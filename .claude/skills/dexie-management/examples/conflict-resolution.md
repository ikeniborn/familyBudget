# Conflict Resolution Example

Real conflict resolution workflow for offline-first sync.

## Scenario

User редактирует transaction offline, но другой user уже изменил эту же транзакцию на сервере.

## Step 1: Conflict Detection

При upload получаем 409 Conflict:

```typescript
async function uploadOperation(op: LocalPendingOperation): Promise<void> {
  const response = await fetchWithTimeout(`/api/v1/facts/${op.server_id}`, {
    method: 'PUT',
    body: JSON.stringify(op.payload)
  });

  if (response.status === 409) {
    // Conflict detected!
    const serverVersion = await response.json();
    const localVersion = await db.budgetFacts
      .where('temp_id').equals(op.temp_id!)
      .first();

    if (localVersion) {
      await handleConflict(op.temp_id!, localVersion, serverVersion);
    }
    return;
  }
  // ... normal flow
}
```

## Step 2: Save Conflict

```typescript
async function handleConflict(
  temp_id: string,
  localVersion: LocalBudgetFact,
  serverVersion: LocalBudgetFact
): Promise<void> {
  logger.warn('[factSync] Conflict detected', {
    temp_id,
    local_amount: fromCents(localVersion.amount),
    server_amount: fromCents(serverVersion.amount)
  });

  // Save conflict
  await db.syncConflicts.add({
    entity_type: 'fact',
    entity_id: serverVersion.id,
    temp_id: temp_id,
    local_version: {
      ...localVersion,
      amount: fromCents(localVersion.amount)  // For readability
    } as Record<string, unknown>,
    server_version: {
      ...serverVersion,
      amount: fromCents(serverVersion.amount)
    } as Record<string, unknown>,
    resolution: null,
    resolved_at: null,
    created_at: new Date()
  });

  // Mark as conflict
  await db.budgetFacts.where('temp_id').equals(temp_id).modify({
    sync_status: 'conflict'
  });
}
```

## Step 3: Resolve Conflict

```typescript
async function resolveConflict(
  conflictId: number,
  strategy: 'server' | 'client'
): Promise<void> {
  const conflict = await db.syncConflicts.get(conflictId);

  if (strategy === 'server') {
    const serverVersion = conflict.server_version as LocalBudgetFact;

    // Replace local with server
    await db.budgetFacts.where('temp_id').equals(conflict.temp_id!).modify({
      ...serverVersion,
      amount: toCents(serverVersion.amount),  // Convert back to cents
      sync_status: 'synced',
      synced_at: new Date()
    });

    // Remove pending operation
    await db.pendingOperations.where('temp_id').equals(conflict.temp_id!).delete();
  } else {
    // Keep local, retry upload
    await db.budgetFacts.where('temp_id').equals(conflict.temp_id!).modify({
      sync_status: 'pending'
    });
  }

  // Mark conflict resolved
  await db.syncConflicts.update(conflictId, {
    resolution: strategy,
    resolved_at: new Date()
  });

  logger.info('[factSync] ✅ Conflict resolved', { conflictId, strategy });
}
```

## UI Integration

```typescript
// Show conflict notification
const conflicts = await db.syncConflicts
  .where('resolution').equals(null)
  .toArray();

if (conflicts.length > 0) {
  showConflictModal({
    conflicts,
    onResolve: (conflictId, strategy) => resolveConflict(conflictId, strategy)
  });
}
```

## Resolution Strategies

1. **Server Wins**: Replace local with server version (safest)
2. **Client Wins**: Force upload local version (может перезаписать чужие изменения)
3. **Manual**: Present both versions to user in UI

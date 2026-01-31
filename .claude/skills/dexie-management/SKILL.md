---
name: Dexie Management
description: Автоматизация работы с Dexie.js offline-first database в проекте Family Budget
version: 1.1.0
author: Family Budget Team
tags: [dexie, offline-first, indexeddb, caching, crud, sync, cents-conversion]
dependencies: [db-management, frontend-development, websocket-realtime]
architecture_refs:
  - $ref: ../../docs/architecture/dexie-integration.md
  - $ref: ../../DEXIE-MIGRATION-SUMMARY.md
  - $ref: ../../docs/architecture/dexie-rollback.md
  - $ref: ../../docs/architecture/pwa.md
user-invocable: false
---

# Dexie Management Skill

Автоматизация разработки offline-first CRUD операций с Dexie.js (v11.0.0, production-ready).

## When to Use

- Создать offline-first CRUD операции для новой сущности
- Реализовать синхронизацию pending operations с сервером
- Мигрировать данные с PGlite на Dexie
- Добавить compound indexes для оптимизации queries
- Реализовать conflict resolution для offline изменений

**Автоматически активируется при:**
- "Добавь offline поддержку для модели X"
- "Создай Dexie CRUD для Y"
- "Реализуй синхронизацию pending operations"
- "Мигрируй данные с PGlite на Dexie"

## Architecture Context

**References:**
- Dexie Integration: [$ref](../../docs/architecture/dexie-integration.md) (418 строк)
- Migration Summary: [$ref](../../DEXIE-MIGRATION-SUMMARY.md) (331 строка)
- Rollback Procedure: [$ref](../../docs/architecture/dexie-rollback.md) (358 строк)
- PWA Offline: [$ref](../../docs/architecture/pwa.md)

**Key Patterns:**

### 1. Cents Conversion (КРИТИЧНО!)
Amount fields хранятся как **integer cents** для точности:
```typescript
import { toCents, fromCents } from '@db/dexie';

// При сохранении
const fact = {
  amount: toCents(123.45) // → 12345 (integer)
};

// При чтении
const displayAmount = fromCents(fact.amount); // → 123.45 (float)
```

**Причина:** JavaScript float precision errors (`0.1 + 0.2 = 0.30000000000000004`)

### 2. Async/Await Pattern (ОБЯЗАТЕЛЬНО!)
Все Dexie operations MUST use `await`:
```typescript
// ✅ CORRECT
await db.budgetFacts.add(newFact);
await db.budgetFacts.where('temp_id').equals(temp_id).modify({ ... });

// ❌ WRONG (silent failure)
db.budgetFacts.add(newFact); // Missing await!
```

### 3. Sync Status Tracking
4 валидных состояния:
- `'synced'` - Successfully synced with server
- `'pending'` - Awaiting sync (added to pending queue)
- `'conflict'` - Sync conflict (needs resolution)
- `'deleted'` - Soft delete (pending server confirmation)

### 4. Compound Indexes Optimization
Используйте compound indexes для fast queries:
```typescript
// Schema definition
budgetFacts: '..., [user_id+date], [user_id+sync_status]'

// Query using compound index
await db.budgetFacts
  .where('[user_id+date]')
  .between([userId, dateFrom], [userId, dateTo])
  .toArray();
```

### 5. Temp ID → Server ID Mapping
Offline-first workflow:
1. Create с `temp_id` (UUID) + `id: null`
2. Add to `pendingOperations` queue
3. Upload to server → получить `server_id`
4. Update `id: server_id`, `sync_status: 'synced'`
5. Remove from `pendingOperations`

## Commands

### Command: offline-crud

**Usage:**
```
Создай offline-first CRUD operations для модели <ModelName> с Dexie.js.
Поля: <field1: type1, field2: type2, ...>
Amount field: <field_name> (если есть)
```

**What It Does:**
1. Создает CRUD functions (create, update, delete, query) в `operations/{model}Operations.ts`
2. Добавляет cents conversion для amount fields
3. Добавляет sync status tracking
4. Добавляет pending operations queue integration
5. Добавляет validation

**Required Imports:**
```typescript
import { db, toCents, fromCents } from '../core/database';
import { logger } from '../utils/logger';
import { validate{Model} } from '../utils/validation';
import { calculateContentHash, generateUUID } from '../utils/hash';
import type { Local{Model} } from '../types/{model}';
```

**Utility Functions Reference:**
- `generateUUID()`: Creates RFC 4122 UUID v4 for temp_id
- `calculateContentHash(data)`: SHA-256 hash for deduplication (async)
- `toCents(amount)`: Convert dollars to integer cents
- `fromCents(cents)`: Convert cents to dollars

См. [hash.ts](../../frontend/shared/db/dexie/utils/hash.ts) и [validation.ts](../../frontend/shared/db/dexie/utils/validation.ts) для details.

---

**Template: CREATE Operation**
```typescript
/**
 * Create {model} (offline-first)
 * ВАЖНО: amount конвертируется в cents
 */
export async function create{Model}(
  data: Omit<Local{Model}, 'id' | 'temp_id' | 'sync_status' | 'content_hash' | 'created_at' | 'updated_at' | 'synced_at'>
): Promise<string> {
  // Trigger sync indicator
  if (typeof window !== 'undefined') {
    (window as any).pgliteIndicator?.onSyncStart();
  }

  try {
    const temp_id = generateUUID();
    const content_hash = await calculateContentHash(data as Record<string, unknown>);

    logger.debug('[Dexie] Creating {model}', { temp_id, data });

    // Validate перед insert
    validate{Model}(data);

    // Convert amount to cents (if applicable)
    const new{Model}: Local{Model} = {
      id: null,
      temp_id,
      ...data,
      amount: toCents(data.amount), // ⚠️ Only if amount field exists
      sync_status: 'pending',
      content_hash,
      created_at: new Date(),
      updated_at: new Date(),
      synced_at: null
    };

    // Insert
    await db.{models}.add(new{Model});

    // Add to pending operations queue
    await addPendingOperation({
      operation: 'create',
      entity_type: '{model}',
      temp_id,
      server_id: null,
      payload: data as Record<string, unknown>,
      attempts: 0,
      max_attempts: 3,
      last_error: null,
      content_hash,
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.info('[Dexie] ✅ {Model} created', { temp_id });

    // Sync complete
    if (typeof window !== 'undefined') {
      (window as any).pgliteIndicator?.onSyncComplete();
    }

    return temp_id;
  } catch (error) {
    logger.error('[Dexie] ❌ {Model} create error:', error);
    if (typeof window !== 'undefined') {
      (window as any).pgliteIndicator?.onSyncError(error as Error);
    }
    throw error;
  }
}
```

**Template: QUERY Operation**
```typescript
/**
 * Query {models} с фильтрами
 * ВАЖНО: amount конвертируется из cents в dollars
 */
export async function query{Models}(filters?: {Model}Filters): Promise<Local{Model}[]> {
  logger.debug('[Dexie] query{Models}', filters);

  let results: Local{Model}[];

  // Оптимизация: используем compound index если возможно
  if (filters?.user_id && filters?.date_from && filters?.date_to) {
    results = await db.{models}
      .where('[user_id+date]')
      .between(
        [filters.user_id, filters.date_from],
        [filters.user_id, filters.date_to],
        true,
        true
      )
      .toArray();
  } else {
    // Fallback: load all и filter в памяти
    results = await db.{models}.toArray();
  }

  // Apply additional filters
  if (filters) {
    results = results.filter(item => {
      if (filters.user_id && item.user_id !== filters.user_id) return false;
      if (filters.is_active !== undefined && item.is_active !== filters.is_active) return false;
      // ... other filters
      return true;
    });
  }

  // Convert amount from cents to dollars (if applicable)
  return results.map(item => ({
    ...item,
    amount: fromCents(item.amount) // ⚠️ Only if amount field exists
  }));
}
```

**Template: UPDATE Operation**
```typescript
/**
 * Update {model} (offline-first)
 */
export async function update{Model}(
  temp_id: string,
  updates: Partial<Pick<Local{Model}, 'field1' | 'field2' | 'amount'>>
): Promise<void> {
  // Trigger sync start
  if (typeof window !== 'undefined') {
    (window as any).pgliteIndicator?.onSyncStart();
  }

  try {
    logger.debug('[Dexie] Updating {model}', { temp_id, updates });

    // Get existing {model}
    const item = await db.{models}.where('temp_id').equals(temp_id).first();
    if (!item) {
      throw new Error(`{Model} not found: ${temp_id}`);
    }

    // Prepare updates (convert amount to cents if needed)
    const updatesWithCents = updates.amount !== undefined
      ? { ...updates, amount: toCents(updates.amount) }
      : updates;

    // Update {model}
    await db.{models}.where('temp_id').equals(temp_id).modify({
      ...updatesWithCents,
      sync_status: 'pending',
      updated_at: new Date()
    });

    // Add to pending operations
    const content_hash = await calculateContentHash({ ...item, ...updates } as Record<string, unknown>);
    await addPendingOperation({
      operation: 'update',
      entity_type: '{model}',
      temp_id,
      server_id: item.id,
      payload: updates as Record<string, unknown>,
      attempts: 0,
      max_attempts: 3,
      last_error: null,
      content_hash,
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.info('[Dexie] ✅ {Model} updated', { temp_id });

    if (typeof window !== 'undefined') {
      (window as any).pgliteIndicator?.onSyncComplete();
    }
  } catch (error) {
    logger.error('[Dexie] ❌ {Model} update error:', error);
    if (typeof window !== 'undefined') {
      (window as any).pgliteIndicator?.onSyncError(error as Error);
    }
    throw error;
  }
}
```

**Template: DELETE Operation**
```typescript
/**
 * Delete {model} (soft delete)
 */
export async function delete{Model}(temp_id: string): Promise<void> {
  // Trigger sync start
  if (typeof window !== 'undefined') {
    (window as any).pgliteIndicator?.onSyncStart();
  }

  try {
    logger.debug('[Dexie] Deleting {model}', { temp_id });

    // Get existing {model}
    const item = await db.{models}.where('temp_id').equals(temp_id).first();
    if (!item) {
      throw new Error(`{Model} not found: ${temp_id}`);
    }

    // Soft delete (mark as deleted)
    await db.{models}.where('temp_id').equals(temp_id).modify({
      sync_status: 'deleted',
      updated_at: new Date()
    });

    // Add to pending operations
    await addPendingOperation({
      operation: 'delete',
      entity_type: '{model}',
      temp_id,
      server_id: item.id,
      payload: {},
      attempts: 0,
      max_attempts: 3,
      last_error: null,
      content_hash: '', // Empty for deletes
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.info('[Dexie] ✅ {Model} deleted', { temp_id });

    if (typeof window !== 'undefined') {
      (window as any).pgliteIndicator?.onSyncComplete();
    }
  } catch (error) {
    logger.error('[Dexie] ❌ {Model} delete error:', error);
    if (typeof window !== 'undefined') {
      (window as any).pgliteIndicator?.onSyncError(error as Error);
    }
    throw error;
  }
}
```

**Template: Type Definitions**
```typescript
// frontend/shared/db/dexie/types/{model}.ts

/**
 * Local{Model} - client-side representation
 */
export interface Local{Model} {
  id: number | null;          // Server ID (null for pending creates)
  temp_id: string;            // Client-side UUID

  // Domain fields
  field1: type1;
  field2: type2 | null;       // Nullable field
  amount: number;             // ⚠️ STORED AS CENTS (integer): $123.45 = 12345

  // Sync tracking
  sync_status: 'synced' | 'pending' | 'conflict' | 'deleted';
  content_hash: string | null; // SHA-256 for deduplication

  // Timestamps
  created_at: Date;
  updated_at: Date;
  synced_at: Date | null;
}

/**
 * Filters for querying {models}
 */
export interface {Model}Filters {
  user_id?: number;
  field1?: type1;
  field2?: type2;
  sync_status?: 'synced' | 'pending' | 'conflict' | 'deleted';
  date_from?: string;   // YYYY-MM-DD
  date_to?: string;     // YYYY-MM-DD
}
```

**ВАЖНО:**
- Amount fields должны иметь комментарий о cents storage
- `sync_status` MUST be union type (не string)
- Filters interface для type-safe queries

---

**Template: Validation Function**
```typescript
// frontend/shared/db/dexie/utils/validation.ts (add to existing file)

/**
 * Validate Local{Model} before insert/update
 */
export function validate{Model}(data: {
  field1: type1;
  field2?: type2;
  amount?: number;  // Optional amount field
}): void {
  // Validate required fields
  if (!data.field1 || data.field1.trim().length === 0) {
    throw new Error('{Model} field1 cannot be empty');
  }

  // Validate amount (if applicable)
  if (data.amount !== undefined && !validateAmount(data.amount)) {
    throw new Error(`Invalid amount: ${data.amount}. Must be a positive number`);
  }

  // Validate field2 constraints (example: enum validation)
  if (data.field2 !== undefined) {
    const allowedValues = ['value1', 'value2'] as const;
    if (!validateType(data.field2, allowedValues)) {
      throw new Error(`Invalid field2: ${data.field2}. Must be one of: ${allowedValues.join(', ')}`);
    }
  }

  // Add other field-specific validation
}
```

**Reference:** См. [validation.ts](../../frontend/shared/db/dexie/utils/validation.ts) для existing validation functions.

---

**Generated Files:**
```
frontend/shared/db/dexie/operations/{model}Operations.ts  # CRUD operations
frontend/shared/db/dexie/types/{model}.ts                 # Type definitions
frontend/shared/db/dexie/utils/validation.ts              # Validation (add validate{Model})
```

---

### Command: sync-operations

**Usage:**
```
Создай sync operations для модели <ModelName> с двусторонней синхронизацией (upload pending + download server data).
```

**What It Does:**
1. Создает `{model}Sync.ts` в `operations/`
2. Реализует upload pending operations
3. Реализует download from server
4. Реализует full sync (upload + download)
5. Добавляет retry logic с exponential backoff

**Template: UPLOAD Pending Operations**
```typescript
/**
 * Upload pending operations to server
 * Синхронизация offline изменений
 */
export async function uploadPending{Models}(): Promise<{
  success: boolean;
  uploaded: number;
  failed: number;
}> {
  logger.info('[{model}Sync] Uploading pending operations...');

  const pendingOps = await db.pendingOperations
    .where('entity_type').equals('{model}')
    .toArray();

  if (pendingOps.length === 0) {
    logger.info('[{model}Sync] No pending operations');
    return { success: true, uploaded: 0, failed: 0 };
  }

  logger.info('[{model}Sync] Found pending operations', { count: pendingOps.length });

  let uploaded = 0;
  let failed = 0;

  for (const op of pendingOps) {
    try {
      await uploadOperation(op);
      uploaded++;
    } catch (error) {
      logger.error('[{model}Sync] ❌ Operation upload failed:', error);
      failed++;

      // Mark operation as failed
      if (op.temp_id) {
        await failPendingOperation(op.temp_id, (error as Error).message);
      }
    }
  }

  logger.info('[{model}Sync] Upload complete', { uploaded, failed });

  return { success: failed === 0, uploaded, failed };
}

/**
 * Upload single operation to server
 */
async function uploadOperation(op: LocalPendingOperation): Promise<void> {
  logger.debug('[{model}Sync] Uploading operation', {
    operation: op.operation,
    temp_id: op.temp_id
  });

  let endpoint: string;
  let method: string;

  switch (op.operation) {
    case 'create':
      endpoint = '/api/v1/{models}';
      method = 'POST';
      break;
    case 'update':
      if (!op.server_id) {
        throw new Error('server_id required for update');
      }
      endpoint = `/api/v1/{models}/${op.server_id}`;
      method = 'PUT';
      break;
    case 'delete':
      if (!op.server_id) {
        throw new Error('server_id required for delete');
      }
      endpoint = `/api/v1/{models}/${op.server_id}`;
      method = 'DELETE';
      break;
    default:
      throw new Error(`Unknown operation: ${op.operation}`);
  }

  const response = await fetchWithTimeout(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: op.operation !== 'delete' ? JSON.stringify(op.payload) : undefined,
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  // Для create получаем server ID
  if (op.operation === 'create') {
    const result = await response.json();
    const serverId = result.id;

    // Confirm operation
    if (op.temp_id) {
      await confirm{Model}Operation(op.temp_id, serverId);
    }
  } else {
    // Для update/delete просто удаляем из pending queue
    if (op.temp_id) {
      await db.pendingOperations.where('temp_id').equals(op.temp_id).delete();
    }
  }

  logger.info('[{model}Sync] ✅ Operation uploaded', {
    operation: op.operation,
    temp_id: op.temp_id
  });
}
```

**Template: DOWNLOAD from Server**
```typescript
/**
 * Download {models} from server (initial sync)
 */
export async function download{Models}(
  userId: number,
  dateFrom?: string,
  dateTo?: string
): Promise<{ success: boolean; count: number }> {
  logger.info('[{model}Sync] Downloading {models}...', { userId, dateFrom, dateTo });

  try {
    let url = `/api/v1/{models}?user_id=${userId}`;
    if (dateFrom) url += `&date_from=${dateFrom}`;
    if (dateTo) url += `&date_to=${dateTo}`;

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch {models}: ${response.status}`);
    }

    const items: Local{Model}[] = await response.json();

    // Bulk insert (amount уже в dollars от сервера, нужна конвертация в cents)
    const itemsWithCents = items.map(item => ({
      ...item,
      amount: toCents(item.amount), // Convert to cents
      sync_status: 'synced' as const,
      synced_at: new Date()
    }));

    await db.{models}.bulkPut(itemsWithCents);

    // Update sync metadata
    await db.syncMetadata.put({
      entity_type: '{models}',
      last_sync_timestamp: new Date(),
      sync_version: 1,
      total_records: items.length
    });

    logger.info('[{model}Sync] ✅ {Models} downloaded', { count: items.length });
    return { success: true, count: items.length };
  } catch (error) {
    logger.error('[{model}Sync] ❌ {Models} download failed:', error);
    return { success: false, count: 0 };
  }
}
```

**Template: FULL SYNC**
```typescript
/**
 * Full sync - upload pending + download server {models}
 */
export async function fullSync{Models}(
  userId: number,
  dateFrom?: string,
  dateTo?: string
): Promise<{
  success: boolean;
  uploaded: number;
  downloaded: number;
  failed: number;
}> {
  logger.info('[{model}Sync] Starting full sync...', { userId, dateFrom, dateTo });

  // 1. Upload pending operations first
  const uploadResult = await uploadPending{Models}();

  // 2. Download {models} from server
  const downloadResult = await download{Models}(userId, dateFrom, dateTo);

  const result = {
    success: uploadResult.success && downloadResult.success,
    uploaded: uploadResult.uploaded,
    downloaded: downloadResult.count,
    failed: uploadResult.failed
  };

  logger.info('[{model}Sync] Full sync complete', result);

  return result;
}
```

**Template: AUTO-SYNC с Retry Logic**
```typescript
/**
 * Auto-sync with exponential backoff retry
 */
export async function autoSync{Models}(
  userId: number,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<void> {
  let retries = 0;
  let delay = initialDelay;

  while (retries < maxRetries) {
    try {
      const result = await fullSync{Models}(userId);

      if (result.success) {
        logger.info('[{model}Sync] ✅ Auto-sync complete');
        return;
      }

      // Partial success - retry failed operations
      if (result.failed > 0) {
        logger.warn('[{model}Sync] Partial sync failure, retrying...', {
          failed: result.failed,
          retries
        });
      }
    } catch (error) {
      logger.error('[{model}Sync] ❌ Auto-sync error:', error);
    }

    // Exponential backoff
    retries++;
    if (retries < maxRetries) {
      logger.info('[{model}Sync] Retrying after ${delay}ms...', { retries, maxRetries });
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }

  logger.error('[{model}Sync] ❌ Auto-sync failed after ${maxRetries} retries');
}
```

---

**Template: CONFLICT RESOLUTION**

**Когда возникает конфликт:**
- Local version изменена (sync_status: 'pending')
- Server version тоже изменена (другой updated_at)
- При upload получаем 409 Conflict или version mismatch

**Detect and Log Conflict:**
```typescript
/**
 * Handle sync conflict
 * Сохраняет конфликт в syncConflicts table для manual resolution
 */
async function handleConflict(
  temp_id: string,
  localVersion: Local{Model},
  serverVersion: Local{Model}
): Promise<void> {
  logger.warn('[{model}Sync] Conflict detected', { temp_id });

  // Save to conflicts table
  await db.syncConflicts.add({
    entity_type: '{model}',
    entity_id: serverVersion.id,
    temp_id: temp_id,
    local_version: localVersion as Record<string, unknown>,
    server_version: serverVersion as Record<string, unknown>,
    resolution: null,
    resolved_at: null,
    created_at: new Date()
  });

  // Mark local item as conflict
  await db.{models}.where('temp_id').equals(temp_id).modify({
    sync_status: 'conflict'
  });

  logger.info('[{model}Sync] Conflict saved for manual resolution');
}
```

**Resolution Strategies:**

1. **Server Wins**: Replace local with server version
2. **Client Wins**: Force upload local version
3. **Merge**: Combine changes (requires custom logic)
4. **Manual**: Present to user in UI

**Resolve Conflict (Server Wins):**
```typescript
/**
 * Resolve conflict with strategy
 */
export async function resolveConflict(
  conflictId: number,
  strategy: 'server' | 'client' | 'manual' = 'server'
): Promise<void> {
  const conflict = await db.syncConflicts.get(conflictId);
  if (!conflict) throw new Error(`Conflict not found: ${conflictId}`);

  if (strategy === 'server') {
    // Server wins - replace local with server version
    const serverVersion = conflict.server_version as Local{Model};

    await db.{models}.where('temp_id').equals(conflict.temp_id!).modify({
      ...serverVersion,
      amount: toCents(serverVersion.amount), // Convert to cents if needed
      sync_status: 'synced',
      synced_at: new Date()
    });

    // Remove from pending queue (если была)
    await db.pendingOperations.where('temp_id').equals(conflict.temp_id!).delete();

    // Mark conflict as resolved
    await db.syncConflicts.update(conflictId, {
      resolution: 'server',
      resolved_at: new Date()
    });

    logger.info('[{model}Sync] ✅ Conflict resolved (server wins)', { conflictId });
  } else if (strategy === 'client') {
    // Client wins - keep local version, force upload
    await db.{models}.where('temp_id').equals(conflict.temp_id!).modify({
      sync_status: 'pending'
    });

    // Mark conflict as resolved
    await db.syncConflicts.update(conflictId, {
      resolution: 'client',
      resolved_at: new Date()
    });

    logger.info('[{model}Sync] ✅ Conflict resolved (client wins)', { conflictId });
  }
  // 'manual' strategy requires UI interaction
}
```

**Generated Files:**
```
frontend/shared/db/dexie/operations/{model}Sync.ts  # Sync operations + conflict resolution
```

---

### Command: migration-guide

**Usage:**
```
Мигрируй данные модели <ModelName> с PGlite на Dexie.
```

**Recommendation:**
Вместо сложной миграции данных рекомендуется **re-sync from server**:
- Проще implementation (минимум кода)
- Гарантированная data integrity (source of truth - сервер)
- Меньше риска ошибок миграции
- Автоматическая валидация данных

**Template: Re-sync from Server**
```typescript
/**
 * Re-sync {models} from server (recommended migration)
 * Замена PGlite → Dexie через полную переиндексацию
 */
export async function resync{Models}FromServer(
  userId: number,
  dateFrom?: string,
  dateTo?: string
): Promise<{
  success: boolean;
  deleted: number;
  downloaded: number;
}> {
  logger.info('[{model}Migration] Starting re-sync from server...');

  try {
    // 1. Clear existing PGlite data (if needed)
    const deletedCount = await db.{models}.clear();
    logger.info('[{model}Migration] Cleared existing data', { count: deletedCount });

    // 2. Download fresh data from server
    const downloadResult = await download{Models}(userId, dateFrom, dateTo);

    if (!downloadResult.success) {
      throw new Error('Failed to download {models} from server');
    }

    logger.info('[{model}Migration] ✅ Re-sync complete', {
      deleted: deletedCount,
      downloaded: downloadResult.count
    });

    return {
      success: true,
      deleted: deletedCount,
      downloaded: downloadResult.count
    };
  } catch (error) {
    logger.error('[{model}Migration] ❌ Re-sync failed:', error);
    return { success: false, deleted: 0, downloaded: 0 };
  }
}
```

**Alternative: Direct Migration (для reference only)**
Для случаев когда re-sync невозможен:
- См. `frontend/shared/db/dexie/migration/migrateFromPGlite.ts` (250+ строк)
- Включает progress reporting, data verification, rollback support
- НЕ рекомендуется для новых миграций

**Generated Files:**
```
frontend/shared/db/dexie/migration/{model}Migration.ts  # Migration logic
```

---

## Examples

### Example 1: RecurringPlan CRUD

**Task:** Создай offline-first CRUD operations для модели RecurringPlan с Dexie.js

**Context:**
- RecurringPlan - регулярные платежи (зарплата, аренда, подписки)
- Используется для автоматического создания budget facts
- Amount хранится в cents для точности

**Command:**
```
Создай offline-first CRUD operations для модели RecurringPlan с Dexie.js.
Поля: user_id (number), article_id (number), financial_center_id (number),
      amount (number, cents), frequency (string), day_of_month (number), is_active (boolean)
Amount field: amount
```

**Generated Code Structure:**

```typescript
// frontend/shared/db/dexie/types/recurringPlan.ts
export interface LocalRecurringPlan {
  id: number | null;
  temp_id: string;
  user_id: number;
  article_id: number;
  financial_center_id: number;
  amount: number;  // ⚠️ STORED AS CENTS
  frequency: string;
  day_of_month: number | null;
  is_active: boolean;
  sync_status: 'synced' | 'pending' | 'conflict' | 'deleted';
  content_hash: string | null;
  created_at: Date;
  updated_at: Date;
  synced_at: Date | null;
}

export interface RecurringPlanFilters {
  user_id?: number;
  article_id?: number;
  is_active?: boolean;
  frequency?: string;
}
```

```typescript
// frontend/shared/db/dexie/utils/validation.ts (add)
export function validateRecurringPlan(plan: {
  amount: number;
  frequency: string;
  day_of_month: number | null;
}): void {
  // Validate amount
  if (!validateAmount(plan.amount)) {
    throw new Error(`Invalid amount: ${plan.amount}`);
  }

  // Validate frequency
  const allowedFrequencies = ['daily', 'weekly', 'monthly', 'yearly'] as const;
  if (!validateType(plan.frequency, allowedFrequencies)) {
    throw new Error(`Invalid frequency: ${plan.frequency}`);
  }

  // Validate day_of_month (1-31 or null)
  if (plan.day_of_month !== null) {
    if (!Number.isInteger(plan.day_of_month) ||
        plan.day_of_month < 1 ||
        plan.day_of_month > 31) {
      throw new Error(`Invalid day_of_month: ${plan.day_of_month}`);
    }
  }
}
```

```typescript
// frontend/shared/db/dexie/operations/recurringPlanOperations.ts
import { db, toCents, fromCents } from '../core/database';
import { logger } from '../utils/logger';
import { validateRecurringPlan } from '../utils/validation';
import { calculateContentHash, generateUUID } from '../utils/hash';
import type { LocalRecurringPlan, RecurringPlanFilters } from '../types/recurringPlan';

export async function createRecurringPlan(
  data: Omit<LocalRecurringPlan, 'id' | 'temp_id' | 'sync_status' | 'content_hash' | 'created_at' | 'updated_at' | 'synced_at'>
): Promise<string> {
  const temp_id = generateUUID();
  const content_hash = await calculateContentHash(data as Record<string, unknown>);

  validateRecurringPlan(data);

  const newPlan: LocalRecurringPlan = {
    id: null,
    temp_id,
    ...data,
    amount: toCents(data.amount),  // Convert to cents
    sync_status: 'pending',
    content_hash,
    created_at: new Date(),
    updated_at: new Date(),
    synced_at: null
  };

  await db.recurringPlans.add(newPlan);

  // Add to pending queue
  await db.pendingOperations.add({
    operation: 'create',
    entity_type: 'recurring_plan',
    temp_id,
    server_id: null,
    payload: data as Record<string, unknown>,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    content_hash,
    created_at: new Date(),
    updated_at: new Date()
  });

  logger.info('[Dexie] ✅ RecurringPlan created', { temp_id });
  return temp_id;
}

export async function queryRecurringPlans(
  filters?: RecurringPlanFilters
): Promise<LocalRecurringPlan[]> {
  let results = await db.recurringPlans.toArray();

  if (filters) {
    results = results.filter(plan => {
      if (filters.user_id && plan.user_id !== filters.user_id) return false;
      if (filters.article_id && plan.article_id !== filters.article_id) return false;
      if (filters.is_active !== undefined && plan.is_active !== filters.is_active) return false;
      if (filters.frequency && plan.frequency !== filters.frequency) return false;
      return true;
    });
  }

  // Convert amount from cents to dollars
  return results.map(plan => ({
    ...plan,
    amount: fromCents(plan.amount)
  }));
}
```

**Usage:**
```typescript
// Create recurring plan for monthly salary
const temp_id = await createRecurringPlan({
  user_id: 1,
  article_id: 5,  // "Зарплата"
  financial_center_id: 2,
  amount: 100000,  // $100,000 (will be stored as 10,000,000 cents)
  frequency: 'monthly',
  day_of_month: 25,
  is_active: true
});

// Query active plans
const activePlans = await queryRecurringPlans({
  user_id: 1,
  is_active: true
});
```

**Files Created:**
- `frontend/shared/db/dexie/types/recurringPlan.ts` (60 строк)
- `frontend/shared/db/dexie/operations/recurringPlanOperations.ts` (200 строк)
- `frontend/shared/db/dexie/utils/validation.ts` (добавлено validateRecurringPlan)

---

### Example 2: Conflict Resolution для BudgetFact

**Scenario:** User редактирует transaction offline, но другой user уже изменил эту же транзакцию на сервере.

**Step 1: Conflict Detection**
```typescript
// При upload получаем 409 Conflict
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

**Step 2: Save Conflict**
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

**Step 3: Resolve Conflict (User Choice)**
```typescript
// User выбирает "Server Wins"
await resolveConflict(conflictId, 'server');

// Или "Client Wins"
await resolveConflict(conflictId, 'client');

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

**UI Integration:**
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

---

### Example 3: Shopping List Sync with Server

**Task:** Синхронизация shopping lists между offline client и server

**Step 1: Download Shopping Lists**
```typescript
// frontend/shared/db/dexie/operations/shoppingSync.ts
import { db, toCents } from '../core/database';
import { logger } from '../utils/logger';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import type { LocalShoppingList } from '../types/shopping';

export async function downloadShoppingLists(
  userId: number
): Promise<{ success: boolean; count: number }> {
  logger.info('[shoppingSync] Downloading shopping lists...', { userId });

  try {
    const response = await fetchWithTimeout(
      `/api/v1/shopping-lists?user_id=${userId}`,
      { method: 'GET', credentials: 'include' }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch shopping lists: ${response.status}`);
    }

    const lists: LocalShoppingList[] = await response.json();

    // Bulk insert с type conversion
    const listsWithCents = lists.map(list => ({
      ...list,
      sync_status: 'synced' as const,
      synced_at: new Date()
    }));

    await db.shoppingLists.bulkPut(listsWithCents);

    // Update metadata
    await db.syncMetadata.put({
      entity_type: 'shopping_lists',
      last_sync_timestamp: new Date(),
      sync_version: 1,
      total_records: lists.length
    });

    logger.info('[shoppingSync] ✅ Shopping lists downloaded', { count: lists.length });
    return { success: true, count: lists.length };
  } catch (error) {
    logger.error('[shoppingSync] ❌ Download failed:', error);
    return { success: false, count: 0 };
  }
}
```

**Step 2: Upload Pending Changes**
```typescript
export async function uploadPendingShoppingLists(): Promise<{
  success: boolean;
  uploaded: number;
  failed: number;
}> {
  const pendingOps = await db.pendingOperations
    .where('entity_type').equals('shopping_list')
    .toArray();

  let uploaded = 0;
  let failed = 0;

  for (const op of pendingOps) {
    try {
      let endpoint = '/api/v1/shopping-lists';
      let method = 'POST';

      if (op.operation === 'update') {
        endpoint = `/api/v1/shopping-lists/${op.server_id}`;
        method = 'PUT';
      } else if (op.operation === 'delete') {
        endpoint = `/api/v1/shopping-lists/${op.server_id}`;
        method = 'DELETE';
      }

      const response = await fetchWithTimeout(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: op.operation !== 'delete' ? JSON.stringify(op.payload) : undefined,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      // Confirm operation
      if (op.operation === 'create') {
        const result = await response.json();
        await db.shoppingLists.where('temp_id').equals(op.temp_id!).modify({
          id: result.id,
          sync_status: 'synced',
          synced_at: new Date()
        });
      }

      // Remove from pending queue
      await db.pendingOperations.where('temp_id').equals(op.temp_id!).delete();

      uploaded++;
    } catch (error) {
      failed++;
      logger.error('[shoppingSync] Upload failed:', error);
    }
  }

  return { success: failed === 0, uploaded, failed };
}
```

**Step 3: Full Sync**
```typescript
export async function fullShoppingSync(userId: number): Promise<{
  success: boolean;
  uploaded: number;
  downloaded: number;
  failed: number;
}> {
  // Upload pending first
  const uploadResult = await uploadPendingShoppingLists();

  // Then download fresh data
  const downloadResult = await downloadShoppingLists(userId);

  return {
    success: uploadResult.success && downloadResult.success,
    uploaded: uploadResult.uploaded,
    downloaded: downloadResult.count,
    failed: uploadResult.failed
  };
}
```

**Usage:**
```typescript
// On app startup or network reconnect
const result = await fullShoppingSync(currentUserId);

if (result.success) {
  console.log(`✅ Sync complete: ${result.uploaded} uploaded, ${result.downloaded} downloaded`);
} else {
  console.log(`⚠️ Partial sync: ${result.failed} failed`);
}
```

---

## Validation Checklist

**Перед commit:**

- [ ] **Cents Conversion:** Amount fields используют `toCents()` при save, `fromCents()` при load
- [ ] **Async/Await:** Все Dexie operations имеют `await`
- [ ] **Sync Status:** Используются только валидные значения (`'synced' | 'pending' | 'conflict' | 'deleted'`)
- [ ] **Compound Indexes:** Query оптимизирован через compound indexes (если применимо)
- [ ] **Temp ID Mapping:** Workflow temp_id → server_id реализован корректно
- [ ] **Content Hash:** Используется для deduplication в `pendingOperations`
- [ ] **Error Handling:** Try-catch блоки обрабатывают все async operations
- [ ] **Logging:** Используется `logger.debug/info/warn/error` для трейсинга
- [ ] **Validation:** Input data валидируется перед insert/update
- [ ] **Tests:** Создан test файл `__tests__/{model}Operations.test.ts` (опционально)

---

## Common Mistakes

### 1. Amount as Float
**Symptom:** Precision errors (0.1 + 0.2 = 0.30000000000000004)

**Fix:**
```typescript
// ❌ WRONG
const fact = { amount: 123.45 };
await db.budgetFacts.add(fact); // Stored as float

// ✅ CORRECT
const fact = { amount: toCents(123.45) }; // 12345 (integer)
await db.budgetFacts.add(fact);
```

**Reference:** `dexie-integration.md#cents-conversion`

---

### 2. Missing Await
**Symptom:** Operations silently fail, no error thrown, data not saved

**Fix:**
```typescript
// ❌ WRONG
db.budgetFacts.add(newFact); // Missing await!

// ✅ CORRECT
await db.budgetFacts.add(newFact);
await db.budgetFacts.where('temp_id').equals(temp_id).modify({ ... });
```

**Reference:** `frontend/shared/db/dexie/operations/factOperations.ts:65`

---

### 3. Неправильный Sync Status
**Symptom:** Invalid sync_status value, queries fail

**Fix:**
```typescript
// ❌ WRONG
await db.budgetFacts.add({
  ...fact,
  sync_status: 'created' // Invalid value!
});

// ✅ CORRECT
await db.budgetFacts.add({
  ...fact,
  sync_status: 'pending' // Valid value
});
```

**Valid values:** `'synced'`, `'pending'`, `'conflict'`, `'deleted'`

**Reference:** `frontend/shared/db/dexie/types/fact.ts:34`

---

### 4. Забытый Pending Queue
**Symptom:** Offline changes не синхронизируются с сервером

**Fix:**
```typescript
// ❌ WRONG (забыли добавить в pending queue)
await db.budgetFacts.add(newFact);

// ✅ CORRECT
await db.budgetFacts.add(newFact);

// Add to pending operations
await db.pendingOperations.add({
  operation: 'create',
  entity_type: 'fact',
  temp_id: newFact.temp_id,
  server_id: null,
  payload: { ...newFact },
  attempts: 0,
  max_attempts: 3,
  last_error: null,
  content_hash: await calculateContentHash(newFact),
  created_at: new Date(),
  updated_at: new Date()
});
```

**Reference:** `frontend/shared/db/dexie/operations/factOperations.ts:68-80`

---

### 5. Неоптимизированные Queries
**Symptom:** Slow queries, full table scans

**Fix:**
```typescript
// ❌ WRONG (full table scan)
const results = (await db.budgetFacts.toArray())
  .filter(fact => fact.user_id === userId && fact.date >= dateFrom && fact.date <= dateTo);

// ✅ CORRECT (использует compound index [user_id+date])
const results = await db.budgetFacts
  .where('[user_id+date]')
  .between([userId, dateFrom], [userId, dateTo], true, true)
  .toArray();
```

**Reference:** `frontend/shared/db/dexie/core/database.ts:77` (compound indexes definition)

---

## Related Skills

**Dependencies:**
- **db-management**: Create SQLAlchemy models и migrations для server-side (при создании новой сущности)
- **frontend-development**: Integrate Dexie operations с frontend UI (HTMX triggers, WebSocket updates)
- **websocket-realtime**: Broadcast server changes → update Dexie local data
- **api-development**: Create REST API endpoints для sync operations

**Cross-references:**
- Используйте **api-development** для создания `/api/v1/{models}` endpoints (CRUD)
- Используйте **websocket-realtime** для real-time updates после server sync
- Используйте **db-management** для SCD Type 2 patterns (если dimension table)

---

## Quick Links

**Documentation:**
- [Dexie Integration](../../docs/architecture/dexie-integration.md) - Main architecture doc
- [Migration Summary](../../DEXIE-MIGRATION-SUMMARY.md) - Migration status
- [Rollback Procedure](../../docs/architecture/dexie-rollback.md) - Emergency rollback

**Code Examples:**
- [factOperations.ts](../../frontend/shared/db/dexie/operations/factOperations.ts) - Budget Facts CRUD
- [factSync.ts](../../frontend/shared/db/dexie/operations/factSync.ts) - Sync logic
- [database.ts](../../frontend/shared/db/dexie/core/database.ts) - Schema definition

**Tests:**
- [DexieManager.test.ts](../../frontend/shared/db/dexie/__tests__/DexieManager.test.ts) - Integration tests
- [centsConversion.test.ts](../../frontend/shared/db/dexie/__tests__/centsConversion.test.ts) - Precision tests

---

## Bundle Size Impact

**Before (PGlite):** 3.4MB
**After (Dexie):** 29KB
**Reduction:** 99.1% (3.37MB saved)

**See:** `DEXIE-MIGRATION-SUMMARY.md#bundle-size-reduction`

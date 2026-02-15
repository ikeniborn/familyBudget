# Dexie.js Offline & IndexedDB Integration - Interactive Learning Tour

**Date:** 2026-02-15
**Duration:** 25-30 minutes
**Difficulty:** Hard
**Category:** Frontend (Offline-first architecture)

---

## Overview

Welcome to the **Dexie.js Offline & IndexedDB Integration Tour**! This interactive guide will help you understand Family Budget's offline-first architecture, from high-level concepts down to implementation details.

**What you'll learn:**
- ✅ Why Family Budget migrated from PGlite to Dexie.js
- ✅ How IndexedDB powers offline-first functionality
- ✅ Database schema (13 tables) and indexing strategy
- ✅ Cents conversion pattern for financial precision
- ✅ Offline CRUD operations with automatic sync
- ✅ Conflict resolution and retry logic
- ✅ Data flow from browser → IndexedDB → API → PostgreSQL

---

## Table of Contents

1. [**Migration Context (5 min)**](#1-migration-context) - Why Dexie replaced PGlite
2. [**Architecture Overview (5 min)**](#2-architecture-overview) - Stack and data flow
3. [**Database Schema (7 min)**](#3-database-schema) - 13 tables, indexes, and versioning
4. [**Cents Conversion (3 min)**](#4-cents-conversion) - Financial precision pattern
5. [**Offline CRUD (5 min)**](#5-offline-crud) - Create, read, update, delete operations
6. [**Sync & Conflict Resolution (5 min)**](#6-sync--conflict-resolution) - Bidirectional sync, retry logic

---

## 1. Migration Context

### The Problem with PGlite

Family Budget originally used **PGlite** (PostgreSQL in the browser via WebAssembly) for offline functionality.

**PGlite v0.3.x issues:**
- ❌ **Alpha status** - Unstable, critical production bugs
- ❌ **Massive bundle size** - 3.4MB (99.1% of frontend bundle)
- ❌ **Memory issues** - OOM crashes on mobile devices
- ❌ **Limited browser support** - Safari IndexedDB integration issues

**Example bundle analysis (before migration):**
```
Total Bundle: 3.43 MB
├── PGlite WASM: 3.4 MB (99.1%)
└── Application code: 30 KB (0.9%)
```

### Why Dexie.js?

**Dexie.js** is a production-ready IndexedDB wrapper (10+ years, 10k+ GitHub stars).

**Migration results (v11.0.0):**
- ✅ **Bundle size:** 99.1% reduction (3.4MB → 29KB)
- ✅ **Stability:** Alpha → Production-ready
- ✅ **Performance:** ±20% acceptable slowdown (250ms → 280-300ms dashboard load)
- ✅ **API compatibility:** Transparent replacement (minimal code changes)

**Bundle analysis (after migration):**
```
Total Bundle: 59 KB
├── Dexie.js: 29 KB (49.2%)
└── Application code: 30 KB (50.8%)
```

**Key decisions:**
- ⚠️ **Trade-off accepted:** SQL queries → NoSQL (IndexedDB)
- ✅ **Performance acceptable:** 20% slower queries vs 99.1% bundle reduction
- ✅ **Full migration:** PGlite removed completely (v11.3.1)

**Timeline:**
- **v11.0.0** (2026-01-31): Initial Dexie release
- **v11.3.1** (2026-02-05): PGlite legacy removed
- **v11.5.0** (2026-02-09): Separate sync periods for Facts/Plans

---

## 2. Architecture Overview

### Stack Diagram

```
┌─────────────────────────────────────────────┐
│           DataLayer (abstraction)            │
│  getArticles(), getFacts(), sync(), etc.    │
├─────────────────────────────────────────────┤
│  Strategy: Dexie-first, API fallback        │
│  ⚠️ MINIMAL CHANGES (only imports)          │
└────────────┬────────────────────────────────┘
             │
   ┌─────────┴────────┐
   │                  │
┌──▼──────────┐  ┌───▼──────┐
│DexieManager │  │REST API  │
│  (IndexedDB)│  │ Fallback │
└──┬──────────┘  └──────────┘
   │
┌──▼────────────────────┐
│    Dexie.js API       │
│  (Promise-based)      │
│  - Table operations   │
│  - Compound indexes   │
│  - Transactions       │
└──┬────────────────────┘
   │
┌──▼────────────────────┐
│ IndexedDB (Native)    │
│ (Browser Storage)     │
│ - Key-value store     │
│ - Async API           │
│ - 50MB+ quota         │
└───────────────────────┘
```

### Core Components

**1. DexieManager** (`frontend/shared/db/dexie/DexieManager.ts`)
- Main API interface
- Compatible with PGliteManager API (drop-in replacement)
- Initialization, CRUD, sync operations
- **File size:** ~650 lines

**2. Database Schema** (`frontend/shared/db/dexie/core/database.ts`)
- 13 tables (articles, facts, shopping, etc.)
- Compound indexes for performance
- Cents conversion helpers (`toCents()`, `fromCents()`)
- **File size:** ~200 lines

**3. Operations Modules** (`frontend/shared/db/dexie/operations/*.ts`)
- **schemaOperations.ts** - Reference data (articles, financial centers)
- **factOperations.ts** - Budget facts CRUD
- **bulkOperations.ts** - Batch operations (bulk insert)
- **shoppingOperations.ts** - Shopping lists
- **factSync.ts**, **referenceSync.ts**, **shoppingSync.ts** - Bidirectional sync
- **pruningOperations.ts** - Automatic cleanup (hybrid strategy: setInterval + Visibility API + requestIdleCallback)
- **conflictOperations.ts** - Conflict detection and resolution

**4. Migration** (`frontend/shared/db/dexie/migration/*.ts`)
- **migrateFromPGlite.ts** - One-time migration (deprecated in v11.3.1)
- **cleanupLegacyDB.ts** - Automatic cleanup of Legacy IndexedDB v5-v10

---

## 3. Database Schema

### Schema Version History

| Version | Date | Changes | Migration |
|---------|------|---------|-----------|
| **v3** | 2026-02-09 | Remove `user_id` from Stores/ProductGroups (global reference data) | Auto-upgrade |
| **v2** | 2026-02-06 | Add `creator_id` indexes to Shopping Lists | Auto-upgrade |
| **v1** | 2026-01-31 | Initial Dexie schema (PGlite replacement) | Manual re-sync |

**Dynamic version detection:**
```typescript
// database.ts:48-77
async function getDatabaseVersion(): Promise<number> {
  const exists = await Dexie.exists('FamilyBudgetDB');
  if (!exists) return DEFAULT_SCHEMA_VERSION;

  // Open to get current version
  const tempDb = new Dexie('FamilyBudgetDB');
  await tempDb.open();
  const currentVersion = tempDb.verno;

  // Use maximum (prevents downgrade errors)
  return Math.max(currentVersion, DEFAULT_SCHEMA_VERSION);
}
```

**How migrations work:**
- User visits site → Dexie checks IndexedDB version
- If version < DEFAULT_SCHEMA_VERSION → auto-upgrade on `db.open()`
- Data preserved, missing indexes added
- **Zero user intervention** - seamless upgrade

---

### Reference Data Tables

**Articles (budget categories):**
```typescript
// 13 tables total, showing key reference data
articles: 'id, user_id, type, parent_id, is_active'

// Stores article tree structure (Closure Table pattern)
articleHierarchy: '[ancestor_id+descendant_id], ancestor_id, descendant_id, depth'

// Financial Centers (accounts, wallets)
financialCenters: 'id, user_id, is_active'

// Cost Centers (projects, departments)
costCenters: 'id, user_id, is_active'
```

**Compound index example:**
```typescript
// Primary key: [ancestor_id+descendant_id]
// Enables fast query: "Get all children of article X"
await db.articleHierarchy
  .where('[ancestor_id+descendant_id]')
  .between([ancestorId, 0], [ancestorId, Infinity])
  .toArray();
```

---

### Transactional Data Tables

**Budget Facts (transactions):**
```typescript
budgetFacts: 'temp_id, id, user_id, article_id, financial_center_id, cost_center_id, date, sync_status, [user_id+date], [user_id+sync_status]'

// CRITICAL: amount stored as integer cents
// Example: $123.45 stored as 12345
// Conversion: save → toCents(123.45) = 12345 | load → fromCents(12345) = 123.45
```

**Pending Operations (sync queue):**
```typescript
pendingOperations: '++id, content_hash, entity_type, temp_id, server_id, next_retry_at'

// Tracks offline operations awaiting sync
// Exponential backoff: 2s, 4s, 8s, 16s, 32s
```

**Recurring Plans:**
```typescript
recurringPlans: 'id, user_id, article_id, financial_center_id, is_active'

// MMDD encoding for dates (e.g., 0131 = January 31)
// Date validation: 0229 only in leap years
```

---

### Shopping Lists Tables

```typescript
// Shopping lists (with creator_id for Shared Family Budget)
shoppingLists: 'temp_id, id, user_id, creator_id, is_completed, sync_status'

// List items (with position for sorting)
shoppingListItems: 'temp_id, id, creator_id, shopping_list_temp_id, position, sync_status, [shopping_list_temp_id+position]'

// Stores (global reference data, no user_id since v3)
stores: 'id, name'

// Product groups (categories, global since v3)
productGroups: 'id, parent_id, name'

// Product group hierarchy (Closure Table)
productGroupHierarchy: '[ancestor_id+descendant_id], ancestor_id, descendant_id, depth'
```

**Schema v3 change (2026-02-09):**
- **Before:** `stores: 'id, user_id, name'`
- **After:** `stores: 'id, name'` (user_id removed)
- **Reason:** Stores/ProductGroups are global reference data, not user-specific

---

### Metadata Tables

```typescript
// Sync tracking (last sync timestamp per entity)
syncMetadata: 'entity_type, last_sync_timestamp'

// Schema migration history
schemaMigrations: 'version, applied_at'
```

---

## 4. Cents Conversion

### Why Integer Cents?

JavaScript numbers use IEEE 754 floating-point precision:

```javascript
// ❌ PROBLEM: Float precision errors
0.1 + 0.2 = 0.30000000000000004  // Not 0.3!
0.07 * 100 = 7.000000000000001   // Not 7!

// Financial calculation gone wrong
let balance = 0;
balance += 0.1;
balance += 0.2;
console.log(balance === 0.3);  // false! (balance = 0.30000000000000004)
```

**Real-world impact:**
- ❌ Transaction totals incorrect by fractions of cents
- ❌ Budget balances drift over time
- ❌ Fails validation checks (e.g., `total === sum(items)`)

**Solution: Store amounts as integer cents**

```typescript
// database.ts:262-286
export const toCents = (dollars: number): number => Math.round(dollars * 100);
export const fromCents = (cents: number): number => cents / 100;

// Example
const amount = 123.45;  // dollars
const stored = toCents(amount);  // 12345 (integer cents)
const loaded = fromCents(stored);  // 123.45 (dollars)
```

---

### Usage in Code

**Saving to Dexie:**
```typescript
// factOperations.ts:47-57
const newFact: LocalBudgetFact = {
  temp_id,
  user_id: 1,
  amount: toCents(123.45), // ← Convert to cents (12345)
  date: '2026-02-15',
  sync_status: 'pending'
};

await db.budgetFacts.add(newFact);
```

**Loading from Dexie:**
```typescript
// factOperations.ts:228-246
const facts = await db.budgetFacts
  .where('[user_id+date]')
  .between([userId, dateFrom], [userId, dateTo])
  .toArray();

// Convert cents → dollars for display
return facts.map(f => ({
  ...f,
  amount: fromCents(f.amount) // ← Convert from cents (12345 → 123.45)
}));
```

**API mapping:**
```typescript
// apiMapper.ts
export function mapAPIFactToLocal(apiFact: APIBudgetFact): LocalBudgetFact {
  return {
    ...apiFact,
    amount: toCents(apiFact.amount) // API sends dollars, Dexie stores cents
  };
}
```

---

### Testing

**Precision tests** (`__tests__/centsConversion.test.ts`):
```typescript
test('toCents handles edge cases', () => {
  expect(toCents(0.1 + 0.2)).toBe(30);  // Not 29 or 31!
  expect(toCents(123.456789)).toBe(12346);  // Rounds correctly
  expect(toCents(0.005)).toBe(1);  // Rounds up (banker's rounding)
});

test('fromCents is inverse of toCents', () => {
  const original = 123.45;
  expect(fromCents(toCents(original))).toBe(original);
});
```

**Key insight:** Always use `toCents()`/`fromCents()` - never store floats!

---

## 5. Offline CRUD

### Create Operation

**User flow:**
1. User clicks "Add Transaction" (offline)
2. Frontend creates temp_id (UUID)
3. Dexie saves fact with `sync_status: 'pending'`
4. Pending operation added to sync queue
5. When online → automatic sync to server

**Code walkthrough:**

```typescript
// factOperations.ts:28-85
export async function createFact(fact): Promise<string> {
  // 1. Generate UUID for temp_id
  const temp_id = generateUUID();

  // 2. Calculate content hash (for deduplication)
  const content_hash = await calculateContentHash(fact);

  // 3. Validate fact data
  validateFact({
    amount: fact.amount,
    date: fact.date,
    record_type: fact.record_type
  });

  // 4. Convert amount to cents
  const newFact: LocalBudgetFact = {
    id: null,  // Server assigns real ID
    temp_id,
    ...fact,
    amount: toCents(fact.amount), // ← Financial precision
    sync_status: 'pending',
    content_hash,
    created_at: new Date()
  };

  // 5. Insert into Dexie
  await db.budgetFacts.add(newFact);

  // 6. Add to sync queue
  await addPendingOperation({
    operation: 'create',
    entity_type: 'fact',
    temp_id,
    payload: fact,
    attempts: 0,
    next_retry_at: null  // Immediate sync
  });

  return temp_id;
}
```

**Atomic transaction guarantee:**
- ✅ Both `budgetFacts.add()` and `addPendingOperation()` succeed together
- ✅ Or both fail (no partial state)

---

### Read Operation (with filters)

**User flow:**
1. Dashboard requests facts for date range
2. DataLayer queries Dexie first (offline-first)
3. If Dexie empty → fallback to API
4. API results cached in Dexie for offline access

**Code walkthrough:**

```typescript
// factOperations.ts:228-246
export async function queryFacts(filters?: FactFilters): Promise<LocalBudgetFact[]> {
  const {
    user_id,
    date_from,
    date_to,
    article_id,
    sync_status
  } = filters || {};

  // Use compound index for fast query
  let query = db.budgetFacts;

  // Filter by user + date range (uses [user_id+date] compound index)
  if (user_id && date_from && date_to) {
    query = query
      .where('[user_id+date]')
      .between([user_id, date_from], [user_id, date_to]);
  }

  const facts = await query.toArray();

  // Additional in-memory filters
  let result = facts;
  if (article_id) {
    result = result.filter(f => f.article_id === article_id);
  }
  if (sync_status) {
    result = result.filter(f => f.sync_status === sync_status);
  }

  // Convert cents → dollars
  return result.map(f => ({
    ...f,
    amount: fromCents(f.amount)
  }));
}
```

**Performance optimization:**
- ✅ Compound index `[user_id+date]` enables fast range queries
- ✅ ~15-20ms for 1000 records (vs 5-10ms SQL)
- ✅ In-memory filtering acceptable for <10,000 records

---

### Update Operation

**User flow:**
1. User edits transaction (offline)
2. Dexie updates fact, sets `sync_status: 'pending'`
3. Pending operation added with new content_hash
4. When online → PATCH request to server

**Code walkthrough:**

```typescript
// factOperations.ts:93-140
export async function updateFact(temp_id: string, updates): Promise<void> {
  // 1. Get existing fact
  const fact = await db.budgetFacts.where('temp_id').equals(temp_id).first();
  if (!fact) throw new Error(`Fact not found: ${temp_id}`);

  // 2. Convert amount to cents if provided
  const updatesWithCents = updates.amount !== undefined
    ? { ...updates, amount: toCents(updates.amount) }
    : updates;

  // 3. Update fact (sets sync_status: 'pending')
  await db.budgetFacts.where('temp_id').equals(temp_id).modify({
    ...updatesWithCents,
    sync_status: 'pending',
    updated_at: new Date()
  });

  // 4. Calculate new content hash
  const content_hash = await calculateContentHash({ ...fact, ...updates });

  // 5. Add to sync queue
  await addPendingOperation({
    operation: 'update',
    entity_type: 'fact',
    temp_id,
    server_id: fact.id,  // Server ID from previous sync
    payload: updates,
    attempts: 0,
    content_hash
  });
}
```

**Conflict scenario:**
- ⚠️ User edits transaction offline
- ⚠️ Another user edits same transaction online
- ⚠️ When syncing → server version differs
- ✅ Conflict detection via `content_hash` mismatch
- ✅ User prompted to resolve (keep local/server/merge)

---

### Delete Operation (Soft Delete)

**User flow:**
1. User deletes transaction
2. Dexie marks `sync_status: 'deleted'` (soft delete)
3. Pending operation added
4. When online → DELETE request to server
5. After successful sync → fact removed from Dexie

**Code walkthrough:**

```typescript
// factOperations.ts:147-180
export async function deleteFact(temp_id: string): Promise<void> {
  // 1. Get existing fact
  const fact = await db.budgetFacts.where('temp_id').equals(temp_id).first();
  if (!fact) throw new Error(`Fact not found: ${temp_id}`);

  // 2. Soft delete (mark as deleted, keep for sync)
  await db.budgetFacts.where('temp_id').equals(temp_id).modify({
    sync_status: 'deleted',
    deleted_at: new Date()
  });

  // 3. Add to sync queue
  await addPendingOperation({
    operation: 'delete',
    entity_type: 'fact',
    temp_id,
    server_id: fact.id,
    attempts: 0
  });
}
```

**Why soft delete?**
- ✅ Offline deletion persists until online
- ✅ Can undo before sync (restore from `deleted` state)
- ✅ After successful sync → fact purged from Dexie

---

## 6. Sync & Conflict Resolution

### Bidirectional Sync

**Full sync flow:**
```
1. UPLOAD (pending operations)
   ├─ Get pending operations (filtered by next_retry_at)
   ├─ POST/PATCH/DELETE to server
   ├─ On success: confirmPendingOperation() (atomic transaction)
   └─ On failure: exponential backoff (2s, 4s, 8s, 16s, 32s)

2. DOWNLOAD (server changes)
   ├─ GET /api/v1/facts?from_date&to_date
   ├─ Compare content_hash with Dexie
   ├─ Detect conflicts (local pending + server changed)
   └─ Bulk insert new/updated facts

3. CONFLICT RESOLUTION
   ├─ Show modal: local vs server version
   ├─ User chooses: keep local / keep server / merge
   ├─ Apply resolution
   └─ Retry sync
```

---

### Exponential Backoff

**Problem:** Network errors → immediate retry → spam server

**Solution (v11.0.1):**
```typescript
// factOperations.ts:334-351
function calculateBackoff(attempts: number): number {
  if (attempts === 0) return 0;  // First attempt: immediate

  const baseDelay = 2000;  // 2 seconds
  const maxDelay = 60000;  // 60 seconds

  // Exponential: 2s, 4s, 8s, 16s, 32s, 60s (capped)
  const delay = Math.min(baseDelay * Math.pow(2, attempts - 1), maxDelay);
  return delay;
}

// Usage
const nextRetryAt = Date.now() + calculateBackoff(attempts);
await db.pendingOperations.add({
  ...operation,
  attempts: attempts + 1,
  next_retry_at: nextRetryAt
});
```

**Retry timeline:**
```
Attempt 1: Immediate (0s delay)
Attempt 2: +2s delay
Attempt 3: +4s delay
Attempt 4: +8s delay
Attempt 5: +16s delay
Attempt 6: +32s delay
Attempt 7+: +60s delay (max)
```

**Benefits:**
- ✅ Reduces server load during outages
- ✅ Eventually succeeds when network restored
- ✅ Max 3 attempts by default (`DEFAULT_MAX_RETRY_ATTEMPTS`)

---

### Conflict Detection & Resolution

**Conflict scenario:**
```
Timeline:
T0: User A downloads fact (id: 123, amount: $100, content_hash: ABC)
T1: User B edits fact online → amount: $150 (content_hash: XYZ)
T2: User A edits offline → amount: $200 (content_hash: DEF)
T3: User A goes online → sync attempts upload
T4: Server detects conflict (content_hash: XYZ ≠ ABC)
T5: Client shows conflict modal
```

**Detection logic:**
```typescript
// conflictOperations.ts:35-78
export async function detectConflict(
  temp_id: string,
  serverData: any
): Promise<boolean> {
  // 1. Get local fact
  const localFact = await db.budgetFacts
    .where('temp_id').equals(temp_id)
    .first();

  if (!localFact) return false;

  // 2. Compare content hashes
  const serverHash = await calculateContentHash(serverData);
  const localHash = localFact.content_hash;

  if (serverHash === localHash) {
    return false;  // No conflict
  }

  // 3. Conflict detected
  logger.warn('[Dexie] Conflict detected', {
    temp_id,
    localHash,
    serverHash
  });

  // 4. Create conflict record
  await createConflictRecord({
    entity_type: 'fact',
    temp_id,
    entity_id: localFact.id,
    local_data: localFact,
    server_data: serverData,
    status: 'pending'
  });

  return true;
}
```

**Resolution strategies:**
```typescript
export type ConflictStrategy = 'local' | 'server' | 'merge';

export async function resolveConflict(
  conflictId: number,
  strategy: ConflictStrategy
): Promise<void> {
  const conflict = await db.syncConflicts.get(conflictId);

  switch (strategy) {
    case 'local':
      // Keep local changes, discard server
      await db.budgetFacts.update(conflict.temp_id, conflict.local_data);
      break;

    case 'server':
      // Keep server changes, discard local
      await db.budgetFacts.update(conflict.temp_id, conflict.server_data);
      break;

    case 'merge':
      // User-defined merge logic
      const merged = mergeData(conflict.local_data, conflict.server_data);
      await db.budgetFacts.update(conflict.temp_id, merged);
      break;
  }

  // Mark conflict as resolved
  await db.syncConflicts.update(conflictId, { status: 'resolved' });
}
```

**Conflict modal (v11.0.1):**
- ⏱️ 60-second timeout → auto-fallback to "server wins"
- ✅ Cleanup logic prevents double resolution
- ✅ User can compare local vs server side-by-side

---

### Atomic Transaction Fix (v11.0.1)

**Problem (v11.0.0):**
```typescript
// ❌ Non-atomic (crash between steps → data inconsistency)
await db.budgetFacts.modify({ sync_status: 'synced' });  // Step 1
await db.pendingOperations.delete(opId);                 // Step 2
// Crash here → fact marked synced, but pending op still exists!
```

**Solution (v11.0.1):**
```typescript
// ✅ Atomic transaction (all-or-nothing)
await db.transaction('rw', [db.budgetFacts, db.pendingOperations], async () => {
  await db.budgetFacts.modify({ sync_status: 'synced' });
  await db.pendingOperations.delete(opId);
});
// Crash → BOTH operations rollback, data consistent
```

**Benefits:**
- ✅ ACID guarantees (Atomicity, Consistency)
- ✅ Network interruptions handled safely
- ✅ No orphaned pending operations

---

## Summary & Next Steps

### What You Learned

✅ **Migration rationale:** PGlite → Dexie (99.1% bundle reduction, production stability)
✅ **Architecture:** DataLayer → DexieManager → Dexie.js → IndexedDB
✅ **Database schema:** 13 tables, compound indexes, dynamic versioning
✅ **Cents conversion:** Financial precision via integer storage
✅ **Offline CRUD:** Create, read, update, delete with sync queue
✅ **Sync mechanisms:** Exponential backoff, conflict resolution, atomic transactions

---

### Key Files to Explore

| File | Purpose | Lines |
|------|---------|-------|
| **DexieManager.ts** | Main API interface | 650 |
| **database.ts** | Schema definition + cents helpers | 200 |
| **factOperations.ts** | Budget fact CRUD | 400 |
| **factSync.ts** | Bidirectional sync | 250 |
| **DataLayer.ts** | Abstraction layer (Dexie + API) | 1200 |
| **dexie-integration.md** | Full documentation | 1286 |

**Interactive exploration:**
```bash
# Dexie diagnostics modal (in browser)
1. Open Family Budget
2. Click Dexie badge (navbar)
3. View sync status, database size, pending operations
4. Test sync period sliders (Facts: 30-180 days, Plans: 1-6 months)
```

---

### Advanced Topics (Beyond This Tour)

**Not covered (see documentation):**
- 🔸 Shopping lists offline CRUD (`shoppingOperations.ts`)
- 🔸 Recurring plans sync with MMDD encoding (`recurringOperations.ts`)
- 🔸 Pruning strategy (hybrid: setInterval + Visibility API + requestIdleCallback)
- 🔸 Reference data sync on login (`referenceSync.ts`)
- 🔸 Performance monitoring (`PerformanceMonitor.ts`)

**References:**
- 📖 [Dexie.js Integration](../architecture/core/dexie-integration.md) - Complete guide
- 📖 [PWA Architecture](../architecture/core/pwa.md) - Service Worker + offline
- 📖 [Offline Sync](../architecture/flows/offline-sync.yaml) - Data flow diagrams

---

### Quiz (Optional - Test Your Knowledge)

**Question 1:** Why does Dexie store `amount` as integer cents?
<details>
<summary>Answer</summary>

JavaScript floats have precision errors (e.g., `0.1 + 0.2 = 0.30000000000000004`). Storing as integer cents (12345 for $123.45) avoids financial calculation errors.
</details>

**Question 2:** What happens when a user edits a transaction offline, then another user edits the same transaction online?
<details>
<summary>Answer</summary>

When syncing, conflict detection compares `content_hash`. If mismatch → conflict modal shows local vs server version. User chooses: keep local, keep server, or merge.
</details>

**Question 3:** Why does `confirmPendingOperation()` use a Dexie transaction in v11.0.1+?
<details>
<summary>Answer</summary>

Ensures atomicity. Without transaction, crash between "mark fact as synced" and "delete pending operation" leaves inconsistent state. Transaction guarantees both succeed or both fail.
</details>

**Question 4:** What is the retry timeline for a failed sync operation?
<details>
<summary>Answer</summary>

Exponential backoff: Attempt 1 (immediate) → Attempt 2 (+2s) → Attempt 3 (+4s) → Attempt 4 (+8s) → Attempt 5 (+16s) → Attempt 6+ (+32-60s max). Default max: 3 attempts.
</details>

**Question 5:** Why did Family Budget migrate from PGlite to Dexie?
<details>
<summary>Answer</summary>

PGlite v0.3.x was alpha (unstable), 3.4MB bundle (99.1% of frontend), and caused mobile crashes. Dexie.js is production-ready (10+ years), 29KB, with 98%+ browser support.
</details>

---

## Feedback

**Found this tour helpful?** ⭐ Star the repo!
**Questions or suggestions?** Open an issue or PR.

**Author:** Family Budget Team
**Date:** 2026-02-15
**Version:** 1.0.0

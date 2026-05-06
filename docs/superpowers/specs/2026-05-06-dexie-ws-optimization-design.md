# Dexie/WS Optimization Design

**Date:** 2026-05-06  
**Status:** Approved  
**Scope:** Frontend (Dexie + WS) + minimal Backend change

---

## Problem

Three confirmed production bugs caused by two architectural flaws:

| Bug | Root Cause |
|-----|-----------|
| Duplicate facts in UI | Double Dexie write: API write + WS broadcast write trigger two UI renders |
| Facts disappear after reload | WS upsert errors silently swallowed → record never created in Dexie |
| WS stops delivering updates | WS event handler throws → listener detaches |

**Architectural flaws:**
1. 24 scattered direct `db.budgetFacts.*` accesses across 6+ files — no single abstraction, errors invisible
2. `upsertFactInDexie()` in `eventHandlers.ts` has `catch { /* non-fatal */ }` — errors invisible

**Primary scenario:** Multiple family members create facts simultaneously on shared budget.

---

## Chosen Approach: FactRepository + WS tab-origin deduplication

Both goals equally important: user-facing reliability (no lost data, no duplicates) and code maintainability (single abstraction, visible errors).

---

## Architecture

### Current state (problem)

```
saveTransaction.ts → db.budgetFacts.put()          ← WRITE 1
                   → API POST /facts
                          → server
                               → WS broadcast
                                     → upsertFactInDexie()  ← WRITE 2 (silent fail)

eventHandlers.ts  → db.budgetFacts.*     ← 24 direct accesses,
factOperations.ts → db.budgetFacts.*        scattered, no logging
bulkOperations.ts → db.budgetFacts.*
...
```

### Target state

```
saveTransaction.ts → factRepo.createFromAPI(fact)     ← single write point
                          └── db.budgetFacts.put()
                          └── stamps tab_origin_id

WS broadcast → eventHandlers.ts → factRepo.upsertFromServer(fact)
                                       ├── fact.tab_origin_id === myTabId? → skip
                                       ├── else: idempotent upsert
                                       └── error → dbLogger.error() (visible)

factOperations.ts → factRepo.createOffline()   (offline path, atomic)
factSync.ts       → factRepo.confirmPending()
bulkOperations.ts → factRepo.bulkUpsert()
```

---

## Type Changes

### `LocalBudgetFact` — добавить поле

```typescript
// frontend/shared/db/dexie/types/fact.ts
export interface LocalBudgetFact {
  // ... existing fields ...
  tab_origin_id: string | null;  // ← new: UUID of tab that created this record (for WS dedup)
}
```

Not indexed — used only for equality check in `upsertFromServer`, not for querying.

---

## New Files

### `frontend/shared/db/dexie/repositories/FactRepository.ts`

```typescript
interface FactRepository {
  // Online: POST /api/facts returned data → write to Dexie
  createFromAPI(serverFact: ApiFactResponse): Promise<LocalBudgetFact>;

  // Offline: create with temp_id + add to pendingOperations (atomic)
  createOffline(data: OfflineFactData): Promise<LocalBudgetFact>;

  // WS event from server → idempotent upsert (skip if own tab)
  upsertFromServer(serverFact: WsFactPayload): Promise<'created' | 'updated' | 'skipped'>;

  // Sync confirmed: temp_id → server_id (atomic transaction)
  confirmPending(temp_id: string, server_id: number): Promise<void>;

  // Bulk from server (initial sync, bulk import)
  bulkUpsert(facts: ApiFactResponse[]): Promise<void>;

  // Physical delete by temp_id
  remove(temp_id: string): Promise<void>;
}
```

**`upsertFromServer` key logic:**
```typescript
async upsertFromServer(serverFact): Promise<'created' | 'updated' | 'skipped'> {
  if (serverFact.tab_origin_id === getTabId()) {
    return 'skipped';
  }

  return db.transaction('rw', db.budgetFacts, async () => {
    const existing = await db.budgetFacts
      .where('id').equals(serverFact.id)
      .or('temp_id').equals(serverFact.temp_id ?? '')
      .first();

    if (existing) {
      await db.budgetFacts.where('temp_id').equals(existing.temp_id).modify({
        id: serverFact.id,
        sync_status: 'synced',
        synced_at: new Date(),
        amount: serverFact.amount,
        updated_at: new Date(serverFact.updated_at),
      });
      return 'updated';
    } else {
      await db.budgetFacts.put(mapServerFactToLocal(serverFact));
      return 'created';
    }
  });
  // Errors NOT caught here — propagate up to caller
}
```

**`createFromAPI` key logic:**
```typescript
async createFromAPI(serverFact): Promise<LocalBudgetFact> {
  const local = mapServerFactToLocal(serverFact, {
    sync_status: 'synced',
    tab_origin_id: getTabId(),
  });
  await db.budgetFacts.put(local);
  return local;
}
```

### `frontend/shared/db/dexie/utils/tabId.ts`

```typescript
const KEY = 'fb_tab_id';
let _id: string | null = null;

export function getTabId(): string {
  if (_id) return _id;
  _id = sessionStorage.getItem(KEY);
  if (!_id) {
    _id = crypto.randomUUID();
    sessionStorage.setItem(KEY, _id);
  }
  return _id;
}
```

`sessionStorage` — unique per-tab, survives in-tab navigation, cleared on tab close.

---

## Modified Files

| File | Change |
|------|--------|
| `frontend/shared/db/dexie/core/database.ts` | Add version 5: `created_at` index on `pendingOperations` |
| `frontend/shared/db/dexie/repositories/FactRepository.ts` | **New** — all `budgetFacts` access centralized here |
| `frontend/shared/db/dexie/utils/tabId.ts` | **New** — singleton tab UUID |
| `frontend/shared/db/dexie/index.ts` | Export `factRepo` singleton |
| `frontend/web/static/js/budget/budgetWSClient/integration/eventHandlers.ts` | `upsertFactInDexie` → `factRepo.upsertFromServer`, silent catch → `dbLogger.error()` |
| `frontend/web/static/js/dashboard/features/modalFact/saveTransaction.ts` | `db.budgetFacts.put` → `factRepo.createFromAPI`, add `X-Tab-Id` header |
| `frontend/shared/db/dexie/operations/factOperations.ts` | Delegate to `FactRepository`, becomes thin wrapper |
| `frontend/shared/db/dexie/operations/factSync.ts` | `confirmPendingOperation` → `factRepo.confirmPending` |
| `frontend/shared/db/dexie/operations/bulkOperations.ts` | `db.budgetFacts.bulkPut` → `factRepo.bulkUpsert` |
| `frontend/shared/db/dexie/DexieManager.ts` | Direct `db.budgetFacts.*` → repository |
| `frontend/shared/db/dexie/operations/conflictOperations.ts` | Direct `db.budgetFacts.*` → repository |
| `backend/app/api/v1/endpoints/facts.py` | Extract `X-Tab-Id` header, add `tab_origin_id` to `response_data` |
| `backend/app/api/v1/endpoints/budget_ws.py` | Add `tab_origin_id` to `_filter_fact_data` whitelist |

---

## Dexie Schema Version 5

```typescript
this.version(5).stores({
  pendingOperations: '++id, content_hash, entity_type, temp_id, server_id, next_retry_at, created_at'
  //                                                                                        ^^^ new index
});
// No upgrade() needed — Dexie adds index automatically
```

Fixes: `getPendingOperations()` currently loads ALL ops then sorts in JS. With `created_at` indexed, sort happens in IndexedDB.

---

## Error Handling

**Before (eventHandlers.ts):**
```typescript
} catch { /* non-fatal */ }
```

**After:**
```typescript
} catch (error) {
  dbLogger.error('[FactRepo] upsertFromServer failed', { factId: fact.id, error });
  // no re-throw: WS handler must not crash from Dexie errors
}
```

All `FactRepository` methods propagate errors upward. Only WS handler catches (and logs). All other callers (saveTransaction, factSync) let errors surface naturally.

---

## Data Flows

### Online: Tab A creates fact, Tab B is open

```
A: POST /api/facts {X-Tab-Id: "abc"}
   → 201 {id: 42, tab_origin_id: "abc"}
   → factRepo.createFromAPI() → Dexie ✓

Server: WS broadcast {fact_created, id: 42, tab_origin_id: "abc"}

A (WS): upsertFromServer → tab_origin_id === myTabId → 'skipped' ✓
B (WS): upsertFromServer → different tab → idempotent upsert → 'created' ✓
```

### Offline: Tab A creates fact

```
A: POST → network error
   → factRepo.createOffline() — atomic transaction:
       budgetFacts.put({id: null, temp_id: "t-1", sync_status: 'pending'})
       pendingOperations.put({temp_id: "t-1", ...})
   → UI: fact visible immediately with pending indicator

A regains network:
   syncManager.uploadPending() → POST /api/facts {temp_id: "t-1"}
   → factRepo.confirmPending("t-1", 42) — atomic:
       budgetFacts: temp_id "t-1" → id=42, sync_status='synced'
       pendingOperations: delete
   WS: {fact_created, id: 42, tab_origin_id: "abc"} → skipped ✓
```

### WS error (currently invisible → after fix)

```
upsertFromServer throws
→ dbLogger.error('[FactRepo] upsertFromServer failed', {factId, error})
→ UI does not crash
→ error visible in logs / monitoring
```

---

## Bug Fix Mapping

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Duplicate facts in UI | Double write → two UI renders | `tab_origin_id` dedup in WS handler |
| Facts disappear after reload | WS upsert error swallowed → record never in Dexie | Errors visible + search by `id` OR `temp_id` |
| WS stops delivering updates | Handler throws → listener detaches | catch does not re-throw |

---

## Out of Scope

- `fact_updated` / `fact_deleted` WS events: same `tab_origin_id` pattern applies but excluded from this spec to limit blast radius. Can be follow-up.
- Conflict resolution strategy changes
- Shopping list Dexie operations
- Long-polling fallback behavior

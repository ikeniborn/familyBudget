# Shopping Lists Download Fix — Design

**Date:** 2026-05-29
**Version target:** 0.6.167
**Branch:** dev/fix-shopping-lists-download → test

## Problem

On `https://fb.ikeniborn.ru/lists` console logs:

```
lists.min.js?v=0.6.165:778 [DEXIE] [shoppingSync] ❌ Shopping lists download failed: i
```

Bootstrap pull `downloadShoppingLists(userId)` fails on first `/lists` load. Caught as non-fatal in `stateManager.ts:322-324`, but Dexie cache stays out of sync with server. Missed WS events (e.g. cross-tab `shopping_list_created`) can mask newly-created lists.

## Root Causes

Four independent defects in `frontend/shared/db/dexie/operations/shoppingSync.ts::downloadShoppingLists`:

### 1. API response shape mismatch (silent corruption)

Backend `GET /api/v1/shopping-lists` returns `ShoppingListListResponse`:

```json
{ "shopping_lists": [...], "total": N, "limit": 100, "offset": 0 }
```

Frontend (line 181) treats payload as array:

```typescript
const lists: LocalShoppingList[] = await response.json();
```

`lists` becomes the wrapper object, not the array.

### 2. Stale Dexie index reference (throws SchemaError)

Dexie schema v3 (`database.ts:160`) dropped `user_id` from `shoppingLists` table indexes:

```typescript
// v1: shoppingLists: 'temp_id, id, user_id, creator_id, is_completed, sync_status'
// v3: shoppingLists: 'temp_id, id, creator_id, is_active, sync_status'
```

Frontend still queries the dropped index (line 184):

```typescript
await db.shoppingLists.where('user_id').equals(userId).delete();
```

Dexie throws `SchemaError: KeyPath user_id on object store shoppingLists is not indexed`. This is the `i` (minified Error) in production logs.

### 3. Bogus query param + shared-model violation

Frontend passes `?user_id=${userId}` but backend has no such filter (`shopping_lists.py:66-72`, "**NO user_id filtering** - returns ALL lists for all users"). Shared-references model. URL param silently ignored.

`downloadShoppingLists(userId)` signature implies per-user scope — misleading contract.

### 4. Type mismatch on bulkPut

`ShoppingListCardResponse` lacks fields required by `LocalShoppingList`: `creator_id`, `is_active`, `sync_status`, `sync_hash`, `content_hash`, `synced_at`. Even if shape mismatch were fixed, `bulkPut` would insert malformed records.

## Dead Code Discovered

Same module contains two unused exports with identical defects:

- `downloadShoppingListItems` (line 200) — URL `/api/v1/shopping-items` (does not exist; real prefix is `/shopping-list-items`), accepts `shopping_list_temp_id` param the backend does not support. No callers.
- `fullShoppingSync` (line 240) — orchestrates the broken downloads. No callers.

Grep confirms no usages outside `shoppingSync.ts`.

## Design

### Section 1 — Backend schema extension

**File:** `backend/app/schemas/shopping_list.py`

Add `creator_id` and `is_active` to `ShoppingListCardResponse` (additive change; existing consumers ignore new fields):

```python
class ShoppingListCardResponse(BaseModel):
    id: int
    temp_id: str | None = None
    creator_id: int           # NEW: required for Dexie LocalShoppingList
    name: str
    description: str | None
    is_active: bool           # NEW: model has it, Card was missing
    total_items: int
    completed_items: int
    completion_percentage: float
    created_at: datetime
    updated_at: datetime
```

**File:** `backend/app/services/shopping_list_service.py`

`get_shopping_lists_with_stats` must include `creator_id` and `is_active` in each dict.

No endpoint URL / signature changes.

### Section 2 — Frontend: shoppingSync.ts rewrite

**File:** `frontend/shared/db/dexie/operations/shoppingSync.ts`

Replace `downloadShoppingLists`:

```typescript
export async function downloadShoppingLists(): Promise<{
  success: boolean;
  count: number;
}> {
  logger.info('[shoppingSync] Downloading shopping lists...');

  try {
    const response = await fetchWithTimeout('/api/v1/shopping-lists', {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch shopping lists: ${response.status}`);
    }

    const payload = await response.json();
    const serverLists: ServerShoppingListCard[] = payload.shopping_lists ?? [];

    const now = new Date();
    const localLists: LocalShoppingList[] = serverLists.map(card => ({
      id: card.id,
      temp_id: card.temp_id ?? `server-${card.id}`,
      creator_id: card.creator_id,
      name: card.name,
      description: card.description,
      is_active: card.is_active,
      sync_status: 'synced',
      sync_hash: null,
      content_hash: null,
      created_at: new Date(card.created_at),
      updated_at: new Date(card.updated_at),
      synced_at: now,
      total_items: card.total_items,
      completed_items: card.completed_items,
      completion_percentage: card.completion_percentage,
    }));

    // Shared model: replace only synced rows; preserve pending/deleted local edits
    await db.shoppingLists.where('sync_status').equals('synced').delete();
    await db.shoppingLists.bulkPut(localLists);

    logger.info('[shoppingSync] ✅ Shopping lists downloaded', { count: localLists.length });
    return { success: true, count: localLists.length };
  } catch (error) {
    logger.error('[shoppingSync] ❌ Shopping lists download failed:', error);
    return { success: false, count: 0 };
  }
}
```

**Delete entirely:**

- `downloadShoppingListItems` (lines 200-235) — dead, broken URL + signature
- `fullShoppingSync` (lines 240-267) — dead, no callers

**Add new type:** `ServerShoppingListCard` in `frontend/shared/db/dexie/types/shopping.ts` mirroring backend `ShoppingListCardResponse`.

### Section 3 — Caller update

**File:** `frontend/web/static/js/lists/listsManager/core/stateManager.ts` (lines 314-325)

Before:

```typescript
if (!bootstrapPullDone) {
  bootstrapPullDone = true;
  try {
    const userId = (window as any).userData?.id;
    if (userId) {
      const { downloadShoppingLists } = await import('@db/dexie');
      await downloadShoppingLists(userId);
    }
  } catch (pullError) {
    debugLog('[ListsManager] Bootstrap forced pull failed (non-fatal)', pullError);
  }
}
```

After:

```typescript
if (!bootstrapPullDone) {
  bootstrapPullDone = true;
  try {
    const { downloadShoppingLists } = await import('@db/dexie');
    await downloadShoppingLists();
  } catch (pullError) {
    debugLog('[ListsManager] Bootstrap forced pull failed (non-fatal)', pullError);
  }
}
```

Removes `userData?.id` gate — auth handled at fetch layer via cookie credentials. No other callers in repo.

### Section 4 — Tests

**Backend (pytest)** — `tests/integration/test_shopping_lists_api.py`:

- `GET /api/v1/shopping-lists` response cards contain `creator_id` and `is_active`
- `ShoppingListCardResponse` validates payload requires `creator_id`

**Frontend unit (vitest)** — `tests/unit/dexie/shoppingSync.spec.ts` (new):

- `downloadShoppingLists` unwraps `payload.shopping_lists`
- Maps ServerCard → LocalShoppingList: `sync_status='synced'`, `synced_at` set, `temp_id` fallback `server-${id}`
- Does NOT delete local rows with `sync_status` of `pending` or `deleted` (mock Dexie)
- Returns `{success: false, count: 0}` on 500 response
- Regression guard: does not throw `SchemaError` (current production bug)

**E2E (Playwright)** — `tests/e2e/lists-bootstrap-pull.spec.ts` (new):

- Navigate `/lists` → console contains no `❌ Shopping lists download failed`
- Network: exactly one `GET /api/v1/shopping-lists`, no `user_id=` query param
- Response 200, payload has `shopping_lists` array

**Verification:**

```bash
npm run type-check
npm run test:coverage
cd tests && ./run-tests.sh backend
npm run test:e2e
```

### Section 5 — Migration / rollout

- Version bump: `0.6.166` → `0.6.167` (patch). Pre-commit hook auto-syncs `package.json` / `package-lock.json`.
- No DB migration. No Dexie schema version bump.
- Backwards-compat:
  - Backend additive (extra response fields) — safe for older clients
  - Frontend signature change confined to single module + single caller
  - Bundle cache-bust via `?v=` placeholder (CI handles)
- Deploy flow:
  1. PR `dev/fix-shopping-lists-download` → `test`
  2. CI/CD builds + updates `IMAGE_VERSIONS.json`
  3. `ssh budget-test` → `cd /opt/budget` → `./deploy.sh`
  4. Smoke check `https://fbd.ikeniborn.ru/lists` console clean
  5. PR `test` → `prod`

## Files Touched

| File | Change |
|---|---|
| `backend/app/schemas/shopping_list.py` | Add `creator_id`, `is_active` to `ShoppingListCardResponse` |
| `backend/app/services/shopping_list_service.py` | Include new fields in stats dict |
| `frontend/shared/db/dexie/operations/shoppingSync.ts` | Rewrite `downloadShoppingLists`; delete dead exports |
| `frontend/shared/db/dexie/types/shopping.ts` | Add `ServerShoppingListCard` |
| `frontend/web/static/js/lists/listsManager/core/stateManager.ts` | Update caller signature |
| `tests/integration/test_shopping_lists_api.py` | New assertions on response fields |
| `tests/unit/dexie/shoppingSync.spec.ts` | New file |
| `tests/e2e/lists-bootstrap-pull.spec.ts` | New file |
| `VERSION` | `0.6.166` → `0.6.167` |

## Out of Scope

- Refactor of shared helper for download/bulkPut pattern across stores/productGroups (premature abstraction; revisit when third consumer appears).
- Item-level sync (`downloadShoppingListItems` rewrite) — current path uses HTMX/REST for item fetch via `/api/v1/shopping-list-items?shopping_list_id=N`; no offline download path is in use today.

# Design: Lists Page — Bug Fixes + Edit List Feature

**Date:** 2026-06-03
**Intent doc:** `docs/superpowers/intents/2026-06-03-lists-bugs-and-edit-intent.md`
**Status:** approved
**Delivery:** single PR from `dev/lists-bugs-and-edit`

---

## Overview

Fix 6 critical blocking issues on the `/lists` page and add list editing capability. All delivered in one PR.

Issues:
1. Add list edit modal (name + description)
2. Landing page item counters (X/Y completed) don't update after import
3. Google Sheets URL not saved per list — re-entered on every import
4. New product groups from import don't appear in hierarchy tree without page reload
5. Delete completed items requires two passes
6. "Mark all as completed" button fails immediately after import

---

## Issue 1: Edit List Modal

### Approach
Frontend only. No new backend endpoint — uses existing `PATCH /api/v1/shopping-lists/{id}` via `ShoppingListUpdate` schema (already supports `name` and `description`).

### Changes

**`frontend/web/static/js/lists/listsManager/ui/modalManager.ts`** — add 3 functions:

- `openEditListModal(listId: number)` — reads list from `state.shoppingLists`, fills `name`/`description` fields, opens `#edit-list-modal`
- `closeEditListModal()` — closes dialog
- `handleEditList(event: Event)` — form submit handler:
  - `PATCH /api/v1/shopping-lists/{id}` with `{name, description}`
  - On success: update matching entry in `state.shoppingLists` in memory
  - Re-render: update detail view breadcrumb title + `renderShoppingListCards()` (for landing page cache)
  - Close modal

**`frontend/web/static/js/lists/listsManager/adapters/windowExports.ts`** — add:
```ts
window.openEditListModal = openEditListModal;
window.closeEditListModal = closeEditListModal;
window.handleEditList = handleEditList;
```

**`frontend/web/templates/lists.html`** — add:
1. `<dialog id="edit-list-modal">` — mirrors `#create-list-modal` structure with fields: `name` (required) and `description` (optional textarea)
2. Edit button in detail view header — `onclick="window.openEditListModal(currentListId)"` — placed next to delete button

### Constraints
- Name field: required, matches existing validation
- Description: optional, no length restriction beyond what backend validates
- After save: breadcrumb title updates immediately from API response (source of truth)

---

## Issue 2: Landing Page Counters After Import

### Root Cause
`csvImporter.js:executeImport()` calls `loadShoppingListItems()` and `renderItemsTable()` after import, but never refreshes `state.shoppingLists`. The landing page cards read `total_items`/`completed_items`/`completion_percentage` from stale state.

### Fix

**`frontend/web/static/js/lists/listsManager/rendering/hierarchyIntegration.ts`** — add `loadShoppingLists` to proxy:
```ts
export function createListsManagerProxy() {
  return {
    // ...existing methods...
    loadShoppingLists,  // add this
    // ...
  };
}
```

**`frontend/web/static/js/lists/csvImporter.js`** (compiled from TS sources in `lists/csvImporter/`) — after `renderItemsTable()` call in `executeImport()`, add:
```js
if (typeof this.listsManager.loadShoppingLists === 'function') {
    await this.listsManager.loadShoppingLists();
}
```

`loadShoppingLists` already exists in `stateManager.ts` and fetches full stats from API including `total_items`/`completed_items`.

---

## Issue 3: Google Sheets URL Per List

### Root Cause
URL currently stored at user level (`t_d_user.google_sheets_url`). Must be tied to a specific list so different lists can have different source sheets.

### Backend Changes

**Migration** — add column to `t_f_shopping_list`:
```sql
ALTER TABLE t_f_shopping_list ADD COLUMN google_sheets_url VARCHAR(2048) NULL;
```

**`backend/app/models/shopping_list.py`** — add field:
```python
google_sheets_url: str | None = Field(default=None, max_length=2048)
```

**`backend/app/schemas/shopping_list.py`** — add to `ShoppingListUpdate`:
```python
google_sheets_url: str | None = Field(default=None, max_length=2048)
```

**`backend/app/api/v1/endpoints/shopping_lists.py`** — add 2 endpoints:

```
GET  /api/v1/shopping-lists/{list_id}/google-sheets-url
     → {"google_sheets_url": str|null, "has_saved_url": bool}

PATCH /api/v1/shopping-lists/{list_id}/google-sheets-url
     body: {"google_sheets_url": str|null}
     → {"google_sheets_url": str|null, "has_saved_url": bool}
```

Auth: any authenticated user (consistent with shared-list model). 404 if list not found.

The existing user-level endpoint `GET/PATCH /api/v1/users/me/google-sheets-url` is **not modified**.

### Frontend Changes

**`frontend/web/static/js/lists/googleSheetsImporter.js`** — change URL targets:

`fetchSavedGoogleSheetsUrl()`:
```js
// reads this.listsManager.currentListId
const listId = this.listsManager.currentListId;
if (!listId) return;
const response = await fetch(`/api/v1/shopping-lists/${listId}/google-sheets-url`, ...);
```

`saveGoogleSheetsUrl(url)`:
```js
const listId = this.listsManager.currentListId;
if (!listId) return false;
const response = await fetch(`/api/v1/shopping-lists/${listId}/google-sheets-url`, {
    method: 'PATCH', ...
});
```

`this.listsManager.currentListId` is already exposed by the proxy in `hierarchyIntegration.ts`.

---

## Issue 4: New Product Groups in Hierarchy Tree After Import

### Root Cause
`csvImporter.js:executeImport()` calls `loadProductGroups()` first, then `loadShoppingListItems()`. Inside `loadShoppingListItems()`, `loadStoresAndGroups()` is called again — this re-fetches from Dexie (which may return stale/cached data), overwriting the fresh product groups just loaded.

### Fix

**`frontend/web/static/js/lists/csvImporter.js:executeImport()`** (edit TS source, recompile) — reorder calls:

```js
// BEFORE (broken order):
if (result.created_stores)         await this.listsManager.loadStores();
if (result.created_product_groups) await this.listsManager.loadProductGroups();
await this.listsManager.loadShoppingListItems(currentListId);  // overwrites above
this.listsManager.renderItemsTable();

// AFTER (fixed order):
await this.listsManager.loadShoppingListItems(currentListId);   // loads items + stale groups
if (result.created_stores)         await this.listsManager.loadStores();         // overwrite with fresh
if (result.created_product_groups) await this.listsManager.loadProductGroups();  // overwrite with fresh
this.listsManager.renderItemsTable();  // renders with fresh stores + groups
```

Choices.js reinit for store/group dropdowns remains after `renderItemsTable()` as before.

---

## Issue 5: Delete Completed — Two Passes Required

### Root Cause
Newly imported items exist in API but not in Dexie (sync hasn't happened yet). `state.currentItems` has these items with `temp_id=null`. `deleteMultipleItems()` checks `tempIds.length !== itemIds.length` → triggers API-only fallback. API DELETE requests succeed, but `loadShoppingListItems()` then reads from Dexie (which still has the items) → items reappear.

### Fix

**`frontend/web/static/js/lists/listsManager/core/listOperations.ts:deleteMultipleItems()`** — in the API-only fallback path, after `Promise.all(deletes)`:

```ts
// After successful API deletes, evict from Dexie by server id
// (items may lack temp_id if created via import before Dexie sync)
if (isDexieActive()) {
    try {
        await db.shoppingListItems.where('id').anyOf(itemIds).delete();
        debugLog('[LIST_OPS] Evicted API-deleted items from Dexie', { count: itemIds.length });
    } catch (dexieErr) {
        console.warn('[LIST_OPS] Dexie eviction failed (non-critical):', dexieErr);
    }
}
```

Soft-delete pattern preserved: the Dexie `.delete()` here is a hard eviction of locally-unknown rows (no `deleted_at` to set since these items have no `temp_id`). The server already performed the soft-delete.

---

## Issue 6: Mark All Completed Fails After Import

### Root Cause
`markAllCompleted()` iterates over items with `for...of await toggleItemCompleted(item.id, true)`. Inside `toggleItemCompleted`, after Dexie operations, `loadShoppingListItems()` is called — this updates `state.currentItems`. On the next loop iteration, the fresh state may not contain the previously-found item (e.g. it was reloaded with a different virtual ID), causing `throw new Error('Item not found in state')` which aborts the entire loop.

### Fix

**`frontend/web/static/js/lists/listsManager/core/listOperations.ts:toggleItemCompleted()`** — change throw to warn+return:

```ts
const item = state.currentItems.find(i => i.id === itemId);
if (!item) {
  // Item may have been reloaded with updated state (e.g. during bulk mark-all)
  debugLog('[LIST_OPS] Item not found in state during toggle, skipping', { itemId });
  return;  // was: throw new Error('Item not found in state')
}
```

This is safe: if the item isn't in state, it either already has the correct `is_completed` value or was removed. Either way, aborting the entire bulk operation is wrong behavior.

---

## Health Constraints

- Offline sync internals (IndexedDB schema, sync_hash, conflict resolution) — **not touched**
- CSV import 5-stage wizard flow — **not touched** (only reordering calls in `executeImport`)
- Soft delete pattern — **preserved** (Dexie eviction in issue #5 only affects items without temp_id)
- Dashboard and facts page counters — **not affected** (changes are local to lists page state)
- Batch delete endpoint behavior — **not changed** (fix is frontend-only)

---

## Files Changed

| File | Change |
|------|--------|
| `backend/db/migrations/versions/YYYYMMDD_*_add_google_sheets_url_to_shopping_list.py` | new migration |
| `backend/app/models/shopping_list.py` | +`google_sheets_url` field |
| `backend/app/schemas/shopping_list.py` | +`google_sheets_url` in `ShoppingListUpdate` |
| `backend/app/api/v1/endpoints/shopping_lists.py` | +2 google-sheets-url endpoints |
| `frontend/web/templates/lists.html` | +`#edit-list-modal`, +edit button |
| `frontend/web/static/js/lists/listsManager/ui/modalManager.ts` | +edit list functions |
| `frontend/web/static/js/lists/listsManager/adapters/windowExports.ts` | +edit list exports |
| `frontend/web/static/js/lists/listsManager/rendering/hierarchyIntegration.ts` | +`loadShoppingLists` in proxy |
| `frontend/web/static/js/lists/listsManager/core/listOperations.ts` | Dexie eviction in fallback + warn not throw |
| `frontend/web/static/js/lists/listsManager/features/bulkActions.ts` | (no change needed — fix is in listOperations) |
| `frontend/web/static/js/lists/csvImporter/` (TS sources) | reorder calls + add `loadShoppingLists` |
| `frontend/web/static/js/lists/googleSheetsImporter.js` (plain JS source) | list-level URL endpoints |

---

## Out of Scope

- Changing user-level google-sheets-url endpoint
- Modifying offline sync conflict resolution
- Adding `comment` field to `ShoppingList` (not needed — `description` covers it)
- Changes to WebSocket schema

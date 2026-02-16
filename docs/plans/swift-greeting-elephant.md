# Fix Shopping List Deletion UI Synchronization

**Created:** 2026-02-16
**Status:** Ready for Implementation
**Complexity:** Medium (4 interconnected components)

---

## Context

### Problem Statement

When user deletes a shopping list:
- ✅ API DELETE request succeeds (HTTP 204)
- ✅ Success toast is shown ("Список успешно удален")
- ❌ **Shopping list remains visible on page**
- ❌ Second deletion attempt returns 404 (list already deleted from DB)

**User Impact:** Confusing UX - users see deleted lists and get errors on retry.

### Root Causes (4 Issues)

1. **Backend Missing WebSocket Broadcast**
   - File: `backend/app/api/v1/endpoints/shopping_lists.py:415-421`
   - Shopping list DELETE does NOT broadcast `shopping_list_deleted` event
   - Compare: Item deletion correctly broadcasts `item_deleted` (items.py:1137)

2. **Frontend Missing Event Handler**
   - No `ShoppingListDeletedEvent` type defined
   - No `handleShoppingListDeleted()` function
   - No WebSocket listener registration

3. **Dexie Cache Not Invalidated**
   - After DELETE, `renderLandingView()` → `loadShoppingLists()` → `dataLayer.getShoppingLists()`
   - DataLayer loads from **Dexie cache** (if active) instead of fresh API
   - Deleted list still in cache → UI re-renders with stale data

4. **UI Refresh Logic Issue**
   - `confirmDeleteList()` calls `renderLandingView()` which loads from cache
   - No forced API refresh or cache invalidation

### Investigation Results

**Server Logs Analysis (budget-test):**
- 09:07:52 UTC - First DELETE succeeds (HTTP 204, list ID 33)
- 09:41:03 UTC - Second DELETE fails (HTTP 404, "Shopping list 33 not found")
- WebSocket broadcast sent for items, but NOT for list deletion

**Current Broken Flow:**
```
User clicks Delete
  → API DELETE /shopping-lists/33 → 204 No Content
  → Success toast shown
  → renderLandingView() called
  → loadShoppingLists() → DataLayer.getShoppingLists()
  → Dexie cache returns STALE data (deleted list still there)
  → UI shows deleted list ❌
```

**Target Fixed Flow:**
```
User clicks Delete
  → API DELETE → WebSocket broadcast → 204 No Content
                    ↓
  Other tabs receive event → Remove list from UI
                    ↓
  Initiating client → Success toast
                    ↓
  Dexie cache invalidated (soft delete)
                    ↓
  loadShoppingLists() → Fresh data from API
                    ↓
  UI updated correctly ✅
```

---

## Implementation Plan

### Phase 1: Backend WebSocket Broadcast

**Goal:** Broadcast `shopping_list_deleted` event to all connected clients.

#### 1.1 Add Broadcast Function

**File:** `backend/app/api/v1/endpoints/budget_ws.py`
**Location:** After line 1140 (after `broadcast_item_deleted`)

```python
async def broadcast_shopping_list_deleted(shopping_list_id: int):
    """Broadcast shopping list deleted event."""
    logger.debug(f"broadcast_shopping_list_deleted: list_id={shopping_list_id}")
    await _broadcast_and_buffer("shopping_list_deleted", {"id": shopping_list_id})
```

**Pattern:** Follow existing `broadcast_item_deleted()` at line 1137.

#### 1.2 Call Broadcast in DELETE Endpoint

**File:** `backend/app/api/v1/endpoints/shopping_lists.py`
**Location:** After line 416 (`await session.commit()`)

```python
# After: await session.commit()

# WebSocket broadcast for cross-tab sync
try:
    from backend.app.api.v1.endpoints import budget_ws
    await budget_ws.broadcast_shopping_list_deleted(shopping_list_id)
except Exception as e:
    logger.warning(f"WebSocket broadcast failed for deleted list {shopping_list_id}: {e}")

# Then existing: logger.info(...)
```

**Why here:** After commit ensures list is deleted before broadcast.

---

### Phase 2: Frontend Event Type Definition

**File:** `frontend/web/static/js/budget/budgetWSClient/types/events.ts`
**Location:** After line 115 (after `ItemCompletedEvent`)

```typescript
// ============================================================================
// Shopping List Events
// ============================================================================

export interface ShoppingListDeletedEvent {
  id: number;
}
```

**Pattern:** Matches existing event type structure.

---

### Phase 3: Frontend Event Handler

#### 3.1 Implement Handler Function

**File:** `frontend/web/static/js/lists/listsManager/integration/wsEventHandlers.ts`
**Location:** After line 215 (after `handleItemCompletedToggled`)

```typescript
/**
 * Handle shopping list deleted event from WebSocket
 *
 * Removes shopping list from global state and triggers UI reload
 *
 * @param shoppingListId - Shopping list ID to remove
 */
export function handleShoppingListDeleted(shoppingListId: number): void {
  if (!shoppingListId) {
    debugLog('[ListsManager] Invalid shoppingListId for handleShoppingListDeleted');
    return;
  }

  const state = getState();

  // Find the list in current lists
  const listIndex = state.shoppingLists.findIndex(list => list.id === shoppingListId);
  if (listIndex === -1) {
    debugLog('[ListsManager] Shopping list not found for removal:', shoppingListId);
    return;
  }

  const removedList = state.shoppingLists[listIndex];

  // Remove from shopping lists array
  const newLists = [...state.shoppingLists];
  newLists.splice(listIndex, 1);

  updateState({ shoppingLists: newLists });
  debugLog('[ListsManager] Removed shopping list from WebSocket:', shoppingListId);

  // If currently viewing this list, redirect to landing view
  if (state.currentListId === shoppingListId) {
    debugLog('[ListsManager] Deleted list was active, returning to landing view');
    import('../rendering/listRenderer').then(({ renderLandingView }) => {
      renderLandingView();
    });
  } else {
    // Otherwise, just refresh the cards view
    import('../rendering/listRenderer').then(({ renderShoppingListCards }) => {
      renderShoppingListCards();
    });
  }

  // Show notification
  showToast(`Список удалён: ${removedList.name}`, 'info');
}
```

#### 3.2 Export Handler

**File:** `frontend/web/static/js/lists/listsManager/index.ts`
**Location:** After line 141

```typescript
export {
  handleItemCreated,
  handleItemUpdated,
  handleItemDeleted,
  handleItemCompletedToggled,
  handleShoppingListDeleted  // NEW
} from './integration/wsEventHandlers';
```

---

### Phase 4: WebSocket Event Registration

**File:** `frontend/web/static/js/budget/budgetWSClient/integration/eventHandlers.ts`

#### 4.1 Add Import

**Location:** Top of file (with other event type imports)

```typescript
import type {
  // ... existing imports
  ShoppingListDeletedEvent  // NEW
} from '../types/events';
```

#### 4.2 Register Handler

**Location:** After line 198 (in switch-case statement)

```typescript
case 'shopping_list_deleted': {
  const eventData = data as ShoppingListDeletedEvent;
  debugLog('[BudgetWS] Handling shopping_list_deleted event', eventData);

  // Notify lists manager if available
  if ((window as any).listsManager) {
    (window as any).listsManager.handleShoppingListDeleted(eventData.id);
  }
  break;
}
```

---

### Phase 5: Dexie Cache Invalidation

#### 5.1 Add Delete Function

**File:** `frontend/shared/db/dexie/operations/shoppingOperations.ts`
**Location:** After line 151

```typescript
/**
 * Delete shopping list (soft delete)
 * Called when list is deleted via API or WebSocket event
 *
 * @param temp_id - Shopping list temp_id
 */
export async function deleteShoppingList(temp_id: string): Promise<void> {
  logger.debug('[shoppingOps] deleteShoppingList', { temp_id });

  // Soft delete: mark as deleted without removing from Dexie
  await db.shoppingLists.where('temp_id').equals(temp_id).modify({
    sync_status: 'deleted',
    is_active: false,  // Mark inactive
    updated_at: new Date()
  });

  logger.info('[shoppingOps] ✅ Shopping list soft-deleted', { temp_id });
}
```

#### 5.2 Export Function

**File:** `frontend/shared/db/dexie/index.ts`
**Location:** After line 84

```typescript
export {
  createShoppingList,
  queryShoppingLists,
  createShoppingListItem,
  queryShoppingListItems,
  updateShoppingListItem,
  deleteShoppingListItem,
  deleteShoppingList,  // NEW
  bulkInsertShoppingListItems
} from './operations/shoppingOperations';
```

---

### Phase 6: UI Refresh Enhancement

**File:** `frontend/web/static/js/lists/listsManager/ui/modalManager.ts`
**Location:** Line 538 (replace existing `await renderLandingView()`)

```typescript
// Force Dexie cache invalidation + fresh API load
const dexie = await getDexieManager();
const state = getState();

// Find deleted list's temp_id
const deletedList = state.shoppingLists.find(list => list.id === listId);
if (deletedList?.temp_id && isDexieActive() && dexie.isReady()) {
  // Invalidate Dexie cache
  const { deleteShoppingList } = await import('@db/dexie');
  await deleteShoppingList(deletedList.temp_id);
  debugLog('[DeleteList] Dexie cache invalidated for list:', deletedList.temp_id);
}

// Reload landing view (will now fetch fresh data from API)
await renderLandingView();
```

**Why:** Ensures Dexie cache is cleared BEFORE UI reload.

---

### Phase 7: Error Handling Improvements

**File:** `frontend/web/static/js/lists/listsManager/ui/modalManager.ts`
**Location:** In `confirmDeleteList()` error handler (around line 524)

```typescript
// Handle 404 Forbidden (already deleted)
if (response.status === 404) {
  showToast('Список уже удалён', 'info');
  await renderLandingView();  // Refresh UI anyway
  return;
}
```

**Why:** Gracefully handle duplicate deletion attempts.

---

## Testing Strategy

### Unit Tests

**Backend Test:**
```python
# tests/api/test_shopping_lists.py
async def test_delete_shopping_list_broadcasts_websocket(client, auth_headers):
    """DELETE /shopping-lists/{id} should broadcast shopping_list_deleted event."""
    # Given: Shopping list exists
    # When: DELETE request
    # Then: WebSocket event "shopping_list_deleted" sent with {"id": list_id}
```

**Frontend Test:**
```typescript
// tests/unit/lists/wsEventHandlers.test.ts
it('should remove shopping list from state on WebSocket event', () => {
  // Given: State has 3 lists
  // When: handleShoppingListDeleted(listId)
  // Then: State has 2 lists, removed list not present
});
```

**Dexie Test:**
```typescript
// tests/unit/dexie/shoppingOperations.test.ts
it('should soft-delete shopping list in Dexie', async () => {
  // Given: List exists with sync_status='synced'
  // When: deleteShoppingList(temp_id)
  // Then: List has sync_status='deleted', is_active=false
});
```

### Integration Tests

1. **Dexie Active:** Delete → Verify cache invalidated → Verify UI loads from API
2. **Dexie Inactive:** Delete → Verify direct API refresh → Verify UI updates
3. **Cross-Tab Sync:** Delete in Tab1 → Verify Tab2 updates via WebSocket

### E2E Tests (Playwright)

**New File:** `tests/e2e/webapp/lists/shopping-list-deletion.spec.ts`

```typescript
test('shopping list deletion syncs across tabs', async ({ browser }) => {
  const page1 = await browser.newPage();
  const page2 = await browser.newPage();

  await page1.goto('/lists');
  await page2.goto('/lists');

  // Tab 1: Delete shopping list
  await page1.locator('[data-list-id="1"] .btn-delete-list').click();
  await page1.locator('.btn-error').click();  // Confirm

  // Tab 1: Verify list removed
  await expect(page1.locator('[data-list-id="1"]')).not.toBeVisible();

  // Tab 2: Verify list also removed (WebSocket sync)
  await expect(page2.locator('[data-list-id="1"]')).not.toBeVisible({ timeout: 2000 });
});

test('shopping list deletion works with Dexie cache', async ({ page }) => {
  await page.goto('/lists');

  // Enable Dexie offline mode
  await page.evaluate(() => window.dexieManager.activate());

  // Delete shopping list
  await page.locator('[data-list-id="1"] .btn-delete-list').click();
  await page.locator('.btn-error').click();

  // Verify list removed from UI
  await expect(page.locator('[data-list-id="1"]')).not.toBeVisible();

  // Reload page (should load from fresh API, not stale cache)
  await page.reload();
  await expect(page.locator('[data-list-id="1"]')).not.toBeVisible();
});
```

---

## Edge Cases & Considerations

### 1. Second DELETE Attempt (404)

**Current:** Error toast "Shopping list 33 not found"
**Fixed:** Info toast "Список уже удалён" + UI refresh

### 2. Viewing Deleted List

**Scenario:** User has list detail view open, another user deletes it.
**Solution:** `handleShoppingListDeleted()` checks `currentListId` and redirects to landing view.

### 3. Offline Deletion

**Behavior:**
- API call fails (no network)
- Dexie queues operation for sync
- Optimistic UI update (remove list from view)
- On reconnect: sync to server → WebSocket broadcast to other clients

**Note:** Requires PGlite offline queue (out of scope, but architecture supports it).

### 4. Concurrent Deletions

**Scenario:** Two users delete same list simultaneously.
**Behavior:**
- First DELETE → 204 + WebSocket broadcast
- Second DELETE → 404 + graceful handling (info toast)

### 5. WebSocket Disconnected

**Scenario:** User deletes while WebSocket offline.
**Behavior:**
- Initiating client updates via `renderLandingView()` (works)
- Other tabs don't receive event (acceptable degradation)
- On reconnect: backlog sync (if implemented)

---

## Critical Files Summary

| File | Change | Lines |
|------|--------|-------|
| `backend/app/api/v1/endpoints/budget_ws.py` | Add broadcast function | After 1140 |
| `backend/app/api/v1/endpoints/shopping_lists.py` | Call broadcast after delete | After 416 |
| `frontend/web/static/js/budget/budgetWSClient/types/events.ts` | Define event type | After 115 |
| `frontend/web/static/js/lists/listsManager/integration/wsEventHandlers.ts` | Implement handler | After 215 |
| `frontend/web/static/js/lists/listsManager/index.ts` | Export handler | After 141 |
| `frontend/web/static/js/budget/budgetWSClient/integration/eventHandlers.ts` | Register handler | After 198 |
| `frontend/shared/db/dexie/operations/shoppingOperations.ts` | Add delete function | After 151 |
| `frontend/shared/db/dexie/index.ts` | Export delete function | After 84 |
| `frontend/web/static/js/lists/listsManager/ui/modalManager.ts` | Fix UI refresh | Line 538 |

---

## Verification Steps

### After Implementation

1. **Backend Verification:**
   ```bash
   # Run on budget-test server
   ssh budget-test
   cd /opt/budget

   # Check logs for WebSocket broadcast
   docker logs budget-backend-1 -f | grep "broadcast_shopping_list_deleted"
   ```

2. **Frontend Verification (Browser DevTools):**
   ```javascript
   // Open two tabs on https://fbd.ikeniborn.ru/lists
   // Tab 1: Delete a shopping list
   // Tab 1 Console: Check for WebSocket event
   // Tab 2 Console: Verify event received and list removed
   ```

3. **Dexie Verification:**
   ```javascript
   // In browser console after deletion
   const db = await window.dexieManager.db;
   const lists = await db.shoppingLists.toArray();
   console.log('Deleted list should have is_active=false:', lists);
   ```

4. **E2E Test Execution:**
   ```bash
   # Run shopping list deletion tests
   npm run test:e2e -- lists/shopping-list-deletion.spec.ts
   ```

### Success Criteria

✅ DELETE request succeeds (HTTP 204)
✅ Success toast shown ("Список успешно удален")
✅ **Shopping list DISAPPEARS from page immediately**
✅ Second DELETE shows info toast ("Список уже удалён")
✅ Other tabs update via WebSocket (list disappears)
✅ Page reload doesn't show deleted list (Dexie cache cleared)
✅ Logs show `broadcast_shopping_list_deleted` call
✅ E2E tests pass (cross-tab sync + Dexie scenarios)

---

## Implementation Order

**Day 1: Core WebSocket Flow**
1. Backend broadcast function + call
2. Frontend event type
3. Frontend event handler
4. Event registration

**Day 2: Cache & UI**
5. Dexie cache invalidation
6. UI refresh enhancement
7. Error handling improvements

**Day 3: Testing**
8. Unit tests (backend + frontend)
9. Integration tests (Dexie scenarios)
10. E2E tests (Playwright multi-tab)

**Total Effort:** ~3 days (1 backend dev + 1 frontend dev)

---

## References

- **Existing Pattern:** Item deletion broadcasts work correctly (see `budget_ws.py:1137`)
- **WebSocket Architecture:** `docs/architecture/core/websocket.md`
- **Dexie Integration:** `docs/architecture/core/dexie-integration.md`
- **Shopping Lists Feature:** `docs/architecture/features/shopping-lists.md` (if exists)

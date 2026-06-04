/**
 * Lists Manager - WebSocket Event Handlers
 *
 * Handles real-time updates from WebSocket connection.
 * Implements cross-list filtering for security and cache synchronization.
 *
 * Phase 3.5: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/listsManager.ts lines 2351-2496
 */

import { getState, updateState } from '../core/ListsState';
import { updateItemsCache } from '../core/listOperations';
import { renderCurrentView } from '../rendering/tableBuilder';
import { updateFABVisibility, renderLandingView, renderShoppingListCards } from '../rendering/listRenderer';
import { updateFABButtons } from '../features/searchFilter';

// ============================================================================
// Type Definitions
// ============================================================================

declare const debugLog: (...args: any[]) => void;
declare const showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle item created event from WebSocket
 *
 * CRITICAL: Cross-list filtering prevents unauthorized item injection
 *
 * @param item - Item data from server (must contain shopping_list_id)
 */
export function handleItemCreated(item: any): void {
  if (!item || !item.id) {
    debugLog('[ListsManager] Invalid item for handleItemCreated');
    return;
  }

  const state = getState();

  // CRITICAL: Filter by current list to prevent cross-list item injection
  if (item.shopping_list_id !== state.currentListId) {
    debugLog('[ListsManager] Item from different list, ignoring:', item.shopping_list_id, 'current:', state.currentListId);
    return;
  }

  // Check if item already exists (avoid duplicates).
  const existingIndex = state.currentItems.findIndex(i => i.id === item.id);

  if (existingIndex !== -1) {
    debugLog('[ListsManager] Replacing existing item with server item:', item.id);
    const newItems = [...state.currentItems];
    newItems[existingIndex] = { ...newItems[existingIndex], ...item };
    updateState({ currentItems: newItems });

    // Re-render and update UI silently (no toast — user already sees the item)
    renderCurrentView();
    updateFABVisibility();
    updateFABButtons();
    updateItemsCache();
    return;
  }

  // Add to items array
  updateState({
    currentItems: [...state.currentItems, item]
  });
  debugLog('[ListsManager] Added item from WebSocket:', item.id);

  // Re-render and update UI
  renderCurrentView();
  updateFABVisibility();
  updateFABButtons();
  updateItemsCache();

  // Show notification
  showToast(`Добавлен товар: ${item.product_name}`, 'info');
}

/**
 * Handle item updated event from WebSocket
 *
 * CRITICAL: Cross-list filtering prevents unauthorized item updates
 *
 * @param item - Updated item data from server (must contain shopping_list_id)
 */
export function handleItemUpdated(item: any): void {
  if (!item || !item.id) {
    debugLog('[ListsManager] Invalid item for handleItemUpdated');
    return;
  }

  const state = getState();

  // CRITICAL: Filter by current list to prevent cross-list item updates
  if (item.shopping_list_id !== state.currentListId) {
    debugLog('[ListsManager] Item from different list, ignoring update:', item.shopping_list_id, 'current:', state.currentListId);
    return;
  }

  const index = state.currentItems.findIndex(i => i.id === item.id);
  if (index === -1) {
    debugLog('[ListsManager] Item not found for update:', item.id);
    // Item doesn't exist locally - add it
    handleItemCreated(item);
    return;
  }

  // Update item in array
  const newItems = [...state.currentItems];
  newItems[index] = { ...newItems[index], ...item };
  updateState({ currentItems: newItems });
  debugLog('[ListsManager] Updated item from WebSocket:', item.id);

  // Re-render and update UI
  renderCurrentView();
  updateFABButtons();
  updateFABVisibility();
  updateItemsCache();
}

/**
 * Handle item deleted event from WebSocket
 *
 * CRITICAL: Cross-list filtering prevents unauthorized item removal
 *
 * @param itemId - Item ID to remove
 * @param shoppingListId - Shopping list ID (for filtering)
 */
export function handleItemDeleted(itemId: number, shoppingListId: number): void {
  if (!itemId) {
    debugLog('[ListsManager] Invalid itemId for handleItemDeleted');
    return;
  }

  const state = getState();

  // CRITICAL: Filter by current list to prevent cross-list item removal
  if (shoppingListId !== undefined && shoppingListId !== state.currentListId) {
    debugLog('[ListsManager] Item from different list, ignoring removal:', shoppingListId, 'current:', state.currentListId);
    return;
  }

  const index = state.currentItems.findIndex(i => i.id === itemId);
  if (index === -1) {
    debugLog('[ListsManager] Item not found for removal:', itemId);
    return;
  }

  const removedItem = state.currentItems[index];
  const newItems = [...state.currentItems];
  newItems.splice(index, 1);

  // Also remove from selection if selected
  const newSelection = new Set(state.selectedItemIds);
  newSelection.delete(itemId);

  updateState({
    currentItems: newItems,
    selectedItemIds: newSelection
  });
  debugLog('[ListsManager] Removed item from WebSocket:', itemId);

  // Re-render and update UI
  renderCurrentView();
  updateFABButtons();
  updateFABVisibility();
  updateItemsCache();

  // Show notification
  showToast(`Удалён товар: ${removedItem.product_name}`, 'info');
}

/**
 * Handle item completed toggle event from WebSocket
 *
 * CRITICAL: Cross-list filtering prevents unauthorized item toggle
 *
 * @param itemId - Item ID
 * @param isCompleted - New completed status
 * @param shoppingListId - Shopping list ID (for filtering)
 */
export function handleItemCompletedToggled(itemId: number, isCompleted: boolean, shoppingListId: number): void {
  if (!itemId) {
    debugLog('[ListsManager] Invalid itemId for handleItemCompletedToggled');
    return;
  }

  const state = getState();

  // CRITICAL: Filter by current list to prevent cross-list item toggle
  if (shoppingListId !== undefined && shoppingListId !== state.currentListId) {
    debugLog('[ListsManager] Item from different list, ignoring toggle:', shoppingListId, 'current:', state.currentListId);
    return;
  }

  const item = state.currentItems.find(i => i.id === itemId);
  if (!item) {
    debugLog('[ListsManager] Item not found for toggle:', itemId);
    return;
  }

  // Update status
  const newItems = [...state.currentItems];
  const index = newItems.findIndex(i => i.id === itemId);
  if (index !== -1) {
    newItems[index] = {
      ...newItems[index],
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : undefined
    };
  }

  updateState({ currentItems: newItems });
  debugLog('[ListsManager] Toggled item from WebSocket:', itemId, isCompleted);

  // Re-render and update UI
  renderCurrentView();
  updateFABButtons();
  updateFABVisibility();
  updateItemsCache();
}

/**
 * Handle shopping list updated event from WebSocket
 *
 * Updates item stats (total_items, completed_items, completion_percentage) in global state
 * and re-renders landing page cards if currently on the landing view.
 *
 * Called when: items are added/deleted/completed on another device (after Phase 1 backend fix)
 *
 * @param shoppingListData - Updated shopping list data from server (includes stats)
 */
export function handleShoppingListUpdated(shoppingListData: any): void {
  if (!shoppingListData || !shoppingListData.id) {
    debugLog('[ListsManager] Invalid data for handleShoppingListUpdated');
    return;
  }

  const state = getState();

  // Find the list in current state
  const listIndex = state.shoppingLists.findIndex(list => list.id === shoppingListData.id);
  if (listIndex === -1) {
    debugLog('[ListsManager] Shopping list not found in state for update:', shoppingListData.id);
    // List not in state - trigger full reload on landing view
    const landingView = document.getElementById('landing-view');
    if (landingView && !landingView.classList.contains('hidden')) {
      renderShoppingListCards();
    }
    return;
  }

  // Update stats in state (merge new stats into existing list entry)
  const updatedList = {
    ...state.shoppingLists[listIndex],
    ...(shoppingListData.total_items !== undefined && { total_items: shoppingListData.total_items }),
    ...(shoppingListData.completed_items !== undefined && { completed_items: shoppingListData.completed_items }),
    ...(shoppingListData.completion_percentage !== undefined && { completion_percentage: shoppingListData.completion_percentage }),
    ...(shoppingListData.name !== undefined && { name: shoppingListData.name }),
  };

  const newLists = [...state.shoppingLists];
  newLists[listIndex] = updatedList;
  updateState({ shoppingLists: newLists });

  debugLog('[ListsManager] Updated shopping list stats from WebSocket:', {
    id: shoppingListData.id,
    total_items: shoppingListData.total_items,
    completed_items: shoppingListData.completed_items,
  });

  // Re-render landing page cards if on landing view
  const landingView = document.getElementById('landing-view');
  if (landingView && !landingView.classList.contains('hidden')) {
    renderShoppingListCards();
    debugLog('[ListsManager] Re-rendered landing page cards with updated stats');
  }
}

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
    // Handle async function with error handling
    renderLandingView().catch(err => {
      console.error('[ListsManager] Failed to render landing view after list deletion:', err);
      // Fallback: just refresh the cards
      renderShoppingListCards();
    });
  } else {
    // Otherwise, just refresh the cards view
    renderShoppingListCards();
  }

  // Show notification
  showToast(`Список удалён: ${removedList.name}`, 'info');
}

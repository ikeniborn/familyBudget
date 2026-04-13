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
import { updateFABVisibility } from '../rendering/listRenderer';
import { updateFABButtons } from '../features/searchFilter';
import { db, generateNumericTempId } from '@db/dexie';

// ============================================================================
// Type Definitions
// ============================================================================

declare const debugLog: (...args: any[]) => void;
declare const showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

// ============================================================================
// Dexie Sync Helpers (BUG #4 fix)
// ----------------------------------------------------------------------------
// WebSocket handlers update in-memory state AND persist changes to Dexie so the
// offline-first reads don't return stale data on next reload. Dexie writes are
// fire-and-forget: a Dexie failure logs a warning but does not block the UI
// re-render.
//
// Primary key for shoppingListItems / shoppingLists is `temp_id` (numeric int53).
// WS payloads carry the server-side `id`, so we look up rows by the secondary
// `id` index and fall back to creating a new row when the record is missing.
// ============================================================================

/**
 * Convert a loosely-typed date value (string | Date | null | undefined) to Date.
 */
function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
}

/**
 * Persist a created/updated item coming from WebSocket into Dexie.
 * If a row with the same server id already exists, it is modified in place;
 * otherwise a fresh row is inserted with a generated temp_id.
 */
async function syncItemToDexie(item: any): Promise<void> {
  try {
    const existing = await db.shoppingListItems.where('id').equals(item.id).first();
    const updated_at = toDate(item.updated_at);

    if (existing) {
      await db.shoppingListItems.where('temp_id').equals(existing.temp_id).modify({
        ...item,
        temp_id: existing.temp_id, // Keep primary key stable
        sync_status: 'synced',
        updated_at,
      });
    } else {
      await db.shoppingListItems.put({
        ...item,
        temp_id: generateNumericTempId(),
        sync_status: 'synced',
        created_at: toDate(item.created_at),
        updated_at,
      });
    }
  } catch (error) {
    debugLog('[ListsManager] Dexie sync failed for item:', item?.id, error);
  }
}

/**
 * Soft-delete an item in Dexie by server id.
 */
async function softDeleteItemInDexie(itemId: number): Promise<void> {
  try {
    await db.shoppingListItems.where('id').equals(itemId).modify({
      sync_status: 'deleted',
      updated_at: new Date(),
    });
  } catch (error) {
    debugLog('[ListsManager] Dexie soft-delete failed for item:', itemId, error);
  }
}

/**
 * Update is_completed on a Dexie row by server id.
 */
async function toggleItemCompletedInDexie(itemId: number, isCompleted: boolean): Promise<void> {
  try {
    await db.shoppingListItems.where('id').equals(itemId).modify({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date() : null,
      sync_status: 'synced',
      updated_at: new Date(),
    });
  } catch (error) {
    debugLog('[ListsManager] Dexie toggle-complete failed for item:', itemId, error);
  }
}

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

  // Check if item already exists (avoid duplicates)
  const exists = state.currentItems.some(i => i.id === item.id);
  if (exists) {
    debugLog('[ListsManager] Item already exists, updating instead:', item.id);
    handleItemUpdated(item);
    return;
  }

  // Add to items array
  updateState({
    currentItems: [...state.currentItems, item]
  });
  debugLog('[ListsManager] Added item from WebSocket:', item.id);

  // Persist to Dexie so offline-first reads stay in sync (BUG #4)
  void syncItemToDexie(item);

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

  // Persist to Dexie (BUG #4)
  void syncItemToDexie(item);

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

  // Soft-delete in Dexie (BUG #4)
  void softDeleteItemInDexie(itemId);

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

  // Persist to Dexie (BUG #4)
  void toggleItemCompletedInDexie(itemId, isCompleted);

  // Re-render and update UI
  renderCurrentView();
  updateFABButtons();
  updateFABVisibility();
  updateItemsCache();
}

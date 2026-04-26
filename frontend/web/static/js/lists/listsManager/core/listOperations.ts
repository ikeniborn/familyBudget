/**
 * Lists Manager - CRUD Operations
 *
 * Core create, update, delete operations for shopping list items.
 * Handles online/offline modes with optimistic UI updates.
 *
 * Phase 3.1 part 2: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/listsManager.ts lines 1860-1940, 3210-3400
 *
 * Phase 4.2 (task-015): Dexie Pending Queue Integration
 * Replaced OfflineShoppingManager with Dexie-first write operations
 */

import { getState } from './ListsState';
import { loadShoppingListItems } from './stateManager';
import { renderCurrentView } from '../rendering/tableBuilder';
import { updateFABButtons } from '../features/searchFilter';
import { updateFABVisibility } from '../rendering/listRenderer';
import {
  getDexieManager,
  isDexieActive,
  db as dexieDb,
  addItemToList,
  updateShoppingListItem,
  toggleItemCompleted as toggleItemCompletedDexie,
  deleteShoppingListItem
} from '@db/dexie';
import { getCurrentUserId } from '@shared/utils/userHelpers';

// ============================================================================
// Type Definitions
// ============================================================================

declare const showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
declare const showConfirmDialog: (message: string, title?: string) => Promise<boolean>;
declare const debugLog: (...args: any[]) => void;

export interface ItemData {
  shopping_list_id?: number;
  store_id?: number;
  product_group_id?: number;
  product_name?: string;
  quantity?: number;
  unit?: string | null;
  comment?: string | null;
  is_completed?: boolean;
}

// ============================================================================
// DOM Selectors
// ============================================================================

const SELECTORS = {
  hierarchyItem: (id: number): string => `.hierarchy-item[data-item-id="${id}"]`,
  hierarchyItemName: '.hierarchy-item-name',
  tableRow: (id: number): string => `#items-table-body tr[data-item-id="${id}"]`,
  tableItemName: '.table-item-name'
} as const;

// ============================================================================
// UI Helper Functions
// ============================================================================

/**
 * Refresh UI after state changes
 * Centralizes UI update logic to avoid code duplication
 */
function refreshUI(): void {
  renderCurrentView();
  updateFABButtons();
  updateFABVisibility();
}

// ============================================================================
// Create Operations
// ============================================================================

/**
 * Create new shopping list item
 * Dexie-first with API fallback (task-015 Phase 4.2)
 *
 * @param data - Item data
 * @returns Created item (with tempId for Dexie, or real id for API)
 */
export async function createItem(data: ItemData): Promise<any> {
  const state = getState();
  const dexie = await getDexieManager();

  try {
    let result;

    // Dexie-first strategy
    if (isDexieActive() && dexie.isReady()) {
      // Find current list temp_id
      const currentList = state.shoppingLists.find(l => l.id === state.currentListId);
      if (!currentList?.temp_id) {
        throw new Error('Current shopping list not found or missing temp_id');
      }

      // Get user ID using standardized helper
      let userId: number;
      try {
        userId = await getCurrentUserId();
      } catch (error) {
        console.error('[LIST_OPS] User ID unavailable:', error);
        throw new Error('User ID not available. Please refresh the page and log in again.');
      }

      // Create in Dexie (auto-adds to pending queue)
      const temp_id = await addItemToList({
        shopping_list_temp_id: currentList.temp_id,
        creator_id: userId,
        product_name: data.product_name || '',
        quantity: data.quantity ?? null,
        unit: data.unit ?? null,
        comment: data.comment ?? null,
        position: null,                        // Auto-assigned by Dexie
        store_id: data.store_id ?? 0,          // 0 = no store
        product_group_id: data.product_group_id ?? 0,  // 0 = no group
        // Completion status
        is_completed: false,
        completed_at: null,
        // Sync tracking
        sync_hash: null,
        content_hash: null,
        synced_at: null,
        version: 1,
        // Soft delete
        deleted_at: null,
        last_modified_by: userId
      });

      result = { tempId: temp_id, id: null };
      debugLog('[LIST_OPS] Item created in Dexie', { temp_id });

      // Background upload: persist item to server before any cache reset
      // Fire-and-forget — UI already reflects local state from Dexie
      dexie.uploadPendingShoppingData().catch((err: unknown) => {
        console.warn('[LIST_OPS] Background item upload failed:', err);
      });

      // Reload items from Dexie (DataLayer now handles temp_id lookup internally)
      if (currentList.id) {
        await loadShoppingListItems(currentList.id);
      } else if (state.currentListId !== null) {
        await loadShoppingListItems(state.currentListId);
      }

    } else {
      // Fallback: direct API call
      const itemData = {
        ...data,
        shopping_list_id: state.currentListId
      };

      const response = await fetch('/api/v1/shopping-list-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(itemData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      result = await response.json();
      debugLog('[LIST_OPS] Item created via API', { id: result.id });

      // Background sync to Dexie (non-blocking, same pattern as list creation)
      (async () => {
        try {
          const creatorId = (window as any).userData?.id || null;

          // Find current list to get temp_id
          const currentList = state.shoppingLists.find(l => l.id === state.currentListId);
          if (!currentList?.temp_id) {
            console.warn('[LIST_OPS] Current list not found or missing temp_id, skipping Dexie sync');
            return;
          }

          // BUG-5 fix: lookup existing Dexie row by server id to reuse temp_id
          // and prevent dup rows (one synthetic `item_<id>_<ts>`, one real UUID).
          const existing = await dexieDb.shoppingListItems.where('id').equals(result.id).first();
          const stableTempId = existing?.temp_id ?? result.temp_id;
          if (!stableTempId) {
            console.warn('[LIST_OPS] No stable temp_id available (existing row not found and API did not echo temp_id); skipping Dexie sync to avoid synthetic id duplication');
            return;
          }

          const localItem = {
            id: result.id,
            temp_id: stableTempId,
            shopping_list_id: result.shopping_list_id ?? currentList.id ?? null,
            shopping_list_temp_id: currentList.temp_id,  // Use list's temp_id (UUID)
            store_id: result.store_id,
            product_group_id: result.product_group_id,
            product_name: result.product_name,
            quantity: result.quantity,
            unit: result.unit,
            comment: result.comment,
            position: result.position,
            is_completed: false,
            creator_id: creatorId,
            created_at: new Date(result.created_at),
            updated_at: new Date(result.updated_at),
            sync_status: 'synced' as const,
            sync_hash: null,
            content_hash: null,
            version: 1,
            deleted_at: null,
            last_modified_by: creatorId,
            synced_at: new Date(),
            completed_at: null
          };

          await dexieDb.shoppingListItems.put(localItem);
          debugLog('[LIST_OPS] ✅ Item synced to Dexie', {
            itemId: result.id,
            listTempId: currentList.temp_id
          });

        } catch (error) {
          console.error('[LIST_OPS] ❌ Item Dexie sync failed:', error);
          // Non-critical - API write succeeded, Dexie is cache only
        }
      })();

      // Reload items from API
      if (state.currentListId) {
        await loadShoppingListItems(state.currentListId);
      }
    }

    showToast('Товар добавлен', 'success');
    refreshUI();

    return result;
  } catch (error) {
    console.error('[LIST_OPS] Error creating item:', error);
    showToast('Ошибка создания товара', 'error');
    throw error;
  }
}

// ============================================================================
// Update Operations
// ============================================================================

/**
 * Update shopping list item
 * Dexie-first with API fallback (task-015 Phase 4.2)
 *
 * @param itemId - Item ID (server ID or 0 for temp items)
 * @param data - Updated data (partial)
 * @returns Updated item
 */
export async function updateItem(itemId: number, data: Partial<ItemData>): Promise<any> {
  const state = getState();
  const dexie = await getDexieManager();

  // Find item and get temp_id
  const item = state.currentItems.find(i => i.id === itemId);
  if (!item) {
    throw new Error('Item not found in state');
  }

  try {
    let result;

    // Dexie-first strategy
    if (isDexieActive() && dexie.isReady() && item.temp_id) {
      // Update in Dexie (auto-adds to pending queue)
      const updates: any = {};
      if (data.product_name !== undefined) updates.product_name = data.product_name;
      if (data.quantity !== undefined) updates.quantity = data.quantity;
      if (data.unit !== undefined) updates.unit = data.unit;
      if (data.comment !== undefined) updates.comment = data.comment;
      if (data.store_id !== undefined) updates.store_id = data.store_id;
      if (data.product_group_id !== undefined) updates.product_group_id = data.product_group_id;

      await updateShoppingListItem(item.temp_id, updates);
      result = { tempId: item.temp_id, id: itemId };
      debugLog('[LIST_OPS] Item updated in Dexie', { temp_id: item.temp_id });

      // Reload items from Dexie
      if (state.currentListId) {
        await loadShoppingListItems(state.currentListId);
      }

    } else {
      // Fallback: direct API call
      const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      result = await response.json();
      debugLog('[LIST_OPS] Item updated via API', { id: itemId });

      // Reload items from API
      if (state.currentListId) {
        await loadShoppingListItems(state.currentListId);
      }
    }

    showToast('Товар обновлен', 'success');
    refreshUI();

    return result;
  } catch (error) {
    console.error('[LIST_OPS] Error updating item:', error);
    showToast('Ошибка обновления товара', 'error');
    throw error;
  }
}

/**
 * Toggle item completed status
 * Dexie-first with API fallback (task-015 Phase 4.2)
 *
 * @param itemId - Item ID (server ID or 0 for temp items)
 * @param isCompleted - New completed status
 */
export async function toggleItemCompleted(itemId: number, isCompleted: boolean): Promise<void> {
  const state = getState();
  const dexie = await getDexieManager();

  // Find item and get temp_id
  const item = state.currentItems.find(i => i.id === itemId);
  if (!item) {
    throw new Error('Item not found in state');
  }

  // Optimistic DOM update (instant visual feedback)
  updateItemCompletedDom(itemId, isCompleted);

  // Optimistically reflect state in the in-memory items list so an immediate
  // re-render with hideCompleted on actually drops the row (otherwise the
  // optimistic class toggle leaves the row visible with opacity-60 until the
  // network round-trip finishes — see BUG-3).
  const optimisticItem = state.currentItems.find(i => i.id === itemId);
  if (optimisticItem) {
    optimisticItem.is_completed = isCompleted;
  }
  if (getState().hideCompleted) {
    renderCurrentView();
  }

  try {
    // Dexie-first strategy
    if (isDexieActive() && dexie.isReady() && item.temp_id) {
      // Toggle in Dexie (auto-adds to pending queue)
      await toggleItemCompletedDexie(item.temp_id, isCompleted);
      debugLog('[LIST_OPS] Item completion toggled in Dexie', { temp_id: item.temp_id, isCompleted });

      // Reload items from Dexie
      if (state.currentListId) {
        await loadShoppingListItems(state.currentListId);
      }

    } else {
      // Fallback: direct API call
      const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ is_completed: isCompleted })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      debugLog('[LIST_OPS] Item completion toggled via API', { id: itemId, isCompleted });

      // Reload items from API
      if (state.currentListId) {
        await loadShoppingListItems(state.currentListId);
      }
    }

    refreshUI();

  } catch (error) {
    console.error('[LIST_OPS] Error toggling item completed:', error);

    // Revert DOM update on error
    updateItemCompletedDom(itemId, !isCompleted);
    // Also revert optimistic in-memory state and re-render so a hidden row
    // re-appears if the toggle ultimately failed (BUG-3 revert path).
    const revertItem = getState().currentItems.find(i => i.id === itemId);
    if (revertItem) {
      revertItem.is_completed = !isCompleted;
    }
    if (getState().hideCompleted) {
      renderCurrentView();
    }
    showToast('Ошибка обновления статуса', 'error');
  }
}

/**
 * Update item completed state in DOM (optimistic update without full re-render)
 *
 * @param itemId - Item ID
 * @param isCompleted - Completed state to set
 * @returns {void}
 */
function updateItemCompletedDom(itemId: number, isCompleted: boolean): void {
  // Update hierarchy view item
  const hierarchyItem = document.querySelector(SELECTORS.hierarchyItem(itemId));
  if (hierarchyItem) {
    hierarchyItem.classList.toggle('completed', isCompleted);
    hierarchyItem.setAttribute('data-item-completed', String(isCompleted));

    // Update item name with line-through
    const nameElement = hierarchyItem.querySelector(SELECTORS.hierarchyItemName);
    if (nameElement) {
      nameElement.classList.toggle('line-through', isCompleted);
    }
  }

  // Also update table view if visible
  const tableRow = document.querySelector(SELECTORS.tableRow(itemId));
  if (tableRow) {
    tableRow.classList.toggle('completed', isCompleted);
    const tableName = tableRow.querySelector(SELECTORS.tableItemName);
    if (tableName) {
      tableName.classList.toggle('line-through', isCompleted);
      tableName.classList.toggle('opacity-60', isCompleted);
    }
  }
}

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Delete shopping list item
 * Dexie-first with API fallback (task-015 Phase 4.2)
 *
 * @param itemId - Item ID (server ID or 0 for temp items)
 * @param skipConfirm - Skip confirmation dialog (default: false)
 */
export async function deleteItem(itemId: number, skipConfirm: boolean = false): Promise<void> {
  if (!skipConfirm) {
    const confirmed = await showConfirmDialog(
      'Удалить этот товар?',
      '🗑️ Удаление товара'
    );
    if (!confirmed) {
      return;
    }
  }

  const state = getState();
  const dexie = await getDexieManager();

  // Find item — may be undefined if state wasn't initialized (e.g. after login redirect)
  const item = state.currentItems.find(i => i.id === itemId);

  try {
    // Dexie-first strategy (only when item found in state with temp_id)
    if (item && isDexieActive() && dexie.isReady() && item.temp_id) {
      // Delete in Dexie (soft delete, adds to pending queue)
      await deleteShoppingListItem(item.temp_id);
      debugLog('[LIST_OPS] Item deleted in Dexie', { temp_id: item.temp_id });

      // Background upload: push delete to server before any cache reset
      // Fire-and-forget — UI already reflects local state from Dexie
      dexie.uploadPendingShoppingData().catch((err: unknown) => {
        console.warn('[LIST_OPS] Background delete upload failed:', err);
      });

      // Reload items from Dexie
      if (state.currentListId) {
        await loadShoppingListItems(state.currentListId);
      }

    } else {
      // Fallback: direct API call
      const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      debugLog('[LIST_OPS] Item deleted via API', { id: itemId });

      // Reload items from API
      if (state.currentListId) {
        await loadShoppingListItems(state.currentListId);
      }
    }

    showToast('Товар удален', 'success');
    refreshUI();

  } catch (error) {
    console.error('[LIST_OPS] Error deleting item:', error);
    showToast('Ошибка удаления товара', 'error');
  }
}

/**
 * Delete multiple items
 * Dexie-first with API fallback (task-015 Phase 4.2)
 *
 * @param itemIds - Array of item IDs to delete
 * @param skipConfirm - Skip confirmation dialog (default: false)
 */
export async function deleteMultipleItems(itemIds: number[], skipConfirm: boolean = false): Promise<void> {
  if (itemIds.length === 0) return;

  if (!skipConfirm) {
    const confirmed = await showConfirmDialog(
      `Удалить выбранные товары (${itemIds.length})?\nЭто действие необратимо.`,
      '🗑️ Удаление товаров'
    );
    if (!confirmed) {
      return;
    }
  }

  const state = getState();
  const dexie = await getDexieManager();

  try {
    // Dexie-first strategy
    if (isDexieActive() && dexie.isReady()) {
      // Find items and get temp_ids
      const itemsToDelete = state.currentItems.filter(item => itemIds.includes(item.id));
      const tempIds = itemsToDelete.map(item => item.temp_id).filter(Boolean) as string[];

      if (tempIds.length !== itemIds.length) {
        // FALLBACK: If temp_id missing, use API-only deletion (skip Dexie)
        console.warn('[LIST_OPS] Some items missing temp_id, using API-only deletion');

        // API-only bulk delete
        await Promise.all(
          itemIds.map(id =>
            fetch(`/api/v1/shopping-list-items/${id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin'
            })
          )
        );

        // Reload from server to sync state
        if (state.currentListId) {
          await loadShoppingListItems(state.currentListId);
        }
        renderCurrentView();
        return;
      }

      // Delete each item in Dexie (parallel)
      await Promise.all(tempIds.map(temp_id => deleteShoppingListItem(temp_id)));
      debugLog('[LIST_OPS] Bulk deleted items in Dexie', { count: tempIds.length });

      // Background upload: push deletes to server before any cache reset
      // Fire-and-forget — UI already reflects local state from Dexie
      dexie.uploadPendingShoppingData().catch((err: unknown) => {
        console.warn('[LIST_OPS] Background bulk delete upload failed:', err);
      });

      // Reload items from Dexie
      if (state.currentListId) {
        await loadShoppingListItems(state.currentListId);
      }

    } else {
      // Fallback: direct API calls (parallel)
      const promises = itemIds.map(id =>
        fetch(`/api/v1/shopping-list-items/${id}`, {
          method: 'DELETE',
          credentials: 'same-origin'
        })
      );

      await Promise.all(promises);
      debugLog('[LIST_OPS] Bulk deleted items via API', { count: itemIds.length });

      // Reload items from API
      if (state.currentListId) {
        await loadShoppingListItems(state.currentListId);
      }
    }

    showToast(`Удалено товаров: ${itemIds.length}`, 'success');
    refreshUI();

  } catch (error) {
    console.error('[LIST_OPS] Error deleting multiple items:', error);
    showToast('Ошибка удаления товаров', 'error');
  }
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Update items cache (deprecated - removed in Dexie migration)
 * Dexie handles caching automatically via shoppingListItems table
 */
export async function updateItemsCache(): Promise<void> {
  // No-op: Dexie migration - caching handled by DataLayer
  debugLog('[ListsManager] Cache update skipped (Dexie handles caching)');
}

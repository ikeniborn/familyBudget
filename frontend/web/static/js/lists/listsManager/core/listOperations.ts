/**
 * Lists Manager - CRUD Operations
 *
 * Core create, update, delete operations for shopping list items.
 * Direct REST API calls.
 */

import { getState } from './ListsState';
import { loadShoppingListItems } from './stateManager';
import { renderCurrentView } from '../rendering/tableBuilder';
import { updateFABButtons } from '../features/searchFilter';
import { updateFABVisibility } from '../rendering/listRenderer';

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
 * Create new shopping list item via REST API.
 *
 * @param data - Item data
 * @returns Created item
 */
export async function createItem(data: ItemData): Promise<any> {
  const state = getState();

  try {
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

    const result = await response.json();
    debugLog('[LIST_OPS] Item created via API', { id: result.id });

    if (state.currentListId) {
      await loadShoppingListItems(state.currentListId);
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
 * Update shopping list item via REST API.
 *
 * @param itemId - Item ID
 * @param data - Updated data (partial)
 * @returns Updated item
 */
export async function updateItem(itemId: number, data: Partial<ItemData>): Promise<any> {
  const state = getState();

  try {
    const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    debugLog('[LIST_OPS] Item updated via API', { id: itemId });

    if (state.currentListId) {
      await loadShoppingListItems(state.currentListId);
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
 * Toggle item completed status via REST API.
 *
 * @param itemId - Item ID
 * @param isCompleted - New completed status
 */
export async function toggleItemCompleted(itemId: number, isCompleted: boolean): Promise<void> {
  const state = getState();

  const item = state.currentItems.find(i => i.id === itemId);
  if (!item) {
    // Item may have been reloaded with updated state (e.g. during bulk mark-all)
    debugLog('[LIST_OPS] Item not found in state during toggle, skipping', { itemId });
    return;
  }

  // Optimistic DOM update (instant visual feedback)
  updateItemCompletedDom(itemId, isCompleted);

  // Optimistically reflect state in the in-memory items list so an immediate
  // re-render with hideCompleted on actually drops the row (BUG-3).
  const optimisticItem = state.currentItems.find(i => i.id === itemId);
  if (optimisticItem) {
    optimisticItem.is_completed = isCompleted;
  }
  if (getState().hideCompleted) {
    renderCurrentView();
  }

  try {
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

    if (state.currentListId) {
      await loadShoppingListItems(state.currentListId);
    }

    refreshUI();

  } catch (error) {
    console.error('[LIST_OPS] Error toggling item completed:', error);

    // Revert DOM update on error
    updateItemCompletedDom(itemId, !isCompleted);
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
 */
function updateItemCompletedDom(itemId: number, isCompleted: boolean): void {
  const hierarchyItem = document.querySelector(SELECTORS.hierarchyItem(itemId));
  if (hierarchyItem) {
    hierarchyItem.classList.toggle('completed', isCompleted);
    hierarchyItem.setAttribute('data-item-completed', String(isCompleted));

    const nameElement = hierarchyItem.querySelector(SELECTORS.hierarchyItemName);
    if (nameElement) {
      nameElement.classList.toggle('line-through', isCompleted);
    }
  }

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
 * Delete shopping list item via REST API.
 *
 * @param itemId - Item ID
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

  try {
    const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    debugLog('[LIST_OPS] Item deleted via API', { id: itemId });

    if (state.currentListId) {
      await loadShoppingListItems(state.currentListId);
    }

    showToast('Товар удален', 'success');
    refreshUI();

  } catch (error) {
    console.error('[LIST_OPS] Error deleting item:', error);
    showToast('Ошибка удаления товара', 'error');
  }
}

/**
 * Delete multiple items via REST API (parallel requests).
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

  try {
    const promises = itemIds.map(id =>
      fetch(`/api/v1/shopping-list-items/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      })
    );

    await Promise.all(promises);
    debugLog('[LIST_OPS] Bulk deleted items via API', { count: itemIds.length });

    if (state.currentListId) {
      await loadShoppingListItems(state.currentListId);
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
 * Update items cache (no-op kept for callsite compatibility).
 * Data is loaded directly from API on demand.
 */
export async function updateItemsCache(): Promise<void> {
  debugLog('[ListsManager] Cache update skipped (API-only mode)');
}

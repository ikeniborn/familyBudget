/**
 * Lists Manager - Multiple Item Selection
 *
 * Handles multiple item selection and bulk operations.
 * Provides select all/none, select completed, and bulk delete functionality.
 *
 * Phase 3.3: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/listsManager.ts lines 1776-1856, 1946-1987
 */

import { getState, updateState } from '../core/ListsState';
import { renderCurrentView } from '../rendering/tableBuilder';

// ============================================================================
// Type Definitions
// ============================================================================

declare const showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
declare const showConfirmDialog: (message: string, title?: string) => Promise<boolean>;
declare const debugLog: (...args: any[]) => void;

// ============================================================================
// Selection Management
// ============================================================================

/**
 * Toggle select all/deselect all
 *
 * If all items are selected - deselect all
 * Otherwise - select all
 */
export function toggleSelectAll(): void {
  const state = getState();
  const allSelected = state.selectedItemIds.size === state.currentItems.length && state.currentItems.length > 0;

  if (allSelected) {
    // Deselect all
    updateState({ selectedItemIds: new Set() });
  } else {
    // Select all
    const newSelectedIds = new Set<number>();
    state.currentItems.forEach(item => {
      newSelectedIds.add(item.id);
    });
    updateState({ selectedItemIds: newSelectedIds });
  }

  renderCurrentView();
}

/**
 * Select completed items
 */
export function selectCompleted(): void {
  const state = getState();
  const newSelectedIds = new Set<number>();

  state.currentItems
    .filter(item => item.is_completed)
    .forEach(item => {
      newSelectedIds.add(item.id);
    });

  updateState({ selectedItemIds: newSelectedIds });
  renderCurrentView();
  showToast(`Выбрано ${newSelectedIds.size} выполненных товаров`, 'info');
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Delete selected items
 */
export async function deleteSelected(): Promise<void> {
  const state = getState();

  if (state.selectedItemIds.size === 0) {
    return;
  }

  const count = state.selectedItemIds.size;
  const confirmed = await showConfirmDialog(
    `Удалить выбранные товары (${count})?\nЭто действие необратимо.`,
    '🗑️ Удаление товаров'
  );
  if (!confirmed) {
    return;
  }

  try {
    const itemIds = Array.from(state.selectedItemIds);

    const response = await fetch('/api/v1/shopping-list-items/batch-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify({ item_ids: itemIds })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Remove from local state
    const newItems = state.currentItems.filter(item => !state.selectedItemIds.has(item.id));
    updateState({
      currentItems: newItems,
      selectedItemIds: new Set()
    });

    // Re-render based on current view
    if (state.currentView === 'hierarchy' && state.hierarchyView) {
      state.hierarchyView.render();
    } else {
      renderCurrentView();
    }

    showToast(`Удалено товаров: ${count}`, 'success');

  } catch (error) {
    console.error('[ListsManager] Error deleting selected items:', error);
    showToast('Ошибка удаления товаров', 'error');
  }
}

// ============================================================================
// UI Updates
// ============================================================================

/**
 * Update selection UI
 *
 * Updates delete button and select all button states
 * Note: This method is called from renderItemsTable() but the selection UI
 * elements (delete-selected-btn, select-all-btn) are not currently in the HTML.
 * Adding null checks to prevent errors.
 */
export function updateSelectionUI(): void {
  const state = getState();
  const deleteBtn = document.getElementById('delete-selected-btn') as HTMLButtonElement | null;
  const selectAllBtn = document.getElementById('select-all-btn') as HTMLButtonElement | null;

  // Update delete button state - preserve mobile-friendly structure
  if (deleteBtn) {
    if (state.selectedItemIds.size > 0) {
      deleteBtn.disabled = false;
      // Update only the text span, keep icon
      const textSpan = deleteBtn.querySelector('span:last-child');
      if (textSpan && textSpan.classList.contains('hidden')) {
        // Mobile: show count in icon span
        const iconSpan = deleteBtn.querySelector('span:first-child');
        if (iconSpan) iconSpan.textContent = `🗑️${state.selectedItemIds.size}`;
      } else if (textSpan) {
        // Desktop: show full text
        textSpan.textContent = `Удалить (${state.selectedItemIds.size})`;
      }
    } else {
      deleteBtn.disabled = true;
      const textSpan = deleteBtn.querySelector('span:last-child');
      if (textSpan && textSpan.classList.contains('hidden')) {
        const iconSpan = deleteBtn.querySelector('span:first-child');
        if (iconSpan) iconSpan.textContent = '🗑️';
      } else if (textSpan) {
        textSpan.textContent = 'Удалить';
      }
    }
  }

  // Update select all button - preserve mobile-friendly structure
  if (selectAllBtn) {
    const selectAllTextSpan = selectAllBtn.querySelector('span:last-child');
    const selectAllIconSpan = selectAllBtn.querySelector('span:first-child');
    if (state.selectedItemIds.size === state.currentItems.length && state.currentItems.length > 0) {
      if (selectAllIconSpan) selectAllIconSpan.textContent = '☐';
      if (selectAllTextSpan) selectAllTextSpan.textContent = 'Снять выделение';
    } else {
      if (selectAllIconSpan) selectAllIconSpan.textContent = '☑️';
      if (selectAllTextSpan) selectAllTextSpan.textContent = 'Выделить все';
    }
  }
}

// ============================================================================
// Bulk Delete Confirmation Modal (v7.x.x migration fix)
// ============================================================================

/**
 * Pending delete IDs for bulk delete confirmation
 * Populated when user initiates bulk delete, cleared after confirmation or cancellation
 */
let pendingDeleteIds: number[] = [];

/**
 * Confirm bulk delete operation
 * Called from lists.html line 448: onclick="confirmDelete()"
 *
 * Created: 2026-01-11 (v7.x.x migration fix)
 */
export async function confirmDelete(): Promise<void> {
  if (pendingDeleteIds.length === 0) {
    debugLog('[BULK_DELETE] No pending delete IDs');
    return;
  }

  debugLog('[BULK_DELETE] Confirming deletion of', pendingDeleteIds.length, 'items');

  try {
    const response = await fetch('/api/v1/shopping-list-items/batch-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify({ item_ids: pendingDeleteIds })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Remove from local state
    const state = getState();
    const deletedIds = new Set(pendingDeleteIds);
    const newItems = state.currentItems.filter(item => !deletedIds.has(item.id));

    updateState({
      currentItems: newItems,
      selectedItemIds: new Set()
    });

    // Re-render based on current view
    if (state.currentView === 'hierarchy' && state.hierarchyView) {
      state.hierarchyView.render();
    } else {
      renderCurrentView();
    }

    showToast(`Удалено товаров: ${pendingDeleteIds.length}`, 'success');

  } catch (error) {
    debugLog('[BULK_DELETE] Error:', error);
    showToast('Ошибка удаления товаров', 'error');
  } finally {
    // Close modal and clear pending IDs
    closeDeleteConfirmModal();
  }
}

/**
 * Close bulk delete confirmation modal
 * Called from lists.html line 447: onclick="closeDeleteConfirmModal()"
 *
 * Created: 2026-01-11 (v7.x.x migration fix)
 */
export function closeDeleteConfirmModal(): void {
  const modal = document.getElementById('delete-confirm-modal') as HTMLDialogElement | null;
  if (modal) {
    modal.close();
  }

  // Clear pending delete IDs
  pendingDeleteIds = [];

  debugLog('[BULK_DELETE] Modal closed, pending IDs cleared');
}

/**
 * Open bulk delete confirmation modal
 * Modified version of deleteSelected() that uses modal instead of native confirm
 *
 * Note: This can be used as replacement for deleteSelected() if modal UI is preferred
 */
export function deleteSelectedWithModal(): void {
  const state = getState();

  if (state.selectedItemIds.size === 0) {
    return;
  }

  // Store IDs for later confirmation
  pendingDeleteIds = Array.from(state.selectedItemIds);

  // Update modal content (if modal has dynamic text element)
  const countElement = document.getElementById('delete-confirm-count');
  if (countElement) {
    countElement.textContent = pendingDeleteIds.length.toString();
  }

  // Open modal
  const modal = document.getElementById('delete-confirm-modal') as HTMLDialogElement | null;
  if (modal) {
    modal.showModal();
  } else {
    console.warn('[BULK_DELETE] Modal not found, falling back to native confirm');
    // Fallback to existing deleteSelected()
    deleteSelected();
  }
}

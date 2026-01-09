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
  if (!confirm(`Удалить выбранные товары (${count})?`)) {
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

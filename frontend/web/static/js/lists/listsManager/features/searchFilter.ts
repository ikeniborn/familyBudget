/**
 * Lists Manager - Search and Filter Features
 *
 * Handles search query management and hide completed filter.
 * Updates UI state and persists preferences to localStorage.
 *
 * Phase 3.3: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/listsManager.ts lines 1082-1132, 1137-1157
 */

import { getState, updateState } from '../core/ListsState';
import { renderCurrentView } from '../rendering/tableBuilder';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create responsive text with mobile (short) and desktop (full) versions
 * Used for button labels that need different text on mobile vs desktop
 * @param short - Short text for mobile (<640px), e.g. "Скрыть"
 * @param full - Full text for desktop (>=640px), e.g. "Скрыть выполненные"
 * @returns HTML string with responsive spans using Tailwind classes
 * @example
 * createResponsiveText('Показать', 'Показать все')
 * // Returns: '<span class="sm:hidden">Показать</span><span class="hidden sm:inline">Показать все</span>'
 */
function createResponsiveText(short: string, full: string): string {
  return `
    <span class="sm:hidden">${short}</span>
    <span class="hidden sm:inline">${full}</span>
  `;
}

// ============================================================================
// Type Definitions
// ============================================================================

declare const debugLog: (...args: any[]) => void;

// ============================================================================
// Search Query Management
// ============================================================================

/**
 * Set search query and re-render view
 *
 * @param query - Search query string
 */
export function handleSearch(query: string): void {
  updateState({ searchQuery: query });

  // Show/hide clear button
  const clearBtn = document.getElementById('clear-search-btn');
  if (clearBtn) {
    if (query && query.trim() !== '') {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }

  // Re-render based on current view
  const state = getState();
  if (state.currentView === 'hierarchy' && state.hierarchyView) {
    state.hierarchyView.render();
  } else {
    renderCurrentView();
  }
}

/**
 * Clear search query
 */
export function clearSearch(): void {
  const input = document.getElementById('items-search') as HTMLInputElement | null;
  if (input) {
    input.value = '';
  }
  handleSearch('');
}

/**
 * Toggle search field visibility
 */
export function toggleSearchField(): void {
  const searchContainer = document.getElementById('search-field-container');
  const searchInput = document.getElementById('items-search') as HTMLInputElement;

  if (!searchContainer) return;

  const isHidden = searchContainer.classList.contains('hidden');

  if (isHidden) {
    // Show search field
    searchContainer.classList.remove('hidden');
    searchInput?.focus();
  } else {
    // Hide search field and clear search
    searchContainer.classList.add('hidden');
    if (searchInput) searchInput.value = '';
    clearSearch();
  }
}

// ============================================================================
// FAB Buttons Management
// ============================================================================

/**
 * Update FAB button visibility based on item completion state
 *
 * Visibility rules:
 * - Delete completed (🗑️): Show only if at least 1 completed item exists
 * - Mark all completed (✅): Hide if ALL items are completed
 * - Unmark all completed (❌): Hide if ALL items are NOT completed
 */
export function updateFABButtons(): void {
  const state = getState();

  // Early exit if no items
  if (!state.currentItems || state.currentItems.length === 0) {
    // Hide all action button containers when list is empty
    document.getElementById('fab-item-delete-completed')?.classList.add('hidden');
    document.getElementById('fab-item-mark-all-completed')?.classList.add('hidden');
    document.getElementById('fab-item-unmark-all-completed')?.classList.add('hidden');
    return;
  }

  // Count item states
  const completedCount = state.currentItems.filter(item => item.is_completed).length;
  const totalCount = state.currentItems.length;
  const uncompletedCount = totalCount - completedCount;

  // Delete completed container (🗑️): Show only if there are completed items
  const deleteItem = document.getElementById('fab-item-delete-completed');
  if (deleteItem) {
    if (completedCount > 0) {
      deleteItem.classList.remove('hidden');
    } else {
      deleteItem.classList.add('hidden');
    }
  }

  // Mark all completed container (✅): Hide if all items are already completed
  const markAllItem = document.getElementById('fab-item-mark-all-completed');
  if (markAllItem) {
    if (uncompletedCount > 0) {
      markAllItem.classList.remove('hidden');
    } else {
      markAllItem.classList.add('hidden');
    }
  }

  // Unmark all completed container (❌): Hide if all items are NOT completed
  const unmarkAllItem = document.getElementById('fab-item-unmark-all-completed');
  if (unmarkAllItem) {
    if (completedCount > 0) {
      unmarkAllItem.classList.remove('hidden');
    } else {
      unmarkAllItem.classList.add('hidden');
    }
  }
}

// ============================================================================
// Hide Completed Filter
// ============================================================================

/**
 * Toggle hide completed items filter
 * Saves preference to localStorage for persistence across sessions
 */
export function toggleHideCompleted(): void {
  const state = getState();
  const newValue = !state.hideCompleted;
  updateState({ hideCompleted: newValue });

  // Save preference to localStorage
  try {
    localStorage.setItem('lists_hide_completed_preference', newValue.toString());
    debugLog('[ListsManager] Saved hide completed preference:', newValue);
  } catch (e) {
    // localStorage may be unavailable in private browsing
  }

  updateHideCompletedButton();
  renderCurrentView();
  updateFABButtons();
}

/**
 * Update hide completed button state
 */
export function updateHideCompletedButton(): void {
  const state = getState();
  const btn = document.getElementById('toggle-hide-completed-btn');
  if (!btn) return;

  const iconSpan = btn.querySelector('span:first-child');
  const textSpan = btn.querySelector('span:nth-child(2)');

  if (state.hideCompleted) {
    if (iconSpan) iconSpan.textContent = '👁️‍🗨️';
    if (textSpan) {
      textSpan.innerHTML = createResponsiveText('Показать', 'Показать все');
    }
    btn.title = 'Показать все товары';
    btn.classList.add('btn-primary');
    btn.classList.remove('btn-outline');
  } else {
    if (iconSpan) iconSpan.textContent = '👁️';
    if (textSpan) {
      textSpan.innerHTML = createResponsiveText('Скрыть', 'Скрыть выполненные');
    }
    btn.title = 'Скрыть выполненные товары';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-outline');
  }

  // Update icon visibility based on completion state
  if (typeof updateFABButtons === 'function') {
    updateFABButtons();
  }
}

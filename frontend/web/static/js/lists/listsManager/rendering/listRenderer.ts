/**
 * Lists Manager - List View Rendering
 *
 * Orchestrates landing view (list cards) and detail view (items table).
 * Handles view switching, FAB visibility, and breadcrumb updates.
 *
 * Phase 3.2: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/listsManager.ts lines 460-604, 852-900
 */

import { getState, updateState } from '../core/ListsState';
import { loadShoppingLists, loadShoppingListItems } from '../core/stateManager';
import { renderCurrentView } from './tableBuilder';

// ============================================================================
// Type Definitions
// ============================================================================

declare const debugLog: (...args: any[]) => void;
declare const showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
declare const closeImportWizard: () => void;
declare const openDeleteListModal: (listId: number, listName: string) => void;

declare global {
  interface Window {
    listsManager?: any;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Check if current device is desktop (width >= 768px)
 */
function isDesktop(): boolean {
  return window.innerWidth >= 768;
}

// ============================================================================
// FAB Visibility Management
// ============================================================================

/**
 * Show FAB menu (detail view only - mass operations, desktop only)
 */
function showFAB(): void {
  const isDesktopResult = isDesktop();
  debugLog('[FAB] showFAB() called', { isDesktop: isDesktopResult });

  if (!isDesktopResult) return;

  const fabMenu = document.getElementById('lists-fab-menu');
  if (fabMenu) fabMenu.classList.remove('hidden');
}

/**
 * Hide FAB menu (when switching to landing view, desktop only)
 */
function hideFAB(): void {
  const isDesktopResult = isDesktop();
  debugLog('[FAB] hideFAB() called', { isDesktop: isDesktopResult });

  if (!isDesktopResult) return;

  const fabMenu = document.getElementById('lists-fab-menu');
  if (fabMenu) fabMenu.classList.add('hidden');
}

/**
 * Show add item FAB (detail view only - desktop only)
 */
function showAddItemFAB(): void {
  const isDesktopResult = isDesktop();
  debugLog('[FAB] showAddItemFAB() called', { isDesktop: isDesktopResult });

  if (!isDesktopResult) return;

  const addItemFab = document.getElementById('lists-add-item-fab');
  if (addItemFab) addItemFab.classList.remove('hidden');
}

/**
 * Hide add item FAB (when switching to landing view, desktop only)
 */
function hideAddItemFAB(): void {
  const isDesktopResult = isDesktop();
  debugLog('[FAB] hideAddItemFAB() called', { isDesktop: isDesktopResult });

  if (!isDesktopResult) return;

  const addItemFab = document.getElementById('lists-add-item-fab');
  if (addItemFab) addItemFab.classList.add('hidden');
}

/**
 * Show create list FAB (landing view only - desktop only)
 */
function showCreateListFAB(): void {
  const isDesktopResult = isDesktop();
  debugLog('[FAB] showCreateListFAB() called', { isDesktop: isDesktopResult });

  if (!isDesktopResult) return;

  const createListFab = document.getElementById('lists-create-list-fab');
  if (createListFab) createListFab.classList.remove('hidden');
}

/**
 * Hide create list FAB (when switching to detail view, desktop only)
 */
function hideCreateListFAB(): void {
  const isDesktopResult = isDesktop();
  debugLog('[FAB] hideCreateListFAB() called', { isDesktop: isDesktopResult });

  if (!isDesktopResult) return;

  const createListFab = document.getElementById('lists-create-list-fab');
  if (createListFab) createListFab.classList.add('hidden');
}

/**
 * Update FAB visibility based on current view
 * Shows FAB when in detail view (regardless of item count)
 */
export function updateFABVisibility(): void {
  const fabMenu = document.getElementById('lists-fab-menu');
  const fabBackdrop = document.getElementById('lists-fab-backdrop');

  const state = getState();
  const inDetailView = state.currentListId !== null;
  const isDesktopResult = isDesktop();

  debugLog('[FAB] updateFABVisibility', {
    inDetailView,
    isDesktop: isDesktopResult,
    currentListId: state.currentListId,
  });

  if (inDetailView && isDesktopResult) {
    // Detail view: show FAB
    if (fabMenu) fabMenu.classList.remove('hidden');
  } else {
    // Landing view or mobile: hide FAB
    if (fabMenu) fabMenu.classList.add('hidden');
    if (fabBackdrop) fabBackdrop.classList.add('hidden');
  }
}

/**
 * Update hide completed button state
 */
function updateHideCompletedButton(): void {
  const state = getState();
  const btn = document.getElementById('toggle-hide-completed-btn');
  if (!btn) return;

  if (state.hideCompleted) {
    btn.classList.remove('btn-outline');
    btn.classList.add('btn-primary');
    btn.textContent = '👁️ Показать все';
  } else {
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-outline');
    btn.textContent = '👁️ Скрыть выполненные';
  }
}

// ============================================================================
// View Switching
// ============================================================================

/**
 * Switch between table and hierarchy views
 */
export function switchView(viewName: 'table' | 'hierarchy'): void {
  // Save preference to localStorage
  try {
    localStorage.setItem('lists_view_preference', viewName);
    debugLog('[ListsManager] Saved view preference:', viewName);
  } catch (e) {
    // localStorage may be unavailable in private browsing
  }

  // Update state
  updateState({ currentView: viewName });

  // Update view toggle buttons
  const tableBtn = document.getElementById('view-table-btn');
  const hierarchyBtn = document.getElementById('view-hierarchy-btn');

  if (viewName === 'hierarchy') {
    if (tableBtn) {
      tableBtn.classList.remove('btn-primary');
      tableBtn.classList.add('btn-outline');
    }
    if (hierarchyBtn) {
      hierarchyBtn.classList.remove('btn-outline');
      hierarchyBtn.classList.add('btn-primary');
    }
  } else {
    if (tableBtn) {
      tableBtn.classList.remove('btn-outline');
      tableBtn.classList.add('btn-primary');
    }
    if (hierarchyBtn) {
      hierarchyBtn.classList.remove('btn-primary');
      hierarchyBtn.classList.add('btn-outline');
    }
  }

  // Render current view
  renderCurrentView();
}

/**
 * Initialize view based on screen width
 * Mobile (< 640px) defaults to hierarchy view for better UX
 */
export function initializeResponsiveView(): void {
  const isMobile = window.innerWidth < 640;
  const savedPreference = localStorage.getItem('lists_view_preference');

  // If mobile and no saved preference, use hierarchy view
  if (isMobile && !savedPreference) {
    debugLog('[ListsManager] Mobile detected, switching to hierarchy view');
    switchView('hierarchy');
  } else if (savedPreference) {
    // Restore saved preference
    switchView(savedPreference as 'table' | 'hierarchy');
  } else {
    // Desktop defaults to table view
    switchView('table');
  }
}

// ============================================================================
// Landing View
// ============================================================================

/**
 * Render shopping list cards in grid
 */
export function renderShoppingListCards(): void {
  const state = getState();
  const grid = document.getElementById('lists-grid');
  const emptyState = document.getElementById('empty-state');

  if (state.shoppingLists.length === 0) {
    if (grid) grid.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (grid) grid.classList.remove('hidden');
  if (emptyState) emptyState.classList.add('hidden');

  if (!grid) return;

  grid.innerHTML = state.shoppingLists.map(list => {
    const totalItems = list.total_items || 0;
    const completedItems = list.completed_items || 0;
    const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    // Escape name for use in onclick attribute
    const escapedName = escapeHtml(list.name).replace(/'/g, "\\'");

    return `
      <div class="shopping-list-card" onclick="window.listsManager.showDetailView(${list.id})">
        <div class="flex justify-between items-start mb-2">
          <div class="card-title flex-1">${escapeHtml(list.name)}</div>
          <button class="btn btn-ghost btn-sm btn-circle text-error hover:bg-error hover:text-error-content ml-2"
                  onclick="event.stopPropagation(); openDeleteListModal(${list.id}, '${escapedName}');"
                  title="Удалить список"
                  aria-label="Удалить список ${escapeHtml(list.name)}"
                  style="transform: scale(1.25);">
            🗑️
          </button>
        </div>
        <div class="card-description truncate-2-lines">
          ${list.description ? escapeHtml(list.description) : 'Без описания'}
        </div>
        <div class="card-progress">
          <div class="card-progress-bar">
            <div class="card-progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <div class="card-progress-text">
            ${completedItems} / ${totalItems} выполнено (${progressPercent}%)
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Show Landing View (grid of shopping list cards)
 */
export async function renderLandingView(): Promise<void> {
  debugLog('[ListsManager] Showing landing view');

  // Reset state
  updateState({
    currentListId: null,
    currentItems: [],
    selectedItemIds: new Set(),
  });

  // CRITICAL: Close import wizard when returning to landing view
  closeImportWizard();

  // Desktop FAB visibility: Landing View
  // Hide detail view FABs (mass operations + add item)
  hideFAB();
  hideAddItemFAB();
  // Show create list FAB
  showCreateListFAB();

  // Show landing view, hide detail view
  document.getElementById('landing-view')?.classList.remove('hidden');
  document.getElementById('detail-view')?.classList.add('hidden');

  // Load shopping lists
  await loadShoppingLists();
  renderShoppingListCards();
}

// ============================================================================
// Detail View
// ============================================================================

/**
 * Show Detail View (items table for specific list)
 */
export async function renderDetailView(listId: number): Promise<void> {
  debugLog('[ListsManager] Showing detail view for list:', listId);

  const state = getState();

  // IMPORTANT: Full state reset BEFORE loading new list
  // This prevents showing old list data while new list loads
  updateState({
    currentItems: [],
    selectedItemIds: new Set(),
    currentListId: listId,
    searchQuery: '',
    hideCompleted: false,
  });

  // CRITICAL: Close import wizard to prevent data isolation breach
  // (CSV import from List A must not leak into List B)
  closeImportWizard();

  // Reset search query for new list
  const searchInput = document.getElementById('items-search') as HTMLInputElement | null;
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('clear-search-btn');
  if (clearBtn) clearBtn.classList.add('hidden');

  // Restore hide completed preference from localStorage
  try {
    const storedHide = localStorage.getItem('lists_hide_completed_preference');
    if (storedHide === 'true') {
      updateState({ hideCompleted: true });
      debugLog('[ListsManager] Restored hide completed preference:', true);
    }
  } catch (e) {
    // localStorage may be unavailable in private browsing
  }
  updateHideCompletedButton();

  // Restore search field visibility from localStorage
  try {
    const searchVisible = localStorage.getItem('lists_search_visible');
    if (searchVisible === 'true') {
      // Show search field by triggering toggle
      const container = document.getElementById('search-field-container');
      const button = document.getElementById('toggle-search-btn');
      if (container && button) {
        container.classList.remove('hidden');
        button.classList.remove('btn-outline');
        button.classList.add('btn-primary');
        debugLog('[SEARCH] Restored search field visibility:', { visible: true });
      }
    }
  } catch (e) {
    // Ignore localStorage errors
  }

  // Reset HierarchyView expanded nodes for new list
  // Each list should start with fresh tree state
  if (state.hierarchyView) {
    state.hierarchyView.expandedNodes.clear();
  }

  // Find the list
  const list = state.shoppingLists.find(l => l.id === listId);
  if (!list) {
    showToast('Список не найден', 'error');
    return;
  }

  // Update breadcrumb
  const breadcrumbElement = document.getElementById('breadcrumb-list-name');
  if (breadcrumbElement) breadcrumbElement.textContent = list.name;

  // Show detail view, hide landing view
  const landingView = document.getElementById('landing-view');
  const detailView = document.getElementById('detail-view');
  if (landingView) landingView.classList.add('hidden');
  if (detailView) detailView.classList.remove('hidden');

  // Desktop FAB visibility: Detail View
  // Hide create list FAB (only visible in landing view)
  hideCreateListFAB();
  // Show detail view FABs (mass operations + add item)
  showFAB();
  showAddItemFAB();

  // Load items for this list
  await loadShoppingListItems(listId);

  // Initialize responsive view (mobile < 640px defaults to hierarchy)
  // This also restores saved preference and renders content
  initializeResponsiveView();

  // Update FAB visibility AFTER switchView to ensure it's visible in all views
  updateFABVisibility();

  // Initialize Choices.js for store and product group selectors in modal
  // NOTE: These should be moved to modalManager.ts in Phase 3.3
  if (typeof (window as any).initStoreChoices === 'function') {
    (window as any).initStoreChoices();
  }
  if (typeof (window as any).initProductGroupChoices === 'function') {
    (window as any).initProductGroupChoices();
  }

  // Note: Real-time updates provided by global budgetWSClient
  // Filtering by shopping_list_id is done in addItemToUI, updateItemInUI, etc.
}

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
import { updateHideCompletedButton, clearSearch } from '../features/searchFilter';

// ============================================================================
// Type Definitions
// ============================================================================

declare const debugLog: (...args: any[]) => void;
declare const showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
declare const closeImportWizard: () => void;
declare const openDeleteListModal: (listId: number, listName: string) => void;

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
 * Update mobile "Add" button UI (icon, tooltip, aria-label)
 * Extracted to avoid code duplication
 */
async function updateMobileUI(): Promise<void> {
  const { updateMobileAddButton } = await import('../ui/globalHelpers');
  await updateMobileAddButton();
}

// ============================================================================
// FAB Visibility Management
// ============================================================================

/**
 * Show FAB menu (detail view only - mass operations, ALL devices)
 * NOTE: Now visible on mobile AND desktop (removed isDesktop() check)
 */
function showFAB(): void {
  debugLog('[FAB] showFAB() called');

  const fabMenu = document.getElementById('lists-fab-menu');
  if (fabMenu) fabMenu.classList.remove('hidden');
}

/**
 * Hide FAB menu (when switching to landing view, ALL devices)
 * NOTE: Now works on mobile AND desktop (removed isDesktop() check)
 */
function hideFAB(): void {
  debugLog('[FAB] hideFAB() called');

  const fabMenu = document.getElementById('lists-fab-menu');
  if (fabMenu) fabMenu.classList.add('hidden');
}

/**
 * Show create list FAB (landing view only, ALL devices)
 * NOTE: Now visible on mobile AND desktop (removed isDesktop() check)
 */
function showCreateListFAB(): void {
  debugLog('[FAB] showCreateListFAB() called');

  const createListFab = document.getElementById('create-list-fab');
  if (createListFab) createListFab.classList.remove('hidden');
}

/**
 * Hide create list FAB (when switching to detail view, ALL devices)
 * NOTE: Now works on mobile AND desktop (removed isDesktop() check)
 */
function hideCreateListFAB(): void {
  debugLog('[FAB] hideCreateListFAB() called');

  const createListFab = document.getElementById('create-list-fab');
  if (createListFab) createListFab.classList.add('hidden');
}

/**
 * Update FAB visibility based on current view (ALL devices)
 * Shows FAB when in detail view (regardless of item count)
 * NOTE: Now works on mobile AND desktop (removed isDesktop() check)
 */
export function updateFABVisibility(): void {
  const fabMenu = document.getElementById('lists-fab-menu');
  const fabBackdrop = document.getElementById('lists-fab-backdrop');

  const state = getState();
  const inDetailView = state.currentListId !== null;

  debugLog('[FAB] updateFABVisibility', {
    inDetailView,
    currentListId: state.currentListId,
  });

  if (inDetailView) {
    // Detail view: show FAB (mobile AND desktop)
    if (fabMenu) fabMenu.classList.remove('hidden');
  } else {
    // Landing view: hide FAB
    if (fabMenu) fabMenu.classList.add('hidden');
    if (fabBackdrop) fabBackdrop.classList.add('hidden');
  }
}


// ============================================================================
// View Switching
// ============================================================================

/**
 * Switch between table and hierarchy views
 * @param viewName - The view to switch to ('table' or 'hierarchy')
 * @param savePreference - Whether to save preference to localStorage (default: true)
 */
export function switchView(viewName: 'table' | 'hierarchy', savePreference: boolean = true): void {
  const isMobile = window.innerWidth < 640;

  // CRITICAL: On mobile, ALWAYS use hierarchy (ignore table switch requests)
  if (isMobile && viewName === 'table') {
    debugLog('[ListsManager] Mobile detected - ignoring table view switch, forcing hierarchy');
    viewName = 'hierarchy';
    savePreference = false; // Don't save this forced switch
  }

  // Save preference to localStorage (only if savePreference=true)
  if (savePreference) {
    try {
      localStorage.setItem('lists_view_preference', viewName);
      debugLog('[ListsManager] Saved view preference:', viewName);
    } catch (e) {
      // localStorage may be unavailable in private browsing
    }
  } else {
    debugLog('[ListsManager] Switched to', viewName, 'view (not saving preference)');
  }

  // Update state
  updateState({ currentView: viewName });

  // Get DOM elements
  const tableViewContainer = document.getElementById('table-view');
  const hierarchyViewContainer = document.getElementById('hierarchy-view');
  const tableBtn = document.getElementById('table-view-btn');
  const hierarchyBtn = document.getElementById('hierarchy-view-btn');
  const tableControls = document.getElementById('table-controls');
  const hierarchyControls = document.getElementById('hierarchy-controls');

  if (viewName === 'hierarchy') {
    // Show hierarchy, hide table
    if (tableViewContainer) tableViewContainer.classList.add('hidden');
    if (hierarchyViewContainer) hierarchyViewContainer.classList.remove('hidden');

    // Update button styles
    if (tableBtn) {
      tableBtn.classList.remove('btn-primary');
      tableBtn.classList.add('btn-outline');
    }
    if (hierarchyBtn) {
      hierarchyBtn.classList.remove('btn-outline');
      hierarchyBtn.classList.add('btn-primary');
    }

    // Show hierarchy controls, hide table controls
    if (tableControls) tableControls.classList.add('hidden');
    if (hierarchyControls) hierarchyControls.classList.remove('hidden');
  } else {
    // Desktop only: show table, hide hierarchy
    // Mobile devices never reach this branch (forced to hierarchy above)
    if (tableViewContainer) tableViewContainer.classList.remove('hidden');
    if (hierarchyViewContainer) hierarchyViewContainer.classList.add('hidden');

    // Update button styles
    if (tableBtn) {
      tableBtn.classList.remove('btn-outline');
      tableBtn.classList.add('btn-primary');
    }
    if (hierarchyBtn) {
      hierarchyBtn.classList.remove('btn-primary');
      hierarchyBtn.classList.add('btn-outline');
    }

    // Show table controls, hide hierarchy controls
    if (tableControls) tableControls.classList.remove('hidden');
    if (hierarchyControls) hierarchyControls.classList.add('hidden');
  }

  // Clear search when switching views for UX consistency
  clearSearch();

  // Render current view content
  renderCurrentView();

  // Ensure FAB remains visible after view switch
  updateFABVisibility();
}

/**
 * Initialize view based on screen width
 * Mobile (< 640px) ALWAYS uses hierarchy view (ignores & preserves savedPreference)
 * Desktop (≥ 640px) uses savedPreference or defaults to table
 */
export function initializeResponsiveView(): void {
  const isMobile = window.innerWidth < 640;

  // CRITICAL: Mobile ALWAYS uses hierarchy (don't save to preserve desktop preference)
  if (isMobile) {
    debugLog('[ListsManager] Mobile detected (<640px), forcing hierarchy view (not saving)');
    switchView('hierarchy', false); // Don't save to preserve desktop preference
    return;
  }

  // Desktop: use savedPreference or default to table
  const savedPreference = localStorage.getItem('lists_view_preference');
  if (savedPreference === 'hierarchy') {
    debugLog('[ListsManager] Desktop: restoring hierarchy view from preference');
    switchView('hierarchy', false); // Don't re-save existing preference
  } else {
    // Default to table for desktop (even if savedPreference is null or 'table')
    debugLog('[ListsManager] Desktop: using table view');
    switchView('table', false); // Don't re-save on initialization
  }
}

/**
 * Sync view UI with current state WITHOUT rendering
 * Used after items are loaded to avoid double-render
 */
function syncViewUI(): void {
  const state = getState();
  const viewName = state.currentView;
  const isMobile = window.innerWidth < 640;

  // Get DOM elements
  const tableViewContainer = document.getElementById('table-view');
  const hierarchyViewContainer = document.getElementById('hierarchy-view');
  const tableBtn = document.getElementById('table-view-btn');
  const hierarchyBtn = document.getElementById('hierarchy-view-btn');
  const tableControls = document.getElementById('table-controls');
  const hierarchyControls = document.getElementById('hierarchy-controls');

  // CRITICAL: On mobile OR when hierarchy view is selected - show hierarchy, hide table
  // Mobile ALWAYS shows hierarchy (table-view kept hidden via CSS + JS)
  if (viewName === 'hierarchy' || isMobile) {
    // Show hierarchy, hide table
    if (tableViewContainer) tableViewContainer.classList.add('hidden');
    if (hierarchyViewContainer) hierarchyViewContainer.classList.remove('hidden');

    // Update button styles (only visible on desktop)
    if (tableBtn) {
      tableBtn.classList.remove('btn-primary');
      tableBtn.classList.add('btn-outline');
    }
    if (hierarchyBtn) {
      hierarchyBtn.classList.remove('btn-outline');
      hierarchyBtn.classList.add('btn-primary');
    }

    // Show hierarchy controls, hide table controls
    if (tableControls) tableControls.classList.add('hidden');
    if (hierarchyControls) hierarchyControls.classList.remove('hidden');

    if (isMobile) {
      debugLog('[ListsManager] Mobile detected - forcing hierarchy view (table permanently hidden)');
    }
  } else {
    // Desktop only: show table, hide hierarchy
    // Mobile devices NEVER reach this branch (isMobile check above)
    if (tableViewContainer) tableViewContainer.classList.remove('hidden');
    if (hierarchyViewContainer) hierarchyViewContainer.classList.add('hidden');

    // Update button styles
    if (tableBtn) {
      tableBtn.classList.remove('btn-outline');
      tableBtn.classList.add('btn-primary');
    }
    if (hierarchyBtn) {
      hierarchyBtn.classList.remove('btn-primary');
      hierarchyBtn.classList.add('btn-outline');
    }

    // Show table controls, hide hierarchy controls
    if (tableControls) tableControls.classList.remove('hidden');
    if (hierarchyControls) hierarchyControls.classList.add('hidden');
  }

  debugLog('[ListsManager] Synced view UI:', { viewName, isMobile });
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
    // Statistics from API (ShoppingListWithStats guarantees these fields exist)
    const totalItems = list.total_items ?? 0;
    const completedItems = list.completed_items ?? 0;
    const progressPercent = list.completion_percentage ?? 0;

    return `
      <div class="shopping-list-card" data-list-id="${list.id}">
        <div class="flex justify-between items-start mb-2">
          <div class="card-title flex-1">${escapeHtml(list.name)}</div>
          <button class="btn-delete-list btn btn-ghost btn-sm btn-circle text-error hover:bg-error hover:text-error-content ml-2"
                  data-list-id="${list.id}"
                  data-list-name="${escapeHtml(list.name)}"
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

  // Добавить event listeners после рендеринга (безопасно, нет inline handlers)
  grid.querySelectorAll('.shopping-list-card').forEach(card => {
    card.addEventListener('click', (e: Event) => {
      // Игнорировать клики по кнопке удаления
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('.btn-delete-list')) {
        const htmlCard = card as HTMLElement;
        const listId = htmlCard.dataset.listId;
        if (listId && window.listsManager) {
          window.listsManager.showDetailView(parseInt(listId, 10));
        }
      }
    });
  });

  grid.querySelectorAll('.btn-delete-list').forEach(btn => {
    btn.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      const htmlBtn = btn as HTMLElement;
      const listId = htmlBtn.dataset.listId;
      const listName = htmlBtn.dataset.listName; // уже экранировано через escapeHtml
      if (listId && listName) {
        openDeleteListModal(parseInt(listId, 10), listName);
      }
    });
  });
}

/**
 * Show Landing View (grid of shopping list cards)
 */
export async function renderLandingView(): Promise<void> {
  debugLog('[ListsManager] Showing landing view');

  // Restore URL when returning to landing view
  if (window.location.pathname !== '/lists') {
    history.pushState({ view: 'landing' }, '', '/lists');
  }

  // Reset state
  updateState({
    currentListId: null,
    currentItems: [],
    selectedItemIds: new Set(),
  });

  // CRITICAL: Close import wizard when returning to landing view
  closeImportWizard();

  // Desktop FAB visibility: Landing View
  // Hide detail view FAB (mass operations Speed Dial)
  hideFAB();
  // Show create list FAB
  showCreateListFAB();

  // Show landing view, hide detail view
  document.getElementById('landing-view')?.classList.remove('hidden');
  document.getElementById('detail-view')?.classList.add('hidden');

  // Immediate render from current state (shows WS-updated data before API completes)
  renderShoppingListCards();

  // Load fresh data from server
  await loadShoppingLists();
  renderShoppingListCards();

  // Update mobile "Add" button UI (icon, tooltip, aria-label)
  await updateMobileUI();
}

// ============================================================================
// Detail View
// ============================================================================

/**
 * Show Detail View (items table for specific list)
 */
export async function renderDetailView(listId: number): Promise<void> {
  debugLog('[ListsManager] Showing detail view for list:', listId);

  // Update URL for deep linking and browser back button
  history.pushState({ view: 'detail', listId }, '', `/lists/${listId}`);

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

  // CRITICAL: Set correct view BEFORE showing containers (prevents flicker)
  // On mobile (<640px): force hierarchy, on desktop: restore preference
  const isMobile = window.innerWidth < 640;
  if (isMobile) {
    updateState({ currentView: 'hierarchy' });
    debugLog('[RENDER_DETAIL] Pre-set hierarchy view for mobile (prevents flicker)');
  } else {
    const savedPreference = localStorage.getItem('lists_view_preference');
    updateState({ currentView: savedPreference === 'hierarchy' ? 'hierarchy' : 'table' });
    debugLog('[RENDER_DETAIL] Pre-set desktop view from preference:', savedPreference || 'table');
  }

  // CRITICAL: Sync view UI BEFORE showing detail-view (prevents table flash during FOUC)
  // This hides table-view and shows hierarchy-view containers BEFORE they become visible
  syncViewUI();
  debugLog('[RENDER_DETAIL] syncViewUI() completed - table-view hidden before detail-view shown');

  // Show detail view, hide landing view
  // Table-view already hidden via syncViewUI() above, no FOUC during 600ms load delay
  const landingView = document.getElementById('landing-view');
  const detailView = document.getElementById('detail-view');
  if (landingView) landingView.classList.add('hidden');
  if (detailView) detailView.classList.remove('hidden');
  debugLog('[RENDER_DETAIL] detail-view shown (table-view already hidden)');

  // Desktop FAB visibility: Detail View
  // Hide create list FAB (only visible in landing view)
  hideCreateListFAB();
  // Show detail view Speed Dial (mass operations including add item)
  showFAB();

  // Load items for this list
  await loadShoppingListItems(listId);

  // Render ONLY the current view (hierarchy on mobile, table/hierarchy on desktop)
  // This prevents rendering table on mobile entirely
  renderCurrentView();
  debugLog('[RENDER_DETAIL] renderCurrentView() completed');

  // Update FAB visibility after rendering
  updateFABVisibility();

  // Initialize Choices.js for store and product group selectors in modal
  // NOTE: These should be moved to modalManager.ts in Phase 3.3
  if (typeof (window as any).initStoreChoices === 'function') {
    (window as any).initStoreChoices();
  }
  if (typeof (window as any).initProductGroupChoices === 'function') {
    (window as any).initProductGroupChoices();
  }

  // Update mobile "Add" button UI (icon, tooltip, aria-label)
  await updateMobileUI();

  // Note: Real-time updates provided by global budgetWSClient
  // Filtering by shopping_list_id is done in addItemToUI, updateItemInUI, etc.
}

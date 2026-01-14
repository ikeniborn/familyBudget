/**
 * Global helper functions for lists page
 *
 * Created: 2026-01-11 (v7.x.x migration fixes)
 * Purpose: Provide missing onclick handlers that were removed during TypeScript migration
 */

// Type declaration for global debugLog
declare const debugLog: (...args: any[]) => void;

/**
 * Open modal by ID (for Financial Centers, Cost Centers, Articles)
 *
 * STUB IMPLEMENTATION:
 * These modals don't exist in lists.html - they're on the main budget page (index.html).
 * This function is called from mobile hamburger menu (lists.html:56,62,68).
 *
 * For now, show alert to inform user to use main budget page.
 *
 * TODO: Implement proper HTMX-based modal loading from base routes
 *
 * @param modalId - Modal ID (e.g., 'modal_add_financial_center')
 */
export function openModal(modalId: string): void {
  debugLog(`[LISTS_GLOBAL] openModal('${modalId}') called - feature not fully implemented`);
  debugLog('[LISTS_GLOBAL] These modals are available on the main budget page, not lists page');

  // (Logging removed - not critical for stub implementation)

  // Inform user to use main budget page
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    window.Telegram.WebApp.showAlert('Эту функцию можно использовать на главной странице бюджета');
  } else if (typeof alert !== 'undefined') {
    alert('Эту функцию можно использовать на главной странице бюджета');
  }
}

/**
 * Navigate to home with offline handling
 *
 * Used by mobile bottom navigation (lists.html:38)
 * Handles both online and offline scenarios
 */
export function navigateHomeOfflineFriendly(): void {
  // Check online status
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (!isOnline) {
    debugLog('[LISTS_GLOBAL] Offline - using direct navigation fallback');

    // Use direct navigation when offline
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }
  // Online: HTMX will handle navigation via hx-get="/" attribute
  // No need to do anything here - onclick is fired before hx-get
}

/**
 * Handle mobile "Add" button click
 *
 * Opens appropriate modal based on current view:
 * - Landing View (currentListId === null) → Create shopping list
 * - Detail View (currentListId !== null) → Add item to list
 *
 * Used by mobile bottom navigation (lists.html:XX)
 */
export async function handleMobileAddButton(): Promise<void> {
  // Dynamic imports to avoid circular dependencies
  const { getState } = await import('../core/ListsState');
  const { openCreateListModal, openAddItemModal } = await import('./modalManager');

  const state = getState();
  const isLandingView = state.currentListId == null; // null or undefined

  debugLog('[MOBILE_MENU] handleMobileAddButton() called');
  debugLog('[MOBILE_MENU] Current view:', isLandingView ? 'Landing' : 'Detail');

  if (isLandingView) {
    // Landing View → create new shopping list
    debugLog('[MOBILE_MENU] Opening create list modal (Landing View)');
    if (typeof openCreateListModal === 'function') {
      openCreateListModal();
    } else {
      console.error('[MOBILE_MENU] openCreateListModal is not a function');
    }
  } else {
    // Detail View → add item to current list
    debugLog('[MOBILE_MENU] Opening add item modal (Detail View, list:', state.currentListId, ')');
    if (typeof openAddItemModal === 'function') {
      openAddItemModal();
    } else {
      console.error('[MOBILE_MENU] openAddItemModal is not a function');
    }
  }
}

/**
 * Update mobile "Add" button UI based on current view
 *
 * Dynamically changes:
 * - Icon (➕ for Landing View, 🛒 for Detail View)
 * - Tooltip (title attribute)
 * - Aria-label (accessibility)
 *
 * Called by renderLandingView() and renderDetailView()
 */
export async function updateMobileAddButton(): Promise<void> {
  const { getState } = await import('../core/ListsState');
  const state = getState();
  const isLandingView = state.currentListId == null;

  const button = document.getElementById('mobile-add-button');
  const iconSpan = document.getElementById('mobile-add-icon');

  if (!button || !iconSpan) {
    // Button not found (desktop view or button not rendered yet)
    debugLog('[MOBILE_MENU] Button elements not found - likely desktop view or not yet rendered');
    return;
  }

  if (isLandingView) {
    // Landing View: Create list
    iconSpan.textContent = '➕';
    button.setAttribute('title', 'Создать список');
    button.setAttribute('aria-label', 'Создать список');
    debugLog('[MOBILE_MENU] Updated button UI for Landing View (➕ Создать список)');
  } else {
    // Detail View: Add item
    iconSpan.textContent = '🛒';
    button.setAttribute('title', 'Добавить товар');
    button.setAttribute('aria-label', 'Добавить товар');
    debugLog('[MOBILE_MENU] Updated button UI for Detail View (🛒 Добавить товар)');
  }
}

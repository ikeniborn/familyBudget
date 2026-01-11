/**
 * Global helper functions for lists page
 *
 * Created: 2026-01-11 (v7.x.x migration fixes)
 * Purpose: Provide missing onclick handlers that were removed during TypeScript migration
 */
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
export function openModal(modalId) {
    debugLog(`[LISTS_GLOBAL] openModal('${modalId}') called - feature not fully implemented`);
    debugLog('[LISTS_GLOBAL] These modals are available on the main budget page, not lists page');
    // (Logging removed - not critical for stub implementation)
    // Inform user to use main budget page
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Эту функцию можно использовать на главной странице бюджета');
    }
    else if (typeof alert !== 'undefined') {
        alert('Эту функцию можно использовать на главной странице бюджета');
    }
}
/**
 * Navigate to home with offline handling
 *
 * Used by mobile bottom navigation (lists.html:38)
 * Handles both online and offline scenarios
 */
export function navigateHomeOfflineFriendly() {
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
//# sourceMappingURL=globalHelpers.js.map
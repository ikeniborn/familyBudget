/**
 * Navigation Tracker
 * Tracks page navigation events to suppress false positive warnings
 *
 * Extracted from offlineManager.js:54-79
 *
 * When user navigates away from page (reload, HTMX navigation), we set isNavigating=true
 * to prevent false warnings about failed requests during the transition.
 */

import { getState, updateState } from './OfflineState';

/**
 * Initialize navigation tracking
 * Sets up listeners for beforeunload and HTMX navigation events
 *
 * Call this ONCE during app initialization (from initializeOfflineManager)
 */
export function initNavigationTracking(): void {
  if (typeof window === 'undefined') {
    return; // Server-side rendering guard
  }

  // ============================================================================
  // beforeunload - Browser navigation away from page
  // ============================================================================
  window.addEventListener('beforeunload', () => {
    updateState({ isNavigating: true });
  });

  // ============================================================================
  // HTMX navigation tracking
  // ============================================================================
  // HTMX is a library for partial page updates without full page reloads
  // We need to track HTMX requests to suppress warnings during transitions

  // Check if HTMX is available globally
  if (typeof (window as any).htmx !== 'undefined') {
    // htmx:beforeRequest - Fired when HTMX starts a request
    // Set isNavigating=true and schedule a timeout to clear it
    document.body.addEventListener('htmx:beforeRequest', () => {
      updateState({ isNavigating: true });

      // Clear previous timeout if exists
      const state = getState();
      if (state.navigationTimeout) {
        clearTimeout(state.navigationTimeout);
      }

      // Schedule clearing isNavigating after 8 seconds
      // (Fallback if htmx:afterSettle never fires)
      const timeoutId = setTimeout(() => {
        updateState({ isNavigating: false, navigationTimeout: null });
      }, 8000);

      updateState({ navigationTimeout: timeoutId });
    });

    // htmx:afterSettle - Fired when HTMX completes rendering new content
    // Clear isNavigating after a 1-second grace period
    document.body.addEventListener('htmx:afterSettle', () => {
      const state = getState();

      // Clear existing timeout
      if (state.navigationTimeout) {
        clearTimeout(state.navigationTimeout);
      }

      // Schedule clearing isNavigating after 1 second
      // (Grace period to allow any pending operations to complete)
      const timeoutId = setTimeout(() => {
        updateState({ isNavigating: false, navigationTimeout: null });
      }, 1000);

      updateState({ navigationTimeout: timeoutId });
    });
  }
}

/**
 * Check if navigation is in progress
 * Use this to suppress warnings during page transitions
 *
 * @returns true if currently navigating
 *
 * @example
 * ```typescript
 * if (isNavigating()) {
 *   return; // Suppress warning during navigation
 * }
 * showToast('Request failed', 'error');
 * ```
 */
export function isNavigating(): boolean {
  const state = getState();
  return state.isNavigating;
}

/**
 * Manually set navigation state
 * Useful for testing or custom navigation handling
 *
 * @param navigating - New navigation state
 */
export function setNavigating(navigating: boolean): void {
  updateState({ isNavigating: navigating });
}

/**
 * Clear navigation timeout
 * Useful for cleanup during app shutdown
 */
export function clearNavigationTimeout(): void {
  const state = getState();

  if (state.navigationTimeout) {
    clearTimeout(state.navigationTimeout);
    updateState({ navigationTimeout: null });
  }
}

/**
 * Global HTMX type declaration
 * HTMX is loaded globally via script tag
 */
declare global {
  interface Window {
    htmx?: any;
  }
}

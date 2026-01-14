/**
 * Navigation Detection Module
 * Suppresses RTT warnings during page navigation/load
 *
 * Extracted from budgetWSClient.js:268-302 (NAVIGATION WINDOW METHODS)
 */

import { getState, updateState } from '../core/WSState';

/**
 * Start navigation window (suppress RTT warnings for 10 seconds)
 * Called on DOMContentLoaded to allow WebSocket reconnection to stabilize
 */
export function startNavigationWindow(): void {
  const state = getState();

  updateState({ isNavigating: true });

  // Clear existing timer (if any)
  if (state.navigationTimer) {
    clearTimeout(state.navigationTimer);
  }

  // Set timer to clear navigation flag
  const timer = setTimeout(() => {
    updateState({
      isNavigating: false,
      navigationTimer: null,
    });
  }, state.NAVIGATION_WINDOW);

  updateState({ navigationTimer: timer });
}

/**
 * Stop navigation window (cleanup on disconnect)
 */
export function stopNavigationWindow(): void {
  const state = getState();

  if (state.navigationTimer) {
    clearTimeout(state.navigationTimer);
    updateState({
      navigationTimer: null,
      isNavigating: false,
    });
  }
}

/**
 * Check if currently in navigation window
 */
export function isInNavigationWindow(): boolean {
  return getState().isNavigating;
}

/**
 * Initialize navigation detection
 * Sets up DOMContentLoaded listener or starts immediately if already loaded
 */
export function initNavigationDetection(): void {
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        startNavigationWindow();
      },
      { once: true }
    );
  } else {
    // Page already loaded (fast connection or cached)
    startNavigationWindow();
  }
}

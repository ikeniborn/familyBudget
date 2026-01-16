/**
 * Lifecycle Module
 * Initialization, cleanup, and state restoration
 *
 * Features:
 * - Event listener registration/cleanup
 * - Heartbeat lifecycle management
 * - Restored state event dispatch
 * - Memory leak prevention
 *
 * @version 3.0.0
 * @date 2026-01-16
 */

import { getState, updateState, loadOfflineState } from './NetworkState';
import { hasNetworkInformation } from '../utils/connectionInfo';
import { handleConnectionChange } from '../features/connectionQuality';
import { handleOnline, handleOffline, checkConnectivity } from './detectionEngine';
import { startHeartbeat, stopHeartbeat } from '../features/heartbeat';
import { stopAutoRecoveryCheck } from '../features/heartbeat';

// Bound event handlers (stored for cleanup)
let _handleOnline: (() => Promise<void>) | null = null;
let _handleOffline: (() => void) | null = null;
let _handleConnectionChange: (() => Promise<void>) | null = null;

/**
 * Dispatch events for restored offline state from localStorage
 * From networkDetector.ts:121-147
 *
 * Called after initialization to notify listeners about restored auto-offline state.
 * Safe to call multiple times - only dispatches once.
 *
 * Use case: Page reload while in auto-offline mode
 */
export const dispatchRestoredState = (): void => {
  const { autoOfflineMode, _hasRestoredState, _stateDispatched } = getState();

  if (!_hasRestoredState || _stateDispatched) {
    return;
  }

  updateState({ _stateDispatched: true });

  // Dispatch network status change event
  window.dispatchEvent(new CustomEvent('network-status-change', {
    detail: {
      status: 'offline',
      previousStatus: 'online',
      timestamp: Date.now(),
      auto: autoOfflineMode,
      restored: true  // Indicates state was restored from localStorage
    }
  }));

  // Dispatch offline status change for UI updates
  window.dispatchEvent(new CustomEvent('offline-status-change', {
    detail: {
      online: false,
      status: 'offline',
      auto: autoOfflineMode
    }
  }));
};

/**
 * Initialize detector
 * From networkDetector.ts:149-165
 *
 * Actions:
 * 1. Load persisted auto-offline state from localStorage
 * 2. Register browser event listeners (online, offline)
 * 3. Register Network Information API listener (if available)
 * 4. Start heartbeat (unless auto-offline mode)
 * 5. Initial connectivity check
 */
export const init = (): void => {
  // Load persisted state from localStorage
  loadOfflineState();

  // Bind event handlers (for cleanup later)
  _handleOnline = handleOnline.bind(null);
  _handleOffline = handleOffline.bind(null);
  _handleConnectionChange = handleConnectionChange.bind(null);

  // Register browser event listeners
  window.addEventListener('online', _handleOnline);
  window.addEventListener('offline', _handleOffline);

  // Network Information API (Chrome, Edge, Yandex Browser)
  if (hasNetworkInformation()) {
    navigator.connection!.addEventListener('change', _handleConnectionChange);
  }

  const { autoOfflineMode } = getState();

  // Start heartbeat (only if not in auto offline mode)
  if (!autoOfflineMode) {
    startHeartbeat();

    // Initial check
    checkConnectivity();
  }

  // Mark state as restored (for dispatchRestoredState)
  updateState({ _hasRestoredState: autoOfflineMode });
};

/**
 * Cleanup on destroy
 * From networkDetector.ts:479-489
 *
 * Actions:
 * 1. Remove all event listeners
 * 2. Stop heartbeat
 * 3. Stop auto-recovery check
 *
 * CRITICAL: Always call this on component unmount to prevent memory leaks!
 */
export const destroy = (): void => {
  // Remove event listeners
  if (_handleOnline) {
    window.removeEventListener('online', _handleOnline);
    _handleOnline = null;
  }
  if (_handleOffline) {
    window.removeEventListener('offline', _handleOffline);
    _handleOffline = null;
  }

  if (hasNetworkInformation() && _handleConnectionChange) {
    navigator.connection!.removeEventListener('change', _handleConnectionChange);
    _handleConnectionChange = null;
  }

  // Stop timers
  stopHeartbeat();
  stopAutoRecoveryCheck();
};

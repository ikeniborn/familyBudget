/**
 * Auto-Offline Mode Module
 * Emergency offline mode with periodic recovery checks
 *
 * Features:
 * - Enable/disable auto-offline mode
 * - localStorage persistence (survives page reload)
 * - Periodic recovery checks (30s → 60s → 120s progressive backoff)
 * - Event dispatch for UI integration
 *
 * @version 3.0.0
 * @date 2026-01-16
 */

import { getState, updateState, saveOfflineState } from '../core/NetworkState';
import { stopHeartbeat, startHeartbeat, startAutoRecoveryCheck, stopAutoRecoveryCheck } from './heartbeat';
import { _networkLog } from '../utils/logger';

/**
 * Enable auto-offline mode
 * From networkDetector.ts:527-554
 *
 * Actions:
 * 1. Set auto-offline mode flag
 * 2. Save to localStorage (persistent)
 * 3. Stop heartbeat checks
 * 4. Set status to 'offline'
 * 5. Start recovery checks (30s → 60s → 120s)
 * 6. Dispatch events for UI update
 *
 * Use case: When server is completely unavailable (emergency mode)
 */
export const enableAutoOfflineMode = (): void => {
  const { autoOfflineMode, status } = getState();

  if (autoOfflineMode) return;

  const oldStatus = status;

  // Set auto-offline mode
  updateState({
    autoOfflineMode: true,
    status: 'offline'
  });

  saveOfflineState();
  stopHeartbeat();

  _networkLog('[NetworkDetector] Auto offline mode ENABLED');

  // Start periodic recovery check (progressive backoff: 30s → 60s → 120s)
  startAutoRecoveryCheck();

  // Dispatch events
  window.dispatchEvent(new CustomEvent('network-status-change', {
    detail: {
      status: 'offline',
      previousStatus: oldStatus,
      timestamp: Date.now(),
      auto: true
    }
  }));

  window.dispatchEvent(new CustomEvent('offline-status-change', {
    detail: { online: false, status: 'offline', auto: true }
  }));
};

/**
 * Disable auto-offline mode
 * From networkDetector.ts:560-572
 *
 * Called when connection to server is restored.
 *
 * Actions:
 * 1. Clear auto-offline mode flag
 * 2. Save to localStorage
 * 3. Stop recovery checks
 * 4. Resume heartbeat checks
 * 5. Verify actual network state
 */
export const disableAutoOfflineMode = async (): Promise<void> => {
  const { autoOfflineMode } = getState();

  if (!autoOfflineMode) return;

  updateState({ autoOfflineMode: false });
  saveOfflineState();
  stopAutoRecoveryCheck();
  startHeartbeat();

  _networkLog('[NetworkDetector] Auto offline mode DISABLED');

  // Check actual network state
  // Dynamic import to avoid circular dependency
  const { checkConnectivity } = await import('../core/detectionEngine');
  await checkConnectivity(true);
};

/**
 * Check if auto-offline mode is enabled
 * From networkDetector.ts:644-646
 *
 * @returns true if auto-offline mode is active
 */
export const isOfflineModeEnabled = (): boolean => {
  return getState().autoOfflineMode;
};

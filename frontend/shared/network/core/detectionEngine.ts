/**
 * Detection Engine
 * Core network status detection and connectivity checking
 *
 * Features:
 * - Real API availability checking (fetch /health endpoint)
 * - Status transitions with event dispatch
 * - Adaptive timeout based on RTT
 * - Throttling to prevent spam
 * - AbortController for timeout handling
 *
 * @version 3.0.0
 * @date 2026-01-16
 */

import { getState, updateState } from './NetworkState';
import type { NetworkStatus, StatusChangeOptions } from '../types';
import { getAdaptiveTimeout, getConnectionInfo } from '../utils/connectionInfo';
import { _networkLog } from '../utils/logger';

/**
 * Set network status and dispatch events
 * From networkDetector.ts:239-263
 *
 * Actions:
 * 1. Update state
 * 2. Call onStatusChange callback (if registered)
 * 3. Dispatch 'network-status-change' CustomEvent
 * 4. Log status change (DEBUG_MODE only)
 *
 * @param newStatus - New network status
 * @param options - Optional parameters for event detail
 * @returns New status (for chaining)
 */
export const setStatus = (newStatus: NetworkStatus, options: StatusChangeOptions = {}): NetworkStatus => {
  const { status: oldStatus, onStatusChange } = getState();

  if (oldStatus !== newStatus) {
    updateState({ status: newStatus });

    // Notify via callback
    if (onStatusChange) {
      onStatusChange(newStatus, oldStatus, options);
    }

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('network-status-change', {
      detail: {
        status: newStatus,
        previousStatus: oldStatus,
        timestamp: Date.now()
      }
    }));

    _networkLog(`[NetworkDetector] Status changed: ${oldStatus} → ${newStatus}`);
  }

  return newStatus;
};

/**
 * Check real API availability
 * From networkDetector.ts:285-344
 *
 * Algorithm:
 * 1. Quick check: navigator.onLine
 * 2. Throttling: skip if checked recently (unless force=true)
 * 3. Fetch /health endpoint with adaptive timeout
 * 4. Handle response:
 *    - OK + good connection quality → 'online'
 *    - OK + slow connection → 'degraded'
 *    - HTTP error → 'degraded'
 *    - Network error → increment failures, set 'degraded' or 'offline'
 *
 * @param force - Ignore min check interval (default: false)
 * @returns Promise<NetworkStatus> - Resolved status
 */
export const checkConnectivity = async (force: boolean = false): Promise<NetworkStatus> => {
  const state = getState();

  // Skip network checks if auto offline mode is enabled
  if (state.autoOfflineMode) {
    return 'offline';
  }

  // Quick check: navigator.onLine
  if (!navigator.onLine) {
    return setStatus('offline');
  }

  // Throttling: don't check too frequently
  const now = Date.now();
  if (!force && now - state.lastCheck < state.minCheckInterval) {
    return state.status;
  }
  updateState({ lastCheck: now });

  try {
    // Use adaptive timeout based on RTT
    const timeout = getAdaptiveTimeout();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(state.heartbeatUrl, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      // Success!
      updateState({
        consecutiveFailures: 0,
        lastHeartbeat: now
      });

      // Check connection quality
      const info = getConnectionInfo();
      if (info && (state.slowConnectionTypes.includes(info.effectiveType) ||
                   info.rtt > state.degradedRtt)) {
        return setStatus('degraded');
      }

      return setStatus('online');
    } else {
      // HTTP error (but connection exists)
      return setStatus('degraded');
    }
  } catch (error) {
    // Network error or timeout
    const newFailures = state.consecutiveFailures + 1;
    updateState({ consecutiveFailures: newFailures });

    if (newFailures >= state.maxFailuresBeforeOffline) {
      return setStatus('offline');
    }

    return setStatus('degraded');
  }
};

/**
 * Handle browser 'online' event
 * From networkDetector.ts:196-203
 *
 * Called when navigator.onLine becomes true.
 * Verifies real connection (navigator.onLine can be unreliable).
 */
export const handleOnline = async (): Promise<void> => {
  const { autoOfflineMode } = getState();

  // Skip if auto offline mode is enabled
  if (autoOfflineMode) {
    return;
  }

  // navigator.onLine became true → verify real connection
  await checkConnectivity(true);
};

/**
 * Handle browser 'offline' event
 * From networkDetector.ts:208-210
 *
 * Called when navigator.onLine becomes false.
 * Immediately set status to 'offline' (no need to verify).
 */
export const handleOffline = (): void => {
  setStatus('offline');
};

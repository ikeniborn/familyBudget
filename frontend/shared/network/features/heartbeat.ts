/**
 * Heartbeat Module
 * Periodic /health endpoint checks with progressive backoff
 *
 * Features:
 * - Progressive backoff intervals (2s → 4s → 20s)
 * - Auto-recovery checks for auto-offline mode (30s → 60s → 120s)
 * - Automatic rescheduling
 *
 * @version 3.0.0
 * @date 2026-01-16
 */

import { getState, updateState } from '../core/NetworkState';
import { _networkLog } from '../utils/logger';

/**
 * Get progressive backoff delay for next heartbeat check
 * From networkDetector.ts:349-356
 *
 * Logic:
 * - consecutiveFailures = 0-1: check every 2s (rapid)
 * - consecutiveFailures = 2: check every 4s (slowdown)
 * - consecutiveFailures >= 3 (offline): check every 20s (slow polling)
 */
export const getNextCheckDelay = (): number => {
  const { consecutiveFailures, heartbeatIntervals } = getState();
  const index = Math.min(consecutiveFailures, heartbeatIntervals.length - 1);
  return heartbeatIntervals[index];
};

/**
 * Schedule next heartbeat check with progressive backoff
 * From networkDetector.ts:368-389
 */
export const scheduleNextHeartbeat = (): void => {
  const state = getState();

  // Clear previous timer
  if (state.heartbeatTimer) {
    clearTimeout(state.heartbeatTimer);
  }

  // Skip if auto offline mode is enabled
  if (state.autoOfflineMode) {
    return;
  }

  const delay = getNextCheckDelay();

  const timer = setTimeout(async () => {
    // ВАЖНО: Проверять ВСЕГДА, независимо от статуса!
    // Это позволяет обнаруживать восстановление сети даже когда status = 'offline'

    // Dynamic import to avoid circular dependency
    const { checkConnectivity } = await import('../core/detectionEngine');
    await checkConnectivity();

    // Schedule next check
    scheduleNextHeartbeat();
  }, delay);

  updateState({ heartbeatTimer: timer });
};

/**
 * Start periodic heartbeat
 * From networkDetector.ts:361-363
 */
export const startHeartbeat = (): void => {
  scheduleNextHeartbeat();
};

/**
 * Stop heartbeat
 * From networkDetector.ts:394-399
 */
export const stopHeartbeat = (): void => {
  const { heartbeatTimer } = getState();
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    updateState({ heartbeatTimer: null });
  }
};

/**
 * Start auto-recovery check with progressive backoff
 * From networkDetector.ts:578-629
 *
 * Checks server availability periodically when in auto-offline mode:
 * - Check #1: after 30s
 * - Check #2: after 60s
 * - Check #3+: every 120s
 *
 * When server recovered:
 * - Disables auto-offline mode
 * - Dispatches 'server-recovered' event
 * - Dispatches 'auto-offline-recovered' event (triggers sync)
 */
export const startAutoRecoveryCheck = (): void => {
  stopAutoRecoveryCheck(); // Clear previous

  let checkCount = 0;
  const intervals = [30000, 60000, 120000]; // 30s, 60s, 120s

  const scheduleNext = () => {
    const interval = intervals[Math.min(checkCount, intervals.length - 1)];

    _networkLog(`[NetworkDetector] Scheduling next auto recovery check in ${interval / 1000}s (check #${checkCount + 1})`);

    const timer = setTimeout(async () => {
      _networkLog(`[NetworkDetector] Auto recovery check #${checkCount + 1}...`);

      // Temporarily disable auto offline mode to allow real connectivity check
      const wasAutoOffline = getState().autoOfflineMode;
      updateState({ autoOfflineMode: false });

      try {
        // Check actual server connectivity
        const { checkConnectivity } = await import('../core/detectionEngine');
        await checkConnectivity(true);

        if (getState().status !== 'offline') {
          // Recovered!
          _networkLog('[NetworkDetector] Server recovered, disabling auto offline mode');

          // Disable auto-offline mode (dynamic import to avoid circular dependency)
          const { disableAutoOfflineMode } = await import('./autoOffline');
          await disableAutoOfflineMode();

          // Dispatch recovery events
          window.dispatchEvent(new CustomEvent('server-recovered', {
            detail: { timestamp: Date.now() }
          }));

          window.dispatchEvent(new CustomEvent('auto-offline-recovered'));
        } else {
          // Not recovered - restore auto offline mode and schedule next check
          updateState({ autoOfflineMode: wasAutoOffline });
          checkCount++;
          scheduleNext();
        }
      } catch (error) {
        // Error during check - restore auto offline mode and schedule next check
        console.error('[NetworkDetector] Error during recovery check:', error);
        updateState({ autoOfflineMode: wasAutoOffline });
        checkCount++;
        scheduleNext();
      }
    }, interval);

    updateState({ autoRecoveryTimer: timer });
  };

  scheduleNext();
};

/**
 * Stop auto-recovery check
 * From networkDetector.ts:634-639
 */
export const stopAutoRecoveryCheck = (): void => {
  const { autoRecoveryTimer } = getState();
  if (autoRecoveryTimer) {
    clearTimeout(autoRecoveryTimer);
    updateState({ autoRecoveryTimer: null });
  }
};

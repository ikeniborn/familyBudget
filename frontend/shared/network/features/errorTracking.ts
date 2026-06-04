/**
 * Error Tracking Module
 * Consecutive request failure tracking and status transitions
 *
 * Features:
 * - Request success handling (reset counter, upgrade status)
 * - Request failure handling (increment counter, downgrade status)
 * - Automatic status transitions based on failure threshold
 *
 * @version 3.0.0
 * @date 2026-01-16
 */

import { getState, updateState } from '../core/NetworkState';

/**
 * Called on successful API request
 * From networkDetector.ts:405-420
 *
 * Logic:
 * - Reset consecutive failures counter
 * - If status = 'offline' → verify real availability (might be back online)
 * - If status = 'degraded' → upgrade to 'online' (success indicates good connection)
 *
 * Integration: Called by network adapter after successful request
 */
export const onRequestSuccess = (): void => {
  const { autoOfflineMode, status } = getState();

  // Skip if auto offline mode is enabled
  if (autoOfflineMode) {
    return;
  }

  // Reset consecutive failures
  updateState({ consecutiveFailures: 0 });

  if (status === 'offline') {
    // Was offline → check real state
    // Dynamic import to avoid circular dependency
    (async () => {
      try {
        const { checkConnectivity } = await import('../core/detectionEngine');
        await checkConnectivity(true);
      } catch (e) {
        // Ignore errors - this is a background check
      }
    })();
  } else if (status === 'degraded') {
    // Success on degraded → back to online
    (async () => {
      try {
        const { setStatus } = await import('../core/detectionEngine');
        setStatus('online');
      } catch (e) {
        // Ignore errors - this is a background operation
      }
    })();
  }
};

/**
 * Called on failed API request
 * From networkDetector.ts:426-439
 *
 * Logic:
 * - Increment consecutive failures counter
 * - If failures >= maxFailuresBeforeOffline (default: 3) → set 'offline' status
 * - Else if status = 'online' → downgrade to 'degraded'
 *
 * Integration: Called by network adapter after failed request
 */
export const onRequestFailure = (): void => {
  const { autoOfflineMode, consecutiveFailures, maxFailuresBeforeOffline, status } = getState();

  // Skip if auto offline mode is enabled
  if (autoOfflineMode) {
    return;
  }

  const newFailures = consecutiveFailures + 1;
  updateState({ consecutiveFailures: newFailures });

  if (newFailures >= maxFailuresBeforeOffline) {
    // Too many failures → offline
    (async () => {
      try {
        const { setStatus } = await import('../core/detectionEngine');
        setStatus('offline');
      } catch (e) {
        // Ignore errors - this is a background operation
      }
    })();
  } else if (status === 'online') {
    // First/second failure → degraded
    (async () => {
      try {
        const { setStatus } = await import('../core/detectionEngine');
        setStatus('degraded');
      } catch (e) {
        // Ignore errors - this is a background operation
      }
    })();
  }
};

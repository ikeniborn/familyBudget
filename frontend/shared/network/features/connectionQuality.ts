/**
 * Connection Quality Module
 * Network Information API integration and connection change handling
 *
 * Features:
 * - Connection quality change detection
 * - Status downgrade on slow connections
 *
 * Note: Core functions (hasNetworkInformation, getConnectionInfo, getAdaptiveTimeout)
 * moved to utils/connectionInfo.ts to avoid circular dependency with detectionEngine.ts
 *
 * @version 3.0.0
 * @date 2026-01-16
 */

import { getState } from '../core/NetworkState';

// Re-export utilities from utils/connectionInfo (to maintain public API)
export {
  hasNetworkInformation,
  getConnectionInfo,
  getAdaptiveTimeout
} from '../utils/connectionInfo';

/**
 * Handle connection quality change event
 * From networkDetector.ts:215-232
 *
 * Called when Network Information API detects connection change.
 * Logic:
 * - Slow connection (slow-2g, 2g) OR high RTT (>5000ms) → set 'degraded' status
 * - Connection improved from 'degraded' → verify real availability
 */
export const handleConnectionChange = async (): Promise<void> => {
  const { autoOfflineMode, status, slowConnectionTypes, degradedRtt } = getState();

  // Skip if auto offline mode is enabled
  if (autoOfflineMode) {
    return;
  }

  // Dynamic import to avoid circular dependency
  const { getConnectionInfo } = await import('../utils/connectionInfo');
  const info = getConnectionInfo();
  if (!info) return;

  // Very slow connection → degraded
  if (slowConnectionTypes.includes(info.effectiveType) ||
      info.rtt > degradedRtt) {
    // Dynamic import to avoid circular dependency
    const { setStatus } = await import('../core/detectionEngine');
    setStatus('degraded');
  } else if (status === 'degraded') {
    // Connection improved → check real availability
    const { checkConnectivity } = await import('../core/detectionEngine');
    await checkConnectivity(true);
  }
};

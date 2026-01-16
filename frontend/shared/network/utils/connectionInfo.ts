/**
 * Connection Info Utilities
 * Network Information API helpers (extracted to avoid circular dependency)
 *
 * Extracted from connectionQuality.ts to break circular dependency:
 * - detectionEngine.ts needs getAdaptiveTimeout(), getConnectionInfo()
 * - connectionQuality.ts needs setStatus() from detectionEngine
 *
 * @version 3.0.0
 * @date 2026-01-16
 */

import type { ConnectionInfo } from '../types';

/**
 * Check if Network Information API is supported
 * From networkDetector.ts:170-174
 *
 * Supported browsers: Chrome, Edge, Yandex Browser
 * NOT supported: Safari, Firefox
 */
export const hasNetworkInformation = (): boolean => {
  return 'connection' in navigator &&
         !!navigator.connection &&
         'effectiveType' in navigator.connection;
};

/**
 * Get connection quality information from Network Information API
 * From networkDetector.ts:179-191
 *
 * @returns ConnectionInfo object or null if API not available
 */
export const getConnectionInfo = (): ConnectionInfo | null => {
  if (!hasNetworkInformation()) {
    return null;
  }

  const conn = navigator.connection!;
  return {
    effectiveType: conn.effectiveType as '4g' | '3g' | '2g' | 'slow-2g',
    downlink: conn.downlink || 0,
    rtt: conn.rtt || 0,
    saveData: conn.saveData || false
  };
};

/**
 * Get adaptive timeout based on RTT (Round-Trip Time)
 * From networkDetector.ts:269-279
 *
 * Logic:
 * - RTT available: RTT * 2 (min 2000ms, max 5000ms)
 * - RTT unavailable: 3000ms fallback
 *
 * @returns Timeout in milliseconds
 */
export const getAdaptiveTimeout = (): number => {
  const info = getConnectionInfo();

  if (info && info.rtt) {
    // RTT * 2 with bounds: min 2sec, max 5sec
    return Math.max(Math.min(info.rtt * 2, 5000), 2000);
  }

  // Fallback: 3000ms (compromise between 2 and 5 sec)
  return 3000;
};

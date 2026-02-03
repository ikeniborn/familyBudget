/**
 * TypeScript type definitions for Network Detection Module
 * Extracted from networkDetector.ts v2.0.0
 *
 * @version 3.0.0
 * @date 2026-01-16
 */

/**
 * Network status
 */
export type NetworkStatus = 'online' | 'offline' | 'degraded';

/**
 * Connection info from Network Information API
 */
export interface ConnectionInfo {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  downlink: number;      // Mbps
  rtt: number;          // Round-trip time ms
  saveData: boolean;    // Data saver mode
}

/**
 * Additional options passed to status change events
 */
export interface StatusChangeOptions {
  timestamp?: number;
  reason?: string;
  [key: string]: unknown;
}

/**
 * Constructor options for SmartNetworkDetector
 */
export interface SmartNetworkDetectorOptions {
  maxFailures?: number;
  heartbeatUrl?: string;
  heartbeatIntervals?: number[];
  heartbeatTimeout?: number;
  minCheckInterval?: number;
  degradedRtt?: number;
  onStatusChange?: ((newStatus: NetworkStatus, oldStatus: NetworkStatus, options?: StatusChangeOptions) => void) | null;
}

/**
 * Detailed status response
 */
export interface DetailedStatus {
  status: NetworkStatus;
  isOnline: boolean;            // Changed from navigatorOnLine to match implementation
  autoOfflineMode: boolean;     // Added to match implementation
  consecutiveFailures: number;
  lastHeartbeat: number;
  lastCheck: number;
  connectionInfo: ConnectionInfo | null;
}

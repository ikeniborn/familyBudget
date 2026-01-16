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
 * Constructor options for SmartNetworkDetector
 */
export interface SmartNetworkDetectorOptions {
  maxFailures?: number;
  heartbeatUrl?: string;
  heartbeatIntervals?: number[];
  heartbeatTimeout?: number;
  minCheckInterval?: number;
  degradedRtt?: number;
  onStatusChange?: ((newStatus: NetworkStatus, oldStatus: NetworkStatus, options?: any) => void) | null;
}

/**
 * Detailed status response
 */
export interface DetailedStatus {
  status: NetworkStatus;
  navigatorOnLine: boolean;
  consecutiveFailures: number;
  lastHeartbeat: number;
  lastCheck: number;
  connectionInfo: ConnectionInfo | null;
}

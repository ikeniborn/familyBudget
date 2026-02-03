/**
 * Window Adapter - 100% Backward Compatibility Layer
 * Provides window.SmartNetworkDetector class identical to v2.0.0 API
 *
 * This adapter ensures backward compatibility with existing code that uses:
 * ```javascript
 * const detector = new SmartNetworkDetector(options);
 * detector.getStatus(); // → 'online' | 'offline' | 'degraded'
 * ```
 *
 * @version 3.0.0
 * @date 2026-01-16
 */

import { resetState, getState, updateState } from '../core/NetworkState';
import { init, destroy, dispatchRestoredState } from '../core/lifecycle';
import { checkConnectivity } from '../core/detectionEngine';
import { getConnectionInfo } from '../utils/connectionInfo';
import { onRequestSuccess, onRequestFailure } from '../features/errorTracking';
import {
  enableAutoOfflineMode,
  disableAutoOfflineMode,
  isOfflineModeEnabled
} from '../features/autoOffline';
import { stopHeartbeat } from '../features/heartbeat';

import type {
  NetworkStatus,
  SmartNetworkDetectorOptions,
  DetailedStatus,
  ConnectionInfo
} from '../types';

/**
 * SmartNetworkDetector Class
 * 100% backward compatible with v2.0.0
 *
 * Delegates all operations to modular functions while maintaining
 * the same API surface as the original class.
 */
export class SmartNetworkDetector {
  /**
   * Constructor
   * @param options - Configuration options (optional)
   */
  constructor(options: SmartNetworkDetectorOptions = {}) {
    // Reset state with new options and initialize
    resetState(options);
    init();
  }

  // =========================================================================
  // Status Queries
  // =========================================================================

  /**
   * Get current network status
   * @returns Current status: 'online' | 'offline' | 'degraded'
   */
  getStatus(): NetworkStatus {
    return getState().status;
  }

  /**
   * Check if network is online (includes degraded)
   * @returns true if status is 'online' (may include auto-offline mode)
   */
  isOnline(): boolean {
    return getState().status === 'online';
  }

  /**
   * Check if network is fully online (not auto-offline, not degraded)
   * @returns true if status is 'online' AND auto-offline mode is disabled
   */
  isFullyOnline(): boolean {
    const state = getState();
    return state.status === 'online' && !state.autoOfflineMode;
  }

  /**
   * Get connection quality information from Network Information API
   * @returns ConnectionInfo object or null if API not available
   */
  getConnectionInfo(): ConnectionInfo | null {
    return getConnectionInfo();
  }

  /**
   * Get detailed network status information
   * @returns DetailedStatus object with all status fields
   */
  getDetailedStatus(): DetailedStatus {
    const state = getState();
    const connectionInfo: ConnectionInfo | null = getConnectionInfo();

    return {
      status: state.status,
      isOnline: state.status === 'online',
      autoOfflineMode: state.autoOfflineMode,
      consecutiveFailures: state.consecutiveFailures,
      lastCheck: state.lastCheck,
      lastHeartbeat: state.lastHeartbeat,
      connectionInfo
    };
  }

  // =========================================================================
  // Network Detection
  // =========================================================================

  /**
   * Check real API availability (force check)
   * @param force - Ignore min check interval (default: false)
   * @returns Promise<NetworkStatus> - Resolved status
   */
  async checkConnectivity(force: boolean = false): Promise<NetworkStatus> {
    return await checkConnectivity(force);
  }

  // =========================================================================
  // Request Tracking (for OfflineManager integration)
  // =========================================================================

  /**
   * Called on successful API request
   * Logic:
   * - Reset consecutive failures counter
   * - If status = 'offline' → verify real availability
   * - If status = 'degraded' → upgrade to 'online'
   */
  onRequestSuccess(): void {
    onRequestSuccess();
  }

  /**
   * Called on failed API request
   * Logic:
   * - Increment consecutive failures counter
   * - If failures >= maxFailuresBeforeOffline → set 'offline' status
   * - Else if status = 'online' → downgrade to 'degraded'
   */
  onRequestFailure(): void {
    onRequestFailure();
  }

  // =========================================================================
  // Auto-Offline Mode (Emergency Offline)
  // =========================================================================

  /**
   * Enable auto-offline mode
   * Use case: When server is completely unavailable (emergency mode)
   *
   * Actions:
   * 1. Set auto-offline mode flag
   * 2. Save to localStorage (persistent)
   * 3. Stop heartbeat checks
   * 4. Set status to 'offline'
   * 5. Start recovery checks (30s → 60s → 120s)
   * 6. Dispatch events for UI update
   */
  enableAutoOfflineMode(): void {
    enableAutoOfflineMode();
  }

  /**
   * Disable auto-offline mode
   * Called when connection to server is restored.
   *
   * Actions:
   * 1. Clear auto-offline mode flag
   * 2. Save to localStorage
   * 3. Stop recovery checks
   * 4. Resume heartbeat checks
   * 5. Verify actual network state
   */
  async disableAutoOfflineMode(): Promise<void> {
    await disableAutoOfflineMode();
  }

  /**
   * Check if auto offline mode is enabled
   * @returns true if auto-offline mode is active
   */
  isOfflineModeEnabled(): boolean {
    return isOfflineModeEnabled();
  }

  // =========================================================================
  // Lifecycle Management
  // =========================================================================

  /**
   * Cleanup on destroy
   * Actions:
   * 1. Remove all event listeners
   * 2. Stop heartbeat
   * 3. Stop auto-recovery check
   *
   * CRITICAL: Always call this on component unmount to prevent memory leaks!
   */
  destroy(): void {
    destroy();
  }

  /**
   * Stop heartbeat checks
   * Useful when switching to manual network detection
   */
  stopHeartbeat(): void {
    stopHeartbeat();
  }

  /**
   * Dispatch events for restored offline state from localStorage
   * From networkDetector.ts:121-147
   *
   * Called after initialization to notify listeners about restored auto-offline state.
   * Safe to call multiple times - only dispatches once.
   */
  dispatchRestoredState(): void {
    dispatchRestoredState();
  }

  // =========================================================================
  // Internal State Access (for base.html:2320 compatibility)
  // =========================================================================

  /**
   * CRITICAL: Internal property used in base.html:2320
   * Must be accessible as getter/setter for backward compatibility
   */
  get _stateDispatched(): boolean {
    return getState()._stateDispatched;
  }

  set _stateDispatched(value: boolean) {
    updateState({ _stateDispatched: value });
  }
}

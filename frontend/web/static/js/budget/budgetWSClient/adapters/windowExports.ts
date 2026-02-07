/**
 * Window Exports Adapter
 * Provides backward compatibility for window.budgetWSClient
 */

import {
  connect,
  disconnect,
  reconnect,
  forceReconnect,
  on,
  off,
  getState,
  updateState,
} from '../index';

/**
 * BudgetWSClient class for backward compatibility
 * Proxies all calls to modular functions
 */
export class BudgetWSClient {
  /**
   * Constructor
   */
  constructor() {
    // State already initialized via createInitialState
  }

  /**
   * Get connection status
   */
  get isConnected(): boolean {
    return getState().isConnected;
  }

  /**
   * Get enabled status
   */
  get enabled(): boolean {
    return getState().enabled;
  }

  /**
   * Set enabled status
   */
  setEnabled(enabled: boolean): void {
    updateState({ enabled });
  }

  /**
   * Get leader status (multi-tab)
   */
  get isLeader(): boolean {
    return getState().isLeader;
  }

  /**
   * Get long polling status
   */
  get useLongPolling(): boolean {
    return getState().useLongPolling;
  }

  /**
   * Get RTT rolling average
   */
  get rttRollingAverage(): number {
    return getState().rttRollingAverage;
  }

  /**
   * Get limit reached status
   */
  get limitReached(): boolean {
    return getState().limitReached;
  }

  /**
   * Get approaching limit status
   */
  get approachingLimit(): boolean {
    return getState().approachingLimit;
  }

  // ============================================================================
  // Connection Methods
  // ============================================================================
  connect = connect;
  disconnect = disconnect;
  reconnect = reconnect;

  // ============================================================================
  // Event Methods
  // ============================================================================
  on = on;
  off = off;

  /**
   * Get status (for diagnostics)
   */
  getStatus(): any {
    const state = getState();
    return {
      connected: state.isConnected,
      enabled: state.enabled,
      isLeader: state.isLeader,
      useLongPolling: state.useLongPolling,
      rttAverage: state.rttRollingAverage,
      reconnectAttempts: state.reconnectAttempts,
    };
  }

  /**
   * Diagnose connection
   */
  diagnose(): void {
    // Stub - original implementation would log detailed diagnostics
    this.getStatus(); // Call to prevent unused warning
  }

  /**
   * Force reconnect
   */
  forceReconnect = forceReconnect;
}

/**
 * Export to window for global access
 */
if (typeof window !== 'undefined') {
  (window as any).BudgetWSClient = BudgetWSClient;

  // Create singleton instance for backward compatibility
  // index.js expects window.budgetWSClient (instance), not BudgetWSClient (class)
  (window as any).budgetWSClient = new BudgetWSClient();

  // IMPORTANT: Do NOT auto-connect here
  // index.js:49 calls connect() explicitly during app initialization
}

export default BudgetWSClient;

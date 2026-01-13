/**
 * Window namespace extensions for BudgetWSClient
 * Declares global window.budgetWSClient and related types
 */

/**
 * BudgetWSClient class interface
 * Provides WebSocket real-time updates and connection management
 */
export interface BudgetWSClientClass {
  // ============================================================================
  // Connection Management
  // ============================================================================
  connect(): void;
  disconnect(): void;
  reconnect(): void;
  isConnected: boolean;

  // ============================================================================
  // Configuration
  // ============================================================================
  setEnabled(enabled: boolean): void;
  enabled: boolean;

  // ============================================================================
  // Status & Diagnostics
  // ============================================================================
  getStatus(): {
    connected: boolean;
    enabled: boolean;
    isLeader: boolean;
    useLongPolling: boolean;
    rttAverage: number;
    reconnectAttempts: number;
  };
  diagnose(): void;
  forceReconnect(): void;

  // ============================================================================
  // Event Handlers
  // ============================================================================
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;

  // ============================================================================
  // Multi-tab Support
  // ============================================================================
  isLeader: boolean;
  useLongPolling: boolean;

  // ============================================================================
  // RTT Measurement
  // ============================================================================
  rttRollingAverage: number;

  // ============================================================================
  // Limit Tracking
  // ============================================================================
  limitReached: boolean;
  approachingLimit: boolean;
}

// Extend Window interface
declare global {
  interface Window {
    budgetWSClient?: BudgetWSClientClass;
  }
}

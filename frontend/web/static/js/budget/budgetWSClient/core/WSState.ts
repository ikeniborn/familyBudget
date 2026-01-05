/**
 * WebSocket State Management
 *
 * Central state for budgetWSClient module.
 * This module has ZERO dependencies to prevent circular dependencies.
 *
 * Phase 2.3: ES Modules Migration
 * Extracted from: frontend/web/static/js/budget/budgetWSClient.ts lines 120-200
 */

export {}; // Force module scope

// ============================================================================
// Type Definitions
// ============================================================================

export type WSState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'approaching_limit'
  | 'limit_reached';

export type WSBadgeState =
  | 'disabled'
  | 'warning_slow'
  | 'warning_tabs'
  | 'connected'
  | 'connected_via_leader'
  | 'limit_reached'
  | 'reconnecting'
  | 'error'
  | 'connecting';

export type WSEventType =
  | 'connect'
  | 'disconnect'
  | 'connected'
  | 'auth_error'
  | 'limit_reached'
  | 'reconnect_failed'
  | 'online_status'
  | 'fact_created'
  | 'fact_updated'
  | 'fact_deleted'
  | 'plan_created'
  | 'plan_updated'
  | 'plan_deleted'
  | 'transfer_created'
  | 'transfer_deleted'
  | 'item_created'
  | 'item_updated'
  | 'item_deleted'
  | 'item_completed';

export interface WSMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

export interface ConnectionHistoryEntry {
  event: string;
  time: number;
}

export interface LastError {
  message: string;
  time: string;
}

export interface RTTMetrics {
  current: number;
  average: number;
  min: number;
  max: number;
  samples: number[];
}

export interface WSClientState {
  // WebSocket connection
  ws: WebSocket | null;
  isConnected: boolean;
  enabled: boolean;

  // Reconnection
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  baseReconnectDelay: number;
  maxReconnectDelay: number;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;

  // Connection tracking
  connectionId: string | null;
  lastServerPing: number;
  pingTimeout: number;

  // Error tracking
  lastError: LastError | null;
  connectionHistory: ConnectionHistoryEntry[];

  // Long Polling fallback
  useLongPolling: boolean;
  pollController: AbortController | null;
  lastEventTimestamp: number;
  pollInterval: number;
  pollTimeout: number;
  pollTimeoutHandle: ReturnType<typeof setTimeout> | null;
  pollingActive: boolean;
  pollRetryCount: number;
  maxPollRetries: number;
  basePollRetryDelay: number;

  // Multi-tab support
  leaderLockHeld: boolean;
  leaderElectionInProgress: boolean;
  heartbeatInterval: ReturnType<typeof setInterval> | null;
  followerCheckInterval: ReturnType<typeof setInterval> | null;
  broadcastChannel: BroadcastChannel | null;

  // RTT measurement
  rttMetrics: RTTMetrics;
  rttSampleWindow: number;
  highRTTThreshold: number;
  veryHighRTTThreshold: number;
  rttFilterEnabled: boolean;

  // iOS quirks
  lastVisibilityChange: number;
  wakePending: boolean;
  wakeCheckDelay: number;

  // Navigation detection
  navigationWindowActive: boolean;
  navigationWindowStart: number | null;
  navigationWindowDuration: number;

  // Badge state
  currentBadgeState: WSBadgeState;
  badgeUpdatePending: boolean;

  // Event handlers
  handlers: Record<string, Function[]>;
}

// ============================================================================
// State Storage (Singleton)
// ============================================================================

let state: WSClientState = {
  // WebSocket connection
  ws: null,
  isConnected: false,
  enabled: true,

  // Reconnection
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  baseReconnectDelay: 1000,
  maxReconnectDelay: 30000,
  reconnectTimeout: null,

  // Connection tracking
  connectionId: null,
  lastServerPing: 0,
  pingTimeout: 65000,

  // Error tracking
  lastError: null,
  connectionHistory: [],

  // Long Polling fallback
  useLongPolling: false,
  pollController: null,
  lastEventTimestamp: 0,
  pollInterval: 10000,
  pollTimeout: 30000,
  pollTimeoutHandle: null,
  pollingActive: false,
  pollRetryCount: 0,
  maxPollRetries: 3,
  basePollRetryDelay: 5000,

  // Multi-tab support
  leaderLockHeld: false,
  leaderElectionInProgress: false,
  heartbeatInterval: null,
  followerCheckInterval: null,
  broadcastChannel: null,

  // RTT measurement
  rttMetrics: {
    current: 0,
    average: 0,
    min: Infinity,
    max: 0,
    samples: []
  },
  rttSampleWindow: 10,
  highRTTThreshold: 1000,
  veryHighRTTThreshold: 3000,
  rttFilterEnabled: true,

  // iOS quirks
  lastVisibilityChange: Date.now(),
  wakePending: false,
  wakeCheckDelay: 2000,

  // Navigation detection
  navigationWindowActive: false,
  navigationWindowStart: null,
  navigationWindowDuration: 3000,

  // Badge state
  currentBadgeState: 'connecting',
  badgeUpdatePending: false,

  // Event handlers
  handlers: {}
};

// ============================================================================
// State Accessors
// ============================================================================

/**
 * Get current WebSocket client state (read-only)
 */
export const getState = (): Readonly<WSClientState> => state;

/**
 * Update state (partial updates)
 *
 * @param updates - Partial state object with fields to update
 */
export const updateState = (updates: Partial<WSClientState>): void => {
  state = { ...state, ...updates };
};

/**
 * Reset state to initial values
 */
export const resetState = (): void => {
  // Clean up existing resources
  if (state.ws) {
    state.ws.close();
  }
  if (state.reconnectTimeout) {
    clearTimeout(state.reconnectTimeout);
  }
  if (state.heartbeatInterval) {
    clearInterval(state.heartbeatInterval);
  }
  if (state.followerCheckInterval) {
    clearInterval(state.followerCheckInterval);
  }
  if (state.broadcastChannel) {
    state.broadcastChannel.close();
  }

  // Reset state
  state = {
    ws: null,
    isConnected: false,
    enabled: true,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    baseReconnectDelay: 1000,
    maxReconnectDelay: 30000,
    reconnectTimeout: null,
    connectionId: null,
    lastServerPing: 0,
    pingTimeout: 65000,
    lastError: null,
    connectionHistory: [],
    useLongPolling: false,
    pollController: null,
    lastEventTimestamp: 0,
    pollInterval: 10000,
    pollTimeout: 30000,
    pollTimeoutHandle: null,
    pollingActive: false,
    pollRetryCount: 0,
    maxPollRetries: 3,
    basePollRetryDelay: 5000,
    leaderLockHeld: false,
    leaderElectionInProgress: false,
    heartbeatInterval: null,
    followerCheckInterval: null,
    broadcastChannel: null,
    rttMetrics: {
      current: 0,
      average: 0,
      min: Infinity,
      max: 0,
      samples: []
    },
    rttSampleWindow: 10,
    highRTTThreshold: 1000,
    veryHighRTTThreshold: 3000,
    rttFilterEnabled: true,
    lastVisibilityChange: Date.now(),
    wakePending: false,
    wakeCheckDelay: 2000,
    navigationWindowActive: false,
    navigationWindowStart: null,
    navigationWindowDuration: 3000,
    currentBadgeState: 'connecting',
    badgeUpdatePending: false,
    handlers: {}
  };
};

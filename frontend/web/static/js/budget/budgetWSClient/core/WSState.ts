/**
 * Central state management for WebSocket client
 * ZERO DEPENDENCIES to prevent circular deps
 *
 * This module contains ONLY state definition and basic accessors.
 * NO business logic, NO external imports.
 */

export {}; // Force module scope

/**
 * Visual badge state representation
 */
export interface WSBadgeState {
  status: 'online' | 'offline' | 'connecting' | 'slow' | 'error';
  visible: boolean;
  message: string;
}

/**
 * Connection history entry for debugging
 */
export interface ConnectionHistoryEntry {
  timestamp: number;
  event: string;
  details?: any;
}

/**
 * Browser capabilities detection
 */
export interface BrowserInfo {
  isSafari: boolean;
  isIOSSafari: boolean;
  isAndroidChrome: boolean;
}

/**
 * Complete state container for BudgetWSClient
 *
 * Organized into logical sections:
 * 1. WebSocket connection
 * 2. Connection tracking
 * 3. Long Polling fallback
 * 4. Client ping
 * 5. RTT measurement
 * 6. Limit tracking
 * 7. Multi-tab support
 * 8. Navigation detection
 * 9. Wake recovery
 * 10. Status indicator
 * 11. Browser detection
 */
export interface BudgetWSState {
  // ============================================================================
  // WebSocket connection
  // ============================================================================
  ws: WebSocket | null;
  isConnected: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  baseReconnectDelay: number; // 1 second
  maxReconnectDelay: number; // 30 seconds
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
  handlers: Record<string, Array<(data: any) => void>>; // event → handlers[]
  enabled: boolean; // Can be disabled if not needed

  // ============================================================================
  // Connection tracking
  // ============================================================================
  connectionId: string | null;
  lastServerPing: number;
  PING_TIMEOUT: number; // 45 seconds (server pings every 10s)
  lastError: Error | null;
  connectionHistory: ConnectionHistoryEntry[];

  // ============================================================================
  // Long Polling fallback (for Safari/iOS where WebSocket unreliable)
  // ============================================================================
  useLongPolling: boolean;
  pollController: AbortController | null;
  lastEventTimestamp: number;
  POLL_INTERVAL: number; // 5000ms
  POLL_TIMEOUT: number; // 5 seconds
  pollTimeout: ReturnType<typeof setTimeout> | null;
  pollingActive: boolean;
  pollRetryCount: number;
  MAX_POLL_RETRIES: number; // 10
  BASE_POLL_RETRY_DELAY: number; // 1000ms
  consecutive503Count: number; // Track consecutive 503 errors → stop polling

  // ============================================================================
  // Client ping (bidirectional communication)
  // ============================================================================
  pingInterval: ReturnType<typeof setInterval> | null;
  CLIENT_PING_INTERVAL: number; // 15000ms (8000ms for iOS)
  lastPongReceived: number;

  // ============================================================================
  // RTT measurement (slow connection detection)
  // ============================================================================
  rttMeasurements: number[]; // Rolling window of last 5 RTT measurements
  rttRollingAverage: number; // Average of last 5 measurements
  pingTimestamp: number | null; // Timestamp when ping sent
  RTT_THRESHOLD: number; // 5000ms (configurable via FEATURE_FLAGS)
  RTT_WINDOW_SIZE: number; // 5

  // ============================================================================
  // Limit tracking (budget limits reached)
  // ============================================================================
  limitReached: boolean;
  approachingLimit: boolean;

  // ============================================================================
  // Multi-tab support (BroadcastChannel + Web Locks API)
  // Only one WebSocket connection per browser (leader election)
  // ============================================================================
  isLeader: boolean;
  channel: BroadcastChannel | null;
  leaderHeartbeatInterval: ReturnType<typeof setInterval> | null;
  followerCheckInterval: ReturnType<typeof setInterval> | null;
  lastLeaderHeartbeat: number;
  HEARTBEAT_INTERVAL: number; // 3000ms (leader sends heartbeat every 3s)
  LEADER_TIMEOUT: number; // 10000ms (follower considers leader dead after 10s)
  leaderLockAcquired: boolean;
  lockReleaser: (() => void) | null;
  multiTabSupported: boolean | null; // Cached support check
  multiTabInitialized: boolean; // Lazy init flag

  // ============================================================================
  // Navigation detection (suppress RTT warnings during page load)
  // ============================================================================
  navigationCheckInterval: ReturnType<typeof setInterval> | null;
  lastNavigationCheck: number;
  NAVIGATION_CHECK_INTERVAL: number; // 1000ms
  navigationWindow: { before: number; after: number }; // Grace periods
  isInNavigationWindow: boolean;
  isNavigating: boolean; // true during page load (10s window)
  navigationTimer: ReturnType<typeof setTimeout> | null;
  NAVIGATION_WINDOW: number; // 10000ms

  // ============================================================================
  // Wake recovery (iOS Safari sleep/wake issues)
  // ============================================================================
  reconnecting: boolean; // Guard against parallel reconnection attempts
  lastVisibilityChange: number;
  lastFocusChange: number;
  iosWakeRecoveryMode: boolean; // Increased delays after code 1005
  iosDeviceMode: boolean; // ANY iOS/iPadOS device (all use WebKit)
  iosWebSocketTimeout: number | undefined; // 5000ms for iOS
  suspendDetectionTimeout: ReturnType<typeof setTimeout> | null;

  // Wake recovery enhancements (5 layers of protection)
  healthCheckInterval: ReturnType<typeof setInterval> | null;
  HEALTH_CHECK_INTERVAL: number; // 60000ms
  pongTimeoutTimer: ReturnType<typeof setTimeout> | null;
  PONG_TIMEOUT: number; // 20000ms
  enableDetailedLogging: boolean; // Always on for iOS debugging

  // ============================================================================
  // Status indicator (visual badge debouncing)
  // ============================================================================
  lastIndicatorState: string | null;
  indicatorDebounceTimer: ReturnType<typeof setTimeout> | null;
  INDICATOR_DEBOUNCE_MS: number; // 500ms (prevent flickering on iOS)

  // Sticky state mechanism (prevent rapid badge transitions)
  lastStateChangeTime: number;
  currentBadgeState: string | null;
  STICKY_STATE_DURATION: number; // 5000ms (minimum 5s between changes)

  // Badge state (status, visibility, message)
  badgeState: WSBadgeState;

  // ============================================================================
  // Browser detection
  // ============================================================================
  browserInfo: BrowserInfo;
}

/**
 * Initial state factory
 * Creates fresh state with default values
 */
export const createInitialState = (): BudgetWSState => ({
  // WebSocket connection
  ws: null,
  isConnected: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  baseReconnectDelay: 1000,
  maxReconnectDelay: 30000,
  reconnectTimeout: null,
  handlers: {},
  enabled: true,

  // Connection tracking
  connectionId: null,
  lastServerPing: 0,
  PING_TIMEOUT: 45000,
  lastError: null,
  connectionHistory: [],

  // Long Polling fallback
  useLongPolling: false,
  pollController: null,
  lastEventTimestamp: 0,
  POLL_INTERVAL: 5000,
  POLL_TIMEOUT: 5,
  pollTimeout: null,
  pollingActive: false,
  pollRetryCount: 0,
  MAX_POLL_RETRIES: 10,
  BASE_POLL_RETRY_DELAY: 1000,
  consecutive503Count: 0,

  // Client ping
  pingInterval: null,
  CLIENT_PING_INTERVAL: 15000,
  lastPongReceived: 0,

  // RTT measurement
  rttMeasurements: [],
  rttRollingAverage: 0,
  pingTimestamp: null,
  RTT_THRESHOLD: 5000,
  RTT_WINDOW_SIZE: 5,

  // Limit tracking
  limitReached: false,
  approachingLimit: false,

  // Multi-tab support
  isLeader: false,
  channel: null,
  leaderHeartbeatInterval: null,
  followerCheckInterval: null,
  lastLeaderHeartbeat: 0,
  HEARTBEAT_INTERVAL: 3000,
  LEADER_TIMEOUT: 10000,
  leaderLockAcquired: false,
  lockReleaser: null,
  multiTabSupported: null,
  multiTabInitialized: false,

  // Navigation detection
  navigationCheckInterval: null,
  lastNavigationCheck: 0,
  NAVIGATION_CHECK_INTERVAL: 1000,
  navigationWindow: { before: 0, after: 0 },
  isInNavigationWindow: false,
  isNavigating: true, // Initially true (page just loaded)
  navigationTimer: null,
  NAVIGATION_WINDOW: 10000,

  // Wake recovery
  reconnecting: false,
  lastVisibilityChange: 0,
  lastFocusChange: 0,
  iosWakeRecoveryMode: false,
  iosDeviceMode: false,
  iosWebSocketTimeout: undefined,
  suspendDetectionTimeout: null,
  healthCheckInterval: null,
  HEALTH_CHECK_INTERVAL: 60000,
  pongTimeoutTimer: null,
  PONG_TIMEOUT: 20000,
  enableDetailedLogging: false,

  // Status indicator
  lastIndicatorState: null,
  indicatorDebounceTimer: null,
  INDICATOR_DEBOUNCE_MS: 500,
  lastStateChangeTime: 0,
  currentBadgeState: null,
  STICKY_STATE_DURATION: 5000,
  badgeState: {
    status: 'offline',
    visible: false,
    message: '',
  },

  // Browser detection
  browserInfo: {
    isSafari: false,
    isIOSSafari: false,
    isAndroidChrome: false,
  },
});

/**
 * Internal singleton state
 * NEVER export this directly - use getState() instead
 */
let state: BudgetWSState = createInitialState();

/**
 * Get readonly snapshot of current state
 * @returns Readonly state (prevents accidental mutations)
 */
export const getState = (): Readonly<BudgetWSState> => state;

/**
 * Update state with partial updates
 * Uses spread operator for immutability
 *
 * @param updates - Partial state updates
 */
export const updateState = (updates: Partial<BudgetWSState>): void => {
  state = { ...state, ...updates };
};

/**
 * Reset state to initial values
 * Clears ALL timers and connections to prevent memory leaks
 *
 * IMPORTANT: Call this on disconnect/cleanup to prevent resource leaks
 */
export const resetState = (): void => {
  // Clear all timers
  if (state.reconnectTimeout) clearTimeout(state.reconnectTimeout);
  if (state.pollTimeout) clearTimeout(state.pollTimeout);
  if (state.pingInterval) clearInterval(state.pingInterval);
  if (state.leaderHeartbeatInterval) clearInterval(state.leaderHeartbeatInterval);
  if (state.followerCheckInterval) clearInterval(state.followerCheckInterval);
  if (state.navigationCheckInterval) clearInterval(state.navigationCheckInterval);
  if (state.navigationTimer) clearTimeout(state.navigationTimer);
  if (state.suspendDetectionTimeout) clearTimeout(state.suspendDetectionTimeout);
  if (state.healthCheckInterval) clearInterval(state.healthCheckInterval);
  if (state.pongTimeoutTimer) clearTimeout(state.pongTimeoutTimer);
  if (state.indicatorDebounceTimer) clearTimeout(state.indicatorDebounceTimer);

  // Close connections
  if (state.ws) {
    state.ws.close();
  }
  if (state.pollController) {
    state.pollController.abort();
  }
  if (state.channel) {
    state.channel.close();
  }
  if (state.lockReleaser) {
    state.lockReleaser();
  }

  // Reset to initial state
  state = createInitialState();
};

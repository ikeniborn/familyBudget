/**
 * Budget WebSocket Client - State Management
 *
 * Centralized state for WebSocket connection, multi-tab support, and RTT monitoring.
 *
 * Phase 2.3: ES Modules Migration
 * Extracted from: frontend/web/static/js/budget/budgetWSClient.ts lines 22-311
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type WSState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'approaching_limit' | 'limit_reached';

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

// ============================================================================
// State Interface
// ============================================================================

/**
 * Complete state for BudgetWSClient
 *
 * Organized by functionality:
 * - WebSocket connection
 * - Long Polling fallback
 * - Multi-tab support
 * - RTT measurement
 * - iOS quirks handling
 * - Connection limits
 */
export interface BudgetWSState {
    // WebSocket connection
    ws: WebSocket | null;
    isConnected: boolean;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    baseReconnectDelay: number;
    maxReconnectDelay: number;
    reconnectTimeout: ReturnType<typeof setTimeout> | null;
    handlers: Record<string, Function[]>;
    enabled: boolean;

    // Connection tracking
    connectionId: string | null;
    lastServerPing: number;
    PING_TIMEOUT: number;

    // Error tracking
    lastError: LastError | null;
    connectionHistory: ConnectionHistoryEntry[];

    // Long Polling fallback
    useLongPolling: boolean;
    pollController: AbortController | null;
    lastEventTimestamp: number;
    POLL_INTERVAL: number;
    POLL_TIMEOUT: number;
    pollTimeout: ReturnType<typeof setTimeout> | null;
    pollingActive: boolean;
    pollRetryCount: number;
    MAX_POLL_RETRIES: number;
    BASE_POLL_RETRY_DELAY: number;
    consecutive503Count: number;

    // Client ping
    pingInterval: ReturnType<typeof setInterval> | null;
    CLIENT_PING_INTERVAL: number;
    lastPongReceived: number;

    // RTT measurement
    rttMeasurements: number[];
    rttRollingAverage: number;
    pingTimestamp: number | null;
    RTT_THRESHOLD: number;
    RTT_WINDOW_SIZE: number;

    // Limit flags
    limitReached: boolean;
    approachingLimit: boolean;

    // Multi-tab support
    isLeader: boolean;
    channel: BroadcastChannel | null;
    leaderHeartbeatInterval: number | null;
    followerCheckInterval: number | null;
    lastLeaderHeartbeat: number;
    HEARTBEAT_INTERVAL: number;
    LEADER_TIMEOUT: number;
    multiTabSupported: boolean | null;
    multiTabInitialized: boolean;

    // Status indicator debouncing
    lastIndicatorState: WSBadgeState | null;
    indicatorDebounceTimer: number | null;
    INDICATOR_DEBOUNCE_MS: number;

    // Sticky state mechanism
    lastStateChangeTime: number;
    currentBadgeState: WSBadgeState | null;
    STICKY_STATE_DURATION: number;

    // iOS wake recovery
    reconnecting: boolean;
    lastVisibilityChange: number;
    iosWakeRecoveryMode: boolean;
    iosDeviceMode: boolean;

    // Navigation detection
    isNavigating: boolean;
    navigationTimer: ReturnType<typeof setTimeout> | null;
    NAVIGATION_WINDOW: number;

    // iOS WebSocket strategy
    iosWebSocketTimeout?: number;

    // Wake recovery enhancements
    healthCheckInterval: ReturnType<typeof setInterval> | null;
    HEALTH_CHECK_INTERVAL: number;
    pongTimeoutTimer: ReturnType<typeof setTimeout> | null;
    PONG_TIMEOUT: number;
    enableDetailedLogging: boolean;
}

// ============================================================================
// Initial State Factory
// ============================================================================

/**
 * Create initial WebSocket client state
 */
export function createInitialState(): BudgetWSState {
    return {
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

        // Error tracking
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
        RTT_THRESHOLD: 1000,
        RTT_WINDOW_SIZE: 10,

        // Limit flags
        limitReached: false,
        approachingLimit: false,

        // Multi-tab support
        isLeader: false,
        channel: null,
        leaderHeartbeatInterval: null,
        followerCheckInterval: null,
        lastLeaderHeartbeat: 0,
        HEARTBEAT_INTERVAL: 5000,
        LEADER_TIMEOUT: 10000,
        multiTabSupported: null,
        multiTabInitialized: false,

        // Status indicator debouncing
        lastIndicatorState: null,
        indicatorDebounceTimer: null,
        INDICATOR_DEBOUNCE_MS: 300,

        // Sticky state mechanism
        lastStateChangeTime: 0,
        currentBadgeState: null,
        STICKY_STATE_DURATION: 3000,

        // iOS wake recovery
        reconnecting: false,
        lastVisibilityChange: 0,
        iosWakeRecoveryMode: false,
        iosDeviceMode: false,

        // Navigation detection
        isNavigating: false,
        navigationTimer: null,
        NAVIGATION_WINDOW: 2000,

        // iOS WebSocket strategy
        iosWebSocketTimeout: undefined,

        // Wake recovery enhancements
        healthCheckInterval: null,
        HEALTH_CHECK_INTERVAL: 30000,
        pongTimeoutTimer: null,
        PONG_TIMEOUT: 10000,
        enableDetailedLogging: false
    };
}

// ============================================================================
// Singleton State
// ============================================================================

let state: BudgetWSState = createInitialState();

export const getState = (): BudgetWSState => state;

export const updateState = (updates: Partial<BudgetWSState>): void => {
    state = { ...state, ...updates };
};

export const resetState = (): void => {
    state = createInitialState();
};

/**
 * Connection Manager for WebSocket
 * Handles connect, disconnect, reconnect lifecycle
 *
 * Phase 1 Implementation:
 * - Token management (getWSToken)
 * - Connection creation with timeout
 * - Message routing
 * - Utility functions (setError, logHistory, closeExistingConnection)
 * - Reconnection logic (scheduleReconnect, forceReconnect)
 *
 * Original: budgetWSClient.js:957-1785
 */

// Type declaration for global debugLog
declare const debugLog: (...args: any[]) => void;

import { getState, updateState, type ConnectionHistoryEntry } from './WSState';

// Import from other modules for integration
import { startLongPolling, stopLongPolling } from '../fallback/longPolling';
import { handlePongReceived } from '../features/healthCheck';
import { dispatchEvent } from '../integration/eventHandlers';
import { broadcastWSEvent } from '../multiTab/tabCoordination';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Set error for debugging
 * Original: budgetWSClient.js:1198-1202
 */
function setError(error: string): void {
  updateState({
    lastError: {
      message: error,
      time: new Date().toISOString()
    } as any
  });
  logHistory(`error: ${error}`);
  console.error('[BudgetWS]', error);
}

/**
 * Log to connection history (last 20 entries)
 * Original: budgetWSClient.js:1205-1221
 */
function logHistory(event: string, details?: any): void {
  const state = getState();
  const entry: ConnectionHistoryEntry = {
    timestamp: Date.now(),
    event,
    details
  };

  const history = [...state.connectionHistory, entry].slice(-20);
  updateState({ connectionHistory: history });
}

/**
 * Close existing connection (WS or polling)
 * Original: budgetWSClient.js:876-905
 */
function closeExistingConnection(): void {
  const state = getState();

  if (state.ws) {
    state.ws.close();
    updateState({ ws: null });
  }

  if (state.pollingActive) {
    stopLongPolling();
  }
}

/**
 * Send message to WebSocket
 * Original: budgetWSClient.js:1410-1422
 *
 * @internal Used by healthCheck.ts for checkOnline()
 */
export function sendMessage(message: any): boolean {
  const state = getState();

  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    console.warn('[BudgetWS] Cannot send, not connected');
    return false;
  }

  try {
    state.ws.send(JSON.stringify(message));
    return true;
  } catch (e) {
    setError(`Send failed: ${e instanceof Error ? e.message : 'unknown'}`);
    return false;
  }
}

/**
 * Check if offline mode is active
 * Original: budgetWSClient.js:312-337
 */
function isOfflineModeActive(): boolean {
  const offlineManager = (window as any).offlineManager;
  return offlineManager && typeof offlineManager.isOffline === 'function' && offlineManager.isOffline();
}

// ============================================================================
// Token Management
// ============================================================================

/**
 * Fetch WebSocket authentication token
 * Original: budgetWSClient.js:957-984
 */
async function getWSToken(): Promise<string | null> {
  logHistory('token_fetch_start');

  try {
    const response = await fetch('/api/v1/budget/ws/token', {
      method: 'POST',
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 401) {
        setError('Token 401: Not authenticated');
        updateState({ enabled: false });
        return null;
      }
      setError(`Token HTTP ${response.status}`);
      // 5xx or other server errors: mark as disconnected so the indicator reflects the failure
      updateState({
        isConnected: false,
        reconnectAttempts: getState().reconnectAttempts + 1,
      });
      return null;
    }

    const data = await response.json();
    if (!data.token) {
      setError('Token empty in response');
      return null;
    }

    logHistory('token_received');
    return data.token;
  } catch (e) {
    setError(`Token fetch: ${e instanceof Error ? e.message : 'unknown'}`);
    return null;
  }
}

// ============================================================================
// Message Handling
// ============================================================================

/**
 * Handle incoming WebSocket message
 * Original: budgetWSClient.js:1223-1365
 */
function handleServerMessage(message: any): void {
  const { event, data, connection_id } = message;

  // Update connection ID
  if (connection_id) {
    updateState({ connectionId: connection_id });
  }

  // Server ping - update last ping timestamp
  if (event === 'ping') {
    updateState({ lastServerPing: Date.now() });
    return;
  }

  // Pong response - measure RTT
  if (event === 'pong') {
    handlePongReceived();
    return;
  }

  // Offline mode notification
  if (event === 'offline') {
    // Integration with offlineManager
    const offlineManager = (window as any).offlineManager;
    if (offlineManager && typeof offlineManager.handleOfflineEvent === 'function') {
      offlineManager.handleOfflineEvent(data);
    }
    return;
  }

  // Route to specific event handler
  dispatchEvent(event, data);

  // Broadcast to follower tabs
  const state = getState();
  if (state.isLeader) {
    broadcastWSEvent(event, data);
  }
}

// ============================================================================
// WebSocket Event Handlers
// ============================================================================

/**
 * Handle WebSocket open event
 */
function handleOpen(): void {
  const state = getState();

  logHistory('ws_connected');

  // Reset RTT measurements on new connection
  updateState({
    isConnected: true,
    reconnectAttempts: 0,
    limitReached: false,
    rttMeasurements: [],
    rttRollingAverage: 0,
    pingTimestamp: null
  });

  // Notify handlers
  const handlers = state.handlers['connect'] || [];
  handlers.forEach(handler => handler({}));

  // Start client ping (will be implemented via features/healthCheck)
  // startClientPing();

  // Start health check (will be implemented via mobile/wakeRecovery)
  // startHealthCheck();
}

/**
 * Handle WebSocket close event
 */
function handleClose(event: CloseEvent): void {
  const state = getState();

  // Log detailed close info for debugging
  const reason = event.reason || 'none';
  const clean = event.wasClean ? 'clean' : 'unclean';
  logHistory(`ws_closed_code=${event.code}_reason=${reason}_${clean}`);

  updateState({
    isConnected: false,
    connectionId: null
  });

  // Stop client ping
  // stopClientPing();

  // Stop health check
  // stopHealthCheck();

  // Handle specific close codes
  if (event.code === 4001) {
    setError('WS 4001: Auth error');
    updateState({ enabled: false });
    const handlers = state.handlers['auth_error'] || [];
    handlers.forEach(handler => handler({}));
    return;
  }

  if (event.code === 4029) {
    setError('WS 4029: Connection limit');
    updateState({
      limitReached: true,
      reconnectAttempts: state.maxReconnectAttempts
    });
    const handlers = state.handlers['limit_reached'] || [];
    handlers.forEach(handler => handler({}));
    return;
  }

  // iOS-specific: code 1005 (No Status Received) after wake from sleep
  if (state.iosDeviceMode && event.code === 1005) {
    logHistory('ios_1005_wake_recovery');
    updateState({ iosWakeRecoveryMode: true });
    // Reset wake recovery mode after 5 seconds
    setTimeout(() => {
      updateState({ iosWakeRecoveryMode: false });
    }, 5000);
  }

  // Notify handlers
  const handlers = state.handlers['disconnect'] || [];
  handlers.forEach(handler => handler({}));

  // Schedule reconnect
  scheduleReconnect();
}

/**
 * Handle WebSocket error event
 */
function handleError(_event: Event): void {
  setError('WS error event');
}

/**
 * Handle WebSocket message event
 */
function handleMessage(event: MessageEvent): void {
  try {
    const message = JSON.parse(event.data);
    handleServerMessage(message);
  } catch (e) {
    console.error('[BudgetWS] Failed to parse message:', e);
  }
}

// ============================================================================
// Connection Creation
// ============================================================================

/**
 * Create WebSocket connection
 * Original: budgetWSClient.js:1043-1191
 */
async function createConnection(): Promise<void> {
  const state = getState();

  if (!state.enabled) return;

  // Skip if offline mode is active
  if (isOfflineModeActive()) {
    logHistory('connect_skip_offline_mode');
    debugLog('[BudgetWS] Skipping connection - offline mode active');
    return;
  }

  // Quick check: don't attempt if browser says offline
  if (!navigator.onLine) {
    logHistory('connect_skip_navigator_offline');
    debugLog('[BudgetWS] Browser reports offline, skipping connection attempt');
    return;
  }

  // If already using long polling, continue with that
  if (state.useLongPolling) {
    startLongPolling();
    return;
  }

  // Close existing connection if any
  if (state.ws) {
    state.ws.close();
    updateState({ ws: null });
  }

  // Get auth token for WebSocket
  const token = await getWSToken();
  if (!token) {
    console.warn('[BudgetWS] No token, falling back to long polling');
    updateState({ useLongPolling: true });
    startLongPolling();
    return;
  }

  // Build WebSocket URL
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/api/v1/budget/ws?token=${encodeURIComponent(token)}`;

  try {
    const ws = new WebSocket(wsUrl);

    // Connection timeout (5 sec for iOS, 10 sec for others)
    const timeout = state.iosWebSocketTimeout || 10000;
    logHistory(`ws_connecting_timeout_${timeout}ms`);

    const connectionTimeout = setTimeout(() => {
      if (ws && ws.readyState !== WebSocket.OPEN) {
        setError(`WS timeout after ${timeout}ms`);
        ws.close();
        updateState({
          ws: null,
          useLongPolling: true
        });
        startLongPolling();
      }
    }, timeout);

    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      updateState({ ws });
      handleOpen();
    };

    ws.onmessage = handleMessage;

    ws.onerror = (error) => {
      clearTimeout(connectionTimeout);
      handleError(error as Event);
    };

    ws.onclose = (event) => {
      clearTimeout(connectionTimeout);
      handleClose(event);
    };

    updateState({ ws });
  } catch (error) {
    setError(`WS create: ${error instanceof Error ? error.message : 'unknown'}`);
    updateState({ useLongPolling: true });
    startLongPolling();
  }
}

// ============================================================================
// Reconnection Logic
// ============================================================================

/**
 * Schedule reconnection with exponential backoff
 * Original: budgetWSClient.js:1729-1785
 */
function scheduleReconnect(): void {
  const state = getState();

  // Skip reconnect if offline mode is active
  if (isOfflineModeActive()) {
    logHistory('reconnect_skip_offline_mode');
    debugLog('[BudgetWS] Skipping reconnect - offline mode active');
    return;
  }

  if (!navigator.onLine) {
    logHistory('reconnect_skip_navigator_offline');
    debugLog('[BudgetWS] Offline, waiting for network');
    window.addEventListener('online', () => {
      debugLog('[BudgetWS] Back online, reconnecting');
      updateState({
        reconnectAttempts: 0,
        useLongPolling: false
      });
      createConnection();
    }, { once: true });
    return;
  }

  if (state.reconnectTimeout) return;

  if (state.reconnectAttempts >= state.maxReconnectAttempts) {
    console.error('[BudgetWS] Max reconnect attempts reached');
    const handlers = state.handlers['reconnect_failed'] || [];
    handlers.forEach(handler => handler({ attempts: state.reconnectAttempts }));
    return;
  }

  // Calculate delay with exponential backoff
  let baseDelay = state.baseReconnectDelay * Math.pow(2, state.reconnectAttempts);

  // iOS wake recovery mode: increase minimum delay to let network stabilize
  if (state.iosDeviceMode && state.iosWakeRecoveryMode) {
    baseDelay = Math.max(baseDelay, 3000); // Minimum 3 seconds
    debugLog('[BudgetWS] iOS wake recovery: using minimum 3s delay');
  }

  // Add jitter to prevent thundering herd
  const jitter = baseDelay * 0.2 * Math.random(); // ±10% jitter
  const delay = Math.min(baseDelay + jitter, state.maxReconnectDelay);

  logHistory(`reconnect_scheduled_delay=${Math.round(delay)}ms_attempt=${state.reconnectAttempts + 1}`);
  debugLog('[BudgetWS] Reconnecting in', Math.round(delay), 'ms (attempt', state.reconnectAttempts + 1, ')');

  const timeout = setTimeout(() => {
    updateState({
      reconnectTimeout: null,
      reconnectAttempts: state.reconnectAttempts + 1,
      useLongPolling: false // Reset to allow WebSocket retry
    });

    createConnection();
  }, delay);

  updateState({ reconnectTimeout: timeout });
}

/**
 * Force reconnection (close existing + immediate reconnect)
 * Original: budgetWSClient.js:907-934
 */
export async function forceReconnect(): Promise<void> {
  logHistory('force_reconnect_start');

  closeExistingConnection();

  updateState({
    reconnectAttempts: 0,
    reconnecting: false
  });

  // Small delay to ensure cleanup
  await new Promise(resolve => setTimeout(resolve, 100));

  await connect();
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Connect to WebSocket endpoint
 * Original: budgetWSClient.js:991-1037
 */
export async function connect(): Promise<void> {
  const state = getState();

  logHistory('connect_start');

  // Skip connection if offline mode is active
  if (isOfflineModeActive()) {
    logHistory('connect_skip_offline_mode');
    debugLog('[BudgetWS] Skipping connect - offline mode active');
    return;
  }

  if (!state.enabled) {
    logHistory('connect_skip_disabled');
    return;
  }

  if (state.isConnected) {
    logHistory('connect_skip_connected');
    return;
  }

  if (state.ws || state.pollingActive) {
    logHistory('connect_skip_active');
    return;
  }

  // Initialize multi-tab support (will be handled by multi-tab integration)
  // For now, just create connection directly
  // TODO: Integrate with multiTab/leaderElection

  logHistory('creating_connection');
  await createConnection();
}

/**
 * Disconnect from WebSocket
 */
export function disconnect(): void {
  const state = getState();

  if (state.ws) {
    state.ws.close();
    updateState({ ws: null, isConnected: false });
  }

  if (state.reconnectTimeout) {
    clearTimeout(state.reconnectTimeout);
    updateState({ reconnectTimeout: null });
  }
}

/**
 * Reconnect with exponential backoff
 */
export async function reconnect(): Promise<void> {
  const state = getState();

  if (state.reconnecting) {
    return;
  }

  updateState({ reconnecting: true });

  const delay = Math.min(
    state.baseReconnectDelay * Math.pow(2, state.reconnectAttempts),
    state.maxReconnectDelay
  );

  await new Promise(resolve => setTimeout(resolve, delay));

  updateState({
    reconnectAttempts: state.reconnectAttempts + 1,
    reconnecting: false,
  });

  await connect();
}

/**
 * Register event handler
 */
export function on(event: string, handler: (data: any) => void): void {
  const state = getState();
  const handlers = { ...state.handlers };

  if (!handlers[event]) {
    handlers[event] = [];
  }

  handlers[event].push(handler);
  updateState({ handlers });
}

/**
 * Unregister event handler
 */
export function off(event: string, handler: (data: any) => void): void {
  const state = getState();
  const handlers = { ...state.handlers };

  if (handlers[event]) {
    handlers[event] = handlers[event].filter(h => h !== handler);
  }

  updateState({ handlers });
}

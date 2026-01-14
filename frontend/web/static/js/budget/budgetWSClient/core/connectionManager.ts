/**
 * Connection Manager for WebSocket
 * Handles connect, disconnect, reconnect lifecycle
 *
 * Extracted from budgetWSClient.js:852-986 (CONNECTION MANAGEMENT)
 */

import { getState, updateState } from './WSState';

/**
 * Connect to WebSocket server
 */
export async function connect(): Promise<void> {
  const state = getState();

  if (!state.enabled) {
    return;
  }

  if (state.reconnecting) {
    return; // Already reconnecting
  }

  // Get token and create WebSocket URL
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/api/v1/budget/ws?token=TOKEN_HERE`;

  try {
    const ws = new WebSocket(wsUrl);

    ws.onopen = handleOpen;
    ws.onclose = handleClose;
    ws.onerror = handleError;
    ws.onmessage = handleMessage;

    updateState({ ws });
  } catch (error) {
    handleError(new Event('error'));
  }
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
 * Handle WebSocket open event
 */
function handleOpen(): void {
  updateState({
    isConnected: true,
    reconnectAttempts: 0,
  });
}

/**
 * Handle WebSocket close event
 */
function handleClose(_event: CloseEvent): void {
  const state = getState();

  updateState({
    isConnected: false,
    ws: null,
  });

  // Reconnect if enabled
  if (state.enabled && state.reconnectAttempts < state.maxReconnectAttempts) {
    reconnect();
  }
}

/**
 * Handle WebSocket error event
 */
function handleError(_event: Event): void {
  updateState({ lastError: new Error('WebSocket error') });
}

/**
 * Handle WebSocket message event
 */
function handleMessage(event: MessageEvent): void {
  try {
    const message = JSON.parse(event.data);
    const { event: eventType, data } = message;

    // Notify handlers
    const state = getState();
    const handlers = state.handlers[eventType] || [];
    handlers.forEach(handler => handler(data));
  } catch (error) {
    // Ignore parse errors
  }
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

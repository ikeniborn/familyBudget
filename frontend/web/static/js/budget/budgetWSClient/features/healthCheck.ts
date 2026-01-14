/**
 * Health Check Module
 * Implements ping/pong health check and pong timeout enforcement
 *
 * Extracted from budgetWSClient.js:143-150 + pong timeout logic
 */

import { getState, updateState } from '../core/WSState';
import { on, off } from '../integration/eventRegistration';
import { sendMessage } from '../core/connectionManager';

/**
 * Start client ping interval
 * Sends periodic pings to keep connection alive
 */
export function startClientPing(): void {
  const state = getState();

  if (state.pingInterval) {
    clearInterval(state.pingInterval);
  }

  const interval = setInterval(() => {
    sendClientPing();
  }, state.CLIENT_PING_INTERVAL);

  updateState({ pingInterval: interval });
}

/**
 * Stop client ping interval
 */
export function stopClientPing(): void {
  const state = getState();

  if (state.pingInterval) {
    clearInterval(state.pingInterval);
    updateState({ pingInterval: null });
  }
}

/**
 * Send client ping to server
 */
export function sendClientPing(): void {
  const state = getState();

  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    return;
  }

  try {
    // Record ping timestamp for RTT measurement
    updateState({ pingTimestamp: Date.now() });

    state.ws.send(JSON.stringify({ type: 'ping' }));

    // Start pong timeout (Layer 4: Force close if no pong in PONG_TIMEOUT)
    startPongTimeout();
  } catch (e) {
    console.error('[BudgetWS] Failed to send ping:', e);
  }
}

/**
 * Start pong timeout timer
 */
export function startPongTimeout(): void {
  const state = getState();

  if (state.pongTimeoutTimer) {
    clearTimeout(state.pongTimeoutTimer);
  }

  const timer = setTimeout(() => {
    // Pong timeout, force close connection
    console.warn('[BudgetWS] Pong timeout, forcing reconnect');
    const event = new CustomEvent('ws:pong-timeout');
    window.dispatchEvent(event);
  }, state.PONG_TIMEOUT);

  updateState({ pongTimeoutTimer: timer });
}

/**
 * Clear pong timeout timer
 */
export function clearPongTimeout(): void {
  const state = getState();

  if (state.pongTimeoutTimer) {
    clearTimeout(state.pongTimeoutTimer);
    updateState({ pongTimeoutTimer: null });
  }
}

/**
 * Handle pong received from server
 */
export function handlePongReceived(): void {
  const state = getState();
  const rtt = state.pingTimestamp ? Date.now() - state.pingTimestamp : 0;

  // Clear pong timeout
  clearPongTimeout();

  // Record RTT
  const event = new CustomEvent('ws:rtt-measured', {
    detail: { rtt },
  });
  window.dispatchEvent(event);

  // Update last server ping timestamp
  updateState({ lastServerPing: Date.now() });
}

/**
 * Check if connection is alive
 */
export function isConnectionAlive(): boolean {
  const state = getState();

  // No WebSocket
  if (!state.ws) {
    return false;
  }

  // WebSocket not in OPEN state
  if (state.ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  // No server ping received yet
  if (!state.lastServerPing) {
    return true; // Assume alive on new connection
  }

  // Check if last ping was recent
  const timeSinceLastPing = Date.now() - state.lastServerPing;
  return timeSinceLastPing < state.PING_TIMEOUT;
}

/**
 * Request check_online from server with timeout
 * Returns true if server responds with online=true within 5 seconds
 *
 * Original: budgetWSClient.js:1424-1456
 */
export async function checkOnline(): Promise<boolean> {
  const state = getState();

  // Strategy 1: WebSocket check (if connection is open)
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        off('online_status', handleResponse);
        resolve(false);
      }, 5000);

      function handleResponse(data: any) {
        clearTimeout(timeout);
        off('online_status', handleResponse);
        resolve(data.online === true);
      }

      on('online_status', handleResponse);
      sendMessage({ type: 'check_online' });
    });
  }

  // Strategy 2: HTTP fallback check
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('/api/v1/budget/ws/status', {
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (e) {
    return false;
  }
}

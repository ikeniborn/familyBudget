/**
 * Wake Recovery Module
 * Handles iOS/Safari wake from sleep detection and connection recovery
 *
 * Extracted from budgetWSClient.js:143-220 (WAKE RECOVERY ENHANCEMENTS)
 */

import { getState, updateState } from '../core/WSState';

/**
 * Initialize wake recovery listeners
 */
export function initWakeRecovery(): void {
  // Service Worker wake detection (backup mechanism)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'PAGE_WAKE') {
        const state = getState();
        if (state.isLeader && document.visibilityState === 'visible') {
          performWakeHealthCheck();
        }
      }
    });
  }

  // Close connection on page unload
  window.addEventListener('beforeunload', () => {
    silentClose();
  });

  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      silentClose();
    }
  });

  // Visibility change handler
  document.addEventListener('visibilitychange', () => {
    handleVisibilityChange();
  });
}

/**
 * Handle visibility change (tab hidden/visible)
 */
function handleVisibilityChange(): void {
  const state = getState();

  if (document.visibilityState === 'hidden') {
    if (state.isLeader) {
      // Tab hidden, leader keeping connection active
    }
  } else if (document.visibilityState === 'visible') {
    // iOS: debounce rapid visibility changes after wake from sleep
    if (state.iosDeviceMode) {
      const now = Date.now();
      if (now - state.lastVisibilityChange < 2000) {
        // Debouncing visibility change
        return;
      }
      updateState({ lastVisibilityChange: now });
    }

    // Notify Service Worker about page wake
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        action: 'pageWake',
        timestamp: Date.now(),
      });
    }

    // Enhanced Visibility API Recovery
    if (state.isLeader) {
      performWakeHealthCheck();
    }

    // Followers: request status from leader
    if (!state.isLeader && state.channel) {
      state.channel.postMessage({ type: 'status_request' });
    }
  }
}

/**
 * Perform wake health check
 * Aggressively checks connection health after wake from sleep
 */
export function performWakeHealthCheck(): void {
  const state = getState();

  // Check if connection is stale
  if (isConnectionStale()) {
    // Connection stale, force reconnect
    const event = new CustomEvent('ws:wake-reconnect');
    window.dispatchEvent(event);
  } else if (state.isConnected && state.ws && state.ws.readyState === WebSocket.OPEN) {
    // Connection looks good, send ping to verify
    sendClientPing();
  }
}

/**
 * Check if connection is stale
 */
function isConnectionStale(): boolean {
  const state = getState();

  // Check if WebSocket exists but is not in OPEN state
  if (state.ws && state.ws.readyState !== WebSocket.OPEN) {
    return true;
  }

  // Check if we haven't received a server ping in PING_TIMEOUT
  if (!state.lastServerPing) {
    return false;
  }

  const timeSinceLastPing = Date.now() - state.lastServerPing;
  return timeSinceLastPing > state.PING_TIMEOUT;
}

/**
 * Send client ping to server
 */
function sendClientPing(): void {
  const state = getState();
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    try {
      state.ws.send(JSON.stringify({ type: 'ping' }));
    } catch (e) {
      console.error('[BudgetWS] Failed to send ping:', e);
    }
  }
}

/**
 * Silent close (for page unload)
 */
function silentClose(): void {
  const event = new CustomEvent('ws:silent-close');
  window.dispatchEvent(event);
}

/**
 * Start health check interval
 */
export function startHealthCheckInterval(): void {
  const state = getState();

  if (state.healthCheckInterval) {
    clearInterval(state.healthCheckInterval);
  }

  const interval = setInterval(() => {
    if (document.visibilityState === 'visible' && state.isLeader) {
      performWakeHealthCheck();
    }
  }, state.HEALTH_CHECK_INTERVAL);

  updateState({ healthCheckInterval: interval });
}

/**
 * Stop health check interval
 */
export function stopHealthCheckInterval(): void {
  const state = getState();

  if (state.healthCheckInterval) {
    clearInterval(state.healthCheckInterval);
    updateState({ healthCheckInterval: null });
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

/**
 * WebSocket Adapter
 * Manages WebSocket connection during offline/online transitions
 *
 * Extracted from offlineManager.js:1779-1806
 */

import { getState, updateState } from '../core/OfflineState';

/**
 * Initialize WebSocket client
 * Connects to budgetWSClient if available
 *
 * @param options - Initialization options
 * @param options.autoConnect - Automatically connect after init (default: true)
 */
export function initWS(options?: { autoConnect?: boolean }): void {
  // Check if budgetWSClient is available globally
  if (typeof window !== 'undefined' && (window as any).budgetWSClient) {
    const wsClient = (window as any).budgetWSClient;

    // Store reference in state
    updateState({ wsClient });

    // Auto-connect unless explicitly disabled
    if (options?.autoConnect !== false) {
      wsClient.connect();
    }
  }
}

/**
 * Disconnect WebSocket
 * Disables reconnection attempts to prevent connection spam during offline
 */
export function disconnectWS(): void {
  const state = getState();

  if (!state.wsClient) {
    return; // No WebSocket client available
  }

  // Disable reconnection attempts
  // budgetWSClient.setEnabled(false) stops automatic reconnects
  if (typeof state.wsClient.setEnabled === 'function') {
    state.wsClient.setEnabled(false);
  }
}

/**
 * Reconnect WebSocket
 * Enables reconnection attempts when network recovers
 */
export function reconnectWS(): void {
  const state = getState();

  if (!state.wsClient) {
    return; // No WebSocket client available
  }

  // Enable reconnection attempts
  // budgetWSClient.setEnabled(true) allows automatic reconnects
  if (typeof state.wsClient.setEnabled === 'function') {
    state.wsClient.setEnabled(true);
  }
}

/**
 * Get WebSocket connection status
 *
 * @returns Connection status string ('connected', 'disconnected', 'connecting', etc.)
 */
export function getWSStatus(): string {
  const state = getState();

  if (!state.wsClient) {
    return 'unavailable'; // WebSocket client not initialized
  }

  // Get status from budgetWSClient
  if (typeof state.wsClient.getStatus === 'function') {
    return state.wsClient.getStatus();
  }

  // Fallback: check if connected via readyState
  if (state.wsClient.ws) {
    const readyState = state.wsClient.ws.readyState;
    switch (readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  }

  return 'unknown';
}

/**
 * Check if WebSocket is connected
 *
 * @returns true if WebSocket is connected, false otherwise
 */
export function isWSConnected(): boolean {
  const status = getWSStatus();
  return status === 'connected';
}

/**
 * Send message via WebSocket
 * Safe wrapper that checks connection before sending
 *
 * @param message - Message to send (will be JSON stringified)
 * @returns true if sent successfully, false if not connected
 */
export function sendWSMessage(message: any): boolean {
  const state = getState();

  if (!state.wsClient) {
    return false; // No WebSocket client
  }

  if (!isWSConnected()) {
    return false; // Not connected
  }

  // Send via budgetWSClient
  if (typeof state.wsClient.send === 'function') {
    try {
      state.wsClient.send(message);
      return true;
    } catch (error) {
      return false;
    }
  }

  return false;
}

/**
 * Global type declarations for window.budgetWSClient
 * Using 'any' to avoid conflicts with existing declarations
 */
declare global {
  interface Window {
    budgetWSClient?: any;
  }
}

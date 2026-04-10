/**
 * Long Polling Fallback Module
 * Implements HTTP long polling when WebSocket is unavailable
 *
 * Extracted from budgetWSClient.js:1452-1595 (LONG POLLING FALLBACK)
 */

import { getState, updateState } from '../core/WSState';
import type { PollResponse } from '../types/events';

/**
 * Start long polling
 */
export function startLongPolling(): void {
  const state = getState();

  if (state.pollingActive) {
    return;
  }

  // Skip if offline mode is active
  if (isOfflineModeActive()) {
    return;
  }

  // Quick check: don't start polling if browser says offline
  if (!navigator.onLine) {
    return;
  }

  updateState({
    pollingActive: true,
    // isConnected stays as-is until the first successful poll confirms reachability
    lastEventTimestamp: Date.now() / 1000,
  });

  pollLoop();
}

/**
 * Long polling loop
 */
async function pollLoop(): Promise<void> {
  const state = getState();

  if (!state.enabled || !state.pollingActive) {
    stopLongPolling();
    return;
  }

  // Stop polling if offline mode became active
  if (isOfflineModeActive()) {
    stopLongPolling();
    return;
  }

  const controller = new AbortController();
  updateState({ pollController: controller });

  try {
    const url = `/api/v1/budget/poll?since=${state.lastEventTimestamp}&timeout=${state.POLL_TIMEOUT}`;
    const response = await fetch(url, {
      credentials: 'include',
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Not authenticated
        stopLongPolling();
        updateState({
          enabled: false,
          isConnected: false,
        });
        const errorEvent = new CustomEvent('ws:auth-error', {
          detail: { message: 'Poll 401: Not authenticated' },
        });
        window.dispatchEvent(errorEvent);
        return;
      }
      // 5xx or other server errors: mark as disconnected so the indicator shows error state
      updateState({ isConnected: false });
      const statusEvent = new CustomEvent('ws:status-changed', {
        detail: { isConnected: false },
      });
      window.dispatchEvent(statusEvent);
      throw new Error(`HTTP ${response.status}`);
    }

    const data: PollResponse = await response.json();
    const currentState = getState();
    updateState({ lastServerPing: Date.now() });

    // First successful poll: mark as connected and notify handlers
    if (!currentState.isConnected) {
      updateState({ isConnected: true });
      const connectedStatusEvent = new CustomEvent('ws:status-changed', {
        detail: { isConnected: true },
      });
      window.dispatchEvent(connectedStatusEvent);
      const connectEvent = new CustomEvent('ws:connected', {
        detail: { mode: 'polling' },
      });
      window.dispatchEvent(connectEvent);
    }

    // Process events
    if (data.events && data.events.length > 0) {
      for (const event of data.events) {
        const messageEvent = new CustomEvent('ws:message', {
          detail: event,
        });
        window.dispatchEvent(messageEvent);
      }
    }

    // Update timestamp
    if (data.server_time) {
      updateState({ lastEventTimestamp: data.server_time });
    }

    // Reset retry count on successful poll
    updateState({
      pollRetryCount: 0,
      consecutive503Count: 0,
    });

    // Schedule next poll
    const timeout = setTimeout(() => pollLoop(), 100);
    updateState({ pollTimeout: timeout });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      // Gracefully cancelled
      return;
    }

    // For HTTP 503 (server unavailable)
    if (error.message && error.message.includes('503')) {
      console.warn('[BudgetWS] Poll: server unavailable (503)');
      const currentState = getState();
      const consecutive503Count = currentState.consecutive503Count + 1;
      updateState({ consecutive503Count });

      if (consecutive503Count >= 3 && isOfflineModeActive()) {
        // Multiple 503 errors + offline mode active, stop polling
        stopLongPolling();
        const statusEvent = new CustomEvent('ws:status-changed', {
          detail: { isConnected: false },
        });
        window.dispatchEvent(statusEvent);
        return;
      }
    } else {
      const errorEvent = new CustomEvent('ws:poll-error', {
        detail: { message: `Poll: ${error.message}` },
      });
      window.dispatchEvent(errorEvent);
    }

    // Exponential backoff with jitter
    const currentState = getState();
    const pollRetryCount = currentState.pollRetryCount + 1;
    updateState({ pollRetryCount });

    if (pollRetryCount <= currentState.MAX_POLL_RETRIES) {
      const baseDelay = currentState.BASE_POLL_RETRY_DELAY * Math.pow(2, pollRetryCount - 1);
      const jitter = baseDelay * 0.2 * Math.random(); // ±10% jitter
      const delay = Math.min(baseDelay + jitter, 30000); // max 30s

      const timeout = setTimeout(() => pollLoop(), delay);
      updateState({ pollTimeout: timeout });
    } else {
      // Max retries reached
      updateState({ pollingActive: false });
      const errorEvent = new CustomEvent('ws:poll-error', {
        detail: { message: 'Poll max retries' },
      });
      window.dispatchEvent(errorEvent);
      const statusEvent = new CustomEvent('ws:status-changed', {
        detail: { isConnected: false },
      });
      window.dispatchEvent(statusEvent);
    }
  }
}

/**
 * Stop long polling
 */
export function stopLongPolling(): void {
  const state = getState();

  if (state.pollController) {
    state.pollController.abort();
    updateState({ pollController: null });
  }

  if (state.pollTimeout) {
    clearTimeout(state.pollTimeout);
    updateState({ pollTimeout: null });
  }

  updateState({ pollingActive: false });
}

/**
 * Check if offline mode is active
 */
function isOfflineModeActive(): boolean {
  // Check if offline manager exists and is in offline mode
  if (typeof window !== 'undefined' && (window as any).offlineManager) {
    const offlineManager = (window as any).offlineManager;
    return offlineManager.networkDetector?.autoOfflineMode === true;
  }
  return false;
}

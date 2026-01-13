/**
 * Leader Election Module
 * Handles Web Locks API-based leader election for multi-tab WebSocket coordination
 *
 * Extracted from budgetWSClient.js:468-670 (MULTI-TAB SUPPORT)
 */

import { getState, updateState } from '../core/WSState';

/**
 * Check if browser supports multi-tab features
 */
export function supportsMultiTab(): boolean {
  return (
    typeof BroadcastChannel !== 'undefined' &&
    typeof navigator.locks !== 'undefined'
  );
}

/**
 * Initialize multi-tab support
 * Handles Safari iOS quirks and Web Locks API
 */
export async function initMultiTab(): Promise<void> {
  const state = getState();

  if (state.multiTabInitialized) {
    return;
  }

  updateState({ multiTabInitialized: true });

  // Safari iOS: Skip Web Locks entirely (single tab connection)
  if (state.iosDeviceMode) {
    updateState({
      isLeader: true,
      multiTabSupported: false,
    });
    return;
  }

  if (!supportsMultiTab()) {
    updateState({ multiTabSupported: false });
    return;
  }

  // Safety timeout for Web Locks (5s fallback)
  let safetyTimeoutFired = false;
  const safetyTimeout = setTimeout(() => {
    safetyTimeoutFired = true;
    const currentState = getState();
    if (!currentState.isLeader && !currentState.isConnected) {
      console.warn('[BudgetWS] Safety timeout (5s): forcing leader status');
      updateState({
        isLeader: true,
        multiTabSupported: false,
      });
      if (currentState.enabled) {
        // Trigger connection creation (will be handled by connectionManager)
        const event = new CustomEvent('ws:force-leader');
        window.dispatchEvent(event);
      }
    }
  }, 5000);

  try {
    // Create BroadcastChannel
    const channel = new BroadcastChannel('budget-ws-channel');
    channel.onmessage = (e) => {
      const event = new CustomEvent('ws:channel-message', { detail: e.data });
      window.dispatchEvent(event);
    };
    updateState({ channel });

    // Check connection pressure
    let connectionPressure = 0;
    try {
      const status = await checkConnectionLimit();
      if (status.limits && status.limits.max_per_user > 0) {
        connectionPressure = (status.user_connections || 0) / status.limits.max_per_user;
        updateState({ approachingLimit: connectionPressure >= 0.7 });
      }
    } catch (e) {
      // Connection limit check failed, continue anyway
    }

    if (safetyTimeoutFired) {
      return;
    }

    // Leader election based on browser type
    if (needsLongerTimeout()) {
      const timeout = connectionPressure >= 0.5 ? 2000 : 500;
      await tryBecomeLeaderWithTimeout(timeout);
    } else {
      await tryBecomeLeader();
    }
  } catch (e) {
    console.error('[BudgetWS] Multi-tab init failed:', e);
    updateState({ multiTabSupported: false });
  } finally {
    clearTimeout(safetyTimeout);
  }
}

/**
 * Try to acquire leader lock (fast path for Chrome/Firefox/Edge)
 */
export async function tryBecomeLeader(): Promise<void> {
  if (!navigator.locks) {
    // Fallback: become leader immediately
    updateState({ isLeader: true });
    broadcastLeaderChanged();
    startLeaderHeartbeat();
    return;
  }

  return new Promise((resolve) => {
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        const state = getState();
        if (Date.now() - state.lastLeaderHeartbeat < 5000) {
          // Leader detected via heartbeat, start follower mode
          const event = new CustomEvent('ws:start-follower-mode');
          window.dispatchEvent(event);
        } else {
          // No leader detected, become leader
          updateState({ isLeader: true });
          broadcastLeaderChanged();
          startLeaderHeartbeat();
        }
        resolve();
      }
    }, 100);

    navigator.locks!.request('budget-ws-leader', async (_lock) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        const state = getState();
        if (state.followerCheckInterval) {
          clearInterval(state.followerCheckInterval);
        }
        updateState({
          isLeader: true,
          followerCheckInterval: null,
        });
        broadcastLeaderChanged();
        startLeaderHeartbeat();
      } else {
        const state = getState();
        if (!state.isLeader) {
          if (state.followerCheckInterval) {
            clearInterval(state.followerCheckInterval);
          }
          updateState({
            isLeader: true,
            followerCheckInterval: null,
          });
          broadcastLeaderChanged();
          startLeaderHeartbeat();
          if (state.enabled && !state.isConnected) {
            // Trigger connection creation
            const event = new CustomEvent('ws:leader-promoted');
            window.dispatchEvent(event);
          }
        }
      }
      resolve();
      return new Promise(() => {}); // Hold lock forever
    });
  });
}

/**
 * Try to acquire leader lock with configurable timeout (for Safari)
 */
export async function tryBecomeLeaderWithTimeout(timeoutMs: number): Promise<void> {
  if (!navigator.locks) {
    // Fallback: become leader immediately
    updateState({ isLeader: true });
    broadcastLeaderChanged();
    startLeaderHeartbeat();
    return;
  }

  return new Promise((resolve) => {
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        const state = getState();
        if (Date.now() - state.lastLeaderHeartbeat < 5000) {
          // Leader detected, stay follower
          const event = new CustomEvent('ws:start-follower-mode');
          window.dispatchEvent(event);
        } else {
          // No leader, become leader
          updateState({ isLeader: true });
          broadcastLeaderChanged();
          startLeaderHeartbeat();
        }
        resolve();
      }
    }, timeoutMs);

    navigator.locks!.request('budget-ws-leader', async (_lock) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        updateState({ isLeader: true });
        broadcastLeaderChanged();
        startLeaderHeartbeat();
      } else {
        const state = getState();
        if (!state.isLeader) {
          if (state.followerCheckInterval) {
            clearInterval(state.followerCheckInterval);
          }
          updateState({
            isLeader: true,
            followerCheckInterval: null,
          });
          broadcastLeaderChanged();
          startLeaderHeartbeat();
          if (state.enabled && !state.isConnected) {
            // Trigger connection creation
            const event = new CustomEvent('ws:leader-promoted');
            window.dispatchEvent(event);
          }
        }
      }
      resolve();
      return new Promise(() => {});
    });
  });
}

/**
 * Start leader heartbeat broadcast
 */
export function startLeaderHeartbeat(): void {
  const state = getState();
  if (state.leaderHeartbeatInterval) {
    clearInterval(state.leaderHeartbeatInterval);
  }

  const interval = setInterval(() => {
    broadcastHeartbeat();
  }, state.HEARTBEAT_INTERVAL);

  updateState({ leaderHeartbeatInterval: interval });
  broadcastHeartbeat(); // Send immediately
}

/**
 * Broadcast heartbeat message
 */
function broadcastHeartbeat(): void {
  const state = getState();
  broadcastMessage({
    type: 'heartbeat',
    timestamp: Date.now(),
    isConnected: state.isConnected,
  });
}

/**
 * Broadcast leader changed message
 */
function broadcastLeaderChanged(): void {
  broadcastMessage({
    type: 'leader_changed',
    timestamp: Date.now(),
  });
}

/**
 * Broadcast message to all tabs
 */
function broadcastMessage(message: any): void {
  const state = getState();
  if (state.channel) {
    try {
      state.channel.postMessage(message);
    } catch (e) {
      console.error('[BudgetWS] Broadcast failed:', e);
    }
  }
}

/**
 * Check connection limit from backend
 */
async function checkConnectionLimit(): Promise<any> {
  const response = await fetch('/api/v1/budget/ws/connection-status');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json();
}

/**
 * Check if browser needs longer timeout (Safari quirk)
 */
function needsLongerTimeout(): boolean {
  const state = getState();
  return state.browserInfo.isSafari || state.iosDeviceMode;
}

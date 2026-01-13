/**
 * Follower Sync Module
 * Handles follower tab behavior and leader failover
 *
 * Extracted from budgetWSClient.js:671-701 (follower mode)
 */

import { getState, updateState } from '../core/WSState';
import { startLeaderHeartbeat } from './leaderElection';

/**
 * Start follower mode
 * Monitors leader heartbeat and takes over if leader dies
 */
export function startFollowerMode(): void {
  const state = getState();
  updateState({ lastLeaderHeartbeat: Date.now() });

  // Clear existing interval if any
  if (state.followerCheckInterval) {
    clearInterval(state.followerCheckInterval);
  }

  const interval = setInterval(() => {
    const currentState = getState();

    if (currentState.isLeader) {
      // Became leader, stop follower mode
      clearInterval(interval);
      updateState({ followerCheckInterval: null });
      return;
    }

    const timeSinceHeartbeat = Date.now() - currentState.lastLeaderHeartbeat;
    if (timeSinceHeartbeat > currentState.LEADER_TIMEOUT) {
      // Leader timeout, take over
      clearInterval(interval);
      updateState({
        followerCheckInterval: null,
        isLeader: true,
      });

      // Broadcast leader change
      broadcastLeaderChanged();
      startLeaderHeartbeat();

      // Create connection as new leader
      if (currentState.enabled && !currentState.isConnected) {
        const event = new CustomEvent('ws:leader-takeover');
        window.dispatchEvent(event);
      }
    }
  }, 5000); // Check every 5 seconds

  updateState({ followerCheckInterval: interval });
}

/**
 * Stop follower mode (when becoming leader)
 */
export function stopFollowerMode(): void {
  const state = getState();
  if (state.followerCheckInterval) {
    clearInterval(state.followerCheckInterval);
    updateState({ followerCheckInterval: null });
  }
}

/**
 * Update connection status from leader heartbeat
 */
export function updateConnectionStatus(isConnected: boolean): void {
  const state = getState();
  if (!state.isLeader) {
    updateState({ isConnected });
    // Update UI indicator
    const event = new CustomEvent('ws:status-changed', { detail: { isConnected } });
    window.dispatchEvent(event);
  }
}

/**
 * Broadcast leader changed message
 */
function broadcastLeaderChanged(): void {
  const state = getState();
  if (state.channel) {
    try {
      state.channel.postMessage({
        type: 'leader_changed',
        timestamp: Date.now(),
      });
    } catch (e) {
      console.error('[BudgetWS] Broadcast failed:', e);
    }
  }
}

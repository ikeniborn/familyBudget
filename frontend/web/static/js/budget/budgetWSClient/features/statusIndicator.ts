/**
 * Status Indicator Module
 * Manages visual connection status badge
 *
 * Extracted from budgetWSClient.js:1938-2131 (sticky state + status indicator)
 */

import { getState, updateState } from '../core/WSState';
import { isSlowConnection } from './rttMeasurement';

/**
 * Update status indicator (visual badge)
 */
export function updateStatusIndicator(): void {
  const state = getState();

  // Determine new badge state
  let newState: string;

  if (!state.enabled) {
    newState = 'disabled';
  } else if (state.limitReached) {
    newState = 'limit_reached';
  } else if (!state.isConnected) {
    if (state.reconnectAttempts > 0) {
      newState = 'reconnecting';
    } else {
      newState = 'disconnected';
    }
  } else {
    // Connected
    if (!state.isLeader && state.multiTabSupported) {
      newState = 'connected_via_leader';
    } else if (isSlowConnection()) {
      newState = 'slow_connection';
    } else {
      newState = 'connected';
    }
  }

  // Check if state change is allowed (sticky state enforcement)
  if (!canChangeState(newState)) {
    return;
  }

  // Record state change
  recordStateChange(newState);

  // Update visual indicator
  applyIndicatorStyle(newState);
}

/**
 * Check if state change is allowed (sticky state enforcement)
 * Prevents rapid badge state transitions
 */
function canChangeState(newState: string): boolean {
  const state = getState();
  const now = Date.now();
  const timeSinceLastChange = now - state.lastStateChangeTime;

  // Exception 1: Allow immediate transition FROM error states TO connected
  const isRecovery =
    (state.currentBadgeState === 'error' ||
      state.currentBadgeState === 'limit_reached' ||
      state.currentBadgeState === 'reconnecting') &&
    (newState === 'connected' || newState === 'connected_via_leader');

  if (isRecovery) {
    return true;
  }

  // Exception 2: First state change (no previous state)
  if (!state.currentBadgeState) {
    return true;
  }

  // Enforce sticky state duration
  if (timeSinceLastChange < state.STICKY_STATE_DURATION) {
    return false;
  }

  return true;
}

/**
 * Record state change timestamp
 */
function recordStateChange(newState: string): void {
  updateState({
    currentBadgeState: newState,
    lastStateChangeTime: Date.now(),
  });
}

/**
 * Apply indicator style to DOM
 */
function applyIndicatorStyle(badgeState: string): void {
  const indicator = document.getElementById('ws-status-indicator');
  if (!indicator) {
    return;
  }

  // Remove all state classes
  indicator.classList.remove(
    'badge-success',
    'badge-error',
    'badge-warning',
    'badge-info',
    'badge-neutral'
  );

  // Apply new state
  switch (badgeState) {
    case 'connected':
      indicator.classList.add('badge-success');
      indicator.textContent = '●';
      indicator.title = 'Connected to real-time updates';
      break;

    case 'connected_via_leader':
      indicator.classList.add('badge-info');
      indicator.textContent = '●';
      indicator.title = 'Connected via leader tab';
      break;

    case 'slow_connection':
      const state = getState();
      indicator.classList.add('badge-warning');
      indicator.textContent = '◐';
      indicator.title = `Slow connection detected (${Math.round(state.rttRollingAverage)}ms RTT)`;
      break;

    case 'reconnecting':
      indicator.classList.add('badge-warning');
      indicator.textContent = '◌';
      indicator.title = 'Reconnecting...';
      break;

    case 'disconnected':
      indicator.classList.add('badge-error');
      indicator.textContent = '○';
      indicator.title = 'Disconnected';
      break;

    case 'limit_reached':
      indicator.classList.add('badge-error');
      indicator.textContent = '!';
      indicator.title = 'Connection limit reached';
      break;

    case 'disabled':
      indicator.classList.add('badge-neutral');
      indicator.textContent = '○';
      indicator.title = 'Real-time updates disabled';
      break;

    default:
      indicator.classList.add('badge-neutral');
      indicator.textContent = '?';
      indicator.title = 'Unknown status';
  }
}

/**
 * Get current badge state
 */
export function getCurrentBadgeState(): string | null {
  return getState().currentBadgeState;
}

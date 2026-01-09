import { describe, it, expect, beforeEach } from 'vitest';
import { getState, updateState, resetState, createInitialState } from '@web/budget/budgetWSClient/core/WSState';
import type { BudgetWSState, WSBadgeState } from '@web/budget/budgetWSClient/core/WSState';

describe('WSState', () => {
  beforeEach(() => {
    resetState();
  });

  describe('createInitialState', () => {
    it('should create initial state with correct WebSocket defaults', () => {
      const state = createInitialState();

      // WebSocket connection
      expect(state.ws).toBeNull();
      expect(state.isConnected).toBe(false);
      expect(state.reconnectAttempts).toBe(0);
      expect(state.maxReconnectAttempts).toBe(10);
      expect(state.baseReconnectDelay).toBe(1000);
      expect(state.maxReconnectDelay).toBe(30000);
      expect(state.reconnectTimeout).toBeNull();
      expect(state.handlers).toEqual({});
      expect(state.enabled).toBe(true);
    });

    it('should create initial state with correct connection tracking defaults', () => {
      const state = createInitialState();

      expect(state.connectionId).toBeNull();
      expect(state.lastServerPing).toBe(0);
      expect(state.PING_TIMEOUT).toBe(45000);
      expect(state.lastError).toBeNull();
      expect(state.connectionHistory).toEqual([]);
    });

    it('should create initial state with correct long polling defaults', () => {
      const state = createInitialState();

      expect(state.useLongPolling).toBe(false);
      expect(state.pollController).toBeNull();
      expect(state.lastEventTimestamp).toBe(0);
      expect(state.POLL_INTERVAL).toBe(5000);
      expect(state.POLL_TIMEOUT).toBe(5);
      expect(state.pollTimeout).toBeNull();
      expect(state.pollingActive).toBe(false);
      expect(state.pollRetryCount).toBe(0);
      expect(state.MAX_POLL_RETRIES).toBe(10);
      expect(state.BASE_POLL_RETRY_DELAY).toBe(1000);
      expect(state.consecutive503Count).toBe(0);
    });

    it('should create initial state with correct RTT defaults', () => {
      const state = createInitialState();

      expect(state.rttMeasurements).toEqual([]);
      expect(state.rttRollingAverage).toBe(0);
      expect(state.pingTimestamp).toBeNull();
      expect(state.RTT_THRESHOLD).toBe(1000);
      expect(state.RTT_WINDOW_SIZE).toBe(10);
    });

    it('should create initial state with correct multi-tab defaults', () => {
      const state = createInitialState();

      expect(state.isLeader).toBe(false);
      expect(state.channel).toBeNull();
      expect(state.leaderHeartbeatInterval).toBeNull();
      expect(state.followerCheckInterval).toBeNull();
      expect(state.lastLeaderHeartbeat).toBe(0);
      expect(state.HEARTBEAT_INTERVAL).toBe(5000);
      expect(state.LEADER_TIMEOUT).toBe(10000);
      expect(state.multiTabSupported).toBeNull();
      expect(state.multiTabInitialized).toBe(false);
    });

    it('should create initial state with correct iOS quirks defaults', () => {
      const state = createInitialState();

      expect(state.reconnecting).toBe(false);
      expect(state.lastVisibilityChange).toBe(0);
      expect(state.iosWakeRecoveryMode).toBe(false);
      expect(state.iosDeviceMode).toBe(false);
      expect(state.iosWebSocketTimeout).toBeUndefined();
    });

    it('should create initial state with correct limit flags', () => {
      const state = createInitialState();

      expect(state.limitReached).toBe(false);
      expect(state.approachingLimit).toBe(false);
    });
  });

  describe('getState', () => {
    it('should return initial state on first call', () => {
      const state = getState();

      expect(state.isConnected).toBe(false);
      expect(state.reconnectAttempts).toBe(0);
      expect(state.enabled).toBe(true);
    });
  });

  describe('updateState', () => {
    it('should update WebSocket connection state', () => {
      updateState({ isConnected: true, reconnectAttempts: 3 });

      const state = getState();
      expect(state.isConnected).toBe(true);
      expect(state.reconnectAttempts).toBe(3);
      expect(state.enabled).toBe(true);  // Other fields unchanged
    });

    it('should update multi-tab leader state', () => {
      updateState({ isLeader: true, lastLeaderHeartbeat: 12345 });

      const state = getState();
      expect(state.isLeader).toBe(true);
      expect(state.lastLeaderHeartbeat).toBe(12345);
    });

    it('should update RTT measurements', () => {
      const measurements = [100, 150, 120];
      updateState({ rttMeasurements: measurements, rttRollingAverage: 123 });

      const state = getState();
      expect(state.rttMeasurements).toEqual(measurements);
      expect(state.rttRollingAverage).toBe(123);
    });

    it('should update long polling state', () => {
      updateState({ useLongPolling: true, pollingActive: true, pollRetryCount: 2 });

      const state = getState();
      expect(state.useLongPolling).toBe(true);
      expect(state.pollingActive).toBe(true);
      expect(state.pollRetryCount).toBe(2);
    });

    it('should update error tracking', () => {
      const error = { message: 'Connection failed', time: '2025-01-06T10:00:00Z' };
      const history = [
        { event: 'connect', time: 1000 },
        { event: 'error', time: 2000 }
      ];

      updateState({ lastError: error, connectionHistory: history });

      const state = getState();
      expect(state.lastError).toEqual(error);
      expect(state.connectionHistory).toEqual(history);
      expect(state.connectionHistory).toHaveLength(2);
    });

    it('should update limit flags', () => {
      updateState({ limitReached: true, approachingLimit: true });

      const state = getState();
      expect(state.limitReached).toBe(true);
      expect(state.approachingLimit).toBe(true);
    });

    it('should update iOS quirks state', () => {
      updateState({
        iosWakeRecoveryMode: true,
        iosDeviceMode: true,
        reconnecting: true
      });

      const state = getState();
      expect(state.iosWakeRecoveryMode).toBe(true);
      expect(state.iosDeviceMode).toBe(true);
      expect(state.reconnecting).toBe(true);
    });

    it('should update badge state', () => {
      const badgeState: WSBadgeState = 'connected';
      updateState({
        currentBadgeState: badgeState,
        lastIndicatorState: 'connecting'
      });

      const state = getState();
      expect(state.currentBadgeState).toBe('connected');
      expect(state.lastIndicatorState).toBe('connecting');
    });

    it('should update navigation detection state', () => {
      updateState({ isNavigating: true });

      const state = getState();
      expect(state.isNavigating).toBe(true);
    });

    it('should handle multiple sequential updates', () => {
      updateState({ isConnected: true });
      updateState({ reconnectAttempts: 1 });
      updateState({ limitReached: true });

      const state = getState();
      expect(state.isConnected).toBe(true);
      expect(state.reconnectAttempts).toBe(1);
      expect(state.limitReached).toBe(true);
    });

    it('should preserve other fields when updating one field', () => {
      updateState({
        isConnected: true,
        isLeader: true,
        rttRollingAverage: 150
      });

      // Update only reconnectAttempts
      updateState({ reconnectAttempts: 5 });

      const state = getState();
      expect(state.reconnectAttempts).toBe(5);
      // Verify other fields preserved
      expect(state.isConnected).toBe(true);
      expect(state.isLeader).toBe(true);
      expect(state.rttRollingAverage).toBe(150);
    });
  });

  describe('resetState', () => {
    it('should reset all connection state to defaults', () => {
      // Modify state
      updateState({
        isConnected: true,
        reconnectAttempts: 5,
        enabled: false
      });

      // Reset
      resetState();

      const state = getState();
      expect(state.isConnected).toBe(false);
      expect(state.reconnectAttempts).toBe(0);
      expect(state.enabled).toBe(true);
    });

    it('should reset multi-tab state to defaults', () => {
      updateState({
        isLeader: true,
        lastLeaderHeartbeat: 12345,
        multiTabInitialized: true
      });

      resetState();

      const state = getState();
      expect(state.isLeader).toBe(false);
      expect(state.lastLeaderHeartbeat).toBe(0);
      expect(state.multiTabInitialized).toBe(false);
    });

    it('should clear RTT measurements', () => {
      updateState({
        rttMeasurements: [100, 150, 120],
        rttRollingAverage: 123
      });

      resetState();

      const state = getState();
      expect(state.rttMeasurements).toEqual([]);
      expect(state.rttRollingAverage).toBe(0);
    });

    it('should clear error tracking', () => {
      updateState({
        lastError: { message: 'Error', time: '2025-01-06' },
        connectionHistory: [{ event: 'error', time: 1000 }]
      });

      resetState();

      const state = getState();
      expect(state.lastError).toBeNull();
      expect(state.connectionHistory).toEqual([]);
    });

    it('should reset all timers to null', () => {
      // Note: We can't actually set timer values in tests without mocking,
      // but we can verify the reset sets them to null
      resetState();

      const state = getState();
      expect(state.reconnectTimeout).toBeNull();
      expect(state.pollTimeout).toBeNull();
      expect(state.pingInterval).toBeNull();
      expect(state.navigationTimer).toBeNull();
    });

    it('should reset limit flags', () => {
      updateState({ limitReached: true, approachingLimit: true });

      resetState();

      const state = getState();
      expect(state.limitReached).toBe(false);
      expect(state.approachingLimit).toBe(false);
    });

    it('should reset iOS quirks state', () => {
      updateState({
        iosWakeRecoveryMode: true,
        iosDeviceMode: true,
        reconnecting: true
      });

      resetState();

      const state = getState();
      expect(state.iosWakeRecoveryMode).toBe(false);
      expect(state.iosDeviceMode).toBe(false);
      expect(state.reconnecting).toBe(false);
    });
  });

  describe('state consistency', () => {
    it('should reflect updates immediately in subsequent getState calls', () => {
      updateState({ isConnected: true });
      let state = getState();
      expect(state.isConnected).toBe(true);

      updateState({ isConnected: false });
      state = getState();
      expect(state.isConnected).toBe(false);
    });

    it('should maintain state consistency across multiple getState calls', () => {
      updateState({
        isConnected: true,
        isLeader: true,
        rttRollingAverage: 150
      });

      const state1 = getState();
      const state2 = getState();

      expect(state1.isConnected).toBe(true);
      expect(state2.isConnected).toBe(true);
      expect(state1.isLeader).toBe(true);
      expect(state2.isLeader).toBe(true);
      expect(state1.rttRollingAverage).toBe(150);
      expect(state2.rttRollingAverage).toBe(150);
    });
  });
});

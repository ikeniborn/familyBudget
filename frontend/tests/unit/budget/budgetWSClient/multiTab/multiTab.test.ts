/**
 * Unit tests for Multi-Tab Synchronization
 *
 * Tests leader election, follower sync, and tab coordination
 * Phase 4: Multi-Tab Synchronization (Verification)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as WSState from '@web/budget/budgetWSClient/core/WSState';
import {
  supportsMultiTab,
  initMultiTab,
  tryBecomeLeader,
  tryBecomeLeaderWithTimeout,
  startLeaderHeartbeat,
} from '@web/budget/budgetWSClient/multiTab/leaderElection';
import {
  startFollowerMode,
  stopFollowerMode,
  updateConnectionStatus,
} from '@web/budget/budgetWSClient/multiTab/followerSync';
import {
  handleChannelMessage,
  broadcastWSEvent,
  requestStatus,
} from '@web/budget/budgetWSClient/multiTab/tabCoordination';

describe('Multi-Tab Synchronization', () => {
  let mockBroadcastChannel: any;
  let mockNavigatorLocks: any;

  beforeEach(() => {
    vi.useFakeTimers();

    // Reset state
    WSState.resetState();

    // Mock BroadcastChannel
    mockBroadcastChannel = {
      postMessage: vi.fn(),
      onmessage: null,
      close: vi.fn(),
    };

    (global.BroadcastChannel as any) = vi.fn(() => mockBroadcastChannel);

    // Mock navigator.locks
    mockNavigatorLocks = {
      request: vi.fn(),
    };

    Object.defineProperty(navigator, 'locks', {
      writable: true,
      configurable: true,
      value: mockNavigatorLocks,
    });

    // Mock fetch for connection limit check
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        limits: { max_per_user: 10 },
        user_connections: 2,
      }),
    }));

    // Mock window.dispatchEvent
    global.dispatchEvent = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete (navigator as any).locks;
  });

  describe('supportsMultiTab()', () => {
    it('should return true if BroadcastChannel and Web Locks are supported', () => {
      expect(supportsMultiTab()).toBe(true);
    });

    it('should return false if BroadcastChannel is not supported', () => {
      (global.BroadcastChannel as any) = undefined;

      expect(supportsMultiTab()).toBe(false);
    });

    it('should return false if Web Locks API is not supported', () => {
      // Set to undefined instead of delete (delete doesn't work properly in tests)
      Object.defineProperty(navigator, 'locks', {
        writable: true,
        configurable: true,
        value: undefined,
      });

      expect(supportsMultiTab()).toBe(false);
    });
  });

  describe('initMultiTab()', () => {
    it('should skip if already initialized', async () => {
      WSState.updateState({ multiTabInitialized: true });

      await initMultiTab();

      expect(BroadcastChannel).not.toHaveBeenCalled();
    });

    it('should use iOS device mode (single tab)', async () => {
      WSState.updateState({ iosDeviceMode: true });

      await initMultiTab();

      const state = WSState.getState();
      expect(state.isLeader).toBe(true);
      expect(state.multiTabSupported).toBe(false);
      expect(state.multiTabInitialized).toBe(true);
    });

    it('should detect unsupported multi-tab (no BroadcastChannel)', async () => {
      (global.BroadcastChannel as any) = undefined;

      await initMultiTab();

      const state = WSState.getState();
      expect(state.multiTabSupported).toBe(false);
    });

    it('should create BroadcastChannel when supported', async () => {
      mockNavigatorLocks.request.mockImplementation((name, callback) => {
        callback({});
        return Promise.resolve();
      });

      await initMultiTab();

      expect(BroadcastChannel).toHaveBeenCalledWith('budget-ws-channel');
      const state = WSState.getState();
      expect(state.channel).toBe(mockBroadcastChannel);
    });

    it('should trigger safety timeout after 5s', async () => {
      // Don't resolve locks request (simulate hanging)
      mockNavigatorLocks.request.mockImplementation(() => new Promise(() => {}));

      const promise = initMultiTab();

      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);
      await promise;

      const state = WSState.getState();
      expect(state.isLeader).toBe(true);
      expect(state.multiTabSupported).toBe(false);
    });

    it('should check connection limits before leader election', async () => {
      mockNavigatorLocks.request.mockImplementation((name, callback) => {
        callback({});
        return Promise.resolve();
      });

      await initMultiTab();

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/budget/ws/connection-status');
    });

    it('should set approachingLimit flag when connections >= 70%', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          limits: { max_per_user: 10 },
          user_connections: 8, // 80%
        }),
      }));

      mockNavigatorLocks.request.mockImplementation((name, callback) => {
        callback({});
        return Promise.resolve();
      });

      await initMultiTab();

      const state = WSState.getState();
      expect(state.approachingLimit).toBe(true);
    });
  });

  describe('tryBecomeLeader()', () => {
    it('should become leader immediately if no Web Locks API', async () => {
      WSState.updateState({ channel: mockBroadcastChannel });
      delete (navigator as any).locks;

      await tryBecomeLeader();

      const state = WSState.getState();
      expect(state.isLeader).toBe(true);
      expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'leader_changed',
        })
      );
    });

    it('should acquire lock and become leader', async () => {
      WSState.updateState({ channel: mockBroadcastChannel });

      // Simplify mock: call callback synchronously and return resolved promise
      mockNavigatorLocks.request.mockImplementation((name, callback) => {
        callback({});
        return Promise.resolve();
      });

      await tryBecomeLeader();

      const state = WSState.getState();
      expect(state.isLeader).toBe(true);
      expect(state.leaderHeartbeatInterval).toBeDefined();
    });

    it('should start follower mode if leader detected via heartbeat', async () => {
      WSState.updateState({
        channel: mockBroadcastChannel,
        lastLeaderHeartbeat: Date.now() - 1000, // Recent heartbeat
      });

      // Simulate lock request timeout (100ms)
      mockNavigatorLocks.request.mockImplementation(() => new Promise(() => {}));

      const promise = tryBecomeLeader();

      vi.advanceTimersByTime(100);
      await promise;

      expect(global.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ws:start-follower-mode',
        })
      );
    });

    it('should become leader if no recent heartbeat', async () => {
      WSState.updateState({
        channel: mockBroadcastChannel,
        lastLeaderHeartbeat: Date.now() - 10000, // Old heartbeat
      });

      mockNavigatorLocks.request.mockImplementation(() => new Promise(() => {}));

      const promise = tryBecomeLeader();

      vi.advanceTimersByTime(100);
      await promise;

      const state = WSState.getState();
      expect(state.isLeader).toBe(true);
    });
  });

  describe('tryBecomeLeaderWithTimeout()', () => {
    it('should use custom timeout for Safari', async () => {
      WSState.updateState({ channel: mockBroadcastChannel });

      mockNavigatorLocks.request.mockImplementation(() => new Promise(() => {}));

      const promise = tryBecomeLeaderWithTimeout(500);

      vi.advanceTimersByTime(500);
      await promise;

      const state = WSState.getState();
      expect(state.isLeader).toBe(true);
    });

    it('should stay follower if leader heartbeat detected', async () => {
      WSState.updateState({
        channel: mockBroadcastChannel,
        lastLeaderHeartbeat: Date.now() - 1000, // Recent heartbeat
      });

      mockNavigatorLocks.request.mockImplementation(() => new Promise(() => {}));

      const promise = tryBecomeLeaderWithTimeout(500);

      vi.advanceTimersByTime(500);
      await promise;

      expect(global.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ws:start-follower-mode',
        })
      );
    });
  });

  describe('startLeaderHeartbeat()', () => {
    it('should start heartbeat interval', () => {
      WSState.updateState({ channel: mockBroadcastChannel });

      startLeaderHeartbeat();

      const state = WSState.getState();
      expect(state.leaderHeartbeatInterval).toBeDefined();
    });

    it('should send immediate heartbeat', () => {
      WSState.updateState({ channel: mockBroadcastChannel });

      startLeaderHeartbeat();

      expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'heartbeat',
          timestamp: expect.any(Number),
        })
      );
    });

    it('should send heartbeat at HEARTBEAT_INTERVAL', () => {
      WSState.updateState({ channel: mockBroadcastChannel });

      startLeaderHeartbeat();

      mockBroadcastChannel.postMessage.mockClear();

      // Fast-forward to next heartbeat
      vi.advanceTimersByTime(WSState.getState().HEARTBEAT_INTERVAL);

      expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'heartbeat',
        })
      );
    });

    it('should clear existing interval before starting new one', () => {
      WSState.updateState({ channel: mockBroadcastChannel });

      startLeaderHeartbeat();
      const firstInterval = WSState.getState().leaderHeartbeatInterval;

      startLeaderHeartbeat();
      const secondInterval = WSState.getState().leaderHeartbeatInterval;

      expect(firstInterval).not.toBe(secondInterval);
    });
  });

  describe('Follower Sync', () => {
    describe('startFollowerMode()', () => {
      it('should start follower check interval', () => {
        startFollowerMode();

        const state = WSState.getState();
        expect(state.followerCheckInterval).toBeDefined();
        expect(state.lastLeaderHeartbeat).toBeGreaterThan(0);
      });

      it('should stop if becomes leader', () => {
        startFollowerMode();

        // Become leader
        WSState.updateState({ isLeader: true });

        // Fast-forward interval check
        vi.advanceTimersByTime(5000);

        const state = WSState.getState();
        expect(state.followerCheckInterval).toBeNull();
      });

      it('should take over as leader on timeout', () => {
        WSState.updateState({
          channel: mockBroadcastChannel,
          enabled: true,
          isConnected: false,
        });

        startFollowerMode();

        // Simulate leader timeout
        WSState.updateState({ lastLeaderHeartbeat: Date.now() - 20000 });

        vi.advanceTimersByTime(5000);

        const state = WSState.getState();
        expect(state.isLeader).toBe(true);
        expect(state.followerCheckInterval).toBeNull();
        expect(global.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'ws:leader-takeover',
          })
        );
      });

      it('should broadcast leader change on takeover', () => {
        WSState.updateState({ channel: mockBroadcastChannel });

        startFollowerMode();

        // Simulate leader timeout
        WSState.updateState({ lastLeaderHeartbeat: Date.now() - 20000 });

        vi.advanceTimersByTime(5000);

        expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'leader_changed',
          })
        );
      });
    });

    describe('stopFollowerMode()', () => {
      it('should clear follower check interval', () => {
        startFollowerMode();
        expect(WSState.getState().followerCheckInterval).not.toBeNull();

        stopFollowerMode();
        expect(WSState.getState().followerCheckInterval).toBeNull();
      });

      it('should not throw if no interval running', () => {
        expect(() => stopFollowerMode()).not.toThrow();
      });
    });

    describe('updateConnectionStatus()', () => {
      it('should update connection status for followers', () => {
        WSState.updateState({ isLeader: false });

        updateConnectionStatus(true);

        const state = WSState.getState();
        expect(state.isConnected).toBe(true);
      });

      it('should dispatch status changed event', () => {
        WSState.updateState({ isLeader: false });

        updateConnectionStatus(true);

        expect(global.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'ws:status-changed',
            detail: { isConnected: true },
          })
        );
      });

      it('should not update if leader', () => {
        WSState.updateState({ isLeader: true, isConnected: false });

        updateConnectionStatus(true);

        const state = WSState.getState();
        expect(state.isConnected).toBe(false);
      });
    });
  });

  describe('Tab Coordination', () => {
    describe('handleChannelMessage()', () => {
      it('should handle heartbeat message', () => {
        const message = {
          type: 'heartbeat' as const,
          timestamp: Date.now(),
          isConnected: true,
        };

        handleChannelMessage(message);

        const state = WSState.getState();
        expect(state.lastLeaderHeartbeat).toBe(message.timestamp);
      });

      it('should handle ws_event message', () => {
        WSState.updateState({ isLeader: false });

        const message = {
          type: 'ws_event' as const,
          event: 'fact_created',
          data: { id: 123 },
        };

        handleChannelMessage(message);

        expect(global.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'ws:event-received',
            detail: {
              event: 'fact_created',
              data: { id: 123 },
            },
          })
        );
      });

      it('should ignore ws_event if leader', () => {
        WSState.updateState({ isLeader: true });

        const message = {
          type: 'ws_event' as const,
          event: 'fact_created',
          data: { id: 123 },
        };

        handleChannelMessage(message);

        expect(global.dispatchEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'ws:event-received',
          })
        );
      });

      it('should handle leader_changed message', () => {
        const timestamp = Date.now();
        const message = {
          type: 'leader_changed' as const,
          timestamp,
        };

        handleChannelMessage(message);

        const state = WSState.getState();
        expect(state.lastLeaderHeartbeat).toBe(timestamp);
      });

      it('should respond to status_request if leader', () => {
        WSState.updateState({
          channel: mockBroadcastChannel,
          isLeader: true,
          isConnected: true,
          connectionId: 'conn-123',
        });

        const message = {
          type: 'status_request' as const,
        };

        handleChannelMessage(message);

        expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith({
          type: 'status_response',
          isConnected: true,
          connectionId: 'conn-123',
        });
      });

      it('should not respond to status_request if follower', () => {
        WSState.updateState({
          channel: mockBroadcastChannel,
          isLeader: false,
        });

        const message = {
          type: 'status_request' as const,
        };

        handleChannelMessage(message);

        expect(mockBroadcastChannel.postMessage).not.toHaveBeenCalled();
      });

      it('should handle status_response message', () => {
        WSState.updateState({ isLeader: false });

        const message = {
          type: 'status_response' as const,
          isConnected: true,
          connectionId: 'conn-456',
        };

        handleChannelMessage(message);

        const state = WSState.getState();
        expect(state.isConnected).toBe(true);
      });

      it('should warn on unknown message type', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const message = {
          type: 'unknown_type' as any,
        };

        handleChannelMessage(message);

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unknown channel message type'),
          'unknown_type'
        );

        consoleWarnSpy.mockRestore();
      });
    });

    describe('broadcastWSEvent()', () => {
      it('should broadcast event if leader', () => {
        WSState.updateState({
          channel: mockBroadcastChannel,
          isLeader: true,
        });

        broadcastWSEvent('fact_created', { id: 123 });

        expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith({
          type: 'ws_event',
          event: 'fact_created',
          data: { id: 123 },
        });
      });

      it('should not broadcast if follower', () => {
        WSState.updateState({
          channel: mockBroadcastChannel,
          isLeader: false,
        });

        broadcastWSEvent('fact_created', { id: 123 });

        expect(mockBroadcastChannel.postMessage).not.toHaveBeenCalled();
      });

      it('should not broadcast if no channel', () => {
        WSState.updateState({
          channel: null,
          isLeader: true,
        });

        expect(() => broadcastWSEvent('fact_created', { id: 123 })).not.toThrow();
      });
    });

    describe('requestStatus()', () => {
      it('should broadcast status request', () => {
        WSState.updateState({ channel: mockBroadcastChannel });

        requestStatus();

        expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith({
          type: 'status_request',
        });
      });

      it('should not throw if no channel', () => {
        WSState.updateState({ channel: null });

        expect(() => requestStatus()).not.toThrow();
      });
    });
  });

  describe('Error handling', () => {
    it('should handle broadcast errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockBroadcastChannel.postMessage.mockImplementation(() => {
        throw new Error('Broadcast error');
      });

      WSState.updateState({
        channel: mockBroadcastChannel,
        isLeader: true,
      });

      expect(() => broadcastWSEvent('fact_created', { id: 123 })).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle initMultiTab errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      (BroadcastChannel as any) = vi.fn(() => {
        throw new Error('BroadcastChannel error');
      });

      await initMultiTab();

      const state = WSState.getState();
      expect(state.multiTabSupported).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});

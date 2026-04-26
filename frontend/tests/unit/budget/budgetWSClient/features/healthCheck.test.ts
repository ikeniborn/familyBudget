/**
 * Unit tests for Health Check Module
 *
 * Tests ping/pong health check, pong timeout, and checkOnline()
 * Phase 3: Health Check & RTT
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startClientPing,
  stopClientPing,
  sendClientPing,
  startPongTimeout,
  clearPongTimeout,
  handlePongReceived,
  isConnectionAlive,
  checkOnline,
} from '@web/budget/budgetWSClient/features/healthCheck';
import * as WSState from '@web/budget/budgetWSClient/core/WSState';

describe('Health Check Module', () => {
  let mockWebSocket: any;

  beforeEach(() => {
    vi.useFakeTimers();

    // Reset state
    WSState.resetState();

    // Mock WebSocket
    mockWebSocket = {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
    };

    vi.stubGlobal('WebSocket', vi.fn(() => mockWebSocket));
    (global.WebSocket as any).OPEN = 1;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('startClientPing()', () => {
    it('should start ping interval', () => {
      WSState.updateState({ ws: mockWebSocket });

      startClientPing();

      const state = WSState.getState();
      expect(state.pingInterval).toBeDefined();
      expect(state.pingInterval).not.toBeNull();
    });

    it('should clear existing interval before starting new one', () => {
      WSState.updateState({ ws: mockWebSocket });

      startClientPing();
      const firstInterval = WSState.getState().pingInterval;

      startClientPing();
      const secondInterval = WSState.getState().pingInterval;

      expect(firstInterval).not.toBe(secondInterval);
    });

    it('should send ping at CLIENT_PING_INTERVAL', () => {
      WSState.updateState({ ws: mockWebSocket });

      startClientPing();

      // Fast-forward to just before first ping
      vi.advanceTimersByTime(WSState.getState().CLIENT_PING_INTERVAL - 1);
      expect(mockWebSocket.send).not.toHaveBeenCalled();

      // Fast-forward to first ping
      vi.advanceTimersByTime(1);
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }));
    });
  });

  describe('stopClientPing()', () => {
    it('should stop ping interval', () => {
      WSState.updateState({ ws: mockWebSocket });

      startClientPing();
      expect(WSState.getState().pingInterval).not.toBeNull();

      stopClientPing();
      expect(WSState.getState().pingInterval).toBeNull();
    });

    it('should not throw if no interval is running', () => {
      expect(() => stopClientPing()).not.toThrow();
    });
  });

  describe('sendClientPing()', () => {
    it('should send ping message', () => {
      WSState.updateState({ ws: mockWebSocket });

      sendClientPing();

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }));
    });

    it('should record ping timestamp', () => {
      WSState.updateState({ ws: mockWebSocket });
      const beforePing = Date.now();

      sendClientPing();

      const state = WSState.getState();
      expect(state.pingTimestamp).toBeGreaterThanOrEqual(beforePing);
    });

    it('should start pong timeout', () => {
      WSState.updateState({ ws: mockWebSocket });

      sendClientPing();

      const state = WSState.getState();
      expect(state.pongTimeoutTimer).toBeDefined();
      expect(state.pongTimeoutTimer).not.toBeNull();
    });

    it('should not send if WebSocket is not open', () => {
      mockWebSocket.readyState = 0; // CONNECTING
      WSState.updateState({ ws: mockWebSocket });

      sendClientPing();

      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    it('should not send if WebSocket is null', () => {
      WSState.updateState({ ws: null });

      sendClientPing();

      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });
  });

  describe('Pong timeout', () => {
    it('should dispatch ws:pong-timeout event if no pong received', () => {
      WSState.updateState({ ws: mockWebSocket });

      const timeoutSpy = vi.fn();
      window.addEventListener('ws:pong-timeout', timeoutSpy);

      sendClientPing();

      // Fast-forward to pong timeout
      vi.advanceTimersByTime(WSState.getState().PONG_TIMEOUT);

      expect(timeoutSpy).toHaveBeenCalled();

      window.removeEventListener('ws:pong-timeout', timeoutSpy);
    });

    it('should not dispatch timeout if pong received', () => {
      WSState.updateState({ ws: mockWebSocket });

      const timeoutSpy = vi.fn();
      window.addEventListener('ws:pong-timeout', timeoutSpy);

      sendClientPing();

      // Receive pong before timeout
      handlePongReceived();

      // Fast-forward past pong timeout
      vi.advanceTimersByTime(WSState.getState().PONG_TIMEOUT + 1000);

      expect(timeoutSpy).not.toHaveBeenCalled();

      window.removeEventListener('ws:pong-timeout', timeoutSpy);
    });
  });

  describe('handlePongReceived()', () => {
    it('should clear pong timeout', () => {
      WSState.updateState({ ws: mockWebSocket });

      sendClientPing();
      expect(WSState.getState().pongTimeoutTimer).not.toBeNull();

      handlePongReceived();
      expect(WSState.getState().pongTimeoutTimer).toBeNull();
    });

    it('should calculate RTT', () => {
      WSState.updateState({ ws: mockWebSocket });

      const rttSpy = vi.fn();
      window.addEventListener('ws:rtt-measured', rttSpy);

      sendClientPing();

      // Fast-forward 100ms
      vi.advanceTimersByTime(100);

      handlePongReceived();

      expect(rttSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            rtt: expect.any(Number),
          }),
        })
      );

      window.removeEventListener('ws:rtt-measured', rttSpy);
    });

    it('should update lastServerPing', () => {
      WSState.updateState({ ws: mockWebSocket });
      const beforePong = Date.now();

      handlePongReceived();

      const state = WSState.getState();
      expect(state.lastServerPing).toBeGreaterThanOrEqual(beforePong);
    });
  });

  describe('isConnectionAlive()', () => {
    it('should return false if no WebSocket', () => {
      WSState.updateState({ ws: null });

      expect(isConnectionAlive()).toBe(false);
    });

    it('should return false if WebSocket is not OPEN', () => {
      mockWebSocket.readyState = 0; // CONNECTING
      WSState.updateState({ ws: mockWebSocket });

      expect(isConnectionAlive()).toBe(false);
    });

    it('should return true on new connection (no lastServerPing)', () => {
      WSState.updateState({ ws: mockWebSocket, lastServerPing: null });

      expect(isConnectionAlive()).toBe(true);
    });

    it('should return true if last ping was recent', () => {
      const recentPing = Date.now() - 1000; // 1 second ago
      WSState.updateState({ ws: mockWebSocket, lastServerPing: recentPing });

      expect(isConnectionAlive()).toBe(true);
    });

    it('should return false if last ping exceeded PING_TIMEOUT', () => {
      const state = WSState.getState();
      const oldPing = Date.now() - state.PING_TIMEOUT - 1000;
      WSState.updateState({ ws: mockWebSocket, lastServerPing: oldPing });

      expect(isConnectionAlive()).toBe(false);
    });
  });

  describe('checkOnline() - WebSocket strategy', () => {
    it('should return true if server responds with online=true', async () => {
      WSState.updateState({ ws: mockWebSocket });

      // Import eventRegistration for test
      const { notifyHandlers } = await import('@web/budget/budgetWSClient/integration/eventRegistration');

      // Start checkOnline (returns promise)
      const resultPromise = checkOnline();

      // Simulate server response
      notifyHandlers('online_status', { online: true });

      const result = await resultPromise;
      expect(result).toBe(true);
    });

    it('should return false if server responds with online=false', async () => {
      WSState.updateState({ ws: mockWebSocket });

      const { notifyHandlers } = await import('@web/budget/budgetWSClient/integration/eventRegistration');

      const resultPromise = checkOnline();

      notifyHandlers('online_status', { online: false });

      const result = await resultPromise;
      expect(result).toBe(false);
    });

    it('should return false on timeout (5s)', async () => {
      WSState.updateState({ ws: mockWebSocket });

      const resultPromise = checkOnline();

      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

      const result = await resultPromise;
      expect(result).toBe(false);
    });

    it('should send check_online message', async () => {
      WSState.updateState({ ws: mockWebSocket });

      const resultPromise = checkOnline();

      // Verify message sent
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'check_online' })
      );

      // Cleanup
      vi.advanceTimersByTime(5000);
      await resultPromise;
    });

    it('should cleanup handler on timeout', async () => {
      WSState.updateState({ ws: mockWebSocket });

      const { getHandlers } = await import('@web/budget/budgetWSClient/integration/eventRegistration');

      const resultPromise = checkOnline();

      // Get handlers before timeout
      const handlersBefore = getHandlers('online_status') as any[];
      expect(handlersBefore.length).toBe(1);

      // Trigger timeout
      vi.advanceTimersByTime(5000);
      await resultPromise;

      // Verify handler removed
      const handlersAfter = getHandlers('online_status') as any[];
      expect(handlersAfter.length).toBe(0);
    });

    it('should cleanup handler on success', async () => {
      WSState.updateState({ ws: mockWebSocket });

      const { notifyHandlers, getHandlers } = await import('@web/budget/budgetWSClient/integration/eventRegistration');

      const resultPromise = checkOnline();

      // Respond immediately
      notifyHandlers('online_status', { online: true });

      await resultPromise;

      // Verify handler removed
      const handlersAfter = getHandlers('online_status') as any[];
      expect(handlersAfter.length).toBe(0);
    });
  });

  describe('checkOnline() - HTTP fallback strategy', () => {
    beforeEach(() => {
      // Reset fetch mock
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should use HTTP fallback if WebSocket is not open', async () => {
      mockWebSocket.readyState = 0; // CONNECTING
      WSState.updateState({ ws: mockWebSocket });

      (global.fetch as any).mockResolvedValue({ ok: true });

      const result = await checkOnline();

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/budget/ws/status',
        expect.objectContaining({
          credentials: 'include',
        })
      );
      expect(result).toBe(true);
    });

    it('should use HTTP fallback if WebSocket is null', async () => {
      WSState.updateState({ ws: null });

      (global.fetch as any).mockResolvedValue({ ok: true });

      const result = await checkOnline();

      expect(global.fetch).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return true if HTTP check succeeds', async () => {
      WSState.updateState({ ws: null });

      (global.fetch as any).mockResolvedValue({ ok: true });

      const result = await checkOnline();
      expect(result).toBe(true);
    });

    it('should return false if HTTP check fails', async () => {
      WSState.updateState({ ws: null });

      (global.fetch as any).mockResolvedValue({ ok: false });

      const result = await checkOnline();
      expect(result).toBe(false);
    });

    it('should return false on HTTP timeout', async () => {
      WSState.updateState({ ws: null });

      (global.fetch as any).mockRejectedValue(new Error('Timeout'));

      const result = await checkOnline();
      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      WSState.updateState({ ws: null });

      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await checkOnline();
      expect(result).toBe(false);
    });
  });
});

/**
 * Unit tests for Connection Manager
 *
 * Tests WebSocket connection lifecycle, token management, and reconnection logic
 * Phase 1: Core Connection Manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { connect, disconnect, forceReconnect, sendMessage } from '@web/budget/budgetWSClient/core/connectionManager';
import * as WSState from '@web/budget/budgetWSClient/core/WSState';

// Mock dependencies
vi.mock('@web/budget/budgetWSClient/fallback/longPolling', () => ({
  startLongPolling: vi.fn(),
  stopLongPolling: vi.fn(),
}));

vi.mock('@web/budget/budgetWSClient/features/healthCheck', () => ({
  handlePongReceived: vi.fn(),
}));

vi.mock('@web/budget/budgetWSClient/integration/eventHandlers', () => ({
  dispatchEvent: vi.fn(),
}));

vi.mock('@web/budget/budgetWSClient/multiTab/tabCoordination', () => ({
  broadcastWSEvent: vi.fn(),
}));

// Mock global debugLog
(global as any).debugLog = vi.fn();

describe('Connection Manager', () => {
  let mockWebSocket: any;
  let mockFetch: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Mock WebSocket
    mockWebSocket = {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
      readyState: 0,
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
    };

    vi.stubGlobal('WebSocket', vi.fn(() => mockWebSocket));
    // Add WebSocket constants
    (global.WebSocket as any).CONNECTING = 0;
    (global.WebSocket as any).OPEN = 1;
    (global.WebSocket as any).CLOSING = 2;
    (global.WebSocket as any).CLOSED = 3;

    // Mock fetch
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    // Reset WSState
    WSState.resetState();

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    (global as any).window = {
      location: {
        protocol: 'https:',
        host: 'localhost:8000',
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('Token Management (getWSToken)', () => {
    it('should fetch token successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ token: 'test-token-123' }),
      });

      // Enable WS and connect
      WSState.updateState({ enabled: true });
      const connectPromise = connect();

      // Wait for fetch to complete
      await vi.runAllTimersAsync();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/budget/ws/token', {
        method: 'POST',
        credentials: 'include',
      });

      await connectPromise;
    });

    it('should disable WebSocket on 401 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      });

      WSState.updateState({ enabled: true });
      await connect();
      await vi.runAllTimersAsync();

      const state = WSState.getState();
      expect(state.enabled).toBe(false);
      expect(state.lastError?.message).toContain('401');
    });

    it('should handle empty token response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ token: null }),
      });

      WSState.updateState({ enabled: true });
      await connect();
      await vi.runAllTimersAsync();

      const state = WSState.getState();
      expect(state.lastError?.message).toContain('Token empty');
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      WSState.updateState({ enabled: true });
      await connect();
      await vi.runAllTimersAsync();

      const state = WSState.getState();
      expect(state.lastError?.message).toContain('Network error');
    });
  });

  describe('Connection Creation', () => {
    it('should create WebSocket connection with valid token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ token: 'test-token-123' }),
      });

      WSState.updateState({ enabled: true });
      await connect();
      await vi.runAllTimersAsync();

      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('wss://localhost:8000/api/v1/budget/ws?token=test-token-123')
      );
    });

    it('should use ws:// protocol for http://', async () => {
      (global as any).window.location.protocol = 'http:';

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ token: 'test-token-123' }),
      });

      WSState.updateState({ enabled: true });
      await connect();
      await vi.runAllTimersAsync();

      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('ws://localhost:8000/api/v1/budget/ws?token=test-token-123')
      );
    });

    it('should skip connection if already connected', async () => {
      WSState.updateState({ enabled: true, isConnected: true });

      await connect();
      await vi.runAllTimersAsync();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(global.WebSocket).not.toHaveBeenCalled();
    });

    it('should skip connection if disabled', async () => {
      WSState.updateState({ enabled: false });

      await connect();
      await vi.runAllTimersAsync();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(global.WebSocket).not.toHaveBeenCalled();
    });

    it('should skip connection if navigator offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      WSState.updateState({ enabled: true });
      await connect();
      await vi.runAllTimersAsync();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(global.WebSocket).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage()', () => {
    it('should send message when connected', () => {
      // Create a proper WebSocket mock
      const ws = {
        readyState: 1, // OPEN
        send: vi.fn(),
        close: vi.fn(),
      };

      WSState.updateState({ ws: ws as any, isConnected: true });

      const message = { event: 'test', data: { foo: 'bar' } };
      const result = sendMessage(message);

      expect(result).toBe(true);
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should return false when not connected', () => {
      WSState.updateState({ ws: null, isConnected: false });

      const message = { event: 'test' };
      const result = sendMessage(message);

      expect(result).toBe(false);
    });

    it('should return false when WebSocket not OPEN', () => {
      mockWebSocket.readyState = 0; // CONNECTING
      WSState.updateState({ ws: mockWebSocket, isConnected: false });

      const message = { event: 'test' };
      const result = sendMessage(message);

      expect(result).toBe(false);
    });

    it('should handle send error gracefully', () => {
      const ws = {
        readyState: 1, // OPEN
        send: vi.fn(() => {
          throw new Error('Send failed');
        }),
        close: vi.fn(),
      };

      WSState.updateState({ ws: ws as any, isConnected: true });

      const message = { event: 'test' };
      const result = sendMessage(message);

      expect(result).toBe(false);
      const state = WSState.getState();
      expect(state.lastError).toBeDefined();
      expect(state.lastError).toHaveProperty('message');
      expect((state.lastError as any).message).toContain('Send failed');
    });
  });

  describe('disconnect()', () => {
    it('should close WebSocket connection', () => {
      WSState.updateState({ ws: mockWebSocket, isConnected: true });

      disconnect();

      expect(mockWebSocket.close).toHaveBeenCalled();
      const state = WSState.getState();
      expect(state.ws).toBeNull();
      expect(state.isConnected).toBe(false);
    });

    it('should clear reconnect timeout', () => {
      const timeoutId = setTimeout(() => {}, 5000);
      WSState.updateState({
        ws: mockWebSocket,
        reconnectTimeout: timeoutId as any,
      });

      disconnect();

      const state = WSState.getState();
      expect(state.reconnectTimeout).toBeNull();
    });

    it('should handle disconnect when not connected', () => {
      WSState.updateState({ ws: null, isConnected: false });

      expect(() => {
        disconnect();
      }).not.toThrow();
    });
  });

  describe('forceReconnect()', () => {
    it('should close existing connection and reconnect', async () => {
      WSState.updateState({
        ws: mockWebSocket,
        isConnected: true,
        reconnectAttempts: 5,
        enabled: true,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ token: 'test-token-123' }),
      });

      const reconnectPromise = forceReconnect();
      await vi.runAllTimersAsync();
      await reconnectPromise;

      expect(mockWebSocket.close).toHaveBeenCalled();
      const state = WSState.getState();
      expect(state.reconnectAttempts).toBe(0);
    });

    it('should reset reconnecting flag', async () => {
      WSState.updateState({
        reconnecting: true,
        enabled: true,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ token: 'test-token-123' }),
      });

      const reconnectPromise = forceReconnect();
      await vi.runAllTimersAsync();
      await reconnectPromise;

      const state = WSState.getState();
      expect(state.reconnecting).toBe(false);
    });
  });

  describe('Connection History (logHistory)', () => {
    it('should keep last 20 entries', async () => {
      WSState.updateState({ enabled: true });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ token: 'test-token-123' }),
      });

      // Generate many connection attempts to fill history
      for (let i = 0; i < 25; i++) {
        await connect();
        await vi.runAllTimersAsync();
        WSState.resetState();
        WSState.updateState({ enabled: true });
      }

      const state = WSState.getState();
      expect(state.connectionHistory.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Error Handling (setError)', () => {
    it('should set error message and timestamp', async () => {
      mockFetch.mockRejectedValue(new Error('Test error'));

      WSState.updateState({ enabled: true });
      await connect();
      await vi.runAllTimersAsync();

      const state = WSState.getState();
      expect(state.lastError).toBeDefined();
      expect(state.lastError?.message).toContain('Test error');
      expect(state.lastError?.time).toBeDefined();
    });

    it('should log error to connection history', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      WSState.updateState({ enabled: true });
      await connect();
      await vi.runAllTimersAsync();

      const state = WSState.getState();
      const errorEntry = state.connectionHistory.find((entry) =>
        entry.event.includes('error')
      );
      expect(errorEntry).toBeDefined();
    });
  });

});

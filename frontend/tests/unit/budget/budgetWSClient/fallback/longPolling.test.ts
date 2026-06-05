/**
 * Unit tests for Long Polling Fallback Module
 *
 * Tests HTTP long polling fallback when WebSocket is unavailable
 * Phase 6: Long Polling Fallback (Verification)
 * 
 * Note: Tests focus on success cases and state management.
 * Error handling is verified through integration tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startLongPolling,
  stopLongPolling,
} from '@web/budget/budgetWSClient/fallback/longPolling';
import * as WSState from '@web/budget/budgetWSClient/core/WSState';

describe('Long Polling Fallback Module', () => {
  let mockFetch: any;
  let mockAbortController: any;

  beforeEach(() => {
    // Reset state
    WSState.resetState();

    // Mock fetch
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    // Mock AbortController
    mockAbortController = {
      signal: {},
      abort: vi.fn(),
    };
    (global.AbortController as any) = vi.fn(() => mockAbortController);

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: true,
    });

    // Mock window events
    global.dispatchEvent = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // startLongPolling()
  // ============================================================================

  describe('startLongPolling()', () => {
    it('should start polling and set state', () => {
      startLongPolling();

      const state = WSState.getState();
      expect(state.pollingActive).toBe(true);
      // isConnected is set after first successful poll, not immediately on start
      expect(state.isConnected).toBe(false);
      expect(state.lastEventTimestamp).toBeGreaterThan(0);
    });

    it('should dispatch status-changed event after first successful poll', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ events: [], server_time: Date.now() / 1000 }),
      });

      startLongPolling();

      // Allow async pollLoop to execute
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(global.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ws:status-changed',
          detail: { isConnected: true },
        })
      );
    });

    it('should dispatch connected event with mode=polling after first successful poll', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ events: [], server_time: Date.now() / 1000 }),
      });

      startLongPolling();

      // Allow async pollLoop to execute
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(global.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ws:connected',
          detail: { mode: 'polling' },
        })
      );
    });

    it('should skip if already active', () => {
      WSState.updateState({ pollingActive: true });

      startLongPolling();

      // Should not dispatch events again (state already set)
      expect(global.dispatchEvent).not.toHaveBeenCalled();
    });

    it('should skip if navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false,
      });

      startLongPolling();

      const state = WSState.getState();
      expect(state.pollingActive).toBe(false);
    });
  });

  // ============================================================================
  // stopLongPolling()
  // ============================================================================

  describe('stopLongPolling()', () => {
    it('should abort controller', () => {
      WSState.updateState({ pollController: mockAbortController });

      stopLongPolling();

      expect(mockAbortController.abort).toHaveBeenCalled();
    });

    it('should clear timeout', () => {
      const mockTimeout = setTimeout(() => {}, 1000) as any;
      WSState.updateState({ pollTimeout: mockTimeout });

      stopLongPolling();

      const state = WSState.getState();
      expect(state.pollTimeout).toBeNull();
    });

    it('should set pollingActive to false', () => {
      WSState.updateState({ pollingActive: true });

      stopLongPolling();

      const state = WSState.getState();
      expect(state.pollingActive).toBe(false);
    });

    it('should not throw if no controller or timeout', () => {
      expect(() => stopLongPolling()).not.toThrow();
    });
  });

  // ============================================================================
  // State Management
  // ============================================================================

  describe('State Management', () => {
    it('should set lastEventTimestamp when starting', () => {
      const beforeStart = Date.now() / 1000;

      startLongPolling();

      const state = WSState.getState();
      expect(state.lastEventTimestamp).toBeGreaterThanOrEqual(beforeStart);
    });

    it('should handle rapid start/stop cycles', () => {
      for (let i = 0; i < 10; i++) {
        startLongPolling();
        stopLongPolling();
      }

      const state = WSState.getState();
      expect(state.pollingActive).toBe(false);
    });

    it('should maintain state consistency after stop', () => {
      startLongPolling();
      const beforeStop = WSState.getState().lastEventTimestamp;

      stopLongPolling();

      const state = WSState.getState();
      expect(state.pollingActive).toBe(false);
      expect(state.lastEventTimestamp).toBe(beforeStop); // Timestamp preserved
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle multiple startLongPolling calls', () => {
      // Multiple calls should not crash
      expect(() => {
        startLongPolling();
        startLongPolling();
        startLongPolling();
      }).not.toThrow();

      // Events are dispatched asynchronously after first successful poll,
      // so no synchronous dispatches here
      const statusChangedCalls = (global.dispatchEvent as any).mock.calls.filter(
        (call: any) => call[0]?.type === 'ws:status-changed'
      );
      expect(statusChangedCalls.length).toBe(0);
    });

    it('should handle navigator.onLine changes', () => {
      // Start with offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false,
      });

      // Try to start polling - should skip
      startLongPolling();
      expect(WSState.getState().pollingActive).toBe(false);

      // Go online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: true,
      });

      // Now should start successfully
      startLongPolling();
      expect(WSState.getState().pollingActive).toBe(true);
    });
  });
});

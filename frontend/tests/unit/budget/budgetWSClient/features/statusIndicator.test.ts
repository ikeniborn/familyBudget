/**
 * Unit tests for Status Indicator Module
 *
 * Tests visual connection status badge with sticky state enforcement
 * Phase 7: Status Indicator (Verification)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  updateStatusIndicator,
  getCurrentBadgeState,
} from '@web/budget/budgetWSClient/features/statusIndicator';
import * as WSState from '@web/budget/budgetWSClient/core/WSState';
import * as rttMeasurement from '@web/budget/budgetWSClient/features/rttMeasurement';

describe('Status Indicator Module', () => {
  let mockIndicator: HTMLElement;

  beforeEach(() => {
    // Reset state
    WSState.resetState();

    // Create mock indicator element
    mockIndicator = document.createElement('div');
    mockIndicator.id = 'ws-status-indicator';
    document.body.appendChild(mockIndicator);

    // Mock isSlowConnection
    vi.spyOn(rttMeasurement, 'isSlowConnection').mockReturnValue(false);

    // Set reasonable defaults
    WSState.updateState({
      enabled: true,
      isConnected: true,
      limitReached: false,
      reconnectAttempts: 0,
      isLeader: true,
      multiTabSupported: false,
      STICKY_STATE_DURATION: 500,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (mockIndicator && mockIndicator.parentNode) {
      mockIndicator.parentNode.removeChild(mockIndicator);
    }
  });

  // ============================================================================
  // Badge States
  // ============================================================================

  describe('Badge States', () => {
    it('should show "connected" state when connected as leader', () => {
      WSState.updateState({
        enabled: true,
        isConnected: true,
        isLeader: true,
      });

      updateStatusIndicator();

      expect(mockIndicator.classList.contains('badge-success')).toBe(true);
      expect(mockIndicator.textContent).toBe('●');
      expect(mockIndicator.title).toBe('Connected to real-time updates');
      expect(getCurrentBadgeState()).toBe('connected');
    });

    it('should show "connected_via_leader" state when follower', () => {
      WSState.updateState({
        enabled: true,
        isConnected: true,
        isLeader: false,
        multiTabSupported: true,
      });

      updateStatusIndicator();

      expect(mockIndicator.classList.contains('badge-info')).toBe(true);
      expect(mockIndicator.textContent).toBe('●');
      expect(mockIndicator.title).toBe('Connected via leader tab');
      expect(getCurrentBadgeState()).toBe('connected_via_leader');
    });

    it('should show "slow_connection" state when RTT high', () => {
      vi.mocked(rttMeasurement.isSlowConnection).mockReturnValue(true);
      WSState.updateState({
        enabled: true,
        isConnected: true,
        rttRollingAverage: 6500,
      });

      updateStatusIndicator();

      expect(mockIndicator.classList.contains('badge-warning')).toBe(true);
      expect(mockIndicator.textContent).toBe('◐');
      expect(mockIndicator.title).toContain('Slow connection');
      expect(mockIndicator.title).toContain('6500ms');
      expect(getCurrentBadgeState()).toBe('slow_connection');
    });

    it('should show "reconnecting" state when reconnecting', () => {
      WSState.updateState({
        enabled: true,
        isConnected: false,
        reconnectAttempts: 1,
      });

      updateStatusIndicator();

      expect(mockIndicator.classList.contains('badge-warning')).toBe(true);
      expect(mockIndicator.textContent).toBe('◌');
      expect(mockIndicator.title).toBe('Reconnecting...');
      expect(getCurrentBadgeState()).toBe('reconnecting');
    });

    it('should show "disconnected" state when not connected', () => {
      WSState.updateState({
        enabled: true,
        isConnected: false,
        reconnectAttempts: 0,
      });

      updateStatusIndicator();

      expect(mockIndicator.classList.contains('badge-error')).toBe(true);
      expect(mockIndicator.textContent).toBe('○');
      expect(mockIndicator.title).toBe('Disconnected');
      expect(getCurrentBadgeState()).toBe('disconnected');
    });

    it('should show "limit_reached" state when limit exceeded', () => {
      WSState.updateState({
        enabled: true,
        limitReached: true,
      });

      updateStatusIndicator();

      expect(mockIndicator.classList.contains('badge-error')).toBe(true);
      expect(mockIndicator.textContent).toBe('!');
      expect(mockIndicator.title).toBe('Connection limit reached');
      expect(getCurrentBadgeState()).toBe('limit_reached');
    });

    it('should show "disabled" state when not enabled', () => {
      WSState.updateState({
        enabled: false,
      });

      updateStatusIndicator();

      expect(mockIndicator.classList.contains('badge-neutral')).toBe(true);
      expect(mockIndicator.textContent).toBe('○');
      expect(mockIndicator.title).toBe('Real-time updates disabled');
      expect(getCurrentBadgeState()).toBe('disabled');
    });
  });

  // ============================================================================
  // Sticky State Enforcement
  // ============================================================================

  describe('Sticky State Enforcement', () => {
    it('should prevent rapid state changes within 500ms', () => {
      // First change: connected
      WSState.updateState({ isConnected: true, enabled: true });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('connected');

      // Immediate change to disconnected (should be blocked)
      WSState.updateState({ isConnected: false });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('connected'); // Still connected
    });

    it('should allow state change after 500ms', () => {
      vi.useFakeTimers();

      // First change
      WSState.updateState({ isConnected: true, enabled: true });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('connected');

      // Wait 500ms
      vi.advanceTimersByTime(500);

      // Now change should be allowed
      WSState.updateState({ isConnected: false, reconnectAttempts: 0 });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('disconnected');

      vi.useRealTimers();
    });

    it('should allow recovery transitions immediately (error → connected)', () => {
      // First: set to error state (limit_reached)
      WSState.updateState({ limitReached: true, enabled: true });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('limit_reached');

      // Immediate recovery to connected (should NOT be blocked)
      WSState.updateState({ limitReached: false, isConnected: true });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('connected');
    });

    it('should allow recovery transitions immediately (reconnecting → connected)', () => {
      // First: set to reconnecting
      WSState.updateState({ isConnected: false, reconnectAttempts: 1, enabled: true });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('reconnecting');

      // Immediate recovery (should NOT be blocked)
      WSState.updateState({ isConnected: true, reconnectAttempts: 0 });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('connected');
    });

    it('should allow first state change without delay', () => {
      // No previous state
      expect(getCurrentBadgeState()).toBeNull();

      // First change should be allowed
      WSState.updateState({ isConnected: true, enabled: true });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('connected');
    });
  });

  // ============================================================================
  // DOM Manipulation
  // ============================================================================

  describe('DOM Manipulation', () => {
    it('should remove all badge classes before applying new one', () => {
      mockIndicator.classList.add('badge-success', 'badge-error', 'badge-warning');

      WSState.updateState({ isConnected: false, reconnectAttempts: 0, enabled: true });
      updateStatusIndicator();

      // Only badge-error should remain
      expect(mockIndicator.classList.contains('badge-success')).toBe(false);
      expect(mockIndicator.classList.contains('badge-warning')).toBe(false);
      expect(mockIndicator.classList.contains('badge-error')).toBe(true);
    });

    it('should handle missing indicator element gracefully', () => {
      // Remove indicator
      mockIndicator.remove();

      // Should not crash
      expect(() => {
        WSState.updateState({ isConnected: true, enabled: true });
        updateStatusIndicator();
      }).not.toThrow();
    });

    it('should update all visual properties (class, text, title)', () => {
      WSState.updateState({ isConnected: true, enabled: true });
      updateStatusIndicator();

      expect(mockIndicator.classList.contains('badge-success')).toBe(true);
      expect(mockIndicator.textContent).toBe('●');
      expect(mockIndicator.title).toBeTruthy();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration Tests', () => {
    it('should integrate with isSlowConnection()', () => {
      // Normal connection
      vi.mocked(rttMeasurement.isSlowConnection).mockReturnValue(false);
      WSState.updateState({ isConnected: true, enabled: true });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('connected');

      // Wait for sticky state
      vi.useFakeTimers();
      vi.advanceTimersByTime(500);

      // Slow connection
      vi.mocked(rttMeasurement.isSlowConnection).mockReturnValue(true);
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('slow_connection');

      vi.useRealTimers();
    });

    it('should prioritize states correctly (limit > disconnected > slow)', () => {
      // limit_reached takes precedence
      WSState.updateState({
        enabled: true,
        limitReached: true,
        isConnected: false,
      });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('limit_reached');

      vi.useFakeTimers();
      vi.advanceTimersByTime(500);

      // disconnected takes precedence over connected
      WSState.updateState({ limitReached: false, isConnected: false, reconnectAttempts: 0 });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('disconnected');

      vi.useRealTimers();
    });

    it('should handle multi-tab mode correctly', () => {
      // Leader
      WSState.updateState({
        enabled: true,
        isConnected: true,
        isLeader: true,
        multiTabSupported: true,
      });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('connected');

      vi.useFakeTimers();
      vi.advanceTimersByTime(500);

      // Follower
      WSState.updateState({ isLeader: false });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('connected_via_leader');

      vi.useRealTimers();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle rapid updates with sticky state', () => {
      // First update
      WSState.updateState({ isConnected: true, enabled: true });
      updateStatusIndicator();
      const firstState = getCurrentBadgeState();

      // 10 rapid updates (all should be blocked)
      for (let i = 0; i < 10; i++) {
        WSState.updateState({ isConnected: i % 2 === 0 });
        updateStatusIndicator();
      }

      // State should not have changed
      expect(getCurrentBadgeState()).toBe(firstState);
    });

    it('should allow multiple recovery transitions in sequence', () => {
      // Error state
      WSState.updateState({ limitReached: true, enabled: true });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('limit_reached');

      // Recovery 1: error → connected (immediate)
      WSState.updateState({ limitReached: false, isConnected: true });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('connected');

      // Immediate error again
      WSState.updateState({ isConnected: false, reconnectAttempts: 1 });
      updateStatusIndicator();

      // Recovery 2: reconnecting → connected (immediate)
      WSState.updateState({ isConnected: true, reconnectAttempts: 0 });
      updateStatusIndicator();
      expect(getCurrentBadgeState()).toBe('connected');
    });

    it('should preserve currentBadgeState in state', () => {
      WSState.updateState({ isConnected: true, enabled: true });
      updateStatusIndicator();

      const state = WSState.getState();
      expect(state.currentBadgeState).toBe('connected');
      expect(state.lastStateChangeTime).toBeGreaterThan(0);
    });
  });
});

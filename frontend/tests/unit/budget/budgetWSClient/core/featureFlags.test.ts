/**
 * Unit tests for Feature Flags System
 *
 * Tests localStorage-based feature flags with A/B testing capability
 * Phase 1.6: Feature Flags System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getFeatureFlags,
  enableFeature,
  disableFeature,
  enableForPercentage,
  getFeatureFlagsStatus,
  resetAllFeatures,
  type WSFeatureFlags
} from '@web/budget/budgetWSClient/core/featureFlags';

describe('Feature Flags System', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getFeatureFlags()', () => {
    it('should return all flags as false by default', () => {
      const flags = getFeatureFlags();

      expect(flags.useNewConnection).toBe(false);
      expect(flags.useNewEventHandlers).toBe(false);
      expect(flags.useNewHealthCheck).toBe(false);
      expect(flags.useNewMultiTab).toBe(false);
      expect(flags.useNewMobile).toBe(false);
      expect(flags.useNewFallback).toBe(false);
      expect(flags.useNewStatus).toBe(false);
    });

    it('should read enabled flags from localStorage', () => {
      localStorage.setItem('ws_new_connection', 'true');
      localStorage.setItem('ws_new_health', 'true');

      const flags = getFeatureFlags();

      expect(flags.useNewConnection).toBe(true);
      expect(flags.useNewHealthCheck).toBe(true);
      expect(flags.useNewEventHandlers).toBe(false);
      expect(flags.useNewMultiTab).toBe(false);
    });

    it('should treat any non-"true" value as false', () => {
      localStorage.setItem('ws_new_connection', 'false');
      localStorage.setItem('ws_new_health', 'yes');
      localStorage.setItem('ws_new_multitab', '1');

      const flags = getFeatureFlags();

      expect(flags.useNewConnection).toBe(false);
      expect(flags.useNewHealthCheck).toBe(false);
      expect(flags.useNewMultiTab).toBe(false);
    });
  });

  describe('enableFeature()', () => {
    it('should enable a specific feature flag', () => {
      enableFeature('useNewConnection');

      expect(localStorage.getItem('ws_new_connection')).toBe('true');

      const flags = getFeatureFlags();
      expect(flags.useNewConnection).toBe(true);
    });

    it('should enable multiple features independently', () => {
      enableFeature('useNewConnection');
      enableFeature('useNewHealthCheck');
      enableFeature('useNewMultiTab');

      expect(localStorage.getItem('ws_new_connection')).toBe('true');
      expect(localStorage.getItem('ws_new_health')).toBe('true');
      expect(localStorage.getItem('ws_new_multitab')).toBe('true');

      const flags = getFeatureFlags();
      expect(flags.useNewConnection).toBe(true);
      expect(flags.useNewHealthCheck).toBe(true);
      expect(flags.useNewMultiTab).toBe(true);
      expect(flags.useNewEventHandlers).toBe(false);
    });

    it('should convert feature name to correct localStorage key', () => {
      enableFeature('useNewEventHandlers');
      expect(localStorage.getItem('ws_new_handlers')).toBe('true');

      enableFeature('useNewFallback');
      expect(localStorage.getItem('ws_new_fallback')).toBe('true');
    });
  });

  describe('disableFeature()', () => {
    it('should disable a specific feature flag', () => {
      localStorage.setItem('ws_new_connection', 'true');

      disableFeature('useNewConnection');

      expect(localStorage.getItem('ws_new_connection')).toBeNull();

      const flags = getFeatureFlags();
      expect(flags.useNewConnection).toBe(false);
    });

    it('should only disable the specified feature', () => {
      localStorage.setItem('ws_new_connection', 'true');
      localStorage.setItem('ws_new_health', 'true');
      localStorage.setItem('ws_new_multitab', 'true');

      disableFeature('useNewHealthCheck');

      expect(localStorage.getItem('ws_new_connection')).toBe('true');
      expect(localStorage.getItem('ws_new_health')).toBeNull();
      expect(localStorage.getItem('ws_new_multitab')).toBe('true');
    });

    it('should be safe to disable an already disabled feature', () => {
      expect(() => {
        disableFeature('useNewConnection');
      }).not.toThrow();

      expect(localStorage.getItem('ws_new_connection')).toBeNull();
    });
  });

  describe('enableForPercentage()', () => {
    it('should throw error for invalid percentage < 0', () => {
      expect(() => {
        enableForPercentage('useNewConnection', -1);
      }).toThrow('Invalid percentage: -1. Must be 0-100.');
    });

    it('should throw error for invalid percentage > 100', () => {
      expect(() => {
        enableForPercentage('useNewConnection', 101);
      }).toThrow('Invalid percentage: 101. Must be 0-100.');
    });

    it('should enable feature for 100% of users', () => {
      enableForPercentage('useNewConnection', 100);

      const flags = getFeatureFlags();
      expect(flags.useNewConnection).toBe(true);
    });

    it('should disable feature for 0% of users', () => {
      enableForPercentage('useNewConnection', 0);

      const flags = getFeatureFlags();
      expect(flags.useNewConnection).toBe(false);
    });

    it('should use deterministic hashing (same user always gets same result)', () => {
      // Set anonymous user ID in localStorage
      const mockUserId = 'test-user-123';
      localStorage.setItem('anonymous_user_id', mockUserId);

      // First call
      enableForPercentage('useNewConnection', 50);
      const firstResult = getFeatureFlags().useNewConnection;

      // Clear feature flag but keep user ID
      localStorage.removeItem('ws_new_connection');

      // Second call with same user
      enableForPercentage('useNewConnection', 50);
      const secondResult = getFeatureFlags().useNewConnection;

      // Should get same result for same user
      expect(firstResult).toBe(secondResult);

      // Cleanup
      localStorage.removeItem('anonymous_user_id');
    });

    it('should bucket users differently for different features', () => {
      // Same percentage, but different features might give different results
      // due to hash(userId + feature)
      enableForPercentage('useNewConnection', 50);
      const connectionEnabled = getFeatureFlags().useNewConnection;

      localStorage.clear();

      enableForPercentage('useNewHealthCheck', 50);
      const healthEnabled = getFeatureFlags().useNewHealthCheck;

      // Not testing for inequality (could be same), just that it works
      expect(typeof connectionEnabled).toBe('boolean');
      expect(typeof healthEnabled).toBe('boolean');
    });
  });

  describe('getFeatureFlagsStatus()', () => {
    it('should return status with all flags disabled', () => {
      const status = getFeatureFlagsStatus();

      expect(status.flags).toBeDefined();
      expect(status.enabledCount).toBe(0);
      expect(status.totalCount).toBe(7);
    });

    it('should count enabled flags correctly', () => {
      enableFeature('useNewConnection');
      enableFeature('useNewHealthCheck');
      enableFeature('useNewMultiTab');

      const status = getFeatureFlagsStatus();

      expect(status.enabledCount).toBe(3);
      expect(status.totalCount).toBe(7);
    });

    it('should return current flags state', () => {
      enableFeature('useNewConnection');

      const status = getFeatureFlagsStatus();

      expect(status.flags.useNewConnection).toBe(true);
      expect(status.flags.useNewEventHandlers).toBe(false);
    });
  });

  describe('resetAllFeatures()', () => {
    it('should disable all features', () => {
      // Enable some features
      enableFeature('useNewConnection');
      enableFeature('useNewHealthCheck');
      enableFeature('useNewMultiTab');

      // Reset all
      resetAllFeatures();

      // Check all disabled
      const flags = getFeatureFlags();
      expect(flags.useNewConnection).toBe(false);
      expect(flags.useNewEventHandlers).toBe(false);
      expect(flags.useNewHealthCheck).toBe(false);
      expect(flags.useNewMultiTab).toBe(false);
      expect(flags.useNewMobile).toBe(false);
      expect(flags.useNewFallback).toBe(false);
      expect(flags.useNewStatus).toBe(false);
    });

    it('should clear all localStorage keys for feature flags', () => {
      enableFeature('useNewConnection');
      enableFeature('useNewHealthCheck');

      resetAllFeatures();

      expect(localStorage.getItem('ws_new_connection')).toBeNull();
      expect(localStorage.getItem('ws_new_handlers')).toBeNull();
      expect(localStorage.getItem('ws_new_health')).toBeNull();
      expect(localStorage.getItem('ws_new_multitab')).toBeNull();
      expect(localStorage.getItem('ws_new_mobile')).toBeNull();
      expect(localStorage.getItem('ws_new_fallback')).toBeNull();
      expect(localStorage.getItem('ws_new_status')).toBeNull();
    });

    it('should result in 0 enabled features', () => {
      enableFeature('useNewConnection');
      enableFeature('useNewHealthCheck');

      resetAllFeatures();

      const status = getFeatureFlagsStatus();
      expect(status.enabledCount).toBe(0);
    });
  });

  describe('Window exports', () => {
    it('should expose wsFeatureFlags on window object', () => {
      // window.wsFeatureFlags should be defined after module load
      expect((window as any).wsFeatureFlags).toBeDefined();
      expect((window as any).wsFeatureFlags.get).toBeDefined();
      expect((window as any).wsFeatureFlags.getStatus).toBeDefined();
      expect((window as any).wsFeatureFlags.enable).toBeDefined();
      expect((window as any).wsFeatureFlags.disable).toBeDefined();
      expect((window as any).wsFeatureFlags.enableForPercentage).toBeDefined();
      expect((window as any).wsFeatureFlags.resetAll).toBeDefined();
    });
  });
});

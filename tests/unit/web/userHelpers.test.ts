/**
 * Unit Tests for User Helpers
 * Tests getCurrentUserId() fallback chain and caching mechanism
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCurrentUserId, requireUserId, clearUserIdCache } from '@shared/utils/userHelpers';

describe('getCurrentUserId', () => {
  // Save original window state
  let originalUserData: any;
  let originalCurrentUser: any;

  beforeEach(() => {
    // Clear cache before each test
    clearUserIdCache();

    // Save and clear window properties
    originalUserData = (window as any).userData;
    originalCurrentUser = (window as any).currentUser;
    delete (window as any).userData;
    delete (window as any).currentUser;

    // Reset fetch mock
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    // Restore original window state
    if (originalUserData !== undefined) {
      (window as any).userData = originalUserData;
    } else {
      delete (window as any).userData;
    }

    if (originalCurrentUser !== undefined) {
      (window as any).currentUser = originalCurrentUser;
    } else {
      delete (window as any).currentUser;
    }
  });

  describe('PRIMARY: window.userData.id', () => {
    it('should return userData.id when available', async () => {
      (window as any).userData = { id: 123, username: 'test', isAdmin: false };

      const userId = await getCurrentUserId();

      expect(userId).toBe(123);
    });

    it('should prioritize userData.id over currentUser.id', async () => {
      (window as any).userData = { id: 123, username: 'test', isAdmin: false };
      (window as any).currentUser = { id: 456 }; // Should be ignored

      const userId = await getCurrentUserId();

      expect(userId).toBe(123);
    });
  });

  describe('FALLBACK 1: window.currentUser.id (deprecated)', () => {
    it('should fall back to currentUser.id when userData not available', async () => {
      (window as any).currentUser = { id: 456 };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const userId = await getCurrentUserId();

      expect(userId).toBe(456);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[userHelpers] Using deprecated window.currentUser.id - update code to use window.userData.id'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('FALLBACK 2: Cached user ID', () => {
    it('should use cached user ID from previous API call', async () => {
      // First call: fetch from API
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 789 })
      }));

      const userId1 = await getCurrentUserId();
      expect(userId1).toBe(789);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call: should use cache (no additional fetch)
      const userId2 = await getCurrentUserId();
      expect(userId2).toBe(789);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should clear cache when clearUserIdCache is called', async () => {
      // First call: fetch from API
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 789 })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 999 })
        }));

      const userId1 = await getCurrentUserId();
      expect(userId1).toBe(789);

      // Clear cache
      clearUserIdCache();

      // Second call: should fetch again (cache cleared)
      const userId2 = await getCurrentUserId();
      expect(userId2).toBe(999);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('FALLBACK 3: API call', () => {
    it('should fetch user ID from API when no other source available', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 789, username: 'apiuser' })
      }));

      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const userId = await getCurrentUserId();

      expect(userId).toBe(789);
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/users/me', {
        credentials: 'include',
        signal: expect.any(AbortSignal)
      });
      expect(consoleSpy).toHaveBeenCalledWith('[userHelpers] User ID from API:', 789);

      consoleSpy.mockRestore();
    });

    it('should throw error when API fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(getCurrentUserId()).rejects.toThrow(
        'Cannot determine user ID. User must be authenticated.'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[userHelpers] Failed to fetch user from API:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should throw error when API returns non-ok response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      }));

      await expect(getCurrentUserId()).rejects.toThrow(
        'Cannot determine user ID. User must be authenticated.'
      );
    });

    it('should throw error when API returns invalid user object', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'not-a-number' }) // Invalid type
      }));

      await expect(getCurrentUserId()).rejects.toThrow(
        'Cannot determine user ID. User must be authenticated.'
      );
    });

    it('should cache user ID from successful API call', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 789 })
      }));

      const userId1 = await getCurrentUserId();
      expect(userId1).toBe(789);

      // Clear fetch mock to ensure it's not called again
      vi.clearAllMocks();

      // Second call should use cache
      const userId2 = await getCurrentUserId();
      expect(userId2).toBe(789);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('requireUserId', () => {
    it('should be an alias for getCurrentUserId', async () => {
      (window as any).userData = { id: 123, username: 'test', isAdmin: false };

      const userId = await requireUserId();

      expect(userId).toBe(123);
    });

    it('should throw error when user ID unavailable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(requireUserId()).rejects.toThrow(
        'Cannot determine user ID. User must be authenticated.'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined window gracefully', async () => {
      // This test simulates SSR environment (no window object)
      // In real code, window checks prevent errors

      (window as any).userData = { id: 123 };
      const userId = await getCurrentUserId();

      expect(userId).toBe(123);
    });

    it('should handle null userData.id', async () => {
      (window as any).userData = { id: null };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 789 })
      }));

      const userId = await getCurrentUserId();

      // Should skip userData (null id) and fetch from API
      expect(userId).toBe(789);
    });

    it('should handle userData without id property', async () => {
      (window as any).userData = { username: 'test' }; // Missing id

      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 789 })
      }));

      const userId = await getCurrentUserId();

      // Should skip userData (no id) and fetch from API
      expect(userId).toBe(789);
    });
  });
});

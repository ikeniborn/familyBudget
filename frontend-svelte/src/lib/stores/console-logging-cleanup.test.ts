import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { authStore, isAdmin } from './auth.store';

describe('Console Logging Cleanup Tests', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Spy on console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Auth Store Logging', () => {
    it('should not log during normal authentication flow', async () => {
      const mockUser = {
        id: 1,
        user_id: 1,
        user_name: 'Test User',
        username: 'testuser',
        role: 'user' as const,
        is_active: true
      };

      // Set user without triggering logs
      authStore.setUser(mockUser);

      // Console.log should not be called for normal operations
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should only log errors for critical failures', () => {
      // Try to set invalid user (missing ID)
      const invalidUser = {
        user_name: 'Invalid User',
        role: 'user'
      };

      authStore.setUser(invalidUser);

      // Should log error for missing ID
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing user ID')
      );

      // But not regular logs
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should not log during isAdmin checks', () => {
      const mockAdmin = {
        id: 1,
        user_id: 1,
        user_name: 'Admin User',
        username: 'admin',
        role: 'admin' as const,
        is_active: true
      };

      authStore.setUser(mockAdmin);

      // Reset console mocks
      vi.clearAllMocks();

      // Multiple isAdmin checks should not produce logs
      for (let i = 0; i < 10; i++) {
        const adminStatus = get(isAdmin);
        expect(adminStatus).toBe(true);
      }

      // No console logs should be generated
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should warn only for missing roles when user exists', () => {
      const userWithoutRole = {
        id: 1,
        user_id: 1,
        user_name: 'User Without Role',
        username: 'noRole'
        // role is missing
      };

      authStore.setUser(userWithoutRole);

      // Check isAdmin to trigger role validation
      const adminStatus = get(isAdmin);

      // Should warn about missing role
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('User exists but role is missing')
      );
    });

    it('should not log during localStorage operations', () => {
      const mockUser = {
        id: 1,
        user_id: 1,
        user_name: 'Storage Test User',
        username: 'storagetest',
        role: 'user' as const,
        is_active: true
      };

      // Clear mocks
      vi.clearAllMocks();

      // Set user (triggers localStorage save)
      authStore.setUser(mockUser);

      // Clear auth (triggers localStorage clear)
      authStore.clearAuth();

      // No logs should be generated for storage operations
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('Performance Impact', () => {
    it('should significantly reduce console output in typical user session', () => {
      // Simulate typical user session
      vi.clearAllMocks();

      // 1. Initial auth check
      authStore.checkAuth().catch(() => {}); // Catch expected error

      // 2. User login
      const mockUser = {
        id: 1,
        user_id: 1,
        user_name: 'Session User',
        username: 'session',
        role: 'user' as const,
        is_active: true
      };
      authStore.setUser(mockUser);

      // 3. Multiple isAdmin checks (typical during navigation)
      for (let i = 0; i < 20; i++) {
        get(isAdmin);
      }

      // 4. Logout
      authStore.clearAuth();

      // Total console calls should be minimal
      const totalConsoleCalls =
        (console.log as any).mock.calls.length +
        (console.warn as any).mock.calls.length +
        (console.error as any).mock.calls.length;

      // Should have less than 5 console calls for entire session
      expect(totalConsoleCalls).toBeLessThan(5);
    });
  });
});
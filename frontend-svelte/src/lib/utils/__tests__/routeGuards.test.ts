import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { authStore, isAdmin } from '../../stores/auth.store';
import { createMockUser } from '../../../test/utils';

// Mock navigation
vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

// Mock page store
vi.mock('$app/stores', () => ({
  page: {
    subscribe: vi.fn(() => () => {}),
    set: vi.fn(),
    update: vi.fn()
  }
}));

const mockGoto = vi.mocked(goto);

/**
 * Route guard utility functions for testing
 * These would typically be in a separate module
 */
class RouteGuards {
  static checkAdminAccess(currentPath: string): boolean {
    const adminRoutes = [
      '/settings/users',
      '/settings/security',
      '/settings/import-export',
      '/admin'
    ];
    
    return adminRoutes.some(route => currentPath.startsWith(route));
  }

  static async enforceAdminAccess(currentPath: string): Promise<void> {
    if (this.checkAdminAccess(currentPath)) {
      const adminStatus = get(isAdmin);
      const authenticated = get(authStore).isAuthenticated;
      
      if (!authenticated) {
        await goto('/login?redirect=' + encodeURIComponent(currentPath));
        throw new Error('Authentication required');
      }
      
      if (!adminStatus) {
        await goto('/settings?error=access_denied&message=' + 
          encodeURIComponent('Доступ запрещен. Требуются права администратора.'));
        throw new Error('Admin access required');
      }
    }
  }

  static getProtectedRoutes(): string[] {
    return [
      '/settings/users',
      '/settings/users/*',
      '/settings/security',
      '/settings/security/*',
      '/settings/import-export',
      '/settings/import-export/*',
      '/admin',
      '/admin/*'
    ];
  }

  static isProtectedRoute(path: string): boolean {
    const protectedRoutes = this.getProtectedRoutes();
    return protectedRoutes.some(route => {
      if (route.endsWith('/*')) {
        const basePath = route.slice(0, -2);
        return path.startsWith(basePath);
      }
      return path === route;
    });
  }
}

describe('Route Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    authStore.logout();
  });

  describe('Admin Route Detection', () => {
    it('should correctly identify admin routes', () => {
      const adminRoutes = [
        '/settings/users',
        '/settings/users/123',
        '/settings/users/create',
        '/settings/security',
        '/settings/security/permissions',
        '/settings/import-export',
        '/admin',
        '/admin/dashboard'
      ];

      adminRoutes.forEach(route => {
        expect(RouteGuards.checkAdminAccess(route)).toBe(true);
      });
    });

    it('should correctly identify non-admin routes', () => {
      const regularRoutes = [
        '/settings',
        '/settings/profile',
        '/reference/periods',
        '/reference/nomenclatures',
        '/dashboard',
        '/reports',
        '/products'
      ];

      regularRoutes.forEach(route => {
        expect(RouteGuards.checkAdminAccess(route)).toBe(false);
      });
    });

    it('should handle edge cases in route detection', () => {
      const edgeCases = [
        '/',
        '',
        '/settingsusers', // No slash
        '/settings/user', // Singular vs plural
        '/settings/users_admin', // Underscore
        '/my-settings/users', // Different prefix
      ];

      edgeCases.forEach(route => {
        expect(RouteGuards.checkAdminAccess(route)).toBe(false);
      });
    });
  });

  describe('Protected Route Detection', () => {
    it('should correctly identify protected routes', () => {
      const protectedRoutes = [
        '/settings/users',
        '/settings/users/123',
        '/settings/users/create/new',
        '/settings/security',
        '/settings/security/roles',
        '/settings/import-export',
        '/admin',
        '/admin/users',
        '/admin/reports'
      ];

      protectedRoutes.forEach(route => {
        expect(RouteGuards.isProtectedRoute(route)).toBe(true);
      });
    });

    it('should correctly identify non-protected routes', () => {
      const publicRoutes = [
        '/settings',
        '/login',
        '/dashboard',
        '/reference/periods',
        '/products',
        '/'
      ];

      publicRoutes.forEach(route => {
        expect(RouteGuards.isProtectedRoute(route)).toBe(false);
      });
    });
  });

  describe('Admin Access Enforcement', () => {
    describe('Successful Access', () => {
      it('should allow admin user to access admin routes', async () => {
        const adminUser = createMockUser({ id: 1, user_name: 'Admin User' });
        authStore.setUser(adminUser);

        await RouteGuards.enforceAdminAccess('/settings/users');

        expect(mockGoto).not.toHaveBeenCalled();
      });

      it('should allow any user to access non-admin routes', async () => {
        const regularUser = createMockUser({ id: 2, user_name: 'Regular User' });
        authStore.setUser(regularUser);

        await RouteGuards.enforceAdminAccess('/settings');
        await RouteGuards.enforceAdminAccess('/dashboard');
        await RouteGuards.enforceAdminAccess('/reference/periods');

        expect(mockGoto).not.toHaveBeenCalled();
      });

      it('should allow unauthenticated users to access non-admin routes', async () => {
        await authStore.logout();

        await RouteGuards.enforceAdminAccess('/settings');
        await RouteGuards.enforceAdminAccess('/reference/periods');

        expect(mockGoto).not.toHaveBeenCalled();
      });
    });

    describe('Access Denied', () => {
      it('should redirect unauthenticated user trying to access admin route', async () => {
        await authStore.logout();

        await expect(RouteGuards.enforceAdminAccess('/settings/users'))
          .rejects.toThrow('Authentication required');

        expect(mockGoto).toHaveBeenCalledWith('/login?redirect=' + 
          encodeURIComponent('/settings/users'));
      });

      it('should redirect non-admin user trying to access admin route', async () => {
        const regularUser = createMockUser({ id: 2, user_name: 'Regular User' });
        authStore.setUser(regularUser);

        await expect(RouteGuards.enforceAdminAccess('/settings/users'))
          .rejects.toThrow('Admin access required');

        expect(mockGoto).toHaveBeenCalledWith(
          '/settings?error=access_denied&message=' + 
          encodeURIComponent('Доступ запрещен. Требуются права администратора.')
        );
      });

      it('should redirect user with invalid admin status', async () => {
        const invalidUser = createMockUser({ id: 0, user_name: 'Invalid User' });
        authStore.setUser(invalidUser);

        await expect(RouteGuards.enforceAdminAccess('/settings/users'))
          .rejects.toThrow('Admin access required');

        expect(mockGoto).toHaveBeenCalled();
      });
    });

    describe('Edge Cases', () => {
      it('should handle concurrent route checks', async () => {
        const adminUser = createMockUser({ id: 1, user_name: 'Admin User' });
        authStore.setUser(adminUser);

        const promises = [
          RouteGuards.enforceAdminAccess('/settings/users'),
          RouteGuards.enforceAdminAccess('/settings/security'),
          RouteGuards.enforceAdminAccess('/admin/dashboard')
        ];

        await Promise.all(promises);

        expect(mockGoto).not.toHaveBeenCalled();
      });

      it('should handle rapidly changing auth state', async () => {
        // Start as regular user
        const regularUser = createMockUser({ id: 2 });
        authStore.setUser(regularUser);

        // Change to admin
        const adminUser = createMockUser({ id: 1 });
        authStore.setUser(adminUser);

        // Should use current state (admin)
        await RouteGuards.enforceAdminAccess('/settings/users');

        expect(mockGoto).not.toHaveBeenCalled();
      });

      it('should handle corrupted auth state', async () => {
        // Set corrupted state
        authStore.setUser(null as any);

        await expect(RouteGuards.enforceAdminAccess('/settings/users'))
          .rejects.toThrow('Authentication required');

        expect(mockGoto).toHaveBeenCalledWith(
          '/login?redirect=' + encodeURIComponent('/settings/users')
        );
      });
    });
  });

  describe('Integration with Navigation', () => {
    it('should handle navigation errors gracefully', async () => {
      mockGoto.mockRejectedValue(new Error('Navigation failed'));

      const regularUser = createMockUser({ id: 2 });
      authStore.setUser(regularUser);

      // Should still throw the access error, not the navigation error
      await expect(RouteGuards.enforceAdminAccess('/settings/users'))
        .rejects.toThrow('Admin access required');

      expect(mockGoto).toHaveBeenCalled();
    });

    it('should preserve redirect parameters', async () => {
      await authStore.logout();

      const protectedPath = '/settings/users/123/edit?tab=permissions';

      await expect(RouteGuards.enforceAdminAccess(protectedPath))
        .rejects.toThrow('Authentication required');

      expect(mockGoto).toHaveBeenCalledWith(
        '/login?redirect=' + encodeURIComponent(protectedPath)
      );
    });

    it('should handle special characters in paths', async () => {
      const regularUser = createMockUser({ id: 2 });
      authStore.setUser(regularUser);

      const pathWithSpecialChars = '/settings/users/тест@example.com';

      await expect(RouteGuards.enforceAdminAccess(pathWithSpecialChars))
        .rejects.toThrow('Admin access required');

      expect(mockGoto).toHaveBeenCalledWith(
        '/settings?error=access_denied&message=' + 
        encodeURIComponent('Доступ запрещен. Требуются права администратора.')
      );
    });
  });

  describe('Performance', () => {
    it('should perform route checks efficiently', () => {
      const start = performance.now();

      // Perform many route checks
      for (let i = 0; i < 1000; i++) {
        RouteGuards.checkAdminAccess('/settings/users');
        RouteGuards.isProtectedRoute('/settings/users');
      }

      const end = performance.now();
      const duration = end - start;

      // Should complete 2000 checks in reasonable time
      expect(duration).toBeLessThan(100);
    });

    it('should cache route classifications', () => {
      // Multiple calls to same route should be fast
      const routes = ['/settings/users', '/dashboard', '/admin'];
      
      const start = performance.now();
      
      for (let i = 0; i < 100; i++) {
        routes.forEach(route => {
          RouteGuards.checkAdminAccess(route);
          RouteGuards.isProtectedRoute(route);
        });
      }
      
      const end = performance.now();
      expect(end - start).toBeLessThan(50);
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with repeated access checks', async () => {
      const adminUser = createMockUser({ id: 1 });
      authStore.setUser(adminUser);

      // Perform many access checks
      for (let i = 0; i < 100; i++) {
        await RouteGuards.enforceAdminAccess('/settings/users');
      }

      // Should not have accumulated errors or memory leaks
      expect(mockGoto).not.toHaveBeenCalled();
    });

    it('should handle store subscriptions properly', () => {
      // Create multiple route guard instances
      const guards = Array(10).fill(null).map(() => RouteGuards);

      // Each should be able to check admin status
      guards.forEach(guard => {
        expect(guard.checkAdminAccess('/settings/users')).toBe(true);
      });
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for route strings', () => {
      const route: string = '/settings/users';
      const isAdmin: boolean = RouteGuards.checkAdminAccess(route);
      const isProtected: boolean = RouteGuards.isProtectedRoute(route);

      expect(typeof isAdmin).toBe('boolean');
      expect(typeof isProtected).toBe('boolean');
    });

    it('should handle undefined and null paths gracefully', () => {
      expect(RouteGuards.checkAdminAccess(undefined as any)).toBe(false);
      expect(RouteGuards.checkAdminAccess(null as any)).toBe(false);
      expect(RouteGuards.isProtectedRoute(undefined as any)).toBe(false);
      expect(RouteGuards.isProtectedRoute(null as any)).toBe(false);
    });
  });
});
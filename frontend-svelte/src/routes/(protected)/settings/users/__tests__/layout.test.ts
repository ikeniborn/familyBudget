import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redirect } from '@sveltejs/kit';
import { load } from '../+layout';
import type { LayoutLoad } from '../$types';

// Mock SvelteKit's redirect function
vi.mock('@sveltejs/kit', () => ({
  redirect: vi.fn()
}));

const mockRedirect = vi.mocked(redirect);

describe('Admin Route Guard (+layout.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Successful Admin Access', () => {
    it('should allow access for authenticated admin user (id = 1)', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: 1, user_name: 'Admin User', user_email: 'admin@example.com' }
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      const result = await load(mockLoadEvent);

      expect(mockParent).toHaveBeenCalledOnce();
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should handle admin user with additional properties', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true,
        user: { 
          id: 1, 
          user_name: 'Admin User', 
          user_email: 'admin@example.com',
          role: 'administrator',
          permissions: ['all']
        }
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      const result = await load(mockLoadEvent);

      expect(mockRedirect).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });
  });

  describe('Access Denied Scenarios', () => {
    it('should redirect unauthenticated user', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: false,
        user: null
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      
      expect(mockRedirect).toHaveBeenCalledWith(
        302,
        '/settings?error=access_denied&message=' + encodeURIComponent('Доступ запрещен. Требуются права администратора.')
      );
    });

    it('should redirect regular user (id != 1)', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: 2, user_name: 'Regular User', user_email: 'user@example.com' }
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      
      expect(mockRedirect).toHaveBeenCalledWith(
        302,
        '/settings?error=access_denied&message=' + encodeURIComponent('Доступ запрещен. Требуются права администратора.')
      );
    });

    it('should redirect when user is null despite authenticated=true', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true,
        user: null
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      
      expect(mockRedirect).toHaveBeenCalledWith(
        302,
        '/settings?error=access_denied&message=' + encodeURIComponent('Доступ запрещен. Требуются права администратора.')
      );
    });

    it('should redirect when user is undefined', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true,
        user: undefined
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      
      expect(mockRedirect).toHaveBeenCalledWith(
        302,
        '/settings?error=access_denied&message=' + encodeURIComponent('Доступ запрещен. Требуются права администратора.')
      );
    });

    it('should redirect when authenticated is explicitly false', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: false,
        user: { id: 1, user_name: 'Admin User' }
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      
      expect(mockRedirect).toHaveBeenCalledWith(
        302,
        '/settings?error=access_denied&message=' + encodeURIComponent('Доступ запрещен. Требуются права администратора.')
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with id = 0', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: 0, user_name: 'Zero User' }
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalled();
    });

    it('should handle user with negative id', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: -1, user_name: 'Negative User' }
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalled();
    });

    it('should handle user with string id "1"', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: '1', user_name: 'String ID User' }
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalled();
    });

    it('should handle user without id property', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true,
        user: { user_name: 'No ID User' }
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalled();
    });

    it('should handle user with null id', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: null, user_name: 'Null ID User' }
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalled();
    });

    it('should handle user with undefined id', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: undefined, user_name: 'Undefined ID User' }
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalled();
    });

    it('should handle large user id correctly', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: 999999, user_name: 'Large ID User' }
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalled();
    });
  });

  describe('Parent Data Handling', () => {
    it('should handle missing authenticated field', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        user: { id: 1, user_name: 'Admin User' }
        // missing authenticated field
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalled();
    });

    it('should handle missing user field when authenticated', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true
        // missing user field
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalled();
    });

    it('should handle empty parent data', async () => {
      const mockParent = vi.fn().mockResolvedValue({});

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalled();
    });

    it('should handle null parent data', async () => {
      const mockParent = vi.fn().mockResolvedValue(null);

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalled();
    });

    it('should handle undefined parent data', async () => {
      const mockParent = vi.fn().mockResolvedValue(undefined);

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalled();
    });

    it('should handle parent function throwing error', async () => {
      const mockParent = vi.fn().mockRejectedValue(new Error('Parent load failed'));

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow('Parent load failed');
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  describe('Redirect URL Construction', () => {
    it('should construct redirect URL with proper encoding', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: 2, user_name: 'Regular User' }
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      
      const expectedMessage = encodeURIComponent('Доступ запрещен. Требуются права администратора.');
      expect(mockRedirect).toHaveBeenCalledWith(
        302,
        `/settings?error=access_denied&message=${expectedMessage}`
      );
    });

    it('should use correct status code for redirect', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: false,
        user: null
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      await expect(load(mockLoadEvent)).rejects.toThrow();
      
      expect(mockRedirect).toHaveBeenCalledWith(
        302, // Should be 302 (Found) for temporary redirect
        expect.any(String)
      );
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for LayoutLoad', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: 1, user_name: 'Admin User' }
      });

      const mockLoadEvent = {
        parent: mockParent,
        params: {},
        route: { id: '/settings/users' },
        url: new URL('http://localhost/settings/users')
      } as Parameters<LayoutLoad>[0];

      const result = await load(mockLoadEvent);

      // Result should be a proper return type
      expect(result).toEqual({});
      expect(typeof result).toBe('object');
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle multiple concurrent load calls', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: 1, user_name: 'Admin User' }
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      // Make multiple concurrent calls
      const promises = Array(10).fill(null).map(() => load(mockLoadEvent));
      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result).toEqual({});
      });

      expect(mockRedirect).not.toHaveBeenCalled();
      expect(mockParent).toHaveBeenCalledTimes(10);
    });

    it('should complete quickly for admin user', async () => {
      const mockParent = vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: 1, user_name: 'Admin User' }
      });

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      const start = performance.now();
      await load(mockLoadEvent);
      const end = performance.now();

      // Should complete quickly (< 100ms)
      expect(end - start).toBeLessThan(100);
    });

    it('should handle slow parent resolver gracefully', async () => {
      const mockParent = vi.fn().mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            authenticated: true,
            user: { id: 1, user_name: 'Admin User' }
          }), 100)
        )
      );

      const mockLoadEvent = {
        parent: mockParent
      } as any;

      const result = await load(mockLoadEvent);
      expect(result).toEqual({});
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });
});
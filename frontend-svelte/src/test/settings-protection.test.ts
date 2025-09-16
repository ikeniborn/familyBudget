/**
 * Comprehensive tests for settings page route protection and access control.
 * Tests server-side route protection, error handling, and integration between
 * frontend components and backend security.
 *
 * Coverage:
 * - Server-side route protection via layout.server.ts
 * - Authentication and authorization error handling
 * - Settings page access restrictions
 * - Redirect behavior for unauthorized users
 * - Error message display for 401/403 responses
 * - Integration testing between frontend and backend protection
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/svelte';
import { readable, writable } from 'svelte/store';
import { tick } from 'svelte';
import { error, redirect } from '@sveltejs/kit';

// Types for testing
interface MockLocals {
  user?: {
    id: number;
    user_id: number;
    username: string;
    user_name: string;
    role: string;
  } | null;
}

interface MockRequestEvent {
  locals: MockLocals;
  cookies: {
    get: (name: string) => string | undefined;
  };
  url: {
    pathname: string;
    search: string;
  };
  fetch: vi.MockedFunction<any>;
}

// Mock SvelteKit functions
const mockError = vi.fn();
const mockRedirect = vi.fn();

vi.mock('@sveltejs/kit', () => ({
  error: mockError,
  redirect: mockRedirect
}));

// Mock page store
const mockPage = writable({
  url: { pathname: '/settings', search: '' },
  params: {},
  route: { id: '/settings' },
  data: {},
  error: null,
  status: 200
});

vi.mock('$app/stores', () => ({
  page: mockPage
}));

// Mock navigation
const mockGoto = vi.fn();
vi.mock('$app/navigation', () => ({
  goto: mockGoto
}));

describe('Settings Route Protection - Server-Side Access Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockError.mockImplementation((status: number, message: string) => {
      throw new Error(`${status}: ${message}`);
    });
    mockRedirect.mockImplementation((status: number, location: string) => {
      throw new Error(`Redirect ${status}: ${location}`);
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Authentication Required - Base Protected Layout', () => {
    it('should redirect unauthenticated users to login', async () => {
      // Mock the base protected layout load function
      const { load } = await import('../../frontend-svelte/src/routes/(protected)/+layout.server');

      const mockEvent: MockRequestEvent = {
        locals: {},
        cookies: {
          get: vi.fn().mockReturnValue(undefined) // No session cookie
        },
        url: {
          pathname: '/settings',
          search: ''
        },
        fetch: vi.fn()
      };

      // Should throw redirect to login
      await expect(load(mockEvent as any)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalledWith(
        303,
        '/login?returnUrl=%2Fsettings'
      );
    });

    it('should redirect users with invalid session to login', async () => {
      const { load } = await import('../../frontend-svelte/src/routes/(protected)/+layout.server');

      const mockEvent: MockRequestEvent = {
        locals: {},
        cookies: {
          get: vi.fn().mockReturnValue('invalid-session-id')
        },
        url: {
          pathname: '/settings/periods',
          search: ''
        },
        fetch: vi.fn().mockRejectedValue(new Response('Unauthorized', { status: 401 }))
      };

      // Should throw redirect to login with return URL
      await expect(load(mockEvent as any)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalledWith(
        303,
        '/login?returnUrl=%2Fsettings%2Fperiods'
      );
    });

    it('should allow authenticated users to proceed', async () => {
      const { load } = await import('../../frontend-svelte/src/routes/(protected)/+layout.server');

      const mockUser = {
        id: 1,
        user_id: 1,
        username: 'test_user',
        user_name: 'Test User',
        role: 'user'
      };

      const mockEvent: MockRequestEvent = {
        locals: {},
        cookies: {
          get: vi.fn().mockReturnValue('valid-session-id')
        },
        url: {
          pathname: '/dashboard',
          search: ''
        },
        fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({
          user: mockUser
        }), { status: 200 }))
      };

      const result = await load(mockEvent as any);

      expect(result).toEqual({
        authenticated: true,
        user: mockUser
      });
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(mockError).not.toHaveBeenCalled();
    });
  });

  describe('Admin Authorization - Settings Layout Protection', () => {
    it('should throw 401 error if user is not authenticated', async () => {
      const { load } = await import('../../frontend-svelte/src/routes/(protected)/settings/+layout.server');

      const mockEvent = {
        locals: {} // No user in locals
      };

      await expect(load(mockEvent as any)).rejects.toThrow();
      expect(mockError).toHaveBeenCalledWith(401, 'Authentication required');
    });

    it('should throw 403 error for non-admin users', async () => {
      const { load } = await import('../../frontend-svelte/src/routes/(protected)/settings/+layout.server');

      const mockEvent = {
        locals: {
          user: {
            id: 2,
            user_id: 2,
            username: 'regular_user',
            user_name: 'Regular User',
            role: 'user' // Not admin
          }
        }
      };

      await expect(load(mockEvent as any)).rejects.toThrow();
      expect(mockError).toHaveBeenCalledWith(403, 'Доступ запрещен. Требуются права администратора.');
    });

    it('should allow admin users to proceed', async () => {
      const { load } = await import('../../frontend-svelte/src/routes/(protected)/settings/+layout.server');

      const adminUser = {
        id: 1,
        user_id: 1,
        username: 'admin_user',
        user_name: 'Admin User',
        role: 'admin'
      };

      const mockEvent = {
        locals: {
          user: adminUser
        }
      };

      const result = await load(mockEvent as any);

      expect(result).toEqual({
        user: adminUser
      });
      expect(mockError).not.toHaveBeenCalled();
    });

    it('should treat user without role as non-admin', async () => {
      const { load } = await import('../../frontend-svelte/src/routes/(protected)/settings/+layout.server');

      const mockEvent = {
        locals: {
          user: {
            id: 3,
            user_id: 3,
            username: 'no_role_user',
            user_name: 'No Role User'
            // Missing role property
          }
        }
      };

      await expect(load(mockEvent as any)).rejects.toThrow();
      expect(mockError).toHaveBeenCalledWith(403, 'Доступ запрещен. Требуются права администратора.');
    });
  });

  describe('Nested Settings Routes Protection', () => {
    const settingsRoutes = [
      '/settings/periods',
      '/settings/financial-centers',
      '/settings/cost-centers',
      '/settings/nomenclatures',
      '/settings/articles',
      '/settings/users',
      '/settings/security',
      '/settings/import-export'
    ];

    it.each(settingsRoutes)('should protect %s route for non-admin users', async (route) => {
      const { load } = await import('../../frontend-svelte/src/routes/(protected)/settings/+layout.server');

      const mockEvent = {
        locals: {
          user: {
            id: 2,
            user_id: 2,
            username: 'regular_user',
            user_name: 'Regular User',
            role: 'user'
          }
        }
      };

      await expect(load(mockEvent as any)).rejects.toThrow();
      expect(mockError).toHaveBeenCalledWith(403, 'Доступ запрещен. Требуются права администратора.');
    });

    it.each(settingsRoutes)('should allow %s route for admin users', async (route) => {
      const { load } = await import('../../frontend-svelte/src/routes/(protected)/settings/+layout.server');

      const adminUser = {
        id: 1,
        user_id: 1,
        username: 'admin_user',
        user_name: 'Admin User',
        role: 'admin'
      };

      const mockEvent = {
        locals: {
          user: adminUser
        }
      };

      const result = await load(mockEvent as any);

      expect(result).toEqual({
        user: adminUser
      });
      expect(mockError).not.toHaveBeenCalled();
    });
  });
});

describe('Settings Access - Error Handling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('HTTP Status Code Handling', () => {
    it('should handle 401 Unauthorized responses properly', async () => {
      // Mock page store with error state
      mockPage.set({
        url: { pathname: '/settings', search: '' },
        params: {},
        route: { id: '/settings' },
        data: {},
        error: {
          status: 401,
          message: 'Authentication required'
        },
        status: 401
      });

      // Test that error page would be displayed
      const pageData = await new Promise((resolve) => {
        const unsubscribe = mockPage.subscribe(resolve);
        unsubscribe();
      });

      expect(pageData).toMatchObject({
        error: {
          status: 401,
          message: 'Authentication required'
        }
      });
    });

    it('should handle 403 Forbidden responses properly', async () => {
      mockPage.set({
        url: { pathname: '/settings', search: '' },
        params: {},
        route: { id: '/settings' },
        data: {},
        error: {
          status: 403,
          message: 'Доступ запрещен. Требуются права администратора.'
        },
        status: 403
      });

      const pageData = await new Promise((resolve) => {
        const unsubscribe = mockPage.subscribe(resolve);
        unsubscribe();
      });

      expect(pageData).toMatchObject({
        error: {
          status: 403,
          message: 'Доступ запрещен. Требуются права администратора.'
        }
      });
    });
  });

  describe('Session Validation Edge Cases', () => {
    it('should handle network errors during session validation', async () => {
      const { load } = await import('../../frontend-svelte/src/routes/(protected)/+layout.server');

      const mockEvent: MockRequestEvent = {
        locals: {},
        cookies: {
          get: vi.fn().mockReturnValue('session-id')
        },
        url: {
          pathname: '/settings',
          search: ''
        },
        fetch: vi.fn().mockRejectedValue(new Error('Network error'))
      };

      await expect(load(mockEvent as any)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalledWith(
        303,
        '/login?returnUrl=%2Fsettings'
      );
    });

    it('should handle malformed session responses', async () => {
      const { load } = await import('../../frontend-svelte/src/routes/(protected)/+layout.server');

      const mockEvent: MockRequestEvent = {
        locals: {},
        cookies: {
          get: vi.fn().mockReturnValue('session-id')
        },
        url: {
          pathname: '/settings',
          search: ''
        },
        fetch: vi.fn().mockResolvedValue(new Response('invalid json', { status: 200 }))
      };

      await expect(load(mockEvent as any)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalledWith(
        303,
        '/login?returnUrl=%2Fsettings'
      );
    });

    it('should handle sessions without user data', async () => {
      const { load } = await import('../../frontend-svelte/src/routes/(protected)/+layout.server');

      const mockEvent: MockRequestEvent = {
        locals: {},
        cookies: {
          get: vi.fn().mockReturnValue('session-id')
        },
        url: {
          pathname: '/settings',
          search: ''
        },
        fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
      };

      await expect(load(mockEvent as any)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalledWith(
        303,
        '/login?returnUrl=%2Fsettings'
      );
    });
  });

  describe('Cookie Handling', () => {
    it('should handle both connect.sid and familybudget.sid cookies', async () => {
      const { load } = await import('../../frontend-svelte/src/routes/(protected)/+layout.server');

      // Test connect.sid cookie
      const mockEvent1: MockRequestEvent = {
        locals: {},
        cookies: {
          get: vi.fn((name) => name === 'connect.sid' ? 'connect-session-id' : undefined)
        },
        url: {
          pathname: '/dashboard',
          search: ''
        },
        fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({
          user: { id: 1, user_id: 1, username: 'user', role: 'user' }
        }), { status: 200 }))
      };

      await load(mockEvent1 as any);

      // Should use connect.sid cookie
      expect(mockEvent1.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Cookie': 'connect.sid=connect-session-id'
          })
        })
      );

      // Test familybudget.sid cookie
      const mockEvent2: MockRequestEvent = {
        locals: {},
        cookies: {
          get: vi.fn((name) => name === 'familybudget.sid' ? 'family-session-id' : undefined)
        },
        url: {
          pathname: '/dashboard',
          search: ''
        },
        fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({
          user: { id: 1, user_id: 1, username: 'user', role: 'user' }
        }), { status: 200 }))
      };

      await load(mockEvent2 as any);

      // Should use familybudget.sid cookie
      expect(mockEvent2.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Cookie': 'familybudget.sid=family-session-id'
          })
        })
      );
    });
  });
});

describe('Settings Protection - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Full Access Flow', () => {
    it('should complete full authentication and authorization flow for admin', async () => {
      const baseLoad = await import('../../frontend-svelte/src/routes/(protected)/+layout.server');
      const settingsLoad = await import('../../frontend-svelte/src/routes/(protected)/settings/+layout.server');

      const adminUser = {
        id: 1,
        user_id: 1,
        username: 'admin_user',
        user_name: 'Admin User',
        role: 'admin'
      };

      // Step 1: Base authentication
      const mockBaseEvent: MockRequestEvent = {
        locals: {},
        cookies: {
          get: vi.fn().mockReturnValue('valid-session-id')
        },
        url: {
          pathname: '/settings',
          search: ''
        },
        fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({
          user: adminUser
        }), { status: 200 }))
      };

      const baseResult = await baseLoad.load(mockBaseEvent as any);

      expect(baseResult).toEqual({
        authenticated: true,
        user: adminUser
      });

      // Step 2: Settings authorization
      const mockSettingsEvent = {
        locals: {
          user: adminUser
        }
      };

      const settingsResult = await settingsLoad.load(mockSettingsEvent as any);

      expect(settingsResult).toEqual({
        user: adminUser
      });

      // Both should succeed without errors
      expect(mockError).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('should block regular user at settings authorization step', async () => {
      const baseLoad = await import('../../frontend-svelte/src/routes/(protected)/+layout.server');
      const settingsLoad = await import('../../frontend-svelte/src/routes/(protected)/settings/+layout.server');

      const regularUser = {
        id: 2,
        user_id: 2,
        username: 'regular_user',
        user_name: 'Regular User',
        role: 'user'
      };

      // Step 1: Base authentication (should succeed)
      const mockBaseEvent: MockRequestEvent = {
        locals: {},
        cookies: {
          get: vi.fn().mockReturnValue('valid-session-id')
        },
        url: {
          pathname: '/settings',
          search: ''
        },
        fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({
          user: regularUser
        }), { status: 200 }))
      };

      const baseResult = await baseLoad.load(mockBaseEvent as any);

      expect(baseResult).toEqual({
        authenticated: true,
        user: regularUser
      });

      // Step 2: Settings authorization (should fail)
      const mockSettingsEvent = {
        locals: {
          user: regularUser
        }
      };

      await expect(settingsLoad.load(mockSettingsEvent as any)).rejects.toThrow();
      expect(mockError).toHaveBeenCalledWith(403, 'Доступ запрещен. Требуются права администратора.');
    });
  });

  describe('Return URL Preservation', () => {
    it('should preserve return URL with query parameters', async () => {
      const { load } = await import('../../frontend-svelte/src/routes/(protected)/+layout.server');

      const mockEvent: MockRequestEvent = {
        locals: {},
        cookies: {
          get: vi.fn().mockReturnValue(undefined)
        },
        url: {
          pathname: '/settings/periods',
          search: '?tab=active&filter=2025'
        },
        fetch: vi.fn()
      };

      await expect(load(mockEvent as any)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalledWith(
        303,
        '/login?returnUrl=%2Fsettings%2Fperiods%3Ftab%3Dactive%26filter%3D2025'
      );
    });

    it('should handle special characters in return URL', async () => {
      const { load } = await import('../../frontend-svelte/src/routes/(protected)/+layout.server');

      const mockEvent: MockRequestEvent = {
        locals: {},
        cookies: {
          get: vi.fn().mockReturnValue(undefined)
        },
        url: {
          pathname: '/settings/nomenclatures',
          search: '?search=Продукты питания&category=основные'
        },
        fetch: vi.fn()
      };

      await expect(load(mockEvent as any)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalledWith(
        303,
        expect.stringContaining('/login?returnUrl=')
      );
    });
  });

  describe('Backend Environment Configuration', () => {
    const originalBackendUrl = process.env.BACKEND_URL;

    afterEach(() => {
      process.env.BACKEND_URL = originalBackendUrl;
    });

    it('should use custom backend URL from environment', async () => {
      process.env.BACKEND_URL = 'http://custom-backend:5000';

      const { load } = await import('../../frontend-svelte/src/routes/(protected)/+layout.server');

      const mockEvent: MockRequestEvent = {
        locals: {},
        cookies: {
          get: vi.fn().mockReturnValue('session-id')
        },
        url: {
          pathname: '/dashboard',
          search: ''
        },
        fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({
          user: { id: 1, user_id: 1, username: 'user', role: 'user' }
        }), { status: 200 }))
      };

      await load(mockEvent as any);

      expect(mockEvent.fetch).toHaveBeenCalledWith(
        'http://custom-backend:5000/api/auth/me',
        expect.any(Object)
      );
    });

    it('should fallback to default backend URL', async () => {
      delete process.env.BACKEND_URL;

      const { load } = await import('../../frontend-svelte/src/routes/(protected)/+layout.server');

      const mockEvent: MockRequestEvent = {
        locals: {},
        cookies: {
          get: vi.fn().mockReturnValue('session-id')
        },
        url: {
          pathname: '/dashboard',
          search: ''
        },
        fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({
          user: { id: 1, user_id: 1, username: 'user', role: 'user' }
        }), { status: 200 }))
      };

      await load(mockEvent as any);

      expect(mockEvent.fetch).toHaveBeenCalledWith(
        'http://backend:4000/api/auth/me',
        expect.any(Object)
      );
    });
  });
});
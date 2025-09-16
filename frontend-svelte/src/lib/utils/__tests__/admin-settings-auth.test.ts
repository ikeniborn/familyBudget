/**
 * Comprehensive frontend tests for admin settings authorization fix.
 *
 * This test suite covers:
 * 1. hooks.server.ts cookie handling
 * 2. Backend URL configuration
 * 3. User data extraction
 * 4. Role validation
 * 5. Session format compatibility
 * 6. Error handling and edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RequestEvent, Handle } from '@sveltejs/kit';
import { handle } from '../../../hooks.server';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods to avoid spam during tests
const originalConsole = { ...console };
beforeEach(() => {
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
});

afterEach(() => {
  Object.assign(console, originalConsole);
  vi.clearAllMocks();
});

describe('Admin Settings Authorization - hooks.server.ts', () => {

  describe('Cookie Handling', () => {
    it('should extract connect.sid cookie correctly', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:abc123.signature']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      // Mock successful auth response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: {
            id: 1,
            username: 'admin',
            role: 'admin'
          }
        })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.authenticated).toBe(true);
      expect(mockEvent.locals.sessionId).toBe('abc123');
      expect(mockEvent.locals.user?.role).toBe('admin');
    });

    it('should extract familybudget.sid cookie as fallback', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['familybudget.sid', 'xyz789.signature']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: {
            id: 2,
            username: 'user',
            role: 'user'
          }
        })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.authenticated).toBe(true);
      expect(mockEvent.locals.sessionId).toBe('xyz789');
      expect(mockEvent.locals.user?.role).toBe('user');
    });

    it('should prefer connect.sid over familybudget.sid when both exist', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([
          ['connect.sid', 's:primary123.signature'],
          ['familybudget.sid', 'secondary456.signature']
        ])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: { id: 1, username: 'admin', role: 'admin' }
        })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.sessionId).toBe('primary123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Cookie': 'connect.sid=s:primary123.signature'
          })
        })
      );
    });

    it('should handle session ID without s: prefix', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 'plain-session-id']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.sessionId).toBe('plain-session-id');
      expect(mockEvent.locals.authenticated).toBe(true); // Has sessionId but auth failed
    });

    it('should handle malformed session cookies', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 'malformed.cookie.with.too.many.dots']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      await handle({ event: mockEvent, resolve: mockResolve });

      // Should extract first part before first dot
      expect(mockEvent.locals.sessionId).toBe('malformed');
      expect(mockEvent.locals.authenticated).toBe(true);
    });

    it('should handle no cookies gracefully', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map()
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.authenticated).toBe(false);
      expect(mockEvent.locals.sessionId).toBeUndefined();
      expect(mockEvent.locals.user).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Backend URL Configuration', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use BACKEND_URL environment variable when available', async () => {
      process.env.BACKEND_URL = 'http://custom-backend:3000';

      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:test123.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: { id: 1, username: 'admin', role: 'admin' }
        })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://custom-backend:3000/api/auth/me',
        expect.any(Object)
      );
    });

    it('should fallback to default Docker backend URL', async () => {
      delete process.env.BACKEND_URL;

      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:test123.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: { id: 1, username: 'admin', role: 'admin' }
        })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://budget-backend:4000/api/auth/me',
        expect.any(Object)
      );
    });

    it('should include correct headers in backend request', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:session123.signature']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, user: { id: 1 } })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Cookie': 'connect.sid=s:session123.signature',
            'Accept': 'application/json',
            'User-Agent': 'SvelteKit-SSR'
          })
        })
      );
    });
  });

  describe('User Data Extraction', () => {
    it('should extract user data from success format response', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:test123.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: {
            id: 1,
            username: 'admin',
            user_name: 'Admin User',
            role: 'admin',
            telegram_id: '123456789'
          }
        })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.user).toEqual({
        id: 1,
        username: 'admin',
        user_name: 'Admin User',
        role: 'admin',
        telegram_id: '123456789'
      });
    });

    it('should extract user data from direct user format response', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:test123.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          user: {
            id: 2,
            username: 'user',
            role: 'user'
          }
        })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.user).toEqual({
        id: 2,
        username: 'user',
        role: 'user'
      });
    });

    it('should handle legacy user data format', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:test123.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 3,
          user_id: 3,
          username: 'legacy_user',
          user_name: 'Legacy User',
          role: 'user',
          telegram_id: 987654321
        })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.user).toEqual({
        id: 3,
        user_id: 3,
        username: 'legacy_user',
        first_name: 'Legacy User',
        role: 'user',
        telegram_id: '987654321'
      });
    });

    it('should handle user data with missing fields gracefully', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:test123.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: {
            id: 4,
            // Missing username, role, etc.
          }
        })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.user).toEqual({
        id: 4,
        // Should have default/undefined values for missing fields
      });
    });

    it('should convert telegram_id to string', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:test123.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: {
            id: 5,
            telegram_id: 123456789  // Number
          }
        })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.user?.telegram_id).toBe('123456789'); // String
    });
  });

  describe('Role Validation', () => {
    it('should correctly identify admin users', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:admin123.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: {
            id: 1,
            username: 'admin',
            role: 'admin'
          }
        })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.user?.role).toBe('admin');
    });

    it('should correctly identify regular users', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:user123.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: {
            id: 2,
            username: 'user',
            role: 'user'
          }
        })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.user?.role).toBe('user');
    });

    it('should handle missing role with fallback', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:norole123.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: {
            id: 3,
            username: 'norole'
            // No role field
          }
        })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.user?.role).toBe('user'); // Default fallback
    });

    it('should handle role from user_role field', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:userrole123.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 4,
          user_role: 'admin'  // Legacy field name
        })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.user?.role).toBe('admin');
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 authentication failure', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:invalid123.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.authenticated).toBe(true); // Has session ID
      expect(mockEvent.locals.user).toBeUndefined(); // But no user data
    });

    it('should handle 500 server error', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:server-error.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.authenticated).toBe(true);
      expect(mockEvent.locals.user).toBeUndefined();
    });

    it('should handle network errors gracefully', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:network-error.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.authenticated).toBe(true);
      expect(mockEvent.locals.user).toBeUndefined();
    });

    it('should handle malformed JSON response', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:malformed.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.authenticated).toBe(true);
      expect(mockEvent.locals.user).toBeUndefined();
    });

    it('should handle timeout scenarios', async () => {
      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:timeout.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      // Simulate timeout
      mockFetch.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.authenticated).toBe(true);
      expect(mockEvent.locals.user).toBeUndefined();
    });
  });

  describe('Development vs Production Behavior', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should log debug information in development mode', async () => {
      process.env.NODE_ENV = 'development';

      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:debug123.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: { id: 1, username: 'admin', role: 'admin' }
        })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(console.log).toHaveBeenCalledWith(
        '[Auth Debug] User loaded:',
        expect.objectContaining({
          userId: 1,
          role: 'admin',
          sessionId: 'debug123...'
        })
      );
    });

    it('should not log debug information in production mode', async () => {
      process.env.NODE_ENV = 'production';

      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:prod123.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: { id: 1, username: 'admin', role: 'admin' }
        })
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('[Auth Debug]'),
        expect.any(Object)
      );
    });

    it('should log authentication failures in development', async () => {
      process.env.NODE_ENV = 'development';

      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:fail123.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(console.warn).toHaveBeenCalledWith(
        '[Auth Debug] Authentication failed:',
        expect.objectContaining({
          status: 401,
          sessionId: 'fail123...'
        })
      );
    });

    it('should log errors with stack trace in development', async () => {
      process.env.NODE_ENV = 'development';

      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:error123.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at line 1\n    at line 2\n    at line 3';
      mockFetch.mockRejectedValueOnce(error);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(console.error).toHaveBeenCalledWith(
        '[Auth Error] Failed to fetch user data:',
        expect.objectContaining({
          error: 'Test error',
          sessionId: 'error123...',
          stack: expect.stringContaining('Error: Test error')
        })
      );
    });

    it('should provide minimal logging in production', async () => {
      process.env.NODE_ENV = 'production';

      const mockEvent = createMockEvent({
        cookies: new Map([['connect.sid', 's:prod-error.sig']])
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      mockFetch.mockRejectedValueOnce(new Error('Production error'));

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(console.warn).toHaveBeenCalledWith('Authentication service unavailable');
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('API Request Handling', () => {
    it('should pass through cookies for API requests', async () => {
      const mockEvent = createMockEvent({
        url: new URL('http://localhost:5173/api/test'),
        request: {
          headers: new Map([['cookie', 'existing=value']])
        }
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.request.headers.get('cookie')).toBe('existing=value');
    });

    it('should set empty cookie header for API requests without cookies', async () => {
      const mockEvent = createMockEvent({
        url: new URL('http://localhost:5173/api/test'),
        request: {
          headers: new Map()
        }
      });

      const mockResolve = vi.fn().mockResolvedValue(createMockResponse());

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.request.headers.get('cookie')).toBe('');
    });
  });

  describe('CORS Headers', () => {
    it('should add CORS headers for localhost development', async () => {
      const mockEvent = createMockEvent({
        url: new URL('http://localhost:5173/test')
      });

      const response = createMockResponse();
      const mockResolve = vi.fn().mockResolvedValue(response);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(response.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(response.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      expect(response.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    });

    it('should not add CORS headers for non-localhost origins', async () => {
      const mockEvent = createMockEvent({
        url: new URL('https://production.example.com/test')
      });

      const response = createMockResponse();
      const mockResolve = vi.fn().mockResolvedValue(response);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(response.headers.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });
  });
});

// Helper functions

function createMockEvent(options: {
  cookies?: Map<string, string>;
  url?: URL;
  request?: {
    headers?: Map<string, string>;
  };
} = {}): RequestEvent {
  const event = {
    cookies: {
      get: (name: string) => options.cookies?.get(name)
    },
    locals: {} as App.Locals,
    url: options.url || new URL('http://localhost:5173/'),
    request: {
      headers: {
        get: (name: string) => options.request?.headers?.get(name),
        set: vi.fn()
      }
    }
  } as any;

  return event;
}

function createMockResponse() {
  return {
    headers: {
      set: vi.fn()
    }
  } as any;
}
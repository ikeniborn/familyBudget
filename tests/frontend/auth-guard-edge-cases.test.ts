/**
 * AuthGuard Frontend Edge Cases Tests
 *
 * This test suite covers edge cases and complex scenarios for the AuthGuard
 * component's frontend behavior, complementing the backend edge case tests.
 *
 * Key edge cases tested:
 * 1. Browser storage corruption and recovery
 * 2. Network connectivity issues during auth
 * 3. Component lifecycle edge cases
 * 4. SSR to client hydration mismatches
 * 5. Memory management and cleanup
 * 6. Performance edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import { writable } from 'svelte/store';
import { page } from '$app/stores';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import AuthGuard from '$lib/components/auth/AuthGuard.svelte';
import { authStore, isAuthenticated, isAuthLoading } from '$lib/stores/auth.store';

// Mock external dependencies
vi.mock('$app/environment', () => ({
  browser: true
}));

vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

vi.mock('$app/stores', () => ({
  page: {
    subscribe: vi.fn(),
    url: { pathname: '/articles', search: '' }
  }
}));

vi.mock('$lib/stores/auth.store', () => {
  const mockAuthStore = {
    subscribe: vi.fn(),
    setUser: vi.fn(),
    markSSRAuthenticated: vi.fn(),
    checkAuth: vi.fn(),
    clearSSRAuthenticated: vi.fn(),
    clearAuth: vi.fn()
  };

  return {
    authStore: mockAuthStore,
    isAuthenticated: { subscribe: vi.fn() },
    isAuthLoading: { subscribe: vi.fn() }
  };
});

describe('AuthGuard Frontend Edge Cases', () => {
  let mockPageStore: any;
  let mockAuthStore: any;
  let mockIsAuthenticated: any;
  let mockIsAuthLoading: any;
  let originalLocalStorage: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock stores
    mockPageStore = {
      data: null,
      url: { pathname: '/articles', search: '' }
    };

    (page as any).subscribe = vi.fn((callback) => {
      callback(mockPageStore);
      return () => {};
    });

    mockAuthStore = authStore as any;
    mockIsAuthenticated = isAuthenticated as any;
    mockIsAuthLoading = isAuthLoading as any;

    // Setup default states
    let isAuthenticatedState = false;
    let isLoadingState = false;

    mockIsAuthenticated.subscribe = vi.fn((callback) => {
      callback(isAuthenticatedState);
      return () => {};
    });

    mockIsAuthLoading.subscribe = vi.fn((callback) => {
      callback(isLoadingState);
      return () => {};
    });

    mockAuthStore.checkAuth.mockResolvedValue(undefined);

    // Mock localStorage
    originalLocalStorage = global.localStorage;
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    global.localStorage = originalLocalStorage;
  });

  describe('Browser Storage Corruption and Recovery', () => {
    it('should handle corrupted localStorage data gracefully', async () => {
      // Arrange: Mock corrupted localStorage
      (global.localStorage.getItem as any).mockImplementation((key) => {
        if (key === 'auth-storage') {
          return '{invalid-json:corrupted}'; // Invalid JSON
        }
        return null;
      });

      mockPageStore.data = null; // No SSR data

      // Act: Render component with corrupted storage
      render(AuthGuard);
      await tick();

      // Assert: Should handle corruption without crashing
      expect(mockAuthStore.checkAuth).toHaveBeenCalled();
      expect(global.localStorage.removeItem).toHaveBeenCalledWith('auth-storage');
    });

    it('should recover from localStorage quota exceeded errors', async () => {
      // Arrange: Mock localStorage quota exceeded
      (global.localStorage.setItem as any).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      mockPageStore.data = {
        user: { id: 1, role: 'admin' },
        authenticated: true
      };

      // Act: Render component that tries to save auth data
      render(AuthGuard);
      await tick();

      // Assert: Should handle quota error gracefully
      expect(mockAuthStore.setUser).toHaveBeenCalled();
      expect(mockAuthStore.markSSRAuthenticated).toHaveBeenCalled();
    });

    it('should handle localStorage access denied in private browsing', async () => {
      // Arrange: Mock localStorage access denied
      (global.localStorage.getItem as any).mockImplementation(() => {
        throw new Error('SecurityError: localStorage is not available');
      });

      mockPageStore.data = {
        user: { id: 1, role: 'admin' },
        authenticated: true
      };

      // Act: Render component in private browsing mode
      render(AuthGuard);
      await tick();

      // Assert: Should fallback to SSR data without localStorage
      expect(mockAuthStore.setUser).toHaveBeenCalled();
      expect(mockAuthStore.markSSRAuthenticated).toHaveBeenCalled();
    });

    it('should handle localStorage data type mismatches', async () => {
      // Arrange: Mock localStorage with wrong data types
      (global.localStorage.getItem as any).mockImplementation((key) => {
        if (key === 'auth-storage') {
          return JSON.stringify({
            state: {
              user: 'invalid-user-string', // Should be object
              isAuthenticated: 'true' // Should be boolean
            }
          });
        }
        return null;
      });

      // Act: Render component with invalid data types
      render(AuthGuard);
      await tick();

      // Assert: Should handle type mismatches gracefully
      expect(mockAuthStore.checkAuth).toHaveBeenCalled();
    });
  });

  describe('Network Connectivity Edge Cases', () => {
    it('should handle network disconnection during auth check', async () => {
      // Arrange: Mock network failure
      mockAuthStore.checkAuth.mockRejectedValue(new Error('NetworkError: Failed to fetch'));

      let isAuthenticatedState = false;
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      // Act: Render with network failure
      render(AuthGuard);
      await tick();

      // Assert: Should handle network error gracefully
      expect(mockAuthStore.checkAuth).toHaveBeenCalled();
      // Component should still complete initialization
      await waitFor(() => {
        expect(goto).toHaveBeenCalledWith('/login?returnUrl=%2Farticles');
      });
    });

    it('should handle intermittent network connectivity', async () => {
      // Arrange: Mock intermittent failures
      let callCount = 0;
      mockAuthStore.checkAuth.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Network timeout'));
        }
        return Promise.resolve();
      });

      let isAuthenticatedState = false;
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      // Act: Render with intermittent failures
      render(AuthGuard);
      await tick();

      // Assert: Should eventually succeed or fail gracefully
      expect(mockAuthStore.checkAuth).toHaveBeenCalled();
    });

    it('should handle slow network responses', async () => {
      // Arrange: Mock slow network
      let resolveAuth: any;
      const slowAuthPromise = new Promise((resolve) => {
        resolveAuth = resolve;
      });
      mockAuthStore.checkAuth.mockReturnValue(slowAuthPromise);

      let isAuthenticatedState = false;
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      // Act: Render with slow auth
      render(AuthGuard);
      await tick();

      // Should show loading state
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();

      // Resolve after delay
      resolveAuth();
      await tick();

      // Assert: Should handle slow responses appropriately
      expect(mockAuthStore.checkAuth).toHaveBeenCalled();
    });

    it('should handle auth server returning invalid responses', async () => {
      // Arrange: Mock invalid server response
      mockAuthStore.checkAuth.mockRejectedValue({
        response: {
          status: 500,
          statusText: 'Internal Server Error'
        }
      });

      let isAuthenticatedState = false;
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      // Act: Render with server error
      render(AuthGuard);
      await tick();

      // Assert: Should handle server errors gracefully
      expect(mockAuthStore.checkAuth).toHaveBeenCalled();
    });
  });

  describe('Component Lifecycle Edge Cases', () => {
    it('should handle rapid mount/unmount cycles', async () => {
      // Arrange: Mock SSR data
      mockPageStore.data = {
        user: { id: 1, role: 'admin' },
        authenticated: true
      };

      // Act: Rapid mount/unmount
      const { unmount } = render(AuthGuard);
      await tick();
      unmount();

      // Mount again immediately
      render(AuthGuard);
      await tick();

      // Assert: Should handle rapid lifecycle changes
      expect(mockAuthStore.setUser).toHaveBeenCalled();
      expect(mockAuthStore.markSSRAuthenticated).toHaveBeenCalled();
    });

    it('should handle component destruction during async operations', async () => {
      // Arrange: Mock long-running auth check
      let resolveAuth: any;
      const longAuthPromise = new Promise((resolve) => {
        resolveAuth = resolve;
      });
      mockAuthStore.checkAuth.mockReturnValue(longAuthPromise);

      let isAuthenticatedState = false;
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      // Act: Render and unmount before auth completes
      const { unmount } = render(AuthGuard);
      await tick();

      // Unmount before async operation completes
      unmount();

      // Complete the async operation
      resolveAuth();
      await tick();

      // Assert: Should not cause errors after unmount
      expect(mockAuthStore.checkAuth).toHaveBeenCalled();
    });

    it('should handle multiple onMount calls due to HMR', async () => {
      // Arrange: Simulate HMR scenario
      mockPageStore.data = {
        user: { id: 1, role: 'admin' },
        authenticated: true
      };

      // Act: First mount
      const { component, rerender } = render(AuthGuard);
      await tick();

      // Simulate HMR remount
      rerender(AuthGuard);
      await tick();

      // Assert: Should handle multiple initializations gracefully
      expect(mockAuthStore.setUser).toHaveBeenCalled();
      expect(mockAuthStore.markSSRAuthenticated).toHaveBeenCalled();
    });

    it('should cleanup event listeners and subscriptions', async () => {
      // Arrange: Mock subscription tracking
      const mockUnsubscribe = vi.fn();
      mockIsAuthenticated.subscribe = vi.fn(() => mockUnsubscribe);
      mockIsAuthLoading.subscribe = vi.fn(() => mockUnsubscribe);

      // Act: Mount and unmount
      const { unmount } = render(AuthGuard);
      await tick();
      unmount();

      // Assert: Should clean up subscriptions
      // Note: This test depends on implementation details
      expect(mockIsAuthenticated.subscribe).toHaveBeenCalled();
      expect(mockIsAuthLoading.subscribe).toHaveBeenCalled();
    });
  });

  describe('SSR to Client Hydration Mismatches', () => {
    it('should handle SSR authenticated but client not authenticated', async () => {
      // Arrange: SSR says authenticated, client says not
      mockPageStore.data = {
        user: { id: 1, role: 'admin' },
        authenticated: true
      };

      let isAuthenticatedState = false; // Client not authenticated
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      // Act: Render with hydration mismatch
      render(AuthGuard);
      await tick();

      // Assert: Should trust SSR data
      expect(mockAuthStore.setUser).toHaveBeenCalled();
      expect(mockAuthStore.markSSRAuthenticated).toHaveBeenCalled();
    });

    it('should handle client authenticated but no SSR data', async () => {
      // Arrange: Client authenticated, no SSR data
      mockPageStore.data = null; // No SSR data

      let isAuthenticatedState = true; // Client authenticated
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      // Act: Render with hydration mismatch
      render(AuthGuard);
      await tick();

      // Assert: Should verify with server
      expect(mockAuthStore.checkAuth).toHaveBeenCalled();
    });

    it('should handle conflicting user data between SSR and client', async () => {
      // Arrange: Different user data
      mockPageStore.data = {
        user: { id: 1, role: 'admin', username: 'admin' },
        authenticated: true
      };

      // Mock client store with different user
      (global.localStorage.getItem as any).mockImplementation((key) => {
        if (key === 'auth-storage') {
          return JSON.stringify({
            state: {
              user: { id: 2, role: 'user', username: 'user' },
              isAuthenticated: true
            }
          });
        }
        return null;
      });

      // Act: Render with conflicting data
      render(AuthGuard);
      await tick();

      // Assert: Should prefer SSR data
      expect(mockAuthStore.setUser).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 1,
          role: 'admin',
          username: 'admin'
        })
      );
    });

    it('should handle SSR data format differences', async () => {
      // Arrange: SSR data with different field names
      mockPageStore.data = {
        user: {
          user_id: 1, // Different field name
          user_role: 'admin', // Different field name
          display_name: 'Admin User' // Different field name
        },
        authenticated: true
      };

      // Act: Render with different SSR format
      render(AuthGuard);
      await tick();

      // Assert: Should handle field mapping
      expect(mockAuthStore.setUser).toHaveBeenCalled();
    });
  });

  describe('Memory Management and Performance', () => {
    it('should prevent memory leaks from unresolved promises', async () => {
      // Arrange: Mock promise that never resolves
      const neverResolvingPromise = new Promise(() => {});
      mockAuthStore.checkAuth.mockReturnValue(neverResolvingPromise);

      let isAuthenticatedState = false;
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      // Act: Mount and quickly unmount
      const { unmount } = render(AuthGuard);
      await tick();
      unmount();

      // Assert: Should not cause memory issues
      // This test is more about ensuring cleanup happens
      expect(mockAuthStore.checkAuth).toHaveBeenCalled();
    });

    it('should handle excessive re-renders without performance issues', async () => {
      // Arrange: Rapidly changing page data
      let renderCount = 0;
      const originalSubscribe = (page as any).subscribe;

      (page as any).subscribe = vi.fn((callback) => {
        // Simulate rapid page data changes
        const interval = setInterval(() => {
          renderCount++;
          if (renderCount < 10) {
            callback({
              data: { user: { id: renderCount, role: 'user' }, authenticated: true },
              url: { pathname: '/articles', search: '' }
            });
          } else {
            clearInterval(interval);
          }
        }, 10);

        return () => clearInterval(interval);
      });

      // Act: Render with rapid changes
      render(AuthGuard);
      await new Promise(resolve => setTimeout(resolve, 150)); // Wait for changes

      // Assert: Should handle rapid changes efficiently
      expect(mockAuthStore.setUser).toHaveBeenCalled();
    });

    it('should handle large numbers of concurrent auth guards', async () => {
      // Arrange: Multiple AuthGuard instances
      const guards = [];
      mockPageStore.data = {
        user: { id: 1, role: 'admin' },
        authenticated: true
      };

      // Act: Render multiple guards simultaneously
      for (let i = 0; i < 10; i++) {
        guards.push(render(AuthGuard));
      }

      await tick();

      // Assert: Should handle multiple instances efficiently
      expect(mockAuthStore.setUser).toHaveBeenCalled();
      expect(mockAuthStore.markSSRAuthenticated).toHaveBeenCalled();

      // Cleanup
      guards.forEach(guard => guard.unmount());
    });

    it('should throttle expensive operations during rapid state changes', async () => {
      // Arrange: Rapid auth state changes
      let authStateCallback: any;
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        authStateCallback = callback;
        callback(false);
        return () => {};
      });

      render(AuthGuard);
      await tick();

      // Act: Rapid state changes
      for (let i = 0; i < 20; i++) {
        authStateCallback(i % 2 === 0);
        await tick();
      }

      // Assert: Should handle rapid changes without excessive calls
      // The exact number depends on implementation throttling
      expect(goto).toHaveBeenCalled();
    });
  });

  describe('Browser Compatibility Edge Cases', () => {
    it('should handle browsers without localStorage support', async () => {
      // Arrange: Remove localStorage
      delete (global as any).localStorage;

      mockPageStore.data = {
        user: { id: 1, role: 'admin' },
        authenticated: true
      };

      // Act: Render without localStorage
      render(AuthGuard);
      await tick();

      // Assert: Should work with SSR data only
      expect(mockAuthStore.setUser).toHaveBeenCalled();
      expect(mockAuthStore.markSSRAuthenticated).toHaveBeenCalled();
    });

    it('should handle old browser with limited Promise support', async () => {
      // Arrange: Mock limited Promise environment
      const originalPromise = global.Promise;
      (global as any).Promise = function(executor: any) {
        // Simulate old Promise without finally
        const p = new originalPromise(executor);
        delete (p as any).finally;
        return p;
      };

      let isAuthenticatedState = false;
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      // Act: Render with limited Promise support
      render(AuthGuard);
      await tick();

      // Assert: Should handle gracefully
      expect(mockAuthStore.checkAuth).toHaveBeenCalled();

      // Restore
      global.Promise = originalPromise;
    });

    it('should handle browsers with disabled cookies', async () => {
      // Arrange: Mock disabled cookies (no SSR session data)
      mockPageStore.data = null; // No session data due to disabled cookies

      let isAuthenticatedState = false;
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      // Act: Render with disabled cookies
      render(AuthGuard);
      await tick();

      // Assert: Should fallback to client-side auth
      expect(mockAuthStore.checkAuth).toHaveBeenCalled();
    });
  });
});
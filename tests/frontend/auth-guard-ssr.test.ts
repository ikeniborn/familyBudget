/**
 * AuthGuard SSR Authentication Fix Tests
 *
 * This test suite validates the AuthGuard component's authentication handling,
 * specifically testing the fix for redundant authentication checks and proper
 * SSR data usage that resolves the 401 errors on articles page.
 *
 * Key behaviors tested:
 * 1. SSR authentication data is properly trusted
 * 2. No redundant checkAuth() calls are made when SSR data is present
 * 3. Proper fallback to client-side auth when SSR data is missing
 * 4. Correct loading states and user experience
 * 5. Edge cases (missing data, expired sessions, role changes)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
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
    clearSSRAuthenticated: vi.fn()
  };

  return {
    authStore: mockAuthStore,
    isAuthenticated: { subscribe: vi.fn() },
    isAuthLoading: { subscribe: vi.fn() }
  };
});

describe('AuthGuard SSR Authentication Fix', () => {
  let mockPageStore: any;
  let mockAuthStore: any;
  let mockIsAuthenticated: any;
  let mockIsAuthLoading: any;
  let authCheckSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock page store
    mockPageStore = {
      data: null,
      url: { pathname: '/articles', search: '' }
    };

    const pageSubscribe = vi.fn((callback) => {
      callback(mockPageStore);
      return () => {};
    });

    (page as any).subscribe = pageSubscribe;

    // Setup mock auth stores
    mockAuthStore = authStore as any;
    mockIsAuthenticated = isAuthenticated as any;
    mockIsAuthLoading = isAuthLoading as any;

    // Setup default auth states
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

    // Spy on checkAuth to verify it's not called redundantly
    authCheckSpy = vi.spyOn(mockAuthStore, 'checkAuth');
    authCheckSpy.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SSR Authentication Data Handling', () => {
    it('should trust SSR authentication data and not call checkAuth()', async () => {
      // Arrange: Provide valid SSR auth data
      mockPageStore.data = {
        user: {
          id: 1,
          user_id: 1,
          user_name: 'Test User',
          username: 'testuser',
          role: 'admin',
          telegram_id: 123456789,
          first_name: 'Test',
          last_name: 'User',
          auth_method: 'password'
        },
        authenticated: true
      };

      // Act: Render AuthGuard with SSR data
      const { component } = render(AuthGuard, {
        props: {}
      });

      await tick();
      await waitFor(() => {
        expect(mockAuthStore.setUser).toHaveBeenCalledWith({
          user_id: 1,
          user_name: 'Test User',
          user_telegram_id: 123456789,
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser',
          authMethod: 'password',
          role: 'admin'
        });
      });

      // Assert: SSR authentication was marked and checkAuth was not called
      expect(mockAuthStore.markSSRAuthenticated).toHaveBeenCalled();
      expect(authCheckSpy).not.toHaveBeenCalled();
    });

    it('should handle SSR auth data with user_id field mapping correctly', async () => {
      // Arrange: SSR data uses different field names
      mockPageStore.data = {
        user: {
          user_id: 42, // Different field name
          user_name: 'Admin User',
          username: 'admin',
          role: 'admin',
          telegram_id: null,
          first_name: 'Admin',
          last_name: 'User',
          auth_method: 'password'
        },
        authenticated: true
      };

      // Act
      render(AuthGuard);
      await tick();

      await waitFor(() => {
        expect(mockAuthStore.setUser).toHaveBeenCalledWith({
          user_id: 42, // Should use user_id when id is not present
          user_name: 'Admin User',
          user_telegram_id: null,
          first_name: 'Admin',
          last_name: 'User',
          username: 'admin',
          authMethod: 'password',
          role: 'admin'
        });
      });

      expect(mockAuthStore.markSSRAuthenticated).toHaveBeenCalled();
      expect(authCheckSpy).not.toHaveBeenCalled();
    });

    it('should skip redundant auth check when already SSR-authenticated', async () => {
      // Arrange: Mock localStorage with existing auth + SSR data
      let isAuthenticatedState = true;
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      mockPageStore.data = {
        authenticated: true
      };

      // Act
      render(AuthGuard);
      await tick();

      // Assert: No checkAuth call should be made
      expect(authCheckSpy).not.toHaveBeenCalled();
    });
  });

  describe('Client-Side Authentication Fallback', () => {
    it('should call checkAuth() when authenticated in localStorage but no SSR data', async () => {
      // Arrange: User authenticated locally but no SSR validation
      let isAuthenticatedState = true;
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      mockPageStore.data = null; // No SSR data

      // Act
      render(AuthGuard);
      await tick();

      // Assert: Should verify auth with server
      expect(authCheckSpy).toHaveBeenCalledOnce();
    });

    it('should call checkAuth() when not authenticated and no SSR data', async () => {
      // Arrange: No authentication state
      let isAuthenticatedState = false;
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      mockPageStore.data = null;

      // Act
      render(AuthGuard);
      await tick();

      // Assert: Should check auth with server
      expect(authCheckSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Loading States and User Experience', () => {
    it('should show loading spinner while auth is being checked', async () => {
      // Arrange: Auth loading state
      let isLoadingState = true;
      mockIsAuthLoading.subscribe = vi.fn((callback) => {
        callback(isLoadingState);
        return () => {};
      });

      // Act
      render(AuthGuard);

      // Assert: Loading spinner should be visible
      const loadingSpinner = screen.getByRole('status', { hidden: true });
      expect(loadingSpinner).toBeInTheDocument();
    });

    it('should show loading spinner while client auth is not ready', async () => {
      // Arrange: Component mounted but client auth not ready
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

      // Act: Render before onMount completes
      render(AuthGuard);

      // Assert: Should show loading state
      const loadingSpinner = screen.getByRole('status', { hidden: true });
      expect(loadingSpinner).toBeInTheDocument();
    });

    it('should render slot content when authenticated and ready', async () => {
      // Arrange: Authenticated state
      let isAuthenticatedState = true;
      let isLoadingState = false;

      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      mockIsAuthLoading.subscribe = vi.fn((callback) => {
        callback(isLoadingState);
        return () => {};
      });

      mockPageStore.data = {
        user: { id: 1, role: 'user' },
        authenticated: true
      };

      // Act
      const { container } = render(AuthGuard, {
        props: {},
        $$slots: {
          default: '<div data-testid="protected-content">Protected Content</div>'
        }
      });

      await tick();
      await waitFor(() => {
        const protectedContent = screen.getByTestId('protected-content');
        expect(protectedContent).toBeInTheDocument();
      });
    });
  });

  describe('Authentication Error Handling', () => {
    it('should handle checkAuth() failures gracefully', async () => {
      // Arrange: checkAuth fails
      authCheckSpy.mockRejectedValue(new Error('Network error'));

      let isAuthenticatedState = false;
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      // Act
      render(AuthGuard);
      await tick();

      // Assert: Should handle error without breaking
      expect(authCheckSpy).toHaveBeenCalled();
      // Component should still be ready even after error
      await waitFor(() => {
        expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
      });
    });

    it('should redirect to login when not authenticated after auth check', async () => {
      // Arrange: Not authenticated after check
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

      // Act
      render(AuthGuard);
      await tick();

      // Allow component to complete auth check
      await waitFor(() => {
        expect(goto).toHaveBeenCalledWith('/login?returnUrl=%2Farticles');
      });
    });
  });

  describe('Edge Cases and Data Validation', () => {
    it('should handle malformed SSR data gracefully', async () => {
      // Arrange: Invalid SSR data
      mockPageStore.data = {
        user: null, // Invalid user data
        authenticated: true
      };

      // Act
      render(AuthGuard);
      await tick();

      // Assert: Should not call setUser with invalid data
      expect(mockAuthStore.setUser).not.toHaveBeenCalled();
      expect(mockAuthStore.markSSRAuthenticated).not.toHaveBeenCalled();
    });

    it('should handle missing role in SSR data with fallback', async () => {
      // Arrange: SSR data missing role
      mockPageStore.data = {
        user: {
          id: 1,
          user_name: 'Test User',
          username: 'testuser',
          // role is missing
          telegram_id: 123456789,
          first_name: 'Test',
          last_name: 'User',
          auth_method: 'password'
        },
        authenticated: true
      };

      // Act
      render(AuthGuard);
      await tick();

      await waitFor(() => {
        expect(mockAuthStore.setUser).toHaveBeenCalledWith({
          user_id: 1,
          user_name: 'Test User',
          user_telegram_id: 123456789,
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser',
          authMethod: 'password',
          role: 'user' // Should default to 'user'
        });
      });
    });

    it('should handle SSR data with empty user object', async () => {
      // Arrange: Empty user object
      mockPageStore.data = {
        user: {},
        authenticated: true
      };

      // Act
      render(AuthGuard);
      await tick();

      // Assert: Should not proceed with empty user data
      expect(mockAuthStore.setUser).not.toHaveBeenCalled();
      expect(mockAuthStore.markSSRAuthenticated).not.toHaveBeenCalled();
    });

    it('should handle SSR authentication without user object', async () => {
      // Arrange: Authenticated but no user data
      mockPageStore.data = {
        authenticated: true
        // user is missing
      };

      let isAuthenticatedState = true;
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      // Act
      render(AuthGuard);
      await tick();

      // Assert: Should trust SSR authentication without calling checkAuth
      expect(authCheckSpy).not.toHaveBeenCalled();
      expect(mockAuthStore.setUser).not.toHaveBeenCalled();
    });
  });

  describe('Browser Environment Handling', () => {
    it('should handle server-side rendering (non-browser) environment', async () => {
      // Arrange: Mock server environment
      vi.mocked(browser, true).mockReturnValue(false);

      let isAuthenticatedState = false;
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      // Act
      render(AuthGuard);
      await tick();

      // Assert: Should not attempt client-side auth check in SSR
      expect(authCheckSpy).not.toHaveBeenCalled();
    });
  });

  describe('Performance and Redundancy Prevention', () => {
    it('should not make multiple auth checks when component re-renders', async () => {
      // Arrange: Component with stable props
      mockPageStore.data = {
        user: { id: 1, role: 'user' },
        authenticated: true
      };

      // Act: Render and re-render
      const { rerender } = render(AuthGuard);
      await tick();

      rerender(AuthGuard);
      await tick();

      // Assert: Should only call auth methods once
      expect(mockAuthStore.setUser).toHaveBeenCalledTimes(1);
      expect(mockAuthStore.markSSRAuthenticated).toHaveBeenCalledTimes(1);
      expect(authCheckSpy).not.toHaveBeenCalled();
    });

    it('should prevent redundant checkAuth calls with proper flag management', async () => {
      // Arrange: Multiple conditions that could trigger checkAuth
      let isAuthenticatedState = false;
      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        callback(isAuthenticatedState);
        return () => {};
      });

      mockPageStore.data = null;

      // Act: Render component
      render(AuthGuard);
      await tick();

      // Simulate component update
      await tick();

      // Assert: checkAuth should only be called once
      expect(authCheckSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration with Authentication Store', () => {
    it('should properly integrate with auth store state management', async () => {
      // Arrange: SSR data that should update store
      mockPageStore.data = {
        user: {
          id: 123,
          user_name: 'Integration Test User',
          username: 'integration',
          role: 'admin',
          telegram_id: 987654321,
          first_name: 'Integration',
          last_name: 'Test',
          auth_method: 'telegram'
        },
        authenticated: true
      };

      // Act
      render(AuthGuard);
      await tick();

      // Assert: Store methods called with correct data
      await waitFor(() => {
        expect(mockAuthStore.setUser).toHaveBeenCalledWith({
          user_id: 123,
          user_name: 'Integration Test User',
          user_telegram_id: 987654321,
          first_name: 'Integration',
          last_name: 'Test',
          username: 'integration',
          authMethod: 'telegram',
          role: 'admin'
        });
      });

      expect(mockAuthStore.markSSRAuthenticated).toHaveBeenCalledOnce();
    });

    it('should handle auth store state changes during mount', async () => {
      // Arrange: Auth state changes during component lifecycle
      let isAuthenticatedState = false;
      let stateChangeCallback: any;

      mockIsAuthenticated.subscribe = vi.fn((callback) => {
        stateChangeCallback = callback;
        callback(isAuthenticatedState);
        return () => {};
      });

      // Act: Render component
      render(AuthGuard);
      await tick();

      // Simulate auth state change during mount
      isAuthenticatedState = true;
      stateChangeCallback(true);
      await tick();

      // Assert: Should handle state changes gracefully
      expect(mockAuthStore.setUser).toHaveBeenCalled();
    });
  });
});
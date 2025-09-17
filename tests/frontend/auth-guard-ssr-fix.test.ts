/**
 * Unit tests for AuthGuard SSR authentication fix
 * Tests the fix for avoiding redundant client-side authentication checks
 * when user is already authenticated via SSR
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import AuthGuard from '$lib/components/auth/AuthGuard.svelte';

// Mock Svelte stores and dependencies
const mockPage = writable({
  data: null,
  url: { pathname: '/settings/articles', search: '' }
});

const mockIsAuthenticated = writable(false);
const mockIsAuthLoading = writable(false);

const mockAuthStore = {
  setUser: vi.fn(),
  checkAuth: vi.fn(),
  markSSRAuthenticated: vi.fn(),
  clearSSRAuthenticated: vi.fn()
};

const mockGoto = vi.fn();

// Mock modules
vi.mock('$app/stores', () => ({
  page: mockPage
}));

vi.mock('$app/environment', () => ({
  browser: true
}));

vi.mock('$app/navigation', () => ({
  goto: mockGoto
}));

vi.mock('$lib/stores/auth.store', () => ({
  isAuthenticated: mockIsAuthenticated,
  isAuthLoading: mockIsAuthLoading,
  authStore: mockAuthStore
}));

describe('AuthGuard SSR Authentication Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPage.set({
      data: null,
      url: { pathname: '/settings/articles', search: '' }
    });
    mockIsAuthenticated.set(false);
    mockIsAuthLoading.set(false);
  });

  describe('SSR Authentication Trust', () => {
    it('should trust SSR authentication data and avoid checkAuth() call', async () => {
      // Setup SSR authentication data
      const ssrAuthData = {
        user: {
          id: 1,
          user_id: 1,
          user_name: 'Test Admin',
          username: 'admin',
          role: 'admin',
          auth_method: 'password',
          telegram_id: null,
          first_name: 'Test',
          last_name: 'Admin'
        },
        authenticated: true
      };

      mockPage.set({
        data: ssrAuthData,
        url: { pathname: '/settings/articles', search: '' }
      });

      const { component } = render(AuthGuard, {
        props: {},
        context: new Map([
          ['$$slots', { default: [() => 'Protected content'] }]
        ])
      });

      // Wait for component to mount and process
      await waitFor(() => {
        expect(mockAuthStore.setUser).toHaveBeenCalledWith({
          user_id: 1,
          user_name: 'Test Admin',
          user_telegram_id: null,
          first_name: 'Test',
          last_name: 'Admin',
          username: 'admin',
          authMethod: 'password',
          role: 'admin'
        });
      });

      // Verify SSR authentication was marked
      expect(mockAuthStore.markSSRAuthenticated).toHaveBeenCalled();

      // Verify checkAuth() was NOT called (this is the fix)
      expect(mockAuthStore.checkAuth).not.toHaveBeenCalled();
    });

    it('should call checkAuth() when no SSR data available', async () => {
      // Setup: User authenticated from localStorage but no SSR data
      mockIsAuthenticated.set(true);
      mockPage.set({
        data: null, // No SSR data
        url: { pathname: '/settings/articles', search: '' }
      });

      render(AuthGuard, {
        props: {},
        context: new Map([
          ['$$slots', { default: [() => 'Protected content'] }]
        ])
      });

      // Wait for component to mount and process
      await waitFor(() => {
        expect(mockAuthStore.checkAuth).toHaveBeenCalled();
      });

      // Verify SSR methods were NOT called
      expect(mockAuthStore.setUser).not.toHaveBeenCalled();
      expect(mockAuthStore.markSSRAuthenticated).not.toHaveBeenCalled();
    });

    it('should skip checkAuth() when both localStorage and SSR indicate authentication', async () => {
      // Setup: User authenticated from both localStorage AND SSR
      mockIsAuthenticated.set(true);
      const ssrAuthData = {
        user: {
          id: 1,
          username: 'admin',
          role: 'admin'
        },
        authenticated: true
      };

      mockPage.set({
        data: ssrAuthData,
        url: { pathname: '/settings/articles', search: '' }
      });

      render(AuthGuard, {
        props: {},
        context: new Map([
          ['$$slots', { default: [() => 'Protected content'] }]
        ])
      });

      // Wait for component to mount and process
      await waitFor(() => {
        expect(mockAuthStore.setUser).toHaveBeenCalled();
        expect(mockAuthStore.markSSRAuthenticated).toHaveBeenCalled();
      });

      // This is the key test: checkAuth should NOT be called
      expect(mockAuthStore.checkAuth).not.toHaveBeenCalled();
    });
  });

  describe('Malformed SSR Data Handling', () => {
    it('should handle malformed SSR data gracefully', async () => {
      const malformedSSRData = {
        user: null, // Malformed: user is null
        authenticated: true
      };

      mockPage.set({
        data: malformedSSRData,
        url: { pathname: '/settings/articles', search: '' }
      });

      render(AuthGuard, {
        props: {},
        context: new Map([
          ['$$slots', { default: [() => 'Protected content'] }]
        ])
      });

      // Should not try to set malformed user data
      expect(mockAuthStore.setUser).not.toHaveBeenCalled();
      expect(mockAuthStore.markSSRAuthenticated).not.toHaveBeenCalled();
    });

    it('should handle missing authentication flag in SSR data', async () => {
      const incompleteSSRData = {
        user: {
          id: 1,
          username: 'admin',
          role: 'admin'
        }
        // Missing authenticated: true
      };

      mockPage.set({
        data: incompleteSSRData,
        url: { pathname: '/settings/articles', search: '' }
      });

      render(AuthGuard, {
        props: {},
        context: new Map([
          ['$$slots', { default: [() => 'Protected content'] }]
        ])
      });

      // Should not process incomplete SSR data
      expect(mockAuthStore.setUser).not.toHaveBeenCalled();
      expect(mockAuthStore.markSSRAuthenticated).not.toHaveBeenCalled();
    });
  });

  describe('Role Preservation', () => {
    it('should preserve admin role from SSR data', async () => {
      const adminSSRData = {
        user: {
          id: 1,
          user_id: 1,
          username: 'admin',
          user_name: 'Administrator',
          role: 'admin',
          auth_method: 'password'
        },
        authenticated: true
      };

      mockPage.set({
        data: adminSSRData,
        url: { pathname: '/settings/articles', search: '' }
      });

      render(AuthGuard, {
        props: {},
        context: new Map([
          ['$$slots', { default: [() => 'Protected content'] }]
        ])
      });

      await waitFor(() => {
        expect(mockAuthStore.setUser).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'admin'
          })
        );
      });
    });

    it('should default to user role when role is missing', async () => {
      const noRoleSSRData = {
        user: {
          id: 1,
          user_id: 1,
          username: 'user1',
          user_name: 'Regular User',
          auth_method: 'password'
          // Missing role field
        },
        authenticated: true
      };

      mockPage.set({
        data: noRoleSSRData,
        url: { pathname: '/settings/articles', search: '' }
      });

      render(AuthGuard, {
        props: {},
        context: new Map([
          ['$$slots', { default: [() => 'Protected content'] }]
        ])
      });

      await waitFor(() => {
        expect(mockAuthStore.setUser).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'user'
          })
        );
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading spinner when authentication is in progress', () => {
      mockIsAuthLoading.set(true);

      const { container } = render(AuthGuard, {
        props: {},
        context: new Map([
          ['$$slots', { default: [() => 'Protected content'] }]
        ])
      });

      // Should show loading spinner
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeTruthy();
    });

    it('should render protected content when authenticated', async () => {
      mockIsAuthenticated.set(true);
      mockIsAuthLoading.set(false);

      const { getByText } = render(AuthGuard, {
        props: {},
        context: new Map([
          ['$$slots', { default: [() => 'Protected content'] }]
        ])
      });

      // Should render the slot content
      expect(getByText('Protected content')).toBeTruthy();
    });
  });

  describe('Redirect Behavior', () => {
    it('should redirect to login when not authenticated', async () => {
      mockIsAuthenticated.set(false);
      mockIsAuthLoading.set(false);

      mockPage.set({
        data: null,
        url: { pathname: '/settings/articles', search: '?filter=active' }
      });

      render(AuthGuard, {
        props: {},
        context: new Map([
          ['$$slots', { default: [() => 'Protected content'] }]
        ])
      });

      // Wait for redirect logic to execute
      await waitFor(() => {
        expect(mockGoto).toHaveBeenCalledWith(
          '/login?returnUrl=%2Fsettings%2Farticles%3Ffilter%3Dactive'
        );
      });
    });
  });

  describe('Performance Optimization', () => {
    it('should minimize authentication-related operations for SSR users', async () => {
      const ssrAuthData = {
        user: {
          id: 1,
          username: 'admin',
          role: 'admin'
        },
        authenticated: true
      };

      mockPage.set({
        data: ssrAuthData,
        url: { pathname: '/settings/articles', search: '' }
      });

      const startTime = performance.now();

      render(AuthGuard, {
        props: {},
        context: new Map([
          ['$$slots', { default: [() => 'Protected content'] }]
        ])
      });

      await waitFor(() => {
        expect(mockAuthStore.setUser).toHaveBeenCalled();
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should be fast since no API calls are made
      expect(executionTime).toBeLessThan(100); // Less than 100ms

      // Verify no expensive operations
      expect(mockAuthStore.checkAuth).not.toHaveBeenCalled();
    });
  });
});
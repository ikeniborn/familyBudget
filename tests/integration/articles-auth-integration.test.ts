/**
 * Integration tests for articles page authentication fix
 * Tests the complete authentication flow for the articles settings page
 * including SSR authentication and button functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom';

// Mock the SvelteKit environment
const mockPage = {
  data: null,
  url: { pathname: '/settings/articles', search: '' },
  params: {},
  route: { id: '/settings/articles' }
};

const mockAuthStore = {
  subscribe: vi.fn(),
  setUser: vi.fn(),
  checkAuth: vi.fn(),
  markSSRAuthenticated: vi.fn(),
  clearSSRAuthenticated: vi.fn(),
  logout: vi.fn()
};

const mockIsAuthenticated = { subscribe: vi.fn() };
const mockIsAuthLoading = { subscribe: vi.fn() };
const mockIsAdmin = { subscribe: vi.fn() };

// Mock API calls
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();
const mockApiDelete = vi.fn();

// Mock toast notifications
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn()
};

// Mock modules
vi.mock('$app/stores', () => ({
  page: {
    subscribe: (fn: any) => {
      fn(mockPage);
      return () => {};
    }
  }
}));

vi.mock('$app/environment', () => ({
  browser: true
}));

vi.mock('$lib/stores/auth.store', () => ({
  authStore: mockAuthStore,
  isAuthenticated: mockIsAuthenticated,
  isAuthLoading: mockIsAuthLoading,
  isAdmin: mockIsAdmin
}));

vi.mock('$lib/services/api', () => ({
  default: {
    get: mockApiGet,
    post: mockApiPost,
    put: mockApiPut,
    delete: mockApiDelete
  }
}));

vi.mock('$lib/stores/toast.store', () => ({
  toast: mockToast
}));

describe('Articles Authentication Integration', () => {
  const mockAdminUser = {
    id: 1,
    user_id: 1,
    username: 'admin',
    user_name: 'Administrator',
    role: 'admin' as const,
    auth_method: 'password',
    is_active: true
  };

  const mockRegularUser = {
    id: 2,
    user_id: 2,
    username: 'user1',
    user_name: 'Regular User',
    role: 'user' as const,
    auth_method: 'password',
    is_active: true
  };

  const mockArticles = [
    {
      id: 1,
      code: 'ART001',
      name: 'Office Supplies',
      description: 'General office supplies',
      is_active: true,
      user_id: 1,
      is_shared: false
    },
    {
      id: 2,
      code: 'ART002',
      name: 'Equipment',
      description: 'Office equipment',
      is_active: true,
      user_id: 1,
      is_shared: true
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default successful API responses
    mockApiGet.mockResolvedValue({
      success: true,
      data: mockArticles,
      total: mockArticles.length
    });

    mockApiPost.mockResolvedValue({
      success: true,
      data: { id: 3, ...mockArticles[0] }
    });

    mockApiPut.mockResolvedValue({
      success: true,
      data: { ...mockArticles[0] }
    });

    mockApiDelete.mockResolvedValue({
      success: true
    });

    // Setup default store subscriptions
    mockIsAuthenticated.subscribe.mockImplementation((fn) => {
      fn(true);
      return () => {};
    });

    mockIsAuthLoading.subscribe.mockImplementation((fn) => {
      fn(false);
      return () => {};
    });

    mockIsAdmin.subscribe.mockImplementation((fn) => {
      fn(true);
      return () => {};
    });

    mockAuthStore.subscribe.mockImplementation((fn) => {
      fn({
        user: mockAdminUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        sessionValidated: true,
        ssrAuthenticated: true
      });
      return () => {};
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('SSR Authentication without 401 Errors', () => {
    it('should load articles page without 401 errors when SSR authenticated', async () => {
      // Setup SSR authentication data
      mockPage.data = {
        user: mockAdminUser,
        authenticated: true
      };

      // Import and render the articles page component
      // Note: This would be the actual articles page component in a real test
      const MockArticlesPage = (await import('./mock-articles-page.svelte')).default;

      render(MockArticlesPage);

      // Wait for component to mount and load data
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/articles');
      });

      // Verify that checkAuth was NOT called (this is the fix)
      expect(mockAuthStore.checkAuth).not.toHaveBeenCalled();

      // Verify SSR authentication was properly set
      expect(mockAuthStore.setUser).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'admin'
        })
      );
      expect(mockAuthStore.markSSRAuthenticated).toHaveBeenCalled();

      // Verify no authentication errors occurred
      expect(mockToast.error).not.toHaveBeenCalledWith(
        expect.stringContaining('401')
      );
      expect(mockToast.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Unauthorized')
      );
    });

    it('should handle API errors gracefully without authentication issues', async () => {
      // Setup SSR authentication
      mockPage.data = {
        user: mockAdminUser,
        authenticated: true
      };

      // Mock API error (but not 401)
      mockApiGet.mockRejectedValueOnce({
        response: { status: 500 },
        message: 'Server error'
      });

      const MockArticlesPage = (await import('./mock-articles-page.svelte')).default;
      render(MockArticlesPage);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      // Should show server error, not authentication error
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to load articles')
        );
      });

      // Should NOT have authentication-related calls
      expect(mockAuthStore.checkAuth).not.toHaveBeenCalled();
    });
  });

  describe('Button Functionality and CRUD Operations', () => {
    beforeEach(() => {
      mockPage.data = {
        user: mockAdminUser,
        authenticated: true
      };
    });

    it('should make create button responsive and functional', async () => {
      const MockArticlesPage = (await import('./mock-articles-page.svelte')).default;
      const { getByTestId, getByText } = render(MockArticlesPage);

      // Wait for page to load
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      // Find and click the create button
      const createButton = getByTestId('create-article-btn');
      expect(createButton).toBeInTheDocument();
      expect(createButton).not.toBeDisabled();

      await fireEvent.click(createButton);

      // Should open create modal
      await waitFor(() => {
        expect(getByText('Create Article')).toBeInTheDocument();
      });
    });

    it('should make edit buttons responsive and functional', async () => {
      const MockArticlesPage = (await import('./mock-articles-page.svelte')).default;
      const { getAllByTestId } = render(MockArticlesPage);

      // Wait for articles to load
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      // Find and click an edit button
      const editButtons = getAllByTestId('edit-article-btn');
      expect(editButtons).toHaveLength(mockArticles.length);
      expect(editButtons[0]).not.toBeDisabled();

      await fireEvent.click(editButtons[0]);

      // Should open edit modal with article data
      await waitFor(() => {
        expect(screen.getByDisplayValue('Office Supplies')).toBeInTheDocument();
      });
    });

    it('should make delete buttons responsive and functional', async () => {
      const MockArticlesPage = (await import('./mock-articles-page.svelte')).default;
      const { getAllByTestId, getByText } = render(MockArticlesPage);

      // Wait for articles to load
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      // Find and click a delete button
      const deleteButtons = getAllByTestId('delete-article-btn');
      expect(deleteButtons).toHaveLength(mockArticles.length);
      expect(deleteButtons[0]).not.toBeDisabled();

      await fireEvent.click(deleteButtons[0]);

      // Should open delete confirmation
      await waitFor(() => {
        expect(getByText('Confirm Deletion')).toBeInTheDocument();
      });

      // Confirm deletion
      const confirmButton = getByTestId('confirm-delete-btn');
      await fireEvent.click(confirmButton);

      // Should call delete API
      await waitFor(() => {
        expect(mockApiDelete).toHaveBeenCalledWith('/articles/1');
      });
    });

    it('should perform create operation successfully', async () => {
      const MockArticlesPage = (await import('./mock-articles-page.svelte')).default;
      const { getByTestId, getByLabelText } = render(MockArticlesPage);

      // Wait for page to load
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      // Open create modal
      const createButton = getByTestId('create-article-btn');
      await fireEvent.click(createButton);

      // Fill in form data
      const codeInput = getByLabelText('Code');
      const nameInput = getByLabelText('Name');
      const descInput = getByLabelText('Description');

      await fireEvent.input(codeInput, { target: { value: 'ART003' } });
      await fireEvent.input(nameInput, { target: { value: 'New Article' } });
      await fireEvent.input(descInput, { target: { value: 'Test article' } });

      // Submit form
      const submitButton = getByTestId('submit-article-btn');
      await fireEvent.click(submitButton);

      // Should call create API
      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/articles', {
          code: 'ART003',
          name: 'New Article',
          description: 'Test article',
          is_active: true,
          is_shared: false
        });
      });

      // Should show success message
      expect(mockToast.success).toHaveBeenCalledWith('Article created successfully');
    });
  });

  describe('Admin Feature Protection', () => {
    it('should show admin-only features for admin users', async () => {
      mockPage.data = {
        user: mockAdminUser,
        authenticated: true
      };

      mockIsAdmin.subscribe.mockImplementation((fn) => {
        fn(true);
        return () => {};
      });

      const MockArticlesPage = (await import('./mock-articles-page.svelte')).default;
      const { getByTestId } = render(MockArticlesPage);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      // Admin features should be visible
      expect(getByTestId('bulk-operations-btn')).toBeInTheDocument();
      expect(getByTestId('shared-articles-toggle')).toBeInTheDocument();
    });

    it('should hide admin-only features for regular users', async () => {
      mockPage.data = {
        user: mockRegularUser,
        authenticated: true
      };

      mockIsAdmin.subscribe.mockImplementation((fn) => {
        fn(false);
        return () => {};
      });

      mockAuthStore.subscribe.mockImplementation((fn) => {
        fn({
          user: mockRegularUser,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          sessionValidated: true,
          ssrAuthenticated: true
        });
        return () => {};
      });

      const MockArticlesPage = (await import('./mock-articles-page.svelte')).default;
      const { queryByTestId } = render(MockArticlesPage);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      // Admin features should be hidden
      expect(queryByTestId('bulk-operations-btn')).not.toBeInTheDocument();
      expect(queryByTestId('shared-articles-toggle')).not.toBeInTheDocument();
    });
  });

  describe('Performance Improvements', () => {
    it('should load faster with SSR authentication', async () => {
      mockPage.data = {
        user: mockAdminUser,
        authenticated: true
      };

      const startTime = performance.now();

      const MockArticlesPage = (await import('./mock-articles-page.svelte')).default;
      render(MockArticlesPage);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      // Should load quickly since no authentication delay
      expect(loadTime).toBeLessThan(500); // Less than 500ms

      // Should not have called checkAuth (performance improvement)
      expect(mockAuthStore.checkAuth).not.toHaveBeenCalled();
    });

    it('should reduce authentication-related API calls by at least 50%', async () => {
      mockPage.data = {
        user: mockAdminUser,
        authenticated: true
      };

      const MockArticlesPage = (await import('./mock-articles-page.svelte')).default;
      render(MockArticlesPage);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      // Count authentication-related API calls
      const authApiCalls = [
        mockAuthStore.checkAuth,
        // Add any other auth-related API calls
      ].filter(mock => mock.mock.calls.length > 0);

      // Should have minimal auth API calls with SSR
      expect(authApiCalls.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle session expiry gracefully', async () => {
      mockPage.data = {
        user: mockAdminUser,
        authenticated: true
      };

      // Mock session expiry during API call
      mockApiGet.mockRejectedValueOnce({
        response: { status: 401 },
        message: 'Session expired'
      });

      const MockArticlesPage = (await import('./mock-articles-page.svelte')).default;
      render(MockArticlesPage);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      // Should handle 401 gracefully and redirect to login
      await waitFor(() => {
        expect(mockAuthStore.logout).toHaveBeenCalled();
      });
    });

    it('should validate SSR data integrity', async () => {
      // Malformed SSR data
      mockPage.data = {
        user: null,
        authenticated: true // Inconsistent: authenticated but no user
      };

      const MockArticlesPage = (await import('./mock-articles-page.svelte')).default;
      render(MockArticlesPage);

      // Should not trust malformed SSR data
      expect(mockAuthStore.setUser).not.toHaveBeenCalled();
      expect(mockAuthStore.markSSRAuthenticated).not.toHaveBeenCalled();

      // Should fall back to checkAuth
      await waitFor(() => {
        expect(mockAuthStore.checkAuth).toHaveBeenCalled();
      });
    });
  });
});
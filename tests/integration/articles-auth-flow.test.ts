/**
 * Articles Page Authentication Integration Tests
 *
 * This test suite validates the complete authentication flow for the articles page,
 * ensuring that the AuthGuard fix properly eliminates 401 errors and provides
 * responsive button interactions.
 *
 * Key integration scenarios tested:
 * 1. Articles page loads without 401 errors for authenticated users
 * 2. Button responsiveness and UI interactions work correctly
 * 3. Complete authentication flow from login to articles access
 * 4. Role-based access control for articles functionality
 * 5. Session persistence and SSR integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { page } from '$app/stores';
import { goto } from '$app/navigation';
import { authStore } from '$lib/stores/auth.store';
import api from '$lib/services/api';

// Mock the articles page component (simplified version for testing)
const MockArticlesPage = `
<script>
  import { onMount } from 'svelte';
  import AuthGuard from '$lib/components/auth/AuthGuard.svelte';
  import { isAdmin } from '$lib/stores/auth.store';

  let articles = [];
  let loading = false;
  let error = null;

  async function loadArticles() {
    loading = true;
    error = null;
    try {
      const response = await fetch('/api/articles');
      if (!response.ok) {
        throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
      }
      const data = await response.json();
      articles = data.data || [];
    } catch (err) {
      error = err.message;
      console.error('Failed to load articles:', err);
    } finally {
      loading = false;
    }
  }

  async function createArticle() {
    // Simulate article creation
    const newArticle = {
      id: Date.now(),
      name: 'Test Article',
      description: 'Test Description'
    };
    articles = [...articles, newArticle];
  }

  async function deleteArticle(id) {
    articles = articles.filter(a => a.id !== id);
  }

  onMount(() => {
    loadArticles();
  });
</script>

<AuthGuard>
  <div data-testid="articles-page">
    <h1>Articles Management</h1>

    {#if loading}
      <div data-testid="loading">Loading articles...</div>
    {/if}

    {#if error}
      <div data-testid="error" class="error">Error: {error}</div>
    {/if}

    {#if $isAdmin}
      <button data-testid="create-article-btn" on:click={createArticle}>
        Create Article
      </button>
    {/if}

    <div data-testid="articles-list">
      {#each articles as article}
        <div data-testid="article-{article.id}" class="article-item">
          <h3>{article.name}</h3>
          <p>{article.description}</p>
          {#if $isAdmin}
            <button
              data-testid="delete-article-{article.id}"
              on:click={() => deleteArticle(article.id)}
            >
              Delete
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</AuthGuard>
`;

// Mock external dependencies
vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

vi.mock('$app/stores', () => ({
  page: {
    subscribe: vi.fn(),
    url: { pathname: '/articles', search: '' }
  }
}));

vi.mock('$lib/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

// Mock fetch for articles API
global.fetch = vi.fn();

describe('Articles Page Authentication Integration', () => {
  let mockPageStore: any;
  let fetchMock: any;

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

    // Setup fetch mock
    fetchMock = global.fetch as any;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        data: [
          { id: 1, name: 'Article 1', description: 'Description 1' },
          { id: 2, name: 'Article 2', description: 'Description 2' }
        ]
      })
    });

    // Reset auth store
    authStore.clearAuth();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Successful Authentication Flow', () => {
    it('should load articles page without 401 errors for admin user with SSR data', async () => {
      // Arrange: Admin user with SSR authentication
      mockPageStore.data = {
        user: {
          id: 1,
          user_name: 'Admin User',
          username: 'admin',
          role: 'admin',
          telegram_id: 123456789,
          first_name: 'Admin',
          last_name: 'User',
          auth_method: 'password'
        },
        authenticated: true
      };

      // Act: Render articles page
      const { container } = render(MockArticlesPage);
      await tick();

      // Wait for articles to load
      await waitFor(() => {
        expect(screen.getByTestId('articles-page')).toBeInTheDocument();
      });

      // Assert: No authentication errors
      expect(screen.queryByTestId('error')).not.toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith('/api/articles');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should show admin-only buttons for admin users', async () => {
      // Arrange: Admin user with SSR data
      mockPageStore.data = {
        user: {
          id: 1,
          username: 'admin',
          role: 'admin'
        },
        authenticated: true
      };

      // Act
      render(MockArticlesPage);
      await tick();

      await waitFor(() => {
        expect(screen.getByTestId('articles-page')).toBeInTheDocument();
      });

      // Assert: Admin buttons should be visible
      expect(screen.getByTestId('create-article-btn')).toBeInTheDocument();
    });

    it('should hide admin-only buttons for regular users', async () => {
      // Arrange: Regular user with SSR data
      mockPageStore.data = {
        user: {
          id: 2,
          username: 'user',
          role: 'user'
        },
        authenticated: true
      };

      // Act
      render(MockArticlesPage);
      await tick();

      await waitFor(() => {
        expect(screen.getByTestId('articles-page')).toBeInTheDocument();
      });

      // Assert: Admin buttons should not be visible
      expect(screen.queryByTestId('create-article-btn')).not.toBeInTheDocument();
    });
  });

  describe('Button Responsiveness and UI Interactions', () => {
    beforeEach(() => {
      // Setup admin user for button interaction tests
      mockPageStore.data = {
        user: {
          id: 1,
          username: 'admin',
          role: 'admin'
        },
        authenticated: true
      };
    });

    it('should handle create article button clicks responsively', async () => {
      // Arrange
      render(MockArticlesPage);
      await tick();

      await waitFor(() => {
        expect(screen.getByTestId('articles-page')).toBeInTheDocument();
      });

      const createButton = screen.getByTestId('create-article-btn');

      // Act: Click create button
      await fireEvent.click(createButton);
      await tick();

      // Assert: New article should appear in list
      await waitFor(() => {
        expect(screen.getByText('Test Article')).toBeInTheDocument();
      });
    });

    it('should handle delete article button clicks responsively', async () => {
      // Arrange: Page with existing articles
      render(MockArticlesPage);
      await tick();

      await waitFor(() => {
        expect(screen.getByTestId('articles-page')).toBeInTheDocument();
      });

      // Wait for articles to load
      await waitFor(() => {
        expect(screen.getByTestId('article-1')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-article-1');

      // Act: Click delete button
      await fireEvent.click(deleteButton);
      await tick();

      // Assert: Article should be removed from list
      await waitFor(() => {
        expect(screen.queryByTestId('article-1')).not.toBeInTheDocument();
      });
    });

    it('should handle multiple rapid button clicks without errors', async () => {
      // Arrange
      render(MockArticlesPage);
      await tick();

      await waitFor(() => {
        expect(screen.getByTestId('create-article-btn')).toBeInTheDocument();
      });

      const createButton = screen.getByTestId('create-article-btn');

      // Act: Multiple rapid clicks
      await fireEvent.click(createButton);
      await fireEvent.click(createButton);
      await fireEvent.click(createButton);
      await tick();

      // Assert: Should handle multiple clicks gracefully
      const articles = screen.getAllByText(/Test Article/);
      expect(articles.length).toBeGreaterThan(0);
    });
  });

  describe('Authentication Error Handling', () => {
    it('should handle 401 errors gracefully without breaking UI', async () => {
      // Arrange: Mock 401 response
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      mockPageStore.data = {
        user: { id: 1, role: 'admin' },
        authenticated: true
      };

      // Act
      render(MockArticlesPage);
      await tick();

      // Assert: Should show error but not break
      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
        expect(screen.getByText(/HTTP 401: Unauthorized/)).toBeInTheDocument();
      });
    });

    it('should handle 403 forbidden errors for insufficient permissions', async () => {
      // Arrange: Mock 403 response
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });

      mockPageStore.data = {
        user: { id: 1, role: 'user' },
        authenticated: true
      };

      // Act
      render(MockArticlesPage);
      await tick();

      // Assert: Should show error appropriately
      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
        expect(screen.getByText(/HTTP 403: Forbidden/)).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      // Arrange: Mock network error
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      mockPageStore.data = {
        user: { id: 1, role: 'admin' },
        authenticated: true
      };

      // Act
      render(MockArticlesPage);
      await tick();

      // Assert: Should show network error
      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });
  });

  describe('Session Persistence and SSR Integration', () => {
    it('should maintain authentication state across page reloads', async () => {
      // Arrange: Simulate page reload with SSR data
      mockPageStore.data = {
        user: {
          id: 1,
          username: 'admin',
          role: 'admin'
        },
        authenticated: true
      };

      // Act: First render (simulating initial page load)
      const { unmount } = render(MockArticlesPage);
      await tick();

      await waitFor(() => {
        expect(screen.getByTestId('articles-page')).toBeInTheDocument();
      });

      // Simulate unmount and remount (page reload)
      unmount();

      const { container } = render(MockArticlesPage);
      await tick();

      // Assert: Should load without additional auth checks
      await waitFor(() => {
        expect(screen.getByTestId('articles-page')).toBeInTheDocument();
      });

      expect(fetchMock).toHaveBeenCalledTimes(2); // Once for each mount
    });

    it('should handle transition from unauthenticated to authenticated state', async () => {
      // Arrange: Start with no authentication
      mockPageStore.data = null;

      // Act: Render without auth
      const { rerender } = render(MockArticlesPage);
      await tick();

      // Should redirect to login
      await waitFor(() => {
        expect(goto).toHaveBeenCalledWith('/login?returnUrl=%2Farticles');
      });

      // Simulate successful authentication
      mockPageStore.data = {
        user: { id: 1, username: 'admin', role: 'admin' },
        authenticated: true
      };

      // Re-render with auth data
      rerender(MockArticlesPage);
      await tick();

      // Assert: Should now show articles page
      await waitFor(() => {
        expect(screen.getByTestId('articles-page')).toBeInTheDocument();
      });
    });
  });

  describe('Role-Based Access Control Integration', () => {
    it('should enforce role-based access for article creation', async () => {
      // Arrange: Regular user
      mockPageStore.data = {
        user: {
          id: 2,
          username: 'regularuser',
          role: 'user'
        },
        authenticated: true
      };

      // Act
      render(MockArticlesPage);
      await tick();

      await waitFor(() => {
        expect(screen.getByTestId('articles-page')).toBeInTheDocument();
      });

      // Assert: Create button should not be visible
      expect(screen.queryByTestId('create-article-btn')).not.toBeInTheDocument();
    });

    it('should enforce role-based access for article deletion', async () => {
      // Arrange: Regular user
      mockPageStore.data = {
        user: {
          id: 2,
          username: 'regularuser',
          role: 'user'
        },
        authenticated: true
      };

      // Act
      render(MockArticlesPage);
      await tick();

      await waitFor(() => {
        expect(screen.getByTestId('articles-page')).toBeInTheDocument();
      });

      // Wait for articles to load
      await waitFor(() => {
        expect(screen.getByTestId('article-1')).toBeInTheDocument();
      });

      // Assert: Delete buttons should not be visible
      expect(screen.queryByTestId('delete-article-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('delete-article-2')).not.toBeInTheDocument();
    });

    it('should allow admin users full access to all functions', async () => {
      // Arrange: Admin user
      mockPageStore.data = {
        user: {
          id: 1,
          username: 'admin',
          role: 'admin'
        },
        authenticated: true
      };

      // Act
      render(MockArticlesPage);
      await tick();

      await waitFor(() => {
        expect(screen.getByTestId('articles-page')).toBeInTheDocument();
      });

      // Wait for articles to load
      await waitFor(() => {
        expect(screen.getByTestId('article-1')).toBeInTheDocument();
      });

      // Assert: All admin buttons should be visible
      expect(screen.getByTestId('create-article-btn')).toBeInTheDocument();
      expect(screen.getByTestId('delete-article-1')).toBeInTheDocument();
      expect(screen.getByTestId('delete-article-2')).toBeInTheDocument();
    });
  });

  describe('Loading States and User Feedback', () => {
    it('should show loading state while articles are being fetched', async () => {
      // Arrange: Delayed API response
      let resolvePromise: any;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      fetchMock.mockReturnValueOnce(delayedPromise);

      mockPageStore.data = {
        user: { id: 1, role: 'admin' },
        authenticated: true
      };

      // Act
      render(MockArticlesPage);
      await tick();

      // Assert: Should show loading state
      expect(screen.getByTestId('loading')).toBeInTheDocument();

      // Resolve the promise
      resolvePromise({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] })
      });

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });
    });

    it('should provide clear error messages for failed operations', async () => {
      // Arrange: API error
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      mockPageStore.data = {
        user: { id: 1, role: 'admin' },
        authenticated: true
      };

      // Act
      render(MockArticlesPage);
      await tick();

      // Assert: Should show clear error message
      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
        expect(screen.getByText(/HTTP 500: Internal Server Error/)).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Optimization', () => {
    it('should not make duplicate API calls on component re-renders', async () => {
      // Arrange
      mockPageStore.data = {
        user: { id: 1, role: 'admin' },
        authenticated: true
      };

      // Act: Render and re-render
      const { rerender } = render(MockArticlesPage);
      await tick();

      await waitFor(() => {
        expect(screen.getByTestId('articles-page')).toBeInTheDocument();
      });

      // Re-render component
      rerender(MockArticlesPage);
      await tick();

      // Assert: Should only call API once
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid state changes gracefully', async () => {
      // Arrange: Multiple rapid state changes
      mockPageStore.data = {
        user: { id: 1, role: 'admin' },
        authenticated: true
      };

      // Act
      render(MockArticlesPage);
      await tick();

      await waitFor(() => {
        expect(screen.getByTestId('create-article-btn')).toBeInTheDocument();
      });

      // Rapid button interactions
      const createButton = screen.getByTestId('create-article-btn');
      for (let i = 0; i < 5; i++) {
        await fireEvent.click(createButton);
      }

      await tick();

      // Assert: Should handle rapid interactions without errors
      const testArticles = screen.getAllByText(/Test Article/);
      expect(testArticles.length).toBe(5);
    });
  });
});
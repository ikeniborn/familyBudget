/**
 * AuthGuard End-to-End Authentication Tests
 *
 * This test suite provides comprehensive E2E testing for the complete authentication
 * flow, including the AuthGuard fix that eliminates 401 errors and ensures proper
 * SSR authentication handling.
 *
 * Key E2E scenarios tested:
 * 1. Complete login flow to articles page access
 * 2. Session persistence across page navigation
 * 3. Role-based access control enforcement
 * 4. Authentication error handling and recovery
 * 5. Real browser environment authentication behavior
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Helper functions for authentication
async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="username-input"]', 'admin');
  await page.fill('[data-testid="password-input"]', 'admin');
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

async function loginAsUser(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="username-input"]', 'testuser');
  await page.fill('[data-testid="password-input"]', 'password123');
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('/login');
}

test.describe('AuthGuard E2E Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept API calls to verify authentication behavior
    await page.route('/api/auth/me', async (route) => {
      const url = route.request().url();
      const headers = route.request().headers();

      // Mock successful authentication for admin
      if (headers.cookie?.includes('connect.sid')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: {
              id: 1,
              username: 'admin',
              role: 'admin',
              user_name: 'Admin User'
            },
            authenticated: true
          })
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Unauthorized'
          })
        });
      }
    });

    // Mock articles API
    await page.route('/api/articles', async (route) => {
      const headers = route.request().headers();

      if (headers.cookie?.includes('connect.sid')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              { id: 1, name: 'Test Article 1', description: 'Description 1' },
              { id: 2, name: 'Test Article 2', description: 'Description 2' }
            ]
          })
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Unauthorized'
          })
        });
      }
    });
  });

  test.describe('Complete Authentication Flow', () => {
    test('should complete full login to articles page flow without 401 errors', async ({ page }) => {
      // Arrange: Start from login page
      await page.goto('/login');

      // Act: Login as admin
      await page.fill('[data-testid="username-input"]', 'admin');
      await page.fill('[data-testid="password-input"]', 'admin');

      // Mock successful login response
      await page.route('/api/auth/login', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: {
              id: 1,
              username: 'admin',
              role: 'admin',
              user_name: 'Admin User'
            }
          })
        });
      });

      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Navigate to articles page
      await page.goto('/articles');

      // Assert: Articles page should load without errors
      await expect(page.locator('[data-testid="articles-page"]')).toBeVisible();
      await expect(page.locator('[data-testid="error"]')).not.toBeVisible();

      // Verify admin functions are available
      await expect(page.locator('[data-testid="create-article-btn"]')).toBeVisible();
    });

    test('should handle SSR authentication data correctly on direct page access', async ({ page }) => {
      // Arrange: Mock server-side authentication check
      await page.route('**/articles', async (route, request) => {
        if (request.method() === 'GET' && request.headers().cookie?.includes('connect.sid')) {
          // Simulate SSR with auth data
          const html = `
            <script>
              window.__SSR_AUTH__ = {
                user: {
                  id: 1,
                  username: 'admin',
                  role: 'admin',
                  user_name: 'Admin User'
                },
                authenticated: true
              };
            </script>
            <!-- Rest of HTML -->
          `;
          await route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: html
          });
        } else {
          await route.continue();
        }
      });

      // Set authentication cookie
      await page.context().addCookies([
        {
          name: 'connect.sid',
          value: 's:test-session-id',
          domain: 'localhost',
          path: '/'
        }
      ]);

      // Act: Direct navigation to articles page
      await page.goto('/articles');

      // Assert: Should load immediately without auth checks
      await expect(page.locator('[data-testid="articles-page"]')).toBeVisible();

      // Verify no loading states (indicating no client-side auth check)
      await expect(page.locator('[data-testid="loading"]')).not.toBeVisible();
    });

    test('should redirect unauthenticated users to login', async ({ page }) => {
      // Act: Try to access articles page without authentication
      await page.goto('/articles');

      // Assert: Should redirect to login
      await page.waitForURL('/login');
      await expect(page.url()).toContain('/login');
      await expect(page.url()).toContain('returnUrl=%2Farticles');
    });
  });

  test.describe('Session Persistence and Navigation', () => {
    test('should maintain authentication across page navigation', async ({ page }) => {
      // Arrange: Login as admin
      await loginAsAdmin(page);

      // Act: Navigate between pages
      await page.goto('/dashboard');
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();

      await page.goto('/articles');
      await expect(page.locator('[data-testid="articles-page"]')).toBeVisible();

      await page.goto('/settings');
      await expect(page.locator('[data-testid="settings-page"]')).toBeVisible();

      // Navigate back to articles
      await page.goto('/articles');

      // Assert: Should load without re-authentication
      await expect(page.locator('[data-testid="articles-page"]')).toBeVisible();
      await expect(page.locator('[data-testid="create-article-btn"]')).toBeVisible();
    });

    test('should handle browser refresh while maintaining session', async ({ page }) => {
      // Arrange: Login and navigate to articles
      await loginAsAdmin(page);
      await page.goto('/articles');
      await expect(page.locator('[data-testid="articles-page"]')).toBeVisible();

      // Act: Refresh the page
      await page.reload();

      // Assert: Should maintain authentication state
      await expect(page.locator('[data-testid="articles-page"]')).toBeVisible();
      await expect(page.locator('[data-testid="create-article-btn"]')).toBeVisible();
    });

    test('should handle new tab/window with same session', async ({ context }) => {
      // Arrange: Login in first tab
      const page1 = await context.newPage();
      await loginAsAdmin(page1);

      // Act: Open new tab and navigate to articles
      const page2 = await context.newPage();
      await page2.goto('/articles');

      // Assert: Should be authenticated in new tab
      await expect(page2.locator('[data-testid="articles-page"]')).toBeVisible();
      await expect(page2.locator('[data-testid="create-article-btn"]')).toBeVisible();
    });
  });

  test.describe('Role-Based Access Control E2E', () => {
    test('should enforce admin-only access to articles management for admin users', async ({ page }) => {
      // Arrange: Login as admin
      await loginAsAdmin(page);

      // Act: Navigate to articles
      await page.goto('/articles');

      // Assert: Should have full access
      await expect(page.locator('[data-testid="articles-page"]')).toBeVisible();
      await expect(page.locator('[data-testid="create-article-btn"]')).toBeVisible();

      // Check for delete buttons on articles
      await expect(page.locator('[data-testid^="delete-article-"]').first()).toBeVisible();
    });

    test('should restrict article management features for regular users', async ({ page }) => {
      // Arrange: Mock user authentication
      await page.route('/api/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: {
              id: 2,
              username: 'testuser',
              role: 'user',
              user_name: 'Test User'
            },
            authenticated: true
          })
        });
      });

      await loginAsUser(page);

      // Act: Navigate to articles
      await page.goto('/articles');

      // Assert: Should have limited access
      await expect(page.locator('[data-testid="articles-page"]')).toBeVisible();
      await expect(page.locator('[data-testid="create-article-btn"]')).not.toBeVisible();

      // Check that delete buttons are not visible
      await expect(page.locator('[data-testid^="delete-article-"]')).not.toBeVisible();
    });

    test('should handle role changes during session', async ({ page }) => {
      // Arrange: Start as regular user
      await page.route('/api/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: {
              id: 2,
              username: 'testuser',
              role: 'user',
              user_name: 'Test User'
            },
            authenticated: true
          })
        });
      });

      await loginAsUser(page);
      await page.goto('/articles');

      // Verify limited access
      await expect(page.locator('[data-testid="create-article-btn"]')).not.toBeVisible();

      // Simulate role change to admin
      await page.route('/api/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: {
              id: 2,
              username: 'testuser',
              role: 'admin', // Role changed to admin
              user_name: 'Test User'
            },
            authenticated: true
          })
        });
      });

      // Act: Refresh or navigate to trigger auth check
      await page.reload();

      // Assert: Should now have admin access
      await expect(page.locator('[data-testid="create-article-btn"]')).toBeVisible();
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should handle authentication failures gracefully', async ({ page }) => {
      // Arrange: Mock authentication failure
      await page.route('/api/auth/me', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Session expired'
          })
        });
      });

      // Act: Try to access articles with invalid session
      await page.goto('/articles');

      // Assert: Should redirect to login
      await page.waitForURL('/login');
      await expect(page.url()).toContain('/login');
    });

    test('should handle server errors during authentication', async ({ page }) => {
      // Arrange: Mock server error
      await page.route('/api/auth/me', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Internal server error'
          })
        });
      });

      // Act: Try to access articles
      await page.goto('/articles');

      // Assert: Should handle error gracefully (redirect to login)
      await page.waitForURL('/login');
    });

    test('should recover from network errors', async ({ page }) => {
      // Arrange: Login first
      await loginAsAdmin(page);
      await page.goto('/articles');
      await expect(page.locator('[data-testid="articles-page"]')).toBeVisible();

      // Mock network error
      await page.route('/api/articles', async (route) => {
        await route.abort('failed');
      });

      // Act: Trigger network request (reload)
      await page.reload();

      // Should show error but maintain auth state
      await expect(page.locator('[data-testid="articles-page"]')).toBeVisible();

      // Restore network and retry
      await page.unroute('/api/articles');
      await page.route('/api/articles', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: []
          })
        });
      });

      await page.reload();

      // Assert: Should recover successfully
      await expect(page.locator('[data-testid="articles-page"]')).toBeVisible();
      await expect(page.locator('[data-testid="error"]')).not.toBeVisible();
    });
  });

  test.describe('Button Responsiveness and UI Interactions', () => {
    test('should handle article creation and deletion flows', async ({ page }) => {
      // Arrange: Login as admin
      await loginAsAdmin(page);
      await page.goto('/articles');

      // Mock article creation API
      await page.route('/api/articles', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 3,
                name: 'New Article',
                description: 'New Description'
              }
            })
          });
        } else {
          await route.continue();
        }
      });

      // Act: Create new article
      await page.click('[data-testid="create-article-btn"]');
      await page.fill('[data-testid="article-name-input"]', 'New Article');
      await page.fill('[data-testid="article-description-input"]', 'New Description');
      await page.click('[data-testid="save-article-btn"]');

      // Assert: New article should appear
      await expect(page.locator('[data-testid="article-3"]')).toBeVisible();
      await expect(page.locator('text=New Article')).toBeVisible();

      // Act: Delete article
      await page.click('[data-testid="delete-article-3"]');
      await page.click('[data-testid="confirm-delete-btn"]');

      // Assert: Article should be removed
      await expect(page.locator('[data-testid="article-3"]')).not.toBeVisible();
    });

    test('should handle rapid button interactions without errors', async ({ page }) => {
      // Arrange: Login as admin
      await loginAsAdmin(page);
      await page.goto('/articles');

      // Act: Rapid clicks on create button
      const createButton = page.locator('[data-testid="create-article-btn"]');

      // Click multiple times rapidly
      await createButton.click();
      await createButton.click();
      await createButton.click();

      // Assert: Should handle gracefully without errors
      await expect(page.locator('[data-testid="articles-page"]')).toBeVisible();

      // UI should remain responsive
      await expect(createButton).toBeEnabled();
    });

    test('should provide immediate visual feedback for user actions', async ({ page }) => {
      // Arrange: Login as admin
      await loginAsAdmin(page);
      await page.goto('/articles');

      // Act: Click create button
      await page.click('[data-testid="create-article-btn"]');

      // Assert: Modal or form should appear immediately
      await expect(page.locator('[data-testid="create-article-modal"]')).toBeVisible({ timeout: 100 });

      // Act: Cancel action
      await page.click('[data-testid="cancel-btn"]');

      // Assert: Modal should close immediately
      await expect(page.locator('[data-testid="create-article-modal"]')).not.toBeVisible({ timeout: 100 });
    });
  });

  test.describe('Performance and User Experience', () => {
    test('should load articles page quickly without unnecessary auth delays', async ({ page }) => {
      // Arrange: Setup performance monitoring
      const startTime = Date.now();

      await loginAsAdmin(page);

      // Act: Navigate to articles page
      await page.goto('/articles');
      await expect(page.locator('[data-testid="articles-page"]')).toBeVisible();

      const loadTime = Date.now() - startTime;

      // Assert: Should load within reasonable time (< 2 seconds)
      expect(loadTime).toBeLessThan(2000);
    });

    test('should minimize loading states for SSR-authenticated users', async ({ page }) => {
      // Arrange: Set auth cookie
      await page.context().addCookies([
        {
          name: 'connect.sid',
          value: 's:test-session-id',
          domain: 'localhost',
          path: '/'
        }
      ]);

      // Act: Direct navigation with SSR auth
      await page.goto('/articles');

      // Assert: Should not show extended loading states
      const loadingElement = page.locator('[data-testid="loading"]');

      // Loading should either not appear or disappear quickly
      if (await loadingElement.isVisible()) {
        await expect(loadingElement).not.toBeVisible({ timeout: 500 });
      }

      await expect(page.locator('[data-testid="articles-page"]')).toBeVisible();
    });

    test('should handle concurrent user sessions correctly', async ({ context }) => {
      // Arrange: Create multiple tabs with different users
      const adminPage = await context.newPage();
      const userPage = await context.newPage();

      // Setup different auth for each page
      await adminPage.route('/api/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: { id: 1, username: 'admin', role: 'admin' },
            authenticated: true
          })
        });
      });

      await userPage.route('/api/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: { id: 2, username: 'user', role: 'user' },
            authenticated: true
          })
        });
      });

      // Act: Navigate both to articles
      await Promise.all([
        adminPage.goto('/articles'),
        userPage.goto('/articles')
      ]);

      // Assert: Each should have appropriate access
      await expect(adminPage.locator('[data-testid="create-article-btn"]')).toBeVisible();
      await expect(userPage.locator('[data-testid="create-article-btn"]')).not.toBeVisible();
    });
  });
});
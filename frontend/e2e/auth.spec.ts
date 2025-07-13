import { test, expect } from '@playwright/test';
import { testUsers } from './fixtures/test-data';

// Helper function to set up authenticated state
async function setupAuthenticatedUser(page: any, user = testUsers.testUser) {
  await page.evaluate((userData) => {
    localStorage.setItem('auth-storage', JSON.stringify({
      state: {
        user: {
          id: 1,
          username: userData.email.split('@')[0],
          first_name: userData.name.split(' ')[0],
          last_name: userData.name.split(' ')[1] || 'User',
          email: userData.email
        },
        isAuthenticated: true
      },
      version: 0
    }));
  }, user);
}

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear authentication state before each test
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

  test('should display login page when not authenticated', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    
    // Should show authentication options
    await expect(page.getByText('Вход в систему')).toBeVisible();
    await expect(page.getByText('Войдите через Telegram')).toBeVisible();
  });

  test('should show both authentication methods', async ({ page }) => {
    await page.goto('/login');
    
    // Check for Telegram button
    await expect(page.locator('button:has-text("Telegram")')).toBeVisible();
    
    // Check for password authentication option
    await expect(page.locator('button:has-text("Вход по паролю")')).toBeVisible();
  });

  test('should display password form when selected', async ({ page }) => {
    await page.goto('/login');
    
    // Click password authentication
    await page.click('button:has-text("Вход по паролю")');
    
    // Should show password form
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should validate password form fields', async ({ page }) => {
    await page.goto('/login');
    await page.click('button:has-text("Вход по паролю")');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expect(page.locator('text=Обязательное поле')).toBeVisible();
  });

  test('should authenticate with valid password credentials', async ({ page }) => {
    // Mock successful login API response
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            id: 1,
            username: 'testuser',
            email: testUsers.testUser.email,
            first_name: 'Test',
            last_name: 'User'
          }
        })
      });
    });

    await page.goto('/login');
    await page.click('button:has-text("Вход по паролю")');
    
    // Fill valid credentials
    await page.fill('input[name="username"]', testUsers.testUser.email);
    await page.fill('input[name="password"]', testUsers.testUser.password);
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('should handle authentication errors', async ({ page }) => {
    // Mock failed login API response
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Неверные учетные данные'
        })
      });
    });

    await page.goto('/login');
    await page.click('button:has-text("Вход по паролю")');
    
    await page.fill('input[name="username"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=Неверные учетные данные')).toBeVisible();
  });

  test('should navigate to dashboard after successful login', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Test User')).toBeVisible();
  });

  test('should maintain session after page reload', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    await page.goto('/');
    await expect(page.getByText('Test User')).toBeVisible();
    
    // Reload page
    await page.reload();
    
    // Should still be authenticated
    await expect(page.getByText('Test User')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    await page.goto('/');
    
    // Click logout button
    await page.getByRole('button', { name: 'Выйти' }).click();
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    
    // Check localStorage is cleared
    const authStorage = await page.evaluate(() => localStorage.getItem('auth-storage'));
    const authData = JSON.parse(authStorage || '{}');
    expect(authData.state?.isAuthenticated).toBeFalsy();
  });

  test('should redirect to login when accessing protected routes while unauthenticated', async ({ page }) => {
    const protectedRoutes = ['/dashboard', '/reports', '/fact', '/products'];
    
    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL('/login');
    }
  });

  test('should redirect to intended page after successful authentication', async ({ page }) => {
    // Try to access protected page while not authenticated
    await page.goto('/reports');
    await expect(page).toHaveURL('/login');
    
    // Setup authentication
    await setupAuthenticatedUser(page);
    
    // Navigate again - should be able to access the page
    await page.goto('/reports');
    await expect(page).toHaveURL('/reports');
  });

  test('should handle session expiration', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    await page.goto('/');
    await expect(page.getByText('Test User')).toBeVisible();
    
    // Simulate session expiration by clearing storage
    await page.evaluate(() => localStorage.clear());
    
    // Try to navigate to protected route
    await page.goto('/reports');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('should show loading state during authentication', async ({ page }) => {
    // Mock slow API response
    await page.route('**/api/auth/login', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, user: { id: 1 } })
      });
    });

    await page.goto('/login');
    await page.click('button:has-text("Вход по паролю")');
    
    await page.fill('input[name="username"]', testUsers.testUser.email);
    await page.fill('input[name="password"]', testUsers.testUser.password);
    await page.click('button[type="submit"]');
    
    // Should show loading state
    await expect(page.locator('button[type="submit"]:disabled')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network error
    await page.route('**/api/auth/login', route => route.abort('failed'));

    await page.goto('/login');
    await page.click('button:has-text("Вход по паролю")');
    
    await page.fill('input[name="username"]', testUsers.testUser.email);
    await page.fill('input[name="password"]', testUsers.testUser.password);
    await page.click('button[type="submit"]');
    
    // Should show network error
    await expect(page.locator('text=Ошибка сети')).toBeVisible();
  });
});
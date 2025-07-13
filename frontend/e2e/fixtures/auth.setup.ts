import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Go to login page
  await page.goto('/login');

  // Wait for the page to load
  await expect(page.locator('h1')).toContainText('Вход в систему');

  // Try password authentication first
  await page.click('button:has-text("Вход по паролю")');

  // Fill in credentials (using test user credentials)
  await page.fill('input[name="username"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for successful authentication - should redirect to dashboard
  await page.waitForURL('**/dashboard');
  
  // Verify we're logged in by checking for user-specific content
  await expect(page.locator('text=Добро пожаловать')).toBeVisible();

  // Save authentication state
  await page.context().storageState({ path: authFile });
});

setup.describe.configure({ mode: 'serial' });
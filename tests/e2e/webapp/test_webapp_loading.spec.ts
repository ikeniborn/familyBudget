import { test, expect } from '@playwright/test';

/**
 * E2E tests for Web App loading and initialization.
 *
 * Tests the basic Web App infrastructure without Telegram SDK mocking.
 */

test.describe('Web App Loading', () => {
  // TODO: Create /webapp/test.html page for this test
  test.skip('test page loads successfully', async ({ page }) => {
    // Navigate to test page
    await page.goto('/webapp/test.html');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check title
    await expect(page).toHaveTitle(/Test - Family Budget Web App/);

    // Check main heading
    const heading = page.locator('h1');
    await expect(heading).toHaveText('🧪 Web App Test Page');

    // Check all cards are present
    const envCard = page.locator('.card', { hasText: 'Environment' });
    await expect(envCard).toBeVisible();

    const themeCard = page.locator('.card', { hasText: 'Theme' });
    await expect(themeCard).toBeVisible();

    const userCard = page.locator('.card', { hasText: 'User' });
    await expect(userCard).toBeVisible();

    const modulesCard = page.locator('.card', { hasText: 'Modules Test' });
    await expect(modulesCard).toBeVisible();
  });

  test('CSS files load correctly', async ({ page }) => {
    await page.goto('/webapp/test.html');

    // Check that CSS variables are applied
    const container = page.locator('.container');
    await expect(container).toBeVisible();

    // Verify buttons have correct styling
    const testApiButton = page.locator('#test-api');
    await expect(testApiButton).toBeVisible();
    await expect(testApiButton).toHaveClass(/btn-primary/);

    const testHapticButton = page.locator('#test-haptic');
    await expect(testHapticButton).toBeVisible();
    await expect(testHapticButton).toHaveClass(/btn-secondary/);
  });

  test('JavaScript modules load without errors', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/webapp/test.html');
    await page.waitForLoadState('domcontentloaded');  // networkidle hangs with WebSocket

    // Wait a bit for scripts to initialize
    await page.waitForTimeout(1000);

    // Check no JavaScript errors occurred
    expect(errors).toHaveLength(0);
  });

  // TODO: Create /webapp/*.html pages for these tests
  test.skip('placeholder pages are accessible', async ({ page }) => {
    const pages = [
      '/webapp/index.html',
      '/webapp/add.html',
      '/webapp/today.html',
      '/webapp/stats.html',
      '/webapp/list.html',
      '/webapp/edit.html',
      '/webapp/delete.html',
      '/webapp/addplan.html',
      '/webapp/summary.html',
      '/webapp/search.html',
    ];

    for (const pagePath of pages) {
      await page.goto(pagePath);

      // Check page loads (status 200)
      const response = await page.goto(pagePath);
      expect(response?.status()).toBe(200);

      // Check page has basic HTML structure
      const html = page.locator('html');
      await expect(html).toBeVisible();
    }
  });
});

test.describe('Web App Module Tests', () => {
  test.skip('modules status shows all modules loaded', async ({ page }) => {
    // TODO: This test requires Telegram SDK mocking
    // Will be implemented when we add proper Telegram SDK test environment

    await page.goto('/webapp/test.html');
    await page.waitForLoadState('networkidle');

    const modulesStatus = page.locator('#modules-status');
    await expect(modulesStatus).toContainText('✅ Auth');
    await expect(modulesStatus).toContainText('✅ APIClient');
    await expect(modulesStatus).toContainText('✅ UI');
    await expect(modulesStatus).toContainText('✅ Theme');
    await expect(modulesStatus).toContainText('✅ Storage');
    await expect(modulesStatus).toContainText('✅ Validators');
    await expect(modulesStatus).toContainText('✅ BudgetApp');
  });

  test.skip('test API button triggers API call', async ({ page }) => {
    // TODO: This test requires proper API mocking and Telegram SDK
    // Will be implemented in later phases
  });

  test.skip('test haptic button triggers haptic feedback', async ({ page }) => {
    // TODO: This test requires Telegram SDK mocking
    // Will be implemented in later phases
  });
});

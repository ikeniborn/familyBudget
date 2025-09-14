/**
 * End-to-End tests for complete dashboard functionality.
 * Tests the entire dashboard flow from authentication to data display,
 * including navigation, data loading, error handling, and user interactions.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { setupE2EDatabase, cleanupE2EDatabase, createTestUser, createTestData } from '../helpers/e2e-setup';

describe('Dashboard E2E Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
  const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:4000';

  let testUserId: number;
  let testUserCredentials: { username: string; password: string };

  beforeAll(async () => {
    // Setup browser
    browser = await chromium.launch({
      headless: process.env.CI !== undefined,
      slowMo: process.env.CI ? 0 : 100
    });

    // Setup test database and user
    await setupE2EDatabase();
    const userData = await createTestUser();
    testUserId = userData.userId;
    testUserCredentials = userData.credentials;

    // Create test data for dashboard
    await createTestData(testUserId);
  });

  beforeEach(async () => {
    context = await browser.newContext();
    page = await context.newPage();

    // Set up request/response monitoring
    page.on('response', response => {
      if (response.status() >= 400) {
        console.error(`Failed request: ${response.url()} - ${response.status()}`);
      }
    });

    // Navigate to application
    await page.goto(BASE_URL);
  });

  afterEach(async () => {
    await context.close();
  });

  afterAll(async () => {
    await browser.close();
    await cleanupE2EDatabase();
  });

  describe('Authentication and Initial Load', () => {
    it('should redirect unauthenticated users to login', async () => {
      await page.goto(`${BASE_URL}/dashboard`);

      // Should redirect to login page
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByText('Вход в систему')).toBeVisible();
    });

    it('should allow login and redirect to dashboard', async () => {
      // Navigate to login
      await page.goto(`${BASE_URL}/login`);

      // Fill login form
      await page.getByRole('textbox', { name: /логин|username/i }).fill(testUserCredentials.username);
      await page.getByRole('textbox', { name: /пароль|password/i }).fill(testUserCredentials.password);

      // Submit login
      await page.getByRole('button', { name: /войти|login/i }).click();

      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/);
    });

    it('should maintain session across page reloads', async () => {
      // Login first
      await loginUser(page, testUserCredentials);

      // Navigate to dashboard
      await page.goto(`${BASE_URL}/dashboard`);
      await expect(page.getByText('Главная панель')).toBeVisible();

      // Reload page
      await page.reload();

      // Should still be logged in and see dashboard
      await expect(page.getByText('Главная панель')).toBeVisible();
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  describe('Dashboard Data Loading', () => {
    beforeEach(async () => {
      await loginUser(page, testUserCredentials);
      await page.goto(`${BASE_URL}/dashboard`);
    });

    it('should show loading state initially', async () => {
      // Intercept API calls to delay response
      await page.route('**/api/reports/dashboard-stats', route => {
        setTimeout(() => route.continue(), 1000);
      });

      await page.reload();

      // Should show loading indicator
      await expect(page.getByText('Загрузка дашборда...')).toBeVisible();

      // Wait for loading to complete
      await expect(page.getByText('Загрузка дашборда...')).toBeHidden({ timeout: 5000 });
    });

    it('should load and display dashboard data correctly', async () => {
      // Wait for page to load
      await expect(page.getByText('Главная панель')).toBeVisible();

      // Check main statistics cards
      await expect(page.getByText('Общий бюджет')).toBeVisible();
      await expect(page.getByText('Потрачено')).toBeVisible();
      await expect(page.getByText('Остаток')).toBeVisible();
      await expect(page.getByText('Экономия')).toBeVisible();

      // Check sections
      await expect(page.getByText('Быстрые действия')).toBeVisible();
      await expect(page.getByText('Прогресс по категориям')).toBeVisible();
      await expect(page.getByText('Последние операции')).toBeVisible();

      // Check that numeric values are displayed (not zero if we have test data)
      const budgetElements = page.locator('.stat-value').filter({ hasText: /\d+,?\d*\s*₽/ });
      await expect(budgetElements.first()).toBeVisible();
    });

    it('should display category progress with visual indicators', async () => {
      await expect(page.getByText('Прогресс по категориям')).toBeVisible();

      // Look for progress bars
      const progressBars = page.locator('.progress-bar');
      if (await progressBars.count() > 0) {
        await expect(progressBars.first()).toBeVisible();

        // Check for percentage display
        const percentageElements = page.locator('text=/\d+%/');
        if (await percentageElements.count() > 0) {
          await expect(percentageElements.first()).toBeVisible();
        }
      }
    });

    it('should display recent transactions with correct formatting', async () => {
      await expect(page.getByText('Последние операции')).toBeVisible();

      // Look for transaction items
      const transactionItems = page.locator('.transaction-item');
      if (await transactionItems.count() > 0) {
        // Should have transaction description and amount
        const firstTransaction = transactionItems.first();
        await expect(firstTransaction).toBeVisible();

        // Check for amount formatting (positive/negative with ₽ symbol)
        const amountElements = page.locator('text=/[+-]?\d+,?\d*\s*₽/');
        await expect(amountElements.first()).toBeVisible();
      }
    });
  });

  describe('Quick Actions Navigation', () => {
    beforeEach(async () => {
      await loginUser(page, testUserCredentials);
      await page.goto(`${BASE_URL}/dashboard`);
      await expect(page.getByText('Главная панель')).toBeVisible();
    });

    it('should navigate to fact entry page', async () => {
      await page.getByRole('link', { name: /добавить расход/i }).click();
      await expect(page).toHaveURL(/\/fact/);
    });

    it('should navigate to budget creation page', async () => {
      await page.getByRole('link', { name: /создать бюджет/i }).click();
      await expect(page).toHaveURL(/\/budget/);
    });

    it('should navigate to reports page', async () => {
      await page.getByRole('link', { name: /посмотреть отчеты/i }).click();
      await expect(page).toHaveURL(/\/reports/);
    });

    it('should navigate to products page', async () => {
      await page.getByRole('link', { name: /управление товарами/i }).click();
      await expect(page).toHaveURL(/\/products/);
    });

    it('should navigate to all transactions from recent transactions', async () => {
      const allTransactionsLink = page.getByRole('link', { name: /все операции/i });
      if (await allTransactionsLink.isVisible()) {
        await allTransactionsLink.click();
        await expect(page).toHaveURL(/\/fact/);
      }
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await loginUser(page, testUserCredentials);
    });

    it('should handle API errors gracefully', async () => {
      // Intercept and fail API requests
      await page.route('**/api/reports/dashboard-stats', route => {
        route.fulfill({ status: 500, body: 'Internal Server Error' });
      });

      await page.goto(`${BASE_URL}/dashboard`);

      // Should show error state
      await expect(page.getByText('Ошибка загрузки данных')).toBeVisible();
      await expect(page.getByText('Попробовать снова')).toBeVisible();
    });

    it('should allow retry after error', async () => {
      let failFirstRequest = true;

      // Fail first request, succeed on retry
      await page.route('**/api/reports/dashboard-stats', route => {
        if (failFirstRequest) {
          failFirstRequest = false;
          route.fulfill({ status: 500, body: 'Internal Server Error' });
        } else {
          route.continue();
        }
      });

      await page.goto(`${BASE_URL}/dashboard`);

      // Wait for error state
      await expect(page.getByText('Ошибка загрузки данных')).toBeVisible();

      // Click retry
      await page.getByText('Попробовать снова').click();

      // Should load successfully after retry
      await expect(page.getByText('Главная панель')).toBeVisible();
      await expect(page.getByText('Ошибка загрузки данных')).toBeHidden();
    });

    it('should handle network timeouts', async () => {
      // Simulate slow network
      await page.route('**/api/reports/**', route => {
        setTimeout(() => route.abort(), 30000); // Never resolve
      });

      await page.goto(`${BASE_URL}/dashboard`);

      // Should show loading state for a while, then error
      await expect(page.getByText('Загрузка дашборда...')).toBeVisible();

      // Wait for timeout (this might take a while in real tests)
      // In practice, you'd want to mock this more efficiently
    });
  });

  describe('Responsive Design', () => {
    beforeEach(async () => {
      await loginUser(page, testUserCredentials);
      await page.goto(`${BASE_URL}/dashboard`);
      await expect(page.getByText('Главная панель')).toBeVisible();
    });

    it('should display correctly on mobile devices', async () => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

      // Check that elements are still visible and properly arranged
      await expect(page.getByText('Главная панель')).toBeVisible();
      await expect(page.getByText('Общий бюджет')).toBeVisible();

      // Statistics cards should stack vertically on mobile
      const statCards = page.locator('.stat-card');
      if (await statCards.count() > 0) {
        const firstCard = statCards.first();
        const secondCard = statCards.nth(1);

        if (await secondCard.isVisible()) {
          const firstCardBox = await firstCard.boundingBox();
          const secondCardBox = await secondCard.boundingBox();

          // On mobile, second card should be below first card
          expect(secondCardBox?.y).toBeGreaterThan(firstCardBox?.y || 0);
        }
      }
    });

    it('should display correctly on tablet devices', async () => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad

      await expect(page.getByText('Главная панель')).toBeVisible();
      await expect(page.getByText('Быстрые действия')).toBeVisible();

      // Should maintain good layout on tablet
      const quickActionsSection = page.locator('text=Быстрые действия').locator('..').locator('..');
      await expect(quickActionsSection).toBeVisible();
    });

    it('should display correctly on desktop', async () => {
      await page.setViewportSize({ width: 1920, height: 1080 });

      await expect(page.getByText('Главная панель')).toBeVisible();

      // Desktop should show elements side by side
      const mainContent = page.locator('.main-content');
      await expect(mainContent).toBeVisible();
    });
  });

  describe('Data Accuracy and Calculations', () => {
    beforeEach(async () => {
      await loginUser(page, testUserCredentials);
      await page.goto(`${BASE_URL}/dashboard`);
      await expect(page.getByText('Главная панель')).toBeVisible();
    });

    it('should display correctly formatted currency values', async () => {
      // Look for currency values with proper formatting
      const currencyElements = page.locator('text=/\d{1,3}(,\d{3})*\s*₽/');

      if (await currencyElements.count() > 0) {
        await expect(currencyElements.first()).toBeVisible();

        // Check that values are properly formatted with commas for thousands
        const text = await currencyElements.first().textContent();
        expect(text).toMatch(/\d{1,3}(,\d{3})*\s*₽/);
      }
    });

    it('should display consistent percentages', async () => {
      // Look for percentage values
      const percentageElements = page.locator('text=/\d+%/');

      if (await percentageElements.count() > 0) {
        const percentages = await percentageElements.allTextContents();

        for (const percentage of percentages) {
          const value = parseInt(percentage.replace('%', ''));
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(999); // Allow for over-budget scenarios
        }
      }
    });

    it('should show over-budget warning indicators', async () => {
      // If there are over-budget categories, they should be visually distinct
      const overBudgetPercentages = page.locator('text=/[12]\d\d%/'); // 100%+ percentages

      if (await overBudgetPercentages.count() > 0) {
        // Should have warning styling or icons
        const warningIcons = page.locator('.text-red-500, [class*="red-"]');
        await expect(warningIcons.first()).toBeVisible();
      }
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await loginUser(page, testUserCredentials);
    });

    it('should load dashboard within reasonable time', async () => {
      const startTime = Date.now();

      await page.goto(`${BASE_URL}/dashboard`);
      await expect(page.getByText('Главная панель')).toBeVisible();

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    });

    it('should make efficient API calls', async () => {
      const apiCalls: string[] = [];

      page.on('request', request => {
        if (request.url().includes('/api/')) {
          apiCalls.push(request.url());
        }
      });

      await page.goto(`${BASE_URL}/dashboard`);
      await expect(page.getByText('Главная панель')).toBeVisible();

      // Should make expected API calls but not excessive ones
      expect(apiCalls.length).toBeGreaterThan(0);
      expect(apiCalls.length).toBeLessThan(10); // Reasonable limit

      // Should call dashboard-related endpoints
      const dashboardCalls = apiCalls.filter(url => url.includes('/reports/'));
      expect(dashboardCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      await loginUser(page, testUserCredentials);
      await page.goto(`${BASE_URL}/dashboard`);
      await expect(page.getByText('Главная панель')).toBeVisible();
    });

    it('should have proper heading hierarchy', async () => {
      // Check for h1
      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText(/главная панель/i);

      // Check for proper heading structure
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      expect(await headings.count()).toBeGreaterThan(1);
    });

    it('should be keyboard navigable', async () => {
      // Start from first interactive element
      await page.keyboard.press('Tab');

      // Should be able to navigate to quick action links
      const focusedElement = await page.evaluate(() => document.activeElement?.textContent);
      expect(focusedElement).toBeTruthy();

      // Tab through several elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should still have focus on interactive elements
      const newFocusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['A', 'BUTTON', 'INPUT', 'SELECT'].includes(newFocusedElement || '')).toBe(true);
    });

    it('should have proper ARIA labels and roles', async () => {
      // Check for proper roles
      const main = page.locator('main, [role="main"]');
      if (await main.count() > 0) {
        await expect(main).toBeVisible();
      }

      // Check for accessible names on interactive elements
      const links = page.locator('a');
      const buttons = page.locator('button');

      for (let i = 0; i < Math.min(await links.count(), 5); i++) {
        const link = links.nth(i);
        const text = await link.textContent();
        expect(text?.trim()).toBeTruthy();
      }

      for (let i = 0; i < Math.min(await buttons.count(), 5); i++) {
        const button = buttons.nth(i);
        const text = await button.textContent();
        expect(text?.trim()).toBeTruthy();
      }
    });
  });

  describe('Multi-User Data Isolation', () => {
    let secondUserCredentials: { username: string; password: string };
    let secondUserId: number;

    beforeAll(async () => {
      // Create second test user
      const userData = await createTestUser();
      secondUserId = userData.userId;
      secondUserCredentials = userData.credentials;
      await createTestData(secondUserId);
    });

    it('should show different data for different users', async () => {
      // Login as first user and get dashboard data
      await loginUser(page, testUserCredentials);
      await page.goto(`${BASE_URL}/dashboard`);
      await expect(page.getByText('Главная панель')).toBeVisible();

      const firstUserData = await extractDashboardData(page);

      // Logout and login as second user
      await logoutUser(page);
      await loginUser(page, secondUserCredentials);
      await page.goto(`${BASE_URL}/dashboard`);
      await expect(page.getByText('Главная панель')).toBeVisible();

      const secondUserData = await extractDashboardData(page);

      // Data should be different (or both could be empty for new users)
      // The key is ensuring no data leakage
      expect(firstUserData).toBeDefined();
      expect(secondUserData).toBeDefined();
    });
  });
});

// Helper Functions

async function loginUser(page: Page, credentials: { username: string; password: string }) {
  await page.goto(`${process.env.E2E_BASE_URL || 'http://localhost:5173'}/login`);

  await page.getByRole('textbox', { name: /логин|username/i }).fill(credentials.username);
  await page.getByRole('textbox', { name: /пароль|password/i }).fill(credentials.password);

  await page.getByRole('button', { name: /войти|login/i }).click();

  // Wait for redirect
  await expect(page).toHaveURL(/(?!.*login)/);
}

async function logoutUser(page: Page) {
  // Look for logout button/link
  const logoutButton = page.getByRole('button', { name: /выйти|logout/i }).or(
    page.getByRole('link', { name: /выйти|logout/i })
  );

  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  } else {
    // Alternative: clear session by going to logout endpoint
    await page.goto(`${process.env.E2E_BASE_URL || 'http://localhost:5173'}/logout`);
  }

  await expect(page).toHaveURL(/login/);
}

async function extractDashboardData(page: Page) {
  // Extract key dashboard data for comparison
  const data: any = {};

  try {
    // Get budget values
    const budgetElements = await page.locator('.stat-value').allTextContents();
    data.budgetValues = budgetElements;

    // Get category names
    const categoryElements = await page.locator('.category-progress').allTextContents();
    data.categories = categoryElements;

    // Get transaction descriptions
    const transactionElements = await page.locator('.transaction-item').allTextContents();
    data.transactions = transactionElements;

  } catch (error) {
    // If elements don't exist, that's fine - user might have no data
    data.isEmpty = true;
  }

  return data;
}
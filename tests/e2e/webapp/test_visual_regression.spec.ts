/**
 * E2E Tests: Visual Regression Testing
 *
 * Tests visual consistency of critical UI components using Playwright screenshot comparison:
 * - Dashboard (desktop + mobile viewports)
 * - Transaction Modal (tabs, form states)
 * - Lists Page (empty state, with items)
 * - Mobile Navigation (bottom nav bar)
 *
 * Authentication: Uses storage state from global setup (tests/e2e/setup/auth.setup.ts)
 *
 * NOTE: First run creates baseline screenshots, subsequent runs compare against baseline
 * Baselines stored in: tests/e2e/webapp/test_visual_regression.spec.ts-snapshots/
 *
 * Update baselines: npm run test:e2e -- --update-snapshots
 */

import { test, expect } from '@playwright/test';

// Viewport sizes for responsive testing
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },   // iPhone 12 mini
  desktop: { width: 1920, height: 1080 }, // Desktop
};

test.describe('Visual Regression - Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Close cookie consent if present
    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }

    // Wait for dashboard to fully load
    await page.waitForSelector('#fab-btn', { state: 'visible', timeout: 10000 });
  });

  test('should match dashboard screenshot on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Wait for dynamic content (charts, stats) to load
    await page.waitForTimeout(2000);

    // Take full page screenshot
    await expect(page).toHaveScreenshot('dashboard-desktop.png', {
      fullPage: true,
      maxDiffPixels: 100, // Allow minor rendering differences
    });
  });

  test('should match dashboard screenshot on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Wait for responsive layout adjustments
    await page.waitForTimeout(1500);

    // Take full page screenshot
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('should match summary cards section', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Locate summary cards container
    const summaryCards = page.locator('.stats, [class*="summary"], [class*="card"]').first();
    const cardsVisible = await summaryCards.isVisible({ timeout: 3000 }).catch(() => false);

    if (cardsVisible) {
      await expect(summaryCards).toHaveScreenshot('dashboard-summary-cards.png', {
        maxDiffPixels: 50,
      });
    } else {
      test.skip();
    }
  });
});

test.describe('Visual Regression - Transaction Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }

    await page.waitForSelector('#fab-btn', { state: 'visible', timeout: 10000 });
  });

  test('should match empty transaction modal on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Open transaction modal
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();
    await page.waitForTimeout(500);

    // Check for Speed Dial (mobile) vs direct modal (desktop)
    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    const speedDialVisible = await speedDialMenu.isVisible({ timeout: 1000 }).catch(() => false);

    if (speedDialVisible) {
      // Click "Добавить транзакцию" in Speed Dial
      const transactionButton = speedDialMenu.locator('button[title*="транзакц" i], button:has-text("Транзакция")').first();
      await transactionButton.click();
    }

    // Modal should be visible
    const modal = page.locator('dialog[open]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Wait for modal animation
    await page.waitForTimeout(500);

    // Screenshot of empty modal
    await expect(modal).toHaveScreenshot('transaction-modal-empty-desktop.png', {
      maxDiffPixels: 100,
    });
  });

  test('should match transaction modal with tabs', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Open modal
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();
    await page.waitForTimeout(500);

    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    const speedDialVisible = await speedDialMenu.isVisible({ timeout: 1000 }).catch(() => false);

    if (speedDialVisible) {
      const transactionButton = speedDialMenu.locator('button[title*="транзакц" i]').first();
      await transactionButton.click();
    }

    const modal = page.locator('dialog[open]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Check for tab navigation (Расход/Доход/Перевод)
    const tabs = modal.locator('button[role="tab"], .tabs button');
    const tabsCount = await tabs.count();

    if (tabsCount > 0) {
      // Screenshot with tabs visible
      await expect(modal).toHaveScreenshot('transaction-modal-with-tabs.png', {
        maxDiffPixels: 100,
      });

      // Switch to Income tab if exists
      const incomeTab = modal.locator('button:has-text("Доход")');
      const incomeTabVisible = await incomeTab.isVisible().catch(() => false);

      if (incomeTabVisible) {
        await incomeTab.click();
        await page.waitForTimeout(300);

        await expect(modal).toHaveScreenshot('transaction-modal-income-tab.png', {
          maxDiffPixels: 100,
        });
      }
    }
  });

  test('should match transaction modal on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Open modal via FAB
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();
    await page.waitForTimeout(500);

    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    await expect(speedDialMenu).toBeVisible({ timeout: 3000 });

    // Click transaction button in Speed Dial
    const transactionButton = speedDialMenu.locator('button[title*="транзакц" i]').first();
    await transactionButton.click();

    const modal = page.locator('dialog[open]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Wait for mobile layout adjustments
    await page.waitForTimeout(500);

    // Screenshot of mobile modal
    await expect(modal).toHaveScreenshot('transaction-modal-mobile.png', {
      maxDiffPixels: 100,
    });
  });
});

test.describe('Visual Regression - Lists Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/lists');
    await page.waitForLoadState('domcontentloaded');

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should match lists page on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Wait for page content to load
    await page.waitForTimeout(2000);

    // Full page screenshot
    await expect(page).toHaveScreenshot('lists-page-desktop.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('should match lists page on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Wait for mobile layout
    await page.waitForTimeout(1500);

    // Full page screenshot
    await expect(page).toHaveScreenshot('lists-page-mobile.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('should match empty state if no lists', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Check for empty state message
    const emptyState = page.locator('text=/нет списков|empty|создайте первый/i');
    const emptyStateVisible = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);

    if (emptyStateVisible) {
      const emptyContainer = emptyState.locator('..').locator('..');
      await expect(emptyContainer).toHaveScreenshot('lists-empty-state.png', {
        maxDiffPixels: 50,
      });
    } else {
      test.skip();
    }
  });

  test('should match list item card', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Look for first list item
    const listItem = page.locator('a[href^="/lists/"], .list-item, tr[data-list-id]').first();
    const itemVisible = await listItem.isVisible({ timeout: 3000 }).catch(() => false);

    if (itemVisible) {
      await expect(listItem).toHaveScreenshot('lists-item-card.png', {
        maxDiffPixels: 50,
      });
    } else {
      test.skip();
    }
  });
});

test.describe('Visual Regression - Mobile Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should match mobile bottom navigation bar', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Wait for bottom nav to render
    await page.waitForTimeout(1500);

    // Look for bottom navigation
    const bottomNav = page.locator('.btm-nav, [class*="bottom-nav"], nav[class*="fixed"]').first();
    const navVisible = await bottomNav.isVisible({ timeout: 3000 }).catch(() => false);

    if (navVisible) {
      await expect(bottomNav).toHaveScreenshot('mobile-bottom-nav.png', {
        maxDiffPixels: 50,
      });
    } else {
      test.skip();
    }
  });

  test('should match mobile navigation with active state', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Navigate to different page to see active state
    await page.goto('/facts');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const bottomNav = page.locator('.btm-nav, [class*="bottom-nav"]').first();
    const navVisible = await bottomNav.isVisible({ timeout: 3000 }).catch(() => false);

    if (navVisible) {
      await expect(bottomNav).toHaveScreenshot('mobile-bottom-nav-facts-active.png', {
        maxDiffPixels: 50,
      });
    } else {
      test.skip();
    }
  });

  test('should match mobile header on different pages', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Test header on Facts page
    await page.goto('/facts');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const header = page.locator('header, .navbar, [class*="header"]').first();
    const headerVisible = await header.isVisible({ timeout: 3000 }).catch(() => false);

    if (headerVisible) {
      await expect(header).toHaveScreenshot('mobile-header-facts.png', {
        maxDiffPixels: 50,
      });

      // Test header on Plans page
      await page.goto('/plans');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      await expect(header).toHaveScreenshot('mobile-header-plans.png', {
        maxDiffPixels: 50,
      });
    } else {
      test.skip();
    }
  });

  test('should match FAB button states', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // FAB button closed state
    const fabButton = page.locator('#fab-btn');
    await expect(fabButton).toBeVisible({ timeout: 5000 });

    await expect(fabButton).toHaveScreenshot('fab-closed.png', {
      maxDiffPixels: 30,
    });

    // FAB button opened state (Speed Dial)
    await fabButton.click();
    await page.waitForTimeout(500);

    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    const speedDialVisible = await speedDialMenu.isVisible({ timeout: 1000 }).catch(() => false);

    if (speedDialVisible) {
      // Screenshot of full Speed Dial menu
      const fabContainer = page.locator('#fab-btn, #fab-speed-dial-menu');
      await expect(fabContainer.first()).toHaveScreenshot('fab-speed-dial-open.png', {
        maxDiffPixels: 50,
      });
    }
  });
});

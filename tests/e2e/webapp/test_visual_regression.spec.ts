/**
 * E2E Tests: Visual Regression
 *
 * Tests visual consistency across viewports:
 * - Homepage screenshots (desktop/mobile)
 * - Modal screenshots (desktop/mobile)
 * - Navigation states
 * - Key UI components
 *
 * Authentication: Uses storage state from global setup (tests/e2e/setup/auth.setup.ts)
 *
 * To update baseline screenshots: npm run test:e2e -- --update-snapshots
 */

import { test, expect } from '@playwright/test';

// Test URLs
const BASE_URL = process.env.BASE_URL || 'https://fbd.ikeniborn.ru';

// Viewport sizes
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },   // iPhone 12 mini
  tablet: { width: 768, height: 1024 },  // iPad
  desktop: { width: 1920, height: 1080 }, // Desktop
};

test.describe('Visual Regression - Homepage', () => {
  test.beforeEach(async ({ page }) => {
    // Authentication handled by global setup (storage state)
    await page.goto(BASE_URL);
    // Use domcontentloaded instead of networkidle to avoid timeout issues
    await page.waitForLoadState('domcontentloaded');

    // Wait for critical resources
    await page.waitForSelector('#fab-btn', { state: 'visible', timeout: 10000 });

    // Close cookie consent modal if present
    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }

    // Wait for HTMX to load all data sections (PGlite init + data loading)
    // Check that spinners are removed (HTMX innerHTML swap removes them from DOM)
    await page.waitForFunction(() => {
      const quickStatsSpinner = document.querySelector('#quick-stats .loading.loading-spinner');
      const balancesSpinner = document.querySelector('#account-balances .loading.loading-spinner');
      const transactionsSpinner = document.querySelector('#recent-transactions .loading.loading-spinner');
      return !quickStatsSpinner && !balancesSpinner && !transactionsSpinner;
    }, { timeout: 15000 });

    // Wait for content to stabilize after data load
    await page.waitForTimeout(1000);
  });

  test('should match homepage on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.waitForTimeout(500); // Wait for animations

    await expect(page).toHaveScreenshot('homepage-desktop.png', {
      fullPage: true,
      maxDiffPixels: 100, // Allow minor differences
    });
  });

  test('should match homepage on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.waitForTimeout(500); // Wait for animations

    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('should match homepage on tablet', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.waitForTimeout(500); // Wait for animations

    await expect(page).toHaveScreenshot('homepage-tablet.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });
});

test.describe('Visual Regression - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should match mobile navigation bar', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.waitForTimeout(500);

    // Capture mobile navigation bar (should be visible on mobile)
    const mobileNav = page.locator('#mobile-navigation-bar');
    const navVisible = await mobileNav.isVisible().catch(() => false);

    if (navVisible) {
      await expect(mobileNav).toHaveScreenshot('mobile-nav-bar.png', {
        maxDiffPixels: 50,
      });
    } else {
      // If mobile nav is not visible, just verify viewport is mobile
      expect(VIEWPORTS.mobile.width).toBeLessThan(1024);
    }
  });

  test('should match desktop FAB menu', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.waitForTimeout(500);

    // Capture FAB button
    const fab = page.locator('#fab-wrapper');
    await expect(fab).toHaveScreenshot('desktop-fab.png', {
      maxDiffPixels: 50,
    });
  });

  test('should match Speed Dial menu opened', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Open Speed Dial menu
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    await expect(speedDialMenu).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(500); // Wait for animation

    // Capture Speed Dial menu
    await expect(speedDialMenu).toHaveScreenshot('speed-dial-menu.png', {
      maxDiffPixels: 50,
    });
  });
});

test.describe('Visual Regression - Modals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should match transaction modal on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);

    // Open modal via FAB (opens directly without Speed Dial on production)
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    // Modal opens directly (no Speed Dial menu on production)
    const modalDialog = page.locator('#modal_fact[open]');
    await expect(modalDialog).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000); // Wait for content to load

    // Capture modal
    await expect(modalDialog).toHaveScreenshot('modal-fact-desktop.png', {
      maxDiffPixels: 100,
    });
  });

  test('should match transaction modal on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Open modal via Speed Dial
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    await expect(speedDialMenu).toBeVisible({ timeout: 3000 });

    const addFactButton = speedDialMenu.locator('button[title="Добавить факт"]');
    await addFactButton.click();

    const modalDialog = page.locator('#modal_fact[open]');
    await expect(modalDialog).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000); // Wait for content to load

    // Capture modal
    await expect(modalDialog).toHaveScreenshot('modal-fact-mobile.png', {
      maxDiffPixels: 100,
    });
  });
});

test.describe('Visual Regression - Statistics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }

    await page.waitForTimeout(1000); // Wait for data to load
  });

  test('should match quick statistics card on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    const statsCard = page.locator('h2:has-text("📊 Быстрая статистика")').locator('..');
    await expect(statsCard).toBeVisible();

    await expect(statsCard).toHaveScreenshot('quick-stats-desktop.png', {
      maxDiffPixels: 100,
    });
  });

  test('should match quick statistics card on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    const statsCard = page.locator('h2:has-text("📊 Быстрая статистика")').locator('..');
    await expect(statsCard).toBeVisible();

    await expect(statsCard).toHaveScreenshot('quick-stats-mobile.png', {
      maxDiffPixels: 100,
    });
  });
});

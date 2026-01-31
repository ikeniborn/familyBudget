/**
 * E2E Tests: Mobile Navigation & Responsive Design
 *
 * Tests responsive layout transitions for Family Budget web app:
 * - Mobile viewport (< 1024px): Mobile navigation bar visible, desktop FAB hidden
 * - Desktop viewport (≥ 1024px): Desktop FAB visible, mobile navigation hidden
 * - Breakpoint transition behavior
 *
 * Authentication: Uses storage state from global setup (tests/e2e/setup/auth.setup.ts)
 * Session is authenticated once before all tests and reused via storageState.
 *
 * See: docs/architecture/guides/browser-testing-workarounds.md
 */

import { test, expect } from '@playwright/test';

// Test URLs
// BASE_URL now uses baseURL from playwright.config.ts (http://localhost for E2E tests)

// Viewport sizes
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },   // iPhone 12 mini
  tablet: { width: 768, height: 1024 },  // iPad
  desktop: { width: 1920, height: 1080 }, // Desktop
  breakpoint: { width: 1024, height: 768 }, // Breakpoint boundary
};

// Breakpoint from responsive design docs
const MOBILE_BREAKPOINT = 1024; // px

test.describe('Mobile Navigation - Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    // Authentication handled by global setup (storage state)
    // Navigate to app
    await page.goto('/');  // Uses baseURL from playwright.config.ts

    // Wait for page load - use domcontentloaded instead of networkidle to avoid timeout
    await page.waitForLoadState('domcontentloaded');

    // Wait for critical resources
    await page.waitForSelector('#fab-btn', { state: 'visible', timeout: 10000 });
  });

  test('should display mobile nav bar when viewport < 1024px', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);

    // Verify viewport changed (THIS IS THE MAIN WORKAROUND TEST)
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(innerWidth).toBe(VIEWPORTS.mobile.width);

    // Verify mobile nav visible (inside #fab-toolbar)
    const mobileNav = page.locator('.mobile-nav-wrapper');
    await expect(mobileNav).toBeVisible();

    // Note: On mobile, both mobile-nav-wrapper AND fab-wrapper are visible
    // This is expected behavior per docs/architecture/frontend/responsive-design.md
  });

  test('should display desktop FAB when viewport ≥ 1024px', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);

    // Verify viewport changed
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(innerWidth).toBe(VIEWPORTS.desktop.width);

    // Verify mobile nav hidden
    const mobileNav = page.locator('.mobile-nav-wrapper');
    const isMobileHidden = await mobileNav.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.display === 'none' ||
             style.visibility === 'hidden' ||
             el.classList.contains('hidden');
    });
    expect(isMobileHidden).toBe(true);

    // Verify desktop FAB visible
    const desktopFab = page.locator('#fab-wrapper');
    await expect(desktopFab).toBeVisible();
  });

  test('should transition layout at 1024px breakpoint', async ({ page }) => {
    // Start at mobile size (< 1024px)
    await page.setViewportSize({ width: 1023, height: 768 });

    let innerWidth = await page.evaluate(() => window.innerWidth);
    expect(innerWidth).toBe(1023);

    // Verify mobile layout active
    let mobileNav = page.locator('.mobile-nav-wrapper');
    await expect(mobileNav).toBeVisible();

    // Resize to desktop size (≥ 1024px)
    await page.setViewportSize({ width: 1024, height: 768 });

    innerWidth = await page.evaluate(() => window.innerWidth);
    expect(innerWidth).toBe(1024);

    // Verify desktop layout active
    const desktopFab = page.locator('#fab-wrapper');
    await expect(desktopFab).toBeVisible();

    // Verify mobile nav hidden
    mobileNav = page.locator('.mobile-nav-wrapper');
    const isHidden = await mobileNav.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.display === 'none' ||
             style.visibility === 'hidden' ||
             el.classList.contains('hidden');
    });
    expect(isHidden).toBe(true);
  });

  test('should display Speed Dial FAB on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);

    // Verify viewport changed
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(innerWidth).toBe(VIEWPORTS.mobile.width);

    // Verify mobile nav visible
    const mobileNav = page.locator('.mobile-nav-wrapper');
    await expect(mobileNav).toBeVisible();

    // Verify FAB button exists (Speed Dial is part of #fab-wrapper)
    const fabButton = page.locator('#fab-btn');
    await expect(fabButton).toBeVisible();
  });

  test('should handle tablet viewport (768px)', async ({ page }) => {
    // Set tablet viewport (still < 1024px, should show mobile layout)
    await page.setViewportSize(VIEWPORTS.tablet);

    // Verify viewport changed
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(innerWidth).toBe(VIEWPORTS.tablet.width);

    // Verify mobile layout active (< 1024px)
    const mobileNav = page.locator('.mobile-nav-wrapper');
    await expect(mobileNav).toBeVisible();
  });

  test('should correctly set viewport width', async ({ page }) => {
    // This test verifies the core workaround: page.setViewportSize() works

    // Test multiple viewport sizes
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1024, height: 768, name: 'breakpoint' },
      { width: 1920, height: 1080, name: 'desktop' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const actualWidth = await page.evaluate(() => window.innerWidth);
      expect(actualWidth).toBe(vp.width);
    }
  });
});

test.describe('Mobile Navigation - User Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Authentication handled by global setup (storage state)
    await page.goto('/');  // Uses baseURL from playwright.config.ts
    await page.waitForLoadState('networkidle');
    await page.setViewportSize(VIEWPORTS.mobile);
  });

  test('should navigate via mobile nav links', async ({ page }) => {
    const mobileNav = page.locator('.mobile-nav-wrapper');
    await expect(mobileNav).toBeVisible();

    // Get all navigation links (mobile nav uses <a> tags, not buttons)
    const navLinks = mobileNav.locator('a.icon-btn');
    const linkCount = await navLinks.count();

    // Should have multiple links (5 links: Главная, Аналитика, Факт, План, Списки)
    expect(linkCount).toBeGreaterThanOrEqual(5);

    // Verify first link is visible and has correct attributes
    const firstLink = navLinks.first();
    await expect(firstLink).toBeVisible();

    const href = await firstLink.getAttribute('href');
    expect(href).toBeTruthy();
  });

  test('should display FAB button on mobile', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);

    // Verify viewport width
    const width = await page.evaluate(() => window.innerWidth);
    expect(width).toBe(VIEWPORTS.mobile.width);

    // Verify FAB button is present (on mobile, FAB is visible for Speed Dial)
    const fabButton = page.locator('#fab-btn');
    await expect(fabButton).toBeVisible();

    // Note: Per responsive-design.md, both mobile-nav-wrapper AND fab-wrapper
    // are visible on mobile (< 1024px). This is expected behavior.
  });
});

test.describe('Mobile Navigation - Performance', () => {
  test('should load mobile navigation quickly', async ({ page }) => {
    // Authentication handled by global setup (storage state)

    // Set mobile viewport before navigation
    await page.setViewportSize(VIEWPORTS.mobile);

    // Start timing
    const startTime = Date.now();

    // Navigate to page
    await page.goto('/');  // Uses baseURL from playwright.config.ts

    // Wait for mobile nav to appear
    const mobileNav = page.locator('.mobile-nav-wrapper');
    await expect(mobileNav).toBeVisible({ timeout: 5000 });

    const loadTime = Date.now() - startTime;

    // Mobile nav should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
});

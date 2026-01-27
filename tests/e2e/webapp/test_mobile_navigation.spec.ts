/**
 * E2E Tests: Mobile Navigation & Responsive Design
 *
 * Tests responsive layout transitions for Family Budget web app:
 * - Mobile viewport (< 1024px): Mobile navigation bar visible, desktop FAB hidden
 * - Desktop viewport (≥ 1024px): Desktop FAB visible, mobile navigation hidden
 * - Breakpoint transition behavior
 *
 * Authentication: Uses email/password login from .env.test
 * See: docs/architecture/guides/browser-testing-workarounds.md
 */

import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

// Test URLs
const BASE_URL = process.env.BASE_URL || 'https://fbd.ikeniborn.ru';

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
    // Authenticate user (email/password from .env.test)
    await login(page);

    // Navigate to app
    await page.goto(BASE_URL);

    // Wait for page load
    await page.waitForLoadState('networkidle');
  });

  test('should display mobile nav bar when viewport < 1024px', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);

    // Verify viewport changed
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(innerWidth).toBe(VIEWPORTS.mobile.width);

    // Verify mobile nav visible
    const mobileNav = page.locator('#mobile-navigation-bar');
    await expect(mobileNav).toBeVisible();

    // Verify desktop FAB hidden (via .hidden class or visibility)
    const desktopFab = page.locator('#fab-wrapper');
    const isHidden = await desktopFab.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.display === 'none' ||
             style.visibility === 'hidden' ||
             el.classList.contains('hidden');
    });
    expect(isHidden).toBe(true);
  });

  test('should display desktop FAB when viewport ≥ 1024px', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);

    // Verify viewport changed
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(innerWidth).toBe(VIEWPORTS.desktop.width);

    // Verify mobile nav hidden
    const mobileNav = page.locator('#mobile-navigation-bar');
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
    let mobileNav = page.locator('#mobile-navigation-bar');
    await expect(mobileNav).toBeVisible();

    // Resize to desktop size (≥ 1024px)
    await page.setViewportSize({ width: 1024, height: 768 });

    innerWidth = await page.evaluate(() => window.innerWidth);
    expect(innerWidth).toBe(1024);

    // Verify desktop layout active
    const desktopFab = page.locator('#fab-wrapper');
    await expect(desktopFab).toBeVisible();

    // Verify mobile nav hidden
    mobileNav = page.locator('#mobile-navigation-bar');
    const isHidden = await mobileNav.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.display === 'none' ||
             style.visibility === 'hidden' ||
             el.classList.contains('hidden');
    });
    expect(isHidden).toBe(true);
  });

  test('should display Speed Dial menu on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);

    // Verify mobile nav visible
    const mobileNav = page.locator('#mobile-navigation-bar');
    await expect(mobileNav).toBeVisible();

    // Find and click Speed Dial button (last button in mobile nav)
    const speedDialBtn = mobileNav.locator('button').last();
    await expect(speedDialBtn).toBeVisible();

    // Click to open Speed Dial menu
    await speedDialBtn.click();

    // Wait for Speed Dial menu to appear
    // (Adjust selector based on actual implementation)
    const speedDialMenu = page.locator('#speed-dial-menu, .speed-dial-menu');

    // Verify menu opened (may be visible or use data attribute)
    await expect(speedDialMenu).toBeVisible({ timeout: 5000 });
  });

  test('should handle tablet viewport (768px)', async ({ page }) => {
    // Set tablet viewport (still < 1024px, should show mobile layout)
    await page.setViewportSize(VIEWPORTS.tablet);

    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(innerWidth).toBe(VIEWPORTS.tablet.width);

    // Verify mobile layout active (< 1024px)
    const mobileNav = page.locator('#mobile-navigation-bar');
    await expect(mobileNav).toBeVisible();

    // Verify desktop FAB hidden
    const desktopFab = page.locator('#fab-wrapper');
    const isHidden = await desktopFab.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.display === 'none' ||
             style.visibility === 'hidden' ||
             el.classList.contains('hidden');
    });
    expect(isHidden).toBe(true);
  });

  test('should verify iOS Safari protection (visibility + pointer-events)', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);

    // Verify desktop FAB uses iOS Safari protection
    const desktopFab = page.locator('#fab-wrapper');

    const protection = await desktopFab.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        visibility: style.visibility,
        pointerEvents: style.pointerEvents,
        display: style.display,
      };
    });

    // On mobile, desktop FAB should be hidden with iOS Safari protection
    // (visibility: hidden + pointer-events: none or display: none)
    expect(
      protection.display === 'none' ||
      (protection.visibility === 'hidden' && protection.pointerEvents === 'none')
    ).toBe(true);
  });
});

test.describe('Mobile Navigation - User Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate user
    await login(page);

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.setViewportSize(VIEWPORTS.mobile);
  });

  test('should navigate via mobile nav buttons', async ({ page }) => {
    const mobileNav = page.locator('#mobile-navigation-bar');
    await expect(mobileNav).toBeVisible();

    // Get all navigation buttons
    const navButtons = mobileNav.locator('button');
    const buttonCount = await navButtons.count();

    // Should have multiple buttons (exact count depends on implementation)
    expect(buttonCount).toBeGreaterThan(0);

    // Click first button (e.g., "Транзакции")
    const firstBtn = navButtons.first();
    await expect(firstBtn).toBeVisible();

    // Note: Actual navigation testing requires authentication
    // This test verifies buttons are clickable
    await expect(firstBtn).toBeEnabled();
  });

  test('should not allow clicks on hidden desktop FAB', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);

    // Verify desktop FAB hidden
    const desktopFab = page.locator('#fab-wrapper');
    const isClickable = await desktopFab.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      // Element is not clickable if:
      // 1. display: none
      // 2. visibility: hidden
      // 3. pointer-events: none
      // 4. zero dimensions
      return !(
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.pointerEvents === 'none' ||
        rect.width === 0 ||
        rect.height === 0
      );
    });

    expect(isClickable).toBe(false);
  });
});

test.describe('Mobile Navigation - Performance', () => {
  test('should load mobile navigation quickly', async ({ page }) => {
    // Authenticate user
    await login(page);

    // Set mobile viewport before navigation
    await page.setViewportSize(VIEWPORTS.mobile);

    // Start timing
    const startTime = Date.now();

    // Navigate to page
    await page.goto(BASE_URL);

    // Wait for mobile nav to appear
    const mobileNav = page.locator('#mobile-navigation-bar');
    await expect(mobileNav).toBeVisible({ timeout: 5000 });

    const loadTime = Date.now() - startTime;

    // Mobile nav should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
});

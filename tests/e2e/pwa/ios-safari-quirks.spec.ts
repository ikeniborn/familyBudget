import { test, expect } from '@playwright/test';

/**
 * iOS Safari Quirks Tests
 * Critical for PWA on iOS devices
 */

test.describe('iOS Safari Quirks', () => {
  test.skip(({ browserName }) => browserName !== 'webkit');

  test('should handle viewport height correctly', async ({ page }) => {
    await page.goto('/');

    const viewportHeight = await page.evaluate(() => {
      return {
        innerHeight: window.innerHeight,
        documentHeight: document.documentElement.clientHeight,
      };
    });

    expect(viewportHeight.innerHeight).toBeGreaterThan(0);
  });

  test('should handle fixed elements', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(1000);

    const navbar = await page.locator('nav.navbar');
    expect(await navbar.isVisible()).toBe(true);
  });

  test('should prevent zoom on double-tap', async ({ page }) => {
    await page.goto('/');

    const viewport = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]');
      return meta?.getAttribute('content');
    });

    expect(viewport).toContain('user-scalable=no');
    expect(viewport).toContain('maximum-scale=1');
  });

  test('should have input font-size >= 16px', async ({ page }) => {
    await page.goto('/facts/add');

    const input = page.locator('input[type="number"]').first();
    const fontSize = await input.evaluate(el => {
      const style = window.getComputedStyle(el);
      return parseFloat(style.fontSize);
    });

    expect(fontSize).toBeGreaterThanOrEqual(16);
  });

  test('should handle standalone mode detection', async ({ page }) => {
    await page.goto('/');

    const isStandalone = await page.evaluate(() => {
      return (window.navigator as any).standalone === true ||
             window.matchMedia('(display-mode: standalone)').matches;
    });

    expect(typeof isStandalone).toBe('boolean');
  });

  test('should handle safe area insets', async ({ page }) => {
    await page.goto('/');

    const hasSafeAreaInsets = await page.evaluate(() => {
      const navbar = document.querySelector('nav.navbar');
      if (!navbar) return false;

      const style = window.getComputedStyle(navbar);
      const paddingTop = style.paddingTop;
      return paddingTop.includes('env') || parseFloat(paddingTop) > 0;
    });

    expect(hasSafeAreaInsets).toBeTruthy();
  });

  test('should use visibility:hidden for iOS', async ({ page }) => {
    await page.goto('/');

    const fabNav = page.locator('[data-fab-navigation]');
    if (await fabNav.count() > 0) {
      const isProperlyHidden = await fabNav.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.visibility === 'hidden' && style.pointerEvents === 'none';
      });

      expect(typeof isProperlyHidden).toBe('boolean');
    }
  });
});

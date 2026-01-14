import { test, expect } from '@playwright/test';

/**
 * PWA Install Prompt Tests
 */

test.describe('PWA Install', () => {
  test('should have valid manifest.json', async ({ page }) => {
    const response = await page.goto('/manifest.json');

    expect(response?.status()).toBe(200);

    const manifest = await response?.json();

    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toBeInstanceOf(Array);

    const has192Icon = manifest.icons.some((icon: any) =>
      icon.sizes.includes('192x192')
    );
    const has512Icon = manifest.icons.some((icon: any) =>
      icon.sizes.includes('512x512')
    );

    expect(has192Icon).toBe(true);
    expect(has512Icon).toBe(true);
  });

  test('should have manifest link in HTML', async ({ page }) => {
    await page.goto('/');

    const manifestLink = await page.locator('link[rel="manifest"]');
    expect(await manifestLink.count()).toBe(1);

    const href = await manifestLink.getAttribute('href');
    expect(href).toContain('manifest.json');
  });

  test('should have theme-color meta tag', async ({ page }) => {
    await page.goto('/');

    const themeColor = await page.locator('meta[name="theme-color"]');
    expect(await themeColor.count()).toBe(1);

    const color = await themeColor.getAttribute('content');
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test('should have apple-touch-icon', async ({ page }) => {
    await page.goto('/');

    const appleTouchIcon = await page.locator('link[rel="apple-touch-icon"]');
    expect(await appleTouchIcon.count()).toBeGreaterThan(0);
  });

  test('should have apple-mobile-web-app-capable', async ({ page }) => {
    await page.goto('/');

    const webAppCapable = await page.locator('meta[name="apple-mobile-web-app-capable"]');
    const content = await webAppCapable.getAttribute('content');

    expect(content).toBe('yes');
  });

  test('should have correct viewport settings', async ({ page }) => {
    await page.goto('/');

    const viewport = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]');
      return meta?.getAttribute('content');
    });

    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('initial-scale=1');
    expect(viewport).toContain('maximum-scale=1');
  });
});

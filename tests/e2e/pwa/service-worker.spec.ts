import { test, expect } from '@playwright/test';

/**
 * Service Worker PWA Tests
 */

test.describe('Service Worker', () => {
  test('should register Service Worker successfully', async ({ page }) => {
    await page.goto('/');

    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await navigator.serviceWorker.ready;
      return registration.active !== null;
    });

    expect(swRegistered).toBe(true);
  });

  test('should have Service Worker controlling', async ({ page }) => {
    await page.goto('/');

    const isControlling = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      for (let i = 0; i < 50; i++) {
        if (navigator.serviceWorker.controller) return true;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return false;
    });

    expect(isControlling).toBe(true);
  });

  test('should cache static assets', async ({ page }) => {
    await page.goto('/');

    const cacheStatus = await page.evaluate(async () => {
      const cache = await caches.open('static-cache-v1');
      const cachedUrls = await cache.keys();
      return {
        hasCss: cachedUrls.some(req => req.url.includes('.css')),
        hasJs: cachedUrls.some(req => req.url.includes('.js')),
        count: cachedUrls.length
      };
    });

    expect(cacheStatus.count).toBeGreaterThan(0);
  });
});

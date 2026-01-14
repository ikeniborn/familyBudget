import { test, expect } from '@playwright/test';

/**
 * Offline Mode PWA Tests
 */

test.describe('Offline Mode', () => {
  test('should display offline indicator', async ({ page, context }) => {
    await page.goto('/');
    await context.setOffline(true);

    const offlineIndicator = await page.waitForSelector('[data-offline-indicator]', {
      state: 'visible',
      timeout: 5000,
    });

    expect(offlineIndicator).toBeTruthy();
    await context.setOffline(false);
  });

  test('should save transaction to queue when offline', async ({ page, context }) => {
    await page.goto('/');
    await page.click('a[href="/facts/add"]');
    await page.waitForLoadState('networkidle');

    await context.setOffline(true);

    await page.fill('input[name="amount"]', '100');
    await page.fill('input[name="description"]', 'Offline test');
    await page.click('button[type="submit"]');

    const toast = await page.waitForSelector('.toast:has-text("Сохранено офлайн")', {
      state: 'visible',
      timeout: 5000,
    });

    expect(toast).toBeTruthy();
    await context.setOffline(false);
  });

  test('should sync when back online', async ({ page, context }) => {
    await page.goto('/');
    await page.click('a[href="/facts/add"]');
    await context.setOffline(true);

    await page.fill('input[name="amount"]', '200');
    await page.fill('input[name="description"]', 'Sync test');
    await page.click('button[type="submit"]');

    await page.waitForSelector('.toast:has-text("Сохранено офлайн")');
    await context.setOffline(false);

    await page.click('[data-sync-button]').catch(() => {});

    const syncToast = await page.waitForSelector('.toast:has-text("Синхронизировано")', {
      state: 'visible',
      timeout: 10000,
    });

    expect(syncToast).toBeTruthy();
  });
});

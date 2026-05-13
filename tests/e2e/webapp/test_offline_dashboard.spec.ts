/**
 * E2E Tests: Offline Dashboard
 *
 * Verifies offline dashboard rendering using Playwright's network simulation.
 * Tests: offline badge visible, sections rendered, online restore works.
 *
 * Prerequisites:
 * - Dexie must be activated (enablePGlite=true in localStorage) on fbd.ikeniborn.ru
 * - At least one fact must be synced to IndexedDB before going offline
 *
 * Authentication: Uses storage state from global setup (tests/e2e/setup/auth.setup.ts)
 */

import { test, expect } from '@playwright/test';

test.describe('Offline Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Load dashboard online first to sync Dexie
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#quick-stats', { state: 'visible', timeout: 15000 });

    // Wait for HTMX sections to load (spinner disappears)
    await page.waitForFunction(() => {
      const qs = document.getElementById('quick-stats');
      return qs && !qs.querySelector('.loading');
    }, { timeout: 15000 });
  });

  test('offline badge visible in quick-stats when page loaded offline', async ({ page, context }) => {
    // Go offline before reload
    await context.setOffline(true);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Wait for offline rendering (coordinator proactive renderAll)
    await page.waitForFunction(() => {
      const qs = document.getElementById('quick-stats');
      return qs && qs.innerHTML.includes('Данные из локального хранилища');
    }, { timeout: 10000 });

    await expect(page.locator('#quick-stats')).toContainText('Данные из локального хранилища');
    await expect(page.locator('#account-balances')).toContainText('Данные из локального хранилища');
  });

  test('recent-transactions card becomes visible when offline', async ({ page, context }) => {
    await context.setOffline(true);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Card should become visible (data-offline-hidden removed)
    await page.waitForFunction(() => {
      const card = document.getElementById('recent-transactions-card');
      return card && !card.hasAttribute('data-offline-hidden');
    }, { timeout: 10000 });

    const card = page.locator('#recent-transactions-card');
    await expect(card).not.toHaveAttribute('data-offline-hidden');
  });

  test('coming back online removes offline badge and restores HTMX data', async ({ page, context }) => {
    // Go offline
    await context.setOffline(true);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Wait for offline badge
    await page.waitForFunction(() => {
      const qs = document.getElementById('quick-stats');
      return qs && qs.innerHTML.includes('Данные из локального хранилища');
    }, { timeout: 10000 });

    // Come back online
    await context.setOffline(false);

    // Dispatch offline-status-change event manually (simulates what offline manager does)
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('offline-status-change', { detail: { online: true } }));
    });

    // Wait for offline badge to disappear
    await page.waitForFunction(() => {
      const qs = document.getElementById('quick-stats');
      return qs && !qs.innerHTML.includes('Данные из локального хранилища');
    }, { timeout: 15000 });

    // card should be hidden again
    await expect(page.locator('#recent-transactions-card')).toHaveAttribute('data-offline-hidden', 'true');
  });

  test('adding transaction offline reflects in quick-stats after re-render', async ({ page, context }) => {
    const dexieActive = await page.evaluate(() => localStorage.getItem('enablePGlite') === 'true');
    if (!dexieActive) { test.skip(true, 'Dexie not active in this environment'); return; }

    // Go offline
    await context.setOffline(true);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Wait for offline badge
    await page.waitForFunction(() => {
      const qs = document.getElementById('quick-stats');
      return qs && qs.innerHTML.includes('Данные из локального хранилища');
    }, { timeout: 10000 });

    // Capture expense total before
    const expenseBefore = await page.evaluate(() => {
      const qs = document.getElementById('quick-stats');
      return qs?.innerHTML ?? '';
    });

    // Open add transaction modal and add expense offline
    await page.click('#fab-btn');
    await page.waitForSelector('dialog#modal_fact[open]', { timeout: 5000 });
    await page.fill('input[name="amount"]', '999');
    await page.click('button[type="submit"]');
    await page.waitForSelector('dialog#modal_fact:not([open])', { timeout: 5000 });

    // Dispatch offline-status-change event to trigger re-render from Dexie
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('offline-status-change', { detail: { online: false } }));
    });

    await page.waitForFunction((before: string) => {
      const qs = document.getElementById('quick-stats');
      return qs && qs.innerHTML !== before && qs.innerHTML.includes('Данные из локального хранилища');
    }, expenseBefore, { timeout: 10000 });

    // Stats grid must still be visible (not spinner)
    await expect(page.locator('#quick-stats .stats-grid')).toBeVisible();
  });

  test('quick-stats shows data (not empty state) when Dexie has facts', async ({ page, context }) => {
    // Only runs meaningfully if Dexie is active and synced
    const dexieActive = await page.evaluate(() => {
      return localStorage.getItem('enablePGlite') === 'true';
    });

    if (!dexieActive) {
      test.skip(true, 'Dexie not active in this environment');
      return;
    }

    await context.setOffline(true);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await page.waitForFunction(() => {
      const qs = document.getElementById('quick-stats');
      return qs && qs.innerHTML.includes('Данные из локального хранилища');
    }, { timeout: 10000 });

    // Stats grid should be rendered
    await expect(page.locator('#quick-stats .stats-grid')).toBeVisible();
  });
});

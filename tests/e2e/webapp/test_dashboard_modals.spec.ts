/**
 * E2E Regression: Dashboard add-modals — BUG-1
 *
 * Source: tmp/test_plans/report_01_dashboard_2026-04-26.md
 *
 * The dashboard previously rendered four <dialog> elements because index.html
 * instantiated the modal_fact / modal_plan macros twice (as #modal_add_transaction
 * + #modal_add_plan AND as #modal_fact + #modal_plan). Side-effect: double
 * loadFinancialCenters fetch (BUG-2).
 *
 * Authentication: Uses storage state from global setup.
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard modals — BUG-1 regression', () => {
  test('renders exactly one #modal_fact and one #modal_plan, no stale duplicates', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('dialog#modal_fact', { state: 'attached', timeout: 10000 });

    expect(await page.locator('dialog#modal_fact').count()).toBe(1);
    expect(await page.locator('dialog#modal_plan').count()).toBe(1);
    expect(await page.locator('dialog#modal_add_transaction').count()).toBe(0);
    expect(await page.locator('dialog#modal_add_plan').count()).toBe(0);
  });
});

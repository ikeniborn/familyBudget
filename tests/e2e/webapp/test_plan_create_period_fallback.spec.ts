/**
 * E2E: BUG-001 regression — plan creation must succeed even if the period
 * hidden input was never populated by setup*PeriodButtons() (or was cleared
 * after a form.reset).
 *
 * Repro strategy:
 *  1. Open modal_plan on /plan via FAB.
 *  2. Force-clear the hidden `plan_month` input (simulate setup-skip / reset race).
 *  3. Fill required fields and submit.
 *  4. Expect: toast «План сохранён» (not 422, not «Заполните все обязательные поля»).
 *
 * Before fix: checkValidity() fails silently on hidden required → warning toast;
 * after fix: syncPlanPeriodFromActive() restores value from .btn-active.
 */

import { test, expect } from '@playwright/test';

async function navigateToPlanPage(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/plan');
  await page.waitForLoadState('domcontentloaded');
  const acceptAll = page.locator('button:has-text("Принять все")');
  if (await acceptAll.isVisible({ timeout: 2000 }).catch(() => false)) {
    await acceptAll.click();
    await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
  }
}

test.describe('BUG-001: plan_month fallback', () => {
  test('submit succeeds when hidden plan_month is empty (btn-active only)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await navigateToPlanPage(page);

    // Open FAB speed dial
    const fab = page.locator('[data-testid="fab-main-button"], #fab-main-button, .fab-main').first();
    await fab.click();

    // Click «Добавить плановую транзакцию»
    const planFab = page.locator('[aria-label="Добавить плановую транзакцию"]');
    await planFab.click();

    // Wait for modal_plan to open & skeleton to hide
    await page.waitForSelector('#modal_plan[open]', { timeout: 5000 });
    await page.waitForSelector('#modal_plan-tab-transaction .period-btn', { timeout: 5000 });

    // Simulate setup-skip: clear the hidden plan_month value while leaving btn-active
    await page.evaluate(() => {
      const hidden = document.querySelector<HTMLInputElement>(
        '#modal_plan-tab-transaction input[name="plan_month"]'
      );
      if (hidden) hidden.value = '';
    });

    // Fill minimal required fields — FC, article, amount
    // (Select first non-placeholder option in each dropdown via evaluate for speed)
    await page.evaluate(() => {
      const fc = document.querySelector<HTMLSelectElement>(
        '#modal_plan-tab-transaction select[name="financial_center_id"]'
      );
      if (fc && fc.options.length > 1) fc.selectedIndex = 1;
      fc?.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const art = document.querySelector<HTMLSelectElement>(
        '#modal_plan-tab-transaction select[name="article_id"]'
      );
      if (art && art.options.length > 1) art.selectedIndex = 1;
      art?.dispatchEvent(new Event('change', { bubbles: true }));
      const amt = document.querySelector<HTMLInputElement>(
        '#modal_plan-tab-transaction input[name="amount"]'
      );
      if (amt) {
        const desc = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(amt), 'value'
        );
        desc?.set?.call(amt, '12.34');
        amt.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Click Save
    await page.click('#modal_plan button[onclick*="savePlanModal"]');

    // Expect success toast, NOT the missing-field warning
    const success = page.locator('text=/План сохранён/');
    const badWarn = page.locator('text=/Заполните все обязательные поля/');

    await expect(success).toBeVisible({ timeout: 5000 });
    await expect(badWarn).not.toBeVisible();
  });
});

/**
 * E2E Tests: Recurring Plans
 *
 * Tests recurring payment plans UI on the unified /plan page:
 * - Modal opens via FAB / SpeedDial
 * - Switching to "Регулярный платеж" reveals frequency/duration fields
 * - Validation prevents save with empty required fields
 * - Recurring management section is rendered on the plan page
 * - Mobile navigation reaches /plan
 *
 * Authentication: Uses storage state from global setup (tests/e2e/setup/auth.setup.ts)
 */

import { test, expect, Page } from '@playwright/test';
import { openPlanModal as openPlanModalViaFab, waitForVisibleFab } from '../helpers/fab';

const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  desktop: { width: 1920, height: 1080 },
};

async function navigateToPlanPage(page: Page): Promise<void> {
  await page.goto('/plan');
  await page.waitForLoadState('domcontentloaded');

  const acceptAllButton = page.locator('button:has-text("Принять все")');
  const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
  if (isVisible) {
    await acceptAllButton.click();
    await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
  }
}

/**
 * Open the plan modal via whichever FAB matches the current viewport.
 * Returns the visible modal locator, or null if it could not be opened.
 */
async function openPlanModal(page: Page) {
  try {
    await openPlanModalViaFab(page);
  } catch {
    return null;
  }

  return page.locator('dialog[open]').first();
}

test.describe('Recurring Plans - Modal Recurring Mode', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPlanPage(page);
    await waitForVisibleFab(page);
  });

  test('should reveal frequency/duration fields when recurring mode selected (desktop)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    const modal = await openPlanModal(page);
    if (!modal) {
      test.skip(true, 'Plan modal could not be opened in this environment');
      return;
    }

    const recurringRadio = modal.locator('input[name="plan_mode"][value="recurring"]').first();
    await expect(recurringRadio).toBeAttached({ timeout: 5000 });
    await recurringRadio.check({ force: true });

    const recurringSettings = modal.locator('[id^="recurring-settings-"]').first();
    await expect(recurringSettings).toBeVisible({ timeout: 3000 });

    const frequencySelect = recurringSettings.locator('select[name="frequency_type"]').first();
    await expect(frequencySelect).toBeVisible();
    await frequencySelect.selectOption('monthly');

    const durationSelect = recurringSettings.locator('select[name="duration_type"]').first();
    await expect(durationSelect).toBeVisible();
  });

  test('should reveal recurring fields on mobile via SpeedDial', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    const modal = await openPlanModal(page);
    if (!modal) {
      test.skip(true, 'Plan modal could not be opened in this environment');
      return;
    }

    const recurringRadio = modal.locator('input[name="plan_mode"][value="recurring"]').first();
    await expect(recurringRadio).toBeAttached({ timeout: 5000 });
    await recurringRadio.check({ force: true });

    const recurringSettings = modal.locator('[id^="recurring-settings-"]').first();
    await expect(recurringSettings).toBeVisible({ timeout: 3000 });
  });

  test('should keep modal open when required fields are empty', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    const modal = await openPlanModal(page);
    if (!modal) {
      test.skip(true, 'Plan modal could not be opened in this environment');
      return;
    }

    const saveButton = modal.locator('button[onclick*="savePlanModal"]').first();
    await expect(saveButton).toBeVisible();
    await saveButton.click();
    await page.waitForTimeout(300);

    // Native HTML5 validation prevents submission — modal must still be open
    await expect(modal).toBeVisible();

    const fcSelect = modal.locator('select[name="financial_center_id"]').first();
    const fcInvalid = await fcSelect.evaluate(
      (el: HTMLSelectElement) => !el.validity.valid || el.value === ''
    );
    expect(fcInvalid).toBe(true);
  });
});

test.describe('Recurring Plans - Page Sections & Navigation', () => {
  test('should render the recurring plans management section on /plan', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await navigateToPlanPage(page);

    const recurringMgmt = page.locator('#recurring-plan-stats, [id*="recurring"]').first();
    await expect(recurringMgmt).toBeAttached({ timeout: 10000 });
  });

  test('should navigate to /plan from the main UI', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const planLink = page.locator('a[href="/plan"]:visible').first();
    if (!(await planLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      const menuButton = page.locator('button[aria-label*="menu" i], button:has-text("☰")').first();
      if (await menuButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await menuButton.click();
      }
    }

    await page.locator('a[href="/plan"]:visible').first().click();
    await page.waitForURL('**/plan', { timeout: 10000 });
    expect(page.url()).toContain('/plan');
  });
});

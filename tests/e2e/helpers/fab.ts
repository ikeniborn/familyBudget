/**
 * FAB (floating action button) helpers for E2E tests.
 *
 * The app renders two FABs: the mobile #fab-btn (visible below 1024px) and
 * the desktop #desktop-fab-btn (visible at 1024px and above). Waiting for
 * `#fab-btn` on a desktop viewport races the stylesheet load and fails once
 * the media query hides the mobile wrapper — always wait for whichever FAB
 * matches the current viewport instead.
 */
import { Page, expect } from '@playwright/test';

const FACT_ACTION_LABEL = 'Добавить фактическую транзакцию';
const PLAN_ACTION_LABEL = 'Добавить плановую транзакцию';

/** Wait for the FAB that matches the current viewport. Call after setViewportSize. */
export async function waitForVisibleFab(page: Page): Promise<void> {
  await expect(page.locator('#fab-btn:visible, #desktop-fab-btn:visible').first())
    .toBeVisible({ timeout: 10000 });
}

async function openFabAction(page: Page, label: string): Promise<void> {
  const desktopFab = page.locator('#desktop-fab-btn');
  if (await desktopFab.isVisible().catch(() => false)) {
    await desktopFab.click();
    await page.locator(`#desktop-fab-wrapper button[aria-label="${label}"]`).click({ timeout: 5000 });
  } else {
    await page.locator('#fab-btn').click();
    const speedDial = page.locator('#fab-speed-dial-menu');
    if (await speedDial.isVisible({ timeout: 1500 }).catch(() => false)) {
      await speedDial.locator(`button[aria-label="${label}"]`).click();
    }
    // Off the home page the mobile FAB triggers the page-context action directly
  }
  const modal = page.locator('dialog[open]').first();
  await expect(modal).toBeVisible({ timeout: 5000 });
  // Wait out the modal's async init — while the skeleton shows, the form is
  // hidden and the active tab may still be reset
  await expect(modal.locator('[id$="-loading-skeleton"]')).toBeHidden({ timeout: 10000 });
  await page.waitForTimeout(300);
}

/** Open the fact (transaction) modal via whichever FAB is visible. */
export async function openFactModal(page: Page): Promise<void> {
  await openFabAction(page, FACT_ACTION_LABEL);
}

/** Open the plan modal via whichever FAB is visible. */
export async function openPlanModal(page: Page): Promise<void> {
  await openFabAction(page, PLAN_ACTION_LABEL);
}

/** Open the fact modal and switch to the "Перевод" (transfer) tab. */
export async function openTransferTab(page: Page): Promise<void> {
  await openFactModal(page);
  const modal = page.locator('dialog[open]').first();
  // The tab switch listens for click, not change — check() does not fire it
  await modal.locator('input[role="tab"][aria-label="Перевод"]').click({ timeout: 5000 });
  await expect(modal.locator('[id$="-tab-transfer"]')).not.toHaveClass(/hidden/, { timeout: 5000 });
  await expect(modal.locator('select[name="from_financial_center_id"]')).toBeVisible({ timeout: 5000 });
}

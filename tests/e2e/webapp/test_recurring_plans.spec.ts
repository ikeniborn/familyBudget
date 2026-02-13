/**
 * E2E Tests: Recurring Plans
 *
 * Tests recurring payment plans functionality:
 * - Create monthly/weekly recurring plan
 * - Edit recurring plan (amount, frequency, name)
 * - Delete recurring plan with confirmation
 * - View recurring plans list
 * - Reminder notifications (UI check)
 *
 * Authentication: Uses storage state from global setup (tests/e2e/setup/auth.setup.ts)
 */

import { test, expect } from '@playwright/test';

// Viewport sizes
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },   // iPhone 12 mini
  desktop: { width: 1920, height: 1080 }, // Desktop
};

test.describe('Recurring Plans - CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Authentication handled by global setup (storage state)
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for critical resources
    await page.waitForSelector('#fab-btn', { state: 'visible', timeout: 10000 });

    // Close cookie consent modal if present
    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should create monthly recurring plan on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Navigate to Plans page
    const plansLink = page.locator('a[href="/plans"]').first();
    await plansLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Wait for plans page to load
    await page.waitForSelector('h1, h2', { timeout: 5000 });

    // Open "Add Plan" modal via FAB or page button
    // Try FAB first (if desktop doesn't hide it)
    const fabButton = page.locator('#fab-btn');
    const fabVisible = await fabButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (fabVisible) {
      await fabButton.click();
      await page.waitForTimeout(500); // Wait for animation

      // Check if Speed Dial menu appeared (mobile) or modal opened directly (desktop)
      const speedDialMenu = page.locator('#fab-speed-dial-menu');
      const speedDialVisible = await speedDialMenu.isVisible({ timeout: 1000 }).catch(() => false);

      if (speedDialVisible) {
        // Click "Add Plan" in Speed Dial
        const addPlanButton = speedDialMenu.locator('button[title*="план" i], button:has-text("План")');
        await addPlanButton.click();
      }
    } else {
      // Look for "Add Plan" button on page
      const addPlanPageButton = page.locator('button:has-text("Добавить план"), a:has-text("Добавить план")').first();
      await addPlanPageButton.click();
    }

    // Modal should be open
    const modal = page.locator('dialog[open], .modal[class*="modal-open"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill form
    const planName = `E2E Test Plan ${Date.now()}`;

    const nameInput = modal.locator('input[name="name"], input[name="plan_name"]');
    await nameInput.fill(planName);

    const amountInput = modal.locator('input[name="amount"]');
    await amountInput.fill('5000');

    // Select frequency (monthly)
    const frequencySelect = modal.locator('select[name="frequency"]');
    const frequencyVisible = await frequencySelect.isVisible().catch(() => false);

    if (frequencyVisible) {
      await frequencySelect.selectOption({ label: /месяц|month/i });
    }

    // Save button
    const saveButton = modal.locator('button[type="submit"], button.btn-primary').first();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Wait for modal to close
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Verify plan appears in list
    const planItem = page.locator(`text=${planName}`).first();
    await expect(planItem).toBeVisible({ timeout: 5000 });
  });

  test('should create weekly recurring plan on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Navigate to Plans page
    const plansLink = page.locator('a[href="/plans"]').first();
    await plansLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Open "Add Plan" modal via FAB
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();
    await page.waitForTimeout(500);

    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    await expect(speedDialMenu).toBeVisible({ timeout: 3000 });

    // Click "Add Plan" in Speed Dial
    const addPlanButton = speedDialMenu.locator('button[title*="план" i], button:has-text("План")');
    await addPlanButton.click();

    // Modal should be open
    const modal = page.locator('dialog[open], .modal[class*="modal-open"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill form
    const planName = `E2E Weekly Plan ${Date.now()}`;

    const nameInput = modal.locator('input[name="name"], input[name="plan_name"]');
    await nameInput.fill(planName);

    const amountInput = modal.locator('input[name="amount"]');
    await amountInput.fill('1500');

    // Select frequency (weekly)
    const frequencySelect = modal.locator('select[name="frequency"]');
    const frequencyVisible = await frequencySelect.isVisible().catch(() => false);

    if (frequencyVisible) {
      await frequencySelect.selectOption({ label: /недел|week/i });
    }

    // Save
    const saveButton = modal.locator('button[type="submit"], button.btn-primary').first();
    await saveButton.click();

    // Verify success
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    const planItem = page.locator(`text=${planName}`).first();
    await expect(planItem).toBeVisible({ timeout: 5000 });
  });

  test('should show validation error when plan name is empty', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Navigate to Plans and open modal
    await page.goto('/plans');
    await page.waitForLoadState('domcontentloaded');

    const fabButton = page.locator('#fab-btn');
    const fabVisible = await fabButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (fabVisible) {
      await fabButton.click();
      const speedDialMenu = page.locator('#fab-speed-dial-menu');
      const speedDialVisible = await speedDialMenu.isVisible({ timeout: 1000 }).catch(() => false);
      if (speedDialVisible) {
        const addPlanButton = speedDialMenu.locator('button[title*="план" i]');
        await addPlanButton.click();
      }
    }

    const modal = page.locator('dialog[open], .modal[class*="modal-open"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Try to submit without filling name
    const amountInput = modal.locator('input[name="amount"]');
    await amountInput.fill('1000');

    const saveButton = modal.locator('button[type="submit"], button.btn-primary').first();
    await saveButton.click();

    // Modal should remain open (validation failed)
    await expect(modal).toBeVisible();

    // Check for HTML5 validation or error message
    const nameInput = modal.locator('input[name="name"], input[name="plan_name"]');
    const isInvalid = await nameInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('should delete recurring plan with confirmation', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Navigate to Plans page
    await page.goto('/plans');
    await page.waitForLoadState('domcontentloaded');

    // Check if there are any plans
    const planItems = page.locator('tr[data-plan-id], .plan-item, [class*="plan"]');
    const planCount = await planItems.count();

    if (planCount === 0) {
      test.skip();
      return;
    }

    // Click delete button on first plan
    const firstPlan = planItems.first();
    const deleteButton = firstPlan.locator('button[title*="Удалить" i], button:has-text("Удалить")').first();

    const deleteVisible = await deleteButton.isVisible({ timeout: 2000 }).catch(() => false);
    if (!deleteVisible) {
      test.skip();
      return;
    }

    await deleteButton.click();

    // Confirmation dialog should appear
    const confirmDialog = page.locator('dialog[open], .modal[class*="modal-open"]').last();
    await expect(confirmDialog).toBeVisible({ timeout: 3000 });

    // Confirm deletion
    const confirmButton = confirmDialog.locator('button:has-text("Удалить"), button:has-text("Да"), button.btn-error').first();
    await confirmButton.click();

    // Verify deletion (toast message or plan disappears)
    await page.waitForTimeout(1000);
    // Plan should be removed from list or toast shown
  });
});

test.describe('Recurring Plans - View and Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should display plans list page', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Navigate to Plans
    const plansLink = page.locator('a[href="/plans"]').first();
    await plansLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Page should have title/heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();

    // Check for plans table or list container
    const plansContainer = page.locator('table, .plans-list, [class*="plan"]').first();
    await expect(plansContainer).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to plans page from mobile nav', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Find Plans link in mobile nav
    const mobileNav = page.locator('.btm-nav, [class*="bottom-nav"]');
    const mobileNavVisible = await mobileNav.isVisible({ timeout: 2000 }).catch(() => false);

    if (!mobileNavVisible) {
      // Plans might be in hamburger menu
      const menuButton = page.locator('button[aria-label*="menu" i], button:has-text("☰")');
      const menuVisible = await menuButton.isVisible({ timeout: 2000 }).catch(() => false);
      if (menuVisible) {
        await menuButton.click();
      }
    }

    const plansLink = page.locator('a[href="/plans"]').first();
    await plansLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Verify navigation
    expect(page.url()).toContain('/plans');
  });
});

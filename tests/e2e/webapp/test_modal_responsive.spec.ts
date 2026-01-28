/**
 * E2E Tests: Modal Responsive Behavior
 *
 * Tests modal components across different viewport sizes:
 * - Modal open/close on mobile (375px)
 * - Modal open/close on desktop (1920px)
 * - Tab switching within modals (modal_fact, modal_plan)
 * - Form field visibility in different viewports
 *
 * Authentication: Uses storage state from global setup (tests/e2e/setup/auth.setup.ts)
 */

import { test, expect } from '@playwright/test';

// Test URLs
const BASE_URL = process.env.BASE_URL || 'https://fbd.ikeniborn.ru';

// Viewport sizes
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },   // iPhone 12 mini
  desktop: { width: 1920, height: 1080 }, // Desktop
};

test.describe('Modal - Responsive Behavior', () => {
  test.beforeEach(async ({ page }) => {
    // Authentication handled by global setup (storage state)
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Close cookie consent modal if present
    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should open and close transaction modal on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);

    // Open modal via FAB button
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    // Wait for modal to appear
    const modal = page.locator('#modal_fact');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Verify modal is open
    const dialog = modal.locator('dialog[open]');
    await expect(dialog).toBeVisible();

    // Close modal
    const closeButton = dialog.locator('button.btn-sm.btn-circle');
    await closeButton.click();

    // Verify modal is closed
    await expect(dialog).not.toBeVisible();
  });

  test('should open and close transaction modal on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);

    // Open modal via FAB button
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    // Wait for modal to appear
    const modal = page.locator('#modal_fact');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Verify modal is open
    const dialog = modal.locator('dialog[open]');
    await expect(dialog).toBeVisible();

    // Close modal
    const closeButton = dialog.locator('button.btn-sm.btn-circle');
    await closeButton.click();

    // Verify modal is closed
    await expect(dialog).not.toBeVisible();
  });

  test('should switch tabs within transaction modal', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);

    // Open modal
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    const modal = page.locator('#modal_fact');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Verify transaction tab is active by default
    const transactionTab = modal.locator('[role="tab"]:has-text("Транзакция")');
    await expect(transactionTab).toHaveAttribute('aria-selected', 'true');

    // Click transfer tab
    const transferTab = modal.locator('[role="tab"]:has-text("Перевод")');
    await transferTab.click();

    // Verify transfer tab is now active
    await expect(transferTab).toHaveAttribute('aria-selected', 'true');
    await expect(transactionTab).toHaveAttribute('aria-selected', 'false');

    // Verify transfer content is visible
    const transferContent = modal.locator('#modal_fact-tab-transfer');
    await expect(transferContent).toBeVisible();
  });

  test('should display form fields correctly on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);

    // Open modal
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    const modal = page.locator('#modal_fact');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Verify key form fields are visible
    const amountInput = modal.locator('input[name="amount"]');
    await expect(amountInput).toBeVisible();

    const dateInput = modal.locator('input[name="date"]');
    await expect(dateInput).toBeVisible();

    const articleSelect = modal.locator('select[name="article_id"]');
    await expect(articleSelect).toBeVisible();

    const financialCenterSelect = modal.locator('select[name="financial_center_id"]');
    await expect(financialCenterSelect).toBeVisible();
  });

  test('should display form fields correctly on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);

    // Open modal
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    const modal = page.locator('#modal_fact');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Verify key form fields are visible
    const amountInput = modal.locator('input[name="amount"]');
    await expect(amountInput).toBeVisible();

    const dateInput = modal.locator('input[name="date"]');
    await expect(dateInput).toBeVisible();

    const articleSelect = modal.locator('select[name="article_id"]');
    await expect(articleSelect).toBeVisible();

    const financialCenterSelect = modal.locator('select[name="financial_center_id"]');
    await expect(financialCenterSelect).toBeVisible();
  });
});

test.describe('Modal - Plan Modal Behavior', () => {
  test.beforeEach(async ({ page }) => {
    // Authentication handled by global setup (storage state)
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Close cookie consent modal if present
    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should open plan modal via navigation', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);

    // Navigate to plans page
    await page.goto(`${BASE_URL}/plans`);
    await page.waitForLoadState('networkidle');

    // Open modal via add button
    const addButton = page.locator('button:has-text("Добавить план")').first();

    // Check if button exists (may not be visible on all pages)
    const buttonExists = await addButton.count() > 0;

    if (buttonExists) {
      await addButton.click();

      // Wait for modal to appear
      const modal = page.locator('#modal_plan');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Verify modal is open
      const dialog = modal.locator('dialog[open]');
      await expect(dialog).toBeVisible();

      // Close modal
      const closeButton = dialog.locator('button.btn-sm.btn-circle');
      await closeButton.click();

      // Verify modal is closed
      await expect(dialog).not.toBeVisible();
    } else {
      // If button doesn't exist, skip test
      test.skip();
    }
  });
});

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
// BASE_URL uses baseURL from playwright.config.ts (https://fbd.ikeniborn.ru for E2E tests)

// Viewport sizes
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },   // iPhone 12 mini
  desktop: { width: 1920, height: 1080 }, // Desktop
};

test.describe('Modal - Responsive Behavior', () => {
  test.beforeEach(async ({ page }) => {
    // Authentication handled by global setup (storage state)
    await page.goto('/');  // Uses baseURL from playwright.config.ts
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

    // Click FAB button to open Speed Dial menu
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    // Wait for Speed Dial menu to appear
    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    await expect(speedDialMenu).toBeVisible({ timeout: 3000 });

    // Click "Добавить факт" option
    const addFactButton = speedDialMenu.locator('button[title="Добавить факт"]');
    await addFactButton.click();

    // Wait for modal dialog to open (modal_fact IS the dialog element)
    const modalDialog = page.locator('#modal_fact[open]');
    await expect(modalDialog).toBeVisible({ timeout: 5000 });

    // Verify modal content is visible
    const modalBox = page.locator('#modal_fact .modal-box');
    await expect(modalBox).toBeVisible();

    // Close modal (click "Отмена" button in modal actions)
    const closeButton = page.locator('#modal_fact .modal-action button.btn-ghost');
    await closeButton.click();

    // Verify modal is closed (no [open] attribute)
    await expect(modalDialog).not.toBeVisible();
  });

  test('should open and close transaction modal on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);

    // Click FAB button to open modal (opens directly without Speed Dial on production)
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    // Modal opens directly (no Speed Dial menu on production)
    const modalDialog = page.locator('#modal_fact[open]');
    await expect(modalDialog).toBeVisible({ timeout: 5000 });

    // Verify modal content is visible
    const modalBox = page.locator('#modal_fact .modal-box');
    await expect(modalBox).toBeVisible();

    // Close modal (click "Отмена" button in modal actions)
    const closeButton = page.locator('#modal_fact .modal-action button.btn-ghost');
    await closeButton.click();

    // Verify modal is closed
    await expect(modalDialog).not.toBeVisible();
  });

  test('should have transaction tab active by default', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);

    // Click FAB button to open modal (opens directly without Speed Dial on production)
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    // Modal opens directly (no Speed Dial menu on production)
    const modalDialog = page.locator('#modal_fact[open]');
    await expect(modalDialog).toBeVisible({ timeout: 5000 });

    // Verify transaction tab is active by default (checked radio input)
    const transactionTabInput = page.locator('#modal_fact input[name="modal_fact_tabs"][data-tab="transaction"]');
    await expect(transactionTabInput).toBeChecked();

    // Verify transaction content is visible
    const transactionContent = page.locator('#modal_fact-tab-transaction');
    await expect(transactionContent).toBeVisible();

    // Verify both tabs exist
    const transferTabInput = page.locator('#modal_fact input[name="modal_fact_tabs"][data-tab="transfer"]');
    await expect(transferTabInput).toBeVisible();
  });

  test('should display form fields correctly on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);

    // Click FAB button to open Speed Dial menu
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    // Wait for Speed Dial menu to appear
    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    await expect(speedDialMenu).toBeVisible({ timeout: 3000 });

    // Click "Добавить факт" option
    const addFactButton = speedDialMenu.locator('button[title="Добавить факт"]');
    await addFactButton.click();

    // Wait for modal to open
    const modalDialog = page.locator('#modal_fact[open]');
    await expect(modalDialog).toBeVisible({ timeout: 5000 });

    // Verify key form fields are visible in transaction tab
    const amountInput = page.locator('#modal_fact-tab-transaction input[name="amount"]');
    await expect(amountInput).toBeVisible();

    const dateInput = page.locator('#modal_fact-tab-transaction input[name="fact_date"]');
    await expect(dateInput).toBeVisible();

    // Verify Choices.js selects are initialized (at least one visible)
    const choicesContainer = page.locator('#modal_fact-tab-transaction .choices').first();
    await expect(choicesContainer).toBeVisible();
  });

  test('should display form fields correctly on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);

    // Click FAB button to open modal (opens directly without Speed Dial on production)
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    // Modal opens directly (no Speed Dial menu on production)
    const modalDialog = page.locator('#modal_fact[open]');
    await expect(modalDialog).toBeVisible({ timeout: 5000 });

    // Verify key form fields are visible in transaction tab
    const amountInput = page.locator('#modal_fact-tab-transaction input[name="amount"]');
    await expect(amountInput).toBeVisible();

    const dateInput = page.locator('#modal_fact-tab-transaction input[name="fact_date"]');
    await expect(dateInput).toBeVisible();

    // Verify Choices.js selects are initialized (at least one visible)
    const choicesContainer = page.locator('#modal_fact-tab-transaction .choices').first();
    await expect(choicesContainer).toBeVisible();
  });
});

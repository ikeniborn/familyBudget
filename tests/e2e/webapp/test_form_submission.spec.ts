/**
 * E2E Tests: Form Submission
 *
 * Tests form submission functionality:
 * - Transaction creation (fill form + submit)
 * - Form validation (required fields)
 * - Success feedback (toast notification)
 * - Error handling
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

test.describe('Form Submission - Transaction Creation', () => {
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

  test('should fill transaction form with all required fields', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);

    // Open modal via Speed Dial
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    await expect(speedDialMenu).toBeVisible({ timeout: 3000 });

    const addFactButton = speedDialMenu.locator('button[title="Добавить факт"]');
    await addFactButton.click();

    const modalDialog = page.locator('#modal_fact[open]');
    await expect(modalDialog).toBeVisible({ timeout: 5000 });

    // Wait for financial centers to load
    await page.waitForTimeout(1000);

    // Fill required fields
    // Date (use "Сегодня" button for simplicity)
    const todayButton = page.locator('#modal_fact-tab-transaction button:has-text("Сегодня")');
    await todayButton.click();

    // Financial Center (set value programmatically to bypass Choices.js UI)
    const fcSelect = page.locator('#modal_fact-tab-transaction select[name="financial_center_id"]');
    await fcSelect.evaluate((select: HTMLSelectElement) => {
      // Select first non-empty option
      if (select.options.length > 1) {
        select.selectedIndex = 1;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Record Type (expense is default, no action needed)

    // Article (set value programmatically to bypass Choices.js UI)
    // Wait for article select to be populated (depends on FC selection)
    await page.waitForTimeout(1000);
    const articleSelect = page.locator('#modal_fact-tab-transaction select[name="article_id"]');
    await articleSelect.evaluate((select: HTMLSelectElement) => {
      // Select first non-empty option
      if (select.options.length > 1) {
        select.selectedIndex = 1;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Amount
    const amountInput = page.locator('#modal_fact-tab-transaction input[name="amount"]');
    await amountInput.fill('100');

    // Description (optional)
    const descriptionInput = page.locator('#modal_fact-tab-transaction textarea[name="description"]');
    await descriptionInput.fill('E2E Test Transaction');

    // Submit form
    const saveButton = page.locator('#modal_fact .modal-action button.btn-primary');
    await saveButton.click();

    // Verify modal closes (success)
    await expect(modalDialog).not.toBeVisible({ timeout: 10000 });
  });

  test('should show validation error when required fields missing', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);

    // Open modal via Speed Dial
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    await expect(speedDialMenu).toBeVisible({ timeout: 3000 });

    const addFactButton = speedDialMenu.locator('button[title="Добавить факт"]');
    await addFactButton.click();

    const modalDialog = page.locator('#modal_fact[open]');
    await expect(modalDialog).toBeVisible({ timeout: 5000 });

    // Try to submit without filling any fields
    const saveButton = page.locator('#modal_fact .modal-action button.btn-primary');
    await saveButton.click();

    // Modal should remain open (validation failed)
    await expect(modalDialog).toBeVisible();

    // Check for HTML5 validation (browser native)
    const dateInput = page.locator('#modal_fact-tab-transaction input[name="fact_date"]');
    const isDateInvalid = await dateInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isDateInvalid).toBe(true);
  });

  test('should submit transaction on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);

    // Open modal via Speed Dial
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    await expect(speedDialMenu).toBeVisible({ timeout: 3000 });

    const addFactButton = speedDialMenu.locator('button[title="Добавить факт"]');
    await addFactButton.click();

    const modalDialog = page.locator('#modal_fact[open]');
    await expect(modalDialog).toBeVisible({ timeout: 5000 });

    // Wait for financial centers to load
    await page.waitForTimeout(1000);

    // Fill required fields (same as desktop)
    const todayButton = page.locator('#modal_fact-tab-transaction button:has-text("Сегодня")');
    await todayButton.click();

    const fcSelect = page.locator('#modal_fact-tab-transaction select[name="financial_center_id"]');
    await fcSelect.evaluate((select: HTMLSelectElement) => {
      if (select.options.length > 1) {
        select.selectedIndex = 1;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Wait for article select to be populated (depends on FC selection)
    await page.waitForTimeout(2000);
    const articleSelect = page.locator('#modal_fact-tab-transaction select[name="article_id"]');
    // Wait for options to load
    await articleSelect.evaluate(async (select: HTMLSelectElement) => {
      // Wait for options to be populated
      for (let i = 0; i < 20; i++) {
        if (select.options.length > 1) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (select.options.length > 1) {
        select.selectedIndex = 1;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const amountInput = page.locator('#modal_fact-tab-transaction input[name="amount"]');
    await amountInput.fill('50');

    // Submit form
    const saveButton = page.locator('#modal_fact .modal-action button.btn-primary');
    await saveButton.click();

    // Verify modal closes (success)
    await expect(modalDialog).not.toBeVisible({ timeout: 10000 });
  });

  test('should submit income transaction', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);

    // Open modal via Speed Dial
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    await expect(speedDialMenu).toBeVisible({ timeout: 3000 });

    const addFactButton = speedDialMenu.locator('button[title="Добавить факт"]');
    await addFactButton.click();

    const modalDialog = page.locator('#modal_fact[open]');
    await expect(modalDialog).toBeVisible({ timeout: 5000 });

    // Wait for financial centers to load
    await page.waitForTimeout(1000);

    // Fill required fields
    const todayButton = page.locator('#modal_fact-tab-transaction button:has-text("Сегодня")');
    await todayButton.click();

    const fcSelect = page.locator('#modal_fact-tab-transaction select[name="financial_center_id"]');
    await fcSelect.evaluate((select: HTMLSelectElement) => {
      if (select.options.length > 1) {
        select.selectedIndex = 1;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Select "Доход" (income)
    const incomeButton = page.locator('#modal_fact-tab-transaction label.transaction-type-btn[data-type="income"]');
    await incomeButton.click();

    // Wait for article select to be populated (depends on FC selection)
    await page.waitForTimeout(2000);
    const articleSelect = page.locator('#modal_fact-tab-transaction select[name="article_id"]');
    // Wait for options to load
    await articleSelect.evaluate(async (select: HTMLSelectElement) => {
      // Wait for options to be populated
      for (let i = 0; i < 20; i++) {
        if (select.options.length > 1) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (select.options.length > 1) {
        select.selectedIndex = 1;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const amountInput = page.locator('#modal_fact-tab-transaction input[name="amount"]');
    await amountInput.fill('200');

    const descriptionInput = page.locator('#modal_fact-tab-transaction textarea[name="description"]');
    await descriptionInput.fill('E2E Test Income');

    // Submit form
    const saveButton = page.locator('#modal_fact .modal-action button.btn-primary');
    await saveButton.click();

    // Verify modal closes (success)
    await expect(modalDialog).not.toBeVisible({ timeout: 10000 });
  });

  test('should populate date using quick buttons', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);

    // Open modal via Speed Dial
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();

    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    await expect(speedDialMenu).toBeVisible({ timeout: 3000 });

    const addFactButton = speedDialMenu.locator('button[title="Добавить факт"]');
    await addFactButton.click();

    const modalDialog = page.locator('#modal_fact[open]');
    await expect(modalDialog).toBeVisible({ timeout: 5000 });

    const dateInput = page.locator('#modal_fact-tab-transaction input[name="fact_date"]');

    // Test "Сегодня" button
    const todayButton = page.locator('#modal_fact-tab-transaction button:has-text("Сегодня")');
    await todayButton.click();
    const todayValue = await dateInput.inputValue();
    expect(todayValue.length).toBeGreaterThan(0);

    // Test "Вчера" button (use getByRole for exact match)
    const yesterdayButton = page.locator('#modal_fact-tab-transaction').getByRole('button', { name: 'Вчера', exact: true });
    await yesterdayButton.click();
    const yesterdayValue = await dateInput.inputValue();
    expect(yesterdayValue.length).toBeGreaterThan(0);
    expect(yesterdayValue).not.toBe(todayValue);

    // Test "Позавчера" button
    const beforeYesterdayButton = page.locator('#modal_fact-tab-transaction').getByRole('button', { name: 'Позавчера', exact: true });
    await beforeYesterdayButton.click();
    const beforeYesterdayValue = await dateInput.inputValue();
    expect(beforeYesterdayValue.length).toBeGreaterThan(0);
    expect(beforeYesterdayValue).not.toBe(yesterdayValue);
  });
});

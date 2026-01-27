/**
 * E2E Test Authentication Helper
 *
 * Provides authentication utilities for Playwright E2E tests.
 * Supports email/password login with session persistence.
 */

import { Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.test
function loadTestEnv(): { email: string; password: string; baseUrl: string } {
  const envPath = path.resolve(__dirname, '../../../.env.test');

  if (!fs.existsSync(envPath)) {
    throw new Error(
      `.env.test not found. Create it from .env.test.example and add TEST_USER_EMAIL and TEST_USER_PASSWORD.\n` +
      `See: docs/testing/e2e-test-user-setup.md`
    );
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};

  // Parse .env.test file
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').trim();

    env[key.trim()] = value;
  });

  const email = env.TEST_USER_EMAIL || process.env.TEST_USER_EMAIL;
  const password = env.TEST_USER_PASSWORD || process.env.TEST_USER_PASSWORD;
  const baseUrl = env.BASE_URL || process.env.BASE_URL || 'https://fbd.ikeniborn.ru';

  if (!email || !password) {
    throw new Error(
      `TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env.test or environment variables.\n` +
      `See: docs/testing/e2e-test-user-setup.md`
    );
  }

  return { email, password, baseUrl };
}

/**
 * Login to Family Budget with email/password
 *
 * @param page - Playwright page object
 * @param email - User email (optional, defaults to TEST_USER_EMAIL from .env.test)
 * @param password - User password (optional, defaults to TEST_USER_PASSWORD from .env.test)
 * @throws Error if login fails
 */
export async function login(page: Page, email?: string, password?: string): Promise<void> {
  const env = loadTestEnv();
  const loginEmail = email || env.email;
  const loginPassword = password || env.password;

  // eslint-disable-next-line no-console
  console.log(`[AUTH] Logging in as ${loginEmail}...`);

  // Navigate to login page
  await page.goto(`${env.baseUrl}/login`);

  // Wait for login form
  await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });

  // Fill email
  const emailInput = page.locator('input[name="email"], input[type="email"]').first();
  await emailInput.fill(loginEmail);

  // Fill password
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
  await passwordInput.fill(loginPassword);

  // Submit form
  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.click();

  // Wait for navigation to main page (authentication successful)
  try {
    await page.waitForURL(env.baseUrl, { timeout: 10000 });
    // eslint-disable-next-line no-console
    console.log('[AUTH] Login successful');
  } catch (error) {
    // Check if still on login page (login failed)
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/login-failed.png' });

      throw new Error(
        `Login failed. Still on login page: ${currentUrl}\n` +
        `Check credentials in .env.test and verify test user exists.\n` +
        `Screenshot saved: test-results/login-failed.png`
      );
    }

    throw error;
  }

  // Verify user is logged in (check for user menu or logout button)
  const isLoggedIn = await page.locator('[data-testid="user-menu"], .user-menu, button:has-text("Выйти")').count();

  if (isLoggedIn === 0) {
    // eslint-disable-next-line no-console
    console.warn('[AUTH] Warning: Login appeared successful but user menu not found. Tests may fail.');
  }
}

/**
 * Logout from Family Budget
 *
 * @param page - Playwright page object
 */
export async function logout(page: Page): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[AUTH] Logging out...');

  // Find and click logout button
  const logoutButton = page.locator('button:has-text("Выйти"), a:has-text("Выйти")').first();

  if (await logoutButton.count() > 0) {
    await logoutButton.click();
    await page.waitForURL(/\/login/, { timeout: 5000 });
    // eslint-disable-next-line no-console
    console.log('[AUTH] Logout successful');
  } else {
    // eslint-disable-next-line no-console
    console.warn('[AUTH] Logout button not found. Clearing cookies instead.');
    await page.context().clearCookies();
  }
}

/**
 * Check if user is currently logged in
 *
 * @param page - Playwright page object
 * @returns true if logged in, false otherwise
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  const userMenuCount = await page.locator('[data-testid="user-menu"], .user-menu, button:has-text("Выйти")').count();
  return userMenuCount > 0;
}

/**
 * Get test user credentials from environment
 *
 * @returns Object with email and password
 */
export function getTestCredentials(): { email: string; password: string } {
  const env = loadTestEnv();
  return { email: env.email, password: env.password };
}

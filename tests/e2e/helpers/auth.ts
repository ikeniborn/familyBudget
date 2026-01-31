/**
 * E2E Test Authentication Helper
 *
 * Provides authentication utilities for Playwright E2E tests.
 * Supports email/password login with session persistence.
 */

import { Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.test or process.env (CI)
function loadTestEnv(): { email: string; password: string; baseUrl: string } {
  // In CI environment (GitHub Actions), use environment variables directly
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

  let email = process.env.TEST_USER_EMAIL;
  let password = process.env.TEST_USER_PASSWORD;
  // E2E tests run against local Docker environment (http://localhost)
  // Configured in playwright.config.ts baseURL
  let baseUrl = process.env.BASE_URL || 'http://localhost';

  // In local development, try loading from .env.test file
  if (!isCI && (!email || !password)) {
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

    email = email || env.TEST_USER_EMAIL;
    password = password || env.TEST_USER_PASSWORD;
    baseUrl = baseUrl || env.BASE_URL || 'http://localhost';
  }

  if (!email || !password) {
    throw new Error(
      `TEST_USER_EMAIL and TEST_USER_PASSWORD must be set.\n` +
      `- CI: Set GitHub Actions secrets\n` +
      `- Local: Create .env.test from .env.test.example\n` +
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

  // Navigate to email login page (not /login which shows Telegram OAuth)
  await page.goto(`${env.baseUrl}/login-email`);

  // Step 1: Enter identifier (email)
  await page.waitForSelector('input[name="identifier"]', { timeout: 10000 });
  const identifierInput = page.locator('input[name="identifier"]');
  await identifierInput.fill(loginEmail);

  // Click "Продолжить" button
  const continueButton = page.locator('button[type="submit"]').first();
  await continueButton.click();

  // Step 2: Wait for authentication methods to appear
  // Check if biometric button is visible (some users have WebAuthn)
  const biometricButton = page.locator('button:has-text("Использовать пароль")');
  const biometricVisible = await biometricButton.isVisible({ timeout: 3000 }).catch(() => false);

  if (biometricVisible) {
    // eslint-disable-next-line no-console
    console.log('[AUTH] Biometric auth available, switching to password...');
    // Click "Использовать пароль" button
    await biometricButton.click();
  }

  // Step 3: Wait for password field to appear and enter password
  await page.waitForSelector('input[name="password"]', { state: 'visible', timeout: 10000 });
  const passwordInput = page.locator('input[name="password"]');
  await passwordInput.fill(loginPassword);

  // Submit password form (use specific ID to avoid ambiguity)
  const loginButton = page.locator('#password-login-btn');
  await loginButton.click();

  // Wait for navigation to main page or error message
  try {
    // Wait for either redirect OR error message
    await Promise.race([
      page.waitForURL(env.baseUrl, { timeout: 15000 }),
      page.waitForSelector('#login-error:not(.hidden)', { timeout: 15000 }).then(() => {
        throw new Error('Login error displayed on page');
      })
    ]);

    // eslint-disable-next-line no-console
    console.log('[AUTH] Login successful');

    // Close cookie consent modal if present
    try {
      const acceptAllButton = page.locator('button:has-text("Принять все")');
      const isVisible = await acceptAllButton.isVisible({ timeout: 3000 });
      if (isVisible) {
        // eslint-disable-next-line no-console
        console.log('[AUTH] Closing cookie consent modal...');
        await acceptAllButton.click();
        // Wait for modal to disappear
        await page.waitForSelector('button:has-text("Принять все")', { state: 'hidden', timeout: 5000 });
        // eslint-disable-next-line no-console
        console.log('[AUTH] Cookie modal closed');
      }
    } catch (e) {
      // Cookie modal not present or already closed, continue
    }
  } catch (error) {
    // Check if error message is displayed
    const errorVisible = await page.locator('#login-error:not(.hidden)').isVisible().catch(() => false);
    if (errorVisible) {
      const errorText = await page.locator('#login-error-text').textContent();
      await page.screenshot({ path: 'test-results/login-failed.png' });

      throw new Error(
        `Login failed with error: ${errorText}\n` +
        `Check credentials in .env.test and verify test user exists.\n` +
        `Screenshot saved: test-results/login-failed.png`
      );
    }

    // Check if still on login page (login failed without error message)
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

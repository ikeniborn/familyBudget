/**
 * Global Authentication Setup
 *
 * This setup script runs ONCE before all tests to authenticate and save the session state.
 * All subsequent tests reuse this authenticated state, eliminating redundant logins.
 *
 * Performance Impact:
 * - Before: 9 tests × 15s login = ~135s wasted on authentication
 * - After: 1 login × 15s = ~15s total authentication time
 * - Savings: ~120s (2 minutes) per test run
 *
 * Storage State:
 * - Cookies (session tokens)
 * - LocalStorage (user preferences, offline data)
 * - SessionStorage (temporary session data)
 *
 * Usage:
 * Configured in playwright.config.ts via `dependencies` and `storageState` options.
 * Tests automatically inherit authenticated state without manual login.
 */

import { test as setup } from '@playwright/test';
import { login } from '../helpers/auth';

// Storage state file path
const authFile = 'tests/e2e/.auth/user.json';

/**
 * Global setup: Authenticate once and save session state
 */
setup('authenticate', async ({ page }) => {
  // eslint-disable-next-line no-console
  console.log('[SETUP] Authenticating user for all tests...');

  // Perform login (uses TEST_USER_EMAIL and TEST_USER_PASSWORD from .env.test)
  await login(page);

  // Navigate to main page to ensure session is fully initialized
  // E2E tests run against deployed test server (configured in playwright.config.ts)
  await page.goto('/');  // Uses baseURL from playwright.config.ts
  await page.waitForLoadState('networkidle');

  // eslint-disable-next-line no-console
  console.log('[SETUP] Session initialized, saving storage state...');

  // Save authenticated state to file
  await page.context().storageState({ path: authFile });

  // eslint-disable-next-line no-console
  console.log(`[SETUP] Storage state saved to ${authFile}`);
  // eslint-disable-next-line no-console
  console.log('[SETUP] All tests will reuse this authenticated session');
});

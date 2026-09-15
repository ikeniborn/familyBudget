import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * Playwright configuration for E2E tests.
 *
 * Tests Web Apps UI flows in a real browser environment.
 */

/* Chromium's two-segment post-quantum (ML-KEM) TLS ClientHello stalls on some
 * network paths in front of the Traefik SNI peek; disabling PQ key agreement
 * keeps local runs reliable and is harmless in CI. */
const chromiumLaunchArgs = ['--disable-features=PostQuantumKeyAgreement,UseMLKEM'];

export default defineConfig({
  testDir: path.join(__dirname, '../tests/e2e'),

  /* Only match .spec.ts files (exclude Vitest .test.ts files) */
  testMatch: /.*\.spec\.ts$/,

  /* Tests share one stand user and mutate the same data (lists, transactions),
   * so parallel workers race each other — run serially for stability */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,

  /* One worker everywhere: the suite is run rarely (manual workflow) and
   * shared-user data races outweigh the speedup */
  workers: 1,

  /* Per-test timeout: 60s (default 30s often too low for slow CI) */
  timeout: 60 * 1000,

  /* Global timeout for entire test run: 25 minutes */
  globalTimeout: 25 * 60 * 1000,

  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    /* E2E tests run against deployed test server (fbd.ikeniborn.ru) */
    baseURL: process.env.BASE_URL || 'https://fbd.ikeniborn.ru',

    /* Optional proxy for local runs on networks where the direct TLS path to
     * the test server is unreliable (e.g. E2E_PROXY=socks5://127.0.0.1:1080
     * over an SSH tunnel). Unset in CI. */
    ...(process.env.E2E_PROXY ? { proxy: { server: process.env.E2E_PROXY } } : {}),

    /* Navigation timeout: 30s (prevents networkidle-style hangs) */
    navigationTimeout: 30 * 1000,

    /* Action timeout: 15s per locator action */
    actionTimeout: 15 * 1000,

    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  /* CI: chromium (desktop) + Mobile Safari only — fast and representative */
  /* Full suite (firefox, webkit, Mobile Chrome) runs locally via npm run test:e2e:full */
  projects: [
    /* Setup project - runs once before all tests to authenticate */
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: chromiumLaunchArgs },
      },
    },

    /* Desktop Chrome */
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
        launchOptions: { args: chromiumLaunchArgs },
      },
      dependencies: ['setup'],
    },

    /* Mobile Safari (important for Telegram Web Apps on iOS) */
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  /* Run your local dev server before starting the tests (optional) */
  /* Commented out to prevent local server startup - tests use production URL by default */
  /* Uncomment and set BASE_URL=http://localhost:8000 if you need local testing */
  // webServer: {
  //   command: 'cd backend && uvicorn backend.app.main:app --host 0.0.0.0 --port 8000',
  //   url: 'http://localhost:8000/health',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  //   env: {
  //     PYTHONPATH: process.env.PYTHONPATH || process.cwd(),
  //     DATABASE_URL: process.env.DATABASE_URL || '',
  //     REDIS_URL: process.env.REDIS_URL || '',
  //     JWT_SECRET: process.env.JWT_SECRET || '',
  //     SECRET_KEY: process.env.SECRET_KEY || '',
  //     TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  //     ADMIN_TELEGRAM_ID: process.env.ADMIN_TELEGRAM_ID || '',
  //     API_INTERNAL_KEY: process.env.API_INTERNAL_KEY || '',
  //     CORS_ORIGINS: process.env.CORS_ORIGINS || '',
  //     REDIS_ENABLED: process.env.REDIS_ENABLED || 'false',
  //   },
  // },
});

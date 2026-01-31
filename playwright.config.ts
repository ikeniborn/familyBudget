import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E tests.
 *
 * Tests Web Apps UI flows in a real browser environment.
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

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

    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    /* Setup project - runs once before all tests to authenticate */
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'], // Setup uses chromium (always available in CI)
      },
    },

    /* Desktop browsers with authentication */
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    /* Test against mobile viewports (important for Telegram Web Apps). */
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
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

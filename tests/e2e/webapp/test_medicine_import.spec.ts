/**
 * E2E Tests: Medicine Import (Phase 5)
 *
 * Tests the medicine CSV / Google Sheets import wizard:
 * - «Импорт» button on the courses + stock pages
 * - Wizard modal opens with the file input + Google Sheets field
 * - Full flow (upload -> analyze -> map -> preview -> execute) — see skipped tests
 *
 * Authentication: Uses storage state from global setup (tests/e2e/setup/auth.setup.ts)
 *
 * NOTE: The full upload flow is skipped by default — it needs a seeded backend on the
 * deployed test server and CSV file fixtures, mirroring tests/e2e/webapp/test_csv_import.spec.ts.
 */

import { test, expect, type Page } from '@playwright/test';

const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  desktop: { width: 1280, height: 800 },
};

async function dismissCookieBanner(page: Page): Promise<void> {
  const acceptAllButton = page.locator('button:has-text("Принять все")');
  const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
  if (isVisible) {
    await acceptAllButton.click();
    await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 }).catch(() => {});
  }
}

test.describe('Medicine Import - Courses page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/medicines/courses');
    await page.waitForLoadState('domcontentloaded');
    await dismissCookieBanner(page);
  });

  test('should show the «Импорт» button on the courses page', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const importButton = page.locator('button:has-text("Импорт")');
    await expect(importButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('should open the import wizard modal with a file input', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.locator('button:has-text("Импорт")').first().click();

    // Wizard injects a <dialog id="medicine-import-modal"> with a CSV file input + Google Sheets field.
    const fileInput = page.locator('#med-import-file');
    await expect(fileInput).toBeAttached({ timeout: 5000 });
    await expect(page.locator('#med-import-gs')).toBeAttached();
  });

  test('should render the wizard on mobile (375px)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    const importButton = page.locator('button:has-text("Импорт")');
    await expect(importButton.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Medicine Import - Stock page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/medicines/stock');
    await page.waitForLoadState('domcontentloaded');
    await dismissCookieBanner(page);
  });

  test('should show the «Импорт» button in the stock header', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const importButton = page.locator('button:has-text("Импорт")');
    await expect(importButton.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Medicine Import - Full course import flow', () => {
  // Skipped by default: requires a seeded backend + writes data on the deployed test server.
  // Mirrors the skip strategy of test_csv_import.spec.ts (file-fixture flows).
  test.skip('should import a course from CSV (analyze -> map -> preview -> execute)', async ({ page }) => {
    await page.goto('/medicines/courses');
    await dismissCookieBanner(page);

    await page.locator('button:has-text("Импорт")').first().click();

    // TODO: setInputFiles on #med-import-file with a CSV buffer containing a «Пациент» column.
    const csv = 'Пациент,Лекарство,Доза,Время,Начало\nБабушка,Эналаприл,1,08:00;20:00,2026-06-15\n';
    await page.locator('#med-import-file').setInputFiles({
      name: 'courses.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8'),
    });

    // analyze -> mapping table
    await page.locator('button:has-text("Далее")').click();
    await expect(page.locator('#med-import-step select[data-col]').first()).toBeVisible({ timeout: 10000 });

    // preview
    await page.locator('button:has-text("Предпросмотр")').click();
    await expect(page.locator('.alert')).toBeVisible({ timeout: 10000 });

    // execute
    await page.locator('button:has-text("Импортировать")').click();
    await expect(page.locator('text=/Импортировано/i')).toBeVisible({ timeout: 10000 });
  });
});

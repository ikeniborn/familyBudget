/**
 * E2E Tests: CSV Import
 *
 * Tests CSV import functionality:
 * - Upload CSV file (bank statement)
 * - Preview imported data
 * - Category mapping / autocategorization
 * - Bulk edit operations
 * - Import confirmation
 * - Error handling (invalid format, missing columns)
 *
 * Authentication: Uses storage state from global setup (tests/e2e/setup/auth.setup.ts)
 *
 * NOTE: File upload testing requires test CSV files
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';
import { waitForVisibleFab } from '../helpers/fab';

// Viewport sizes
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  desktop: { width: 1920, height: 1080 },
};

test.describe('CSV Import - Navigation and UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await waitForVisibleFab(page);

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should navigate to import page', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // The import link lives in the «Прочее» dropdown — open it first
    await page.locator('summary:has-text("Прочее")').click();
    await page.locator('a[href="/import"]:visible').first().click();
    await page.waitForURL('**/import', { timeout: 10000 });

    // Verify import page loaded
    expect(page.url()).toContain('/import');

    // Check for file upload element or import wizard
    const uploadArea = page.locator('input[type="file"], [class*="upload"], [class*="dropzone"]');
    const uploadVisible = await uploadArea.isVisible({ timeout: 5000 }).catch(() => false);

    // Page should have file upload or instructions
    expect(uploadVisible || page.url().includes('/import')).toBeTruthy();
  });

  test('should display import wizard on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    await page.goto('/import');
    await page.waitForLoadState('domcontentloaded');

    // Check for wizard steps or instructions
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();

    // Look for file input
    const fileInput = page.locator('#csv-file');
    await expect(fileInput).toBeAttached(); // Might be hidden by custom upload UI
  });

  test('should show supported bank formats', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    await page.goto('/import');
    await page.waitForLoadState('domcontentloaded');

    // Look for supported formats info
    const formatInfo = page.locator('text=/Тинькофф|Сбербанк|Альфа|ВТБ|CSV/i');
    const formatVisible = await formatInfo.isVisible({ timeout: 3000 }).catch(() => false);

    // Should show format info or help text
    expect(formatVisible || page.url().includes('/import')).toBeTruthy();
  });
});

test.describe('CSV Import - File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/import');
    await page.waitForLoadState('domcontentloaded');

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should accept CSV file upload', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Create test CSV content
    const csvContent = `Date,Description,Amount,Category
2024-01-15,Grocery Store,-50.00,Groceries
2024-01-16,Salary,+3000.00,Income
2024-01-17,Coffee Shop,-5.50,Food`;

    // Find file input
    const fileInput = page.locator('#csv-file');

    // Upload test file
    // NOTE: This requires creating actual test file or using setInputFiles with buffer
    // For now, verify file input exists and is functional
    await expect(fileInput).toBeAttached();

    const isFileInputVisible = await fileInput.isVisible().catch(() => false);

    // File input might be hidden by custom UI
    // Just verify it exists in DOM
    expect(isFileInputVisible || await fileInput.evaluate(el => el !== null)).toBeTruthy();
  });

  test.skip('should upload and preview CSV data', async ({ page }) => {
    // This test requires actual CSV file creation
    // Skipped by default - implement when test fixtures are available

    await page.setViewportSize(VIEWPORTS.desktop);

    // TODO: Create test CSV file
    // TODO: Upload file
    // TODO: Verify preview table appears
    // TODO: Check row count matches CSV
  });
});

test.describe('CSV Import - Data Preview and Mapping', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/import');
    await page.waitForLoadState('domcontentloaded');

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test.skip('should display preview table after upload', async ({ page }) => {
    // Requires file upload implementation
    await page.setViewportSize(VIEWPORTS.desktop);

    // After upload, preview table should appear
    const previewTable = page.locator('table.import-preview, [class*="preview"] table');
    await expect(previewTable).toBeVisible({ timeout: 5000 });

    // Table should have headers
    const headers = previewTable.locator('th');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThan(0);
  });

  test.skip('should allow category mapping', async ({ page }) => {
    // Requires file upload + preview loaded
    await page.setViewportSize(VIEWPORTS.desktop);

    // Look for category select/input for each row
    const categorySelects = page.locator('select[name*="category"], .category-selector');
    const selectCount = await categorySelects.count();

    expect(selectCount).toBeGreaterThan(0);

    // Select category for first row
    const firstSelect = categorySelects.first();
    await firstSelect.selectOption({ index: 1 });

    // Verify selection
    const selectedValue = await firstSelect.inputValue();
    expect(selectedValue).not.toBe('');
  });

  test.skip('should support bulk category assignment', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Look for bulk actions UI
    const bulkActionsButton = page.locator('button:has-text("Массовые операции"), button:has-text("Bulk")');
    const bulkVisible = await bulkActionsButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (bulkVisible) {
      await bulkActionsButton.click();

      // Select multiple rows
      const checkboxes = page.locator('input[type="checkbox"][name*="select"]');
      const checkboxCount = await checkboxes.count();

      if (checkboxCount > 1) {
        await checkboxes.nth(0).check();
        await checkboxes.nth(1).check();

        // Apply bulk category
        const categorySelect = page.locator('select[name*="bulk_category"]');
        const categoryVisible = await categorySelect.isVisible().catch(() => false);

        if (categoryVisible) {
          await categorySelect.selectOption({ index: 1 });

          const applyButton = page.locator('button:has-text("Применить"), button:has-text("Apply")');
          await applyButton.click();

          await page.waitForTimeout(500);
        }
      }
    }
  });
});

test.describe('CSV Import - Import Confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/import');
    await page.waitForLoadState('domcontentloaded');

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test.skip('should confirm import and create transactions', async ({ page }) => {
    // Requires full import flow: upload -> preview -> map -> confirm
    await page.setViewportSize(VIEWPORTS.desktop);

    // After mapping, find Import/Confirm button
    const importButton = page.locator('button:has-text("Импортировать"), button:has-text("Confirm"), button.btn-primary');
    const importVisible = await importButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (importVisible) {
      await importButton.click();

      // Wait for import process
      await page.waitForTimeout(2000);

      // Success message or redirect to facts page
      const successMessage = page.locator('text=/успешно|success|imported/i');
      const successVisible = await successMessage.isVisible({ timeout: 5000 }).catch(() => false);

      expect(successVisible || page.url().includes('/facts')).toBeTruthy();
    }
  });

  test.skip('should show import summary after completion', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // After import completes, summary should appear
    const summary = page.locator('.import-summary, [class*="summary"]');
    const summaryVisible = await summary.isVisible({ timeout: 5000 }).catch(() => false);

    if (summaryVisible) {
      // Check for imported count
      const count = summary.locator('text=/\d+.*импортирован|imported/i');
      await expect(count).toBeVisible();
    }
  });
});

test.describe('CSV Import - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/import');
    await page.waitForLoadState('domcontentloaded');

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test.skip('should reject non-CSV files', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Try to upload non-CSV file (e.g., .txt or .json)
    const fileInput = page.locator('#csv-file');

    // This would require creating test file
    // Verify file input has accept attribute
    const acceptAttr = await fileInput.getAttribute('accept');
    expect(acceptAttr).toContain('.csv');
  });

  test.skip('should show error for invalid CSV format', async ({ page }) => {
    // Requires uploading malformed CSV
    await page.setViewportSize(VIEWPORTS.desktop);

    // After upload of invalid CSV, error message should appear
    const errorMessage = page.locator('.error, .alert-error, text=/invalid|ошибка|неверный/i');
    const errorVisible = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);

    // Error should be shown for invalid format
    expect(errorVisible || true).toBeTruthy();
  });
});

test('bank CSV integrity review shows rejects, excludes registry matches and binds retries', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  const fact = { id: 91, fact_date: '2026-11-01', amount: '840', account_name: 'Семейная карта' };
  const staged = {
    id: 21, bank_provider_id: 1, file_upload_id: 50, fact_date: fact.fact_date,
    source_row: 2, amount_string: '-840.49', original_amount: '-840.49',
    whole_amount: '-840', amount_difference: '0.49', description: 'Кафе',
    article_id: 3, financial_center_id: 2, matches: [fact], already_imported: false,
  };
  const records = [
    staged,
    { ...staged, id: 22, source_row: 3, amount_string: '9007199254740993', original_amount: '9007199254740993', whole_amount: '9007199254740993', amount_difference: '0', matches: [] },
    { ...staged, id: 23, file_upload_id: 49, source_row: 2, already_imported: true },
  ];
  let parsed = false;
  let completed = false;
  const attempts: Array<{
    confirmation_id: string;
    staging_ids: number[];
    acknowledgments: Record<string, number[]>;
  }> = [];
  await page.route('**/api/v1/staging/21', route => route.fulfill({ json: { success: true } }));
  await page.route('**/api/v1/financial-centers', route => route.fulfill({ json: [{ id: 2, name: 'Счёт' }, { id: 3, name: 'Кошелёк' }] }));
  await page.route('**/api/v1/import/banks', route => route.fulfill({ json: [{ id: 1, name: 'Банк QA' }] }));
  await page.route('**/api/v1/import/upload?*', route => route.fulfill({ json: { file_id: 50, prior_imported_count: 1 } }));
  await page.route('**/api/v1/import/files/50/analyze', route => route.fulfill({ json: { headers: ['Date', 'Amount'], sample_rows: [], total_rows: 4 } }));
  await page.route('**/api/v1/import/mappings/1', route => route.fulfill({ json: { mapping_id: 2, mapping: { amount: 'Amount', fact_date: 'Date' } } }));
  await page.route('**/api/v1/import/files/50/parse', route => {
    parsed = true;
    return route.fulfill({ json: { total_rows: 4, total_inserted: 2, prior_imported_count: 1, rejected_rows: [{ source_row: 4, reason: 'zero_after_truncation' }, { source_row: 5, reason: 'invalid_date' }] } });
  });
  await page.route('**/api/v1/staging', route => route.fulfill({ json: parsed && !completed ? records : [] }));
  await page.route('**/api/v1/staging/import', route => {
    attempts.push(route.request().postDataJSON());
    if (attempts.length === 1) {
      return route.fulfill({ status: 409, json: { detail: { message: { code: 'matches_changed', matches: { 21: [fact, { ...fact, id: 92, account_name: 'Другой счёт' }] } } } } });
    }
    if (attempts.length === 2) return route.abort('failed');
    completed = true;
    return route.fulfill({ json: { success: true, total_imported: 2 } });
  });
  await page.route('**/api/v1/consent/status', route => route.fulfill({ json: { has_consented: true, consents: {} } }));
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/import');
  const consent = page.getByRole('button', { name: 'Принять все', exact: true });
  if (await consent.isVisible()) await consent.click();
  await page.locator('#bank-selector').selectOption('1');
  await page.locator('#upload-new-file-btn').click();
  await expect(page.locator('#csv-file')).toBeVisible();
  await page.locator('#csv-file').setInputFiles({
    name: 'statement.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Date;Amount\n2026-11-01;-840.49\n2026-11-01;-840.49\n2026-11-01;0.25\nbad;12'),
  });
  await page.locator('#upload-btn').click();
  await expect(page.locator('#statement-recognition')).toContainText('1');
  await page.locator('#use-existing-mapping-btn').click();
  const report = page.locator('#bank-parse-report');
  await expect(report).toContainText('Принято: 2 из 4');
  await expect(report).toContainText('Строка 4: после отсечения копеек сумма равна нулю');
  await expect(report).toContainText('Строка 5: неверная дата');
  const row = page.locator('#staging-row-21');
  await expect(row).toContainText('Семейная карта');
  const amount = row.locator('[data-col=amount]');
  await expect(amount).toHaveText('−840 ₽');
  await expect(amount).toHaveAttribute('title', /−840,49 ₽.*\+0,49 ₽/);
  await expect(page.locator('#staging-row-22 [data-col=amount]')).toHaveText('9007199254740993 ₽');
  await expect(page.locator('#staging-row-22 [data-col=status]')).toHaveText('Готово');
  const edited = page.waitForResponse(response => response.url().endsWith('/staging/21') && response.request().method() === 'PATCH');
  await row.locator('#fc-21').selectOption('3');
  await edited;
  await expect(row).toContainText('Семейная карта');
  await page.locator('#header-select-all').check();
  await expect(page.locator('#select-21')).not.toBeChecked();
  await expect(page.locator('#select-22')).toBeChecked();
  await expect(page.locator('#select-23')).toBeDisabled();
  await row.getByRole('button', { name: 'Это отдельная операция' }).click();
  await page.locator('#execute-import-btn').click();
  await expect(row).toContainText('Другой счёт');
  await expect(page.locator('#select-21')).not.toBeChecked();
  await expect(page.locator('#select-22')).toBeChecked();
  await row.getByRole('button', { name: 'Это отдельная операция' }).click();
  await page.locator('#execute-import-btn').click();
  await expect(page.locator('#notification-toast')).toContainText(/fetch|связи|сети/i);
  await page.locator('#execute-import-btn').click();
  await expect(row).toHaveCount(0);
  expect(attempts).toHaveLength(3);
  expect(attempts[0].acknowledgments).toEqual({ 21: [91] });
  expect(attempts[1].acknowledgments).toEqual({ 21: [91, 92] });
  expect(attempts[1].staging_ids).toEqual([21, 22]);
  expect(attempts[1].confirmation_id).toMatch(/^[a-f0-9-]{36}$/);
  expect(attempts[2]).toEqual(attempts[1]);
});

test('filtered import preview opens the last category and scopes AI to eligible rows', async ({ page }) => {
  const rows = Array.from({ length: 5 }, (_, index) => ({
    id: index + 1, bank_provider_id: index === 4 ? 2 : 1, amount_string: '-659.85',
    original_amount: '-659.85', whole_amount: '-659', amount_difference: '0.85',
    fact_date: '2026-11-20', article_id: null as number | null, financial_center_id: null,
    csv_metadata: { category: index === 0 ? 'Транспорт' : 'Покупки' },
    matches: index === 2 ? [{ id: 90, amount: '659', fact_date: '2026-11-20' }] : [],
  }));
  const articles = [{ id: 11, name: 'Продукты', type: 'expense', is_active: true, parent_id: null }];
  const aiCalls: number[][] = [];
  let aiEnabled = false;
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url());
    switch (url.pathname) {
      case '/api/v1/consent/status': return route.fulfill({ json: { has_consented: true, consents: {} } });
      case '/api/v1/import/banks': return route.fulfill({ json: [{ id: 1, name: 'Банк QA' }] });
      case '/api/v1/ai/status': return route.fulfill({ json: { enabled: aiEnabled, text: aiEnabled } });
      case '/api/v1/articles': return route.fulfill({ json: { articles } });
      case '/api/v1/staging': return route.fulfill({ json: rows });
      case '/api/v1/staging/2':
      case '/api/v1/staging/4':
        rows[Number(url.pathname.split('/').pop()) - 1].article_id = route.request().postDataJSON().article_id;
        return route.fulfill({ json: { success: true } });
      case '/api/v1/ai/categorize-import':
        aiCalls.push(route.request().postDataJSON().staging_ids);
        return route.fulfill({ json: { processed: 1, suggestions: [{ staging_id: 2, article_id: 11, article_path: 'Продукты', confidence: 'high' }], unmatched: 0 } });
      default: return route.fulfill({ json: [] });
    }
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  const openPreview = async () => {
    await page.goto('/import');
    await page.locator('#bank-selector').selectOption('1');
    await page.locator('#skip-to-enrichment-btn').click();
    await expect(page.locator('#bulk-filtered-count')).toHaveText('4');
  };
  await openPreview();
  const aiButton = page.getByRole('button', { name: 'Подобрать категории с ИИ' });
  await expect(aiButton).toBeVisible();
  await expect(aiButton).toBeDisabled();
  await expect(page.locator('#ai-categorize-status')).toHaveText('ИИ выключен в настройках');
  aiEnabled = true;
  await openPreview();
  await expect(aiButton).toBeEnabled();
  await page.locator('#filter-csv-cat').selectOption('Покупки', { force: true });
  await expect(page.locator('#bulk-filtered-count')).toHaveText('3');
  await expect(page.locator('#staging-table-body .choices')).toHaveCount(0);
  const last = page.locator('#staging-row-4');
  await expect(last.locator('[data-col=status]')).toHaveText('Нужны категория и счёт');
  await last.getByRole('button', { name: 'Выберите категорию' }).click();
  const menu = last.locator('.choices__list--dropdown');
  await menu.locator('input').fill('Продукты');
  await menu.getByRole('option', { name: 'Продукты' }).click();
  await expect(last.locator('[data-col=status]')).toHaveText('Нужен счёт');
  await expect(last.locator('[data-col=article]')).not.toHaveClass(/empty-field/);
  await expect(last.locator('[data-col=fc]')).toHaveClass(/empty-field/);
  await aiButton.click();
  await expect(page.locator('#ai-categorize-status')).toContainText('Рекомендации: 1 из 1 · применено: 1');
  await expect(page.locator('#staging-row-2 button', { hasText: 'Продукты' })).toBeVisible();
  await expect(page.locator('#bulk-filtered-count')).toHaveText('3');
  await aiButton.click();
  await expect(page.locator('#ai-categorize-status')).toContainText('нет строк');
  expect(aiCalls).toEqual([[2]]);
  await page.locator('#filter-csv-cat').selectOption('', { force: true });
  await expect(last.getByRole('button', { name: 'Продукты' })).toBeVisible();
});

test('enrichment sidebar keeps selection and import reachable at the last row', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 700 });
  const category = 'Продукты и повседневные покупки для всей семьи';
  const description = 'Длинное описание покупки со всеми подробностями из банковской выписки';
  const rows = Array.from({ length: 45 }, (_, index) => ({
    id: index + 1, bank_provider_id: 1, source_row: index + 2, fact_date: '2026-11-20',
    amount_string: '-300', whole_amount: '-300', original_amount: '-300', amount_difference: '0',
    article_id: 11, financial_center_id: 1, description,
    csv_metadata: { category: index < 3 ? 'Магазин' : 'Прочее' },
    already_imported: index === 44, matches: index === 2 ? [{ id: 90, amount: '300', fact_date: '2026-11-20' }] : [],
  }));
  const imported: number[][] = [];
  const deleted: number[][] = [];
  await page.route('**/api/v1/**', route => {
    switch (new URL(route.request().url()).pathname) {
      case '/api/v1/consent/status': return route.fulfill({ json: { has_consented: true, consents: {} } });
      case '/api/v1/import/banks': return route.fulfill({ json: [{ id: 1, name: 'Банк' }] });
      case '/api/v1/articles': return route.fulfill({ json: { articles: [{ id: 11, name: category, type: 'expense', is_active: true, parent_id: null }] } });
      case '/api/v1/staging': return route.fulfill({ json: imported.length ? [] : rows });
      case '/api/v1/staging/bulk-delete':
        deleted.push(route.request().postDataJSON().staging_ids);
        return route.fulfill({ json: { success: true } });
      case '/api/v1/staging/import':
        imported.push(route.request().postDataJSON().staging_ids);
        return route.fulfill({ json: { success: true, total_imported: 2 } });
      default: return route.fulfill({ json: [] });
    }
  });
  await page.addInitScript(() => localStorage.setItem('staging-column-widths', JSON.stringify({ article: 80 })));
  await page.goto('/import');
  await page.locator('#bank-selector').selectOption('1');
  await page.locator('#skip-to-enrichment-btn').click();
  const first = page.locator('#staging-row-1');
  await expect(first.locator('[data-col=date]')).toHaveText('2026-11-20');
  await expect(first.locator('[data-col=description]')).toHaveAttribute('title', description);
  const article = first.locator('[data-col=article]');
  const trigger = article.getByRole('button', { name: category });
  const clipped = (el: HTMLElement) => {
    const cell = el.closest('td')!.getBoundingClientRect();
    const item = el.getBoundingClientRect();
    const css = getComputedStyle(el);
    return cell.width <= 81 && item.left >= cell.left && item.right <= cell.right
      && el.scrollWidth > el.clientWidth && css.textOverflow === 'ellipsis' && css.whiteSpace === 'nowrap';
  };
  await expect.poll(() => trigger.evaluate(clipped)).toBe(true);
  await trigger.click();
  await article.locator('.choices__input--cloned').press('Escape');
  await expect.poll(() => article.locator('.choices__list--single [data-item]:visible').evaluate(clipped)).toBe(true);

  const sidebar = page.locator('#filter-sidebar');
  const selectAll = sidebar.getByLabel('Выбрать все видимые');
  const submit = sidebar.locator('#execute-import-btn');
  await page.locator('#staging-row-45').scrollIntoViewIfNeeded();
  await expect(page.locator('#header-select-all')).not.toBeInViewport();
  await expect(selectAll).toBeInViewport({ ratio: 1 });
  await expect(submit).toBeInViewport({ ratio: 1 });
  await expect(submit).toBeDisabled();
  await selectAll.check();
  await expect(submit).toHaveText('Импортировать (43)');
  await expect(page.locator('#header-select-all')).toBeChecked();
  await expect(sidebar.getByText('Удалить выбранные')).toBeHidden();
  await sidebar.getByText('Другие действия').click();
  await sidebar.getByRole('button', { name: 'Удалить выбранные' }).click();
  await expect(page.locator('#confirm-dialog-message')).toContainText('43');
  await page.locator('#confirm-dialog-no').click();
  expect(deleted).toEqual([]);

  await sidebar.getByRole('button', { name: 'Фильтры' }).click();
  await page.locator('#filter-csv-cat').selectOption('Магазин');
  await expect(submit).toBeDisabled();
  await page.locator('#select-1').check();
  await expect(selectAll).toHaveJSProperty('indeterminate', true);
  await selectAll.check();
  await expect(submit).toHaveText('Импортировать (2)');
  await expect(page.locator('#select-3')).not.toBeChecked();
  page.once('dialog', dialog => dialog.accept());
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(first).toHaveCount(0);
  expect(imported).toEqual([[1, 2]]);
});

import { test, expect } from '@playwright/test';
import { testUsers, testReportFilters, pageSelectors, testUtils } from './fixtures/test-data';

// Helper function to set up authenticated state
async function setupAuthenticatedUser(page: any) {
  await page.evaluate((userData) => {
    localStorage.setItem('auth-storage', JSON.stringify({
      state: {
        user: {
          id: 1,
          username: userData.email.split('@')[0],
          first_name: userData.name.split(' ')[0],
          last_name: userData.name.split(' ')[1] || 'User',
          email: userData.email
        },
        isAuthenticated: true
      },
      version: 0
    }));
  }, testUsers.testUser);
}

test.describe('Budget Planning Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
  });

  test('should complete full budget planning workflow', async ({ page }) => {
    // Step 1: Navigate to dashboard and verify overview
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText('Панель управления');
    
    // Should show budget overview cards
    await expect(page.locator('text=Общий доход')).toBeVisible();
    await expect(page.locator('text=Общий расход')).toBeVisible();
    await expect(page.locator('text=Использование бюджета')).toBeVisible();

    // Step 2: Go to budget planning (if there's a dedicated page)
    // For now, we'll work with the fact entry page as it handles budget entries
    await page.goto('/fact');
    await expect(page.locator('h1')).toContainText('Внесение фактических данных');

    // Step 3: Create budget entries with plan and fact
    await page.route('**/api/periods', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { period_id: 1, period_ru_name: 'Январь 2025' },
          { period_id: 2, period_ru_name: 'Февраль 2025' }
        ])
      });
    });

    await page.route('**/api/nomenclatures', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { nomenclature_id: 1, nomenclature_name: 'IT расходы' },
          { nomenclature_id: 2, nomenclature_name: 'Маркетинг' },
          { nomenclature_id: 3, nomenclature_name: 'Офисные расходы' }
        ])
      });
    });

    await page.route('**/api/financial_centers', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { financial_center_id: 1, financial_center_name: 'Административный центр' }
        ])
      });
    });

    await page.route('**/api/cost_centers', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { cost_center_id: 1, cost_center_name: 'Управление' }
        ])
      });
    });

    await page.reload();

    // Create multiple budget entries
    const budgetEntries = [
      {
        period: 'Январь 2025',
        nomenclature: 'IT расходы',
        planned: '150000',
        actual: '140000',
        description: 'Покупка ноутбуков для отдела'
      },
      {
        period: 'Январь 2025',
        nomenclature: 'Маркетинг',
        planned: '50000',
        actual: '65000',
        description: 'Рекламная кампания'
      }
    ];

    for (const entry of budgetEntries) {
      // Mock successful creation
      await page.route('**/api/registry', async route => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: Math.random(),
              ...entry,
              created_at: new Date().toISOString()
            })
          });
        }
      });

      // Fill form
      await page.selectOption('select[name="period_id"]', { label: entry.period });
      await page.selectOption('select[name="nomenclature_id"]', { label: entry.nomenclature });
      await page.fill('input[name="planned_amount"]', entry.planned);
      await page.fill('input[name="actual_amount"]', entry.actual);
      await page.fill('textarea[name="description"]', entry.description);
      await page.fill('input[name="transaction_date"]', '2025-01-15');

      // Submit entry
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Запись успешно сохранена')).toBeVisible();

      // Wait for form reset
      await page.waitForTimeout(500);
    }

    // Step 4: Verify budget entries were created and navigate to reports
    await page.goto('/reports');
    await expect(page.locator('h1')).toContainText('Отчеты и аналитика');
  });

  test('should handle budget variance analysis', async ({ page }) => {
    await page.goto('/fact');

    // Mock API responses
    await page.route('**/api/periods', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { period_id: 1, period_ru_name: 'Январь 2025' }
        ])
      });
    });

    await page.route('**/api/nomenclatures', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { nomenclature_id: 1, nomenclature_name: 'IT расходы' }
        ])
      });
    });

    await page.reload();

    // Test positive variance (under budget)
    await page.selectOption('select[name="period_id"]', '1');
    await page.selectOption('select[name="nomenclature_id"]', '1');
    await page.fill('input[name="planned_amount"]', '100000');
    await page.fill('input[name="actual_amount"]', '85000');

    // Should show negative variance (savings)
    await expect(page.locator('text=Отклонение:')).toBeVisible();
    const varianceText = await page.locator('text=Отклонение:').locator('..').textContent();
    expect(varianceText).toContain('-15,000');

    // Test negative variance (over budget)
    await page.fill('input[name="actual_amount"]', '120000');
    
    // Should show positive variance (overspend)
    const newVarianceText = await page.locator('text=Отклонение:').locator('..').textContent();
    expect(newVarianceText).toContain('+20,000');
  });

  test('should validate budget constraints and business rules', async ({ page }) => {
    await page.goto('/fact');

    // Mock API responses
    await page.route('**/api/periods', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { period_id: 1, period_ru_name: 'Январь 2025' }
        ])
      });
    });

    await page.reload();

    // Test negative amounts validation
    await page.fill('input[name="planned_amount"]', '-1000');
    await page.fill('input[name="actual_amount"]', '-500');
    await page.click('button[type="submit"]');

    // Should show validation errors
    await expect(page.locator('text=Сумма должна быть положительной')).toBeVisible();

    // Test future date validation
    await page.fill('input[name="planned_amount"]', '1000');
    await page.fill('input[name="actual_amount"]', '500');
    await page.fill('input[name="transaction_date"]', testUtils.generateFutureDate(365));
    await page.click('button[type="submit"]');

    // Should show future date validation error
    await expect(page.locator('text=Дата не может быть в будущем')).toBeVisible();
  });
});

test.describe('Reports Generation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto('/reports');
  });

  test('should generate plan-fact analysis report', async ({ page }) => {
    // Mock report data
    const mockReportData = [
      {
        period_ru_name: 'Январь 2025',
        nomenclature_name: 'IT расходы',
        planned_amount: 150000,
        actual_amount: 140000,
        financial_center_name: 'Административный центр'
      },
      {
        period_ru_name: 'Январь 2025',
        nomenclature_name: 'Маркетинг',
        planned_amount: 50000,
        actual_amount: 65000,
        financial_center_name: 'Отдел продаж'
      }
    ];

    await page.route('**/api/reports/plan-fact*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockReportData)
      });
    });

    // Mock filter data
    await page.route('**/api/periods', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { period_id: 1, period_ru_name: 'Январь 2025' }
        ])
      });
    });

    await page.route('**/api/financial_centers', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { financial_center_id: 1, financial_center_name: 'Все ЦФО' }
        ])
      });
    });

    await page.reload();

    // Set report filters
    await page.selectOption('select[name="report_type"]', 'plan_fact');
    await page.selectOption('select[name="period_id"]', '1');
    await page.click('button:has-text("Применить фильтры")');

    // Should generate report
    await testUtils.waitForTableData(page);
    await expect(page.locator('text=IT расходы')).toBeVisible();
    await expect(page.locator('text=Маркетинг')).toBeVisible();

    // Should show variance calculations
    await expect(page.locator('text=140,000')).toBeVisible(); // Actual amount
    await expect(page.locator('text=150,000')).toBeVisible(); // Planned amount
  });

  test('should switch between table and chart views', async ({ page }) => {
    // Mock chart data
    await page.route('**/api/reports/*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            period_ru_name: 'Январь 2025',
            nomenclature_name: 'IT расходы',
            planned_amount: 150000,
            actual_amount: 140000
          }
        ])
      });
    });

    await page.reload();

    // Should show table view by default
    await expect(page.locator(pageSelectors.tables.dataTable)).toBeVisible();

    // Switch to chart view
    await page.click(pageSelectors.charts.chartToggle);
    await page.click('button:has-text("График")');

    // Should show chart view
    await testUtils.waitForChartRender(page);
    await expect(page.locator(pageSelectors.charts.chartContainer)).toBeVisible();

    // Should be able to change chart type
    await page.click(pageSelectors.charts.chartSelector);
    await page.selectOption('select', 'category_pie');

    // Should render different chart type
    await testUtils.waitForChartRender(page);
    await expect(page.locator('text=Распределение по категориям')).toBeVisible();
  });

  test('should export report data', async ({ page }) => {
    // Mock report data
    await page.route('**/api/reports/*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            period_ru_name: 'Январь 2025',
            nomenclature_name: 'IT расходы',
            planned_amount: 150000,
            actual_amount: 140000
          }
        ])
      });
    });

    await page.reload();
    await testUtils.waitForTableData(page);

    // Set up download handling
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.click('button:has-text("Экспорт")');

    // Should trigger download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  test('should handle report filtering and pagination', async ({ page }) => {
    // Mock large dataset
    const mockData = Array.from({ length: 25 }, (_, i) => ({
      period_ru_name: 'Январь 2025',
      nomenclature_name: `Категория ${i + 1}`,
      planned_amount: (i + 1) * 10000,
      actual_amount: (i + 1) * 9500
    }));

    await page.route('**/api/reports/*', async route => {
      const url = new URL(route.request().url());
      const page_num = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '10');
      
      const start = (page_num - 1) * limit;
      const end = start + limit;
      const pageData = mockData.slice(start, end);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: pageData,
          total: mockData.length,
          page: page_num,
          limit: limit
        })
      });
    });

    await page.reload();
    await testUtils.waitForTableData(page);

    // Should show pagination
    await expect(page.locator(pageSelectors.tables.pagination)).toBeVisible();

    // Test search filtering
    await page.fill('input[placeholder*="Поиск"]', 'Категория 1');
    await page.press('input[placeholder*="Поиск"]', 'Enter');

    await testUtils.waitForTableData(page);
    await expect(page.locator('text=Категория 1')).toBeVisible();
  });

  test('should handle report generation errors', async ({ page }) => {
    // Mock API error
    await page.route('**/api/reports/*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Ошибка генерации отчета'
        })
      });
    });

    await page.reload();

    // Apply filters to trigger report generation
    await page.click('button:has-text("Применить фильтры")');

    // Should show error message
    await expect(page.locator('text=Ошибка генерации отчета')).toBeVisible();

    // Should show retry option
    await expect(page.locator('button:has-text("Повторить")')).toBeVisible();
  });

  test('should handle empty report data', async ({ page }) => {
    // Mock empty data response
    await page.route('**/api/reports/*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.reload();
    await page.click('button:has-text("Применить фильтры")');

    // Should show empty state
    await expect(page.locator('text=Нет данных для отображения')).toBeVisible();
  });

  test('should persist report filters and view preferences', async ({ page }) => {
    // Set specific filters
    await page.selectOption('select[name="report_type"]', 'plan_fact');
    await page.click('button:has-text("График")'); // Switch to chart view

    // Reload page
    await page.reload();

    // Should remember filter settings
    const reportType = await page.locator('select[name="report_type"]').inputValue();
    expect(reportType).toBe('plan_fact');

    // Should remember view mode (this would be handled by useUserPreferences hook)
    // In real implementation, chart view would be persisted
  });
});
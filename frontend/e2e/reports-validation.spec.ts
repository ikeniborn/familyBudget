import { test, expect } from '@playwright/test';

test.describe('Reports Page Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authenticated state
    await page.evaluate(() => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: {
            id: 1,
            username: 'testuser',
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com'
          },
          isAuthenticated: true
        },
        version: 0
      }));
    });
  });

  test('should load reports page without errors', async ({ page }) => {
    // Navigate to reports page
    await page.goto('/reports');
    
    // Wait for the page to load
    await page.waitForSelector('h1', { timeout: 10000 });
    
    // Check that main heading is present
    await expect(page.locator('h1')).toContainText('Отчеты и аналитика');
    
    // Check that filters section is present
    await expect(page.locator('text=Фильтры отчета')).toBeVisible();
    
    // Check that view mode toggle is present
    await expect(page.locator('text=Таблица')).toBeVisible();
    await expect(page.locator('text=График')).toBeVisible();
  });

  test('should display report filters and controls', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForSelector('h1');
    
    // Check report type selector
    await expect(page.locator('select[name="report_type"]')).toBeVisible();
    
    // Check apply filters button
    await expect(page.locator('button:has-text("Применить фильтры")')).toBeVisible();
    
    // Check refresh button
    await expect(page.locator('button[aria-label="Обновить данные"]')).toBeVisible();
  });

  test('should switch between table and chart views', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForSelector('h1');
    
    // Default should be table view
    await expect(page.locator('button:has-text("Таблица")')).toHaveClass(/bg-white/);
    
    // Switch to chart view
    await page.click('button:has-text("График")');
    
    // Chart button should be active
    await expect(page.locator('button:has-text("График")')).toHaveClass(/bg-white/);
    
    // Chart selector should be visible
    await expect(page.locator('[data-testid="chart-selector"]')).toBeVisible();
  });

  test('should load and display mock data', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForSelector('h1');
    
    // Apply filters to trigger data loading
    await page.click('button:has-text("Применить фильтры")');
    
    // Wait for data to load
    await page.waitForSelector('[data-testid="data-table"]', { timeout: 10000 });
    
    // Check that table contains data
    const rows = page.locator('tbody tr');
    await expect(rows).not.toHaveCount(0);
    
    // Check that mock data is displayed
    await expect(page.locator('text=Операционные расходы')).toBeVisible();
    await expect(page.locator('text=Маркетинг')).toBeVisible();
  });

  test('should display statistics cards', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForSelector('h1');
    
    // Check for statistics cards
    await expect(page.locator('text=Общий доход')).toBeVisible();
    await expect(page.locator('text=Общий расход')).toBeVisible();
    await expect(page.locator('text=Отклонение')).toBeVisible();
    await expect(page.locator('text=Использование бюджета')).toBeVisible();
  });

  test('should handle chart rendering', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForSelector('h1');
    
    // Switch to chart view
    await page.click('button:has-text("График")');
    
    // Apply filters to load data
    await page.click('button:has-text("Применить фильтры")');
    
    // Wait for chart to render
    await page.waitForSelector('[data-testid="chart-container"]', { timeout: 15000 });
    
    // Check that chart is rendered
    await expect(page.locator('[data-testid="chart-container"] svg')).toBeVisible();
  });

  test('should handle different chart types', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForSelector('h1');
    
    // Switch to chart view
    await page.click('button:has-text("График")');
    
    // Apply filters to load data
    await page.click('button:has-text("Применить фильтры")');
    
    // Wait for chart selector
    await page.waitForSelector('[data-testid="chart-selector"] select');
    
    // Test different chart types
    const chartTypes = ['plan_fact_bar', 'category_pie', 'budget_gauge'];
    
    for (const chartType of chartTypes) {
      await page.selectOption('[data-testid="chart-selector"] select', chartType);
      
      // Wait for chart to re-render
      await page.waitForTimeout(1000);
      
      // Chart container should still be visible
      await expect(page.locator('[data-testid="chart-container"]')).toBeVisible();
    }
  });

  test('should handle loading states correctly', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForSelector('h1');
    
    // Click apply filters and immediately check for loading state
    await page.click('button:has-text("Применить фильтры")');
    
    // Should show loading indicator briefly
    await expect(page.locator('text=Загрузка')).toBeVisible({ timeout: 2000 });
    
    // Loading should eventually disappear
    await expect(page.locator('text=Загрузка')).not.toBeVisible({ timeout: 10000 });
  });

  test('should persist user preferences', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForSelector('h1');
    
    // Switch to chart view
    await page.click('button:has-text("График")');
    
    // Change chart type
    await page.selectOption('[data-testid="chart-selector"] select', 'category_pie');
    
    // Reload page
    await page.reload();
    await page.waitForSelector('h1');
    
    // Chart view should be remembered
    await expect(page.locator('button:has-text("График")')).toHaveClass(/bg-white/);
    
    // Chart type should be remembered
    const selectedValue = await page.locator('[data-testid="chart-selector"] select').inputValue();
    expect(selectedValue).toBe('category_pie');
  });

  test('should handle refresh functionality', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForSelector('h1');
    
    // Load initial data
    await page.click('button:has-text("Применить фильтры")');
    await page.waitForSelector('[data-testid="data-table"]');
    
    // Click refresh button
    await page.click('button[aria-label="Обновить данные"]');
    
    // Should show loading state
    await expect(page.locator('text=Загрузка')).toBeVisible({ timeout: 2000 });
    
    // Data should reload
    await expect(page.locator('[data-testid="data-table"]')).toBeVisible({ timeout: 10000 });
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/reports');
    await page.waitForSelector('h1');
    
    // Main heading should be visible
    await expect(page.locator('h1')).toBeVisible();
    
    // Controls should be properly laid out
    await expect(page.locator('button:has-text("Применить фильтры")')).toBeVisible();
    
    // View mode toggle should work on mobile
    await page.click('button:has-text("График")');
    await expect(page.locator('button:has-text("График")')).toHaveClass(/bg-white/);
  });
});
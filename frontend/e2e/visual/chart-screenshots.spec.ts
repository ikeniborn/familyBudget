import { test, expect } from '@playwright/test';

test.describe('Chart Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport to standard desktop size
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Navigate to a test page with charts (when charts are working)
    await page.goto('/dashboard');
    
    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
  });

  test('Dashboard charts visual regression', async ({ page }) => {
    // Wait for any charts to load
    await page.waitForTimeout(2000);
    
    // Take full page screenshot
    await expect(page).toHaveScreenshot('dashboard-full-page.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('Individual chart components', async ({ page }) => {
    // Test each chart container individually when they exist
    const chartContainers = page.locator('[data-testid*="chart"]');
    const count = await chartContainers.count();
    
    for (let i = 0; i < count; i++) {
      const chart = chartContainers.nth(i);
      const testId = await chart.getAttribute('data-testid') || `chart-${i}`;
      
      await expect(chart).toHaveScreenshot(`${testId}.png`, {
        threshold: 0.1,
      });
    }
  });

  test('Chart loading states', async ({ page }) => {
    // Navigate to reports page that might show loading
    await page.goto('/reports');
    
    // Capture loading state if present
    const loadingIndicator = page.locator('.animate-spin').first();
    if (await loadingIndicator.isVisible()) {
      await expect(loadingIndicator).toHaveScreenshot('chart-loading-state.png');
    }
    
    // Wait for content to load and take final screenshot
    await page.waitForTimeout(3000);
    await expect(page).toHaveScreenshot('reports-loaded-state.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('Chart empty states', async ({ page }) => {
    // Navigate to reports page which should show empty state
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    
    // Look for empty state elements
    const emptyState = page.locator('text=База данных пуста').first();
    if (await emptyState.isVisible()) {
      await expect(page).toHaveScreenshot('charts-empty-state.png', {
        fullPage: true,
        threshold: 0.2,
      });
    }
  });

  test('Chart error states', async ({ page }) => {
    // Intercept API calls to simulate errors
    await page.route('/api/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Simulated API error' })
      });
    });
    
    await page.goto('/reports');
    await page.waitForTimeout(2000);
    
    // Look for error state
    const errorState = page.locator('text=Ошибка подключения').first();
    if (await errorState.isVisible()) {
      await expect(page).toHaveScreenshot('charts-error-state.png', {
        fullPage: true,
        threshold: 0.2,
      });
    }
  });
});

test.describe('Chart Responsive Tests', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 720 },
    { name: 'large-desktop', width: 1920, height: 1080 },
  ];

  viewports.forEach(({ name, width, height }) => {
    test(`Dashboard responsive - ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot(`dashboard-${name}.png`, {
        fullPage: true,
        threshold: 0.2,
      });
    });

    test(`Reports responsive - ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/reports');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot(`reports-${name}.png`, {
        fullPage: true,
        threshold: 0.2,
      });
    });
  });
});

test.describe('Chart Interaction States', () => {
  test('Chart hover states', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Look for interactive chart elements
    const chartElements = page.locator('[data-testid*="chart"] .recharts-bar, [data-testid*="chart"] .recharts-line');
    const count = await chartElements.count();
    
    if (count > 0) {
      // Hover over first chart element
      await chartElements.first().hover();
      await page.waitForTimeout(500);
      
      await expect(page).toHaveScreenshot('chart-hover-state.png', {
        fullPage: true,
        threshold: 0.1,
      });
    }
  });

  test('Chart tooltip states', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Look for chart areas that might show tooltips
    const chartAreas = page.locator('[data-testid*="chart"]');
    const count = await chartAreas.count();
    
    if (count > 0) {
      // Hover to trigger tooltip
      await chartAreas.first().hover();
      await page.waitForTimeout(500);
      
      // Look for tooltip
      const tooltip = page.locator('.recharts-tooltip-wrapper, .tooltip');
      if (await tooltip.isVisible()) {
        await expect(page).toHaveScreenshot('chart-tooltip-visible.png', {
          fullPage: true,
          threshold: 0.1,
        });
      }
    }
  });
});

test.describe('Chart Theme Variations', () => {
  test('Light theme charts', async ({ page }) => {
    // Set light theme preference
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Ensure light theme is active
    await page.evaluate(() => {
      localStorage.setItem('familyBudget_userPreferences', JSON.stringify({
        chartsTheme: 'light'
      }));
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('charts-light-theme.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('Dark theme charts', async ({ page }) => {
    // Set dark theme preference
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Set dark theme
    await page.evaluate(() => {
      localStorage.setItem('familyBudget_userPreferences', JSON.stringify({
        chartsTheme: 'dark'
      }));
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('charts-dark-theme.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });
});

test.describe('Chart Animation States', () => {
  test('Chart animation disabled for screenshots', async ({ page }) => {
    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('charts-no-animations.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });
});

test.describe('Chart Print Styles', () => {
  test('Chart print preview', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Emulate print media
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('charts-print-preview.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });
});

test.describe('Chart Data States', () => {
  test('Charts with minimal data', async ({ page }) => {
    // Mock API to return minimal data
    await page.route('/api/registry/summary', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            total_income: 1000,
            total_expense: 500,
            budget_utilization: 50,
            periods_count: 1,
          }
        })
      });
    });
    
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('charts-minimal-data.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('Charts with large numbers', async ({ page }) => {
    // Mock API to return large numbers
    await page.route('/api/registry/summary', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            total_income: 999999999,
            total_expense: 555555555,
            budget_utilization: 156,
            periods_count: 99,
          }
        })
      });
    });
    
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('charts-large-numbers.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });
});
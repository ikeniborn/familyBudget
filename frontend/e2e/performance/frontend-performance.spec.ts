import { test, expect, Page } from '@playwright/test';
import { testUsers } from '../fixtures/test-data';

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  firstContentfulPaint: 1500, // 1.5 seconds
  largestContentfulPaint: 2500, // 2.5 seconds
  cumulativeLayoutShift: 0.1,
  firstInputDelay: 100, // 100ms
  memoryLeakThreshold: 50 * 1024 * 1024, // 50MB
  frameDurationThreshold: 16.67, // 60 FPS = 16.67ms per frame
  renderingThreshold: 1000, // 1 second for complex renders
};

// Helper function to set up authenticated state
async function setupAuthenticatedUser(page: Page) {
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

// Performance measurement utilities
class FrontendPerformanceMetrics {
  static async measureWebVitals(page: Page): Promise<any> {
    return await page.evaluate(() => {
      return new Promise((resolve) => {
        const metrics: any = {};
        
        // Core Web Vitals
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              metrics.firstContentfulPaint = navEntry.domContentLoadedEventEnd - navEntry.navigationStart;
              metrics.loadTime = navEntry.loadEventEnd - navEntry.navigationStart;
            }
            
            if (entry.entryType === 'paint') {
              if (entry.name === 'first-contentful-paint') {
                metrics.firstContentfulPaint = entry.startTime;
              }
              if (entry.name === 'largest-contentful-paint') {
                metrics.largestContentfulPaint = entry.startTime;
              }
            }
            
            if (entry.entryType === 'layout-shift') {
              if (!metrics.cumulativeLayoutShift) {
                metrics.cumulativeLayoutShift = 0;
              }
              metrics.cumulativeLayoutShift += (entry as any).value;
            }
          }
        }).observe({ entryTypes: ['navigation', 'paint', 'layout-shift'] });
        
        // Memory usage
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          metrics.memoryUsage = {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit
          };
        }
        
        setTimeout(() => resolve(metrics), 2000);
      });
    });
  }

  static async measureRenderingPerformance(page: Page, actions: () => Promise<void>): Promise<any> {
    return await page.evaluate(async (actionsStr) => {
      const startTime = performance.now();
      let frameCount = 0;
      let frameTimes: number[] = [];
      
      // Monitor frame rate
      const frameObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            frameTimes.push(entry.duration);
            frameCount++;
          }
        }
      });
      frameObserver.observe({ entryTypes: ['measure'] });
      
      // Mark frame measurements
      const measureFrame = () => {
        performance.mark('frame-start');
        requestAnimationFrame(() => {
          performance.mark('frame-end');
          performance.measure('frame-duration', 'frame-start', 'frame-end');
          if (frameCount < 60) { // Measure for ~1 second at 60fps
            measureFrame();
          }
        });
      };
      
      measureFrame();
      
      // Wait for rendering to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const endTime = performance.now();
      const averageFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      
      return {
        totalRenderTime: endTime - startTime,
        frameCount,
        averageFrameTime,
        maxFrameTime: Math.max(...frameTimes),
        minFrameTime: Math.min(...frameTimes),
        fps: frameCount > 0 ? 1000 / averageFrameTime : 0
      };
    }, actions.toString());
  }

  static async measureMemoryLeaks(page: Page, iterations: number = 10): Promise<any> {
    const memorySnapshots: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const memory = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        
        // Force garbage collection if available
        if ('gc' in window) {
          (window as any).gc();
        }
        
        return 0;
      });
      
      memorySnapshots.push(memory);
      
      // Trigger some activity that might cause leaks
      await page.evaluate(() => {
        // Create temporary DOM elements
        const div = document.createElement('div');
        div.innerHTML = '<span>'.repeat(1000) + 'test' + '</span>'.repeat(1000);
        document.body.appendChild(div);
        
        // Remove them
        document.body.removeChild(div);
        
        // Create temporary event listeners
        const handler = () => {};
        window.addEventListener('test-event', handler);
        window.removeEventListener('test-event', handler);
      });
      
      await page.waitForTimeout(100);
    }
    
    const initialMemory = memorySnapshots[0];
    const finalMemory = memorySnapshots[memorySnapshots.length - 1];
    const memoryGrowth = finalMemory - initialMemory;
    const averageMemory = memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length;
    
    return {
      initialMemory,
      finalMemory,
      memoryGrowth,
      averageMemory,
      snapshots: memorySnapshots
    };
  }
}

test.describe('Frontend Performance - Rendering Performance', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
  });

  test('should measure Core Web Vitals for main pages', async ({ page }) => {
    const pages = [
      { url: '/', name: 'Dashboard' },
      { url: '/reports', name: 'Reports' },
      { url: '/fact', name: 'Fact Entry' },
      { url: '/products', name: 'Products' }
    ];

    for (const pageInfo of pages) {
      // Navigate to page
      await page.goto(pageInfo.url);
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Measure Web Vitals
      const metrics = await FrontendPerformanceMetrics.measureWebVitals(page);
      
      console.log(`${pageInfo.name} Performance Metrics:
        - First Contentful Paint: ${metrics.firstContentfulPaint}ms
        - Largest Contentful Paint: ${metrics.largestContentfulPaint || 'N/A'}ms
        - Cumulative Layout Shift: ${metrics.cumulativeLayoutShift || 0}
        - Load Time: ${metrics.loadTime}ms
        - Memory Usage: ${(metrics.memoryUsage?.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
      
      // Assertions
      expect(metrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
      if (metrics.largestContentfulPaint) {
        expect(metrics.largestContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.largestContentfulPaint);
      }
      if (metrics.cumulativeLayoutShift) {
        expect(metrics.cumulativeLayoutShift).toBeLessThan(PERFORMANCE_THRESHOLDS.cumulativeLayoutShift);
      }
    }
  });

  test('should measure large table rendering performance', async ({ page }) => {
    // Mock large dataset
    const mockLargeDataset = Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      period_ru_name: `Период ${(i % 12) + 1}`,
      nomenclature_name: `Категория ${(i % 50) + 1}`,
      planned_amount: Math.floor(Math.random() * 100000) + 10000,
      actual_amount: Math.floor(Math.random() * 100000) + 10000,
      variance: Math.floor(Math.random() * 20000) - 10000
    }));

    await page.route('**/api/reports/plan-fact*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockLargeDataset)
      });
    });

    await page.route('**/api/periods', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { period_id: 1, period_ru_name: 'Январь 2025' }
        ])
      });
    });

    await page.goto('/reports');
    
    // Measure rendering performance
    const renderStartTime = Date.now();
    
    await page.selectOption('select[name="report_type"]', 'plan_fact');
    await page.selectOption('select[name="period_id"]', '1');
    await page.click('button:has-text("Применить фильтры")');
    
    // Wait for table to fully render
    await page.waitForSelector('[data-testid="data-table"]');
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('tbody tr');
      return rows.length >= 50; // Wait for substantial data
    });
    
    const renderTime = Date.now() - renderStartTime;
    
    // Measure scroll performance
    const scrollMetrics = await page.evaluate(() => {
      const startTime = performance.now();
      let frameCount = 0;
      
      return new Promise((resolve) => {
        const table = document.querySelector('[data-testid="data-table"]');
        if (!table) return resolve({ scrollPerformance: 0, frameCount: 0 });
        
        const measureScrollFrame = () => {
          frameCount++;
          table.scrollTop += 100;
          
          if (frameCount < 20) {
            requestAnimationFrame(measureScrollFrame);
          } else {
            const endTime = performance.now();
            resolve({
              scrollPerformance: endTime - startTime,
              frameCount,
              averageFrameTime: (endTime - startTime) / frameCount
            });
          }
        };
        
        requestAnimationFrame(measureScrollFrame);
      });
    });

    console.log(`Large Table Rendering Performance:
      - Dataset size: ${mockLargeDataset.length} records
      - Initial render time: ${renderTime}ms
      - Scroll performance: ${(scrollMetrics as any).scrollPerformance}ms for ${(scrollMetrics as any).frameCount} frames
      - Average frame time: ${(scrollMetrics as any).averageFrameTime}ms`);

    // Assertions
    expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.renderingThreshold * 2); // Allow 2x for large data
    expect((scrollMetrics as any).averageFrameTime).toBeLessThan(PERFORMANCE_THRESHOLDS.frameDurationThreshold * 2);
  });

  test('should measure chart rendering performance', async ({ page }) => {
    // Mock chart data
    const mockChartData = Array.from({ length: 100 }, (_, i) => ({
      period_ru_name: `День ${i + 1}`,
      nomenclature_name: 'IT расходы',
      planned_amount: Math.floor(Math.random() * 50000) + 10000,
      actual_amount: Math.floor(Math.random() * 50000) + 10000
    }));

    await page.route('**/api/reports/*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockChartData)
      });
    });

    await page.goto('/reports');
    
    // Switch to chart view and measure rendering
    const chartRenderStartTime = Date.now();
    
    // Assuming chart toggle exists (from Phase 10.5)
    await page.click('button:has-text("График")');
    
    // Wait for chart to render
    await page.waitForSelector('[data-testid="chart-container"]', { timeout: 10000 });
    await page.waitForFunction(() => {
      const chartContainer = document.querySelector('[data-testid="chart-container"]');
      return chartContainer && chartContainer.querySelector('svg');
    });
    
    const chartRenderTime = Date.now() - chartRenderStartTime;
    
    // Test different chart types performance
    const chartTypes = ['plan_fact_bar', 'category_pie', 'trend_line'];
    const chartPerformance: Record<string, number> = {};
    
    for (const chartType of chartTypes) {
      const switchStartTime = Date.now();
      
      // Switch chart type (assuming selector exists)
      await page.selectOption('[data-testid="chart-selector"] select', chartType);
      
      // Wait for chart to re-render
      await page.waitForFunction((type) => {
        const container = document.querySelector('[data-testid="chart-container"]');
        return container && container.querySelector('svg') && 
               container.getAttribute('data-chart-type') === type;
      }, chartType);
      
      chartPerformance[chartType] = Date.now() - switchStartTime;
    }

    console.log(`Chart Rendering Performance:
      - Initial chart render: ${chartRenderTime}ms
      - Chart type switches:
        ${Object.entries(chartPerformance).map(([type, time]) => `  - ${type}: ${time}ms`).join('\n        ')}`);

    // Assertions
    expect(chartRenderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.renderingThreshold * 1.5);
    Object.values(chartPerformance).forEach(time => {
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.renderingThreshold);
    });
  });

  test('should measure form interaction performance', async ({ page }) => {
    await page.goto('/fact');
    
    // Mock form dependencies
    await page.route('**/api/periods', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(Array.from({ length: 50 }, (_, i) => ({
          period_id: i + 1,
          period_ru_name: `Период ${i + 1}`
        })))
      });
    });

    await page.route('**/api/nomenclatures', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(Array.from({ length: 100 }, (_, i) => ({
          nomenclature_id: i + 1,
          nomenclature_name: `Категория ${i + 1}`
        })))
      });
    });

    await page.reload();
    
    // Measure form field interaction performance
    const interactions = [
      { action: 'select period', selector: 'select[name="period_id"]' },
      { action: 'select nomenclature', selector: 'select[name="nomenclature_id"]' },
      { action: 'fill planned amount', selector: 'input[name="planned_amount"]' },
      { action: 'fill actual amount', selector: 'input[name="actual_amount"]' },
      { action: 'fill description', selector: 'textarea[name="description"]' }
    ];

    const interactionTimes: Record<string, number> = {};

    for (const interaction of interactions) {
      const startTime = Date.now();
      
      if (interaction.selector.includes('select')) {
        await page.selectOption(interaction.selector, '1');
      } else if (interaction.selector.includes('textarea')) {
        await page.fill(interaction.selector, 'Test description '.repeat(10));
      } else {
        await page.fill(interaction.selector, '50000');
      }
      
      // Wait for any validation or calculation triggers
      await page.waitForTimeout(100);
      
      interactionTimes[interaction.action] = Date.now() - startTime;
    }

    // Measure form validation performance
    const validationStartTime = Date.now();
    await page.fill('input[name="planned_amount"]', '-1000'); // Invalid value
    await page.waitForSelector('text=Сумма должна быть положительной', { timeout: 5000 });
    const validationTime = Date.now() - validationStartTime;

    console.log(`Form Interaction Performance:
      ${Object.entries(interactionTimes).map(([action, time]) => `- ${action}: ${time}ms`).join('\n      ')}
      - Validation response: ${validationTime}ms`);

    // Assertions
    Object.values(interactionTimes).forEach(time => {
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.firstInputDelay * 5); // Allow 5x for complex operations
    });
    expect(validationTime).toBeLessThan(500); // Validation should be quick
  });
});

test.describe('Frontend Performance - Memory Leak Detection', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
  });

  test('should detect memory leaks in navigation between pages', async ({ page }) => {
    const pages = ['/', '/reports', '/fact', '/products'];
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Navigate between pages multiple times
    for (let cycle = 0; cycle < 5; cycle++) {
      for (const pageUrl of pages) {
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');
        
        // Trigger some interactions to potentially create memory leaks
        await page.evaluate(() => {
          // Simulate component mounting/unmounting
          const event = new CustomEvent('test-interaction');
          document.dispatchEvent(event);
          
          // Force garbage collection if available
          if ('gc' in window) {
            (window as any).gc();
          }
        });
        
        await page.waitForTimeout(100);
      }
    }

    const finalMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    const memoryGrowth = finalMemory - initialMemory;
    const memoryGrowthMB = memoryGrowth / 1024 / 1024;

    console.log(`Navigation Memory Test:
      - Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB
      - Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB
      - Memory growth: ${memoryGrowthMB.toFixed(2)}MB
      - Navigation cycles: 5 cycles × ${pages.length} pages`);

    // Memory growth should be minimal for navigation
    expect(memoryGrowth).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryLeakThreshold);
  });

  test('should detect memory leaks in data table operations', async ({ page }) => {
    // Create large dataset for memory stress testing
    const createLargeDataset = (size: number) => 
      Array.from({ length: size }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        description: `Description for item ${i + 1} `.repeat(10),
        value: Math.random() * 10000
      }));

    await page.route('**/api/products*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createLargeDataset(1000))
      });
    });

    await page.goto('/products');
    
    const memoryLeakTest = await FrontendPerformanceMetrics.measureMemoryLeaks(page, 20);

    // Perform data operations that might cause leaks
    for (let i = 0; i < 10; i++) {
      // Trigger table re-renders
      await page.fill('input[placeholder*="Поиск"]', `search ${i}`);
      await page.waitForTimeout(200);
      
      // Clear search
      await page.fill('input[placeholder*="Поиск"]', '');
      await page.waitForTimeout(200);
      
      // Force component updates
      await page.evaluate(() => {
        // Simulate state changes that might leak
        window.dispatchEvent(new Event('resize'));
      });
    }

    const finalMemoryCheck = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    console.log(`Data Table Memory Test:
      - Memory growth over iterations: ${(memoryLeakTest.memoryGrowth / 1024 / 1024).toFixed(2)}MB
      - Average memory usage: ${(memoryLeakTest.averageMemory / 1024 / 1024).toFixed(2)}MB
      - Final memory check: ${(finalMemoryCheck / 1024 / 1024).toFixed(2)}MB`);

    // Memory growth should be controlled
    expect(memoryLeakTest.memoryGrowth).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryLeakThreshold);
  });

  test('should detect memory leaks in chart rendering', async ({ page }) => {
    // Mock chart data updates
    let dataVersion = 0;
    await page.route('**/api/reports/*', async route => {
      dataVersion++;
      const data = Array.from({ length: 100 }, (_, i) => ({
        id: i + dataVersion * 100,
        value: Math.random() * 1000,
        label: `Point ${i + dataVersion * 100}`
      }));
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data)
      });
    });

    await page.goto('/reports');
    
    // Switch to chart view if available
    try {
      await page.click('button:has-text("График")', { timeout: 2000 });
    } catch {
      // Chart view might not be available yet
    }

    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Repeatedly update chart data
    for (let i = 0; i < 15; i++) {
      await page.click('button:has-text("Применить фильтры")');
      await page.waitForTimeout(300);
      
      // Try switching chart types if available
      try {
        const chartTypes = ['plan_fact_bar', 'category_pie'];
        for (const chartType of chartTypes) {
          await page.selectOption('[data-testid="chart-selector"] select', chartType);
          await page.waitForTimeout(200);
        }
      } catch {
        // Chart type selector might not be available
      }
    }

    const finalMemory = await page.evaluate(() => {
      // Force garbage collection
      if ('gc' in window) {
        (window as any).gc();
      }
      
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    const memoryGrowth = finalMemory - initialMemory;

    console.log(`Chart Memory Test:
      - Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB
      - Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB
      - Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB
      - Chart updates: 15 iterations`);

    // Chart rendering should not cause significant memory leaks
    expect(memoryGrowth).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryLeakThreshold);
  });

  test('should detect memory leaks in form interactions', async ({ page }) => {
    await page.goto('/fact');
    
    // Mock form dependencies
    await page.route('**/api/periods', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ period_id: 1, period_ru_name: 'Test Period' }])
      });
    });

    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Perform repetitive form operations
    for (let i = 0; i < 50; i++) {
      // Fill and clear form fields repeatedly
      await page.fill('input[name="planned_amount"]', `${1000 + i}`);
      await page.fill('input[name="actual_amount"]', `${900 + i}`);
      await page.fill('textarea[name="description"]', `Description ${i} `.repeat(5));
      
      // Clear fields
      await page.fill('input[name="planned_amount"]', '');
      await page.fill('input[name="actual_amount"]', '');
      await page.fill('textarea[name="description"]', '');
      
      // Trigger validation
      await page.fill('input[name="planned_amount"]', '-100');
      await page.fill('input[name="planned_amount"]', '100');
      
      if (i % 10 === 0) {
        await page.waitForTimeout(100);
      }
    }

    const finalMemory = await page.evaluate(() => {
      // Force garbage collection
      if ('gc' in window) {
        (window as any).gc();
      }
      
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    const memoryGrowth = finalMemory - initialMemory;

    console.log(`Form Interaction Memory Test:
      - Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB
      - Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB
      - Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB
      - Form operations: 50 fill/clear cycles`);

    // Form interactions should not cause memory leaks
    expect(memoryGrowth).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryLeakThreshold / 2); // Stricter threshold for forms
  });
});
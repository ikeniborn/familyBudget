import { test, expect } from '@playwright/test';

test.describe('Reference Data Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        name: 'Test User',
        telegram_id: '123456'
      }));
    });
  });

  test.describe('Large Dataset Handling', () => {
    test('should handle 10,000 periods efficiently', async ({ page }) => {
      // Mock large dataset
      await page.route('/api/periods*', async route => {
        const periods = Array.from({ length: 10000 }, (_, i) => ({
          period_id: i + 1,
          period_name: `Period ${i + 1}`,
          period_year: 2020 + Math.floor(i / 12),
          period_month: (i % 12) + 1,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        
        await route.fulfill({ 
          json: periods,
          headers: { 'Content-Type': 'application/json' }
        });
      });

      await page.click('button:has-text("Периоды")');
      
      // Measure initial load time
      const startTime = Date.now();
      await page.waitForSelector('.virtual-scroll-container');
      const loadTime = Date.now() - startTime;
      
      // Should load within 2 seconds
      expect(loadTime).toBeLessThan(2000);
      
      // Verify virtual scrolling is active
      const renderedRows = await page.locator('tbody tr').count();
      expect(renderedRows).toBeLessThan(100); // Virtual scrolling should limit DOM nodes
      
      // Test scrolling performance
      const scrollStartTime = Date.now();
      await page.evaluate(() => {
        const container = document.querySelector('.virtual-scroll-container');
        container?.scrollTo(0, container.scrollHeight / 2);
      });
      await page.waitForTimeout(100); // Wait for render
      const scrollTime = Date.now() - scrollStartTime;
      
      // Scrolling should be smooth (< 200ms)
      expect(scrollTime).toBeLessThan(200);
    });

    test('should handle 5,000 financial centers with hierarchy', async ({ page }) => {
      // Mock hierarchical dataset
      await page.route('/api/financial_centers*', async route => {
        const centers = [];
        
        // Create 50 root centers
        for (let i = 0; i < 50; i++) {
          centers.push({
            financial_center_id: i * 100 + 1,
            financial_center_name: `Root Center ${i + 1}`,
            parent_id: null,
            level: 0,
            is_active: true
          });
          
          // Create 99 child centers for each root
          for (let j = 0; j < 99; j++) {
            centers.push({
              financial_center_id: i * 100 + j + 2,
              financial_center_name: `Child ${i + 1}-${j + 1}`,
              parent_id: i * 100 + 1,
              level: 1,
              is_active: true
            });
          }
        }
        
        await route.fulfill({ json: centers });
      });

      await page.click('button:has-text("Финансовые центры")');
      
      const startTime = Date.now();
      await page.waitForSelector('.tree-view');
      const loadTime = Date.now() - startTime;
      
      // Should handle hierarchy within 3 seconds
      expect(loadTime).toBeLessThan(3000);
      
      // Test expand/collapse performance
      const expandStartTime = Date.now();
      await page.click('.tree-item:first-child button[aria-label="Expand"]');
      await page.waitForSelector('.tree-item:first-child .tree-item');
      const expandTime = Date.now() - expandStartTime;
      
      // Expand should be fast (< 300ms)
      expect(expandTime).toBeLessThan(300);
    });
  });

  test.describe('Search Performance', () => {
    test('should search through 10,000 items efficiently', async ({ page }) => {
      // Mock large dataset
      await page.route('/api/nomenclatures*', async route => {
        const nomenclatures = Array.from({ length: 10000 }, (_, i) => ({
          nomenclature_id: i + 1,
          nomenclature_name: `Category ${i + 1}`,
          nomenclature_type: i % 2 === 0 ? 'INCOME' : 'EXPENSE',
          is_active: true
        }));
        
        await route.fulfill({ json: nomenclatures });
      });

      await page.click('button:has-text("Номенклатуры")');
      await page.waitForSelector('table');
      
      // Test search performance
      const searchInput = page.locator('input[placeholder="Поиск..."]');
      
      const searchStartTime = Date.now();
      await searchInput.fill('Category 5000');
      await page.waitForTimeout(300); // Debounce delay
      
      // Wait for filtered results
      await page.waitForFunction(() => {
        const rows = document.querySelectorAll('tbody tr');
        return rows.length < 100; // Results are filtered
      });
      
      const searchTime = Date.now() - searchStartTime;
      
      // Search should complete within 1 second
      expect(searchTime).toBeLessThan(1000);
      
      // Verify search results
      const visibleRows = await page.locator('tbody tr:visible').count();
      expect(visibleRows).toBeGreaterThan(0);
      expect(visibleRows).toBeLessThan(20); // Should filter effectively
    });

    test('should handle complex filters efficiently', async ({ page }) => {
      await page.click('button:has-text("Номенклатуры")');
      await page.click('button:has-text("Расширенный поиск")');
      
      // Add multiple filters
      const filterStartTime = Date.now();
      
      // Filter 1
      await page.selectOption('select[name="field"]', 'nomenclature_type');
      await page.selectOption('select[name="operator"]', 'equals');
      await page.selectOption('select[name="value"]', 'EXPENSE');
      await page.click('button[aria-label="Add filter"]');
      
      // Filter 2
      await page.selectOption('select[name="field"]', 'is_active');
      await page.selectOption('select[name="operator"]', 'equals');
      await page.selectOption('select[name="value"]', 'true');
      await page.click('button[aria-label="Add filter"]');
      
      // Apply filters
      await page.click('button:has-text("Применить")');
      
      await page.waitForSelector('.filter-results');
      const filterTime = Date.now() - filterStartTime;
      
      // Complex filtering should complete within 1.5 seconds
      expect(filterTime).toBeLessThan(1500);
    });
  });

  test.describe('Bulk Operations Performance', () => {
    test('should import 1,000 records efficiently', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      await page.click('button:has-text("Массовые операции")');
      await page.click('button:has-text("Импорт")');
      
      // Create large CSV
      const csvLines = ['period_name,period_year,period_month'];
      for (let i = 0; i < 1000; i++) {
        const year = 2020 + Math.floor(i / 12);
        const month = (i % 12) + 1;
        csvLines.push(`Period ${year}-${month},${year},${month}`);
      }
      const csvContent = csvLines.join('\n');
      const buffer = Buffer.from(csvContent);
      
      const importStartTime = Date.now();
      
      await page.setInputFiles('input[type="file"]', {
        name: 'large_import.csv',
        mimeType: 'text/csv',
        buffer
      });
      
      // Wait for import to complete
      await page.waitForSelector('.progress-complete', { timeout: 30000 });
      const importTime = Date.now() - importStartTime;
      
      // Should import 1000 records within 10 seconds
      expect(importTime).toBeLessThan(10000);
      
      // Verify progress tracking
      const progressUpdates = await page.locator('.progress-bar').count();
      expect(progressUpdates).toBeGreaterThan(0);
    });

    test('should export 5,000 records efficiently', async ({ page }) => {
      // Mock large dataset
      await page.route('/api/periods*', async route => {
        const periods = Array.from({ length: 5000 }, (_, i) => ({
          period_id: i + 1,
          period_name: `Period ${i + 1}`,
          period_year: 2020 + Math.floor(i / 12),
          period_month: (i % 12) + 1,
          is_active: true
        }));
        
        await route.fulfill({ json: periods });
      });

      await page.click('button:has-text("Периоды")');
      await page.click('button:has-text("Массовые операции")');
      await page.click('button:has-text("Экспорт")');
      
      await page.selectOption('select[name="format"]', 'excel');
      
      const exportStartTime = Date.now();
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Экспорт")');
      const download = await downloadPromise;
      const exportTime = Date.now() - exportStartTime;
      
      // Should export 5000 records within 5 seconds
      expect(exportTime).toBeLessThan(5000);
      
      // Verify file size is reasonable
      const path = await download.path();
      expect(path).toBeTruthy();
    });

    test('should update 500 records in batch efficiently', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      
      // Select multiple items programmatically
      await page.evaluate(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        for (let i = 1; i <= 500 && i < checkboxes.length; i++) {
          (checkboxes[i] as HTMLInputElement).click();
        }
      });
      
      await page.click('button:has-text("Массовые операции")');
      await page.click('button:has-text("Групповое обновление")');
      await page.click('button:has-text("Добавить выбранные")');
      
      await page.selectOption('select[name="field"]', 'is_active');
      await page.selectOption('select[name="value"]', 'false');
      
      const updateStartTime = Date.now();
      await page.click('button:has-text("Выполнить групповое обновление")');
      
      // Wait for completion
      await page.waitForSelector(':text("Успешно обновлено: 500")', { timeout: 15000 });
      const updateTime = Date.now() - updateStartTime;
      
      // Should update 500 records within 5 seconds
      expect(updateTime).toBeLessThan(5000);
    });
  });

  test.describe('Memory Usage', () => {
    test('should not leak memory during extended usage', async ({ page, context }) => {
      // Enable Chrome DevTools Protocol
      const client = await context.newCDPSession(page);
      
      // Get initial memory usage
      await client.send('Runtime.enable');
      const initialHeap = await client.send('Runtime.getHeapUsage');
      const initialUsedSize = initialHeap.usedSize;
      
      // Perform intensive operations
      for (let i = 0; i < 10; i++) {
        await page.click('button:has-text("Периоды")');
        await page.waitForTimeout(100);
        await page.click('button:has-text("Финансовые центры")');
        await page.waitForTimeout(100);
        await page.click('button:has-text("Центры затрат")');
        await page.waitForTimeout(100);
        await page.click('button:has-text("Номенклатуры")');
        await page.waitForTimeout(100);
      }
      
      // Force garbage collection
      await client.send('HeapProfiler.collectGarbage');
      await page.waitForTimeout(1000);
      
      // Get final memory usage
      const finalHeap = await client.send('Runtime.getHeapUsage');
      const finalUsedSize = finalHeap.usedSize;
      
      // Memory increase should be reasonable (< 50MB)
      const memoryIncrease = (finalUsedSize - initialUsedSize) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(50);
    });
  });

  test.describe('Concurrent Operations', () => {
    test('should handle multiple concurrent requests', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      
      // Trigger multiple operations concurrently
      const operations = [
        page.click('button:has-text("Добавить период")'),
        page.fill('input[placeholder="Поиск..."]', 'test'),
        page.click('button:has-text("Массовые операции")'),
        page.evaluate(() => {
          // Trigger a refresh
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5' }));
        })
      ];
      
      const concurrentStartTime = Date.now();
      await Promise.all(operations.map(op => op.catch(() => {}))); // Ignore errors
      const concurrentTime = Date.now() - concurrentStartTime;
      
      // All operations should complete within 2 seconds
      expect(concurrentTime).toBeLessThan(2000);
      
      // UI should remain responsive
      const isResponsive = await page.evaluate(() => {
        return !document.body.classList.contains('loading');
      });
      expect(isResponsive).toBe(true);
    });
  });

  test.describe('Network Performance', () => {
    test('should implement efficient caching', async ({ page }) => {
      let apiCallCount = 0;
      
      await page.route('/api/periods*', async route => {
        apiCallCount++;
        const periods = Array.from({ length: 100 }, (_, i) => ({
          period_id: i + 1,
          period_name: `Period ${i + 1}`,
          period_year: 2024,
          period_month: (i % 12) + 1
        }));
        
        await route.fulfill({ 
          json: periods,
          headers: {
            'Cache-Control': 'max-age=3600',
            'ETag': '"123456"'
          }
        });
      });
      
      // First load
      await page.click('button:has-text("Периоды")');
      await page.waitForSelector('table');
      expect(apiCallCount).toBe(1);
      
      // Navigate away and back
      await page.click('button:has-text("Финансовые центры")');
      await page.waitForTimeout(100);
      await page.click('button:has-text("Периоды")');
      await page.waitForSelector('table');
      
      // Should use cache (no additional API call)
      expect(apiCallCount).toBe(1);
    });

    test('should handle slow network gracefully', async ({ page }) => {
      await page.route('/api/periods*', async route => {
        // Simulate slow network
        await new Promise(resolve => setTimeout(resolve, 3000));
        await route.fulfill({ json: [] });
      });
      
      await page.click('button:has-text("Периоды")');
      
      // Should show loading indicator immediately
      const loadingVisible = await page.locator('.loading-indicator').isVisible();
      expect(loadingVisible).toBe(true);
      
      // Should remain responsive during loading
      const otherTabClickable = await page.locator('button:has-text("Финансовые центры")').isEnabled();
      expect(otherTabClickable).toBe(true);
    });
  });

  test.describe('Rendering Performance', () => {
    test('should render complex forms efficiently', async ({ page }) => {
      await page.click('button:has-text("Центры затрат")');
      
      const renderStartTime = Date.now();
      await page.click('button:has-text("Добавить МВЗ")');
      await page.waitForSelector('dialog form');
      const renderTime = Date.now() - renderStartTime;
      
      // Form should render within 200ms
      expect(renderTime).toBeLessThan(200);
      
      // Test form interaction performance
      const interactionStartTime = Date.now();
      await page.fill('input[name="cost_center_name"]', 'Performance Test Center');
      await page.selectOption('select[name="financial_center_id"]', { index: 1 });
      await page.fill('input[name="budget_limit"]', '1000000');
      const interactionTime = Date.now() - interactionStartTime;
      
      // Interactions should be smooth (< 100ms each)
      expect(interactionTime).toBeLessThan(300);
    });

    test('should handle rapid UI updates', async ({ page }) => {
      await page.click('button:has-text("Номенклатуры")');
      
      // Rapidly toggle between views
      const rapidStartTime = Date.now();
      for (let i = 0; i < 10; i++) {
        await page.click('button:has-text("Табличный вид")');
        await page.click('button:has-text("Древовидный вид")');
      }
      const rapidTime = Date.now() - rapidStartTime;
      
      // Should handle rapid toggling (< 2 seconds for 20 switches)
      expect(rapidTime).toBeLessThan(2000);
      
      // UI should remain stable
      const isStable = await page.evaluate(() => {
        const container = document.querySelector('.view-container');
        return container && !container.classList.contains('transitioning');
      });
      expect(isStable).toBe(true);
    });
  });
});
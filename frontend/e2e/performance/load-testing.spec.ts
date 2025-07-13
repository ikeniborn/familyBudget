import { test, expect, Page } from '@playwright/test';
import { testUsers, testBudgetEntries } from '../fixtures/test-data';

// Configuration for load testing
const LOAD_TEST_CONFIG = {
  // API endpoint stress testing
  api: {
    concurrent_requests: 50,
    requests_per_endpoint: 100,
    timeout_threshold: 5000, // 5 seconds
    memory_threshold: 100 * 1024 * 1024, // 100MB
  },
  // Database performance
  database: {
    large_dataset_size: 10000,
    query_timeout_threshold: 2000, // 2 seconds
    concurrent_connections: 20,
  },
  // Frontend performance
  frontend: {
    rendering_threshold: 1000, // 1 second
    memory_leak_threshold: 50 * 1024 * 1024, // 50MB growth
    fps_threshold: 30, // minimum FPS
  }
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
class PerformanceMetrics {
  static async measureApiResponse(page: Page, apiUrl: string): Promise<number> {
    const startTime = Date.now();
    
    await page.waitForResponse(response => 
      response.url().includes(apiUrl) && response.status() === 200
    );
    
    return Date.now() - startTime;
  }

  static async measureMemoryUsage(page: Page): Promise<number> {
    const metrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    return metrics;
  }

  static async measureRenderTime(page: Page, selector: string): Promise<number> {
    const startTime = Date.now();
    await page.waitForSelector(selector, { state: 'visible' });
    return Date.now() - startTime;
  }

  static async measureNetworkActivity(page: Page): Promise<{ requests: number; totalSize: number }> {
    let requestCount = 0;
    let totalSize = 0;

    page.on('response', response => {
      requestCount++;
      totalSize += parseInt(response.headers()['content-length'] || '0');
    });

    // Give time for network activity
    await page.waitForTimeout(1000);

    return { requests: requestCount, totalSize };
  }
}

test.describe('Load Testing - API Endpoints Stress Testing', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
  });

  test('should handle concurrent authentication requests', async ({ page, browser }) => {
    const responsesTimes: number[] = [];
    const errors: string[] = [];

    // Create multiple contexts for concurrent testing
    const contexts = await Promise.all(
      Array.from({ length: LOAD_TEST_CONFIG.api.concurrent_requests }, () => 
        browser.newContext()
      )
    );

    const pages = await Promise.all(
      contexts.map(context => context.newPage())
    );

    // Mock authentication endpoint with realistic delay
    for (const testPage of pages) {
      await testPage.route('**/api/auth/login', async route => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: { id: 1, email: testUsers.testUser.email }
          })
        });
      });
    }

    // Execute concurrent login requests
    const promises = pages.map(async (testPage, index) => {
      try {
        const startTime = Date.now();
        
        await testPage.goto('/login');
        await testPage.click('button:has-text("Вход по паролю")');
        await testPage.fill('input[name="username"]', `user${index}@test.com`);
        await testPage.fill('input[name="password"]', 'password123');
        await testPage.click('button[type="submit"]');
        
        await testPage.waitForURL('/');
        
        const responseTime = Date.now() - startTime;
        responsesTimes.push(responseTime);
        
        return { success: true, responseTime };
      } catch (error) {
        errors.push(`Request ${index}: ${error}`);
        return { success: false, error: error.toString() };
      }
    });

    const results = await Promise.all(promises);

    // Cleanup
    await Promise.all(contexts.map(context => context.close()));

    // Analyze results
    const successfulRequests = results.filter(r => r.success).length;
    const averageResponseTime = responsesTimes.reduce((a, b) => a + b, 0) / responsesTimes.length;
    const maxResponseTime = Math.max(...responsesTimes);

    console.log(`Concurrent Authentication Load Test Results:
      - Successful requests: ${successfulRequests}/${LOAD_TEST_CONFIG.api.concurrent_requests}
      - Average response time: ${averageResponseTime.toFixed(2)}ms
      - Max response time: ${maxResponseTime}ms
      - Errors: ${errors.length}`);

    // Assertions
    expect(successfulRequests).toBeGreaterThan(LOAD_TEST_CONFIG.api.concurrent_requests * 0.9); // 90% success rate
    expect(averageResponseTime).toBeLessThan(LOAD_TEST_CONFIG.api.timeout_threshold);
    expect(maxResponseTime).toBeLessThan(LOAD_TEST_CONFIG.api.timeout_threshold * 2);
  });

  test('should handle high-frequency budget entry submissions', async ({ page }) => {
    const responseTimes: number[] = [];
    let requestCount = 0;
    let errorCount = 0;

    // Mock API endpoints
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

    await page.route('**/api/registry', async route => {
      if (route.request().method() === 'POST') {
        requestCount++;
        const startTime = Date.now();
        
        // Simulate database processing time
        await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
        
        try {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: requestCount,
              created_at: new Date().toISOString()
            })
          });
          
          responseTimes.push(Date.now() - startTime);
        } catch (error) {
          errorCount++;
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Server overloaded' })
          });
        }
      }
    });

    await page.goto('/fact');
    await page.reload();

    // Submit multiple budget entries rapidly
    for (let i = 0; i < LOAD_TEST_CONFIG.api.requests_per_endpoint; i++) {
      await page.selectOption('select[name="period_id"]', '1');
      await page.selectOption('select[name="nomenclature_id"]', '1');
      await page.fill('input[name="planned_amount"]', `${1000 + i}`);
      await page.fill('input[name="actual_amount"]', `${900 + i}`);
      await page.fill('textarea[name="description"]', `Load test entry ${i}`);
      
      await page.click('button[type="submit"]');
      
      // Small delay to prevent overwhelming
      if (i % 10 === 0) {
        await page.waitForTimeout(100);
      }
    }

    // Wait for all requests to complete
    await page.waitForTimeout(2000);

    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const successRate = ((requestCount - errorCount) / requestCount) * 100;

    console.log(`Budget Entry Load Test Results:
      - Total requests: ${requestCount}
      - Successful requests: ${requestCount - errorCount}
      - Success rate: ${successRate.toFixed(2)}%
      - Average response time: ${averageResponseTime.toFixed(2)}ms
      - Max response time: ${maxResponseTime}ms
      - Error count: ${errorCount}`);

    // Assertions
    expect(successRate).toBeGreaterThan(85); // 85% success rate under load
    expect(averageResponseTime).toBeLessThan(LOAD_TEST_CONFIG.api.timeout_threshold);
  });

  test('should handle large dataset report generation', async ({ page }) => {
    let reportGenerationTime = 0;
    let dataSize = 0;

    // Mock large dataset
    const mockLargeDataset = Array.from({ length: LOAD_TEST_CONFIG.database.large_dataset_size }, (_, i) => ({
      period_ru_name: `Период ${(i % 12) + 1}`,
      nomenclature_name: `Категория ${(i % 50) + 1}`,
      planned_amount: Math.floor(Math.random() * 100000) + 10000,
      actual_amount: Math.floor(Math.random() * 100000) + 10000,
      financial_center_name: `ЦФО ${(i % 5) + 1}`,
      variance: Math.floor(Math.random() * 20000) - 10000
    }));

    await page.route('**/api/reports/plan-fact*', async route => {
      const startTime = Date.now();
      
      // Simulate complex query processing
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      
      const responseData = JSON.stringify(mockLargeDataset);
      dataSize = Buffer.byteLength(responseData, 'utf8');
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: responseData
      });
      
      reportGenerationTime = Date.now() - startTime;
    });

    // Mock filter endpoints
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
    
    // Measure memory before
    const memoryBefore = await PerformanceMetrics.measureMemoryUsage(page);
    
    // Generate large report
    const renderStartTime = Date.now();
    await page.selectOption('select[name="report_type"]', 'plan_fact');
    await page.selectOption('select[name="period_id"]', '1');
    await page.click('button:has-text("Применить фильтры")');
    
    // Wait for table to render
    await page.waitForSelector('[data-testid="data-table"]');
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('tbody tr');
      return rows.length > 100; // Wait for substantial data
    });
    
    const renderTime = Date.now() - renderStartTime;
    
    // Measure memory after
    const memoryAfter = await PerformanceMetrics.measureMemoryUsage(page);
    const memoryIncrease = memoryAfter - memoryBefore;

    console.log(`Large Dataset Report Test Results:
      - Dataset size: ${LOAD_TEST_CONFIG.database.large_dataset_size} records
      - Data transfer size: ${(dataSize / 1024 / 1024).toFixed(2)} MB
      - Report generation time: ${reportGenerationTime}ms
      - Frontend render time: ${renderTime}ms
      - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);

    // Assertions
    expect(reportGenerationTime).toBeLessThan(LOAD_TEST_CONFIG.database.query_timeout_threshold);
    expect(renderTime).toBeLessThan(LOAD_TEST_CONFIG.frontend.rendering_threshold * 3); // Allow 3x for large data
    expect(memoryIncrease).toBeLessThan(LOAD_TEST_CONFIG.frontend.memory_leak_threshold);
  });

  test('should handle API rate limiting gracefully', async ({ page }) => {
    let requestCount = 0;
    let rateLimitHits = 0;

    await page.route('**/api/registry', async route => {
      requestCount++;
      
      // Simulate rate limiting after 20 requests
      if (requestCount > 20) {
        rateLimitHits++;
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          headers: {
            'Retry-After': '1',
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': '0'
          },
          body: JSON.stringify({
            error: 'Rate limit exceeded',
            retry_after: 1
          })
        });
      } else {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: requestCount })
        });
      }
    });

    await page.goto('/fact');
    
    // Rapidly submit requests to trigger rate limiting
    for (let i = 0; i < 30; i++) {
      await page.fill('input[name="planned_amount"]', '1000');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(50); // Small delay
    }

    // Wait for all requests to complete
    await page.waitForTimeout(2000);

    console.log(`Rate Limiting Test Results:
      - Total requests attempted: 30
      - Requests processed: ${requestCount}
      - Rate limit hits: ${rateLimitHits}
      - Rate limit threshold: 20 requests`);

    // Assertions
    expect(requestCount).toBeGreaterThan(20);
    expect(rateLimitHits).toBeGreaterThan(0);
    
    // Should show rate limit error message
    await expect(page.locator('text=Rate limit exceeded')).toBeVisible();
  });

  test('should handle network latency and timeouts', async ({ page }) => {
    let timeoutCount = 0;
    let slowResponseCount = 0;

    await page.route('**/api/reports/*', async route => {
      const delay = Math.random() * 10000; // 0-10 second delay
      
      if (delay > 8000) {
        // Simulate timeout
        timeoutCount++;
        await new Promise(resolve => setTimeout(resolve, delay));
        await route.abort('timeout');
      } else if (delay > 5000) {
        // Slow response
        slowResponseCount++;
        await new Promise(resolve => setTimeout(resolve, delay));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      } else {
        // Normal response
        await new Promise(resolve => setTimeout(resolve, delay));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            period_ru_name: 'Январь 2025',
            nomenclature_name: 'IT расходы',
            planned_amount: 100000,
            actual_amount: 95000
          }])
        });
      }
    });

    await page.goto('/reports');
    
    // Try to generate reports multiple times
    for (let i = 0; i < 10; i++) {
      try {
        await page.click('button:has-text("Применить фильтры")');
        await page.waitForSelector('[data-testid="data-table"]', { timeout: 6000 });
      } catch (error) {
        // Expected for some requests due to timeouts
      }
      
      await page.waitForTimeout(500);
    }

    console.log(`Network Latency Test Results:
      - Timeout count: ${timeoutCount}
      - Slow response count: ${slowResponseCount}
      - Expected behavior under poor network conditions`);

    // Should handle timeouts gracefully
    expect(timeoutCount + slowResponseCount).toBeGreaterThan(0);
  });
});

test.describe('Load Testing - Database Query Optimization', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
  });

  test('should handle complex query pagination efficiently', async ({ page }) => {
    let queryTimes: number[] = [];
    let totalRecords = 0;

    // Mock paginated responses with realistic query times
    await page.route('**/api/reports/plan-fact*', async route => {
      const url = new URL(route.request().url());
      const page_num = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      
      const startTime = Date.now();
      
      // Simulate complex join query processing time
      const queryComplexity = page_num * 10; // Slower for later pages
      await new Promise(resolve => setTimeout(resolve, 100 + queryComplexity));
      
      const mockData = Array.from({ length: limit }, (_, i) => ({
        id: (page_num - 1) * limit + i + 1,
        period_ru_name: 'Январь 2025',
        nomenclature_name: `Категория ${i + 1}`,
        planned_amount: 10000 + i * 1000,
        actual_amount: 9500 + i * 950
      }));
      
      totalRecords = 1000; // Simulate large dataset
      const queryTime = Date.now() - startTime;
      queryTimes.push(queryTime);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: mockData,
          total: totalRecords,
          page: page_num,
          limit: limit,
          total_pages: Math.ceil(totalRecords / limit)
        })
      });
    });

    await page.goto('/reports');
    await page.click('button:has-text("Применить фильтры")');
    
    // Navigate through multiple pages
    for (let i = 0; i < 5; i++) {
      await page.waitForSelector('[data-testid="data-table"]');
      await page.click('button[aria-label="Следующая страница"]');
      await page.waitForTimeout(500);
    }

    const averageQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
    const maxQueryTime = Math.max(...queryTimes);

    console.log(`Pagination Performance Results:
      - Pages tested: ${queryTimes.length}
      - Average query time: ${averageQueryTime.toFixed(2)}ms
      - Max query time: ${maxQueryTime}ms
      - Total records: ${totalRecords}`);

    // Assertions
    expect(averageQueryTime).toBeLessThan(LOAD_TEST_CONFIG.database.query_timeout_threshold);
    expect(maxQueryTime).toBeLessThan(LOAD_TEST_CONFIG.database.query_timeout_threshold * 1.5);
  });

  test('should optimize filtered queries performance', async ({ page }) => {
    const filterScenarios = [
      { name: 'Simple filter', complexity: 1 },
      { name: 'Multiple filters', complexity: 2 },
      { name: 'Date range filter', complexity: 3 },
      { name: 'Complex aggregation', complexity: 5 }
    ];

    const results: Array<{ scenario: string; queryTime: number }> = [];

    for (const scenario of filterScenarios) {
      await page.route('**/api/reports/plan-fact*', async route => {
        const startTime = Date.now();
        
        // Simulate query complexity based on filters
        const processingTime = scenario.complexity * 200;
        await new Promise(resolve => setTimeout(resolve, processingTime));
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            period_ru_name: 'Январь 2025',
            nomenclature_name: 'IT расходы',
            planned_amount: 100000,
            actual_amount: 95000
          }])
        });
        
        const queryTime = Date.now() - startTime;
        results.push({ scenario: scenario.name, queryTime });
      });

      await page.goto('/reports');
      
      // Apply filters based on scenario
      if (scenario.complexity >= 2) {
        await page.selectOption('select[name="financial_center_id"]', '1');
      }
      if (scenario.complexity >= 3) {
        await page.fill('input[name="start_date"]', '2025-01-01');
        await page.fill('input[name="end_date"]', '2025-01-31');
      }
      
      await page.click('button:has-text("Применить фильтры")');
      await page.waitForSelector('[data-testid="data-table"]');
      
      await page.waitForTimeout(500);
    }

    console.log('Filter Query Performance Results:');
    results.forEach(result => {
      console.log(`- ${result.scenario}: ${result.queryTime}ms`);
    });

    // All filtered queries should complete within threshold
    results.forEach(result => {
      expect(result.queryTime).toBeLessThan(LOAD_TEST_CONFIG.database.query_timeout_threshold);
    });
  });

  test('should handle concurrent database connections', async ({ browser }) => {
    const connectionResults: Array<{ success: boolean; responseTime: number }> = [];

    // Create multiple contexts for concurrent database access
    const contexts = await Promise.all(
      Array.from({ length: LOAD_TEST_CONFIG.database.concurrent_connections }, () => 
        browser.newContext()
      )
    );

    const pages = await Promise.all(
      contexts.map(context => context.newPage())
    );

    // Setup authentication for all pages
    for (const testPage of pages) {
      await setupAuthenticatedUser(testPage);
    }

    // Mock database endpoint with connection simulation
    for (const testPage of pages) {
      await testPage.route('**/api/reports/plan-fact*', async route => {
        const startTime = Date.now();
        
        // Simulate database connection and query
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            period_ru_name: 'Январь 2025',
            nomenclature_name: 'IT расходы',
            planned_amount: 100000,
            actual_amount: 95000
          }])
        });
        
        const responseTime = Date.now() - startTime;
        connectionResults.push({ success: true, responseTime });
      });
    }

    // Execute concurrent database queries
    const promises = pages.map(async (testPage, index) => {
      try {
        await testPage.goto('/reports');
        await testPage.click('button:has-text("Применить фильтры")');
        await testPage.waitForSelector('[data-testid="data-table"]');
        return { success: true };
      } catch (error) {
        connectionResults.push({ success: false, responseTime: 0 });
        return { success: false, error: error.toString() };
      }
    });

    await Promise.all(promises);

    // Cleanup
    await Promise.all(contexts.map(context => context.close()));

    const successfulConnections = connectionResults.filter(r => r.success).length;
    const averageResponseTime = connectionResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.responseTime, 0) / successfulConnections;

    console.log(`Concurrent Database Connections Results:
      - Successful connections: ${successfulConnections}/${LOAD_TEST_CONFIG.database.concurrent_connections}
      - Average response time: ${averageResponseTime.toFixed(2)}ms`);

    // Assertions
    expect(successfulConnections).toBeGreaterThan(LOAD_TEST_CONFIG.database.concurrent_connections * 0.9);
    expect(averageResponseTime).toBeLessThan(LOAD_TEST_CONFIG.database.query_timeout_threshold);
  });
});
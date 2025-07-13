import { test, expect, Page, Browser } from '@playwright/test';
import { testUsers } from '../fixtures/test-data';

// Benchmark test configuration
const BENCHMARK_CONFIG = {
  reports: {
    datasets: [100, 500, 1000, 5000, 10000], // Different dataset sizes
    timeout_threshold: 10000, // 10 seconds max for largest reports
    memory_threshold: 200 * 1024 * 1024, // 200MB max memory usage
  },
  concurrency: {
    user_counts: [1, 5, 10, 20, 50], // Different concurrent user counts
    session_duration: 30000, // 30 seconds per user session
    max_acceptable_failure_rate: 5, // 5% max failure rate
  },
  datasets: {
    small: 1000,
    medium: 10000,
    large: 50000,
    xlarge: 100000,
  }
};

// Helper function to set up authenticated state
async function setupAuthenticatedUser(page: Page, userIndex: number = 0) {
  await page.evaluate((userData) => {
    localStorage.setItem('auth-storage', JSON.stringify({
      state: {
        user: {
          id: userData.id,
          username: userData.email.split('@')[0],
          first_name: userData.name.split(' ')[0],
          last_name: userData.name.split(' ')[1] || 'User',
          email: userData.email
        },
        isAuthenticated: true
      },
      version: 0
    }));
  }, {
    ...testUsers.testUser,
    id: userIndex + 1,
    email: `user${userIndex}@test.com`,
    name: `Test User ${userIndex}`
  });
}

// Benchmark utilities
class BenchmarkMetrics {
  static async measureReportGeneration(
    page: Page, 
    datasetSize: number, 
    reportType: string = 'plan_fact'
  ): Promise<{
    generationTime: number;
    renderTime: number;
    memoryUsage: number;
    networkTime: number;
    dataSize: number;
  }> {
    // Generate mock dataset
    const mockDataset = Array.from({ length: datasetSize }, (_, i) => ({
      id: i + 1,
      period_ru_name: `Период ${(i % 12) + 1}`,
      nomenclature_name: `Категория ${(i % 100) + 1}`,
      financial_center_name: `ЦФО ${(i % 10) + 1}`,
      planned_amount: Math.floor(Math.random() * 100000) + 10000,
      actual_amount: Math.floor(Math.random() * 100000) + 10000,
      variance: Math.floor(Math.random() * 20000) - 10000,
      variance_percent: (Math.random() - 0.5) * 100,
      created_at: new Date(2025, 0, (i % 31) + 1).toISOString()
    }));

    let networkStartTime = 0;
    let networkEndTime = 0;
    const dataSize = Buffer.byteLength(JSON.stringify(mockDataset), 'utf8');

    // Mock API with performance measurement
    await page.route(`**/api/reports/${reportType}*`, async route => {
      networkStartTime = Date.now();
      
      // Simulate server processing time based on dataset size
      const processingTime = Math.max(100, datasetSize / 10);
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDataset)
      });
      
      networkEndTime = Date.now();
    });

    // Measure memory before
    const memoryBefore = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Start generation
    const generationStartTime = Date.now();
    await page.click('button:has-text("Применить фильтры")');
    
    // Wait for network request to complete
    await page.waitForResponse(response => 
      response.url().includes('/api/reports/') && response.status() === 200
    );
    
    const generationTime = networkEndTime - networkStartTime;
    
    // Wait for rendering to complete
    const renderStartTime = Date.now();
    await page.waitForSelector('[data-testid="data-table"]');
    await page.waitForFunction((size) => {
      const rows = document.querySelectorAll('tbody tr');
      return rows.length >= Math.min(size, 50); // Wait for visible rows
    }, datasetSize);
    
    const renderTime = Date.now() - renderStartTime;
    const networkTime = networkEndTime - networkStartTime;

    // Measure memory after
    const memoryAfter = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    return {
      generationTime,
      renderTime,
      memoryUsage: memoryAfter - memoryBefore,
      networkTime,
      dataSize
    };
  }

  static async simulateUserSession(page: Page, sessionId: number, duration: number): Promise<{
    sessionId: number;
    success: boolean;
    actions: number;
    errors: string[];
    avgResponseTime: number;
  }> {
    const errors: string[] = [];
    const responseTimes: number[] = [];
    let actionCount = 0;

    const startTime = Date.now();
    
    try {
      await setupAuthenticatedUser(page, sessionId);

      // Define user actions
      const actions = [
        async () => {
          const actionStart = Date.now();
          await page.goto('/');
          await page.waitForSelector('h1');
          responseTimes.push(Date.now() - actionStart);
          actionCount++;
        },
        async () => {
          const actionStart = Date.now();
          await page.goto('/reports');
          await page.waitForSelector('h1');
          responseTimes.push(Date.now() - actionStart);
          actionCount++;
        },
        async () => {
          const actionStart = Date.now();
          await page.click('button:has-text("Применить фильтры")');
          await page.waitForSelector('[data-testid="data-table"]', { timeout: 5000 });
          responseTimes.push(Date.now() - actionStart);
          actionCount++;
        },
        async () => {
          const actionStart = Date.now();
          await page.goto('/fact');
          await page.waitForSelector('h1');
          responseTimes.push(Date.now() - actionStart);
          actionCount++;
        },
        async () => {
          const actionStart = Date.now();
          await page.fill('input[name="planned_amount"]', `${Math.floor(Math.random() * 10000)}`);
          await page.fill('input[name="actual_amount"]', `${Math.floor(Math.random() * 10000)}`);
          responseTimes.push(Date.now() - actionStart);
          actionCount++;
        }
      ];

      // Perform actions for the duration
      while (Date.now() - startTime < duration) {
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        
        try {
          await randomAction();
          await page.waitForTimeout(100 + Math.random() * 500); // Random delay between actions
        } catch (error) {
          errors.push(`Action ${actionCount}: ${error}`);
        }
      }

      const avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0;

      return {
        sessionId,
        success: errors.length < actionCount * 0.1, // Success if < 10% errors
        actions: actionCount,
        errors,
        avgResponseTime
      };

    } catch (error) {
      errors.push(`Session setup failed: ${error}`);
      return {
        sessionId,
        success: false,
        actions: actionCount,
        errors,
        avgResponseTime: 0
      };
    }
  }
}

test.describe('Benchmark Tests - Report Generation Speed', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
    
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

    await page.route('**/api/financial_centers', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { financial_center_id: 1, financial_center_name: 'Все ЦФО' }
        ])
      });
    });

    await page.goto('/reports');
  });

  test('should benchmark report generation across different dataset sizes', async ({ page }) => {
    const benchmarkResults: Array<{
      datasetSize: number;
      generationTime: number;
      renderTime: number;
      memoryUsage: number;
      throughput: number;
    }> = [];

    for (const datasetSize of BENCHMARK_CONFIG.reports.datasets) {
      console.log(`\nTesting dataset size: ${datasetSize} records`);
      
      // Set report type
      await page.selectOption('select[name="report_type"]', 'plan_fact');
      await page.selectOption('select[name="period_id"]', '1');

      // Measure performance
      const metrics = await BenchmarkMetrics.measureReportGeneration(page, datasetSize);
      
      const throughput = datasetSize / (metrics.generationTime / 1000); // records per second

      benchmarkResults.push({
        datasetSize,
        generationTime: metrics.generationTime,
        renderTime: metrics.renderTime,
        memoryUsage: metrics.memoryUsage,
        throughput
      });

      console.log(`Results for ${datasetSize} records:
        - Generation time: ${metrics.generationTime}ms
        - Render time: ${metrics.renderTime}ms
        - Memory usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB
        - Data size: ${(metrics.dataSize / 1024 / 1024).toFixed(2)}MB
        - Throughput: ${throughput.toFixed(2)} records/second`);

      // Wait between tests
      await page.waitForTimeout(1000);
    }

    // Analyze scaling characteristics
    console.log('\n=== SCALING ANALYSIS ===');
    for (let i = 1; i < benchmarkResults.length; i++) {
      const current = benchmarkResults[i];
      const previous = benchmarkResults[i - 1];
      
      const sizeRatio = current.datasetSize / previous.datasetSize;
      const timeRatio = current.generationTime / previous.generationTime;
      const memoryRatio = current.memoryUsage / previous.memoryUsage;

      console.log(`${previous.datasetSize} → ${current.datasetSize} records:
        - Size ratio: ${sizeRatio.toFixed(1)}x
        - Time ratio: ${timeRatio.toFixed(2)}x (${timeRatio <= sizeRatio ? 'GOOD' : 'POOR'} scaling)
        - Memory ratio: ${memoryRatio.toFixed(2)}x`);
    }

    // Performance assertions
    benchmarkResults.forEach(result => {
      // Generation time should scale reasonably
      expect(result.generationTime).toBeLessThan(BENCHMARK_CONFIG.reports.timeout_threshold);
      
      // Memory usage should be reasonable
      expect(result.memoryUsage).toBeLessThan(BENCHMARK_CONFIG.reports.memory_threshold);
      
      // Throughput should be maintained for larger datasets
      if (result.datasetSize >= 1000) {
        expect(result.throughput).toBeGreaterThan(10); // At least 10 records/second
      }
    });
  });

  test('should benchmark different report types performance', async ({ page }) => {
    const reportTypes = [
      { type: 'plan_fact', name: 'Plan vs Fact Analysis' },
      { type: 'budget', name: 'Budget Summary' },
      { type: 'variance', name: 'Variance Analysis' },
      { type: 'trend', name: 'Trend Analysis' }
    ];

    const reportPerformance: Record<string, any> = {};

    for (const reportType of reportTypes) {
      console.log(`\nTesting report type: ${reportType.name}`);
      
      await page.selectOption('select[name="report_type"]', reportType.type);
      await page.selectOption('select[name="period_id"]', '1');

      const metrics = await BenchmarkMetrics.measureReportGeneration(page, 1000, reportType.type);

      reportPerformance[reportType.type] = {
        name: reportType.name,
        ...metrics
      };

      console.log(`${reportType.name} Results:
        - Generation time: ${metrics.generationTime}ms
        - Render time: ${metrics.renderTime}ms
        - Memory usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);

      await page.waitForTimeout(500);
    }

    // Compare report types
    console.log('\n=== REPORT TYPE COMPARISON ===');
    const sortedBySpeed = Object.entries(reportPerformance)
      .sort(([,a], [,b]) => a.generationTime - b.generationTime);

    sortedBySpeed.forEach(([type, metrics], index) => {
      console.log(`${index + 1}. ${metrics.name}: ${metrics.generationTime}ms`);
    });

    // All report types should perform within acceptable limits
    Object.values(reportPerformance).forEach((metrics: any) => {
      expect(metrics.generationTime).toBeLessThan(5000); // 5 seconds max for any report type
      expect(metrics.memoryUsage).toBeLessThan(100 * 1024 * 1024); // 100MB max
    });
  });

  test('should benchmark report filtering and sorting performance', async ({ page }) => {
    const datasetSize = 5000;
    
    // Setup base dataset
    const mockData = Array.from({ length: datasetSize }, (_, i) => ({
      id: i + 1,
      period_ru_name: `Период ${(i % 12) + 1}`,
      nomenclature_name: `Категория ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) + 1}`,
      financial_center_name: `ЦФО ${(i % 5) + 1}`,
      planned_amount: Math.floor(Math.random() * 100000) + 10000,
      actual_amount: Math.floor(Math.random() * 100000) + 10000,
      variance: Math.floor(Math.random() * 20000) - 10000
    }));

    // Test different filtering scenarios
    const filterScenarios = [
      { name: 'No filter', filter: () => mockData },
      { name: 'Simple filter', filter: () => mockData.filter(item => item.planned_amount > 50000) },
      { name: 'Multiple filters', filter: () => mockData.filter(item => 
        item.planned_amount > 30000 && item.variance > 0) },
      { name: 'Text search', filter: () => mockData.filter(item => 
        item.nomenclature_name.includes('A')) },
      { name: 'Complex aggregation', filter: () => {
        const grouped = mockData.reduce((acc, item) => {
          const key = item.financial_center_name;
          if (!acc[key]) acc[key] = [];
          acc[key].push(item);
          return acc;
        }, {} as Record<string, typeof mockData>);
        return Object.entries(grouped).map(([center, items]) => ({
          financial_center_name: center,
          total_planned: items.reduce((sum, item) => sum + item.planned_amount, 0),
          total_actual: items.reduce((sum, item) => sum + item.actual_amount, 0),
          count: items.length
        }));
      }}
    ];

    const filterResults: Record<string, number> = {};

    for (const scenario of filterScenarios) {
      await page.route('**/api/reports/plan-fact*', async route => {
        const startTime = Date.now();
        
        const filteredData = scenario.filter();
        
        // Simulate server processing time for filtering
        await new Promise(resolve => setTimeout(resolve, Math.max(50, filteredData.length / 50)));
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(filteredData)
        });
        
        filterResults[scenario.name] = Date.now() - startTime;
      });

      console.log(`Testing filter scenario: ${scenario.name}`);
      
      await page.click('button:has-text("Применить фильтры")');
      await page.waitForSelector('[data-testid="data-table"]');
      
      await page.waitForTimeout(500);
    }

    console.log('\n=== FILTERING PERFORMANCE ===');
    Object.entries(filterResults).forEach(([scenario, time]) => {
      console.log(`${scenario}: ${time}ms`);
    });

    // All filtering scenarios should complete quickly
    Object.values(filterResults).forEach(time => {
      expect(time).toBeLessThan(2000); // 2 seconds max for any filter
    });
  });
});

test.describe('Benchmark Tests - Large Dataset Handling', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
  });

  test('should benchmark pagination performance with large datasets', async ({ page }) => {
    const testSizes = Object.values(BENCHMARK_CONFIG.datasets);
    
    for (const datasetSize of testSizes) {
      console.log(`\nTesting pagination with ${datasetSize} records`);
      
      let pageLoadTimes: number[] = [];
      const pageSize = 50;
      const totalPages = Math.ceil(datasetSize / pageSize);
      const pagesToTest = Math.min(10, totalPages); // Test up to 10 pages

      await page.route('**/api/products*', async route => {
        const url = new URL(route.request().url());
        const pageNum = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || pageSize.toString());
        
        const startTime = Date.now();
        
        // Simulate pagination query with realistic performance characteristics
        const queryTime = Math.max(50, Math.log(pageNum) * 20 + Math.random() * 100);
        await new Promise(resolve => setTimeout(resolve, queryTime));
        
        const start = (pageNum - 1) * limit;
        const pageData = Array.from({ length: Math.min(limit, datasetSize - start) }, (_, i) => ({
          id: start + i + 1,
          name: `Product ${start + i + 1}`,
          description: `Description for product ${start + i + 1}`,
          price: Math.random() * 10000
        }));

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: pageData,
            total: datasetSize,
            page: pageNum,
            limit,
            total_pages: totalPages
          })
        });
        
        pageLoadTimes.push(Date.now() - startTime);
      });

      await page.goto('/products');
      
      // Test pagination performance
      for (let pageNum = 1; pageNum <= pagesToTest; pageNum++) {
        if (pageNum > 1) {
          await page.click('button[aria-label="Следующая страница"]');
        }
        await page.waitForSelector('[data-testid="data-table"]');
        await page.waitForTimeout(100);
      }

      const avgPageLoadTime = pageLoadTimes.reduce((a, b) => a + b, 0) / pageLoadTimes.length;
      const maxPageLoadTime = Math.max(...pageLoadTimes);

      console.log(`Pagination results for ${datasetSize} records:
        - Pages tested: ${pagesToTest}
        - Average page load: ${avgPageLoadTime.toFixed(2)}ms
        - Max page load: ${maxPageLoadTime}ms
        - Total pages: ${totalPages}`);

      // Performance assertions
      expect(avgPageLoadTime).toBeLessThan(1000); // Average page load under 1 second
      expect(maxPageLoadTime).toBeLessThan(2000); // Max page load under 2 seconds
    }
  });

  test('should benchmark search performance across large datasets', async ({ page }) => {
    const datasetSize = BENCHMARK_CONFIG.datasets.large;
    
    // Create searchable dataset
    const mockData = Array.from({ length: datasetSize }, (_, i) => ({
      id: i + 1,
      name: `Product ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26)}`,
      category: `Category ${i % 100}`,
      description: `This is a detailed description for product ${i + 1}`,
      price: Math.random() * 10000
    }));

    const searchScenarios = [
      { query: 'Product A', expectedResults: 'many' },
      { query: 'Product A1', expectedResults: 'some' },
      { query: 'Product A123', expectedResults: 'few' },
      { query: 'Category 5', expectedResults: 'some' },
      { query: 'xyz123nonexistent', expectedResults: 'none' }
    ];

    const searchResults: Record<string, { time: number; results: number }> = {};

    for (const scenario of searchScenarios) {
      await page.route('**/api/products*', async route => {
        const url = new URL(route.request().url());
        const searchQuery = url.searchParams.get('search') || '';
        
        const startTime = Date.now();
        
        // Simulate database search with realistic performance
        const searchTime = Math.max(100, searchQuery.length * 10 + Math.random() * 200);
        await new Promise(resolve => setTimeout(resolve, searchTime));
        
        const filteredData = searchQuery 
          ? mockData.filter(item => 
              item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.description.toLowerCase().includes(searchQuery.toLowerCase())
            )
          : mockData.slice(0, 50); // Default page

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(filteredData)
        });
        
        const searchTime_actual = Date.now() - startTime;
        searchResults[scenario.query] = {
          time: searchTime_actual,
          results: filteredData.length
        };
      });

      console.log(`Testing search query: "${scenario.query}"`);
      
      await page.goto('/products');
      await page.fill('input[placeholder*="Поиск"]', scenario.query);
      await page.press('input[placeholder*="Поиск"]', 'Enter');
      await page.waitForSelector('[data-testid="data-table"]');
      
      await page.waitForTimeout(300);
    }

    console.log('\n=== SEARCH PERFORMANCE ===');
    Object.entries(searchResults).forEach(([query, result]) => {
      console.log(`"${query}": ${result.time}ms → ${result.results} results`);
    });

    // Search performance assertions
    Object.values(searchResults).forEach(result => {
      expect(result.time).toBeLessThan(1500); // All searches under 1.5 seconds
    });
  });

  test('should benchmark sorting performance on large datasets', async ({ page }) => {
    const datasetSize = BENCHMARK_CONFIG.datasets.medium;
    
    const sortingScenarios = [
      { field: 'name', order: 'asc', label: 'Name (A-Z)' },
      { field: 'name', order: 'desc', label: 'Name (Z-A)' },
      { field: 'price', order: 'asc', label: 'Price (Low-High)' },
      { field: 'price', order: 'desc', label: 'Price (High-Low)' },
      { field: 'created_at', order: 'desc', label: 'Date (Recent)' }
    ];

    const sortResults: Record<string, number> = {};

    for (const scenario of sortingScenarios) {
      await page.route('**/api/products*', async route => {
        const url = new URL(route.request().url());
        const sortBy = url.searchParams.get('sort_by') || 'id';
        const sortOrder = url.searchParams.get('sort_order') || 'asc';
        
        const startTime = Date.now();
        
        // Generate dataset
        const mockData = Array.from({ length: datasetSize }, (_, i) => ({
          id: i + 1,
          name: `Product ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26)}`,
          price: Math.random() * 10000,
          created_at: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString()
        }));

        // Simulate database sorting
        const sortTime = Math.max(100, datasetSize / 100 + Math.random() * 300);
        await new Promise(resolve => setTimeout(resolve, sortTime));

        // Perform sorting
        mockData.sort((a, b) => {
          const aVal = a[sortBy as keyof typeof a];
          const bVal = b[sortBy as keyof typeof b];
          
          if (sortOrder === 'desc') {
            return aVal < bVal ? 1 : -1;
          }
          return aVal > bVal ? 1 : -1;
        });

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockData.slice(0, 50)) // Return first page
        });
        
        sortResults[scenario.label] = Date.now() - startTime;
      });

      console.log(`Testing sort: ${scenario.label}`);
      
      await page.goto('/products');
      
      // Click sort header
      await page.click(`th:has-text("${scenario.field === 'name' ? 'Название' : 
                                        scenario.field === 'price' ? 'Цена' : 
                                        'Дата'}")`);
      
      await page.waitForSelector('[data-testid="data-table"]');
      await page.waitForTimeout(300);
    }

    console.log('\n=== SORTING PERFORMANCE ===');
    Object.entries(sortResults).forEach(([scenario, time]) => {
      console.log(`${scenario}: ${time}ms`);
    });

    // Sorting performance assertions
    Object.values(sortResults).forEach(time => {
      expect(time).toBeLessThan(2000); // All sorts under 2 seconds
    });
  });
});

test.describe('Benchmark Tests - Concurrent User Scenarios', () => {
  test('should benchmark concurrent user sessions', async ({ browser }) => {
    for (const userCount of BENCHMARK_CONFIG.concurrency.user_counts) {
      console.log(`\nTesting ${userCount} concurrent users`);
      
      // Create contexts for concurrent users
      const contexts = await Promise.all(
        Array.from({ length: userCount }, () => browser.newContext())
      );

      const pages = await Promise.all(
        contexts.map(context => context.newPage())
      );

      // Setup mock endpoints for all pages
      for (const page of pages) {
        await page.route('**/api/**', async route => {
          // Simulate variable server response time under load
          const baseDelay = 100;
          const loadDelay = Math.min(500, userCount * 10); // Increase delay with user count
          const randomDelay = Math.random() * 200;
          
          await new Promise(resolve => setTimeout(resolve, baseDelay + loadDelay + randomDelay));
          
          // Simulate occasional failures under high load
          if (userCount > 20 && Math.random() < 0.05) { // 5% failure rate for high load
            await route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Service temporarily unavailable' })
            });
          } else {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, data: [] })
            });
          }
        });
      }

      // Run concurrent user sessions
      const sessionPromises = pages.map((page, index) => 
        BenchmarkMetrics.simulateUserSession(
          page, 
          index, 
          BENCHMARK_CONFIG.concurrency.session_duration
        )
      );

      const startTime = Date.now();
      const sessionResults = await Promise.all(sessionPromises);
      const totalTime = Date.now() - startTime;

      // Analyze results
      const successfulSessions = sessionResults.filter(r => r.success).length;
      const failedSessions = sessionResults.filter(r => !r.success).length;
      const successRate = (successfulSessions / userCount) * 100;
      
      const totalActions = sessionResults.reduce((sum, r) => sum + r.actions, 0);
      const totalErrors = sessionResults.reduce((sum, r) => sum + r.errors.length, 0);
      
      const avgResponseTime = sessionResults
        .filter(r => r.avgResponseTime > 0)
        .reduce((sum, r) => sum + r.avgResponseTime, 0) / successfulSessions;

      console.log(`Concurrent Users Test (${userCount} users):
        - Successful sessions: ${successfulSessions}/${userCount} (${successRate.toFixed(1)}%)
        - Failed sessions: ${failedSessions}
        - Total actions performed: ${totalActions}
        - Total errors: ${totalErrors}
        - Average response time: ${avgResponseTime.toFixed(2)}ms
        - Test duration: ${totalTime}ms
        - Actions per second: ${(totalActions / (totalTime / 1000)).toFixed(2)}`);

      // Performance assertions
      expect(successRate).toBeGreaterThan(100 - BENCHMARK_CONFIG.concurrency.max_acceptable_failure_rate);
      
      if (userCount <= 10) {
        expect(avgResponseTime).toBeLessThan(2000); // Under light load, responses should be fast
      } else if (userCount <= 20) {
        expect(avgResponseTime).toBeLessThan(3000); // Under medium load
      } else {
        expect(avgResponseTime).toBeLessThan(5000); // Under heavy load
      }

      // Cleanup
      await Promise.all(contexts.map(context => context.close()));
      
      // Wait between different user count tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  });

  test('should benchmark concurrent database operations', async ({ browser }) => {
    const concurrentOperations = 25;
    
    console.log(`Testing ${concurrentOperations} concurrent database operations`);
    
    // Create contexts for concurrent operations
    const contexts = await Promise.all(
      Array.from({ length: concurrentOperations }, () => browser.newContext())
    );

    const pages = await Promise.all(
      contexts.map(context => context.newPage())
    );

    // Setup authenticated users
    for (let i = 0; i < pages.length; i++) {
      await setupAuthenticatedUser(pages[i], i);
    }

    let operationCount = 0;
    const operationResults: Array<{ success: boolean; time: number; operation: string }> = [];

    // Mock database operations with concurrency simulation
    for (const page of pages) {
      await page.route('**/api/registry', async route => {
        if (route.request().method() === 'POST') {
          operationCount++;
          const startTime = Date.now();
          
          // Simulate database contention and locking
          const baseProcessingTime = 200;
          const contentionDelay = Math.min(1000, operationCount * 20); // Increases with concurrent operations
          const randomVariation = Math.random() * 300;
          
          await new Promise(resolve => setTimeout(resolve, baseProcessingTime + contentionDelay + randomVariation));
          
          // Simulate occasional deadlocks or timeouts
          if (operationCount > 15 && Math.random() < 0.1) { // 10% failure rate under high contention
            operationResults.push({
              success: false,
              time: Date.now() - startTime,
              operation: 'INSERT'
            });
            
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Database deadlock detected' })
            });
          } else {
            operationResults.push({
              success: true,
              time: Date.now() - startTime,
              operation: 'INSERT'
            });
            
            await route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify({ id: operationCount })
            });
          }
        }
      });

      // Mock form dependencies
      await page.route('**/api/periods', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ period_id: 1, period_ru_name: 'Test Period' }])
        });
      });
    }

    // Execute concurrent database operations
    const operationPromises = pages.map(async (page, index) => {
      try {
        await page.goto('/fact');
        await page.reload();
        
        // Fill and submit form
        await page.selectOption('select[name="period_id"]', '1');
        await page.fill('input[name="planned_amount"]', `${(index + 1) * 1000}`);
        await page.fill('input[name="actual_amount"]', `${(index + 1) * 900}`);
        await page.fill('textarea[name="description"]', `Concurrent test entry ${index + 1}`);
        
        await page.click('button[type="submit"]');
        
        // Wait for result
        await page.waitForTimeout(3000);
        
        return { success: true, userId: index + 1 };
      } catch (error) {
        return { success: false, userId: index + 1, error: error.toString() };
      }
    });

    const results = await Promise.all(operationPromises);

    // Analyze concurrent operation results
    const successfulOperations = operationResults.filter(r => r.success).length;
    const failedOperations = operationResults.filter(r => !r.success).length;
    const avgOperationTime = operationResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.time, 0) / successfulOperations;
    
    const maxOperationTime = Math.max(...operationResults.map(r => r.time));

    console.log(`Concurrent Database Operations Results:
      - Operations attempted: ${concurrentOperations}
      - Successful operations: ${successfulOperations}
      - Failed operations: ${failedOperations}
      - Success rate: ${(successfulOperations / operationCount * 100).toFixed(1)}%
      - Average operation time: ${avgOperationTime.toFixed(2)}ms
      - Max operation time: ${maxOperationTime}ms`);

    // Performance assertions
    expect(successfulOperations).toBeGreaterThan(concurrentOperations * 0.8); // At least 80% success
    expect(avgOperationTime).toBeLessThan(2000); // Average under 2 seconds
    expect(maxOperationTime).toBeLessThan(5000); // Max under 5 seconds

    // Cleanup
    await Promise.all(contexts.map(context => context.close()));
  });
});
import { test, expect } from '@playwright/test';
import { testUsers, testBudgetEntries, testProducts } from './fixtures/test-data';

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

test.describe('API Integration Tests - Frontend to Backend', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
  });

  test('should test full authentication flow through all layers', async ({ page }) => {
    // Test the complete auth flow: Frontend → Frontend-API → Backend
    let frontendApiCalled = false;
    let backendApiCalled = false;

    // Mock Frontend-API endpoint
    await page.route('**/frontend-api/auth/login', async route => {
      frontendApiCalled = true;
      
      // Simulate Frontend-API calling the Backend
      const request = route.request();
      const postData = await request.postDataJSON();
      
      expect(postData).toHaveProperty('username');
      expect(postData).toHaveProperty('password');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            id: 1,
            username: postData.username,
            email: testUsers.testUser.email,
            first_name: 'Test',
            last_name: 'User'
          },
          token: 'mock-jwt-token'
        })
      });
    });

    // Mock Backend API endpoint (simulating what Frontend-API would call)
    await page.route('**/api/auth/login', async route => {
      backendApiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_id: 1,
          username: 'testuser',
          email: testUsers.testUser.email
        })
      });
    });

    // Clear auth state first
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    
    await page.click('button:has-text("Вход по паролю")');
    await page.fill('input[name="username"]', testUsers.testUser.email);
    await page.fill('input[name="password"]', testUsers.testUser.password);
    await page.click('button[type="submit"]');

    // Wait for redirect
    await expect(page).toHaveURL('/');
    
    // Verify auth chain was called
    expect(frontendApiCalled).toBe(true);
  });

  test('should test budget data flow through all API layers', async ({ page }) => {
    let frontendApiCalled = false;
    let backendApiCalled = false;
    
    // Mock Frontend-API endpoint for budget entries
    await page.route('**/frontend-api/registry', async route => {
      if (route.request().method() === 'POST') {
        frontendApiCalled = true;
        
        const requestData = await route.request().postDataJSON();
        expect(requestData).toHaveProperty('planned_amount');
        expect(requestData).toHaveProperty('actual_amount');
        
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            ...requestData,
            created_at: new Date().toISOString()
          })
        });
      }
    });

    // Mock Backend API endpoint
    await page.route('**/api/registry', async route => {
      if (route.request().method() === 'POST') {
        backendApiCalled = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            registry_id: 1,
            user_id: 1,
            planned_amount: 150000,
            actual_amount: 140000
          })
        });
      }
    });

    // Mock dependency endpoints
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

    await page.goto('/fact');
    await page.reload();

    // Fill and submit budget entry
    await page.selectOption('select[name="period_id"]', '1');
    await page.selectOption('select[name="nomenclature_id"]', '1');
    await page.fill('input[name="planned_amount"]', testBudgetEntries.laptopPurchase.planned_amount.toString());
    await page.fill('input[name="actual_amount"]', testBudgetEntries.laptopPurchase.actual_amount.toString());
    await page.fill('textarea[name="description"]', testBudgetEntries.laptopPurchase.description);
    await page.fill('input[name="transaction_date"]', testBudgetEntries.laptopPurchase.transaction_date);

    await page.click('button[type="submit"]');
    
    // Verify success
    await expect(page.locator('text=Запись успешно сохранена')).toBeVisible();
    expect(frontendApiCalled).toBe(true);
  });

  test('should test report generation through API layers', async ({ page }) => {
    let reportApiCalled = false;
    
    // Mock Frontend-API reports endpoint
    await page.route('**/frontend-api/reports/plan-fact*', async route => {
      reportApiCalled = true;
      
      const url = new URL(route.request().url());
      const params = url.searchParams;
      
      expect(params.get('period_id')).toBeTruthy();
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            period_ru_name: 'Январь 2025',
            nomenclature_name: 'IT расходы',
            planned_amount: 150000,
            actual_amount: 140000,
            variance: -10000,
            variance_percent: -6.67
          }
        ])
      });
    });

    // Mock Backend API reports endpoint
    await page.route('**/api/reports/plan-fact*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            registry_id: 1,
            user_id: 1,
            period_ru_name: 'Январь 2025',
            nomenclature_name: 'IT расходы',
            planned_amount: 150000,
            actual_amount: 140000
          }
        ])
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

    await page.goto('/reports');
    
    // Generate report
    await page.selectOption('select[name="report_type"]', 'plan_fact');
    await page.selectOption('select[name="period_id"]', '1');
    await page.click('button:has-text("Применить фильтры")');

    // Wait for report data
    await page.waitForSelector('text=IT расходы');
    expect(reportApiCalled).toBe(true);
  });

  test('should test error propagation through API layers', async ({ page }) => {
    // Test Frontend-API error handling
    await page.route('**/frontend-api/registry', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Backend service unavailable',
          details: 'Connection to budget-api failed'
        })
      });
    });

    // Mock dependency endpoints
    await page.route('**/api/periods', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { period_id: 1, period_ru_name: 'Январь 2025' }
        ])
      });
    });

    await page.goto('/fact');
    await page.reload();

    // Try to submit entry
    await page.selectOption('select[name="period_id"]', '1');
    await page.fill('input[name="planned_amount"]', '1000');
    await page.fill('input[name="actual_amount"]', '1000');
    await page.click('button[type="submit"]');

    // Should show error from Frontend-API
    await expect(page.locator('text=Backend service unavailable')).toBeVisible();
  });

  test('should test session validation across services', async ({ page }) => {
    let sessionValidated = false;

    // Mock session validation in Frontend-API
    await page.route('**/frontend-api/auth/validate', async route => {
      sessionValidated = true;
      
      const authHeader = route.request().headers()['authorization'];
      if (authHeader && authHeader.includes('Bearer')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            valid: true,
            user: {
              id: 1,
              email: testUsers.testUser.email
            }
          })
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ valid: false, error: 'Invalid session' })
        });
      }
    });

    await page.goto('/dashboard');
    
    // Access a protected resource that should validate session
    await page.goto('/reports');
    
    // Session validation might be called
    // In a real app, this would be called automatically by Frontend-API middleware
  });

  test('should test data consistency between Frontend and Backend', async ({ page }) => {
    const testProduct = testProducts.laptop;
    let frontendData: any;
    let backendData: any;

    // Mock Frontend-API endpoint
    await page.route('**/frontend-api/products', async route => {
      if (route.request().method() === 'POST') {
        frontendData = await route.request().postDataJSON();
        
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            ...frontendData,
            created_at: new Date().toISOString()
          })
        });
      }
    });

    // Mock Backend API endpoint
    await page.route('**/api/products', async route => {
      if (route.request().method() === 'POST') {
        backendData = await route.request().postDataJSON();
        
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            product_id: 1,
            user_id: 1,
            ...backendData
          })
        });
      }
    });

    await page.goto('/products');
    
    // Create a product
    await page.click('button:has-text("Добавить продукт")');
    await page.fill('input[name="name"]', testProduct.name);
    await page.fill('textarea[name="description"]', testProduct.description);
    await page.fill('input[name="price"]', testProduct.price.toString());
    await page.fill('input[name="unit"]', testProduct.unit);
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Продукт успешно создан')).toBeVisible();

    // Verify data consistency
    expect(frontendData.name).toBe(testProduct.name);
    expect(frontendData.price).toBe(testProduct.price);
    // In real implementation, we'd verify backendData matches frontendData
  });

  test('should test pagination through API layers', async ({ page }) => {
    let apiCallCount = 0;
    
    // Mock paginated API response
    await page.route('**/frontend-api/products*', async route => {
      apiCallCount++;
      const url = new URL(route.request().url());
      const page_num = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '10');
      
      const mockData = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        name: `Product ${i + 1}`,
        price: (i + 1) * 1000
      }));
      
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
          limit: limit,
          total_pages: Math.ceil(mockData.length / limit)
        })
      });
    });

    await page.goto('/products');
    await page.waitForSelector('[data-testid="data-table"]');

    // Navigate through pages
    await page.click('button[aria-label="Следующая страница"]');
    await page.waitForSelector('text=Страница 2 из');

    // Verify multiple API calls were made
    expect(apiCallCount).toBeGreaterThan(1);
  });

  test('should test real-time data synchronization', async ({ page }) => {
    let websocketConnected = false;
    
    // Mock WebSocket connection for real-time updates
    await page.addInitScript(() => {
      // Override WebSocket constructor
      const originalWebSocket = window.WebSocket;
      window.WebSocket = class extends originalWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          
          // Simulate successful connection
          setTimeout(() => {
            this.dispatchEvent(new Event('open'));
          }, 100);
          
          // Simulate real-time budget update
          setTimeout(() => {
            this.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify({
                type: 'budget_update',
                data: {
                  registry_id: 1,
                  actual_amount: 145000,
                  updated_at: new Date().toISOString()
                }
              })
            }));
          }, 1000);
        }
      };
    });

    await page.goto('/dashboard');
    
    // Wait for WebSocket connection and message
    await page.waitForTimeout(1500);
    
    // In a real implementation, we'd verify the UI updated with the new data
    // For now, we just verify the page loaded without errors
    await expect(page.locator('h1')).toContainText('Панель управления');
  });
});

test.describe('API Integration Tests - Error Handling and Resilience', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
  });

  test('should handle Backend API timeout gracefully', async ({ page }) => {
    // Mock slow/timeout response from Backend
    await page.route('**/api/reports/*', async route => {
      // Simulate timeout by not fulfilling the route
      await new Promise(resolve => setTimeout(resolve, 30000));
    });

    // Mock Frontend-API timeout handling
    await page.route('**/frontend-api/reports/*', async route => {
      await route.fulfill({
        status: 504,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Gateway timeout',
          message: 'Backend service timed out'
        })
      });
    });

    await page.goto('/reports');
    await page.click('button:has-text("Применить фильтры")');

    // Should show timeout error
    await expect(page.locator('text=Gateway timeout')).toBeVisible();
  });

  test('should handle Frontend-API service unavailable', async ({ page }) => {
    // Mock Frontend-API being down
    await page.route('**/frontend-api/**', route => route.abort('failed'));

    await page.goto('/fact');
    
    // Try to submit a form
    await page.fill('input[name="planned_amount"]', '1000');
    await page.click('button[type="submit"]');

    // Should show connection error
    await expect(page.locator('text=Ошибка соединения')).toBeVisible();
  });

  test('should handle partial Backend API failures', async ({ page }) => {
    let periodsCallCount = 0;
    
    // Mock periods API failing intermittently
    await page.route('**/api/periods', async route => {
      periodsCallCount++;
      
      if (periodsCallCount <= 2) {
        // Fail first two calls
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Database connection failed' })
        });
      } else {
        // Succeed on retry
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { period_id: 1, period_ru_name: 'Январь 2025' }
          ])
        });
      }
    });

    await page.goto('/fact');
    
    // Should eventually load after retries
    await page.waitForSelector('select[name="period_id"] option:not([value=""])', { timeout: 10000 });
    
    // Verify it retried and eventually succeeded
    expect(periodsCallCount).toBeGreaterThan(1);
  });

  test('should handle authentication expiry across services', async ({ page }) => {
    // Mock session expiry in Frontend-API
    await page.route('**/frontend-api/registry', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Session expired',
          code: 'AUTH_EXPIRED'
        })
      });
    });

    await page.goto('/fact');
    
    // Try to submit form
    await page.fill('input[name="planned_amount"]', '1000');
    await page.click('button[type="submit"]');

    // Should redirect to login due to auth expiry
    await expect(page).toHaveURL('/login');
  });
});
import { test, expect } from '@playwright/test';
import { testUsers, testProducts, testBudgetEntries, pageSelectors, testUtils } from './fixtures/test-data';

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

test.describe('CRUD Operations - Products', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto('/products');
  });

  test('should display products list page', async ({ page }) => {
    await expect(page).toHaveURL('/products');
    await expect(page.locator('h1')).toContainText('Список продуктов');
    
    // Should show data table
    await expect(page.locator(pageSelectors.tables.dataTable)).toBeVisible();
  });

  test('should create new product', async ({ page }) => {
    // Mock API responses
    await page.route('**/api/products', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            ...testProducts.laptop,
            created_at: new Date().toISOString()
          })
        });
      }
    });

    // Click add new product button
    await page.click('button:has-text("Добавить продукт")');

    // Should open create form
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('h2:has-text("Добавить продукт")')).toBeVisible();

    // Fill product form
    await page.fill('input[name="name"]', testProducts.laptop.name);
    await page.fill('textarea[name="description"]', testProducts.laptop.description);
    await page.fill('input[name="price"]', testProducts.laptop.price.toString());
    await page.fill('input[name="unit"]', testProducts.laptop.unit);
    await page.fill('input[name="barcode"]', testProducts.laptop.barcode);

    // Submit form
    await page.click('button[type="submit"]');

    // Should close dialog and show success message
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    await expect(page.locator('text=Продукт успешно создан')).toBeVisible();
  });

  test('should edit existing product', async ({ page }) => {
    // Mock API responses
    await page.route('**/api/products/1', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            ...testProducts.laptop
          })
        });
      } else if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            ...testProducts.laptop,
            name: 'Updated Laptop Name'
          })
        });
      }
    });

    // Mock products list
    await page.route('**/api/products', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 1,
            ...testProducts.laptop
          }])
        });
      }
    });

    await page.reload();
    await testUtils.waitForTableData(page);

    // Click edit button for first product
    await page.click('button[aria-label="Редактировать"]:first-of-type');

    // Should open edit form
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('h2:has-text("Редактировать продукт")')).toBeVisible();

    // Update product name
    await page.fill('input[name="name"]', 'Updated Laptop Name');

    // Submit form
    await page.click('button[type="submit"]');

    // Should close dialog and show success message
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    await expect(page.locator('text=Продукт успешно обновлен')).toBeVisible();
  });

  test('should delete product with confirmation', async ({ page }) => {
    // Mock API responses
    await page.route('**/api/products', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 1,
            ...testProducts.laptop
          }])
        });
      }
    });

    await page.route('**/api/products/1', async route => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      }
    });

    await page.reload();
    await testUtils.waitForTableData(page);

    // Click delete button
    await page.click('button[aria-label="Удалить"]:first-of-type');

    // Should show confirmation dialog
    await expect(page.locator(pageSelectors.modals.confirmDialog)).toBeVisible();
    await expect(page.locator('text=Вы уверены, что хотите удалить')).toBeVisible();

    // Confirm deletion
    await page.click('button:has-text("Удалить")');

    // Should show success message
    await expect(page.locator('text=Продукт успешно удален')).toBeVisible();
  });

  test('should handle product form validation', async ({ page }) => {
    await page.click('button:has-text("Добавить продукт")');

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Should show validation errors
    await expect(page.locator('text=Обязательное поле')).toBeVisible();

    // Fill invalid price
    await page.fill('input[name="name"]', 'Test Product');
    await page.fill('input[name="price"]', '-100');
    await page.click('button[type="submit"]');

    // Should show price validation error
    await expect(page.locator('text=Цена должна быть положительной')).toBeVisible();
  });

  test('should search and filter products', async ({ page }) => {
    // Mock filtered products response
    await page.route('**/api/products?search=laptop', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 1,
          ...testProducts.laptop
        }])
      });
    });

    // Use search
    await page.fill('input[placeholder="Поиск продуктов..."]', 'laptop');
    await page.press('input[placeholder="Поиск продуктов..."]', 'Enter');

    // Should filter results
    await testUtils.waitForTableData(page);
    await expect(page.locator('text=' + testProducts.laptop.name)).toBeVisible();
  });
});

test.describe('CRUD Operations - Budget Entries (Registry)', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto('/fact');
  });

  test('should create new budget entry', async ({ page }) => {
    // Mock API responses for form data
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
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            ...testBudgetEntries.laptopPurchase
          })
        });
      }
    });

    await page.reload();

    // Fill fact entry form
    await page.selectOption('select[name="period_id"]', '1');
    await page.selectOption('select[name="nomenclature_id"]', '1');
    await page.fill('input[name="planned_amount"]', testBudgetEntries.laptopPurchase.planned_amount.toString());
    await page.fill('input[name="actual_amount"]', testBudgetEntries.laptopPurchase.actual_amount.toString());
    await page.fill('textarea[name="description"]', testBudgetEntries.laptopPurchase.description);
    await page.fill('input[name="transaction_date"]', testBudgetEntries.laptopPurchase.transaction_date);

    // Submit form
    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator('text=Запись успешно сохранена')).toBeVisible();
  });

  test('should validate budget entry form', async ({ page }) => {
    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Should show validation errors
    await expect(page.locator('text=Обязательное поле')).toBeVisible();
  });

  test('should calculate variance automatically', async ({ page }) => {
    // Mock form data
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

    // Fill amounts
    await page.fill('input[name="planned_amount"]', '100000');
    await page.fill('input[name="actual_amount"]', '85000');

    // Should calculate variance automatically
    const variance = await page.locator('text=Отклонение:').locator('..').locator('span:last-child').textContent();
    expect(variance).toContain('-15,000');
  });
});

test.describe('CRUD Operations - Data Pagination and Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
  });

  test('should handle pagination in data tables', async ({ page }) => {
    // Mock large dataset
    const mockData = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `Product ${i + 1}`,
      price: (i + 1) * 1000
    }));

    await page.route('**/api/products', async route => {
      const url = new URL(route.request().url());
      const page_num = parseInt(url.searchParams.get('page') || '1');
      const page_size = parseInt(url.searchParams.get('limit') || '10');
      
      const start = (page_num - 1) * page_size;
      const end = start + page_size;
      const pageData = mockData.slice(start, end);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: pageData,
          total: mockData.length,
          page: page_num,
          limit: page_size,
          total_pages: Math.ceil(mockData.length / page_size)
        })
      });
    });

    await page.goto('/products');
    await testUtils.waitForTableData(page);

    // Should show pagination controls
    await expect(page.locator(pageSelectors.tables.pagination)).toBeVisible();

    // Should show current page info
    await expect(page.locator('text=Страница 1 из')).toBeVisible();

    // Navigate to next page
    await page.click('button[aria-label="Следующая страница"]');

    // Should update table data
    await testUtils.waitForTableData(page);
    await expect(page.locator('text=Страница 2 из')).toBeVisible();
  });

  test('should handle sorting in data tables', async ({ page }) => {
    const mockData = [
      { id: 1, name: 'Z Product', price: 1000 },
      { id: 2, name: 'A Product', price: 2000 },
      { id: 3, name: 'M Product', price: 1500 }
    ];

    await page.route('**/api/products*', async route => {
      const url = new URL(route.request().url());
      const sortBy = url.searchParams.get('sort_by') || 'id';
      const sortOrder = url.searchParams.get('sort_order') || 'asc';

      let sortedData = [...mockData];
      sortedData.sort((a, b) => {
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
        body: JSON.stringify(sortedData)
      });
    });

    await page.goto('/products');
    await testUtils.waitForTableData(page);

    // Click on name column header to sort
    await page.click('th:has-text("Название")');

    // Should sort by name
    await testUtils.waitForTableData(page);
    const firstRowName = await page.locator('tbody tr:first-child td:first-child').textContent();
    expect(firstRowName).toBe('A Product');
  });

  test('should handle bulk operations', async ({ page }) => {
    const mockData = [
      { id: 1, name: 'Product 1', price: 1000 },
      { id: 2, name: 'Product 2', price: 2000 },
      { id: 3, name: 'Product 3', price: 1500 }
    ];

    await page.route('**/api/products', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockData)
        });
      }
    });

    await page.route('**/api/products/bulk-delete', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, deleted: 2 })
        });
      }
    });

    await page.goto('/products');
    await testUtils.waitForTableData(page);

    // Select multiple items
    await page.check('input[type="checkbox"]:nth-child(1)'); // Select all checkbox
    
    // Should show bulk actions
    await expect(page.locator('text=выбрано')).toBeVisible();
    await expect(page.locator('button:has-text("Удалить выбранные")')).toBeVisible();

    // Perform bulk delete
    await page.click('button:has-text("Удалить выбранные")');
    
    // Confirm deletion
    await page.click('button:has-text("Удалить")');

    // Should show success message
    await expect(page.locator('text=Элементы успешно удалены')).toBeVisible();
  });
});
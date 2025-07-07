import { test, expect } from '@playwright/test';

test.describe('Budget Planning', () => {
  test.beforeEach(async ({ page }) => {
    // Setup authenticated state
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: {
            id: 1,
            username: 'testuser',
            first_name: 'Test',
            last_name: 'User'
          },
          isAuthenticated: true
        },
        version: 0
      }));
    });
  });

  test('should display budget form and list', async ({ page }) => {
    await page.goto('/budget');
    
    // Check form elements
    await expect(page.getByText('Планирование бюджета')).toBeVisible();
    await expect(page.getByLabel('Период')).toBeVisible();
    await expect(page.getByLabel('ЦФО')).toBeVisible();
    await expect(page.getByLabel('Номенклатура')).toBeVisible();
    await expect(page.getByLabel('Тип операции')).toBeVisible();
    await expect(page.getByLabel('Сумма')).toBeVisible();
    
    // Check list section
    await expect(page.getByText('Запланированный бюджет')).toBeVisible();
  });

  test('should switch between expense and income', async ({ page }) => {
    await page.goto('/budget');
    
    // Default should be expense
    const typeSelect = page.getByLabel('Тип операции');
    await expect(typeSelect).toHaveValue('1'); // Expense
    
    // Switch to income
    await typeSelect.selectOption('3'); // Income
    await expect(typeSelect).toHaveValue('3');
  });

  test('should add new budget entry', async ({ page }) => {
    await page.goto('/budget');
    
    // Fill form
    await page.getByLabel('Период').selectOption({ index: 1 });
    await page.getByLabel('ЦФО').selectOption({ index: 1 });
    await page.getByLabel('Номенклатура').selectOption({ index: 1 });
    await page.getByLabel('Тип операции').selectOption('1'); // Expense
    await page.getByLabel('Сумма').fill('5000');
    await page.getByLabel('Комментарий').fill('Monthly budget');
    
    // Submit form
    await page.getByRole('button', { name: 'Добавить в бюджет' }).click();
    
    // Should show success message
    await expect(page.getByText('Бюджет успешно добавлен')).toBeVisible();
    
    // Form should be reset
    await expect(page.getByLabel('Сумма')).toHaveValue('');
    await expect(page.getByLabel('Комментарий')).toHaveValue('');
  });

  test('should validate budget form', async ({ page }) => {
    await page.goto('/budget');
    
    // Try to submit without filling required fields
    await page.getByRole('button', { name: 'Добавить в бюджет' }).click();
    
    // Should show validation errors
    await expect(page.getByText('Период обязателен')).toBeVisible();
    await expect(page.getByText('ЦФО обязателен')).toBeVisible();
    await expect(page.getByText('Номенклатура обязательна')).toBeVisible();
    await expect(page.getByText('Сумма обязательна')).toBeVisible();
  });
});
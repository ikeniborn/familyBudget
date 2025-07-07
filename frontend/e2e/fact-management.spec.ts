import { test, expect } from '@playwright/test';

test.describe('Fact Management', () => {
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

  test('should display fact form and list', async ({ page }) => {
    await page.goto('/fact');
    
    // Check form elements
    await expect(page.getByText('Добавление фактических расходов')).toBeVisible();
    await expect(page.getByLabel('Дата операции')).toBeVisible();
    await expect(page.getByLabel('Период')).toBeVisible();
    await expect(page.getByLabel('ЦФО')).toBeVisible();
    await expect(page.getByLabel('Номенклатура')).toBeVisible();
    await expect(page.getByLabel('Сумма')).toBeVisible();
    
    // Check list section
    await expect(page.getByText('Последние записи')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/fact');
    
    // Try to submit without filling required fields
    await page.getByRole('button', { name: 'Добавить запись' }).click();
    
    // Should show validation errors
    await expect(page.getByText('Период обязателен')).toBeVisible();
    await expect(page.getByText('ЦФО обязателен')).toBeVisible();
    await expect(page.getByText('Номенклатура обязательна')).toBeVisible();
    await expect(page.getByText('Сумма обязательна')).toBeVisible();
  });

  test('should toggle MVZ field visibility', async ({ page }) => {
    await page.goto('/fact');
    
    // MVZ should not be visible initially
    await expect(page.getByLabel('МВЗ')).not.toBeVisible();
    
    // Toggle MVZ
    await page.getByText('Использовать МВЗ').click();
    
    // MVZ should now be visible
    await expect(page.getByLabel('МВЗ')).toBeVisible();
  });

  test('should add new fact entry', async ({ page }) => {
    await page.goto('/fact');
    
    // Fill form
    await page.getByLabel('Дата операции').fill('2025-01-07');
    await page.getByLabel('Период').selectOption({ index: 1 });
    await page.getByLabel('ЦФО').selectOption({ index: 1 });
    await page.getByLabel('Номенклатура').selectOption({ index: 1 });
    await page.getByLabel('Сумма').fill('1500');
    await page.getByLabel('Комментарий').fill('Test expense');
    
    // Submit form
    await page.getByRole('button', { name: 'Добавить запись' }).click();
    
    // Should show success message
    await expect(page.getByText('Запись успешно добавлена')).toBeVisible();
    
    // Form should be reset
    await expect(page.getByLabel('Сумма')).toHaveValue('');
    await expect(page.getByLabel('Комментарий')).toHaveValue('');
  });
});
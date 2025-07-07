import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display login page when not authenticated', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    
    // Should show Telegram login button
    await expect(page.getByText('Вход в систему')).toBeVisible();
    await expect(page.getByText('Войдите через Telegram')).toBeVisible();
  });

  test('should navigate to dashboard after successful login', async ({ page }) => {
    // Mock authenticated state
    await page.goto('/login');
    
    // Since Telegram auth requires real authentication, we'll mock it
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
    
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Test User')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
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
    
    await page.goto('/');
    
    // Click logout button
    await page.getByRole('button', { name: 'Выйти' }).click();
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    
    // Check localStorage is cleared
    const authStorage = await page.evaluate(() => localStorage.getItem('auth-storage'));
    const authData = JSON.parse(authStorage || '{}');
    expect(authData.state?.isAuthenticated).toBeFalsy();
  });
});
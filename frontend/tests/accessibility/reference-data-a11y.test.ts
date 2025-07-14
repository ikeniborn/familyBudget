import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y, configureAxe } from 'axe-playwright';

test.describe('Reference Data Accessibility Tests', () => {
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
    
    // Inject axe-core
    await injectAxe(page);
    
    // Configure axe to check WCAG 2.1 AA
    await configureAxe(page, {
      rules: {
        'color-contrast': { enabled: true },
        'html-has-lang': { enabled: true },
        'landmark-one-main': { enabled: true },
        'page-has-heading-one': { enabled: true }
      }
    });
  });

  test.describe('General Accessibility', () => {
    test('should have no accessibility violations on main page', async ({ page }) => {
      await checkA11y(page, null, {
        detailedReport: true,
        detailedReportOptions: {
          html: true
        }
      });
    });

    test('should have proper page structure', async ({ page }) => {
      // Check for main landmark
      const main = await page.locator('main');
      await expect(main).toBeVisible();
      
      // Check for proper heading hierarchy
      const h1 = await page.locator('h1');
      await expect(h1).toBeVisible();
      await expect(h1).toContainText(/Справочники|Настройки/);
      
      // Check for navigation
      const nav = await page.locator('nav, [role="navigation"]');
      await expect(nav).toBeVisible();
    });

    test('should have proper language declaration', async ({ page }) => {
      const html = await page.locator('html');
      const lang = await html.getAttribute('lang');
      expect(lang).toBe('ru');
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate tabs with keyboard', async ({ page }) => {
      // Focus on tab list
      await page.keyboard.press('Tab');
      
      // Navigate through tabs
      const tabs = ['Периоды', 'Финансовые центры', 'Центры затрат', 'Номенклатуры', 'Продукты'];
      
      for (const tabName of tabs) {
        // Check if tab is focusable
        const focusedElement = await page.evaluate(() => document.activeElement?.textContent);
        expect(focusedElement).toContain(tabName);
        
        // Navigate to next tab
        await page.keyboard.press('ArrowRight');
      }
      
      // Test tab activation with Enter
      await page.keyboard.press('ArrowLeft'); // Go back to Products
      await page.keyboard.press('Enter');
      
      // Verify panel changed
      await expect(page.locator('[role="tabpanel"][aria-labelledby*="products"]')).toBeVisible();
    });

    test('should navigate table with keyboard', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      await page.waitForSelector('table');
      
      // Focus on table
      await page.focus('table');
      
      // Navigate rows with arrow keys
      await page.keyboard.press('ArrowDown');
      let focusedRow = await page.evaluate(() => {
        const focused = document.activeElement;
        return focused?.closest('tr')?.getAttribute('aria-rowindex');
      });
      expect(focusedRow).toBe('2');
      
      // Select with space
      await page.keyboard.press('Space');
      const isChecked = await page.evaluate(() => {
        const row = document.activeElement?.closest('tr');
        const checkbox = row?.querySelector('input[type="checkbox"]');
        return checkbox?.checked;
      });
      expect(isChecked).toBe(true);
      
      // Open context menu
      await page.keyboard.press('ContextMenu');
      await expect(page.locator('[role="menu"]')).toBeVisible();
      
      // Navigate menu items
      await page.keyboard.press('ArrowDown');
      const focusedMenuItem = await page.evaluate(() => document.activeElement?.textContent);
      expect(focusedMenuItem).toBeTruthy();
    });

    test('should handle form navigation', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      await page.click('button:has-text("Добавить период")');
      
      // Check dialog focus trap
      const dialogHasFocus = await page.evaluate(() => {
        const dialog = document.querySelector('dialog');
        return dialog?.contains(document.activeElement);
      });
      expect(dialogHasFocus).toBe(true);
      
      // Tab through form fields
      const formFields = [
        'input[name="period_name"]',
        'input[name="period_year"]',
        'input[name="period_month"]',
        'button:has-text("Сохранить")',
        'button:has-text("Отмена")'
      ];
      
      for (const field of formFields) {
        await page.keyboard.press('Tab');
        const focusedField = await page.evaluate(() => document.activeElement?.matches);
        await expect(page.locator(field)).toBeFocused();
      }
      
      // Test Escape closes dialog
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog')).not.toBeVisible();
    });

    test('should support keyboard shortcuts', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      
      // Test Ctrl+N for new
      await page.keyboard.press('Control+n');
      await expect(page.locator('dialog:has-text("Новый период")')).toBeVisible();
      await page.keyboard.press('Escape');
      
      // Test Ctrl+F for search
      await page.keyboard.press('Control+f');
      await expect(page.locator('input[placeholder="Поиск..."]')).toBeFocused();
      
      // Test F5 for refresh
      const refreshPromise = page.waitForRequest(/api\/periods/);
      await page.keyboard.press('F5');
      await refreshPromise;
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      
      // Check table accessibility
      const table = await page.locator('table');
      await expect(table).toHaveAttribute('role', 'table');
      await expect(table).toHaveAttribute('aria-label', /Таблица периодов/);
      
      // Check buttons have labels
      const addButton = await page.locator('button:has-text("Добавить период")');
      await expect(addButton).toHaveAttribute('aria-label', 'Добавить новый период');
      
      // Check form inputs have labels
      await addButton.click();
      const nameInput = await page.locator('input[name="period_name"]');
      const nameLabel = await page.locator('label[for="period_name"]');
      await expect(nameLabel).toBeVisible();
      await expect(nameLabel).toHaveText(/Название периода/);
    });

    test('should announce dynamic content changes', async ({ page }) => {
      // Check for live regions
      const liveRegions = await page.locator('[aria-live]');
      await expect(liveRegions).toHaveCount(2); // Status and notifications
      
      // Test notification announcement
      await page.click('button:has-text("Периоды")');
      await page.click('button:has-text("Добавить период")');
      await page.fill('input[name="period_name"]', 'Test Period');
      await page.click('button:has-text("Сохранить")');
      
      // Check if success message is in live region
      const notification = await page.locator('[role="alert"]');
      await expect(notification).toBeVisible();
      await expect(notification).toHaveAttribute('aria-live', 'polite');
    });

    test('should have descriptive form errors', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      await page.click('button:has-text("Добавить период")');
      
      // Submit empty form
      await page.click('button:has-text("Сохранить")');
      
      // Check error association
      const nameInput = await page.locator('input[name="period_name"]');
      const errorId = await nameInput.getAttribute('aria-describedby');
      expect(errorId).toBeTruthy();
      
      const errorMessage = await page.locator(`#${errorId}`);
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toHaveAttribute('role', 'alert');
      
      // Check input has error state
      await expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    });

    test('should provide context for data tables', async ({ page }) => {
      await page.click('button:has-text("Финансовые центры")');
      
      // Check table headers
      const headers = await page.locator('th');
      const headerCount = await headers.count();
      
      for (let i = 0; i < headerCount; i++) {
        const header = headers.nth(i);
        const scope = await header.getAttribute('scope');
        expect(scope).toBe('col');
      }
      
      // Check sortable columns
      const sortableHeaders = await page.locator('th[aria-sort]');
      await expect(sortableHeaders).toHaveCount(0); // Initially unsorted
      
      await page.click('th:has-text("Название")');
      await expect(page.locator('th:has-text("Название")')).toHaveAttribute('aria-sort', 'ascending');
    });
  });

  test.describe('Visual Accessibility', () => {
    test('should have sufficient color contrast', async ({ page }) => {
      // Run axe color contrast check
      await checkA11y(page, null, {
        rules: {
          'color-contrast': { enabled: true }
        }
      });
    });

    test('should not rely on color alone', async ({ page }) => {
      await page.click('button:has-text("Номенклатуры")');
      
      // Check that color-coded items have additional indicators
      const incomeItems = await page.locator('tr:has-text("INCOME")');
      const firstIncome = incomeItems.first();
      
      // Should have icon in addition to color
      const icon = await firstIncome.locator('svg, .icon');
      await expect(icon).toBeVisible();
      
      // Should have text label
      const typeLabel = await firstIncome.locator('td:has-text("Доход")');
      await expect(typeLabel).toBeVisible();
    });

    test('should support high contrast mode', async ({ page }) => {
      // Enable high contrast
      await page.click('button[aria-label="Settings"]');
      await page.click('button:has-text("Высокая контрастность")');
      
      // Verify high contrast styles applied
      const bodyStyles = await page.evaluate(() => {
        const body = document.body;
        const styles = window.getComputedStyle(body);
        return {
          background: styles.backgroundColor,
          color: styles.color
        };
      });
      
      // Should have high contrast colors
      expect(bodyStyles.background).toBe('rgb(0, 0, 0)'); // Black
      expect(bodyStyles.color).toBe('rgb(255, 255, 255)'); // White
      
      // Check focus indicators are visible
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        const styles = window.getComputedStyle(el!);
        return {
          outline: styles.outline,
          outlineOffset: styles.outlineOffset
        };
      });
      
      expect(focusedElement.outline).toMatch(/solid/);
    });

    test('should handle text zoom', async ({ page }) => {
      // Zoom to 200%
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '32px'; // 200% of 16px
      });
      
      // Check layout doesn't break
      await page.click('button:has-text("Периоды")');
      
      // Text should still be readable
      const isOverflowing = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          if (el.scrollWidth > el.clientWidth) {
            return true;
          }
        }
        return false;
      });
      
      expect(isOverflowing).toBe(false);
      
      // Interactive elements should remain clickable
      const addButton = await page.locator('button:has-text("Добавить период")');
      await expect(addButton).toBeVisible();
      await addButton.click();
      await expect(page.locator('dialog')).toBeVisible();
    });
  });

  test.describe('Focus Management', () => {
    test('should have visible focus indicators', async ({ page }) => {
      // Tab through interface
      await page.keyboard.press('Tab');
      
      // Check focus is visible
      const focusVisible = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;
        const styles = window.getComputedStyle(el);
        return styles.outline !== 'none' || styles.boxShadow !== 'none';
      });
      
      expect(focusVisible).toBe(true);
    });

    test('should manage focus on dialog open/close', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      
      // Remember focused element
      const addButton = page.locator('button:has-text("Добавить период")');
      await addButton.focus();
      
      // Open dialog
      await addButton.click();
      
      // Focus should move to dialog
      const dialogHasFocus = await page.evaluate(() => {
        const dialog = document.querySelector('dialog');
        return dialog?.contains(document.activeElement);
      });
      expect(dialogHasFocus).toBe(true);
      
      // Close dialog
      await page.click('button:has-text("Отмена")');
      
      // Focus should return to trigger button
      await expect(addButton).toBeFocused();
    });

    test('should trap focus in modals', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      await page.click('button:has-text("Добавить период")');
      
      // Tab through all focusable elements
      const focusableElements = [];
      let previousElement = '';
      
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const current = await page.evaluate(() => document.activeElement?.outerHTML);
        
        if (current === previousElement) {
          // Focus wrapped around
          break;
        }
        
        focusableElements.push(current);
        previousElement = current;
      }
      
      // All focused elements should be within dialog
      const allInDialog = await page.evaluate((elements) => {
        const dialog = document.querySelector('dialog');
        return elements.every(html => {
          const temp = document.createElement('div');
          temp.innerHTML = html;
          const el = temp.firstChild;
          return dialog?.contains(el);
        });
      }, focusableElements);
      
      expect(allInDialog).toBe(true);
    });
  });

  test.describe('Error Handling Accessibility', () => {
    test('should announce errors to screen readers', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      await page.click('button:has-text("Добавить период")');
      
      // Submit invalid form
      await page.fill('input[name="period_month"]', '13'); // Invalid month
      await page.click('button:has-text("Сохранить")');
      
      // Check error announcement
      const errorRegion = await page.locator('[role="alert"]');
      await expect(errorRegion).toBeVisible();
      await expect(errorRegion).toHaveAttribute('aria-live', 'assertive');
      
      // Check field error association
      const monthInput = await page.locator('input[name="period_month"]');
      await expect(monthInput).toHaveAttribute('aria-invalid', 'true');
      
      const describedBy = await monthInput.getAttribute('aria-describedby');
      const errorText = await page.locator(`#${describedBy}`);
      await expect(errorText).toContainText('Месяц должен быть от 1 до 12');
    });
  });

  test.describe('Loading States Accessibility', () => {
    test('should announce loading states', async ({ page }) => {
      // Intercept API call to delay response
      await page.route('/api/periods*', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({ json: [] });
      });
      
      await page.click('button:has-text("Периоды")');
      
      // Check loading indicator
      const loadingIndicator = await page.locator('[role="status"]');
      await expect(loadingIndicator).toBeVisible();
      await expect(loadingIndicator).toHaveAttribute('aria-busy', 'true');
      await expect(loadingIndicator).toContainText(/Загрузка/);
      
      // Wait for loading to complete
      await page.waitForSelector('[role="status"][aria-busy="false"]', { state: 'attached' });
    });
  });

  test.describe('Mobile Accessibility', () => {
    test('should be accessible on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Check no horizontal scroll
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
      
      // Check touch targets are large enough (44x44 minimum)
      const buttons = await page.locator('button');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        const box = await button.boundingBox();
        if (box) {
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });
});
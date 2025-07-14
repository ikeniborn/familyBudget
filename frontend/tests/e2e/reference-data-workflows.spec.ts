import { test, expect } from '@playwright/test';

test.describe('Reference Data Management Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings page
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

  test.describe('Period Management', () => {
    test('should create a new period', async ({ page }) => {
      // Navigate to periods tab
      await page.click('button:has-text("Периоды")');
      
      // Click add button
      await page.click('button:has-text("Добавить период")');
      
      // Fill form
      await page.fill('input[name="period_name"]', 'Январь 2024');
      await page.fill('input[name="period_year"]', '2024');
      await page.fill('input[name="period_month"]', '1');
      
      // Submit form
      await page.click('button:has-text("Сохранить")');
      
      // Verify success message
      await expect(page.locator('.toast-success')).toContainText('Период создан');
      
      // Verify period appears in list
      await expect(page.locator('td:has-text("Январь 2024")')).toBeVisible();
    });

    test('should edit existing period', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      
      // Click edit button on first period
      await page.click('tr:first-child button[aria-label="Edit"]');
      
      // Update name
      await page.fill('input[name="period_name"]', 'Январь 2024 (обновлен)');
      
      // Save changes
      await page.click('button:has-text("Сохранить")');
      
      // Verify update
      await expect(page.locator('td:has-text("Январь 2024 (обновлен)")')).toBeVisible();
    });

    test('should validate period dates', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      await page.click('button:has-text("Добавить период")');
      
      // Enter invalid month
      await page.fill('input[name="period_month"]', '13');
      await page.click('button:has-text("Сохранить")');
      
      // Verify validation error
      await expect(page.locator('.error-message')).toContainText('Месяц должен быть от 1 до 12');
    });

    test('should handle period overlap validation', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      
      // Create first period
      await page.click('button:has-text("Добавить период")');
      await page.fill('input[name="period_name"]', 'Январь 2024');
      await page.fill('input[name="period_year"]', '2024');
      await page.fill('input[name="period_month"]', '1');
      await page.click('button:has-text("Сохранить")');
      
      // Try to create overlapping period
      await page.click('button:has-text("Добавить период")');
      await page.fill('input[name="period_name"]', 'Январь 2024 Дубликат');
      await page.fill('input[name="period_year"]', '2024');
      await page.fill('input[name="period_month"]', '1');
      await page.click('button:has-text("Сохранить")');
      
      // Verify overlap error
      await expect(page.locator('.error-message')).toContainText('Период с такими датами уже существует');
    });
  });

  test.describe('Financial Center Hierarchy', () => {
    test('should create parent and child financial centers', async ({ page }) => {
      await page.click('button:has-text("Финансовые центры")');
      
      // Create parent
      await page.click('button:has-text("Добавить ЦФО")');
      await page.fill('input[name="financial_center_name"]', 'Головной офис');
      await page.fill('textarea[name="financial_center_description"]', 'Главный финансовый центр');
      await page.click('button:has-text("Сохранить")');
      
      // Create child
      await page.click('button:has-text("Добавить ЦФО")');
      await page.fill('input[name="financial_center_name"]', 'Филиал Москва');
      await page.selectOption('select[name="parent_id"]', 'Головной офис');
      await page.click('button:has-text("Сохранить")');
      
      // Verify hierarchy display
      await expect(page.locator('.tree-item:has-text("Головной офис")')).toBeVisible();
      await expect(page.locator('.tree-item .tree-item:has-text("Филиал Москва")')).toBeVisible();
    });

    test('should prevent circular dependencies', async ({ page }) => {
      await page.click('button:has-text("Финансовые центры")');
      
      // Edit child to set parent as itself
      await page.click('tr:has-text("Филиал Москва") button[aria-label="Edit"]');
      
      // Try to select itself as parent (should not be in options)
      const parentOptions = await page.locator('select[name="parent_id"] option').allTextContents();
      expect(parentOptions).not.toContain('Филиал Москва');
    });
  });

  test.describe('Cost Center Budget Management', () => {
    test('should create cost center with budget limit', async ({ page }) => {
      await page.click('button:has-text("Центры затрат")');
      
      await page.click('button:has-text("Добавить МВЗ")');
      await page.fill('input[name="cost_center_name"]', 'Маркетинг');
      await page.selectOption('select[name="financial_center_id"]', 'Головной офис');
      await page.fill('input[name="budget_limit"]', '500000');
      await page.selectOption('select[name="budget_period"]', 'monthly');
      
      await page.click('button:has-text("Сохранить")');
      
      // Verify budget display
      await expect(page.locator('td:has-text("500,000₽/мес")')).toBeVisible();
    });

    test('should track budget usage', async ({ page }) => {
      await page.click('button:has-text("Центры затрат")');
      
      // View cost center with transactions
      await page.click('tr:has-text("Маркетинг") button[aria-label="View"]');
      
      // Verify budget usage display
      await expect(page.locator('.budget-usage')).toBeVisible();
      await expect(page.locator('.budget-percentage')).toBeVisible();
    });
  });

  test.describe('Bulk Operations', () => {
    test('should import periods from CSV', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      await page.click('button:has-text("Массовые операции")');
      
      // Switch to import tab
      await page.click('button:has-text("Импорт")');
      
      // Create CSV file
      const csvContent = 'period_name,period_year,period_month\nФевраль 2024,2024,2\nМарт 2024,2024,3';
      const buffer = Buffer.from(csvContent);
      
      // Upload file
      await page.setInputFiles('input[type="file"]', {
        name: 'periods.csv',
        mimeType: 'text/csv',
        buffer
      });
      
      // Wait for import to complete
      await expect(page.locator('.progress-complete')).toBeVisible();
      await expect(page.locator(':text("Успешно импортировано: 2")')).toBeVisible();
    });

    test('should export data to different formats', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      await page.click('button:has-text("Массовые операции")');
      
      // Switch to export tab
      await page.click('button:has-text("Экспорт")');
      
      // Select format
      await page.selectOption('select[name="format"]', 'excel');
      
      // Configure options
      await page.check('input[name="includeHeaders"]');
      await page.check('input[name="filterInactive"]');
      
      // Start download
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Экспорт")');
      const download = await downloadPromise;
      
      // Verify download
      expect(download.suggestedFilename()).toContain('periods');
      expect(download.suggestedFilename()).toContain('.xlsx');
    });

    test('should perform batch updates', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      
      // Select multiple items
      await page.check('tr:nth-child(1) input[type="checkbox"]');
      await page.check('tr:nth-child(2) input[type="checkbox"]');
      
      await page.click('button:has-text("Массовые операции")');
      await page.click('button:has-text("Групповое обновление")');
      
      // Add selected items to batch
      await page.click('button:has-text("Добавить выбранные")');
      
      // Configure update
      await page.selectOption('select[name="field"]', 'is_active');
      await page.selectOption('select[name="value"]', 'false');
      
      // Execute batch update
      await page.click('button:has-text("Выполнить групповое обновление")');
      
      await expect(page.locator(':text("Успешно обновлено: 2")')).toBeVisible();
    });
  });

  test.describe('Search and Filtering', () => {
    test('should perform full-text search', async ({ page }) => {
      await page.click('button:has-text("Номенклатуры")');
      
      // Use quick search
      await page.fill('input[placeholder="Поиск..."]', 'продукт');
      
      // Wait for search results
      await page.waitForTimeout(300); // Debounce delay
      
      // Verify filtered results
      const visibleRows = await page.locator('tbody tr:visible').count();
      expect(visibleRows).toBeGreaterThan(0);
      
      // All visible items should contain search term
      const rowTexts = await page.locator('tbody tr:visible').allTextContents();
      rowTexts.forEach(text => {
        expect(text.toLowerCase()).toContain('продукт');
      });
    });

    test('should use advanced filters', async ({ page }) => {
      await page.click('button:has-text("Номенклатуры")');
      await page.click('button:has-text("Расширенный поиск")');
      
      // Add filter
      await page.selectOption('select[name="field"]', 'nomenclature_type');
      await page.selectOption('select[name="operator"]', 'equals');
      await page.selectOption('select[name="value"]', 'EXPENSE');
      await page.click('button[aria-label="Add filter"]');
      
      // Add another filter
      await page.selectOption('select[name="field"]', 'is_active');
      await page.selectOption('select[name="operator"]', 'equals');
      await page.selectOption('select[name="value"]', 'true');
      await page.click('button[aria-label="Add filter"]');
      
      // Apply filters
      await page.click('button:has-text("Применить")');
      
      // Verify results
      await expect(page.locator('.filter-results')).toContainText('Найдено записей:');
    });

    test('should save and reuse filters', async ({ page }) => {
      await page.click('button:has-text("Номенклатуры")');
      await page.click('button:has-text("Расширенный поиск")');
      
      // Create filter
      await page.selectOption('select[name="field"]', 'nomenclature_type');
      await page.selectOption('select[name="operator"]', 'equals');
      await page.selectOption('select[name="value"]', 'INCOME');
      await page.click('button[aria-label="Add filter"]');
      
      // Save filter
      await page.click('button:has-text("Сохранить")');
      await page.fill('input[name="filterName"]', 'Только доходы');
      await page.fill('textarea[name="filterDescription"]', 'Фильтр для отображения только доходных категорий');
      await page.click('button:has-text("Сохранить фильтр")');
      
      // Close and reopen search
      await page.click('button[aria-label="Close"]');
      await page.click('button:has-text("Расширенный поиск")');
      
      // Apply saved filter
      await page.click('.saved-filter:has-text("Только доходы")');
      
      // Verify filter is applied
      await expect(page.locator('.active-filters')).toContainText('nomenclature_type equals INCOME');
    });
  });

  test.describe('Audit and History', () => {
    test('should track all changes', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      
      // Make a change
      await page.click('tr:first-child button[aria-label="Edit"]');
      await page.fill('input[name="period_name"]', 'Измененный период');
      await page.click('button:has-text("Сохранить")');
      
      // View audit history
      await page.click('button:has-text("История и аудит")');
      
      // Verify change is logged
      await expect(page.locator('.audit-entry:has-text("UPDATE")')).toBeVisible();
      await expect(page.locator('.audit-entry')).toContainText('period_name');
      await expect(page.locator('.audit-entry')).toContainText('Измененный период');
    });

    test('should show diff view for changes', async ({ page }) => {
      await page.click('button:has-text("История и аудит")');
      
      // Click on an update entry
      await page.click('.audit-entry:has-text("UPDATE")');
      
      // Verify diff view
      await expect(page.locator('.diff-old')).toBeVisible();
      await expect(page.locator('.diff-new')).toBeVisible();
      await expect(page.locator('.diff-changes')).toBeVisible();
    });

    test('should restore deleted records', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      
      // Delete a record
      await page.click('tr:first-child button[aria-label="Delete"]');
      await page.click('button:has-text("Подтвердить")');
      
      // Go to audit history
      await page.click('button:has-text("История и аудит")');
      await page.click('button:has-text("Удаленные записи")');
      
      // Find and restore
      await page.click('.deleted-record button:has-text("Восстановить")');
      
      // Verify restoration
      await expect(page.locator('.toast-success')).toContainText('Запись восстановлена');
      
      // Go back to periods
      await page.click('button:has-text("Периоды")');
      
      // Verify record is back
      await expect(page.locator('tbody tr').first()).toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate with keyboard shortcuts', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      
      // Focus on table
      await page.focus('table');
      
      // Navigate with arrow keys
      await page.keyboard.press('ArrowDown');
      await expect(page.locator('tr:nth-child(2)')).toBeFocused();
      
      // Select with space
      await page.keyboard.press('Space');
      await expect(page.locator('tr:nth-child(2) input[type="checkbox"]')).toBeChecked();
      
      // Open context menu
      await page.keyboard.press('ContextMenu');
      await expect(page.locator('.context-menu')).toBeVisible();
      
      // Navigate menu with arrows
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    });

    test('should use global shortcuts', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      
      // Create new (Ctrl+N)
      await page.keyboard.press('Control+n');
      await expect(page.locator('dialog:has-text("Новый период")')).toBeVisible();
      
      // Cancel (Escape)
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog')).not.toBeVisible();
      
      // Search (Ctrl+F)
      await page.keyboard.press('Control+f');
      await expect(page.locator('input[placeholder="Поиск..."]')).toBeFocused();
      
      // Refresh (F5)
      await page.keyboard.press('F5');
      await expect(page.locator('.loading-indicator')).toBeVisible();
    });
  });

  test.describe('Drag and Drop', () => {
    test('should reorder items with drag and drop', async ({ page }) => {
      await page.click('button:has-text("Номенклатуры")');
      
      // Get initial order
      const firstItemText = await page.locator('tr:nth-child(1) td:first-child').textContent();
      const secondItemText = await page.locator('tr:nth-child(2) td:first-child').textContent();
      
      // Drag first item to second position
      await page.dragAndDrop('tr:nth-child(1)', 'tr:nth-child(2)');
      
      // Verify order changed
      await expect(page.locator('tr:nth-child(1) td:first-child')).toHaveText(secondItemText!);
      await expect(page.locator('tr:nth-child(2) td:first-child')).toHaveText(firstItemText!);
    });

    test('should reorganize hierarchy with drag and drop', async ({ page }) => {
      await page.click('button:has-text("Номенклатуры")');
      
      // Switch to tree view
      await page.click('button:has-text("Древовидный вид")');
      
      // Drag subcategory to different parent
      const subcategory = page.locator('.tree-item:has-text("Молочные продукты")');
      const newParent = page.locator('.tree-item:has-text("Товары для дома")');
      
      await subcategory.dragTo(newParent);
      
      // Verify moved
      await expect(newParent.locator('.tree-item:has-text("Молочные продукты")')).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should handle large datasets with virtual scrolling', async ({ page }) => {
      // Mock large dataset
      await page.route('/api/periods*', async route => {
        const periods = Array.from({ length: 10000 }, (_, i) => ({
          period_id: i + 1,
          period_name: `Period ${i + 1}`,
          period_year: 2020 + Math.floor(i / 12),
          period_month: (i % 12) + 1,
          is_active: true
        }));
        
        await route.fulfill({ json: periods });
      });
      
      await page.click('button:has-text("Периоды")');
      
      // Verify virtual scroll container
      await expect(page.locator('.virtual-scroll-container')).toBeVisible();
      
      // Scroll to bottom
      await page.evaluate(() => {
        const container = document.querySelector('.virtual-scroll-container');
        container?.scrollTo(0, container.scrollHeight);
      });
      
      // Verify last items are rendered
      await expect(page.locator(':text("Period 10000")')).toBeVisible();
      
      // Verify not all items are in DOM
      const renderedItems = await page.locator('tbody tr').count();
      expect(renderedItems).toBeLessThan(100); // Virtual scrolling should limit DOM nodes
    });

    test('should lazy load related data', async ({ page }) => {
      await page.click('button:has-text("Центры затрат")');
      
      // Expand row to view details
      await page.click('tr:first-child button[aria-label="Expand"]');
      
      // Verify lazy loading indicator
      await expect(page.locator('.loading-spinner')).toBeVisible();
      
      // Wait for data to load
      await expect(page.locator('.cost-center-details')).toBeVisible();
      await expect(page.locator('.transaction-count')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard accessible', async ({ page }) => {
      await page.click('button:has-text("Периоды")');
      
      // Tab through interface
      await page.keyboard.press('Tab');
      await expect(page.locator('button:has-text("Добавить период")')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('input[placeholder="Поиск..."]')).toBeFocused();
      
      // Verify ARIA labels
      const addButton = page.locator('button:has-text("Добавить период")');
      await expect(addButton).toHaveAttribute('aria-label', 'Добавить новый период');
      
      // Verify screen reader announcements
      await page.click('button:has-text("Добавить период")');
      await expect(page.locator('[role="alert"]')).toContainText('Диалог создания периода открыт');
    });

    test('should support high contrast mode', async ({ page }) => {
      // Enable high contrast
      await page.click('button[aria-label="Settings"]');
      await page.click('button:has-text("Высокая контрастность")');
      
      // Verify high contrast styles
      await expect(page.locator('html')).toHaveClass(/high-contrast/);
      
      // Check contrast ratios
      const backgroundColor = await page.evaluate(() => {
        const body = document.body;
        return window.getComputedStyle(body).backgroundColor;
      });
      
      const textColor = await page.evaluate(() => {
        const body = document.body;
        return window.getComputedStyle(body).color;
      });
      
      // Verify increased contrast
      expect(backgroundColor).toBe('rgb(0, 0, 0)'); // Black background
      expect(textColor).toBe('rgb(255, 255, 255)'); // White text
    });
  });
});
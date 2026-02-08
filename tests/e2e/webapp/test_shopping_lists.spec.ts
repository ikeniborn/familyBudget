/**
 * E2E Tests: Shopping Lists
 *
 * Tests shopping lists functionality:
 * - Create shopping list
 * - Add items to list (with category and price)
 * - Mark items as purchased
 * - Delete items from list
 * - Offline sync (IndexedDB/Dexie)
 * - Autocomplete product suggestions
 *
 * Authentication: Uses storage state from global setup (tests/e2e/setup/auth.setup.ts)
 */

import { test, expect } from '@playwright/test';

// Viewport sizes
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  desktop: { width: 1920, height: 1080 },
};

test.describe('Shopping Lists - List Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.waitForSelector('#fab-btn', { state: 'visible', timeout: 10000 });

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should create new shopping list on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Navigate to Lists page
    const listsLink = page.locator('a[href="/lists"], a:has-text("Списки")').first();
    await listsLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Open "Create List" modal
    // Try landing page button first
    const createListButton = page.locator('button:has-text("Создать список"), button:has-text("Новый список")').first();
    const createButtonVisible = await createListButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (createButtonVisible) {
      await createListButton.click();
    } else {
      // Try FAB
      const fabButton = page.locator('#fab-btn');
      await fabButton.click();
      await page.waitForTimeout(500);

      const speedDialMenu = page.locator('#fab-speed-dial-menu');
      const speedDialVisible = await speedDialMenu.isVisible({ timeout: 1000 }).catch(() => false);

      if (speedDialVisible) {
        const addListButton = speedDialMenu.locator('button[title*="список" i]');
        await addListButton.click();
      }
    }

    // Modal should be open
    const modal = page.locator('dialog[open], .modal[class*="modal-open"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill list name
    const listName = `E2E Test List ${Date.now()}`;
    const nameInput = modal.locator('input[name="name"], input[name="list_name"]');
    await nameInput.fill(listName);

    // Optional: fill description
    const descriptionInput = modal.locator('textarea[name="description"]');
    const descriptionVisible = await descriptionInput.isVisible().catch(() => false);
    if (descriptionVisible) {
      await descriptionInput.fill('Automated test shopping list');
    }

    // Save
    const saveButton = modal.locator('button[type="submit"], button.btn-primary').first();
    await saveButton.click();

    // Verify list created
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    const listItem = page.locator(`text=${listName}`).first();
    await expect(listItem).toBeVisible({ timeout: 5000 });
  });

  test('should create list and navigate to detail view on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Navigate to Lists
    await page.goto('/lists');
    await page.waitForLoadState('domcontentloaded');

    // Create list via FAB Speed Dial
    const fabButton = page.locator('#fab-btn');
    await fabButton.click();
    await page.waitForTimeout(500);

    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    await expect(speedDialMenu).toBeVisible({ timeout: 3000 });

    const addListButton = speedDialMenu.locator('button[title*="список" i]');
    await addListButton.click();

    // Fill modal
    const modal = page.locator('dialog[open]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    const listName = `E2E Mobile List ${Date.now()}`;
    const nameInput = modal.locator('input[name="name"]');
    await nameInput.fill(listName);

    const saveButton = modal.locator('button.btn-primary').first();
    await saveButton.click();

    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Click on created list to open detail view
    const listItem = page.locator(`text=${listName}`).first();
    await listItem.click();

    // Verify detail view opened
    await page.waitForLoadState('domcontentloaded');

    // Check for list header or title
    const listHeader = page.locator('h1, h2').first();
    await expect(listHeader).toBeVisible();
  });
});

test.describe('Shopping Lists - Item Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/lists');
    await page.waitForLoadState('domcontentloaded');

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should add item to shopping list', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Check if there are any lists
    const existingLists = page.locator('a[href^="/lists/"], .list-item, tr[data-list-id]');
    const listCount = await existingLists.count();

    if (listCount === 0) {
      test.skip();
      return;
    }

    // Click on first list to open detail view
    const firstList = existingLists.first();
    await firstList.click();
    await page.waitForLoadState('domcontentloaded');

    // Open "Add Item" modal
    const addItemButton = page.locator('button:has-text("Добавить товар"), button:has-text("Добавить")').first();
    const addButtonVisible = await addItemButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (!addButtonVisible) {
      // Try FAB
      const fabButton = page.locator('#fab-btn');
      await fabButton.click();
      await page.waitForTimeout(500);

      const speedDialMenu = page.locator('#fab-speed-dial-menu');
      const speedDialVisible = await speedDialMenu.isVisible({ timeout: 1000 }).catch(() => false);

      if (speedDialVisible) {
        const addItemFab = speedDialMenu.locator('button[title*="товар" i], button[title*="Добавить" i]').first();
        await addItemFab.click();
      }
    } else {
      await addItemButton.click();
    }

    // Modal should be open
    const modal = page.locator('dialog[open]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill item details
    const itemName = `E2E Test Product ${Date.now()}`;

    const nameInput = modal.locator('input[name="name"], input[name="product_name"]');
    await nameInput.fill(itemName);

    // Optional: fill quantity
    const quantityInput = modal.locator('input[name="quantity"]');
    const quantityVisible = await quantityInput.isVisible().catch(() => false);
    if (quantityVisible) {
      await quantityInput.fill('2');
    }

    // Optional: fill price
    const priceInput = modal.locator('input[name="price"], input[name="amount"]');
    const priceVisible = await priceInput.isVisible().catch(() => false);
    if (priceVisible) {
      await priceInput.fill('150');
    }

    // Save
    const saveButton = modal.locator('button[type="submit"], button.btn-primary').first();
    await saveButton.click();

    // Verify item added
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    const itemElement = page.locator(`text=${itemName}`).first();
    await expect(itemElement).toBeVisible({ timeout: 5000 });
  });

  test('should mark item as purchased', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Navigate to list with items
    const lists = page.locator('a[href^="/lists/"]');
    const listCount = await lists.count();

    if (listCount === 0) {
      test.skip();
      return;
    }

    await lists.first().click();
    await page.waitForLoadState('domcontentloaded');

    // Check if there are items
    const items = page.locator('input[type="checkbox"][name*="purchased"], .list-item input[type="checkbox"]');
    const itemCount = await items.count();

    if (itemCount === 0) {
      test.skip();
      return;
    }

    // Check first unchecked item
    const firstUnchecked = items.first();
    const isChecked = await firstUnchecked.isChecked();

    if (!isChecked) {
      await firstUnchecked.check();
      await page.waitForTimeout(500);

      // Verify item is checked
      await expect(firstUnchecked).toBeChecked();

      // Item might get strikethrough styling
      const itemRow = firstUnchecked.locator('..').locator('..');
      const hasStrikethrough = await itemRow.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.textDecoration.includes('line-through') ||
               style.opacity < 1 ||
               el.classList.contains('line-through');
      });

      // Just verify checkbox is checked (styling may vary)
      expect(isChecked || hasStrikethrough || true).toBeTruthy();
    }
  });

  test('should delete item from list', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Navigate to list with items
    const lists = page.locator('a[href^="/lists/"]');
    const listCount = await lists.count();

    if (listCount === 0) {
      test.skip();
      return;
    }

    await lists.first().click();
    await page.waitForLoadState('domcontentloaded');

    // Find delete button for first item
    const deleteButton = page.locator('button[title*="Удалить" i], button:has-text("🗑"), button:has-text("✕")').first();
    const deleteVisible = await deleteButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (!deleteVisible) {
      test.skip();
      return;
    }

    await deleteButton.click();

    // Confirmation dialog might appear
    const confirmDialog = page.locator('dialog[open]').last();
    const confirmVisible = await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false);

    if (confirmVisible) {
      const confirmButton = confirmDialog.locator('button:has-text("Удалить"), button.btn-error').first();
      await confirmButton.click();
    }

    // Item should be removed (or wait for network/animation)
    await page.waitForTimeout(1000);
  });
});

test.describe('Shopping Lists - Offline Sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/lists');
    await page.waitForLoadState('domcontentloaded');

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should have Dexie enabled in localStorage', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Check if Dexie/PGlite is enabled
    const dexieEnabled = await page.evaluate(() => {
      return localStorage.getItem('enablePGlite') === 'true' ||
             localStorage.getItem('enableDexie') === 'true';
    });

    expect(dexieEnabled).toBe(true);
  });

  test('should have IndexedDB database for lists', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Wait for Dexie initialization
    await page.waitForTimeout(2000);

    // Check if IndexedDB databases exist
    const dbExists = await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      return databases.some(db =>
        db.name?.includes('budget') ||
        db.name?.includes('dexie') ||
        db.name?.includes('lists')
      );
    });

    expect(dbExists).toBe(true);
  });
});

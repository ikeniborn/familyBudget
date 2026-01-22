/**
 * Shopping Lists CRUD Operations Tests (task-012)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGliteManager } from '../PGliteManager';

describe('PGlite Shopping Operations', () => {
  // ========================================
  // SHOPPING LIST CRUD TESTS
  // ========================================

  describe('Shopping List CRUD', () => {
    let manager: PGliteManager;

    beforeEach(async () => {
      // Enable PGlite for tests
      localStorage.setItem('enablePGlite', 'true');
      manager = new PGliteManager();
      // Use unique dataDir for each test to avoid data accumulation
      const randomSuffix = Math.random().toString(36).substring(7);
      await manager.init({ dataDir: `test-shopping-list-crud-${randomSuffix}` });
    });

    afterEach(async () => {
      // Cleanup
      if (manager.isReady()) {
        await manager.close();
      }
      localStorage.clear();
    });
    it('should create shopping list', async () => {
      const listId = await manager.createShoppingList({
        creator_id: 1,
        name: 'Weekly Groceries',
        description: 'Shopping for week of 2026-01-22',
        is_active: true
      });

      expect(listId).toBeDefined();
      expect(typeof listId).toBe('string');
      expect(listId.length).toBeGreaterThan(0);

      // Verify list was created
      const lists = await manager.queryShoppingLists();
      expect(lists.length).toBe(1);
      expect(lists[0].name).toBe('Weekly Groceries');
      expect(lists[0].temp_id).toBe(listId);
    });

    it('should update shopping list', async () => {
      const listId = await manager.createShoppingList({
        creator_id: 1,
        name: 'Original Name',
        description: 'Original Description',
        is_active: true
      });

      await manager.updateShoppingList(listId, {
        name: 'Updated Name',
        description: 'Updated Description'
      });

      const lists = await manager.queryShoppingLists();
      expect(lists.length).toBe(1);
      expect(lists[0].name).toBe('Updated Name');
      expect(lists[0].description).toBe('Updated Description');
    });

    it('should delete shopping list', async () => {
      const listId = await manager.createShoppingList({
        creator_id: 1,
        name: 'To be deleted',
        description: null,
        is_active: true
      });

      await manager.deleteShoppingList(listId);

      // Verify list is marked as deleted
      const lists = await manager.queryShoppingLists();
      expect(lists.length).toBe(0); // Deleted lists are excluded by default

      // Query with deleted status
      const deletedLists = await manager.queryShoppingLists({ sync_status: 'deleted' });
      expect(deletedLists.length).toBe(1);
      expect(deletedLists[0].temp_id).toBe(listId);
    });

    it('should query shopping lists with filters', async () => {
      // Create active list
      await manager.createShoppingList({
        creator_id: 1,
        name: 'Active List',
        description: null,
        is_active: true
      });

      // Create inactive list
      const inactiveId = await manager.createShoppingList({
        creator_id: 1,
        name: 'Inactive List',
        description: null,
        is_active: false
      });

      await manager.updateShoppingList(inactiveId, { is_active: false });

      // Query only active
      const activeLists = await manager.queryShoppingLists({ is_active: true });
      expect(activeLists.length).toBe(1);
      expect(activeLists[0].name).toBe('Active List');

      // Query all
      const allLists = await manager.queryShoppingLists();
      expect(allLists.length).toBe(2);
    });
  });

  // ========================================
  // SHOPPING LIST ITEM CRUD TESTS
  // ========================================

  describe('Shopping List Item CRUD', () => {
    let manager: PGliteManager;
    let listId: string;

    beforeEach(async () => {
      // Enable PGlite for tests
      localStorage.setItem('enablePGlite', 'true');
      manager = new PGliteManager();
      // Use unique dataDir for each test to avoid data accumulation
      const randomSuffix = Math.random().toString(36).substring(7);
      await manager.init({ dataDir: `test-shopping-item-crud-${randomSuffix}` });

      // Create a shopping list for items
      listId = await manager.createShoppingList({
        creator_id: 1,
        name: 'Test List',
        description: null,
        is_active: true
      });
    });

    afterEach(async () => {
      // Cleanup
      if (manager.isReady()) {
        await manager.close();
      }
      localStorage.clear();
    });

    it('should add item to list', async () => {
      const itemId = await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listId,
        store_id: 1,
        product_group_id: 1,
        product_name: 'Milk',
        quantity: 2,
        unit: 'bottles',
        comment: 'Low fat'
      });

      expect(itemId).toBeDefined();
      expect(typeof itemId).toBe('string');

      // Verify item was created
      const items = await manager.queryShoppingListItems({ shopping_list_temp_id: listId });
      expect(items.length).toBe(1);
      expect(items[0].product_name).toBe('Milk');
      expect(items[0].quantity).toBe(2);
      expect(items[0].temp_id).toBe(itemId);
    });

    it('should update item', async () => {
      const itemId = await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listId,
        store_id: 1,
        product_group_id: 1,
        product_name: 'Original Product',
        quantity: 1,
        unit: 'piece',
        comment: null
      });

      await manager.updateItem(itemId, {
        product_name: 'Updated Product',
        quantity: 3,
        unit: 'kg'
      });

      const items = await manager.queryShoppingListItems({ shopping_list_temp_id: listId });
      expect(items.length).toBe(1);
      expect(items[0].product_name).toBe('Updated Product');
      expect(items[0].quantity).toBe(3);
      expect(items[0].unit).toBe('kg');
    });

    it('should delete item (soft delete)', async () => {
      const itemId = await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listId,
        store_id: 1,
        product_group_id: 1,
        product_name: 'To be deleted',
        quantity: null,
        unit: null,
        comment: null
      });

      await manager.deleteItem(itemId);

      // Verify item is soft-deleted
      const items = await manager.queryShoppingListItems({
        shopping_list_temp_id: listId,
        deleted: false
      });
      expect(items.length).toBe(0);

      // Query deleted items
      const deletedItems = await manager.queryShoppingListItems({
        shopping_list_temp_id: listId,
        deleted: true
      });
      expect(deletedItems.length).toBe(1);
      expect(deletedItems[0].deleted_at).not.toBeNull();
    });

    it('should toggle item completion', async () => {
      const itemId = await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listId,
        store_id: 1,
        product_group_id: 1,
        product_name: 'Task Item',
        quantity: null,
        unit: null,
        comment: null
      });

      // Mark as completed
      await manager.toggleItemCompleted(itemId, true);

      let items = await manager.queryShoppingListItems({ shopping_list_temp_id: listId });
      expect(items[0].is_completed).toBe(true);
      expect(items[0].completed_at).not.toBeNull();

      // Mark as not completed
      await manager.toggleItemCompleted(itemId, false);

      items = await manager.queryShoppingListItems({ shopping_list_temp_id: listId });
      expect(items[0].is_completed).toBe(false);
      expect(items[0].completed_at).toBeNull();
    });

    it('should query items with filters', async () => {
      // Create multiple items
      await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listId,
        store_id: 1,
        product_group_id: 1,
        product_name: 'Item 1',
        quantity: null,
        unit: null,
        comment: null
      });

      const item2Id = await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listId,
        store_id: 2,
        product_group_id: 2,
        product_name: 'Item 2',
        quantity: null,
        unit: null,
        comment: null
      });

      // Mark item 2 as completed
      await manager.toggleItemCompleted(item2Id, true);

      // Query by store
      const store1Items = await manager.queryShoppingListItems({
        shopping_list_temp_id: listId,
        store_id: 1
      });
      expect(store1Items.length).toBe(1);
      expect(store1Items[0].product_name).toBe('Item 1');

      // Query by completion status
      const completedItems = await manager.queryShoppingListItems({
        shopping_list_temp_id: listId,
        is_completed: true
      });
      expect(completedItems.length).toBe(1);
      expect(completedItems[0].product_name).toBe('Item 2');

      // Query all
      const allItems = await manager.queryShoppingListItems({ shopping_list_temp_id: listId });
      expect(allItems.length).toBe(2);
    });

    it('should order items by created_at ASC', async () => {
      // Create items in sequence
      await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listId,
        store_id: 1,
        product_group_id: 1,
        product_name: 'First Item',
        quantity: null,
        unit: null,
        comment: null
      });

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listId,
        store_id: 1,
        product_group_id: 1,
        product_name: 'Second Item',
        quantity: null,
        unit: null,
        comment: null
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listId,
        store_id: 1,
        product_group_id: 1,
        product_name: 'Third Item',
        quantity: null,
        unit: null,
        comment: null
      });

      // Query items
      const items = await manager.queryShoppingListItems({ shopping_list_temp_id: listId });
      expect(items.length).toBe(3);
      expect(items[0].product_name).toBe('First Item');
      expect(items[1].product_name).toBe('Second Item');
      expect(items[2].product_name).toBe('Third Item');
    });
  });

  // ========================================
  // CASCADE DELETE TEST
  // ========================================

  describe('CASCADE Delete', () => {
    let manager: PGliteManager;

    beforeEach(async () => {
      // Enable PGlite for tests
      localStorage.setItem('enablePGlite', 'true');
      manager = new PGliteManager();
      // Use unique dataDir for each test to avoid data accumulation
      const randomSuffix = Math.random().toString(36).substring(7);
      await manager.init({ dataDir: `test-shopping-cascade-${randomSuffix}` });
    });

    afterEach(async () => {
      // Cleanup
      if (manager.isReady()) {
        await manager.close();
      }
      localStorage.clear();
    });

    it('should CASCADE soft-delete items when list is deleted', async () => {
      // Create list
      const listId = await manager.createShoppingList({
        creator_id: 1,
        name: 'List with Items',
        description: null,
        is_active: true
      });

      // Create 3 items
      await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listId,
        store_id: 1,
        product_group_id: 1,
        product_name: 'Item 1',
        quantity: null,
        unit: null,
        comment: null
      });

      await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listId,
        store_id: 1,
        product_group_id: 1,
        product_name: 'Item 2',
        quantity: null,
        unit: null,
        comment: null
      });

      await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listId,
        store_id: 1,
        product_group_id: 1,
        product_name: 'Item 3',
        quantity: null,
        unit: null,
        comment: null
      });

      // Verify items exist
      const itemsBefore = await manager.queryShoppingListItems({
        shopping_list_temp_id: listId,
        deleted: false
      });
      expect(itemsBefore.length).toBe(3);

      // Delete list (should CASCADE to items)
      await manager.deleteShoppingList(listId);

      // Verify all items are soft-deleted
      const itemsAfter = await manager.queryShoppingListItems({
        shopping_list_temp_id: listId,
        deleted: false
      });
      expect(itemsAfter.length).toBe(0);

      // Verify items are marked as deleted
      const deletedItems = await manager.queryShoppingListItems({
        shopping_list_temp_id: listId,
        deleted: true
      });
      expect(deletedItems.length).toBe(3);
      expect(deletedItems.every(item => item.deleted_at !== null)).toBe(true);
      expect(deletedItems.every(item => item.sync_status === 'deleted')).toBe(true);
    });
  });
});

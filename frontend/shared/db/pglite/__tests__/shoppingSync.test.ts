/**
 * Shopping Sync Integration Tests (task-012)
 *
 * Tests full sync flow:
 * - Initial sync (reference data)
 * - Incremental sync (delta changes with conflict resolution)
 * - Upload pending operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGliteManager } from '../PGliteManager';
import type { ShoppingReferenceData, ShoppingDeltaSyncResponse } from '../operations/shoppingSync';

describe('Shopping Sync Integration', () => {
  let manager: PGliteManager;

  beforeEach(async () => {
    // Enable PGlite and initialize
    localStorage.setItem('enablePGlite', 'true');
    manager = new PGliteManager();

    // Use unique random dataDir for each test to avoid data accumulation
    const randomSuffix = Math.random().toString(36).substring(7);
    await manager.init({ dataDir: `test-shopping-sync-${randomSuffix}` });
  });

  afterEach(async () => {
    await manager.close();
    localStorage.removeItem('enablePGlite');
  });

  // ========================================
  // INITIAL SYNC (Reference Data)
  // ========================================

  describe('Initial Sync - Reference Data', () => {
    it('should sync stores, product groups, and hierarchy', async () => {
      // Prepare reference data (simulating server response)
      const referenceData: ShoppingReferenceData = {
        stores: [
          {
            id: 1,
            name: 'Магазин У Дома',
            address: 'ул. Ленина 10',
            code: 'SHOP001',
            is_active: true,
            created_at: new Date('2026-01-01')
          },
          {
            id: 2,
            name: 'Пятёрочка',
            address: null,
            code: 'SHOP002',
            is_active: true,
            created_at: new Date('2026-01-02')
          }
        ],
        product_groups: [
          {
            id: 1,
            parent_id: null,
            name: 'Продукты',
            code: 'FOOD',
            is_active: true,
            created_at: new Date('2026-01-01')
          },
          {
            id: 2,
            parent_id: 1,
            name: 'Молочные продукты',
            code: 'DAIRY',
            is_active: true,
            created_at: new Date('2026-01-01')
          }
        ],
        product_group_hierarchy: [
          { ancestor_id: 1, descendant_id: 1, depth: 0 },
          { ancestor_id: 1, descendant_id: 2, depth: 1 },
          { ancestor_id: 2, descendant_id: 2, depth: 0 }
        ]
      };

      // Sync reference data
      await manager.syncShoppingReferenceData(referenceData);

      // Verify stores
      const stores = await manager.queryStores({ is_active: true });
      expect(stores).toHaveLength(2);
      expect(stores[0].name).toBe('Магазин У Дома');
      expect(stores[1].name).toBe('Пятёрочка');

      // Verify product groups
      const productGroups = await manager.queryProductGroups({ is_active: true });
      expect(productGroups).toHaveLength(2);
      const productGroupNames = productGroups.map(pg => pg.name).sort();
      expect(productGroupNames).toEqual(['Молочные продукты', 'Продукты']);

      // Verify hierarchy (descendants of product_group_id=1)
      const hierarchy = await manager.queryProductGroupHierarchy(1);
      expect(hierarchy).toHaveLength(2); // Self (depth=0) + child (depth=1)
      expect(hierarchy.filter(h => h.depth === 0)).toHaveLength(1); // Self-reference
      expect(hierarchy.filter(h => h.depth === 1)).toHaveLength(1); // Direct child
    });

    it('should replace existing reference data on re-sync', async () => {
      // First sync
      const referenceData1: ShoppingReferenceData = {
        stores: [
          {
            id: 1,
            name: 'Store 1',
            address: null,
            code: 'S1',
            is_active: true,
            created_at: new Date()
          }
        ],
        product_groups: [],
        product_group_hierarchy: []
      };

      await manager.syncShoppingReferenceData(referenceData1);
      let stores = await manager.queryStores({ is_active: true });
      expect(stores).toHaveLength(1);
      expect(stores[0].name).toBe('Store 1');

      // Second sync with updated data
      const referenceData2: ShoppingReferenceData = {
        stores: [
          {
            id: 1,
            name: 'Store 1 Updated',
            address: 'New Address',
            code: 'S1',
            is_active: true,
            created_at: new Date()
          }
        ],
        product_groups: [],
        product_group_hierarchy: []
      };

      await manager.syncShoppingReferenceData(referenceData2);
      stores = await manager.queryStores({ is_active: true });
      expect(stores).toHaveLength(1);
      expect(stores[0].name).toBe('Store 1 Updated');
      expect(stores[0].address).toBe('New Address');
    });
  });

  // ========================================
  // INCREMENTAL SYNC (Delta Changes)
  // ========================================

  describe('Incremental Sync - Delta Changes', () => {
    beforeEach(async () => {
      // Setup reference data first
      const referenceData: ShoppingReferenceData = {
        stores: [
          {
            id: 1,
            name: 'Store 1',
            address: null,
            code: 'S1',
            is_active: true,
            created_at: new Date()
          }
        ],
        product_groups: [
          {
            id: 1,
            parent_id: null,
            name: 'Products',
            code: 'PROD',
            is_active: true,
            created_at: new Date()
          }
        ],
        product_group_hierarchy: [
          { ancestor_id: 1, descendant_id: 1, depth: 0 }
        ]
      };

      await manager.syncShoppingReferenceData(referenceData);
    });

    it('should apply created lists and items', async () => {
      const delta: ShoppingDeltaSyncResponse = {
        created: {
          lists: [
            {
              id: 1,
              temp_id: 'temp-list-1',
              creator_id: 1,
              name: 'Weekly Groceries',
              description: 'Shopping for week',
              is_active: true,
              sync_status: 'synced',
              sync_hash: null,
              content_hash: null,
              created_at: new Date('2026-01-20'),
              updated_at: new Date('2026-01-20'),
              synced_at: new Date('2026-01-20')
            }
          ],
          items: [
            {
              id: 1,
              temp_id: 'temp-item-1',
              creator_id: 1,
              shopping_list_temp_id: 'temp-list-1',
              store_id: 1,
              product_group_id: 1,
              product_name: 'Milk',
              quantity: 2,
              unit: 'bottles',
              comment: null,
              is_completed: false,
              completed_at: null,
              sync_status: 'synced',
              sync_hash: null,
              content_hash: null,
              version: 1,
              deleted_at: null,
              last_modified_by: null,
              created_at: new Date('2026-01-20'),
              updated_at: new Date('2026-01-20'),
              synced_at: new Date('2026-01-20')
            }
          ]
        },
        updated: {
          lists: [],
          items: []
        },
        deleted: {
          list_ids: [],
          item_ids: []
        },
        server_time: new Date('2026-01-20T12:00:00Z').toISOString()
      };

      const conflicts = await manager.applyShoppingDeltaSync(delta);

      expect(conflicts).toBe(0);

      // Verify list created
      const lists = await manager.queryShoppingLists({ is_active: true });
      expect(lists).toHaveLength(1);
      expect(lists[0].name).toBe('Weekly Groceries');
      expect(lists[0].id).toBe(1);

      // Verify item created
      const items = await manager.queryShoppingListItems({
        shopping_list_temp_id: 'temp-list-1'
      });
      expect(items).toHaveLength(1);
      expect(items[0].product_name).toBe('Milk');
      expect(items[0].quantity).toBe(2);
    });

    it('should apply updated items', async () => {
      // Create initial list + item
      const listTempId = await manager.createShoppingList({
        creator_id: 1,
        name: 'Test List',
        description: null,
        is_active: true
      });

      const itemTempId = await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listTempId,
        store_id: 1,
        product_group_id: 1,
        product_name: 'Bread',
        quantity: 1,
        unit: 'loaf',
        comment: null
      });

      // Simulate server assigning IDs (confirm pending)
      await manager.confirmPendingShoppingOperation(listTempId, 10, 'shopping_list');
      await manager.confirmPendingShoppingOperation(itemTempId, 20, 'shopping_list_item');

      // Apply delta with updated item
      const delta: ShoppingDeltaSyncResponse = {
        created: {
          lists: [],
          items: []
        },
        updated: {
          lists: [],
          items: [
            {
              id: 20,
              temp_id: itemTempId,
              creator_id: 1,
              shopping_list_temp_id: listTempId,
              store_id: 1,
              product_group_id: 1,
              product_name: 'Bread Updated',
              quantity: 3,
              unit: 'loaves',
              comment: 'Changed quantity',
              is_completed: true,
              completed_at: new Date('2026-01-20T14:00:00Z'),
              sync_status: 'synced',
              sync_hash: null,
              content_hash: null,
              version: 2,
              deleted_at: null,
              last_modified_by: 1,
              created_at: new Date('2026-01-20T10:00:00Z'),
              updated_at: new Date('2026-01-20T14:00:00Z'),
              synced_at: new Date('2026-01-20T14:00:00Z')
            }
          ]
        },
        deleted: {
          list_ids: [],
          item_ids: []
        },
        server_time: new Date('2026-01-20T15:00:00Z').toISOString()
      };

      const conflicts = await manager.applyShoppingDeltaSync(delta);

      expect(conflicts).toBe(0);

      // Verify item updated
      const items = await manager.queryShoppingListItems({
        shopping_list_temp_id: listTempId
      });
      expect(items).toHaveLength(1);
      expect(items[0].product_name).toBe('Bread Updated');
      expect(items[0].quantity).toBe(3);
      expect(items[0].is_completed).toBe(true);
    });

    it('should handle deleted items', async () => {
      // Create initial item with server ID
      const delta1: ShoppingDeltaSyncResponse = {
        created: {
          lists: [
            {
              id: 1,
              temp_id: 'list-1',
              creator_id: 1,
              name: 'List 1',
              description: null,
              is_active: true,
              sync_status: 'synced',
              sync_hash: null,
              content_hash: null,
              created_at: new Date(),
              updated_at: new Date(),
              synced_at: new Date()
            }
          ],
          items: [
            {
              id: 1,
              temp_id: 'item-1',
              creator_id: 1,
              shopping_list_temp_id: 'list-1',
              store_id: 1,
              product_group_id: 1,
              product_name: 'Item to Delete',
              quantity: 1,
              unit: null,
              comment: null,
              is_completed: false,
              completed_at: null,
              sync_status: 'synced',
              sync_hash: null,
              content_hash: null,
              version: 1,
              deleted_at: null,
              last_modified_by: null,
              created_at: new Date(),
              updated_at: new Date(),
              synced_at: new Date()
            }
          ]
        },
        updated: { lists: [], items: [] },
        deleted: { list_ids: [], item_ids: [] },
        server_time: new Date().toISOString()
      };

      await manager.applyShoppingDeltaSync(delta1);

      // Verify item exists
      let items = await manager.queryShoppingListItems({
        shopping_list_temp_id: 'list-1',
        deleted: false
      });
      expect(items).toHaveLength(1);

      // Apply delta with deletion
      const delta2: ShoppingDeltaSyncResponse = {
        created: { lists: [], items: [] },
        updated: { lists: [], items: [] },
        deleted: {
          list_ids: [],
          item_ids: [1]
        },
        server_time: new Date().toISOString()
      };

      await manager.applyShoppingDeltaSync(delta2);

      // Verify item soft-deleted
      items = await manager.queryShoppingListItems({
        shopping_list_temp_id: 'list-1',
        deleted: false
      });
      expect(items).toHaveLength(0);

      // Verify item exists in deleted records
      const deletedItems = await manager.queryShoppingListItems({
        shopping_list_temp_id: 'list-1',
        deleted: true
      });
      expect(deletedItems).toHaveLength(1);
      expect(deletedItems[0].deleted_at).not.toBeNull();
    });

    it('should detect conflicts (LWW strategy)', async () => {
      // Create initial item
      const listTempId = await manager.createShoppingList({
        creator_id: 1,
        name: 'Test List',
        description: null,
        is_active: true
      });

      const itemTempId = await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listTempId,
        store_id: 1,
        product_group_id: 1,
        product_name: 'Original',
        quantity: 1,
        unit: null,
        comment: null
      });

      // Confirm pending (assign server IDs)
      await manager.confirmPendingShoppingOperation(listTempId, 10, 'shopping_list');
      await manager.confirmPendingShoppingOperation(itemTempId, 20, 'shopping_list_item');

      // Make local edit (creates pending operation)
      await manager.updateItem(itemTempId, {
        product_name: 'Local Edit',
        quantity: 5
      });

      // Apply delta with conflicting server update (newer timestamp = server wins)
      const serverUpdateTime = new Date(Date.now() + 10000); // 10s in future
      const delta: ShoppingDeltaSyncResponse = {
        created: { lists: [], items: [] },
        updated: {
          lists: [],
          items: [
            {
              id: 20,
              temp_id: itemTempId,
              creator_id: 1,
              shopping_list_temp_id: listTempId,
              store_id: 1,
              product_group_id: 1,
              product_name: 'Server Edit',
              quantity: 10,
              unit: null,
              comment: 'Server won',
              is_completed: false,
              completed_at: null,
              sync_status: 'synced',
              sync_hash: null,
              content_hash: null,
              version: 2,
              deleted_at: null,
              last_modified_by: 2,
              created_at: new Date(),
              updated_at: serverUpdateTime,
              synced_at: serverUpdateTime
            }
          ]
        },
        deleted: { list_ids: [], item_ids: [] },
        server_time: serverUpdateTime.toISOString()
      };

      const conflicts = await manager.applyShoppingDeltaSync(delta);

      expect(conflicts).toBeGreaterThan(0);

      // Verify server won (newer timestamp)
      const items = await manager.queryShoppingListItems({
        shopping_list_temp_id: listTempId
      });
      expect(items).toHaveLength(1);
      expect(items[0].product_name).toBe('Server Edit');
      expect(items[0].quantity).toBe(10);
    });
  });

  // ========================================
  // UPLOAD SYNC (Pending Operations)
  // ========================================

  describe('Upload Sync - Pending Operations', () => {
    beforeEach(async () => {
      // Setup reference data
      const referenceData: ShoppingReferenceData = {
        stores: [
          {
            id: 1,
            name: 'Store 1',
            address: null,
            code: 'S1',
            is_active: true,
            created_at: new Date()
          }
        ],
        product_groups: [
          {
            id: 1,
            parent_id: null,
            name: 'Products',
            code: 'PROD',
            is_active: true,
            created_at: new Date()
          }
        ],
        product_group_hierarchy: [
          { ancestor_id: 1, descendant_id: 1, depth: 0 }
        ]
      };

      await manager.syncShoppingReferenceData(referenceData);
    });

    it('should get pending shopping operations', async () => {
      // Create offline list + items
      const listTempId = await manager.createShoppingList({
        creator_id: 1,
        name: 'Offline List',
        description: null,
        is_active: true
      });

      await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listTempId,
        store_id: 1,
        product_group_id: 1,
        product_name: 'Offline Item 1',
        quantity: 1,
        unit: null,
        comment: null
      });

      await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listTempId,
        store_id: 1,
        product_group_id: 1,
        product_name: 'Offline Item 2',
        quantity: 2,
        unit: null,
        comment: null
      });

      // Get pending operations
      const pending = await manager.getPendingShoppingOperations();

      expect(pending.length).toBeGreaterThanOrEqual(3); // 1 list + 2 items
      expect(pending.filter(op => op.entity_type === 'shopping_list')).toHaveLength(1);
      expect(pending.filter(op => op.entity_type === 'shopping_list_item')).toHaveLength(2);
    });

    it('should confirm pending operations after successful upload', async () => {
      const listTempId = await manager.createShoppingList({
        creator_id: 1,
        name: 'Test List',
        description: null,
        is_active: true
      });

      const itemTempId = await manager.addItemToList({
        creator_id: 1,
        shopping_list_temp_id: listTempId,
        store_id: 1,
        product_group_id: 1,
        product_name: 'Test Item',
        quantity: 1,
        unit: null,
        comment: null
      });

      // Verify pending operations exist
      let pending = await manager.getPendingShoppingOperations();
      expect(pending.length).toBeGreaterThanOrEqual(2);

      // Simulate successful server upload
      await manager.confirmPendingShoppingOperation(listTempId, 100, 'shopping_list');
      await manager.confirmPendingShoppingOperation(itemTempId, 200, 'shopping_list_item');

      // Verify pending operations removed
      pending = await manager.getPendingShoppingOperations();
      expect(pending.filter(op => op.temp_id === listTempId)).toHaveLength(0);
      expect(pending.filter(op => op.temp_id === itemTempId)).toHaveLength(0);

      // Verify local records have server IDs
      const lists = await manager.queryShoppingLists({ is_active: true });
      expect(lists[0].id).toBe(100);
      expect(lists[0].sync_status).toBe('synced');

      const items = await manager.queryShoppingListItems({
        shopping_list_temp_id: listTempId
      });
      expect(items[0].id).toBe(200);
      expect(items[0].sync_status).toBe('synced');
    });

    it('should retry failed pending operations', async () => {
      const listTempId = await manager.createShoppingList({
        creator_id: 1,
        name: 'Test List',
        description: null,
        is_active: true
      });

      // Get initial pending operation
      let pending = await manager.getPendingShoppingOperations();
      const listOp = pending.find(op => op.temp_id === listTempId);
      expect(listOp).toBeDefined();
      expect(listOp!.attempts).toBe(0);
      expect(listOp!.last_error).toBeNull();

      // Simulate upload failure
      await manager.retryPendingShoppingOperation(listTempId, 'Network timeout');

      // Verify attempts incremented and error logged
      pending = await manager.getPendingShoppingOperations();
      const updatedOp = pending.find(op => op.temp_id === listTempId);
      expect(updatedOp).toBeDefined();
      expect(updatedOp!.attempts).toBe(1);
      expect(updatedOp!.last_error).toBe('Network timeout');
    });
  });
});

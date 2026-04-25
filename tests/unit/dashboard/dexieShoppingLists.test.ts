/**
 * Dexie unit tests — shoppingLists + shoppingListItems lifecycle.
 * Covers: create list → add item → soft-delete list → items no longer in active view.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { DexieManager } from '@db/dexie/DexieManager';
import {
  createShoppingList,
  createShoppingListItem,
  deleteShoppingList,
  queryShoppingLists,
  queryShoppingListItems,
} from '@db/dexie/operations/shoppingOperations';

describe('Dexie shoppingLists + shoppingListItems — lifecycle', () => {
  let manager: DexieManager;

  beforeEach(async () => {
    manager = new DexieManager();
    await manager.init();
  });

  afterEach(async () => {
    if (manager.isReady()) {
      await manager.clearAll();
      await manager.close();
    }
  });

  it('create list + add item + soft-delete list hides list from active view', async () => {
    const listTempId = await createShoppingList({
      creator_id: 1,
      name: 'Groceries',
      description: null,
      is_active: true,
      sync_hash: null,
      content_hash: null,
      synced_at: null,
    });

    const itemTempId = await createShoppingListItem({
      creator_id: 1,
      shopping_list_temp_id: listTempId,
      store_id: 1,
      product_group_id: 1,
      product_name: 'Milk',
      quantity: 2,
      unit: 'л',
      comment: null,
      position: 0,
      is_completed: false,
      completed_at: null,
      sync_hash: null,
      content_hash: null,
      version: 1,
      deleted_at: null,
      last_modified_by: 1,
      synced_at: null,
    });

    expect(itemTempId).toBeTruthy();

    const itemsBefore = await queryShoppingListItems(listTempId);
    expect(itemsBefore).toHaveLength(1);
    expect(itemsBefore[0].product_name).toBe('Milk');

    const activeListsBefore = await queryShoppingLists({ is_active: true });
    expect(activeListsBefore).toHaveLength(1);

    await deleteShoppingList(listTempId);

    const activeListsAfter = await queryShoppingLists({ is_active: true });
    expect(activeListsAfter).toHaveLength(0);

    // List itself is soft-deleted (sync_status='deleted'); items remain attached
    // but the list no longer surfaces in active UI queries.
    const deleted = await queryShoppingLists({ sync_status: 'deleted' });
    expect(deleted).toHaveLength(1);
    expect(deleted[0].temp_id).toBe(listTempId);
  });

  it('queryShoppingListItems returns empty for unknown list temp_id (negative)', async () => {
    const res = await queryShoppingListItems('nonexistent-list-id');
    expect(res).toEqual([]);
  });
});

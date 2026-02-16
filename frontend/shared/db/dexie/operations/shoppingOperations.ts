/**
 * Shopping Lists operations (CRUD)
 * Упрощенная реализация для миграции
 */

import { db } from '../core/database';
import { logger } from '../utils/logger';
import { validateShoppingItem } from '../utils/validation';
import { generateUUID } from '../utils/hash';
import type {
  LocalShoppingList,
  LocalShoppingListItem,
  LocalStore,
  LocalProductGroup,
  ShoppingListFilters,
  StoreFilters,
  ProductGroupFilters
} from '../types/shopping';

/**
 * Create shopping list
 *
 * @param list - Shopping list data
 * @returns temp_id
 */
export async function createShoppingList(
  list: Omit<LocalShoppingList, 'id' | 'temp_id' | 'sync_status' | 'created_at' | 'updated_at'>
): Promise<string> {
  logger.debug('[shoppingOps] createShoppingList', list);

  const temp_id = generateUUID();

  const newList: LocalShoppingList = {
    id: null,
    temp_id,
    ...list,
    sync_status: 'pending',
    created_at: new Date(),
    updated_at: new Date()
  };

  await db.shoppingLists.add(newList);

  logger.info('[shoppingOps] ✅ Shopping list created', { temp_id });
  return temp_id;
}

/**
 * Query shopping lists с фильтрами
 */
export async function queryShoppingLists(
  filters?: ShoppingListFilters
): Promise<LocalShoppingList[]> {
  logger.debug('[shoppingOps] queryShoppingLists', filters);

  let results = await db.shoppingLists.toArray();

  // CRITICAL FIX: Filter out deleted lists by default (data integrity best practice)
  // Prevents UI from displaying soft-deleted records (avoids user confusion)
  // Deleted lists only visible when explicitly requested via filters.sync_status === 'deleted'
  results = results.filter(list => {
    // Default filter: exclude deleted lists unless explicitly requested
    if (!filters?.sync_status || filters.sync_status !== 'deleted') {
      if (list.sync_status === 'deleted') return false;
    }
    return true;
  });

  // Apply user-provided filters
  if (filters) {
    results = results.filter(list => {
      if (filters.is_active !== undefined && list.is_active !== filters.is_active) return false;
      if (filters.sync_status && list.sync_status !== filters.sync_status) return false;
      return true;
    });
  }

  return results.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

/**
 * Create shopping list item
 *
 * @param item - Shopping item data
 * @returns temp_id
 */
export async function createShoppingListItem(
  item: Omit<LocalShoppingListItem, 'id' | 'temp_id' | 'sync_status' | 'created_at' | 'updated_at'>
): Promise<string> {
  logger.debug('[shoppingOps] createShoppingListItem', item);

  // Validate
  validateShoppingItem({
    name: item.product_name,
    quantity: item.quantity,
    position: item.position
  });

  const temp_id = generateUUID();

  const newItem: LocalShoppingListItem = {
    id: null,
    temp_id,
    ...item,
    sync_status: 'pending',
    created_at: new Date(),
    updated_at: new Date()
  };

  await db.shoppingListItems.add(newItem);

  logger.info('[shoppingOps] ✅ Shopping item created', { temp_id });
  return temp_id;
}

/**
 * Query shopping list items для списка
 */
export async function queryShoppingListItems(
  shopping_list_temp_id: string
): Promise<LocalShoppingListItem[]> {
  logger.debug('[shoppingOps] queryShoppingListItems', { shopping_list_temp_id });

  const items = await db.shoppingListItems
    .where('shopping_list_temp_id')
    .equals(shopping_list_temp_id)
    .toArray();

  return items.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

/**
 * Update shopping list item
 */
export async function updateShoppingListItem(
  temp_id: string,
  updates: Partial<Pick<LocalShoppingListItem, 'product_name' | 'quantity' | 'is_completed' | 'position'>>
): Promise<void> {
  logger.debug('[shoppingOps] updateShoppingListItem', { temp_id, updates });

  await db.shoppingListItems.where('temp_id').equals(temp_id).modify({
    ...updates,
    sync_status: 'pending',
    updated_at: new Date()
  });

  logger.info('[shoppingOps] ✅ Shopping item updated', { temp_id });
}

/**
 * Delete shopping list item (soft delete)
 */
export async function deleteShoppingListItem(temp_id: string): Promise<void> {
  logger.debug('[shoppingOps] deleteShoppingListItem', { temp_id });

  await db.shoppingListItems.where('temp_id').equals(temp_id).modify({
    sync_status: 'deleted',
    updated_at: new Date()
  });

  logger.info('[shoppingOps] ✅ Shopping item deleted', { temp_id });
}

/**
 * Bulk insert shopping list items
 */
export async function bulkInsertShoppingListItems(
  items: LocalShoppingListItem[]
): Promise<void> {
  logger.info('[shoppingOps] bulkInsertShoppingListItems', { count: items.length });

  await db.shoppingListItems.bulkPut(items);

  logger.info('[shoppingOps] ✅ Bulk insert complete', { count: items.length });
}

/**
 * Query stores с фильтрами
 */
export async function queryStores(
  filters?: StoreFilters
): Promise<LocalStore[]> {
  logger.debug('[shoppingOps] queryStores', filters);

  let results = await db.stores.toArray();

  // Apply filters
  if (filters) {
    results = results.filter(store => {
      if (filters.is_active !== undefined && store.is_active !== filters.is_active) return false;
      return true;
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Query product groups с фильтрами
 */
export async function queryProductGroups(
  filters?: ProductGroupFilters
): Promise<LocalProductGroup[]> {
  logger.debug('[shoppingOps] queryProductGroups', filters);

  let results = await db.productGroups.toArray();

  // Apply filters
  if (filters) {
    results = results.filter(group => {
      if (filters.parent_id !== undefined && group.parent_id !== filters.parent_id) return false;
      if (filters.is_active !== undefined && group.is_active !== filters.is_active) return false;
      return true;
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================================================
// Shopping List (Header) Operations
// ============================================================================

/**
 * Update shopping list
 * @param temp_id - Shopping list temp_id
 * @param updates - Partial updates
 */
export async function updateShoppingList(
  temp_id: string,
  updates: Partial<Omit<LocalShoppingList, 'id' | 'temp_id' | 'creator_id' | 'created_at'>>
): Promise<void> {
  logger.debug('[shoppingOps] updateShoppingList', { temp_id, updates });

  await db.shoppingLists.where('temp_id').equals(temp_id).modify({
    ...updates,
    sync_status: 'pending',  // Mark as needing sync
    updated_at: new Date()
  });

  logger.info('[shoppingOps] ✅ Shopping list updated', { temp_id });
}

/**
 * Delete shopping list (soft delete)
 * @param temp_id - Shopping list temp_id
 */
export async function deleteShoppingList(temp_id: string): Promise<void> {
  logger.debug('[shoppingOps] deleteShoppingList', { temp_id });

  // Soft delete: mark as deleted without removing from Dexie
  await db.shoppingLists.where('temp_id').equals(temp_id).modify({
    sync_status: 'deleted',
    is_active: false,  // Mark inactive
    synced_at: null,  // Reset synced_at to trigger upload
    updated_at: new Date()
  });

  logger.info('[shoppingOps] ✅ Shopping list soft-deleted', { temp_id });
}

/**
 * Update shopping list statistics (total_items, completed_items, completion_percentage)
 * Call this after creating/updating/deleting items in the list
 *
 * @param shopping_list_temp_id - Shopping list temp_id
 */
export async function updateShoppingListStats(shopping_list_temp_id: string): Promise<void> {
  logger.debug('[shoppingOps] updateShoppingListStats', { shopping_list_temp_id });

  // Count items in this list (exclude soft-deleted)
  const items = await db.shoppingListItems
    .where('shopping_list_temp_id')
    .equals(shopping_list_temp_id)
    .toArray();

  const activeItems = items.filter(i => i.sync_status !== 'deleted');
  const total = activeItems.length;
  const completed = activeItems.filter(i => i.is_completed).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  await db.shoppingLists.where('temp_id').equals(shopping_list_temp_id).modify({
    total_items: total,
    completed_items: completed,
    completion_percentage: percentage,
    updated_at: new Date()
  });

  logger.debug('[shoppingOps] Stats updated', {
    shopping_list_temp_id,
    total,
    completed,
    percentage
  });
}

/**
 * Get shopping list by temp_id
 * @param temp_id - Shopping list temp_id
 * @returns Shopping list or undefined
 */
export async function getShoppingListByTempId(temp_id: string): Promise<LocalShoppingList | undefined> {
  logger.debug('[shoppingOps] getShoppingListByTempId', { temp_id });
  return await db.shoppingLists.where('temp_id').equals(temp_id).first();
}

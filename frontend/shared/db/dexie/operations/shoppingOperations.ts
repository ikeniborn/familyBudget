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
  ShoppingListFilters
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

  // Apply filters
  if (filters) {
    results = results.filter(list => {
      if (filters.user_id && list.user_id !== filters.user_id) return false;
      if (filters.is_completed !== undefined && list.is_completed !== filters.is_completed) return false;
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
    name: item.name,
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

  return items.sort((a, b) => a.position - b.position);
}

/**
 * Update shopping list item
 */
export async function updateShoppingListItem(
  temp_id: string,
  updates: Partial<Pick<LocalShoppingListItem, 'name' | 'quantity' | 'is_purchased' | 'position'>>
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

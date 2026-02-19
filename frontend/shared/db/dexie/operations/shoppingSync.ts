/**
 * Shopping Lists Sync Operations
 * Синхронизация shopping lists (offline → server, server → local)
 */

import { db } from '../core/database';
import { logger } from '../utils/logger';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import type {
  LocalShoppingList,
  LocalShoppingListItem
} from '../types/shopping';

/**
 * Upload pending shopping operations to server
 */
export async function uploadPendingShoppingOperations(): Promise<{
  success: boolean;
  uploaded: number;
  failed: number;
}> {
  logger.info('[shoppingSync] Uploading pending shopping operations...');

  // Get pending shopping list items
  const pendingItems = await db.shoppingListItems
    .where('sync_status').equals('pending')
    .toArray();

  if (pendingItems.length === 0) {
    logger.info('[shoppingSync] No pending shopping operations');
    return { success: true, uploaded: 0, failed: 0 };
  }

  logger.info('[shoppingSync] Found pending items', { count: pendingItems.length });

  let uploaded = 0;
  let failed = 0;

  for (const item of pendingItems) {
    try {
      await uploadShoppingItem(item);
      uploaded++;
    } catch (error) {
      logger.error('[shoppingSync] ❌ Item upload failed:', error);
      failed++;
    }
  }

  logger.info('[shoppingSync] Upload complete', { uploaded, failed });

  return {
    success: failed === 0,
    uploaded,
    failed
  };
}

/**
 * Upload single shopping item to server
 */
async function uploadShoppingItem(item: LocalShoppingListItem): Promise<void> {
  logger.debug('[shoppingSync] Uploading shopping item', {
    temp_id: item.temp_id,
    id: item.id
  });

  let endpoint: string;
  let method: string;

  // Resolve server shopping_list_id from Dexie (needed for POST)
  let shoppingListServerId: number | null = null;
  if (item.id === null) {
    const list = await db.shoppingLists.where('temp_id').equals(item.shopping_list_temp_id).first();
    shoppingListServerId = list?.id ?? null;
    if (!shoppingListServerId) {
      throw new Error(`Cannot upload item: shopping list not yet synced (temp_id: ${item.shopping_list_temp_id})`);
    }
  }

  if (item.id === null) {
    // Create
    endpoint = '/api/v1/shopping-list-items';
    method = 'POST';
  } else {
    // Update
    endpoint = `/api/v1/shopping-list-items/${item.id}`;
    method = 'PUT';
  }

  // Send only API-compatible fields (exclude Dexie-specific metadata)
  const apiPayload = {
    shopping_list_id: shoppingListServerId,
    product_name: item.product_name,
    quantity: item.quantity,
    unit: item.unit,
    comment: item.comment,
    store_id: item.store_id,
    product_group_id: item.product_group_id,
    position: item.position,
    is_completed: item.is_completed,
    completed_at: item.completed_at
  };

  const response = await fetchWithTimeout(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(apiPayload),
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  // Update local item as synced
  if (item.id === null) {
    const result = await response.json();
    await db.shoppingListItems.where('temp_id').equals(item.temp_id).modify({
      id: result.id,
      sync_status: 'synced'
    });
  } else {
    await db.shoppingListItems.where('temp_id').equals(item.temp_id).modify({
      sync_status: 'synced'
    });
  }

  logger.info('[shoppingSync] ✅ Item uploaded', { temp_id: item.temp_id });
}

/**
 * Download shopping lists from server
 */
export async function downloadShoppingLists(userId: number): Promise<{
  success: boolean;
  count: number;
}> {
  logger.info('[shoppingSync] Downloading shopping lists...', { userId });

  try {
    const response = await fetchWithTimeout(
      `/api/v1/shopping-lists?user_id=${userId}`,
      {
        method: 'GET',
        credentials: 'include'
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch shopping lists: ${response.status}`);
    }

    const lists: LocalShoppingList[] = await response.json();

    // Clear existing lists
    await db.shoppingLists.where('user_id').equals(userId).delete();

    // Bulk insert
    await db.shoppingLists.bulkPut(lists);

    logger.info('[shoppingSync] ✅ Shopping lists downloaded', { count: lists.length });
    return { success: true, count: lists.length };
  } catch (error) {
    logger.error('[shoppingSync] ❌ Shopping lists download failed:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Download shopping list items from server
 */
export async function downloadShoppingListItems(
  shopping_list_temp_id: string
): Promise<{ success: boolean; count: number }> {
  logger.info('[shoppingSync] Downloading shopping items...', { shopping_list_temp_id });

  try {
    const response = await fetchWithTimeout(
      `/api/v1/shopping-items?shopping_list_temp_id=${shopping_list_temp_id}`,
      {
        method: 'GET',
        credentials: 'include'
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch shopping items: ${response.status}`);
    }

    const items: LocalShoppingListItem[] = await response.json();

    // Clear existing items for this list
    await db.shoppingListItems
      .where('shopping_list_temp_id')
      .equals(shopping_list_temp_id)
      .delete();

    // Bulk insert
    await db.shoppingListItems.bulkPut(items);

    logger.info('[shoppingSync] ✅ Shopping items downloaded', { count: items.length });
    return { success: true, count: items.length };
  } catch (error) {
    logger.error('[shoppingSync] ❌ Shopping items download failed:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Full sync - upload pending + download server data
 */
export async function fullShoppingSync(userId: number): Promise<{
  success: boolean;
  uploaded: number;
  downloaded: number;
  failed: number;
}> {
  logger.info('[shoppingSync] Starting full sync...', { userId });

  // 1. Upload pending lists (headers)
  const uploadListsResult = await uploadPendingShoppingLists();

  // 2. Upload pending items
  const uploadItemsResult = await uploadPendingShoppingOperations();

  // 3. Download lists from server
  const downloadResult = await downloadShoppingLists(userId);

  const result = {
    success: uploadListsResult.success && uploadItemsResult.success && downloadResult.success,
    uploaded: uploadListsResult.uploaded + uploadItemsResult.uploaded,
    downloaded: downloadResult.count,
    failed: uploadListsResult.failed + uploadItemsResult.failed
  };

  logger.info('[shoppingSync] Full sync complete', result);

  return result;
}

// ============================================================================
// Shopping Lists (Headers) Upload
// ============================================================================

/**
 * Upload pending shopping lists (headers) to server
 * Handles create/update/delete operations with Last-write-wins conflict resolution
 */
export async function uploadPendingShoppingLists(): Promise<{
  success: boolean;
  uploaded: number;
  failed: number;
}> {
  logger.info('[shoppingSync] Uploading pending shopping lists...');

  // Get pending shopping lists (pending or deleted status)
  const pendingLists = await db.shoppingLists
    .where('sync_status')
    .anyOf(['pending', 'deleted'])
    .toArray();

  if (pendingLists.length === 0) {
    logger.info('[shoppingSync] No pending shopping lists');
    return { success: true, uploaded: 0, failed: 0 };
  }

  logger.info('[shoppingSync] Found pending lists', { count: pendingLists.length });

  let uploaded = 0;
  let failed = 0;

  for (const list of pendingLists) {
    try {
      await uploadShoppingList(list);
      uploaded++;
    } catch (error) {
      logger.error('[shoppingSync] ❌ List upload failed:', error);
      failed++;
    }
  }

  logger.info('[shoppingSync] Upload complete', { uploaded, failed });

  return {
    success: failed === 0,
    uploaded,
    failed
  };
}

/**
 * Upload single shopping list to server
 * Handles create/update/delete with Last-write-wins conflict resolution
 */
async function uploadShoppingList(list: LocalShoppingList): Promise<void> {
  logger.debug('[shoppingSync] Uploading shopping list', {
    temp_id: list.temp_id,
    id: list.id,
    name: list.name,
    sync_status: list.sync_status
  });

  let endpoint: string;
  let method: string;

  if (list.id === null && list.sync_status !== 'deleted') {
    // CREATE: new list hasn't been synced yet
    endpoint = '/api/v1/shopping-lists';
    method = 'POST';
  } else if (list.sync_status === 'deleted') {
    // DELETE: list marked for deletion
    if (list.id === null) {
      // List was created offline and deleted before sync - just remove locally
      await db.shoppingLists.where('temp_id').equals(list.temp_id).delete();
      logger.info('[shoppingSync] ✅ Local-only list deleted', { temp_id: list.temp_id });
      return;
    }
    endpoint = `/api/v1/shopping-lists/${list.id}`;
    method = 'DELETE';
  } else {
    // UPDATE: list already has server ID
    endpoint = `/api/v1/shopping-lists/${list.id}`;
    method = 'PUT';
  }

  const response = await fetchWithTimeout(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method !== 'DELETE' ? JSON.stringify({
      name: list.name,
      description: list.description,
      is_active: list.is_active
    }) : undefined,
    credentials: 'include'
  });

  if (!response.ok) {
    // Last-write-wins: 404 on DELETE means someone already deleted it
    if (response.status === 404 && method === 'DELETE') {
      logger.info('[shoppingSync] List already deleted on server', { temp_id: list.temp_id });
      await db.shoppingLists.where('temp_id').equals(list.temp_id).delete();
      return;
    }

    throw new Error(`Server error: ${response.status}`);
  }

  // Update local list as synced
  if (method === 'DELETE') {
    await db.shoppingLists.where('temp_id').equals(list.temp_id).delete();
    logger.info('[shoppingSync] ✅ List deleted', { temp_id: list.temp_id });
  } else if (list.id === null) {
    // CREATE response contains server-assigned ID
    const result = await response.json();
    await db.shoppingLists.where('temp_id').equals(list.temp_id).modify({
      id: result.id,  // ← Server assigns permanent ID
      sync_status: 'synced',
      synced_at: new Date()
    });
    logger.info('[shoppingSync] ✅ List created', { temp_id: list.temp_id, id: result.id });
  } else {
    // UPDATE
    await db.shoppingLists.where('temp_id').equals(list.temp_id).modify({
      sync_status: 'synced',
      synced_at: new Date()
    });
    logger.info('[shoppingSync] ✅ List updated', { temp_id: list.temp_id });
  }
}

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
    .where('sync_status').anyOf(['pending', 'deleted'])
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

  // Handle soft-deleted items — send DELETE to server then hard-delete locally
  if (item.sync_status === 'deleted') {
    if (item.id === null) {
      // Never synced to server — just remove locally
      await db.shoppingListItems.where('temp_id').equals(item.temp_id).delete();
      logger.info('[shoppingSync] ✅ Local-only item removed', { temp_id: item.temp_id });
      return;
    }
    const response = await fetchWithTimeout(`/api/v1/shopping-list-items/${item.id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Server error: ${response.status}`);
    }
    // Hard-delete from Dexie (server confirmed deletion or 404 = already deleted)
    await db.shoppingListItems.where('temp_id').equals(item.temp_id).delete();
    logger.info('[shoppingSync] ✅ Item deleted on server and locally', {
      temp_id: item.temp_id,
      id: item.id
    });
    return;
  }

  let endpoint: string;
  let method: string;

  if (item.id === null) {
    // Create
    endpoint = '/api/v1/shopping-items';
    method = 'POST';
  } else {
    // Update
    endpoint = `/api/v1/shopping-items/${item.id}`;
    method = 'PUT';
  }

  const response = await fetchWithTimeout(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(item),
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

  // 1. Upload pending operations
  const uploadResult = await uploadPendingShoppingOperations();

  // 2. Download lists from server
  const downloadResult = await downloadShoppingLists(userId);

  const result = {
    success: uploadResult.success && downloadResult.success,
    uploaded: uploadResult.uploaded,
    downloaded: downloadResult.count,
    failed: uploadResult.failed
  };

  logger.info('[shoppingSync] Full sync complete', result);

  return result;
}

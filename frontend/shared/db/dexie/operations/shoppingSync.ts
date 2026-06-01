/**
 * Shopping Lists Sync Operations
 * Синхронизация shopping lists (offline → server, server → local)
 */

import { db } from '../core/database';
import { logger } from '../utils/logger';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import type {
  LocalShoppingList,
  LocalShoppingListItem,
  ServerShoppingListCard
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
    await db.shoppingListItems.where('temp_id').equals(item.temp_id).delete();
    logger.info('[shoppingSync] ✅ Item deleted on server and locally', {
      temp_id: item.temp_id,
      id: item.id
    });
    return;
  }

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
    completed_at: item.completed_at,
    temp_id: item.temp_id,
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
    if (response.status === 404 && method === 'PUT') {
      // Item was deleted server-side — recreate via POST
      const createResp = await fetchWithTimeout('/api/v1/shopping-list-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...apiPayload, shopping_list_id: item.shopping_list_id ?? shoppingListServerId }),
        credentials: 'include'
      });
      if (createResp.ok) {
        const result = await createResp.json();
        await db.shoppingListItems.where('temp_id').equals(item.temp_id).modify({
          id: result.id,
          sync_status: 'synced'
        });
        logger.info('[shoppingSync] Item recreated via POST after 404', { temp_id: item.temp_id, new_id: result.id });
        return;
      }
      throw new Error(`Server error on recreate: ${createResp.status}`);
    }
    throw new Error(`Server error: ${response.status}`);
  }

  // Update local item as synced
  if (item.id === null) {
    const result = await response.json();
    await db.shoppingListItems.where('temp_id').equals(item.temp_id).modify({
      id: result.id,
      shopping_list_id: result.shopping_list_id ?? shoppingListServerId,
      sync_status: 'synced'
    });
  } else {
    await db.shoppingListItems.where('temp_id').equals(item.temp_id).modify({
      shopping_list_id: shoppingListServerId,
      sync_status: 'synced'
    });
  }

  logger.info('[shoppingSync] ✅ Item uploaded', { temp_id: item.temp_id });
}

/**
 * Download shopping lists from server.
 *
 * Shared-references model: returns ALL lists (no user_id filtering).
 * Replaces only rows with sync_status='synced'; pending and deleted
 * local edits are preserved for the next upload pass.
 */
export async function downloadShoppingLists(): Promise<{
  success: boolean;
  count: number;
}> {
  logger.info('[shoppingSync] Downloading shopping lists...');

  try {
    const response = await fetchWithTimeout('/api/v1/shopping-lists', {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch shopping lists: ${response.status}`);
    }

    const payload = await response.json();
    const serverLists: ServerShoppingListCard[] = payload.shopping_lists ?? [];

    const now = new Date();
    const localLists: LocalShoppingList[] = serverLists.map(card => ({
      id: card.id,
      temp_id: card.temp_id ?? `server-${card.id}`,
      creator_id: card.creator_id,
      name: card.name,
      description: card.description,
      is_active: card.is_active,
      sync_status: 'synced',
      sync_hash: null,
      content_hash: null,
      created_at: new Date(card.created_at),
      updated_at: new Date(card.updated_at),
      synced_at: now,
      total_items: card.total_items,
      completed_items: card.completed_items,
      completion_percentage: card.completion_percentage,
    }));

    // Shared model: replace only synced rows; preserve pending/deleted local edits.
    await db.shoppingLists.where('sync_status').equals('synced').delete();
    await db.shoppingLists.bulkPut(localLists);

    logger.info('[shoppingSync] ✅ Shopping lists downloaded', { count: localLists.length });
    return { success: true, count: localLists.length };
  } catch (error) {
    logger.error('[shoppingSync] ❌ Shopping lists download failed:', error);
    return { success: false, count: 0 };
  }
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

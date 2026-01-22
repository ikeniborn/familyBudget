/**
 * Shopping Lists Sync Operations (task-012)
 *
 * Handles bidirectional sync between PGlite and backend:
 * - Initial sync: Download reference data (stores, product groups, hierarchy)
 * - Incremental sync: Download delta changes (lists and items)
 * - Upload sync: Upload pending operations to server
 * - Conflict resolution: LWW (Last-Write-Wins) strategy
 */

import type { PGlite } from '@electric-sql/pglite';
import type {
  LocalStore,
  LocalProductGroup,
  LocalProductGroupHierarchy,
  LocalShoppingList,
  LocalShoppingListItem,
  LocalPendingOperation
} from '../types/models';
import type { ShoppingConflictDetection } from '../types/conflicts';
import { ShoppingConflictManager } from '../ShoppingConflictManager';
import { logger } from '../utils/logger';

// ========================================
// TYPE DEFINITIONS
// ========================================

/**
 * Shopping reference data from server (initial sync)
 */
export interface ShoppingReferenceData {
  stores: LocalStore[];
  product_groups: LocalProductGroup[];
  product_group_hierarchy: LocalProductGroupHierarchy[];
}

/**
 * Delta sync response from server (incremental sync)
 */
export interface ShoppingDeltaSyncResponse {
  created: {
    lists: LocalShoppingList[];
    items: LocalShoppingListItem[];
  };
  updated: {
    lists: LocalShoppingList[];
    items: LocalShoppingListItem[];
  };
  deleted: {
    list_ids: number[];
    item_ids: number[];
  };
  server_time: string; // ISO 8601
}

/**
 * Batch sync request for uploading pending operations
 */
export interface BatchSyncOperation {
  operation: 'create' | 'update' | 'delete';
  entity_type: 'shopping_list' | 'shopping_list_item';
  temp_id?: string;
  server_id?: number | null;
  payload: Record<string, unknown>;
}

/**
 * Batch sync response from server
 */
export interface BatchSyncResponse {
  results: Array<{
    temp_id?: string;
    server_id?: number;
    status: 'success' | 'conflict' | 'error';
    error?: string;
    conflict_type?: 'update_update' | 'update_delete' | 'delete_update';
    server_version?: number;
  }>;
}

/**
 * Sync progress callback
 */
export type SyncProgressCallback = (progress: {
  phase: 'reference' | 'delta' | 'upload' | 'complete';
  message: string;
  current?: number;
  total?: number;
}) => void;

// ========================================
// INITIAL SYNC (Reference Data)
// ========================================

/**
 * Perform initial sync for reference data
 *
 * Downloads stores, product groups, and hierarchy from server
 * and bulk inserts into PGlite.
 *
 * @param db - PGlite instance
 * @param referenceData - Reference data from server
 * @param onProgress - Optional progress callback
 */
export async function syncReferenceData(
  db: PGlite,
  referenceData: ShoppingReferenceData,
  onProgress?: SyncProgressCallback
): Promise<void> {
  logger.info('[SHOPPING_SYNC] Starting reference data sync', {
    stores: referenceData.stores.length,
    product_groups: referenceData.product_groups.length,
    hierarchy: referenceData.product_group_hierarchy.length
  });

  onProgress?.({
    phase: 'reference',
    message: 'Syncing stores...',
    current: 0,
    total: referenceData.stores.length
  });

  // Bulk insert stores
  await bulkInsertStores(db, referenceData.stores);

  onProgress?.({
    phase: 'reference',
    message: 'Syncing product groups...',
    current: referenceData.stores.length,
    total: referenceData.stores.length + referenceData.product_groups.length
  });

  // Bulk insert product groups
  await bulkInsertProductGroups(db, referenceData.product_groups);

  onProgress?.({
    phase: 'reference',
    message: 'Syncing hierarchy...',
    current: referenceData.stores.length + referenceData.product_groups.length,
    total: referenceData.stores.length + referenceData.product_groups.length + referenceData.product_group_hierarchy.length
  });

  // Bulk insert hierarchy
  await bulkInsertProductGroupHierarchy(db, referenceData.product_group_hierarchy);

  logger.info('[SHOPPING_SYNC] Reference data sync complete');
}

/**
 * Bulk insert stores into PGlite
 */
async function bulkInsertStores(db: PGlite, stores: LocalStore[]): Promise<void> {
  if (stores.length === 0) return;

  // Clear existing data (reference data is read-only, server is source of truth)
  await db.query('DELETE FROM local_stores');

  // Batch insert (use prepared statement for better performance)
  const batchSize = 100;
  for (let i = 0; i < stores.length; i += batchSize) {
    const batch = stores.slice(i, i + batchSize);

    for (const store of batch) {
      await db.query(`
        INSERT INTO local_stores (id, name, address, code, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          address = EXCLUDED.address,
          code = EXCLUDED.code,
          is_active = EXCLUDED.is_active,
          created_at = EXCLUDED.created_at
      `, [
        store.id,
        store.name,
        store.address,
        store.code,
        store.is_active,
        store.created_at
      ]);
    }
  }

  logger.debug('[SHOPPING_SYNC] Bulk inserted stores', { count: stores.length });
}

/**
 * Bulk insert product groups into PGlite
 */
async function bulkInsertProductGroups(db: PGlite, productGroups: LocalProductGroup[]): Promise<void> {
  if (productGroups.length === 0) return;

  // Clear existing data
  await db.query('DELETE FROM local_product_groups');

  const batchSize = 100;
  for (let i = 0; i < productGroups.length; i += batchSize) {
    const batch = productGroups.slice(i, i + batchSize);

    for (const pg of batch) {
      await db.query(`
        INSERT INTO local_product_groups (id, parent_id, name, code, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          parent_id = EXCLUDED.parent_id,
          name = EXCLUDED.name,
          code = EXCLUDED.code,
          is_active = EXCLUDED.is_active,
          created_at = EXCLUDED.created_at
      `, [
        pg.id,
        pg.parent_id,
        pg.name,
        pg.code,
        pg.is_active,
        pg.created_at
      ]);
    }
  }

  logger.debug('[SHOPPING_SYNC] Bulk inserted product groups', { count: productGroups.length });
}

/**
 * Bulk insert product group hierarchy into PGlite
 */
async function bulkInsertProductGroupHierarchy(
  db: PGlite,
  hierarchy: LocalProductGroupHierarchy[]
): Promise<void> {
  if (hierarchy.length === 0) return;

  // Clear existing data
  await db.query('DELETE FROM local_product_group_hierarchy');

  const batchSize = 100;
  for (let i = 0; i < hierarchy.length; i += batchSize) {
    const batch = hierarchy.slice(i, i + batchSize);

    for (const h of batch) {
      await db.query(`
        INSERT INTO local_product_group_hierarchy (ancestor_id, descendant_id, depth)
        VALUES ($1, $2, $3)
        ON CONFLICT (ancestor_id, descendant_id) DO UPDATE SET
          depth = EXCLUDED.depth
      `, [h.ancestor_id, h.descendant_id, h.depth]);
    }
  }

  logger.debug('[SHOPPING_SYNC] Bulk inserted hierarchy', { count: hierarchy.length });
}

// ========================================
// INCREMENTAL SYNC (Delta Changes)
// ========================================

/**
 * Apply delta sync changes to PGlite
 *
 * Handles created, updated, and deleted records with conflict resolution.
 *
 * @param db - PGlite instance
 * @param delta - Delta sync response from server
 * @param onProgress - Optional progress callback
 * @returns Number of conflicts detected
 */
export async function applyDeltaSync(
  db: PGlite,
  delta: ShoppingDeltaSyncResponse,
  onConflict?: (conflict: ShoppingConflictDetection) => Promise<void>,
  onProgress?: SyncProgressCallback
): Promise<number> {
  logger.info('[SHOPPING_SYNC] Applying delta sync', {
    created_lists: delta.created.lists.length,
    created_items: delta.created.items.length,
    updated_lists: delta.updated.lists.length,
    updated_items: delta.updated.items.length,
    deleted_lists: delta.deleted.list_ids.length,
    deleted_items: delta.deleted.item_ids.length
  });

  onProgress?.({
    phase: 'delta',
    message: 'Applying server changes...',
    current: 0,
    total: delta.created.lists.length + delta.created.items.length +
           delta.updated.lists.length + delta.updated.items.length
  });

  // Apply all changes in logical groups
  await applyCreatedRecords(db, delta.created);
  const conflictsCount = await applyUpdatedRecords(db, delta.updated, onConflict);
  await applyDeletedRecords(db, delta.deleted);

  logger.info('[SHOPPING_SYNC] Delta sync complete', { conflictsCount });

  return conflictsCount;
}

/**
 * Apply created records (lists and items) from server
 */
async function applyCreatedRecords(db: PGlite, created: { lists: LocalShoppingList[], items: LocalShoppingListItem[] }): Promise<void> {
  for (const list of created.lists) {
    await applyCreatedList(db, list);
  }

  for (const item of created.items) {
    await applyCreatedItem(db, item);
  }
}

/**
 * Apply updated records (lists and items) with conflict detection
 * @returns Number of conflicts detected
 */
async function applyUpdatedRecords(
  db: PGlite,
  updated: { lists: LocalShoppingList[], items: LocalShoppingListItem[] },
  onConflict?: (conflict: ShoppingConflictDetection) => Promise<void>
): Promise<number> {
  let conflictsCount = 0;

  for (const list of updated.lists) {
    const hasConflict = await applyUpdatedList(db, list, onConflict);
    if (hasConflict) conflictsCount++;
  }

  for (const item of updated.items) {
    const hasConflict = await applyUpdatedItem(db, item, onConflict);
    if (hasConflict) conflictsCount++;
  }

  return conflictsCount;
}

/**
 * Apply deleted records (lists and items) from server
 */
async function applyDeletedRecords(db: PGlite, deleted: { list_ids: number[], item_ids: number[] }): Promise<void> {
  for (const listId of deleted.list_ids) {
    await applyDeletedList(db, listId);
  }

  for (const itemId of deleted.item_ids) {
    await applyDeletedItem(db, itemId);
  }
}

/**
 * Apply created shopping list from server
 */
async function applyCreatedList(db: PGlite, list: LocalShoppingList): Promise<void> {
  // Check if list already exists (by server ID)
  const existing = await db.query(
    'SELECT id FROM local_shopping_lists WHERE id = $1',
    [list.id]
  );

  if (existing.rows.length > 0) {
    // Already exists - skip
    return;
  }

  // Insert new list
  await db.query(`
    INSERT INTO local_shopping_lists (
      id, temp_id, creator_id, name, description, is_active,
      sync_status, sync_hash, content_hash,
      created_at, updated_at, synced_at
    ) VALUES ($1, $2, $3, $4, $5, $6, 'synced', $7, $8, $9, $10, NOW())
  `, [
    list.id,
    list.temp_id || `server_${list.id}`,
    list.creator_id,
    list.name,
    list.description,
    list.is_active,
    list.sync_hash,
    list.content_hash,
    list.created_at,
    list.updated_at
  ]);
}

/**
 * Apply created shopping list item from server
 */
async function applyCreatedItem(db: PGlite, item: LocalShoppingListItem): Promise<void> {
  // Check if item already exists (by server ID)
  const existing = await db.query(
    'SELECT id FROM local_shopping_list_items WHERE id = $1',
    [item.id]
  );

  if (existing.rows.length > 0) {
    // Already exists - skip
    return;
  }

  // Insert new item
  await db.query(`
    INSERT INTO local_shopping_list_items (
      id, temp_id, creator_id, shopping_list_temp_id,
      store_id, product_group_id, product_name, quantity, unit, comment,
      is_completed, completed_at,
      sync_status, sync_hash, content_hash, version,
      deleted_at, last_modified_by,
      created_at, updated_at, synced_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
      'synced', $13, $14, $15, $16, $17, $18, $19, NOW()
    )
  `, [
    item.id,
    item.temp_id || `server_${item.id}`,
    item.creator_id,
    item.shopping_list_temp_id,
    item.store_id,
    item.product_group_id,
    item.product_name,
    item.quantity,
    item.unit,
    item.comment,
    item.is_completed,
    item.completed_at,
    item.sync_hash,
    item.content_hash,
    item.version,
    item.deleted_at,
    item.last_modified_by,
    item.created_at,
    item.updated_at
  ]);
}

/**
 * Apply updated shopping list from server (with conflict detection)
 *
 * Uses LWW (Last-Write-Wins) strategy for conflict resolution.
 *
 * @returns true if conflict detected
 */
async function applyUpdatedList(
  db: PGlite,
  serverList: LocalShoppingList,
  onConflict?: (conflict: ShoppingConflictDetection) => Promise<void>
): Promise<boolean> {
  // Fetch local version
  const result = await db.query(
    'SELECT * FROM local_shopping_lists WHERE id = $1',
    [serverList.id]
  );

  if (result.rows.length === 0) {
    // List doesn't exist locally - create it
    await applyCreatedList(db, serverList);
    return false;
  }

  const localList = result.rows[0] as LocalShoppingList;

  // Check for conflict (local has pending changes)
  if (localList.sync_status === 'pending') {
    // Detect conflict via ShoppingConflictManager
    const conflictManager = new ShoppingConflictManager(db);
    const conflict = await conflictManager.detectListConflict(localList, serverList);

    if (conflict && onConflict) {
      // Trigger manual resolution UI
      await onConflict(conflict);
      return true; // Conflict detected, awaiting user resolution
    }

    // FALLBACK: Existing LWW logic if no onConflict callback
    const serverTime = new Date(serverList.updated_at).getTime();
    const localTime = new Date(localList.updated_at).getTime();

    if (serverTime > localTime) {
      // Server wins - apply server changes
      logger.info('[CONFLICT] Server wins for list (LWW fallback)', { id: serverList.id });
      if (conflict) {
        await conflictManager.applyServerResolution(conflict);
      } else {
        // Manual update (old code path)
        await db.query(`
          UPDATE local_shopping_lists
          SET name = $2, description = $3, is_active = $4,
              sync_status = 'synced', updated_at = $5, synced_at = NOW()
          WHERE id = $1
        `, [
          serverList.id,
          serverList.name,
          serverList.description,
          serverList.is_active,
          serverList.updated_at
        ]);
      }
      return true; // Conflict resolved (server wins)
    } else {
      // Local wins - keep pending status
      logger.info('[CONFLICT] Local wins for list (LWW fallback)', { id: serverList.id });
      if (conflict) {
        await conflictManager.applyClientResolution(conflict);
      }
      return true; // Conflict resolved (local wins)
    }
  }

  // No conflict - apply server update
  await db.query(`
    UPDATE local_shopping_lists
    SET name = $2, description = $3, is_active = $4,
        sync_status = 'synced', updated_at = $5, synced_at = NOW()
    WHERE id = $1
  `, [
    serverList.id,
    serverList.name,
    serverList.description,
    serverList.is_active,
    serverList.updated_at
  ]);

  return false;
}

/**
 * Apply updated shopping list item from server (with conflict detection)
 *
 * Uses LWW (Last-Write-Wins) strategy for conflict resolution.
 *
 * @returns true if conflict detected
 */
async function applyUpdatedItem(
  db: PGlite,
  serverItem: LocalShoppingListItem,
  onConflict?: (conflict: ShoppingConflictDetection) => Promise<void>
): Promise<boolean> {
  // Fetch local version
  const result = await db.query(
    'SELECT * FROM local_shopping_list_items WHERE id = $1',
    [serverItem.id]
  );

  if (result.rows.length === 0) {
    // Item doesn't exist locally - create it
    await applyCreatedItem(db, serverItem);
    return false;
  }

  const localItem = result.rows[0] as LocalShoppingListItem;

  // Check for conflict (local has pending changes)
  if (localItem.sync_status === 'pending') {
    // Detect conflict via ShoppingConflictManager
    const conflictManager = new ShoppingConflictManager(db);
    const conflict = await conflictManager.detectItemConflict(localItem, serverItem);

    if (conflict && onConflict) {
      // Trigger manual resolution UI
      await onConflict(conflict);
      return true; // Conflict detected, awaiting user resolution
    }

    // FALLBACK: Existing LWW logic if no onConflict callback
    const serverTime = new Date(serverItem.updated_at).getTime();
    const localTime = new Date(localItem.updated_at).getTime();

    if (serverTime > localTime) {
      // Server wins - apply server changes
      logger.info('[CONFLICT] Server wins for item (LWW fallback)', { id: serverItem.id });
      if (conflict) {
        await conflictManager.applyServerResolution(conflict);
      } else {
        // Manual update (old code path)
        await db.query(`
          UPDATE local_shopping_list_items
          SET product_name = $2, quantity = $3, unit = $4, comment = $5,
              is_completed = $6, completed_at = $7, version = $8,
              sync_status = 'synced', updated_at = $9, synced_at = NOW()
          WHERE id = $1
        `, [
          serverItem.id,
          serverItem.product_name,
          serverItem.quantity,
          serverItem.unit,
          serverItem.comment,
          serverItem.is_completed,
          serverItem.completed_at,
          serverItem.version,
          serverItem.updated_at
        ]);
      }
      return true; // Conflict resolved (server wins)
    } else {
      // Local wins - keep pending status
      logger.info('[CONFLICT] Local wins for item (LWW fallback)', { id: serverItem.id });
      if (conflict) {
        await conflictManager.applyClientResolution(conflict);
      }
      return true; // Conflict resolved (local wins)
    }
  }

  // No conflict - apply server update
  await db.query(`
    UPDATE local_shopping_list_items
    SET product_name = $2, quantity = $3, unit = $4, comment = $5,
        is_completed = $6, completed_at = $7, version = $8,
        sync_status = 'synced', updated_at = $9, synced_at = NOW()
    WHERE id = $1
  `, [
    serverItem.id,
    serverItem.product_name,
    serverItem.quantity,
    serverItem.unit,
    serverItem.comment,
    serverItem.is_completed,
    serverItem.completed_at,
    serverItem.version,
    serverItem.updated_at
  ]);

  return false;
}

/**
 * Apply deleted shopping list from server
 */
async function applyDeletedList(db: PGlite, listId: number): Promise<void> {
  // Mark list as deleted
  await db.query(`
    UPDATE local_shopping_lists
    SET sync_status = 'deleted', updated_at = NOW()
    WHERE id = $1
  `, [listId]);
}

/**
 * Apply deleted shopping list item from server
 */
async function applyDeletedItem(db: PGlite, itemId: number): Promise<void> {
  // Soft delete item
  await db.query(`
    UPDATE local_shopping_list_items
    SET deleted_at = NOW(), sync_status = 'deleted', updated_at = NOW()
    WHERE id = $1
  `, [itemId]);
}

// ========================================
// UPLOAD SYNC (Pending Operations)
// ========================================

/**
 * Get pending shopping operations ready for upload
 *
 * @param db - PGlite instance
 * @returns Array of pending operations
 */
export async function getPendingShoppingOperations(
  db: PGlite
): Promise<LocalPendingOperation[]> {
  const result = await db.query(`
    SELECT * FROM local_pending_operations
    WHERE entity_type IN ('shopping_list', 'shopping_list_item')
      AND attempts < max_attempts
    ORDER BY created_at ASC
  `);

  return result.rows as LocalPendingOperation[];
}

/**
 * Confirm successful upload of pending operation
 *
 * Updates local record with server ID and marks as synced.
 *
 * @param db - PGlite instance
 * @param tempId - Client temp_id
 * @param serverId - Server-assigned ID
 * @param entityType - Entity type ('shopping_list' or 'shopping_list_item')
 */
export async function confirmPendingShoppingOperation(
  db: PGlite,
  tempId: string,
  serverId: number,
  entityType: 'shopping_list' | 'shopping_list_item'
): Promise<void> {
  // Update local record with server ID
  if (entityType === 'shopping_list') {
    await db.query(`
      UPDATE local_shopping_lists
      SET id = $2, sync_status = 'synced', synced_at = NOW()
      WHERE temp_id = $1
    `, [tempId, serverId]);
  } else {
    await db.query(`
      UPDATE local_shopping_list_items
      SET id = $2, sync_status = 'synced', synced_at = NOW()
      WHERE temp_id = $1
    `, [tempId, serverId]);
  }

  // Remove from pending operations
  await db.query(`
    DELETE FROM local_pending_operations
    WHERE temp_id = $1 AND entity_type = $2
  `, [tempId, entityType]);

  logger.debug('[SHOPPING_SYNC] Confirmed pending operation', { tempId, serverId, entityType });
}

/**
 * Retry failed pending operation
 *
 * Increments attempts counter and updates error message.
 *
 * @param db - PGlite instance
 * @param tempId - Client temp_id
 * @param error - Error message from server
 */
export async function retryPendingShoppingOperation(
  db: PGlite,
  tempId: string,
  error: string
): Promise<void> {
  await db.query(`
    UPDATE local_pending_operations
    SET attempts = attempts + 1,
        last_error = $2,
        updated_at = NOW()
    WHERE temp_id = $1
  `, [tempId, error]);

  logger.debug('[SHOPPING_SYNC] Retrying pending operation', { tempId, error });
}

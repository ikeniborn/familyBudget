/**
 * Shopping Lists operations (CRUD for Lists, Items, and Reference Data)
 * Phase 3: Full Offline Support
 */

import type { PGlite } from '@electric-sql/pglite';
import type {
  LocalShoppingList,
  LocalShoppingListItem,
  LocalStore,
  LocalProductGroup,
  LocalProductGroupHierarchy,
  ShoppingListFilters,
  ShoppingListItemFilters,
  StoreFilters,
  ProductGroupFilters,
  LocalPendingOperation
} from '../types/models';
import { calculateContentHash, generateUUID } from '../utils/hash';
import { DEFAULT_MAX_RETRY_ATTEMPTS } from '../features/featureFlags';
import { logger } from '../utils/logger';

// ========================================
// SHOPPING LIST OPERATIONS
// ========================================

/**
 * Create shopping list (offline-first)
 * Returns temp_id for client-side tracking
 *
 * @param db - PGlite instance
 * @param list - Shopping list data
 * @returns temp_id (UUID)
 */
export async function createShoppingList(
  db: PGlite,
  list: Omit<LocalShoppingList, 'id' | 'temp_id' | 'sync_status' | 'sync_hash' | 'content_hash' | 'created_at' | 'updated_at' | 'synced_at'>
): Promise<string> {
  const temp_id = generateUUID();
  const content_hash = await calculateContentHash(list as Record<string, unknown>);

  logger.debug('[SHOPPING] Creating list', { temp_id, list });

  // Insert list
  await db.query(`
    INSERT INTO local_shopping_lists (
      temp_id, creator_id, name, description, is_active,
      sync_status, content_hash, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW(), NOW())
  `, [
    temp_id,
    list.creator_id,
    list.name,
    list.description,
    list.is_active,
    content_hash
  ]);

  // Add to pending operations queue
  await addPendingOperation(db, {
    operation: 'create',
    entity_type: 'shopping_list',
    temp_id,
    server_id: null,
    payload: list as Record<string, unknown>,
    attempts: 0,
    max_attempts: DEFAULT_MAX_RETRY_ATTEMPTS,
    last_error: null,
    content_hash,
    created_at: new Date(),
    updated_at: new Date()
  } as LocalPendingOperation);

  logger.info('[SHOPPING] List created', { temp_id });

  return temp_id;
}

/**
 * Update shopping list
 *
 * @param db - PGlite instance
 * @param temp_id - List temp_id
 * @param updates - Fields to update
 */
export async function updateShoppingList(
  db: PGlite,
  temp_id: string,
  updates: Partial<Pick<LocalShoppingList, 'name' | 'description' | 'is_active'>>
): Promise<void> {
  logger.debug('[SHOPPING] Updating list', { temp_id, updates });

  // Build dynamic UPDATE query
  const setClauses: string[] = [];
  const params: unknown[] = [temp_id]; // $1 is temp_id
  let paramIndex = 2;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    params.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    params.push(updates.description);
  }
  if (updates.is_active !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`);
    params.push(updates.is_active);
  }

  // Always update updated_at and sync_status
  setClauses.push('updated_at = NOW()');
  setClauses.push(`sync_status = 'pending'`);

  if (setClauses.length === 0) {
    logger.warn('[SHOPPING] No updates provided for list', { temp_id });
    return;
  }

  const query = `
    UPDATE local_shopping_lists
    SET ${setClauses.join(', ')}
    WHERE temp_id = $1
  `;

  await db.query(query, params);

  // Add to pending operations queue
  const list = await getListByTempId(db, temp_id);
  if (list) {
    const content_hash = await calculateContentHash(updates as Record<string, unknown>);
    await addPendingOperation(db, {
      operation: 'update',
      entity_type: 'shopping_list',
      temp_id,
      server_id: list.id,
      payload: updates as Record<string, unknown>,
      attempts: 0,
      max_attempts: DEFAULT_MAX_RETRY_ATTEMPTS,
      last_error: null,
      content_hash,
      created_at: new Date(),
      updated_at: new Date()
    } as LocalPendingOperation);
  }

  logger.info('[SHOPPING] List updated', { temp_id });
}

/**
 * Delete shopping list (CASCADE soft delete items)
 *
 * @param db - PGlite instance
 * @param temp_id - List temp_id
 */
export async function deleteShoppingList(
  db: PGlite,
  temp_id: string
): Promise<void> {
  logger.debug('[SHOPPING] Deleting list', { temp_id });

  const list = await getListByTempId(db, temp_id);
  if (!list) {
    throw new Error(`Shopping list not found: ${temp_id}`);
  }

  // Soft delete all items in this list
  await db.query(`
    UPDATE local_shopping_list_items
    SET deleted_at = NOW(), sync_status = 'deleted', updated_at = NOW()
    WHERE shopping_list_temp_id = $1 AND deleted_at IS NULL
  `, [temp_id]);

  // Mark list as deleted
  await db.query(`
    UPDATE local_shopping_lists
    SET sync_status = 'deleted', updated_at = NOW()
    WHERE temp_id = $1
  `, [temp_id]);

  // Add to pending operations queue
  await addPendingOperation(db, {
    operation: 'delete',
    entity_type: 'shopping_list',
    temp_id,
    server_id: list.id,
    payload: {},
    attempts: 0,
    max_attempts: DEFAULT_MAX_RETRY_ATTEMPTS,
    last_error: null,
    content_hash: await calculateContentHash({ temp_id }),
    created_at: new Date(),
    updated_at: new Date()
  } as LocalPendingOperation);

  logger.info('[SHOPPING] List deleted (CASCADE)', { temp_id });
}

/**
 * Query shopping lists with filters
 *
 * @param db - PGlite instance
 * @param filters - Optional filters
 * @returns Array of shopping lists
 */
export async function queryShoppingLists(
  db: PGlite,
  filters?: ShoppingListFilters
): Promise<LocalShoppingList[]> {
  let query = `SELECT * FROM local_shopping_lists WHERE 1=1`;
  const params: unknown[] = [];
  let paramIndex = 1;

  // Apply filters
  if (filters?.is_active !== undefined) {
    query += ` AND is_active = $${paramIndex++}`;
    params.push(filters.is_active);
  }

  if (filters?.sync_status !== undefined) {
    query += ` AND sync_status = $${paramIndex++}`;
    params.push(filters.sync_status);
  } else {
    // Exclude deleted by default (only if sync_status filter not specified)
    query += ` AND sync_status != 'deleted'`;
  }

  // Order by created_at DESC
  query += ` ORDER BY created_at DESC`;

  logger.debug('[SHOPPING] Querying lists', { filters });

  const result = await db.query(query, params);
  return result.rows as LocalShoppingList[];
}

/**
 * Get shopping list by temp_id
 *
 * @param db - PGlite instance
 * @param temp_id - List temp_id
 * @returns Shopping list or null
 */
async function getListByTempId(
  db: PGlite,
  temp_id: string
): Promise<LocalShoppingList | null> {
  const result = await db.query(`
    SELECT * FROM local_shopping_lists WHERE temp_id = $1
  `, [temp_id]);

  return result.rows[0] as LocalShoppingList || null;
}

// ========================================
// SHOPPING LIST ITEM OPERATIONS
// ========================================

/**
 * Add item to shopping list (offline-first)
 *
 * @param db - PGlite instance
 * @param item - Shopping list item data
 * @returns temp_id (UUID)
 */
export async function addItemToList(
  db: PGlite,
  item: Omit<LocalShoppingListItem, 'id' | 'temp_id' | 'sync_status' | 'sync_hash' | 'content_hash' | 'version' | 'deleted_at' | 'last_modified_by' | 'created_at' | 'updated_at' | 'synced_at' | 'is_completed' | 'completed_at'>
): Promise<string> {
  const temp_id = generateUUID();
  const content_hash = await calculateContentHash(item as Record<string, unknown>);

  logger.debug('[SHOPPING] Adding item', { temp_id, item });

  // Auto-assign position (Task-014: position-based ordering)
  const maxPosResult = await db.query(`
    SELECT COALESCE(MAX(position), 0) as max_pos
    FROM local_shopping_list_items
    WHERE shopping_list_temp_id = $1 AND deleted_at IS NULL
  `, [item.shopping_list_temp_id]);

  const newPosition = ((maxPosResult.rows[0] as { max_pos: number }).max_pos || 0) + 1;

  logger.debug('[SHOPPING] Auto-assigned position', { temp_id, position: newPosition });

  // Insert item
  await db.query(`
    INSERT INTO local_shopping_list_items (
      temp_id, creator_id, shopping_list_temp_id, store_id, product_group_id,
      product_name, quantity, unit, comment, position,
      is_completed, sync_status, content_hash, version,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, 'pending', $11, 1, NOW(), NOW())
  `, [
    temp_id,
    item.creator_id,
    item.shopping_list_temp_id,
    item.store_id,
    item.product_group_id,
    item.product_name,
    item.quantity,
    item.unit,
    item.comment,
    newPosition,
    content_hash
  ]);

  // Add to pending operations queue
  await addPendingOperation(db, {
    operation: 'create',
    entity_type: 'shopping_list_item',
    temp_id,
    server_id: null,
    payload: item as Record<string, unknown>,
    attempts: 0,
    max_attempts: DEFAULT_MAX_RETRY_ATTEMPTS,
    last_error: null,
    content_hash,
    created_at: new Date(),
    updated_at: new Date()
  } as LocalPendingOperation);

  logger.info('[SHOPPING] Item added', { temp_id });

  return temp_id;
}

/**
 * Update shopping list item
 *
 * @param db - PGlite instance
 * @param temp_id - Item temp_id
 * @param updates - Fields to update
 */
export async function updateItem(
  db: PGlite,
  temp_id: string,
  updates: Partial<Pick<LocalShoppingListItem, 'product_name' | 'quantity' | 'unit' | 'comment' | 'store_id' | 'product_group_id'>>
): Promise<void> {
  logger.debug('[SHOPPING] Updating item', { temp_id, updates });

  // Build dynamic UPDATE query
  const setClauses: string[] = [];
  const params: unknown[] = [temp_id]; // $1 is temp_id
  let paramIndex = 2;

  if (updates.product_name !== undefined) {
    setClauses.push(`product_name = $${paramIndex++}`);
    params.push(updates.product_name);
  }
  if (updates.quantity !== undefined) {
    setClauses.push(`quantity = $${paramIndex++}`);
    params.push(updates.quantity);
  }
  if (updates.unit !== undefined) {
    setClauses.push(`unit = $${paramIndex++}`);
    params.push(updates.unit);
  }
  if (updates.comment !== undefined) {
    setClauses.push(`comment = $${paramIndex++}`);
    params.push(updates.comment);
  }
  if (updates.store_id !== undefined) {
    setClauses.push(`store_id = $${paramIndex++}`);
    params.push(updates.store_id);
  }
  if (updates.product_group_id !== undefined) {
    setClauses.push(`product_group_id = $${paramIndex++}`);
    params.push(updates.product_group_id);
  }

  // Always update updated_at, sync_status, and increment version
  setClauses.push('updated_at = NOW()');
  setClauses.push(`sync_status = 'pending'`);
  setClauses.push('version = version + 1');

  if (setClauses.length === 3) { // Only the always-updated fields
    logger.warn('[SHOPPING] No updates provided for item', { temp_id });
    return;
  }

  const query = `
    UPDATE local_shopping_list_items
    SET ${setClauses.join(', ')}
    WHERE temp_id = $1 AND deleted_at IS NULL
  `;

  await db.query(query, params);

  // Add to pending operations queue
  const item = await getItemByTempId(db, temp_id);
  if (item) {
    const content_hash = await calculateContentHash(updates as Record<string, unknown>);
    await addPendingOperation(db, {
      operation: 'update',
      entity_type: 'shopping_list_item',
      temp_id,
      server_id: item.id,
      payload: updates as Record<string, unknown>,
      attempts: 0,
      max_attempts: DEFAULT_MAX_RETRY_ATTEMPTS,
      last_error: null,
      content_hash,
      created_at: new Date(),
      updated_at: new Date()
    } as LocalPendingOperation);
  }

  logger.info('[SHOPPING] Item updated', { temp_id });
}

/**
 * Delete shopping list item (soft delete)
 *
 * @param db - PGlite instance
 * @param temp_id - Item temp_id
 */
export async function deleteItem(
  db: PGlite,
  temp_id: string
): Promise<void> {
  logger.debug('[SHOPPING] Deleting item', { temp_id });

  const item = await getItemByTempId(db, temp_id);
  if (!item) {
    throw new Error(`Shopping list item not found: ${temp_id}`);
  }

  // Soft delete
  await db.query(`
    UPDATE local_shopping_list_items
    SET deleted_at = NOW(), sync_status = 'deleted', updated_at = NOW()
    WHERE temp_id = $1
  `, [temp_id]);

  // Add to pending operations queue
  await addPendingOperation(db, {
    operation: 'delete',
    entity_type: 'shopping_list_item',
    temp_id,
    server_id: item.id,
    payload: {},
    attempts: 0,
    max_attempts: DEFAULT_MAX_RETRY_ATTEMPTS,
    last_error: null,
    content_hash: await calculateContentHash({ temp_id }),
    created_at: new Date(),
    updated_at: new Date()
  } as LocalPendingOperation);

  logger.info('[SHOPPING] Item deleted', { temp_id });
}

/**
 * Toggle item completion status
 *
 * @param db - PGlite instance
 * @param temp_id - Item temp_id
 * @param is_completed - New completion status
 */
export async function toggleItemCompleted(
  db: PGlite,
  temp_id: string,
  is_completed: boolean
): Promise<void> {
  logger.debug('[SHOPPING] Toggling item completed', { temp_id, is_completed });

  await db.query(`
    UPDATE local_shopping_list_items
    SET is_completed = $2,
        completed_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
        sync_status = 'pending',
        updated_at = NOW(),
        version = version + 1
    WHERE temp_id = $1 AND deleted_at IS NULL
  `, [temp_id, is_completed]);

  // Add to pending operations queue
  const item = await getItemByTempId(db, temp_id);
  if (item) {
    const content_hash = await calculateContentHash({ is_completed });
    await addPendingOperation(db, {
      operation: 'update',
      entity_type: 'shopping_list_item',
      temp_id,
      server_id: item.id,
      payload: { is_completed, completed_at: is_completed ? new Date() : null },
      attempts: 0,
      max_attempts: DEFAULT_MAX_RETRY_ATTEMPTS,
      last_error: null,
      content_hash,
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  logger.info('[SHOPPING] Item completed toggled', { temp_id, is_completed });
}

/**
 * Query shopping list items with filters
 *
 * @param db - PGlite instance
 * @param filters - Optional filters
 * @returns Array of shopping list items
 */
export async function queryShoppingListItems(
  db: PGlite,
  filters?: ShoppingListItemFilters
): Promise<LocalShoppingListItem[]> {
  let query = `SELECT * FROM local_shopping_list_items WHERE 1=1`;
  const params: unknown[] = [];
  let paramIndex = 1;

  // Apply filters
  if (filters?.shopping_list_temp_id !== undefined) {
    query += ` AND shopping_list_temp_id = $${paramIndex++}`;
    params.push(filters.shopping_list_temp_id);
  }

  if (filters?.store_id !== undefined) {
    query += ` AND store_id = $${paramIndex++}`;
    params.push(filters.store_id);
  }

  if (filters?.product_group_id !== undefined) {
    query += ` AND product_group_id = $${paramIndex++}`;
    params.push(filters.product_group_id);
  }

  if (filters?.is_completed !== undefined) {
    query += ` AND is_completed = $${paramIndex++}`;
    params.push(filters.is_completed);
  }

  if (filters?.sync_status !== undefined) {
    query += ` AND sync_status = $${paramIndex++}`;
    params.push(filters.sync_status);
  }

  // Deleted filter
  if (filters?.deleted === true) {
    query += ` AND deleted_at IS NOT NULL`;
  } else if (filters?.deleted === false) {
    query += ` AND deleted_at IS NULL`;
  }
  // If deleted === undefined, show all

  // Order by created_at ASC (insertion order, as in backend)
  query += ` ORDER BY created_at ASC`;

  logger.debug('[SHOPPING] Querying items', { filters });

  const result = await db.query(query, params);

  // Convert NUMERIC to number (PostgreSQL returns as string)
  return result.rows.map((row: unknown) => {
    const r = row as LocalShoppingListItem;
    return {
      ...r,
      quantity: r.quantity !== null && typeof r.quantity === 'string'
        ? parseFloat(r.quantity)
        : r.quantity
    };
  }) as LocalShoppingListItem[];
}

/**
 * Get shopping list item by temp_id
 *
 * @param db - PGlite instance
 * @param temp_id - Item temp_id
 * @returns Shopping list item or null
 */
async function getItemByTempId(
  db: PGlite,
  temp_id: string
): Promise<LocalShoppingListItem | null> {
  const result = await db.query(`
    SELECT * FROM local_shopping_list_items WHERE temp_id = $1
  `, [temp_id]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0] as LocalShoppingListItem;
  return {
    ...row,
    quantity: row.quantity !== null && typeof row.quantity === 'string'
      ? parseFloat(row.quantity)
      : row.quantity
  };
}

// ========================================
// REFERENCE DATA OPERATIONS
// ========================================

/**
 * Query stores
 *
 * @param db - PGlite instance
 * @param filters - Optional filters
 * @returns Array of stores
 */
export async function queryStores(
  db: PGlite,
  filters?: StoreFilters
): Promise<LocalStore[]> {
  let query = `SELECT * FROM local_stores WHERE 1=1`;
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters?.is_active !== undefined) {
    query += ` AND is_active = $${paramIndex++}`;
    params.push(filters.is_active);
  }

  query += ` ORDER BY name ASC`;

  logger.debug('[SHOPPING] Querying stores', { filters });

  const result = await db.query(query, params);
  return result.rows as LocalStore[];
}

/**
 * Query product groups
 *
 * @param db - PGlite instance
 * @param filters - Optional filters
 * @returns Array of product groups
 */
export async function queryProductGroups(
  db: PGlite,
  filters?: ProductGroupFilters
): Promise<LocalProductGroup[]> {
  let query = `SELECT * FROM local_product_groups WHERE 1=1`;
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters?.parent_id !== undefined) {
    if (filters.parent_id === null) {
      query += ` AND parent_id IS NULL`;
    } else {
      query += ` AND parent_id = $${paramIndex++}`;
      params.push(filters.parent_id);
    }
  }

  if (filters?.is_active !== undefined) {
    query += ` AND is_active = $${paramIndex++}`;
    params.push(filters.is_active);
  }

  query += ` ORDER BY name ASC`;

  logger.debug('[SHOPPING] Querying product groups', { filters });

  const result = await db.query(query, params);
  return result.rows as LocalProductGroup[];
}

/**
 * Query product group hierarchy (descendants of a product group)
 *
 * @param db - PGlite instance
 * @param product_group_id - Ancestor product group ID
 * @returns Array of hierarchy records
 */
export async function queryProductGroupHierarchy(
  db: PGlite,
  product_group_id: number
): Promise<LocalProductGroupHierarchy[]> {
  logger.debug('[SHOPPING] Querying product group hierarchy', { product_group_id });

  const result = await db.query(`
    SELECT * FROM local_product_group_hierarchy
    WHERE ancestor_id = $1
    ORDER BY depth ASC
  `, [product_group_id]);

  return result.rows as LocalProductGroupHierarchy[];
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Add pending operation to queue (with deduplication)
 *
 * @param db - PGlite instance
 * @param operation - Pending operation data
 */
async function addPendingOperation(
  db: PGlite,
  operation: Omit<LocalPendingOperation, 'id'>
): Promise<void> {
  try {
    await db.query(`
      INSERT INTO local_pending_operations (
        operation, entity_type, temp_id, server_id, payload, content_hash,
        attempts, max_attempts, last_error, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (content_hash) DO NOTHING
    `, [
      operation.operation,
      operation.entity_type,
      operation.temp_id,
      operation.server_id,
      JSON.stringify(operation.payload),
      operation.content_hash,
      operation.attempts,
      operation.max_attempts,
      operation.last_error,
      operation.created_at,
      operation.updated_at
    ]);
  } catch (error) {
    // Deduplication conflict - ignore
    if (error instanceof Error && error.message.includes('content_hash')) {
      logger.debug('[SHOPPING] Pending operation deduplicated', {
        entity_type: operation.entity_type,
        temp_id: operation.temp_id
      });
      return;
    }
    throw error;
  }
}

/**
 * Schema operations for reference data
 * CRUD methods for Articles, Financial Centers, Cost Centers
 */

import type { PGlite } from '@electric-sql/pglite';
import type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalSyncMetadata
} from '../types/models';

/**
 * Query Articles with optional filters
 *
 * @param db - PGlite instance
 * @param filters - Optional filters (user_id, type, parent_id, is_active)
 * @returns Array of articles
 */
export async function queryArticles(
  db: PGlite,
  filters?: {
    user_id?: number;
    type?: 'income' | 'expense';
    parent_id?: number | null;
    is_active?: boolean;
  }
): Promise<LocalArticle[]> {
  let sql = 'SELECT * FROM local_articles WHERE 1=1';
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters?.user_id !== undefined) {
    sql += ` AND user_id = $${paramIndex++}`;
    params.push(filters.user_id);
  }

  if (filters?.type) {
    sql += ` AND type = $${paramIndex++}`;
    params.push(filters.type);
  }

  if (filters?.parent_id !== undefined) {
    if (filters.parent_id === null) {
      sql += ' AND parent_id IS NULL';
    } else {
      sql += ` AND parent_id = $${paramIndex++}`;
      params.push(filters.parent_id);
    }
  }

  if (filters?.is_active !== undefined) {
    sql += ` AND is_active = $${paramIndex++}`;
    params.push(filters.is_active);
  }

  sql += ' ORDER BY name';

  const result = await db.query(sql, params);
  return result.rows as LocalArticle[];
}

/**
 * Query Financial Centers for a user
 *
 * @param db - PGlite instance
 * @param user_id - User ID
 * @param is_active - Optional filter for active centers
 * @returns Array of financial centers
 */
export async function queryFinancialCenters(
  db: PGlite,
  user_id: number,
  is_active?: boolean
): Promise<LocalFinancialCenter[]> {
  let sql = 'SELECT * FROM local_financial_centers WHERE user_id = $1';
  const params: unknown[] = [user_id];

  if (is_active !== undefined) {
    sql += ' AND is_active = $2';
    params.push(is_active);
  }

  sql += ' ORDER BY name';

  const result = await db.query(sql, params);
  return result.rows as LocalFinancialCenter[];
}

/**
 * Query Cost Centers for a user
 *
 * @param db - PGlite instance
 * @param user_id - User ID
 * @param is_active - Optional filter for active centers
 * @returns Array of cost centers
 */
export async function queryCostCenters(
  db: PGlite,
  user_id: number,
  is_active?: boolean
): Promise<LocalCostCenter[]> {
  let sql = 'SELECT * FROM local_cost_centers WHERE user_id = $1';
  const params: unknown[] = [user_id];

  if (is_active !== undefined) {
    sql += ' AND is_active = $2';
    params.push(is_active);
  }

  sql += ' ORDER BY name';

  const result = await db.query(sql, params);
  return result.rows as LocalCostCenter[];
}

/**
 * Get sync metadata for an entity type
 *
 * @param db - PGlite instance
 * @param entity_type - Entity type (articles, financial_centers, cost_centers)
 * @returns Sync metadata or null if not found
 */
export async function getSyncMetadata(
  db: PGlite,
  entity_type: string
): Promise<LocalSyncMetadata | null> {
  const result = await db.query(
    'SELECT * FROM local_sync_metadata WHERE entity_type = $1',
    [entity_type]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as LocalSyncMetadata;
}

/**
 * Update sync metadata for an entity type
 *
 * @param db - PGlite instance
 * @param entity_type - Entity type
 * @param data - Metadata to update (last_sync_timestamp, sync_version, total_records)
 */
export async function updateSyncMetadata(
  db: PGlite,
  entity_type: string,
  data: {
    last_sync_timestamp?: Date;
    sync_version?: number;
    total_records?: number;
  }
): Promise<void> {
  const existing = await getSyncMetadata(db, entity_type);

  if (existing) {
    // Update existing record
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.last_sync_timestamp !== undefined) {
      updates.push(`last_sync_timestamp = $${paramIndex++}`);
      params.push(data.last_sync_timestamp);
    }

    if (data.sync_version !== undefined) {
      updates.push(`sync_version = $${paramIndex++}`);
      params.push(data.sync_version);
    }

    if (data.total_records !== undefined) {
      updates.push(`total_records = $${paramIndex++}`);
      params.push(data.total_records);
    }

    if (updates.length > 0) {
      params.push(entity_type);
      await db.query(
        `UPDATE local_sync_metadata SET ${updates.join(', ')} WHERE entity_type = $${paramIndex}`,
        params
      );
    }
  } else {
    // Insert new record
    await db.query(
      `INSERT INTO local_sync_metadata (entity_type, last_sync_timestamp, sync_version, total_records)
       VALUES ($1, $2, $3, $4)`,
      [
        entity_type,
        data.last_sync_timestamp || null,
        data.sync_version || 1,
        data.total_records || 0
      ]
    );
  }
}

/**
 * Recurring Plans operations (Read-Only Reference Data)
 * Phase 4: Recurring plans are cached locally for fast queries
 * Write operations (create/update/delete) go directly to API
 */

import type { PGlite } from '@electric-sql/pglite';
import type { LocalRecurringPlan } from '../types/fact';
import { logger } from '../utils/logger';

/**
 * Filters for querying recurring plans
 */
export interface RecurringPlanFilters {
  user_id?: number;
  article_id?: number;
  financial_center_id?: number;
  cost_center_id?: number;
  is_active?: boolean;
  frequency?: string;
}

/**
 * Helper: Apply filter to query
 *
 * @param query - Current query string
 * @param params - Query parameters array
 * @param paramIndex - Current parameter index
 * @param columnName - Column name to filter
 * @param filterValue - Filter value (undefined = skip)
 * @returns Updated query state
 */
function applyFilter<T>(
  query: string,
  params: unknown[],
  paramIndex: number,
  columnName: string,
  filterValue: T | undefined
): { query: string; paramIndex: number } {
  if (filterValue !== undefined) {
    query += ` AND ${columnName} = $${paramIndex++}`;
    params.push(filterValue);
  }
  return { query, paramIndex };
}

/**
 * Query recurring plans with filters
 *
 * @param db - PGlite instance
 * @param filters - Optional filters
 * @returns Array of recurring plans
 */
export async function queryRecurringPlans(
  db: PGlite,
  filters?: RecurringPlanFilters
): Promise<LocalRecurringPlan[]> {
  // Base query
  let query = `
    SELECT * FROM local_recurring_plans
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let paramIndex = 1;

  // Apply filters using helper
  const filterMappings: Array<{ column: string; value: unknown }> = [
    { column: 'user_id', value: filters?.user_id },
    { column: 'article_id', value: filters?.article_id },
    { column: 'financial_center_id', value: filters?.financial_center_id },
    { column: 'cost_center_id', value: filters?.cost_center_id },
    { column: 'is_active', value: filters?.is_active },
    { column: 'frequency', value: filters?.frequency }
  ];

  for (const { column, value } of filterMappings) {
    const result = applyFilter(query, params, paramIndex, column, value);
    query = result.query;
    paramIndex = result.paramIndex;
  }

  // Ordering by day_of_month
  query += ` ORDER BY day_of_month ASC NULLS LAST, created_at DESC`;

  logger.debug('[PGLITE] Querying recurring plans', { filters });

  const result = await db.query(query, params);

  // Convert NUMERIC to number (PostgreSQL returns as string)
  return result.rows.map((row: unknown) => {
    const r = row as LocalRecurringPlan;
    return {
      ...r,
      amount: typeof r.amount === 'string' ? parseFloat(r.amount) : r.amount
    };
  }) as LocalRecurringPlan[];
}

/**
 * Bulk insert recurring plans from server (full sync)
 *
 * Uses UPSERT (ON CONFLICT DO UPDATE) to handle duplicate syncs.
 * Does NOT create pending operations (recurring plans are read-only cache).
 *
 * @param db - PGlite instance
 * @param plans - Array of server recurring plans
 */
export async function bulkInsertRecurringPlans(
  db: PGlite,
  plans: LocalRecurringPlan[]
): Promise<void> {
  if (plans.length === 0) {
    logger.debug('[PGLITE] No recurring plans to bulk insert');
    return;
  }

  logger.info('[PGLITE] Bulk inserting recurring plans', { count: plans.length });

  // Use transaction for atomicity
  await db.query('BEGIN');

  try {
    for (const plan of plans) {
      await db.query(`
        INSERT INTO local_recurring_plans (
          id, user_id, article_id, financial_center_id, cost_center_id,
          amount, day_of_month, frequency, is_active, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          article_id = EXCLUDED.article_id,
          financial_center_id = EXCLUDED.financial_center_id,
          cost_center_id = EXCLUDED.cost_center_id,
          amount = EXCLUDED.amount,
          day_of_month = EXCLUDED.day_of_month,
          frequency = EXCLUDED.frequency,
          is_active = EXCLUDED.is_active,
          created_at = EXCLUDED.created_at
      `, [
        plan.id,
        plan.user_id,
        plan.article_id,
        plan.financial_center_id,
        plan.cost_center_id,
        plan.amount,
        plan.day_of_month,
        plan.frequency,
        plan.is_active,
        plan.created_at
      ]);
    }

    await db.query('COMMIT');
    logger.info('[PGLITE] Bulk insert recurring plans completed', { count: plans.length });
  } catch (error) {
    await db.query('ROLLBACK');
    logger.error('[PGLITE] Bulk insert recurring plans failed', error);
    throw error;
  }
}

/**
 * Get recurring plans sync metadata
 *
 * @param db - PGlite instance
 * @returns Sync metadata (last_sync_timestamp, total_records)
 */
export async function getRecurringPlansSyncMetadata(
  db: PGlite
): Promise<{ last_sync_timestamp: Date | null; total_records: number }> {
  const result = await db.query(`
    SELECT last_sync_timestamp, total_records
    FROM local_sync_metadata
    WHERE entity_type = 'recurring_plans'
  `);

  if (result.rows.length === 0) {
    return { last_sync_timestamp: null, total_records: 0 };
  }

  const row = result.rows[0] as { last_sync_timestamp: Date | null; total_records: number };
  return {
    last_sync_timestamp: row.last_sync_timestamp,
    total_records: row.total_records
  };
}

/**
 * Update recurring plans sync metadata
 *
 * @param db - PGlite instance
 * @param total - Total number of recurring plans synced
 */
export async function updateRecurringPlansSyncMetadata(
  db: PGlite,
  total: number
): Promise<void> {
  await db.query(`
    INSERT INTO local_sync_metadata (entity_type, last_sync_timestamp, total_records, sync_version)
    VALUES ('recurring_plans', NOW(), $1, 1)
    ON CONFLICT (entity_type) DO UPDATE SET
      last_sync_timestamp = NOW(),
      total_records = EXCLUDED.total_records,
      sync_version = local_sync_metadata.sync_version + 1
  `, [total]);

  logger.debug('[PGLITE] Recurring plans sync metadata updated', { total });
}

/**
 * Clear all recurring plans (for full resync)
 *
 * @param db - PGlite instance
 */
export async function clearRecurringPlans(db: PGlite): Promise<void> {
  logger.info('[PGLITE] Clearing all recurring plans');

  await db.query('BEGIN');

  try {
    await db.query('DELETE FROM local_recurring_plans');
    await db.query(`
      DELETE FROM local_sync_metadata WHERE entity_type = 'recurring_plans'
    `);

    await db.query('COMMIT');
    logger.info('[PGLITE] Recurring plans cleared');
  } catch (error) {
    await db.query('ROLLBACK');
    logger.error('[PGLITE] Failed to clear recurring plans', error);
    throw error;
  }
}

/**
 * Budget Fact operations (CRUD + Windowed Queries)
 */

import type { PGlite } from '@electric-sql/pglite';
import type {
  LocalBudgetFact,
  LocalPendingOperation,
  FactFilters
} from '../types/fact';
import { calculateContentHash, generateUUID } from '../utils/hash';
import {
  getPGliteFeatureFlags,
  MAX_FACTS_QUERY_LIMIT,
  DEFAULT_MAX_RETRY_ATTEMPTS
} from '../features/featureFlags';
import { logger } from '../utils/logger';

/**
 * Create budget fact (offline-first)
 * Returns temp_id for client-side tracking
 *
 * @param db - PGlite instance
 * @param fact - Partial fact data (id will be null for creates)
 * @returns temp_id (UUID)
 */
export async function createFact(
  db: PGlite,
  fact: Omit<LocalBudgetFact, 'id' | 'temp_id' | 'sync_status' | 'content_hash' | 'created_at' | 'updated_at' | 'synced_at'>
): Promise<string> {
  const temp_id = generateUUID();
  const content_hash = await calculateContentHash(fact as Record<string, unknown>);

  logger.debug('[PGLITE] Creating fact', { temp_id, fact });

  // Insert fact
  await db.query(`
    INSERT INTO local_budget_facts (
      temp_id, user_id, article_id, financial_center_id, cost_center_id,
      date, amount, record_type, comment,
      transfer_group_id, is_transfer,
      sync_status, content_hash,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, NOW(), NOW())
  `, [
    temp_id,
    fact.user_id,
    fact.article_id,
    fact.financial_center_id,
    fact.cost_center_id,
    fact.date,
    fact.amount,
    fact.record_type,
    fact.comment,
    fact.transfer_group_id,
    fact.is_transfer,
    content_hash
  ]);

  // Add to pending operations queue
  await addPendingOperation(db, {
    operation: 'create',
    entity_type: 'fact',
    temp_id,
    server_id: null,
    payload: fact as Record<string, unknown>,
    attempts: 0,
    max_attempts: DEFAULT_MAX_RETRY_ATTEMPTS,
    last_error: null,
    content_hash,
    created_at: new Date(),
    updated_at: new Date()
  } as LocalPendingOperation);

  logger.info('[PGLITE] Fact created', { temp_id });

  return temp_id;
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
 * Build facts query with filters
 *
 * @param filters - Optional filters
 * @param windowStartStr - Window start date (YYYY-MM-DD)
 * @returns Query string and parameters
 */
function buildFactsQuery(
  filters: FactFilters | undefined,
  windowStartStr: string
): { query: string; params: unknown[] } {
  // Base query with data window
  let query = `
    SELECT * FROM local_budget_facts
    WHERE date >= $1 AND sync_status != 'deleted'
  `;
  const params: unknown[] = [filters?.date_from || windowStartStr];
  let paramIndex = 2;

  // Apply filters using helper
  const filterMappings: Array<{ column: string; value: unknown }> = [
    { column: 'user_id', value: filters?.user_id },
    { column: 'article_id', value: filters?.article_id },
    { column: 'financial_center_id', value: filters?.financial_center_id },
    { column: 'cost_center_id', value: filters?.cost_center_id },
    { column: 'record_type', value: filters?.record_type },
    { column: 'sync_status', value: filters?.sync_status }
  ];

  for (const { column, value } of filterMappings) {
    const result = applyFilter(query, params, paramIndex, column, value);
    query = result.query;
    paramIndex = result.paramIndex;
  }

  // Date range filter (date_to)
  if (filters?.date_to !== undefined) {
    query += ` AND date <= $${paramIndex++}`;
    params.push(filters.date_to);
  }

  // Ordering and limit
  query += ` ORDER BY date DESC LIMIT ${MAX_FACTS_QUERY_LIMIT}`;

  return { query, params };
}

/**
 * Query facts with filters and data window
 *
 * @param db - PGlite instance
 * @param filters - Optional filters
 * @returns Array of budget facts
 */
export async function queryFacts(
  db: PGlite,
  filters?: FactFilters
): Promise<LocalBudgetFact[]> {
  const flags = getPGliteFeatureFlags();

  // Calculate window start date (default: 90 days ago)
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - flags.factsWindow);
  const windowStartStr = windowStart.toISOString().split('T')[0]; // YYYY-MM-DD

  // Build query with filters
  const { query, params } = buildFactsQuery(filters, windowStartStr);

  logger.debug('[PGLITE] Querying facts', { filters, windowStart: windowStartStr });

  const result = await db.query(query, params);

  // Convert NUMERIC to number (PostgreSQL returns as string)
  return result.rows.map((row: unknown) => {
    const r = row as LocalBudgetFact;
    return {
      ...r,
      amount: typeof r.amount === 'string' ? parseFloat(r.amount) : r.amount
    };
  }) as LocalBudgetFact[];
}

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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
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
      operation.last_error
    ]);

    logger.debug('[PGLITE] Pending operation added', {
      operation: operation.operation,
      entity_type: operation.entity_type,
      temp_id: operation.temp_id
    });
  } catch (error) {
    logger.error('[PGLITE] Failed to add pending operation', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Get pending operations queue
 *
 * @param db - PGlite instance
 * @returns Array of pending operations
 */
export async function getPendingOperations(
  db: PGlite
): Promise<LocalPendingOperation[]> {
  const result = await db.query(`
    SELECT * FROM local_pending_operations
    WHERE attempts < max_attempts
    ORDER BY created_at ASC
  `);

  // JSONB payload is already parsed by PGlite (returns as object, not string)
  return result.rows.map((row: unknown) => {
    const r = row as LocalPendingOperation;
    return {
      ...r,
      // Ensure payload is object (already is from PGlite JSONB)
      payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload
    };
  }) as LocalPendingOperation[];
}

/**
 * Bulk insert facts from server (incremental sync - created)
 *
 * Uses srv-{id} prefix for temp_id to avoid UUID conflicts with offline creates.
 * Uses UPSERT (ON CONFLICT DO UPDATE) to handle duplicate syncs.
 *
 * @param db - PGlite instance
 * @param facts - Array of server facts (must have id)
 */
export async function bulkInsertFacts(
  db: PGlite,
  facts: Array<Omit<LocalBudgetFact, 'temp_id'> & { id: number }>
): Promise<void> {
  if (facts.length === 0) {
    logger.debug('[PGLITE] No facts to bulk insert');
    return;
  }

  logger.info('[PGLITE] Bulk inserting facts', { count: facts.length });

  // Use transaction for atomicity
  await db.query('BEGIN');

  try {
    for (const fact of facts) {
      const temp_id = `srv-${fact.id}`; // Server fact prefix

      await db.query(`
        INSERT INTO local_budget_facts (
          id, temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, comment,
          transfer_group_id, is_transfer,
          sync_status, sync_hash, content_hash,
          created_at, updated_at, synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'synced', $13, $14, $15, $16, NOW())
        ON CONFLICT (temp_id) DO UPDATE SET
          id = EXCLUDED.id,
          user_id = EXCLUDED.user_id,
          article_id = EXCLUDED.article_id,
          financial_center_id = EXCLUDED.financial_center_id,
          cost_center_id = EXCLUDED.cost_center_id,
          date = EXCLUDED.date,
          amount = EXCLUDED.amount,
          record_type = EXCLUDED.record_type,
          comment = EXCLUDED.comment,
          transfer_group_id = EXCLUDED.transfer_group_id,
          is_transfer = EXCLUDED.is_transfer,
          sync_status = 'synced',
          sync_hash = EXCLUDED.sync_hash,
          content_hash = EXCLUDED.content_hash,
          updated_at = EXCLUDED.updated_at,
          synced_at = NOW()
      `, [
        fact.id,
        temp_id,
        fact.user_id,
        fact.article_id,
        fact.financial_center_id,
        fact.cost_center_id,
        fact.date,
        fact.amount,
        fact.record_type,
        fact.comment,
        fact.transfer_group_id,
        fact.is_transfer,
        fact.sync_hash,
        fact.content_hash,
        fact.created_at,
        fact.updated_at
      ]);
    }

    await db.query('COMMIT');
    logger.info('[PGLITE] Bulk insert completed', { count: facts.length });
  } catch (error) {
    await db.query('ROLLBACK');
    logger.error('[PGLITE] Bulk insert failed', error);
    throw error;
  }
}

/**
 * Bulk update facts from server (incremental sync - updated)
 *
 * Updates all fields except temp_id (stable identifier).
 * Only updates facts with srv-{id} prefix (server-synced facts).
 *
 * @param db - PGlite instance
 * @param facts - Array of server facts (must have id)
 */
export async function bulkUpdateFacts(
  db: PGlite,
  facts: Array<Omit<LocalBudgetFact, 'temp_id'> & { id: number }>
): Promise<void> {
  if (facts.length === 0) {
    logger.debug('[PGLITE] No facts to bulk update');
    return;
  }

  logger.info('[PGLITE] Bulk updating facts', { count: facts.length });

  await db.query('BEGIN');

  try {
    for (const fact of facts) {
      const temp_id = `srv-${fact.id}`;

      await db.query(`
        UPDATE local_budget_facts
        SET
          user_id = $1,
          article_id = $2,
          financial_center_id = $3,
          cost_center_id = $4,
          date = $5,
          amount = $6,
          record_type = $7,
          comment = $8,
          transfer_group_id = $9,
          is_transfer = $10,
          sync_status = 'synced',
          sync_hash = $11,
          content_hash = $12,
          updated_at = $13,
          synced_at = NOW()
        WHERE temp_id = $14
      `, [
        fact.user_id,
        fact.article_id,
        fact.financial_center_id,
        fact.cost_center_id,
        fact.date,
        fact.amount,
        fact.record_type,
        fact.comment,
        fact.transfer_group_id,
        fact.is_transfer,
        fact.sync_hash,
        fact.content_hash,
        fact.updated_at,
        temp_id
      ]);
    }

    await db.query('COMMIT');
    logger.info('[PGLITE] Bulk update completed', { count: facts.length });
  } catch (error) {
    await db.query('ROLLBACK');
    logger.error('[PGLITE] Bulk update failed', error);
    throw error;
  }
}

/**
 * Bulk soft delete facts (incremental sync - deleted)
 *
 * Sets sync_status='deleted' instead of physical deletion.
 * Preserves data for offline conflict resolution.
 *
 * @param db - PGlite instance
 * @param factIds - Array of server fact IDs to delete
 */
export async function bulkSoftDeleteFacts(
  db: PGlite,
  factIds: number[]
): Promise<void> {
  if (factIds.length === 0) {
    logger.debug('[PGLITE] No facts to bulk soft delete');
    return;
  }

  logger.info('[PGLITE] Bulk soft deleting facts', { count: factIds.length });

  await db.query('BEGIN');

  try {
    for (const factId of factIds) {
      const temp_id = `srv-${factId}`;

      await db.query(`
        UPDATE local_budget_facts
        SET sync_status = 'deleted', synced_at = NOW()
        WHERE temp_id = $1
      `, [temp_id]);
    }

    await db.query('COMMIT');
    logger.info('[PGLITE] Bulk soft delete completed', { count: factIds.length });
  } catch (error) {
    await db.query('ROLLBACK');
    logger.error('[PGLITE] Bulk soft delete failed', error);
    throw error;
  }
}

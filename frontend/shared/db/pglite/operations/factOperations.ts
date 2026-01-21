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
import { getPGliteFeatureFlags } from '../features/featureFlags';
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
    max_attempts: 3,
    last_error: null,
    content_hash,
    created_at: new Date(),
    updated_at: new Date()
  } as LocalPendingOperation);

  logger.info('[PGLITE] Fact created', { temp_id });

  return temp_id;
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

  // Build query
  let query = `
    SELECT * FROM local_budget_facts
    WHERE date >= $1 AND sync_status != 'deleted'
  `;
  const params: unknown[] = [filters?.date_from || windowStartStr];
  let paramIndex = 2;

  // Apply filters
  if (filters?.user_id !== undefined) {
    query += ` AND user_id = $${paramIndex++}`;
    params.push(filters.user_id);
  }

  if (filters?.article_id !== undefined) {
    query += ` AND article_id = $${paramIndex++}`;
    params.push(filters.article_id);
  }

  if (filters?.financial_center_id !== undefined) {
    query += ` AND financial_center_id = $${paramIndex++}`;
    params.push(filters.financial_center_id);
  }

  if (filters?.cost_center_id !== undefined) {
    query += ` AND cost_center_id = $${paramIndex++}`;
    params.push(filters.cost_center_id);
  }

  if (filters?.record_type !== undefined) {
    query += ` AND record_type = $${paramIndex++}`;
    params.push(filters.record_type);
  }

  if (filters?.sync_status !== undefined) {
    query += ` AND sync_status = $${paramIndex++}`;
    params.push(filters.sync_status);
  }

  if (filters?.date_to !== undefined) {
    query += ` AND date <= $${paramIndex++}`;
    params.push(filters.date_to);
  }

  query += ' ORDER BY date DESC LIMIT 1000';

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

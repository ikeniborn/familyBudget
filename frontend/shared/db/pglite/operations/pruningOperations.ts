/**
 * Data pruning operations (task-010)
 * Automatically remove old synced facts beyond retention window
 */

import type { PGlite } from '@electric-sql/pglite';
import { getPGliteFeatureFlags } from '../features/featureFlags';
import { logger } from '../utils/logger';

// =============================================================================
// Types
// =============================================================================

export interface PruningResult {
  deletedCount: number;
  dbSizeBefore: number;  // KB
  dbSizeAfter: number;   // KB
  windowStart: string;   // YYYY-MM-DD
  timestamp: Date;
}

export interface PruningStats {
  lastPrunedAt: string | null;
  totalPruned: number;
}

interface PruningMetadata {
  last_pruned_at?: string;
  total_pruned?: number;
}

// =============================================================================
// Core Pruning Logic
// =============================================================================

/**
 * Prune old synced facts beyond retention window
 * CRITICAL: Only deletes sync_status='synced' records
 *
 * @param db - PGlite database instance
 * @param retentionDays - Override default retention (optional)
 * @returns Pruning result with deleted count and DB size metrics
 */
export async function pruneOldFacts(
  db: PGlite,
  retentionDays?: number
): Promise<PruningResult> {
  const flags = getPGliteFeatureFlags();
  const retention = retentionDays ?? flags.pruningRetentionDays;

  // Calculate window start
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - retention);
  const windowStartStr = windowStart.toISOString().split('T')[0];

  logger.info('[PRUNING] Starting pruning', {
    retention,
    windowStart: windowStartStr
  });

  // Get DB size before
  const sizeBefore = await getDBSizeKB(db);

  // CRITICAL: Only delete synced records
  // NEVER delete: pending, conflicted, deleted
  const result = await db.query(`
    DELETE FROM local_budget_facts
    WHERE date < $1 AND sync_status = 'synced'
    RETURNING temp_id
  `, [windowStartStr]);

  const deletedCount = result.rows.length;

  // Get DB size after
  const sizeAfter = await getDBSizeKB(db);

  logger.info('[PRUNING] Completed', {
    deletedCount,
    sizeBefore,
    sizeAfter,
    savedKB: sizeBefore - sizeAfter
  });

  // Update metadata
  await updatePruningMetadata(db, {
    last_pruned_at: new Date(),
    total_pruned: deletedCount
  });

  return {
    deletedCount,
    dbSizeBefore: sizeBefore,
    dbSizeAfter: sizeAfter,
    windowStart: windowStartStr,
    timestamp: new Date()
  };
}

/**
 * Get pruning statistics for diagnostic UI
 *
 * @param db - PGlite database instance
 * @returns Pruning stats (last pruned, total pruned)
 */
export async function getPruningStats(db: PGlite): Promise<PruningStats> {
  const result = await db.query(`
    SELECT metadata FROM local_sync_metadata
    WHERE entity_type = 'pruning'
  `);

  if (result.rows.length === 0) {
    return { lastPrunedAt: null, totalPruned: 0 };
  }

  const row = result.rows[0] as { metadata: unknown };
  const metadata = row.metadata as PruningMetadata;

  return {
    lastPrunedAt: metadata.last_pruned_at || null,
    totalPruned: metadata.total_pruned || 0
  };
}

/**
 * Calculate potential pruning impact (dry-run)
 *
 * @param db - PGlite database instance
 * @param retentionDays - Retention window to test
 * @returns Number of records that would be deleted
 */
export async function calculatePotentialPruning(
  db: PGlite,
  retentionDays: number
): Promise<number> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - retentionDays);
  const windowStartStr = windowStart.toISOString().split('T')[0];

  const result = await db.query(`
    SELECT COUNT(*) as count FROM local_budget_facts
    WHERE date < $1 AND sync_status = 'synced'
  `, [windowStartStr]);

  // Defensive check: PostgreSQL COUNT always returns a row, but verify for safety
  if (result.rows.length === 0) {
    logger.warn('[PRUNING] calculatePotentialPruning: empty result (unexpected)');
    return 0;
  }

  return Number((result.rows[0] as { count: number }).count);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get database size in KB
 *
 * @param db - PGlite database instance
 * @returns Database size in KB
 */
async function getDBSizeKB(db: PGlite): Promise<number> {
  const result = await db.query('SELECT pg_database_size(current_database()) as size_bytes');

  // Defensive check: pg_database_size always returns a row, but verify for safety
  if (result.rows.length === 0) {
    logger.warn('[PRUNING] getDBSizeKB: empty result (unexpected)');
    return 0;
  }

  return Math.round(Number((result.rows[0] as { size_bytes: number }).size_bytes) / 1024);
}

/**
 * Update pruning metadata in local_sync_metadata
 *
 * @param db - PGlite database instance
 * @param data - Metadata to store
 */
async function updatePruningMetadata(
  db: PGlite,
  data: { last_pruned_at: Date; total_pruned: number }
): Promise<void> {
  await db.query(`
    INSERT INTO local_sync_metadata (entity_type, metadata, last_sync_timestamp, updated_at)
    VALUES ('pruning', $1, NOW(), NOW())
    ON CONFLICT (entity_type) DO UPDATE SET
      metadata = jsonb_set(
        COALESCE(local_sync_metadata.metadata, '{}'::jsonb),
        '{total_pruned}',
        (COALESCE((local_sync_metadata.metadata->>'total_pruned')::int, 0) + $2)::text::jsonb
      ) || jsonb_build_object('last_pruned_at', $3),
      last_sync_timestamp = EXCLUDED.last_sync_timestamp,
      updated_at = NOW()
  `, [
    JSON.stringify(data),
    data.total_pruned,
    data.last_pruned_at.toISOString()
  ]);
}

/**
 * Recurring Plans Sync Operations
 *
 * Handles download sync from backend to PGlite:
 * - Full sync: Download all recurring plans (read-only reference data)
 * - No incremental sync (recurring plans change infrequently)
 * - No upload sync (write operations go directly to API)
 */

import type { PGlite } from '@electric-sql/pglite';
import type { LocalRecurringPlan } from '../types/fact';
import {
  bulkInsertRecurringPlans,
  updateRecurringPlansSyncMetadata
} from './recurringOperations';
import { logger } from '../utils/logger';

/**
 * Sync progress callback
 */
export type SyncProgressCallback = (progress: {
  phase: 'sync' | 'complete';
  message: string;
  current?: number;
  total?: number;
}) => void;

/**
 * Perform full sync for recurring plans
 *
 * Downloads all recurring plans from server and bulk inserts into PGlite.
 * Uses UPSERT to handle duplicate syncs.
 *
 * @param db - PGlite instance
 * @param plans - Recurring plans from server
 * @param onProgress - Optional progress callback
 */
export async function syncRecurringPlans(
  db: PGlite,
  plans: LocalRecurringPlan[],
  onProgress?: SyncProgressCallback
): Promise<void> {
  logger.info('[RECURRING_SYNC] Starting recurring plans sync', {
    plans_count: plans.length
  });

  onProgress?.({
    phase: 'sync',
    message: 'Syncing recurring plans...',
    current: 0,
    total: plans.length
  });

  // Bulk insert/update recurring plans
  await bulkInsertRecurringPlans(db, plans);

  // Update sync metadata
  await updateRecurringPlansSyncMetadata(db, plans.length);

  onProgress?.({
    phase: 'complete',
    message: 'Recurring plans sync complete',
    current: plans.length,
    total: plans.length
  });

  logger.info('[RECURRING_SYNC] Recurring plans sync complete', {
    synced_count: plans.length
  });
}

/**
 * Check if recurring plans need sync
 *
 * Returns true if:
 * - No sync metadata exists
 * - Last sync was more than 24 hours ago
 * - Total records count is 0
 *
 * @param db - PGlite instance
 * @returns True if sync needed
 */
export async function needsRecurringPlansSync(db: PGlite): Promise<boolean> {
  const result = await db.query(`
    SELECT last_sync_timestamp, total_records
    FROM local_sync_metadata
    WHERE entity_type = 'recurring_plans'
  `);

  if (result.rows.length === 0) {
    logger.debug('[RECURRING_SYNC] No sync metadata found, sync needed');
    return true;
  }

  const row = result.rows[0] as { last_sync_timestamp: Date | null; total_records: number };

  if (row.total_records === 0) {
    logger.debug('[RECURRING_SYNC] Zero records, sync needed');
    return true;
  }

  if (!row.last_sync_timestamp) {
    logger.debug('[RECURRING_SYNC] No last sync timestamp, sync needed');
    return true;
  }

  // Check if last sync was more than 24 hours ago
  const lastSync = new Date(row.last_sync_timestamp);
  const now = new Date();
  const hoursSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);

  if (hoursSinceLastSync > 24) {
    logger.debug('[RECURRING_SYNC] Last sync > 24 hours ago, sync needed', {
      hours: hoursSinceLastSync.toFixed(1)
    });
    return true;
  }

  logger.debug('[RECURRING_SYNC] Sync not needed', {
    last_sync: lastSync.toISOString(),
    hours_since: hoursSinceLastSync.toFixed(1),
    total_records: row.total_records
  });

  return false;
}

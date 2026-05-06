/**
 * Bulk operations для batch insert/update
 * Оптимизация для initial sync и массовых операций
 */

import { db } from '../core/database';
import { logger } from '../utils/logger';
import { factRepo } from '../repositories/FactRepository';
import type { LocalBudgetFact } from '../types/fact';

/**
 * Progress callback для bulk operations
 */
export type BulkProgressCallback = (_current: number, _total: number) => void;

/**
 * Bulk insert facts с progress reporting
 *
 * @param facts - Array of facts (amount в integer rubles)
 * @param onProgress - Optional progress callback
 */
export async function bulkInsertFacts(
  facts: LocalBudgetFact[],
  onProgress?: BulkProgressCallback
): Promise<void> {
  logger.info('[bulkOps] bulkInsertFacts', { count: facts.length });
  await factRepo.bulkUpsert(facts, onProgress);
  logger.info('[bulkOps] ✅ Bulk insert complete', { total: facts.length });
}

/**
 * Bulk update facts (mark as synced)
 *
 * @param temp_ids - Array of temp_ids to update
 * @param server_ids - Array of server IDs (same order as temp_ids)
 */
export async function bulkConfirmFacts(
  temp_ids: string[],
  server_ids: number[]
): Promise<void> {
  logger.info('[bulkOps] bulkConfirmFacts', { count: temp_ids.length });

  if (temp_ids.length !== server_ids.length) {
    throw new Error('temp_ids и server_ids должны быть одинаковой длины');
  }

  // Dexie не поддерживает batch modify по списку keys
  // Решение: transaction с modify для каждого
  await db.transaction('rw', db.budgetFacts, async () => {
    for (let i = 0; i < temp_ids.length; i++) {
      await db.budgetFacts
        .where('temp_id').equals(temp_ids[i])
        .modify({
          id: server_ids[i],
          sync_status: 'synced',
          synced_at: new Date()
        });
    }
  });

  logger.info('[bulkOps] ✅ Bulk confirm complete', { count: temp_ids.length });
}

/**
 * Bulk delete facts (hard delete, не soft)
 * Используется для cleanup старых synced records
 *
 * @param temp_ids - Array of temp_ids to delete
 */
export async function bulkDeleteFacts(temp_ids: string[]): Promise<void> {
  logger.info('[bulkOps] bulkDeleteFacts', { count: temp_ids.length });

  await db.budgetFacts
    .where('temp_id').anyOf(temp_ids)
    .delete();

  logger.info('[bulkOps] ✅ Bulk delete complete', { count: temp_ids.length });
}

/**
 * Clear all facts (для testing/reset)
 */
export async function clearAllFacts(): Promise<void> {
  logger.warn('[bulkOps] Clearing all facts...');

  await db.budgetFacts.clear();

  logger.info('[bulkOps] ✅ All facts cleared');
}

/**
 * Get facts count по sync_status
 */
export async function getFactsCountByStatus(): Promise<{
  synced: number;
  pending: number;
  conflict: number;
  deleted: number;
}> {
  const [synced, pending, conflict, deleted] = await Promise.all([
    db.budgetFacts.where('sync_status').equals('synced').count(),
    db.budgetFacts.where('sync_status').equals('pending').count(),
    db.budgetFacts.where('sync_status').equals('conflict').count(),
    db.budgetFacts.where('sync_status').equals('deleted').count()
  ]);

  return { synced, pending, conflict, deleted };
}

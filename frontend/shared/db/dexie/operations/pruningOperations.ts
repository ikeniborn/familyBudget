/**
 * Pruning operations for Dexie.js
 * Auto-delete old synced facts to save space
 */

import { db } from '../core/database';
import { logger } from '../utils/logger';

/**
 * Prune old synced facts based on retention period
 *
 * @param retentionDays - Number of days to keep facts (default: 30)
 * @returns Number of deleted facts
 */
export async function pruneFacts(retentionDays: number = 30): Promise<number> {
  try {
    logger.info('[Dexie] Starting pruning...', { retentionDays });

    // Calculate cutoff date (retentionDays ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD

    logger.debug('[Dexie] Pruning cutoff date', { cutoffDateStr });

    // Find old synced facts (sync_status = 'synced' AND date < cutoff)
    const factsToDelete = await db.budgetFacts
      .where('sync_status')
      .equals('synced')
      .filter(fact => fact.date < cutoffDateStr)
      .toArray();

    const count = factsToDelete.length;

    if (count === 0) {
      logger.info('[Dexie] No facts to prune');
      return 0;
    }

    // Delete facts (use where().delete() instead of bulkDelete for string keys)
    await db.budgetFacts
      .where('sync_status')
      .equals('synced')
      .and(fact => fact.date < cutoffDateStr)
      .delete();

    logger.info('[Dexie] ✅ Pruned facts', { count, cutoffDateStr });

    return count;
  } catch (error) {
    logger.error('[Dexie] ❌ Pruning error:', error);
    throw error;
  }
}

/**
 * Auto-pruning с interval logic
 * Runs pruning every hour (configurable)
 */
let autoPruningInterval: number | null = null;
let autoPruningEnabled = false;

export function startAutoPruning(retentionDays: number = 30, intervalMs: number = 60 * 60 * 1000): void {
  if (autoPruningEnabled) {
    logger.warn('[Dexie] Auto-pruning already enabled');
    return;
  }

  logger.info('[Dexie] Starting auto-pruning', { retentionDays, intervalMs });

  autoPruningEnabled = true;

  // Run immediately
  pruneFacts(retentionDays).catch(error => {
    logger.error('[Dexie] Auto-pruning failed:', error);
  });

  // Schedule periodic runs
  autoPruningInterval = window.setInterval(() => {
    pruneFacts(retentionDays).catch(error => {
      logger.error('[Dexie] Auto-pruning failed:', error);
    });
  }, intervalMs);

  logger.info('[Dexie] Auto-pruning started');
}

export function stopAutoPruning(): void {
  if (!autoPruningEnabled) {
    logger.warn('[Dexie] Auto-pruning already disabled');
    return;
  }

  logger.info('[Dexie] Stopping auto-pruning');

  autoPruningEnabled = false;

  if (autoPruningInterval !== null) {
    window.clearInterval(autoPruningInterval);
    autoPruningInterval = null;
  }

  logger.info('[Dexie] Auto-pruning stopped');
}

export function isAutoPruningEnabled(): boolean {
  return autoPruningEnabled;
}

/**
 * Calculate actual database size (approximate)
 * IndexedDB doesn't expose exact size, estimate based on record counts
 *
 * @returns Approximate DB size in bytes
 */
export async function calculateDatabaseSize(): Promise<number> {
  try {
    // Estimate based on table sizes (approximate)
    const articles = await db.articles.count();
    const financialCenters = await db.financialCenters.count();
    const costCenters = await db.costCenters.count();
    const facts = await db.budgetFacts.count();
    const recurringPlans = await db.recurringPlans.count();
    const shoppingLists = await db.shoppingLists.count();
    const shoppingListItems = await db.shoppingListItems.count();
    const pendingOperations = await db.pendingOperations.count();
    const syncConflicts = await db.syncConflicts.count();

    // Rough estimate: each record ~500 bytes average
    // (Articles, centers: ~200 bytes, Facts: ~300 bytes, Shopping items: ~400 bytes)
    const estimatedSize =
      (articles + financialCenters + costCenters) * 200 +
      facts * 300 +
      recurringPlans * 150 +
      shoppingLists * 200 +
      shoppingListItems * 400 +
      pendingOperations * 250 +
      syncConflicts * 300;

    logger.debug('[Dexie] Estimated DB size', { estimatedSize, facts, shoppingListItems });

    return estimatedSize;
  } catch (error) {
    logger.error('[Dexie] DB size calculation error:', error);
    return 0;
  }
}

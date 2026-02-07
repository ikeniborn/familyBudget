/**
 * Reference Data Sync Operations
 * Синхронизация справочников (Articles, Financial Centers, Cost Centers)
 */

import { db } from '../core/database';
import { logger } from '../utils/logger';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import {
  bulkInsertArticles,
  bulkInsertFinancialCenters,
  bulkInsertCostCenters,
  bulkInsertArticleHierarchy
} from './schemaOperations';
import type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalArticleHierarchy,
  LocalSyncMetadata
} from '../types/models';

/**
 * Sync articles from server
 *
 * @param userId - User ID
 * @returns Sync status
 */
export async function syncArticles(userId: number): Promise<{ success: boolean; count: number }> {
  logger.info('[referenceSync] Syncing articles...', { userId });

  try {
    // Fetch from server (backend uses CurrentUser dependency from session cookie)
    const response = await fetchWithTimeout(`/api/v1/articles`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch articles: ${response.status}`);
    }

    // Unwrap API pagination response: { articles: [...], total, limit, offset }
    const data = await response.json();
    const articles: LocalArticle[] = data.articles || [];

    // Clear existing articles
    await db.articles.where('user_id').equals(userId).delete();

    // Bulk insert
    await bulkInsertArticles(articles);

    // Update sync metadata
    await updateSyncMetadata('articles', articles.length);

    logger.info('[referenceSync] ✅ Articles synced', { count: articles.length });
    return { success: true, count: articles.length };
  } catch (error) {
    logger.error('[referenceSync] ❌ Articles sync failed:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Sync financial centers from server
 */
export async function syncFinancialCenters(userId: number): Promise<{ success: boolean; count: number }> {
  logger.info('[referenceSync] Syncing financial centers...', { userId });

  try {
    // Backend uses CurrentUser dependency from session cookie
    const response = await fetchWithTimeout(`/api/v1/financial-centers`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch financial centers: ${response.status}`);
    }

    // Unwrap API pagination response: { financial_centers: [...], total, limit, offset }
    const data = await response.json();
    const centers: LocalFinancialCenter[] = data.financial_centers || [];

    // Clear existing
    await db.financialCenters.where('user_id').equals(userId).delete();

    // Bulk insert
    await bulkInsertFinancialCenters(centers);

    // Update sync metadata
    await updateSyncMetadata('financial_centers', centers.length);

    logger.info('[referenceSync] ✅ Financial centers synced', { count: centers.length });
    return { success: true, count: centers.length };
  } catch (error) {
    logger.error('[referenceSync] ❌ Financial centers sync failed:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Sync cost centers from server
 */
export async function syncCostCenters(userId: number): Promise<{ success: boolean; count: number }> {
  logger.info('[referenceSync] Syncing cost centers...', { userId });

  try {
    // Backend uses CurrentUser dependency from session cookie
    const response = await fetchWithTimeout(`/api/v1/cost-centers`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch cost centers: ${response.status}`);
    }

    // Unwrap API pagination response: { cost_centers: [...], total, limit, offset }
    const data = await response.json();
    const centers: LocalCostCenter[] = data.cost_centers || [];

    // Clear existing
    await db.costCenters.where('user_id').equals(userId).delete();

    // Bulk insert
    await bulkInsertCostCenters(centers);

    // Update sync metadata
    await updateSyncMetadata('cost_centers', centers.length);

    logger.info('[referenceSync] ✅ Cost centers synced', { count: centers.length });
    return { success: true, count: centers.length };
  } catch (error) {
    logger.error('[referenceSync] ❌ Cost centers sync failed:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Sync article hierarchy from server
 */
export async function syncArticleHierarchy(userId: number): Promise<{ success: boolean; count: number }> {
  logger.info('[referenceSync] Syncing article hierarchy...', { userId });

  try {
    // Global hierarchy endpoint (not user-specific)
    const response = await fetchWithTimeout(`/api/v1/articles/hierarchy`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch article hierarchy: ${response.status}`);
    }

    // Direct array response (no pagination wrapper for hierarchy)
    const hierarchy: LocalArticleHierarchy[] = await response.json();

    // Clear existing
    await db.articleHierarchy.clear();

    // Bulk insert
    await bulkInsertArticleHierarchy(hierarchy);

    logger.info('[referenceSync] ✅ Article hierarchy synced', { count: hierarchy.length });
    return { success: true, count: hierarchy.length };
  } catch (error) {
    logger.error('[referenceSync] ❌ Article hierarchy sync failed:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Sync recurring plans from server (v11.4.0+)
 */
export async function syncRecurringPlans(
  userId: number,
  syncPeriodDays: number = 90
): Promise<{ success: boolean; count: number }> {
  logger.info('[referenceSync] Syncing recurring plans...', { userId, syncPeriodDays });

  try {
    // Calculate date range for sync period
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - syncPeriodDays);
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + syncPeriodDays);

    // Fetch from server with date filtering
    const params = new URLSearchParams({
      is_active: 'true',
      from_date: fromDate.toISOString().split('T')[0],
      to_date: toDate.toISOString().split('T')[0],
      limit: '1000'
    });

    const response = await fetchWithTimeout(`/api/v1/recurring-plans?${params.toString()}`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch recurring plans: ${response.status}`);
    }

    // Unwrap API pagination response: { items: [...], total, skip, limit }
    const data = await response.json();
    const plans = data.items || [];

    // Clear existing plans within date range (avoid stale data)
    await db.recurringPlans.where('user_id').equals(userId).delete();

    // Bulk insert
    if (plans.length > 0) {
      await db.recurringPlans.bulkAdd(plans);
    }

    // Update sync metadata
    await updateSyncMetadata('recurring_plans', plans.length);

    logger.info('[referenceSync] ✅ Recurring plans synced', { count: plans.length });
    return { success: true, count: plans.length };
  } catch (error) {
    logger.error('[referenceSync] ❌ Recurring plans sync failed:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Initial sync - синхронизация всех справочников
 */
export async function initialReferenceSync(
  userId: number,
  syncPeriodDays: number = 90
): Promise<{
  success: boolean;
  results: Record<string, { success: boolean; count: number }>;
}> {
  logger.info('[referenceSync] Starting initial sync...', { userId, syncPeriodDays });

  const results = {
    articles: await syncArticles(userId),
    financialCenters: await syncFinancialCenters(userId),
    costCenters: await syncCostCenters(userId),
    articleHierarchy: await syncArticleHierarchy(userId),
    recurringPlans: await syncRecurringPlans(userId, syncPeriodDays)  // v11.4.0+
  };

  const success = Object.values(results).every(r => r.success);

  logger.info('[referenceSync] Initial sync complete', { success, results });

  return { success, results };
}

/**
 * Update sync metadata
 */
async function updateSyncMetadata(entityType: string, totalRecords: number): Promise<void> {
  const metadata: LocalSyncMetadata = {
    entity_type: entityType,
    last_sync_timestamp: new Date(),
    sync_version: 1,
    total_records: totalRecords
  };

  await db.syncMetadata.put(metadata);
}

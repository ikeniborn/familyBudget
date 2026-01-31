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
    // Fetch from server
    const response = await fetchWithTimeout(`/api/v1/articles?user_id=${userId}`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch articles: ${response.status}`);
    }

    const articles: LocalArticle[] = await response.json();

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
    const response = await fetchWithTimeout(`/api/v1/financial-centers?user_id=${userId}`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch financial centers: ${response.status}`);
    }

    const centers: LocalFinancialCenter[] = await response.json();

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
    const response = await fetchWithTimeout(`/api/v1/cost-centers?user_id=${userId}`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch cost centers: ${response.status}`);
    }

    const centers: LocalCostCenter[] = await response.json();

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
    const response = await fetchWithTimeout(`/api/v1/articles/hierarchy?user_id=${userId}`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch article hierarchy: ${response.status}`);
    }

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
 * Initial sync - синхронизация всех справочников
 */
export async function initialReferenceSync(userId: number): Promise<{
  success: boolean;
  results: Record<string, { success: boolean; count: number }>;
}> {
  logger.info('[referenceSync] Starting initial sync...', { userId });

  const results = {
    articles: await syncArticles(userId),
    financialCenters: await syncFinancialCenters(userId),
    costCenters: await syncCostCenters(userId),
    articleHierarchy: await syncArticleHierarchy(userId)
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

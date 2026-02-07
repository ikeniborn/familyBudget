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
 * Sync stores from server (v11.4.2+)
 * Global reference data (не привязаны к пользователю)
 */
export async function syncStores(): Promise<{ success: boolean; count: number }> {
  logger.info('[referenceSync] Syncing stores...');

  try {
    const response = await fetchWithTimeout(`/api/v1/stores`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch stores: ${response.status}`);
    }

    const data = await response.json();
    const stores = data.stores || [];

    // Clear existing (global reference data - no user filtering)
    await db.stores.clear();

    // Bulk insert (use bulkPut for primary key 'id')
    if (stores.length > 0) {
      await db.stores.bulkPut(stores);
    }

    logger.info('[referenceSync] ✅ Stores synced', { count: stores.length });
    return { success: true, count: stores.length };
  } catch (error) {
    logger.error('[referenceSync] ❌ Stores sync failed:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Sync product groups from server (v11.4.2+)
 * Global reference data (не привязаны к пользователю)
 */
export async function syncProductGroups(): Promise<{ success: boolean; count: number }> {
  logger.info('[referenceSync] Syncing product groups...');

  try {
    const response = await fetchWithTimeout(`/api/v1/product-groups`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product groups: ${response.status}`);
    }

    const data = await response.json();
    const groups = data.product_groups || [];

    // Clear existing (global reference data - no user filtering)
    await db.productGroups.clear();

    // Bulk insert (use bulkPut for primary key 'id')
    if (groups.length > 0) {
      await db.productGroups.bulkPut(groups);
    }

    logger.info('[referenceSync] ✅ Product groups synced', { count: groups.length });
    return { success: true, count: groups.length };
  } catch (error) {
    logger.error('[referenceSync] ❌ Product groups sync failed:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Shopping Lists removed from reference sync (v11.4.2)
 * Reason: Shopping Lists are TRANSACTIONAL DATA (user mutations with temp_id),
 * not REFERENCE DATA (read-only global catalogs).
 *
 * Shopping Lists sync moved to shoppingSync.ts (similar to Facts sync).
 * Reference sync is only for: Articles, Financial Centers, Cost Centers, Article Hierarchy,
 * Stores, Product Groups.
 */

/**
 * Recurring Plans removed from reference sync (v11.4.2)
 * Reason: Backend endpoint /api/v1/recurring-plans returns 422 error.
 * DataLayer already has fallback to API for getRecurringPlans(),
 * so proactive sync is not required.
 *
 * Recurring Plans will be fetched on-demand from API when needed.
 */

/**
 * Initial sync - синхронизация всех справочников
 * v11.4.2: Removed recurringPlans and shoppingLists (moved to on-demand API)
 */
export async function initialReferenceSync(
  userId: number
): Promise<{
  success: boolean;
  results: Record<string, { success: boolean; count: number }>;
}> {
  logger.info('[referenceSync] Starting initial sync...', { userId });

  const results = {
    articles: await syncArticles(userId),
    financialCenters: await syncFinancialCenters(userId),
    costCenters: await syncCostCenters(userId),
    articleHierarchy: await syncArticleHierarchy(userId),
    stores: await syncStores(),  // v11.4.2+ (global reference data, no userId)
    productGroups: await syncProductGroups()  // v11.4.2+ (global reference data, no userId)
  };

  // Critical syncs (required for app to work)
  const criticalSyncs = ['articles', 'financialCenters', 'costCenters', 'articleHierarchy'];
  const success = criticalSyncs.every(key => results[key as keyof typeof results].success);

  // Non-critical syncs (nice to have, but app works without them)
  const nonCriticalSyncs = ['stores', 'productGroups'];
  nonCriticalSyncs.forEach(key => {
    if (!results[key as keyof typeof results].success) {
      logger.warn(`[referenceSync] ${key} sync failed, but continuing (non-critical)`);
    }
  });

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

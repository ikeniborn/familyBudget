/**
 * Reference Data Sync Operations
 * Синхронизация справочников (Articles, Financial Centers, Cost Centers)
 */

import { db, toCents } from '../core/database';
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
  LocalRecurringPlan,
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
 * Sync shopping lists from server (v11.4.3+)
 *
 * NOTE: Shopping Lists are TRANSACTIONAL DATA (user mutations), but we cache them
 * for offline access on /lists page. API returns server IDs, so we map to temp_id.
 */
export async function syncShoppingLists(userId: number): Promise<{ success: boolean; count: number }> {
  logger.info('[referenceSync] Syncing shopping lists...', { userId });

  try {
    const response = await fetchWithTimeout(`/api/v1/shopping-lists`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch shopping lists: ${response.status}`);
    }

    const data = await response.json();
    const lists = data.shopping_lists || [];

    // Transform API data: id → temp_id mapping for Dexie schema compatibility
    const transformedLists = lists.map((list: any) => ({
      ...list,
      temp_id: list.id?.toString() || list.temp_id,  // Use server ID as temp_id if missing
      creator_id: list.creator_id || userId,          // Fallback to current user
      is_active: list.is_active ?? true,
      sync_status: 'synced',
      synced_at: new Date(),
      created_at: list.created_at ? new Date(list.created_at) : new Date(),
      updated_at: list.updated_at ? new Date(list.updated_at) : new Date()
    }));

    // Clear existing user's lists
    await db.shoppingLists.where('creator_id').equals(userId).delete();

    // Bulk insert
    if (transformedLists.length > 0) {
      await db.shoppingLists.bulkPut(transformedLists);
    }

    logger.info('[referenceSync] ✅ Shopping lists synced', { count: transformedLists.length });
    return { success: true, count: transformedLists.length };
  } catch (error) {
    logger.error('[referenceSync] ❌ Shopping lists sync failed:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Sync recurring plans from server (v11.4.6 - restored)
 * Supports sync period filtering via from_date/to_date
 *
 * v11.4.2: Removed due to 422 error
 * v11.4.6: Restored with confirmed working endpoint
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

    // Try with date filtering (v11.4.0+)
    const params = new URLSearchParams({
      from_date: fromDate.toISOString().split('T')[0],
      to_date: toDate.toISOString().split('T')[0],
      limit: '1000'
    });

    const response = await fetchWithTimeout(`/api/v1/recurring-plans?${params.toString()}`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const plans = data.items || data;

    // Convert amounts to cents before storing
    const plansWithCents = plans.map((plan: LocalRecurringPlan) => ({
      ...plan,
      amount: toCents(plan.amount)
    }));

    // Clear user's existing plans and insert new ones
    await db.transaction('rw', db.recurringPlans, async () => {
      await db.recurringPlans.where('user_id').equals(userId).delete();
      if (plansWithCents.length > 0) {
        await db.recurringPlans.bulkAdd(plansWithCents);
      }
    });

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
 * v11.4.3: Restored shoppingLists (transactional data for offline /lists)
 * v11.4.6: Restored recurringPlans (proactive sync with working endpoint)
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
    productGroups: await syncProductGroups(),  // v11.4.2+ (global reference data, no userId)
    shoppingLists: await syncShoppingLists(userId),  // v11.4.3+ (transactional data for offline /lists)
    recurringPlans: await syncRecurringPlans(userId, 90)  // v11.4.6: Restored with working endpoint
  };

  // Critical syncs (required for app to work)
  const criticalSyncs = ['articles', 'financialCenters', 'costCenters', 'articleHierarchy'];
  const success = criticalSyncs.every(key => results[key as keyof typeof results].success);

  // Non-critical syncs (nice to have, but app works without them)
  const nonCriticalSyncs = ['stores', 'productGroups', 'shoppingLists', 'recurringPlans'];
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

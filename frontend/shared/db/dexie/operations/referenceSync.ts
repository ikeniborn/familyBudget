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
  LocalSyncMetadata,
  LocalShoppingListItem
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

    // Sync items for each list
    let totalItems = 0;
    for (const list of transformedLists) {
      const itemsResponse = await fetchWithTimeout(
        `/api/v1/shopping-lists/${list.id}/with-items`,
        { method: 'GET', credentials: 'include' }
      );

      if (!itemsResponse.ok) {
        logger.warn('[referenceSync] ⚠️ Could not fetch items for list', {
          list_id: list.id,
          status: itemsResponse.status
        });
        continue;
      }

      const itemsData = await itemsResponse.json();
      const items: any[] = itemsData.items || [];

      // Preserve existing temp_ids so items keep stable primary keys across re-syncs
      const existingItems = await db.shoppingListItems
        .where('shopping_list_temp_id').equals(list.temp_id)
        .toArray();
      const existingTempIdByItemServerId = new Map(
        existingItems
          .filter((i: LocalShoppingListItem) => i.id != null)
          .map((i: LocalShoppingListItem) => [i.id!, i.temp_id])
      );

      // Server IDs of items with pending/deleted status — must not be overwritten by server data
      const protectedItemIds = new Set<number>(
        existingItems
          .filter((i: LocalShoppingListItem) =>
            (i.sync_status === 'pending' || i.sync_status === 'deleted') && i.id != null)
          .map((i: LocalShoppingListItem) => i.id!)
      );

      // Clear only SYNCED items for this list (preserve pending/unsent items)
      await db.shoppingListItems
        .where('shopping_list_temp_id')
        .equals(list.temp_id)
        .filter(item => item.sync_status === 'synced')
        .delete();

      if (items.length > 0) {
        const transformedItems: LocalShoppingListItem[] = items.map((item: any) => ({
          ...item,
          temp_id: existingTempIdByItemServerId.get(item.id) ?? item.temp_id ?? item.id,
          shopping_list_temp_id: list.temp_id,
          sync_status: 'synced' as const,
          sync_hash: null,
          content_hash: null,
          synced_at: new Date(),
          created_at: item.created_at ? new Date(item.created_at) : new Date(),
          updated_at: item.updated_at ? new Date(item.updated_at) : new Date(),
          completed_at: item.completed_at ? new Date(item.completed_at) : null,
          deleted_at: item.deleted_at ? new Date(item.deleted_at) : null
        }));

        const safeItems = transformedItems.filter((i: LocalShoppingListItem) =>
          !i.id || !protectedItemIds.has(i.id)
        );
        if (safeItems.length > 0) {
          await db.shoppingListItems.bulkPut(safeItems);
        }
        totalItems += safeItems.length;
      }
    }

    logger.info('[referenceSync] ✅ Shopping lists synced', {
      count: transformedLists.length,
      items: totalItems
    });
    return { success: true, count: transformedLists.length };
  } catch (error) {
    logger.error('[referenceSync] ❌ Shopping lists sync failed:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Calculate date range for full months (v11.5.0+)
 *
 * @param months - Number of months to include in each direction
 * @returns Object with fromDate and toDate in YYYY-MM-DD format
 *
 * EXAMPLES:
 * - Today: 2025-02-09, months: 3
 *   → from_date: 2024-11-01, to_date: 2025-05-31
 *
 * - Today: 2025-01-15, months: 2
 *   → from_date: 2024-11-01, to_date: 2025-03-31
 */
function calculateFullMonthsRange(months: number): { fromDate: string; toDate: string } {
  const today = new Date();

  // Calculate from_date (start of month N months ago)
  const fromYear = today.getFullYear();
  const fromMonth = today.getMonth() - months;
  const fromDate = new Date(fromYear, fromMonth, 1);

  // Calculate to_date (end of month N months ahead)
  // Use next month's day 0 = last day of target month
  const toYear = today.getFullYear();
  const toMonth = today.getMonth() + months + 1;
  const toDate = new Date(toYear, toMonth, 0);

  // Format dates manually to avoid timezone issues
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    fromDate: formatDate(fromDate),
    toDate: formatDate(toDate)
  };
}

/**
 * Sync recurring plans from server (v11.5.0+)
 * Supports sync period filtering via from_date/to_date
 *
 * v11.4.2: Removed due to 422 error
 * v11.4.6: Restored with confirmed working endpoint
 * v11.5.0: Changed to month-based period (full months calculation)
 */
export async function syncRecurringPlans(
  userId: number,
  syncPeriodMonths: number = 3
): Promise<{ success: boolean; count: number }> {
  logger.info('[referenceSync] Syncing recurring plans...', { userId, syncPeriodMonths });

  try {
    // Calculate full months range
    const { fromDate, toDate } = calculateFullMonthsRange(syncPeriodMonths);

    // Try with date filtering (v11.5.0+)
    const params = new URLSearchParams({
      from_date: fromDate,  // YYYY-MM-DD (start of month)
      to_date: toDate,      // YYYY-MM-DD (end of month)
      limit: '100'  // Matches DataLayer.ts:1373 (fixed in 329f1822) and backend constraint
    });

    const response = await fetchWithTimeout(`/api/v1/recurring-plans?${params.toString()}`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      // Enhanced logging for 422 errors
      if (response.status === 422) {
        try {
          const errorData = await response.json();
          logger.error('[referenceSync] ❌ Recurring plans sync failed: Invalid params', {
            status: response.status,
            from_date: params.get('from_date'),
            to_date: params.get('to_date'),
            error: errorData
          });
        } catch {
          // If response is not JSON, log basic info
          logger.error('[referenceSync] ❌ Recurring plans 422 error (non-JSON response)', {
            status: response.status,
            from_date: params.get('from_date'),
            to_date: params.get('to_date')
          });
        }
      }
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
 * v11.5.0: Changed recurringPlans to month-based sync (3 months default)
 */
export async function initialReferenceSync(
  userId: number
): Promise<{
  success: boolean;
  results: Record<string, { success: boolean; count: number }>;
}> {
  logger.info('[referenceSync] Starting initial sync...', { userId });

  // Get sync period for plans from DexieManager (v11.5.0+)
  const dexieManager = await import('../DexieManager').then(m => m.getDexieManager());
  const syncPeriodMonths = (await dexieManager).getSyncPeriodMonths?.() ?? 3;

  const results = {
    articles: await syncArticles(userId),
    financialCenters: await syncFinancialCenters(userId),
    costCenters: await syncCostCenters(userId),
    articleHierarchy: await syncArticleHierarchy(userId),
    stores: await syncStores(),  // v11.4.2+ (global reference data, no userId)
    productGroups: await syncProductGroups(),  // v11.4.2+ (global reference data, no userId)
    shoppingLists: await syncShoppingLists(userId),  // v11.4.3+ (transactional data for offline /lists)
    recurringPlans: await syncRecurringPlans(userId, syncPeriodMonths)  // v11.5.0: Month-based sync
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

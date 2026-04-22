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
  LocalBudgetFact,
  LocalSyncMetadata,
  LocalShoppingListItem
} from '../types/models';
import { mapAPIFactToLocal, validateMappedFact } from '../utils/apiMapper';

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
 * Sync product group hierarchy (closure table) from server
 */
export async function syncProductGroupHierarchy(): Promise<{ success: boolean; count: number }> {
  logger.info('[referenceSync] Syncing product group hierarchy...');

  try {
    const response = await fetchWithTimeout('/api/v1/product-groups/hierarchy', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product group hierarchy: ${response.status}`);
    }

    const hierarchy = await response.json();

    await db.productGroupHierarchy.clear();
    if (hierarchy.length > 0) {
      await db.productGroupHierarchy.bulkPut(hierarchy);
    }

    logger.info('[referenceSync] ✅ Product group hierarchy synced', { count: hierarchy.length });
    return { success: true, count: hierarchy.length };
  } catch (error) {
    logger.error('[referenceSync] ❌ Product group hierarchy sync failed:', error);
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

    // CRITICAL FIX: Preserve existing temp_ids for lists already in Dexie
    // If a list was created locally (UUID temp_id), we must keep that UUID
    // so that shopping_list_items (keyed by temp_id) remain findable
    const existingListsInDexie = await db.shoppingLists.where('creator_id').equals(userId).toArray();
    const existingTempIdByServerId = new Map<number, string>(
      existingListsInDexie
        .filter(l => l.id != null)
        .map(l => [l.id!, l.temp_id])
    );

    // Collect server IDs of pending/deleted lists — they must not be overwritten
    const pendingOrDeletedLists = existingListsInDexie.filter(
      l => l.sync_status === 'pending' || l.sync_status === 'deleted'
    );
    const pendingListServerIds = new Set(
      pendingOrDeletedLists.filter(l => l.id != null).map(l => l.id!)
    );

    // Transform API data: preserve existing temp_id if list already exists locally
    const transformedLists = lists.map((list: any) => ({
      ...list,
      temp_id: existingTempIdByServerId.get(list.id) || list.temp_id || list.id?.toString(),
      creator_id: list.creator_id || userId,
      is_active: list.is_active ?? true,
      sync_status: 'synced',
      synced_at: new Date(),
      created_at: list.created_at ? new Date(list.created_at) : new Date(),
      updated_at: list.updated_at ? new Date(list.updated_at) : new Date()
    }));

    // Only delete synced lists — pending/deleted ones are awaiting upload
    await db.shoppingLists
      .where('creator_id').equals(userId)
      .filter(l => l.sync_status === 'synced')
      .delete();

    // Skip lists whose local version has unsent edits or pending deletion
    const safeToInsert = transformedLists.filter(
      (l: any) => !l.id || !pendingListServerIds.has(l.id)
    );
    if (safeToInsert.length > 0) {
      await db.shoppingLists.bulkPut(safeToInsert);
    }

    // Sync shopping list items for each list (v11.6.1+)
    // API: GET /api/v1/shopping-list-items?shopping_list_id={id}
    // Returns { items: [...], total, limit, offset }
    let totalItems = 0;
    for (const list of transformedLists) {
      const serverId = list.id;
      if (!serverId) continue; // Skip offline-only lists (no server ID yet)

      try {
        const itemsResponse = await fetchWithTimeout(
          `/api/v1/shopping-list-items?shopping_list_id=${serverId}`,
          { method: 'GET', credentials: 'include' }
        );

        if (!itemsResponse.ok) {
          logger.warn('[referenceSync] Failed to fetch items for list', {
            shopping_list_id: serverId,
            status: itemsResponse.status
          });
          continue;
        }

        const itemsData = await itemsResponse.json();
        // Filter soft-deleted items (API already excludes them, but guard defensively)
        const items = (itemsData.items || []).filter((item: any) => !item.deleted_at);

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
            temp_id: existingTempIdByItemServerId.get(item.id) || item.temp_id || `server-item-${item.id}`,
            shopping_list_temp_id: list.temp_id, // Link to the Dexie list by temp_id
            sync_status: 'synced',
            synced_at: new Date(),
            created_at: item.created_at ? new Date(item.created_at) : new Date(),
            updated_at: item.updated_at ? new Date(item.updated_at) : new Date(),
            completed_at: item.completed_at ? new Date(item.completed_at) : null,
            deleted_at: item.deleted_at ? new Date(item.deleted_at) : null,
            sync_hash: item.sync_hash || null,
            content_hash: item.content_hash || null,
            version: item.version ?? 1,
            last_modified_by: item.last_modified_by || null,
            conflict_data: undefined
          }));
          // Skip items whose local version has unsent edits or pending deletion
          const safeItems = transformedItems.filter((i: LocalShoppingListItem) =>
            !i.id || !protectedItemIds.has(i.id)
          );
          if (safeItems.length > 0) {
            await db.shoppingListItems.bulkPut(safeItems);
          }
          totalItems += safeItems.length;
        }
      } catch (itemError) {
        logger.warn('[referenceSync] Error fetching items for list (non-critical)', {
          shopping_list_id: serverId,
          error: itemError
        });
        // Continue with next list — item sync failure is non-critical
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
 * Calculate date range for full months
 *
 * @param historyMonths - Months into the past (from start of month)
 * @param futureMonths  - Months into the future (to end of month)
 * @returns Object with fromDate and toDate in YYYY-MM-DD format
 */
function calculatePlansRange(historyMonths: number, futureMonths: number): { fromDate: string; toDate: string } {
  const today = new Date();
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const fromDate = new Date(today.getFullYear(), today.getMonth() - historyMonths, 1);
  const toDate = new Date(today.getFullYear(), today.getMonth() + futureMonths + 1, 0);
  return { fromDate: formatDate(fromDate), toDate: formatDate(toDate) };
}

/**
 * Sync regular plans (record_type='plan') from server
 * Uses historyMonths/futureMonths date window to control scope
 *
 * v11.6.0: Added to complement syncRecurringPlans for offline plan access
 */
export async function syncPlans(
  userId: number,
  historyMonths: number = 3,
  futureMonths: number = 3
): Promise<{ success: boolean; count: number }> {
  logger.info('[referenceSync] Syncing plans...', { userId, historyMonths, futureMonths });

  try {
    const { fromDate, toDate } = calculatePlansRange(historyMonths, futureMonths);
    const params = new URLSearchParams({
      record_type: 'plan',
      date_from: fromDate,
      date_to: toDate,
      limit: '500'
    });

    const response = await fetchWithTimeout(`/api/v1/facts?${params.toString()}`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const rawPlans = data.facts || data.items || [];

    // Map API response → LocalBudgetFact (generates temp_id, normalises field names, validates)
    // Per-item error handling: skip malformed plans instead of failing the whole sync
    const mappedPlans: LocalBudgetFact[] = [];
    for (const rawPlan of rawPlans) {
      try {
        const mapped = mapAPIFactToLocal(rawPlan as Record<string, unknown>);
        validateMappedFact(mapped);
        mappedPlans.push({ ...mapped, amount: toCents(mapped.amount) });
      } catch (err) {
        logger.warn('[referenceSync] Skipping malformed plan', {
          id: (rawPlan as any).id,
          error: (err as Error).message
        });
      }
    }

    // Collect server IDs of locally pending/deleted plans before modifying DB
    // These must not be overwritten by stale server data
    const protectedPlans = await db.budgetFacts
      .where('[user_id+date]')
      .between([userId, fromDate], [userId, toDate + '\uffff'])
      .filter((f: LocalBudgetFact) =>
        f.record_type === 'plan' &&
        (f.sync_status === 'pending' || f.sync_status === 'deleted')
      )
      .toArray();
    const protectedPlanIds = new Set(
      protectedPlans.filter((p: LocalBudgetFact) => p.id != null).map((p: LocalBudgetFact) => p.id!)
    );

    // Replace server-synced plans in the date window; preserve pending/deleted local records
    await db.transaction('rw', db.budgetFacts, async () => {
      // Only delete synced plans — deleted ones are awaiting upload and must stay invisible
      await db.budgetFacts
        .where('[user_id+date]')
        .between([userId, fromDate], [userId, toDate + '\uffff'])
        .filter((f: LocalBudgetFact) =>
          f.record_type === 'plan' && f.sync_status === 'synced'
        )
        .delete();

      // Skip plans whose local version has unsent edits or pending deletion
      const safePlans = mappedPlans.filter(
        (p: LocalBudgetFact) => !p.id || !protectedPlanIds.has(p.id)
      );
      if (safePlans.length > 0) {
        await db.budgetFacts.bulkPut(safePlans);
      }
    });

    await updateSyncMetadata('plans', mappedPlans.length);

    logger.info('[referenceSync] ✅ Plans synced', { count: mappedPlans.length, fromDate, toDate });
    return { success: true, count: mappedPlans.length };
  } catch (error) {
    logger.error('[referenceSync] ❌ Plans sync failed:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Sync recurring plans from server (v11.5.0+)
 * Note: /api/v1/recurring-plans does NOT support date filtering (422 if date params sent)
 * Fetches all active recurring plans without a date window.
 *
 * v11.4.2: Date filter removed — endpoint returned 422 with date params
 * v11.4.6: Restored with confirmed working endpoint (no date params)
 * v11.6.0: No date filter; regular plans synced separately via syncPlans()
 */
export async function syncRecurringPlans(
  userId: number
): Promise<{ success: boolean; count: number }> {
  logger.info('[referenceSync] Syncing recurring plans...', { userId });

  try {
    // Fetch all active plans without date filter to ensure complete dataset in Dexie
    // Date filtering was removed because it caused incomplete results when plans fall
    // outside the window (e.g. yearly plans, plans near boundary dates)
    const params = new URLSearchParams({
      limit: '500'
    });

    const response = await fetchWithTimeout(`/api/v1/recurring-plans/?${params.toString()}`, {
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
    // Use bulkPut (not bulkAdd) for idempotent sync: prevents ConstraintError if sync
    // is called twice (e.g. post-SW-update trigger + normal init race condition)
    await db.transaction('rw', db.recurringPlans, async () => {
      await db.recurringPlans.where('user_id').equals(userId).delete();
      if (plansWithCents.length > 0) {
        await db.recurringPlans.bulkPut(plansWithCents);
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
 * v11.6.0: Added syncPlans for regular plans (record_type='plan') with date window
 */
export async function initialReferenceSync(
  userId: number,
  historyMonths: number = 3,
  futureMonths: number = 3
): Promise<{
  success: boolean;
  results: Record<string, { success: boolean; count: number }>;
}> {
  logger.info('[referenceSync] Starting initial sync...', { userId, historyMonths, futureMonths });

  // BUG-5 one-shot pruner: remove synthetic duplicate shopping items.
  // Older versions of listOperations.ts synthesised `item_<id>_<ts>` temp_ids
  // when the API did not echo temp_id — leaving two Dexie rows with the same
  // server `id` (one synthetic, one real UUID). Drop the synthetic ones.
  try {
    const { db } = await import('../core/database');
    const synthetic = await db.shoppingListItems
      .filter(item => typeof item.temp_id === 'string' && item.temp_id.startsWith('item_'))
      .toArray();
    let pruned = 0;
    for (const syn of synthetic) {
      if (syn.id == null) continue;
      const siblings = await db.shoppingListItems.where('id').equals(syn.id).toArray();
      const hasRealSibling = siblings.some(s =>
        s.temp_id !== syn.temp_id &&
        typeof s.temp_id === 'string' &&
        !s.temp_id.startsWith('item_')
      );
      if (hasRealSibling) {
        await db.shoppingListItems.where('temp_id').equals(syn.temp_id).delete();
        pruned++;
      }
    }
    if (pruned > 0) {
      logger.info('[referenceSync] Pruned synthetic duplicate shopping items', { count: pruned });
    }
  } catch (pruneError) {
    logger.warn('[referenceSync] Synthetic-item pruner failed (non-fatal)', pruneError);
  }

  // Upload pending shopping items BEFORE downloading (prevents data loss on cache refresh)
  try {
    const { uploadPendingShoppingOperations, uploadPendingShoppingLists } = await import('./shoppingSync');
    await uploadPendingShoppingLists();
    await uploadPendingShoppingOperations();
    logger.info('[referenceSync] Pending shopping operations uploaded before sync');
  } catch (uploadError) {
    logger.warn('[referenceSync] Failed to upload pending shopping operations (continuing sync)', uploadError);
  }

  // Upload pending fact operations (create/update/delete) before downloading server data
  // Ensures local deletions and edits reach server before plans/facts are refreshed
  try {
    const { uploadPendingOperations } = await import('./factSync');
    await uploadPendingOperations();
    logger.info('[referenceSync] Pending fact operations uploaded before sync');
  } catch (uploadError) {
    logger.warn('[referenceSync] Failed to upload pending fact operations (continuing sync)', uploadError);
  }

  const results = {
    articles: await syncArticles(userId),
    financialCenters: await syncFinancialCenters(userId),
    costCenters: await syncCostCenters(userId),
    articleHierarchy: await syncArticleHierarchy(userId),
    stores: await syncStores(),                                // v11.4.2+ (global reference data, no userId)
    productGroups: await syncProductGroups(),                  // v11.4.2+ (global reference data, no userId)
    productGroupHierarchy: await syncProductGroupHierarchy(),  // closure table for offline hierarchy queries
    shoppingLists: await syncShoppingLists(userId),  // v11.4.3+ (transactional data for offline /lists)
    plans: await syncPlans(userId, historyMonths, futureMonths),  // v11.6.0: regular plans with date window
    recurringPlans: await syncRecurringPlans(userId) // v11.6.0: all active recurring plans (no date filter)
  };

  // Critical syncs (required for app to work)
  const criticalSyncs = ['articles', 'financialCenters', 'costCenters', 'articleHierarchy'];
  const success = criticalSyncs.every(key => results[key as keyof typeof results].success);

  // Non-critical syncs (nice to have, but app works without them)
  const nonCriticalSyncs = ['stores', 'productGroups', 'productGroupHierarchy', 'shoppingLists', 'plans', 'recurringPlans'];
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

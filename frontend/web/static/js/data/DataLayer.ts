/**
 * Data Layer - Unified API for reference data
 *
 * Provides abstraction over Dexie (offline) and REST API (online) data sources.
 * Implements Dexie-first strategy with graceful fallback to API.
 *
 * @example
 * ```typescript
 * import { dataLayer } from './DataLayer';
 *
 * // Get articles (Dexie-first, API fallback)
 * const articles = await dataLayer.getArticles({ type: 'expense' });
 *
 * // Get financial centers
 * const centers = await dataLayer.getFinancialCenters(userId, true);
 *
 * // Get performance stats
 * const stats = dataLayer.getPerformanceStats();
 * // Stats: { reductionPercent: 75.5, speedupFactor: 12.3 }
 * ```
 *
 * @module data/DataLayer
 */

import { getDexieManager, DexieManager, db as dexieDb, isDexieActive, mapAPIFactToLocal } from '@db/dexie';
import { performanceMonitor } from '../monitoring/PerformanceMonitor';
import type { PerformanceStats } from '../monitoring/PerformanceMonitor';
import type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalArticleHierarchy,
  LocalShoppingList,
  ShoppingListWithStats,
  LocalShoppingListItem,
  LocalStore,
  LocalProductGroup,
  LocalBudgetFact,
  LocalRecurringPlan,
  ShoppingListFilters,
  ShoppingListItemFilters,
  StoreFilters,
  ProductGroupFilters,
  FactFilters,
  RecurringPlanFilters
} from '@db/dexie';
import { factsManager } from '../dashboard/features/factsManager';
import type {
  ArticleListResponse,
  FinancialCenterListResponse,
  CostCenterListResponse,
  StoreListResponse,
  ShoppingListListResponse,
  ShoppingListItemListResponse,
  ProductGroupListResponse,
  FactListResponse,
  RecurringPlanListResponse,
  ArticleHierarchyListResponse
} from './types/api-responses';

/**
 * Article filters for getArticles()
 */
export interface ArticleFilters {
  user_id?: number;
  type?: 'income' | 'expense';
  parent_id?: number | null;
  is_active?: boolean;
}

/**
 * Data Layer class
 * Provides unified API for reference data with Dexie-first, API-fallback strategy
 */
export class DataLayer {
  private dexie: DexieManager | null = null;
  private dexiePromise: Promise<DexieManager> | null = null;

  /**
   * Lazy initialize Dexie manager
   * Handles both sync and async getDexieManager() implementations
   */
  private async getDexie(): Promise<any> {
    if (this.dexie) {
      return this.dexie;
    }

    if (this.dexiePromise) {
      return this.dexiePromise;
    }

    this.dexiePromise = Promise.resolve(getDexieManager()).then(async (manager) => {
      // Initialize Dexie on first access
      if (!manager.isReady()) {
        await manager.init();
      }
      this.dexie = manager;
      return manager;
    });

    return this.dexiePromise;
  }

  /**
   * NEW: Determine whether to use Dexie or API
   *
   * Returns true only if user ACTIVATED Dexie (opt-in).
   * By default (API-first), returns false.
   */
  private shouldUseDexie(): boolean {
    return isDexieActive();
  }

  // =============================================================================
  // Articles
  // =============================================================================

  /**
   * Get articles with optional filters
   *
   * NEW STRATEGY (API-First with Opt-In Dexie):
   * - By default: Use API (100% reliable)
   * - If user activated Dexie: Use Dexie with API fallback
   *
   * @param filters - Optional filters (user_id, type, parent_id, is_active)
   * @returns Array of articles
   */
  async getArticles(filters?: ArticleFilters): Promise<LocalArticle[]> {
    const startTime = performance.now();

    console.debug('[DATA_LAYER] getArticles', {
      filters,
      useDexie: this.shouldUseDexie()
    });

    try {
      // API-FIRST: Use API if Dexie not activated
      if (!this.shouldUseDexie()) {
        const result = await this.getArticlesFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getArticles', duration);
        console.debug('[DATA_LAYER] API returned', {
          count: result.length,
          source: 'API',
          durationMs: duration.toFixed(2)
        });
        return result;
      }

      // OPT-IN: User activated Dexie
      const dexie = await this.getDexie();

      // Wait for readiness (max 5s)
      if (!dexie.isReady()) {
        const waitStartTime = Date.now();
        while (!dexie.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!dexie.isReady()) {
          console.warn('[DATA_LAYER] Dexie timeout, using API fallback');
          const result = await this.getArticlesFromAPI(filters);
          performanceMonitor.trackAPICall('getArticles', performance.now() - startTime);
          return result;
        }
      }

      // Query Dexie
      console.debug('[DATA_LAYER] Using Dexie');
      const result = await dexie.queryArticles(filters);
      const duration = performance.now() - startTime;

      // CRITICAL: Fallback на API если Dexie вернул пустой результат
      if (result.length === 0) {
        console.debug('[DATA_LAYER] Dexie returned empty, using API fallback');
        const apiResult = await this.getArticlesFromAPI(filters);
        performanceMonitor.trackAPICall('getArticles', performance.now() - startTime);
        performanceMonitor.trackCacheMiss('getArticles', 'api');
        console.debug('[DATA_LAYER] API fallback returned', { count: apiResult.length });

        // NEW: Cache articles in Dexie for future offline use
        if (apiResult.length > 0 && filters?.user_id !== undefined) {
          try {
            const syncResult = await dexie.syncArticles(filters.user_id);
            if (syncResult.success) {
              console.debug('[DATA_LAYER] Cached API articles in Dexie', { count: syncResult.count });
            }
          } catch (cacheError) {
            console.warn('[DATA_LAYER] Failed to cache articles:', cacheError);
          }
        }

        return apiResult;
      }

      performanceMonitor.trackDexieCall('getArticles', duration);
      performanceMonitor.trackCacheHit('getArticles', 'dexie');
      console.debug('[DATA_LAYER] Dexie returned', {
        count: result.length,
        source: 'Dexie',
        durationMs: duration.toFixed(2)
      });
      return result;

    } catch (error) {
      console.error('[DATA_LAYER] Error in getArticles', error);
      // Graceful fallback на API при любой ошибке
      const result = await this.getArticlesFromAPI(filters);
      performanceMonitor.trackAPICall('getArticles', performance.now() - startTime);
      return result;
    }
  }

  /**
   * Fetch articles from REST API
   *
   * @param filters - Optional filters
   * @returns Array of articles
   */
  private async getArticlesFromAPI(filters?: ArticleFilters): Promise<LocalArticle[]> {
    const params = new URLSearchParams();
    params.set('limit', '1000');

    if (filters?.user_id !== undefined) {
      params.set('user_id', filters.user_id.toString());
    }
    if (filters?.type) {
      params.set('type', filters.type);
    }
    if (filters?.parent_id !== undefined) {
      if (filters.parent_id === null) {
        params.set('parent_id', 'null');
      } else {
        params.set('parent_id', filters.parent_id.toString());
      }
    }
    if (filters?.is_active !== undefined) {
      params.set('is_active', filters.is_active.toString());
    }

    const response = await fetch(`/api/v1/articles?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: ArticleListResponse = await response.json();
    // Backend returns ArticleListResponse { articles: [...] }
    return data.articles || [];
  }

  // =============================================================================
  // Financial Centers
  // =============================================================================

  /**
   * Get financial centers for a user
   *
   * NEW STRATEGY (API-First with Opt-In Dexie):
   * - By default: Use API (100% reliable)
   * - If user activated Dexie: Use Dexie with API fallback
   *
   * @param userId - User ID
   * @param includeGlobal - Include global centers (default: true)
   * @returns Array of financial centers
   */
  async getFinancialCenters(
    userId: number,
    includeGlobal: boolean = true
  ): Promise<LocalFinancialCenter[]> {
    const startTime = performance.now();

    console.debug('[DATA_LAYER] getFinancialCenters', {
      userId,
      includeGlobal,
      useDexie: this.shouldUseDexie()
    });

    try {
      // API-FIRST: Use API if Dexie not activated
      if (!this.shouldUseDexie()) {
        const result = await this.getFinancialCentersFromAPI(includeGlobal);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getFinancialCenters', duration);
        console.debug('[DATA_LAYER] API returned', {
          count: result.length,
          source: 'API',
          durationMs: duration.toFixed(2)
        });
        return result;
      }

      // OPT-IN: User activated Dexie
      const dexie = await this.getDexie();

      // Wait for readiness (max 5s)
      if (!dexie.isReady()) {
        const waitStartTime = Date.now();
        while (!dexie.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!dexie.isReady()) {
          console.warn('[DATA_LAYER] Dexie timeout, using API fallback');
          const result = await this.getFinancialCentersFromAPI(includeGlobal);
          performanceMonitor.trackAPICall('getFinancialCenters', performance.now() - startTime);
          return result;
        }
      }

      // Query Dexie
      console.debug('[DATA_LAYER] Using Dexie');
      const result = await dexie.queryFinancialCenters(userId, true);
      const duration = performance.now() - startTime;

      // CRITICAL: Fallback на API если Dexie вернул пустой результат
      if (result.length === 0) {
        console.debug('[DATA_LAYER] Dexie returned empty, using API fallback');
        const apiResult = await this.getFinancialCentersFromAPI(includeGlobal);
        performanceMonitor.trackAPICall('getFinancialCenters', performance.now() - startTime);
        performanceMonitor.trackCacheMiss('getFinancialCenters', 'api');
        console.debug('[DATA_LAYER] API fallback returned', { count: apiResult.length });

        // NEW: Cache financial centers in Dexie for future offline use
        if (apiResult.length > 0) {
          try {
            const syncResult = await dexie.syncFinancialCenters(userId);
            if (syncResult.success) {
              console.debug('[DATA_LAYER] Cached API financial centers in Dexie', { count: syncResult.count });
            }
          } catch (cacheError) {
            console.warn('[DATA_LAYER] Failed to cache financial centers:', cacheError);
          }
        }

        return apiResult;
      }

      performanceMonitor.trackDexieCall('getFinancialCenters', duration);
      performanceMonitor.trackCacheHit('getFinancialCenters', 'dexie');
      console.debug('[DATA_LAYER] Dexie returned', {
        count: result.length,
        source: 'Dexie',
        durationMs: duration.toFixed(2)
      });
      return result;

    } catch (error) {
      console.error('[DATA_LAYER] Error in getFinancialCenters', error);
      // Graceful fallback на API при любой ошибке
      const result = await this.getFinancialCentersFromAPI(includeGlobal);
      performanceMonitor.trackAPICall('getFinancialCenters', performance.now() - startTime);
      return result;
    }
  }

  /**
   * Fetch financial centers from REST API
   *
   * @param includeGlobal - Include global centers
   * @returns Array of financial centers
   */
  private async getFinancialCentersFromAPI(
    includeGlobal: boolean
  ): Promise<LocalFinancialCenter[]> {
    const params = new URLSearchParams();
    params.set('limit', '1000');
    if (includeGlobal) {
      params.set('include_global', 'true');
    }

    const response = await fetch(`/api/v1/financial-centers?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: FinancialCenterListResponse = await response.json();
    // Backend returns FinancialCenterListResponse { financial_centers: [...] }
    return data.financial_centers || [];
  }

  // =============================================================================
  // Cost Centers
  // =============================================================================

  /**
   * Get cost centers for a user
   *
   * NEW STRATEGY (API-First with Opt-In Dexie):
   * - By default: Use API (100% reliable)
   * - If user activated Dexie: Use Dexie with API fallback
   *
   * @param userId - User ID
   * @param financialCenterId - Optional financial center filter (null = no filter)
   * @param includeGlobal - Include global centers (default: true)
   * @returns Array of cost centers
   */
  async getCostCenters(
    userId: number,
    financialCenterId: number | null = null,
    includeGlobal: boolean = true
  ): Promise<LocalCostCenter[]> {
    const startTime = performance.now();

    console.debug('[DATA_LAYER] getCostCenters', {
      userId,
      financialCenterId,
      includeGlobal,
      useDexie: this.shouldUseDexie()
    });

    try {
      // API-FIRST: Use API if Dexie not activated
      if (!this.shouldUseDexie()) {
        const result = await this.getCostCentersFromAPI(financialCenterId, includeGlobal);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getCostCenters', duration);
        console.debug('[DATA_LAYER] API returned', {
          count: result.length,
          source: 'API',
          durationMs: duration.toFixed(2)
        });
        return result;
      }

      // OPT-IN: User activated Dexie
      const dexie = await this.getDexie();

      // Wait for readiness (max 5s)
      if (!dexie.isReady()) {
        const waitStartTime = Date.now();
        while (!dexie.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!dexie.isReady()) {
          console.warn('[DATA_LAYER] Dexie timeout, using API fallback');
          const result = await this.getCostCentersFromAPI(financialCenterId, includeGlobal);
          performanceMonitor.trackAPICall('getCostCenters', performance.now() - startTime);
          return result;
        }
      }

      // Query Dexie
      console.debug('[DATA_LAYER] Using Dexie');
      const result = await dexie.queryFilteredCostCenters(userId, financialCenterId, includeGlobal);
      const duration = performance.now() - startTime;

      // CRITICAL: Fallback на API если Dexie вернул пустой результат
      if (result.length === 0) {
        console.debug('[DATA_LAYER] Dexie returned empty, using API fallback');
        const apiResult = await this.getCostCentersFromAPI(financialCenterId, includeGlobal);
        performanceMonitor.trackAPICall('getCostCenters', performance.now() - startTime);
        performanceMonitor.trackCacheMiss('getCostCenters', 'api');
        console.debug('[DATA_LAYER] API fallback returned', { count: apiResult.length });

        // NEW: Cache cost centers in Dexie for future offline use
        if (apiResult.length > 0) {
          try {
            const syncResult = await dexie.syncCostCenters(userId);
            if (syncResult.success) {
              console.debug('[DATA_LAYER] Cached API cost centers in Dexie', { count: syncResult.count });
            }
          } catch (cacheError) {
            console.warn('[DATA_LAYER] Failed to cache cost centers:', cacheError);
          }
        }

        return apiResult;
      }

      performanceMonitor.trackDexieCall('getCostCenters', duration);
      performanceMonitor.trackCacheHit('getCostCenters', 'dexie');
      console.debug('[DATA_LAYER] Dexie returned', {
        count: result.length,
        source: 'Dexie',
        durationMs: duration.toFixed(2)
      });
      return result;

    } catch (error) {
      console.error('[DATA_LAYER] Error in getCostCenters', error);
      // Graceful fallback на API при любой ошибке
      const result = await this.getCostCentersFromAPI(financialCenterId, includeGlobal);
      performanceMonitor.trackAPICall('getCostCenters', performance.now() - startTime);
      return result;
    }
  }

  /**
   * Fetch cost centers from REST API
   *
   * @param financialCenterId - Optional financial center filter
   * @param includeGlobal - Include global centers
   * @returns Array of cost centers
   */
  private async getCostCentersFromAPI(
    financialCenterId: number | null,
    includeGlobal: boolean
  ): Promise<LocalCostCenter[]> {
    const params = new URLSearchParams();
    params.set('limit', '1000');
    if (includeGlobal) {
      params.set('include_global', 'true');
    }
    if (financialCenterId !== null) {
      params.set('financial_center_id', financialCenterId.toString());
    }

    const response = await fetch(`/api/v1/cost-centers?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: CostCenterListResponse = await response.json();
    // Backend returns CostCenterListResponse { cost_centers: [...] }
    return data.cost_centers || [];
  }

  // =============================================================================
  // Article Hierarchy
  // =============================================================================

  /**
   * Get article hierarchy using closure table
   *
   * @param articleId - Article ID to get hierarchy for
   * @returns Array of hierarchy records (ancestor-descendant pairs)
   */
  async getArticleHierarchy(articleId: number): Promise<LocalArticleHierarchy[]> {
    const startTime = performance.now();

    try {
      // API-FIRST
      if (!this.shouldUseDexie()) {
        const result = await this.getArticleHierarchyFromAPI(articleId);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getArticleHierarchy', duration);
        return result;
      }

      // OPT-IN Dexie
      const dexie = await this.getDexie();
      if (!dexie.isReady()) {
        const waitStartTime = Date.now();
        while (!dexie.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!dexie.isReady()) {
          const result = await this.getArticleHierarchyFromAPI(articleId);
          performanceMonitor.trackAPICall('getArticleHierarchy', performance.now() - startTime);
          return result;
        }
      }

      const result = await dexie.queryArticleHierarchy(articleId);
      const duration = performance.now() - startTime;

      if (result.length === 0) {
        const apiResult = await this.getArticleHierarchyFromAPI(articleId);
        performanceMonitor.trackAPICall('getArticleHierarchy', performance.now() - startTime);
        return apiResult;
      }

      performanceMonitor.trackDexieCall('getArticleHierarchy', duration);
      return result;
    } catch (error) {
      console.error('[DATA_LAYER] Error in getArticleHierarchy', error);
      const result = await this.getArticleHierarchyFromAPI(articleId);
      performanceMonitor.trackAPICall('getArticleHierarchy', performance.now() - startTime);
      return result;
    }
  }

  /**
   * Fetch article hierarchy from REST API
   *
   * @param articleId - Article ID
   * @returns Array of hierarchy records
   */
  private async getArticleHierarchyFromAPI(articleId: number): Promise<LocalArticleHierarchy[]> {
    const response = await fetch(`/api/v1/articles/${articleId}/hierarchy`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: ArticleHierarchyListResponse = await response.json();
    // TODO: Verify backend schema when endpoint is implemented (currently not found)
    return data.items || [];
  }

  // =============================================================================
  // Shopping Lists (task-015 phase 2)
  // =============================================================================

  /**
   * Get shopping lists with optional filters
   *
   * @param filters - Optional filters (is_active, creator_id, etc.)
   * @returns Array of shopping lists
   */
  /**
   * Get shopping lists with filters
   *
   * NEW STRATEGY (API-First with Opt-In Dexie)
   */
  async getShoppingLists(filters?: ShoppingListFilters): Promise<ShoppingListWithStats[]> {
    const startTime = performance.now();

    console.debug('[DATA_LAYER] getShoppingLists', {
      filters,
      useDexie: this.shouldUseDexie()
    });

    try {
      // API-FIRST
      if (!this.shouldUseDexie()) {
        const result = await this.getShoppingListsFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getShoppingLists', duration);
        console.debug('[DATA_LAYER] API returned', { count: result.length, source: 'API', durationMs: duration.toFixed(2) });
        return result;
      }

      // OPT-IN Dexie
      const dexie = await this.getDexie();

      if (!dexie.isReady()) {
        const waitStartTime = Date.now();
        while (!dexie.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!dexie.isReady()) {
          console.warn('[DATA_LAYER] Dexie timeout, using API fallback');
          const result = await this.getShoppingListsFromAPI(filters);
          performanceMonitor.trackAPICall('getShoppingLists', performance.now() - startTime);
          return result;
        }
      }

      console.debug('[DATA_LAYER] Using Dexie');
      const result = await dexie.queryShoppingLists(filters);
      const duration = performance.now() - startTime;

      if (result.length === 0) {
        console.debug('[DATA_LAYER] Dexie returned empty, using API fallback');
        const apiResult = await this.getShoppingListsFromAPI(filters);

        // Cache API lists in Dexie so next access (including item FK lookup) works offline
        if (apiResult.length > 0) {
          try {
            await dexie.getDB().shoppingLists.bulkPut(apiResult);
            console.debug('[DATA_LAYER] Cached API lists in Dexie', { count: apiResult.length });
          } catch (cacheError) {
            console.warn('[DATA_LAYER] Failed to cache lists in Dexie', cacheError);
          }
        }

        performanceMonitor.trackAPICall('getShoppingLists', performance.now() - startTime);
        console.debug('[DATA_LAYER] API fallback returned', { count: apiResult.length });
        return apiResult;
      }

      performanceMonitor.trackDexieCall('getShoppingLists', duration);
      console.debug('[DATA_LAYER] Dexie returned', { count: result.length, source: 'Dexie', durationMs: duration.toFixed(2) });
      // Enrich Dexie results with stats computed from items (fixes missing total_items/completed_items)
      return await this.enrichShoppingListsWithStats(result);

    } catch (error) {
      console.error('[DATA_LAYER] Error in getShoppingLists', error);
      const result = await this.getShoppingListsFromAPI(filters);
      performanceMonitor.trackAPICall('getShoppingLists', performance.now() - startTime);
      return result;
    }
  }

  /**
   * Enrich shopping lists from Dexie with stats computed from items.
   * Called when lists are loaded from Dexie (offline) which doesn't store stats.
   */
  private async enrichShoppingListsWithStats(lists: LocalShoppingList[]): Promise<ShoppingListWithStats[]> {
    try {
      // Get all items in a single query, then group by list
      const allItems = await dexieDb.shoppingListItems.toArray();
      const statsMap = new Map<string, { total: number; completed: number }>();

      for (const item of allItems) {
        if (item.deleted_at || item.sync_status === 'deleted') continue; // Skip soft-deleted items
        const key = item.shopping_list_temp_id;
        if (!statsMap.has(key)) statsMap.set(key, { total: 0, completed: 0 });
        const s = statsMap.get(key)!;
        s.total++;
        if (item.is_completed) s.completed++;
      }

      return lists.map(list => {
        const s = statsMap.get(list.temp_id) ?? { total: 0, completed: 0 };
        const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
        return {
          ...list,
          total_items: s.total,
          completed_items: s.completed,
          completion_percentage: pct,
        } as ShoppingListWithStats;
      });
    } catch (error) {
      console.warn('[DATA_LAYER] Failed to compute shopping list stats from Dexie:', error);
      return lists.map(list => ({
        ...list,
        total_items: 0,
        completed_items: 0,
        completion_percentage: 0,
      } as ShoppingListWithStats));
    }
  }

  /**
   * Fetch shopping lists from REST API
   *
   * @param filters - Optional filters
   * @returns Array of shopping lists
   */
  private async getShoppingListsFromAPI(filters?: ShoppingListFilters): Promise<ShoppingListWithStats[]> {
    const params = new URLSearchParams();
    params.set('limit', '1000');

    if (filters?.is_active !== undefined) {
      params.set('is_active', filters.is_active.toString());
    }
    if (filters?.sync_status) {
      params.set('sync_status', filters.sync_status);
    }

    const response = await fetch(`/api/v1/shopping-lists?${params.toString()}`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: ShoppingListListResponse = await response.json();
    // Backend returns ShoppingListListResponse { shopping_lists: [...] }
    return data.shopping_lists || [];
  }

  /**
   * Get shopping list items with filters
   *
   * NEW STRATEGY (API-First with Opt-In Dexie)
   */
  async getShoppingListItems(
    listId: number,
    filters?: ShoppingListItemFilters
  ): Promise<LocalShoppingListItem[]> {
    const startTime = performance.now();

    console.debug('[DATA_LAYER] getShoppingListItems', {
      listId,
      filters,
      useDexie: this.shouldUseDexie()
    });

    try {
      // API-FIRST
      if (!this.shouldUseDexie()) {
        const result = await this.getShoppingListItemsFromAPI(listId, filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getShoppingListItems', duration);
        console.debug('[DATA_LAYER] API returned', { count: result.length, source: 'API', durationMs: duration.toFixed(2) });
        return result;
      }

      // OPT-IN Dexie
      const dexie = await this.getDexie();

      if (!dexie.isReady()) {
        const waitStartTime = Date.now();
        while (!dexie.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!dexie.isReady()) {
          console.warn('[DATA_LAYER] Dexie timeout, using API fallback');
          const result = await this.getShoppingListItemsFromAPI(listId, filters);
          performanceMonitor.trackAPICall('getShoppingListItems', performance.now() - startTime);
          return result;
        }
      }

      console.debug('[DATA_LAYER] Using Dexie');

      // Lookup list by numeric ID to get temp_id (for Dexie FK queries)
      const list = await dexie.getDB().shoppingLists.where('id').equals(listId).first();
      if (!list || !list.temp_id) {
        console.warn('[DATA_LAYER] List not found in Dexie or missing temp_id, using API fallback');
        const result = await this.getShoppingListItemsFromAPI(listId, filters);
        performanceMonitor.trackAPICall('getShoppingListItems', performance.now() - startTime);
        return result;
      }

      const listTempId = list.temp_id;  // ← Use Dexie temp_id for FK query
      let result = await dexie.queryShoppingListItems(listTempId);
      const duration = performance.now() - startTime;

      // Apply filters in-memory (client-side filtering)
      // OPTIMIZATION: Single filter pass instead of 5 sequential filters
      // Reduces O(5n) to O(n) and avoids creating 4 intermediate arrays
      if (filters) {
        const originalCount = result.length;  // Capture count BEFORE filtering

        result = result.filter((item: LocalShoppingListItem) => {
          // Filter by completion status
          if (filters.is_completed !== undefined && item.is_completed !== filters.is_completed) {
            return false;
          }

          // Filter by store
          if (filters.store_id !== undefined && item.store_id !== filters.store_id) {
            return false;
          }

          // Filter by product group
          if (filters.product_group_id !== undefined && item.product_group_id !== filters.product_group_id) {
            return false;
          }

          // Filter by sync status
          if (filters.sync_status !== undefined && item.sync_status !== filters.sync_status) {
            return false;
          }

          // Filter by deleted status
          // deleted filter: true = only deleted (deleted_at !== null), false = only active (deleted_at === null)
          if (filters.deleted !== undefined) {
            const isDeleted = item.deleted_at !== null;
            if (filters.deleted !== isDeleted) {
              return false;
            }
          }

          return true;
        });

        console.debug('[DATA_LAYER] Applied in-memory filters', {
          originalCount,
          filteredCount: result.length,
          filtersApplied: filters
        });
      }

      if (result.length === 0) {
        console.debug('[DATA_LAYER] Dexie returned empty, using API fallback');
        let apiResult = await this.getShoppingListItemsFromAPI(listId, filters);

        // CRITICAL FIX: Ensure temp_id exists for all API items (for bulk delete compatibility)
        apiResult = apiResult.map(item => ({
          ...item,
          temp_id: item.temp_id || `item_${item.id}_${Date.now()}`,
          shopping_list_temp_id: item.shopping_list_temp_id || listTempId,
          sync_status: item.sync_status || 'synced',
        }));

        // Cache API items in Dexie so next offline access doesn't lose data
        if (apiResult.length > 0) {
          try {
            await dexie.getDB().shoppingListItems.bulkPut(apiResult);
            console.debug('[DATA_LAYER] Cached API items in Dexie', { count: apiResult.length });
          } catch (cacheError) {
            console.warn('[DATA_LAYER] Failed to cache API items in Dexie', cacheError);
          }
        }

        performanceMonitor.trackAPICall('getShoppingListItems', performance.now() - startTime);
        console.debug('[DATA_LAYER] API fallback returned', { count: apiResult.length });
        return apiResult;
      }

      performanceMonitor.trackDexieCall('getShoppingListItems', duration);
      console.debug('[DATA_LAYER] Dexie returned', { count: result.length, source: 'Dexie', durationMs: duration.toFixed(2) });
      return result;

    } catch (error) {
      console.error('[DATA_LAYER] Error in getShoppingListItems', error);
      const result = await this.getShoppingListItemsFromAPI(listId, filters);
      performanceMonitor.trackAPICall('getShoppingListItems', performance.now() - startTime);
      return result;
    }
  }

  /**
   * Fetch shopping list items from REST API
   *
   * @param listId - Shopping list numeric ID
   * @param filters - Optional filters
   * @returns Array of shopping list items
   */
  private async getShoppingListItemsFromAPI(
    listId: number,
    filters?: ShoppingListItemFilters
  ): Promise<LocalShoppingListItem[]> {
    const params = new URLSearchParams();
    params.set('limit', '1000');
    params.set('shopping_list_id', String(listId));

    if (filters?.is_completed !== undefined) {
      params.set('is_completed', filters.is_completed.toString());
    }
    if (filters?.store_id !== undefined) {
      params.set('store_id', filters.store_id.toString());
    }
    if (filters?.product_group_id !== undefined) {
      params.set('product_group_id', filters.product_group_id.toString());
    }

    const response = await fetch(`/api/v1/shopping-list-items?${params.toString()}`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: ShoppingListItemListResponse = await response.json();
    // Backend returns ShoppingListItemListResponse { items: [...] } - correct!
    return data.items || [];
  }

  /**
   * Get stores (reference data)
   *
   * @param filters - Optional filters
   * @returns Array of stores
   */
  async getStores(filters?: StoreFilters): Promise<LocalStore[]> {
    const startTime = performance.now();

    try {
      // API-FIRST
      if (!this.shouldUseDexie()) {
        const result = await this.getStoresFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getStores', duration);
        return result;
      }

      // OPT-IN Dexie
      const dexie = await this.getDexie();
      if (!dexie.isReady()) {
        const waitStartTime = Date.now();
        while (!dexie.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!dexie.isReady()) {
          const result = await this.getStoresFromAPI(filters);
          performanceMonitor.trackAPICall('getStores', performance.now() - startTime);
          return result;
        }
      }

      const result = await dexie.queryStores(filters);
      const duration = performance.now() - startTime;

      if (result.length === 0) {
        const apiResult = await this.getStoresFromAPI(filters);
        performanceMonitor.trackAPICall('getStores', performance.now() - startTime);
        return apiResult;
      }

      performanceMonitor.trackDexieCall('getStores', duration);
      return result;
    } catch (error) {
      console.error('[DATA_LAYER] Error in getStores', error);
      const result = await this.getStoresFromAPI(filters);
      performanceMonitor.trackAPICall('getStores', performance.now() - startTime);
      return result;
    }
  }

  /**
   * Fetch stores from REST API
   *
   * @param filters - Optional filters
   * @returns Array of stores
   */
  private async getStoresFromAPI(filters?: StoreFilters): Promise<LocalStore[]> {
    const params = new URLSearchParams();
    params.set('limit', '1000');

    if (filters?.is_active !== undefined) {
      params.set('is_active', filters.is_active.toString());
    }

    const response = await fetch(`/api/v1/stores?${params.toString()}`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: StoreListResponse = await response.json();
    // Backend returns StoreListResponse { stores: [...] }
    return data.stores || [];
  }

  /**
   * Get product groups (reference data)
   *
   * @param filters - Optional filters
   * @returns Array of product groups
   */
  async getProductGroups(filters?: ProductGroupFilters): Promise<LocalProductGroup[]> {
    const startTime = performance.now();

    try {
      // API-FIRST
      if (!this.shouldUseDexie()) {
        const result = await this.getProductGroupsFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getProductGroups', duration);
        return result;
      }

      // OPT-IN Dexie
      const dexie = await this.getDexie();
      if (!dexie.isReady()) {
        const waitStartTime = Date.now();
        while (!dexie.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!dexie.isReady()) {
          const result = await this.getProductGroupsFromAPI(filters);
          performanceMonitor.trackAPICall('getProductGroups', performance.now() - startTime);
          return result;
        }
      }

      const result = await dexie.queryProductGroups(filters);
      const duration = performance.now() - startTime;

      if (result.length === 0) {
        const apiResult = await this.getProductGroupsFromAPI(filters);
        performanceMonitor.trackAPICall('getProductGroups', performance.now() - startTime);
        return apiResult;
      }

      performanceMonitor.trackDexieCall('getProductGroups', duration);
      return result;
    } catch (error) {
      console.error('[DATA_LAYER] Error in getProductGroups', error);
      const result = await this.getProductGroupsFromAPI(filters);
      performanceMonitor.trackAPICall('getProductGroups', performance.now() - startTime);
      return result;
    }
  }

  /**
   * Fetch product groups from REST API
   *
   * @param filters - Optional filters
   * @returns Array of product groups
   */
  private async getProductGroupsFromAPI(filters?: ProductGroupFilters): Promise<LocalProductGroup[]> {
    const params = new URLSearchParams();
    params.set('limit', '1000');

    if (filters?.is_active !== undefined) {
      params.set('is_active', filters.is_active.toString());
    }
    if (filters?.parent_id !== undefined) {
      if (filters.parent_id === null) {
        params.set('parent_id', 'null');
      } else {
        params.set('parent_id', filters.parent_id.toString());
      }
    }

    const response = await fetch(`/api/v1/product-groups?${params.toString()}`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: ProductGroupListResponse = await response.json();
    // Backend returns ProductGroupListResponse { product_groups: [...] }
    return data.product_groups || [];
  }

  // =============================================================================
  // Budget Facts (task-015 phase 2)
  // =============================================================================

  /**
   * Get budget facts with filters
   *
   * @param filters - Optional filters (user_id, article_id, record_type, etc.)
   * @returns Array of budget facts
   */
  /**
   * Get budget facts with filters
   *
   * NEW STRATEGY (API-First with Opt-In Dexie)
   */
  async getFacts(filters?: FactFilters): Promise<LocalBudgetFact[]> {
    const startTime = performance.now();

    console.debug('[DATA_LAYER] getFacts', {
      filters,
      useDexie: this.shouldUseDexie()
    });

    try {
      // API-FIRST
      if (!this.shouldUseDexie()) {
        const result = await this.getFactsFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getFacts', duration);
        console.debug('[DATA_LAYER] API returned', { count: result.length, source: 'API', durationMs: duration.toFixed(2) });
        return result;
      }

      // OPT-IN Dexie
      const dexie = await this.getDexie();

      if (!dexie.isReady()) {
        const waitStartTime = Date.now();
        while (!dexie.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!dexie.isReady()) {
          console.warn('[DATA_LAYER] Dexie timeout, using API fallback');
          const result = await this.getFactsFromAPI(filters);
          performanceMonitor.trackAPICall('getFacts', performance.now() - startTime);
          return result;
        }
      }

      console.debug('[DATA_LAYER] Using Dexie');
      const result = await dexie.queryFacts(filters);
      const duration = performance.now() - startTime;

      if (result.length === 0) {
        console.debug('[DATA_LAYER] Dexie returned empty, using API fallback');
        const apiResult = await this.getFactsFromAPI(filters);
        performanceMonitor.trackAPICall('getFacts', performance.now() - startTime);
        console.debug('[DATA_LAYER] API fallback returned', { count: apiResult.length });

        // CACHE FIX (v11.3.9): Map API → Dexie schema before bulk insert
        // This generates temp_id (primary key) and handles field name mappings
        if (apiResult.length > 0) {
          try {
            // MAP API → Dexie schema (generates temp_id, sync_status, etc.)
            const mappedFacts: LocalBudgetFact[] = [];
            const errors: string[] = [];

            for (const apiFact of apiResult) {
              try {
                const mapped = mapAPIFactToLocal(apiFact);  // ✅ Adds temp_id!
                mappedFacts.push(mapped);
              } catch (mapError) {
                const factId = apiFact.id || 'unknown';
                const errorMsg = mapError instanceof Error ? mapError.message : String(mapError);
                errors.push(`Fact ${factId}: ${errorMsg}`);
              }
            }

            if (mappedFacts.length > 0) {
              await dexie.bulkInsertFacts(mappedFacts);
              console.debug('[DATA_LAYER] Cached API facts in Dexie', {
                count: mappedFacts.length,
                skipped: errors.length
              });
            }

            if (errors.length > 0) {
              console.warn('[DATA_LAYER] Skipped malformed facts during cache', {
                total: apiResult.length,
                cached: mappedFacts.length,
                skipped: errors.length
              });
            }
          } catch (cacheError: unknown) {
            const errorMessage = cacheError instanceof Error ? cacheError.message : String(cacheError);
            console.warn('[DATA_LAYER] Failed to cache facts in Dexie', errorMessage, cacheError);
            // Non-critical error, continue with API result
          }
        }

        return apiResult;
      }

      performanceMonitor.trackDexieCall('getFacts', duration);
      console.debug('[DATA_LAYER] Dexie returned', { count: result.length, source: 'Dexie', durationMs: duration.toFixed(2) });
      return result;

    } catch (error) {
      console.error('[DATA_LAYER] Error in getFacts', error);
      const result = await this.getFactsFromAPI(filters);
      performanceMonitor.trackAPICall('getFacts', performance.now() - startTime);
      return result;
    }
  }

  /**
   * Fetch budget facts from REST API
   *
   * @param filters - Optional filters
   * @returns Array of budget facts
   */
  async getFactsFromAPI(filters?: FactFilters): Promise<LocalBudgetFact[]> {
    const params = new URLSearchParams();
    params.set('limit', '1000');

    if (filters?.user_id !== undefined) {
      params.set('user_id', filters.user_id.toString());
    }
    if (filters?.article_id !== undefined) {
      params.set('article_id', filters.article_id.toString());
    }
    if (filters?.financial_center_id !== undefined) {
      params.set('financial_center_id', filters.financial_center_id.toString());
    }
    if (filters?.cost_center_id !== undefined) {
      params.set('cost_center_id', filters.cost_center_id.toString());
    }
    if (filters?.record_type) {
      params.set('record_type', filters.record_type);
    }
    if (filters?.date_from) {
      params.set('date_from', filters.date_from);
    }
    if (filters?.date_to) {
      params.set('date_to', filters.date_to);
    }

    const response = await fetch(`/api/v1/facts?${params.toString()}`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: FactListResponse = await response.json();
    // Backend returns FactListResponse { facts: [...] }
    return data.facts || [];
  }

  /**
   * Get count of budget facts matching filters
   *
   * @param filters - Optional filters
   * @returns Count of matching facts
   */
  async getFactsCount(filters?: FactFilters): Promise<number> {
    const startTime = performance.now();

    try {
      // API-FIRST
      if (!this.shouldUseDexie()) {
        const count = await this.getFactsCountFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getFactsCount', duration);
        return count;
      }

      // OPT-IN Dexie
      const dexie = await this.getDexie();
      if (!dexie.isReady()) {
        const waitStartTime = Date.now();
        while (!dexie.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!dexie.isReady()) {
          const count = await this.getFactsCountFromAPI(filters);
          performanceMonitor.trackAPICall('getFactsCount', performance.now() - startTime);
          return count;
        }
      }

      const facts = await dexie.queryFacts(filters);
      const count = facts.length;
      const duration = performance.now() - startTime;

      if (count === 0) {
        const apiCount = await this.getFactsCountFromAPI(filters);
        performanceMonitor.trackAPICall('getFactsCount', performance.now() - startTime);
        return apiCount;
      }

      performanceMonitor.trackDexieCall('getFactsCount', duration);
      return count;
    } catch (error) {
      console.error('[DATA_LAYER] Error in getFactsCount', error);
      const count = await this.getFactsCountFromAPI(filters);
      performanceMonitor.trackAPICall('getFactsCount', performance.now() - startTime);
      return count;
    }
  }

  /**
   * Fetch budget facts count from REST API
   *
   * @param filters - Optional filters
   * @returns Count of matching facts
   */
  private async getFactsCountFromAPI(filters?: FactFilters): Promise<number> {
    const params = new URLSearchParams();

    if (filters?.user_id !== undefined) {
      params.set('user_id', filters.user_id.toString());
    }
    if (filters?.article_id !== undefined) {
      params.set('article_id', filters.article_id.toString());
    }
    if (filters?.financial_center_id !== undefined) {
      params.set('financial_center_id', filters.financial_center_id.toString());
    }
    if (filters?.cost_center_id !== undefined) {
      params.set('cost_center_id', filters.cost_center_id.toString());
    }
    if (filters?.record_type) {
      params.set('record_type', filters.record_type);
    }
    if (filters?.date_from) {
      params.set('date_from', filters.date_from);
    }
    if (filters?.date_to) {
      params.set('date_to', filters.date_to);
    }

    const response = await fetch(`/api/v1/facts/count?${params.toString()}`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.count || 0;
  }

  // =============================================================================
  // Recurring Plans (task-015 phase 2)
  // =============================================================================

  /**
   * Get recurring plans with filters
   *
   * @param filters - Optional filters (user_id, is_active, etc.)
   * @returns Array of recurring plans
   */
  /**
   * Get recurring plans with filters
   *
   * NEW STRATEGY (API-First with Opt-In Dexie)
   */
  async getRecurringPlans(filters?: RecurringPlanFilters): Promise<LocalRecurringPlan[]> {
    const startTime = performance.now();

    // Calculate sync period using MONTHS (v11.5.0+)
    const syncPeriodMonths = this.dexie?.getSyncPeriodMonths?.() ?? 3;

    // Calculate full months range
    const { fromDate, toDate } = this.calculateFullMonthsRange(syncPeriodMonths);

    // Merge sync period with user filters
    const syncFilters: RecurringPlanFilters = {
      ...filters,
      from_date: filters?.from_date ?? fromDate,
      to_date: filters?.to_date ?? toDate
    };

    console.debug('[DATA_LAYER] getRecurringPlans', {
      filters: syncFilters,
      syncPeriodMonths,
      useDexie: this.shouldUseDexie()
    });

    try {
      // API-FIRST
      if (!this.shouldUseDexie()) {
        const result = await this.getRecurringPlansFromAPI(syncFilters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getRecurringPlans', duration);
        console.debug('[DATA_LAYER] API returned', { count: result.length, source: 'API', durationMs: duration.toFixed(2) });
        return result;
      }

      // OPT-IN Dexie
      const dexie = await this.getDexie();

      if (!dexie.isReady()) {
        const waitStartTime = Date.now();
        while (!dexie.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!dexie.isReady()) {
          console.warn('[DATA_LAYER] Dexie timeout, using API fallback');
          const result = await this.getRecurringPlansFromAPI(syncFilters);
          performanceMonitor.trackAPICall('getRecurringPlans', performance.now() - startTime);
          return result;
        }
      }

      console.debug('[DATA_LAYER] Using Dexie');
      const result = await dexie.queryRecurringPlans(syncFilters);
      const duration = performance.now() - startTime;

      if (result.length === 0) {
        console.debug('[DATA_LAYER] Dexie returned empty, using API fallback');
        const apiResult = await this.getRecurringPlansFromAPI(syncFilters);
        performanceMonitor.trackAPICall('getRecurringPlans', performance.now() - startTime);
        console.debug('[DATA_LAYER] API fallback returned', { count: apiResult.length });

        // CACHE FIX (v11.3.7): Cache API results in Dexie for offline access
        // This enables offline capability for Recurring Plans after first load
        if (apiResult.length > 0) {
          try {
            // Use bulkAdd directly (no wrapper method exists)
            await dexie.getDB().recurringPlans.bulkAdd(apiResult);
            console.debug('[DATA_LAYER] Cached API recurring plans in Dexie', { count: apiResult.length });
          } catch (cacheError: unknown) {
            const errorMessage = cacheError instanceof Error ? cacheError.message : String(cacheError);
            console.warn('[DATA_LAYER] Failed to cache recurring plans in Dexie', errorMessage, cacheError);
            // Non-critical error, continue with API result
          }
        }

        return apiResult;
      }

      performanceMonitor.trackDexieCall('getRecurringPlans', duration);
      console.debug('[DATA_LAYER] Dexie returned', { count: result.length, source: 'Dexie', durationMs: duration.toFixed(2) });
      return result;

    } catch (error) {
      console.error('[DATA_LAYER] Error in getRecurringPlans', error);
      const result = await this.getRecurringPlansFromAPI(syncFilters);
      performanceMonitor.trackAPICall('getRecurringPlans', performance.now() - startTime);
      return result;
    }
  }

  /**
   * Fetch recurring plans from REST API
   *
   * @param filters - Optional filters
   * @returns Array of recurring plans
   */
  private async getRecurringPlansFromAPI(filters?: RecurringPlanFilters): Promise<LocalRecurringPlan[]> {
    const params = new URLSearchParams();
    params.set('limit', '100');  // ← FIX: Backend constraint is le=100 (recurring_plans.py:99)

    if (filters?.user_id !== undefined) {
      params.set('user_id', filters.user_id.toString());
    }
    if (filters?.article_id !== undefined) {
      params.set('article_id', filters.article_id.toString());
    }
    if (filters?.financial_center_id !== undefined) {
      params.set('financial_center_id', filters.financial_center_id.toString());
    }
    if (filters?.cost_center_id !== undefined) {
      params.set('cost_center_id', filters.cost_center_id.toString());
    }
    if (filters?.is_active !== undefined) {
      params.set('is_active', filters.is_active.toString());
    }
    if (filters?.frequency) {
      params.set('frequency', filters.frequency);
    }
    if (filters?.from_date) {
      params.set('from_date', filters.from_date);
    }
    if (filters?.to_date) {
      params.set('to_date', filters.to_date);
    }

    const response = await fetch(`/api/v1/recurring-plans?${params.toString()}`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: RecurringPlanListResponse = await response.json();
    // Backend returns RecurringPlanListResponse { items: [...] } - correct!
    return data.items || [];
  }

  // =============================================================================
  // Dashboard Analytics (task-011)
  // =============================================================================

  /**
   * Get dashboard data (Dexie-first with API fallback)
   * Used for future features requiring dashboard analytics
   *
   * @returns Dashboard data (recent facts, quick stats, account balances)
   */
  async getDashboardData() {
    return await factsManager.initDashboard();
  }

  // =============================================================================
  // Performance Metrics
  // =============================================================================

  /**
   * Calculate date range for full months (v11.5.0+)
   * Same logic as referenceSync.ts
   *
   * @param months - Number of months to include in each direction
   * @returns Object with fromDate and toDate in YYYY-MM-DD format
   */
  private calculateFullMonthsRange(months: number): { fromDate: string; toDate: string } {
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
   * Get performance statistics
   *
   * @returns Performance stats comparing API and Dexie
   */
  getPerformanceStats(): PerformanceStats {
    return performanceMonitor.getStats();
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics(): void {
    performanceMonitor.reset();
  }

  // ── P2P Sync integration ─────────────────────────────────────────────────

  /**
   * Get pending facts for P2P sync (facts with sync_status='pending').
   * Used by P2PUIController before initiating sync.
   * @returns {Promise<LocalBudgetFact[]>}
   */
  async getPendingFactsForP2P(): Promise<LocalBudgetFact[]> {
    try {
      const dexie = await this.getDexie();
      if (!dexie.isReady()) return [];
      const db = dexie.getDB();
      return await db.budgetFacts
        .where('sync_status').equals('pending')
        .toArray();
    } catch (err) {
      console.error('[DataLayer] getPendingFactsForP2P error:', err);
      return [];
    }
  }

  /**
   * Get all local facts for P2P merge comparison.
   * Returns synced + pending facts (excludes deleted).
   * @returns {Promise<LocalBudgetFact[]>}
   */
  async getAllFactsForP2PMerge(): Promise<LocalBudgetFact[]> {
    try {
      const dexie = await this.getDexie();
      if (!dexie.isReady()) return [];
      const db = dexie.getDB();
      return await db.budgetFacts
        .filter((f: LocalBudgetFact) => f.sync_status !== 'deleted')
        .toArray();
    } catch (err) {
      console.error('[DataLayer] getAllFactsForP2PMerge error:', err);
      return [];
    }
  }

  /**
   * Apply P2P sync result: write merged facts to Dexie with sync_status='pending'.
   * They will be synced to server by the regular sync loop.
   * @param {LocalBudgetFact[]} mergedFacts
   * @returns {Promise<number>} Count of applied facts
   */
  async applyP2PSyncResult(mergedFacts: LocalBudgetFact[]): Promise<number> {
    if (!mergedFacts.length) return 0;
    try {
      const dexie = await this.getDexie();
      if (!dexie.isReady()) throw new Error('Dexie not ready');
      const db = dexie.getDB();
      await db.budgetFacts.bulkPut(mergedFacts);
      console.debug('[DataLayer] applyP2PSyncResult: applied', mergedFacts.length, 'facts');
      return mergedFacts.length;
    } catch (err) {
      console.error('[DataLayer] applyP2PSyncResult error:', err);
      throw err;
    }
  }
}

/**
 * Global singleton data layer instance
 */
export const dataLayer = new DataLayer();

/**
 * Expose to window for debugging
 */
if (typeof window !== 'undefined') {
  (window as any).dataLayer = dataLayer;
}

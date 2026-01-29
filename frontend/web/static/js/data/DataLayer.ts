/**
 * Data Layer - Unified API for reference data
 *
 * Provides abstraction over PGlite (offline) and REST API (online) data sources.
 * Implements PGlite-first strategy with graceful fallback to API.
 *
 * @example
 * ```typescript
 * import { dataLayer } from './DataLayer';
 *
 * // Get articles (PGlite-first, API fallback)
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

import { getPGliteManager, PGliteManager } from '@db/pglite';
import { isPGliteActive } from '@db/pglite';
import { performanceMonitor } from '../monitoring/PerformanceMonitor';
import type { PerformanceStats } from '../monitoring/PerformanceMonitor';
import type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalArticleHierarchy,
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
} from '@db/pglite';
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
 * Provides unified API for reference data with PGlite-first, API-fallback strategy
 */
export class DataLayer {
  private pglite: PGliteManager | null = null;
  private pglitePromise: Promise<PGliteManager> | null = null;

  /**
   * Lazy initialize PGlite manager
   * Handles both sync and async getPGliteManager() implementations
   */
  private async getPGlite(): Promise<any> {
    if (this.pglite) {
      return this.pglite;
    }

    if (this.pglitePromise) {
      return this.pglitePromise;
    }

    this.pglitePromise = Promise.resolve(getPGliteManager()).then(async (manager) => {
      // Initialize PGlite on first access
      if (!manager.isReady()) {
        await manager.init();
      }
      this.pglite = manager;
      return manager;
    });

    return this.pglitePromise;
  }

  /**
   * NEW: Determine whether to use PGlite or API
   *
   * Returns true only if user ACTIVATED PGlite (opt-in).
   * By default (API-first), returns false.
   */
  private shouldUsePGlite(): boolean {
    return isPGliteActive();
  }

  // =============================================================================
  // Articles
  // =============================================================================

  /**
   * Get articles with optional filters
   *
   * NEW STRATEGY (API-First with Opt-In PGlite):
   * - By default: Use API (100% reliable)
   * - If user activated PGlite: Use PGlite with API fallback
   *
   * @param filters - Optional filters (user_id, type, parent_id, is_active)
   * @returns Array of articles
   */
  async getArticles(filters?: ArticleFilters): Promise<LocalArticle[]> {
    const startTime = performance.now();

    console.info('[DATA_LAYER] getArticles', {
      filters,
      usePGlite: this.shouldUsePGlite()
    });

    try {
      // API-FIRST: Use API if PGlite not activated
      if (!this.shouldUsePGlite()) {
        const result = await this.getArticlesFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getArticles', duration);
        console.info('[DATA_LAYER] API returned', {
          count: result.length,
          source: 'API',
          durationMs: duration.toFixed(2)
        });
        return result;
      }

      // OPT-IN: User activated PGlite
      const pglite = await this.getPGlite();

      // Wait for readiness (max 5s)
      if (!pglite.isReady()) {
        const waitStartTime = Date.now();
        while (!pglite.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!pglite.isReady()) {
          console.warn('[DATA_LAYER] PGlite timeout, using API fallback');
          const result = await this.getArticlesFromAPI(filters);
          performanceMonitor.trackAPICall('getArticles', performance.now() - startTime);
          return result;
        }
      }

      // Query PGlite
      console.info('[DATA_LAYER] Using PGlite');
      const result = await pglite.queryArticles(filters);
      const duration = performance.now() - startTime;

      // CRITICAL: Fallback на API если PGlite вернул пустой результат
      if (result.length === 0) {
        console.warn('[DATA_LAYER] PGlite returned empty, using API fallback');
        const apiResult = await this.getArticlesFromAPI(filters);
        performanceMonitor.trackAPICall('getArticles', performance.now() - startTime);
        console.info('[DATA_LAYER] API fallback returned', { count: apiResult.length });
        return apiResult;
      }

      performanceMonitor.trackPGliteCall('getArticles', duration);
      console.info('[DATA_LAYER] PGlite returned', {
        count: result.length,
        source: 'PGlite',
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
   * NEW STRATEGY (API-First with Opt-In PGlite):
   * - By default: Use API (100% reliable)
   * - If user activated PGlite: Use PGlite with API fallback
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

    console.info('[DATA_LAYER] getFinancialCenters', {
      userId,
      includeGlobal,
      usePGlite: this.shouldUsePGlite()
    });

    try {
      // API-FIRST: Use API if PGlite not activated
      if (!this.shouldUsePGlite()) {
        const result = await this.getFinancialCentersFromAPI(includeGlobal);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getFinancialCenters', duration);
        console.info('[DATA_LAYER] API returned', {
          count: result.length,
          source: 'API',
          durationMs: duration.toFixed(2)
        });
        return result;
      }

      // OPT-IN: User activated PGlite
      const pglite = await this.getPGlite();

      // Wait for readiness (max 5s)
      if (!pglite.isReady()) {
        const waitStartTime = Date.now();
        while (!pglite.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!pglite.isReady()) {
          console.warn('[DATA_LAYER] PGlite timeout, using API fallback');
          const result = await this.getFinancialCentersFromAPI(includeGlobal);
          performanceMonitor.trackAPICall('getFinancialCenters', performance.now() - startTime);
          return result;
        }
      }

      // Query PGlite
      console.info('[DATA_LAYER] Using PGlite');
      const result = await pglite.queryFinancialCenters(userId, true);
      const duration = performance.now() - startTime;

      // CRITICAL: Fallback на API если PGlite вернул пустой результат
      if (result.length === 0) {
        console.warn('[DATA_LAYER] PGlite returned empty, using API fallback');
        const apiResult = await this.getFinancialCentersFromAPI(includeGlobal);
        performanceMonitor.trackAPICall('getFinancialCenters', performance.now() - startTime);
        console.info('[DATA_LAYER] API fallback returned', { count: apiResult.length });
        return apiResult;
      }

      performanceMonitor.trackPGliteCall('getFinancialCenters', duration);
      console.info('[DATA_LAYER] PGlite returned', {
        count: result.length,
        source: 'PGlite',
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
   * NEW STRATEGY (API-First with Opt-In PGlite):
   * - By default: Use API (100% reliable)
   * - If user activated PGlite: Use PGlite with API fallback
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

    console.info('[DATA_LAYER] getCostCenters', {
      userId,
      financialCenterId,
      includeGlobal,
      usePGlite: this.shouldUsePGlite()
    });

    try {
      // API-FIRST: Use API if PGlite not activated
      if (!this.shouldUsePGlite()) {
        const result = await this.getCostCentersFromAPI(financialCenterId, includeGlobal);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getCostCenters', duration);
        console.info('[DATA_LAYER] API returned', {
          count: result.length,
          source: 'API',
          durationMs: duration.toFixed(2)
        });
        return result;
      }

      // OPT-IN: User activated PGlite
      const pglite = await this.getPGlite();

      // Wait for readiness (max 5s)
      if (!pglite.isReady()) {
        const waitStartTime = Date.now();
        while (!pglite.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!pglite.isReady()) {
          console.warn('[DATA_LAYER] PGlite timeout, using API fallback');
          const result = await this.getCostCentersFromAPI(financialCenterId, includeGlobal);
          performanceMonitor.trackAPICall('getCostCenters', performance.now() - startTime);
          return result;
        }
      }

      // Query PGlite
      console.info('[DATA_LAYER] Using PGlite');
      const result = await pglite.queryFilteredCostCenters(userId, financialCenterId, true);
      const duration = performance.now() - startTime;

      // CRITICAL: Fallback на API если PGlite вернул пустой результат
      if (result.length === 0) {
        console.warn('[DATA_LAYER] PGlite returned empty, using API fallback');
        const apiResult = await this.getCostCentersFromAPI(financialCenterId, includeGlobal);
        performanceMonitor.trackAPICall('getCostCenters', performance.now() - startTime);
        console.info('[DATA_LAYER] API fallback returned', { count: apiResult.length });
        return apiResult;
      }

      performanceMonitor.trackPGliteCall('getCostCenters', duration);
      console.info('[DATA_LAYER] PGlite returned', {
        count: result.length,
        source: 'PGlite',
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
      if (!this.shouldUsePGlite()) {
        const result = await this.getArticleHierarchyFromAPI(articleId);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getArticleHierarchy', duration);
        return result;
      }

      // OPT-IN PGlite
      const pglite = await this.getPGlite();
      if (!pglite.isReady()) {
        const waitStartTime = Date.now();
        while (!pglite.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!pglite.isReady()) {
          const result = await this.getArticleHierarchyFromAPI(articleId);
          performanceMonitor.trackAPICall('getArticleHierarchy', performance.now() - startTime);
          return result;
        }
      }

      const result = await pglite.queryArticleHierarchy(articleId);
      const duration = performance.now() - startTime;

      if (result.length === 0) {
        const apiResult = await this.getArticleHierarchyFromAPI(articleId);
        performanceMonitor.trackAPICall('getArticleHierarchy', performance.now() - startTime);
        return apiResult;
      }

      performanceMonitor.trackPGliteCall('getArticleHierarchy', duration);
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
   * NEW STRATEGY (API-First with Opt-In PGlite)
   */
  async getShoppingLists(filters?: ShoppingListFilters): Promise<ShoppingListWithStats[]> {
    const startTime = performance.now();

    console.info('[DATA_LAYER] getShoppingLists', {
      filters,
      usePGlite: this.shouldUsePGlite()
    });

    try {
      // API-FIRST
      if (!this.shouldUsePGlite()) {
        const result = await this.getShoppingListsFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getShoppingLists', duration);
        console.info('[DATA_LAYER] API returned', { count: result.length, source: 'API', durationMs: duration.toFixed(2) });
        return result;
      }

      // OPT-IN PGlite
      const pglite = await this.getPGlite();

      if (!pglite.isReady()) {
        const waitStartTime = Date.now();
        while (!pglite.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!pglite.isReady()) {
          console.warn('[DATA_LAYER] PGlite timeout, using API fallback');
          const result = await this.getShoppingListsFromAPI(filters);
          performanceMonitor.trackAPICall('getShoppingLists', performance.now() - startTime);
          return result;
        }
      }

      console.info('[DATA_LAYER] Using PGlite');
      const result = await pglite.queryShoppingLists(filters);
      const duration = performance.now() - startTime;

      if (result.length === 0) {
        console.warn('[DATA_LAYER] PGlite returned empty, using API fallback');
        const apiResult = await this.getShoppingListsFromAPI(filters);
        performanceMonitor.trackAPICall('getShoppingLists', performance.now() - startTime);
        console.info('[DATA_LAYER] API fallback returned', { count: apiResult.length });
        return apiResult;
      }

      performanceMonitor.trackPGliteCall('getShoppingLists', duration);
      console.info('[DATA_LAYER] PGlite returned', { count: result.length, source: 'PGlite', durationMs: duration.toFixed(2) });
      return result;

    } catch (error) {
      console.error('[DATA_LAYER] Error in getShoppingLists', error);
      const result = await this.getShoppingListsFromAPI(filters);
      performanceMonitor.trackAPICall('getShoppingLists', performance.now() - startTime);
      return result;
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
   * NEW STRATEGY (API-First with Opt-In PGlite)
   */
  async getShoppingListItems(
    listTempId: string,
    filters?: ShoppingListItemFilters
  ): Promise<LocalShoppingListItem[]> {
    const startTime = performance.now();

    console.info('[DATA_LAYER] getShoppingListItems', {
      listTempId,
      filters,
      usePGlite: this.shouldUsePGlite()
    });

    try {
      // API-FIRST
      if (!this.shouldUsePGlite()) {
        const result = await this.getShoppingListItemsFromAPI(listTempId, filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getShoppingListItems', duration);
        console.info('[DATA_LAYER] API returned', { count: result.length, source: 'API', durationMs: duration.toFixed(2) });
        return result;
      }

      // OPT-IN PGlite
      const pglite = await this.getPGlite();

      if (!pglite.isReady()) {
        const waitStartTime = Date.now();
        while (!pglite.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!pglite.isReady()) {
          console.warn('[DATA_LAYER] PGlite timeout, using API fallback');
          const result = await this.getShoppingListItemsFromAPI(listTempId, filters);
          performanceMonitor.trackAPICall('getShoppingListItems', performance.now() - startTime);
          return result;
        }
      }

      console.info('[DATA_LAYER] Using PGlite');
      const result = await pglite.queryShoppingListItems({
        ...filters,
        shopping_list_temp_id: listTempId
      });
      const duration = performance.now() - startTime;

      if (result.length === 0) {
        console.warn('[DATA_LAYER] PGlite returned empty, using API fallback');
        const apiResult = await this.getShoppingListItemsFromAPI(listTempId, filters);
        performanceMonitor.trackAPICall('getShoppingListItems', performance.now() - startTime);
        console.info('[DATA_LAYER] API fallback returned', { count: apiResult.length });
        return apiResult;
      }

      performanceMonitor.trackPGliteCall('getShoppingListItems', duration);
      console.info('[DATA_LAYER] PGlite returned', { count: result.length, source: 'PGlite', durationMs: duration.toFixed(2) });
      return result;

    } catch (error) {
      console.error('[DATA_LAYER] Error in getShoppingListItems', error);
      const result = await this.getShoppingListItemsFromAPI(listTempId, filters);
      performanceMonitor.trackAPICall('getShoppingListItems', performance.now() - startTime);
      return result;
    }
  }

  /**
   * Fetch shopping list items from REST API
   *
   * @param listTempId - Shopping list ID (can be numeric ID or temp_id)
   * @param filters - Optional filters
   * @returns Array of shopping list items
   */
  private async getShoppingListItemsFromAPI(
    listTempId: string,
    filters?: ShoppingListItemFilters
  ): Promise<LocalShoppingListItem[]> {
    const params = new URLSearchParams();
    params.set('limit', '1000');
    params.set('shopping_list_id', listTempId);

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
      if (!this.shouldUsePGlite()) {
        const result = await this.getStoresFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getStores', duration);
        return result;
      }

      // OPT-IN PGlite
      const pglite = await this.getPGlite();
      if (!pglite.isReady()) {
        const waitStartTime = Date.now();
        while (!pglite.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!pglite.isReady()) {
          const result = await this.getStoresFromAPI(filters);
          performanceMonitor.trackAPICall('getStores', performance.now() - startTime);
          return result;
        }
      }

      const result = await pglite.queryStores(filters);
      const duration = performance.now() - startTime;

      if (result.length === 0) {
        const apiResult = await this.getStoresFromAPI(filters);
        performanceMonitor.trackAPICall('getStores', performance.now() - startTime);
        return apiResult;
      }

      performanceMonitor.trackPGliteCall('getStores', duration);
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
      if (!this.shouldUsePGlite()) {
        const result = await this.getProductGroupsFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getProductGroups', duration);
        return result;
      }

      // OPT-IN PGlite
      const pglite = await this.getPGlite();
      if (!pglite.isReady()) {
        const waitStartTime = Date.now();
        while (!pglite.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!pglite.isReady()) {
          const result = await this.getProductGroupsFromAPI(filters);
          performanceMonitor.trackAPICall('getProductGroups', performance.now() - startTime);
          return result;
        }
      }

      const result = await pglite.queryProductGroups(filters);
      const duration = performance.now() - startTime;

      if (result.length === 0) {
        const apiResult = await this.getProductGroupsFromAPI(filters);
        performanceMonitor.trackAPICall('getProductGroups', performance.now() - startTime);
        return apiResult;
      }

      performanceMonitor.trackPGliteCall('getProductGroups', duration);
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
   * NEW STRATEGY (API-First with Opt-In PGlite)
   */
  async getFacts(filters?: FactFilters): Promise<LocalBudgetFact[]> {
    const startTime = performance.now();

    console.info('[DATA_LAYER] getFacts', {
      filters,
      usePGlite: this.shouldUsePGlite()
    });

    try {
      // API-FIRST
      if (!this.shouldUsePGlite()) {
        const result = await this.getFactsFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getFacts', duration);
        console.info('[DATA_LAYER] API returned', { count: result.length, source: 'API', durationMs: duration.toFixed(2) });
        return result;
      }

      // OPT-IN PGlite
      const pglite = await this.getPGlite();

      if (!pglite.isReady()) {
        const waitStartTime = Date.now();
        while (!pglite.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!pglite.isReady()) {
          console.warn('[DATA_LAYER] PGlite timeout, using API fallback');
          const result = await this.getFactsFromAPI(filters);
          performanceMonitor.trackAPICall('getFacts', performance.now() - startTime);
          return result;
        }
      }

      console.info('[DATA_LAYER] Using PGlite');
      const result = await pglite.queryFacts(filters);
      const duration = performance.now() - startTime;

      if (result.length === 0) {
        console.warn('[DATA_LAYER] PGlite returned empty, using API fallback');
        const apiResult = await this.getFactsFromAPI(filters);
        performanceMonitor.trackAPICall('getFacts', performance.now() - startTime);
        console.info('[DATA_LAYER] API fallback returned', { count: apiResult.length });
        return apiResult;
      }

      performanceMonitor.trackPGliteCall('getFacts', duration);
      console.info('[DATA_LAYER] PGlite returned', { count: result.length, source: 'PGlite', durationMs: duration.toFixed(2) });
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
  private async getFactsFromAPI(filters?: FactFilters): Promise<LocalBudgetFact[]> {
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
      if (!this.shouldUsePGlite()) {
        const count = await this.getFactsCountFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getFactsCount', duration);
        return count;
      }

      // OPT-IN PGlite
      const pglite = await this.getPGlite();
      if (!pglite.isReady()) {
        const waitStartTime = Date.now();
        while (!pglite.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!pglite.isReady()) {
          const count = await this.getFactsCountFromAPI(filters);
          performanceMonitor.trackAPICall('getFactsCount', performance.now() - startTime);
          return count;
        }
      }

      const facts = await pglite.queryFacts(filters);
      const count = facts.length;
      const duration = performance.now() - startTime;

      if (count === 0) {
        const apiCount = await this.getFactsCountFromAPI(filters);
        performanceMonitor.trackAPICall('getFactsCount', performance.now() - startTime);
        return apiCount;
      }

      performanceMonitor.trackPGliteCall('getFactsCount', duration);
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
   * NEW STRATEGY (API-First with Opt-In PGlite)
   */
  async getRecurringPlans(filters?: RecurringPlanFilters): Promise<LocalRecurringPlan[]> {
    const startTime = performance.now();

    console.info('[DATA_LAYER] getRecurringPlans', {
      filters,
      usePGlite: this.shouldUsePGlite()
    });

    try {
      // API-FIRST
      if (!this.shouldUsePGlite()) {
        const result = await this.getRecurringPlansFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getRecurringPlans', duration);
        console.info('[DATA_LAYER] API returned', { count: result.length, source: 'API', durationMs: duration.toFixed(2) });
        return result;
      }

      // OPT-IN PGlite
      const pglite = await this.getPGlite();

      if (!pglite.isReady()) {
        const waitStartTime = Date.now();
        while (!pglite.isReady() && (Date.now() - waitStartTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!pglite.isReady()) {
          console.warn('[DATA_LAYER] PGlite timeout, using API fallback');
          const result = await this.getRecurringPlansFromAPI(filters);
          performanceMonitor.trackAPICall('getRecurringPlans', performance.now() - startTime);
          return result;
        }
      }

      console.info('[DATA_LAYER] Using PGlite');
      const result = await pglite.queryRecurringPlans(filters);
      const duration = performance.now() - startTime;

      if (result.length === 0) {
        console.warn('[DATA_LAYER] PGlite returned empty, using API fallback');
        const apiResult = await this.getRecurringPlansFromAPI(filters);
        performanceMonitor.trackAPICall('getRecurringPlans', performance.now() - startTime);
        console.info('[DATA_LAYER] API fallback returned', { count: apiResult.length });
        return apiResult;
      }

      performanceMonitor.trackPGliteCall('getRecurringPlans', duration);
      console.info('[DATA_LAYER] PGlite returned', { count: result.length, source: 'PGlite', durationMs: duration.toFixed(2) });
      return result;

    } catch (error) {
      console.error('[DATA_LAYER] Error in getRecurringPlans', error);
      const result = await this.getRecurringPlansFromAPI(filters);
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
    if (filters?.is_active !== undefined) {
      params.set('is_active', filters.is_active.toString());
    }
    if (filters?.frequency) {
      params.set('frequency', filters.frequency);
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
   * Get dashboard data (PGlite-first with API fallback)
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
   * Get performance statistics
   *
   * @returns Performance stats comparing API and PGlite
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

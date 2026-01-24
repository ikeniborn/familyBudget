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

import { getPGliteManager } from '@db/pglite';
import { isPGliteEnabled } from '@db/pglite';
import { performanceMonitor } from '../monitoring/PerformanceMonitor';
import type { PerformanceStats } from '../monitoring/PerformanceMonitor';
import type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalArticleHierarchy,
  LocalShoppingList,
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
  private pglite: any | null = null;
  private pglitePromise: Promise<any> | null = null;

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

  // =============================================================================
  // Articles
  // =============================================================================

  /**
   * Get articles with optional filters
   *
   * @param filters - Optional filters (user_id, type, parent_id, is_active)
   * @returns Array of articles
   */
  async getArticles(filters?: ArticleFilters): Promise<LocalArticle[]> {
    const startTime = performance.now();

    try {
      // PGlite-first strategy
      if (isPGliteEnabled()) {
        const pglite = await this.getPGlite();
        if (pglite.isReady()) {
          const result = await pglite.queryArticles(filters);
          const duration = performance.now() - startTime;
          performanceMonitor.trackPGliteCall('getArticles', duration);
          return result;
        }
      }

      // Fallback to API
      const result = await this.getArticlesFromAPI(filters);
      const duration = performance.now() - startTime;
      performanceMonitor.trackAPICall('getArticles', duration);
      return result;
    } catch (error) {
      console.error('[DATA_LAYER] getArticles failed:', error);

      // Fallback to API on PGlite error
      if (isPGliteEnabled()) {
        console.warn('[DATA_LAYER] PGlite failed, falling back to API');
        const result = await this.getArticlesFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getArticles', duration);
        return result;
      }

      throw error;
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

    const data = await response.json();
    return data.items || [];
  }

  // =============================================================================
  // Financial Centers
  // =============================================================================

  /**
   * Get financial centers for a user
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

    try {
      // PGlite-first strategy
      if (isPGliteEnabled()) {
        const pglite = await this.getPGlite();
        if (pglite.isReady()) {
          const result = await pglite.queryFinancialCenters(userId, true); // only active
          const duration = performance.now() - startTime;
          performanceMonitor.trackPGliteCall('getFinancialCenters', duration);
          return result;
        }
      }

      // Fallback to API
      const result = await this.getFinancialCentersFromAPI(includeGlobal);
      const duration = performance.now() - startTime;
      performanceMonitor.trackAPICall('getFinancialCenters', duration);
      return result;
    } catch (error) {
      console.error('[DATA_LAYER] getFinancialCenters failed:', error);

      // Fallback to API on PGlite error
      if (isPGliteEnabled()) {
        console.warn('[DATA_LAYER] PGlite failed, falling back to API');
        const result = await this.getFinancialCentersFromAPI(includeGlobal);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getFinancialCenters', duration);
        return result;
      }

      throw error;
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

    const data = await response.json();
    // Backend returns FinancialCenterListResponse { financial_centers: [...] }
    // Support both formats for backward compatibility
    return data.financial_centers || data.items || [];
  }

  // =============================================================================
  // Cost Centers
  // =============================================================================

  /**
   * Get cost centers for a user
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

    try {
      // PGlite-first strategy
      if (isPGliteEnabled()) {
        const pglite = await this.getPGlite();
        if (pglite.isReady()) {
          const result = await pglite.queryFilteredCostCenters(
            userId,
            financialCenterId,
            true // only active
          );
          const duration = performance.now() - startTime;
          performanceMonitor.trackPGliteCall('getCostCenters', duration);
          return result;
        }
      }

      // Fallback to API
      const result = await this.getCostCentersFromAPI(financialCenterId, includeGlobal);
      const duration = performance.now() - startTime;
      performanceMonitor.trackAPICall('getCostCenters', duration);
      return result;
    } catch (error) {
      console.error('[DATA_LAYER] getCostCenters failed:', error);

      // Fallback to API on PGlite error
      if (isPGliteEnabled()) {
        console.warn('[DATA_LAYER] PGlite failed, falling back to API');
        const result = await this.getCostCentersFromAPI(financialCenterId, includeGlobal);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getCostCenters', duration);
        return result;
      }

      throw error;
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

    const data = await response.json();
    return data.items || [];
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
      // PGlite-first strategy
      if (isPGliteEnabled()) {
        const pglite = await this.getPGlite();
        if (pglite.isReady()) {
          const result = await pglite.queryArticleHierarchy(articleId);
          const duration = performance.now() - startTime;
          performanceMonitor.trackPGliteCall('getArticleHierarchy', duration);
          return result;
        }
      }

      // Fallback to API
      const result = await this.getArticleHierarchyFromAPI(articleId);
      const duration = performance.now() - startTime;
      performanceMonitor.trackAPICall('getArticleHierarchy', duration);
      return result;
    } catch (error) {
      console.error('[DATA_LAYER] getArticleHierarchy failed:', error);

      // Fallback to API on PGlite error
      if (isPGliteEnabled()) {
        console.warn('[DATA_LAYER] PGlite failed, falling back to API');
        const result = await this.getArticleHierarchyFromAPI(articleId);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getArticleHierarchy', duration);
        return result;
      }

      throw error;
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

    const data = await response.json();
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
  async getShoppingLists(filters?: ShoppingListFilters): Promise<LocalShoppingList[]> {
    const startTime = performance.now();

    try {
      // PGlite-first strategy
      if (isPGliteEnabled()) {
        const pglite = await this.getPGlite();
        if (pglite.isReady()) {
          const result = await pglite.queryShoppingLists(filters);
          const duration = performance.now() - startTime;
          performanceMonitor.trackPGliteCall('getShoppingLists', duration);
          return result;
        }
      }

      // Fallback to API
      const result = await this.getShoppingListsFromAPI(filters);
      const duration = performance.now() - startTime;
      performanceMonitor.trackAPICall('getShoppingLists', duration);
      return result;
    } catch (error) {
      console.error('[DATA_LAYER] getShoppingLists failed:', error);

      // Fallback to API on PGlite error
      if (isPGliteEnabled()) {
        console.warn('[DATA_LAYER] PGlite failed, falling back to API');
        const result = await this.getShoppingListsFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getShoppingLists', duration);
        return result;
      }

      throw error;
    }
  }

  /**
   * Fetch shopping lists from REST API
   *
   * @param filters - Optional filters
   * @returns Array of shopping lists
   */
  private async getShoppingListsFromAPI(filters?: ShoppingListFilters): Promise<LocalShoppingList[]> {
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

    const data = await response.json();
    return data.items || [];
  }

  /**
   * Get shopping list items with filters
   *
   * @param listTempId - Shopping list temp_id
   * @param filters - Optional filters
   * @returns Array of shopping list items
   */
  async getShoppingListItems(
    listTempId: string,
    filters?: ShoppingListItemFilters
  ): Promise<LocalShoppingListItem[]> {
    const startTime = performance.now();

    try {
      // PGlite-first strategy
      if (isPGliteEnabled()) {
        const pglite = await this.getPGlite();
        if (pglite.isReady()) {
          const result = await pglite.queryShoppingListItems({
            ...filters,
            shopping_list_temp_id: listTempId
          });
          const duration = performance.now() - startTime;
          performanceMonitor.trackPGliteCall('getShoppingListItems', duration);
          return result;
        }
      }

      // Fallback to API
      const result = await this.getShoppingListItemsFromAPI(listTempId, filters);
      const duration = performance.now() - startTime;
      performanceMonitor.trackAPICall('getShoppingListItems', duration);
      return result;
    } catch (error) {
      console.error('[DATA_LAYER] getShoppingListItems failed:', error);

      // Fallback to API on PGlite error
      if (isPGliteEnabled()) {
        console.warn('[DATA_LAYER] PGlite failed, falling back to API');
        const result = await this.getShoppingListItemsFromAPI(listTempId, filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getShoppingListItems', duration);
        return result;
      }

      throw error;
    }
  }

  /**
   * Fetch shopping list items from REST API
   *
   * @param listTempId - Shopping list temp_id
   * @param filters - Optional filters
   * @returns Array of shopping list items
   */
  private async getShoppingListItemsFromAPI(
    listTempId: string,
    filters?: ShoppingListItemFilters
  ): Promise<LocalShoppingListItem[]> {
    const params = new URLSearchParams();
    params.set('limit', '1000');
    params.set('shopping_list_temp_id', listTempId);

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

    const data = await response.json();
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
      // PGlite-first strategy
      if (isPGliteEnabled()) {
        const pglite = await this.getPGlite();
        if (pglite.isReady()) {
          const result = await pglite.queryStores(filters);
          const duration = performance.now() - startTime;
          performanceMonitor.trackPGliteCall('getStores', duration);
          return result;
        }
      }

      // Fallback to API
      const result = await this.getStoresFromAPI(filters);
      const duration = performance.now() - startTime;
      performanceMonitor.trackAPICall('getStores', duration);
      return result;
    } catch (error) {
      console.error('[DATA_LAYER] getStores failed:', error);

      // Fallback to API on PGlite error
      if (isPGliteEnabled()) {
        console.warn('[DATA_LAYER] PGlite failed, falling back to API');
        const result = await this.getStoresFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getStores', duration);
        return result;
      }

      throw error;
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

    const data = await response.json();
    return data.items || [];
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
      // PGlite-first strategy
      if (isPGliteEnabled()) {
        const pglite = await this.getPGlite();
        if (pglite.isReady()) {
          const result = await pglite.queryProductGroups(filters);
          const duration = performance.now() - startTime;
          performanceMonitor.trackPGliteCall('getProductGroups', duration);
          return result;
        }
      }

      // Fallback to API
      const result = await this.getProductGroupsFromAPI(filters);
      const duration = performance.now() - startTime;
      performanceMonitor.trackAPICall('getProductGroups', duration);
      return result;
    } catch (error) {
      console.error('[DATA_LAYER] getProductGroups failed:', error);

      // Fallback to API on PGlite error
      if (isPGliteEnabled()) {
        console.warn('[DATA_LAYER] PGlite failed, falling back to API');
        const result = await this.getProductGroupsFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getProductGroups', duration);
        return result;
      }

      throw error;
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

    const data = await response.json();
    return data.items || [];
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
  async getFacts(filters?: FactFilters): Promise<LocalBudgetFact[]> {
    const startTime = performance.now();

    try {
      // PGlite-first strategy
      if (isPGliteEnabled()) {
        const pglite = await this.getPGlite();
        if (pglite.isReady()) {
          const result = await pglite.queryFacts(filters);
          const duration = performance.now() - startTime;
          performanceMonitor.trackPGliteCall('getFacts', duration);
          return result;
        }
      }

      // Fallback to API
      const result = await this.getFactsFromAPI(filters);
      const duration = performance.now() - startTime;
      performanceMonitor.trackAPICall('getFacts', duration);
      return result;
    } catch (error) {
      console.error('[DATA_LAYER] getFacts failed:', error);

      // Fallback to API on PGlite error
      if (isPGliteEnabled()) {
        console.warn('[DATA_LAYER] PGlite failed, falling back to API');
        const result = await this.getFactsFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getFacts', duration);
        return result;
      }

      throw error;
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

    const data = await response.json();
    return data.items || [];
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
      // PGlite-first strategy
      if (isPGliteEnabled()) {
        const pglite = await this.getPGlite();
        if (pglite.isReady()) {
          const facts = await pglite.queryFacts(filters);
          const count = facts.length;
          const duration = performance.now() - startTime;
          performanceMonitor.trackPGliteCall('getFactsCount', duration);
          return count;
        }
      }

      // Fallback to API
      const count = await this.getFactsCountFromAPI(filters);
      const duration = performance.now() - startTime;
      performanceMonitor.trackAPICall('getFactsCount', duration);
      return count;
    } catch (error) {
      console.error('[DATA_LAYER] getFactsCount failed:', error);

      // Fallback to API on PGlite error
      if (isPGliteEnabled()) {
        console.warn('[DATA_LAYER] PGlite failed, falling back to API');
        const count = await this.getFactsCountFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getFactsCount', duration);
        return count;
      }

      throw error;
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
  async getRecurringPlans(filters?: RecurringPlanFilters): Promise<LocalRecurringPlan[]> {
    const startTime = performance.now();

    try {
      // PGlite-first strategy
      if (isPGliteEnabled()) {
        const pglite = await this.getPGlite();
        if (pglite.isReady()) {
          const result = await pglite.queryRecurringPlans(filters);
          const duration = performance.now() - startTime;
          performanceMonitor.trackPGliteCall('getRecurringPlans', duration);
          return result;
        }
      }

      // Fallback to API
      const result = await this.getRecurringPlansFromAPI(filters);
      const duration = performance.now() - startTime;
      performanceMonitor.trackAPICall('getRecurringPlans', duration);
      return result;
    } catch (error) {
      console.error('[DATA_LAYER] getRecurringPlans failed:', error);

      // Fallback to API on PGlite error
      if (isPGliteEnabled()) {
        console.warn('[DATA_LAYER] PGlite failed, falling back to API');
        const result = await this.getRecurringPlansFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall('getRecurringPlans', duration);
        return result;
      }

      throw error;
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

    const data = await response.json();
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

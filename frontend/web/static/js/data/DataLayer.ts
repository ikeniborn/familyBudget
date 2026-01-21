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
  LocalArticleHierarchy
} from '@db/pglite';

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
  private pglite = getPGliteManager();

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
      if (isPGliteEnabled() && this.pglite.isReady()) {
        const result = await this.pglite.queryArticles(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackPGliteCall('getArticles', duration);
        return result;
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
      if (isPGliteEnabled() && this.pglite.isReady()) {
        const result = await this.pglite.queryFinancialCenters(userId, true); // only active
        const duration = performance.now() - startTime;
        performanceMonitor.trackPGliteCall('getFinancialCenters', duration);
        return result;
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
    return data.items || [];
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
      if (isPGliteEnabled() && this.pglite.isReady()) {
        const result = await this.pglite.queryFilteredCostCenters(
          userId,
          financialCenterId,
          true // only active
        );
        const duration = performance.now() - startTime;
        performanceMonitor.trackPGliteCall('getCostCenters', duration);
        return result;
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
      if (isPGliteEnabled() && this.pglite.isReady()) {
        const result = await this.pglite.queryArticleHierarchy(articleId);
        const duration = performance.now() - startTime;
        performanceMonitor.trackPGliteCall('getArticleHierarchy', duration);
        return result;
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

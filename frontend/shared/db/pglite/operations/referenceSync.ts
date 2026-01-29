/**
 * Reference Data Sync Operations
 *
 * Initial sync for read-only reference data:
 * - Articles (budget categories)
 * - Financial Centers (accounts)
 * - Cost Centers (projects)
 * - Article Hierarchy (closure table)
 */

import type { PGlite } from '@electric-sql/pglite';
import type { LocalArticle, LocalFinancialCenter, LocalCostCenter, LocalArticleHierarchy } from '../types/models';
import { updateSyncMetadata } from './schemaOperations';
import { logger } from '../utils/logger';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { withRetry } from '../utils/retry';

export interface ReferenceDataResponse {
  articles: LocalArticle[];
  financial_centers: LocalFinancialCenter[];
  cost_centers: LocalCostCenter[];
  article_hierarchy: LocalArticleHierarchy[];
}

/**
 * Progress callback for UI updates
 */
export type SyncProgressCallback = (progress: {
  phase: string;
  message: string;
  current?: number;
  total?: number;
}) => void;

/**
 * Fetch reference data from API with retry logic
 *
 * @param retries - Number of retry attempts (default: 3)
 * @returns Reference data (articles, financial_centers, cost_centers, hierarchy)
 * @throws Error if all retry attempts fail
 */
async function fetchReferenceData(retries = 3): Promise<ReferenceDataResponse> {
  logger.info('[REFERENCE_SYNC] Fetching reference data from API...');

  return withRetry(
    async () => {
      // Fetch all reference data in parallel with 10s timeout
      const [articlesRes, fcRes, ccRes] = await Promise.all([
        fetchWithTimeout('/api/v1/articles', { credentials: 'include' }, 10000),
        fetchWithTimeout('/api/v1/financial-centers', { credentials: 'include' }, 10000),
        fetchWithTimeout('/api/v1/cost-centers', { credentials: 'include' }, 10000)
      ]);

      // Check HTTP status codes
      if (!articlesRes.ok) {
        throw new Error(`Failed to fetch articles: HTTP ${articlesRes.status}`);
      }
      if (!fcRes.ok) {
        throw new Error(`Failed to fetch financial centers: HTTP ${fcRes.status}`);
      }
      if (!ccRes.ok) {
        throw new Error(`Failed to fetch cost centers: HTTP ${ccRes.status}`);
      }

      const articlesData = await articlesRes.json();
      const fcData = await fcRes.json();
      const ccData = await ccRes.json();

      // Extract arrays from response (API returns { articles: [...], financial_centers: [...], cost_centers: [...] })
      const articles = articlesData.articles || articlesData.data || articlesData;
      const financial_centers = fcData.financial_centers || fcData.data || fcData;
      const cost_centers = ccData.cost_centers || ccData.data || ccData;

      // Validate response data
      if (!Array.isArray(articles) || !Array.isArray(financial_centers) || !Array.isArray(cost_centers)) {
        throw new Error('Invalid API response format: expected arrays');
      }

      // Article hierarchy is computed from articles (parent_id relationships)
      const article_hierarchy = computeArticleHierarchy(articles);

      logger.info('[REFERENCE_SYNC] Fetched reference data', {
        articles: articles.length,
        financial_centers: financial_centers.length,
        cost_centers: cost_centers.length,
        hierarchy: article_hierarchy.length
      });

      return {
        articles,
        financial_centers,
        cost_centers,
        article_hierarchy
      };
    },
    {
      maxAttempts: retries,
      baseDelay: 1000,
      operationName: 'fetch reference data',
      shouldRetry: (error) => {
        // Don't retry for critical authentication errors
        return !error.message?.includes('401') && !error.message?.includes('403');
      }
    }
  );
}

/**
 * Compute article hierarchy (closure table) from articles
 *
 * Builds a closure table representing all ancestor-descendant relationships
 * in the article tree using depth-first traversal.
 *
 * @param articles - Articles with parent_id relationships
 * @returns Article hierarchy (ancestor-descendant pairs with depth)
 *
 * @example
 * Input articles:
 *   [
 *     { id: 1, parent_id: null, name: "Income" },      // Root
 *     { id: 2, parent_id: 1, name: "Salary" },         // Child of Income
 *     { id: 3, parent_id: 2, name: "Main Job" }        // Child of Salary
 *   ]
 *
 * Output hierarchy:
 *   [
 *     { ancestor_id: 1, descendant_id: 1, depth: 0 },  // Self-reference
 *     { ancestor_id: 1, descendant_id: 2, depth: 1 },  // Income → Salary
 *     { ancestor_id: 1, descendant_id: 3, depth: 2 },  // Income → Main Job
 *     { ancestor_id: 2, descendant_id: 2, depth: 0 },  // Self-reference
 *     { ancestor_id: 2, descendant_id: 3, depth: 1 },  // Salary → Main Job
 *     { ancestor_id: 3, descendant_id: 3, depth: 0 }   // Self-reference
 *   ]
 */
function computeArticleHierarchy(articles: LocalArticle[]): LocalArticleHierarchy[] {
  const hierarchy: LocalArticleHierarchy[] = [];

  // Build adjacency map (parent_id -> children)
  const childrenMap = new Map<number, number[]>();
  for (const article of articles) {
    if (article.parent_id !== null) {
      if (!childrenMap.has(article.parent_id)) {
        childrenMap.set(article.parent_id, []);
      }
      childrenMap.get(article.parent_id)!.push(article.id);
    }
  }

  // Depth-first traversal to build closure table
  function traverse(ancestorId: number, currentId: number, depth: number) {
    hierarchy.push({
      ancestor_id: ancestorId,
      descendant_id: currentId,
      depth
    });

    const children = childrenMap.get(currentId) || [];
    for (const childId of children) {
      traverse(ancestorId, childId, depth + 1);
    }
  }

  // Start traversal from each article
  for (const article of articles) {
    traverse(article.id, article.id, 0);
  }

  return hierarchy;
}

/**
 * Sync reference data from API to PGlite
 *
 * Downloads articles, financial centers, cost centers, and hierarchy
 * from API and bulk inserts into PGlite. Updates sync metadata.
 *
 * @param db - PGlite instance
 * @param onProgress - Optional progress callback for UI updates
 */
export async function syncReferenceData(
  db: PGlite,
  onProgress?: SyncProgressCallback
): Promise<void> {
  logger.info('[REFERENCE_SYNC] Starting reference data sync...');

  try {
    // Step 1: Fetch from API
    onProgress?.({
      phase: 'fetch',
      message: 'Fetching reference data from API...'
    });

    const referenceData = await fetchReferenceData();

    // Step 2: Bulk insert articles
    onProgress?.({
      phase: 'insert',
      message: 'Inserting articles...',
      current: 0,
      total: referenceData.articles.length
    });

    await db.query('DELETE FROM local_articles');

    // Batch insert for better performance (avoid N queries)
    if (referenceData.articles.length > 0) {
      const BATCH_SIZE = 50; // Insert 50 records per query
      for (let i = 0; i < referenceData.articles.length; i += BATCH_SIZE) {
        const batch = referenceData.articles.slice(i, i + BATCH_SIZE);
        const values = batch.map((_, idx) => {
          const base = idx * 8;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
        }).join(', ');

        const params = batch.flatMap(article => [
          article.id,
          article.name,
          article.type,
          article.parent_id || null,
          article.is_active,
          article.user_id,
          article.created_at,
          article.updated_at
        ]);

        await db.query(`
          INSERT INTO local_articles (
            id, name, type, parent_id, is_active, user_id, created_at, updated_at
          ) VALUES ${values}
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            type = EXCLUDED.type,
            parent_id = EXCLUDED.parent_id,
            is_active = EXCLUDED.is_active,
            user_id = EXCLUDED.user_id,
            updated_at = EXCLUDED.updated_at
        `, params);
      }
    }

    // Step 3: Bulk insert financial centers
    onProgress?.({
      phase: 'insert',
      message: 'Inserting financial centers...',
      current: referenceData.articles.length,
      total: referenceData.articles.length + referenceData.financial_centers.length
    });

    await db.query('DELETE FROM local_financial_centers');

    // Batch insert for better performance
    if (referenceData.financial_centers.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < referenceData.financial_centers.length; i += BATCH_SIZE) {
        const batch = referenceData.financial_centers.slice(i, i + BATCH_SIZE);
        const values = batch.map((_, idx) => {
          const base = idx * 8;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
        }).join(', ');

        const params = batch.flatMap(fc => [
          fc.id,
          fc.name,
          fc.description,
          fc.code,
          fc.is_active,
          fc.user_id,
          fc.created_at,
          fc.updated_at
        ]);

        await db.query(`
          INSERT INTO local_financial_centers (
            id, name, description, code, is_active, user_id, created_at, updated_at
          ) VALUES ${values}
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            code = EXCLUDED.code,
            is_active = EXCLUDED.is_active,
            user_id = EXCLUDED.user_id,
            updated_at = EXCLUDED.updated_at
        `, params);
      }
    }

    // Step 4: Bulk insert cost centers
    onProgress?.({
      phase: 'insert',
      message: 'Inserting cost centers...',
      current: referenceData.articles.length + referenceData.financial_centers.length,
      total: referenceData.articles.length + referenceData.financial_centers.length + referenceData.cost_centers.length
    });

    await db.query('DELETE FROM local_cost_centers');

    // Batch insert for better performance
    if (referenceData.cost_centers.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < referenceData.cost_centers.length; i += BATCH_SIZE) {
        const batch = referenceData.cost_centers.slice(i, i + BATCH_SIZE);
        const values = batch.map((_, idx) => {
          const base = idx * 5;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
        }).join(', ');

        const params = batch.flatMap(cc => [
          cc.id,
          cc.name,
          cc.is_active,
          cc.user_id,
          cc.created_at
        ]);

        await db.query(`
          INSERT INTO local_cost_centers (
            id, name, is_active, user_id, created_at
          ) VALUES ${values}
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            is_active = EXCLUDED.is_active,
            user_id = EXCLUDED.user_id
        `, params);
      }
    }

    // Step 5: Bulk insert article hierarchy
    onProgress?.({
      phase: 'insert',
      message: 'Building article hierarchy...',
      current: referenceData.articles.length + referenceData.financial_centers.length + referenceData.cost_centers.length,
      total: referenceData.articles.length + referenceData.financial_centers.length + referenceData.cost_centers.length + referenceData.article_hierarchy.length
    });

    await db.query('DELETE FROM local_article_hierarchy');

    // Batch insert for better performance
    if (referenceData.article_hierarchy.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < referenceData.article_hierarchy.length; i += BATCH_SIZE) {
        const batch = referenceData.article_hierarchy.slice(i, i + BATCH_SIZE);
        const values = batch.map((_, idx) => {
          const base = idx * 3;
          return `($${base + 1}, $${base + 2}, $${base + 3})`;
        }).join(', ');

        const params = batch.flatMap(h => [
          h.ancestor_id,
          h.descendant_id,
          h.depth
        ]);

        await db.query(`
          INSERT INTO local_article_hierarchy (
            ancestor_id, descendant_id, depth
          ) VALUES ${values}
          ON CONFLICT (ancestor_id, descendant_id) DO UPDATE SET
            depth = EXCLUDED.depth
        `, params);
      }
    }

    // Step 6: Update sync metadata
    onProgress?.({
      phase: 'metadata',
      message: 'Updating sync metadata...'
    });

    await updateSyncMetadata(db, 'articles', {
      last_sync_timestamp: new Date(),
      sync_version: 1,
      total_records: referenceData.articles.length
    });

    await updateSyncMetadata(db, 'financial_centers', {
      last_sync_timestamp: new Date(),
      sync_version: 1,
      total_records: referenceData.financial_centers.length
    });

    await updateSyncMetadata(db, 'cost_centers', {
      last_sync_timestamp: new Date(),
      sync_version: 1,
      total_records: referenceData.cost_centers.length
    });

    logger.info('[REFERENCE_SYNC] Reference data sync completed', {
      articles: referenceData.articles.length,
      financial_centers: referenceData.financial_centers.length,
      cost_centers: referenceData.cost_centers.length,
      hierarchy: referenceData.article_hierarchy.length
    });

    onProgress?.({
      phase: 'complete',
      message: 'Reference data sync completed'
    });
  } catch (error) {
    logger.error('[REFERENCE_SYNC] Reference data sync failed', error);
    throw error;
  }
}

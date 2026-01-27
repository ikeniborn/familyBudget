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
 * Fetch reference data from API
 *
 * @returns Reference data (articles, financial_centers, cost_centers, hierarchy)
 */
async function fetchReferenceData(): Promise<ReferenceDataResponse> {
  logger.info('[REFERENCE_SYNC] Fetching reference data from API...');

  try {
    // Fetch all reference data in parallel
    const [articlesRes, fcRes, ccRes] = await Promise.all([
      fetch('/api/v1/articles'),
      fetch('/api/v1/financial-centers'),
      fetch('/api/v1/cost-centers')
    ]);

    if (!articlesRes.ok || !fcRes.ok || !ccRes.ok) {
      throw new Error('Failed to fetch reference data from API');
    }

    const articlesData = await articlesRes.json();
    const fcData = await fcRes.json();
    const ccData = await ccRes.json();

    // Extract arrays from response (API returns { data: [...] })
    const articles = articlesData.data || articlesData;
    const financial_centers = fcData.data || fcData;
    const cost_centers = ccData.data || ccData;

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
  } catch (error) {
    logger.error('[REFERENCE_SYNC] Failed to fetch reference data', error);
    throw error;
  }
}

/**
 * Compute article hierarchy (closure table) from articles
 *
 * @param articles - Articles with parent_id relationships
 * @returns Article hierarchy (ancestor-descendant pairs with depth)
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

    for (const article of referenceData.articles) {
      await db.query(`
        INSERT INTO local_articles (
          id, name, type, parent_id, is_active, user_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          parent_id = EXCLUDED.parent_id,
          is_active = EXCLUDED.is_active,
          user_id = EXCLUDED.user_id,
          updated_at = EXCLUDED.updated_at
      `, [
        article.id,
        article.name,
        article.type,
        article.parent_id || null,
        article.is_active,
        article.user_id,
        article.created_at,
        article.updated_at
      ]);
    }

    // Step 3: Bulk insert financial centers
    onProgress?.({
      phase: 'insert',
      message: 'Inserting financial centers...',
      current: referenceData.articles.length,
      total: referenceData.articles.length + referenceData.financial_centers.length
    });

    await db.query('DELETE FROM local_financial_centers');

    for (const fc of referenceData.financial_centers) {
      await db.query(`
        INSERT INTO local_financial_centers (
          id, name, type, currency, is_active, user_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          currency = EXCLUDED.currency,
          is_active = EXCLUDED.is_active,
          user_id = EXCLUDED.user_id
      `, [
        fc.id,
        fc.name,
        fc.type,
        fc.currency,
        fc.is_active,
        fc.user_id,
        fc.created_at
      ]);
    }

    // Step 4: Bulk insert cost centers
    onProgress?.({
      phase: 'insert',
      message: 'Inserting cost centers...',
      current: referenceData.articles.length + referenceData.financial_centers.length,
      total: referenceData.articles.length + referenceData.financial_centers.length + referenceData.cost_centers.length
    });

    await db.query('DELETE FROM local_cost_centers');

    for (const cc of referenceData.cost_centers) {
      await db.query(`
        INSERT INTO local_cost_centers (
          id, name, is_active, user_id, created_at
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          is_active = EXCLUDED.is_active,
          user_id = EXCLUDED.user_id
      `, [
        cc.id,
        cc.name,
        cc.is_active,
        cc.user_id,
        cc.created_at
      ]);
    }

    // Step 5: Bulk insert article hierarchy
    onProgress?.({
      phase: 'insert',
      message: 'Building article hierarchy...',
      current: referenceData.articles.length + referenceData.financial_centers.length + referenceData.cost_centers.length,
      total: referenceData.articles.length + referenceData.financial_centers.length + referenceData.cost_centers.length + referenceData.article_hierarchy.length
    });

    await db.query('DELETE FROM local_article_hierarchy');

    for (const h of referenceData.article_hierarchy) {
      await db.query(`
        INSERT INTO local_article_hierarchy (
          ancestor_id, descendant_id, depth
        ) VALUES ($1, $2, $3)
        ON CONFLICT (ancestor_id, descendant_id) DO UPDATE SET
          depth = EXCLUDED.depth
      `, [
        h.ancestor_id,
        h.descendant_id,
        h.depth
      ]);
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

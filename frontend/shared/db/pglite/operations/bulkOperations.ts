/**
 * Bulk insert operations for initial sync
 * Handles chunked inserts with progress tracking
 */

import type { PGlite } from '@electric-sql/pglite';
import type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalArticleHierarchy
} from '../types/models';
import { logger } from '../utils/logger';

const BULK_INSERT_CHUNK_SIZE = 1000;

/**
 * Progress callback type
 */
export type ProgressCallback = (current: number, total: number) => void;

/**
 * Bulk insert articles with chunking and progress tracking
 *
 * @param db - PGlite instance
 * @param articles - Articles to insert
 * @param onProgress - Optional progress callback
 */
export async function bulkInsertArticles(
  db: PGlite,
  articles: LocalArticle[],
  onProgress?: ProgressCallback
): Promise<void> {
  if (articles.length === 0) {
    logger.debug('No articles to insert');
    return;
  }

  logger.info(`Bulk inserting ${articles.length} articles`);

  // Process in chunks to avoid memory issues
  for (let i = 0; i < articles.length; i += BULK_INSERT_CHUNK_SIZE) {
    const chunk = articles.slice(i, Math.min(i + BULK_INSERT_CHUNK_SIZE, articles.length));
    await insertArticlesChunk(db, chunk);

    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + chunk.length, articles.length), articles.length);
    }
  }

  logger.info(`Successfully inserted ${articles.length} articles`);
}

/**
 * Insert a chunk of articles
 */
async function insertArticlesChunk(db: PGlite, articles: LocalArticle[]): Promise<void> {
  // Build batch INSERT with ON CONFLICT for idempotency
  const values = articles.map((_, idx) => {
    const offset = idx * 8; // 8 parameters per article
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
  }).join(',');

  const params = articles.flatMap(a => [
    a.id,
    a.user_id,
    a.parent_id,
    a.name,
    a.type,
    a.is_active,
    a.created_at,
    a.updated_at
  ]);

  await db.query(`
    INSERT INTO local_articles (id, user_id, parent_id, name, type, is_active, created_at, updated_at)
    VALUES ${values}
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      is_active = EXCLUDED.is_active,
      updated_at = EXCLUDED.updated_at
  `, params);
}

/**
 * Bulk insert financial centers with chunking and progress tracking
 *
 * @param db - PGlite instance
 * @param centers - Financial centers to insert
 * @param onProgress - Optional progress callback
 */
export async function bulkInsertFinancialCenters(
  db: PGlite,
  centers: LocalFinancialCenter[],
  onProgress?: ProgressCallback
): Promise<void> {
  if (centers.length === 0) {
    logger.debug('No financial centers to insert');
    return;
  }

  logger.info(`Bulk inserting ${centers.length} financial centers`);

  for (let i = 0; i < centers.length; i += BULK_INSERT_CHUNK_SIZE) {
    const chunk = centers.slice(i, Math.min(i + BULK_INSERT_CHUNK_SIZE, centers.length));
    await insertFinancialCentersChunk(db, chunk);

    if (onProgress) {
      onProgress(Math.min(i + chunk.length, centers.length), centers.length);
    }
  }

  logger.info(`Successfully inserted ${centers.length} financial centers`);
}

/**
 * Insert a chunk of financial centers
 */
async function insertFinancialCentersChunk(db: PGlite, centers: LocalFinancialCenter[]): Promise<void> {
  const values = centers.map((_, idx) => {
    const offset = idx * 7; // 7 parameters
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
  }).join(',');

  const params = centers.flatMap(c => [
    c.id,
    c.user_id,
    c.name,
    c.type,
    c.currency,
    c.is_active,
    c.created_at
  ]);

  await db.query(`
    INSERT INTO local_financial_centers (id, user_id, name, type, currency, is_active, created_at)
    VALUES ${values}
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      currency = EXCLUDED.currency,
      is_active = EXCLUDED.is_active
  `, params);
}

/**
 * Bulk insert cost centers with chunking and progress tracking
 *
 * @param db - PGlite instance
 * @param centers - Cost centers to insert
 * @param onProgress - Optional progress callback
 */
export async function bulkInsertCostCenters(
  db: PGlite,
  centers: LocalCostCenter[],
  onProgress?: ProgressCallback
): Promise<void> {
  if (centers.length === 0) {
    logger.debug('No cost centers to insert');
    return;
  }

  logger.info(`Bulk inserting ${centers.length} cost centers`);

  for (let i = 0; i < centers.length; i += BULK_INSERT_CHUNK_SIZE) {
    const chunk = centers.slice(i, Math.min(i + BULK_INSERT_CHUNK_SIZE, centers.length));
    await insertCostCentersChunk(db, chunk);

    if (onProgress) {
      onProgress(Math.min(i + chunk.length, centers.length), centers.length);
    }
  }

  logger.info(`Successfully inserted ${centers.length} cost centers`);
}

/**
 * Insert a chunk of cost centers
 */
async function insertCostCentersChunk(db: PGlite, centers: LocalCostCenter[]): Promise<void> {
  const values = centers.map((_, idx) => {
    const offset = idx * 5; // 5 parameters
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
  }).join(',');

  const params = centers.flatMap(c => [
    c.id,
    c.user_id,
    c.name,
    c.is_active,
    c.created_at
  ]);

  await db.query(`
    INSERT INTO local_cost_centers (id, user_id, name, is_active, created_at)
    VALUES ${values}
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      is_active = EXCLUDED.is_active
  `, params);
}

/**
 * Bulk insert article hierarchy with chunking and progress tracking
 *
 * @param db - PGlite instance
 * @param hierarchy - Article hierarchy entries to insert
 * @param onProgress - Optional progress callback
 */
export async function bulkInsertHierarchy(
  db: PGlite,
  hierarchy: LocalArticleHierarchy[],
  onProgress?: ProgressCallback
): Promise<void> {
  if (hierarchy.length === 0) {
    logger.debug('No hierarchy entries to insert');
    return;
  }

  logger.info(`Bulk inserting ${hierarchy.length} hierarchy entries`);

  for (let i = 0; i < hierarchy.length; i += BULK_INSERT_CHUNK_SIZE) {
    const chunk = hierarchy.slice(i, Math.min(i + BULK_INSERT_CHUNK_SIZE, hierarchy.length));
    await insertHierarchyChunk(db, chunk);

    if (onProgress) {
      onProgress(Math.min(i + chunk.length, hierarchy.length), hierarchy.length);
    }
  }

  logger.info(`Successfully inserted ${hierarchy.length} hierarchy entries`);
}

/**
 * Insert a chunk of hierarchy entries
 */
async function insertHierarchyChunk(db: PGlite, hierarchy: LocalArticleHierarchy[]): Promise<void> {
  const values = hierarchy.map((_, idx) => {
    const offset = idx * 3; // 3 parameters
    return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
  }).join(',');

  const params = hierarchy.flatMap(h => [
    h.ancestor_id,
    h.descendant_id,
    h.depth
  ]);

  await db.query(`
    INSERT INTO local_article_hierarchy (ancestor_id, descendant_id, depth)
    VALUES ${values}
    ON CONFLICT (ancestor_id, descendant_id) DO UPDATE SET
      depth = EXCLUDED.depth
  `, params);
}

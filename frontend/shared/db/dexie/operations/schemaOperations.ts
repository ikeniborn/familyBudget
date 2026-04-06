/**
 * Schema operations for reference data
 * CRUD methods для Articles, Financial Centers, Cost Centers
 * Dexie.js implementation
 */

import { db } from '../core/database';
import { logger } from '../utils/logger';
import { validateArticle } from '../utils/validation';
import type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalArticleHierarchy
} from '../types/models';

/**
 * Query Articles с фильтрами
 */
export async function queryArticles(filters?: {
  user_id?: number;
  type?: 'income' | 'expense' | 'debit' | 'credit';
  parent_id?: number | null;
  is_active?: boolean;
}): Promise<LocalArticle[]> {
  logger.debug('[schemaOps] queryArticles', filters);

  let collection = db.articles.toCollection();

  // Оптимизация: используем index если есть user_id
  if (filters?.user_id !== undefined) {
    collection = db.articles.where('user_id').equals(filters.user_id);
  }

  const results = await collection.toArray();

  // Filter в памяти (IndexedDB не поддерживает сложные WHERE)
  return results.filter(article => {
    if (filters?.type && article.type !== filters.type) return false;
    if (filters?.is_active !== undefined && article.is_active !== filters.is_active) return false;
    if (filters?.parent_id !== undefined && article.parent_id !== filters.parent_id) return false;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Query Financial Centers для user
 */
export async function queryFinancialCenters(
  user_id: number,
  is_active?: boolean
): Promise<LocalFinancialCenter[]> {
  logger.debug('[schemaOps] queryFinancialCenters', { user_id, is_active });

  const collection = db.financialCenters.where('user_id').equals(user_id);

  const results = await collection.toArray();

  // Filter по is_active
  const filtered = is_active !== undefined
    ? results.filter(fc => fc.is_active === is_active)
    : results;

  return filtered.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Query Cost Centers для user
 */
export async function queryCostCenters(
  user_id: number,
  is_active?: boolean
): Promise<LocalCostCenter[]> {
  logger.debug('[schemaOps] queryCostCenters', { user_id, is_active });

  const collection = db.costCenters.where('user_id').equals(user_id);

  const results = await collection.toArray();

  const filtered = is_active !== undefined
    ? results.filter(cc => cc.is_active === is_active)
    : results;

  return filtered.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Query Article Hierarchy (closure table)
 * Упрощенная реализация (не критично, т.к. не используется в UI)
 */
export async function queryArticleHierarchy(
  article_id: number
): Promise<LocalArticleHierarchy[]> {
  logger.debug('[schemaOps] queryArticleHierarchy', { article_id });

  // Index query по ancestor_id
  const hierarchy = await db.articleHierarchy
    .where('ancestor_id')
    .equals(article_id)
    .toArray();

  // Sort по depth (в памяти)
  return hierarchy.sort((a, b) => a.depth - b.depth);
}

/**
 * Bulk insert articles (для initial sync)
 */
export async function bulkInsertArticles(
  articles: LocalArticle[]
): Promise<void> {
  logger.info('[schemaOps] bulkInsertArticles', { count: articles.length });

  // Validate все articles перед insert
  articles.forEach(article => {
    validateArticle({
      type: article.type,
      name: article.name,
      user_id: article.user_id
    });
  });

  await db.articles.bulkPut(articles);
  logger.info('[schemaOps] ✅ Articles inserted', { count: articles.length });
}

/**
 * Bulk insert financial centers
 */
export async function bulkInsertFinancialCenters(
  centers: LocalFinancialCenter[]
): Promise<void> {
  logger.info('[schemaOps] bulkInsertFinancialCenters', { count: centers.length });
  await db.financialCenters.bulkPut(centers);
  logger.info('[schemaOps] ✅ Financial centers inserted', { count: centers.length });
}

/**
 * Bulk insert cost centers
 */
export async function bulkInsertCostCenters(
  centers: LocalCostCenter[]
): Promise<void> {
  logger.info('[schemaOps] bulkInsertCostCenters', { count: centers.length });
  await db.costCenters.bulkPut(centers);
  logger.info('[schemaOps] ✅ Cost centers inserted', { count: centers.length });
}

/**
 * Bulk insert article hierarchy
 */
export async function bulkInsertArticleHierarchy(
  hierarchy: LocalArticleHierarchy[]
): Promise<void> {
  logger.info('[schemaOps] bulkInsertArticleHierarchy', { count: hierarchy.length });
  await db.articleHierarchy.bulkPut(hierarchy);
  logger.info('[schemaOps] ✅ Article hierarchy inserted', { count: hierarchy.length });
}

/**
 * Clear reference data (для re-sync)
 */
export async function clearReferenceData(): Promise<void> {
  logger.warn('[schemaOps] Clearing reference data...');

  await db.transaction('rw', [
    db.articles,
    db.articleHierarchy,
    db.financialCenters,
    db.costCenters
  ], async () => {
    await db.articles.clear();
    await db.articleHierarchy.clear();
    await db.financialCenters.clear();
    await db.costCenters.clear();
  });

  logger.info('[schemaOps] ✅ Reference data cleared');
}

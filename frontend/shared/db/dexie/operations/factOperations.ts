/**
 * Budget Fact operations (CRUD + Queries)
 * Dexie.js implementation
 */

import { db } from '../core/database';
import { queryArticles } from './schemaOperations';
import { logger } from '../utils/logger';
import { calculateContentHash } from '../utils/hash';
import { factRepo } from '../repositories/FactRepository';
import type {
  LocalBudgetFact,
  LocalPendingOperation,
  FactFilters
} from '../types/fact';

/**
 * Default config
 */
const DEFAULT_MAX_RETRY_ATTEMPTS = 3;

/**
 * Create budget fact (offline-first)
 *
 * @param fact - Partial fact data
 * @returns temp_id (UUID)
 */
export async function createFact(
  fact: Omit<LocalBudgetFact, 'id' | 'temp_id' | 'sync_status' | 'content_hash' | 'created_at' | 'updated_at' | 'synced_at' | 'tab_origin_id'>
): Promise<string> {
  return factRepo.createOffline(fact);
}

/**
 * Update budget fact (offline-first)
 *
 * @param temp_id - Fact temp_id
 * @param updates - Partial fact data to update
 */
export async function updateFact(
  temp_id: string,
  updates: Partial<Pick<LocalBudgetFact, 'date' | 'amount' | 'article_id' | 'financial_center_id' | 'cost_center_id' | 'comment'>>
): Promise<void> {
  try {
    logger.debug('[Dexie] Updating fact', { temp_id, updates });

    // Get existing fact
    const fact = await db.budgetFacts.where('temp_id').equals(temp_id).first();
    if (!fact) {
      throw new Error(`Fact not found: ${temp_id}`);
    }

    // Update fact
    await db.budgetFacts.where('temp_id').equals(temp_id).modify({
      ...updates,
      sync_status: 'pending',
      updated_at: new Date()
    });

    // Add to pending operations
    const content_hash = await calculateContentHash({ ...fact, ...updates } as Record<string, unknown>);
    await addPendingOperation({
      operation: 'update',
      entity_type: 'fact',
      temp_id,
      server_id: fact.id,
      payload: updates as Record<string, unknown>,
      attempts: 0,
      max_attempts: DEFAULT_MAX_RETRY_ATTEMPTS,
      last_error: null,
      next_retry_at: null, // First attempt - no backoff
      content_hash,
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.info('[Dexie] ✅ Fact updated', { temp_id });
  } catch (error) {
    logger.error('[Dexie] ❌ Fact update error:', error);
    throw error;
  }
}

/**
 * Delete budget fact (soft delete)
 *
 * @param temp_id - Fact temp_id
 */
export async function deleteFact(temp_id: string): Promise<void> {
  try {
    logger.debug('[Dexie] Deleting fact', { temp_id });

    // Get existing fact
    const fact = await db.budgetFacts.where('temp_id').equals(temp_id).first();
    if (!fact) {
      throw new Error(`Fact not found: ${temp_id}`);
    }

    // Soft delete (mark as deleted)
    await db.budgetFacts.where('temp_id').equals(temp_id).modify({
      sync_status: 'deleted',
      updated_at: new Date()
    });

    // Add to pending operations
    await addPendingOperation({
      operation: 'delete',
      entity_type: 'fact',
      temp_id,
      server_id: fact.id,
      payload: {},
      attempts: 0,
      max_attempts: DEFAULT_MAX_RETRY_ATTEMPTS,
      last_error: null,
      next_retry_at: null, // First attempt - no backoff
      content_hash: '', // Empty for deletes
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.info('[Dexie] ✅ Fact deleted', { temp_id });
  } catch (error) {
    logger.error('[Dexie] ❌ Fact delete error:', error);
    throw error;
  }
}

/**
 * Query budget facts с фильтрами
 *
 * @param filters - Optional filters
 * @returns Array of facts (amount в рублях, без конвертации)
 */
export async function queryFacts(filters?: FactFilters): Promise<LocalBudgetFact[]> {
  logger.debug('[Dexie] queryFacts', filters);

  let results: LocalBudgetFact[];

  // Оптимизация: используем compound index [user_id+date] если возможно
  if (filters?.user_id && filters?.date_from && filters?.date_to) {
    results = await db.budgetFacts
      .where('[user_id+date]')
      .between(
        [filters.user_id, filters.date_from],
        [filters.user_id, filters.date_to],
        true,
        true
      )
      .toArray();
  } else {
    // Fallback: load all и filter в памяти
    results = await db.budgetFacts.toArray();
  }

  // Apply additional filters
  if (filters) {
    results = results.filter(fact => {
      if (filters.user_id && fact.user_id !== filters.user_id) return false;
      if (filters.article_id && fact.article_id !== filters.article_id) return false;
      if (filters.financial_center_id && fact.financial_center_id !== filters.financial_center_id) return false;
      if (filters.cost_center_id && fact.cost_center_id !== filters.cost_center_id) return false;
      if (filters.record_type && fact.record_type !== filters.record_type) return false;
      if (filters.sync_status && fact.sync_status !== filters.sync_status) return false;

      // Date range filter (если не использовался compound index)
      if (filters.date_from && fact.date < filters.date_from) return false;
      if (filters.date_to && fact.date > filters.date_to) return false;

      // Search filter by comment field
      // NOTE: article_type is not stored in LocalBudgetFact (only article_id), so it cannot be filtered here
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const comment = fact.comment || '';
        if (!comment.toLowerCase().includes(searchLower)) return false;
      }

      return true;
    });

    // article_type filter: client-side join — article_type is not stored in LocalBudgetFact
    if (filters.article_type) {
      const matchingArticles = await queryArticles({ type: filters.article_type });
      const validArticleIds = new Set(matchingArticles.map(a => a.id));
      results = results.filter(fact => validArticleIds.has(fact.article_id));
    }
  }

  // amount already in rubles (stored via mapAPIFactToLocal without conversion)
  return results;
}

/**
 * Add pending operation to queue
 */
export async function addPendingOperation(operation: Omit<LocalPendingOperation, 'id'>): Promise<void> {
  try {
    await db.pendingOperations.add(operation as LocalPendingOperation);
    logger.debug('[Dexie] Pending operation added', {
      operation: operation.operation,
      entity_type: operation.entity_type
    });
  } catch (error) {
    // Ignore duplicate content_hash (deduplication)
    if ((error as Error).message.includes('content_hash')) {
      logger.warn('[Dexie] Duplicate pending operation (ignored)', {
        content_hash: operation.content_hash
      });
      return;
    }
    throw error;
  }
}

/**
 * Get pending operations ready for sync (respects exponential backoff)
 */
export async function getPendingOperations(): Promise<LocalPendingOperation[]> {
  logger.debug('[Dexie] getPendingOperations');

  const now = new Date();
  // Use created_at index (added in schema v5) — sort happens in IndexedDB, not JS
  const allOperations = await db.pendingOperations
    .orderBy('created_at')
    .toArray();

  // Filter out operations that are waiting for backoff to expire
  const readyOperations = allOperations.filter(op => {
    // If next_retry_at is null, operation is ready (first attempt or max attempts reached)
    if (!op.next_retry_at) return true;

    // Check if backoff period has expired
    return new Date(op.next_retry_at) <= now;
  });

  logger.debug('[Dexie] Pending operations filtered', {
    total: allOperations.length,
    ready: readyOperations.length,
    waiting: allOperations.length - readyOperations.length
  });

  return readyOperations;
}

/**
 * Confirm pending operation (после успешной sync)
 */
export async function confirmPendingOperation(
  temp_id: string,
  server_id: number
): Promise<void> {
  return factRepo.confirmPending(temp_id, server_id);
}

/**
 * Calculate exponential backoff delay (milliseconds)
 * Attempts 1-5 → 2s, 4s, 8s, 16s, 32s
 */
function calculateBackoffDelay(attempts: number): number {
  const baseDelay = 2000; // 2 seconds
  const maxDelay = 32000; // 32 seconds
  const delay = baseDelay * Math.pow(2, attempts - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Fail pending operation (increment attempts + exponential backoff)
 */
export async function failPendingOperation(
  temp_id: string,
  error: string
): Promise<void> {
  logger.warn('[Dexie] failPendingOperation', { temp_id, error });

  const operation = await db.pendingOperations.where('temp_id').equals(temp_id).first();
  if (!operation) {
    logger.error('[Dexie] Pending operation not found', { temp_id });
    return;
  }

  const newAttempts = operation.attempts + 1;

  if (newAttempts >= operation.max_attempts) {
    // Max attempts reached - mark as failed (no more retries)
    await db.pendingOperations.where('temp_id').equals(temp_id).modify({
      last_error: error,
      attempts: newAttempts,
      next_retry_at: null // Stop retrying
    });

    logger.error('[Dexie] ❌ Operation failed (max attempts)', {
      temp_id,
      attempts: newAttempts,
      max_attempts: operation.max_attempts
    });
  } else {
    // Calculate next retry time with exponential backoff
    const backoffMs = calculateBackoffDelay(newAttempts);
    const nextRetryAt = new Date(Date.now() + backoffMs);

    await db.pendingOperations.where('temp_id').equals(temp_id).modify({
      last_error: error,
      attempts: newAttempts,
      next_retry_at: nextRetryAt,
      updated_at: new Date()
    });

    logger.warn('[Dexie] Operation retry scheduled', {
      temp_id,
      attempts: newAttempts,
      max_attempts: operation.max_attempts,
      next_retry_at: nextRetryAt.toISOString(),
      backoff_seconds: backoffMs / 1000
    });
  }
}

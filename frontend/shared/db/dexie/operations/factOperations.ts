/**
 * Budget Fact operations (CRUD + Queries)
 * Адаптация PGlite → Dexie.js
 */

import { db, toCents, fromCents } from '../core/database';
import { logger } from '../utils/logger';
import { validateFact } from '../utils/validation';
import { calculateContentHash, generateUUID } from '../utils/hash';
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
 * ВАЖНО: amount конвертируется в cents
 *
 * @param fact - Partial fact data
 * @returns temp_id (UUID)
 */
export async function createFact(
  fact: Omit<LocalBudgetFact, 'id' | 'temp_id' | 'sync_status' | 'content_hash' | 'created_at' | 'updated_at' | 'synced_at'>
): Promise<string> {
  // Trigger sync start indicator (совместимость с PGlite)
  if (typeof window !== 'undefined') {
    (window as any).pgliteIndicator?.onSyncStart();
  }

  try {
    const temp_id = generateUUID();
    const content_hash = await calculateContentHash(fact as Record<string, unknown>);

    logger.debug('[Dexie] Creating fact', { temp_id, fact });

    // Validate перед insert
    validateFact({
      amount: fact.amount,
      date: fact.date,
      record_type: fact.record_type,
      user_id: fact.user_id,
      article_id: fact.article_id
    });

    // Convert amount to cents
    const newFact: LocalBudgetFact = {
      id: null,
      temp_id,
      ...fact,
      amount: toCents(fact.amount),
      sync_status: 'pending',
      content_hash,
      created_at: new Date(),
      updated_at: new Date(),
      synced_at: null
    };

    // Insert fact
    await db.budgetFacts.add(newFact);

    // Add to pending operations queue
    await addPendingOperation({
      operation: 'create',
      entity_type: 'fact',
      temp_id,
      server_id: null,
      payload: fact as Record<string, unknown>,
      attempts: 0,
      max_attempts: DEFAULT_MAX_RETRY_ATTEMPTS,
      last_error: null,
      content_hash,
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.info('[Dexie] ✅ Fact created', { temp_id });

    // Sync complete
    if (typeof window !== 'undefined') {
      (window as any).pgliteIndicator?.onSyncComplete();
    }

    return temp_id;
  } catch (error) {
    logger.error('[Dexie] ❌ Fact create error:', error);
    if (typeof window !== 'undefined') {
      (window as any).pgliteIndicator?.onSyncError(error as Error);
    }
    throw error;
  }
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
  // Trigger sync start
  if (typeof window !== 'undefined') {
    (window as any).pgliteIndicator?.onSyncStart();
  }

  try {
    logger.debug('[Dexie] Updating fact', { temp_id, updates });

    // Get existing fact
    const fact = await db.budgetFacts.where('temp_id').equals(temp_id).first();
    if (!fact) {
      throw new Error(`Fact not found: ${temp_id}`);
    }

    // Prepare updates (convert amount to cents if needed)
    const updatesWithCents = updates.amount !== undefined
      ? { ...updates, amount: toCents(updates.amount) }
      : updates;

    // Update fact
    await db.budgetFacts.where('temp_id').equals(temp_id).modify({
      ...updatesWithCents,
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
      content_hash,
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.info('[Dexie] ✅ Fact updated', { temp_id });

    // Sync complete
    if (typeof window !== 'undefined') {
      (window as any).pgliteIndicator?.onSyncComplete();
    }
  } catch (error) {
    logger.error('[Dexie] ❌ Fact update error:', error);
    if (typeof window !== 'undefined') {
      (window as any).pgliteIndicator?.onSyncError(error as Error);
    }
    throw error;
  }
}

/**
 * Delete budget fact (soft delete)
 *
 * @param temp_id - Fact temp_id
 */
export async function deleteFact(temp_id: string): Promise<void> {
  // Trigger sync start
  if (typeof window !== 'undefined') {
    (window as any).pgliteIndicator?.onSyncStart();
  }

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
      content_hash: '', // Empty for deletes
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.info('[Dexie] ✅ Fact deleted', { temp_id });

    // Sync complete
    if (typeof window !== 'undefined') {
      (window as any).pgliteIndicator?.onSyncComplete();
    }
  } catch (error) {
    logger.error('[Dexie] ❌ Fact delete error:', error);
    if (typeof window !== 'undefined') {
      (window as any).pgliteIndicator?.onSyncError(error as Error);
    }
    throw error;
  }
}

/**
 * Query budget facts с фильтрами
 * ВАЖНО: amount конвертируется из cents в dollars
 *
 * @param filters - Optional filters
 * @returns Array of facts (amount в dollars)
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

      return true;
    });
  }

  // Convert amount from cents to dollars
  return results.map(fact => ({
    ...fact,
    amount: fromCents(fact.amount)
  }));
}

/**
 * Add pending operation to queue
 */
async function addPendingOperation(operation: Omit<LocalPendingOperation, 'id'>): Promise<void> {
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
 * Get pending operations для sync
 */
export async function getPendingOperations(): Promise<LocalPendingOperation[]> {
  logger.debug('[Dexie] getPendingOperations');

  return await db.pendingOperations
    .orderBy('created_at')
    .toArray();
}

/**
 * Confirm pending operation (после успешной sync)
 */
export async function confirmPendingOperation(
  temp_id: string,
  server_id: number
): Promise<void> {
  logger.debug('[Dexie] confirmPendingOperation', { temp_id, server_id });

  // Update fact с server ID
  await db.budgetFacts.where('temp_id').equals(temp_id).modify({
    id: server_id,
    sync_status: 'synced',
    synced_at: new Date()
  });

  // Remove from pending queue
  await db.pendingOperations
    .where('temp_id').equals(temp_id)
    .delete();

  logger.info('[Dexie] ✅ Operation confirmed', { temp_id, server_id });
}

/**
 * Fail pending operation (increment attempts)
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
    // Max attempts reached - mark as failed
    await db.pendingOperations.where('temp_id').equals(temp_id).modify({
      last_error: error,
      attempts: newAttempts
    });

    logger.error('[Dexie] ❌ Operation failed (max attempts)', {
      temp_id,
      attempts: newAttempts,
      max_attempts: operation.max_attempts
    });
  } else {
    // Increment attempts
    await db.pendingOperations.where('temp_id').equals(temp_id).modify({
      last_error: error,
      attempts: newAttempts,
      updated_at: new Date()
    });

    logger.warn('[Dexie] Operation retry', {
      temp_id,
      attempts: newAttempts,
      max_attempts: operation.max_attempts
    });
  }
}

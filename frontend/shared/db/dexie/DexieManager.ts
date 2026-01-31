/**
 * DexieManager - Main interface for Dexie.js database
 * Replaces PGliteManager with IndexedDB backend
 *
 * ВАЖНО: API совместим с PGliteManager для seamless migration
 * Changes: SQL queries → Dexie.js Table operations
 */

import { db, toCents, fromCents } from './core/database';
import { logger } from './utils/logger';
import { validateFact } from './utils/validation';
import type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalBudgetFact,
  LocalShoppingList,
  FactFilters,
  LocalSyncMetadata
} from './types/models';

/**
 * Initialization status
 */
export type InitializationStatus = 'not_started' | 'initializing' | 'ready' | 'error';

/**
 * Progress callback for bulk operations
 */
export type ProgressCallback = (current: number, total: number) => void;

/**
 * DexieManager - Main database interface
 */
export class DexieManager {
  private state: InitializationStatus = 'not_started';

  /**
   * Initialize Dexie database
   * Opens IndexedDB connection
   */
  async init(): Promise<void> {
    if (this.state === 'ready') {
      logger.debug('[DexieManager] Already initialized');
      return;
    }

    logger.info('[DexieManager] Initializing...');
    this.state = 'initializing';

    try {
      // Open database (creates if not exists)
      await db.open();

      this.state = 'ready';
      logger.info('[DexieManager] ✅ Ready');
    } catch (error) {
      this.state = 'error';
      logger.error('[DexieManager] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if database is ready
   */
  isReady(): boolean {
    return this.state === 'ready';
  }

  /**
   * Get current initialization status
   */
  getStatus(): InitializationStatus {
    return this.state;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    logger.info('[DexieManager] Closing database...');
    await db.close();
    this.state = 'not_started';
    logger.info('[DexieManager] Closed');
  }

  /**
   * Clear all data (for testing/reset)
   */
  async clearAll(): Promise<void> {
    logger.warn('[DexieManager] Clearing all data...');
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map(table => table.clear()));
    });
    logger.info('[DexieManager] All data cleared');
  }

  /**
   * Delete entire database (for migration rollback)
   */
  async deleteDatabase(): Promise<void> {
    logger.warn('[DexieManager] Deleting database...');
    await db.delete();
    this.state = 'not_started';
    logger.info('[DexieManager] Database deleted');
  }

  // ============================================================
  // REFERENCE DATA QUERIES (Articles, Financial Centers, Cost Centers)
  // ============================================================

  /**
   * Query articles with optional filters
   */
  async queryArticles(filters?: {
    user_id?: number;
    type?: 'income' | 'expense' | 'debit' | 'credit';
    is_active?: boolean;
    parent_id?: number | null;
  }): Promise<LocalArticle[]> {
    logger.debug('[DexieManager] queryArticles', filters);

    let collection = db.articles.toCollection();

    // Apply filters
    if (filters?.user_id !== undefined) {
      collection = db.articles.where('user_id').equals(filters.user_id);
    }

    if (filters?.type !== undefined) {
      // Если уже есть фильтр по user_id, нужно filter в памяти
      const results = await collection.toArray();
      return results.filter(a => {
        if (filters.type && a.type !== filters.type) return false;
        if (filters.is_active !== undefined && a.is_active !== filters.is_active) return false;
        if (filters.parent_id !== undefined && a.parent_id !== filters.parent_id) return false;
        return true;
      });
    }

    return await collection.toArray();
  }

  /**
   * Query financial centers
   */
  async queryFinancialCenters(userId: number, includeGlobal: boolean = false): Promise<LocalFinancialCenter[]> {
    logger.debug('[DexieManager] queryFinancialCenters', { userId, includeGlobal });

    // IndexedDB не поддерживает OR conditions
    // Решение: два запроса + merge
    const userCenters = await db.financialCenters
      .where('user_id').equals(userId)
      .toArray();

    if (includeGlobal) {
      const globalCenters = await db.financialCenters
        .where('user_id').equals(0)  // global user_id = 0
        .toArray();
      return [...userCenters, ...globalCenters];
    }

    return userCenters;
  }

  /**
   * Query cost centers
   */
  async queryCostCenters(userId: number): Promise<LocalCostCenter[]> {
    logger.debug('[DexieManager] queryCostCenters', { userId });

    return await db.costCenters
      .where('user_id').equals(userId)
      .toArray();
  }

  // ============================================================
  // BUDGET FACTS OPERATIONS (CRUD)
  // ============================================================

  /**
   * Create new budget fact
   * ВАЖНО: amount конвертируется в cents при сохранении
   */
  async createFact(fact: Omit<LocalBudgetFact, 'id'>): Promise<LocalBudgetFact> {
    logger.debug('[DexieManager] createFact', fact);

    // Validate before insert
    validateFact({
      amount: fact.amount,
      date: fact.date,
      record_type: fact.record_type,
      user_id: fact.user_id,
      article_id: fact.article_id
    });

    // Convert amount to cents
    const factWithCents = {
      ...fact,
      amount: toCents(fact.amount)
    };

    const id = await db.budgetFacts.add(factWithCents as LocalBudgetFact);

    logger.info('[DexieManager] ✅ Fact created', { id, temp_id: fact.temp_id });
    return { ...factWithCents, id } as LocalBudgetFact;
  }

  /**
   * Update budget fact
   */
  async updateFact(id: number, updates: Partial<LocalBudgetFact>): Promise<void> {
    logger.debug('[DexieManager] updateFact', { id, updates });

    // Convert amount to cents if updated
    const updatesWithCents = updates.amount !== undefined
      ? { ...updates, amount: toCents(updates.amount) }
      : updates;

    await db.budgetFacts.update(id, updatesWithCents);
    logger.info('[DexieManager] ✅ Fact updated', { id });
  }

  /**
   * Delete budget fact (soft delete)
   */
  async deleteFact(id: number): Promise<void> {
    logger.debug('[DexieManager] deleteFact', { id });

    await db.budgetFacts.update(id, { sync_status: 'deleted' });
    logger.info('[DexieManager] ✅ Fact deleted (soft)', { id });
  }

  /**
   * Query budget facts with filters
   * ВАЖНО: amount конвертируется из cents при чтении
   */
  async queryFacts(filters?: FactFilters): Promise<LocalBudgetFact[]> {
    logger.debug('[DexieManager] queryFacts', filters);

    let results: LocalBudgetFact[];

    // Оптимизация: используем compound index [user_id+date] если возможно
    if (filters?.user_id && filters?.date_from && filters?.date_to) {
      results = await db.budgetFacts
        .where('[user_id+date]')
        .between(
          [filters.user_id, filters.date_from],
          [filters.user_id, filters.date_to],
          true,  // includeLower
          true   // includeUpper
        )
        .toArray();
    } else {
      // Fallback: filter в памяти
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

  // ============================================================
  // BULK OPERATIONS
  // ============================================================

  /**
   * Bulk insert facts with progress callback
   */
  async bulkInsertFacts(facts: LocalBudgetFact[], onProgress?: ProgressCallback): Promise<void> {
    logger.info('[DexieManager] bulkInsertFacts', { count: facts.length });

    const BATCH_SIZE = 1000;
    const factsWithCents = facts.map(f => ({ ...f, amount: toCents(f.amount) }));

    for (let i = 0; i < factsWithCents.length; i += BATCH_SIZE) {
      const batch = factsWithCents.slice(i, i + BATCH_SIZE);
      await db.budgetFacts.bulkAdd(batch);

      if (onProgress) {
        onProgress(i + batch.length, factsWithCents.length);
      }

      logger.debug(`[DexieManager] Inserted batch ${i / BATCH_SIZE + 1}`, {
        current: i + batch.length,
        total: factsWithCents.length
      });
    }

    logger.info('[DexieManager] ✅ Bulk insert complete', { total: facts.length });
  }

  // ============================================================
  // SYNC OPERATIONS
  // ============================================================

  /**
   * Get pending operations (offline changes queue)
   */
  async getPendingOperations(): Promise<LocalBudgetFact[]> {
    logger.debug('[DexieManager] getPendingOperations');

    const pending = await db.budgetFacts
      .where('sync_status').equals('pending')
      .toArray();

    // Convert amount from cents
    return pending.map(fact => ({
      ...fact,
      amount: fromCents(fact.amount)
    }));
  }

  /**
   * Confirm pending operation (after successful sync)
   */
  async confirmPendingOperation(tempId: string, serverId: number): Promise<void> {
    logger.debug('[DexieManager] confirmPendingOperation', { tempId, serverId });

    await db.budgetFacts
      .where('temp_id').equals(tempId)
      .modify({ id: serverId, sync_status: 'synced' });

    logger.info('[DexieManager] ✅ Operation confirmed', { tempId, serverId });
  }

  /**
   * Get sync metadata for entity type
   */
  async getSyncMetadata(entityType: string): Promise<LocalSyncMetadata | undefined> {
    logger.debug('[DexieManager] getSyncMetadata', { entityType });

    return await db.syncMetadata.get(entityType);
  }

  /**
   * Update sync metadata
   */
  async updateSyncMetadata(metadata: LocalSyncMetadata): Promise<void> {
    logger.debug('[DexieManager] updateSyncMetadata', metadata);

    await db.syncMetadata.put(metadata);
    logger.info('[DexieManager] ✅ Sync metadata updated', { entityType: metadata.entity_type });
  }

  // ============================================================
  // SHOPPING LISTS (Placeholder - будет реализовано в operations/)
  // ============================================================

  async queryShoppingLists(userId: number): Promise<LocalShoppingList[]> {
    return await db.shoppingLists.where('user_id').equals(userId).toArray();
  }

  async createShoppingList(list: Omit<LocalShoppingList, 'id'>): Promise<LocalShoppingList> {
    const id = await db.shoppingLists.add(list as LocalShoppingList);
    return { ...list, id } as LocalShoppingList;
  }
}

/**
 * Singleton instance
 */
let dexieManagerInstance: DexieManager | null = null;

/**
 * Get DexieManager singleton
 */
export function getDexieManager(): DexieManager {
  if (!dexieManagerInstance) {
    dexieManagerInstance = new DexieManager();
  }
  return dexieManagerInstance;
}

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
import { generateUUID } from './utils/hash';
import {
  pruneFacts,
  startAutoPruning,
  stopAutoPruning,
  isAutoPruningEnabled,
  calculateDatabaseSize
} from './operations/pruningOperations';
import {
  detectConflict,
  resolveConflict,
  createConflictRecord,
  getConflictMetrics as getConflictMetricsImpl
} from './operations/conflictOperations';
import type { ConflictStrategy } from './operations/conflictOperations';
import type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalBudgetFact,
  LocalShoppingList,
  LocalArticleHierarchy,
  LocalRecurringPlan,
  FactFilters,
  LocalSyncMetadata,
  LocalSyncConflict
} from './types/models';

/**
 * Initialization status
 */
export type InitializationStatus = 'not_started' | 'initializing' | 'ready' | 'error';

/**
 * Progress callback for bulk operations
 */
export type ProgressCallback = (_current: number, _total: number) => void;

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
  async createFact(
    fact: Omit<LocalBudgetFact, 'id' | 'temp_id' | 'sync_status' | 'content_hash' | 'created_at' | 'updated_at' | 'synced_at'>
  ): Promise<string> {
    logger.debug('[DexieManager] createFact', fact);

    // Validate before insert
    validateFact({
      amount: fact.amount,
      date: fact.date,
      record_type: fact.record_type,
      user_id: fact.user_id,
      article_id: fact.article_id
    });

    const temp_id = generateUUID();

    // Convert amount to cents
    const factWithCents: LocalBudgetFact = {
      id: null,
      temp_id,
      ...fact,
      amount: toCents(fact.amount),
      sync_status: 'pending',
      content_hash: null,
      created_at: new Date(),
      updated_at: new Date(),
      synced_at: null
    };

    await db.budgetFacts.add(factWithCents);

    logger.info('[DexieManager] ✅ Fact created', { temp_id });
    return temp_id;
  }

  /**
   * Update budget fact по temp_id
   */
  async updateFact(temp_id: string, updates: Partial<LocalBudgetFact>): Promise<void> {
    logger.debug('[DexieManager] updateFact', { temp_id, updates });

    // Convert amount to cents if updated
    const updatesWithCents = updates.amount !== undefined
      ? { ...updates, amount: toCents(updates.amount) }
      : updates;

    await db.budgetFacts.where('temp_id').equals(temp_id).modify(updatesWithCents);
    logger.info('[DexieManager] ✅ Fact updated', { temp_id });
  }

  /**
   * Delete budget fact (soft delete) по temp_id
   */
  async deleteFact(temp_id: string): Promise<void> {
    logger.debug('[DexieManager] deleteFact', { temp_id });

    await db.budgetFacts.where('temp_id').equals(temp_id).modify({ sync_status: 'deleted' });
    logger.info('[DexieManager] ✅ Fact deleted (soft)', { temp_id });
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

  /**
   * Bulk insert articles
   */
  async bulkInsertArticles(articles: LocalArticle[], onProgress?: ProgressCallback): Promise<void> {
    logger.info('[DexieManager] bulkInsertArticles', { count: articles.length });
    await db.articles.bulkAdd(articles);
    if (onProgress) onProgress(articles.length, articles.length);
  }

  /**
   * Bulk insert financial centers
   */
  async bulkInsertFinancialCenters(centers: LocalFinancialCenter[], onProgress?: ProgressCallback): Promise<void> {
    logger.info('[DexieManager] bulkInsertFinancialCenters', { count: centers.length });
    await db.financialCenters.bulkAdd(centers);
    if (onProgress) onProgress(centers.length, centers.length);
  }

  /**
   * Bulk insert cost centers
   */
  async bulkInsertCostCenters(centers: LocalCostCenter[], onProgress?: ProgressCallback): Promise<void> {
    logger.info('[DexieManager] bulkInsertCostCenters', { count: centers.length });
    await db.costCenters.bulkAdd(centers);
    if (onProgress) onProgress(centers.length, centers.length);
  }

  /**
   * Bulk insert article hierarchy
   */
  async bulkInsertHierarchy(hierarchy: LocalArticleHierarchy[], onProgress?: ProgressCallback): Promise<void> {
    logger.info('[DexieManager] bulkInsertHierarchy', { count: hierarchy.length });
    await db.articleHierarchy.bulkAdd(hierarchy);
    if (onProgress) onProgress(hierarchy.length, hierarchy.length);
  }

  /**
   * Bulk update facts
   */
  async bulkUpdateFacts(facts: Partial<LocalBudgetFact>[]): Promise<void> {
    logger.info('[DexieManager] bulkUpdateFacts', { count: facts.length });
    await db.budgetFacts.bulkPut(facts as LocalBudgetFact[]);
  }

  /**
   * Bulk soft delete facts
   */
  async bulkSoftDeleteFacts(temp_ids: string[]): Promise<void> {
    logger.info('[DexieManager] bulkSoftDeleteFacts', { count: temp_ids.length });
    await db.transaction('rw', db.budgetFacts, async () => {
      for (const temp_id of temp_ids) {
        await db.budgetFacts.where('temp_id').equals(temp_id).modify({ sync_status: 'deleted' });
      }
    });
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
  // RECURRING PLANS OPERATIONS (CRUD)
  // ============================================================

  /**
   * Query recurring plans with filters
   * ВАЖНО: amount конвертируется из cents при чтении
   */
  async queryRecurringPlans(filters?: {
    user_id?: number;
    article_id?: number;
    financial_center_id?: number;
    cost_center_id?: number;
    is_active?: boolean;
    frequency?: string;
  }): Promise<LocalRecurringPlan[]> {
    logger.debug('[DexieManager] queryRecurringPlans', filters);

    let results: LocalRecurringPlan[];

    // Optimization: use user_id index if available
    if (filters?.user_id) {
      results = await db.recurringPlans
        .where('user_id')
        .equals(filters.user_id)
        .toArray();
    } else {
      results = await db.recurringPlans.toArray();
    }

    // Apply additional filters
    if (filters) {
      results = results.filter(plan => {
        if (filters.user_id && plan.user_id !== filters.user_id) return false;
        if (filters.article_id && plan.article_id !== filters.article_id) return false;
        if (filters.financial_center_id && plan.financial_center_id !== filters.financial_center_id) return false;
        if (filters.cost_center_id && plan.cost_center_id !== filters.cost_center_id) return false;
        if (filters.is_active !== undefined && plan.is_active !== filters.is_active) return false;
        if (filters.frequency && plan.frequency !== filters.frequency) return false;
        return true;
      });
    }

    // Convert amount from cents to dollars
    return results.map(plan => ({
      ...plan,
      amount: fromCents(plan.amount)
    }));
  }

  /**
   * Create recurring plan
   * ВАЖНО: amount конвертируется в cents при сохранении
   */
  async createRecurringPlan(
    plan: Omit<LocalRecurringPlan, 'id' | 'created_at'>
  ): Promise<number> {
    logger.debug('[DexieManager] createRecurringPlan', plan);

    // Validate required fields
    if (!plan.user_id || !plan.article_id || !plan.financial_center_id || !plan.amount || !plan.frequency) {
      throw new Error('[DexieManager] Missing required fields for recurring plan');
    }

    const newPlan: LocalRecurringPlan = {
      ...plan,
      id: 0, // Auto-generated by Dexie
      amount: toCents(plan.amount),
      created_at: new Date()
    };

    const id = await db.recurringPlans.add(newPlan);
    logger.info('[DexieManager] ✅ Recurring plan created', { id });

    return id as number;
  }

  /**
   * Update recurring plan
   */
  async updateRecurringPlan(
    id: number,
    updates: Partial<Omit<LocalRecurringPlan, 'id' | 'created_at'>>
  ): Promise<void> {
    logger.debug('[DexieManager] updateRecurringPlan', { id, updates });

    const plan = await db.recurringPlans.get(id);

    if (!plan) {
      throw new Error(`[DexieManager] Recurring plan not found: ${id}`);
    }

    // Convert amount to cents if provided
    const updateData = { ...updates };
    if (updateData.amount !== undefined) {
      updateData.amount = toCents(updateData.amount);
    }

    await db.recurringPlans.update(id, updateData);
    logger.info('[DexieManager] ✅ Recurring plan updated', { id });
  }

  /**
   * Delete recurring plan
   */
  async deleteRecurringPlan(id: number): Promise<void> {
    logger.debug('[DexieManager] deleteRecurringPlan', { id });

    await db.recurringPlans.delete(id);
    logger.info('[DexieManager] ✅ Recurring plan deleted', { id });
  }

  /**
   * Get single recurring plan by id
   */
  async getRecurringPlan(id: number): Promise<LocalRecurringPlan | undefined> {
    logger.debug('[DexieManager] getRecurringPlan', { id });

    const plan = await db.recurringPlans.get(id);

    if (!plan) {
      return undefined;
    }

    // Convert amount from cents to dollars
    return {
      ...plan,
      amount: fromCents(plan.amount)
    };
  }

  /**
   * Sync recurring plans from server
   * Replaces local data with server version
   */
  async syncRecurringPlansFromServer(plans: LocalRecurringPlan[]): Promise<void> {
    logger.debug('[DexieManager] syncRecurringPlansFromServer', { count: plans.length });

    // Convert amounts to cents
    const plansWithCents = plans.map(plan => ({
      ...plan,
      amount: toCents(plan.amount)
    }));

    // Replace all local data (clear + bulk add)
    await db.transaction('rw', db.recurringPlans, async () => {
      await db.recurringPlans.clear();
      await db.recurringPlans.bulkAdd(plansWithCents);
    });

    logger.info('[DexieManager] ✅ Recurring plans synced', { count: plans.length });
  }

  // ============================================================
  // SHOPPING LISTS (Placeholder - будет реализовано в operations/)
  // ============================================================

  async queryShoppingLists(userId: number): Promise<LocalShoppingList[]> {
    return await db.shoppingLists.where('creator_id').equals(userId).toArray();
  }

  async createShoppingList(
    list: Omit<LocalShoppingList, 'id' | 'temp_id' | 'sync_status' | 'created_at' | 'updated_at'>
  ): Promise<string> {
    const temp_id = generateUUID();

    const newList: LocalShoppingList = {
      id: null,
      temp_id,
      ...list,
      sync_status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    };

    await db.shoppingLists.add(newList);
    return temp_id;
  }

  // ============================================================
  // DIAGNOSTIC & MONITORING (Placeholder for UI)
  // ============================================================

  /**
   * Get diagnostic data for monitoring modal
   * Note: Query performance metrics are placeholder values (future: implement performance tracking)
   */
  async getDiagnosticData(): Promise<{
    initializationStatus: string;
    lastSyncTimestamp: string;
    isEnabled: boolean;
    isInitialized: boolean;
    dbSize: number;
    dbSizeKB: number;
    tables: Record<string, number>;
    tableStats: {
      articles: number;
      financial_centers: number;
      cost_centers: number;
      facts: number;
      plans: number;
    };
    syncStatus: 'error' | 'idle' | 'syncing';
    performance: { avgQueryTime: number };
    performanceMetrics?: {
      avgQueryTimeMs: number;
      totalQueries: number;
      avgLoadTimeMs: number;
      avgSaveTimeMs: number;
    };
    pruningStats: {
      enabled: boolean;
      lastPrune?: Date;
      lastPrunedAt: string;
      totalPruned: number;
      nextPruneEstimate: string;
    };
  }> {
    const articlesCount = await db.articles.count();
    const factsCount = await db.budgetFacts.count();
    const shoppingListsCount = await db.shoppingLists.count();
    const financialCentersCount = await db.financialCenters.count();
    const costCentersCount = await db.costCenters.count();
    const recurringPlansCount = await db.recurringPlans.count();

    // Calculate actual DB size (approximate)
    const dbSize = await calculateDatabaseSize();

    return {
      initializationStatus: this.state,
      lastSyncTimestamp: new Date().toISOString(),
      isEnabled: true,
      isInitialized: this.state === 'ready',
      dbSize,
      dbSizeKB: dbSize / 1024,
      tables: {
        articles: articlesCount,
        budgetFacts: factsCount,
        shoppingLists: shoppingListsCount,
        financialCenters: financialCentersCount,
        costCenters: costCentersCount
      },
      tableStats: {
        articles: articlesCount,
        financial_centers: financialCentersCount,
        cost_centers: costCentersCount,
        facts: factsCount,
        plans: recurringPlansCount
      },
      syncStatus: 'idle' as const,
      performance: {
        avgQueryTime: 15 // Placeholder: actual performance tracking not implemented
      },
      performanceMetrics: {
        avgQueryTimeMs: 15,
        totalQueries: 0, // Placeholder: query tracking not implemented
        avgLoadTimeMs: 10,
        avgSaveTimeMs: 20
      },
      pruningStats: {
        enabled: isAutoPruningEnabled(),
        lastPrune: undefined,
        lastPrunedAt: 'Never',
        totalPruned: 0,
        nextPruneEstimate: isAutoPruningEnabled() ? '1 hour' : 'Disabled'
      }
    };
  }

  /**
   * Get conflict metrics
   */
  async getConflictMetrics(): Promise<{
    total: number;
    resolved: number;
    pending: number;
    resolvedConflicts: number;
    pendingConflicts: number;
    totalConflicts: number;
    conflictRate: number;
    resolutionBreakdown: {
      server: number;
      client: number;
      merged?: number;
    };
  }> {
    logger.debug('[DexieManager] getConflictMetrics');
    return await getConflictMetricsImpl();
  }

  // ============================================================
  // CONFLICT RESOLUTION OPERATIONS
  // ============================================================

  /**
   * Detect conflict between local and remote versions
   */
  detectConflict(local: Record<string, unknown>, remote: Record<string, unknown>): boolean {
    logger.debug('[DexieManager] detectConflict');
    return detectConflict(local, remote);
  }

  /**
   * Resolve conflict using specified strategy
   */
  async resolveConflict(
    conflict: { id: number; local_version: Record<string, unknown>; server_version: Record<string, unknown> },
    strategy: ConflictStrategy
  ): Promise<Record<string, unknown>> {
    logger.debug('[DexieManager] resolveConflict', { conflictId: conflict.id, strategy });
    // Type assertion: conflict parameter matches required LocalSyncConflict fields for resolution
    return await resolveConflict(conflict as LocalSyncConflict, strategy);
  }

  /**
   * Create conflict record
   */
  async createConflictRecord(
    entityType: string,
    entityId: number | null,
    tempId: string | null,
    local: Record<string, unknown>,
    remote: Record<string, unknown>
  ): Promise<void> {
    logger.debug('[DexieManager] createConflictRecord', { entityType, entityId, tempId });
    await createConflictRecord(entityType, entityId, tempId, local, remote);
  }

  // ============================================================
  // AUTO-PRUNING OPERATIONS
  // ============================================================

  /**
   * Prune old synced facts
   */
  async pruneFacts(retentionDays: number = 30): Promise<number> {
    logger.debug('[DexieManager] pruneFacts', { retentionDays });
    return await pruneFacts(retentionDays);
  }

  /**
   * Start auto-pruning
   */
  startAutoPruning(retentionDays: number = 30, intervalMs: number = 60 * 60 * 1000): void {
    logger.debug('[DexieManager] startAutoPruning', { retentionDays, intervalMs });
    startAutoPruning(retentionDays, intervalMs);
  }

  /**
   * Stop auto-pruning
   */
  stopAutoPruning(): void {
    logger.debug('[DexieManager] stopAutoPruning');
    stopAutoPruning();
  }

  /**
   * Check if auto-pruning is enabled
   */
  isAutoPruningEnabled(): boolean {
    return isAutoPruningEnabled();
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

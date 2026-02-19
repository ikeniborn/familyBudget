/**
 * DexieManager - Main interface for Dexie.js database
 * Replaces PGliteManager with IndexedDB backend
 *
 * ВАЖНО: API совместим с PGliteManager для seamless migration
 * Changes: SQL queries → Dexie.js Table operations
 */

import { initializeDatabase, toCents, fromCents, clearVersionCache } from './core/database';
import type { FamilyBudgetDB } from './core/database';
import { logger } from './utils/logger';
import { cleanupLegacyDatabase } from './migration/cleanupLegacyDB';
import { validateFact } from './utils/validation';
import { generateUUID } from './utils/hash';
import {
  pruneFacts,
  startAutoPruning,
  stopAutoPruning,
  isAutoPruningEnabled,
  calculateDatabaseSize,
  setupVisibilityPruning,
  setupIdlePruning
} from './operations/pruningOperations';
import {
  detectConflict,
  resolveConflict,
  createConflictRecord,
  getConflictMetrics as getConflictMetricsImpl
} from './operations/conflictOperations';
import type { ConflictStrategy } from './operations/conflictOperations';
import {
  initialReferenceSync,
  syncArticles,
  syncFinancialCenters,
  syncCostCenters,
  syncRecurringPlans
} from './operations/referenceSync';
import type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalBudgetFact,
  LocalShoppingList,
  LocalArticleHierarchy,
  LocalRecurringPlan,
  FactFilters,
  ShoppingListFilters,
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
  private db: FamilyBudgetDB | null = null;

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
      // Migrate legacy sync period to separate facts/plans settings (v11.5.0+)
      this.migrateSyncPeriodSettings();

      // Cleanup legacy database (v5-v10) before initializing Dexie v1
      await cleanupLegacyDatabase();

      // Initialize database with dynamic version detection
      this.db = await initializeDatabase();

      // Open database (creates if not exists)
      await this.db.open();

      this.state = 'ready';
      logger.info('[DexieManager] ✅ Ready');

      // Initialize hybrid pruning strategy (after successful init)
      const retentionDays = this.getSyncPeriodDays();
      setupVisibilityPruning(retentionDays);
      setupIdlePruning(retentionDays);
    } catch (error) {
      this.state = 'error';
      logger.error('[DexieManager] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get database instance
   * Throws if not initialized
   */
  private getDB(): FamilyBudgetDB {
    if (!this.db) {
      throw new Error('[DexieManager] Database not initialized! Call init() first.');
    }
    return this.db;
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
    await this.getDB().close();
    this.state = 'not_started';
    logger.info('[DexieManager] Closed');
  }

  /**
   * Migrate legacy sync period to separate facts/plans settings (v11.5.0+)
   */
  private migrateSyncPeriodSettings(): void {
    const legacyKey = 'budget_dexie_sync_period';
    const factsKey = 'budget_dexie_sync_period_facts';
    const plansKey = 'budget_dexie_sync_period_plans';

    // Step 1: migrate legacy → facts/plans (v11.5.0+)
    if (!localStorage.getItem(factsKey) && !localStorage.getItem(plansKey)) {
      const legacyValue = localStorage.getItem(legacyKey);

      if (legacyValue) {
        // Migrate: keep facts period, convert to months for plans
        localStorage.setItem(factsKey, legacyValue); // e.g., "90"

        const daysAsMonths = Math.round(parseInt(legacyValue, 10) / 30);
        const plansMonths = Math.max(1, Math.min(6, daysAsMonths));
        localStorage.setItem(plansKey, plansMonths.toString());

        logger.info('[DexieManager] Migrated sync period settings', {
          legacy: legacyValue,
          facts: legacyValue,
          plans: plansMonths
        });
      } else {
        // Set defaults
        localStorage.setItem(factsKey, '90');
        localStorage.setItem(plansKey, '3');
      }
    }

    // Step 2: split plans → plans_history + plans_future (v11.6.0+)
    // Runs independently — existing users who completed step 1 also need this
    const plansHistoryKey = 'budget_dexie_sync_period_plans_history';
    const plansFutureKey = 'budget_dexie_sync_period_plans_future';
    if (!localStorage.getItem(plansHistoryKey) && !localStorage.getItem(plansFutureKey)) {
      const base = parseInt(localStorage.getItem(plansKey) ?? '3', 10);
      localStorage.setItem(plansHistoryKey, base.toString());
      localStorage.setItem(plansFutureKey, base.toString());
    }
  }

  /**
   * Clear all data (for testing/reset)
   */
  async clearAll(): Promise<void> {
    logger.warn('[DexieManager] Clearing all data...');
    const db = this.getDB();
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
    await this.getDB().delete();
    this.state = 'not_started';
    this.db = null;
    clearVersionCache(); // Clear cached version for future reinitializations
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

    let collection = this.getDB().articles.toCollection();

    // Apply filters
    if (filters?.user_id !== undefined) {
      collection = this.getDB().articles.where('user_id').equals(filters.user_id);
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
    const userCenters = await this.getDB().financialCenters
      .where('user_id').equals(userId)
      .toArray();

    if (includeGlobal) {
      const globalCenters = await this.getDB().financialCenters
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

    return await this.getDB().costCenters
      .where('user_id').equals(userId)
      .toArray();
  }

  /**
   * Query cost centers filtered by financial center
   * @param userId - User ID
   * @param financialCenterId - Financial center ID to filter by (can be null for no filter)
   * @param includeGlobal - Include global cost centers (default: true)
   * @returns Filtered cost centers
   */
  async queryFilteredCostCenters(
    userId: number,
    financialCenterId: number | null,
    includeGlobal: boolean = true
  ): Promise<LocalCostCenter[]> {
    logger.debug('[DexieManager] queryFilteredCostCenters', {
      userId,
      financialCenterId,
      includeGlobal
    });

    // Get all user's cost centers
    const allCenters = await this.queryCostCenters(userId);

    // Filter by financial center if specified
    if (financialCenterId !== null) {
      return allCenters.filter(center => {
        // Include if matches financial center
        if (center.financial_center_id === financialCenterId) {
          return true;
        }
        // Include global cost centers if requested
        if (includeGlobal && center.financial_center_id === null) {
          return true;
        }
        return false;
      });
    }

    // No filter specified (null), return all
    return allCenters;
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

    await this.getDB().budgetFacts.add(factWithCents);

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

    await this.getDB().budgetFacts.where('temp_id').equals(temp_id).modify(updatesWithCents);
    logger.info('[DexieManager] ✅ Fact updated', { temp_id });
  }

  /**
   * Delete budget fact (soft delete) по temp_id
   */
  async deleteFact(temp_id: string): Promise<void> {
    logger.debug('[DexieManager] deleteFact', { temp_id });

    await this.getDB().budgetFacts.where('temp_id').equals(temp_id).modify({ sync_status: 'deleted' });
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
      results = await this.getDB().budgetFacts
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
      results = await this.getDB().budgetFacts.toArray();
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
      await this.getDB().budgetFacts.bulkAdd(batch);

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
    await this.getDB().articles.bulkAdd(articles);
    if (onProgress) onProgress(articles.length, articles.length);
  }

  /**
   * Bulk insert financial centers
   */
  async bulkInsertFinancialCenters(centers: LocalFinancialCenter[], onProgress?: ProgressCallback): Promise<void> {
    logger.info('[DexieManager] bulkInsertFinancialCenters', { count: centers.length });
    await this.getDB().financialCenters.bulkAdd(centers);
    if (onProgress) onProgress(centers.length, centers.length);
  }

  /**
   * Bulk insert cost centers
   */
  async bulkInsertCostCenters(centers: LocalCostCenter[], onProgress?: ProgressCallback): Promise<void> {
    logger.info('[DexieManager] bulkInsertCostCenters', { count: centers.length });
    await this.getDB().costCenters.bulkAdd(centers);
    if (onProgress) onProgress(centers.length, centers.length);
  }

  /**
   * Bulk insert article hierarchy
   */
  async bulkInsertHierarchy(hierarchy: LocalArticleHierarchy[], onProgress?: ProgressCallback): Promise<void> {
    logger.info('[DexieManager] bulkInsertHierarchy', { count: hierarchy.length });
    await this.getDB().articleHierarchy.bulkAdd(hierarchy);
    if (onProgress) onProgress(hierarchy.length, hierarchy.length);
  }

  /**
   * Bulk update facts
   */
  async bulkUpdateFacts(facts: Partial<LocalBudgetFact>[]): Promise<void> {
    logger.info('[DexieManager] bulkUpdateFacts', { count: facts.length });
    await this.getDB().budgetFacts.bulkPut(facts as LocalBudgetFact[]);
  }

  /**
   * Bulk soft delete facts
   */
  async bulkSoftDeleteFacts(temp_ids: string[]): Promise<void> {
    logger.info('[DexieManager] bulkSoftDeleteFacts', { count: temp_ids.length });
    const db = this.getDB();
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

    const pending = await this.getDB().budgetFacts
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

    await this.getDB().budgetFacts
      .where('temp_id').equals(tempId)
      .modify({ id: serverId, sync_status: 'synced' });

    logger.info('[DexieManager] ✅ Operation confirmed', { tempId, serverId });
  }

  /**
   * Get sync metadata for entity type
   */
  async getSyncMetadata(entityType: string): Promise<LocalSyncMetadata | undefined> {
    logger.debug('[DexieManager] getSyncMetadata', { entityType });

    return await this.getDB().syncMetadata.get(entityType);
  }

  /**
   * Update sync metadata
   */
  async updateSyncMetadata(metadata: LocalSyncMetadata): Promise<void> {
    logger.debug('[DexieManager] updateSyncMetadata', metadata);

    await this.getDB().syncMetadata.put(metadata);
    logger.info('[DexieManager] ✅ Sync metadata updated', { entityType: metadata.entity_type });
  }

  /**
   * Sync reference data from server
   * Wrapper for initialReferenceSync - syncs Articles, Financial Centers, Cost Centers, Article Hierarchy
   *
   * @param userId - User ID for syncing (optional - will auto-detect from window.userData or window.user)
   * @throws Error if sync fails or userId cannot be determined
   */
  async syncReferenceData(userId?: number): Promise<void> {
    logger.debug('[DexieManager] syncReferenceData', { userId });

    // If userId not provided, try to get from session context
    let effectiveUserId = userId;

    if (!effectiveUserId) {
      // Try window.userData.id (primary)
      if (typeof window !== 'undefined' && (window as any).userData?.id) {
        effectiveUserId = (window as any).userData.id;
        logger.debug('[DexieManager] Using userId from window.userData', { userId: effectiveUserId });
      }
      // Fallback: window.user.id
      else if (typeof window !== 'undefined' && (window as any).user?.id) {
        effectiveUserId = (window as any).user.id;
        logger.debug('[DexieManager] Using userId from window.user', { userId: effectiveUserId });
      }
      // No userId available
      else {
        throw new Error(
          '[DexieManager] userId required for syncReferenceData. ' +
          'Could not auto-detect from window.userData or window.user. ' +
          'Please provide userId parameter explicitly.'
        );
      }
    }

    // TypeScript type guard: ensure effectiveUserId is defined
    if (!effectiveUserId) {
      throw new Error('[DexieManager] Internal error: userId is undefined after resolution');
    }

    const historyMonths = this.getSyncPeriodPlansHistory?.() ?? this.getSyncPeriodMonths?.() ?? 3;
    const futureMonths = this.getSyncPeriodPlansFuture?.() ?? this.getSyncPeriodMonths?.() ?? 3;
    const result = await initialReferenceSync(effectiveUserId, historyMonths, futureMonths);

    if (!result.success) {
      const failedSyncs = Object.entries(result.results)
        .filter(([, r]) => !r.success)
        .map(([name]) => name);

      throw new Error(
        `[DexieManager] Reference data sync failed for: ${failedSyncs.join(', ')}. ` +
        `Details: ${JSON.stringify(result.results)}`
      );
    }

    logger.info('[DexieManager] ✅ Reference data synced', {
      userId: effectiveUserId,
      counts: {
        articles: result.results.articles.count,
        financialCenters: result.results.financialCenters.count,
        costCenters: result.results.costCenters.count,
        articleHierarchy: result.results.articleHierarchy.count,
        // Non-critical syncs (for debugging/visibility)
        recurringPlans: result.results.recurringPlans.count,
        shoppingLists: result.results.shoppingLists.count
      }
    });
  }

  /**
   * Sync articles from server
   * Wrapper for syncArticles operation
   *
   * @param userId - User ID for syncing
   * @returns Sync result with count
   */
  async syncArticles(userId: number): Promise<{ success: boolean; count: number }> {
    logger.debug('[DexieManager] syncArticles', { userId });
    return await syncArticles(userId);
  }

  /**
   * Sync financial centers from server
   * Wrapper for syncFinancialCenters operation
   *
   * @param userId - User ID for syncing
   * @returns Sync result with count
   */
  async syncFinancialCenters(userId: number): Promise<{ success: boolean; count: number }> {
    logger.debug('[DexieManager] syncFinancialCenters', { userId });
    return await syncFinancialCenters(userId);
  }

  /**
   * Sync cost centers from server
   * Wrapper for syncCostCenters operation
   *
   * @param userId - User ID for syncing
   * @returns Sync result with count
   */
  async syncCostCenters(userId: number): Promise<{ success: boolean; count: number }> {
    logger.debug('[DexieManager] syncCostCenters', { userId });
    return await syncCostCenters(userId);
  }

  /**
   * Sync recurring plans from server (v11.5.0+)
   * Wrapper for syncRecurringPlans operation
   *
   * @param userId - User ID for syncing
   * @param syncPeriodMonths - Number of months to sync (default: 3)
   * @returns Sync result with count
   */
  async syncRecurringPlans(userId: number): Promise<{ success: boolean; count: number }> {
    logger.debug('[DexieManager] syncRecurringPlans', { userId });
    return await syncRecurringPlans(userId);
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
      results = await this.getDB().recurringPlans
        .where('user_id')
        .equals(filters.user_id)
        .toArray();
    } else {
      results = await this.getDB().recurringPlans.toArray();
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

    const id = await this.getDB().recurringPlans.add(newPlan);
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

    const plan = await this.getDB().recurringPlans.get(id);

    if (!plan) {
      throw new Error(`[DexieManager] Recurring plan not found: ${id}`);
    }

    // Convert amount to cents if provided
    const updateData = { ...updates };
    if (updateData.amount !== undefined) {
      updateData.amount = toCents(updateData.amount);
    }

    await this.getDB().recurringPlans.update(id, updateData);
    logger.info('[DexieManager] ✅ Recurring plan updated', { id });
  }

  /**
   * Delete recurring plan
   */
  async deleteRecurringPlan(id: number): Promise<void> {
    logger.debug('[DexieManager] deleteRecurringPlan', { id });

    await this.getDB().recurringPlans.delete(id);
    logger.info('[DexieManager] ✅ Recurring plan deleted', { id });
  }

  /**
   * Get single recurring plan by id
   */
  async getRecurringPlan(id: number): Promise<LocalRecurringPlan | undefined> {
    logger.debug('[DexieManager] getRecurringPlan', { id });

    const plan = await this.getDB().recurringPlans.get(id);

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
    const db = this.getDB();
    await db.transaction('rw', db.recurringPlans, async () => {
      await db.recurringPlans.clear();
      await db.recurringPlans.bulkAdd(plansWithCents);
    });

    logger.info('[DexieManager] ✅ Recurring plans synced', { count: plans.length });
  }

  // ============================================================
  // SHOPPING LISTS (Placeholder - будет реализовано в operations/)
  // ============================================================

  /**
   * Query shopping lists with optional filters
   *
   * Fixes: "Failed to execute 'bound' on 'IDBKeyRange': The parameter is not a valid key"
   * Previous signature: queryShoppingLists(userId: number) - incompatible with DataLayer.getShoppingLists(filters)
   *
   * @param filters - Optional filters for is_active and sync_status
   * @returns Filtered shopping lists sorted by created_at desc
   */
  async queryShoppingLists(filters?: ShoppingListFilters): Promise<LocalShoppingList[]> {
    const db = this.getDB();
    let results = await db.shoppingLists.toArray();

    if (filters) {
      results = results.filter(list => {
        if (filters.is_active !== undefined && list.is_active !== filters.is_active) return false;
        if (filters.sync_status && list.sync_status !== filters.sync_status) return false;
        return true;
      });
    }

    // Sort by created_at descending (newest first)
    return results.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
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

    await this.getDB().shoppingLists.add(newList);
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
      plans: number;            // regular plans (record_type='plan') from budgetFacts
      recurringPlans: number;   // recurring plans from recurringPlans table (v11.6.1+)
      stores: number;           // v11.4.2+
      productGroups: number;    // v11.4.2+
      shoppingLists: number;    // v11.4.2+
      shoppingListItems: number; // added in getDiagnosticData
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
    syncPeriod: {
      facts: number;
      plans: number;
      plansHistory: number;
      plansFuture: number;
    };
  }> {
    const articlesCount = await this.getDB().articles.count();
    const factsCount = await this.getDB().budgetFacts.count();
    const plansCount = await this.getDB().budgetFacts.where('record_type').equals('plan').count();
    const shoppingListsCount = await this.getDB().shoppingLists.count();
    const shoppingListItemsCount = await this.getDB().shoppingListItems.count();
    const financialCentersCount = await this.getDB().financialCenters.count();
    const costCentersCount = await this.getDB().costCenters.count();
    const recurringPlansCount = await this.getDB().recurringPlans.count();
    const storesCount = await this.getDB().stores.count();
    const productGroupsCount = await this.getDB().productGroups.count();

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
        plans: plansCount,              // regular plans (record_type='plan') from budgetFacts
        recurringPlans: recurringPlansCount, // from recurringPlans table (v11.6.1+)
        stores: storesCount,
        productGroups: productGroupsCount,
        shoppingLists: shoppingListsCount,
        shoppingListItems: shoppingListItemsCount
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
      },
      syncPeriod: {
        facts: this.getSyncPeriodDays(),
        plans: this.getSyncPeriodMonths(),
        plansHistory: this.getSyncPeriodPlansHistory(),
        plansFuture: this.getSyncPeriodPlansFuture()
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
   * @param retentionDays - Number of days to keep (optional, defaults to getSyncPeriodDays())
   */
  async pruneFacts(retentionDays?: number): Promise<number> {
    const days = retentionDays ?? this.getSyncPeriodDays();
    logger.debug('[DexieManager] pruneFacts', { retentionDays: days });
    return await pruneFacts(days);
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

  /**
   * Get sync period for offline data retention (v11.4.0+)
   * @returns Number of days to keep Facts in Dexie
   */
  getSyncPeriodDays(): number {
    const saved = localStorage.getItem('budget_dexie_sync_period_facts');
    if (!saved) {
      // Fallback to legacy key for backward compatibility
      const legacy = localStorage.getItem('budget_dexie_sync_period');
      return legacy ? parseInt(legacy, 10) : 90;
    }
    return parseInt(saved, 10);
  }

  /**
   * Get sync period for Plans (months) (v11.5.0+)
   * @returns Number of months to keep Plans in Dexie (1-6)
   */
  getSyncPeriodMonths(): number {
    const saved = localStorage.getItem('budget_dexie_sync_period_plans');
    return saved ? parseInt(saved, 10) : 3; // Default: 3 months
  }

  /**
   * Set sync period for Facts (days) (v11.5.0+)
   * @param days - Number of days to keep Facts (30-180)
   */
  setSyncPeriodDays(days: number): void {
    if (days < 30 || days > 180) {
      throw new Error('[DexieManager] Invalid sync period: must be 30-180 days');
    }
    localStorage.setItem('budget_dexie_sync_period_facts', days.toString());
    logger.info('[DexieManager] Facts sync period updated', { days });
  }

  /**
   * Set sync period for Plans (months) (v11.5.0+)
   * @param months - Number of months to keep Plans (1-6)
   */
  setSyncPeriodMonths(months: number): void {
    if (months < 1 || months > 6) {
      throw new Error('[DexieManager] Invalid sync period: must be 1-6 months');
    }
    localStorage.setItem('budget_dexie_sync_period_plans', months.toString());
    logger.info('[DexieManager] Plans sync period updated', { months });
  }

  /**
   * Get sync period for Plans history (months back) (v11.6.0+)
   * @returns Number of months of past plans to keep in Dexie (1-6)
   */
  getSyncPeriodPlansHistory(): number {
    const saved = localStorage.getItem('budget_dexie_sync_period_plans_history');
    if (!saved) {
      return this.getSyncPeriodMonths(); // fallback to legacy plans key
    }
    return parseInt(saved, 10);
  }

  /**
   * Set sync period for Plans history (months back) (v11.6.0+)
   * @param months - Number of months of past plans (1-6)
   */
  setSyncPeriodPlansHistory(months: number): void {
    if (months < 1 || months > 6) {
      throw new Error('[DexieManager] Invalid plans history period: must be 1-6 months');
    }
    localStorage.setItem('budget_dexie_sync_period_plans_history', months.toString());
    logger.info('[DexieManager] Plans history sync period updated', { months });
  }

  /**
   * Get sync period for Plans future (months ahead) (v11.6.0+)
   * @returns Number of months of future plans to keep in Dexie (1-6)
   */
  getSyncPeriodPlansFuture(): number {
    const saved = localStorage.getItem('budget_dexie_sync_period_plans_future');
    if (!saved) {
      return this.getSyncPeriodMonths(); // fallback to legacy plans key
    }
    return parseInt(saved, 10);
  }

  /**
   * Set sync period for Plans future (months ahead) (v11.6.0+)
   * @param months - Number of months of future plans (1-6)
   */
  setSyncPeriodPlansFuture(months: number): void {
    if (months < 1 || months > 6) {
      throw new Error('[DexieManager] Invalid plans future period: must be 1-6 months');
    }
    localStorage.setItem('budget_dexie_sync_period_plans_future', months.toString());
    logger.info('[DexieManager] Plans future sync period updated', { months });
  }

  /**
   * Query shopping list items (wrapper for shoppingOperations)
   * @param shopping_list_temp_id - Shopping list temp_id
   * @returns Promise with shopping list items
   */
  async queryShoppingListItems(shopping_list_temp_id: string): Promise<import('./types/shopping').LocalShoppingListItem[]> {
    const { queryShoppingListItems } = await import('./operations/shoppingOperations');
    return queryShoppingListItems(shopping_list_temp_id);
  }

  /**
   * Query stores with filters (wrapper for shoppingOperations)
   * @param filters - Store filters
   * @returns Promise with stores
   */
  async queryStores(filters?: import('./types/shopping').StoreFilters): Promise<import('./types/shopping').LocalStore[]> {
    const { queryStores } = await import('./operations/shoppingOperations');
    return queryStores(filters);
  }

  /**
   * Query product groups with filters (wrapper for shoppingOperations)
   * @param filters - Product group filters
   * @returns Promise with product groups
   */
  async queryProductGroups(filters?: import('./types/shopping').ProductGroupFilters): Promise<import('./types/shopping').LocalProductGroup[]> {
    const { queryProductGroups } = await import('./operations/shoppingOperations');
    return queryProductGroups(filters);
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

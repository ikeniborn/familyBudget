/**
 * PGliteManager - Main interface for PGlite database
 * Provides high-level API for database initialization, migrations, and queries
 */

import type { PGlite } from '@electric-sql/pglite';
import { initializeDatabase, closeDatabase } from './core/dbInitializer';
import { runMigrations, getSchemaVersion, isSchemaUpToDate } from './core/migrationManager';
import {
  queryArticles,
  queryFinancialCenters,
  queryCostCenters,
  queryArticleHierarchy,
  queryFilteredCostCenters,
  getSyncMetadata,
  updateSyncMetadata
} from './operations/schemaOperations';
import {
  bulkInsertArticles,
  bulkInsertFinancialCenters,
  bulkInsertCostCenters,
  bulkInsertHierarchy,
  type ProgressCallback
} from './operations/bulkOperations';
import {
  createFact,
  updateFact,
  deleteFact,
  queryFacts,
  getPendingOperations,
  bulkInsertFacts,
  bulkUpdateFacts,
  bulkSoftDeleteFacts,
  confirmPendingOperation,
  retryPendingOperation
} from './operations/factOperations';
import {
  createShoppingList,
  updateShoppingList,
  deleteShoppingList,
  queryShoppingLists,
  addItemToList,
  updateItem,
  deleteItem,
  toggleItemCompleted,
  queryShoppingListItems,
  queryStores,
  queryProductGroups,
  queryProductGroupHierarchy
} from './operations/shoppingOperations';
import {
  syncReferenceData,
  applyDeltaSync,
  getPendingShoppingOperations,
  confirmPendingShoppingOperation,
  retryPendingShoppingOperation,
  type ShoppingReferenceData,
  type ShoppingDeltaSyncResponse,
  type SyncProgressCallback
} from './operations/shoppingSync';
import {
  queryRecurringPlans,
  type RecurringPlanFilters
} from './operations/recurringOperations';
import {
  syncRecurringPlans,
  needsRecurringPlansSync,
  type SyncProgressCallback as RecurringSyncProgressCallback
} from './operations/recurringSync';
import {
  pruneOldFacts,
  getPruningStats as getPruningStatsInternal,
  calculatePotentialPruning as calculatePotentialPruningInternal,
  type PruningResult,
  type PruningStats
} from './operations/pruningOperations';
import { getState, updateState } from './core/stateManager';
import type { InitializationStatus } from './core/PGliteState';
import type { IPGliteConfig } from './types/dependencies';
import type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalArticleHierarchy,
  LocalSyncMetadata,
  LocalBudgetFact,
  LocalPendingOperation,
  LocalRecurringPlan,
  FactFilters,
  LocalShoppingList,
  LocalShoppingListItem,
  LocalStore,
  LocalProductGroup,
  LocalProductGroupHierarchy,
  ShoppingListFilters,
  ShoppingListItemFilters,
  StoreFilters,
  ProductGroupFilters
} from './types/models';
import type { CountResult, SizeResult } from './types/pglite';
import { logger } from './utils/logger';
import { ConflictManager, type ServerBudgetFact, type ConflictMetrics, type ConflictDetection } from './ConflictManager';
import { getPGliteFeatureFlags } from './features/featureFlags';

/**
 * Diagnostic data interface
 */
export interface DiagnosticData {
  isEnabled: boolean;
  isInitialized: boolean;
  initializationStatus: InitializationStatus;  // NEW: Background init status for early error detection
  dbSizeKB: number;
  lastSyncTimestamp: string;
  syncStatus: 'idle' | 'syncing' | 'error';
  tableStats: {
    articles: number;
    financial_centers: number;
    cost_centers: number;
    facts: number;
    plans: number;
  };
  performanceMetrics: {
    avgQueryTimeMs: number;
    totalQueries: number;
  };
  pruningStats?: {
    lastPrunedAt: string;
    totalPruned: number;
    nextPruneEstimate: string;  // "in 7 days" or "Never"
  };
}

/**
 * PGliteManager class
 * Main entry point for PGlite database operations
 */
export class PGliteManager {
  // Performance tracking
  private queryTimes: number[] = [];
  private readonly MAX_QUERY_TIMES = 100;

  // Conflict management (task-009)
  private conflictManager: ConflictManager | null = null;

  /**
   * Track query execution time
   *
   * @param durationMs - Query duration in milliseconds
   */
  private trackQueryTime(durationMs: number): void {
    this.queryTimes.push(durationMs);
    if (this.queryTimes.length > this.MAX_QUERY_TIMES) {
      this.queryTimes.shift(); // Keep last 100
    }
  }

  /**
   * Initialize database and run migrations
   *
   * @param config - Optional configuration
   */
  async init(config?: IPGliteConfig): Promise<void> {
    logger.info('Initializing PGliteManager...');

    try {
      // Initialize database
      const db = await initializeDatabase(config);

      // Run migrations
      const migrationsApplied = await runMigrations(db);

      // Initialize conflict manager (task-009)
      this.conflictManager = new ConflictManager(db);

      updateState({
        isInitialized: true,
        initializationStatus: 'ready'  // Set to ready after successful initialization
      });

      logger.info('PGliteManager initialized', {
        migrationsApplied,
        schemaVersion: await getSchemaVersion(db)
      });
    } catch (error) {
      logger.error('Failed to initialize PGliteManager', error);
      throw error;
    }
  }

  /**
   * Initialize ConflictManager for background initialization flow
   * Called from dbInitializer.ts after database and migrations are ready
   */
  initializeConflictManager(): void {
    const state = getState();
    const { db } = state;

    if (!db) {
      throw new Error('[PGLITE] Cannot initialize ConflictManager: database not initialized');
    }

    if (this.conflictManager) {
      logger.info('[CONFLICT_MANAGER] Already initialized, skipping');
      return;
    }

    this.conflictManager = new ConflictManager(db);
    logger.info('[CONFLICT_MANAGER] Initialized successfully');
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    const { db } = getState();

    if (!db) {
      logger.warn('Database not initialized, nothing to close');
      return;
    }

    await closeDatabase(db);
    logger.info('PGliteManager closed');
  }

  /**
   * Check if database is ready for operations
   *
   * @returns True if database is initialized and in ready/active state
   */
  isReady(): boolean {
    const state = getState();
    // Use initializationStatus instead of connectionStatus (marked as deprecated)
    // connectionStatus kept for backward compatibility (PGliteState.ts:28)
    return state.isInitialized &&
           (state.initializationStatus === 'ready' || state.initializationStatus === 'active');
  }

  /**
   * Get current database instance
   *
   * @returns PGlite instance or null
   */
  getDatabase(): PGlite | null {
    return getState().db;
  }

  /**
   * Get current schema version
   *
   * @returns Schema version number
   */
  async getSchemaVersion(): Promise<number> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await getSchemaVersion(db);
  }

  /**
   * Check if schema is up to date
   *
   * @returns True if schema is current
   */
  async isSchemaUpToDate(): Promise<boolean> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await isSchemaUpToDate(db);
  }

  // === Query Methods ===

  /**
   * Query articles with filters
   *
   * @param filters - Optional filters (user_id, type, parent_id, is_active)
   * @returns Array of articles
   */
  async queryArticles(filters?: {
    user_id?: number;
    type?: 'income' | 'expense' | 'debit' | 'credit';
    parent_id?: number | null;
    is_active?: boolean;
  }): Promise<LocalArticle[]> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await queryArticles(db, filters);
  }

  /**
   * Query financial centers for a user
   *
   * @param user_id - User ID
   * @param is_active - Optional filter for active centers
   * @returns Array of financial centers
   */
  async queryFinancialCenters(
    user_id: number,
    is_active?: boolean
  ): Promise<LocalFinancialCenter[]> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await queryFinancialCenters(db, user_id, is_active);
  }

  /**
   * Query cost centers for a user
   *
   * @param user_id - User ID
   * @param is_active - Optional filter for active centers
   * @returns Array of cost centers
   */
  async queryCostCenters(
    user_id: number,
    is_active?: boolean
  ): Promise<LocalCostCenter[]> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await queryCostCenters(db, user_id, is_active);
  }

  /**
   * Query article hierarchy using closure table
   *
   * @param article_id - Article ID to get hierarchy for
   * @returns Array of hierarchy records (ancestor-descendant pairs)
   */
  async queryArticleHierarchy(article_id: number): Promise<LocalArticleHierarchy[]> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await queryArticleHierarchy(db, article_id);
  }

  /**
   * Query cost centers filtered by financial center
   *
   * @param user_id - User ID
   * @param financial_center_id - Financial center ID to filter by (null = no filter)
   * @param is_active - Optional filter for active centers
   * @returns Array of cost centers
   */
  async queryFilteredCostCenters(
    user_id: number,
    financial_center_id: number | null,
    is_active?: boolean
  ): Promise<LocalCostCenter[]> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await queryFilteredCostCenters(db, user_id, financial_center_id, is_active);
  }

  // === Fact Operations (Phase 2) ===

  /**
   * Create budget fact (offline-first)
   *
   * @param fact - Partial fact data
   * @returns temp_id (UUID)
   */
  async createFact(
    fact: Omit<LocalBudgetFact, 'id' | 'temp_id' | 'sync_status' | 'content_hash' | 'created_at' | 'updated_at' | 'synced_at'>
  ): Promise<string> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await createFact(db, fact);
  }

  /**
   * Update budget fact
   *
   * @param temp_id - Fact temp_id
   * @param updates - Partial fact data to update
   */
  async updateFact(
    temp_id: string,
    updates: Partial<Pick<LocalBudgetFact, 'date' | 'amount' | 'article_id' | 'financial_center_id' | 'cost_center_id' | 'comment'>>
  ): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await updateFact(db, temp_id, updates);
  }

  /**
   * Delete budget fact (soft delete)
   *
   * @param temp_id - Fact temp_id
   */
  async deleteFact(temp_id: string): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await deleteFact(db, temp_id);
  }

  /**
   * Query budget facts with filters and data window
   *
   * @param filters - Optional filters
   * @returns Array of budget facts
   */
  async queryFacts(filters?: FactFilters): Promise<LocalBudgetFact[]> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await queryFacts(db, filters);
  }

  /**
   * Get pending operations queue
   *
   * @returns Array of pending operations
   */
  async getPendingOperations(): Promise<LocalPendingOperation[]> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await getPendingOperations(db);
  }

  /**
   * Bulk insert facts from server (incremental sync - created)
   *
   * @param facts - Array of server facts (must have id)
   */
  async bulkInsertFacts(
    facts: Array<Omit<LocalBudgetFact, 'temp_id'> & { id: number }>
  ): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await bulkInsertFacts(db, facts);
  }

  /**
   * Bulk update facts from server (incremental sync - updated)
   *
   * @param facts - Array of server facts (must have id)
   */
  async bulkUpdateFacts(
    facts: Array<Omit<LocalBudgetFact, 'temp_id'> & { id: number }>
  ): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await bulkUpdateFacts(db, facts);
  }

  /**
   * Bulk soft delete facts (incremental sync - deleted)
   *
   * @param factIds - Array of server fact IDs to delete
   */
  async bulkSoftDeleteFacts(factIds: number[]): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await bulkSoftDeleteFacts(db, factIds);
  }

  /**
   * Confirm pending operation after successful server upload
   * Task-008: Client upload changes
   *
   * @param tempId - Client-generated temp_id (UUID)
   * @param serverId - Server-assigned ID
   */
  async confirmPendingOperation(tempId: string, serverId: number): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await confirmPendingOperation(db, tempId, serverId);
  }

  /**
   * Retry pending operation after upload failure
   * Task-008: Client upload changes
   *
   * @param tempId - Client-generated temp_id (UUID)
   * @param error - Error message from server
   */
  async retryPendingOperation(tempId: string, error: string): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await retryPendingOperation(db, tempId, error);
  }

  // === Sync Metadata Methods ===

  /**
   * Get sync metadata for an entity type
   *
   * @param entity_type - Entity type (articles, financial_centers, cost_centers)
   * @returns Sync metadata or null
   */
  async getSyncMetadata(entity_type: string): Promise<LocalSyncMetadata | null> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await getSyncMetadata(db, entity_type);
  }

  /**
   * Update sync metadata for an entity type
   *
   * @param entity_type - Entity type
   * @param data - Metadata to update
   */
  async updateSyncMetadata(
    entity_type: string,
    data: {
      last_sync_timestamp?: Date;
      sync_version?: number;
      total_records?: number;
    }
  ): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    await updateSyncMetadata(db, entity_type, data);
  }

  // === Bulk Insert Methods ===

  /**
   * Bulk insert articles with chunking and progress tracking
   *
   * @param articles - Articles to insert
   * @param onProgress - Optional progress callback
   */
  async bulkInsertArticles(
    articles: LocalArticle[],
    onProgress?: ProgressCallback
  ): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    await bulkInsertArticles(db, articles, onProgress);
  }

  /**
   * Bulk insert financial centers with chunking and progress tracking
   *
   * @param centers - Financial centers to insert
   * @param onProgress - Optional progress callback
   */
  async bulkInsertFinancialCenters(
    centers: LocalFinancialCenter[],
    onProgress?: ProgressCallback
  ): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    await bulkInsertFinancialCenters(db, centers, onProgress);
  }

  /**
   * Bulk insert cost centers with chunking and progress tracking
   *
   * @param centers - Cost centers to insert
   * @param onProgress - Optional progress callback
   */
  async bulkInsertCostCenters(
    centers: LocalCostCenter[],
    onProgress?: ProgressCallback
  ): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    await bulkInsertCostCenters(db, centers, onProgress);
  }

  /**
   * Bulk insert article hierarchy with chunking and progress tracking
   *
   * @param hierarchy - Article hierarchy entries to insert
   * @param onProgress - Optional progress callback
   */
  async bulkInsertHierarchy(
    hierarchy: LocalArticleHierarchy[],
    onProgress?: ProgressCallback
  ): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    await bulkInsertHierarchy(db, hierarchy, onProgress);
  }

  // === Sync Methods (task-009) ===

  /**
   * Handle incremental sync with conflict resolution
   * Task-009: Conflict Resolution LWW
   *
   * @param serverChanges - Server changes (created, updated, deleted)
   * @returns Sync result with applied/conflict/error counts
   */
  async handleSyncIncremental(serverChanges: {
    created: ServerBudgetFact[];
    updated: ServerBudgetFact[];
    deleted: number[];
  }): Promise<{
    applied: number;
    conflicts: number;
    errors: number;
  }> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');
    if (!this.conflictManager) throw new Error('[PGLITE] ConflictManager not initialized');

    // Check feature flag
    const featureFlags = getPGliteFeatureFlags();
    const enableConflictResolution = featureFlags.enableConflictResolution;

    logger.info('[PGLITE_SYNC] Starting incremental sync', {
      created: serverChanges.created.length,
      updated: serverChanges.updated.length,
      deleted: serverChanges.deleted.length,
      conflictResolution: enableConflictResolution
    });

    try {
      // Step 1-3: Detect and resolve conflicts (if enabled)
      const conflicts = enableConflictResolution
        ? await this.detectAndResolveConflicts(serverChanges, db)
        : [];

      if (!enableConflictResolution) {
        logger.info('[PGLITE_SYNC] Conflict resolution disabled, applying all server changes');
      }

      // Step 4: Apply non-conflicting changes
      const conflictIds = new Set(conflicts.map(c => c.entityId));

      const nonConflictingCreated = enableConflictResolution
        ? serverChanges.created.filter(r => !conflictIds.has(r.id as number))
        : serverChanges.created;

      const nonConflictingUpdated = enableConflictResolution
        ? serverChanges.updated.filter(r => !conflictIds.has(r.id as number))
        : serverChanges.updated;

      await this.bulkInsertFacts(nonConflictingCreated);
      await this.bulkUpdateFacts(nonConflictingUpdated);

      // Step 5: Handle deletions
      if (serverChanges.deleted.length > 0) {
        await this.bulkSoftDeleteFacts(serverChanges.deleted);
      }

      const totalApplied =
        nonConflictingCreated.length +
        nonConflictingUpdated.length +
        serverChanges.deleted.length;

      logger.info('[PGLITE_SYNC] Incremental sync completed', {
        applied: totalApplied,
        conflicts: conflicts.length,
        errors: 0
      });

      return {
        applied: totalApplied,
        conflicts: conflicts.length,
        errors: 0
      };
    } catch (error) {
      logger.error('[PGLITE_SYNC] Incremental sync failed', error);
      return {
        applied: 0,
        conflicts: 0,
        errors: 1
      };
    }
  }

  /**
   * Get conflict metrics for diagnostic UI
   * Task-009: Conflict Resolution LWW
   *
   * @returns Conflict metrics
   */
  async getConflictMetrics(): Promise<ConflictMetrics> {
    if (!this.conflictManager) {
      throw new Error('[PGLITE] ConflictManager not initialized');
    }

    return this.conflictManager.getConflictMetrics();
  }

  /**
   * Detect and resolve conflicts between local and server records.
   * Helper method to reduce nesting in handleSyncIncremental.
   *
   * @param serverChanges - Server changes
   * @param db - Database instance
   * @returns Array of detected conflicts
   */
  private async detectAndResolveConflicts(
    serverChanges: {
      created: ServerBudgetFact[];
      updated: ServerBudgetFact[];
      deleted: number[];
    },
    db: PGlite
  ): Promise<ConflictDetection[]> {
    if (!this.conflictManager) {
      return [];
    }

    // Step 1: Fetch local records for conflict check
    const allServerRecords = [...serverChanges.created, ...serverChanges.updated];
    const serverIds = allServerRecords
      .filter(r => r.id !== null)
      .map(r => r.id as number);

    const localRecords = await this.fetchLocalRecordsForConflictCheck(db, serverIds);

    // Step 2: Detect conflicts
    const conflicts = await this.conflictManager.detectConflicts(
      localRecords,
      allServerRecords
    );

    // Step 3: Resolve conflicts
    await this.resolveConflicts(conflicts);

    return conflicts;
  }

  /**
   * Fetch local records for conflict check.
   * Helper method to reduce nesting.
   *
   * @param db - Database instance
   * @param serverIds - Server IDs to fetch
   * @returns Local budget facts
   */
  private async fetchLocalRecordsForConflictCheck(
    db: PGlite,
    serverIds: number[]
  ): Promise<LocalBudgetFact[]> {
    if (serverIds.length === 0) {
      return [];
    }

    const result = await db.query(`
      SELECT * FROM local_budget_facts
      WHERE id = ANY($1) AND sync_status != 'deleted'
    `, [serverIds]);

    return result.rows as LocalBudgetFact[];
  }

  /**
   * Resolve all conflicts using ConflictManager.
   * Helper method to reduce nesting.
   *
   * @param conflicts - Detected conflicts
   */
  private async resolveConflicts(conflicts: ConflictDetection[]): Promise<void> {
    if (!this.conflictManager) {
      return;
    }

    for (const conflict of conflicts) {
      const resolution = this.conflictManager.resolveLWW(conflict);
      await this.conflictManager.logConflict(conflict, resolution);
      await this.conflictManager.applyResolution(conflict, resolution);
    }
  }

  // === Diagnostic Methods ===

  /**
   * Get diagnostic data for monitoring and debugging
   *
   * @returns Diagnostic data including DB size, table stats, and performance metrics
   */
  async getDiagnosticData(): Promise<DiagnosticData> {
    const state = getState();
    const { db } = state;
    if (!db) {
      // Return default data if not initialized
      return {
        isEnabled: false,
        isInitialized: false,
        initializationStatus: state.initializationStatus || 'not_started',
        dbSizeKB: 0,
        lastSyncTimestamp: 'Never',
        syncStatus: 'idle',
        tableStats: {
          articles: 0,
          financial_centers: 0,
          cost_centers: 0,
          facts: 0,
          plans: 0,
        },
        performanceMetrics: {
          avgQueryTimeMs: 0,
          totalQueries: 0,
        },
      };
    }

    // Track timing for diagnostic query
    const startTime = performance.now();

    try {
      // Get table counts in parallel (type-safe queries with type assertion)
      // Note: local_budget_facts contains both facts (record_type='fact') and plans (record_type='plan')
      const [articlesResult, fcResult, ccResult, factsResult, plansResult, recurringPlansResult] = await Promise.all([
        db.query('SELECT COUNT(*) as count FROM local_articles'),
        db.query('SELECT COUNT(*) as count FROM local_financial_centers'),
        db.query('SELECT COUNT(*) as count FROM local_cost_centers'),
        db.query("SELECT COUNT(*) as count FROM local_budget_facts WHERE record_type = 'fact'"),
        db.query("SELECT COUNT(*) as count FROM local_budget_facts WHERE record_type = 'plan'"),
        db.query('SELECT COUNT(*) as count FROM local_recurring_plans WHERE is_active = true'),
      ]);

      // Calculate DB size using PostgreSQL system catalog (type-safe query with type assertion)
      const sizeResult = await db.query('SELECT pg_database_size(current_database()) as size_bytes');
      const dbSizeKB = Math.round((sizeResult.rows[0] as SizeResult).size_bytes / 1024);

      // Get sync metadata
      const syncMeta = await this.getSyncMetadata('articles');

      // Calculate average query time
      const avgQueryTime =
        this.queryTimes.length > 0
          ? this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length
          : 0;

      const endTime = performance.now();
      this.trackQueryTime(endTime - startTime);

      // Get pruning stats (task-010)
      let pruningStats;
      try {
        const stats = await this.getPruningStats();
        const flags = getPGliteFeatureFlags();

        pruningStats = {
          lastPrunedAt: stats.lastPrunedAt || 'Never',
          totalPruned: stats.totalPruned,
          nextPruneEstimate: flags.enableAutoPruning ? 'in 7 days' : 'Never'
        };
      } catch (error) {
        logger.warn('[DIAGNOSTIC] Failed to get pruning stats', error);
      }

      const state = getState();

      // Map connectionStatus to syncStatus for diagnostics
      let syncStatus: 'idle' | 'syncing' | 'error';
      if (state.connectionStatus === 'error') {
        syncStatus = 'error';
      } else if (state.connectionStatus === 'syncing') {
        syncStatus = 'syncing';
      } else {
        syncStatus = 'idle'; // connected, disconnected, connecting → idle (no active sync)
      }

      // Combine plans from local_budget_facts and recurring plans templates
      const totalPlans = (plansResult.rows[0] as CountResult).count + (recurringPlansResult.rows[0] as CountResult).count;

      return {
        isEnabled: true,
        isInitialized: this.isReady(),
        initializationStatus: state.initializationStatus || 'not_started',
        dbSizeKB,
        lastSyncTimestamp: syncMeta?.last_sync_timestamp
          ? new Date(syncMeta.last_sync_timestamp).toLocaleString('ru-RU')
          : 'Never',
        syncStatus,
        tableStats: {
          articles: (articlesResult.rows[0] as CountResult).count,
          financial_centers: (fcResult.rows[0] as CountResult).count,
          cost_centers: (ccResult.rows[0] as CountResult).count,
          facts: (factsResult.rows[0] as CountResult).count,
          plans: totalPlans,
        },
        performanceMetrics: {
          avgQueryTimeMs: Math.round(avgQueryTime * 100) / 100, // 2 decimal places
          totalQueries: this.queryTimes.length,
        },
        pruningStats
      };
    } catch (error) {
      logger.error('Failed to get diagnostic data', error);
      throw new Error('[PGLITE] Failed to get diagnostic data');
    }
  }

  // === Shopping List Methods (task-012) ===

  /**
   * Create shopping list (offline-first)
   *
   * @param list - Shopping list data
   * @returns temp_id (UUID)
   */
  async createShoppingList(
    list: Omit<LocalShoppingList, 'id' | 'temp_id' | 'sync_status' | 'sync_hash' | 'content_hash' | 'created_at' | 'updated_at' | 'synced_at'>
  ): Promise<string> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await createShoppingList(db, list);
  }

  /**
   * Update shopping list
   *
   * @param temp_id - List temp_id
   * @param updates - Fields to update
   */
  async updateShoppingList(
    temp_id: string,
    updates: Partial<Pick<LocalShoppingList, 'name' | 'description' | 'is_active'>>
  ): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await updateShoppingList(db, temp_id, updates);
  }

  /**
   * Delete shopping list (CASCADE soft delete items)
   *
   * @param temp_id - List temp_id
   */
  async deleteShoppingList(temp_id: string): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await deleteShoppingList(db, temp_id);
  }

  /**
   * Query shopping lists with filters
   *
   * @param filters - Optional filters
   * @returns Array of shopping lists
   */
  async queryShoppingLists(filters?: ShoppingListFilters): Promise<LocalShoppingList[]> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await queryShoppingLists(db, filters);
  }

  /**
   * Add item to shopping list (offline-first)
   *
   * @param item - Shopping list item data
   * @returns temp_id (UUID)
   */
  async addItemToList(
    item: Omit<LocalShoppingListItem, 'id' | 'temp_id' | 'sync_status' | 'sync_hash' | 'content_hash' | 'version' | 'deleted_at' | 'last_modified_by' | 'created_at' | 'updated_at' | 'synced_at' | 'is_completed' | 'completed_at'>
  ): Promise<string> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await addItemToList(db, item);
  }

  /**
   * Update shopping list item
   *
   * @param temp_id - Item temp_id
   * @param updates - Fields to update
   */
  async updateItem(
    temp_id: string,
    updates: Partial<Pick<LocalShoppingListItem, 'product_name' | 'quantity' | 'unit' | 'comment' | 'store_id' | 'product_group_id'>>
  ): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await updateItem(db, temp_id, updates);
  }

  /**
   * Delete shopping list item (soft delete)
   *
   * @param temp_id - Item temp_id
   */
  async deleteItem(temp_id: string): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await deleteItem(db, temp_id);
  }

  /**
   * Toggle item completion status
   *
   * @param temp_id - Item temp_id
   * @param is_completed - New completion status
   */
  async toggleItemCompleted(temp_id: string, is_completed: boolean): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await toggleItemCompleted(db, temp_id, is_completed);
  }

  /**
   * Query shopping list items with filters
   *
   * @param filters - Optional filters
   * @returns Array of shopping list items
   */
  async queryShoppingListItems(filters?: ShoppingListItemFilters): Promise<LocalShoppingListItem[]> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await queryShoppingListItems(db, filters);
  }

  /**
   * Query stores (reference data)
   *
   * @param filters - Optional filters
   * @returns Array of stores
   */
  async queryStores(filters?: StoreFilters): Promise<LocalStore[]> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await queryStores(db, filters);
  }

  /**
   * Query product groups (reference data)
   *
   * @param filters - Optional filters
   * @returns Array of product groups
   */
  async queryProductGroups(filters?: ProductGroupFilters): Promise<LocalProductGroup[]> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await queryProductGroups(db, filters);
  }

  /**
   * Query product group hierarchy (descendants of a product group)
   *
   * @param product_group_id - Ancestor product group ID
   * @returns Array of hierarchy records
   */
  async queryProductGroupHierarchy(product_group_id: number): Promise<LocalProductGroupHierarchy[]> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await queryProductGroupHierarchy(db, product_group_id);
  }

  // === Shopping List Sync Methods (task-012) ===

  /**
   * Sync reference data from server (initial sync)
   *
   * Downloads stores, product groups, and hierarchy from server
   * and bulk inserts into PGlite. Reference data is read-only on client.
   *
   * **Use case:** First-time sync or periodic full refresh
   *
   * **Example:**
   * ```typescript
   * const response = await fetch('/api/v1/sync/shopping-reference');
   * const referenceData = await response.json();
   * await pgliteManager.syncShoppingReferenceData(referenceData, (progress) => {
   *   debugLog(`${progress.phase}: ${progress.message}`);
   * });
   * ```
   *
   * @param referenceData - Reference data from server (stores, product_groups, hierarchy)
   * @param onProgress - Optional progress callback for UI updates
   * @throws Error if database not initialized
   * @see {@link ShoppingReferenceData} for data structure
   */
  async syncShoppingReferenceData(
    referenceData: ShoppingReferenceData,
    onProgress?: SyncProgressCallback
  ): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await syncReferenceData(db, referenceData, onProgress);
  }

  /**
   * Apply delta sync changes to PGlite (incremental sync)
   *
   * Handles created, updated, and deleted records with LWW conflict resolution.
   * Compares server and local timestamps to resolve conflicts.
   *
   * **Use case:** Background sync after initial load
   *
   * **Example:**
   * ```typescript
   * const lastSync = await pgliteManager.getSyncMetadata('shopping_lists');
   * const response = await fetch(
   *   `/api/v1/sync/shopping-lists/delta?since=${lastSync.last_sync_timestamp}`
   * );
   * const delta = await response.json();
   * const conflicts = await pgliteManager.applyShoppingDeltaSync(delta);
   * debugLog(`Applied changes with ${conflicts} conflicts`);
   * ```
   *
   * @param delta - Delta sync response from server (created/updated/deleted)
   * @param onProgress - Optional progress callback for UI updates
   * @returns Number of conflicts detected (resolved via LWW strategy)
   * @throws Error if database not initialized
   * @see {@link ShoppingDeltaSyncResponse} for data structure
   */
  async applyShoppingDeltaSync(
    delta: ShoppingDeltaSyncResponse,
    onProgress?: SyncProgressCallback
  ): Promise<number> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await applyDeltaSync(db, delta, undefined, onProgress);
  }

  /**
   * Get pending shopping operations ready for upload
   *
   * Retrieves all pending shopping list and item operations
   * that haven't exceeded max retry attempts (default: 3).
   *
   * **Use case:** Upload offline changes to server
   *
   * **Example:**
   * ```typescript
   * const pending = await pgliteManager.getPendingShoppingOperations();
   * for (const batch of chunk(pending, 100)) {
   *   const response = await fetch('/api/v1/shopping-list-items/sync/batch', {
   *     method: 'POST',
   *     body: JSON.stringify({ operations: batch })
   *   });
   *   const result = await response.json();
   *   // Confirm successful operations
   *   for (const res of result.results) {
   *     if (res.status === 'success') {
   *       await pgliteManager.confirmPendingShoppingOperation(
   *         res.temp_id, res.server_id, 'shopping_list_item'
   *       );
   *     }
   *   }
   * }
   * ```
   *
   * @returns Array of pending operations (shopping_list and shopping_list_item)
   * @throws Error if database not initialized
   * @see {@link LocalPendingOperation} for operation structure
   */
  async getPendingShoppingOperations(): Promise<LocalPendingOperation[]> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await getPendingShoppingOperations(db);
  }

  /**
   * Confirm successful upload of pending shopping operation
   *
   * Updates local record with server-assigned ID and marks as synced.
   * Removes operation from pending queue.
   *
   * **Use case:** After successful server upload
   *
   * **Example:**
   * ```typescript
   * // After successful POST /api/v1/shopping-lists
   * const response = await fetch('/api/v1/shopping-lists', {
   *   method: 'POST',
   *   body: JSON.stringify({ temp_id: 'uuid-123', name: 'My List' })
   * });
   * const result = await response.json();
   * await pgliteManager.confirmPendingShoppingOperation(
   *   'uuid-123',
   *   result.id,
   *   'shopping_list'
   * );
   * ```
   *
   * @param tempId - Client-generated temp_id (UUID)
   * @param serverId - Server-assigned ID from response
   * @param entityType - Entity type ('shopping_list' or 'shopping_list_item')
   * @throws Error if database not initialized
   */
  async confirmPendingShoppingOperation(
    tempId: string,
    serverId: number,
    entityType: 'shopping_list' | 'shopping_list_item'
  ): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await confirmPendingShoppingOperation(db, tempId, serverId, entityType);
  }

  /**
   * Retry failed pending shopping operation
   *
   * Increments attempts counter and updates error message.
   * Operation will be retried on next sync if attempts < max_attempts.
   *
   * **Use case:** After upload failure (network error, validation error)
   *
   * **Example:**
   * ```typescript
   * try {
   *   const response = await fetch('/api/v1/shopping-lists', {
   *     method: 'POST',
   *     body: JSON.stringify({ temp_id: 'uuid-123', name: 'My List' })
   *   });
   *   // ... confirm success
   * } catch (error) {
   *   // Retry later
   *   await pgliteManager.retryPendingShoppingOperation(
   *     'uuid-123',
   *     error.message
   *   );
   * }
   * ```
   *
   * @param tempId - Client-generated temp_id (UUID)
   * @param error - Error message from server or network
   * @throws Error if database not initialized
   */
  async retryPendingShoppingOperation(
    tempId: string,
    error: string
  ): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await retryPendingShoppingOperation(db, tempId, error);
  }

  // === Recurring Plans Methods (task-015) ===

  /**
   * Query recurring plans with filters
   *
   * Recurring plans are read-only reference data cached locally.
   * Write operations (create/update/delete) go directly to API.
   *
   * **Use case:** Load recurring plans for UI display
   *
   * **Example:**
   * ```typescript
   * const activePlans = await pgliteManager.queryRecurringPlans({
   *   user_id: 1,
   *   is_active: true
   * });
   * ```
   *
   * @param filters - Optional filters (user_id, article_id, is_active, etc.)
   * @returns Array of recurring plans
   * @throws Error if database not initialized
   * @see {@link RecurringPlanFilters} for available filters
   */
  async queryRecurringPlans(filters?: RecurringPlanFilters): Promise<LocalRecurringPlan[]> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await queryRecurringPlans(db, filters);
  }

  /**
   * Sync recurring plans from server (full sync)
   *
   * Downloads all recurring plans and bulk inserts into PGlite.
   * Uses UPSERT to handle duplicate syncs.
   *
   * **Use case:** Initial sync or periodic refresh (recommended: 24 hours)
   *
   * **Example:**
   * ```typescript
   * const response = await fetch('/api/v1/recurring-plans');
   * const plans = await response.json();
   * await pgliteManager.syncRecurringPlans(plans, (progress) => {
   *   debugLog(`${progress.phase}: ${progress.message}`);
   * });
   * ```
   *
   * @param plans - Recurring plans from server
   * @param onProgress - Optional progress callback for UI updates
   * @throws Error if database not initialized
   */
  async syncRecurringPlans(
    plans: LocalRecurringPlan[],
    onProgress?: RecurringSyncProgressCallback
  ): Promise<void> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await syncRecurringPlans(db, plans, onProgress);
  }

  /**
   * Check if recurring plans need sync
   *
   * Returns true if:
   * - No sync metadata exists
   * - Last sync was more than 24 hours ago
   * - Total records count is 0
   *
   * **Use case:** Decide whether to trigger background sync
   *
   * **Example:**
   * ```typescript
   * if (await pgliteManager.needsRecurringPlansSync()) {
   *   const plans = await fetchRecurringPlans();
   *   await pgliteManager.syncRecurringPlans(plans);
   * }
   * ```
   *
   * @returns True if sync needed
   * @throws Error if database not initialized
   */
  async needsRecurringPlansSync(): Promise<boolean> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await needsRecurringPlansSync(db);
  }

  // === Pruning Methods (task-010) ===

  /**
   * Prune old synced facts beyond retention window
   *
   * @param retentionDays - Override default retention (optional)
   * @returns Pruning result with deleted count and DB size metrics
   */
  async pruneFacts(retentionDays?: number): Promise<PruningResult> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await pruneOldFacts(db, retentionDays);
  }

  /**
   * Get pruning statistics for diagnostic UI
   *
   * @returns Pruning stats (last pruned, total pruned)
   */
  async getPruningStats(): Promise<PruningStats> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await getPruningStatsInternal(db);
  }

  /**
   * Calculate potential pruning impact (dry-run)
   *
   * @param retentionDays - Retention window to test
   * @returns Number of records that would be deleted
   */
  async calculatePotentialPruning(retentionDays: number): Promise<number> {
    const { db } = getState();
    if (!db) throw new Error('[PGLITE] Database not initialized');

    return await calculatePotentialPruningInternal(db, retentionDays);
  }
}

// Singleton instance (optional, can be created manually)
let instance: PGliteManager | null = null;

/**
 * Get singleton PGliteManager instance
 *
 * @returns PGliteManager instance
 */
export function getPGliteManager(): PGliteManager {
  if (!instance) {
    instance = new PGliteManager();
  }
  return instance;
}

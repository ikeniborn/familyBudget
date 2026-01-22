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
  queryFacts,
  getPendingOperations,
  bulkInsertFacts,
  bulkUpdateFacts,
  bulkSoftDeleteFacts,
  confirmPendingOperation,
  retryPendingOperation
} from './operations/factOperations';
import {
  pruneOldFacts,
  getPruningStats as getPruningStatsInternal,
  calculatePotentialPruning as calculatePotentialPruningInternal,
  type PruningResult,
  type PruningStats
} from './operations/pruningOperations';
import { getState, updateState, isConnected } from './core/stateManager';
import type { IPGliteConfig } from './types/dependencies';
import type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalArticleHierarchy,
  LocalSyncMetadata,
  LocalBudgetFact,
  LocalPendingOperation,
  FactFilters
} from './types/models';
import type { CountResult, SizeResult } from './types/pglite';
import { logger } from './utils/logger';
import { ConflictManager, type ServerBudgetFact, type ConflictMetrics } from './ConflictManager';
import { getPGliteFeatureFlags } from './features/featureFlags';

/**
 * Diagnostic data interface
 */
export interface DiagnosticData {
  isEnabled: boolean;
  isInitialized: boolean;
  dbSizeKB: number;
  lastSyncTimestamp: string;
  syncStatus: 'idle' | 'syncing' | 'error';
  tableStats: {
    articles: number;
    financial_centers: number;
    cost_centers: number;
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

      updateState({ isInitialized: true });

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
   * @returns True if database is initialized and connected
   */
  isReady(): boolean {
    const state = getState();
    return state.isInitialized && isConnected();
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
    type?: 'income' | 'expense';
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
  ): Promise<any[]> {
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
  private async resolveConflicts(conflicts: any[]): Promise<void> {
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
    const { db } = getState();
    if (!db) {
      // Return default data if not initialized
      return {
        isEnabled: false,
        isInitialized: false,
        dbSizeKB: 0,
        lastSyncTimestamp: 'Never',
        syncStatus: 'idle',
        tableStats: {
          articles: 0,
          financial_centers: 0,
          cost_centers: 0,
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
      const [articlesResult, fcResult, ccResult] = await Promise.all([
        db.query('SELECT COUNT(*) as count FROM local_articles'),
        db.query('SELECT COUNT(*) as count FROM local_financial_centers'),
        db.query('SELECT COUNT(*) as count FROM local_cost_centers'),
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

      return {
        isEnabled: true,
        isInitialized: this.isReady(),
        dbSizeKB,
        lastSyncTimestamp: syncMeta?.last_sync_timestamp
          ? new Date(syncMeta.last_sync_timestamp).toLocaleString('ru-RU')
          : 'Never',
        syncStatus: 'idle', // TODO: track sync state
        tableStats: {
          articles: (articlesResult.rows[0] as CountResult).count,
          financial_centers: (fcResult.rows[0] as CountResult).count,
          cost_centers: (ccResult.rows[0] as CountResult).count,
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

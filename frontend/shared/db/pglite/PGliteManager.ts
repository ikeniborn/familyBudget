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
import { getState, updateState, isConnected } from './core/stateManager';
import type { IPGliteConfig } from './types/dependencies';
import type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalArticleHierarchy,
  LocalSyncMetadata
} from './types/models';
import { logger } from './utils/logger';

/**
 * PGliteManager class
 * Main entry point for PGlite database operations
 */
export class PGliteManager {
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

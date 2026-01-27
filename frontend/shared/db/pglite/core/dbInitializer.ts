/**
 * Database initialization module
 * Handles PGlite instance creation and connection management
 */

import { PGlite } from '@electric-sql/pglite';
import { updateState } from './stateManager';
import { getPGliteFeatureFlags, isPGliteEnabled, isPGliteActive } from '../features/featureFlags';
import type { IPGliteConfig } from '../types/dependencies';
import { PGliteInitError } from '../types/errors';
import { logger, configureLogger } from '../utils/logger';
import { runMigrations } from './migrationManager';
import { runValidationSuite } from '../validation/validationSuite';
import { getPGliteManager } from '../index';

/**
 * Initialize PGlite instance with IndexedDB backend
 *
 * @param config - Optional configuration (dataDir, debug, relaxedDurability)
 * @returns Initialized PGlite instance
 * @throws PGliteInitError if initialization fails
 */
export async function initializeDatabase(config?: IPGliteConfig): Promise<PGlite> {
  const flags = getPGliteFeatureFlags();

  // Check feature flag
  if (!flags.enabled) {
    const error = new PGliteInitError('PGlite is disabled. Enable via localStorage: enablePGlite=true');
    updateState({ lastError: error, connectionStatus: 'error' });
    throw error;
  }

  const dataDir = config?.dataDir || 'pglite';
  const debug = config?.debug ?? flags.debug;

  // Configure logger based on debug flag
  configureLogger(debug);

  try {
    updateState({ connectionStatus: 'connecting' });

    logger.debug('Initializing database...', { dataDir, debug });

    // Initialize with IndexedDB backend
    const db = new PGlite(`idb://${dataDir}`, {
      relaxedDurability: config?.relaxedDurability ?? false
    });

    // Test connection
    await db.query('SELECT 1 as test');

    updateState({
      db,
      connectionStatus: 'connected',
      lastError: null
    });

    logger.info('Database initialized successfully');

    return db;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const initError = new PGliteInitError(`Failed to initialize database: ${errorMessage}`);

    updateState({
      db: null,
      connectionStatus: 'error',
      lastError: initError
    });

    logger.error('Initialization failed', error);
    throw initError;
  }
}

/**
 * Close database connection
 *
 * @param db - PGlite instance to close
 */
export async function closeDatabase(db: PGlite): Promise<void> {
  try {
    await db.close();

    updateState({
      db: null,
      isInitialized: false,
      connectionStatus: 'disconnected',
      lastError: null
    });

    logger.info('Database closed');
  } catch (error) {
    logger.error('Error closing database', error);
    throw error;
  }
}

/**
 * NEW: Background инициализация PGlite с progress tracking
 *
 * PHASE 3: Non-blocking initialization flow:
 * 1. Check if allowed (enabled but not active)
 * 2. Initialize IndexedDB
 * 3. Run migrations
 * 4. Initialize ConflictManager
 * 5. Sync reference data (articles, FCs, CCs)
 * 6. Run validation suite
 * 7. Update state to 'ready' and show notification
 *
 * This function NEVER blocks UI - runs in background.
 * User continues to work via API while PGlite initializes.
 */
export async function initializeDatabaseInBackground(): Promise<void> {
  // Check if background init is allowed
  if (!isPGliteEnabled() || isPGliteActive()) {
    logger.info('[DB_INIT] Background init skipped', {
      enabled: isPGliteEnabled(),
      active: isPGliteActive()
    });
    return;
  }

  logger.info('[DB_INIT] Starting background initialization...');
  updateState({ initializationStatus: 'initializing' });

  try {
    // Step 1: Initialize database
    logger.info('[DB_INIT] Step 1/5: Initialize database');
    const db = await initializeDatabase();

    // Step 2: Run migrations
    logger.info('[DB_INIT] Step 2/5: Run migrations');
    const schemaVersion = await runMigrations(db);
    logger.info('[DB_INIT] Migrations complete', { schemaVersion });

    // Step 3: Initialize ConflictManager
    logger.info('[DB_INIT] Step 3/5: Initialize ConflictManager');
    // TODO: Import and initialize ConflictManager
    // await initializeConflictManager();

    // Step 4: Initial sync (reference data only)
    logger.info('[DB_INIT] Step 4/5: Sync reference data');
    // TODO: Implement syncReferenceData()
    // await syncReferenceData();

    // Step 5: Run validation suite
    logger.info('[DB_INIT] Step 5/5: Validate readiness');
    updateState({ initializationStatus: 'validating' });

    const pgliteManager = getPGliteManager();
    const validationResults = await runValidationSuite(pgliteManager);

    if (!validationResults.allPassed) {
      throw new Error('Validation failed: ' + JSON.stringify(validationResults.errors));
    }

    // SUCCESS: Mark as ready with validation results
    updateState({
      initializationStatus: 'ready',
      isInitialized: true,
      validationResults
    });

    logger.info('[DB_INIT] Background initialization complete', validationResults);

    // TODO: Show notification (Phase 5)
    // showPGliteReadyNotification(validationResults);

  } catch (error) {
    logger.error('[DB_INIT] Background initialization failed', error);
    updateState({
      initializationStatus: 'error',
      lastError: error as Error
    });

    // Show error toast (но не блокировать UI - API работает)
    if (typeof window !== 'undefined' && window.showToast) {
      window.showToast(
        'Не удалось инициализировать локальную БД. Работа продолжается через сервер.',
        'warning'
      );
    }
  }
}

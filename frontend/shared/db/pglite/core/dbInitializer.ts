/**
 * Database initialization module
 * Handles PGlite instance creation and connection management
 */

import { PGlite } from '@electric-sql/pglite';
import { updateState, getState } from './stateManager';
import { getPGliteFeatureFlags, isPGliteEnabled } from '../features/featureFlags';
import type { IPGliteConfig } from '../types/dependencies';
import { PGliteInitError } from '../types/errors';
import { logger, configureLogger } from '../utils/logger';
import { runMigrations } from './migrationManager';
import { runValidationSuite } from '../validation/validationSuite';
import { getPGliteManager } from '../index';
import { syncReferenceData } from '../operations/referenceSync';
import { syncFactsAndPlans } from '../operations/factSync';

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
 * 6. Sync transactional data (facts, recurring plans) - NEW
 * 7. Run validation suite
 * 8. Update state to 'ready' and show notification
 *
 * This function NEVER blocks UI - runs in background.
 * User continues to work via API while PGlite initializes.
 *
 * @param progressCallback - Optional callback for progress updates
 */
export async function initializeDatabaseInBackground(
  progressCallback?: (progress: {
    phase: string;
    message: string;
    current?: number;
    total?: number
  }) => void
): Promise<void> {
  // Check if background init is allowed
  const state = getState();
  if (!isPGliteEnabled() || state.isInitialized) {
    logger.info('[DB_INIT] Background init skipped', {
      enabled: isPGliteEnabled(),
      isInitialized: state.isInitialized
    });
    return;
  }

  logger.info('[DB_INIT] Starting background initialization...');
  updateState({ initializationStatus: 'initializing' });

  try {
    // Step 1: Initialize database
    logger.info('[DB_INIT] Step 1/6: Initialize database');
    progressCallback?.({
      phase: 'Database',
      message: 'Инициализация IndexedDB...'
    });
    const db = await initializeDatabase();

    // Step 2: Run migrations
    logger.info('[DB_INIT] Step 2/6: Run migrations');
    progressCallback?.({
      phase: 'Migrations',
      message: 'Применение миграций схемы...'
    });
    const schemaVersion = await runMigrations(db);
    logger.info('[DB_INIT] Migrations complete', { schemaVersion });

    // Step 3: Initialize ConflictManager
    logger.info('[DB_INIT] Step 3/6: Initialize ConflictManager');
    progressCallback?.({
      phase: 'ConflictManager',
      message: 'Инициализация менеджера конфликтов...'
    });
    const pgliteManagerForConflict = await getPGliteManager();
    pgliteManagerForConflict.initializeConflictManager();

    // Step 4: Sync reference data (articles, FCs, CCs)
    logger.info('[DB_INIT] Step 4/6: Sync reference data');
    progressCallback?.({
      phase: 'Reference Data',
      message: 'Синхронизация справочников...'
    });

    await syncReferenceData(db, (refProgress) => {
      // Forward progress with counts (articles + FCs + CCs)
      progressCallback?.({
        phase: 'Reference Data',
        message: refProgress.message,
        current: refProgress.current,
        total: refProgress.total
      });

      logger.info(`[DB_INIT] ${refProgress.phase}: ${refProgress.message}`, {
        current: refProgress.current,
        total: refProgress.total
      });
    });

    // Step 5: Sync transactional data (facts, plans)
    logger.info('[DB_INIT] Step 5/6: Sync facts and plans');
    const factsWindow = 90;  // Default: 90 days
    progressCallback?.({
      phase: 'Facts & Plans',
      message: 'Синхронизация транзакций...'
    });

    await syncFactsAndPlans(db, factsWindow, (syncProgress) => {
      // Forward progress with counts (~754 facts for 90 days window)
      progressCallback?.({
        phase: 'Facts & Plans',
        message: `Загружено ${syncProgress.current}/${syncProgress.total} транзакций`,
        current: syncProgress.current,
        total: syncProgress.total
      });

      logger.info(`[DB_INIT] ${syncProgress.phase}: ${syncProgress.message}`, {
        current: syncProgress.current,
        total: syncProgress.total
      });
    });

    // Step 6: Run validation suite
    logger.info('[DB_INIT] Step 6/6: Validate readiness');
    updateState({ initializationStatus: 'validating' });

    progressCallback?.({
      phase: 'Validation',
      message: 'Проверка готовности базы данных...'
    });

    const pgliteManager = await getPGliteManager();
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

    progressCallback?.({
      phase: 'Complete',
      message: 'Готово!'
    });

    logger.info('[DB_INIT] Background initialization complete', validationResults);

    // Show notification when ready (opt-in activation)
    // Dynamic import for browser environment (will resolve to .js at runtime)
    if (typeof window !== 'undefined' && (window as any).showPGliteReadyNotification) {
      try {
        (window as any).showPGliteReadyNotification(validationResults);
      } catch (err) {
        logger.warn('[DB_INIT] Failed to show ready notification', err);
      }
    }

  } catch (error) {
    logger.error('[DB_INIT] Background initialization failed', error);
    updateState({
      initializationStatus: 'error',
      lastError: error as Error,
      errorType: 'initialization'  // Mark as initialization error (NO auto-recovery)
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

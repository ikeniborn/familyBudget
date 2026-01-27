/**
 * Database initialization module
 * Handles PGlite instance creation and connection management
 */

import { PGlite } from '@electric-sql/pglite';
import { updateState } from './stateManager';
import { getPGliteFeatureFlags } from '../features/featureFlags';
import type { IPGliteConfig } from '../types/dependencies';
import { PGliteInitError } from '../types/errors';
import { logger, configureLogger } from '../utils/logger';

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

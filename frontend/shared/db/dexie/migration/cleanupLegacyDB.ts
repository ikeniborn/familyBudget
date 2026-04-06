/**
 * Cleanup Legacy IndexedDB (v5) and PGlite (v10) databases
 *
 * Handles automatic migration for users upgrading from:
 * - v10.1.x (PGlite v10)
 * - v11.0-11.2 (Legacy IndexedDB v5)
 *
 * @version v11.3.1
 */
import Dexie from 'dexie';
import { logger } from '../utils/logger';
import { initializeDatabase } from '../core/database';
import { fullFactSync } from '../operations/factSync';

const DB_NAME = 'FamilyBudgetDB';
const MIGRATION_FLAG = 'dexie_legacy_cleanup_done';

/**
 * Show toast notification to user
 * Falls back to logger if showToast not available
 */
function notify(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
  if (typeof window !== 'undefined' && (window as any).showToast) {
    (window as any).showToast(message, type);
  } else {
    logger.info(`[Migration] ${message}`);
  }
}

/**
 * Cleanup legacy database and migrate to Dexie v1
 *
 * Safe to call multiple times - checks migration flag before executing.
 * Handles errors gracefully without blocking app initialization.
 */
export async function cleanupLegacyDatabase(): Promise<void> {
  // Check if already migrated
  if (localStorage.getItem(MIGRATION_FLAG) === 'true') {
    logger.debug('[Migration] Legacy cleanup already completed');
    return;
  }

  try {
    // Check if database exists
    const exists = await Dexie.exists(DB_NAME);
    if (!exists) {
      logger.debug('[Migration] No legacy database found');
      localStorage.setItem(MIGRATION_FLAG, 'true');
      return;
    }

    // Open database to check version
    const tempDb = new Dexie(DB_NAME);
    await tempDb.open();
    const version = tempDb.verno;
    tempDb.close();

    // Version 5-10 = Legacy/PGlite (incompatible schemas)
    if (version >= 5 && version <= 10) {
      logger.warn(`[Migration] Found legacy database v${version}, migrating to Dexie v1...`);

      // Delete old database
      await Dexie.delete(DB_NAME);
      logger.info('[Migration] Legacy database deleted');

      // Show user notification
      notify('База данных обновлена. Синхронизация с сервером...', 'info');

      // Create fresh Dexie v1
      await initializeDatabase();
      logger.info('[Migration] Dexie v1 initialized');

      // Sync from server (async, don't wait)
      // Use currentUserId from window if available
      const userId = (window as any).currentUserId;
      if (userId) {
        // Sync last 90 days of data
        const dateTo = new Date().toISOString().split('T')[0];
        const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        fullFactSync(userId, dateFrom, dateTo).catch(error => {
          logger.error('[Migration] Sync failed:', error);
          notify('Не удалось синхронизировать данные с сервера', 'warning');
        });
      } else {
        logger.warn('[Migration] No currentUserId found, skipping sync');
      }

      // Mark as migrated
      localStorage.setItem(MIGRATION_FLAG, 'true');
      logger.info('[Migration] ✅ Migration complete');
    } else if (version >= 1 && version < 5) {
      // Valid modern Dexie database (v1-v4)
      logger.debug(`[Migration] Modern Dexie database (v${version}), no migration needed`);
      localStorage.setItem(MIGRATION_FLAG, 'true');
    } else {
      logger.warn(`[Migration] Unrecognized database version: ${version}`);
    }
  } catch (error) {
    logger.error('[Migration] Cleanup failed:', error);
    // Don't block app initialization - continue without migration
  }
}

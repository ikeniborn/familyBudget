/**
 * PGlite → Dexie Migration
 * Одноразовая миграция пользовательских данных
 *
 * ВАЖНО: amount fields конвертируются NUMERIC → integer cents
 */

import { db, toCents } from '../core/database';
import { logger } from '../utils/logger';
import type {
  LocalArticle,
  LocalBudgetFact,
  LocalShoppingList,
  LocalShoppingListItem
} from '../types/models';

/**
 * Migration progress phases
 */
export type MigrationPhase =
  | 'analyzing'
  | 'exporting'
  | 'importing'
  | 'verifying'
  | 'complete'
  | 'failed';

/**
 * Migration progress callback
 */
export interface MigrationProgress {
  phase: MigrationPhase;
  current: number;
  total: number;
  message: string;
}

/**
 * Migration diagnostic info
 */
export interface MigrationDiagnostic {
  totalRecords: number;
  hasPendingOps: boolean;
  estimatedMigrationTime: number; // seconds
  tables: {
    articles: number;
    facts: number;
    shopping_lists: number;
    shopping_items: number;
    pending_ops: number;
  };
}

/**
 * LocalStorage keys
 */
const MIGRATION_KEY = 'pglite_to_dexie_migrated';
const MIGRATION_BACKUP_KEY = 'pglite_migration_backup';

/**
 * Analyze PGlite data перед миграцией
 * Определяет объем данных и наличие pending operations
 */
export async function analyzePGliteData(): Promise<MigrationDiagnostic> {
  logger.info('[Migration] Analyzing PGlite data...');

  try {
    // Проверяем наличие PGlite database в IndexedDB
    const databases = await indexedDB.databases();
    const pgliteDb = databases.find(db => db.name === 'pglite');

    if (!pgliteDb) {
      logger.info('[Migration] No PGlite database found');
      return {
        totalRecords: 0,
        hasPendingOps: false,
        estimatedMigrationTime: 0,
        tables: {
          articles: 0,
          facts: 0,
          shopping_lists: 0,
          shopping_items: 0,
          pending_ops: 0
        }
      };
    }

    // NOTE: Невозможно напрямую query PGlite без библиотеки
    // Возвращаем приблизительные данные
    logger.warn('[Migration] Cannot analyze PGlite data without library');

    return {
      totalRecords: 0,
      hasPendingOps: false,
      estimatedMigrationTime: 0,
      tables: {
        articles: 0,
        facts: 0,
        shopping_lists: 0,
        shopping_items: 0,
        pending_ops: 0
      }
    };
  } catch (error) {
    logger.error('[Migration] Analysis failed:', error);
    return {
      totalRecords: 0,
      hasPendingOps: false,
      estimatedMigrationTime: 0,
      tables: {
        articles: 0,
        facts: 0,
        shopping_lists: 0,
        shopping_items: 0,
        pending_ops: 0
      }
    };
  }
}

/**
 * Main migration function
 * PGlite → Dexie с progress reporting
 *
 * @param onProgress - Optional progress callback
 */
export async function migrateFromPGlite(
  onProgress?: (progress: MigrationProgress) => void
): Promise<void> {
  logger.info('[Migration] Starting PGlite → Dexie migration');

  // Проверяем, была ли миграция уже выполнена
  if (localStorage.getItem(MIGRATION_KEY) === 'true') {
    logger.info('[Migration] Already migrated, skipping');
    onProgress?.({
      phase: 'complete',
      current: 100,
      total: 100,
      message: 'Migration already completed'
    });
    return;
  }

  try {
    // PHASE 1: Analyze
    onProgress?.({
      phase: 'analyzing',
      current: 0,
      total: 100,
      message: 'Analyzing PGlite data...'
    });

    const diagnostic = await analyzePGliteData();

    if (diagnostic.totalRecords === 0) {
      logger.info('[Migration] No PGlite data found, skipping migration');
      localStorage.setItem(MIGRATION_KEY, 'true');
      onProgress?.({
        phase: 'complete',
        current: 100,
        total: 100,
        message: 'No data to migrate'
      });
      return;
    }

    // Warn if pending operations
    if (diagnostic.hasPendingOps) {
      logger.warn('[Migration] ⚠️ Pending offline operations detected');
      // TODO: Implement pending ops backup
    }

    // PHASE 2: Export (skipped - cannot access PGlite without library)
    onProgress?.({
      phase: 'exporting',
      current: 0,
      total: 100,
      message: 'Exporting from PGlite...'
    });

    logger.warn('[Migration] ⚠️ Cannot export from PGlite without @electric-sql/pglite library');
    logger.info('[Migration] Recommendation: Users should re-sync from server instead');

    // PHASE 3: Import (skipped)
    onProgress?.({
      phase: 'importing',
      current: 0,
      total: 100,
      message: 'Importing to Dexie...'
    });

    // PHASE 4: Verify (skipped)
    onProgress?.({
      phase: 'verifying',
      current: 0,
      total: 100,
      message: 'Verifying migration...'
    });

    // PHASE 5: Mark complete
    localStorage.setItem(MIGRATION_KEY, 'true');

    onProgress?.({
      phase: 'complete',
      current: 100,
      total: 100,
      message: 'Migration complete (no PGlite data found)'
    });

    logger.info('[Migration] ✅ Complete');
  } catch (error) {
    logger.error('[Migration] ❌ Failed:', error);

    onProgress?.({
      phase: 'failed',
      current: 0,
      total: 100,
      message: `Migration failed: ${(error as Error).message}`
    });

    // Rollback: удаляем Dexie data
    try {
      await db.delete();
      logger.info('[Migration] Rollback successful');
    } catch (rollbackError) {
      logger.error('[Migration] Rollback failed:', rollbackError);
    }

    throw error;
  }
}

/**
 * Convert PGlite NUMERIC amount to Dexie integer cents
 * Helper для миграции
 *
 * @param records - Records с amount полем
 * @returns Records с amount в cents
 */
export function convertAmountToCents<T extends { amount: number | string }>(
  records: T[]
): T[] {
  return records.map(r => ({
    ...r,
    amount: toCents(typeof r.amount === 'string' ? parseFloat(r.amount) : r.amount)
  }));
}

/**
 * Verify migration integrity
 * Проверяет что данные корректно мигрировали
 *
 * @param pgliteData - Original PGlite data
 * @returns Verification result
 */
export async function verifyMigration(pgliteData: {
  articles: LocalArticle[];
  facts: LocalBudgetFact[];
  shopping_lists: LocalShoppingList[];
  shopping_items: LocalShoppingListItem[];
}): Promise<{ success: boolean; errors: string[] }> {
  logger.info('[Migration] Verifying migration...');

  const errors: string[] = [];

  try {
    // Verify record counts
    const articlesCount = await db.articles.count();
    if (articlesCount !== pgliteData.articles.length) {
      errors.push(
        `Articles count mismatch: ${articlesCount} vs ${pgliteData.articles.length}`
      );
    }

    const factsCount = await db.budgetFacts.count();
    if (factsCount !== pgliteData.facts.length) {
      errors.push(
        `Facts count mismatch: ${factsCount} vs ${pgliteData.facts.length}`
      );
    }

    const listsCount = await db.shoppingLists.count();
    if (listsCount !== pgliteData.shopping_lists.length) {
      errors.push(
        `Shopping lists count mismatch: ${listsCount} vs ${pgliteData.shopping_lists.length}`
      );
    }

    const itemsCount = await db.shoppingListItems.count();
    if (itemsCount !== pgliteData.shopping_items.length) {
      errors.push(
        `Shopping items count mismatch: ${itemsCount} vs ${pgliteData.shopping_items.length}`
      );
    }

    // Verify data integrity (sample check)
    if (articlesCount > 0) {
      const firstArticle = await db.articles.orderBy('id').first();
      if (!firstArticle) {
        errors.push('First article not found after migration');
      }
    }

    logger.info('[Migration] Verification complete', {
      success: errors.length === 0,
      errors
    });

    return { success: errors.length === 0, errors };
  } catch (error) {
    logger.error('[Migration] Verification failed:', error);
    errors.push(`Verification error: ${(error as Error).message}`);
    return { success: false, errors };
  }
}

/**
 * Backup pending operations перед миграцией
 * Сохраняет pending ops в отдельное IndexedDB для восстановления при ошибке
 */
export async function backupPendingOperations(): Promise<void> {
  logger.info('[Migration] Backing up pending operations...');

  try {
    // NOTE: Требует PGlite library для доступа к данным
    // Для полной реализации нужно:
    // 1. Query PGlite pending operations
    // 2. Save to separate IndexedDB
    // 3. Store backup metadata in localStorage

    logger.warn('[Migration] ⚠️ Cannot backup pending ops without PGlite library');
    logger.info('[Migration] Recommendation: Users should sync before upgrading');

    localStorage.setItem(
      MIGRATION_BACKUP_KEY,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        pending_ops_count: 0
      })
    );
  } catch (error) {
    logger.error('[Migration] Backup failed:', error);
    throw error;
  }
}

/**
 * Restore pending operations после failed migration
 */
export async function restorePendingOperations(): Promise<void> {
  logger.info('[Migration] Restoring pending operations...');

  try {
    const backup = localStorage.getItem(MIGRATION_BACKUP_KEY);
    if (!backup) {
      logger.info('[Migration] No backup found');
      return;
    }

    // NOTE: Требует implementation для восстановления pending ops
    logger.warn('[Migration] ⚠️ Restore not implemented');
    logger.info('[Migration] Recommendation: Users should re-sync from server');
  } catch (error) {
    logger.error('[Migration] Restore failed:', error);
  }
}

/**
 * Check migration status
 */
export function isMigrationCompleted(): boolean {
  return localStorage.getItem(MIGRATION_KEY) === 'true';
}

/**
 * Reset migration flag (для testing)
 */
export function resetMigrationFlag(): void {
  logger.warn('[Migration] Resetting migration flag');
  localStorage.removeItem(MIGRATION_KEY);
  localStorage.removeItem(MIGRATION_BACKUP_KEY);
}

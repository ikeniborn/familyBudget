/**
 * Dexie.js Public API
 * Экспорт для использования в приложении
 */

// Core
import type { DexieManager as DexieManagerType } from './DexieManager';
import { getDexieManager as getDexieManagerImpl } from './DexieManager';
export { DexieManager, getDexieManager } from './DexieManager';
import { db as dexieDb, toCents as dexieToCents, fromCents as dexieFromCents } from './core/database';
export { db, toCents, fromCents } from './core/database';
export type { InitializationStatus, ProgressCallback } from './DexieManager';

/**
 * Check if Dexie offline mode is active
 * Читает feature flag из localStorage
 *
 * DEFAULT: TRUE (active by default)
 * Users can explicitly disable: localStorage.setItem('dexieActive', 'false')
 */
export function isDexieActive(): boolean {
  const stored = localStorage.getItem('dexieActive');
  // Default: TRUE (active by default)
  // Users can explicitly disable: localStorage.setItem('dexieActive', 'false')
  return stored !== 'false';
}

/**
 * Set Dexie offline mode active/inactive
 * Записывает feature flag в localStorage
 */
export function setDexieActive(active: boolean): void {
  localStorage.setItem('dexieActive', active ? 'true' : 'false');
}

/**
 * Get Dexie state (compatibility wrapper)
 * Возвращает DexieManager для backward compatibility с PGlite кодом
 */
export async function getState(): Promise<{ db: DexieManagerType | null }> {
  if (!isDexieActive()) {
    return { db: null };
  }

  const manager = getDexieManagerImpl();
  await manager.init();
  return { db: manager };
}

/**
 * Get Dexie feature flags (compatibility wrapper)
 * Возвращает настройки для backward compatibility с PGlite кодом
 */
export function getDexieFeatureFlags(): {
  autoSyncInterval: number;
  enabled: boolean;
} {
  return {
    autoSyncInterval: 30000, // 30 seconds
    enabled: isDexieActive()
  };
}

// Aliases for backward compatibility
export const getPGliteFeatureFlags = getDexieFeatureFlags;
export const isDexieEnabled = isDexieActive;
export const setDexieEnabled = setDexieActive;

// Operations
export * from './operations/schemaOperations';
export * from './operations/factOperations';
export * from './operations/bulkOperations';
export * from './operations/shoppingOperations';
export * from './operations/referenceSync';
export * from './operations/factSync';
export * from './operations/shoppingSync';

// Backward compatibility aliases
export {
  createShoppingListItem as addItemToList,
  updateShoppingListItem,
  deleteShoppingListItem
} from './operations/shoppingOperations';

// toggleItemCompleted implementation (wrapper around updateShoppingListItem)
export async function toggleItemCompleted(temp_id: string, is_completed: boolean): Promise<void> {
  const { updateShoppingListItem } = await import('./operations/shoppingOperations');
  await updateShoppingListItem(temp_id, { is_completed });
}

// Types
export type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalArticleHierarchy,
  LocalSyncMetadata,
  LocalSchemaMigration
} from './types/models';

export type {
  LocalBudgetFact,
  LocalPendingOperation,
  LocalSyncConflict,
  LocalRecurringPlan,
  FactFilters,
  RecurringPlanFilters
} from './types/fact';

export type {
  LocalShoppingList,
  LocalShoppingListItem,
  ShoppingListFilters,
  ShoppingListItemFilters,
  ShoppingListWithStats,
  LocalStore,
  LocalProductGroup,
  LocalProductGroupHierarchy,
  StoreFilters,
  ProductGroupFilters
} from './types/shopping';

// Utils
import { logger as dexieLogger } from './utils/logger';
export { logger } from './utils/logger';
export { fetchWithTimeout } from './utils/fetchWithTimeout';
export { generateUUID, calculateContentHash } from './utils/hash';
export {
  validateArticle,
  validateFact,
  validateShoppingItem,
  validateSyncStatus,
  amountToCents
} from './utils/validation';

// Validation Results (for notifications)
export interface ValidationResults {
  success: boolean;
  details: {
    articleCount: number;
    financialCenterCount: number;
    costCenterCount: number;
    avgQueryTimeMs: number;
  };
}

// ============================================================================
// Window Global Export (IIFE Bundle)
// ============================================================================

/**
 * Type definition for window.Dexie global API
 * Provides type safety for external bundles accessing Dexie
 */
declare global {
  interface Window {
    Dexie: {
      getDexieManager: typeof getDexieManagerImpl;
      db: typeof dexieDb;
      toCents: typeof dexieToCents;
      fromCents: typeof dexieFromCents;
      isDexieActive: typeof isDexieActive;
      setDexieActive: typeof setDexieActive;
      getState: typeof getState;
      getDexieFeatureFlags: typeof getDexieFeatureFlags;
      logger: typeof dexieLogger;
    };
  }
}

/**
 * Expose Dexie API to window.Dexie for external bundles (facts.min.js, etc.)
 *
 * CRITICAL: Vite IIFE bundles do NOT automatically create window globals.
 * External bundles (facts, shopping, etc.) depend on window.Dexie.
 * Without this explicit assignment, they fail with "Dexie is not defined".
 *
 * Strategy:
 * - Import all operations modules dynamically to avoid circular dependencies
 * - Expose minimal API surface (getDexieManager is main entry point)
 * - External bundles call: const manager = await window.Dexie.getDexieManager()
 *
 * @see config/vite.config.single.ts:103 - external: 'dexie'
 * @see config/vite.config.single.ts:124 - globals: { 'dexie': 'window.Dexie' }
 */
if (typeof window !== 'undefined') {
  dexieLogger.info('[DEXIE_BUNDLE] ⚙️ Executing window.Dexie assignment');

  // Minimal API: expose only getDexieManager() as entry point
  // External bundles access full API via: const manager = await window.Dexie.getDexieManager()
  window.Dexie = {
    getDexieManager: getDexieManagerImpl,
    db: dexieDb,
    toCents: dexieToCents,
    fromCents: dexieFromCents,
    isDexieActive,
    setDexieActive,
    getState,
    getDexieFeatureFlags,
    logger: dexieLogger,
  };

  dexieLogger.info('[DEXIE_BUNDLE] ✅ window.Dexie assigned:', {
    type: typeof window.Dexie,
    keys: Object.keys(window.Dexie)
  });

  // Log to confirm window.Dexie is available for external bundles
  dexieLogger.info('Exposed to window.Dexie for external bundles');
}

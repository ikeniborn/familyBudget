/**
 * Dexie.js Public API
 * Экспорт для использования в приложении
 */

// Core
import type { DexieManager as DexieManagerType } from './DexieManager';
import { getDexieManager as getDexieManagerImpl } from './DexieManager';
export { DexieManager, getDexieManager } from './DexieManager';
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

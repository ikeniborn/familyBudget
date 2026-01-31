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
 */
export function isDexieActive(): boolean {
  return localStorage.getItem('dexieActive') === 'true';
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

// Alias for backward compatibility
export const getPGliteFeatureFlags = getDexieFeatureFlags;

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

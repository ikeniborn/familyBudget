/**
 * Dexie.js Public API
 * Экспорт для использования в приложении
 */

// Core
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

// Operations
export * from './operations/schemaOperations';
export * from './operations/factOperations';
export * from './operations/bulkOperations';
export * from './operations/shoppingOperations';
export * from './operations/referenceSync';
export * from './operations/factSync';
export * from './operations/shoppingSync';

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

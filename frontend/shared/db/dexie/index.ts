/**
 * Dexie.js Public API
 * Экспорт для использования в приложении
 * Version: 11.2.35 - Force rebuild
 */

// Core
import { DexieManager } from './DexieManager';
import { getDexieManager as getDexieManagerImpl } from './DexieManager';
export { DexieManager, getDexieManager } from './DexieManager';
import { initializeDatabase, getDatabase, db as dexieDb, toCents as dexieToCents, fromCents as dexieFromCents, clearVersionCache } from './core/database';
export { initializeDatabase, getDatabase, db, toCents, fromCents, clearVersionCache } from './core/database';
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
  console.warn(`[Dexie] dexieActive flag set to: ${active}`);
}

/**
 * Get Dexie state (compatibility wrapper)
 * Возвращает DexieManager для backward compatibility с PGlite кодом
 */
export async function getState(): Promise<{ db: DexieManager | null }> {
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
// Background Initialization API (for base.html compatibility)
// ============================================================================

/**
 * Initialize Dexie database in background (non-blocking)
 * Wrapper around getDexieManager().init() for backward compatibility with base.html
 *
 * @returns Promise that resolves when initialization completes
 */
export async function initializeDatabaseInBackground(): Promise<void> {
  const manager = getDexieManagerImpl();
  await manager.init();
}

/**
 * Check if Dexie database is ready
 * Wrapper around getDexieManager().isReady() for backward compatibility with base.html
 *
 * @returns true if database is initialized and ready to use
 */
export function isReady(): boolean {
  const manager = getDexieManagerImpl();
  return manager.isReady();
}

/**
 * Get diagnostic data for Dexie database
 * Wrapper around getDexieManager().getDiagnosticData() for backward compatibility with base.html
 *
 * @returns Promise with diagnostic data
 */
export async function getDiagnosticData(): Promise<{
  initializationStatus: string;
  lastSyncTimestamp: string;
  isEnabled: boolean;
  isInitialized: boolean;
  dbSize: number;
  dbSizeKB: number;
  tables: Record<string, number>;
  tableStats: {
    articles: number;
    financial_centers: number;
    cost_centers: number;
    facts: number;
    plans: number;
  };
  syncStatus: 'error' | 'idle' | 'syncing';
  performance: { avgQueryTime: number };
  performanceMetrics?: {
    avgQueryTimeMs: number;
    totalQueries: number;
    avgLoadTimeMs: number;
    avgSaveTimeMs: number;
  };
  pruningStats: {
    enabled: boolean;
    lastPrune?: Date;
    lastPrunedAt: string;
    totalPruned: number;
    nextPruneEstimate: string;
  };
}> {
  const manager = getDexieManagerImpl();
  return manager.getDiagnosticData();
}

// ============================================================================
// Window Global Export (IIFE Bundle)
// ============================================================================

/**
 * Type definition for window.Dexie global API
 * Provides type safety for external bundles accessing Dexie
 *
 * window.Dexie is both:
 * - Dexie class constructor (for inheritance: class MyDB extends window.Dexie)
 * - Object with utility methods (for backward compatibility: window.Dexie.getDexieManager())
 */
import type Dexie from 'dexie';

/**
 * Shared type alias for Dexie with utilities
 * Used in both global declaration and runtime type assertion (DRY principle)
 */
type DexieWithUtilities = typeof Dexie & {
  getDexieManager: typeof getDexieManagerImpl;
  DexieManager: typeof DexieManager;
  initializeDatabase: typeof initializeDatabase;
  getDatabase: typeof getDatabase;
  clearVersionCache: typeof clearVersionCache;
  db: typeof dexieDb;
  toCents: typeof dexieToCents;
  fromCents: typeof dexieFromCents;
  isDexieActive: typeof isDexieActive;
  setDexieActive: typeof setDexieActive;
  getState: typeof getState;
  getDexieFeatureFlags: typeof getDexieFeatureFlags;
  logger: typeof dexieLogger;
  // Background initialization API (for base.html compatibility)
  initializeDatabaseInBackground: typeof initializeDatabaseInBackground;
  isReady: typeof isReady;
  getDiagnosticData: typeof getDiagnosticData;
};

declare global {
  interface Window {
    Dexie: DexieWithUtilities;
  }
}

/**
 * Expose Dexie API to window.Dexie for external bundles (facts.min.js, etc.)
 *
 * CRITICAL: External bundles extend Dexie class (class MyDB extends Dexie).
 * window.Dexie MUST be a constructor, not a plain object.
 *
 * Solution:
 * - Synchronous placeholder: window.Dexie = null (signals "loading")
 * - Async import real Dexie constructor from 'dexie' package
 * - Attach utilities as static properties to Dexie class
 * - Export Dexie class with utilities attached
 *
 * Result:
 * - ✅ class FamilyBudgetDB extends window.Dexie (Dexie is a constructor)
 * - ✅ window.Dexie.getDexieManager() (utilities attached as static properties)
 * - ✅ No race condition (placeholder prevents undefined access)
 *
 * @see config/vite.config.single.ts:103 - external: 'dexie'
 * @see config/vite.config.single.ts:124 - globals: { 'dexie': 'window.Dexie' }
 */
if (typeof window !== 'undefined') {
  dexieLogger.info('[DEXIE_BUNDLE] ⚙️ Executing window.Dexie assignment');

  // Synchronous placeholder to prevent race condition
  // External bundles can check: if (!window.Dexie) { /* wait or defer */ }
  (window as any).Dexie = null;
  dexieLogger.info('[DEXIE_BUNDLE] 🔄 window.Dexie placeholder set (loading...)');

  // Import real Dexie constructor for inheritance support
  import('dexie').then(({ default: Dexie }) => {
    // Attach utilities as static properties to Dexie class
    Object.assign(Dexie, {
      getDexieManager: getDexieManagerImpl,
      DexieManager: DexieManager,
      initializeDatabase,
      getDatabase,
      clearVersionCache,
      db: dexieDb,
      toCents: dexieToCents,
      fromCents: dexieFromCents,
      isDexieActive,
      setDexieActive,
      getState,
      getDexieFeatureFlags,
      logger: dexieLogger,
      // Background initialization API (for base.html compatibility)
      initializeDatabaseInBackground,
      isReady,
      getDiagnosticData,
    });

    // Export Dexie class (with utilities attached) to window
    // Type assertion needed because Object.assign() doesn't update TypeScript types
    window.Dexie = Dexie as DexieWithUtilities;

    // Runtime validation: Verify window.Dexie is a valid constructor
    if (typeof window.Dexie !== 'function') {
      throw new Error(
        '[DEXIE_BUNDLE] Runtime validation failed: window.Dexie is not a function (constructor). ' +
        `Type: ${typeof window.Dexie}`
      );
    }

    if (!(window.Dexie.prototype instanceof Object)) {
      throw new Error(
        '[DEXIE_BUNDLE] Runtime validation failed: window.Dexie.prototype is not a valid object. ' +
        'External bundles cannot extend this constructor.'
      );
    }

    // Verify critical utilities are attached
    const requiredUtilities = ['getDexieManager', 'DexieManager', 'initializeDatabase', 'getDatabase', 'clearVersionCache', 'db', 'toCents', 'fromCents'];
    const missingUtilities = requiredUtilities.filter(util => !(util in window.Dexie));
    if (missingUtilities.length > 0) {
      throw new Error(
        `[DEXIE_BUNDLE] Runtime validation failed: Missing utilities: ${missingUtilities.join(', ')}`
      );
    }

    dexieLogger.info('[DEXIE_BUNDLE] ✅ window.Dexie assigned (constructor + utilities):', {
      isConstructor: typeof window.Dexie === 'function',
      hasUtilities: Object.keys(window.Dexie).length,
      canExtend: window.Dexie.prototype instanceof Object,
      validationPassed: true
    });

    dexieLogger.info('Exposed to window.Dexie for external bundles');
  }).catch((err) => {
    dexieLogger.error('[DEXIE_BUNDLE] ❌ Failed to import Dexie constructor:', err);

    // Error recovery: Create fallback placeholder object
    // Prevents external bundles from crashing when accessing window.Dexie methods
    const fallbackDexie = {
      getDexieManager: () => {
        throw new Error('Dexie initialization failed - cannot get manager. See console for details.');
      },
      DexieManager: class DexieManagerFallback {},
      initializeDatabase: async () => {
        throw new Error('Dexie initialization failed - cannot initialize database');
      },
      getDatabase: () => {
        throw new Error('Dexie initialization failed - database not available');
      },
      clearVersionCache: () => {
        // No-op in fallback mode (no cache to clear)
      },
      db: new Proxy({}, {
        get(_target, prop) {
          // Skip symbols and prototype methods
          if (typeof prop === 'symbol' || prop === 'constructor' || prop === '__proto__') {
            return undefined;
          }
          throw new Error(`[Dexie] Initialization failed - cannot access '${String(prop)}'`);
        }
      }) as any,
      toCents: (amount: number) => Math.round(amount * 100),
      fromCents: (cents: number) => cents / 100,
      isDexieActive: () => false,
      setDexieActive: () => {
        dexieLogger.warn('Dexie initialization failed - cannot set active state');
      },
      getState: async () => ({ db: null }),
      getDexieFeatureFlags: () => ({ autoSyncInterval: 30000, enabled: false }),
      logger: dexieLogger,
      initializeDatabaseInBackground: async () => {
        throw new Error('Dexie initialization failed - cannot initialize database');
      },
      isReady: () => false,
      getDiagnosticData: async () => ({
        initializationStatus: 'failed',
        lastSyncTimestamp: 'never',
        isEnabled: false,
        isInitialized: false,
        dbSize: 0,
        dbSizeKB: 0,
        tables: {},
        tableStats: { articles: 0, financial_centers: 0, cost_centers: 0, facts: 0, plans: 0 },
        syncStatus: 'error' as const,
        performance: { avgQueryTime: 0 },
        pruningStats: {
          enabled: false,
          lastPrunedAt: 'never',
          totalPruned: 0,
          nextPruneEstimate: 'never'
        }
      })
    };

    // Assign fallback to prevent undefined errors
    (window as any).Dexie = fallbackDexie;

    // User notification
    dexieLogger.error(
      '[DEXIE_BUNDLE] ⚠️ Fallback mode active - offline features disabled. ' +
      'Application will work in online-only mode.'
    );
  });
}

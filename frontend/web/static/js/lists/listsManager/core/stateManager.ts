/**
 * Lists Manager - State Management
 *
 * Handles initialization and data loading for shopping lists.
 * Manages online/offline state, caching, and data synchronization.
 *
 * Phase 3.1: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/listsManager.ts lines 126-708
 *
 * Phase 3.2 (task-015): DataLayer Integration
 * Replaced direct API fetch with dataLayer (PGlite-first + API fallback)
 */

import { getState, updateState } from './ListsState';
import type { ShoppingList, ShoppingItem, Store, ProductGroup } from './ListsState';
import { dataLayer } from '../../../data/DataLayer';
import { getDexieManager } from '@db/dexie';
import { shouldSimulateLoadError, isVerboseLoggingEnabled } from '../testing/debugUtils';
import type {
  LocalShoppingList,
  ShoppingListWithStats,
  LocalShoppingListItem,
  LocalStore,
  LocalProductGroup
} from '@db/dexie';

// ============================================================================
// Constants
// ============================================================================

/** Prefix for generated temp_id when backend doesn't provide one */
const TEMP_ID_PREFIX = 'list_';
/** Suffix for generated temp_id (indicates fallback generation) */
const TEMP_ID_SUFFIX = '_temp';

// ============================================================================
// Type Definitions
// ============================================================================

declare const debugLog: (...args: any[]) => void;
declare const showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
declare const IndexedDBManager: any;
declare const OfflineShoppingManager: any;

declare global {
  interface Window {
    offlineManager?: any;
  }
}

// ============================================================================
// Type Converters (PGlite Local* types → State types)
// ============================================================================

/**
 * Convert LocalShoppingList (or ShoppingListWithStats) to ShoppingList
 *
 * Handles both PGlite records (without stats) and API responses (with stats).
 *
 * CRITICAL FIX (Task #9): Generate temp_id if missing (backend doesn't return it yet)
 * This ensures Dexie queries work correctly when matching items by shopping_list_temp_id
 */
function convertShoppingList(local: LocalShoppingList | ShoppingListWithStats): ShoppingList {
  // CRITICAL: Generate temp_id if missing (backend API doesn't include it yet)
  // Format: "list_{id}_{timestamp}" - stable across page reloads for same list
  const temp_id = local.temp_id || `${TEMP_ID_PREFIX}${local.id}${TEMP_ID_SUFFIX}`;

  // Log warning if temp_id is missing (indicates backend API issue)
  if (!local.temp_id) {
    console.warn('[STATE_MANAGER] Missing temp_id for list, using fallback', {
      listId: local.id,
      fallback: temp_id,
      message: 'Backend API should return temp_id field'
    });
  }

  return {
    id: local.id || 0, // Use temp_id hash or 0 if no server ID yet
    temp_id,        // Preserve or generate temp_id for Dexie operations
    name: local.name,
    is_active: local.is_active,
    // DEFENSIVE: PGlite returns TIMESTAMP as ISO strings, but types define Date
    // Runtime check provides backward compatibility with both API (Date) and PGlite (string)
    // TODO (task-016): Normalize LocalShoppingList timestamp types to string at PGlite query layer
    created_at: typeof local.created_at === 'string' ? local.created_at : local.created_at.toISOString(),
    updated_at: typeof local.updated_at === 'string' ? local.updated_at : local.updated_at.toISOString(),
    description: local.description || undefined,
    // Statistics from API response (optional in LocalShoppingList, required in ShoppingListWithStats)
    total_items: local.total_items,
    completed_items: local.completed_items,
    completion_percentage: local.completion_percentage
  };
}

/**
 * Convert LocalShoppingListItem to ShoppingItem
 */
function convertShoppingListItem(local: LocalShoppingListItem, listId: number): ShoppingItem {
  return {
    id: local.id || 0,
    list_id: listId,
    temp_id: local.temp_id,         // Preserve PGlite temp_id for write operations (task-015 Phase 4)
    product_name: local.product_name,
    quantity: local.quantity,
    unit: local.unit,
    is_completed: local.is_completed,
    // DEFENSIVE: Handle both Date and string for nullable completed_at
    // TODO (task-016): Normalize LocalShoppingListItem timestamp types to string at PGlite query layer
    completed_at: local.completed_at
      ? (typeof local.completed_at === 'string' ? local.completed_at : local.completed_at.toISOString())
      : undefined,
    store_id: local.store_id,
    product_group_id: local.product_group_id,
    notes: local.comment, // PGlite uses 'comment', UI uses 'notes'
    // DEFENSIVE: PGlite returns TIMESTAMP as ISO strings, but types define Date
    created_at: typeof local.created_at === 'string' ? local.created_at : local.created_at.toISOString(),
    updated_at: typeof local.updated_at === 'string' ? local.updated_at : local.updated_at.toISOString(),
  };
}

/**
 * Convert LocalStore to Store
 */
function convertStore(local: LocalStore): Store {
  return {
    id: local.id,
    name: local.name,
    is_active: local.is_active,
    // DEFENSIVE: PGlite returns TIMESTAMP as ISO strings, but types define Date
    // Runtime check provides backward compatibility with both API (Date) and PGlite (string)
    // TODO (task-016): Normalize LocalStore.created_at type to string at PGlite query layer
    created_at: typeof local.created_at === 'string' ? local.created_at : local.created_at.toISOString(),
    // updated_at is optional in State type
  };
}

/**
 * Convert LocalProductGroup to ProductGroup
 */
function convertProductGroup(local: LocalProductGroup): ProductGroup {
  return {
    id: local.id,
    name: local.name,
    parent_id: local.parent_id,
    is_active: local.is_active,
    // DEFENSIVE: PGlite returns TIMESTAMP as ISO strings, but types define Date
    // Runtime check provides backward compatibility with both API (Date) and PGlite (string)
    // TODO (task-016): Normalize LocalProductGroup.created_at type to string at PGlite query layer
    created_at: typeof local.created_at === 'string' ? local.created_at : local.created_at.toISOString(),
    // updated_at is optional in State type
  };
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize lists manager
 *
 * Sets up Dexie for offline support
 */
export async function initializeListsManager(): Promise<void> {
  debugLog('[ListsManager] Initializing...');

  try {
    // Initialize Dexie for offline support
    const dexieManager = getDexieManager();
    if (!dexieManager.isReady()) {
      await dexieManager.init();
    }

    if (dexieManager.isReady()) {
      updateState({ dexieManager });
      debugLog('[ListsManager] Dexie initialized for offline support');
    } else {
      console.warn('[ListsManager] Dexie initialization failed, offline mode disabled');
    }

    // Listen for network status changes (sync when back online)
    window.addEventListener('offline-status-change', async (event: Event) => {
      const { online } = (event as CustomEvent).detail || {};
      if (online) {
        debugLog('[ListsManager] Network restored, refreshing data...');
        await loadShoppingLists();
        const currentState = getState();
        if (currentState.currentListId) {
          await loadShoppingListItems(currentState.currentListId);
        }
      }
    });

    debugLog('[ListsManager] Initialization complete');
  } catch (error) {
    console.warn('[ListsManager] Dexie initialization error, continuing without offline support:', error);
    // Continue without offline support (API-only mode)
  }
}

/**
 * Check if currently online
 * Uses offlineManager's network detector if available
 */
export function isOnline(): boolean {
  if (window.offlineManager && window.offlineManager.networkDetector) {
    return window.offlineManager.networkDetector.getStatus() !== 'offline';
  }

  // Fallback: check localStorage for autoOfflineMode
  try {
    if (localStorage.getItem('budget_auto_offline_mode') === 'true') {
      return false;
    }
  } catch (e) {
    // Ignore localStorage errors
  }

  return navigator.onLine;
}

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Load all shopping lists (PGlite-first with API fallback)
 *
 * Uses DataLayer for unified data access (task-015 phase 3)
 */
export async function loadShoppingLists(): Promise<void> {
  // DEBUG: Simulate load error for async error testing
  if (shouldSimulateLoadError()) {
    if (isVerboseLoggingEnabled()) {
      debugLog('[ListsManager] ❌ Simulating load error (debug mode)');
    }
    throw new Error('Simulated load error for testing');
  }

  try {
    // DataLayer automatically handles PGlite-first + API fallback
    const localLists = await dataLayer.getShoppingLists({ is_active: true });
    const shoppingLists = localLists.map(convertShoppingList);

    updateState({ shoppingLists });
    debugLog('[ListsManager] Loaded shopping lists:', shoppingLists.length);
  } catch (error) {
    console.error('[ListsManager] Error loading shopping lists:', error);
    showToast('Ошибка загрузки списков', 'error');
    updateState({ shoppingLists: [] });
  }
}

/**
 * Load items for specific shopping list (PGlite-first with API fallback)
 *
 * @param listId - Shopping list numeric ID
 *
 * Uses DataLayer for unified data access (task-015 phase 3)
 */
export async function loadShoppingListItems(listId: number): Promise<void> {
  try {
    // DataLayer now accepts numeric ID and handles Dexie temp_id lookup internally
    const localItems = await dataLayer.getShoppingListItems(listId);

    // Convert to UI types
    const currentItems = localItems.map(item => convertShoppingListItem(item, listId));

    updateState({ currentItems });
    debugLog('[ListsManager] Loaded items:', currentItems.length);

    // Load stores and product groups for dropdowns
    await loadStoresAndGroups();
  } catch (error) {
    console.error('[ListsManager] Error loading items:', error);
    showToast('Ошибка загрузки элементов', 'error');
    updateState({ currentItems: [] });
  }
}

/**
 * Load stores and product groups for dropdowns
 */
/**
 * Load stores (PGlite-first with API fallback)
 * Used by CSVImporter after creating new stores
 */
export async function loadStores(): Promise<void> {
  try {
    const localStores = await dataLayer.getStores();
    const stores = localStores.map(convertStore);
    updateState({ stores });
    debugLog('[ListsManager] Loaded stores:', stores.length);
  } catch (error) {
    console.error('[ListsManager] Error loading stores:', error);
    updateState({ stores: [] });
  }
}

/**
 * Load product groups (PGlite-first with API fallback)
 * Used by CSVImporter after creating new product groups
 */
export async function loadProductGroups(): Promise<void> {
  try {
    const localGroups = await dataLayer.getProductGroups();
    const productGroups = localGroups.map(convertProductGroup);
    updateState({ productGroups });
    debugLog('[ListsManager] Loaded product groups:', productGroups.length);
  } catch (error) {
    console.error('[ListsManager] Error loading product groups:', error);
    updateState({ productGroups: [] });
  }
}

/**
 * Load both stores and product groups (internal helper)
 */
async function loadStoresAndGroups(): Promise<void> {
  await Promise.all([
    loadStores(),
    loadProductGroups()
  ]);
}

/**
 * Switch to a specific shopping list
 *
 * @param listId - Shopping list ID
 */
export async function switchToList(listId: number): Promise<void> {
  updateState({ currentListId: listId });
  await loadShoppingListItems(listId);
}

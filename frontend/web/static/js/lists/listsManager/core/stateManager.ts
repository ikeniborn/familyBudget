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
import type {
  LocalShoppingList,
  ShoppingListWithStats,
  LocalShoppingListItem,
  LocalStore,
  LocalProductGroup
} from '@db/dexie';
import { isValidListId } from '../../utils/listIdUtils';

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
 */
function convertShoppingList(local: LocalShoppingList | ShoppingListWithStats): ShoppingList {
  // DEFENSIVE: Type coercion for temp_id (handle legacy string values from pre-v11.6.0 data)
  let normalizedTempId: number | undefined;
  if (typeof local.temp_id === 'number') {
    normalizedTempId = local.temp_id;
  } else if (typeof local.temp_id === 'string') {
    const parsed = parseInt(local.temp_id, 10);
    normalizedTempId = isNaN(parsed) ? undefined : parsed;
  } else {
    normalizedTempId = undefined;
  }

  return {
    id: local.id || 0, // Use temp_id hash or 0 if no server ID yet
    temp_id: normalizedTempId,     // Preserve PGlite temp_id for write operations (task-015 Phase 4, fixed type coercion)
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
 * Helper: Get numeric temp_id from server ID
 *
 * @param serverId - Server-assigned list ID
 * @returns Numeric temp_id for Dexie query
 */
async function getListTempId(serverId: number): Promise<number> {
  // CRITICAL: Validate serverId before proceeding
  if (!isValidListId(serverId)) {
    throw new Error(
      `[ListsManager] Invalid server ID: ${serverId} (must be positive integer)`
    );
  }

  const state = getState();
  const list = state.shoppingLists.find(l => l.id === serverId);

  if (list?.temp_id) {
    // DEFENSIVE: Handle both number and string temp_id (legacy data compatibility)
    if (typeof list.temp_id === 'number') {
      return list.temp_id;
    } else if (typeof list.temp_id === 'string') {
      const parsed = parseInt(list.temp_id, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    // If temp_id is invalid, fall through to Dexie query below
  }

  // Fallback: query Dexie directly using public API
  try {
    const dexieManager = await getDexieManager();
    const allLists = await dexieManager.queryShoppingLists();
    const dexieList = allLists.find(l => l.id === serverId);

    // CRITICAL FIX (v11.6.1): Return serverId for legacy lists without temp_id
    // Backend supports backward compatible shopping_list_id parameter
    // See listIdUtils.ts for heuristic details (LIST_ID_HEURISTIC_THRESHOLD)
    const resolvedId = dexieList?.temp_id || serverId;

    // Validate resolved ID before returning
    if (!isValidListId(resolvedId)) {
      console.error(
        `[ListsManager] Resolved invalid ID: ${resolvedId} from serverId: ${serverId}`
      );
      // Last resort: return serverId (backend will handle via shopping_list_id)
      return serverId;
    }

    return resolvedId;
  } catch (error) {
    console.warn('[ListsManager] Failed to get temp_id from Dexie:', error);
    // Return serverId as fallback (backward compatible with shopping_list_id)
    return serverId;
  }
}

/**
 * Load items for specific shopping list (PGlite-first with API fallback)
 *
 * @param listId - Shopping list ID or temp_id (number for both Dexie and API)
 *
 * Uses DataLayer for unified data access (task-015 phase 3)
 * FIXED (v11.6.0): Use numeric temp_id instead of string conversion (bug fix)
 */
export async function loadShoppingListItems(listId: number | string): Promise<void> {
  try {
    // Accept both numeric ID (server) and temp_id (client)
    // CRITICAL FIX: Use numeric temp_id instead of string conversion
    const listTempId = typeof listId === 'string'
      ? parseInt(listId, 10) || await getListTempId(parseInt(listId, 10))
      : await getListTempId(listId);

    const localItems = await dataLayer.getShoppingListItems(listTempId);

    // Convert to UI types (use numeric listId for compatibility)
    const numericListId = typeof listId === 'number' ? listId : parseInt(listId, 10) || 0;
    const currentItems = localItems.map(item => convertShoppingListItem(item, numericListId));

    updateState({ currentItems });
    debugLog('[ListsManager] Loaded items:', currentItems.length, 'for temp_id:', listTempId);

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

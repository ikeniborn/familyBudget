/**
 * Lists Manager - State Management
 *
 * Handles initialization and data loading for shopping lists.
 * All data flows through REST API directly (no Dexie cache layer).
 */

import { getState, updateState } from './ListsState';
import type { ShoppingList, ShoppingItem, Store, ProductGroup } from './ListsState';
import { shouldSimulateLoadError, isVerboseLoggingEnabled } from '../testing/debugUtils';

// ============================================================================
// Type Definitions
// ============================================================================

declare const debugLog: (...args: any[]) => void;
declare const showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

declare global {
  interface Window {
    offlineManager?: any;
  }
}

// ============================================================================
// API Response Converters
// ============================================================================

/**
 * Convert API shopping list response to ShoppingList state shape
 */
function convertShoppingList(api: any): ShoppingList {
  return {
    id: api.id,
    temp_id: api.temp_id,
    name: api.name,
    is_active: api.is_active,
    created_at: typeof api.created_at === 'string'
      ? api.created_at
      : (api.created_at?.toISOString?.() ?? new Date().toISOString()),
    updated_at: typeof api.updated_at === 'string'
      ? api.updated_at
      : (api.updated_at?.toISOString?.() ?? new Date().toISOString()),
    description: api.description || undefined,
    total_items: api.total_items,
    completed_items: api.completed_items,
    completion_percentage: api.completion_percentage,
  };
}

/**
 * Convert API shopping list item response to ShoppingItem state shape
 */
function convertShoppingListItem(api: any, listId: number): ShoppingItem {
  return {
    id: api.id,
    list_id: listId,
    temp_id: api.temp_id,
    product_name: api.product_name,
    quantity: api.quantity ?? null,
    unit: api.unit ?? null,
    is_completed: api.is_completed,
    completed_at: api.completed_at
      ? (typeof api.completed_at === 'string' ? api.completed_at : api.completed_at.toISOString())
      : undefined,
    store_id: api.store_id ?? null,
    product_group_id: api.product_group_id ?? null,
    notes: api.comment ?? api.notes ?? null,
    created_at: typeof api.created_at === 'string'
      ? api.created_at
      : (api.created_at?.toISOString?.() ?? undefined),
    updated_at: typeof api.updated_at === 'string'
      ? api.updated_at
      : (api.updated_at?.toISOString?.() ?? undefined),
  };
}

/**
 * Convert API store response to Store state shape
 */
function convertStore(api: any): Store {
  return {
    id: api.id,
    name: api.name,
    is_active: api.is_active,
    created_at: typeof api.created_at === 'string'
      ? api.created_at
      : (api.created_at?.toISOString?.() ?? undefined),
  };
}

/**
 * Convert API product group response to ProductGroup state shape
 */
function convertProductGroup(api: any): ProductGroup {
  return {
    id: api.id,
    name: api.name,
    parent_id: api.parent_id,
    is_active: api.is_active,
    created_at: typeof api.created_at === 'string'
      ? api.created_at
      : (api.created_at?.toISOString?.() ?? undefined),
  };
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize lists manager
 *
 * Sets up reconnect handlers to refresh data from API on network restore.
 */
export async function initializeListsManager(): Promise<void> {
  debugLog('[ListsManager] Initializing...');

  // Listen for network status changes (refresh when back online).
  // Both events signal transitions: 'offline-status-change' (auto-offline / restored)
  // and 'network-status-change' (regular online/offline transitions from networkDetector).
  // Deduplicate via a short-lived flag so we don't double-fire when both arrive.
  let lastReconnectAt = 0;
  const handleReconnect = async () => {
    const now = Date.now();
    if (now - lastReconnectAt < 2000) return;
    lastReconnectAt = now;

    debugLog('[ListsManager] Network restored, refreshing data...');
    await loadShoppingLists();
    const currentState = getState();
    const currentListId = currentState.currentListId;
    if (!currentListId) {
      const { renderLandingView } = await import('../rendering/listRenderer');
      renderLandingView();
    } else if (currentListId) {
      // BUG-7: if the currently-open list was deleted while we were
      // offline, currentListId still points at it on reconnect, and we
      // would fire a 404 against /api/v1/shopping-lists/<id>. Verify
      // the list still exists in the freshly-loaded set; if not, drop
      // the stale id and bounce back to the landing view.
      const stillExists = currentState.shoppingLists.some(
        (list) => list.id === currentListId
      );
      if (!stillExists) {
        debugLog('[ListsManager] Current list no longer exists, returning to landing', {
          currentListId,
        });
        updateState({ currentListId: null, currentItems: [] });
        const { renderLandingView } = await import('../rendering/listRenderer');
        renderLandingView();
        return;
      }
      await loadShoppingListItems(currentListId);
    }
  };

  window.addEventListener('offline-status-change', (event: Event) => {
    const { online } = (event as CustomEvent).detail || {};
    if (online) void handleReconnect();
  });
  window.addEventListener('network-status-change', (event: Event) => {
    const { status, previousStatus } = (event as CustomEvent).detail || {};
    const cameBackOnline =
      previousStatus === 'offline' && (status === 'online' || status === 'degraded');
    if (cameBackOnline) void handleReconnect();
  });
  window.addEventListener('online', () => void handleReconnect());

  debugLog('[ListsManager] Initialization complete');
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
 * Load all shopping lists from API
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
    const params = new URLSearchParams({ is_active: 'true' });
    const response = await fetch(`/api/v1/shopping-lists?${params}`, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const listsArray = Array.isArray(data) ? data : (data.shopping_lists ?? data.lists ?? []);
    const shoppingLists = listsArray.map(convertShoppingList);

    updateState({ shoppingLists });
    debugLog('[ListsManager] Loaded shopping lists:', shoppingLists.length);
  } catch (error) {
    console.error('[ListsManager] Error loading shopping lists:', error);
    showToast('Ошибка загрузки списков', 'error');
    updateState({ shoppingLists: [] });
  }
}

/**
 * Load items for specific shopping list from API
 *
 * @param listId - Shopping list numeric ID
 */
export async function loadShoppingListItems(listId: number): Promise<void> {
  try {
    const params = new URLSearchParams({ shopping_list_id: String(listId) });
    const response = await fetch(`/api/v1/shopping-list-items?${params}`, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const itemsArray = Array.isArray(data) ? data : (data.items ?? data.shopping_list_items ?? []);
    const currentItems = itemsArray.map((item: any) => convertShoppingListItem(item, listId));

    updateState({ currentItems });
    debugLog('[ListsManager] Loaded items:', currentItems.length);

    // Load stores and product groups for dropdowns
    await loadStoresAndGroups();
  } catch (error) {
    console.error('[ListsManager] Error loading items:', error);
    showToast('Ошибка загрузки элементов', 'error');
    // On list switch: items were already cleared by switchToList — no stale data risk.
    // On in-place reload (network restore): preserve last known items for continuity.
  }
}

/**
 * Load stores from API
 * Used by CSVImporter after creating new stores
 */
export async function loadStores(): Promise<void> {
  try {
    const response = await fetch('/api/v1/stores', { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const storesArray = Array.isArray(data) ? data : (data.stores ?? []);
    const stores = storesArray.map(convertStore);
    updateState({ stores });
    debugLog('[ListsManager] Loaded stores:', stores.length);
  } catch (error) {
    console.error('[ListsManager] Error loading stores:', error);
    updateState({ stores: [] });
  }
}

/**
 * Load product groups from API
 * Used by CSVImporter after creating new product groups
 */
export async function loadProductGroups(): Promise<void> {
  try {
    const response = await fetch('/api/v1/product-groups', { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const groupsArray = Array.isArray(data) ? data : (data.product_groups ?? data.groups ?? []);
    const productGroups = groupsArray.map(convertProductGroup);
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
  // Clear stale items from previous list immediately — prevents wrong items showing on load error
  updateState({ currentListId: listId, currentItems: [] });
  await loadShoppingListItems(listId);
}

/**
 * Lists Manager - State Management
 *
 * Handles initialization and data loading for shopping lists.
 * Manages online/offline state, caching, and data synchronization.
 *
 * Phase 3.1: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/listsManager.ts lines 126-708
 */

import { getState, updateState } from './ListsState';

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
// Initialization
// ============================================================================

/**
 * Initialize lists manager
 *
 * Sets up IndexedDB for offline support and OfflineShoppingManager
 */
export async function initializeListsManager(): Promise<void> {
  debugLog('[ListsManager] Initializing...');

  try {
    // Initialize IndexedDB for offline support
    if (typeof IndexedDBManager !== 'undefined') {
      const db = new IndexedDBManager();
      await db.init();
      updateState({ db });
      debugLog('[ListsManager] IndexedDB initialized for offline support');
    } else {
      console.warn('[ListsManager] IndexedDBManager not available, offline mode disabled');
    }

    // Initialize OfflineShoppingManager for offline CRUD operations
    if (window.offlineManager && typeof OfflineShoppingManager !== 'undefined') {
      const offlineShopping = new OfflineShoppingManager(window.offlineManager);
      updateState({ offlineShopping });
      debugLog('[ListsManager] OfflineShoppingManager initialized');
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
    console.error('[ListsManager] Initialization error:', error);
    throw error;
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
 * Load all shopping lists (online or from cache)
 *
 * Fetches from API when online, caches for offline use.
 * Falls back to cache when offline or on error.
 */
export async function loadShoppingLists(): Promise<void> {
  const CACHE_KEY = 'shopping_lists';
  const CACHE_TTL = 86400; // 24 hours

  const state = getState();

  try {
    if (isOnline()) {
      // Online: fetch from API and cache
      const response = await fetch('/api/v1/shopping-lists', {
        credentials: 'same-origin'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const shoppingLists = data.shopping_lists || [];

      updateState({ shoppingLists });

      // Cache for offline use
      if (state.db && shoppingLists.length > 0) {
        await state.db.setCache(CACHE_KEY, shoppingLists, CACHE_TTL);
        debugLog('[ListsManager] Cached shopping lists for offline use');
      }

      debugLog('[ListsManager] Loaded shopping lists from API:', shoppingLists.length);
    } else {
      // Offline: load from cache
      if (state.db) {
        const cached = await state.db.getCache(CACHE_KEY);
        const shoppingLists = cached || [];
        updateState({ shoppingLists });
        debugLog('[ListsManager] Loaded shopping lists from cache:', shoppingLists.length);

        if (shoppingLists.length === 0) {
          showToast('Списки недоступны в offline режиме. Посетите страницу online.', 'warning');
        }
      } else {
        updateState({ shoppingLists: [] });
        console.warn('[ListsManager] Offline and no cache available');
      }
    }
  } catch (error) {
    console.error('[ListsManager] Error loading shopping lists:', error);

    // Fallback to cache on error
    if (state.db) {
      try {
        const cached = await state.db.getCache(CACHE_KEY);
        const shoppingLists = cached || [];
        updateState({ shoppingLists });
        debugLog('[ListsManager] Loaded shopping lists from cache (fallback):', shoppingLists.length);
      } catch (cacheError) {
        console.error('[ListsManager] Error loading shopping lists from cache:', cacheError);
        showToast('Ошибка загрузки списков', 'error');
        updateState({ shoppingLists: [] });
      }
    } else {
      showToast('Ошибка загрузки списков', 'error');
      updateState({ shoppingLists: [] });
    }
  }
}

/**
 * Load items for specific shopping list (online or from cache)
 *
 * @param listId - Shopping list ID
 */
export async function loadShoppingListItems(listId: number): Promise<void> {
  const CACHE_KEY = `shopping_list_items_${listId}`;
  const CACHE_TTL = 86400; // 24 hours

  const state = getState();

  try {
    if (isOnline()) {
      // Online: fetch from API and cache
      const response = await fetch(`/api/v1/shopping-list-items?shopping_list_id=${listId}`, {
        credentials: 'same-origin'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const currentItems = data.items || [];
      updateState({ currentItems });

      // Cache for offline use
      if (state.db) {
        await state.db.setCache(CACHE_KEY, currentItems, CACHE_TTL);
        debugLog('[ListsManager] Cached shopping list items for offline use');
      }

      debugLog('[ListsManager] Loaded items from API:', currentItems.length);
    } else {
      // Offline: load from cache
      if (state.db) {
        const cached = await state.db.getCache(CACHE_KEY);
        const currentItems = cached || [];
        updateState({ currentItems });
        debugLog('[ListsManager] Loaded items from cache:', currentItems.length);
      } else {
        updateState({ currentItems: [] });
        console.warn('[ListsManager] Offline and no cache available');
      }
    }

    // Load stores and product groups for dropdowns
    await loadStoresAndGroups();
  } catch (error) {
    console.error('[ListsManager] Error loading items:', error);

    // Fallback to cache on error
    if (state.db) {
      try {
        const cached = await state.db.getCache(CACHE_KEY);
        const currentItems = cached || [];
        updateState({ currentItems });
        debugLog('[ListsManager] Loaded items from cache (fallback):', currentItems.length);
      } catch (cacheError) {
        console.error('[ListsManager] Error loading items from cache:', cacheError);
        showToast('Ошибка загрузки элементов', 'error');
        updateState({ currentItems: [] });
      }
    } else {
      showToast('Ошибка загрузки элементов', 'error');
      updateState({ currentItems: [] });
    }
  }
}

/**
 * Load stores and product groups for dropdowns
 */
async function loadStoresAndGroups(): Promise<void> {
  const CACHE_KEY_STORES = 'stores';
  const CACHE_KEY_GROUPS = 'product_groups';
  const CACHE_TTL = 86400; // 24 hours

  const state = getState();

  try {
    if (isOnline()) {
      // Load stores
      const storesResponse = await fetch('/api/v1/stores', { credentials: 'same-origin' });
      if (storesResponse.ok) {
        const storesData = await storesResponse.json();
        const stores = storesData.stores || [];
        updateState({ stores });

        if (state.db) {
          await state.db.setCache(CACHE_KEY_STORES, stores, CACHE_TTL);
        }
      }

      // Load product groups
      const groupsResponse = await fetch('/api/v1/product-groups', { credentials: 'same-origin' });
      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        const productGroups = groupsData.product_groups || [];
        updateState({ productGroups });

        if (state.db) {
          await state.db.setCache(CACHE_KEY_GROUPS, productGroups, CACHE_TTL);
        }
      }
    } else {
      // Load from cache
      if (state.db) {
        const cachedStores = await state.db.getCache(CACHE_KEY_STORES);
        const cachedGroups = await state.db.getCache(CACHE_KEY_GROUPS);

        updateState({
          stores: cachedStores || [],
          productGroups: cachedGroups || []
        });
      }
    }
  } catch (error) {
    console.error('[ListsManager] Error loading stores/groups:', error);
    // Continue with empty arrays (non-critical)
  }
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

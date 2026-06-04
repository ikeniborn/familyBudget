/**
 * HierarchyView Integration Module
 *
 * Provides compatibility layer between modular TypeScript structure and HierarchyView class.
 * HierarchyView expects a listsManager object with specific methods and properties.
 *
 * v7.0.1 - Created to fix empty hierarchy tree issue
 */

import { getState, updateState } from '../core/ListsState';
import { filterItemsBySearch, renderItemsTable, renderCurrentView } from './tableBuilder';
import { loadShoppingListItems, loadShoppingLists, loadStores, loadProductGroups } from '../core/stateManager';
import { deleteItem } from '../core/listOperations';
import { initStoreChoices, initProductGroupChoices } from '../ui/modalManager';
import { HierarchyView } from './HierarchyView';

// Type declarations for global functions
declare const debugLog: (...args: any[]) => void;

/**
 * Count nested product group nodes recursively.
 * Mirrors the structure used by HierarchyView.expandProductGroupTree so the
 * total matches what expandAll() actually adds to expandedNodes.
 */
function countProductGroupNodes(
  pgTree: Record<number, any> | undefined | null
): number {
  if (!pgTree) return 0;
  let count = 0;
  Object.values(pgTree).forEach((pg: any) => {
    count++;
    count += countProductGroupNodes(pg?.children);
  });
  return count;
}

/**
 * Count total nodes in hierarchy (stores + every nested product group).
 * Used by updateHierarchyToggleButton to determine toggle state.
 */
function getTotalNodeCount(): number {
  const state = getState();

  if (!state.hierarchyView) return 0;

  const hierarchy = state.hierarchyView.buildHierarchy(
    state.currentItems,
    state.stores,
    state.productGroups
  );

  let total = 0;
  Object.values(hierarchy).forEach((store: any) => {
    total++; // Store node
    // HierarchyView.buildHierarchy stores nested groups under productGroupTree
    // (the previous implementation read store.groups, which never existed —
    // expandAll() registered far more nodes than this counter knew about and
    // updateHierarchyToggleButton() never landed in the "all expanded" branch).
    total += countProductGroupNodes(store.productGroupTree);
  });

  return total;
}

/**
 * Update smart toggle button state based on expanded/collapsed nodes
 * Called by HierarchyView after render operations
 */
export function updateHierarchyToggleButton(): void {
  const btn = document.getElementById('hierarchy-toggle-btn');
  const icon = document.getElementById('hierarchy-toggle-icon');
  const text = document.getElementById('hierarchy-toggle-text');

  if (!btn || !icon || !text) return;

  const state = getState();
  const totalNodes = getTotalNodeCount();
  const expandedCount = state.hierarchyView ? state.hierarchyView.expandedNodes.size : 0;

  debugLog(`[HIERARCHY] Toggle state: ${expandedCount}/${totalNodes} expanded`);

  // All expanded → show "Collapse"
  if (expandedCount === totalNodes && totalNodes > 0) {
    icon.textContent = '⬆️';
    text.textContent = 'Свернуть';
    btn.title = 'Свернуть все узлы';
    btn.dataset.action = 'collapse';
  }
  // Any collapsed → show "Expand"
  else {
    icon.textContent = '⬇️';
    text.textContent = 'Развернуть';
    btn.title = 'Развернуть все узлы';
    btn.dataset.action = 'expand';
  }
}

/**
 * Create listsManager compatibility object for HierarchyView and ImportManager
 *
 * Legacy components expect a listsManager object with these properties/methods:
 * - filterItemsBySearch(): ShoppingItem[]
 * - updateHierarchyToggleButton(): void
 * - loadShoppingListItems(listId: number): Promise<void>
 * - loadShoppingLists(): Promise<void>
 * - loadStores(): Promise<void>
 * - loadProductGroups(): Promise<void>
 * - deleteItem(itemId: number, skipConfirm?: boolean): Promise<void>
 * - renderItemsTable(): void
 * - initStoreChoices(): void
 * - initProductGroupChoices(): void
 * - stores: Store[]
 * - productGroups: ProductGroup[]
 * - searchQuery: string
 * - hideCompleted: boolean
 * - currentItems: ShoppingItem[]
 * - currentListId: number | null
 */
export function createListsManagerProxy(): any {
  return {
    // Method delegation
    filterItemsBySearch,
    updateHierarchyToggleButton,
    loadShoppingListItems,
    loadShoppingLists,
    loadStores,
    loadProductGroups,
    deleteItem,
    renderItemsTable,
    renderCurrentView,
    initStoreChoices,
    initProductGroupChoices,

    // Property getters (dynamic - always return current state)
    get stores() {
      return getState().stores;
    },
    get productGroups() {
      return getState().productGroups;
    },
    get searchQuery() {
      return getState().searchQuery;
    },
    get hideCompleted() {
      return getState().hideCompleted;
    },
    get currentItems() {
      return getState().currentItems;
    },
    get currentListId() {
      return getState().currentListId;
    }
  };
}

/**
 * Initialize HierarchyView with listsManager compatibility proxy
 * Should be called during listsManager initialization
 */
export function initializeHierarchyView(): void {
  // Create compatibility proxy
  const listsManagerProxy = createListsManagerProxy();

  // Initialize HierarchyView (TypeScript class)
  const hierarchyView = new HierarchyView(listsManagerProxy);

  // Store in state
  updateState({ hierarchyView });

  // Export to window for onclick handlers (hierarchyView.js uses window.hierarchyView.toggleNode)
  window.hierarchyView = hierarchyView;

  debugLog('[HIERARCHY] ✅ HierarchyView initialized with listsManager proxy');

  // CRITICAL: On mobile, render hierarchy view immediately after initialization
  // This prevents table view from showing (renderCurrentView was waiting for hierarchyView)
  const state = getState();
  const isMobile = window.innerWidth < 640;

  if (isMobile && state.currentView === 'hierarchy' && state.currentListId !== null) {
    debugLog('[HIERARCHY] Mobile detected - rendering hierarchy view immediately');
    hierarchyView.render();
  }
}

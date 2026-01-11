/**
 * HierarchyView Integration Module
 *
 * Provides compatibility layer between modular TypeScript structure and HierarchyView class.
 * HierarchyView expects a listsManager object with specific methods and properties.
 *
 * v7.0.1 - Created to fix empty hierarchy tree issue
 */

import { getState, updateState } from '../core/ListsState';
import { filterItemsBySearch } from './tableBuilder';

// Type declarations for global functions
declare const debugLog: (...args: any[]) => void;

/**
 * Count total nodes in hierarchy (stores + product groups)
 * Used by updateHierarchyToggleButton to determine toggle state
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
    if (store.groups) {
      total += Object.keys(store.groups).length; // Product group nodes
    }
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
 * Create listsManager compatibility object for HierarchyView
 *
 * HierarchyView expects a listsManager object with these properties/methods:
 * - filterItemsBySearch(): ShoppingItem[]
 * - updateHierarchyToggleButton(): void
 * - stores: Store[]
 * - productGroups: ProductGroup[]
 * - searchQuery: string
 * - hideCompleted: boolean
 * - currentItems: ShoppingItem[]
 */
export function createListsManagerProxy(): any {
  return {
    // Method delegation
    filterItemsBySearch,
    updateHierarchyToggleButton,

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
    }
  };
}

/**
 * Initialize HierarchyView with listsManager compatibility proxy
 * Should be called during listsManager initialization
 */
export function initializeHierarchyView(): void {
  // Check if HierarchyView class is available globally
  if (typeof window.HierarchyView === 'undefined') {
    debugLog('[HIERARCHY] WARNING: HierarchyView class not available (hierarchyView.js not loaded)');
    return;
  }

  // Create compatibility proxy
  const listsManagerProxy = createListsManagerProxy();

  // Initialize HierarchyView
  const hierarchyView = new window.HierarchyView(listsManagerProxy);

  // Store in state
  updateState({ hierarchyView });

  // Export to window for onclick handlers (hierarchyView.js uses window.hierarchyView.toggleNode)
  window.hierarchyView = hierarchyView;

  debugLog('[HIERARCHY] ✅ HierarchyView initialized with listsManager proxy');
}

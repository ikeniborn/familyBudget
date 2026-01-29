/**
 * Central state management for lists manager
 *
 * Replaces 60+ instance properties from listsManager.ts with a single state object.
 * This module has ZERO dependencies to prevent circular dependencies.
 *
 * Phase 2: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/listsManager.ts lines 60-99
 */

export {}; // Force module scope

// ============================================================================
// Type Definitions
// ============================================================================

export interface ShoppingList {
  id: number;
  temp_id?: string;              // PGlite temp_id for offline operations (task-015 Phase 4)
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  description?: string;          // Optional description
  total_items?: number;          // Total item count (from API)
  completed_items?: number;      // Completed item count (from API)
  completion_percentage?: number; // Completion percentage (from API, 0-100)
}

export interface ShoppingItem {
  id: number;
  list_id: number;
  temp_id?: string;               // PGlite temp_id for offline operations (task-015 Phase 4)
  product_name: string;
  quantity: number | null;
  unit: string | null;
  is_completed: boolean;
  completed_at?: string;
  store_id: number | null;
  product_group_id: number | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Store {
  id: number;
  name: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProductGroup {
  id: number;
  name: string;
  parent_id?: number | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ListsState {
  // Current context
  currentListId: number | null;
  currentView: 'table' | 'hierarchy';

  // Data
  shoppingLists: ShoppingList[];
  currentItems: ShoppingItem[];
  stores: Store[];
  productGroups: ProductGroup[];

  // UI state
  selectedItemIds: Set<number>;
  searchQuery: string;
  hideCompleted: boolean;

  // Autocomplete
  currentSuggestions: any[];
  currentDuplicateItem: any;

  // Choices.js instances
  choicesInstances: Record<string, any>;

  // Hierarchy view instance (HierarchyView class)
  hierarchyView: any | null;

  // IndexedDB instance (offline support)
  db: any | null;

  // Offline shopping manager (Phase 3.1)
  offlineShopping: any | null;

  // Debounced functions
  debouncedSearch: (() => void) | null;
  quantityChangeHandler: ((e: Event) => void) | null;
  handleUnitChange: ((event: any) => void) | null;

  // Autocomplete timer
  autocompleteTimer: ReturnType<typeof setTimeout> | null;
}

// ============================================================================
// State Storage (Singleton)
// ============================================================================

let state: ListsState = {
  currentListId: null,
  currentView: 'table',
  shoppingLists: [],
  currentItems: [],
  stores: [],
  productGroups: [],
  selectedItemIds: new Set(),
  searchQuery: '',
  hideCompleted: false,
  currentSuggestions: [],
  currentDuplicateItem: null,
  choicesInstances: {},
  hierarchyView: null,
  db: null,
  offlineShopping: null,
  debouncedSearch: null,
  quantityChangeHandler: null,
  handleUnitChange: null,
  autocompleteTimer: null
};

// ============================================================================
// State Accessors
// ============================================================================

/**
 * Get current state (read-only)
 *
 * Returns a readonly reference to prevent accidental mutations.
 * Use updateState() to modify state.
 */
export const getState = (): Readonly<ListsState> => state;

/**
 * Update state (partial updates)
 *
 * @param updates - Partial state object with fields to update
 *
 * @example
 * updateState({ currentListId: 42, searchQuery: 'milk' });
 */
export const updateState = (updates: Partial<ListsState>): void => {
  state = { ...state, ...updates };
};

/**
 * Reset state to initial values
 *
 * Called on logout or when switching to a different user.
 */
export const resetState = (): void => {
  state = {
    currentListId: null,
    currentView: 'table',
    shoppingLists: [],
    currentItems: [],
    stores: [],
    productGroups: [],
    selectedItemIds: new Set(),
    searchQuery: '',
    hideCompleted: false,
    currentSuggestions: [],
    currentDuplicateItem: null,
    choicesInstances: {},
    hierarchyView: null,
    db: null,
    offlineShopping: null,
    debouncedSearch: null,
    quantityChangeHandler: null,
    handleUnitChange: null,
    autocompleteTimer: null
  };
};

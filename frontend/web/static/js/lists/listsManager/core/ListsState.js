/**
 * Central state management for lists manager
 *
 * Replaces 60+ instance properties from listsManager.ts with a single state object.
 * This module has ZERO dependencies to prevent circular dependencies.
 *
 * Phase 2: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/listsManager.ts lines 60-99
 */
// ============================================================================
// State Storage (Singleton)
// ============================================================================
let state = {
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
export const getState = () => state;
/**
 * Update state (partial updates)
 *
 * @param updates - Partial state object with fields to update
 *
 * @example
 * updateState({ currentListId: 42, searchQuery: 'milk' });
 */
export const updateState = (updates) => {
    state = { ...state, ...updates };
};
/**
 * Reset state to initial values
 *
 * Called on logout or when switching to a different user.
 */
export const resetState = () => {
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
//# sourceMappingURL=ListsState.js.map
/**
 * listsManager - Public API for shopping lists management
 *
 * Modular architecture (Phase 2: ES Modules Migration):
 * - core/: State management + CRUD operations
 * - rendering/: DOM rendering + table building
 * - features/: Search, autocomplete, bulk operations
 * - ui/: Modals, toasts, confirmations
 * - integration/: API, WebSocket, offline sync
 *
 * Usage:
 * ```typescript
 * import { getState, loadShoppingLists, renderLandingView } from '@web/lists/listsManager';
 * ```
 */

// ============================================================================
// Core State
// ============================================================================

export { getState, updateState, resetState } from './core/ListsState';
export type {
  ShoppingList,
  ShoppingItem,
  Store,
  ProductGroup,
  ListsState
} from './core/ListsState';

// ============================================================================
// State Manager (Phase 3.1: Complete)
// ============================================================================

export {
  initializeListsManager,
  isOnline,
  loadShoppingLists,
  loadShoppingListItems,
  switchToList
} from './core/stateManager';

// ============================================================================
// CRUD Operations (Phase 3.1 part 2: Complete)
// ============================================================================

export {
  createItem,
  updateItem,
  deleteItem,
  deleteMultipleItems,
  toggleItemCompleted
} from './core/listOperations';

export type { ItemData } from './core/listOperations';

// ============================================================================
// Rendering (Phase 3.2: Complete)
// ============================================================================

export {
  renderItemsTable,
  renderCurrentView,
  filterItemsBySearch,
  getProductGroupBreadcrumbs
} from './rendering/tableBuilder';

export {
  renderLandingView,
  renderDetailView,
  renderShoppingListCards
} from './rendering/listRenderer';

// ============================================================================
// Features (Phase 3.3: Complete)
// ============================================================================

export {
  handleSearch,
  clearSearch,
  toggleHideCompleted
} from './features/searchFilter';

export {
  toggleSelectAll,
  selectCompleted,
  deleteSelected,
  updateSelectionUI
} from './features/multiSelect';

export {
  setupProductAutocomplete,
  hideProductSuggestions
} from './features/autocomplete';

// ============================================================================
// UI (TODO: Create UI modules)
// ============================================================================

/*
export {
  openAddItemModal,
  openEditItemModal,
  closeItemModal
} from './ui/modalManager';
*/

// ============================================================================
// Integration (TODO: Create integration modules)
// ============================================================================

/*
export {
  handleItemCreated,
  handleItemUpdated,
  handleItemDeleted
} from './integration/wsEventHandler';
*/

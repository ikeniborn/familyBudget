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
// CRUD Operations (TODO: Create listOperations.ts)
// ============================================================================

/*
export {
  createItem,
  updateItem,
  deleteItem,
  toggleItemCompleted
} from './core/listOperations';
*/

// ============================================================================
// Rendering (TODO: Create rendering modules)
// ============================================================================

/*
export {
  renderLandingView,
  renderDetailView
} from './rendering/listRenderer';

export {
  renderItemsTable,
  updateItemInTable
} from './rendering/tableBuilder';
*/

// ============================================================================
// Features (TODO: Create feature modules)
// ============================================================================

/*
export {
  handleSearch,
  clearSearch,
  toggleHideCompleted
} from './features/searchFilter';

export {
  toggleSelectAll,
  deleteSelected
} from './features/multiSelect';

export {
  showProductSuggestions,
  selectSuggestion
} from './features/autocomplete';
*/

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

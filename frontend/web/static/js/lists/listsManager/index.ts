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
  toggleItemCompleted,
  updateItemsCache
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
  renderShoppingListCards,
  updateFABVisibility,
  switchView,
  initializeResponsiveView
} from './rendering/listRenderer';

export {
  initializeHierarchyView,
  updateHierarchyToggleButton
} from './rendering/hierarchyIntegration';

// ============================================================================
// Features (Phase 3.3: Complete)
// ============================================================================

export {
  handleSearch,
  clearSearch,
  toggleHideCompleted,
  toggleSearchField,
  updateFABButtons
} from './features/searchFilter';

export {
  toggleSelectAll,
  selectCompleted,
  deleteSelected,
  updateSelectionUI,
  confirmDelete,
  closeDeleteConfirmModal
} from './features/multiSelect';

export {
  setupProductAutocomplete,
  hideProductSuggestions
} from './features/autocomplete';

export {
  markAllCompleted,
  unmarkAllCompleted,
  deleteCompleted
} from './features/bulkActions';

// ============================================================================
// UI (Phase 3.4: Complete)
// ============================================================================

export {
  openAddItemModal,
  openEditItemModal,
  closeItemModal,
  handleDeleteFromModal,
  handleSaveItem,
  openCreateListModal,
  closeCreateListModal,
  handleCreateList,
  openDeleteListModal,
  closeDeleteListModal,
  confirmDeleteList
} from './ui/modalManager';

export { toggleListsFAB } from './ui/fabManager';

// ============================================================================
// Integration (Phase 3.5: Complete)
// ============================================================================

export {
  handleItemCreated,
  handleItemUpdated,
  handleItemDeleted,
  handleItemCompletedToggled,
  handleShoppingListDeleted
} from './integration/wsEventHandlers';

export { initializeImportManager } from './integration/importIntegration';

// ============================================================================
// Global Helpers (Phase 7.x: Navigation & Modals) - v7.x.x migration fix
// ============================================================================

export {
  openModal,
  navigateHomeOfflineFriendly,
  handleMobileAddButton,
  updateMobileAddButton
} from './ui/globalHelpers';

// ============================================================================
// Hierarchy View Classes (Phase 7.x: TypeScript Migration)
// ============================================================================

export { HierarchyView } from './rendering/HierarchyView';
export { SwipeHandler } from './rendering/SwipeHandler';

export type {
  HierarchyTree,
  HierarchyStore,
  HierarchyProductGroup,
  HierarchyItem,
  ListsManagerProxy
} from './types/hierarchy';

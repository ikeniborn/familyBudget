/**
 * Type definitions for Hierarchy View
 *
 * Defines data structures for hierarchical shopping list rendering:
 * Store → ProductGroup (nested) → Items
 */

/**
 * Hierarchy Item - leaf node in the tree
 */
export interface HierarchyItem {
  type: 'item';
  id: number;
  product_name: string;
  quantity: number | null;
  unit: string | null;
  is_completed: boolean;
  store_id: number | null;
  product_group_id: number | null;
  notes: string | null;
  list_id: number;
}

/**
 * Hierarchy Product Group - intermediate node with children and items
 */
export interface HierarchyProductGroup {
  type: 'product_group';
  id: number;
  name: string;
  storeId: number;
  parent_id: number | null;
  children: Record<number, HierarchyProductGroup>;
  items: HierarchyItem[];
  totalItems?: number;
  completedItems?: number;
}

/**
 * Hierarchy Store - root node in the tree
 */
export interface HierarchyStore {
  type: 'store';
  id: number;
  name: string;
  productGroupTree: Record<number, HierarchyProductGroup>;
  totalItems?: number;
  completedItems?: number;
}

/**
 * Complete hierarchy tree - stores indexed by store ID
 */
export type HierarchyTree = Record<number, HierarchyStore>;

/**
 * HTML Element with attached touch event handlers
 * Used to store handlers on DOM elements for cleanup
 */
export interface HTMLElementWithHandlers extends HTMLElement {
  _touchStartHandler?: (e: TouchEvent) => void;
  _touchMoveHandler?: (e: TouchEvent) => void;
  _touchEndHandler?: (e: TouchEvent) => void;
  _clickHandler?: (e: MouseEvent) => void;
  _blockTouchStart?: (e: TouchEvent) => void;
  _blockTouchEnd?: (e: TouchEvent) => void;
  _blockClick?: (e: MouseEvent) => void;
}

/**
 * ListsManager Proxy Interface
 *
 * HierarchyView and ImportManager expect a listsManager object
 * with these properties and methods. This interface ensures type safety
 * when creating the compatibility proxy.
 */
export interface ListsManagerProxy {
  // Dynamic properties (getters)
  stores: any[];
  productGroups: any[];
  currentItems: any[];
  searchQuery: string;
  hideCompleted: boolean;
  currentListId: number | null;

  // Methods
  filterItemsBySearch(): any[];
  updateHierarchyToggleButton(): void;
  loadShoppingListItems(listId: number): Promise<void>;
  loadStores(): Promise<void>;
  loadProductGroups(): Promise<void>;
  deleteItem(itemId: number, skipConfirm?: boolean): Promise<void>;
  renderItemsTable(): void;
  initStoreChoices(): void;
  initProductGroupChoices(): void;
}

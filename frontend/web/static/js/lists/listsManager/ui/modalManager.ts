/**
 * Lists Manager - Modal Management
 *
 * Handles all modal dialogs: create list, add/edit item, delete confirmations.
 * Manages form initialization, Choices.js selectors, and duplicate detection.
 *
 * Phase 3.4: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/listsManager.ts lines 2996-3653
 */

import { getState, updateState, type ShoppingList } from '../core/ListsState';
import { deleteItem, createItem, updateItem } from '../core/listOperations';
import { renderDetailView, renderLandingView } from '../rendering/listRenderer';
import { loadShoppingLists } from '../core/stateManager';
import { setupProductAutocomplete, hideProductSuggestions } from '../features/autocomplete';
import { getNetworkDelay, isVerboseLoggingEnabled } from '../testing/debugUtils';

// ============================================================================
// Type Definitions
// ============================================================================

declare const showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
declare const debugLog: (...args: any[]) => void;
declare const Choices: any; // Choices.js library

/** Choices.js instance interface for type safety */
interface ChoicesInstance {
  passedElement: { element: HTMLSelectElement };
  destroy(): void;
  setChoiceByValue(value: string): void;
}

/** API response interface for shopping list creation */
interface CreateListAPIResponse {
  id: number;
  name: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  total_items?: number;
  completed_items?: number;
  completion_percentage?: number;
}

declare global {
  interface Window {
    deleteListId?: number;
  }
}

// ============================================================================
// Create List Modal
// ============================================================================

/**
 * Open create list modal
 */
export function openCreateListModal(): void {
  const modal = document.getElementById('create-list-modal') as HTMLDialogElement | null;
  const form = document.getElementById('create-list-form') as HTMLFormElement | null;
  if (form) form.reset();
  if (modal) (modal as any).showModal();
}

/**
 * Close create list modal
 */
export function closeCreateListModal(): void {
  const modal = document.getElementById('create-list-modal') as HTMLDialogElement | null;
  if (modal) (modal as any).close();
}

/**
 * Handle create list form submission
 */
export async function handleCreateList(event: Event): Promise<void> {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const formData = new FormData(form);

  const data = {
    name: formData.get('name'),
    description: formData.get('description') || null
  };

  try {
    const response = await fetch('/api/v1/shopping-lists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: CreateListAPIResponse = await response.json();
    showToast('Список создан', 'success');

    // Close modal
    closeCreateListModal();

    // OPTIMISTIC UPDATE: render before API responds for snappy UX
    const newList: ShoppingList = {
      id: result.id,
      name: result.name,
      description: result.description || undefined,
      is_active: result.is_active ?? true,
      created_at: result.created_at || new Date().toISOString(),
      updated_at: result.updated_at || new Date().toISOString(),
      total_items: result.total_items ?? 0,
      completed_items: result.completed_items ?? 0,
      completion_percentage: result.completion_percentage ?? 0
    };

    // Update state optimistically with duplicate check
    const currentState = getState();
    const existingIndex = currentState.shoppingLists.findIndex(l => l.id === newList.id);

    if (existingIndex >= 0) {
      // Replace existing list (handle edge case of duplicate)
      const updated = [...currentState.shoppingLists];
      updated[existingIndex] = newList;
      updateState({ shoppingLists: updated });
      debugLog('[ListsManager] Replaced existing list in state', { listId: newList.id });
    } else {
      // Add new list
      updateState({
        shoppingLists: [...currentState.shoppingLists, newList]
      });
      debugLog('[ListsManager] Added new list to state', { listId: newList.id });
    }

    // Reload shopping lists from API so state.shoppingLists reflects server truth
    await loadShoppingLists();

    // Open the newly created list immediately
    await renderDetailView(newList.id);
  } catch (error) {
    console.error('[ListsManager] Error creating list:', error);
    showToast('Ошибка создания списка', 'error');
  }
}

// ============================================================================
// Item Modal (Add/Edit)
// ============================================================================

/**
 * Attach a native `close` event listener to #item-modal exactly once.
 *
 * This guarantees the autocomplete dropdown and z-index state are cleaned up
 * on ALL close paths — Esc key, native backdrop button, or any direct
 * `dialog.close()` call — not just the explicit `closeItemModal()` helper.
 *
 * Without this, the Portal-mounted #product-suggestions-dropdown would stay
 * visible after Esc/backdrop close and intercept clicks across the page.
 */
function ensureItemModalCloseCleanup(): void {
  const modal = document.getElementById('item-modal') as HTMLDialogElement | null;
  if (modal && !(modal as any).__closeCleanupAttached) {
    modal.addEventListener('close', () => {
      // Cleanup on ALL close paths (Esc / backdrop / native dialog.close())
      dropdownZIndexManager.reset();
      hideProductSuggestions();
    });
    (modal as any).__closeCleanupAttached = true;
  }
}

/**
 * Open add item modal
 */
export function openAddItemModal(): void {
  const modal = document.getElementById('item-modal') as HTMLDialogElement | null;
  ensureItemModalCloseCleanup();
  const form = document.getElementById('item-form') as HTMLFormElement | null;
  if (form) form.reset();
  const itemIdInput = document.getElementById('item-id') as HTMLInputElement | null;
  if (itemIdInput) itemIdInput.value = '';
  const modalTitle = document.getElementById('item-modal-title');
  if (modalTitle) modalTitle.textContent = '📝 Добавить товар';

  // form.reset() restores DEFAULT option but doesn't blank a select that has
  // no empty default. Force the underlying selects (and any cached text inputs)
  // to empty BEFORE Choices.js rebuilds, so the new instance starts clean.
  const storeSelect = document.getElementById('item-store') as HTMLSelectElement | null;
  if (storeSelect) storeSelect.value = '';
  const groupSelect = document.getElementById('item-product-group') as HTMLSelectElement | null;
  if (groupSelect) groupSelect.value = '';
  const productNameInput = document.getElementById('item-product-name') as HTMLInputElement | null;
  if (productNameInput) productNameInput.value = '';
  const commentInput = document.getElementById('item-comment') as HTMLInputElement | null;
  if (commentInput) commentInput.value = '';
  const quantityInputClear = document.getElementById('item-quantity') as HTMLInputElement | null;
  if (quantityInputClear) quantityInputClear.value = '';

  // Reinitialize Choices.js with latest data (fixes issue after CSV import)
  // This ensures newly created stores/groups are visible
  initStoreChoices();
  initProductGroupChoices();

  // Belt-and-braces clear: after Choices.js rebuilds, force its internal
  // selection back to empty so prior store/group choices don't reappear.
  const stateAfterInit = getState();
  stateAfterInit.choicesInstances?.store?.setChoiceByValue('');
  stateAfterInit.choicesInstances?.productGroup?.setChoiceByValue('');

  // Reset quantity input step to default (integer)
  const quantityInput = document.getElementById('item-quantity') as HTMLInputElement | null;
  if (quantityInput) {
    quantityInput.step = '1';
  }

  // Ensure autocomplete is set up (mobile fix)
  setupProductAutocomplete();

  // Initialize duplicate detection
  initializeDuplicateDetection();

  // Hide duplicate warning on modal open
  hideDuplicateWarning();

  // Hide delete button (not applicable for new items)
  const deleteBtn = document.getElementById('item-modal-delete-btn');
  if (deleteBtn) {
    deleteBtn.classList.add('hidden');
    debugLog('[MODAL_ADD] Delete button hidden (new item mode)');
  }

  if (modal) (modal as any).showModal();
}

/**
 * Open edit item modal
 */
export function openEditItemModal(itemId: number): void {
  const state = getState();
  const item = state.currentItems.find((i: any) => i.id === itemId);
  if (!item) {
    showToast('Товар не найден', 'error');
    return;
  }

  const modal = document.getElementById('item-modal') as HTMLDialogElement | null;
  ensureItemModalCloseCleanup();
  const itemIdInput = document.getElementById('item-id') as HTMLInputElement | null;
  const productNameInput = document.getElementById('item-product-name') as HTMLInputElement | null;
  const quantityInput = document.getElementById('item-quantity') as HTMLInputElement | null;
  const unitSelect = document.getElementById('item-unit') as HTMLSelectElement | null;
  const commentInput = document.getElementById('item-comment') as HTMLInputElement | null;
  const modalTitle = document.getElementById('item-modal-title');

  if (itemIdInput) itemIdInput.value = String(item.id);
  if (productNameInput) productNameInput.value = item.product_name;
  if (quantityInput) quantityInput.value = item.quantity !== null ? String(item.quantity) : '';
  if (unitSelect) unitSelect.value = item.unit || '';
  if (commentInput) commentInput.value = item.notes || '';
  if (modalTitle) modalTitle.textContent = '✏️ Редактировать товар';

  // Show delete button (only for existing items, not new items)
  const deleteBtn = document.getElementById('item-modal-delete-btn');
  if (deleteBtn) {
    deleteBtn.classList.remove('hidden');
    debugLog('[MODAL_EDIT] Delete button shown', { itemId });
  }

  // Quantity input is now always integer (step="1" in HTML)
  debugLog('[LISTS_MODAL] Quantity input configured for integers only (step=1)');

  // Reinitialize Choices.js with latest data
  initStoreChoices();
  initProductGroupChoices();

  // Set selected values for store and product group (after reinitialization)
  if (state.choicesInstances?.store && item.store_id) {
    state.choicesInstances.store.setChoiceByValue(item.store_id.toString());
  }
  if (state.choicesInstances?.productGroup && item.product_group_id) {
    state.choicesInstances.productGroup.setChoiceByValue(item.product_group_id.toString());
  }

  // Ensure autocomplete is set up (mobile fix)
  setupProductAutocomplete();

  if (modal) (modal as any).showModal();
}

/**
 * Close item modal
 *
 * IMPORTANT: Cleans up swipe state before closing to prevent visual glitches
 * where items remain shifted (translateX) after modal closes.
 */
export function closeItemModal(): void {
  // Reset dropdown z-index state to ensure clean state on modal close
  dropdownZIndexManager.reset();

  // Clear product-suggestions dropdown so the empty .suggestion-item portal
  // doesn't intercept clicks on table rows after the modal closes (BUG-6).
  hideProductSuggestions();

  // STEP 1: Cleanup swipe state BEFORE closing modal
  // This prevents items from staying shifted left after swipe-to-edit
  const hierarchyView = (window as any).hierarchyView;
  if (hierarchyView?.swipeHandler) {
    const swipeHandler = hierarchyView.swipeHandler;

    // If modal was opened by swipe, reset the swiped item
    if (swipeHandler.modalOpenedBySwipe) {
      const itemId = swipeHandler.modalOpenedBySwipe;
      const swipedElement = document.querySelector(
        `.hierarchy-item[data-item-id="${itemId}"]`
      ) as HTMLElement | null;

      if (swipedElement) {
        const contentElement = swipedElement.querySelector('.hierarchy-item-content') as HTMLElement | null;
        const hadTransform = contentElement?.style.transform || 'none';

        debugLog('[MODAL_CLOSE] Cleaning up swipe state', {
          itemId,
          hadTransform,
          timestamp: Date.now(),
          source: 'closeItemModal'
        });

        // Reset transform and state
        swipeHandler.resetSwipe(itemId, swipedElement);

        const afterTransform = contentElement?.style.transform || 'none';
        debugLog('[MODAL_CLOSE] Swipe state cleaned', {
          itemId,
          beforeTransform: hadTransform,
          afterTransform,
          cleared: afterTransform === 'translateX(0px)' || afterTransform === '' || afterTransform === 'none'
        });
      } else {
        console.warn('[MODAL_CLOSE] Swiped element not found in DOM', { itemId });
      }

      // Always clear the flag even if element not found
      // This prevents stale state if item was deleted
      swipeHandler.modalOpenedBySwipe = null;
      debugLog('[MODAL_CLOSE] Swipe flag cleared');
    } else {
      debugLog('[MODAL_CLOSE] Modal not opened by swipe, no cleanup needed');
    }
  } else {
    debugLog('[MODAL_CLOSE] SwipeHandler not available (desktop or hierarchy view not initialized)');
  }

  // STEP 2: Close modal
  const modal = document.getElementById('item-modal') as HTMLDialogElement | null;
  if (modal) {
    debugLog('[MODAL_CLOSE] Closing item modal');
    (modal as any).close();
  } else {
    console.error('[MODAL_CLOSE] Modal element not found');
  }
}

/**
 * Handle delete from modal
 * Called when user clicks Delete button in edit modal
 */
export async function handleDeleteFromModal(): Promise<void> {
  const itemIdInput = document.getElementById('item-id') as HTMLInputElement | null;
  if (!itemIdInput) return;
  const itemId = parseInt(itemIdInput.value);

  if (!itemId) {
    console.error('[DELETE_MODAL] No item ID found');
    return;
  }

  debugLog('[DELETE_MODAL] Delete initiated', {
    itemId,
    timestamp: Date.now(),
    source: 'modal_button'
  });

  // Close modal first (better UX - user sees item disappear from list)
  closeItemModal();

  // Delete item using existing deleteItem method
  // (already handles confirmation)
  await deleteItem(itemId);

  debugLog('[DELETE_MODAL] Delete completed', { itemId });
}

/**
 * Handle item form submission (create or update)
 * Called from lists.html line 311: <form onsubmit="handleSaveItem(event)">
 *
 * Created: 2026-01-11 (v7.x.x migration fix)
 */
export async function handleSaveItem(event: Event): Promise<void> {
  event.preventDefault();

  const form = event.target as HTMLFormElement;
  const formData = new FormData(form);

  const itemId = formData.get('item_id');
  const isEdit = itemId !== null && itemId !== '';

  // Extract form data
  const storeId = formData.get('store_id') as string;
  const productGroupId = formData.get('product_group_id') as string;
  const productName = formData.get('product_name') as string;
  const quantityStr = formData.get('quantity') as string;
  const unit = formData.get('unit') as string;
  const comment = formData.get('comment') as string;

  // Validate required fields
  if (!storeId || !productGroupId || !productName) {
    debugLog('[ITEM_SAVE] Missing required fields', {
      storeId: !!storeId,
      productGroupId: !!productGroupId,
      productName: !!productName
    });
    showToast('Заполните обязательные поля', 'error');
    return;
  }

  // Build item data object
  const data: any = {
    store_id: parseInt(storeId, 10),
    product_group_id: parseInt(productGroupId, 10),
    product_name: productName,
    quantity: quantityStr ? parseFloat(quantityStr) : null,
    unit: unit || null,
    comment: comment || null
  };

  debugLog('[ITEM_SAVE] Starting save', {
    isEdit,
    itemId,
    data
  });

  try {
    if (isEdit) {
      // Update existing item
      await updateItem(parseInt(itemId as string, 10), data);
      showToast('Товар обновлён', 'success');
    } else {
      // Create new item
      await createItem(data);
      showToast('Товар добавлен', 'success');
    }

    // Close modal on success
    closeItemModal();

    debugLog('[ITEM_SAVE] Save successful', { isEdit, itemId });

  } catch (error) {
    console.error('[ITEM_SAVE] Error:', error);
    showToast('Ошибка сохранения товара', 'error');
  }
}

// ============================================================================
// Delete List Modal
// ============================================================================

/**
 * Open delete list modal
 */
export function openDeleteListModal(listId: number, listName: string): void {
  // Store listId for later use
  window.deleteListId = listId;

  // Update modal content
  const nameElement = document.getElementById('delete-list-name');
  if (nameElement) nameElement.textContent = listName;

  // Open modal
  const modal = document.getElementById('delete-list-modal') as HTMLDialogElement | null;
  if (modal) modal.showModal();

  debugLog('[DeleteList] Modal opened for list:', listId);
}

/**
 * Close delete list modal
 */
export function closeDeleteListModal(): void {
  const modal = document.getElementById('delete-list-modal') as HTMLDialogElement | null;
  if (modal) modal.close();
  window.deleteListId = undefined;

  debugLog('[DeleteList] Modal closed');
}

/**
 * Confirm delete list
 */
export async function confirmDeleteList(): Promise<void> {
  const listId = window.deleteListId;

  if (!listId) {
    showToast('Ошибка: список не выбран', 'error');
    return;
  }

  try {
    // Close modal
    closeDeleteListModal();

    // Show loading
    showToast('Удаление списка...', 'info');

    debugLog('[DeleteList] Deleting list:', listId);

    // DEBUG: Network delay simulation for race condition testing
    const networkDelay = getNetworkDelay();
    if (networkDelay > 0) {
      if (isVerboseLoggingEnabled()) {
        debugLog(`[DeleteList] 🐌 Simulating slow network: ${networkDelay}ms delay`);
      }
      await new Promise(resolve => setTimeout(resolve, networkDelay));
    }

    // Call DELETE endpoint
    const response = await fetch(`/api/v1/shopping-lists/${listId}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });

    if (!response.ok) {
      // Parse error response
      let errorDetail = `HTTP ${response.status}`;
      try {
        const error = await response.json();
        errorDetail = error.detail || errorDetail;
      } catch (e) {
        // Failed to parse JSON, use status code
      }

      // Handle 404 Not Found (already deleted)
      if (response.status === 404) {
        showToast('Список уже удалён', 'info');
        await renderLandingView();  // Refresh UI anyway
        return;
      }

      throw new Error(errorDetail);
    }

    // Success - reload landing view
    showToast('✅ Список успешно удален', 'success');

    debugLog('[DeleteList] List deleted successfully:', listId);

    // Reload landing view (will now fetch fresh data from API)
    await renderLandingView();

  } catch (error) {
    console.error('[DeleteList] Error deleting list:', error);
    showToast(`❌ Ошибка удаления: ${(error as Error).message}`, 'error');
  }
}

// ============================================================================
// Edit List Modal
// ============================================================================

/**
 * Open edit list modal — reads current list from state, fills name/description
 */
export function openEditListModal(listId?: number): void {
  const state = getState();
  const id = listId ?? state.currentListId;
  if (!id) {
    showToast('Список не выбран', 'error');
    return;
  }

  const list = state.shoppingLists.find(l => l.id === id);
  if (!list) {
    showToast('Список не найден', 'error');
    return;
  }

  const modal = document.getElementById('edit-list-modal') as HTMLDialogElement | null;
  const nameInput = document.getElementById('edit-list-name') as HTMLInputElement | null;
  const descInput = document.getElementById('edit-list-description') as HTMLTextAreaElement | null;
  const hiddenId = document.getElementById('edit-list-id') as HTMLInputElement | null;

  if (nameInput) nameInput.value = list.name;
  if (descInput) descInput.value = list.description || '';
  if (hiddenId) hiddenId.value = String(id);

  if (modal) modal.showModal();
}

/**
 * Close edit list modal
 */
export function closeEditListModal(): void {
  const modal = document.getElementById('edit-list-modal') as HTMLDialogElement | null;
  if (modal) modal.close();
}

/**
 * Handle edit list form submission — PUT /api/v1/shopping-lists/{id}
 */
export async function handleEditList(event: Event): Promise<void> {
  event.preventDefault();

  const form = event.target as HTMLFormElement;
  const formData = new FormData(form);

  const listId = parseInt(formData.get('list_id') as string, 10);
  const name = (formData.get('name') as string).trim();
  const description = (formData.get('description') as string).trim() || null;

  if (!listId || !name) {
    showToast('Название обязательно', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/v1/shopping-lists/${listId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name, description })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const updated = await response.json();

    // Update in-memory state
    const state = getState();
    const idx = state.shoppingLists.findIndex(l => l.id === listId);
    if (idx >= 0) {
      const updatedList = { ...state.shoppingLists[idx], name: updated.name, description: updated.description };
      const lists = [...state.shoppingLists];
      lists[idx] = updatedList;
      updateState({ shoppingLists: lists });
    }

    // Update breadcrumb title in detail view
    const breadcrumb = document.getElementById('breadcrumb-list-name');
    if (breadcrumb) breadcrumb.textContent = updated.name;

    // Refresh landing page cards (for when user navigates back)
    const { renderShoppingListCards } = await import('../rendering/listRenderer');
    renderShoppingListCards();

    closeEditListModal();
    showToast('Список обновлён', 'success');

  } catch (error) {
    console.error('[EDIT_LIST] Error updating list:', error);
    showToast('Ошибка обновления списка', 'error');
  }
}

// ============================================================================
// Choices.js Dropdown Z-Index Management
// ============================================================================

/**
 * Encapsulated manager for dropdown z-index state.
 * Handles case when both store & product-group dropdowns are open simultaneously.
 */
const dropdownZIndexManager = {
  /** Counter for open dropdowns */
  count: 0,

  /**
   * Handle dropdown open event - add z-index fix class to modal
   */
  open(): void {
    this.count++;
    const modal = document.getElementById('item-modal');
    if (modal) {
      modal.classList.add('store-dropdown-open');
      debugLog('[LISTS_MODAL] Dropdown opened, store-dropdown-open class added', {
        openCount: this.count
      });
    }
  },

  /**
   * Handle dropdown close event - remove z-index fix class when all dropdowns closed
   */
  close(): void {
    this.count = Math.max(0, this.count - 1);
    if (this.count === 0) {
      const modal = document.getElementById('item-modal');
      if (modal) {
        modal.classList.remove('store-dropdown-open');
        debugLog('[LISTS_MODAL] All dropdowns closed, store-dropdown-open class removed');
      }
    } else {
      debugLog('[LISTS_MODAL] Dropdown closed, other still open', { openCount: this.count });
    }
  },

  /**
   * Reset state - used when modal closes to ensure clean state
   */
  reset(): void {
    this.count = 0;
    const modal = document.getElementById('item-modal');
    if (modal) {
      modal.classList.remove('store-dropdown-open');
      debugLog('[LISTS_MODAL] Modal closing, store-dropdown-open class removed');
    }
  }
};

/**
 * Setup dropdown z-index event handlers for a Choices.js instance
 * @param choicesInstance - Choices.js instance
 * @param dropdownName - Name for logging ('store' or 'productGroup')
 */
function setupDropdownZIndexHandlers(choicesInstance: ChoicesInstance, dropdownName: string): void {
  if (!choicesInstance?.passedElement?.element) {
    console.warn(`[LISTS_MODAL] Cannot setup z-index handlers for ${dropdownName} - no element`);
    return;
  }

  const element = choicesInstance.passedElement.element;

  element.addEventListener('showDropdown', () => {
    debugLog(`[LISTS_MODAL] ${dropdownName} showDropdown event`);
    dropdownZIndexManager.open();
  });

  element.addEventListener('hideDropdown', () => {
    debugLog(`[LISTS_MODAL] ${dropdownName} hideDropdown event`);
    dropdownZIndexManager.close();
  });

  debugLog(`[LISTS_MODAL] Z-index event handlers attached for ${dropdownName}`);
}

// ============================================================================
// Choices.js Initialization
// ============================================================================

/**
 * Initialize Choices.js for store selector
 */
export function initStoreChoices(): void {
  const state = getState();
  const selectElement = document.getElementById('item-store') as HTMLSelectElement | null;

  if (!selectElement) {
    console.warn('[Choices] Store select element not found');
    return;
  }

  // Destroy existing instance
  if (state.choicesInstances?.store) {
    state.choicesInstances.store.destroy();
    delete state.choicesInstances.store;
  }

  // Build options
  const stores = state.stores || [];
  selectElement.innerHTML = '<option value="">Выберите магазин</option>' +
    stores.map(store => `<option value="${store.id}">${store.name}</option>`).join('');

  // Initialize Choices.js
  try {
    if (typeof Choices !== 'undefined') {
      const choices = new Choices(selectElement, {
        searchEnabled: stores.length > 5,
        shouldSort: false,
        itemSelectText: '',
        noResultsText: 'Ничего не найдено',
        noChoicesText: 'Нет вариантов',
        placeholderValue: 'Выберите магазин'
      });

      // Store instance
      if (!state.choicesInstances) {
        updateState({ choicesInstances: {} });
      }
      state.choicesInstances.store = choices;

      // Setup z-index handlers for dropdown (fixes #item-modal dropdown visibility)
      setupDropdownZIndexHandlers(choices, 'store');
    }
  } catch (error) {
    console.error('[Choices] Error initializing store choices:', error);
  }
}

/**
 * Initialize Choices.js for product group selector
 */
export function initProductGroupChoices(): void {
  const state = getState();
  const selectElement = document.getElementById('item-product-group') as HTMLSelectElement | null;

  if (!selectElement) {
    console.warn('[Choices] Product group select element not found');
    return;
  }

  // Destroy existing instance
  if (state.choicesInstances?.productGroup) {
    state.choicesInstances.productGroup.destroy();
    delete state.choicesInstances.productGroup;
  }

  // Build hierarchical options
  const groups = state.productGroups || [];
  selectElement.innerHTML = '<option value="">Выберите группу</option>' +
    buildProductGroupOptions(groups);

  // Initialize Choices.js
  try {
    if (typeof Choices !== 'undefined') {
      const choices = new Choices(selectElement, {
        searchEnabled: groups.length > 5,
        shouldSort: false,
        itemSelectText: '',
        noResultsText: 'Ничего не найдено',
        noChoicesText: 'Нет вариантов',
        placeholderValue: 'Выберите группу'
      });

      // Store instance
      if (!state.choicesInstances) {
        updateState({ choicesInstances: {} });
      }
      state.choicesInstances.productGroup = choices;

      // Setup z-index handlers for dropdown (fixes #item-modal dropdown visibility)
      setupDropdownZIndexHandlers(choices, 'productGroup');
    }
  } catch (error) {
    console.error('[Choices] Error initializing product group choices:', error);
  }
}

/**
 * Build hierarchical product group options HTML
 */
function buildProductGroupOptions(groups: any[]): string {
  // Build tree structure
  const groupMap: Record<number, any> = {};
  const rootGroups: any[] = [];

  groups.forEach(g => {
    groupMap[g.id] = { ...g, children: [] };
  });

  groups.forEach(g => {
    if (g.parent_id && groupMap[g.parent_id]) {
      groupMap[g.parent_id].children.push(groupMap[g.id]);
    } else {
      rootGroups.push(groupMap[g.id]);
    }
  });

  // Render tree recursively
  function renderGroup(group: any, level: number): string {
    const indent = '&nbsp;&nbsp;'.repeat(level);
    let html = `<option value="${group.id}">${indent}${group.name}</option>`;

    if (group.children && group.children.length > 0) {
      group.children.forEach((child: any) => {
        html += renderGroup(child, level + 1);
      });
    }

    return html;
  }

  return rootGroups.map(g => renderGroup(g, 0)).join('');
}

// ============================================================================
// Duplicate Detection
// ============================================================================

/**
 * Initialize duplicate detection on product name and store change
 */
function initializeDuplicateDetection(): void {
  const state = getState();
  const productInput = document.getElementById('item-product-name');
  const storeSelect = document.getElementById('item-store');
  const quantityInput = document.getElementById('item-quantity');

  if (!productInput || !storeSelect) {
    console.warn('[LISTS] Duplicate detection inputs not found');
    return;
  }

  // Remove old listeners if they exist (prevent duplicates)
  if (state.debouncedSearch) {
    productInput.removeEventListener('input', state.debouncedSearch);
    storeSelect.removeEventListener('change', state.debouncedSearch);
    debugLog('[LISTS] Removed old duplicate detection listeners');
  }

  if (state.quantityChangeHandler && quantityInput) {
    quantityInput.removeEventListener('input', state.quantityChangeHandler);
    debugLog('[LISTS] Removed old quantity listener');
  }

  // Create new debounced search handler
  let searchTimeout: ReturnType<typeof setTimeout> | undefined;
  const debouncedSearch = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const productName = (productInput as HTMLInputElement).value.trim();
      const storeId = parseInt((storeSelect as HTMLSelectElement).value);

      if (productName && storeId && state.currentListId) {
        const duplicate = await searchDuplicate(productName, storeId);
        if (duplicate) {
          showDuplicateWarning(duplicate);
        } else {
          hideDuplicateWarning();
        }
      } else {
        hideDuplicateWarning();
      }
    }, 500); // 500ms debounce
  };

  // Add new listeners
  productInput.addEventListener('input', debouncedSearch);
  storeSelect.addEventListener('change', debouncedSearch);

  // Listen for quantity changes to update future quantity
  if (quantityInput) {
    const quantityChangeHandler = () => {
      debugLog('[FUTURE_QTY] Quantity input changed, updating future quantity display');
      updateFutureQuantity();
    };
    quantityInput.addEventListener('input', quantityChangeHandler);
    debugLog('[LISTS] Future quantity listener initialized');

    updateState({ quantityChangeHandler });
  } else {
    console.warn('[LISTS] Quantity input not found (id=item-quantity)');
  }

  updateState({ debouncedSearch });
  debugLog('[LISTS] Duplicate detection initialized');
}

/**
 * Search for duplicate item in current list
 */
async function searchDuplicate(productName: string, storeId: number): Promise<any | null> {
  const state = getState();

  if (!productName || !storeId || !state.currentListId) {
    return null;
  }

  try {
    debugLog('[DUPLICATE_SEARCH] Searching for duplicate', {
      productName,
      storeId,
      listId: state.currentListId
    });

    const url = new URL('/api/v1/shopping-list-items/check-duplicate', window.location.origin);
    url.searchParams.set('shopping_list_id', String(state.currentListId));
    url.searchParams.set('product_name', productName.trim());
    url.searchParams.set('store_id', String(storeId));

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin'
    });

    if (!response.ok) {
      console.error('[DUPLICATE_SEARCH] API error', { status: response.status });
      return null;
    }

    const data = await response.json();

    if (data && data.id) {
      console.warn('[DUPLICATE_SEARCH] Duplicate found', {
        itemId: data.id,
        quantity: data.quantity,
        unit: data.unit
      });
      return data;
    }

    debugLog('[DUPLICATE_SEARCH] No duplicate found');
    return null;

  } catch (error) {
    console.error('[DUPLICATE_SEARCH] Error searching duplicate', { error: (error as Error).message });
    return null;
  }
}

/**
 * Display duplicate warning in modal
 */
function showDuplicateWarning(duplicateItem: any): void {
  const container = document.getElementById('duplicate-warning-container');
  const details = document.getElementById('duplicate-details');

  if (!container || !details) {
    console.warn('[DUPLICATE_SEARCH] Warning UI elements not found');
    return;
  }

  // Build details text
  let detailsText = `<strong>${duplicateItem.product_name}</strong>`;

  if (duplicateItem.quantity && duplicateItem.unit) {
    detailsText += ` - ${duplicateItem.quantity} ${duplicateItem.unit}`;
  } else if (duplicateItem.quantity) {
    detailsText += ` - количество: ${duplicateItem.quantity}`;
  }

  if (duplicateItem.comment) {
    detailsText += ` <span class="text-gray-600">(${duplicateItem.comment})</span>`;
  }

  details.innerHTML = detailsText;
  container.classList.remove('hidden');

  // Store duplicate item for later use in save
  updateState({ currentDuplicateItem: duplicateItem });

  // Calculate and show future quantity if quantity already entered
  updateFutureQuantity();

  debugLog('[DUPLICATE_SEARCH] Warning displayed', { itemId: duplicateItem.id });
}

/**
 * Hide duplicate warning
 */
function hideDuplicateWarning(): void {
  const container = document.getElementById('duplicate-warning-container');
  if (container) {
    container.classList.add('hidden');
  }
  updateState({ currentDuplicateItem: null });
}

/**
 * Update future quantity display in duplicate warning
 */
function updateFutureQuantity(): void {
  const state = getState();
  const futureQtyElement = document.getElementById('future-quantity');

  if (!futureQtyElement || !state.currentDuplicateItem) {
    return;
  }

  const quantityInput = document.getElementById('item-quantity') as HTMLInputElement | null;
  const newQuantity = quantityInput ? parseFloat(quantityInput.value) : 0;

  if (!newQuantity) {
    futureQtyElement.textContent = '';
    return;
  }

  const existingQuantity = state.currentDuplicateItem.quantity || 0;
  const futureQuantity = existingQuantity + newQuantity;
  const unit = state.currentDuplicateItem.unit || '';

  futureQtyElement.textContent = ` → ${futureQuantity} ${unit}`;

  debugLog('[FUTURE_QTY] Updated', {
    existing: existingQuantity,
    new: newQuantity,
    future: futureQuantity
  });
}


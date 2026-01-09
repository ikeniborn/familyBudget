/**
 * Lists Manager - Modal Management
 *
 * Handles all modal dialogs: create list, add/edit item, delete confirmations.
 * Manages form initialization, Choices.js selectors, and duplicate detection.
 *
 * Phase 3.4: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/listsManager.ts lines 2996-3653
 */

import { getState, updateState } from '../core/ListsState';
import { loadShoppingLists } from '../core/stateManager';
import { deleteItem } from '../core/listOperations';
import { renderDetailView, renderLandingView } from '../rendering/listRenderer';
import { setupProductAutocomplete } from '../features/autocomplete';

// ============================================================================
// Type Definitions
// ============================================================================

declare const showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
declare const debugLog: (...args: any[]) => void;
declare const Choices: any; // Choices.js library

declare global {
  interface Window {
    deleteListId?: number;
    listsManager?: any;
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

    const result = await response.json();
    showToast('Список создан', 'success');

    // Close modal
    closeCreateListModal();

    // Reload and open new list
    await loadShoppingLists();
    await renderDetailView(result.id);
  } catch (error) {
    console.error('[ListsManager] Error creating list:', error);
    showToast('Ошибка создания списка', 'error');
  }
}

// ============================================================================
// Item Modal (Add/Edit)
// ============================================================================

/**
 * Open add item modal
 */
export function openAddItemModal(): void {
  const modal = document.getElementById('item-modal') as HTMLDialogElement | null;
  const form = document.getElementById('item-form') as HTMLFormElement | null;
  if (form) form.reset();
  const itemIdInput = document.getElementById('item-id') as HTMLInputElement | null;
  if (itemIdInput) itemIdInput.value = '';
  const modalTitle = document.getElementById('item-modal-title');
  if (modalTitle) modalTitle.textContent = '📝 Добавить товар';

  // Reinitialize Choices.js with latest data (fixes issue after CSV import)
  // This ensures newly created stores/groups are visible
  initStoreChoices();
  initProductGroupChoices();

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
    console.log('[MODAL_ADD] Delete button hidden (new item mode)');
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
  const itemIdInput = document.getElementById('item-id') as HTMLInputElement | null;
  const productNameInput = document.getElementById('item-product-name') as HTMLInputElement | null;
  const quantityInput = document.getElementById('item-quantity') as HTMLInputElement | null;
  const unitSelect = document.getElementById('item-unit') as HTMLSelectElement | null;
  const commentInput = document.getElementById('item-comment') as HTMLInputElement | null;
  const modalTitle = document.getElementById('item-modal-title');

  if (itemIdInput) itemIdInput.value = String(item.id);
  if (productNameInput) productNameInput.value = item.name;
  if (quantityInput) quantityInput.value = item.quantity !== null ? String(item.quantity) : '';
  if (unitSelect) unitSelect.value = item.unit || '';
  if (commentInput) commentInput.value = item.notes || '';
  if (modalTitle) modalTitle.textContent = '✏️ Редактировать товар';

  // Show delete button (only for existing items, not new items)
  const deleteBtn = document.getElementById('item-modal-delete-btn');
  if (deleteBtn) {
    deleteBtn.classList.remove('hidden');
    console.log('[MODAL_EDIT] Delete button shown', { itemId });
  }

  // Quantity input is now always integer (step="1" in HTML)
  console.log('[LISTS_MODAL] Quantity input configured for integers only (step=1)');

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

        console.log('[MODAL_CLOSE] Cleaning up swipe state', {
          itemId,
          hadTransform,
          timestamp: Date.now(),
          source: 'closeItemModal'
        });

        // Reset transform and state
        swipeHandler.resetSwipe(itemId, swipedElement);

        const afterTransform = contentElement?.style.transform || 'none';
        console.log('[MODAL_CLOSE] Swipe state cleaned', {
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
      console.log('[MODAL_CLOSE] Swipe flag cleared');
    } else {
      console.log('[MODAL_CLOSE] Modal not opened by swipe, no cleanup needed');
    }
  } else {
    console.log('[MODAL_CLOSE] SwipeHandler not available (desktop or hierarchy view not initialized)');
  }

  // STEP 2: Close modal
  const modal = document.getElementById('item-modal') as HTMLDialogElement | null;
  if (modal) {
    console.log('[MODAL_CLOSE] Closing item modal');
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

  console.log('[DELETE_MODAL] Delete initiated', {
    itemId,
    timestamp: Date.now(),
    source: 'modal_button'
  });

  // Close modal first (better UX - user sees item disappear from list)
  closeItemModal();

  // Delete item using existing deleteItem method
  // (already handles confirmation, offline support, cache update)
  await deleteItem(itemId);

  console.log('[DELETE_MODAL] Delete completed', { itemId });
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

      // Handle 403 Forbidden (not creator)
      if (response.status === 403) {
        throw new Error('Только создатель списка может его удалить');
      }

      throw new Error(errorDetail);
    }

    // Success - reload landing view
    showToast('✅ Список успешно удален', 'success');

    debugLog('[DeleteList] List deleted successfully:', listId);

    // Reload shopping lists
    await renderLandingView();

  } catch (error) {
    console.error('[DeleteList] Error deleting list:', error);
    showToast(`❌ Ошибка удаления: ${(error as Error).message}`, 'error');
  }
}

// ============================================================================
// Choices.js Initialization
// ============================================================================

/**
 * Initialize Choices.js for store selector
 */
function initStoreChoices(): void {
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
    }
  } catch (error) {
    console.error('[Choices] Error initializing store choices:', error);
  }
}

/**
 * Initialize Choices.js for product group selector
 */
function initProductGroupChoices(): void {
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
    console.log('[LISTS] Removed old duplicate detection listeners');
  }

  if (state.quantityChangeHandler && quantityInput) {
    quantityInput.removeEventListener('input', state.quantityChangeHandler);
    console.log('[LISTS] Removed old quantity listener');
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
      console.log('[FUTURE_QTY] Quantity input changed, updating future quantity display');
      updateFutureQuantity();
    };
    quantityInput.addEventListener('input', quantityChangeHandler);
    console.log('[LISTS] Future quantity listener initialized');

    updateState({ quantityChangeHandler });
  } else {
    console.warn('[LISTS] Quantity input not found (id=item-quantity)');
  }

  updateState({ debouncedSearch });
  console.log('[LISTS] Duplicate detection initialized');
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
    console.log('[DUPLICATE_SEARCH] Searching for duplicate', {
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

    console.log('[DUPLICATE_SEARCH] No duplicate found');
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

  console.log('[DUPLICATE_SEARCH] Warning displayed', { itemId: duplicateItem.id });
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

  console.log('[FUTURE_QTY] Updated', {
    existing: existingQuantity,
    new: newQuantity,
    future: futureQuantity
  });
}


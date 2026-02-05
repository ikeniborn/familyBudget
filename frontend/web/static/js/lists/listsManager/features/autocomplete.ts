/**
 * Lists Manager - Product Autocomplete
 *
 * Handles product name autocomplete with caching and mobile optimization.
 * Supports restoring soft-deleted items and filling form from suggestions.
 *
 * Phase 3.3: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/listsManager.ts lines 2519-2958
 */

import { getState } from '../core/ListsState';
import { loadShoppingListItems, isOnline } from '../core/stateManager';

// ============================================================================
// Type Definitions
// ============================================================================

declare const debugLog: (...args: any[]) => void;
declare const showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

// Module state
let autocompleteTimer: number | null = null;
let currentSuggestions: any[] = [];

// ============================================================================
// Initialization
// ============================================================================

/**
 * Setup product autocomplete on input field
 */
export function setupProductAutocomplete(): void {
  const input = document.getElementById('item-product-name');

  if (!input) {
    return;
  }

  const handler = () => {
    handleProductInput((input as HTMLInputElement).value);
  };

  // Multiple events for cross-browser mobile compatibility
  input.addEventListener('input', handler);      // Primary (desktop & some mobile)
  input.addEventListener('keyup', handler);      // Fallback for mobile keyboards
  input.addEventListener('compositionend', handler); // IME input (iOS, Android)

  (input as any)._autocompleteInitialized = true;

  // Setup click handler for dropdown (iOS fix)
  setupSuggestionsClickHandler();

  debugLog('[ListsManager] Product autocomplete initialized');
}

/**
 * Setup click/touch handler for suggestions dropdown (iOS-compatible)
 * Uses event delegation pattern for dynamic content
 */
function setupSuggestionsClickHandler(): void {
  const dropdown = document.getElementById('product-suggestions-dropdown');
  if (!dropdown || (dropdown as any)._clickHandlerInitialized) {
    return;
  }

  // Shared handler for both touch and click events
  const handleSelection = (event: any, isTouchEvent = false) => {
    // Find closest .suggestion-item (handles taps/clicks on child elements)
    const suggestionItem = event.target.closest('.suggestion-item');
    if (!suggestionItem) return;

    // Prevent ghost click on touch devices
    if (isTouchEvent) {
      event.preventDefault();
    }

    // Get suggestion index from data attribute
    const index = parseInt(suggestionItem.dataset.index, 10);
    if (!isNaN(index)) {
      selectSuggestion(index);
    }
  };

  // iOS Safari: touchstart event (fires BEFORE click)
  dropdown.addEventListener('touchstart', (event: Event) => {
    handleSelection(event, true);
  }, { passive: false }); // passive: false allows preventDefault()

  // Desktop & fallback: click event
  dropdown.addEventListener('click', (event: Event) => {
    handleSelection(event, false);
  });

  (dropdown as any)._clickHandlerInitialized = true;
  debugLog('[ListsManager] Suggestions click/touch handlers initialized (iOS-compatible)');
}

// ============================================================================
// Input Handling
// ============================================================================

/**
 * Handle product input for autocomplete
 */
function handleProductInput(value: string): void {
  // Clear previous debounce timer
  if (autocompleteTimer) {
    clearTimeout(autocompleteTimer);
  }

  // Hide dropdown if query too short
  if (!value || value.length < 2) {
    hideProductSuggestions();
    return;
  }

  // Debounce API calls (300ms)
  autocompleteTimer = window.setTimeout(() => {
    showProductSuggestions(value);
  }, 300);
}

// ============================================================================
// Suggestions Fetching and Rendering
// ============================================================================

/**
 * Fetch and show product suggestions
 */
async function showProductSuggestions(query: string): Promise<void> {
  if (query.length < 2) {
    hideProductSuggestions();
    return;
  }

  const state = getState();

  try {
    let suggestions = [];

    if (isOnline()) {
      // Online: fetch from API
      // Include shopping_list_id to get deleted items for restore
      const params = new URLSearchParams({
        q: query,
        limit: '10'
      });

      // Add shopping_list_id if we have a current list (enables restore of deleted items)
      if (state.currentListId) {
        params.append('shopping_list_id', String(state.currentListId));
        params.append('include_deleted', 'true');
      }

      const url = `/api/v1/shopping-list-items/products/suggest?${params}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        suggestions = data.suggestions || [];

        // Cache suggestions (deprecated - Dexie migration)
        // Caching now handled by DataLayer shoppingListItems table
      }
    } else {
      // Offline: search in cached suggestions
      suggestions = await searchCachedSuggestions(query);
    }

    renderSuggestionsDropdown(suggestions);

  } catch (error) {
    console.error('[Autocomplete] Error fetching suggestions:', error);
    // Offline fallback removed - Dexie migration
    // DataLayer handles offline suggestions automatically
  }
}

/**
 * Render suggestions dropdown (Portal pattern for iOS Safari fix)
 * Dropdown is rendered in body with position: fixed and positioned via JS
 */
function renderSuggestionsDropdown(suggestions: any[]): void {
  const dropdown = document.getElementById('product-suggestions-dropdown');
  if (!dropdown) return;

  if (!suggestions || suggestions.length === 0) {
    hideProductSuggestions();
    return;
  }

  // Build dropdown HTML
  // Deleted items are visually marked with warning border and restore badge
  const html = suggestions.map((s, index) => `
    <div class="suggestion-item px-3 py-2 hover:bg-base-200 cursor-pointer ${s.is_deleted ? 'bg-base-200/50 border-l-2 border-warning' : ''}"
         data-index="${index}"
         data-is-deleted="${s.is_deleted || false}"
         data-item-id="${s.id || ''}">
      <div class="flex items-center gap-2">
        <span class="font-medium text-sm">${escapeHtml(s.product_name)}</span>
        ${s.is_deleted ? '<span class="badge badge-warning badge-xs">восстановить</span>' : ''}
      </div>
      <div class="text-xs text-base-content/60">
        ${s.store_name ? `<span class="mr-2">🏪 ${escapeHtml(s.store_name)}</span>` : ''}
        ${s.product_group_name ? `<span>📦 ${escapeHtml(s.product_group_name)}</span>` : ''}
        ${s.is_deleted && s.quantity ? `<span class="ml-2">📊 ${s.quantity}${s.unit || ''}</span>` : ''}
      </div>
    </div>
  `).join('');

  dropdown.innerHTML = html;

  // Position dropdown below input field (Portal pattern)
  const input = document.getElementById('item-product-name');
  if (input) {
    const inputRect = input.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Calculate position (below input, aligned left)
    let top = inputRect.bottom + 4; // 4px gap (mt-1)
    const left = inputRect.left;
    const width = inputRect.width;

    // Ensure dropdown doesn't overflow viewport
    const maxHeight = 240; // max-h-60 = 15rem = 240px
    if (top + maxHeight > viewportHeight) {
      // Show above input if not enough space below
      top = inputRect.top - maxHeight - 4;
    }

    // Apply positioning
    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;
    dropdown.style.width = `${width}px`;
  }

  // Show dropdown
  dropdown.classList.remove('hidden');

  // Store suggestions for selection
  currentSuggestions = suggestions;

  debugLog('[ListsManager] Showing', suggestions.length, 'suggestions');
}

/**
 * Hide product suggestions dropdown
 */
export function hideProductSuggestions(): void {
  const dropdown = document.getElementById('product-suggestions-dropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
  }
  currentSuggestions = [];
}

// ============================================================================
// Suggestion Selection
// ============================================================================

/**
 * Select a suggestion from dropdown
 * Handles both regular suggestions (fill form) and deleted items (restore via API)
 */
async function selectSuggestion(index: number): Promise<void> {
  const suggestion = currentSuggestions?.[index];
  if (!suggestion) return;

  // If item is deleted - restore it via API instead of filling form
  if (suggestion.is_deleted && suggestion.id) {
    await restoreDeletedItem(suggestion);
    return;
  }

  // Regular suggestion - fill form with values
  fillFormFromSuggestion(suggestion);
  hideProductSuggestions();

  debugLog('[ListsManager] Selected suggestion:', suggestion.product_name);
}

/**
 * Restore a soft-deleted item via API
 */
async function restoreDeletedItem(suggestion: any): Promise<void> {
  if (!suggestion.id) {
    console.error('[ListsManager] Cannot restore: no item ID');
    return;
  }

  try {
    debugLog('[ListsManager] Restoring deleted item:', suggestion.id, suggestion.product_name);

    const response = await fetch(`/api/v1/shopping-list-items/${suggestion.id}/restore`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    const restoredItem = await response.json();

    // Hide dropdown and close modal
    hideProductSuggestions();
    const modal = document.getElementById('item-modal') as HTMLDialogElement | null;
    if (modal) (modal as any).close();

    // Show success toast
    showToast(`Товар "${suggestion.product_name}" восстановлен`, 'success');

    // Reload items to show restored item
    const state = getState();
    if (state.currentListId) {
      await loadShoppingListItems(state.currentListId);
    }

    debugLog('[ListsManager] Restored item:', restoredItem);

  } catch (error: any) {
    console.error('[ListsManager] Error restoring item:', error);
    showToast(`Ошибка восстановления: ${error.message}`, 'error');

    // Fallback: fill form for creating new item
    fillFormFromSuggestion(suggestion);
    hideProductSuggestions();
  }
}

/**
 * Fill form fields from suggestion
 */
function fillFormFromSuggestion(suggestion: any): void {
  const state = getState();
  const productNameInput = document.getElementById('item-product-name') as HTMLInputElement | null;
  const storeSelect = document.getElementById('item-store') as HTMLSelectElement | null;
  const productGroupSelect = document.getElementById('item-product-group') as HTMLSelectElement | null;
  const quantityInput = document.getElementById('item-quantity') as HTMLInputElement | null;
  const unitSelect = document.getElementById('item-unit') as HTMLSelectElement | null;
  const commentInput = document.getElementById('item-comment') as HTMLInputElement | null;

  // Product name
  if (productNameInput) {
    productNameInput.value = suggestion.product_name;
  }

  // Store (Choices.js)
  if (suggestion.store_id) {
    if (state.choicesInstances?.store) {
      state.choicesInstances.store.setChoiceByValue(String(suggestion.store_id));
    } else if (storeSelect) {
      storeSelect.value = String(suggestion.store_id);
    }
  }

  // Product group (Choices.js)
  if (suggestion.product_group_id) {
    if (state.choicesInstances?.productGroup) {
      state.choicesInstances.productGroup.setChoiceByValue(String(suggestion.product_group_id));
    } else if (productGroupSelect) {
      productGroupSelect.value = String(suggestion.product_group_id);
    }
  }

  // Quantity (from deleted item)
  if (suggestion.quantity && quantityInput) {
    quantityInput.value = String(suggestion.quantity);
  }

  // Unit (from deleted item)
  if (suggestion.unit && unitSelect) {
    unitSelect.value = suggestion.unit;
  }

  // Comment (from deleted item)
  if (suggestion.comment && commentInput) {
    commentInput.value = suggestion.comment;
  }

  // CRITICAL: After filling form from autocomplete, trigger duplicate check and future quantity update
  debugLog('[AUTOCOMPLETE] Form filled from suggestion', {
    productName: suggestion.product_name,
    storeId: suggestion.store_id,
    quantity: suggestion.quantity
  });

  // Check for duplicates after form is filled
  const productName = productNameInput?.value?.trim();
  const storeId = state.choicesInstances?.store?.getValue(true) || storeSelect?.value;

  if (productName && storeId && state.currentListId) {
    debugLog('[AUTOCOMPLETE] Triggering duplicate check after autocomplete selection');

    // NOTE: These functions (searchDuplicate, showDuplicateWarning, updateFutureQuantity)
    // are in the original listsManager.ts but should be moved to a separate modal module
    // For now, call via window.listsManager if available
    if (typeof (window as any).listsManager?.searchDuplicate === 'function') {
      (window as any).listsManager.searchDuplicate(productName, parseInt(storeId)).then((duplicate: any) => {
        if (duplicate) {
          debugLog('[AUTOCOMPLETE] Duplicate found after autocomplete, showing warning');
          if (typeof (window as any).listsManager?.showDuplicateWarning === 'function') {
            (window as any).listsManager.showDuplicateWarning(duplicate);
          }

          // If quantity is already filled (from suggestion), update future quantity display
          if (quantityInput?.value && typeof (window as any).listsManager?.updateFutureQuantity === 'function') {
            debugLog('[AUTOCOMPLETE] Quantity already filled, updating future quantity');
            (window as any).listsManager.updateFutureQuantity();
          }
        } else {
          debugLog('[AUTOCOMPLETE] No duplicate found after autocomplete');
        }
      }).catch((error: any) => {
        console.error('[AUTOCOMPLETE] Error checking duplicate after autocomplete:', error);
      });
    }
  }
}

// ============================================================================
// Caching (Offline Support)
// ============================================================================

/**
 * Cache product suggestions for offline use
 */
/**
 * Search cached suggestions (deprecated - Dexie migration)
 * Offline search now handled by DataLayer shoppingListItems table
 */
async function searchCachedSuggestions(_query: string): Promise<any[]> {
  // No-op: Legacy IndexedDB removed
  debugLog('[Autocomplete] Cache search skipped (Dexie migration)');
  return [];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

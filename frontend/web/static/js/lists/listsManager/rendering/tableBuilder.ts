/**
 * Lists Manager - Table Rendering
 *
 * Renders shopping list items as HTML table (desktop) with responsive cards (mobile).
 * Handles filtering, empty states, and UI updates.
 *
 * Phase 3.2: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/listsManager.ts lines 906-1012, 1019-1077
 */

import { getState } from '../core/ListsState';

// ============================================================================
// Type Definitions
// ============================================================================

declare const debugLog: (...args: any[]) => void;
declare const openAddItemModal: () => void;
declare const openEditItemModal: (itemId: number) => void;
declare const toggleHideCompleted: () => void;

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

/**
 * Format quantity (without unit — unit is rendered in a separate column)
 */
function formatQuantity(quantity: number | null): string {
  if (quantity === null) return '—';

  // Always round to nearest integer
  return Math.round(quantity).toString();
}

/**
 * Get product group breadcrumbs (hierarchy path)
 *
 * @param groupId - Product group ID
 * @returns Breadcrumb string (e.g., "Продукты → Овощи → Помидоры")
 */
export function getProductGroupBreadcrumbs(groupId: number | null): string {
  if (!groupId) return '';

  const state = getState();
  const groupMap: Record<number, any> = {};

  state.productGroups.forEach(group => {
    groupMap[group.id] = group;
  });

  const path: string[] = [];
  let currentId: number | null = groupId;

  while (currentId && groupMap[currentId]) {
    path.unshift(groupMap[currentId].name);
    currentId = groupMap[currentId].parent_id || null;
  }

  return path.join(' → ');
}

// ============================================================================
// Filter Functions
// ============================================================================

/**
 * Filter items by search query and hideCompleted flag
 *
 * Searches in: product name, store name, group name, group ancestors, comments
 *
 * @returns Filtered items
 */
export function filterItemsBySearch(): any[] {
  const state = getState();

  // Start with all items or filter out completed if hideCompleted is active
  let items = state.currentItems;
  if (state.hideCompleted) {
    items = items.filter(item => !item.is_completed);
  }

  if (!state.searchQuery || state.searchQuery.trim() === '') {
    return items;
  }

  const query = state.searchQuery.toLowerCase().trim();

  // DIAGNOSTIC: Log search attempt
  debugLog('[SEARCH_FILTER] Starting search', {
    query,
    totalItems: items.length,
    storeCount: state.stores.length,
    groupCount: state.productGroups.length,
    hideCompleted: state.hideCompleted
  });

  // Build lookup maps
  const storeMap: Record<number, string> = {};
  state.stores.forEach(s => { storeMap[s.id] = s.name || ''; });

  const groupMap: Record<number, any> = {};
  state.productGroups.forEach(g => { groupMap[g.id] = g; });

  // DIAGNOSTIC: Log map sizes
  debugLog('[SEARCH_FILTER] Maps built', {
    storeMapSize: Object.keys(storeMap).length,
    groupMapSize: Object.keys(groupMap).length
  });

  // Helper to get all ancestor names for a group
  const getGroupAncestorNames = (groupId: number | null) => {
    if (!groupId) return [];

    const names: string[] = [];
    let currentId: number | null = groupId;

    while (currentId && groupMap[currentId]) {
      names.push(groupMap[currentId].name || '');
      currentId = groupMap[currentId].parent_id || null;
    }

    return names;
  };

  const results = items.filter(item => {
    // Check product name
    if ((item.product_name || '').toLowerCase().includes(query)) {
      return true;
    }

    // Check store name
    if (item.store_id) {
      const storeName = storeMap[item.store_id] || '';
      if (storeName.toLowerCase().includes(query)) {
        return true;
      }
    }

    // Check group name and ancestors
    if (item.product_group_id) {
      const groupNames = getGroupAncestorNames(item.product_group_id);
      for (const name of groupNames) {
        if (name.toLowerCase().includes(query)) {
          return true;
        }
      }
    }

    // Check notes/comments
    if ((item.notes || '').toLowerCase().includes(query)) {
      return true;
    }

    return false;
  });

  // DIAGNOSTIC: Log results
  debugLog('[SEARCH_FILTER] Search complete', {
    query,
    matchedItems: results.length,
    totalItems: items.length,
    matchRate: `${((results.length / items.length) * 100).toFixed(1)}%`,
    sampleResults: results.slice(0, 3).map(r => ({
      id: r.id,
      product_name: r.product_name,
      store: r.store_id !== null ? (storeMap[r.store_id] || 'N/A') : 'N/A'
    }))
  });

  return results;
}

// ============================================================================
// Table Rendering
// ============================================================================

/**
 * Render items table (desktop) with responsive mobile cards
 *
 * Shows empty state if no items match filters.
 * Handles search filtering and hideCompleted toggle.
 */
export function renderItemsTable(): void {
  const tbody = document.getElementById('items-table-body');
  const emptyState = document.getElementById('table-empty-state');
  const desktopTable = document.getElementById('desktop-table-container');
  const state = getState();

  // Apply search filter
  const filteredItems = filterItemsBySearch();

  if (filteredItems.length === 0) {
    // Use table-content-hidden to hide without breaking responsive classes
    if (desktopTable) desktopTable.classList.add('table-content-hidden');
    if (emptyState) emptyState.classList.remove('hidden');

    // Update empty state message based on search or hide completed
    const emptyTitle = emptyState?.querySelector('h3');
    const emptyText = emptyState?.querySelector('p');
    const emptyButton = emptyState?.querySelector('button');
    const hasCompletedItems = state.currentItems.some(item => item.is_completed);

    if (state.searchQuery && state.searchQuery.trim() !== '') {
      if (emptyTitle) emptyTitle.textContent = 'Ничего не найдено';
      if (emptyText) emptyText.textContent = 'Попробуйте изменить поисковый запрос';
      if (emptyButton) {
        emptyButton.textContent = '➕ Добавить товар';
        emptyButton.onclick = () => openAddItemModal();
      }
    } else if (state.hideCompleted && hasCompletedItems) {
      if (emptyTitle) emptyTitle.textContent = 'Все товары выполнены';
      if (emptyText) emptyText.textContent = 'Нажмите "Показать все" чтобы увидеть выполненные товары';
      if (emptyButton) {
        emptyButton.textContent = '👁️ Показать все';
        emptyButton.onclick = () => toggleHideCompleted();
      }
    } else {
      if (emptyTitle) emptyTitle.textContent = 'Список пуст';
      if (emptyText) emptyText.textContent = 'Добавьте первый товар или импортируйте из CSV';
      if (emptyButton) {
        emptyButton.textContent = '➕ Добавить товар';
        emptyButton.onclick = () => openAddItemModal();
      }
    }
    return;
  }

  // Remove table-content-hidden to show (responsive classes handle desktop/mobile visibility)
  if (desktopTable) desktopTable.classList.remove('table-content-hidden');
  if (emptyState) emptyState.classList.add('hidden');

  // Render desktop table
  if (!tbody) return;

  tbody.innerHTML = filteredItems.map(item => {
    const store = state.stores.find(s => s.id === item.store_id);
    const groupPath = getProductGroupBreadcrumbs(item.product_group_id);
    const isCompleted = item.is_completed;
    const productName = item.product_name || '';
    const comment = item.notes || '';

    return `
      <tr class="${isCompleted ? 'completed' : ''} cursor-pointer hover:bg-base-200"
          data-item-id="${item.id}"
          onclick="window.listsManager.toggleItemCompleted(${item.id}, ${!isCompleted})">
        <td data-label="Магазин">${store ? escapeHtml(store.name) : 'N/A'}</td>
        <td data-label="Группа" class="text-xs">${groupPath ? escapeHtml(groupPath) : 'N/A'}</td>
        <td data-label="Товар">
          <span class="table-item-name ${isCompleted ? 'line-through opacity-60' : ''}">
            ${escapeHtml(productName)}
          </span>
        </td>
        <td data-label="Кол-во" class="text-right">${formatQuantity(item.quantity)}</td>
        <td data-label="Ед.">${item.unit ? escapeHtml(item.unit) : '—'}</td>
        <td data-label="Комментарий" class="truncate-1-line">${comment ? escapeHtml(comment) : '—'}</td>
        <td data-label="Действия" class="text-center" onclick="event.stopPropagation()">
          <div class="action-buttons">
            <button class="btn btn-sm btn-square btn-ghost"
                    onclick="openEditItemModal(${item.id})"
                    title="Редактировать">
              ✏️
            </button>
            <button class="btn btn-sm btn-square btn-ghost text-error"
                    onclick="window.listsManager.deleteItem(${item.id})"
                    title="Удалить">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Update selection UI (checkboxes)
  updateSelectionUI();
}

/**
 * Update selection UI (checkboxes in table)
 *
 * Called after renderItemsTable() to update checkbox states
 */
function updateSelectionUI(): void {
  const state = getState();
  const tbody = document.getElementById('items-table-body');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr[data-item-id]');
  rows.forEach(row => {
    const itemId = parseInt(row.getAttribute('data-item-id') || '0');
    const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement | null;

    if (checkbox) {
      checkbox.checked = state.selectedItemIds.has(itemId);
    }
  });
}

// ============================================================================
// View Rendering
// ============================================================================

/**
 * Render current view (table or hierarchy)
 *
 * Delegates to appropriate renderer based on currentView
 */
export function renderCurrentView(): void {
  const state = getState();
  const isMobile = window.innerWidth < 640;

  // CRITICAL: On mobile, NEVER render table (even if hierarchyView not ready yet)
  // Wait for hierarchyView initialization instead of falling back to table
  if (isMobile && state.currentView === 'hierarchy') {
    if (state.hierarchyView) {
      state.hierarchyView.render();
    } else {
      // HierarchyView not ready yet - wait for initializeHierarchyView()
      debugLog('[ListsManager] Mobile: waiting for hierarchyView initialization (skipping table render)');
      return;
    }
  } else if (state.currentView === 'hierarchy' && state.hierarchyView) {
    // Desktop hierarchy view
    state.hierarchyView.render();
  } else {
    // Desktop table view (mobile never reaches here)
    renderItemsTable();
  }
}

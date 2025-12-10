/**
 * Shopping Lists Manager
 *
 * Core CRUD operations for shopping lists and items
 * Handles view switching, inline editing, batch operations
 *
 * Stage 5: Landing View + Detail View (Table)
 * Stage 6: Hierarchy View (collapsible tree)
 * Stage 8: Offline Support (IndexedDB, sync queue)
 */

class ListsManager {
    constructor() {
        this.currentListId = null;
        this.currentView = 'table'; // 'table' | 'hierarchy'
        this.shoppingLists = [];
        this.currentItems = [];
        this.stores = [];
        this.productGroups = [];
        this.selectedItemIds = new Set();
        this.choicesInstances = {}; // Choices.js instances
        this.hierarchyView = null; // HierarchyView instance
    }

    /**
     * Initialize the manager
     */
    async init() {
        debugLog('[ListsManager] Initializing...');

        try {
            // Load reference data
            await Promise.all([
                this.loadStores(),
                this.loadProductGroups()
            ]);

            // Initialize HierarchyView
            if (typeof HierarchyView !== 'undefined') {
                this.hierarchyView = new HierarchyView(this);
            } else {
                console.warn('[ListsManager] HierarchyView not loaded');
            }

            // Initialize Import Manager
            if (typeof ImportManager !== 'undefined') {
                window.importManager = new ImportManager(this);
                debugLog('[ListsManager] ImportManager initialized');
            } else {
                console.warn('[ListsManager] ImportManager not loaded');
            }

            // Show landing view by default
            await this.showLandingView();

            debugLog('[ListsManager] Initialized successfully');
        } catch (error) {
            console.error('[ListsManager] Initialization error:', error);
            throw error;
        }
    }

    /**
     * Show Landing View (grid of shopping list cards)
     */
    async showLandingView() {
        debugLog('[ListsManager] Showing landing view');

        // Reset state
        this.currentListId = null;
        this.currentItems = [];
        this.selectedItemIds.clear();

        // Show landing view, hide detail view
        document.getElementById('landing-view').classList.remove('hidden');
        document.getElementById('detail-view').classList.add('hidden');

        // Load shopping lists
        await this.loadShoppingLists();
        this.renderShoppingListCards();
    }

    /**
     * Show Detail View (items table for specific list)
     */
    async showDetailView(listId) {
        debugLog('[ListsManager] Showing detail view for list:', listId);

        this.currentListId = listId;
        this.selectedItemIds.clear();

        // Find the list
        const list = this.shoppingLists.find(l => l.id === listId);
        if (!list) {
            showToast('Список не найден', 'error');
            return;
        }

        // Update header
        document.getElementById('list-detail-name').textContent = list.name;
        document.getElementById('list-detail-description').textContent = list.description || 'Без описания';
        document.getElementById('breadcrumb-list-name').textContent = list.name;

        // Show detail view, hide landing view
        document.getElementById('landing-view').classList.add('hidden');
        document.getElementById('detail-view').classList.remove('hidden');

        // Load items for this list
        await this.loadShoppingListItems(listId);
        this.renderItemsTable();

        // Initialize Choices.js for product group selector in modal
        this.initProductGroupChoices();
    }

    /**
     * Load all shopping lists
     */
    async loadShoppingLists() {
        try {
            const response = await fetch('/api/v1/shopping-lists', {
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.shoppingLists = data.shopping_lists || [];

            debugLog('[ListsManager] Loaded shopping lists:', this.shoppingLists.length);
        } catch (error) {
            console.error('[ListsManager] Error loading shopping lists:', error);
            showToast('Ошибка загрузки списков', 'error');
            this.shoppingLists = [];
        }
    }

    /**
     * Load items for specific shopping list
     */
    async loadShoppingListItems(listId) {
        try {
            const response = await fetch(`/api/v1/shopping-lists/${listId}/items`, {
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.currentItems = data.items || [];

            debugLog('[ListsManager] Loaded items:', this.currentItems.length);

            // Update progress badge
            this.updateProgressBadge();
        } catch (error) {
            console.error('[ListsManager] Error loading items:', error);
            showToast('Ошибка загрузки товаров', 'error');
            this.currentItems = [];
        }
    }

    /**
     * Load stores
     */
    async loadStores() {
        try {
            const response = await fetch('/api/v1/stores', {
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.stores = data.stores || [];

            // Populate store selects
            this.populateStoreSelect();

            debugLog('[ListsManager] Loaded stores:', this.stores.length);
        } catch (error) {
            console.error('[ListsManager] Error loading stores:', error);
            this.stores = [];
        }
    }

    /**
     * Load product groups
     */
    async loadProductGroups() {
        try {
            const response = await fetch('/api/v1/product-groups', {
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.productGroups = data.product_groups || [];

            // Populate product group select
            this.populateProductGroupSelect();

            debugLog('[ListsManager] Loaded product groups:', this.productGroups.length);
        } catch (error) {
            console.error('[ListsManager] Error loading product groups:', error);
            this.productGroups = [];
        }
    }

    /**
     * Render shopping list cards in grid
     */
    renderShoppingListCards() {
        const grid = document.getElementById('lists-grid');
        const emptyState = document.getElementById('empty-state');

        if (this.shoppingLists.length === 0) {
            grid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        grid.classList.remove('hidden');
        emptyState.classList.add('hidden');

        grid.innerHTML = this.shoppingLists.map(list => {
            const totalItems = list.total_items || 0;
            const completedItems = list.completed_items || 0;
            const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

            // Escape name for use in onclick attribute
            const escapedName = this.escapeHtml(list.name).replace(/'/g, "\\'");

            return `
                <div class="shopping-list-card" onclick="window.listsManager.showDetailView(${list.id})">
                    <div class="flex justify-between items-start mb-2">
                        <div class="card-title flex-1">${this.escapeHtml(list.name)}</div>
                        <button class="btn btn-ghost btn-xs btn-circle text-error hover:bg-error hover:text-error-content ml-2"
                                onclick="event.stopPropagation(); openDeleteListModal(${list.id}, '${escapedName}');"
                                title="Удалить список"
                                aria-label="Удалить список ${this.escapeHtml(list.name)}">
                            🗑️
                        </button>
                    </div>
                    <div class="card-description truncate-2-lines">
                        ${list.description ? this.escapeHtml(list.description) : 'Без описания'}
                    </div>
                    <div class="card-progress">
                        <div class="card-progress-bar">
                            <div class="card-progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                        <div class="card-progress-text">
                            ${completedItems} / ${totalItems} выполнено (${progressPercent}%)
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render items table
     */
    renderItemsTable() {
        const tbody = document.getElementById('items-table-body');
        const emptyState = document.getElementById('table-empty-state');
        const tableView = document.querySelector('.overflow-x-auto');

        if (this.currentItems.length === 0) {
            tableView.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        tableView.classList.remove('hidden');
        emptyState.classList.add('hidden');

        tbody.innerHTML = this.currentItems.map(item => {
            const store = this.stores.find(s => s.id === item.store_id);
            const productGroup = this.productGroups.find(pg => pg.id === item.product_group_id);
            const isCompleted = item.is_completed;
            const isSelected = this.selectedItemIds.has(item.id);

            return `
                <tr class="${isCompleted ? 'completed' : ''}" data-item-id="${item.id}">
                    <td>
                        <input type="checkbox"
                               class="checkbox"
                               ${isSelected ? 'checked' : ''}
                               onchange="window.listsManager.toggleItemSelection(${item.id}, this.checked)">
                    </td>
                    <td>
                        <input type="checkbox"
                               class="checkbox"
                               ${isCompleted ? 'checked' : ''}
                               onchange="window.listsManager.toggleItemCompleted(${item.id}, this.checked)">
                    </td>
                    <td data-label="Магазин">${store ? this.escapeHtml(store.name) : 'N/A'}</td>
                    <td data-label="Группа">${productGroup ? this.escapeHtml(productGroup.name) : 'N/A'}</td>
                    <td data-label="Товар">${this.escapeHtml(item.product_name)}</td>
                    <td data-label="Кол-во" class="text-right">${item.quantity !== null ? item.quantity : '—'}</td>
                    <td data-label="Ед.">${item.unit ? this.escapeHtml(item.unit) : '—'}</td>
                    <td data-label="Комментарий" class="truncate-1-line">${item.comment ? this.escapeHtml(item.comment) : '—'}</td>
                    <td data-label="Действия" class="text-center">
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-square btn-ghost"
                                    onclick="window.listsManager.openEditItemModal(${item.id})"
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

        // Update selection UI
        this.updateSelectionUI();
    }

    /**
     * Update progress badge
     */
    updateProgressBadge() {
        const badge = document.getElementById('list-progress-badge');
        const totalItems = this.currentItems.length;
        const completedItems = this.currentItems.filter(item => item.is_completed).length;
        const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

        badge.textContent = `${completedItems} / ${totalItems} выполнено (${progressPercent}%)`;
    }

    /**
     * Populate store select dropdown
     */
    populateStoreSelect() {
        const select = document.getElementById('item-store');
        if (!select) return;

        // Keep first option (placeholder)
        const firstOption = select.querySelector('option[value=""]');
        select.innerHTML = '';
        if (firstOption) select.appendChild(firstOption);

        // Add store options
        this.stores
            .filter(store => store.is_active)
            .forEach(store => {
                const option = document.createElement('option');
                option.value = store.id;
                option.textContent = store.name;
                select.appendChild(option);
            });
    }

    /**
     * Populate product group select dropdown
     */
    populateProductGroupSelect() {
        const select = document.getElementById('item-product-group');
        if (!select) return;

        // Keep first option (placeholder)
        const firstOption = select.querySelector('option[value=""]');
        select.innerHTML = '';
        if (firstOption) select.appendChild(firstOption);

        // Build hierarchy tree
        const tree = this.buildProductGroupTree(this.productGroups);

        // Flatten tree with indentation
        const flattenTree = (nodes, level = 0) => {
            let result = [];
            nodes.forEach(node => {
                result.push({ ...node, level });
                if (node.children && node.children.length > 0) {
                    result = result.concat(flattenTree(node.children, level + 1));
                }
            });
            return result;
        };

        const flatGroups = flattenTree(tree);

        // Add product group options with indentation
        flatGroups
            .filter(pg => pg.is_active)
            .forEach(pg => {
                const option = document.createElement('option');
                option.value = pg.id;
                const indent = '&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(pg.level);
                const prefix = pg.level > 0 ? '↳ ' : '';
                option.innerHTML = `${indent}${prefix}${this.escapeHtml(pg.name)}`;
                select.appendChild(option);
            });
    }

    /**
     * Build product group hierarchy tree
     */
    buildProductGroupTree(groups) {
        const map = {};
        const roots = [];

        // Create map
        groups.forEach(group => {
            map[group.id] = { ...group, children: [] };
        });

        // Build tree
        groups.forEach(group => {
            if (group.parent_id && map[group.parent_id]) {
                map[group.parent_id].children.push(map[group.id]);
            } else {
                roots.push(map[group.id]);
            }
        });

        return roots;
    }

    /**
     * Initialize Choices.js for product group selector (hierarchical)
     */
    initProductGroupChoices() {
        const select = document.getElementById('item-product-group');
        if (!select) return;

        // Destroy existing instance
        if (this.choicesInstances.productGroup) {
            this.choicesInstances.productGroup.destroy();
        }

        // Create new Choices.js instance
        this.choicesInstances.productGroup = new Choices(select, {
            searchEnabled: true,
            searchPlaceholderValue: 'Поиск группы...',
            noResultsText: 'Группа не найдена',
            itemSelectText: '',
            allowHTML: true // Allow HTML in options for indentation
        });
    }

    /**
     * Toggle item selection
     */
    toggleItemSelection(itemId, isSelected) {
        if (isSelected) {
            this.selectedItemIds.add(itemId);
        } else {
            this.selectedItemIds.delete(itemId);
        }

        this.updateSelectionUI();
    }

    /**
     * Toggle select all items
     */
    toggleSelectAll() {
        const headerCheckbox = document.getElementById('header-checkbox');
        const isChecked = headerCheckbox.checked;

        if (isChecked) {
            // Select all
            this.currentItems.forEach(item => {
                this.selectedItemIds.add(item.id);
            });
        } else {
            // Deselect all
            this.selectedItemIds.clear();
        }

        this.renderItemsTable();
    }

    /**
     * Select completed items
     */
    selectCompleted() {
        this.selectedItemIds.clear();
        this.currentItems
            .filter(item => item.is_completed)
            .forEach(item => {
                this.selectedItemIds.add(item.id);
            });

        this.renderItemsTable();
        showToast(`Выбрано ${this.selectedItemIds.size} выполненных товаров`, 'info');
    }

    /**
     * Update selection UI
     */
    updateSelectionUI() {
        const deleteBtn = document.getElementById('delete-selected-btn');
        const selectAllBtn = document.getElementById('select-all-btn');
        const headerCheckbox = document.getElementById('header-checkbox');

        // Update delete button state
        if (this.selectedItemIds.size > 0) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = `🗑️ Удалить выбранные (${this.selectedItemIds.size})`;
        } else {
            deleteBtn.disabled = true;
            deleteBtn.textContent = '🗑️ Удалить выбранные';
        }

        // Update select all button
        if (this.selectedItemIds.size === this.currentItems.length && this.currentItems.length > 0) {
            selectAllBtn.textContent = '☐ Снять выделение';
            headerCheckbox.checked = true;
        } else {
            selectAllBtn.textContent = '☑️ Выбрать все';
            headerCheckbox.checked = false;
        }
    }

    /**
     * Toggle item completed status
     */
    async toggleItemCompleted(itemId, isCompleted) {
        try {
            const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({ is_completed: isCompleted })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Update local state
            const item = this.currentItems.find(i => i.id === itemId);
            if (item) {
                item.is_completed = isCompleted;
            }

            // Re-render
            this.renderItemsTable();
            this.updateProgressBadge();

            showToast(isCompleted ? 'Товар отмечен как выполненный' : 'Отметка снята', 'success');
        } catch (error) {
            console.error('[ListsManager] Error toggling item completed:', error);
            showToast('Ошибка обновления статуса', 'error');
            // Revert checkbox
            this.renderItemsTable();
        }
    }

    /**
     * Delete item
     */
    async deleteItem(itemId) {
        if (!confirm('Удалить этот товар?')) {
            return;
        }

        try {
            const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
                method: 'DELETE',
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Remove from local state
            this.currentItems = this.currentItems.filter(item => item.id !== itemId);
            this.selectedItemIds.delete(itemId);

            // Re-render
            this.renderItemsTable();
            this.updateProgressBadge();

            showToast('Товар удален', 'success');
        } catch (error) {
            console.error('[ListsManager] Error deleting item:', error);
            showToast('Ошибка удаления товара', 'error');
        }
    }

    /**
     * Delete selected items
     */
    async deleteSelected() {
        if (this.selectedItemIds.size === 0) {
            return;
        }

        const count = this.selectedItemIds.size;
        if (!confirm(`Удалить выбранные товары (${count})?`)) {
            return;
        }

        try {
            const itemIds = Array.from(this.selectedItemIds);

            const response = await fetch('/api/v1/shopping-list-items/batch-delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({ item_ids: itemIds })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Remove from local state
            this.currentItems = this.currentItems.filter(item => !this.selectedItemIds.has(item.id));
            this.selectedItemIds.clear();

            // Re-render
            this.renderItemsTable();
            this.updateProgressBadge();

            showToast(`Удалено ${count} товаров`, 'success');
        } catch (error) {
            console.error('[ListsManager] Error deleting selected items:', error);
            showToast('Ошибка удаления товаров', 'error');
        }
    }

    /**
     * Switch view (table <-> hierarchy)
     */
    switchView(viewName) {
        this.currentView = viewName;

        if (viewName === 'table') {
            document.getElementById('table-view').classList.remove('hidden');
            document.getElementById('hierarchy-view').classList.add('hidden');
            document.getElementById('table-view-btn').classList.remove('btn-outline');
            document.getElementById('hierarchy-view-btn').classList.add('btn-outline');

            // Show table controls, hide hierarchy controls
            const tableControls = document.getElementById('table-controls');
            const hierarchyControls = document.getElementById('hierarchy-controls');
            if (tableControls) tableControls.classList.remove('hidden');
            if (hierarchyControls) hierarchyControls.classList.add('hidden');
        } else if (viewName === 'hierarchy') {
            document.getElementById('table-view').classList.add('hidden');
            document.getElementById('hierarchy-view').classList.remove('hidden');
            document.getElementById('table-view-btn').classList.add('btn-outline');
            document.getElementById('hierarchy-view-btn').classList.remove('btn-outline');

            // Hide table controls, show hierarchy controls
            const tableControls = document.getElementById('table-controls');
            const hierarchyControls = document.getElementById('hierarchy-controls');
            if (tableControls) tableControls.classList.add('hidden');
            if (hierarchyControls) hierarchyControls.classList.remove('hidden');

            // Render hierarchy tree
            if (this.hierarchyView) {
                this.hierarchyView.render();
            } else {
                showToast('Иерархический вид недоступен', 'error');
            }
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ============================================== //
// Global Functions (called from HTML onclick)    //
// ============================================== //

// Create global instance
window.listsManager = new ListsManager();

/**
 * Show landing view
 */
function showLandingView() {
    window.listsManager.showLandingView();
}

/**
 * Open create list modal
 */
function openCreateListModal() {
    const modal = document.getElementById('create-list-modal');
    const form = document.getElementById('create-list-form');
    form.reset();
    modal.showModal();
}

/**
 * Close create list modal
 */
function closeCreateListModal() {
    const modal = document.getElementById('create-list-modal');
    modal.close();
}

/**
 * Handle create list form submission
 */
async function handleCreateList(event) {
    event.preventDefault();
    const form = event.target;
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
        await window.listsManager.loadShoppingLists();
        await window.listsManager.showDetailView(result.id);
    } catch (error) {
        console.error('[ListsManager] Error creating list:', error);
        showToast('Ошибка создания списка', 'error');
    }
}

/**
 * Open add item modal
 */
function openAddItemModal() {
    const modal = document.getElementById('item-modal');
    const form = document.getElementById('item-form');
    form.reset();
    document.getElementById('item-id').value = '';
    document.getElementById('item-modal-title').textContent = '📝 Добавить товар';
    modal.showModal();
}

/**
 * Open edit item modal
 */
function openEditItemModal(itemId) {
    const item = window.listsManager.currentItems.find(i => i.id === itemId);
    if (!item) {
        showToast('Товар не найден', 'error');
        return;
    }

    const modal = document.getElementById('item-modal');
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-store').value = item.store_id;
    document.getElementById('item-product-group').value = item.product_group_id;
    document.getElementById('item-product-name').value = item.product_name;
    document.getElementById('item-quantity').value = item.quantity !== null ? item.quantity : '';
    document.getElementById('item-unit').value = item.unit || '';
    document.getElementById('item-comment').value = item.comment || '';
    document.getElementById('item-modal-title').textContent = '✏️ Редактировать товар';

    // Update Choices.js instance
    if (window.listsManager.choicesInstances.productGroup) {
        window.listsManager.choicesInstances.productGroup.setChoiceByValue(item.product_group_id.toString());
    }

    modal.showModal();
}

/**
 * Close item modal
 */
function closeItemModal() {
    const modal = document.getElementById('item-modal');
    modal.close();
}

/**
 * Handle save item form submission
 */
async function handleSaveItem(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const itemId = formData.get('item_id');
    const isEdit = itemId !== '';

    const data = {
        store_id: parseInt(formData.get('store_id')),
        product_group_id: parseInt(formData.get('product_group_id')),
        product_name: formData.get('product_name'),
        quantity: formData.get('quantity') ? parseFloat(formData.get('quantity')) : null,
        unit: formData.get('unit') || null,
        comment: formData.get('comment') || null
    };

    try {
        let response;
        if (isEdit) {
            // Update existing item
            response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify(data)
            });
        } else {
            // Create new item
            data.shopping_list_id = window.listsManager.currentListId;
            response = await fetch('/api/v1/shopping-list-items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify(data)
            });
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        showToast(isEdit ? 'Товар обновлен' : 'Товар добавлен', 'success');

        // Close modal
        closeItemModal();

        // Reload items
        await window.listsManager.loadShoppingListItems(window.listsManager.currentListId);
        window.listsManager.renderItemsTable();
    } catch (error) {
        console.error('[ListsManager] Error saving item:', error);
        showToast('Ошибка сохранения товара', 'error');
    }
}

/**
 * Toggle select all
 */
function toggleSelectAll() {
    window.listsManager.toggleSelectAll();
}

/**
 * Select completed items
 */
function selectCompleted() {
    window.listsManager.selectCompleted();
}

/**
 * Delete selected items
 */
function deleteSelected() {
    window.listsManager.deleteSelected();
}

/**
 * Switch view (table <-> hierarchy)
 */
function switchView(viewName) {
    window.listsManager.switchView(viewName);
}

/**
 * Expand all nodes in hierarchy view
 */
function expandAllNodes() {
    if (window.hierarchyView) {
        window.hierarchyView.expandAll();
    }
}

/**
 * Collapse all nodes in hierarchy view
 */
function collapseAllNodes() {
    if (window.hierarchyView) {
        window.hierarchyView.collapseAll();
    }
}

// ============================================================================
// DELETE LIST FUNCTIONS
// ============================================================================

/**
 * Global function to open delete list modal
 * @param {number} listId - Shopping list ID
 * @param {string} listName - Shopping list name (escaped)
 */
function openDeleteListModal(listId, listName) {
    // Store listId for later use
    window.deleteListId = listId;

    // Update modal content
    document.getElementById('delete-list-name').textContent = listName;

    // Open modal
    const modal = document.getElementById('delete-list-modal');
    modal.showModal();

    debugLog('[DeleteList] Modal opened for list:', listId);
}

/**
 * Close delete list modal
 */
function closeDeleteListModal() {
    const modal = document.getElementById('delete-list-modal');
    modal.close();
    window.deleteListId = null;

    debugLog('[DeleteList] Modal closed');
}

/**
 * Confirm delete list
 */
async function confirmDeleteList() {
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
        await window.listsManager.showLandingView();

    } catch (error) {
        console.error('[DeleteList] Error deleting list:', error);
        showToast(`❌ Ошибка удаления: ${error.message}`, 'error');
    }
}

// ============================================================================
// IMPORT MANAGER INITIALIZATION
// ============================================================================

/**
 * Initialize import wizard when accordion is opened
 */
function initializeImportWizard() {
    if (window.importManager && !window.importManager.container) {
        window.importManager.init();
        debugLog('[ImportWizard] Initialized');
    }
}

debugLog('[ListsManager] Module loaded');

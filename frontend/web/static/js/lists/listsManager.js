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

        // Reset HierarchyView expanded nodes for new list
        // Each list should start with fresh tree state
        if (this.hierarchyView) {
            this.hierarchyView.expandedNodes.clear();
        }

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
            const response = await fetch(`/api/v1/shopping-list-items?shopping_list_id=${listId}`, {
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
                        <button class="btn btn-ghost btn-sm btn-circle text-error hover:bg-error hover:text-error-content ml-2"
                                onclick="event.stopPropagation(); openDeleteListModal(${list.id}, '${escapedName}');"
                                title="Удалить список"
                                aria-label="Удалить список ${this.escapeHtml(list.name)}"
                                style="transform: scale(1.25);">
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
     * Get full breadcrumbs path for a product group
     * Returns: "Root → Parent → Child"
     */
    getProductGroupBreadcrumbs(groupId) {
        const groupMap = {};
        this.productGroups.forEach(group => {
            groupMap[group.id] = group;
        });

        const path = [];
        let currentId = groupId;
        while (currentId && groupMap[currentId]) {
            path.unshift(groupMap[currentId].name);
            currentId = groupMap[currentId].parent_id;
        }

        return path.join(' → ');
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
            const groupPath = this.getProductGroupBreadcrumbs(item.product_group_id);
            const isCompleted = item.is_completed;
            const isSelected = this.selectedItemIds.has(item.id);

            return `
                <tr class="${isCompleted ? 'completed' : ''}" data-item-id="${item.id}">
                    <td data-label="Магазин">${store ? this.escapeHtml(store.name) : 'N/A'}</td>
                    <td data-label="Группа" class="text-xs">${groupPath ? this.escapeHtml(groupPath) : 'N/A'}</td>
                    <td data-label="Товар">${this.escapeHtml(item.product_name)}</td>
                    <td data-label="Кол-во" class="text-right">${item.quantity !== null ? item.quantity : '—'}</td>
                    <td data-label="Ед.">${item.unit ? this.escapeHtml(item.unit) : '—'}</td>
                    <td data-label="Комментарий" class="truncate-1-line">${item.comment ? this.escapeHtml(item.comment) : '—'}</td>
                    <td class="px-1 text-center">
                        <input type="checkbox"
                               class="checkbox checkbox-xs"
                               ${isCompleted ? 'checked' : ''}
                               onchange="window.listsManager.toggleItemCompleted(${item.id}, this.checked)">
                    </td>
                    <td data-label="Действия" class="text-center">
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
     * Shows only leaf groups with parent path in parentheses
     * Example: "Кислое (Молочные)" - parents only, smaller gray text
     */
    populateProductGroupSelect() {
        const select = document.getElementById('item-product-group');
        if (!select) return;

        // Keep first option (placeholder)
        const firstOption = select.querySelector('option[value=""]');
        select.innerHTML = '';
        if (firstOption) select.appendChild(firstOption);

        // Build group map for breadcrumbs lookup
        const groupMap = {};
        this.productGroups.forEach(group => {
            groupMap[group.id] = group;
        });

        // Find leaf groups (groups that have no children)
        const parentIds = new Set();
        this.productGroups.forEach(group => {
            if (group.parent_id) {
                parentIds.add(group.parent_id);
            }
        });
        const leafGroups = this.productGroups.filter(group => !parentIds.has(group.id));

        // Sort leaves alphabetically
        leafGroups.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

        // Helper to get parent breadcrumbs path (ancestors only, not including the item itself)
        const getParentBreadcrumbs = (groupId) => {
            const path = [];
            let currentId = groupMap[groupId]?.parent_id;
            while (currentId && groupMap[currentId]) {
                path.unshift(groupMap[currentId]);
                currentId = groupMap[currentId].parent_id;
            }
            return path;
        };

        // Add product group options - only leaves with parent path
        leafGroups
            .filter(pg => pg.is_active)
            .forEach(pg => {
                const option = document.createElement('option');
                option.value = pg.id;

                // Get parents path (excludes the element itself)
                const parents = getParentBreadcrumbs(pg.id);

                // Format: "Name (Parent → Parent)" or just "Name" if no parents
                // Parents shown in smaller gray text
                let label = this.escapeHtml(pg.name);
                if (parents.length > 0) {
                    const parentsStr = parents.map(g => this.escapeHtml(g.name)).join(' → ');
                    label = `${this.escapeHtml(pg.name)} <span class="product-group-parents">(${parentsStr})</span>`;
                }

                option.innerHTML = label;
                option.dataset.path = parents.map(g => g.name).join(' → ');
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

        // Create new Choices.js instance with choices-tailwind styling
        this.choicesInstances.productGroup = new Choices(select, {
            searchEnabled: true,
            searchPlaceholderValue: 'Поиск группы...',
            noResultsText: 'Группа не найдена',
            itemSelectText: '',
            allowHTML: true, // Allow HTML in options for parent path styling
            shouldSort: false, // Maintain alphabetical order from populateProductGroupSelect
            placeholder: true,
            placeholderValue: 'Группа',
            classNames: {
                containerOuter: ['choices', 'choices-tailwind'] // Apply tailwind theme
            }
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
     * If all items are selected - deselect all
     * Otherwise - select all
     */
    toggleSelectAll() {
        const allSelected = this.selectedItemIds.size === this.currentItems.length && this.currentItems.length > 0;

        if (allSelected) {
            // Deselect all
            this.selectedItemIds.clear();
        } else {
            // Select all
            this.currentItems.forEach(item => {
                this.selectedItemIds.add(item.id);
            });
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
     * Note: This method is called from renderItemsTable() but the selection UI
     * elements (delete-selected-btn, select-all-btn) are not currently in the HTML.
     * Adding null checks to prevent errors.
     */
    updateSelectionUI() {
        const deleteBtn = document.getElementById('delete-selected-btn');
        const selectAllBtn = document.getElementById('select-all-btn');

        // Update delete button state - preserve mobile-friendly structure
        if (deleteBtn) {
            if (this.selectedItemIds.size > 0) {
                deleteBtn.disabled = false;
                // Update only the text span, keep icon
                const textSpan = deleteBtn.querySelector('span:last-child');
                if (textSpan && textSpan.classList.contains('hidden')) {
                    // Mobile: show count in icon span
                    const iconSpan = deleteBtn.querySelector('span:first-child');
                    if (iconSpan) iconSpan.textContent = `🗑️${this.selectedItemIds.size}`;
                } else if (textSpan) {
                    // Desktop: show full text
                    textSpan.textContent = `Удалить (${this.selectedItemIds.size})`;
                }
            } else {
                deleteBtn.disabled = true;
                const textSpan = deleteBtn.querySelector('span:last-child');
                if (textSpan && textSpan.classList.contains('hidden')) {
                    const iconSpan = deleteBtn.querySelector('span:first-child');
                    if (iconSpan) iconSpan.textContent = '🗑️';
                } else if (textSpan) {
                    textSpan.textContent = 'Удалить';
                }
            }
        }

        // Update select all button - preserve mobile-friendly structure
        if (selectAllBtn) {
            const selectAllTextSpan = selectAllBtn.querySelector('span:last-child');
            const selectAllIconSpan = selectAllBtn.querySelector('span:first-child');
            if (this.selectedItemIds.size === this.currentItems.length && this.currentItems.length > 0) {
                if (selectAllIconSpan) selectAllIconSpan.textContent = '☐';
                if (selectAllTextSpan) selectAllTextSpan.textContent = 'Снять выделение';
            } else {
                if (selectAllIconSpan) selectAllIconSpan.textContent = '☑️';
                if (selectAllTextSpan) selectAllTextSpan.textContent = 'Выделить все';
            }
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

            // Re-render based on current view
            if (this.currentView === 'hierarchy' && this.hierarchyView) {
                this.hierarchyView.render();
            } else {
                this.renderItemsTable();
            }
            this.updateProgressBadge();

            showToast(isCompleted ? 'Товар отмечен как выполненный' : 'Отметка снята', 'success');
        } catch (error) {
            console.error('[ListsManager] Error toggling item completed:', error);
            showToast('Ошибка обновления статуса', 'error');
            // Revert view
            if (this.currentView === 'hierarchy' && this.hierarchyView) {
                this.hierarchyView.render();
            } else {
                this.renderItemsTable();
            }
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

            // Re-render based on current view
            if (this.currentView === 'hierarchy' && this.hierarchyView) {
                this.hierarchyView.render();
            } else {
                this.renderItemsTable();
            }
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

            // Re-render based on current view
            if (this.currentView === 'hierarchy' && this.hierarchyView) {
                this.hierarchyView.render();
            } else {
                this.renderItemsTable();
            }
            this.updateProgressBadge();

            showToast(`Удалено ${count} товаров`, 'success');
        } catch (error) {
            console.error('[ListsManager] Error deleting selected items:', error);
            showToast('Ошибка удаления товаров', 'error');
        }
    }

    /**
     * Mark all items as completed
     */
    async markAllCompleted() {
        if (this.currentItems.length === 0) {
            showToast('Список пуст', 'info');
            return;
        }

        const uncompletedItems = this.currentItems.filter(item => !item.is_completed);
        if (uncompletedItems.length === 0) {
            showToast('Все товары уже отмечены', 'info');
            return;
        }

        try {
            // Update each uncompleted item
            const promises = uncompletedItems.map(item =>
                fetch(`/api/v1/shopping-list-items/${item.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ is_completed: true })
                })
            );

            await Promise.all(promises);

            // Update local state
            this.currentItems.forEach(item => {
                item.is_completed = true;
            });

            // Re-render based on current view
            if (this.currentView === 'hierarchy' && this.hierarchyView) {
                this.hierarchyView.render();
            } else {
                this.renderItemsTable();
            }
            this.updateProgressBadge();

            showToast(`Отмечено ${uncompletedItems.length} товаров`, 'success');
        } catch (error) {
            console.error('[ListsManager] Error marking all completed:', error);
            showToast('Ошибка обновления статуса', 'error');
        }
    }

    /**
     * Unmark all items (set is_completed = false)
     */
    async unmarkAllCompleted() {
        if (this.currentItems.length === 0) {
            showToast('Список пуст', 'info');
            return;
        }

        const completedItems = this.currentItems.filter(item => item.is_completed);
        if (completedItems.length === 0) {
            showToast('Нет отмеченных товаров', 'info');
            return;
        }

        try {
            // Update each completed item to uncompleted
            const promises = completedItems.map(item =>
                fetch(`/api/v1/shopping-list-items/${item.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ is_completed: false })
                })
            );

            await Promise.all(promises);

            // Update local state
            this.currentItems.forEach(item => {
                item.is_completed = false;
            });

            // Re-render based on current view
            if (this.currentView === 'hierarchy' && this.hierarchyView) {
                this.hierarchyView.render();
            } else {
                this.renderItemsTable();
            }
            this.updateProgressBadge();

            showToast(`Снято ${completedItems.length} отметок`, 'success');
        } catch (error) {
            console.error('[ListsManager] Error unmarking all completed:', error);
            showToast('Ошибка обновления статуса', 'error');
        }
    }

    /**
     * Delete all completed items
     */
    async deleteCompleted() {
        const completedItems = this.currentItems.filter(item => item.is_completed);

        if (completedItems.length === 0) {
            showToast('Нет отмеченных товаров', 'info');
            return;
        }

        if (!confirm(`Удалить ${completedItems.length} отмеченных товаров?`)) {
            return;
        }

        try {
            const itemIds = completedItems.map(item => item.id);

            const response = await fetch('/api/v1/shopping-list-items/batch-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ item_ids: itemIds })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Remove from local state
            this.currentItems = this.currentItems.filter(item => !item.is_completed);
            this.selectedItemIds.clear();

            // Re-render based on current view
            if (this.currentView === 'hierarchy' && this.hierarchyView) {
                this.hierarchyView.render();
            } else {
                this.renderItemsTable();
            }
            this.updateProgressBadge();

            showToast(`Удалено ${completedItems.length} товаров`, 'success');
        } catch (error) {
            console.error('[ListsManager] Error deleting completed items:', error);
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

            // Re-render table to sync checkbox states
            this.renderItemsTable();
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

        // Re-render based on current view
        if (window.listsManager.currentView === 'hierarchy' && window.listsManager.hierarchyView) {
            window.listsManager.hierarchyView.render();
        } else {
            window.listsManager.renderItemsTable();
        }
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
 * Mark all items as completed
 */
function markAllCompleted() {
    window.listsManager.markAllCompleted();
}

/**
 * Unmark all items (remove completed status)
 */
function unmarkAllCompleted() {
    window.listsManager.unmarkAllCompleted();
}

/**
 * Delete all completed items
 */
function deleteCompleted() {
    window.listsManager.deleteCompleted();
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

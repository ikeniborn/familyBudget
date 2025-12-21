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
        this.db = null; // IndexedDBManager instance for offline support
        this.searchQuery = ''; // Search filter for items
        this.hideCompleted = false; // Hide completed items filter
        // Note: Real-time updates now handled by global budgetWSClient
    }

    /**
     * Check if currently online
     * Uses offlineManager's network detector if available, with localStorage fallback
     * for timing issues during page navigation when networkDetector isn't initialized yet
     */
    get isOnline() {
        if (window.offlineManager && window.offlineManager.networkDetector) {
            return window.offlineManager.networkDetector.getStatus() !== 'offline';
        }
        // Fallback: check localStorage directly for autoOfflineMode
        // offlineManager.networkDetector may not be initialized yet during page load
        try {
            if (localStorage.getItem('budget_auto_offline_mode') === 'true') {
                return false;
            }
        } catch (e) {
            // Ignore localStorage errors
        }
        return navigator.onLine;
    }

    /**
     * Initialize the manager
     */
    async init() {
        debugLog('[ListsManager] Initializing...');

        try {
            // Initialize IndexedDB for offline support
            if (typeof IndexedDBManager !== 'undefined') {
                this.db = new IndexedDBManager();
                await this.db.init();
                debugLog('[ListsManager] IndexedDB initialized for offline support');
            } else {
                console.warn('[ListsManager] IndexedDBManager not available, offline mode disabled');
            }

            // Initialize OfflineShoppingManager for offline CRUD operations
            if (window.offlineManager && typeof OfflineShoppingManager !== 'undefined') {
                this.offlineShopping = new OfflineShoppingManager(window.offlineManager);
                debugLog('[ListsManager] OfflineShoppingManager initialized');
            }

            // Note: Real-time updates now handled by global budgetWSClient (consolidation)
            // budgetWSClient calls listsManager.addItemToUI, updateItemInUI, etc. directly

            // Listen for network status changes (sync when back online)
            window.addEventListener('offline-status-change', async (event) => {
                const { online } = event.detail || {};
                this.updateOfflineUI(!online);

                if (online) {
                    // Note: WebSocket reconnection handled by global budgetWSClient

                    if (this.offlineShopping) {
                        try {
                            // Sync pending changes
                            const results = await this.offlineShopping.sync();
                            debugLog('[ListsManager] Sync results:', results);

                            // Reload current list data from server
                            if (this.currentListId) {
                                await this.loadShoppingListItems(this.currentListId);
                                this.renderCurrentView();
                            }

                            if (results && results.synced > 0) {
                                showToast(`Синхронизировано: ${results.synced} изменений`, 'success');
                            }
                        } catch (error) {
                            console.error('[ListsManager] Sync error:', error);
                        }
                    }
                }
                // Note: WebSocket disconnect handled by global budgetWSClient
            });

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

            // Setup product autocomplete (mobile-compatible)
            this._setupProductAutocomplete();

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

        // Note: WebSocket stays connected globally via budgetWSClient (no per-list disconnect needed)

        // Reset state
        this.currentListId = null;
        this.currentItems = [];
        this.selectedItemIds.clear();

        // Hide FAB menu (only visible in detail view)
        this.hideFAB();

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

        // IMPORTANT: Full state reset BEFORE loading new list
        // This prevents showing old list data while new list loads
        this.currentItems = [];  // Clear items immediately
        this.selectedItemIds.clear();
        this.currentListId = listId;

        // Reset search query for new list
        this.searchQuery = '';
        const searchInput = document.getElementById('items-search');
        if (searchInput) searchInput.value = '';
        const clearBtn = document.getElementById('clear-search-btn');
        if (clearBtn) clearBtn.classList.add('hidden');

        // Restore hide completed preference from localStorage
        this.hideCompleted = false;
        try {
            const storedHide = localStorage.getItem('lists_hide_completed_preference');
            if (storedHide === 'true') {
                this.hideCompleted = true;
                debugLog('[ListsManager] Restored hide completed preference:', this.hideCompleted);
            }
        } catch (e) {
            // localStorage may be unavailable in private browsing
        }
        this.updateHideCompletedButton();

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

        // Update delete completed button visibility
        this.updateFABVisibility();

        // Restore saved view preference from localStorage
        let savedView = 'table'; // default
        try {
            const stored = localStorage.getItem('lists_view_preference');
            if (stored === 'table' || stored === 'hierarchy') {
                savedView = stored;
                debugLog('[ListsManager] Restored view preference:', savedView);
            }
        } catch (e) {
            // localStorage may be unavailable
        }

        // Apply saved view (this also renders the content)
        if (savedView === 'hierarchy' && this.hierarchyView) {
            this.switchView('hierarchy');
        } else {
            this.switchView('table');
        }

        // Initialize Choices.js for store and product group selectors in modal
        this.initStoreChoices();
        this.initProductGroupChoices();

        // Note: Real-time updates provided by global budgetWSClient
        // Filtering by shopping_list_id is done in addItemToUI, updateItemInUI, etc.
    }

    /**
     * Load all shopping lists (online or from cache)
     */
    async loadShoppingLists() {
        const CACHE_KEY = 'shopping_lists';
        const CACHE_TTL = 86400; // 24 hours

        try {
            if (this.isOnline) {
                // Online: fetch from API and cache
                const response = await fetch('/api/v1/shopping-lists', {
                    credentials: 'same-origin'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                this.shoppingLists = data.shopping_lists || [];

                // Cache for offline use
                if (this.db && this.shoppingLists.length > 0) {
                    await this.db.setCache(CACHE_KEY, this.shoppingLists, CACHE_TTL);
                    debugLog('[ListsManager] Cached shopping lists for offline use');
                }

                debugLog('[ListsManager] Loaded shopping lists from API:', this.shoppingLists.length);
            } else {
                // Offline: load from cache
                if (this.db) {
                    const cached = await this.db.getCache(CACHE_KEY);
                    this.shoppingLists = cached || [];
                    debugLog('[ListsManager] Loaded shopping lists from cache:', this.shoppingLists.length);

                    if (this.shoppingLists.length === 0) {
                        showToast('Списки недоступны в offline режиме. Посетите страницу online.', 'warning');
                    }
                } else {
                    this.shoppingLists = [];
                    console.warn('[ListsManager] Offline and no cache available');
                }
            }
        } catch (error) {
            console.error('[ListsManager] Error loading shopping lists:', error);

            // Fallback to cache on error
            if (this.db) {
                try {
                    const cached = await this.db.getCache(CACHE_KEY);
                    this.shoppingLists = cached || [];
                    debugLog('[ListsManager] Loaded shopping lists from cache (fallback):', this.shoppingLists.length);
                } catch (cacheError) {
                    console.error('[ListsManager] Error loading shopping lists from cache:', cacheError);
                    showToast('Ошибка загрузки списков', 'error');
                    this.shoppingLists = [];
                }
            } else {
                showToast('Ошибка загрузки списков', 'error');
                this.shoppingLists = [];
            }
        }
    }

    /**
     * Load items for specific shopping list (online or from cache)
     */
    async loadShoppingListItems(listId) {
        const CACHE_KEY = `shopping_list_items_${listId}`;
        const CACHE_TTL = 86400; // 24 hours

        try {
            if (this.isOnline) {
                // Online: fetch from API and cache
                const response = await fetch(`/api/v1/shopping-list-items?shopping_list_id=${listId}`, {
                    credentials: 'same-origin'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                this.currentItems = data.items || [];

                // Cache for offline use
                if (this.db) {
                    await this.db.setCache(CACHE_KEY, this.currentItems, CACHE_TTL);
                    debugLog('[ListsManager] Cached shopping list items for offline use');
                }

                debugLog('[ListsManager] Loaded items from API:', this.currentItems.length);
            } else {
                // Offline: load from cache
                if (this.db) {
                    const cached = await this.db.getCache(CACHE_KEY);
                    this.currentItems = cached || [];
                    debugLog('[ListsManager] Loaded items from cache:', this.currentItems.length);
                } else {
                    this.currentItems = [];
                    console.warn('[ListsManager] Offline and no cache available');
                }
            }

            // Update progress badge
            this.updateProgressBadge();

        } catch (error) {
            console.error('[ListsManager] Error loading items:', error);

            // Fallback to cache on error
            if (this.db) {
                try {
                    const cached = await this.db.getCache(CACHE_KEY);
                    this.currentItems = cached || [];
                    debugLog('[ListsManager] Loaded items from cache (fallback):', this.currentItems.length);
                    this.updateProgressBadge();
                } catch (cacheError) {
                    console.error('[ListsManager] Error loading items from cache:', cacheError);
                    showToast('Ошибка загрузки товаров', 'error');
                    this.currentItems = [];
                }
            } else {
                showToast('Ошибка загрузки товаров', 'error');
                this.currentItems = [];
            }
        }
    }

    /**
     * Load stores (online or from cache)
     */
    async loadStores() {
        try {
            if (this.isOnline) {
                // Online: fetch from API and cache
                const response = await fetch('/api/v1/stores', {
                    credentials: 'same-origin'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                this.stores = data.stores || [];

                // Cache for offline use
                if (this.db && this.stores.length > 0) {
                    await this.db.cacheStores(this.stores);
                    debugLog('[ListsManager] Cached stores for offline use');
                }

                debugLog('[ListsManager] Loaded stores from API:', this.stores.length);
            } else {
                // Offline: load from cache
                if (this.db) {
                    this.stores = await this.db.getCachedStores();
                    debugLog('[ListsManager] Loaded stores from cache:', this.stores.length);
                } else {
                    this.stores = [];
                    console.warn('[ListsManager] Offline and no cache available');
                }
            }

            // Populate store selects
            this.populateStoreSelect();

        } catch (error) {
            console.error('[ListsManager] Error loading stores:', error);

            // Fallback to cache on error
            if (this.db) {
                try {
                    this.stores = await this.db.getCachedStores();
                    debugLog('[ListsManager] Loaded stores from cache (fallback):', this.stores.length);
                    this.populateStoreSelect();
                } catch (cacheError) {
                    console.error('[ListsManager] Error loading stores from cache:', cacheError);
                    this.stores = [];
                }
            } else {
                this.stores = [];
            }
        }
    }

    /**
     * Load product groups (online or from cache)
     */
    async loadProductGroups() {
        try {
            if (this.isOnline) {
                // Online: fetch from API and cache
                const response = await fetch('/api/v1/product-groups', {
                    credentials: 'same-origin'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                this.productGroups = data.product_groups || [];

                // Cache for offline use
                if (this.db && this.productGroups.length > 0) {
                    await this.db.cacheProductGroups(this.productGroups);
                    debugLog('[ListsManager] Cached product groups for offline use');
                }

                debugLog('[ListsManager] Loaded product groups from API:', this.productGroups.length);
            } else {
                // Offline: load from cache
                if (this.db) {
                    this.productGroups = await this.db.getCachedProductGroups();
                    debugLog('[ListsManager] Loaded product groups from cache:', this.productGroups.length);
                } else {
                    this.productGroups = [];
                    console.warn('[ListsManager] Offline and no cache available');
                }
            }

            // Populate product group select
            this.populateProductGroupSelect();

        } catch (error) {
            console.error('[ListsManager] Error loading product groups:', error);

            // Fallback to cache on error
            if (this.db) {
                try {
                    this.productGroups = await this.db.getCachedProductGroups();
                    debugLog('[ListsManager] Loaded product groups from cache (fallback):', this.productGroups.length);
                    this.populateProductGroupSelect();
                } catch (cacheError) {
                    console.error('[ListsManager] Error loading product groups from cache:', cacheError);
                    this.productGroups = [];
                }
            } else {
                this.productGroups = [];
            }
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
     * Render items table (desktop) and mobile cards
     */
    renderItemsTable() {
        const tbody = document.getElementById('items-table-body');
        const mobileContainer = document.getElementById('mobile-cards-container');
        const emptyState = document.getElementById('table-empty-state');
        const desktopTable = document.getElementById('desktop-table-container');

        // Apply search filter
        const filteredItems = this.filterItemsBySearch();

        if (filteredItems.length === 0) {
            // Use table-content-hidden to hide without breaking responsive classes
            if (desktopTable) desktopTable.classList.add('table-content-hidden');
            if (mobileContainer) mobileContainer.classList.add('table-content-hidden');
            emptyState.classList.remove('hidden');

            // Update empty state message based on search or hide completed
            const emptyTitle = emptyState.querySelector('h3');
            const emptyText = emptyState.querySelector('p');
            const emptyButton = emptyState.querySelector('button');
            const hasCompletedItems = this.currentItems.some(item => item.is_completed);

            if (this.searchQuery && this.searchQuery.trim() !== '') {
                if (emptyTitle) emptyTitle.textContent = 'Ничего не найдено';
                if (emptyText) emptyText.textContent = 'Попробуйте изменить поисковый запрос';
                if (emptyButton) {
                    emptyButton.textContent = '➕ Добавить товар';
                    emptyButton.onclick = () => openAddItemModal();
                }
            } else if (this.hideCompleted && hasCompletedItems) {
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
        if (mobileContainer) mobileContainer.classList.remove('table-content-hidden');
        emptyState.classList.add('hidden');

        // Render desktop table
        tbody.innerHTML = filteredItems.map(item => {
            const store = this.stores.find(s => s.id === item.store_id);
            const groupPath = this.getProductGroupBreadcrumbs(item.product_group_id);
            const isCompleted = item.is_completed;

            return `
                <tr class="${isCompleted ? 'completed' : ''} cursor-pointer hover:bg-base-200" data-item-id="${item.id}" onclick="window.listsManager.toggleItemCompleted(${item.id}, ${!isCompleted})">
                    <td data-label="Магазин">${store ? this.escapeHtml(store.name) : 'N/A'}</td>
                    <td data-label="Группа" class="text-xs">${groupPath ? this.escapeHtml(groupPath) : 'N/A'}</td>
                    <td data-label="Товар">
                        <span class="table-item-name ${isCompleted ? 'line-through opacity-60' : ''}">
                            ${this.escapeHtml(item.product_name)}
                        </span>
                    </td>
                    <td data-label="Кол-во" class="text-right">${item.quantity !== null ? this.formatQuantity(item.quantity, item.unit) : '—'}</td>
                    <td data-label="Ед.">${item.unit ? this.escapeHtml(item.unit) : '—'}</td>
                    <td data-label="Комментарий" class="truncate-1-line">${item.comment ? this.escapeHtml(item.comment) : '—'}</td>
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

        // Render mobile cards (sorted by store → group → product)
        if (mobileContainer) {
            const sortedItems = this.getSortedItemsForMobile(filteredItems);
            mobileContainer.innerHTML = sortedItems.map(item => {
                return this.renderMobileCard(item);
            }).join('');
        }

        // Update selection UI
        this.updateSelectionUI();
    }

    /**
     * Render a single mobile card for an item
     * Format: Store → Group → Product | Qty Unit | Status | Edit | Delete
     */
    renderMobileCard(item) {
        const store = this.stores.find(s => s.id === item.store_id);
        const isCompleted = item.is_completed;

        // Build path: Store → Full Group Hierarchy → Product
        const storeName = store ? this.escapeHtml(store.name) : '?';
        const groupPath = this.getProductGroupBreadcrumbs(item.product_group_id);
        const productName = this.escapeHtml(item.product_name);

        // Format quantity
        let qtyText = '';
        if (item.quantity !== null) {
            qtyText = this.formatQuantity(item.quantity, item.unit);
            if (item.unit) {
                qtyText += ' ' + this.escapeHtml(item.unit);
            }
        }

        // Status indicator (small dot or checkmark)
        const statusIcon = isCompleted ? '✓' : '';
        const statusClass = isCompleted ? 'mobile-card-completed' : '';

        return `
            <div class="mobile-item-card ${statusClass}" data-item-id="${item.id}">
                <div class="mobile-card-main" onclick="window.listsManager.toggleItemCompleted(${item.id}, ${!isCompleted})">
                    <div class="mobile-card-path">
                        <span class="mobile-card-store">${storeName}</span>
                        <span class="mobile-card-separator">→</span>
                        <span class="mobile-card-group">${groupPath ? this.escapeHtml(groupPath) : '?'}</span>
                        <span class="mobile-card-separator">→</span>
                        <span class="mobile-card-product">${productName}</span>
                    </div>
                    <div class="mobile-card-status">${statusIcon}</div>
                </div>
                <div class="mobile-card-details">
                    ${qtyText ? `<span class="mobile-card-qty">${qtyText}</span>` : ''}
                    <div class="mobile-card-actions">
                        <button class="btn btn-xs btn-ghost btn-square" onclick="event.stopPropagation(); openEditItemModal(${item.id})" title="Редактировать">
                            ✏️
                        </button>
                        <button class="btn btn-xs btn-ghost btn-square text-error" onclick="event.stopPropagation(); window.listsManager.deleteItem(${item.id})" title="Удалить">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get items sorted for mobile view
     * Sort order: store → group → product
     */
    getSortedItemsForMobile(items = null) {
        const itemsToSort = items || this.currentItems;

        // Build lookup maps for sorting
        const storeMap = {};
        this.stores.forEach(s => { storeMap[s.id] = s.name || ''; });

        const groupMap = {};
        this.productGroups.forEach(g => { groupMap[g.id] = g.name || ''; });

        // Sort items
        return [...itemsToSort].sort((a, b) => {
            // 1. Sort by store name
            const storeA = (storeMap[a.store_id] || '').toLowerCase();
            const storeB = (storeMap[b.store_id] || '').toLowerCase();
            if (storeA !== storeB) {
                return storeA.localeCompare(storeB, 'ru');
            }

            // 2. Sort by group name
            const groupA = (groupMap[a.product_group_id] || '').toLowerCase();
            const groupB = (groupMap[b.product_group_id] || '').toLowerCase();
            if (groupA !== groupB) {
                return groupA.localeCompare(groupB, 'ru');
            }

            // 3. Sort by product name
            const productA = (a.product_name || '').toLowerCase();
            const productB = (b.product_name || '').toLowerCase();
            return productA.localeCompare(productB, 'ru');
        });
    }

    /**
     * Filter items by search query and hideCompleted flag
     * Searches in: product name, store name, group name, group ancestors
     * @returns {Array} Filtered items
     */
    filterItemsBySearch() {
        // Start with all items or filter out completed if hideCompleted is active
        let items = this.currentItems;
        if (this.hideCompleted) {
            items = items.filter(item => !item.is_completed);
        }

        if (!this.searchQuery || this.searchQuery.trim() === '') {
            return items;
        }

        const query = this.searchQuery.toLowerCase().trim();

        // Build lookup maps
        const storeMap = {};
        this.stores.forEach(s => { storeMap[s.id] = s.name || ''; });

        const groupMap = {};
        this.productGroups.forEach(g => { groupMap[g.id] = g; });

        // Helper to get all ancestor names for a group
        const getGroupAncestorNames = (groupId) => {
            const names = [];
            let currentId = groupId;
            while (currentId && groupMap[currentId]) {
                names.push(groupMap[currentId].name || '');
                currentId = groupMap[currentId].parent_id;
            }
            return names;
        };

        return items.filter(item => {
            // Check product name
            if ((item.product_name || '').toLowerCase().includes(query)) {
                return true;
            }

            // Check store name
            const storeName = storeMap[item.store_id] || '';
            if (storeName.toLowerCase().includes(query)) {
                return true;
            }

            // Check group name and ancestors
            const groupNames = getGroupAncestorNames(item.product_group_id);
            for (const name of groupNames) {
                if (name.toLowerCase().includes(query)) {
                    return true;
                }
            }

            // Check comment
            if ((item.comment || '').toLowerCase().includes(query)) {
                return true;
            }

            return false;
        });
    }

    /**
     * Set search query and re-render
     */
    setSearchQuery(query) {
        this.searchQuery = query;

        // Show/hide clear button
        const clearBtn = document.getElementById('clear-search-btn');
        if (clearBtn) {
            if (query && query.trim() !== '') {
                clearBtn.classList.remove('hidden');
            } else {
                clearBtn.classList.add('hidden');
            }
        }

        // Re-render based on current view
        if (this.currentView === 'hierarchy' && this.hierarchyView) {
            this.hierarchyView.render();
        } else {
            this.renderItemsTable();
        }
    }

    /**
     * Clear search query
     */
    clearSearch() {
        const input = document.getElementById('items-search');
        if (input) {
            input.value = '';
        }
        this.setSearchQuery('');
    }

    /**
     * Toggle hide completed items filter
     * Saves preference to localStorage for persistence across sessions
     */
    toggleHideCompleted() {
        this.hideCompleted = !this.hideCompleted;

        // Save preference to localStorage
        try {
            localStorage.setItem('lists_hide_completed_preference', this.hideCompleted.toString());
            debugLog('[ListsManager] Saved hide completed preference:', this.hideCompleted);
        } catch (e) {
            // localStorage may be unavailable in private browsing
        }

        this.updateHideCompletedButton();
        this.renderCurrentView();
    }

    /**
     * Update hide completed button state
     */
    updateHideCompletedButton() {
        const btn = document.getElementById('toggle-hide-completed-btn');
        if (!btn) return;

        const iconSpan = btn.querySelector('span:first-child');
        const textSpan = btn.querySelector('span:last-child');

        if (this.hideCompleted) {
            if (iconSpan) iconSpan.textContent = '👁️‍🗨️';
            if (textSpan) textSpan.textContent = 'Показать все';
            btn.title = 'Показать все товары';
            btn.classList.add('btn-primary');
            btn.classList.remove('btn-outline');
        } else {
            if (iconSpan) iconSpan.textContent = '👁️';
            if (textSpan) textSpan.textContent = 'Скрыть выполненные';
            btn.title = 'Скрыть выполненные';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline');
        }
    }

    /**
     * Update FAB visibility
     * Shows FAB only when in detail view and there are items
     */
    updateFABVisibility() {
        const fabMenu = document.getElementById('lists-fab-menu');
        const fabBackdrop = document.getElementById('lists-fab-backdrop');
        if (!fabMenu) return;

        // Show FAB only when there are items in the list
        if (this.currentItems.length > 0 && this.currentListId) {
            fabMenu.classList.remove('hidden');
        } else {
            fabMenu.classList.add('hidden');
            // Also hide backdrop if FAB is hidden
            if (fabBackdrop) {
                fabBackdrop.classList.add('hidden');
            }
        }
    }

    /**
     * Hide FAB menu (when switching to landing view)
     */
    hideFAB() {
        const fabMenu = document.getElementById('lists-fab-menu');
        const fabBackdrop = document.getElementById('lists-fab-backdrop');
        if (fabMenu) {
            fabMenu.classList.add('hidden', 'closed');
            fabMenu.classList.remove('open');
        }
        if (fabBackdrop) {
            fabBackdrop.classList.add('hidden', 'opacity-0', 'pointer-events-none');
        }
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
     * Note: This method prepares the select element for Choices.js
     * The actual options are populated via buildStoreChoices() in initStoreChoices()
     *
     * IMPORTANT: Do NOT create <option> elements here!
     * Choices.js reads both existing <option> elements AND the choices[] parameter,
     * which causes duplicates. We use choices[] parameter only.
     */
    populateStoreSelect() {
        const select = document.getElementById('item-store');
        if (!select) return;

        // Clear select completely - Choices.js will populate via choices[] parameter
        select.innerHTML = '';
    }

    /**
     * Build choices array for stores
     * Simple flat list sorted alphabetically
     * @returns {Array} Choices array for Choices.js
     */
    buildStoreChoices() {
        // Sort stores alphabetically
        const sortedStores = [...this.stores]
            .filter(store => store.is_active)
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

        return sortedStores.map(store => ({
            value: store.id.toString(),
            label: this.escapeHtml(store.name),
            selected: false,
            disabled: false
        }));
    }

    /**
     * Initialize Choices.js for store selector
     */
    initStoreChoices() {
        const select = document.getElementById('item-store');
        if (!select) return;

        // Destroy existing instance
        if (this.choicesInstances.store) {
            this.choicesInstances.store.destroy();
        }

        // Clear select completely - Choices.js will populate via choices[] parameter
        // This prevents duplicates when destroy() restores original HTML with static <option>
        select.innerHTML = '';

        // Build choices array
        const choices = this.buildStoreChoices();

        // Create Choices.js instance with choices-tailwind styling
        this.choicesInstances.store = new Choices(select, {
            searchEnabled: true,
            searchPlaceholderValue: 'Поиск магазина...',
            noResultsText: 'Магазин не найден',
            itemSelectText: '',
            allowHTML: false, // No HTML needed (flat list)
            shouldSort: false, // Maintain our alphabetical order
            placeholder: true,
            placeholderValue: 'Магазин',
            choices: choices,
            classNames: {
                containerOuter: ['choices', 'choices-tailwind'] // Apply tailwind theme
            }
        });
    }

    /**
     * Populate product group select dropdown
     * Note: This method prepares the select element for Choices.js
     * The actual options are populated via buildProductGroupChoices() in initProductGroupChoices()
     *
     * IMPORTANT: Do NOT create <option> elements here!
     * Choices.js reads both existing <option> elements AND the choices[] parameter,
     * which causes duplicates. We use choices[] parameter only.
     */
    populateProductGroupSelect() {
        const select = document.getElementById('item-product-group');
        if (!select) return;

        // Clear select completely - Choices.js will populate via choices[] parameter
        select.innerHTML = '';
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

        // Clear select completely - Choices.js will populate via choices[] parameter
        // This prevents duplicates when destroy() restores original HTML with static <option>
        select.innerHTML = '';

        // Build choices array with HTML labels for proper rendering
        const choices = this.buildProductGroupChoices();

        // Create new Choices.js instance with choices-tailwind styling
        this.choicesInstances.productGroup = new Choices(select, {
            searchEnabled: true,
            searchPlaceholderValue: 'Поиск группы...',
            noResultsText: 'Группа не найдена',
            itemSelectText: '',
            allowHTML: true, // Allow HTML in options for parent path styling
            shouldSort: false, // Maintain alphabetical order
            placeholder: true,
            placeholderValue: 'Группа',
            choices: choices,
            classNames: {
                containerOuter: ['choices', 'choices-tailwind'] // Apply tailwind theme
            }
        });

        // Initialize unit change listener for quantity input
        this.initUnitChangeListener();
    }

    /**
     * Build choices array for product groups with HTML labels
     * Format: "Name (Full → Hierarchy → Path)" where path is styled gray and smaller
     * Shows FULL hierarchy chain from root to parent
     * @returns {Array} Choices array for Choices.js
     */
    buildProductGroupChoices() {
        // Build group map for parent lookup
        const groupMap = {};
        this.productGroups.forEach(group => {
            groupMap[group.id] = group;
        });

        // Helper to get full parent chain (excluding leaf itself)
        const getParentChain = (groupId) => {
            const path = [];
            let currentId = groupMap[groupId]?.parent_id;

            while (currentId && groupMap[currentId]) {
                path.unshift(groupMap[currentId].name);
                currentId = groupMap[currentId].parent_id;
            }

            return path;
        };

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

        // Build choices array
        const choices = [];
        leafGroups
            .filter(pg => pg.is_active)
            .forEach(pg => {
                // Get FULL parent chain
                const parentChain = getParentChain(pg.id);

                // Format: "Name (Full → Hierarchy)" with HTML styling for hierarchy path
                let label = this.escapeHtml(pg.name);
                if (parentChain.length > 0) {
                    const hierarchyPath = parentChain.map(p => this.escapeHtml(p)).join(' → ');
                    label = `${this.escapeHtml(pg.name)} <span class="product-group-parents">(${hierarchyPath})</span>`;
                }

                choices.push({
                    value: pg.id.toString(),
                    label: label,
                    selected: false,
                    disabled: false
                });
            });

        return choices;
    }

    /**
     * Initialize unit change listener for quantity input
     * Updates step attribute based on selected unit:
     * - кг: step=0.1 (one decimal place)
     * - other units: step=1 (integer only)
     */
    initUnitChangeListener() {
        const unitSelect = document.getElementById('item-unit');
        const quantityInput = document.getElementById('item-quantity');

        if (!unitSelect || !quantityInput) return;

        // Remove existing listener if any
        unitSelect.removeEventListener('change', this.handleUnitChange);

        // Create bound handler
        this.handleUnitChange = (event) => {
            const unit = event.target.value;
            this.updateQuantityInputStep(unit, quantityInput);
        };

        // Add listener
        unitSelect.addEventListener('change', this.handleUnitChange);
    }

    /**
     * Update quantity input step based on unit
     * @param {string} unit - Selected unit
     * @param {HTMLInputElement} quantityInput - Quantity input element
     */
    updateQuantityInputStep(unit, quantityInput) {
        if (unit === 'кг') {
            // For kg: allow one decimal place
            quantityInput.step = '0.1';
        } else {
            // For all other units: integer only
            quantityInput.step = '1';

            // Round current value to integer if it has decimals
            const currentValue = parseFloat(quantityInput.value);
            if (!isNaN(currentValue) && currentValue !== Math.round(currentValue)) {
                quantityInput.value = Math.round(currentValue);
            }
        }
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
     * Toggle item completed status (with offline support)
     */
    async toggleItemCompleted(itemId, isCompleted) {
        // 1. Optimistic UI update - update state and render immediately
        const item = this.currentItems.find(i => i.id === itemId);
        if (item) {
            item.is_completed = isCompleted;
        }
        this.renderCurrentView();
        this.updateProgressBadge();
        this.updateFABVisibility();

        try {
            // 2. Send to server or queue for offline
            if (this.offlineShopping) {
                await this.offlineShopping.updateItem(itemId, { is_completed: isCompleted });
            } else {
                // Fallback to direct fetch (no offline support)
                const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ is_completed: isCompleted })
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
            }

            // 3. Update cache
            await this.updateItemsCache();

        } catch (error) {
            console.error('[ListsManager] Error toggling item completed:', error);
            // 4. Revert only if truly online and error occurred
            // (offline errors are expected and handled by offlineShopping)
            if (this.isOnline && !error.message?.includes('offline')) {
                if (item) item.is_completed = !isCompleted;
                this.renderCurrentView();
                this.updateProgressBadge();
                showToast('Ошибка обновления статуса', 'error');
            }
        }
    }

    /**
     * Delete item (with offline support)
     */
    async deleteItem(itemId) {
        if (!confirm('Удалить этот товар?')) return;

        // 1. Optimistic UI update - save deleted item for potential revert
        const itemIndex = this.currentItems.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return;

        const deletedItem = this.currentItems[itemIndex];
        this.currentItems.splice(itemIndex, 1);
        this.selectedItemIds.delete(itemId);
        this.renderCurrentView();
        this.updateProgressBadge();

        try {
            // 2. Delete on server or queue for offline
            if (this.offlineShopping) {
                await this.offlineShopping.deleteItem(itemId);
            } else {
                // Fallback to direct fetch (no offline support)
                const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
                    method: 'DELETE',
                    credentials: 'same-origin'
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
            }

            // 3. Update cache
            await this.updateItemsCache();
            showToast('Товар удален', 'success');

        } catch (error) {
            console.error('[ListsManager] Error deleting item:', error);
            // 4. Revert deletion only if truly online and error occurred
            if (this.isOnline && !error.message?.includes('offline')) {
                this.currentItems.splice(itemIndex, 0, deletedItem);
                this.renderCurrentView();
                this.updateProgressBadge();
                showToast('Ошибка удаления товара', 'error');
            }
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
            this.updateFABVisibility();

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
            this.updateFABVisibility();

            showToast(`Снято ${completedItems.length} отметок`, 'success');
        } catch (error) {
            console.error('[ListsManager] Error unmarking all completed:', error);
            showToast('Ошибка обновления статуса', 'error');
        }
    }

    /**
     * Delete all completed items (internal - without confirm dialog)
     * Called from deleteCompletedWithConfirm() after user confirmation
     */
    async deleteCompleted() {
        const completedItems = this.currentItems.filter(item => item.is_completed);

        if (completedItems.length === 0) {
            showToast('Нет отмеченных товаров', 'info');
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
            this.updateFABVisibility();

            showToast(`Удалено ${completedItems.length} товаров`, 'success');
        } catch (error) {
            console.error('[ListsManager] Error deleting completed items:', error);
            showToast('Ошибка удаления товаров', 'error');
        }
    }

    /**
     * Switch view (table <-> hierarchy)
     * Saves preference to localStorage for persistence
     */
    switchView(viewName) {
        this.currentView = viewName;

        // Save preference to localStorage
        try {
            localStorage.setItem('lists_view_preference', viewName);
            debugLog('[ListsManager] Saved view preference:', viewName);
        } catch (e) {
            // localStorage may be unavailable in private browsing
            console.warn('[ListsManager] Failed to save view preference:', e);
        }

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

    /**
     * Format quantity based on unit type
     * - шт, л, мл, уп, пач, г: integer (no decimals)
     * - кг: 1 decimal place with comma separator
     * @param {number|null} quantity - The quantity value
     * @param {string|null} unit - The unit type
     * @returns {string|null} Formatted quantity string
     */
    formatQuantity(quantity, unit) {
        if (quantity === null || quantity === undefined) {
            return null;
        }

        // Convert to number if string (API may return string)
        const numQuantity = typeof quantity === 'string' ? parseFloat(quantity) : quantity;
        if (isNaN(numQuantity)) {
            return null;
        }

        // Units that should display with 1 decimal (comma separator)
        const oneDecimalUnits = ['кг'];

        // All other units display as integers: шт, л, мл, уп, пач, г
        if (unit && oneDecimalUnits.includes(unit)) {
            return numQuantity.toFixed(1).replace('.', ',');
        }

        // Default: integer (round to nearest whole number)
        return Math.round(numQuantity).toString();
    }

    // ==========================================================
    // Offline Support Helper Methods
    // ==========================================================

    /**
     * Render current view (table or hierarchy)
     * Used after offline sync and optimistic updates
     */
    renderCurrentView() {
        if (this.currentView === 'hierarchy' && this.hierarchyView) {
            this.hierarchyView.render();
        } else {
            this.renderItemsTable();
        }
    }

    /**
     * Update items cache in IndexedDB
     * Called after successful mutations to keep cache in sync
     */
    async updateItemsCache() {
        if (this.db && this.currentListId) {
            const CACHE_KEY = `shopping_list_items_${this.currentListId}`;
            const CACHE_TTL = 86400; // 24 hours
            await this.db.setCache(CACHE_KEY, this.currentItems, CACHE_TTL);
            debugLog('[ListsManager] Updated items cache');
        }
    }

    /**
     * Update UI for offline mode
     * @param {boolean} isOffline - true if offline
     */
    updateOfflineUI(isOffline) {
        // Hide Import accordion in offline mode
        const importAccordion = document.querySelector('.collapse.collapse-arrow.bg-base-100');
        if (importAccordion) {
            if (isOffline) {
                importAccordion.classList.add('hidden');
                importAccordion.classList.remove('sm:block');
            } else {
                importAccordion.classList.remove('hidden');
                importAccordion.classList.add('hidden', 'sm:block');
            }
        }
    }

    // ==========================================================
    // REAL-TIME UI UPDATE METHODS
    // Called by BudgetWSClient for real-time updates
    // ==========================================================

    /**
     * Add item to UI (from WebSocket event)
     * @param {Object} item - Item data from server (must contain shopping_list_id)
     */
    addItemToUI(item) {
        if (!item || !item.id) {
            debugLog('[ListsManager] Invalid item for addItemToUI');
            return;
        }

        // CRITICAL: Filter by current list to prevent cross-list item injection
        if (item.shopping_list_id !== this.currentListId) {
            debugLog('[ListsManager] Item from different list, ignoring:', item.shopping_list_id, 'current:', this.currentListId);
            return;
        }

        // Check if item already exists (avoid duplicates)
        const exists = this.currentItems.some(i => i.id === item.id);
        if (exists) {
            debugLog('[ListsManager] Item already exists, updating instead:', item.id);
            this.updateItemInUI(item);
            return;
        }

        // Add to items array
        this.currentItems.push(item);
        debugLog('[ListsManager] Added item from WebSocket:', item.id);

        // Re-render and update badge
        this.renderCurrentView();
        this.updateProgressBadge();
        this.updateFABVisibility();
        this.updateItemsCache();

        // Show notification
        showToast(`Добавлен товар: ${item.product_name}`, 'info', 3000);
    }

    /**
     * Update item in UI (from WebSocket event)
     * @param {Object} item - Updated item data from server (must contain shopping_list_id)
     */
    updateItemInUI(item) {
        if (!item || !item.id) {
            debugLog('[ListsManager] Invalid item for updateItemInUI');
            return;
        }

        // CRITICAL: Filter by current list to prevent cross-list item updates
        if (item.shopping_list_id !== this.currentListId) {
            debugLog('[ListsManager] Item from different list, ignoring update:', item.shopping_list_id, 'current:', this.currentListId);
            return;
        }

        const index = this.currentItems.findIndex(i => i.id === item.id);
        if (index === -1) {
            debugLog('[ListsManager] Item not found for update:', item.id);
            // Item doesn't exist locally - add it
            this.addItemToUI(item);
            return;
        }

        // Update item in array
        this.currentItems[index] = { ...this.currentItems[index], ...item };
        debugLog('[ListsManager] Updated item from WebSocket:', item.id);

        // Re-render and update badge
        this.renderCurrentView();
        this.updateProgressBadge();
        this.updateFABVisibility();
        this.updateItemsCache();
    }

    /**
     * Remove item from UI (from WebSocket event)
     * @param {number} itemId - Item ID to remove
     * @param {number} shoppingListId - Shopping list ID (for filtering)
     */
    removeItemFromUI(itemId, shoppingListId) {
        if (!itemId) {
            debugLog('[ListsManager] Invalid itemId for removeItemFromUI');
            return;
        }

        // CRITICAL: Filter by current list to prevent cross-list item removal
        if (shoppingListId !== undefined && shoppingListId !== this.currentListId) {
            debugLog('[ListsManager] Item from different list, ignoring removal:', shoppingListId, 'current:', this.currentListId);
            return;
        }

        const index = this.currentItems.findIndex(i => i.id === itemId);
        if (index === -1) {
            debugLog('[ListsManager] Item not found for removal:', itemId);
            return;
        }

        const removedItem = this.currentItems[index];
        this.currentItems.splice(index, 1);
        debugLog('[ListsManager] Removed item from WebSocket:', itemId);

        // Also remove from selection if selected
        this.selectedItemIds.delete(itemId);

        // Re-render and update badge
        this.renderCurrentView();
        this.updateProgressBadge();
        this.updateFABVisibility();
        this.updateItemsCache();

        // Show notification
        showToast(`Удалён товар: ${removedItem.product_name}`, 'info', 3000);
    }

    /**
     * Toggle item completed status in UI (from WebSocket event)
     * @param {number} itemId - Item ID
     * @param {boolean} isCompleted - New completed status
     * @param {number} shoppingListId - Shopping list ID (for filtering)
     */
    toggleItemCompletedInUI(itemId, isCompleted, shoppingListId) {
        if (!itemId) {
            debugLog('[ListsManager] Invalid itemId for toggleItemCompletedInUI');
            return;
        }

        // CRITICAL: Filter by current list to prevent cross-list item toggle
        if (shoppingListId !== undefined && shoppingListId !== this.currentListId) {
            debugLog('[ListsManager] Item from different list, ignoring toggle:', shoppingListId, 'current:', this.currentListId);
            return;
        }

        const item = this.currentItems.find(i => i.id === itemId);
        if (!item) {
            debugLog('[ListsManager] Item not found for toggle:', itemId);
            return;
        }

        // Update status
        item.is_completed = isCompleted;
        if (isCompleted) {
            item.completed_at = new Date().toISOString();
        }
        debugLog('[ListsManager] Toggled item from WebSocket:', itemId, isCompleted);

        // Re-render and update badge
        this.renderCurrentView();
        this.updateProgressBadge();
        this.updateFABVisibility();
        this.updateItemsCache();
    }

    /**
     * Reload items for current list
     * Used after conflict resolution
     */
    async loadItems() {
        if (this.currentListId) {
            await this.loadShoppingListItems(this.currentListId);
            this.renderCurrentView();
            this.updateProgressBadge();
        }
    }

    // ==========================================================
    // AUTOCOMPLETE METHODS
    // Product suggestions from shopping list history
    // ==========================================================

    /**
     * Setup product name autocomplete with mobile-compatible event handling
     * @private
     */
    _setupProductAutocomplete() {
        const input = document.getElementById('item-product-name');

        if (!input) {
            return;
        }

        const handler = () => {
            this.handleProductInput(input.value);
        };

        // Multiple events for cross-browser mobile compatibility
        input.addEventListener('input', handler);      // Primary (desktop & some mobile)
        input.addEventListener('keyup', handler);      // Fallback for mobile keyboards
        input.addEventListener('compositionend', handler); // IME input (iOS, Android)

        input._autocompleteInitialized = true;

        // Setup click handler for dropdown (iOS fix)
        this._setupSuggestionsClickHandler();

        debugLog('[ListsManager] Product autocomplete initialized');
    }

    /**
     * Setup click/touch handler for suggestions dropdown (iOS-compatible)
     * Uses event delegation pattern for dynamic content
     * @private
     */
    _setupSuggestionsClickHandler() {
        const dropdown = document.getElementById('product-suggestions-dropdown');
        if (!dropdown || dropdown._clickHandlerInitialized) {
            return;
        }

        // Shared handler for both touch and click events
        const handleSelection = (event, isTouchEvent = false) => {
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
                this.selectSuggestion(index);
            }
        };

        // iOS Safari: touchstart event (fires BEFORE click)
        dropdown.addEventListener('touchstart', (event) => {
            handleSelection(event, true);
        }, { passive: false }); // passive: false allows preventDefault()

        // Desktop & fallback: click event
        dropdown.addEventListener('click', (event) => {
            handleSelection(event, false);
        });

        dropdown._clickHandlerInitialized = true;
        debugLog('[ListsManager] Suggestions click/touch handlers initialized (iOS-compatible)');
    }

    /**
     * Handle product input for autocomplete
     * @param {string} value - Input value
     */
    handleProductInput(value) {
        // Clear previous debounce timer
        if (this._autocompleteTimer) {
            clearTimeout(this._autocompleteTimer);
        }

        // Hide dropdown if query too short
        if (!value || value.length < 2) {
            this.hideProductSuggestions();
            return;
        }

        // Debounce API calls (300ms)
        this._autocompleteTimer = setTimeout(() => {
            this.showProductSuggestions(value);
        }, 300);
    }

    /**
     * Fetch and show product suggestions
     * @param {string} query - Search query
     */
    async showProductSuggestions(query) {
        if (query.length < 2) {
            this.hideProductSuggestions();
            return;
        }

        try {
            let suggestions = [];

            if (this.isOnline) {
                // Online: fetch from API
                // Include shopping_list_id to get deleted items for restore
                const params = new URLSearchParams({
                    q: query,
                    limit: '10'
                });

                // Add shopping_list_id if we have a current list (enables restore of deleted items)
                if (this.currentListId) {
                    params.append('shopping_list_id', this.currentListId);
                    params.append('include_deleted', 'true');
                }

                const url = `/api/v1/shopping-list-items/products/suggest?${params}`;
                const response = await fetch(url);

                if (response.ok) {
                    const data = await response.json();
                    suggestions = data.suggestions || [];

                    // Cache suggestions for offline use (only active ones)
                    if (this.db && suggestions.length > 0) {
                        await this._cacheProductSuggestions(
                            suggestions.filter(s => !s.is_deleted)
                        );
                    }
                }
            } else {
                // Offline: search in cached suggestions
                suggestions = await this._searchCachedSuggestions(query);
            }

            this.renderSuggestionsDropdown(suggestions);

        } catch (error) {
            console.error('[Autocomplete] Error fetching suggestions:', error);
            // Try offline cache on error
            if (this.db) {
                const cached = await this._searchCachedSuggestions(query);
                if (cached.length > 0) {
                    this.renderSuggestionsDropdown(cached);
                }
            }
        }
    }

    /**
     * Render suggestions dropdown (Portal pattern for iOS Safari fix)
     * Dropdown is rendered in body with position: fixed and positioned via JS
     * @param {Array} suggestions - Product suggestions
     */
    renderSuggestionsDropdown(suggestions) {
        const dropdown = document.getElementById('product-suggestions-dropdown');
        if (!dropdown) return;

        if (!suggestions || suggestions.length === 0) {
            this.hideProductSuggestions();
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
                    <span class="font-medium text-sm">${this._escapeHtml(s.product_name)}</span>
                    ${s.is_deleted ? '<span class="badge badge-warning badge-xs">восстановить</span>' : ''}
                </div>
                <div class="text-xs text-base-content/60">
                    ${s.store_name ? `<span class="mr-2">🏪 ${this._escapeHtml(s.store_name)}</span>` : ''}
                    ${s.product_group_name ? `<span>📦 ${this._escapeHtml(s.product_group_name)}</span>` : ''}
                    ${s.is_deleted && s.quantity ? `<span class="ml-2">📊 ${s.quantity}${s.unit || ''}</span>` : ''}
                </div>
            </div>
        `).join('');

        dropdown.innerHTML = html;

        // Position dropdown below input field (Portal pattern)
        const input = document.getElementById('item-product-name');
        if (input) {
            const inputRect = input.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Calculate position (below input, aligned left)
            let top = inputRect.bottom + 4; // 4px gap (mt-1)
            let left = inputRect.left;
            let width = inputRect.width;

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
        this._currentSuggestions = suggestions;

        debugLog('[ListsManager] Showing', suggestions.length, 'suggestions');
    }

    /**
     * Select a suggestion from dropdown
     * Handles both regular suggestions (fill form) and deleted items (restore via API)
     * @param {number} index - Suggestion index
     */
    async selectSuggestion(index) {
        const suggestion = this._currentSuggestions?.[index];
        if (!suggestion) return;

        // If item is deleted - restore it via API instead of filling form
        if (suggestion.is_deleted && suggestion.id) {
            await this._restoreDeletedItem(suggestion);
            return;
        }

        // Regular suggestion - fill form with values
        this._fillFormFromSuggestion(suggestion);
        this.hideProductSuggestions();

        debugLog('[ListsManager] Selected suggestion:', suggestion.product_name);
    }

    /**
     * Restore a soft-deleted item via API
     * @param {Object} suggestion - Suggestion with id and is_deleted=true
     * @private
     */
    async _restoreDeletedItem(suggestion) {
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
            this.hideProductSuggestions();
            const modal = document.getElementById('item-modal');
            if (modal) modal.close();

            // Show success toast
            showToast(`Товар "${suggestion.product_name}" восстановлен`, 'success');

            // Reload items to show restored item
            if (this.currentListId) {
                await this.loadItems(this.currentListId);
            }

            debugLog('[ListsManager] Restored item:', restoredItem);

        } catch (error) {
            console.error('[ListsManager] Error restoring item:', error);
            showToast(`Ошибка восстановления: ${error.message}`, 'error');

            // Fallback: fill form for creating new item
            this._fillFormFromSuggestion(suggestion);
            this.hideProductSuggestions();
        }
    }

    /**
     * Fill form fields from suggestion
     * @param {Object} suggestion - Product suggestion
     * @private
     */
    _fillFormFromSuggestion(suggestion) {
        const productNameInput = document.getElementById('item-product-name');
        const storeSelect = document.getElementById('item-store');
        const productGroupSelect = document.getElementById('item-product-group');
        const quantityInput = document.getElementById('item-quantity');
        const unitSelect = document.getElementById('item-unit');
        const commentInput = document.getElementById('item-comment');

        // Product name
        if (productNameInput) {
            productNameInput.value = suggestion.product_name;
        }

        // Store (Choices.js)
        if (suggestion.store_id) {
            if (this.choicesInstances?.store) {
                this.choicesInstances.store.setChoiceByValue(String(suggestion.store_id));
            } else if (storeSelect) {
                storeSelect.value = suggestion.store_id;
            }
        }

        // Product group (Choices.js)
        if (suggestion.product_group_id) {
            if (this.choicesInstances?.productGroup) {
                this.choicesInstances.productGroup.setChoiceByValue(String(suggestion.product_group_id));
            } else if (productGroupSelect) {
                productGroupSelect.value = suggestion.product_group_id;
            }
        }

        // Quantity (from deleted item)
        if (suggestion.quantity && quantityInput) {
            quantityInput.value = suggestion.quantity;
        }

        // Unit (from deleted item)
        if (suggestion.unit && unitSelect) {
            unitSelect.value = suggestion.unit;
        }

        // Comment (from deleted item)
        if (suggestion.comment && commentInput) {
            commentInput.value = suggestion.comment;
        }
    }

    /**
     * Hide product suggestions dropdown
     */
    hideProductSuggestions() {
        const dropdown = document.getElementById('product-suggestions-dropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
            dropdown.innerHTML = '';
        }
        this._currentSuggestions = null;
    }

    /**
     * Cache product suggestions for offline use
     * @param {Array} suggestions - Suggestions to cache
     * @private
     */
    async _cacheProductSuggestions(suggestions) {
        if (!this.db) return;

        try {
            // Store each suggestion with product_name as key
            for (const suggestion of suggestions) {
                await this.db.setCache(
                    `product_suggestion_${suggestion.product_name.toLowerCase()}`,
                    suggestion,
                    86400 * 7  // 7 days TTL
                );
            }
        } catch (error) {
            console.error('[ListsManager] Error caching suggestions:', error);
        }
    }

    /**
     * Search cached suggestions offline
     * @param {string} query - Search query
     * @returns {Promise<Array>}
     * @private
     */
    async _searchCachedSuggestions(query) {
        if (!this.db) return [];

        try {
            // Get all cached items and filter by query
            const allCache = await this.db._getAll('data_cache');
            const suggestions = [];
            const queryLower = query.toLowerCase();

            for (const item of allCache) {
                if (item.key?.startsWith('product_suggestion_') &&
                    item.key.includes(queryLower)) {
                    if (item.value && item.expires > Date.now()) {
                        suggestions.push(item.value);
                    }
                }
            }

            // Sort by usage_count
            suggestions.sort((a, b) => (b.usage_count || 1) - (a.usage_count || 1));

            return suggestions.slice(0, 10);
        } catch (error) {
            console.error('[ListsManager] Error searching cached suggestions:', error);
            return [];
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} str - String to escape
     * @returns {string}
     * @private
     */
    _escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
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

    // Reset Choices.js instances (form.reset() doesn't affect Choices.js)
    if (window.listsManager?.choicesInstances?.store) {
        window.listsManager.choicesInstances.store.setChoiceByValue('');
    }
    if (window.listsManager?.choicesInstances?.productGroup) {
        window.listsManager.choicesInstances.productGroup.setChoiceByValue('');
    }

    // Reset quantity input step to default (integer)
    const quantityInput = document.getElementById('item-quantity');
    if (quantityInput) {
        quantityInput.step = '1';
    }

    // Ensure autocomplete is set up (mobile fix)
    window.listsManager?._setupProductAutocomplete();

    modal.showModal();

    // Focus input after modal animation (iOS Safari fix - увеличено с 100ms до 300ms)
    setTimeout(() => {
        const input = document.getElementById('item-product-name');
        if (input) {
            input.focus();
            // Принудительный клик может помочь на iOS
            input.click();
        }
    }, 300);
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
    document.getElementById('item-product-name').value = item.product_name;
    document.getElementById('item-quantity').value = item.quantity !== null ? item.quantity : '';
    document.getElementById('item-unit').value = item.unit || '';
    document.getElementById('item-comment').value = item.comment || '';
    document.getElementById('item-modal-title').textContent = '✏️ Редактировать товар';

    // Update quantity input step based on unit
    const quantityInput = document.getElementById('item-quantity');
    window.listsManager.updateQuantityInputStep(item.unit || '', quantityInput);

    // Update Choices.js instances for store and product group
    if (window.listsManager.choicesInstances.store) {
        window.listsManager.choicesInstances.store.setChoiceByValue(item.store_id.toString());
    }
    if (window.listsManager.choicesInstances.productGroup) {
        window.listsManager.choicesInstances.productGroup.setChoiceByValue(item.product_group_id.toString());
    }

    // Ensure autocomplete is set up (mobile fix)
    window.listsManager?._setupProductAutocomplete();

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
 * Handle save item form submission (with offline support)
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
        const manager = window.listsManager;
        let result;

        if (manager.offlineShopping) {
            // Use OfflineShoppingManager for online/offline support
            if (isEdit) {
                result = await manager.offlineShopping.updateItem(parseInt(itemId), data);
            } else {
                data.shopping_list_id = manager.currentListId;
                result = await manager.offlineShopping.createItem(data);
            }
        } else {
            // Fallback to direct fetch (no offline support)
            const url = isEdit
                ? `/api/v1/shopping-list-items/${itemId}`
                : '/api/v1/shopping-list-items';
            if (!isEdit) data.shopping_list_id = manager.currentListId;

            const response = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            result = await response.json();
        }

        showToast(isEdit ? 'Товар обновлен' : 'Товар добавлен', 'success');
        closeItemModal();

        // For EDIT: optimistic update (no race condition)
        if (isEdit) {
            const item = manager.currentItems.find(i => i.id === parseInt(itemId));
            if (item) {
                Object.assign(item, data);
                manager.renderCurrentView();
                manager.updateProgressBadge();
                await manager.updateItemsCache();
            }
        } else if (result.tempId && !result.id) {
            // CREATE offline: tempId exists but no real server ID
            // Offline mode needs immediate update (no WebSocket in offline)
            const newItem = {
                id: result.tempId,
                ...data,
                is_completed: false,
                _offline: true
            };
            // Get store and product group names for display
            const store = manager.stores?.find(s => s.id === data.store_id);
            const group = manager.productGroups?.find(g => g.id === data.product_group_id);
            if (store) newItem.store_name = store.name;
            if (group) newItem.product_group_name = group.name;

            manager.currentItems.push(newItem);
            manager.renderCurrentView();
            manager.updateProgressBadge();
            await manager.updateItemsCache();
        }
        // CREATE online (result.id exists): do nothing, WebSocket will add the item

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
 * Toggle hide completed items filter
 */
function toggleHideCompleted() {
    window.listsManager.toggleHideCompleted();
}

// ============================================================================
// FAB SPEED DIAL FUNCTIONS
// ============================================================================

/**
 * Toggle FAB menu (open/close)
 */
function toggleListsFAB() {
    const menu = document.getElementById('lists-fab-menu');
    const backdrop = document.getElementById('lists-fab-backdrop');
    if (!menu || !backdrop) return;

    const isOpen = menu.classList.contains('open');

    if (isOpen) {
        // Close FAB
        menu.classList.remove('open');
        menu.classList.add('closed');
        backdrop.classList.add('opacity-0', 'pointer-events-none', 'hidden');
    } else {
        // Open FAB
        menu.classList.remove('closed');
        menu.classList.add('open');
        backdrop.classList.remove('opacity-0', 'pointer-events-none', 'hidden');
    }
}

/**
 * Mark all items as completed - with confirmation dialog
 */
async function markAllCompletedWithConfirm() {
    toggleListsFAB(); // Close FAB first

    const manager = window.listsManager;
    if (!manager) return;

    const uncompletedCount = manager.currentItems.filter(item => !item.is_completed).length;

    if (uncompletedCount === 0) {
        showToast('Все товары уже отмечены', 'info');
        return;
    }

    const confirmed = await showConfirmDialog(
        `Отметить все ${uncompletedCount} товаров как выполненные?`,
        '✅ Отметить все'
    );

    if (confirmed) {
        await manager.markAllCompleted();
    }
}

/**
 * Unmark all items - with confirmation dialog
 */
async function unmarkAllCompletedWithConfirm() {
    toggleListsFAB(); // Close FAB first

    const manager = window.listsManager;
    if (!manager) return;

    const completedCount = manager.currentItems.filter(item => item.is_completed).length;

    if (completedCount === 0) {
        showToast('Нет отмеченных товаров', 'info');
        return;
    }

    const confirmed = await showConfirmDialog(
        `Снять отметки с ${completedCount} товаров?`,
        '☐ Снять отметки'
    );

    if (confirmed) {
        await manager.unmarkAllCompleted();
    }
}

/**
 * Delete all completed items - with confirmation dialog
 */
async function deleteCompletedWithConfirm() {
    toggleListsFAB(); // Close FAB first

    const manager = window.listsManager;
    if (!manager) return;

    const completedItems = manager.currentItems.filter(item => item.is_completed);

    if (completedItems.length === 0) {
        showToast('Нет отмеченных товаров', 'info');
        return;
    }

    const confirmed = await showConfirmDialog(
        `Удалить ${completedItems.length} отмеченных товаров?\nЭто действие необратимо.`,
        '🗑️ Удаление товаров'
    );

    if (confirmed) {
        await manager.deleteCompleted();
    }
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

/**
 * Toggle import wizard accordion (open/close)
 * Handles opening/closing the import wizard container and updating the visual indicator
 */
function toggleImportWizard() {
    const container = document.getElementById('import-wizard-container');
    const icon = document.getElementById('import-toggle-icon');
    const hint = document.getElementById('import-toggle-hint');
    const wizardContainer = document.getElementById('import-wizard');
    const isOpen = !container.classList.contains('hidden');

    if (isOpen) {
        // Closing - hide wizard and reset state
        container.classList.add('hidden');
        icon.textContent = '▶';
        if (hint) hint.classList.remove('hidden');

        if (wizardContainer) {
            wizardContainer.innerHTML = '';
        }
        if (window.importManager) {
            window.importManager.container = null;
            window.importManager.currentMethod = null;
        }
        debugLog('[ImportWizard] Closed and reset');
    } else {
        // Opening - show wizard and initialize
        container.classList.remove('hidden');
        icon.textContent = '▼';
        if (hint) hint.classList.add('hidden');
        initializeImportWizard();
    }
}

/**
 * Handle search input
 */
function handleItemsSearch(query) {
    window.listsManager.setSearchQuery(query);
}

/**
 * Clear search
 */
function clearItemsSearch() {
    window.listsManager.clearSearch();
}

debugLog('[ListsManager] Module loaded');

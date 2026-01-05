// TypeScript Migration - listsManager.ts
export {};

// Declare globals
declare const debugLog: (...args: any[]) => void;
declare const logLists: any;
declare const showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
declare const OfflineShoppingManager: any;
declare const HierarchyView: any;
declare const ImportManager: any;
declare const IndexedDBManager: any;
declare const Choices: any;
declare const showConfirmDialog: (message: string, title?: string) => Promise<boolean>;

// Declare window extensions
declare global {
    interface Window {
        offlineManager?: any;
        importManager?: any;
        hierarchyView?: any;
        deleteListId?: number;
        showLandingView?: () => void;
        openAddItemModal?: () => void;
        openCreateListModal?: () => void;
        closeItemModal?: () => void;
        closeCreateListModal?: () => void;
        handleCreateList?: (event: Event) => Promise<void>;
        openEditItemModal?: (itemId: number) => void;
        handleDeleteFromModal?: () => Promise<void>;
        handleSaveItem?: (event: Event) => Promise<void>;
        toggleSelectAll?: () => void;
        toggleSearchField?: () => void;
        toggleListsFAB?: () => void;
        markAllCompletedWithConfirm?: () => Promise<void>;
        unmarkAllCompletedWithConfirm?: () => Promise<void>;
        deleteCompletedWithConfirm?: () => Promise<void>;
        switchView?: (viewName: string) => void;
        toggleAllNodes?: () => void;
        openDeleteListModal?: (listId: number, listName: string) => void;
        closeDeleteListModal?: () => void;
        confirmDeleteList?: () => Promise<void>;
        toggleImportWizard?: () => void;
        handleItemsSearch?: (query: string) => void;
        clearItemsSearch?: () => void;
    }
}

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
    private currentListId: number | null;
    private currentView: string;
    private shoppingLists: any[];
    private currentItems: any[];
    private stores: any[];
    private productGroups: any[];
    private selectedItemIds: Set<number>;
    private choicesInstances: Record<string, any>;
    private hierarchyView: any;
    private db: any;
    private searchQuery: string;
    private hideCompleted: boolean;
    private offlineShopping: any;
    private _debouncedSearch: (() => void) | null;
    private _quantityChangeHandler: ((e: Event) => void) | null;
    private currentDuplicateItem: any;
    private handleUnitChange: ((event: any) => void) | null;
    private _autocompleteTimer: ReturnType<typeof setTimeout> | null;
    private _currentSuggestions: any[];

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
        this._debouncedSearch = null; // Debounced search function
        this._quantityChangeHandler = null; // Quantity change handler
        this.currentDuplicateItem = null; // Current duplicate item being handled
        this.handleUnitChange = null; // Unit change handler
        this._autocompleteTimer = null; // Autocomplete timer
        this._currentSuggestions = []; // Current autocomplete suggestions
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
            window.addEventListener('offline-status-change', async (event: Event) => {
                const { online } = (event as CustomEvent).detail || {};
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
     * Initialize duplicate detection listeners
     */
    initializeDuplicateDetection() {
        const productInput = document.getElementById('item-product-name');
        const storeSelect = document.getElementById('item-store');
        const quantityInput = document.getElementById('item-quantity');

        if (!productInput || !storeSelect) {
            console.warn('[LISTS] Duplicate detection inputs not found');
            return;
        }

        // Remove old listeners if they exist (prevent duplicates)
        if (this._debouncedSearch) {
            productInput.removeEventListener('input', this._debouncedSearch);
            storeSelect.removeEventListener('change', this._debouncedSearch);
            console.log('[LISTS] Removed old duplicate detection listeners');
        }

        if (this._quantityChangeHandler && quantityInput) {
            quantityInput.removeEventListener('input', this._quantityChangeHandler);
            console.log('[LISTS] Removed old quantity listener');
        }

        // Create new debounced search handler
        let searchTimeout: ReturnType<typeof setTimeout> | undefined;
        this._debouncedSearch = () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                const productName = (productInput as HTMLInputElement).value.trim();
                const storeId = parseInt((storeSelect as HTMLSelectElement).value);

                if (productName && storeId && this.currentListId) {
                    const duplicate = await this.searchDuplicate(productName, storeId);
                    if (duplicate) {
                        this.showDuplicateWarning(duplicate);
                    } else {
                        this.hideDuplicateWarning();
                    }
                } else {
                    this.hideDuplicateWarning();
                }
            }, 500); // 500ms debounce
        };

        // Add new listeners
        productInput.addEventListener('input', this._debouncedSearch);
        storeSelect.addEventListener('change', this._debouncedSearch);

        // Listen for quantity changes to update future quantity
        if (quantityInput) {
            this._quantityChangeHandler = () => {
                console.log('[FUTURE_QTY] Quantity input changed, updating future quantity display');
                this.updateFutureQuantity();
            };
            quantityInput.addEventListener('input', this._quantityChangeHandler);
            console.log('[LISTS] Future quantity listener initialized');
        } else {
            console.warn('[LISTS] Quantity input not found (id=item-quantity)');
        }

        console.log('[LISTS] Duplicate detection initialized');
    }

    /**
     * Search for duplicate item in current list
     * @param {string} productName - Product name
     * @param {number} storeId - Store ID
     * @returns {Promise<Object|null>} Duplicate item or null
     */
    async searchDuplicate(productName: string, storeId: number) {
        if (!productName || !storeId || !this.currentListId) {
            return null;
        }

        try {
            console.log('[DUPLICATE_SEARCH] Searching for duplicate', {
                productName,
                storeId,
                listId: this.currentListId
            });

            const url = new URL('/api/v1/shopping-list-items/check-duplicate', window.location.origin);
            url.searchParams.set('shopping_list_id', String(this.currentListId));
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
     * @param {Object} duplicateItem - Duplicate item data
     */
    showDuplicateWarning(duplicateItem: any) {
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
        this.currentDuplicateItem = duplicateItem;

        // Calculate and show future quantity if quantity already entered
        this.updateFutureQuantity();

        console.log('[DUPLICATE_SEARCH] Warning displayed', { itemId: duplicateItem.id });
    }

    /**
     * Hide duplicate warning
     */
    hideDuplicateWarning() {
        const container = document.getElementById('duplicate-warning-container');
        if (container) {
            container.classList.add('hidden');
        }

        // Hide future quantity
        const futureQtyContainer = document.getElementById('future-quantity');
        if (futureQtyContainer) {
            futureQtyContainer.classList.add('hidden');
        }

        this.currentDuplicateItem = null;
        console.log('[DUPLICATE_SEARCH] Warning hidden');
    }

    /**
     * Update future quantity display when user enters quantity
     */
    updateFutureQuantity() {
        console.log('[FUTURE_QTY] updateFutureQuantity() called');

        const quantityInput = document.getElementById('item-quantity');
        const futureQtyContainer = document.getElementById('future-quantity');
        const futureQtyValue = document.getElementById('future-quantity-value');

        if (!quantityInput) {
            console.warn('[FUTURE_QTY] Quantity input not found (id=item-quantity)');
            return;
        }
        if (!futureQtyContainer) {
            console.warn('[FUTURE_QTY] Future quantity container not found (id=future-quantity)');
            return;
        }
        if (!futureQtyValue) {
            console.warn('[FUTURE_QTY] Future quantity value span not found (id=future-quantity-value)');
            return;
        }

        console.log('[FUTURE_QTY] All DOM elements found');

        // Only show if duplicate exists
        if (!this.currentDuplicateItem) {
            console.log('[FUTURE_QTY] No duplicate item stored, hiding future quantity');
            futureQtyContainer.classList.add('hidden');
            return;
        }

        console.log('[FUTURE_QTY] Duplicate item exists', {
            itemId: this.currentDuplicateItem.id,
            productName: this.currentDuplicateItem.product_name,
            quantity: this.currentDuplicateItem.quantity,
            unit: this.currentDuplicateItem.unit
        });

        const newQuantity = parseFloat((quantityInput as HTMLInputElement).value) || 0;
        const oldQuantity = parseFloat(this.currentDuplicateItem.quantity) || 0;

        console.log('[FUTURE_QTY] Quantity values', {
            newQuantity,
            oldQuantity,
            inputValue: (quantityInput as HTMLInputElement).value
        });

        // Only show if user entered quantity
        if (newQuantity > 0) {
            const futureQuantity = oldQuantity + newQuantity;
            const unit = this.currentDuplicateItem.unit || '';

            futureQtyValue.textContent = `${futureQuantity} ${unit}`;
            futureQtyContainer.classList.remove('hidden');

            console.log('[FUTURE_QTY] Future quantity displayed', {
                oldQuantity,
                newQuantity,
                futureQuantity,
                unit,
                displayText: futureQtyValue.textContent
            });
        } else {
            console.log('[FUTURE_QTY] New quantity is 0 or empty, hiding future quantity');
            futureQtyContainer.classList.add('hidden');
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

        // CRITICAL: Close import wizard when returning to landing view
        closeImportWizard();

        // Desktop FAB visibility: Landing View
        // Hide detail view FABs (mass operations + add item)
        this.hideFAB();
        this.hideAddItemFAB();
        // Show create list FAB
        this.showCreateListFAB();

        // Show landing view, hide detail view
        document.getElementById('landing-view')?.classList.remove('hidden');
        document.getElementById('detail-view')?.classList.add('hidden');

        // Load shopping lists
        await this.loadShoppingLists();
        this.renderShoppingListCards();
    }

    /**
     * Show Detail View (items table for specific list)
     */
    async showDetailView(listId: number) {
        debugLog('[ListsManager] Showing detail view for list:', listId);

        // IMPORTANT: Full state reset BEFORE loading new list
        // This prevents showing old list data while new list loads
        this.currentItems = [];  // Clear items immediately
        this.selectedItemIds.clear();
        this.currentListId = listId;

        // CRITICAL: Close import wizard to prevent data isolation breach
        // (CSV import from List A must not leak into List B)
        closeImportWizard();

        // Reset search query for new list
        this.searchQuery = '';
        const searchInput = document.getElementById('items-search') as HTMLInputElement | null;
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

        // Restore search field visibility from localStorage
        try {
            const searchVisible = localStorage.getItem('lists_search_visible');
            if (searchVisible === 'true') {
                // Show search field by triggering toggle
                const container = document.getElementById('search-field-container');
                const button = document.getElementById('toggle-search-btn');
                if (container && button) {
                    container.classList.remove('hidden');
                    button.classList.remove('btn-outline');
                    button.classList.add('btn-primary');
                    console.log('[SEARCH] Restored search field visibility:', { visible: true });
                }
            }
        } catch (e) {
            // Ignore localStorage errors
        }

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

        // Update breadcrumb
        const breadcrumbElement = document.getElementById('breadcrumb-list-name');
        if (breadcrumbElement) breadcrumbElement.textContent = list.name;

        // Show detail view, hide landing view
        const landingView = document.getElementById('landing-view');
        const detailView = document.getElementById('detail-view');
        if (landingView) landingView.classList.add('hidden');
        if (detailView) detailView.classList.remove('hidden');

        // Desktop FAB visibility: Detail View
        // Hide create list FAB (only visible in landing view)
        this.hideCreateListFAB();
        // Show detail view FABs (mass operations + add item)
        this.showFAB();
        this.showAddItemFAB();

        // Load items for this list
        await this.loadShoppingListItems(listId);

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

        // Update FAB visibility AFTER switchView to ensure it's visible in all views
        this.updateFABVisibility();

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
    async loadShoppingListItems(listId: number) {
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
    
        } catch (error) {
            console.error('[ListsManager] Error loading items:', error);

            // Fallback to cache on error
            if (this.db) {
                try {
                    const cached = await this.db.getCache(CACHE_KEY);
                    this.currentItems = cached || [];
                    debugLog('[ListsManager] Loaded items from cache (fallback):', this.currentItems.length);
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
            if (grid) grid.classList.add('hidden');
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (grid) grid.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');

        if (!grid) return;
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
    getProductGroupBreadcrumbs(groupId: number) {
        const groupMap: Record<number, any> = {};
        this.productGroups.forEach(group => {
            groupMap[group.id] = group;
        });

        const path: any[] = [];
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
        const desktopTable = document.getElementById('desktop-table-container');

        // Apply search filter
        const filteredItems = this.filterItemsBySearch();

        if (filteredItems.length === 0) {
            // Use table-content-hidden to hide without breaking responsive classes
            if (desktopTable) desktopTable.classList.add('table-content-hidden');
            if (emptyState) emptyState.classList.remove('hidden');

            // Update empty state message based on search or hide completed
            const emptyTitle = emptyState?.querySelector('h3');
            const emptyText = emptyState?.querySelector('p');
            const emptyButton = emptyState?.querySelector('button');
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
        if (emptyState) emptyState.classList.add('hidden');

        // Render desktop table
        if (!tbody) return;
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

        // Update selection UI
        this.updateSelectionUI();
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
        const storeMap: Record<number, string> = {};
        this.stores.forEach(s => { storeMap[s.id] = s.name || ''; });

        const groupMap: Record<number, any> = {};
        this.productGroups.forEach(g => { groupMap[g.id] = g; });

        // Helper to get all ancestor names for a group
        const getGroupAncestorNames = (groupId: number) => {
            const names: string[] = [];
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
    setSearchQuery(query: string) {
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
        const input = document.getElementById('items-search') as HTMLInputElement | null;
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
        this.updateFABButtons();
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
     * Toggle search field visibility
     * Shows/hides search field with animation
     * Saves state to localStorage for persistence
     */
    toggleSearchField() {
        const container = document.getElementById('search-field-container');
        const button = document.getElementById('toggle-search-btn');

        if (!container || !button) {
            console.error('[SEARCH] Search field elements not found');
            return;
        }

        const isVisible = !container.classList.contains('hidden');

        if (isVisible) {
            // Hide search field
            container.classList.add('hidden');
            button.classList.remove('btn-primary');
            button.classList.add('btn-outline');
            console.log('[SEARCH] Search field toggled:', { visible: false });
        } else {
            // Show search field
            container.classList.remove('hidden');
            button.classList.remove('btn-outline');
            button.classList.add('btn-primary');
            console.log('[SEARCH] Search field toggled:', { visible: true });

            // Auto-focus search input
            const searchInput = document.getElementById('items-search');
            if (searchInput) {
                setTimeout(() => searchInput.focus(), 100);
            }
        }

        // Save state to localStorage
        try {
            localStorage.setItem('lists_search_visible', (!isVisible).toString());
        } catch (e) {
            // Ignore localStorage errors
            console.warn('[SEARCH] Failed to save search visibility to localStorage:', e);
        }
    }

    /**
     * Update FAB visibility
     * Shows FAB when in detail view (regardless of item count)
     */
    updateFABVisibility() {
        const fabMenu = document.getElementById('lists-fab-menu');
        const fabBackdrop = document.getElementById('lists-fab-backdrop');
        if (!fabMenu) return;

        // Show FAB when viewing a list (even if empty)
        if (this.currentListId) {
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
     * Update FAB button visibility based on item completion state
     *
     * Visibility rules:
     * - Delete completed (🗑️): Show only if at least 1 completed item exists
     * - Mark all completed (✅): Hide if ALL items are completed
     * - Unmark all completed (❌): Hide if ALL items are NOT completed
     */
    updateFABButtons() {
        // Early exit if no items
        if (!this.currentItems || this.currentItems.length === 0) {
            // Hide all action button containers when list is empty
            document.getElementById('fab-item-delete-completed')?.classList.add('hidden');
            document.getElementById('fab-item-mark-all-completed')?.classList.add('hidden');
            document.getElementById('fab-item-unmark-all-completed')?.classList.add('hidden');
            return;
        }

        // Count item states
        const completedCount = this.currentItems.filter(item => item.is_completed).length;
        const totalCount = this.currentItems.length;
        const uncompletedCount = totalCount - completedCount;

        // Delete completed container (🗑️): Show only if there are completed items
        const deleteItem = document.getElementById('fab-item-delete-completed');
        if (deleteItem) {
            if (completedCount > 0) {
                deleteItem.classList.remove('hidden');
            } else {
                deleteItem.classList.add('hidden');
            }
        }

        // Mark all completed container (✅): Hide if all items are already completed
        const markAllItem = document.getElementById('fab-item-mark-all-completed');
        if (markAllItem) {
            if (uncompletedCount > 0) {
                markAllItem.classList.remove('hidden');
            } else {
                markAllItem.classList.add('hidden');
            }
        }

        // Unmark all completed container (❌): Hide if all items are uncompleted
        const unmarkAllItem = document.getElementById('fab-item-unmark-all-completed');
        if (unmarkAllItem) {
            if (completedCount > 0) {
                unmarkAllItem.classList.remove('hidden');
            } else {
                unmarkAllItem.classList.add('hidden');
            }
        }
    }

    /**
     * Check if we're on desktop (lg breakpoint = 1024px)
     * Uses matchMedia for reliable viewport detection (works in Yandex Browser)
     */
    isDesktop() {
        // Desktop = wide screen (>= 1024px) AND primary pointer is NOT touch
        // CRITICAL: Use 'pointer: fine' (primary pointer) NOT 'any-pointer: fine'
        // This ensures FAB buttons are hidden when primary input is touch,
        // even if device has mouse/trackpad available (iPad with keyboard, Surface tablet)
        const isWideScreen = window.matchMedia('(min-width: 1024px)').matches;

        // Check PRIMARY pointer precision (not secondary/any pointer)
        // pointer: fine = primary input device has fine precision (mouse/trackpad)
        // Returns true: Desktop PC, laptop (mouse/trackpad is primary)
        // Returns false: iPad, Android tablet, Surface in tablet mode (touch is primary)
        const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

        // Also check that primary pointer is NOT touch (defensive check)
        // pointer: coarse = primary input device is touch
        const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

        console.log('[FAB_DETECTION]', {
            isWideScreen,
            hasFinePointer,
            hasCoarsePointer,
            result: isWideScreen && hasFinePointer && !hasCoarsePointer,
            userAgent: navigator.userAgent
        });

        // All conditions must be true for desktop
        return isWideScreen && hasFinePointer && !hasCoarsePointer;
    }

    /**
     * Show FAB menu (detail view only - mass operations, desktop only)
     */
    showFAB() {
        const isDesktopResult = this.isDesktop();
        console.log('[FAB] showFAB() called', { isDesktop: isDesktopResult });
        if (!isDesktopResult) return; // Only manage on desktop
        const fabMenu = document.getElementById('lists-fab-menu');
        if (fabMenu) {
            fabMenu.classList.remove('hidden');
            console.log('[FAB] lists-fab-menu shown');
            // Don't add 'open' - that's for when user clicks to expand
        }
    }

    /**
     * Hide FAB menu (when switching to landing view, desktop only)
     */
    hideFAB() {
        const isDesktopResult = this.isDesktop();
        console.log('[FAB] hideFAB() called', { isDesktop: isDesktopResult });
        if (!isDesktopResult) return; // Only manage on desktop
        const fabMenu = document.getElementById('lists-fab-menu');
        const fabBackdrop = document.getElementById('lists-fab-backdrop');
        if (fabMenu) {
            fabMenu.classList.add('hidden', 'closed');
            fabMenu.classList.remove('open');
            console.log('[FAB] lists-fab-menu hidden');
        }
        if (fabBackdrop) {
            fabBackdrop.classList.add('hidden', 'opacity-0', 'pointer-events-none');
        }
    }

    /**
     * Show add item FAB (detail view only - desktop only)
     */
    showAddItemFAB() {
        const isDesktopResult = this.isDesktop();
        console.log('[FAB] showAddItemFAB() called', { isDesktop: isDesktopResult });
        if (!isDesktopResult) return; // Only manage on desktop
        const addItemFAB = document.getElementById('add-item-fab');
        if (addItemFAB) {
            addItemFAB.classList.remove('hidden');
            console.log('[FAB] add-item-fab shown');
        }
    }

    /**
     * Hide add item FAB (when switching to landing view, desktop only)
     */
    hideAddItemFAB() {
        const isDesktopResult = this.isDesktop();
        console.log('[FAB] hideAddItemFAB() called', { isDesktop: isDesktopResult });
        if (!isDesktopResult) return; // Only manage on desktop
        const addItemFAB = document.getElementById('add-item-fab');
        if (addItemFAB) {
            addItemFAB.classList.add('hidden');
            console.log('[FAB] add-item-fab hidden');
        }
    }

    /**
     * Show create list FAB (landing view only - desktop only)
     */
    showCreateListFAB() {
        const isDesktopResult = this.isDesktop();
        console.log('[FAB] showCreateListFAB() called', { isDesktop: isDesktopResult });
        if (!isDesktopResult) return; // Only manage on desktop
        const createListFAB = document.getElementById('create-list-fab');
        if (createListFAB) {
            createListFAB.classList.remove('hidden');
            console.log('[FAB] create-list-fab shown');
        }
    }

    /**
     * Hide create list FAB (when switching to detail view, desktop only)
     */
    hideCreateListFAB() {
        const isDesktopResult = this.isDesktop();
        console.log('[FAB] hideCreateListFAB() called', { isDesktop: isDesktopResult });
        if (!isDesktopResult) return; // Only manage on desktop
        const createListFAB = document.getElementById('create-list-fab');
        if (createListFAB) {
            createListFAB.classList.add('hidden');
            console.log('[FAB] create-list-fab hidden');
        }
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

        // ============================================
        // FIX: Add z-index class toggle for modal dropdown
        // ============================================
        const modal = document.getElementById('item-modal');
        console.warn('[LISTS_MODAL] Modal element:', modal);

        if (modal) {
            // Get Choices container directly from Choices.js instance API
            // containerOuter.element is the main .choices DOM element
            const choicesContainer = this.choicesInstances.store.containerOuter.element;
            console.warn('[LISTS_MODAL] Choices container element:', choicesContainer);
            console.warn('[LISTS_MODAL] Container classes:', choicesContainer ? choicesContainer.className : 'N/A');

            if (choicesContainer) {
                // Create MutationObserver to watch for .is-open class changes
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        console.warn('[LISTS_MODAL] Mutation detected:', mutation.type, mutation.attributeName);
                        console.warn('[LISTS_MODAL] Current classes:', choicesContainer.className);
                        console.warn('[LISTS_MODAL] Has is-open:', choicesContainer.classList.contains('is-open'));

                        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                            if (choicesContainer.classList.contains('is-open')) {
                                // Dropdown opened - add diagnostic logging
                                modal.classList.add('store-dropdown-open');
                                console.warn('[LISTS_MODAL] ✅ Store dropdown OPENED - z-index fix applied');
                                console.warn('[LISTS_MODAL] Modal classes after:', modal.className);

                                // DIAGNOSTIC: Check ALL dropdowns (Choices.js creates multiple)
                                setTimeout(() => {
                                    const allDropdowns = document.querySelectorAll('.choices__list--dropdown');
                                    console.warn('[LISTS_MODAL] 🔍 Total dropdowns in DOM:', allDropdowns.length);

                                    allDropdowns.forEach((dropdown, index) => {
                                        const style = window.getComputedStyle(dropdown);
                                        const rect = dropdown.getBoundingClientRect();
                                        const isVisible = style.display !== 'none' && rect.height > 0;

                                        console.warn(`[LISTS_MODAL] 🔍 Dropdown #${index}:`, {
                                            display: style.display,
                                            visibility: style.visibility,
                                            height: rect.height,
                                            zIndex: style.zIndex,
                                            isVisible: isVisible,
                                            parent: dropdown.parentElement?.className,
                                            itemsCount: dropdown.children.length
                                        });

                                        if (isVisible) {
                                            console.warn(`[LISTS_MODAL] ✅ VISIBLE dropdown #${index} found!`);
                                            console.warn('[LISTS_MODAL] 🔍 Rect:', rect);
                                            console.warn('[LISTS_MODAL] 🔍 Inside modal?', modal.contains(dropdown));

                                            // Parent chain for visible dropdown
                                            let parent = dropdown.parentElement;
                                            let depth = 0;
                                            console.warn('[LISTS_MODAL] 🔍 Parent chain:');
                                            while (parent && depth < 10) {
                                                console.warn(`[LISTS_MODAL]    ${depth}: ${parent.tagName}#${parent.id || 'NO-ID'}.${parent.className}`);
                                                parent = parent.parentElement;
                                                depth++;
                                            }
                                        }
                                    });
                                }, 100); // Delay to let Choices.js finish rendering
                            } else {
                                // Dropdown closed
                                modal.classList.remove('store-dropdown-open');
                                console.warn('[LISTS_MODAL] ❌ Store dropdown CLOSED - z-index fix removed');
                                console.warn('[LISTS_MODAL] Modal classes after:', modal.className);
                            }
                        }
                    });
                });

                // Start observing class attribute changes
                observer.observe(choicesContainer, {
                    attributes: true,
                    attributeFilter: ['class']
                });

                console.warn('[LISTS_MODAL] 🎯 Store dropdown z-index fix initialized (MutationObserver)');
                console.warn('[LISTS_MODAL] Observing element:', choicesContainer);
            } else {
                console.error('[LISTS_MODAL] ⚠️ Choices container not found in instance API');
                console.warn('[LISTS_MODAL] Store instance:', this.choicesInstances.store);
            }
        } else {
            console.error('[LISTS_MODAL] ⚠️ Modal element #item-modal not found');
        }
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
    buildProductGroupTree(groups: any[]) {
        const map: Record<number, any> = {};
        const roots: any[] = [];

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
        const groupMap: Record<number, any> = {};
        this.productGroups.forEach(group => {
            groupMap[group.id] = group;
        });

        // Helper to get full parent chain (excluding leaf itself)
        const getParentChain = (groupId: number) => {
            const path: string[] = [];
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
        const choices: any[] = [];
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
        const unitSelect = document.getElementById('item-unit') as HTMLSelectElement | null;
        const quantityInput = document.getElementById('item-quantity') as HTMLInputElement | null;

        if (!unitSelect || !quantityInput) return;

        // Remove existing listener if any
        if (this.handleUnitChange) {
            unitSelect.removeEventListener('change', this.handleUnitChange);
        }

        // Create bound handler
        this.handleUnitChange = (event: Event) => {
            const unit = (event.target as HTMLSelectElement).value;
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
    updateQuantityInputStep(unit: string, quantityInput: HTMLInputElement) {
        if (unit === 'кг') {
            // For kg: allow one decimal place
            quantityInput.step = '0.1';
        } else {
            // For all other units: integer only
            quantityInput.step = '1';

            // Round current value to integer if it has decimals
            const currentValue = parseFloat(quantityInput.value);
            if (!isNaN(currentValue) && currentValue !== Math.round(currentValue)) {
                quantityInput.value = String(Math.round(currentValue));
            }
        }
    }

    /**
     * Toggle item selection
     */
    toggleItemSelection(itemId: number, isSelected: boolean) {
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
        const deleteBtn = document.getElementById('delete-selected-btn') as HTMLButtonElement | null;
        const selectAllBtn = document.getElementById('select-all-btn') as HTMLButtonElement | null;

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
    async toggleItemCompleted(itemId: number, isCompleted: boolean) {
        // 1. Optimistic UI update - update state and render immediately
        const item = this.currentItems.find(i => i.id === itemId);
        if (item) {
            item.is_completed = isCompleted;
        }
        this.renderCurrentView();
        this.updateFABVisibility();
        this.updateFABButtons();

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
            if (this.isOnline && !(error as Error).message?.includes('offline')) {
                if (item) item.is_completed = !isCompleted;
                this.renderCurrentView();
                        showToast('Ошибка обновления статуса', 'error');
            }
        }
    }

    /**
     * Delete item (with offline support)
     */
    async deleteItem(itemId: number) {
        if (!confirm('Удалить этот товар?')) return;

        // 1. Optimistic UI update - save deleted item for potential revert
        const itemIndex = this.currentItems.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return;

        const deletedItem = this.currentItems[itemIndex];
        this.currentItems.splice(itemIndex, 1);
        this.selectedItemIds.delete(itemId);
        this.renderCurrentView();

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
            if (this.isOnline && !(error as Error).message?.includes('offline')) {
                this.currentItems.splice(itemIndex, 0, deletedItem);
                this.renderCurrentView();
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
                this.updateFABVisibility();
            this.updateFABButtons();

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
                this.updateFABVisibility();
            this.updateFABButtons();

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
                this.updateFABVisibility();
            this.updateFABButtons();

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
    switchView(viewName: string) {
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
            document.getElementById('table-view')?.classList.remove('hidden');
            document.getElementById('hierarchy-view')?.classList.add('hidden');
            document.getElementById('table-view-btn')?.classList.remove('btn-outline');
            document.getElementById('hierarchy-view-btn')?.classList.add('btn-outline');

            // Show table controls, hide hierarchy controls
            const tableControls = document.getElementById('table-controls');
            const hierarchyControls = document.getElementById('hierarchy-controls');
            if (tableControls) tableControls.classList.remove('hidden');
            if (hierarchyControls) hierarchyControls.classList.add('hidden');

            // Re-render table to sync checkbox states
            this.renderItemsTable();
        } else if (viewName === 'hierarchy') {
            document.getElementById('table-view')?.classList.add('hidden');
            document.getElementById('hierarchy-view')?.classList.remove('hidden');
            document.getElementById('table-view-btn')?.classList.add('btn-outline');
            document.getElementById('hierarchy-view-btn')?.classList.remove('btn-outline');

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

        // Ensure FAB remains visible after view switch
        this.updateFABVisibility();
    }

    /**
     * Count total nodes in hierarchy (stores + product groups)
     * @returns {number} Total node count
     */
    _getTotalNodeCount() {
        if (!this.hierarchyView) return 0;

        const hierarchy = this.hierarchyView.buildHierarchy(
            this.currentItems,
            this.stores,
            this.productGroups
        );

        let total = 0;
        Object.values(hierarchy).forEach((store: any) => {
            total++; // Store node
            total += this._countProductGroupNodes(store.productGroupTree);
        });

        return total;
    }

    /**
     * Recursively count product group nodes in a tree
     * @param {Object} pgTree - Product group tree
     * @returns {number} Node count
     */
    _countProductGroupNodes(pgTree: any[]) {
        let count = 0;
        Object.values(pgTree).forEach(pg => {
            count++; // Product group node
            count += this._countProductGroupNodes(pg.children);
        });
        return count;
    }

    /**
     * Update smart toggle button state based on expanded/collapsed nodes
     */
    updateHierarchyToggleButton() {
        const btn = document.getElementById('hierarchy-toggle-btn');
        const icon = document.getElementById('hierarchy-toggle-icon');
        const text = document.getElementById('hierarchy-toggle-text');

        if (!btn || !icon || !text) return;

        const totalNodes = this._getTotalNodeCount();
        const expandedCount = this.hierarchyView ? this.hierarchyView.expandedNodes.size : 0;

        debugLog(`[HIERARCHY] Toggle state: ${expandedCount}/${totalNodes} expanded`);

        // All expanded → show "Collapse"
        if (expandedCount === totalNodes && totalNodes > 0) {
            icon.textContent = '⬆️';
            text.textContent = 'Свернуть';
            btn.title = 'Свернуть все узлы';
            btn.dataset.action = 'collapse';
        }
        // Any collapsed → show "Expand"
        else {
            icon.textContent = '⬇️';
            text.textContent = 'Развернуть';
            btn.title = 'Развернуть все узлы';
            btn.dataset.action = 'expand';
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text: string) {
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
    formatQuantity(quantity: number, unit: string) {
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
    updateOfflineUI(isOffline: boolean) {
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
    addItemToUI(item: any) {
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
        this.updateFABVisibility();
        this.updateFABButtons();
        this.updateItemsCache();

        // Show notification
        showToast(`Добавлен товар: ${item.product_name}`, 'info');
    }

    /**
     * Update item in UI (from WebSocket event)
     * @param {Object} item - Updated item data from server (must contain shopping_list_id)
     */
    updateItemInUI(item: any) {
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
        this.updateFABButtons();
        this.updateFABVisibility();
        this.updateItemsCache();
    }

    /**
     * Remove item from UI (from WebSocket event)
     * @param {number} itemId - Item ID to remove
     * @param {number} shoppingListId - Shopping list ID (for filtering)
     */
    removeItemFromUI(itemId: number, shoppingListId: number) {
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
        this.updateFABButtons();
        this.updateFABVisibility();
        this.updateItemsCache();

        // Show notification
        showToast(`Удалён товар: ${removedItem.product_name}`, 'info');
    }

    /**
     * Toggle item completed status in UI (from WebSocket event)
     * @param {number} itemId - Item ID
     * @param {boolean} isCompleted - New completed status
     * @param {number} shoppingListId - Shopping list ID (for filtering)
     */
    toggleItemCompletedInUI(itemId: number, isCompleted: boolean, shoppingListId: number) {
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
        this.updateFABButtons();
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
                this.updateFABButtons();
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
            this.handleProductInput((input as HTMLInputElement).value);
        };

        // Multiple events for cross-browser mobile compatibility
        input.addEventListener('input', handler);      // Primary (desktop & some mobile)
        input.addEventListener('keyup', handler);      // Fallback for mobile keyboards
        input.addEventListener('compositionend', handler); // IME input (iOS, Android)

        (input as any)._autocompleteInitialized = true;

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
                this.selectSuggestion(index);
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

    /**
     * Handle product input for autocomplete
     * @param {string} value - Input value
     */
    handleProductInput(value: string) {
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
    async showProductSuggestions(query: string) {
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
                    params.append('shopping_list_id', String(this.currentListId));
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
                            suggestions.filter((s: any) => !s.is_deleted)
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
    renderSuggestionsDropdown(suggestions: any[]) {
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
    async selectSuggestion(index: number) {
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
    async _restoreDeletedItem(suggestion: any) {
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
            const modal = document.getElementById('item-modal') as HTMLDialogElement | null;
            if (modal) (modal as any).close();

            // Show success toast
            showToast(`Товар "${suggestion.product_name}" восстановлен`, 'success');

            // Reload items to show restored item
            if (this.currentListId) {
                await this.loadShoppingListItems(this.currentListId);
            }

            debugLog('[ListsManager] Restored item:', restoredItem);

        } catch (error: any) {
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
    _fillFormFromSuggestion(suggestion: any) {
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
            if (this.choicesInstances?.store) {
                this.choicesInstances.store.setChoiceByValue(String(suggestion.store_id));
            } else if (storeSelect) {
                storeSelect.value = String(suggestion.store_id);
            }
        }

        // Product group (Choices.js)
        if (suggestion.product_group_id) {
            if (this.choicesInstances?.productGroup) {
                this.choicesInstances.productGroup.setChoiceByValue(String(suggestion.product_group_id));
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
        console.log('[AUTOCOMPLETE] Form filled from suggestion', {
            productName: suggestion.product_name,
            storeId: suggestion.store_id,
            quantity: suggestion.quantity
        });

        // Check for duplicates after form is filled
        const productName = productNameInput?.value?.trim();
        const storeId = this.choicesInstances?.store?.getValue(true) || storeSelect?.value;

        if (productName && storeId && this.currentListId) {
            console.log('[AUTOCOMPLETE] Triggering duplicate check after autocomplete selection');

            // Trigger duplicate search asynchronously
            this.searchDuplicate(productName, parseInt(storeId)).then(duplicate => {
                if (duplicate) {
                    console.log('[AUTOCOMPLETE] Duplicate found after autocomplete, showing warning');
                    this.showDuplicateWarning(duplicate);

                    // If quantity is already filled (from suggestion), update future quantity display
                    if (quantityInput?.value) {
                        console.log('[AUTOCOMPLETE] Quantity already filled, updating future quantity');
                        this.updateFutureQuantity();
                    }
                } else {
                    console.log('[AUTOCOMPLETE] No duplicate found after autocomplete');
                }
            }).catch(error => {
                console.error('[AUTOCOMPLETE] Error checking duplicate after autocomplete:', error);
            });
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
        this._currentSuggestions = [];
    }

    /**
     * Cache product suggestions for offline use
     * @param {Array} suggestions - Suggestions to cache
     * @private
     */
    async _cacheProductSuggestions(suggestions: any[]) {
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
    async _searchCachedSuggestions(query: string) {
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
    _escapeHtml(str: string) {
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
    const modal = document.getElementById('create-list-modal') as HTMLDialogElement | null;
    const form = document.getElementById('create-list-form') as HTMLFormElement | null;
    if (form) form.reset();
    if (modal) (modal as any).showModal();
}

/**
 * Close create list modal
 */
function closeCreateListModal() {
    const modal = document.getElementById('create-list-modal') as HTMLDialogElement | null;
    if (modal) (modal as any).close();
}

/**
 * Handle create list form submission
 */
async function handleCreateList(event: Event) {
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
    const modal = document.getElementById('item-modal') as HTMLDialogElement | null;
    const form = document.getElementById('item-form') as HTMLFormElement | null;
    if (form) form.reset();
    const itemIdInput = document.getElementById('item-id') as HTMLInputElement | null;
    if (itemIdInput) itemIdInput.value = '';
    const modalTitle = document.getElementById('item-modal-title');
    if (modalTitle) modalTitle.textContent = '📝 Добавить товар';

    // Reinitialize Choices.js with latest data (fixes issue after CSV import)
    // This ensures newly created stores/groups are visible
    if (window.listsManager) {
        window.listsManager.initStoreChoices();
        window.listsManager.initProductGroupChoices();
    }

    // Reset quantity input step to default (integer)
    const quantityInput = document.getElementById('item-quantity') as HTMLInputElement | null;
    if (quantityInput) {
        quantityInput.step = '1';
    }

    // Ensure autocomplete is set up (mobile fix)
    window.listsManager?._setupProductAutocomplete();

    // Initialize duplicate detection
    window.listsManager?.initializeDuplicateDetection();

    // Hide duplicate warning on modal open
    window.listsManager?.hideDuplicateWarning();

    // Hide delete button (not applicable for new items)
    const deleteBtn = document.getElementById('item-modal-delete-btn');
    if (deleteBtn) {
        deleteBtn.classList.add('hidden');
        console.log('[MODAL_ADD] Delete button hidden (new item mode)');
    }

    if (modal) (modal as any).showModal();

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
function openEditItemModal(itemId: number) {
    const item = window.listsManager.currentItems.find((i: any) => i.id === itemId);
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
    if (productNameInput) productNameInput.value = item.product_name;
    if (quantityInput) quantityInput.value = item.quantity !== null ? String(item.quantity) : '';
    if (unitSelect) unitSelect.value = item.unit || '';
    if (commentInput) commentInput.value = item.comment || '';
    if (modalTitle) modalTitle.textContent = '✏️ Редактировать товар';

    // Show delete button (only for existing items, not new items)
    const deleteBtn = document.getElementById('item-modal-delete-btn');
    if (deleteBtn) {
        deleteBtn.classList.remove('hidden');
        console.log('[MODAL_EDIT] Delete button shown', { itemId });
    }

    // Update quantity input step based on unit
    const quantityInputForUnit = document.getElementById('item-quantity') as HTMLInputElement | null;
    if (quantityInputForUnit) {
        window.listsManager.updateQuantityInputStep(item.unit || '', quantityInputForUnit);
    }

    // Reinitialize Choices.js with latest data (fixes issue after CSV import)
    // This ensures newly created stores/groups are visible
    if (window.listsManager) {
        window.listsManager.initStoreChoices();
        window.listsManager.initProductGroupChoices();
    }

    // Set selected values for store and product group (after reinitialization)
    if (window.listsManager.choicesInstances.store) {
        window.listsManager.choicesInstances.store.setChoiceByValue(item.store_id.toString());
    }
    if (window.listsManager.choicesInstances.productGroup) {
        window.listsManager.choicesInstances.productGroup.setChoiceByValue(item.product_group_id.toString());
    }

    // Ensure autocomplete is set up (mobile fix)
    window.listsManager?._setupProductAutocomplete();

    if (modal) (modal as any).showModal();
}

/**
 * Close item modal
 */
function closeItemModal() {
    const modal = document.getElementById('item-modal') as HTMLDialogElement | null;
    if (modal) (modal as any).close();
}

/**
 * Handle delete from modal
 * Called when user clicks Delete button in edit modal
 */
async function handleDeleteFromModal() {
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
    await window.listsManager.deleteItem(itemId);

    console.log('[DELETE_MODAL] Delete completed', { itemId });
}

/**
 * Handle save item form submission (with offline support)
 */
/**
 * Handle save item form submission (with automatic aggregation)
 */
async function handleSaveItem(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    const itemId = formData.get('item_id');
    const isEdit = itemId !== '';

    const data: any = {
        store_id: parseInt(String(formData.get('store_id'))),
        product_group_id: parseInt(String(formData.get('product_group_id'))),
        product_name: formData.get('product_name'),
        quantity: formData.get('quantity') ? parseFloat(String(formData.get('quantity'))) : null,
        unit: formData.get('unit') || null,
        comment: formData.get('comment') || null
    };

    try {
        const manager = window.listsManager;

        // Check if we should aggregate (duplicate exists and NOT editing)
        const shouldAggregate = !isEdit && manager.currentDuplicateItem;

        console.log('[ITEM_SAVE] Starting save', {
            isEdit,
            shouldAggregate,
            duplicateItemId: manager.currentDuplicateItem?.id,
            newQuantity: data.quantity
        });

        let result;

        if (shouldAggregate) {
            // AGGREGATE: Update existing item instead of creating new
            const existingItem = manager.currentDuplicateItem;

            // Calculate aggregated quantity
            const oldQuantity = parseFloat(existingItem.quantity) || 0;
            const newQuantity = parseFloat(data.quantity) || 0;
            const aggregatedQuantity = oldQuantity + newQuantity;

            // Merge comments (old; new)
            let comment = existingItem.comment || '';
            if (data.comment) {
                comment = comment ? `${comment}; ${data.comment}` : data.comment;
            }

            const updateData = {
                quantity: aggregatedQuantity,
                comment: comment
            };

            console.log('[ITEM_SAVE] Aggregation calculated', {
                oldQuantity,
                newQuantity,
                aggregatedQuantity,
                unit: existingItem.unit,
                oldComment: existingItem.comment,
                newComment: data.comment,
                mergedComment: comment
            });

            // Call API to UPDATE existing item
            if (manager.offlineShopping) {
                result = await manager.offlineShopping.updateItem(existingItem.id, updateData);
            } else {
                const response = await fetch(`/api/v1/shopping-list-items/${existingItem.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify(updateData)
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                result = await response.json();
            }

            console.log('[ITEM_SAVE] Item aggregated successfully', {
                itemId: existingItem.id,
                newQuantity: aggregatedQuantity
            });

            showToast(`Товар объединен (итого: ${aggregatedQuantity} ${existingItem.unit || ''})`, 'success');

            // Optimistic update
            const item = manager.currentItems.find((i: any) => i.id === existingItem.id);
            if (item) {
                item.quantity = aggregatedQuantity;
                item.comment = comment;
                manager.renderCurrentView();
                manager.updateFABButtons();
                await manager.updateItemsCache();
            }

        } else if (isEdit) {
            // EDIT existing item (normal flow)
            if (manager.offlineShopping) {
                result = await manager.offlineShopping.updateItem(parseInt(String(itemId)), data);
            } else {
                const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify(data)
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                result = await response.json();
            }

            console.log('[ITEM_SAVE] Item updated', { itemId });
            showToast('Товар обновлен', 'success');

            // Optimistic update
            const item = manager.currentItems.find((i: any) => i.id === parseInt(String(itemId)));
            if (item) {
                Object.assign(item, data);
                manager.renderCurrentView();
                manager.updateFABButtons();
                await manager.updateItemsCache();
            }

        } else {
            // CREATE new item (normal flow - no duplicate found)
            if (manager.offlineShopping) {
                data.shopping_list_id = manager.currentListId;
                result = await manager.offlineShopping.createItem(data);
            } else {
                data.shopping_list_id = manager.currentListId;
                const response = await fetch('/api/v1/shopping-list-items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify(data)
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                result = await response.json();
            }

            console.log('[ITEM_SAVE] Item created', { tempId: result.tempId, id: result.id });
            showToast('Товар добавлен', 'success');

            // For offline creates: add tempId item immediately
            if (result.tempId && !result.id) {
                const newItem = {
                    id: result.tempId,
                    ...data,
                    is_completed: false,
                    _offline: true
                };
                const store = manager.stores?.find((s: any) => s.id === data.store_id);
                const group = manager.productGroups?.find((g: any) => g.id === data.product_group_id);
                if (store) newItem.store_name = store.name;
                if (group) newItem.product_group_name = group.name;

                manager.currentItems.push(newItem);
                manager.renderCurrentView();
                manager.updateFABButtons();
                await manager.updateItemsCache();
            }
            // For online creates: WebSocket will add the item
        }

        closeItemModal();

    } catch (error) {
        console.error('[ITEM_SAVE] Error saving item:', error);
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

/**
 * Toggle search field visibility
 */
function toggleSearchField() {
    window.listsManager?.toggleSearchField();
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
    const addItemFAB = document.getElementById('add-item-fab');
    if (!menu || !backdrop) return;

    const isOpen = menu.classList.contains('open');

    if (isOpen) {
        // Close FAB
        menu.classList.remove('open');
        menu.classList.add('closed');
        backdrop.classList.add('opacity-0', 'pointer-events-none', 'hidden');

        // Show add-item-fab when Speed Dial closes (restore it)
        if (addItemFAB) {
            addItemFAB.classList.remove('hidden');
            console.log('[FAB] add-item-fab shown (Speed Dial closed)');
        }
    } else {
        // Open FAB
        menu.classList.remove('closed');
        menu.classList.add('open');
        backdrop.classList.remove('opacity-0', 'pointer-events-none', 'hidden');

        // Hide add-item-fab when Speed Dial opens (prevent overlap)
        if (addItemFAB) {
            addItemFAB.classList.add('hidden');
            console.log('[FAB] add-item-fab hidden (Speed Dial opened)');
        }
    }
}

/**
 * Mark all items as completed - with confirmation dialog
 */
async function markAllCompletedWithConfirm() {
    toggleListsFAB(); // Close FAB first

    const manager = window.listsManager;
    if (!manager) return;

    const uncompletedCount = manager.currentItems.filter((item: any) => !item.is_completed).length;

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

    const completedCount = manager.currentItems.filter((item: any) => item.is_completed).length;

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

    const completedItems = manager.currentItems.filter((item: any) => item.is_completed);

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
function switchView(viewName: string) {
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

/**
 * Smart toggle for expand/collapse all nodes in hierarchy view
 * Determines action based on button's data-action attribute
 */
function toggleAllNodes() {
    const btn = document.getElementById('hierarchy-toggle-btn');
    if (!btn) return;

    const action = btn.dataset.action || 'expand';

    debugLog('[HIERARCHY] Toggle clicked:', action);

    if (action === 'expand') {
        expandAllNodes();
    } else {
        collapseAllNodes();
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
function openDeleteListModal(listId: number, listName: string) {
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
function closeDeleteListModal() {
    const modal = document.getElementById('delete-list-modal') as HTMLDialogElement | null;
    if (modal) modal.close();
    window.deleteListId = undefined;

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
        showToast(`❌ Ошибка удаления: ${(error as Error).message}`, 'error');
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
 * Close import wizard (helper function for list switching)
 * CRITICAL: Prevents data isolation breach when switching lists during import
 */
function closeImportWizard() {
    const container = document.getElementById('import-wizard-container');
    const icon = document.getElementById('import-toggle-icon');
    const hint = document.getElementById('import-toggle-hint');
    const wizardContainer = document.getElementById('import-wizard');

    if (!container) return;

    const isOpen = !container.classList.contains('hidden');

    if (isOpen) {
        container.classList.add('hidden');
        if (icon) icon.textContent = '▶';
        if (hint) hint.classList.remove('hidden');

        if (wizardContainer) {
            wizardContainer.innerHTML = '';
        }
        if (window.importManager) {
            window.importManager.container = null;
            window.importManager.currentMethod = null;
        }
        debugLog('[ImportWizard] Closed and reset (auto-close on list switch)');
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
    const isOpen = container && !container.classList.contains('hidden');

    if (isOpen) {
        // Closing - use closeImportWizard helper
        closeImportWizard();
    } else {
        // Opening - show wizard and initialize
        if (container) container.classList.remove('hidden');
        if (icon) icon.textContent = '▼';
        if (hint) hint.classList.add('hidden');
        initializeImportWizard();
    }
}

/**
 * Handle search input
 */
function handleItemsSearch(query: string) {
    window.listsManager.setSearchQuery(query);
}

/**
 * Clear search
 */
function clearItemsSearch() {
    window.listsManager.clearSearch();
}

// Export modal functions to window for onclick handlers in HTML
window.showLandingView = showLandingView;
window.openAddItemModal = openAddItemModal;
window.openCreateListModal = openCreateListModal;
window.closeItemModal = closeItemModal;
window.closeCreateListModal = closeCreateListModal;
window.handleCreateList = handleCreateList;
window.openEditItemModal = openEditItemModal;
window.handleDeleteFromModal = handleDeleteFromModal;
window.handleSaveItem = handleSaveItem;

// Export FAB functions to window for onclick handlers
window.toggleSelectAll = toggleSelectAll;
window.toggleSearchField = toggleSearchField;
window.toggleListsFAB = toggleListsFAB;
window.markAllCompletedWithConfirm = markAllCompletedWithConfirm;
window.unmarkAllCompletedWithConfirm = unmarkAllCompletedWithConfirm;
window.deleteCompletedWithConfirm = deleteCompletedWithConfirm;
window.switchView = switchView;
window.toggleAllNodes = toggleAllNodes;

// Export delete list functions to window
window.openDeleteListModal = openDeleteListModal;
window.closeDeleteListModal = closeDeleteListModal;
window.confirmDeleteList = confirmDeleteList;

// Export import wizard functions to window
window.toggleImportWizard = toggleImportWizard;
window.handleItemsSearch = handleItemsSearch;
window.clearItemsSearch = clearItemsSearch;

debugLog('[ListsManager] Module loaded');

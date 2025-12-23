/**
 * ChoicesCategoryTree - Choices.js-based category selector with hierarchy support.
 *
 * Features:
 * - Fuzzy search via built-in Fuse.js
 * - Frequency-based sorting (most used first)
 * - Only leaf categories shown in dropdown
 * - Full path display below field after selection
 * - Hierarchical breadcrumb navigation
 * - Dual authentication support: Bearer token (WebApp) or cookies (web interface)
 * - Account filtering (whitelist pattern)
 *
 * Usage (Telegram WebApp with Bearer token):
 *   const categoryTree = new ChoicesCategoryTree('#article_id', {
 *     type: 'expense',  // or 'income'
 *     auth: window.auth,  // Auth instance with getToken() method
 *     onCategoryChange: (category) => console.log(category)
 *   });
 *
 * Usage (Web interface with cookie auth):
 *   const categoryTree = new ChoicesCategoryTree('#article_id', {
 *     type: 'expense',  // or 'income'
 *     onCategoryChange: (category) => console.log(category)
 *   });
 *
 * Usage (with account filtering):
 *   const categoryTree = new ChoicesCategoryTree('#article_id', {
 *     type: 'expense',
 *     financialCenterId: 5,  // Show only categories available for account 5
 *     onCategoryChange: (category) => console.log(category)
 *   });
 *   // Update account filter dynamically
 *   await categoryTree.updateFinancialCenter(10);  // Reload with new account
 *
 * API Requirements:
 * - GET /api/v1/articles?type={type}&sort_by=usage_count&financial_center_id={fc_id}
 * - GET /api/v1/articles/{id}/ancestors
 *
 * @version 2.1.0 (Added account filtering)
 * @requires Choices.js v11.1.0
 */

class ChoicesCategoryTree {
    // Static cache to avoid duplicate API calls across instances
    // key: "type:showInactive:fcPart" -> { data: [], timestamp: Date }
    // fcPart is financial_center_id or "all" for unfiltered
    static _cache = new Map();
    static _pendingRequests = new Map();  // key: "type:showInactive:fcPart" -> Promise

    /**
     * Preload categories for offline use.
     * Call this on page load to cache both expense and income categories.
     * Categories will be available in offline mode after preloading.
     *
     * @param {Object} options - Preload options
     * @param {string} options.apiBaseUrl - Base URL for API (default: '/api/v1')
     * @param {boolean} options.showInactive - Include archived categories (default: false)
     * @returns {Promise<void>}
     */
    static async preloadCategories(options = {}) {
        const apiBaseUrl = options.apiBaseUrl || '/api/v1';
        const showInactive = options.showInactive || false;

        // Preload all 4 types: expense/income for transactions, debit/credit for transfers
        const types = ['expense', 'income', 'debit', 'credit'];

        // Preload both types in parallel
        const preloadPromises = types.map(async (type) => {
            // IMPORTANT: Use "all" as FC part to match loadCategories() cache key
            // loadCategories uses: `${type}:${showInactive}:${fcPart}` where fcPart defaults to "all"
            const cacheKey = `${type}:${showInactive}:all`;

            // Skip if already cached
            if (ChoicesCategoryTree._cache.has(cacheKey)) {
                debugLog(`[ChoicesCategoryTree] ${type} categories already cached, skipping preload`);
                return;
            }

            // Skip if request already in flight
            if (ChoicesCategoryTree._pendingRequests.has(cacheKey)) {
                debugLog(`[ChoicesCategoryTree] ${type} categories request already in progress, waiting`);
                return ChoicesCategoryTree._pendingRequests.get(cacheKey);
            }

            const url = `${apiBaseUrl}/articles?type=${type}&sort_by=usage_count&limit=1000&include_inactive=${showInactive}`;

            try {
                const response = await fetch(url, {
                    credentials: 'same-origin',
                });

                if (!response.ok) {
                    console.warn(`[ChoicesCategoryTree] Failed to preload ${type} categories: HTTP ${response.status}`);
                    return;
                }

                const data = await response.json();
                const categories = data.articles || [];

                // Cache the result
                ChoicesCategoryTree._cache.set(cacheKey, {
                    data: categories,
                    timestamp: Date.now()
                });

                debugLog(`[ChoicesCategoryTree] Preloaded ${categories.length} ${type} categories`);
            } catch (error) {
                console.warn(`[ChoicesCategoryTree] Network error preloading ${type} categories:`, error.message);
            }
        });

        await Promise.all(preloadPromises);
    }

    /**
     * Initialize category tree selector.
     *
     * @param {string} selector - CSS selector for select element
     * @param {Object} options - Configuration options
     * @param {string} options.type - Category type ('income' or 'expense')
     * @param {Object} [options.auth] - OPTIONAL: Auth instance with getToken() method (for WebApp Bearer token)
     * @param {Function} options.onCategoryChange - Callback when category changes
     * @param {string} options.apiBaseUrl - Base URL for API (default: '/api/v1')
     * @param {boolean} options.showLeafOnly - Show only leaf categories (default: true)
     * @param {boolean} options.showInactive - Include archived categories (default: false)
     * @param {number|null} options.financialCenterId - OPTIONAL: Filter categories by financial center ID
     */
    constructor(selector, options = {}) {
        this.selector = selector;
        this.element = document.querySelector(selector);

        if (!this.element) {
            console.error(`[ChoicesCategoryTree] Element not found: ${selector}`);
            return;
        }

        // Auth parameter is OPTIONAL:
        // - If provided: use Bearer token (Telegram WebApp)
        // - If not provided: use cookie-based auth (web interface)
        this.auth = options.auth || null;  // Store auth instance (nullable)
        this.options = {
            type: options.type || 'expense',
            // Support both callback names for compatibility (onChange for analytics page)
            onCategoryChange: options.onCategoryChange || options.onChange || null,
            apiBaseUrl: options.apiBaseUrl || '/api/v1',
            showLeafOnly: options.showLeafOnly !== false,  // Default true
            showInactive: options.showInactive || false,  // Default false - hide archived categories
            financialCenterId: options.financialCenterId || null,  // Filter by FC (null = all)
            // Multi-select support (for analytics page category filter)
            multiple: options.multiple || false,
            showPath: options.showPath !== false,  // Default true - show breadcrumb path
            showClearButton: options.showClearButton !== false,  // Default true - show clear-all button for multiple mode
        };

        this.choices = null;
        this.categories = [];
        this.categoryMap = new Map();  // id -> category
        this.childrenMap = new Map();  // parent_id -> [child_ids]
        this._initPromise = null;  // Promise resolver for waitForReady()

        this.init();
    }

    /**
     * Initialize component.
     */
    async init() {
        try {
            // Load categories from API
            await this.loadCategories();

            // Build hierarchy maps
            this.buildHierarchyMaps();

            // Filter to leaf categories if needed
            const displayCategories = this.options.showLeafOnly
                ? this.getLeafCategories()
                : this.categories;

            // Initialize Choices.js
            this.initChoices(displayCategories);
        } catch (error) {
            console.error('[ChoicesCategoryTree] Initialization error:', error);
            this.showError('Ошибка загрузки категорий');
        }
    }

    /**
     * Load categories from API.
     * Uses Bearer token (WebApp) or cookie-based auth (web interface).
     */
    async loadCategories() {
        // Generate cache key based on type, showInactive, and financialCenterId
        const fcPart = this.options.financialCenterId || 'all';
        const cacheKey = `${this.options.type}:${this.options.showInactive}:${fcPart}`;

        // Check cache first (30 second TTL)
        const cached = ChoicesCategoryTree._cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < 30000) {
            this.categories = cached.data;
            return;
        }

        // Check if request is already in flight
        const pendingRequest = ChoicesCategoryTree._pendingRequests.get(cacheKey);
        if (pendingRequest) {
            this.categories = await pendingRequest;
            return;
        }

        // Check if we're offline - skip API call and use cache or empty
        if (!navigator.onLine) {
            debugLog('[ChoicesCategoryTree] Offline mode - skipping API call, using cache');
            // Try to find any cached data for this type (without FC filter)
            const fallbackKey = `${this.options.type}:${this.options.showInactive}:all`;
            const fallback = ChoicesCategoryTree._cache.get(fallbackKey);
            if (fallback) {
                this.categories = fallback.data;
                return;
            }
            this.categories = [];
            return;
        }

        // Create new request with optional financial_center_id filter
        let url = `${this.options.apiBaseUrl}/articles?type=${this.options.type}&sort_by=usage_count&limit=1000&include_inactive=${this.options.showInactive}`;
        if (this.options.financialCenterId) {
            url += `&financial_center_id=${this.options.financialCenterId}`;
        }

        // Build headers conditionally
        const headers = {};

        // If auth instance provided, use Bearer token (Telegram WebApp)
        if (this.auth && typeof this.auth.getToken === 'function') {
            const token = this.auth.getToken();
            if (!token) {
                throw new Error('No authentication token available');
            }
            headers['Authorization'] = `Bearer ${token}`;
        }
        // Otherwise, rely on cookie-based auth (web interface)

        // Create and store promise
        const requestPromise = fetch(url, {
            headers: headers,
            credentials: 'same-origin',  // Include cookies
        }).then(async response => {
            if (!response.ok) {
                // Graceful degradation for 401 Unauthorized (user not authenticated)
                if (response.status === 401) {
                    debugLog('[ChoicesCategoryTree] User not authenticated - categories not loaded (this is expected for unauthenticated users)');
                    return [];  // Empty categories array
                }

                // For other errors, throw with detailed status
                throw new Error(`Failed to load categories: HTTP ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const categories = data.articles || [];

            // Cache the result
            ChoicesCategoryTree._cache.set(cacheKey, {
                data: categories,
                timestamp: Date.now()
            });

            return categories;
        }).catch(error => {
            // Handle network errors (offline mode)
            console.warn('[ChoicesCategoryTree] Network error loading categories (offline?):', error.message);

            // Try to use stale cache if available (ignore TTL in offline mode)
            const staleCache = ChoicesCategoryTree._cache.get(cacheKey);
            if (staleCache && staleCache.data && staleCache.data.length > 0) {
                debugLog('[ChoicesCategoryTree] Using stale cache for offline mode');
                return staleCache.data;
            }

            // Fallback 1: If specific FC cache not found, try "all" categories cache
            // This allows offline mode to work even if user changes FC filter
            if (this.options.financialCenterId) {
                const allCacheKey = `${this.options.type}:${this.options.showInactive}:all`;
                const allCache = ChoicesCategoryTree._cache.get(allCacheKey);
                if (allCache && allCache.data && allCache.data.length > 0) {
                    debugLog(`[ChoicesCategoryTree] Offline: No cache for FC ${this.options.financialCenterId}, using all categories`);
                    // Note: This returns all categories, not filtered by FC
                    // User can still select categories, filtering will apply when back online
                    return allCache.data;
                }
            }

            // No cache available - return empty array to avoid breaking UI
            console.warn('[ChoicesCategoryTree] No cached categories available for offline mode');
            return [];
        }).finally(() => {
            // Remove from pending requests
            ChoicesCategoryTree._pendingRequests.delete(cacheKey);
        });

        // Store pending request
        ChoicesCategoryTree._pendingRequests.set(cacheKey, requestPromise);

        this.categories = await requestPromise;
    }

    /**
     * Build hierarchy maps for efficient lookups.
     */
    buildHierarchyMaps() {
        // Build categoryMap (id -> category)
        this.categoryMap.clear();
        this.childrenMap.clear();

        for (const category of this.categories) {
            this.categoryMap.set(category.id, category);

            // Build childrenMap
            if (category.parent_id) {
                if (!this.childrenMap.has(category.parent_id)) {
                    this.childrenMap.set(category.parent_id, []);
                }
                this.childrenMap.get(category.parent_id).push(category.id);
            }
        }

        // Resolve initialization promise (for waitForReady() method)
        if (this._initPromise) {
            this._initPromise();
            this._initPromise = null;
        }
    }

    /**
     * Wait for the category tree to be fully initialized.
     * This method allows callers to wait for initialization to complete
     * without polling with setInterval. It returns a Promise that resolves
     * when categoryMap is populated and Choices.js is ready.
     *
     * Usage:
     *   const tree = new ChoicesCategoryTree('#selector', options);
     *   await tree.waitForReady();
     *   await tree.setSelectedCategory(categoryId);
     *
     * @returns {Promise<void>} Resolves when initialization is complete
     */
    async waitForReady() {
        // If already initialized, return immediately
        if (this.categoryMap && this.categoryMap.size > 0 &&
            this.choices && this.choices._store?.choices.length > 0) {
            return Promise.resolve();
        }

        // Otherwise, create and return a Promise that will be resolved
        // when buildHierarchyMaps() completes
        return new Promise((resolve) => {
            this._initPromise = resolve;
        });
    }

    /**
     * Get leaf categories (categories without children).
     * Uses API-provided is_leaf flag if available, otherwise calculates locally.
     *
     * IMPORTANT: When filtering by financial_center_id, the API returns only
     * categories available for that FC. The childrenMap built from filtered
     * list may incorrectly mark parent categories as leaves (because their
     * children were filtered out). The API-provided is_leaf flag is calculated
     * from the FULL database, so it's always correct.
     */
    getLeafCategories() {
        return this.categories.filter(cat => {
            // Prefer API-provided is_leaf (calculated from full DB)
            if (typeof cat.is_leaf === 'boolean') {
                return cat.is_leaf;
            }
            // Fallback to local childrenMap calculation (for backwards compatibility)
            return !this.childrenMap.has(cat.id);
        });
    }

    /**
     * Get parent chain for a category (from root to parent, excluding self).
     * Builds chain locally using categoryMap (no API calls).
     *
     * @param {number} categoryId - Category ID
     * @returns {Array} Array of parent categories (root to parent)
     */
    getParentChain(categoryId) {
        const chain = [];
        const category = this.categoryMap.get(categoryId);

        if (!category || !category.parent_id) {
            return chain;  // No parents
        }

        let currentParentId = category.parent_id;

        while (currentParentId) {
            const parent = this.categoryMap.get(currentParentId);
            if (!parent) break;

            chain.unshift(parent);  // Add to beginning (root first)
            currentParentId = parent.parent_id;
        }

        return chain;
    }

    /**
     * Initialize Choices.js with categories.
     *
     * @param {Array} categories - Categories to display
     */
    initChoices(categories) {
        // Clear placeholder option from select element before Choices.js initialization
        // This prevents placeholder from appearing in dropdown list
        this.element.innerHTML = '';

        // Prepare choices data with parent chain
        const choices = categories.map(cat => {
            const parentChain = this.getParentChain(cat.id);
            const parentText = parentChain.length > 0
                ? parentChain.map(p => p.name).join(' › ')
                : '';

            return {
                value: cat.id,
                label: cat.name,
                customProperties: {
                    usage_count: cat.usage_count || 0,
                    parent_id: cat.parent_id,
                    parent_text: parentText,  // Store formatted parent chain
                }
            };
        });

        // Initialize Choices.js with custom templates
        this.choices = new Choices(this.element, {
            searchEnabled: true,
            searchPlaceholderValue: 'Поиск категории...',
            placeholder: true,
            // Different placeholder for single/multiple modes
            placeholderValue: this.options.multiple
                ? ''  // Пустой placeholder для multi-select
                : '— Выберите категорию —',
            noResultsText: 'Не найдено',
            noChoicesText: 'Нет доступных категорий',
            itemSelectText: '',
            shouldSort: false,  // Keep our API sorting (by usage_count)

            // Enable/disable individual remove buttons based on showClearButton option
            // If showClearButton=true: use clear-all button, disable individual remove
            // If showClearButton=false: enable individual remove buttons
            removeItemButton: this.options.multiple && !this.options.showClearButton,

            // Fuzzy search configuration (built-in Fuse.js)
            fuseOptions: {
                threshold: 0.3,        // Match threshold (0.0 = perfect, 1.0 = anything)
                distance: 100,         // Character distance for matches
                ignoreLocation: true,  // Don't care where in string match occurs
                keys: ['label'],       // Search in label field
            },

            // Custom templates for dropdown items (show parent chain)
            callbackOnCreateTemplates: (template) => {
                return this.options.multiple
                    ? this._createMultipleTemplates(template)
                    : this._createSingleTemplates(template);
            },

            // Styling
            classNames: {
                containerOuter: ['choices', 'choices-tailwind', this.options.multiple ? 'is-multiple' : ''].filter(Boolean),
                containerInner: ['choices__inner'],
                input: ['choices__input'],
                inputCloned: ['choices__input--cloned'],
                list: ['choices__list'],
                listItems: ['choices__list--multiple'],
                listSingle: ['choices__list--single'],
                listDropdown: ['choices__list--dropdown'],
                item: ['choices__item'],
                itemSelectable: ['choices__item--selectable'],
                itemDisabled: ['choices__item--disabled'],
                itemChoice: ['choices__item--choice'],
                placeholder: ['choices__placeholder'],
                group: ['choices__group'],
                groupHeading: ['choices__heading'],
                button: ['choices__button'],
            },
        });

        // Add choices WITHOUT auto-selecting first item
        // 4th parameter FALSE prevents Choices.js from auto-selecting
        this.choices.setChoices(choices, 'value', 'label', false);

        // Listen for change events
        this.element.addEventListener('change', (event) => {
            this.handleCategoryChange(event);
        });

        // Add clear-all button for multiple mode (if enabled)
        if (this.options.multiple && this.options.showClearButton) {
            this._addClearAllButton();
        }
    }

    /**
     * Create templates for single-select mode (existing behavior).
     * @private
     */
    _createSingleTemplates(template) {
        return {
            // Dropdown item template (shown in dropdown list)
            choice: (classNames, data) => {
                const parentText = data.customProperties?.parent_text || '';
                const label = data.label;

                return template(`
                    <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled ? classNames.itemDisabled : classNames.itemSelectable}"
                         data-select-text=""
                         data-choice
                         ${data.disabled ? 'data-choice-disabled aria-disabled="true"' : 'data-choice-selectable'}
                         data-id="${data.id}"
                         data-value="${data.value}"
                         ${data.groupId > 0 ? 'role="treeitem"' : 'role="option"'}
                         style="padding-left: 0.75rem;">
                        <span style="font-weight: 500;">${label}</span>
                        ${parentText ? `<span style="font-size: 0.85em; color: #999; margin-left: 0.5em;">(${parentText})</span>` : ''}
                    </div>
                `);
            },

            // Selected item template (shown after selection)
            item: (classNames, data) => {
                // For selected item, show only label (no parent chain)
                return template(`
                    <div class="${classNames.item} ${data.highlighted ? classNames.highlightedState : classNames.itemSelectable}"
                         data-item
                         data-id="${data.id}"
                         data-value="${data.value}"
                         ${data.active ? 'aria-selected="true"' : ''}
                         ${data.disabled ? 'aria-disabled="true"' : ''}>
                        ${data.label}
                    </div>
                `);
            },
        };
    }

    /**
     * Create templates for multi-select mode.
     * When showClearButton=false: badges with individual remove buttons
     * When showClearButton=true: comma-separated text (use clear-all button)
     * @private
     */
    _createMultipleTemplates(template) {
        const showRemoveButtons = !this.options.showClearButton;

        return {
            // Dropdown item template (same as single - shows parent chain)
            choice: (classNames, data) => {
                const parentText = data.customProperties?.parent_text || '';
                const label = data.label;

                return template(`
                    <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled ? classNames.itemDisabled : classNames.itemSelectable}"
                         data-select-text=""
                         data-choice
                         ${data.disabled ? 'data-choice-disabled aria-disabled="true"' : 'data-choice-selectable'}
                         data-id="${data.id}"
                         data-value="${data.value}"
                         role="option"
                         style="padding-left: 0.75rem;">
                        <span style="font-weight: 500;">${label}</span>
                        ${parentText ? `<span style="font-size: 0.85em; color: #999; margin-left: 0.5em;">(${parentText})</span>` : ''}
                    </div>
                `);
            },

            // Selected item template
            item: (classNames, data) => {
                if (showRemoveButtons) {
                    // Badge style with individual remove button
                    return template(`
                        <div class="${classNames.item} choices__item--badge"
                             data-item
                             data-id="${data.id}"
                             data-value="${data.value}"
                             ${data.active ? 'aria-selected="true"' : ''}
                             ${data.disabled ? 'aria-disabled="true"' : ''}>
                            <span class="choices__item--badge-text">${data.label}</span>
                            <button type="button"
                                    class="${classNames.button}"
                                    data-button=""
                                    aria-label="Удалить ${data.label}">
                                ×
                            </button>
                        </div>
                    `);
                } else {
                    // Comma-separated text (use clear-all button)
                    return template(`
                        <span class="${classNames.item} choices__item--comma"
                              data-item
                              data-id="${data.id}"
                              data-value="${data.value}"
                              ${data.active ? 'aria-selected="true"' : ''}
                              ${data.disabled ? 'aria-disabled="true"' : ''}>
                            ${data.label}
                        </span>
                    `);
                }
            },
        };
    }

    /**
     * Add "Clear All" button under the form (for multiple mode).
     * @private
     */
    _addClearAllButton() {
        const choicesContainer = this.element.closest('.choices');
        if (!choicesContainer) return;

        // Create wrapper for clear button (positioned under form)
        const wrapper = document.createElement('div');
        wrapper.className = 'choices__clear-wrapper';

        // Create clear-all button (только иконка X)
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'choices__clear-all';
        clearBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        `;
        clearBtn.title = 'Очистить все';
        clearBtn.style.display = 'none';  // Hidden by default

        wrapper.appendChild(clearBtn);

        // Insert AFTER choices container (под формой)
        choicesContainer.parentElement.insertBefore(wrapper, choicesContainer.nextSibling);

        // Handle click
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.clearSelection();
        });

        // Store reference
        this._clearAllBtn = clearBtn;
    }

    /**
     * Update clear-all button visibility based on selection.
     * @private
     */
    _updateClearAllVisibility() {
        if (!this._clearAllBtn) return;

        const hasItems = this.choices?.getValue()?.length > 0;
        this._clearAllBtn.style.display = hasItems ? 'flex' : 'none';
    }

    /**
     * Handle category change event.
     * Supports both single and multiple selection modes.
     *
     * @param {Event} event - Change event
     */
    async handleCategoryChange(event) {
        if (!this.options.onCategoryChange) return;

        if (this.options.multiple) {
            // Multi-select mode: get all selected items using Choices.js API
            const selectedItems = this.choices?.getValue() || [];
            const selectedCategories = selectedItems.map(item => {
                const categoryId = parseInt(item.value);
                return this.categoryMap.get(categoryId);
            }).filter(Boolean);  // Remove nulls

            this.options.onCategoryChange(selectedCategories);
            this._updateClearAllVisibility();
        } else {
            // Single-select mode (existing behavior)
            const categoryId = parseInt(event.target.value);
            if (!categoryId) return;

            const category = this.categoryMap.get(categoryId);
            this.options.onCategoryChange(category);
        }
    }

    /**
     * Show error message.
     *
     * @param {string} message - Error message
     */
    showError(message) {
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.showAlert(message);
        } else {
            alert(message);
        }
    }

    /**
     * Destroy component and cleanup.
     */
    destroy() {
        if (this.choices) {
            this.choices.destroy();
            this.choices = null;
        }

        // Complete DOM cleanup to prevent reinitialization errors
        if (this.element) {
            this.element.value = '';
            this.element.classList.remove('choices__input', 'choices__input--cloned');
            this.element.removeAttribute('data-choice');
        }

        this.categories = [];
        this.categoryMap.clear();
        this.childrenMap.clear();
    }

    /**
     * Update category type without full reinitialization.
     * More efficient than destroy() + new instance.
     *
     * @param {string} newType - New category type ('income' or 'expense')
     */
    async updateType(newType) {
        // Update type in options
        this.options.type = newType;

        // Clear selection for multiple mode (must use Choices.js API)
        if (this.options.multiple && this.choices) {
            this.choices.removeActiveItems();
            this._updateClearAllVisibility();
        }

        // Reset selection (single mode fallback)
        if (this.element) {
            this.element.value = '';
        }

        try {
            // Load new categories from API (with offline fallback)
            await this.loadCategories();

            // Build hierarchy maps
            this.buildHierarchyMaps();

            // Filter to leaf categories if needed
            const displayCategories = this.options.showLeafOnly
                ? this.getLeafCategories()
                : this.categories;

            // Update Choices.js without full recreation
            if (this.choices) {
                // Clear existing choices
                this.choices.clearStore();

                // Prepare new choices data with parent chain
                const choices = displayCategories.map(cat => {
                    const parentChain = this.getParentChain(cat.id);
                    const parentText = parentChain.length > 0
                        ? parentChain.map(p => p.name).join(' › ')
                        : '';

                    return {
                        value: cat.id,
                        label: cat.name,
                        customProperties: {
                            usage_count: cat.usage_count || 0,
                            parent_id: cat.parent_id,
                            parent_text: parentText,
                        }
                    };
                });

                // Set new choices WITHOUT auto-selecting first item
                // 4th parameter FALSE prevents Choices.js from auto-selecting
                this.choices.setChoices(choices, 'value', 'label', false);

                // Clear any existing selection (shouldn't be any, but to be safe)
                this.choices.removeActiveItems();
                if (this.element) {
                    this.element.value = '';
                }

                // Log warning if no categories available (likely offline without cache)
                if (choices.length === 0) {
                    console.warn(`[ChoicesCategoryTree] No ${newType} categories available - user may be offline without cached data`);
                }
            }
        } catch (error) {
            console.error('[ChoicesCategoryTree] Error updating type:', error);
            // Don't show alert - just log the error
            // The dropdown will remain with old choices or empty
        }
    }

    /**
     * Refresh categories (reload from API).
     */
    async refresh() {

        // Destroy old instance
        if (this.choices) {
            this.choices.destroy();
            this.choices = null;
        }

        // Reinitialize
        await this.init();
    }

    /**
     * Update financial center ID for category filtering.
     * Invalidates specific FC cache and reloads categories.
     * In offline mode, falls back to "all" categories cache.
     *
     * @param {number|null} financialCenterId - Financial center ID (null = show all)
     */
    async updateFinancialCenter(financialCenterId) {
        // Update option
        this.options.financialCenterId = financialCenterId;

        // Only invalidate the specific FC cache, NOT the "all" cache
        // This preserves the "all" cache for offline fallback
        if (financialCenterId) {
            const specificCacheKey = `${this.options.type}:${this.options.showInactive}:${financialCenterId}`;
            ChoicesCategoryTree._cache.delete(specificCacheKey);
        }

        // Save current selection to restore it if still available
        // CRITICAL: Only save selection if it's a real user selection, not a phantom value
        // Check if there are actually active items in Choices.js (user made explicit selection)
        const hasActiveSelection = this.choices && this.choices.getValue(true).length > 0;
        const previousSelection = hasActiveSelection && this.element ? this.element.value : null;
        const previousSelectionId = previousSelection ? parseInt(previousSelection) : null;

        try {
            // Load new categories from API (with offline fallback)
            await this.loadCategories();

            // Build hierarchy maps
            this.buildHierarchyMaps();

            // Filter to leaf categories if needed
            const displayCategories = this.options.showLeafOnly
                ? this.getLeafCategories()
                : this.categories;

            // Update Choices.js without full recreation
            if (this.choices) {
                // Clear existing choices
                this.choices.clearStore();

                // Prepare new choices data with parent chain
                const choices = displayCategories.map(cat => {
                    const parentChain = this.getParentChain(cat.id);
                    const parentText = parentChain.length > 0
                        ? parentChain.map(p => p.name).join(' › ')
                        : '';

                    return {
                        value: cat.id,
                        label: cat.name,
                        customProperties: {
                            usage_count: cat.usage_count || 0,
                            parent_id: cat.parent_id,
                            parent_text: parentText,
                        }
                    };
                });

                // Set new choices WITHOUT auto-selecting first item
                // 4th parameter FALSE prevents Choices.js from auto-selecting
                this.choices.setChoices(choices, 'value', 'label', false);

                // Check if we need to restore previous selection
                const categoryStillAvailable = previousSelectionId &&
                    this.categoryMap.has(previousSelectionId);

                if (categoryStillAvailable) {
                    // Category is available in new filtered list - restore selection
                    // setSelectedCategory will handle clearing and setting the value
                    await this.setSelectedCategory(previousSelectionId);
                    debugLog(`[ChoicesCategoryTree] Preserved selection: ${previousSelectionId}`);
                } else {
                    // No previous selection OR category not available anymore
                    // Clear any auto-selection that Choices.js made
                    this.choices.removeActiveItems();
                    if (this.element) {
                        this.element.value = '';
                    }
                    if (previousSelectionId) {
                        debugLog(`[ChoicesCategoryTree] Reset selection (category ${previousSelectionId} not available for FC ${financialCenterId})`);
                    } else {
                        debugLog(`[ChoicesCategoryTree] No previous selection - keeping empty`);
                    }
                }

                // Log info about filtering
                if (financialCenterId) {
                    debugLog(`[ChoicesCategoryTree] Filtered to FC ${financialCenterId}: ${choices.length} categories`);
                } else {
                    debugLog(`[ChoicesCategoryTree] Showing all categories: ${choices.length}`);
                }

                // Warn if using fallback data (all categories) due to offline
                if (choices.length === 0 && !navigator.onLine) {
                    console.warn(`[ChoicesCategoryTree] Offline: No categories available for FC ${financialCenterId}`);
                }
            }
        } catch (error) {
            console.error('[ChoicesCategoryTree] Error updating financial center:', error);
        }
    }

    /**
     * Get selected category.
     *
     * @returns {Object|null} Selected category or null
     */
    getSelectedCategory() {
        const categoryId = parseInt(this.element.value);
        return categoryId ? this.categoryMap.get(categoryId) : null;
    }

    /**
     * Get all selected categories (for multiple mode).
     *
     * @returns {Array} Array of selected category objects
     */
    getSelectedCategories() {
        if (!this.choices || !this.options.multiple) {
            // Single mode - return array with one item or empty
            const cat = this.getSelectedCategory();
            return cat ? [cat] : [];
        }

        const selectedItems = this.choices.getValue() || [];
        return selectedItems.map(item => {
            const categoryId = parseInt(item.value);
            return this.categoryMap.get(categoryId);
        }).filter(Boolean);
    }

    /**
     * Clear all selected categories (for multiple mode).
     * Triggers onCategoryChange callback with empty array.
     */
    clearSelection() {
        if (!this.choices) return;

        // Remove all selected items using Choices.js API
        this.choices.removeActiveItems();

        // Update clear-all button visibility
        this._updateClearAllVisibility();

        // Trigger callback with empty array
        if (this.options.onCategoryChange) {
            this.options.onCategoryChange([]);
        }
    }

    /**
     * Set selected category with retry logic for async category loading.
     *
     * @param {number} categoryId - Category ID to select
     * @param {number} maxRetries - Maximum retry attempts (default: 3)
     * @param {number} retryDelay - Delay between retries in ms (default: 100)
     */
    async setSelectedCategory(categoryId, maxRetries = 3, retryDelay = 100) {
        if (!this.choices) {
            console.error('[ChoicesCategoryTree] setSelectedCategory failed - no choices instance');
            return;
        }

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            // Get all available choices from _store (not _currentState)
            const availableChoices = this.choices._store?.choices || [];

            // Find the choice we're trying to set
            const targetChoice = availableChoices.find(c => c.value == categoryId || c.value === categoryId.toString());

            if (targetChoice) {
                // CRITICAL: Use the same type as stored in choices
                // If value is a number, pass number; if string, pass string
                const valueToSet = targetChoice.value;

                this.choices.setChoiceByValue(valueToSet);
                return; // Success - exit
            }

            // Category not found yet - wait and retry (unless last attempt)
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }

        // All retries failed
        // This is not necessarily an error - category may be:
        // 1. Deleted from database
        // 2. Wrong type (expense/income mismatch)
        // 3. Not a leaf node (if showLeafOnly is enabled)
        // 4. Filtered out by financial center
        console.debug('[ChoicesCategoryTree] Category not found in available choices:', categoryId,
                      '(may be deleted, wrong type, or filtered out)');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChoicesCategoryTree;
}

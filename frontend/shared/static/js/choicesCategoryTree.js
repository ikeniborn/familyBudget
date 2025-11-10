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
 * API Requirements:
 * - GET /api/v1/articles?type={type}&sort_by=usage_count
 * - GET /api/v1/articles/{id}/ancestors
 *
 * @version 2.0.0 (Shared: WebApp + Web)
 * @requires Choices.js v11.1.0
 */

class ChoicesCategoryTree {
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
            onCategoryChange: options.onCategoryChange || null,
            apiBaseUrl: options.apiBaseUrl || '/api/v1',
            showLeafOnly: options.showLeafOnly !== false,  // Default true
            showInactive: options.showInactive || false,  // Default false - hide archived categories
        };

        this.choices = null;
        this.categories = [];
        this.categoryMap = new Map();  // id -> category
        this.childrenMap = new Map();  // parent_id -> [child_ids]

        this.init();
    }

    /**
     * Initialize component.
     */
    async init() {
        try {
            console.log('[ChoicesCategoryTree] Initializing...');

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

            // Setup path display
            this.setupPathDisplay();

            // Restore selected value if exists
            const selectedId = this.element.value;
            if (selectedId) {
                await this.updatePathDisplay(parseInt(selectedId));
            }

            console.log('[ChoicesCategoryTree] Initialized successfully');
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
        const url = `${this.options.apiBaseUrl}/articles?type=${this.options.type}&sort_by=usage_count&limit=1000&include_inactive=${this.options.showInactive}`;

        console.log(`[ChoicesCategoryTree] Loading categories from: ${url}`);

        // Build headers conditionally
        const headers = {};

        // If auth instance provided, use Bearer token (Telegram WebApp)
        if (this.auth && typeof this.auth.getToken === 'function') {
            const token = this.auth.getToken();
            if (!token) {
                throw new Error('No authentication token available');
            }
            headers['Authorization'] = `Bearer ${token}`;
            console.log('[ChoicesCategoryTree] Using Bearer token authentication');
        } else {
            // Otherwise, rely on cookie-based auth (web interface)
            console.log('[ChoicesCategoryTree] Using cookie-based authentication');
        }

        const response = await fetch(url, {
            headers: headers,
            credentials: 'same-origin',  // Include cookies
        });

        if (!response.ok) {
            // Graceful degradation for 401 Unauthorized (user not authenticated)
            if (response.status === 401) {
                console.log('[ChoicesCategoryTree] User not authenticated - categories not loaded (this is expected for unauthenticated users)');
                this.categories = [];  // Empty categories array
                return;  // Silent fail - don't throw error
            }

            // For other errors, throw with detailed status
            throw new Error(`Failed to load categories: HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        this.categories = data.articles || [];

        console.log(`[ChoicesCategoryTree] Loaded ${this.categories.length} categories`);
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

        console.log(`[ChoicesCategoryTree] Built hierarchy maps: ${this.categoryMap.size} categories, ${this.childrenMap.size} parents`);
    }

    /**
     * Get leaf categories (categories without children).
     */
    getLeafCategories() {
        return this.categories.filter(cat => !this.childrenMap.has(cat.id));
    }

    /**
     * Initialize Choices.js with categories.
     *
     * @param {Array} categories - Categories to display
     */
    initChoices(categories) {
        // Prepare choices data
        const choices = categories.map(cat => ({
            value: cat.id,
            label: cat.name,
            customProperties: {
                usage_count: cat.usage_count || 0,
                parent_id: cat.parent_id,
            }
        }));

        // Initialize Choices.js
        this.choices = new Choices(this.element, {
            searchEnabled: true,
            searchPlaceholderValue: 'Поиск категории...',
            noResultsText: 'Не найдено',
            noChoicesText: 'Нет доступных категорий',
            itemSelectText: '',
            shouldSort: false,  // Keep our API sorting (by usage_count)

            // Fuzzy search configuration (built-in Fuse.js)
            fuseOptions: {
                threshold: 0.3,        // Match threshold (0.0 = perfect, 1.0 = anything)
                distance: 100,         // Character distance for matches
                ignoreLocation: true,  // Don't care where in string match occurs
                keys: ['label'],       // Search in label field
            },

            // Styling
            classNames: {
                containerOuter: ['choices', 'choices-telegram'],
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

        // Add choices
        this.choices.setChoices(choices, 'value', 'label', true);

        // Listen for change events
        this.element.addEventListener('change', (event) => {
            this.handleCategoryChange(event);
        });

        console.log(`[ChoicesCategoryTree] Initialized Choices.js with ${choices.length} items`);
    }

    /**
     * Setup path display element.
     */
    setupPathDisplay() {
        // Find or create path display element
        let pathDisplay = document.querySelector(`#${this.element.id}-path`);

        if (!pathDisplay) {
            // Create path display element
            pathDisplay = document.createElement('div');
            pathDisplay.id = `${this.element.id}-path`;
            pathDisplay.className = 'category-path';
            pathDisplay.style.cssText = 'margin-top: 8px; font-size: 12px; color: var(--tg-theme-hint-color, #999);';

            // Insert after Choices container
            const choicesContainer = this.element.closest('.choices');
            if (choicesContainer && choicesContainer.parentNode) {
                choicesContainer.parentNode.insertBefore(pathDisplay, choicesContainer.nextSibling);
            }
        }

        this.pathDisplay = pathDisplay;
    }

    /**
     * Handle category change event.
     *
     * @param {Event} event - Change event
     */
    async handleCategoryChange(event) {
        const categoryId = parseInt(event.target.value);

        if (!categoryId) {
            this.pathDisplay.textContent = '';
            return;
        }

        console.log(`[ChoicesCategoryTree] Category changed: ${categoryId}`);

        // Update path display
        await this.updatePathDisplay(categoryId);

        // Call user callback
        if (this.options.onCategoryChange) {
            const category = this.categoryMap.get(categoryId);
            this.options.onCategoryChange(category);
        }
    }

    /**
     * Update path display for selected category.
     *
     * @param {number} categoryId - Selected category ID
     */
    async updatePathDisplay(categoryId) {
        try {
            const path = await this.getCategoryPath(categoryId);
            const pathText = path.map(cat => cat.name).join(' › ');
            this.pathDisplay.textContent = pathText;
        } catch (error) {
            console.error('[ChoicesCategoryTree] Error updating path display:', error);
            this.pathDisplay.textContent = '';
        }
    }

    /**
     * Get full category path (ancestors).
     * Uses Bearer token (WebApp) or cookie-based auth (web interface).
     *
     * @param {number} categoryId - Category ID
     * @returns {Promise<Array>} Path array (root to category)
     */
    async getCategoryPath(categoryId) {
        const url = `${this.options.apiBaseUrl}/articles/${categoryId}/ancestors?include_self=true`;

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

        const response = await fetch(url, {
            headers: headers,
            credentials: 'same-origin',  // Include cookies
        });

        if (!response.ok) {
            // Graceful degradation for 401 Unauthorized (user not authenticated)
            if (response.status === 401) {
                console.log('[ChoicesCategoryTree] User not authenticated - ancestors not loaded');
                return [];  // Empty path array
            }

            // For other errors, throw with detailed status
            throw new Error(`Failed to load ancestors: HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.articles || [];
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

        if (this.pathDisplay) {
            this.pathDisplay.textContent = '';
            if (this.pathDisplay.parentNode) {
                this.pathDisplay.parentNode.removeChild(this.pathDisplay);
            }
        }

        this.categories = [];
        this.categoryMap.clear();
        this.childrenMap.clear();

        console.log('[ChoicesCategoryTree] Destroyed');
    }

    /**
     * Update category type without full reinitialization.
     * More efficient than destroy() + new instance.
     *
     * @param {string} newType - New category type ('income' or 'expense')
     */
    async updateType(newType) {
        console.log(`[ChoicesCategoryTree] Updating type from ${this.options.type} to ${newType}`);

        // Update type in options
        this.options.type = newType;

        // Reset selection
        if (this.element) {
            this.element.value = '';
        }

        // Clear path display
        if (this.pathDisplay) {
            this.pathDisplay.textContent = '';
        }

        // Load new categories from API
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

            // Prepare new choices data
            const choices = displayCategories.map(cat => ({
                value: cat.id,
                label: cat.name,
                customProperties: {
                    usage_count: cat.usage_count || 0,
                    parent_id: cat.parent_id,
                }
            }));

            // Set new choices
            this.choices.setChoices(choices, 'value', 'label', true);

            console.log(`[ChoicesCategoryTree] Updated with ${choices.length} categories`);
        }
    }

    /**
     * Refresh categories (reload from API).
     */
    async refresh() {
        console.log('[ChoicesCategoryTree] Refreshing categories...');

        // Destroy old instance
        if (this.choices) {
            this.choices.destroy();
            this.choices = null;
        }

        // Reinitialize
        await this.init();
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
     * Set selected category.
     *
     * @param {number} categoryId - Category ID to select
     */
    async setSelectedCategory(categoryId) {
        console.log('[ChoicesCategoryTree] setSelectedCategory called with:', categoryId);

        if (this.choices) {
            console.log('[ChoicesCategoryTree] Current choices state:', this.choices._currentState);

            // Get all available choices
            const availableChoices = this.choices._currentState?.choices || [];
            console.log('[ChoicesCategoryTree] Available choices count:', availableChoices.length);

            // Find the choice we're trying to set
            const targetChoice = availableChoices.find(c => c.value === categoryId.toString() || c.value === categoryId);
            console.log('[ChoicesCategoryTree] Target choice found:', targetChoice);

            // Try to set value
            this.choices.setChoiceByValue(categoryId.toString());

            // Verify it was set
            const currentValue = this.element.value;
            console.log('[ChoicesCategoryTree] After setChoiceByValue - element.value:', currentValue);

            await this.updatePathDisplay(categoryId);
        } else {
            console.error('[ChoicesCategoryTree] setSelectedCategory failed - no choices instance');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChoicesCategoryTree;
}

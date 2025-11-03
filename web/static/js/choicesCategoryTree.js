/**
 * ChoicesCategoryTree - Choices.js-based category selector with hierarchy support.
 *
 * Features:
 * - Fuzzy search via built-in Fuse.js
 * - Frequency-based sorting (most used first)
 * - Only leaf categories shown in dropdown
 * - Full path display below field after selection
 * - Hierarchical breadcrumb navigation
 * - Tailwind CSS styling
 *
 * Usage:
 *   const categoryTree = new ChoicesCategoryTree('#article_id', {
 *     type: 'expense',  // or 'income'
 *     onCategoryChange: (category) => console.log(category)
 *   });
 *
 * API Requirements:
 * - GET /api/v1/articles?type={type}&sort_by=usage_count
 * - GET /api/v1/articles/{id}/ancestors
 *
 * @version 1.0.0
 * @requires Choices.js v11.1.0
 */

class ChoicesCategoryTree {
    /**
     * Initialize category tree selector.
     *
     * @param {string} selector - CSS selector for select element
     * @param {Object} options - Configuration options
     * @param {string} options.type - Category type ('income' or 'expense')
     * @param {Function} options.onCategoryChange - Callback when category changes
     * @param {string} options.apiBaseUrl - Base URL for API (default: '/api/v1')
     * @param {boolean} options.showLeafOnly - Show only leaf categories (default: true)
     */
    constructor(selector, options = {}) {
        this.selector = selector;
        this.element = document.querySelector(selector);

        if (!this.element) {
            console.error(`[ChoicesCategoryTree] Element not found: ${selector}`);
            return;
        }

        this.options = {
            type: options.type || 'expense',
            onCategoryChange: options.onCategoryChange || null,
            apiBaseUrl: options.apiBaseUrl || '/api/v1',
            showLeafOnly: options.showLeafOnly !== false,  // Default true
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
     */
    async loadCategories() {
        const url = `${this.options.apiBaseUrl}/articles?type=${this.options.type}&sort_by=usage_count&limit=1000`;

        console.log(`[ChoicesCategoryTree] Loading categories from: ${url}`);

        const response = await fetch(url, {
            credentials: 'include',  // Include cookies (JWT)
        });

        if (!response.ok) {
            throw new Error(`Failed to load categories: ${response.status}`);
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

            // Styling (Tailwind CSS classes)
            classNames: {
                containerOuter: 'choices choices-tailwind',
                containerInner: 'choices__inner',
                input: 'choices__input',
                inputCloned: 'choices__input--cloned',
                list: 'choices__list',
                listItems: 'choices__list--multiple',
                listSingle: 'choices__list--single',
                listDropdown: 'choices__list--dropdown',
                item: 'choices__item',
                itemSelectable: 'choices__item--selectable',
                itemDisabled: 'choices__item--disabled',
                itemChoice: 'choices__item--choice',
                placeholder: 'choices__placeholder',
                group: 'choices__group',
                groupHeading: 'choices__heading',
                button: 'choices__button',
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
        let pathDisplay = document.querySelector(`${this.selector}-path`);

        if (!pathDisplay) {
            // Create path display element with Tailwind classes
            pathDisplay = document.createElement('div');
            pathDisplay.id = `${this.element.id}-path`;
            pathDisplay.className = 'category-path mt-2 text-sm text-gray-500 dark:text-gray-400';

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
     *
     * @param {number} categoryId - Category ID
     * @returns {Promise<Array>} Path array (root to category)
     */
    async getCategoryPath(categoryId) {
        const url = `${this.options.apiBaseUrl}/articles/${categoryId}/ancestors?include_self=true`;

        const response = await fetch(url, {
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Failed to load ancestors: ${response.status}`);
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
        // Use browser alert for web version
        alert(message);
    }

    /**
     * Destroy component and cleanup.
     */
    destroy() {
        if (this.choices) {
            this.choices.destroy();
            this.choices = null;
        }

        if (this.pathDisplay && this.pathDisplay.parentNode) {
            this.pathDisplay.parentNode.removeChild(this.pathDisplay);
        }

        this.categories = [];
        this.categoryMap.clear();
        this.childrenMap.clear();

        console.log('[ChoicesCategoryTree] Destroyed');
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
        if (this.choices) {
            this.choices.setChoiceByValue(categoryId.toString());
            await this.updatePathDisplay(categoryId);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChoicesCategoryTree;
}

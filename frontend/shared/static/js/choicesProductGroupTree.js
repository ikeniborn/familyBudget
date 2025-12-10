/**
 * Choices.js Product Group Tree Selector
 *
 * Hierarchical product group selector with Choices.js
 * Similar to ChoicesCategoryTree but for product groups
 *
 * Usage:
 *   const selector = new ChoicesProductGroupTree('select-element-id');
 *   await selector.init();
 */

class ChoicesProductGroupTree {
    constructor(selectId, options = {}) {
        this.selectId = selectId;
        this.selectElement = document.getElementById(selectId);
        this.choicesInstance = null;
        this.productGroups = [];

        // Default options
        this.options = {
            searchEnabled: true,
            searchPlaceholderValue: 'Поиск группы товаров...',
            noResultsText: 'Группа не найдена',
            itemSelectText: '',
            allowHTML: true, // Required for indentation
            shouldSort: false, // Maintain hierarchy order
            ...options
        };
    }

    /**
     * Initialize the selector
     */
    async init() {
        if (!this.selectElement) {
            console.error(`[ChoicesProductGroupTree] Element with id "${this.selectId}" not found`);
            return;
        }

        try {
            // Load product groups from API
            await this.loadProductGroups();

            // Build hierarchical options
            this.buildHierarchicalOptions();

            // Initialize Choices.js
            this.initChoices();

            debugLog(`[ChoicesProductGroupTree] Initialized for #${this.selectId}`);
        } catch (error) {
            console.error('[ChoicesProductGroupTree] Initialization error:', error);
            throw error;
        }
    }

    /**
     * Load product groups from API
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

            debugLog('[ChoicesProductGroupTree] Loaded product groups:', this.productGroups.length);
        } catch (error) {
            console.error('[ChoicesProductGroupTree] Error loading product groups:', error);
            this.productGroups = [];
            throw error;
        }
    }

    /**
     * Build hierarchical tree structure
     */
    buildTree(groups) {
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
     * Flatten tree with level information
     */
    flattenTree(nodes, level = 0) {
        let result = [];

        nodes.forEach(node => {
            result.push({ ...node, level });

            if (node.children && node.children.length > 0) {
                result = result.concat(this.flattenTree(node.children, level + 1));
            }
        });

        return result;
    }

    /**
     * Build hierarchical options for select element
     */
    buildHierarchicalOptions() {
        if (!this.selectElement) return;

        // Keep first option (placeholder)
        const firstOption = this.selectElement.querySelector('option[value=""]');
        this.selectElement.innerHTML = '';
        if (firstOption) {
            this.selectElement.appendChild(firstOption);
        }

        // Build tree
        const tree = this.buildTree(this.productGroups);

        // Flatten tree with levels
        const flatGroups = this.flattenTree(tree);

        // Add options with indentation
        flatGroups
            .filter(pg => pg.is_active)
            .forEach(pg => {
                const option = document.createElement('option');
                option.value = pg.id;

                // Indentation: 4 spaces per level
                const indent = '&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(pg.level);
                const prefix = pg.level > 0 ? '↳ ' : '';

                option.innerHTML = `${indent}${prefix}${this.escapeHtml(pg.name)}`;
                option.dataset.level = pg.level;

                this.selectElement.appendChild(option);
            });
    }

    /**
     * Initialize Choices.js
     */
    initChoices() {
        if (!this.selectElement) return;

        // Destroy existing instance
        if (this.choicesInstance) {
            this.choicesInstance.destroy();
        }

        // Create new Choices.js instance
        this.choicesInstance = new Choices(this.selectElement, this.options);

        debugLog('[ChoicesProductGroupTree] Choices.js initialized');
    }

    /**
     * Get selected product group ID
     */
    getValue() {
        if (!this.choicesInstance) return null;
        return this.choicesInstance.getValue(true);
    }

    /**
     * Set selected product group by ID
     */
    setValue(productGroupId) {
        if (!this.choicesInstance) return;
        this.choicesInstance.setChoiceByValue(productGroupId.toString());
    }

    /**
     * Reset selection to placeholder
     */
    reset() {
        if (!this.choicesInstance) return;
        this.choicesInstance.setChoiceByValue('');
    }

    /**
     * Reload product groups and rebuild options
     */
    async reload() {
        await this.loadProductGroups();
        this.buildHierarchicalOptions();
        this.initChoices();
    }

    /**
     * Destroy Choices.js instance
     */
    destroy() {
        if (this.choicesInstance) {
            this.choicesInstance.destroy();
            this.choicesInstance = null;
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

// Make available globally
window.ChoicesProductGroupTree = ChoicesProductGroupTree;

debugLog('[ChoicesProductGroupTree] Module loaded');

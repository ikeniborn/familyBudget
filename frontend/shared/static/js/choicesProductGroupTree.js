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
     * Build a map of group ID to group data
     */
    buildGroupMap(groups) {
        const map = {};
        groups.forEach(group => {
            map[group.id] = group;
        });
        return map;
    }

    /**
     * Get full path (breadcrumbs) for a product group
     * Returns array from root to the given group: [Root, Parent, Child]
     */
    getBreadcrumbs(groupId, groupMap) {
        const path = [];
        let currentId = groupId;

        while (currentId && groupMap[currentId]) {
            path.unshift(groupMap[currentId]);
            currentId = groupMap[currentId].parent_id;
        }

        return path;
    }

    /**
     * Find all leaf groups (groups without children)
     */
    findLeafGroups(groups) {
        // Set of IDs that are parents
        const parentIds = new Set();
        groups.forEach(group => {
            if (group.parent_id) {
                parentIds.add(group.parent_id);
            }
        });

        // Leaves are groups that are not in parentIds
        return groups.filter(group => !parentIds.has(group.id));
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
     * Shows only leaf groups with full path in parentheses
     * Example: "Кислое (Молочные → Кислое)"
     */
    buildHierarchicalOptions() {
        if (!this.selectElement) return;

        // Keep first option (placeholder)
        const firstOption = this.selectElement.querySelector('option[value=""]');
        this.selectElement.innerHTML = '';
        if (firstOption) {
            this.selectElement.appendChild(firstOption);
        }

        // Build group map for breadcrumbs lookup
        const groupMap = this.buildGroupMap(this.productGroups);

        // Find only leaf groups (groups without children)
        const leafGroups = this.findLeafGroups(this.productGroups);

        // Sort leaves alphabetically
        leafGroups.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

        // Add options - only leaves with full path
        leafGroups
            .filter(pg => pg.is_active)
            .forEach(pg => {
                const option = document.createElement('option');
                option.value = pg.id;

                // Get breadcrumbs path
                const breadcrumbs = this.getBreadcrumbs(pg.id, groupMap);

                // Format: "Name (Path → To → Name)" or just "Name" if root
                let label = this.escapeHtml(pg.name);
                if (breadcrumbs.length > 1) {
                    const pathStr = breadcrumbs.map(g => this.escapeHtml(g.name)).join(' → ');
                    label = `${this.escapeHtml(pg.name)} (${pathStr})`;
                }

                option.innerHTML = label;
                option.dataset.path = breadcrumbs.map(g => g.name).join(' → ');

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

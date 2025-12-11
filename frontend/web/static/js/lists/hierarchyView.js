/**
 * Hierarchy View Renderer
 *
 * Renders shopping list items as a collapsible tree:
 * Store → ProductGroup → Items
 *
 * Stage 6: Hierarchy View
 */

class HierarchyView {
    constructor(listsManager) {
        this.listsManager = listsManager;
        this.expandedNodes = new Set(); // Track expanded nodes
        this.container = document.getElementById('hierarchy-tree');
    }

    /**
     * Render the hierarchy tree
     */
    render() {
        if (!this.container) {
            console.error('[HierarchyView] Container element not found');
            return;
        }

        const items = this.listsManager.currentItems;
        const stores = this.listsManager.stores;
        const productGroups = this.listsManager.productGroups;

        if (items.length === 0) {
            this.renderEmpty();
            return;
        }

        // Build hierarchy structure
        const hierarchy = this.buildHierarchy(items, stores, productGroups);

        // Render tree
        this.container.innerHTML = this.renderTree(hierarchy);

        debugLog('[HierarchyView] Rendered hierarchy tree');
    }

    /**
     * Build a map of product group ID to product group data
     */
    buildProductGroupMap(productGroups) {
        const map = {};
        productGroups.forEach(pg => {
            map[pg.id] = pg;
        });
        return map;
    }

    /**
     * Get full ancestor path for a product group (from root to leaf)
     * Returns array: [Root, Parent, ..., Child]
     */
    getProductGroupPath(groupId, pgMap) {
        const path = [];
        let currentId = groupId;

        while (currentId && pgMap[currentId]) {
            path.unshift(pgMap[currentId]);
            currentId = pgMap[currentId].parent_id;
        }

        return path;
    }

    /**
     * Build hierarchy structure: Store → Full ProductGroup Tree → Items
     * Shows complete product group hierarchy for each item
     */
    buildHierarchy(items, stores, productGroups) {
        const hierarchy = {};
        const pgMap = this.buildProductGroupMap(productGroups);

        items.forEach(item => {
            const store = stores.find(s => s.id === item.store_id);
            if (!store) return;

            // Get full path from root to item's product group
            const pgPath = this.getProductGroupPath(item.product_group_id, pgMap);
            if (pgPath.length === 0) return;

            // Level 1: Store
            if (!hierarchy[store.id]) {
                hierarchy[store.id] = {
                    type: 'store',
                    id: store.id,
                    name: store.name,
                    productGroupTree: {} // Tree of product groups
                };
            }

            // Build nested product group tree
            let currentLevel = hierarchy[store.id].productGroupTree;
            pgPath.forEach((pg, index) => {
                const isLeaf = index === pgPath.length - 1;

                if (!currentLevel[pg.id]) {
                    currentLevel[pg.id] = {
                        type: 'product_group',
                        id: pg.id,
                        name: pg.name,
                        storeId: store.id,
                        children: {}, // Nested product groups
                        items: [] // Items (only for leaves)
                    };
                }

                if (isLeaf) {
                    // Add item to the leaf product group
                    currentLevel[pg.id].items.push({
                        type: 'item',
                        ...item,
                        storeId: store.id,
                        productGroupId: pg.id
                    });
                }

                currentLevel = currentLevel[pg.id].children;
            });
        });

        return hierarchy;
    }

    /**
     * Count all items in a product group tree (including nested children)
     */
    countItemsInTree(pgTree) {
        let total = 0;
        let completed = 0;

        Object.values(pgTree).forEach(pg => {
            // Count items in this product group
            total += pg.items.length;
            completed += pg.items.filter(item => item.is_completed).length;

            // Recursively count items in child product groups
            const childCounts = this.countItemsInTree(pg.children);
            total += childCounts.total;
            completed += childCounts.completed;
        });

        return { total, completed };
    }

    /**
     * Render tree HTML - compact design optimized for mobile
     */
    renderTree(hierarchy) {
        let html = '<div class="hierarchy-tree-compact">';

        // Render stores (level 1) - store headers
        Object.values(hierarchy).forEach(store => {
            const storeNodeId = `store-${store.id}`;
            const isExpanded = this.expandedNodes.has(storeNodeId);

            // Count all items under this store
            const counts = this.countItemsInTree(store.productGroupTree);

            html += `
                <div class="hierarchy-store" data-node-id="${storeNodeId}">
                    <span class="hierarchy-toggle" onclick="window.hierarchyView.toggleNode('${storeNodeId}')">
                        ${isExpanded ? '▼' : '▶'}
                    </span>
                    <span class="hierarchy-store-icon">🏪</span>
                    <span class="hierarchy-store-name hierarchy-clickable" onclick="window.hierarchyView.toggleNode('${storeNodeId}')">${this.escapeHtml(store.name)}</span>
                    <span class="hierarchy-store-badge">${counts.completed}/${counts.total}</span>
                </div>
            `;

            if (isExpanded) {
                html += this.renderProductGroupTree(store.productGroupTree, storeNodeId, 1);
            }
        });

        html += '</div>';
        return html;
    }

    /**
     * Render product group tree recursively (supports nested product groups)
     * Compact design: minimal indentation, groups only show hierarchy structure
     * @param {Object} pgTree - Tree of product groups (keys are IDs)
     * @param {string} parentNodeId - Parent node ID for building unique node IDs
     * @param {number} depth - Current depth level for indentation (max 2 levels visible)
     */
    renderProductGroupTree(pgTree, parentNodeId, depth) {
        let html = '<div class="hierarchy-group-list">';

        const productGroups = Object.values(pgTree);
        productGroups.forEach((productGroup, index) => {
            const pgNodeId = `${parentNodeId}-pg-${productGroup.id}`;
            const isExpanded = this.expandedNodes.has(pgNodeId);

            // Count items in this product group and its children
            const directItemCount = productGroup.items.length;
            const childCounts = this.countItemsInTree(productGroup.children);
            const totalItemCount = directItemCount + childCounts.total;

            const directCompletedCount = productGroup.items.filter(item => item.is_completed).length;
            const totalCompletedCount = directCompletedCount + childCounts.completed;

            // Check if has nested content (items or child product groups)
            const hasNestedContent = productGroup.items.length > 0 || Object.keys(productGroup.children).length > 0;

            // Compact indentation - use CSS classes instead of repeating elements
            // depth 1 = under store, depth 2+ = nested groups
            const indentClass = depth === 1 ? 'indent-1' : 'indent-2';

            html += `
                <div class="hierarchy-group ${indentClass}" data-node-id="${pgNodeId}">
                    ${hasNestedContent ? `
                        <span class="hierarchy-toggle" onclick="window.hierarchyView.toggleNode('${pgNodeId}')">
                            ${isExpanded ? '▼' : '▶'}
                        </span>
                    ` : '<span class="hierarchy-toggle-placeholder"></span>'}
                    <span class="hierarchy-group-icon">📦</span>
                    <span class="hierarchy-group-name ${hasNestedContent ? 'hierarchy-clickable' : ''}" ${hasNestedContent ? `onclick="window.hierarchyView.toggleNode('${pgNodeId}')"` : ''}>${this.escapeHtml(productGroup.name)}</span>
                    <span class="hierarchy-group-badge">${totalCompletedCount}/${totalItemCount}</span>
                </div>
            `;

            if (isExpanded) {
                // First render child product groups
                if (Object.keys(productGroup.children).length > 0) {
                    html += this.renderProductGroupTree(productGroup.children, pgNodeId, depth + 1);
                }

                // Then render items (at the end) - compact list
                if (productGroup.items.length > 0) {
                    html += this.renderItems(productGroup.items, pgNodeId, depth + 1);
                }
            }
        });

        html += '</div>';
        return html;
    }

    /**
     * Render items at specified depth
     * Items are rendered as a compact list with MINIMAL indentation
     * (shifted to left edge for better mobile viewing)
     * @param {Array} items - Array of item objects
     * @param {string} parentNodeId - Parent node ID
     * @param {number} depth - Current depth level (used for styling only)
     */
    renderItems(items, parentNodeId, depth = 2) {
        // Items container - compact list at left edge
        let html = '<div class="hierarchy-items-list">';

        items.forEach((item, index) => {
            const isCompleted = item.is_completed;

            html += `
                <div class="hierarchy-item ${isCompleted ? 'completed' : ''}" data-item-id="${item.id}">
                    <input type="checkbox"
                           class="checkbox checkbox-xs"
                           ${isCompleted ? 'checked' : ''}
                           onchange="window.listsManager.toggleItemCompleted(${item.id}, this.checked)">
                    <span class="hierarchy-item-name ${isCompleted ? 'line-through' : ''}">
                        ${this.escapeHtml(item.product_name)}
                    </span>
                    ${item.quantity ? `<span class="hierarchy-item-qty">${this.formatQuantity(item.quantity, item.unit)}${item.unit ? ' ' + item.unit : ''}</span>` : ''}
                    <div class="hierarchy-item-actions">
                        <button class="btn btn-xs btn-ghost btn-square"
                                onclick="openEditItemModal(${item.id})"
                                title="Редактировать">
                            ✏️
                        </button>
                        <button class="btn btn-xs btn-ghost btn-square text-error"
                                onclick="window.listsManager.deleteItem(${item.id})"
                                title="Удалить">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    /**
     * Render empty state
     */
    renderEmpty() {
        this.container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-6xl mb-4">🌳</div>
                <h3 class="text-2xl font-bold mb-2">Список пуст</h3>
                <p class="text-base-content/70 mb-4">Добавьте товары, чтобы увидеть иерархию</p>
                <button class="btn btn-primary" onclick="openAddItemModal()">
                    ➕ Добавить товар
                </button>
            </div>
        `;
    }

    /**
     * Toggle node expansion
     */
    toggleNode(nodeId) {
        if (this.expandedNodes.has(nodeId)) {
            this.expandedNodes.delete(nodeId);
        } else {
            this.expandedNodes.add(nodeId);
        }

        // Re-render
        this.render();
    }

    /**
     * Expand all nodes recursively in a product group tree
     * @param {Object} pgTree - Tree of product groups
     * @param {string} parentNodeId - Parent node ID
     */
    expandProductGroupTree(pgTree, parentNodeId) {
        Object.values(pgTree).forEach(pg => {
            const pgNodeId = `${parentNodeId}-pg-${pg.id}`;
            this.expandedNodes.add(pgNodeId);

            // Recursively expand child product groups
            if (Object.keys(pg.children).length > 0) {
                this.expandProductGroupTree(pg.children, pgNodeId);
            }
        });
    }

    /**
     * Expand all nodes
     */
    expandAll() {
        const items = this.listsManager.currentItems;
        const stores = this.listsManager.stores;
        const productGroups = this.listsManager.productGroups;

        // Build hierarchy to get the full tree structure
        const hierarchy = this.buildHierarchy(items, stores, productGroups);

        // Expand all stores and their product group trees
        Object.values(hierarchy).forEach(store => {
            const storeNodeId = `store-${store.id}`;
            this.expandedNodes.add(storeNodeId);

            // Recursively expand all product groups
            this.expandProductGroupTree(store.productGroupTree, storeNodeId);
        });

        // Re-render
        this.render();
    }

    /**
     * Collapse all nodes
     */
    collapseAll() {
        this.expandedNodes.clear();
        this.render();
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

        // Units that should display with 1 decimal (comma separator)
        const oneDecimalUnits = ['кг'];

        // All other units display as integers: шт, л, мл, уп, пач, г
        if (unit && oneDecimalUnits.includes(unit)) {
            return quantity.toFixed(1).replace('.', ',');
        }

        // Default: integer (round to nearest whole number)
        return Math.round(quantity).toString();
    }
}

// Make available globally
window.HierarchyView = HierarchyView;

debugLog('[HierarchyView] Module loaded');

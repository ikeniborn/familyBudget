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
     * Render tree HTML
     */
    renderTree(hierarchy) {
        let html = '<div class="hierarchy-tree">';

        // Render stores (level 1)
        Object.values(hierarchy).forEach(store => {
            const storeNodeId = `store-${store.id}`;
            const isExpanded = this.expandedNodes.has(storeNodeId);

            // Count all items under this store
            const counts = this.countItemsInTree(store.productGroupTree);

            html += `
                <div class="hierarchy-node hierarchy-level-1" data-node-id="${storeNodeId}">
                    <span class="hierarchy-toggle" onclick="window.hierarchyView.toggleNode('${storeNodeId}')">
                        ${isExpanded ? '▼' : '▶'}
                    </span>
                    <span class="hierarchy-icon">🏪</span>
                    <span class="hierarchy-label font-bold">${this.escapeHtml(store.name)}</span>
                    <span class="hierarchy-count badge badge-sm badge-ghost">${counts.total}</span>
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
     * @param {Object} pgTree - Tree of product groups (keys are IDs)
     * @param {string} parentNodeId - Parent node ID for building unique node IDs
     * @param {number} depth - Current depth level for indentation
     */
    renderProductGroupTree(pgTree, parentNodeId, depth) {
        let html = '<div class="hierarchy-children">';

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

            // Generate indentation
            const indentHtml = '<span class="hierarchy-indent"></span>'.repeat(depth);

            html += `
                <div class="hierarchy-node hierarchy-level-${depth + 1}" data-node-id="${pgNodeId}">
                    ${indentHtml}
                    <span class="hierarchy-line">└──</span>
                    ${hasNestedContent ? `
                        <span class="hierarchy-toggle" onclick="window.hierarchyView.toggleNode('${pgNodeId}')">
                            ${isExpanded ? '▼' : '▶'}
                        </span>
                    ` : '<span class="hierarchy-toggle-placeholder"></span>'}
                    <span class="hierarchy-icon">📦</span>
                    <span class="hierarchy-label">${this.escapeHtml(productGroup.name)}</span>
                    <span class="hierarchy-count badge badge-sm badge-info">${totalCompletedCount}/${totalItemCount}</span>
                </div>
            `;

            if (isExpanded) {
                // First render child product groups
                if (Object.keys(productGroup.children).length > 0) {
                    html += this.renderProductGroupTree(productGroup.children, pgNodeId, depth + 1);
                }

                // Then render items (at the end)
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
     * @param {Array} items - Array of item objects
     * @param {string} parentNodeId - Parent node ID
     * @param {number} depth - Current depth level for indentation
     */
    renderItems(items, parentNodeId, depth = 2) {
        let html = '<div class="hierarchy-children">';

        // Generate indentation based on depth (depth + 1 for items under product group)
        const indentHtml = '<span class="hierarchy-indent"></span>'.repeat(depth + 1);

        items.forEach((item, index) => {
            const isLast = index === items.length - 1;
            const linePrefix = isLast ? '└──' : '├──';
            const isCompleted = item.is_completed;

            html += `
                <div class="hierarchy-node hierarchy-level-${depth + 2} ${isCompleted ? 'completed' : ''}" data-item-id="${item.id}">
                    ${indentHtml}
                    <span class="hierarchy-line">${linePrefix}</span>
                    <input type="checkbox"
                           class="checkbox checkbox-xs"
                           ${isCompleted ? 'checked' : ''}
                           onchange="window.listsManager.toggleItemCompleted(${item.id}, this.checked)">
                    <span class="hierarchy-icon">🛒</span>
                    <span class="hierarchy-label ${isCompleted ? 'line-through' : ''}">
                        ${this.escapeHtml(item.product_name)}
                        ${item.quantity ? `<span class="text-xs opacity-60 ml-2">${item.quantity} ${item.unit || ''}</span>` : ''}
                    </span>
                    <div class="hierarchy-actions ml-auto">
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
}

// Make available globally
window.HierarchyView = HierarchyView;

debugLog('[HierarchyView] Module loaded');

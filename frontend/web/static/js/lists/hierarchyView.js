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
     * Build hierarchy structure: Store → ProductGroup → Items
     */
    buildHierarchy(items, stores, productGroups) {
        const hierarchy = {};

        items.forEach(item => {
            const store = stores.find(s => s.id === item.store_id);
            const productGroup = productGroups.find(pg => pg.id === item.product_group_id);

            if (!store || !productGroup) return;

            // Level 1: Store
            if (!hierarchy[store.id]) {
                hierarchy[store.id] = {
                    type: 'store',
                    id: store.id,
                    name: store.name,
                    children: {}
                };
            }

            // Level 2: ProductGroup
            if (!hierarchy[store.id].children[productGroup.id]) {
                hierarchy[store.id].children[productGroup.id] = {
                    type: 'product_group',
                    id: productGroup.id,
                    name: productGroup.name,
                    storeId: store.id,
                    children: []
                };
            }

            // Level 3: Item
            hierarchy[store.id].children[productGroup.id].children.push({
                type: 'item',
                ...item,
                storeId: store.id,
                productGroupId: productGroup.id
            });
        });

        return hierarchy;
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
            const childCount = Object.keys(store.children).length;

            html += `
                <div class="hierarchy-node hierarchy-level-1" data-node-id="${storeNodeId}">
                    <span class="hierarchy-toggle" onclick="window.hierarchyView.toggleNode('${storeNodeId}')">
                        ${isExpanded ? '▼' : '▶'}
                    </span>
                    <span class="hierarchy-icon">🏪</span>
                    <span class="hierarchy-label font-bold">${this.escapeHtml(store.name)}</span>
                    <span class="hierarchy-count badge badge-sm badge-ghost">${childCount}</span>
                </div>
            `;

            if (isExpanded) {
                html += this.renderProductGroups(store.children, storeNodeId);
            }
        });

        html += '</div>';
        return html;
    }

    /**
     * Render product groups (level 2)
     */
    renderProductGroups(productGroups, parentNodeId) {
        let html = '<div class="hierarchy-children">';

        Object.values(productGroups).forEach(productGroup => {
            const pgNodeId = `${parentNodeId}-pg-${productGroup.id}`;
            const isExpanded = this.expandedNodes.has(pgNodeId);
            const itemCount = productGroup.children.length;
            const completedCount = productGroup.children.filter(item => item.is_completed).length;

            html += `
                <div class="hierarchy-node hierarchy-level-2" data-node-id="${pgNodeId}">
                    <span class="hierarchy-indent"></span>
                    <span class="hierarchy-line">└──</span>
                    <span class="hierarchy-toggle" onclick="window.hierarchyView.toggleNode('${pgNodeId}')">
                        ${isExpanded ? '▼' : '▶'}
                    </span>
                    <span class="hierarchy-icon">📦</span>
                    <span class="hierarchy-label">${this.escapeHtml(productGroup.name)}</span>
                    <span class="hierarchy-count badge badge-sm badge-info">${completedCount}/${itemCount}</span>
                </div>
            `;

            if (isExpanded) {
                html += this.renderItems(productGroup.children, pgNodeId);
            }
        });

        html += '</div>';
        return html;
    }

    /**
     * Render items (level 3)
     */
    renderItems(items, parentNodeId) {
        let html = '<div class="hierarchy-children">';

        items.forEach((item, index) => {
            const isLast = index === items.length - 1;
            const linePrefix = isLast ? '└──' : '├──';
            const isCompleted = item.is_completed;

            html += `
                <div class="hierarchy-node hierarchy-level-3 ${isCompleted ? 'completed' : ''}" data-item-id="${item.id}">
                    <span class="hierarchy-indent"></span>
                    <span class="hierarchy-indent"></span>
                    <span class="hierarchy-line">${linePrefix}</span>
                    <input type="checkbox"
                           class="checkbox checkbox-sm"
                           ${isCompleted ? 'checked' : ''}
                           onclick="window.listsManager.toggleItemCompleted(${item.id}, this.checked)">
                    <span class="hierarchy-icon">🛒</span>
                    <span class="hierarchy-label ${isCompleted ? 'line-through' : ''}">
                        ${this.escapeHtml(item.product_name)}
                        ${item.quantity ? `<span class="text-xs opacity-60 ml-2">${item.quantity} ${item.unit || ''}</span>` : ''}
                    </span>
                    <div class="hierarchy-actions ml-auto">
                        <button class="btn btn-xs btn-ghost btn-square"
                                onclick="window.listsManager.openEditItemModal(${item.id})"
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
     * Expand all nodes
     */
    expandAll() {
        const items = this.listsManager.currentItems;
        const stores = this.listsManager.stores;
        const productGroups = this.listsManager.productGroups;

        // Build all possible node IDs
        const storeIds = [...new Set(items.map(item => item.store_id))];
        storeIds.forEach(storeId => {
            this.expandedNodes.add(`store-${storeId}`);

            // Find product groups for this store
            const pgIds = [...new Set(
                items
                    .filter(item => item.store_id === storeId)
                    .map(item => item.product_group_id)
            )];

            pgIds.forEach(pgId => {
                this.expandedNodes.add(`store-${storeId}-pg-${pgId}`);
            });
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

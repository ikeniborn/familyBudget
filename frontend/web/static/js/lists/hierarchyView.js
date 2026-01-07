/**
 * Hierarchy View Renderer
 *
 * Renders shopping list items as a collapsible tree:
 * Store → ProductGroup → Items
 *
 * Stage 6: Hierarchy View
 */

/**
 * SwipeHandler - Handles swipe gestures for Hierarchy View items
 * Enables swipe-to-action (edit/delete) on mobile devices
 */
class SwipeHandler {
    constructor(hierarchyView) {
        this.hierarchyView = hierarchyView;
        this.activeSwipedItemId = null;
        this.modalOpenedBySwipe = null; // NEW: Track modal opened by swipe
        this.startX = null;
        this.currentX = null;
        this.isDragging = false;
        this.SWIPE_THRESHOLD = 0.5; // 50% of item width

        // NEW: Centralized logging helper
        this._log = (action, data = {}) => {
            console.log(`[SWIPE_HANDLER] ${action}`, {
                timestamp: new Date().toISOString(),
                ...data
            });
        };

        console.log('[SWIPE_INIT] SwipeHandler initialized with modal tracking', {
            threshold: `${this.SWIPE_THRESHOLD * 100}%`
        });

        this._log('INITIALIZED', {
            threshold: `${this.SWIPE_THRESHOLD * 100}%`,
            minDistance: '50px (default swipe threshold)',
            modalTracking: true
        });
    }

    /**
     * Handle touch start event
     */
    handleTouchStart(e, itemId, itemElement) {
        this.startX = e.touches[0].clientX;
        this.isDragging = true;

        // Close other swiped items
        if (this.activeSwipedItemId && this.activeSwipedItemId !== itemId) {
            this.closeAllSwipes();
        }

        // Add swiping class to CONTENT element (disables transition during drag)
        const contentElement = itemElement.querySelector('.hierarchy-item-content');
        if (contentElement) {
            contentElement.classList.add('swiping');
        }

        console.log('[SWIPE] Touch start', {
            itemId,
            startX: this.startX,
            timestamp: Date.now()
        });
    }

    /**
     * Handle touch move event
     */
    handleTouchMove(e, itemId, itemElement) {
        if (!this.isDragging) return;

        this.currentX = e.touches[0].clientX;
        const deltaX = this.currentX - this.startX;

        const contentElement = itemElement.querySelector('.hierarchy-item-content');
        if (!contentElement) return;

        // Allow both left swipe (open) and right swipe (close)
        if (deltaX > 0) {
            // Right swipe - close if already swiped
            if (itemElement.classList.contains('swiped')) {
                const swipeDistance = Math.min(deltaX, itemElement.offsetWidth * this.SWIPE_THRESHOLD);
                const targetTransform = -(itemElement.offsetWidth * this.SWIPE_THRESHOLD - swipeDistance);
                contentElement.style.transform = `translateX(${targetTransform}px)`;
            } else {
                contentElement.style.transform = 'translateX(0)';
            }
            return;
        }

        const itemWidth = itemElement.offsetWidth;
        const maxSwipe = itemWidth * this.SWIPE_THRESHOLD;

        // Limit swipe to threshold
        const swipeDistance = Math.max(deltaX, -maxSwipe);
        contentElement.style.transform = `translateX(${swipeDistance}px)`;

        console.log('[SWIPE] Touch move', {
            itemId,
            deltaX,
            currentX: this.currentX,
            threshold: maxSwipe,
            swipeDistance
        });
    }

    /**
     * Handle touch end event
     */
    handleTouchEnd(e, itemId, itemElement) {
        if (!this.isDragging) return;

        this.isDragging = false;
        const deltaX = this.currentX - this.startX;
        const itemWidth = itemElement.offsetWidth;
        const threshold = itemWidth * this.SWIPE_THRESHOLD;

        const contentElement = itemElement.querySelector('.hierarchy-item-content');
        if (!contentElement) return;

        // Remove swiping class (re-enable transition)
        contentElement.classList.remove('swiping');

        // Determine action based on threshold
        if (deltaX < 0 && Math.abs(deltaX) >= threshold) {
            // Left swipe - OPEN MODAL DIRECTLY
            this.openEditModal(itemId, itemElement);
            console.log('[SWIPE] Touch end', {
                itemId,
                finalDeltaX: deltaX,
                threshold,
                action: 'opened_modal',
                timestamp: Date.now()
            });
        } else if (deltaX > 0 && Math.abs(deltaX) >= threshold) {
            // Right swipe - CLOSE MODAL IF OPEN
            this.closeModalIfOpen(itemId);
            console.log('[SWIPE] Touch end', {
                itemId,
                finalDeltaX: deltaX,
                threshold,
                action: 'attempted_close_modal',
                timestamp: Date.now()
            });
        } else {
            // Snap back (gesture incomplete)
            this.resetSwipe(itemId, itemElement);
            console.log('[SWIPE] Touch end', {
                itemId,
                finalDeltaX: deltaX,
                threshold,
                action: 'snap_back'
            });
        }
    }

    /**
     * Open edit modal (called after successful left swipe)
     */
    openEditModal(itemId, itemElement) {
        const contentElement = itemElement.querySelector('.hierarchy-item-content');
        const beforeTransform = contentElement ? contentElement.style.transform : 'none';

        console.log('[SWIPE_OPEN] Resetting swipe state before modal open', {
            itemId,
            beforeTransform,
            timestamp: Date.now()
        });

        // Reset visual state immediately
        this.resetSwipe(itemId, itemElement);

        const afterTransform = contentElement ? contentElement.style.transform : 'none';
        const isCleared = afterTransform === 'translateX(0px)' || afterTransform === '' || afterTransform === 'none';

        console.log('[SWIPE_OPEN] Swipe state reset completed', {
            itemId,
            beforeTransform,
            afterTransform,
            cleared: isCleared,
            warning: !isCleared ? 'Transform not properly cleared!' : null
        });

        // Track that this swipe opened the modal
        this.modalOpenedBySwipe = itemId;

        // Call global modal function (defined in listsManager.js)
        if (typeof openEditItemModal === 'function') {
            openEditItemModal(itemId);

            console.log('[SWIPE] Modal opened', {
                itemId,
                timestamp: Date.now(),
                source: 'swipe_gesture',
                modalOpenedBySwipe: this.modalOpenedBySwipe
            });
        } else {
            console.error('[SWIPE] openEditItemModal function not found');
        }
    }

    /**
     * Close modal if currently open (for right swipe)
     */
    closeModalIfOpen(itemId) {
        const modal = document.getElementById('item-modal');

        // Only close if modal is open AND was opened by swipe for THIS item
        if (modal && modal.open && this.modalOpenedBySwipe === itemId) {
            if (typeof closeItemModal === 'function') {
                closeItemModal();

                console.log('[SWIPE] Modal closed by right swipe', {
                    itemId,
                    timestamp: Date.now()
                });

                this.modalOpenedBySwipe = null;
            }
        }
    }

    /**
     * Reset swipe visual state (snap back to original position)
     */
    resetSwipe(itemId, itemElement) {
        const contentElement = itemElement.querySelector('.hierarchy-item-content');
        if (contentElement) {
            contentElement.style.transform = 'translateX(0)';
        }

        // Clear any swiped state
        itemElement.classList.remove('swiped');
        if (this.activeSwipedItemId === itemId) {
            this.activeSwipedItemId = null;
        }
    }

    /**
     * Close all open swipes
     */
    closeAllSwipes() {
        const previousActiveId = this.activeSwipedItemId;

        if (this.activeSwipedItemId) {
            const swipedElement = document.querySelector(`.hierarchy-item[data-item-id="${this.activeSwipedItemId}"]`);
            if (swipedElement) {
                this.resetSwipe(this.activeSwipedItemId, swipedElement);
            }
        }

        console.log('[SWIPE] Close all swipes', { previousActiveId });
    }

    /**
     * Setup event listeners for all items
     */
    setupSwipeHandlers() {
        const items = document.querySelectorAll('.hierarchy-item');

        items.forEach(itemElement => {
            const itemId = parseInt(itemElement.dataset.itemId);
            const contentElement = itemElement.querySelector('.hierarchy-item-content');

            // Remove old listeners (if any)
            itemElement.removeEventListener('touchstart', itemElement._touchStartHandler);
            itemElement.removeEventListener('touchmove', itemElement._touchMoveHandler);
            itemElement.removeEventListener('touchend', itemElement._touchEndHandler);
            if (contentElement) {
                contentElement.removeEventListener('click', contentElement._clickHandler);
            }

            // Create bound handlers
            itemElement._touchStartHandler = (e) => this.handleTouchStart(e, itemId, itemElement);
            itemElement._touchMoveHandler = (e) => this.handleTouchMove(e, itemId, itemElement);
            itemElement._touchEndHandler = (e) => this.handleTouchEnd(e, itemId, itemElement);

            // Click handler for content: close swipe if swiped
            if (contentElement) {
                contentElement._clickHandler = (e) => {
                    // Only close if this item is currently swiped
                    if (itemElement.classList.contains('swiped')) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.closeSwipe(itemId, itemElement);
                        console.log('[SWIPE] Content clicked - closing swipe', { itemId });
                    }
                };
                contentElement.addEventListener('click', contentElement._clickHandler);
            }

            // Add listeners with passive: false for preventDefault() support
            itemElement.addEventListener('touchstart', itemElement._touchStartHandler, { passive: false });
            itemElement.addEventListener('touchmove', itemElement._touchMoveHandler, { passive: false });
            itemElement.addEventListener('touchend', itemElement._touchEndHandler, { passive: false });
        });

        console.log('[SWIPE] Event handlers attached', { itemCount: items.length });
    }

    /**
     * Diagnostic method - call from console to debug swipe state
     * Usage: window.hierarchyView.swipeHandler.diagnoseSwipe()
     */
    diagnoseSwipe() {
        const swipedItems = document.querySelectorAll('.hierarchy-item.swiped');

        this._log('DIAGNOSTIC', {
            swipedCount: swipedItems.length,
            items: Array.from(swipedItems).map(item => {
                const actionsContainer = item.querySelector('.hierarchy-item-swipe-actions');
                const buttons = item.querySelectorAll('.hierarchy-item-swipe-actions button');
                const firstButton = buttons[0];

                return {
                    itemId: item.dataset.itemId,
                    transform: item.style.transform,
                    hasSwiped: item.classList.contains('swiped'),
                    containerWidth: actionsContainer ? actionsContainer.offsetWidth : 0,
                    containerPointerEvents: actionsContainer ?
                        window.getComputedStyle(actionsContainer).pointerEvents : 'N/A',
                    buttonCount: buttons.length,
                    buttonZIndex: firstButton ?
                        window.getComputedStyle(firstButton).zIndex : 'N/A',
                    buttonPointerEvents: firstButton ?
                        window.getComputedStyle(firstButton).pointerEvents : 'N/A',
                    buttonRect: firstButton ? firstButton.getBoundingClientRect() : null
                };
            })
        });

        return swipedItems;
    }
}

class HierarchyView {
    constructor(listsManager) {
        this.listsManager = listsManager;
        this.expandedNodes = new Set(); // Track expanded nodes
        this.container = document.getElementById('hierarchy-tree');
        this.swipeHandler = new SwipeHandler(this); // Swipe gesture handler
    }

    /**
     * Render the hierarchy tree
     */
    render() {
        if (!this.container) {
            console.error('[HierarchyView] Container element not found');
            return;
        }

        // Apply search filter from listsManager
        const items = this.listsManager.filterItemsBySearch();
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

        // Setup swipe handlers for all items
        this.swipeHandler.setupSwipeHandlers();

        // DIAGNOSTIC: Verify swipe indicators rendered correctly (v7.x+)
        const indicators = this.container.querySelectorAll('.swipe-indicator');
        const editIcons = this.container.querySelectorAll('.swipe-edit-icon');
        const chevrons = this.container.querySelectorAll('.swipe-chevron');
        console.log('[LISTS_SWIPE] Indicator diagnostic:', {
            totalIndicators: indicators.length,
            editIconsRendered: editIcons.length,
            chevronsRendered: chevrons.length,
            expectedChevrons: indicators.length * 3,
            chevronMatches: chevrons.length === indicators.length * 3,
            sampleAnimation: chevrons.length > 0 ? {
                chevron1: window.getComputedStyle(chevrons[0]).animationName,
                chevron2: chevrons.length > 1 ? window.getComputedStyle(chevrons[1]).animationName : 'N/A',
                chevron3: chevrons.length > 2 ? window.getComputedStyle(chevrons[2]).animationName : 'N/A'
            } : 'No chevrons found'
        });

        // Update smart toggle button state
        this.listsManager.updateHierarchyToggleButton();
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
     * Compact design: dynamic indentation based on depth, supports unlimited nesting
     * @param {Object} pgTree - Tree of product groups (keys are IDs)
     * @param {string} parentNodeId - Parent node ID for building unique node IDs
     * @param {number} depth - Current depth level for indentation (supports any depth)
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

            // Dynamic indentation based on depth (0.5rem per level)
            // depth 1 = 0.75rem, depth 2 = 1.25rem, depth 3 = 1.75rem, etc.
            const indentRem = 0.25 + (depth * 0.5);
            const indentStyle = `padding-left: ${indentRem}rem;`;

            html += `
                <div class="hierarchy-group" style="${indentStyle}" data-node-id="${pgNodeId}">
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
                    <div class="hierarchy-item-content cursor-pointer" onclick="window.listsManager.toggleItemCompleted(${item.id}, ${!isCompleted})">
                        <span class="hierarchy-item-name ${isCompleted ? 'line-through' : ''}">
                            ${this.escapeHtml(item.product_name)}
                        </span>
                        ${item.quantity ? `<span class="hierarchy-item-qty">${this.formatQuantity(item.quantity, item.unit)}${item.unit ? ' ' + item.unit : ''}</span>` : ''}

                        <!-- NEW: Swipe indicator with pencil + 3 chevrons (v7.x+) -->
                        <div class="swipe-indicator" aria-hidden="true">
                            <!-- Edit icon (pencil) -->
                            <svg class="swipe-edit-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>

                            <!-- Chevron 1 (left arrow) -->
                            <svg class="swipe-chevron swipe-chevron-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M15 18l-6-6 6-6"/>
                            </svg>

                            <!-- Chevron 2 (left arrow) -->
                            <svg class="swipe-chevron swipe-chevron-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M15 18l-6-6 6-6"/>
                            </svg>

                            <!-- Chevron 3 (left arrow) -->
                            <svg class="swipe-chevron swipe-chevron-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M15 18l-6-6 6-6"/>
                            </svg>
                        </div>

                        <!-- Desktop inline actions (unchanged) -->
                        <div class="hierarchy-item-actions" onclick="event.stopPropagation()">
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
                    <!-- REMOVED: .hierarchy-item-swipe-actions div -->
                </div>
            `;
        });

        html += '</div>';

        // Attach swipe handlers after rendering (will be called by setupSwipeHandlers())
        return html;
    }

    /**
     * Render empty state
     */
    renderEmpty() {
        // Check if search is active
        const hasSearch = this.listsManager.searchQuery && this.listsManager.searchQuery.trim() !== '';
        // Check if hide completed is active and there are completed items
        const hideCompleted = this.listsManager.hideCompleted;
        const hasCompletedItems = this.listsManager.currentItems.some(item => item.is_completed);

        if (hasSearch) {
            this.container.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">🔍</div>
                    <h3 class="text-2xl font-bold mb-2">Ничего не найдено</h3>
                    <p class="text-base-content/70 mb-4">Попробуйте изменить поисковый запрос</p>
                </div>
            `;
        } else if (hideCompleted && hasCompletedItems) {
            this.container.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">👁️‍🗨️</div>
                    <h3 class="text-2xl font-bold mb-2">Все товары выполнены</h3>
                    <p class="text-base-content/70 mb-4">Нажмите "Показать все" чтобы увидеть выполненные товары</p>
                    <button class="btn btn-primary" onclick="toggleHideCompleted()">
                        👁️ Показать все
                    </button>
                </div>
            `;
        } else {
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

        // Update smart toggle button state (already called in render, but calling again for clarity)
        this.listsManager.updateHierarchyToggleButton();
    }

    /**
     * Collapse all nodes
     */
    collapseAll() {
        this.expandedNodes.clear();
        this.render();

        // Update smart toggle button state (already called in render, but calling again for clarity)
        this.listsManager.updateHierarchyToggleButton();
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
}

// Make available globally
window.HierarchyView = HierarchyView;

debugLog('[HierarchyView] Module loaded');

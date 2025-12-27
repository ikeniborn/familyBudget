/**
 * Hierarchy Worker - Category tree processing in background thread
 *
 * Actions:
 * - buildMaps: Build categoryMap and childrenMap from categories array
 * - getParentChain: Get parent chain for category
 * - getSubtree: Get all descendants of category
 * - getBreadcrumbs: Get breadcrumb trail to category
 *
 * Performance target: 200-300ms → 50-100ms (70% faster)
 *
 * @version 1.0.0
 */

/**
 * Build hierarchy maps from categories array
 * O(N) complexity where N = number of categories
 *
 * @param {Array} categories - Array of category objects
 * @returns {Object} { categoryMap, childrenMap }
 */
function buildMaps(categories) {
    const categoryMap = {};
    const childrenMap = {};

    for (const category of categories) {
        // Build category map (id -> category)
        categoryMap[category.id] = category;

        // Build children map (parent_id -> [child_ids])
        if (category.parent_id) {
            if (!childrenMap[category.parent_id]) {
                childrenMap[category.parent_id] = [];
            }
            childrenMap[category.parent_id].push(category.id);
        }
    }

    return { categoryMap, childrenMap };
}

/**
 * Get parent chain for category (from category to root)
 * O(D) complexity where D = depth of tree
 *
 * @param {number} categoryId - Category ID
 * @param {Object} categoryMap - Category map (id -> category)
 * @returns {Array} - Array of parent categories (root first)
 */
function getParentChain(categoryId, categoryMap) {
    const chain = [];
    let current = categoryMap[categoryId];

    while (current && current.parent_id) {
        current = categoryMap[current.parent_id];
        if (current) {
            chain.unshift(current);  // Add to beginning (root first)
        }
    }

    return chain;
}

/**
 * Get all descendants of category (recursive subtree)
 * O(N) complexity where N = number of descendants
 *
 * @param {number} categoryId - Category ID
 * @param {Object} childrenMap - Children map (parent_id -> [child_ids])
 * @param {Object} categoryMap - Category map (id -> category)
 * @returns {Array} - Array of descendant categories
 */
function getSubtree(categoryId, childrenMap, categoryMap) {
    const subtree = [];
    const stack = [categoryId];  // DFS using stack

    while (stack.length > 0) {
        const currentId = stack.pop();
        const children = childrenMap[currentId] || [];

        for (const childId of children) {
            subtree.push(categoryMap[childId]);
            stack.push(childId);  // Add to stack for processing
        }
    }

    return subtree;
}

/**
 * Get breadcrumb trail to category (root → category)
 * O(D) complexity where D = depth of tree
 *
 * @param {number} categoryId - Category ID
 * @param {Object} categoryMap - Category map (id -> category)
 * @returns {Array} - Array of categories from root to current (inclusive)
 */
function getBreadcrumbs(categoryId, categoryMap) {
    const breadcrumbs = [];
    let current = categoryMap[categoryId];

    // Build chain from category to root
    while (current) {
        breadcrumbs.unshift(current);  // Add to beginning
        current = current.parent_id ? categoryMap[current.parent_id] : null;
    }

    return breadcrumbs;
}

/**
 * Worker message handler
 */
self.addEventListener('message', (event) => {
    const { id, action, data, options, timestamp } = event.data;
    const startTime = performance.now();

    try {
        let result;

        switch (action) {
            case 'buildMaps':
                result = buildMaps(data.categories);
                break;

            case 'getParentChain':
                result = getParentChain(data.categoryId, data.categoryMap);
                break;

            case 'getSubtree':
                result = getSubtree(data.categoryId, data.childrenMap, data.categoryMap);
                break;

            case 'getBreadcrumbs':
                result = getBreadcrumbs(data.categoryId, data.categoryMap);
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        // Send success response
        self.postMessage({
            id,
            success: true,
            result,
            error: null,
            duration: Math.round(performance.now() - startTime),
            timestamp: Date.now()
        });

    } catch (error) {
        // Send error response
        self.postMessage({
            id,
            success: false,
            result: null,
            error: {
                message: error.message,
                code: 'WORKER_ERROR',
                stack: error.stack  // Include stack for debugging
            },
            duration: Math.round(performance.now() - startTime),
            timestamp: Date.now()
        });
    }
});

// Worker initialization log (for debugging)
self.postMessage({
    type: 'initialized',
    workerType: 'hierarchy',
    version: '1.0.0',
    timestamp: Date.now()
});

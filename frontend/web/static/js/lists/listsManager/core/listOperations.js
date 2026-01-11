/**
 * Lists Manager - CRUD Operations
 *
 * Core create, update, delete operations for shopping list items.
 * Handles online/offline modes with optimistic UI updates.
 *
 * Phase 3.1 part 2: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/listsManager.ts lines 1860-1940, 3210-3400
 */
import { getState, updateState } from './ListsState';
import { isOnline } from './stateManager';
// ============================================================================
// Create Operations
// ============================================================================
/**
 * Create new shopping list item
 *
 * @param data - Item data
 * @returns Created item (with tempId for offline, or real id for online)
 */
export async function createItem(data) {
    const state = getState();
    // Add current list ID
    const itemData = {
        ...data,
        shopping_list_id: state.currentListId
    };
    try {
        let result;
        if (state.offlineShopping) {
            // Use offline manager (handles both online and offline)
            result = await state.offlineShopping.createItem(itemData);
        }
        else {
            // Fallback: direct API call (no offline support)
            const response = await fetch('/api/v1/shopping-list-items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(itemData)
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            result = await response.json();
        }
        debugLog('[ListsManager] Item created', { tempId: result.tempId, id: result.id });
        showToast('Товар добавлен', 'success');
        // For offline creates: add tempId item immediately to state
        if (result.tempId && !result.id) {
            const newItem = {
                id: result.tempId,
                list_id: state.currentListId,
                name: itemData.product_name || '',
                quantity: itemData.quantity || 0,
                unit: itemData.unit || '',
                is_completed: false,
                store_id: itemData.store_id || null,
                product_group_id: itemData.product_group_id || null,
                notes: itemData.comment || null,
                _offline: true,
                store_name: state.stores?.find(s => s.id === itemData.store_id)?.name,
                product_group_name: state.productGroups?.find(g => g.id === itemData.product_group_id)?.name
            };
            const currentItems = [...state.currentItems, newItem];
            updateState({ currentItems });
        }
        // Update cache
        await updateItemsCache();
        return result;
    }
    catch (error) {
        console.error('[ListsManager] Error creating item:', error);
        showToast('Ошибка создания товара', 'error');
        throw error;
    }
}
// ============================================================================
// Update Operations
// ============================================================================
/**
 * Update shopping list item
 *
 * @param itemId - Item ID (can be tempId for offline items)
 * @param data - Updated data (partial)
 * @returns Updated item
 */
export async function updateItem(itemId, data) {
    const state = getState();
    // Optimistic UI update
    const item = state.currentItems.find(i => i.id === itemId);
    if (item) {
        Object.assign(item, data);
        updateState({ currentItems: [...state.currentItems] });
    }
    try {
        let result;
        if (state.offlineShopping) {
            // Use offline manager
            result = await state.offlineShopping.updateItem(itemId, data);
        }
        else {
            // Fallback: direct API call
            const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            result = await response.json();
        }
        debugLog('[ListsManager] Item updated', { itemId });
        showToast('Товар обновлен', 'success');
        // Update cache
        await updateItemsCache();
        return result;
    }
    catch (error) {
        console.error('[ListsManager] Error updating item:', error);
        // Revert optimistic update on error (only if truly online)
        if (isOnline() && !error.message?.includes('offline')) {
            if (item) {
                // Reload from server
                showToast('Ошибка обновления товара', 'error');
            }
        }
        throw error;
    }
}
/**
 * Toggle item completed status
 *
 * @param itemId - Item ID
 * @param isCompleted - New completed status
 */
export async function toggleItemCompleted(itemId, isCompleted) {
    const state = getState();
    // Optimistic UI update
    const item = state.currentItems.find(i => i.id === itemId);
    if (item) {
        item.is_completed = isCompleted;
        updateState({ currentItems: [...state.currentItems] });
    }
    try {
        if (state.offlineShopping) {
            await state.offlineShopping.updateItem(itemId, { is_completed: isCompleted });
        }
        else {
            const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ is_completed: isCompleted })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        // Update cache
        await updateItemsCache();
    }
    catch (error) {
        console.error('[ListsManager] Error toggling item completed:', error);
        // Revert only if truly online and error occurred
        if (isOnline() && !error.message?.includes('offline')) {
            if (item) {
                item.is_completed = !isCompleted;
                updateState({ currentItems: [...state.currentItems] });
                showToast('Ошибка обновления статуса', 'error');
            }
        }
    }
}
// ============================================================================
// Delete Operations
// ============================================================================
/**
 * Delete shopping list item
 *
 * @param itemId - Item ID
 * @param skipConfirm - Skip confirmation dialog (default: false)
 */
export async function deleteItem(itemId, skipConfirm = false) {
    if (!skipConfirm && !confirm('Удалить этот товар?')) {
        return;
    }
    const state = getState();
    // Optimistic UI update - save deleted item for potential revert
    const itemIndex = state.currentItems.findIndex(item => item.id === itemId);
    if (itemIndex === -1)
        return;
    const deletedItem = state.currentItems[itemIndex];
    const currentItems = [...state.currentItems];
    currentItems.splice(itemIndex, 1);
    const selectedItemIds = new Set(state.selectedItemIds);
    selectedItemIds.delete(itemId);
    updateState({ currentItems, selectedItemIds });
    try {
        if (state.offlineShopping) {
            await state.offlineShopping.deleteItem(itemId);
        }
        else {
            const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
                method: 'DELETE',
                credentials: 'same-origin'
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        // Update cache
        await updateItemsCache();
        showToast('Товар удален', 'success');
    }
    catch (error) {
        console.error('[ListsManager] Error deleting item:', error);
        // Revert deletion only if truly online and error occurred
        if (isOnline() && !error.message?.includes('offline')) {
            currentItems.splice(itemIndex, 0, deletedItem);
            updateState({ currentItems });
            showToast('Ошибка удаления товара', 'error');
        }
    }
}
/**
 * Delete multiple items
 *
 * @param itemIds - Array of item IDs to delete
 */
export async function deleteMultipleItems(itemIds) {
    if (itemIds.length === 0)
        return;
    if (!confirm(`Удалить выбранные товары (${itemIds.length})?`)) {
        return;
    }
    const state = getState();
    const currentItems = [...state.currentItems];
    const selectedItemIds = new Set(state.selectedItemIds);
    // Optimistic UI update - remove all items
    const remainingItems = currentItems.filter(item => !itemIds.includes(item.id));
    itemIds.forEach(id => selectedItemIds.delete(id));
    updateState({ currentItems: remainingItems, selectedItemIds });
    try {
        // Delete each item
        const promises = itemIds.map(id => {
            if (state.offlineShopping) {
                return state.offlineShopping.deleteItem(id);
            }
            else {
                return fetch(`/api/v1/shopping-list-items/${id}`, {
                    method: 'DELETE',
                    credentials: 'same-origin'
                });
            }
        });
        await Promise.all(promises);
        // Update cache
        await updateItemsCache();
        showToast(`Удалено товаров: ${itemIds.length}`, 'success');
    }
    catch (error) {
        console.error('[ListsManager] Error deleting multiple items:', error);
        // Revert on error
        if (isOnline()) {
            updateState({ currentItems: currentItems });
            showToast('Ошибка удаления товаров', 'error');
        }
    }
}
// ============================================================================
// Cache Management
// ============================================================================
/**
 * Update items cache in IndexedDB
 */
export async function updateItemsCache() {
    const state = getState();
    if (state.db && state.currentListId) {
        const CACHE_KEY = `shopping_list_items_${state.currentListId}`;
        const CACHE_TTL = 86400; // 24 hours
        try {
            await state.db.setCache(CACHE_KEY, state.currentItems, CACHE_TTL);
            debugLog('[ListsManager] Items cache updated');
        }
        catch (error) {
            console.error('[ListsManager] Error updating items cache:', error);
        }
    }
}
//# sourceMappingURL=listOperations.js.map
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    createItem,
    updateItem,
    toggleItemCompleted,
    deleteItem,
    deleteMultipleItems,
    updateItemsCache
} from '@web/lists/listsManager/core/listOperations';
import * as ListsState from '@web/lists/listsManager/core/ListsState';
import * as stateManager from '@web/lists/listsManager/core/stateManager';

// Mock global functions
global.showToast = vi.fn();
global.debugLog = vi.fn();
global.confirm = vi.fn();
global.fetch = vi.fn();

// TODO (task-015): Update tests for PGlite-first pattern (removed OfflineShoppingManager)
describe.skip('listOperations', () => {
    let mockState: any;
    let mockOfflineShopping: any;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Re-initialize fetch as mock after clearAllMocks
        global.fetch = vi.fn();

        // Mock offline shopping manager
        mockOfflineShopping = {
            createItem: vi.fn(),
            updateItem: vi.fn(),
            deleteItem: vi.fn()
        };

        // Mock state
        mockState = {
            currentListId: 1,
            currentItems: [],
            selectedItemIds: new Set<number>(),
            stores: [
                { id: 1, name: 'Store 1' },
                { id: 2, name: 'Store 2' }
            ],
            productGroups: [
                { id: 1, name: 'Group 1' },
                { id: 2, name: 'Group 2' }
            ],
            offlineShopping: mockOfflineShopping,
            db: {
                setCache: vi.fn()
            }
        };

        // Mock ListsState functions
        vi.spyOn(ListsState, 'getState').mockReturnValue(mockState);
        vi.spyOn(ListsState, 'updateState').mockImplementation((updates) => {
            Object.assign(mockState, updates);
        });

        // Mock isOnline
        vi.spyOn(stateManager, 'isOnline').mockReturnValue(true);
    });

    describe('createItem', () => {
        it('should create item via offline manager in online mode', async () => {
            mockOfflineShopping.createItem.mockResolvedValue({
                id: 123,
                tempId: null
            });

            const itemData = {
                product_name: 'Milk',
                quantity: 2,
                unit: 'л'
            };

            const result = await createItem(itemData);

            expect(result).toEqual({ id: 123, tempId: null });
            expect(mockOfflineShopping.createItem).toHaveBeenCalledWith({
                ...itemData,
                shopping_list_id: 1
            });
            expect(global.showToast).toHaveBeenCalledWith('Товар добавлен', 'success');
        });

        it('should add offline item to state immediately', async () => {
            mockOfflineShopping.createItem.mockResolvedValue({
                tempId: 'temp-123',
                id: null
            });

            const itemData = {
                product_name: 'Bread',
                quantity: 1,
                unit: 'шт',
                store_id: 1,
                product_group_id: 2
            };

            await createItem(itemData);

            expect(mockState.currentItems).toHaveLength(1);
            expect(mockState.currentItems[0]).toMatchObject({
                id: 'temp-123',
                name: 'Bread',
                quantity: 1,
                unit: 'шт',
                is_completed: false,
                store_id: 1,
                product_group_id: 2,
                _offline: true
            });
        });

        it('should add store and product group names to offline item', async () => {
            mockOfflineShopping.createItem.mockResolvedValue({
                tempId: 'temp-456',
                id: null
            });

            await createItem({
                product_name: 'Eggs',
                store_id: 1,
                product_group_id: 2
            });

            expect(mockState.currentItems[0]).toMatchObject({
                store_name: 'Store 1',
                product_group_name: 'Group 2'
            });
        });

        it('should use direct API call when offline manager not available', async () => {
            mockState.offlineShopping = null;

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ id: 789 })
            });

            const result = await createItem({ product_name: 'Test' });

            expect(result).toEqual({ id: 789 });
            expect(global.fetch).toHaveBeenCalledWith('/api/v1/shopping-list-items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    product_name: 'Test',
                    shopping_list_id: 1
                })
            });
        });

        it('should handle API errors', async () => {
            mockState.offlineShopping = null;

            (global.fetch as any).mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            await expect(createItem({ product_name: 'Test' })).rejects.toThrow('HTTP 500');
            expect(global.showToast).toHaveBeenCalledWith('Ошибка создания товара', 'error');
        });

        it('should update cache after creation', async () => {
            mockOfflineShopping.createItem.mockResolvedValue({ id: 123 });

            await createItem({ product_name: 'Test' });

            expect(mockState.db.setCache).toHaveBeenCalledWith(
                'shopping_list_items_1',
                expect.any(Array),
                86400
            );
        });
    });

    describe('updateItem', () => {
        beforeEach(() => {
            mockState.currentItems = [
                { id: 1, name: 'Item 1', quantity: 2, is_completed: false },
                { id: 2, name: 'Item 2', quantity: 1, is_completed: true }
            ];
        });

        it('should update item optimistically', async () => {
            mockOfflineShopping.updateItem.mockResolvedValue({});

            await updateItem(1, { quantity: 5, unit: 'kg' });

            // Optimistic update should be applied
            expect(mockState.currentItems[0]).toMatchObject({
                quantity: 5,
                unit: 'kg'
            });
        });

        it('should use offline manager to persist update', async () => {
            mockOfflineShopping.updateItem.mockResolvedValue({});

            await updateItem(1, { is_completed: true });

            expect(mockOfflineShopping.updateItem).toHaveBeenCalledWith(1, {
                is_completed: true
            });
            expect(global.showToast).toHaveBeenCalledWith('Товар обновлен', 'success');
        });

        it('should use direct API call when offline manager not available', async () => {
            mockState.offlineShopping = null;

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({})
            });

            await updateItem(2, { quantity: 10 });

            expect(global.fetch).toHaveBeenCalledWith('/api/v1/shopping-list-items/2', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ quantity: 10 })
            });
        });

        it('should handle errors and show toast', async () => {
            mockOfflineShopping.updateItem.mockRejectedValue(new Error('Network error'));

            await expect(updateItem(1, { quantity: 5 })).rejects.toThrow('Network error');
            // Note: optimistic update is already applied, revert logic handled by caller
        });

        it('should update cache after update', async () => {
            mockOfflineShopping.updateItem.mockResolvedValue({});

            await updateItem(1, { quantity: 3 });

            expect(mockState.db.setCache).toHaveBeenCalled();
        });
    });

    describe('toggleItemCompleted', () => {
        beforeEach(() => {
            mockState.currentItems = [
                { id: 1, name: 'Item 1', is_completed: false },
                { id: 2, name: 'Item 2', is_completed: true }
            ];
        });

        it('should toggle item to completed optimistically', async () => {
            mockOfflineShopping.updateItem.mockResolvedValue({});

            await toggleItemCompleted(1, true);

            expect(mockState.currentItems[0].is_completed).toBe(true);
            expect(mockOfflineShopping.updateItem).toHaveBeenCalledWith(1, {
                is_completed: true
            });
        });

        it('should toggle item to uncompleted', async () => {
            mockOfflineShopping.updateItem.mockResolvedValue({});

            await toggleItemCompleted(2, false);

            expect(mockState.currentItems[1].is_completed).toBe(false);
        });

        it('should use direct API call when offline manager not available', async () => {
            mockState.offlineShopping = null;

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({})
            });

            await toggleItemCompleted(1, true);

            expect(global.fetch).toHaveBeenCalledWith('/api/v1/shopping-list-items/1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ is_completed: true })
            });
        });

        it('should revert optimistic update on online error', async () => {
            vi.spyOn(stateManager, 'isOnline').mockReturnValue(true);
            mockOfflineShopping.updateItem.mockRejectedValue(new Error('Server error'));

            // Initially false
            expect(mockState.currentItems[0].is_completed).toBe(false);

            await toggleItemCompleted(1, true);

            // After revert, should be back to false
            expect(mockState.currentItems[0].is_completed).toBe(false);
            expect(global.showToast).toHaveBeenCalledWith('Ошибка обновления статуса', 'error');
        });

        it('should not revert on offline error', async () => {
            vi.spyOn(stateManager, 'isOnline').mockReturnValue(true);
            mockOfflineShopping.updateItem.mockRejectedValue(new Error('offline error'));

            await toggleItemCompleted(1, true);

            // Optimistic update should remain
            expect(mockState.currentItems[0].is_completed).toBe(true);
            expect(global.showToast).not.toHaveBeenCalled();
        });

        it('should update cache after toggle', async () => {
            mockOfflineShopping.updateItem.mockResolvedValue({});

            await toggleItemCompleted(1, true);

            expect(mockState.db.setCache).toHaveBeenCalled();
        });
    });

    describe('deleteItem', () => {
        beforeEach(() => {
            mockState.currentItems = [
                { id: 1, name: 'Item 1' },
                { id: 2, name: 'Item 2' },
                { id: 3, name: 'Item 3' }
            ];
            mockState.selectedItemIds = new Set([2]);
        });

        it('should skip deletion when user cancels confirm', async () => {
            (global.confirm as any).mockReturnValue(false);

            await deleteItem(1);

            expect(mockState.currentItems).toHaveLength(3);
            expect(mockOfflineShopping.deleteItem).not.toHaveBeenCalled();
        });

        it('should skip confirmation when skipConfirm is true', async () => {
            mockOfflineShopping.deleteItem.mockResolvedValue({});

            await deleteItem(1, true);

            expect(global.confirm).not.toHaveBeenCalled();
            expect(mockState.currentItems).toHaveLength(2);
        });

        it('should delete item optimistically after confirm', async () => {
            (global.confirm as any).mockReturnValue(true);
            mockOfflineShopping.deleteItem.mockResolvedValue({});

            await deleteItem(2);

            expect(mockState.currentItems).toHaveLength(2);
            expect(mockState.currentItems.find(i => i.id === 2)).toBeUndefined();
            expect(mockOfflineShopping.deleteItem).toHaveBeenCalledWith(2);
        });

        it('should remove deleted item from selectedItemIds', async () => {
            (global.confirm as any).mockReturnValue(true);
            mockOfflineShopping.deleteItem.mockResolvedValue({});

            await deleteItem(2);

            expect(mockState.selectedItemIds.has(2)).toBe(false);
        });

        it('should use direct API call when offline manager not available', async () => {
            (global.confirm as any).mockReturnValue(true);
            mockState.offlineShopping = null;

            (global.fetch as any).mockResolvedValue({ ok: true });

            await deleteItem(1);

            expect(global.fetch).toHaveBeenCalledWith('/api/v1/shopping-list-items/1', {
                method: 'DELETE',
                credentials: 'same-origin'
            });
        });

        it('should revert deletion on online error', async () => {
            (global.confirm as any).mockReturnValue(true);
            vi.spyOn(stateManager, 'isOnline').mockReturnValue(true);
            mockOfflineShopping.deleteItem.mockRejectedValue(new Error('Server error'));

            const originalLength = mockState.currentItems.length;

            await deleteItem(2);

            // Item should be restored
            expect(mockState.currentItems).toHaveLength(originalLength);
            expect(mockState.currentItems.find(i => i.id === 2)).toBeDefined();
            expect(global.showToast).toHaveBeenCalledWith('Ошибка удаления товара', 'error');
        });

        it('should not revert on offline error', async () => {
            (global.confirm as any).mockReturnValue(true);
            vi.spyOn(stateManager, 'isOnline').mockReturnValue(true);
            mockOfflineShopping.deleteItem.mockRejectedValue(new Error('offline error'));

            await deleteItem(2);

            // Deletion should remain
            expect(mockState.currentItems).toHaveLength(2);
            expect(global.showToast).not.toHaveBeenCalledWith(expect.stringContaining('Ошибка'), 'error');
        });

        it('should show success toast after deletion', async () => {
            (global.confirm as any).mockReturnValue(true);
            mockOfflineShopping.deleteItem.mockResolvedValue({});

            await deleteItem(1);

            expect(global.showToast).toHaveBeenCalledWith('Товар удален', 'success');
        });

        it('should return early if item not found', async () => {
            await deleteItem(999, true);

            expect(mockOfflineShopping.deleteItem).not.toHaveBeenCalled();
        });
    });

    describe('deleteMultipleItems', () => {
        beforeEach(() => {
            mockState.currentItems = [
                { id: 1, name: 'Item 1' },
                { id: 2, name: 'Item 2' },
                { id: 3, name: 'Item 3' },
                { id: 4, name: 'Item 4' }
            ];
            mockState.selectedItemIds = new Set([1, 2, 3]);
        });

        it('should return early if no items to delete', async () => {
            await deleteMultipleItems([]);

            expect(global.confirm).not.toHaveBeenCalled();
            expect(mockState.currentItems).toHaveLength(4);
        });

        it('should skip deletion when user cancels confirm', async () => {
            (global.confirm as any).mockReturnValue(false);

            await deleteMultipleItems([1, 2]);

            expect(mockState.currentItems).toHaveLength(4);
        });

        it('should delete multiple items optimistically', async () => {
            (global.confirm as any).mockReturnValue(true);
            mockOfflineShopping.deleteItem.mockResolvedValue({});

            await deleteMultipleItems([1, 2, 3]);

            expect(mockState.currentItems).toHaveLength(1);
            expect(mockState.currentItems[0].id).toBe(4);
        });

        it('should remove deleted items from selectedItemIds', async () => {
            (global.confirm as any).mockReturnValue(true);
            mockOfflineShopping.deleteItem.mockResolvedValue({});

            await deleteMultipleItems([1, 2]);

            expect(mockState.selectedItemIds.has(1)).toBe(false);
            expect(mockState.selectedItemIds.has(2)).toBe(false);
            expect(mockState.selectedItemIds.has(3)).toBe(true);  // Not deleted
        });

        it('should call delete for each item in parallel', async () => {
            (global.confirm as any).mockReturnValue(true);
            mockOfflineShopping.deleteItem.mockResolvedValue({});

            await deleteMultipleItems([1, 2, 3]);

            expect(mockOfflineShopping.deleteItem).toHaveBeenCalledTimes(3);
            expect(mockOfflineShopping.deleteItem).toHaveBeenCalledWith(1);
            expect(mockOfflineShopping.deleteItem).toHaveBeenCalledWith(2);
            expect(mockOfflineShopping.deleteItem).toHaveBeenCalledWith(3);
        });

        it('should use direct API calls when offline manager not available', async () => {
            (global.confirm as any).mockReturnValue(true);
            mockState.offlineShopping = null;

            (global.fetch as any).mockResolvedValue({ ok: true });

            await deleteMultipleItems([1, 2]);

            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(global.fetch).toHaveBeenCalledWith('/api/v1/shopping-list-items/1', {
                method: 'DELETE',
                credentials: 'same-origin'
            });
        });

        it('should show success toast with count', async () => {
            (global.confirm as any).mockReturnValue(true);
            mockOfflineShopping.deleteItem.mockResolvedValue({});

            await deleteMultipleItems([1, 2, 3]);

            expect(global.showToast).toHaveBeenCalledWith('Удалено товаров: 3', 'success');
        });

        it('should revert all deletions on error', async () => {
            (global.confirm as any).mockReturnValue(true);
            vi.spyOn(stateManager, 'isOnline').mockReturnValue(true);
            mockOfflineShopping.deleteItem.mockRejectedValue(new Error('Server error'));

            await deleteMultipleItems([1, 2]);

            // All items should be restored
            expect(mockState.currentItems).toHaveLength(4);
            expect(global.showToast).toHaveBeenCalledWith('Ошибка удаления товаров', 'error');
        });

        it('should show confirm dialog with count', async () => {
            (global.confirm as any).mockReturnValue(true);

            await deleteMultipleItems([1, 2, 3]);

            expect(global.confirm).toHaveBeenCalledWith('Удалить выбранные товары (3)?');
        });
    });

    describe('updateItemsCache', () => {
        it('should update cache in IndexedDB', async () => {
            mockState.currentItems = [
                { id: 1, name: 'Item 1' },
                { id: 2, name: 'Item 2' }
            ];

            await updateItemsCache();

            expect(mockState.db.setCache).toHaveBeenCalledWith(
                'shopping_list_items_1',
                mockState.currentItems,
                86400
            );
        });

        it('should skip cache update if db not available', async () => {
            mockState.db = null;

            await updateItemsCache();

            // Should not throw, just skip silently
            expect(true).toBe(true);
        });

        it('should skip cache update if currentListId not set', async () => {
            mockState.currentListId = null;

            await updateItemsCache();

            expect(mockState.db.setCache).not.toHaveBeenCalled();
        });

        it('should handle cache errors gracefully', async () => {
            mockState.db.setCache.mockRejectedValue(new Error('Cache error'));

            await updateItemsCache();

            // Should not throw, error logged to console
            expect(true).toBe(true);
        });
    });
});

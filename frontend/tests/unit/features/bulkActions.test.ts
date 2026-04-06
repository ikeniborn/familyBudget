import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    markAllCompleted,
    unmarkAllCompleted,
    deleteCompleted
} from '@web/lists/listsManager/features/bulkActions';
import * as ListsState from '@web/lists/listsManager/core/ListsState';
import * as listOperations from '@web/lists/listsManager/core/listOperations';
import * as tableBuilder from '@web/lists/listsManager/rendering/tableBuilder';

// Mock global functions
global.showToast = vi.fn();

describe('bulkActions', () => {
    let mockState: any;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Mock state
        mockState = {
            currentItems: [
                { id: 1, name: 'Item 1', is_completed: false },
                { id: 2, name: 'Item 2', is_completed: true },
                { id: 3, name: 'Item 3', is_completed: false },
                { id: 4, name: 'Item 4', is_completed: true }
            ]
        };

        // Mock ListsState functions
        vi.spyOn(ListsState, 'getState').mockReturnValue(mockState);

        // Mock listOperations
        vi.spyOn(listOperations, 'toggleItemCompleted').mockResolvedValue(undefined);
        vi.spyOn(listOperations, 'deleteMultipleItems').mockResolvedValue(undefined);

        // Mock renderCurrentView
        vi.spyOn(tableBuilder, 'renderCurrentView').mockImplementation(() => {});
    });

    describe('markAllCompleted', () => {
        it('should mark all uncompleted items as completed', async () => {
            await markAllCompleted();

            // Should toggle items 1 and 3 (uncompleted)
            expect(listOperations.toggleItemCompleted).toHaveBeenCalledTimes(2);
            expect(listOperations.toggleItemCompleted).toHaveBeenCalledWith(1, true);
            expect(listOperations.toggleItemCompleted).toHaveBeenCalledWith(3, true);

            // Should re-render and show success message
            expect(tableBuilder.renderCurrentView).toHaveBeenCalled();
            expect(global.showToast).toHaveBeenCalledWith('Отмечено: 2', 'success');
        });

        it('should show info toast if all items already completed', async () => {
            // All items completed
            mockState.currentItems = [
                { id: 1, name: 'Item 1', is_completed: true },
                { id: 2, name: 'Item 2', is_completed: true }
            ];

            await markAllCompleted();

            expect(listOperations.toggleItemCompleted).not.toHaveBeenCalled();
            expect(global.showToast).toHaveBeenCalledWith('Все товары уже отмечены', 'info');
        });

        it('should handle empty list', async () => {
            mockState.currentItems = [];

            await markAllCompleted();

            expect(listOperations.toggleItemCompleted).not.toHaveBeenCalled();
            expect(global.showToast).toHaveBeenCalledWith('Все товары уже отмечены', 'info');
        });
    });

    describe('unmarkAllCompleted', () => {
        it('should unmark all completed items', async () => {
            await unmarkAllCompleted();

            // Should toggle items 2 and 4 (completed)
            expect(listOperations.toggleItemCompleted).toHaveBeenCalledTimes(2);
            expect(listOperations.toggleItemCompleted).toHaveBeenCalledWith(2, false);
            expect(listOperations.toggleItemCompleted).toHaveBeenCalledWith(4, false);

            // Should re-render and show success message
            expect(tableBuilder.renderCurrentView).toHaveBeenCalled();
            expect(global.showToast).toHaveBeenCalledWith('Снято отметок: 2', 'success');
        });

        it('should show info toast if no completed items', async () => {
            // All items uncompleted
            mockState.currentItems = [
                { id: 1, name: 'Item 1', is_completed: false },
                { id: 2, name: 'Item 2', is_completed: false }
            ];

            await unmarkAllCompleted();

            expect(listOperations.toggleItemCompleted).not.toHaveBeenCalled();
            expect(global.showToast).toHaveBeenCalledWith('Нет отмеченных товаров', 'info');
        });

        it('should handle empty list', async () => {
            mockState.currentItems = [];

            await unmarkAllCompleted();

            expect(listOperations.toggleItemCompleted).not.toHaveBeenCalled();
            expect(global.showToast).toHaveBeenCalledWith('Нет отмеченных товаров', 'info');
        });
    });

    describe('deleteCompleted', () => {
        it('should delete all completed items', async () => {
            await deleteCompleted();

            // Should delete items 2 and 4 (completed)
            expect(listOperations.deleteMultipleItems).toHaveBeenCalledTimes(1);
            expect(listOperations.deleteMultipleItems).toHaveBeenCalledWith([2, 4], true);

            // Should re-render and show success message
            expect(tableBuilder.renderCurrentView).toHaveBeenCalled();
            expect(global.showToast).toHaveBeenCalledWith('Удалено: 2', 'success');
        });

        it('should show info toast if no completed items', async () => {
            // All items uncompleted
            mockState.currentItems = [
                { id: 1, name: 'Item 1', is_completed: false },
                { id: 2, name: 'Item 2', is_completed: false }
            ];

            await deleteCompleted();

            expect(listOperations.deleteMultipleItems).not.toHaveBeenCalled();
            expect(global.showToast).toHaveBeenCalledWith('Нет выполненных товаров', 'info');
        });

        it('should handle empty list', async () => {
            mockState.currentItems = [];

            await deleteCompleted();

            expect(listOperations.deleteMultipleItems).not.toHaveBeenCalled();
            expect(global.showToast).toHaveBeenCalledWith('Нет выполненных товаров', 'info');
        });

        it('should handle single completed item', async () => {
            mockState.currentItems = [
                { id: 1, name: 'Item 1', is_completed: true }
            ];

            await deleteCompleted();

            expect(listOperations.deleteMultipleItems).toHaveBeenCalledWith([1], true);
            expect(global.showToast).toHaveBeenCalledWith('Удалено: 1', 'success');
        });
    });
});

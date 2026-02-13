import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    toggleSelectAll,
    selectCompleted,
    deleteSelected,
    updateSelectionUI
} from '@web/lists/listsManager/features/multiSelect';
import * as ListsState from '@web/lists/listsManager/core/ListsState';
import * as tableBuilder from '@web/lists/listsManager/rendering/tableBuilder';

// Mock global functions
global.showToast = vi.fn();
global.showConfirmDialog = vi.fn();

describe('multiSelect', () => {
    let mockState: any;
    let mockElements: Map<string, any>;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Mock elements map
        mockElements = new Map();

        // Mock state
        mockState = {
            currentView: 'table',
            selectedItemIds: new Set<number>(),
            currentItems: [
                { id: 1, name: 'Item 1', is_completed: false },
                { id: 2, name: 'Item 2', is_completed: true },
                { id: 3, name: 'Item 3', is_completed: false },
                { id: 4, name: 'Item 4', is_completed: true }
            ],
            hierarchyView: null
        };

        // Mock ListsState functions
        vi.spyOn(ListsState, 'getState').mockReturnValue(mockState);
        vi.spyOn(ListsState, 'updateState').mockImplementation((updates) => {
            Object.assign(mockState, updates);
        });

        // Mock renderCurrentView
        vi.spyOn(tableBuilder, 'renderCurrentView').mockImplementation(() => {});

        // Mock document.getElementById
        vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
            if (!mockElements.has(id)) {
                // Create persistent span elements for this button
                const iconSpan = { textContent: '☑️' };
                const textSpan = { textContent: '', classList: { contains: vi.fn(() => false) } };

                // Create mock element
                const element: any = {
                    id,
                    disabled: false,
                    classList: {
                        add: vi.fn(),
                        remove: vi.fn(),
                        toggle: vi.fn(),
                        contains: vi.fn()
                    },
                    querySelector: vi.fn((selector: string) => {
                        if (selector === 'span:first-child') {
                            return iconSpan; // Return same object
                        }
                        if (selector === 'span:last-child') {
                            return textSpan; // Return same object
                        }
                        return null;
                    }),
                    value: '',
                    textContent: ''
                };
                mockElements.set(id, element);
            }
            return mockElements.get(id);
        });

        // Mock fetch
        global.fetch = vi.fn();
    });

    describe('toggleSelectAll', () => {
        it('should select all items when none selected', () => {
            mockState.selectedItemIds = new Set();

            toggleSelectAll();

            expect(mockState.selectedItemIds.size).toBe(4);
            expect(mockState.selectedItemIds.has(1)).toBe(true);
            expect(mockState.selectedItemIds.has(2)).toBe(true);
            expect(mockState.selectedItemIds.has(3)).toBe(true);
            expect(mockState.selectedItemIds.has(4)).toBe(true);
            expect(tableBuilder.renderCurrentView).toHaveBeenCalled();
        });

        it('should deselect all items when all selected', () => {
            mockState.selectedItemIds = new Set([1, 2, 3, 4]);

            toggleSelectAll();

            expect(mockState.selectedItemIds.size).toBe(0);
            expect(tableBuilder.renderCurrentView).toHaveBeenCalled();
        });

        it('should select all when partially selected', () => {
            mockState.selectedItemIds = new Set([1, 2]);

            toggleSelectAll();

            expect(mockState.selectedItemIds.size).toBe(4);
            expect(mockState.selectedItemIds.has(1)).toBe(true);
            expect(mockState.selectedItemIds.has(2)).toBe(true);
            expect(mockState.selectedItemIds.has(3)).toBe(true);
            expect(mockState.selectedItemIds.has(4)).toBe(true);
        });

        it('should handle empty items list', () => {
            mockState.currentItems = [];
            mockState.selectedItemIds = new Set();

            toggleSelectAll();

            expect(mockState.selectedItemIds.size).toBe(0);
        });
    });

    describe('selectCompleted', () => {
        it('should select only completed items', () => {
            mockState.selectedItemIds = new Set();

            selectCompleted();

            expect(mockState.selectedItemIds.size).toBe(2);
            expect(mockState.selectedItemIds.has(2)).toBe(true);
            expect(mockState.selectedItemIds.has(4)).toBe(true);
            expect(mockState.selectedItemIds.has(1)).toBe(false);
            expect(mockState.selectedItemIds.has(3)).toBe(false);
            expect(tableBuilder.renderCurrentView).toHaveBeenCalled();
            expect(global.showToast).toHaveBeenCalledWith('Выбрано 2 выполненных товаров', 'info');
        });

        it('should handle no completed items', () => {
            mockState.currentItems = [
                { id: 1, name: 'Item 1', is_completed: false },
                { id: 2, name: 'Item 2', is_completed: false }
            ];

            selectCompleted();

            expect(mockState.selectedItemIds.size).toBe(0);
            expect(global.showToast).toHaveBeenCalledWith('Выбрано 0 выполненных товаров', 'info');
        });

        it('should replace existing selection', () => {
            mockState.selectedItemIds = new Set([1, 3]);

            selectCompleted();

            expect(mockState.selectedItemIds.size).toBe(2);
            expect(mockState.selectedItemIds.has(2)).toBe(true);
            expect(mockState.selectedItemIds.has(4)).toBe(true);
            expect(mockState.selectedItemIds.has(1)).toBe(false);
        });

        it('should select all when all items are completed', () => {
            mockState.currentItems = [
                { id: 1, name: 'Item 1', is_completed: true },
                { id: 2, name: 'Item 2', is_completed: true }
            ];

            selectCompleted();

            expect(mockState.selectedItemIds.size).toBe(2);
            expect(global.showToast).toHaveBeenCalledWith('Выбрано 2 выполненных товаров', 'info');
        });
    });

    describe('deleteSelected', () => {
        it('should return early when no items selected', async () => {
            mockState.selectedItemIds = new Set();

            await deleteSelected();

            expect(global.showConfirmDialog).not.toHaveBeenCalled();
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should show confirmation dialog with count', async () => {
            mockState.selectedItemIds = new Set([1, 2]);
            (global.showConfirmDialog as any).mockResolvedValue(false);

            await deleteSelected();

            expect(global.showConfirmDialog).toHaveBeenCalledWith(
                'Удалить выбранные товары (2)?\nЭто действие необратимо.',
                '🗑️ Удаление товаров'
            );
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should delete selected items on confirmation', async () => {
            mockState.selectedItemIds = new Set([1, 3]);
            (global.showConfirmDialog as any).mockResolvedValue(true);
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ deleted: 2 })
            });

            await deleteSelected();

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/v1/shopping-list-items/batch-delete',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ item_ids: [1, 3] })
                })
            );

            expect(mockState.currentItems).toHaveLength(2);
            expect(mockState.currentItems[0].id).toBe(2);
            expect(mockState.currentItems[1].id).toBe(4);
            expect(mockState.selectedItemIds.size).toBe(0);
            expect(tableBuilder.renderCurrentView).toHaveBeenCalled();
            expect(global.showToast).toHaveBeenCalledWith('Удалено товаров: 2', 'success');
        });

        it('should render hierarchy view when in hierarchy mode', async () => {
            const mockHierarchyView = {
                render: vi.fn()
            };
            mockState.currentView = 'hierarchy';
            mockState.hierarchyView = mockHierarchyView;
            mockState.selectedItemIds = new Set([1]);
            (global.showConfirmDialog as any).mockResolvedValue(true);
            (global.fetch as any).mockResolvedValue({ ok: true });

            await deleteSelected();

            expect(mockHierarchyView.render).toHaveBeenCalled();
            expect(tableBuilder.renderCurrentView).not.toHaveBeenCalled();
        });

        it('should handle API errors', async () => {
            mockState.selectedItemIds = new Set([1, 2]);
            (global.showConfirmDialog as any).mockResolvedValue(true);
            (global.fetch as any).mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await deleteSelected();

            expect(mockState.currentItems).toHaveLength(4); // No change
            expect(mockState.selectedItemIds.size).toBe(2); // Selection preserved
            expect(global.showToast).toHaveBeenCalledWith('Ошибка удаления товаров', 'error');
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle network errors', async () => {
            mockState.selectedItemIds = new Set([1]);
            (global.showConfirmDialog as any).mockResolvedValue(true);
            (global.fetch as any).mockRejectedValue(new Error('Network error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await deleteSelected();

            expect(mockState.currentItems).toHaveLength(4); // No change
            expect(global.showToast).toHaveBeenCalledWith('Ошибка удаления товаров', 'error');

            consoleSpy.mockRestore();
        });

        it('should not delete when user cancels', async () => {
            mockState.selectedItemIds = new Set([1, 2, 3, 4]);
            (global.showConfirmDialog as any).mockResolvedValue(false);

            await deleteSelected();

            expect(global.fetch).not.toHaveBeenCalled();
            expect(mockState.currentItems).toHaveLength(4);
            expect(mockState.selectedItemIds.size).toBe(4);
        });
    });

    describe('updateSelectionUI', () => {
        it('should enable delete button when items selected', () => {
            mockState.selectedItemIds = new Set([1, 2]);
            const deleteBtn = document.getElementById('delete-selected-btn') as any;
            const textSpan = deleteBtn.querySelector('span:last-child');

            updateSelectionUI();

            expect(deleteBtn.disabled).toBe(false);
            expect(textSpan.textContent).toBe('Удалить (2)');
        });

        it('should disable delete button when no items selected', () => {
            mockState.selectedItemIds = new Set();
            const deleteBtn = document.getElementById('delete-selected-btn') as any;
            const textSpan = deleteBtn.querySelector('span:last-child');

            updateSelectionUI();

            expect(deleteBtn.disabled).toBe(true);
            expect(textSpan.textContent).toBe('Удалить');
        });

        it('should update mobile layout with count in icon', () => {
            mockState.selectedItemIds = new Set([1, 2, 3]);
            const deleteBtn = document.getElementById('delete-selected-btn') as any;
            const iconSpan = { textContent: '🗑️' };
            const textSpan = { textContent: '', classList: { contains: vi.fn(() => true) } };

            deleteBtn.querySelector = vi.fn((selector: string) => {
                if (selector === 'span:first-child') return iconSpan;
                if (selector === 'span:last-child') return textSpan;
                return null;
            });

            updateSelectionUI();

            expect(iconSpan.textContent).toBe('🗑️3');
        });

        it('should update select all button to "deselect all" when all selected', () => {
            mockState.selectedItemIds = new Set([1, 2, 3, 4]);
            const selectAllBtn = document.getElementById('select-all-btn') as any;
            const iconSpan = { textContent: '☑️' };
            const textSpan = { textContent: 'Выделить все' };

            selectAllBtn.querySelector = vi.fn((selector: string) => {
                if (selector === 'span:first-child') return iconSpan;
                if (selector === 'span:last-child') return textSpan;
                return null;
            });

            updateSelectionUI();

            expect(iconSpan.textContent).toBe('☐');
            expect(textSpan.textContent).toBe('Снять выделение');
        });

        it('should update select all button to "select all" when partially selected', () => {
            mockState.selectedItemIds = new Set([1, 2]);
            const selectAllBtn = document.getElementById('select-all-btn') as any;
            const iconSpan = { textContent: '☐' };
            const textSpan = { textContent: 'Снять выделение' };

            selectAllBtn.querySelector = vi.fn((selector: string) => {
                if (selector === 'span:first-child') return iconSpan;
                if (selector === 'span:last-child') return textSpan;
                return null;
            });

            updateSelectionUI();

            expect(iconSpan.textContent).toBe('☑️');
            expect(textSpan.textContent).toBe('Выделить все');
        });

        it('should handle missing delete button gracefully', () => {
            vi.spyOn(document, 'getElementById').mockReturnValue(null);

            // Should not throw
            expect(() => updateSelectionUI()).not.toThrow();
        });

        it('should handle missing select all button gracefully', () => {
            const deleteBtn = document.getElementById('delete-selected-btn');
            vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
                if (id === 'delete-selected-btn') return deleteBtn;
                return null;
            });

            // Should not throw
            expect(() => updateSelectionUI()).not.toThrow();
        });

        it('should handle missing button spans gracefully', () => {
            const deleteBtn = document.getElementById('delete-selected-btn') as any;
            deleteBtn.querySelector = vi.fn(() => null);

            // Should not throw
            expect(() => updateSelectionUI()).not.toThrow();
        });

        it('should reset delete button text when selection cleared', () => {
            mockState.selectedItemIds = new Set([1, 2]);
            const deleteBtn = document.getElementById('delete-selected-btn') as any;
            const textSpan = deleteBtn.querySelector('span:last-child');

            updateSelectionUI();
            expect(textSpan.textContent).toBe('Удалить (2)');

            mockState.selectedItemIds = new Set();
            updateSelectionUI();
            expect(textSpan.textContent).toBe('Удалить');
        });
    });

    describe('integration scenarios', () => {
        it('should handle select all → delete workflow', async () => {
            mockState.selectedItemIds = new Set();
            (global.showConfirmDialog as any).mockResolvedValue(true);
            (global.fetch as any).mockResolvedValue({ ok: true });

            // Select all
            toggleSelectAll();
            expect(mockState.selectedItemIds.size).toBe(4);

            // Delete selected
            await deleteSelected();
            expect(mockState.currentItems).toHaveLength(0);
            expect(mockState.selectedItemIds.size).toBe(0);
        });

        it('should handle select completed → delete workflow', async () => {
            mockState.selectedItemIds = new Set();
            (global.showConfirmDialog as any).mockResolvedValue(true);
            (global.fetch as any).mockResolvedValue({ ok: true });

            // Select completed
            selectCompleted();
            expect(mockState.selectedItemIds.size).toBe(2);
            expect(mockState.selectedItemIds.has(2)).toBe(true);
            expect(mockState.selectedItemIds.has(4)).toBe(true);

            // Delete selected
            await deleteSelected();
            expect(mockState.currentItems).toHaveLength(2);
            expect(mockState.currentItems[0].id).toBe(1);
            expect(mockState.currentItems[1].id).toBe(3);
        });

        it('should update UI after selection changes', () => {
            mockState.selectedItemIds = new Set();
            const deleteBtn = document.getElementById('delete-selected-btn') as any;

            updateSelectionUI();
            expect(deleteBtn.disabled).toBe(true);

            mockState.selectedItemIds.add(1);
            updateSelectionUI();
            expect(deleteBtn.disabled).toBe(false);

            mockState.selectedItemIds = new Set();
            updateSelectionUI();
            expect(deleteBtn.disabled).toBe(true);
        });
    });
});

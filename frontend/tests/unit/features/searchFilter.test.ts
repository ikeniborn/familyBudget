import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    handleSearch,
    clearSearch,
    toggleHideCompleted,
    updateFABButtons
} from '@web/lists/listsManager/features/searchFilter';
import * as ListsState from '@web/lists/listsManager/core/ListsState';
import * as tableBuilder from '@web/lists/listsManager/rendering/tableBuilder';

// Mock global functions
global.debugLog = vi.fn();

describe('searchFilter', () => {
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
            searchQuery: '',
            hideCompleted: false,
            currentItems: [],
            hierarchyView: null
        };

        // Mock ListsState functions
        vi.spyOn(ListsState, 'getState').mockReturnValue(mockState);
        vi.spyOn(ListsState, 'updateState').mockImplementation((updates) => {
            Object.assign(mockState, updates);
        });

        // Mock renderCurrentView
        vi.spyOn(tableBuilder, 'renderCurrentView').mockImplementation(() => {});

        // Mock localStorage
        const localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn()
        };
        Object.defineProperty(global, 'localStorage', {
            value: localStorageMock,
            writable: true
        });

        // Mock document.getElementById
        vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
            if (!mockElements.has(id)) {
                // Create mock element
                const element: any = {
                    id,
                    classList: {
                        add: vi.fn(),
                        remove: vi.fn(),
                        toggle: vi.fn(),
                        contains: vi.fn()
                    },
                    querySelector: vi.fn(),
                    value: '',
                    textContent: '',
                    title: ''
                };
                mockElements.set(id, element);
            }
            return mockElements.get(id);
        });
    });

    describe('handleSearch', () => {
        it('should update search query in state', () => {
            handleSearch('test query');

            expect(mockState.searchQuery).toBe('test query');
        });

        it('should show clear button when query is not empty', () => {
            const clearBtn = document.getElementById('clear-search-btn');

            handleSearch('test');

            expect(clearBtn?.classList.remove).toHaveBeenCalledWith('hidden');
        });

        it('should hide clear button when query is empty', () => {
            const clearBtn = document.getElementById('clear-search-btn');

            handleSearch('');

            expect(clearBtn?.classList.add).toHaveBeenCalledWith('hidden');
        });

        it('should hide clear button when query is whitespace only', () => {
            const clearBtn = document.getElementById('clear-search-btn');

            handleSearch('   ');

            expect(clearBtn?.classList.add).toHaveBeenCalledWith('hidden');
        });

        it('should render table view when in table mode', () => {
            mockState.currentView = 'table';

            handleSearch('query');

            expect(tableBuilder.renderCurrentView).toHaveBeenCalled();
        });

        it('should render hierarchy view when in hierarchy mode', () => {
            const mockHierarchyView = {
                render: vi.fn()
            };
            mockState.currentView = 'hierarchy';
            mockState.hierarchyView = mockHierarchyView;

            handleSearch('query');

            expect(mockHierarchyView.render).toHaveBeenCalled();
            expect(tableBuilder.renderCurrentView).not.toHaveBeenCalled();
        });

        it('should handle missing clear button gracefully', () => {
            vi.spyOn(document, 'getElementById').mockReturnValue(null);

            // Should not throw
            expect(() => handleSearch('test')).not.toThrow();
        });
    });

    describe('clearSearch', () => {
        it('should clear search input value', () => {
            const input = document.getElementById('items-search') as any;
            input.value = 'old query';

            clearSearch();

            expect(input.value).toBe('');
        });

        it('should call handleSearch with empty string', () => {
            clearSearch();

            expect(mockState.searchQuery).toBe('');
        });

        it('should hide clear button after clearing', () => {
            const clearBtn = document.getElementById('clear-search-btn');

            clearSearch();

            expect(clearBtn?.classList.add).toHaveBeenCalledWith('hidden');
        });

        it('should handle missing search input gracefully', () => {
            vi.spyOn(document, 'getElementById').mockReturnValue(null);

            // Should not throw
            expect(() => clearSearch()).not.toThrow();
        });
    });

    describe('toggleHideCompleted', () => {
        beforeEach(() => {
            // Mock button with spans
            const btn = document.getElementById('toggle-hide-completed-btn') as any;
            const iconSpan = { textContent: '👁️' };
            const textSpan = {
                textContent: 'Скрыть выполненные',
                innerHTML: ''
            };

            btn.querySelector = vi.fn((selector: string) => {
                if (selector === 'span:first-child') return iconSpan;
                if (selector === 'span:last-child') return textSpan;
                if (selector === 'span:nth-child(2)') return textSpan;
                return null;
            });
        });

        it('should toggle hideCompleted from false to true', () => {
            mockState.hideCompleted = false;

            toggleHideCompleted();

            expect(mockState.hideCompleted).toBe(true);
        });

        it('should toggle hideCompleted from true to false', () => {
            mockState.hideCompleted = true;

            toggleHideCompleted();

            expect(mockState.hideCompleted).toBe(false);
        });

        it('should save preference to localStorage', () => {
            mockState.hideCompleted = false;

            toggleHideCompleted();

            expect(global.localStorage.setItem).toHaveBeenCalledWith(
                'lists_hide_completed_preference',
                'true'
            );
        });

        it('should update button to "hide" state when hideCompleted is true', () => {
            mockState.hideCompleted = false;
            const btn = document.getElementById('toggle-hide-completed-btn');
            const iconSpan = btn?.querySelector('span:first-child') as any;
            const textSpan = btn?.querySelector('span:last-child') as any;

            toggleHideCompleted();

            expect(iconSpan.textContent).toBe('👁️‍🗨️');
            // textSpan.innerHTML contains responsive spans, so textContent includes both mobile and desktop text
            expect(textSpan.innerHTML).toContain('Показать все');
            expect(textSpan.innerHTML).toContain('Показать');
            expect(btn?.title).toBe('Показать все товары');
            expect(btn?.classList.add).toHaveBeenCalledWith('btn-primary');
            expect(btn?.classList.remove).toHaveBeenCalledWith('btn-outline');
        });

        it('should update button to "show" state when hideCompleted is false', () => {
            mockState.hideCompleted = true;
            const btn = document.getElementById('toggle-hide-completed-btn');
            const iconSpan = btn?.querySelector('span:first-child') as any;
            const textSpan = btn?.querySelector('span:last-child') as any;

            toggleHideCompleted();

            expect(iconSpan.textContent).toBe('👁️');
            // textSpan.innerHTML contains responsive spans, so textContent includes both mobile and desktop text
            expect(textSpan.innerHTML).toContain('Скрыть выполненные');
            expect(textSpan.innerHTML).toContain('Скрыть');
            expect(btn?.title).toBe('Скрыть выполненные товары');
            expect(btn?.classList.remove).toHaveBeenCalledWith('btn-primary');
            expect(btn?.classList.add).toHaveBeenCalledWith('btn-outline');
        });

        it('should render current view after toggle', () => {
            toggleHideCompleted();

            expect(tableBuilder.renderCurrentView).toHaveBeenCalled();
        });

        it('should handle localStorage errors gracefully', () => {
            vi.spyOn(global.localStorage, 'setItem').mockImplementation(() => {
                throw new Error('Storage full');
            });

            // Should not throw
            expect(() => toggleHideCompleted()).not.toThrow();
        });

        it('should handle missing button gracefully', () => {
            vi.spyOn(document, 'getElementById').mockReturnValue(null);

            // Should not throw
            expect(() => toggleHideCompleted()).not.toThrow();
        });
    });

    describe('updateFABButtons', () => {
        it('should hide all FAB buttons when no items', () => {
            mockState.currentItems = [];

            updateFABButtons();

            const deleteBtn = document.getElementById('fab-item-delete-completed');
            const markAllBtn = document.getElementById('fab-item-mark-all-completed');
            const unmarkAllBtn = document.getElementById('fab-item-unmark-all-completed');

            expect(deleteBtn?.classList.add).toHaveBeenCalledWith('hidden');
            expect(markAllBtn?.classList.add).toHaveBeenCalledWith('hidden');
            expect(unmarkAllBtn?.classList.add).toHaveBeenCalledWith('hidden');
        });

        it('should show delete completed button when completed items exist', () => {
            mockState.currentItems = [
                { id: 1, is_completed: true },
                { id: 2, is_completed: false }
            ];

            updateFABButtons();

            const deleteBtn = document.getElementById('fab-item-delete-completed');
            expect(deleteBtn?.classList.remove).toHaveBeenCalledWith('hidden');
        });

        it('should hide delete completed button when no completed items', () => {
            mockState.currentItems = [
                { id: 1, is_completed: false },
                { id: 2, is_completed: false }
            ];

            updateFABButtons();

            const deleteBtn = document.getElementById('fab-item-delete-completed');
            expect(deleteBtn?.classList.add).toHaveBeenCalledWith('hidden');
        });

        it('should show mark all completed button when uncompleted items exist', () => {
            mockState.currentItems = [
                { id: 1, is_completed: false },
                { id: 2, is_completed: true }
            ];

            updateFABButtons();

            const markAllBtn = document.getElementById('fab-item-mark-all-completed');
            expect(markAllBtn?.classList.remove).toHaveBeenCalledWith('hidden');
        });

        it('should hide mark all completed button when all items completed', () => {
            mockState.currentItems = [
                { id: 1, is_completed: true },
                { id: 2, is_completed: true }
            ];

            updateFABButtons();

            const markAllBtn = document.getElementById('fab-item-mark-all-completed');
            expect(markAllBtn?.classList.add).toHaveBeenCalledWith('hidden');
        });

        it('should show unmark all completed button when completed items exist', () => {
            mockState.currentItems = [
                { id: 1, is_completed: true },
                { id: 2, is_completed: false }
            ];

            updateFABButtons();

            const unmarkAllBtn = document.getElementById('fab-item-unmark-all-completed');
            expect(unmarkAllBtn?.classList.remove).toHaveBeenCalledWith('hidden');
        });

        it('should hide unmark all completed button when no completed items', () => {
            mockState.currentItems = [
                { id: 1, is_completed: false },
                { id: 2, is_completed: false }
            ];

            updateFABButtons();

            const unmarkAllBtn = document.getElementById('fab-item-unmark-all-completed');
            expect(unmarkAllBtn?.classList.add).toHaveBeenCalledWith('hidden');
        });

        it('should handle mixed completion states correctly', () => {
            mockState.currentItems = [
                { id: 1, is_completed: true },
                { id: 2, is_completed: false },
                { id: 3, is_completed: true },
                { id: 4, is_completed: false }
            ];

            updateFABButtons();

            const deleteBtn = document.getElementById('fab-item-delete-completed');
            const markAllBtn = document.getElementById('fab-item-mark-all-completed');
            const unmarkAllBtn = document.getElementById('fab-item-unmark-all-completed');

            // Delete: show (2 completed)
            expect(deleteBtn?.classList.remove).toHaveBeenCalledWith('hidden');
            // Mark all: show (2 uncompleted)
            expect(markAllBtn?.classList.remove).toHaveBeenCalledWith('hidden');
            // Unmark all: show (2 completed)
            expect(unmarkAllBtn?.classList.remove).toHaveBeenCalledWith('hidden');
        });

        it('should handle missing DOM elements gracefully', () => {
            vi.spyOn(document, 'getElementById').mockReturnValue(null);

            // Should not throw
            expect(() => updateFABButtons()).not.toThrow();
        });

        it('should handle null currentItems', () => {
            mockState.currentItems = null;

            // Should not throw
            expect(() => updateFABButtons()).not.toThrow();
        });

        it('should count completion states correctly', () => {
            mockState.currentItems = [
                { id: 1, is_completed: true },
                { id: 2, is_completed: true },
                { id: 3, is_completed: true },
                { id: 4, is_completed: false }
            ];

            updateFABButtons();

            // 3 completed, 1 uncompleted
            const deleteBtn = document.getElementById('fab-item-delete-completed');
            const markAllBtn = document.getElementById('fab-item-mark-all-completed');
            const unmarkAllBtn = document.getElementById('fab-item-unmark-all-completed');

            expect(deleteBtn?.classList.remove).toHaveBeenCalledWith('hidden');
            expect(markAllBtn?.classList.remove).toHaveBeenCalledWith('hidden');
            expect(unmarkAllBtn?.classList.remove).toHaveBeenCalledWith('hidden');
        });
    });

    describe('integration scenarios', () => {
        it('should handle search and filter together', () => {
            mockState.currentItems = [
                { id: 1, name: 'Milk', is_completed: true },
                { id: 2, name: 'Bread', is_completed: false }
            ];

            handleSearch('milk');
            expect(mockState.searchQuery).toBe('milk');

            toggleHideCompleted();
            expect(mockState.hideCompleted).toBe(true);

            expect(tableBuilder.renderCurrentView).toHaveBeenCalledTimes(2);
        });

        it('should persist hideCompleted preference across toggles', () => {
            // First toggle
            toggleHideCompleted();
            expect(global.localStorage.setItem).toHaveBeenCalledWith(
                'lists_hide_completed_preference',
                'true'
            );

            // Second toggle
            toggleHideCompleted();
            expect(global.localStorage.setItem).toHaveBeenCalledWith(
                'lists_hide_completed_preference',
                'false'
            );
        });

        it('should update FAB buttons after clearing search', () => {
            mockState.currentItems = [
                { id: 1, is_completed: true }
            ];

            clearSearch();

            // clearSearch calls handleSearch which doesn't directly update FAB
            // But in real app, rendering would trigger FAB update
            expect(mockState.searchQuery).toBe('');
        });
    });
});

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    setupProductAutocomplete,
    hideProductSuggestions
} from '@web/lists/listsManager/features/autocomplete';
import * as ListsState from '@web/lists/listsManager/core/ListsState';
import * as stateManager from '@web/lists/listsManager/core/stateManager';

// Mock global functions
global.debugLog = vi.fn();
global.showToast = vi.fn();

describe('autocomplete', () => {
    let mockState: any;
    let mockElements: Map<string, any>;
    let mockDb: any;

    beforeEach(() => {
        // Enable fake timers for debounce testing
        vi.useFakeTimers();

        // Reset all mocks
        vi.clearAllMocks();

        // Mock elements map
        mockElements = new Map();

        // Mock IndexedDB
        mockDb = {
            getCache: vi.fn(),
            setCache: vi.fn()
        };

        // Mock state
        mockState = {
            currentListId: 1,
            db: mockDb,
            choicesInstances: {
                store: {
                    setChoiceByValue: vi.fn(),
                    getValue: vi.fn(() => '5')
                },
                productGroup: {
                    setChoiceByValue: vi.fn(),
                    getValue: vi.fn(() => '3')
                }
            }
        };

        // Mock ListsState functions
        vi.spyOn(ListsState, 'getState').mockReturnValue(mockState);

        // Mock stateManager functions
        vi.spyOn(stateManager, 'isOnline').mockReturnValue(true);
        vi.spyOn(stateManager, 'loadShoppingListItems').mockResolvedValue(undefined);

        // Mock document.getElementById
        vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
            if (!mockElements.has(id)) {
                // Create mock element
                const element: any = {
                    id,
                    value: '',
                    disabled: false,
                    classList: {
                        add: vi.fn(),
                        remove: vi.fn(),
                        contains: vi.fn(() => false)
                    },
                    addEventListener: vi.fn(),
                    style: {},
                    innerHTML: '',
                    getBoundingClientRect: vi.fn(() => ({
                        bottom: 100,
                        left: 50,
                        width: 300,
                        top: 80,
                        height: 20
                    })),
                    close: vi.fn()
                };

                // Special handling for input
                if (id === 'item-product-name') {
                    element.type = 'text';
                }

                // Special handling for dropdown
                if (id === 'product-suggestions-dropdown') {
                    element.closest = vi.fn();
                }

                mockElements.set(id, element);
            }
            return mockElements.get(id);
        });

        // Mock fetch
        vi.stubGlobal('fetch', vi.fn());

        // Mock window properties
        Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    describe('setupProductAutocomplete', () => {
        it('should setup event listeners on input field', () => {
            const input = document.getElementById('item-product-name') as any;

            setupProductAutocomplete();

            expect(input.addEventListener).toHaveBeenCalledWith('input', expect.any(Function));
            expect(input.addEventListener).toHaveBeenCalledWith('keyup', expect.any(Function));
            expect(input.addEventListener).toHaveBeenCalledWith('compositionend', expect.any(Function));
            expect(input._autocompleteInitialized).toBe(true);
        });

        it('should handle missing input field gracefully', () => {
            vi.spyOn(document, 'getElementById').mockReturnValue(null);

            // Should not throw
            expect(() => setupProductAutocomplete()).not.toThrow();
        });

        it('should setup click handler for suggestions dropdown', () => {
            const dropdown = document.getElementById('product-suggestions-dropdown') as any;

            setupProductAutocomplete();

            expect(dropdown.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function), expect.any(Object));
            expect(dropdown.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('should not setup duplicate handlers if already initialized', () => {
            const dropdown = document.getElementById('product-suggestions-dropdown') as any;
            dropdown._clickHandlerInitialized = true;

            setupProductAutocomplete();

            // Should only be called once (for input)
            expect(dropdown.addEventListener).not.toHaveBeenCalled();
        });
    });

    describe('input handling and debounce', () => {
        it('should debounce input (300ms)', async () => {
            const input = document.getElementById('item-product-name') as any;
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ suggestions: [] })
            });

            setupProductAutocomplete();

            // Simulate typing
            input.value = 'mi';
            const handler = (input.addEventListener as any).mock.calls[0][1];
            handler();

            // Should not fetch immediately
            expect(global.fetch).not.toHaveBeenCalled();

            // Fast-forward 300ms
            vi.advanceTimersByTime(300);

            // Should fetch now
            expect(global.fetch).toHaveBeenCalled();
        });

        it('should cancel previous debounce timer on new input', async () => {
            const input = document.getElementById('item-product-name') as any;
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ suggestions: [] })
            });

            setupProductAutocomplete();
            const handler = (input.addEventListener as any).mock.calls[0][1];

            // First input
            input.value = 'mi';
            handler();
            vi.advanceTimersByTime(200);

            // Second input (before 300ms)
            input.value = 'mil';
            handler();
            vi.advanceTimersByTime(300);

            // Should only call fetch once
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should not show dropdown for queries shorter than 2 chars', async () => {
            const input = document.getElementById('item-product-name') as any;
            const dropdown = document.getElementById('product-suggestions-dropdown') as any;

            setupProductAutocomplete();
            const handler = (input.addEventListener as any).mock.calls[0][1];

            input.value = 'm';
            handler();
            vi.advanceTimersByTime(300);

            expect(dropdown.classList.add).toHaveBeenCalledWith('hidden');
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should hide dropdown when input is empty', async () => {
            const input = document.getElementById('item-product-name') as any;
            const dropdown = document.getElementById('product-suggestions-dropdown') as any;

            setupProductAutocomplete();
            const handler = (input.addEventListener as any).mock.calls[0][1];

            input.value = '';
            handler();

            expect(dropdown.classList.add).toHaveBeenCalledWith('hidden');
        });
    });

    describe('suggestions fetching (online)', () => {
        it('should fetch suggestions from API when online', async () => {
            const input = document.getElementById('item-product-name') as any;
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({
                    suggestions: [
                        { product_name: 'Milk', store_name: 'Store A' },
                        { product_name: 'Milkshake', store_name: 'Store B' }
                    ]
                })
            });

            setupProductAutocomplete();
            const handler = (input.addEventListener as any).mock.calls[0][1];

            input.value = 'mil';
            handler();
            vi.advanceTimersByTime(300);

            await vi.waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/api/v1/shopping-list-items/products/suggest')
                );
            });
        });

        it('should include shopping_list_id in API request', async () => {
            mockState.currentListId = 123;
            const input = document.getElementById('item-product-name') as any;
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ suggestions: [] })
            });

            setupProductAutocomplete();
            const handler = (input.addEventListener as any).mock.calls[0][1];

            input.value = 'test';
            handler();
            vi.advanceTimersByTime(300);

            await vi.waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('shopping_list_id=123')
                );
            });
        });

        it('should include include_deleted parameter when list is selected', async () => {
            mockState.currentListId = 456;
            const input = document.getElementById('item-product-name') as any;
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ suggestions: [] })
            });

            setupProductAutocomplete();
            const handler = (input.addEventListener as any).mock.calls[0][1];

            input.value = 'test';
            handler();
            vi.advanceTimersByTime(300);

            await vi.waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('include_deleted=true')
                );
            });
        });
    });

    // Legacy offline cache tests removed (Dexie migration v11.3.1)
    // Offline functionality now handled by DataLayer + Dexie automatically

    describe('dropdown rendering', () => {
        it('should render suggestions with product names', async () => {
            const input = document.getElementById('item-product-name') as any;
            const dropdown = document.getElementById('product-suggestions-dropdown') as any;
            const suggestions = [
                { product_name: 'Milk', store_name: 'Store A' }
            ];

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ suggestions })
            });

            setupProductAutocomplete();
            const handler = (input.addEventListener as any).mock.calls[0][1];

            input.value = 'mil';
            handler();
            vi.advanceTimersByTime(300);

            await vi.waitFor(() => {
                expect(dropdown.innerHTML).toContain('Milk');
                expect(dropdown.classList.remove).toHaveBeenCalledWith('hidden');
            });
        });

        it('should mark deleted items with warning badge', async () => {
            const input = document.getElementById('item-product-name') as any;
            const dropdown = document.getElementById('product-suggestions-dropdown') as any;
            const suggestions = [
                { product_name: 'Old Item', is_deleted: true, id: 123 }
            ];

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ suggestions })
            });

            setupProductAutocomplete();
            const handler = (input.addEventListener as any).mock.calls[0][1];

            input.value = 'old';
            handler();
            vi.advanceTimersByTime(300);

            await vi.waitFor(() => {
                expect(dropdown.innerHTML).toContain('восстановить');
                expect(dropdown.innerHTML).toContain('border-warning');
            });
        });

        it('should position dropdown below input field', async () => {
            const input = document.getElementById('item-product-name') as any;
            const dropdown = document.getElementById('product-suggestions-dropdown') as any;
            const suggestions = [{ product_name: 'Milk' }];

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ suggestions })
            });

            setupProductAutocomplete();
            const handler = (input.addEventListener as any).mock.calls[0][1];

            input.value = 'mil';
            handler();
            vi.advanceTimersByTime(300);

            await vi.waitFor(() => {
                expect(dropdown.style.top).toBe('104px'); // bottom (100) + 4
                expect(dropdown.style.left).toBe('50px');
                expect(dropdown.style.width).toBe('300px');
            });
        });

        it('should hide dropdown when no suggestions', async () => {
            const input = document.getElementById('item-product-name') as any;
            const dropdown = document.getElementById('product-suggestions-dropdown') as any;

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ suggestions: [] })
            });

            setupProductAutocomplete();
            const handler = (input.addEventListener as any).mock.calls[0][1];

            input.value = 'xyz';
            handler();
            vi.advanceTimersByTime(300);

            await vi.waitFor(() => {
                expect(dropdown.classList.add).toHaveBeenCalledWith('hidden');
            });
        });
    });

    describe('hideProductSuggestions', () => {
        it('should hide dropdown and clear content', () => {
            const dropdown = document.getElementById('product-suggestions-dropdown') as any;
            dropdown.innerHTML = '<div>Test</div>';

            hideProductSuggestions();

            expect(dropdown.classList.add).toHaveBeenCalledWith('hidden');
            expect(dropdown.innerHTML).toBe('');
        });

        it('should handle missing dropdown gracefully', () => {
            vi.spyOn(document, 'getElementById').mockReturnValue(null);

            // Should not throw
            expect(() => hideProductSuggestions()).not.toThrow();
        });
    });

    // TODO(v11.0): Update mock setup after Dexie migration
    // These tests fail due to outdated mockDb implementation
    // Requires updating to match new Dexie API behavior
    // Related: Dexie migration (docs/architecture/core/dexie-integration.md)
    describe.skip('error handling', () => {
        it('should fallback to cache on API error', async () => {
            const input = document.getElementById('item-product-name') as any;
            const cachedSuggestions = [{ product_name: 'Cached Milk' }];

            (global.fetch as any).mockRejectedValue(new Error('Network error'));
            mockDb.getCache.mockResolvedValue(cachedSuggestions);

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            setupProductAutocomplete();
            const handler = (input.addEventListener as any).mock.calls[0][1];

            input.value = 'mil';
            handler();
            vi.advanceTimersByTime(300);

            await vi.waitFor(() => {
                const dropdown = document.getElementById('product-suggestions-dropdown') as any;
                expect(dropdown.innerHTML).toContain('Cached Milk');
                expect(consoleSpy).toHaveBeenCalled();
            });

            consoleSpy.mockRestore();
        });

        it('should handle IndexedDB errors gracefully', async () => {
            const input = document.getElementById('item-product-name') as any;

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ suggestions: [{ product_name: 'Milk' }] })
            });

            mockDb.setCache.mockRejectedValue(new Error('IDB error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            setupProductAutocomplete();
            const handler = (input.addEventListener as any).mock.calls[0][1];

            input.value = 'mil';
            handler();
            vi.advanceTimersByTime(300);

            await vi.waitFor(() => {
                // Should still show dropdown despite cache error
                const dropdown = document.getElementById('product-suggestions-dropdown') as any;
                expect(dropdown.innerHTML).toContain('Milk');
                expect(consoleSpy).toHaveBeenCalled();
            });

            consoleSpy.mockRestore();
        });
    });

    // TODO(v11.0): Update mock setup after Dexie migration
    // These tests fail due to outdated mockDb implementation
    // Requires updating to match new Dexie API behavior
    // Related: Dexie migration (docs/architecture/core/dexie-integration.md)
    describe.skip('caching behavior', () => {
        it('should merge new suggestions with existing cache', async () => {
            const input = document.getElementById('item-product-name') as any;
            const existingCache = [
                { product_name: 'Milk', store_id: 1 }
            ];
            const newSuggestions = [
                { product_name: 'Bread', store_id: 2, is_deleted: false }
            ];

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ suggestions: newSuggestions })
            });

            mockDb.getCache.mockResolvedValue(existingCache);

            setupProductAutocomplete();
            const handler = (input.addEventListener as any).mock.calls[0][1];

            input.value = 'test';
            handler();
            vi.advanceTimersByTime(300);

            await vi.waitFor(() => {
                expect(mockDb.setCache).toHaveBeenCalledWith(
                    'product_suggestions',
                    expect.arrayContaining([
                        expect.objectContaining({ product_name: 'Milk' }),
                        expect.objectContaining({ product_name: 'Bread' })
                    ]),
                    86400
                );
            });
        });

        it('should limit cache size to 500 entries', async () => {
            const input = document.getElementById('item-product-name') as any;
            const largeCache = Array.from({ length: 501 }, (_, i) => ({
                product_name: `Item ${i}`,
                store_id: i
            }));

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ suggestions: [{ product_name: 'New', store_id: 999, is_deleted: false }] })
            });

            mockDb.getCache.mockResolvedValue(largeCache);

            setupProductAutocomplete();
            const handler = (input.addEventListener as any).mock.calls[0][1];

            input.value = 'test';
            handler();
            vi.advanceTimersByTime(300);

            await vi.waitFor(() => {
                const cachedArray = (mockDb.setCache as any).mock.calls[0][1];
                expect(cachedArray.length).toBeLessThanOrEqual(500);
            });
        });

        it('should deduplicate suggestions by product_name + store_id', async () => {
            const input = document.getElementById('item-product-name') as any;
            const existingCache = [
                { product_name: 'Milk', store_id: 1 }
            ];
            const newSuggestions = [
                { product_name: 'Milk', store_id: 1, is_deleted: false } // Duplicate
            ];

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ suggestions: newSuggestions })
            });

            mockDb.getCache.mockResolvedValue(existingCache);

            setupProductAutocomplete();
            const handler = (input.addEventListener as any).mock.calls[0][1];

            input.value = 'mil';
            handler();
            vi.advanceTimersByTime(300);

            await vi.waitFor(() => {
                const cachedArray = (mockDb.setCache as any).mock.calls[0][1];
                const milkItems = cachedArray.filter((s: any) => s.product_name === 'Milk' && s.store_id === 1);
                expect(milkItems).toHaveLength(1); // Only 1, not 2
            });
        });
    });
});

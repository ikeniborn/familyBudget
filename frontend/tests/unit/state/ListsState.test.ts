import { describe, it, expect, beforeEach } from 'vitest';
import { getState, updateState, resetState } from '@web/lists/listsManager/core/ListsState';
import type { ListsState } from '@web/lists/listsManager/core/ListsState';

describe('ListsState', () => {
  beforeEach(() => {
    resetState();
  });

  describe('initialization', () => {
    it('should create initial state with correct defaults', () => {
      const state = getState();

      // Current context
      expect(state.currentListId).toBeNull();
      expect(state.currentView).toBe('table');

      // Data
      expect(state.shoppingLists).toEqual([]);
      expect(state.currentItems).toEqual([]);
      expect(state.stores).toEqual([]);
      expect(state.productGroups).toEqual([]);

      // UI state
      expect(state.selectedItemIds).toBeInstanceOf(Set);
      expect(state.selectedItemIds.size).toBe(0);
      expect(state.searchQuery).toBe('');
      expect(state.hideCompleted).toBe(false);

      // Autocomplete
      expect(state.currentSuggestions).toEqual([]);
      expect(state.currentDuplicateItem).toBeNull();

      // Choices.js instances
      expect(state.choicesInstances).toEqual({});

      // Instances
      expect(state.hierarchyView).toBeNull();

      // Debounced functions
      expect(state.debouncedSearch).toBeNull();
      expect(state.quantityChangeHandler).toBeNull();
      expect(state.handleUnitChange).toBeNull();

      // Timers
      expect(state.autocompleteTimer).toBeNull();
    });
  });

  describe('updateState', () => {
    it('should update state partially', () => {
      updateState({ searchQuery: 'test' });

      const state = getState();
      expect(state.searchQuery).toBe('test');
      expect(state.shoppingLists).toEqual([]);  // Other fields unchanged
    });

    it('should handle multiple updates', () => {
      updateState({ searchQuery: 'test' });
      updateState({ hideCompleted: true });

      const state = getState();
      expect(state.searchQuery).toBe('test');
      expect(state.hideCompleted).toBe(true);
    });

    it('should update currentListId', () => {
      updateState({ currentListId: 42 });

      const state = getState();
      expect(state.currentListId).toBe(42);
    });

    it('should update currentView', () => {
      updateState({ currentView: 'hierarchy' });

      const state = getState();
      expect(state.currentView).toBe('hierarchy');
    });

    it('should update shoppingLists', () => {
      const testLists = [
        { id: 1, name: 'Groceries', is_active: true, created_at: '2025-01-01', updated_at: '2025-01-01' },
        { id: 2, name: 'Hardware', is_active: true, created_at: '2025-01-02', updated_at: '2025-01-02' }
      ];

      updateState({ shoppingLists: testLists });

      const state = getState();
      expect(state.shoppingLists).toEqual(testLists);
      expect(state.shoppingLists).toHaveLength(2);
    });

    it('should update currentItems', () => {
      const testItems = [
        { id: 1, list_id: 1, name: 'Milk', quantity: 2, unit: 'л', is_completed: false, store_id: null, product_group_id: null, notes: null },
        { id: 2, list_id: 1, name: 'Bread', quantity: 1, unit: 'шт', is_completed: false, store_id: null, product_group_id: null, notes: null }
      ];

      updateState({ currentItems: testItems });

      const state = getState();
      expect(state.currentItems).toEqual(testItems);
      expect(state.currentItems).toHaveLength(2);
    });

    it('should update selectedItemIds Set', () => {
      const selectedIds = new Set([1, 2, 3]);

      updateState({ selectedItemIds: selectedIds });

      const state = getState();
      expect(state.selectedItemIds).toEqual(selectedIds);
      expect(state.selectedItemIds.size).toBe(3);
      expect(state.selectedItemIds.has(1)).toBe(true);
      expect(state.selectedItemIds.has(2)).toBe(true);
      expect(state.selectedItemIds.has(3)).toBe(true);
    });

    it('should preserve other fields when updating one field', () => {
      // Set up initial data
      updateState({
        currentListId: 10,
        searchQuery: 'initial',
        hideCompleted: true,
        shoppingLists: [{ id: 1, name: 'Test', is_active: true, created_at: '2025-01-01', updated_at: '2025-01-01' }]
      });

      // Update only searchQuery
      updateState({ searchQuery: 'updated' });

      const state = getState();
      expect(state.searchQuery).toBe('updated');
      // Verify other fields are preserved
      expect(state.currentListId).toBe(10);
      expect(state.hideCompleted).toBe(true);
      expect(state.shoppingLists).toHaveLength(1);
    });
  });

  describe('resetState', () => {
    it('should reset to initial state', () => {
      // Modify state
      updateState({
        searchQuery: 'test',
        hideCompleted: true,
        currentListId: 42,
        selectedItemIds: new Set([1, 2, 3])
      });

      // Reset
      resetState();

      const state = getState();
      expect(state.searchQuery).toBe('');
      expect(state.hideCompleted).toBe(false);
      expect(state.currentListId).toBeNull();
      expect(state.selectedItemIds.size).toBe(0);
    });

    it('should clear all arrays', () => {
      updateState({
        shoppingLists: [{ id: 1, name: 'Test', is_active: true, created_at: '2025-01-01', updated_at: '2025-01-01' }],
        currentItems: [{ id: 1, list_id: 1, name: 'Milk', quantity: 1, unit: 'л', is_completed: false, store_id: null, product_group_id: null, notes: null }]
      });

      resetState();

      const state = getState();
      expect(state.shoppingLists).toEqual([]);
      expect(state.currentItems).toEqual([]);
      expect(state.stores).toEqual([]);
      expect(state.productGroups).toEqual([]);
    });

    it('should reset all object/instance fields to null or empty', () => {
      // Set some non-default values
      updateState({
        hierarchyView: { someProperty: 'value' } as any,
        debouncedSearch: (() => {}) as any,
        choicesInstances: { someKey: 'someValue' }
      });

      resetState();

      const state = getState();
      expect(state.hierarchyView).toBeNull();
      expect(state.debouncedSearch).toBeNull();
      expect(state.choicesInstances).toEqual({});
    });
  });

  describe('singleton behavior', () => {
    it('should reflect updates immediately in subsequent getState calls', () => {
      updateState({ searchQuery: 'first' });
      let state = getState();
      expect(state.searchQuery).toBe('first');

      updateState({ searchQuery: 'second' });
      state = getState();
      expect(state.searchQuery).toBe('second');
    });

    it('should maintain state consistency across multiple getState calls', () => {
      updateState({ currentListId: 42, searchQuery: 'test' });

      const state1 = getState();
      const state2 = getState();

      // Both should have the same values (even if different readonly wrappers)
      expect(state1.currentListId).toBe(42);
      expect(state2.currentListId).toBe(42);
      expect(state1.searchQuery).toBe('test');
      expect(state2.searchQuery).toBe('test');
    });
  });
});

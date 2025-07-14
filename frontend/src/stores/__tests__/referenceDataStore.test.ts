import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { act } from '@testing-library/react';
import {
  createReferenceDataStore,
  usePeriodStore,
  useFinancialCenterStore,
  useCostCenterStore,
  useNomenclatureStore,
  useProductStore,
  UndoRedoState,
  StoreState
} from '../referenceDataStore';
import { Period } from '../../services/referenceDataService';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Mock BroadcastChannel
class BroadcastChannelMock {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  
  constructor(name: string) {
    this.name = name;
  }
  
  postMessage = jest.fn();
  close = jest.fn();
  
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  dispatchEvent = jest.fn();
}

global.BroadcastChannel = BroadcastChannelMock as any;

describe('ReferenceDataStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    
    // Reset stores
    act(() => {
      usePeriodStore.setState({
        items: [],
        selectedIds: [],
        sortBy: null,
        sortOrder: 'asc',
        filter: {},
        loading: false,
        error: null,
        history: [],
        currentHistoryIndex: -1,
        isDirty: false,
        conflicts: []
      });
    });
  });

  describe('createReferenceDataStore', () => {
    it('should create a store with initial state', () => {
      const store = createReferenceDataStore<Period>('test', 'period_id');
      const state = store.getState();
      
      expect(state.items).toEqual([]);
      expect(state.selectedIds).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
      expect(state.history).toEqual([]);
      expect(state.currentHistoryIndex).toBe(-1);
    });

    it('should persist state to localStorage when enabled', () => {
      const store = createReferenceDataStore<Period>(
        'test',
        'period_id',
        { persist: true }
      );
      
      act(() => {
        store.getState().setItems([{ period_id: 1 } as Period]);
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'reference_data_test',
        expect.any(String)
      );
    });

    it('should restore state from localStorage', () => {
      const storedData = {
        items: [{ period_id: 1 } as Period],
        selectedIds: [1]
      };
      
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(storedData));
      
      const store = createReferenceDataStore<Period>(
        'test',
        'period_id',
        { persist: true }
      );
      
      const state = store.getState();
      expect(state.items).toEqual(storedData.items);
      expect(state.selectedIds).toEqual(storedData.selectedIds);
    });
  });

  describe('Store actions', () => {
    describe('setItems', () => {
      it('should set items and clear selection', () => {
        const store = usePeriodStore;
        const items: Period[] = [
          { period_id: 1, period_name: 'Jan 2024' } as Period,
          { period_id: 2, period_name: 'Feb 2024' } as Period
        ];
        
        act(() => {
          store.getState().setSelectedIds([1]);
          store.getState().setItems(items);
        });
        
        expect(store.getState().items).toEqual(items);
        expect(store.getState().selectedIds).toEqual([]);
      });
    });

    describe('addItem', () => {
      it('should add item and record history', () => {
        const store = usePeriodStore;
        const item: Period = { period_id: 1, period_name: 'Jan 2024' } as Period;
        
        act(() => {
          store.getState().addItem(item);
        });
        
        const state = store.getState();
        expect(state.items).toContainEqual(item);
        expect(state.history).toHaveLength(1);
        expect(state.history[0].action).toBe('add');
        expect(state.history[0].item).toEqual(item);
        expect(state.isDirty).toBe(true);
      });
    });

    describe('updateItem', () => {
      it('should update existing item and record history', () => {
        const store = usePeriodStore;
        const item: Period = { period_id: 1, period_name: 'Jan 2024' } as Period;
        
        act(() => {
          store.getState().setItems([item]);
          store.getState().updateItem(1, { period_name: 'January 2024' });
        });
        
        const state = store.getState();
        expect(state.items[0].period_name).toBe('January 2024');
        expect(state.history).toHaveLength(1);
        expect(state.history[0].action).toBe('update');
        expect(state.history[0].previousItem).toEqual(item);
        expect(state.isDirty).toBe(true);
      });

      it('should handle optimistic updates', () => {
        const store = usePeriodStore;
        const item: Period = { period_id: 1, period_name: 'Jan 2024' } as Period;
        
        act(() => {
          store.getState().setItems([item]);
          store.getState().updateItem(1, { period_name: 'January 2024' }, true);
        });
        
        const state = store.getState();
        expect(state.items[0].period_name).toBe('January 2024');
        expect(state.items[0]._optimistic).toBe(true);
      });
    });

    describe('deleteItem', () => {
      it('should mark item as deleted and record history', () => {
        const store = usePeriodStore;
        const item: Period = { period_id: 1, period_name: 'Jan 2024', is_active: true } as Period;
        
        act(() => {
          store.getState().setItems([item]);
          store.getState().deleteItem(1);
        });
        
        const state = store.getState();
        expect(state.items[0].is_active).toBe(false);
        expect(state.items[0]._deleted).toBe(true);
        expect(state.history).toHaveLength(1);
        expect(state.history[0].action).toBe('delete');
        expect(state.isDirty).toBe(true);
      });
    });

    describe('Undo/Redo functionality', () => {
      it('should undo add action', () => {
        const store = usePeriodStore;
        const item: Period = { period_id: 1, period_name: 'Jan 2024' } as Period;
        
        act(() => {
          store.getState().addItem(item);
          store.getState().undo();
        });
        
        const state = store.getState();
        expect(state.items).toHaveLength(0);
        expect(state.currentHistoryIndex).toBe(-1);
        expect(state.canUndo()).toBe(false);
        expect(state.canRedo()).toBe(true);
      });

      it('should undo update action', () => {
        const store = usePeriodStore;
        const item: Period = { period_id: 1, period_name: 'Jan 2024' } as Period;
        
        act(() => {
          store.getState().setItems([item]);
          store.getState().clearHistory(); // Clear history from setItems
          store.getState().updateItem(1, { period_name: 'January 2024' });
          store.getState().undo();
        });
        
        const state = store.getState();
        expect(state.items[0].period_name).toBe('Jan 2024');
      });

      it('should redo undone action', () => {
        const store = usePeriodStore;
        const item: Period = { period_id: 1, period_name: 'Jan 2024' } as Period;
        
        act(() => {
          store.getState().addItem(item);
          store.getState().undo();
          store.getState().redo();
        });
        
        const state = store.getState();
        expect(state.items).toHaveLength(1);
        expect(state.items[0]).toEqual(item);
        expect(state.canRedo()).toBe(false);
      });

      it('should limit history size', () => {
        const store = usePeriodStore;
        
        act(() => {
          // Add more than MAX_HISTORY_SIZE (50) items
          for (let i = 1; i <= 55; i++) {
            store.getState().addItem({ period_id: i } as Period);
          }
        });
        
        const state = store.getState();
        expect(state.history).toHaveLength(50);
        expect(state.history[0].item.period_id).toBe(6); // First 5 items removed
      });
    });

    describe('Selection management', () => {
      it('should toggle single selection', () => {
        const store = usePeriodStore;
        
        act(() => {
          store.getState().setItems([
            { period_id: 1 } as Period,
            { period_id: 2 } as Period
          ]);
          store.getState().toggleSelection(1);
        });
        
        expect(store.getState().selectedIds).toEqual([1]);
        
        act(() => {
          store.getState().toggleSelection(1);
        });
        
        expect(store.getState().selectedIds).toEqual([]);
      });

      it('should select all items', () => {
        const store = usePeriodStore;
        
        act(() => {
          store.getState().setItems([
            { period_id: 1 } as Period,
            { period_id: 2 } as Period,
            { period_id: 3 } as Period
          ]);
          store.getState().selectAll();
        });
        
        expect(store.getState().selectedIds).toEqual([1, 2, 3]);
      });

      it('should clear selection', () => {
        const store = usePeriodStore;
        
        act(() => {
          store.getState().setSelectedIds([1, 2, 3]);
          store.getState().clearSelection();
        });
        
        expect(store.getState().selectedIds).toEqual([]);
      });
    });

    describe('Sorting', () => {
      it('should sort items by field', () => {
        const store = usePeriodStore;
        
        act(() => {
          store.getState().setItems([
            { period_id: 1, period_name: 'Feb 2024' } as Period,
            { period_id: 2, period_name: 'Jan 2024' } as Period,
            { period_id: 3, period_name: 'Mar 2024' } as Period
          ]);
          store.getState().setSortBy('period_name');
        });
        
        const state = store.getState();
        expect(state.sortBy).toBe('period_name');
        expect(state.getSortedItems()[0].period_name).toBe('Feb 2024');
      });

      it('should toggle sort order', () => {
        const store = usePeriodStore;
        
        act(() => {
          store.getState().setItems([
            { period_id: 1, period_name: 'A' } as Period,
            { period_id: 2, period_name: 'B' } as Period
          ]);
          store.getState().setSortBy('period_name');
          store.getState().setSortBy('period_name'); // Toggle order
        });
        
        const state = store.getState();
        expect(state.sortOrder).toBe('desc');
        expect(state.getSortedItems()[0].period_name).toBe('B');
      });
    });

    describe('Filtering', () => {
      it('should filter items', () => {
        const store = usePeriodStore;
        
        act(() => {
          store.getState().setItems([
            { period_id: 1, period_name: 'Jan 2024', is_active: true } as Period,
            { period_id: 2, period_name: 'Feb 2024', is_active: false } as Period,
            { period_id: 3, period_name: 'Mar 2024', is_active: true } as Period
          ]);
          store.getState().setFilter({ is_active: true });
        });
        
        const filteredItems = store.getState().getFilteredItems();
        expect(filteredItems).toHaveLength(2);
        expect(filteredItems.every(item => item.is_active)).toBe(true);
      });

      it('should apply multiple filters', () => {
        const store = usePeriodStore;
        
        act(() => {
          store.getState().setItems([
            { period_id: 1, period_year: 2024, period_month: 1 } as Period,
            { period_id: 2, period_year: 2024, period_month: 2 } as Period,
            { period_id: 3, period_year: 2023, period_month: 1 } as Period
          ]);
          store.getState().setFilter({ period_year: 2024, period_month: 1 });
        });
        
        const filteredItems = store.getState().getFilteredItems();
        expect(filteredItems).toHaveLength(1);
        expect(filteredItems[0].period_id).toBe(1);
      });
    });

    describe('Conflict resolution', () => {
      it('should detect conflicts', () => {
        const store = usePeriodStore;
        const localItem: Period = { 
          period_id: 1, 
          period_name: 'Local Version',
          updated_at: '2024-01-01T10:00:00Z'
        } as Period;
        
        const remoteItem: Period = { 
          period_id: 1, 
          period_name: 'Remote Version',
          updated_at: '2024-01-01T11:00:00Z'
        } as Period;
        
        act(() => {
          store.getState().setItems([localItem]);
          const conflict = store.getState().checkForConflicts([remoteItem])[0];
          
          expect(conflict).toBeDefined();
          expect(conflict.localItem).toEqual(localItem);
          expect(conflict.remoteItem).toEqual(remoteItem);
          expect(conflict.conflictType).toBe('update');
        });
      });

      it('should resolve conflicts', () => {
        const store = usePeriodStore;
        const localItem: Period = { 
          period_id: 1, 
          period_name: 'Local Version'
        } as Period;
        
        const remoteItem: Period = { 
          period_id: 1, 
          period_name: 'Remote Version'
        } as Period;
        
        act(() => {
          store.getState().setItems([localItem]);
          const conflicts = store.getState().checkForConflicts([remoteItem]);
          store.getState().resolveConflict(conflicts[0].id, 'remote');
        });
        
        const state = store.getState();
        expect(state.items[0].period_name).toBe('Remote Version');
        expect(state.conflicts).toHaveLength(0);
      });
    });

    describe('Real-time synchronization', () => {
      it('should sync changes across stores', async () => {
        const store = usePeriodStore;
        const item: Period = { period_id: 1, period_name: 'Test' } as Period;
        
        // Simulate receiving broadcast message
        const channel = new BroadcastChannel('reference_data_periods');
        
        act(() => {
          store.getState().addItem(item);
        });
        
        // Verify message was posted
        expect(BroadcastChannelMock.prototype.postMessage).toHaveBeenCalledWith({
          type: 'STATE_CHANGE',
          entityType: 'periods',
          state: expect.objectContaining({
            items: expect.arrayContaining([expect.objectContaining({ period_id: 1 })])
          })
        });
      });
    });
  });

  describe('Store persistence', () => {
    it('should persist dirty state', () => {
      const store = usePeriodStore;
      
      act(() => {
        store.getState().addItem({ period_id: 1 } as Period);
      });
      
      expect(store.getState().isDirty).toBe(true);
      
      act(() => {
        store.getState().clearDirty();
      });
      
      expect(store.getState().isDirty).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should set and clear errors', () => {
      const store = usePeriodStore;
      
      act(() => {
        store.getState().setError('Test error');
      });
      
      expect(store.getState().error).toBe('Test error');
      
      act(() => {
        store.getState().clearError();
      });
      
      expect(store.getState().error).toBe(null);
    });
  });

  describe('Loading state', () => {
    it('should manage loading state', () => {
      const store = usePeriodStore;
      
      act(() => {
        store.getState().setLoading(true);
      });
      
      expect(store.getState().loading).toBe(true);
      
      act(() => {
        store.getState().setLoading(false);
      });
      
      expect(store.getState().loading).toBe(false);
    });
  });
});
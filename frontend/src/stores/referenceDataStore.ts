import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  Period,
  FinancialCenter,
  CostCenter,
  Nomenclature,
  Product,
  periodService,
  financialCenterService,
  costCenterService,
  nomenclatureService,
  productService,
  ReferenceDataError
} from '../services/referenceDataService';
import { toast } from '../components/ui/use-toast';

// Types for store state
interface BaseReferenceDataState<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  lastSync: number | null;
  isDirty: boolean;
  selectedItems: number[];
  searchTerm: string;
  sortBy: string | null;
  sortOrder: 'asc' | 'desc';
}

interface BaseReferenceDataActions<T> {
  // CRUD operations
  fetchAll: (userId: number, force?: boolean) => Promise<void>;
  create: (data: any) => Promise<T>;
  update: (id: number, data: Partial<T>) => Promise<T>;
  delete: (id: number) => Promise<void>;
  bulkDelete: (ids: number[]) => Promise<void>;
  
  // State management
  setItems: (items: T[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setDirty: (dirty: boolean) => void;
  
  // Selection
  selectItem: (id: number) => void;
  deselectItem: (id: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  
  // Search and sort
  setSearchTerm: (term: string) => void;
  setSortBy: (field: string | null) => void;
  toggleSortOrder: () => void;
  
  // Sync
  syncWithServer: (userId: number) => Promise<void>;
  subscribeToChanges: () => () => void;
}

// Undo/Redo history types
interface HistoryEntry<T> {
  action: 'create' | 'update' | 'delete';
  timestamp: number;
  data: T | Partial<T>;
  previousData?: T;
}

interface UndoRedoState<T> {
  history: HistoryEntry<T>[];
  currentIndex: number;
}

interface UndoRedoActions {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  addToHistory: (entry: HistoryEntry<any>) => void;
  clearHistory: () => void;
}

// Create base store factory
function createReferenceDataStore<T extends { [key: string]: any }>(
  name: string,
  service: any,
  idField: keyof T
) {
  type State = BaseReferenceDataState<T> & UndoRedoState<T>;
  type Actions = BaseReferenceDataActions<T> & UndoRedoActions;
  
  return create<State & Actions>()(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial state
          items: [],
          loading: false,
          error: null,
          lastSync: null,
          isDirty: false,
          selectedItems: [],
          searchTerm: '',
          sortBy: null,
          sortOrder: 'asc' as 'asc' | 'desc',
          
          // Undo/Redo state
          history: [],
          currentIndex: -1,
          
          // CRUD operations
          fetchAll: async (userId: number, force = false) => {
            const state = get();
            
            // Skip if already loaded and not forcing
            if (!force && state.items.length > 0 && state.lastSync) {
              const timeSinceSync = Date.now() - state.lastSync;
              if (timeSinceSync < 60000) return; // 1 minute cache
            }
            
            set(state => {
              state.loading = true;
              state.error = null;
            });
            
            try {
              const items = await service.getAll(userId);
              set(state => {
                state.items = items;
                state.lastSync = Date.now();
                state.loading = false;
                state.isDirty = false;
              });
            } catch (error: any) {
              set(state => {
                state.error = error.message;
                state.loading = false;
              });
              
              if (error instanceof ReferenceDataError) {
                toast({
                  title: 'Ошибка',
                  description: error.message,
                  variant: 'destructive'
                });
              }
            }
          },
          
          create: async (data: any) => {
            set(state => {
              state.loading = true;
              state.error = null;
            });
            
            try {
              const newItem = await service.create(data);
              
              set(state => {
                state.items.push(newItem);
                state.loading = false;
                state.isDirty = true;
                
                // Add to history
                state.history = state.history.slice(0, state.currentIndex + 1);
                state.history.push({
                  action: 'create',
                  timestamp: Date.now(),
                  data: newItem
                });
                state.currentIndex = state.history.length - 1;
              });
              
              return newItem;
            } catch (error: any) {
              set(state => {
                state.error = error.message;
                state.loading = false;
              });
              throw error;
            }
          },
          
          update: async (id: number, data: Partial<T>) => {
            const previousItem = get().items.find(item => item[idField] === id);
            if (!previousItem) throw new Error('Item not found');
            
            // Optimistic update
            set(state => {
              const index = state.items.findIndex(item => item[idField] === id);
              if (index !== -1) {
                state.items[index] = { ...state.items[index], ...data };
                state.isDirty = true;
              }
            });
            
            try {
              const updatedItem = await service.update(id, data);
              
              set(state => {
                const index = state.items.findIndex(item => item[idField] === id);
                if (index !== -1) {
                  state.items[index] = updatedItem;
                  
                  // Add to history
                  state.history = state.history.slice(0, state.currentIndex + 1);
                  state.history.push({
                    action: 'update',
                    timestamp: Date.now(),
                    data: updatedItem,
                    previousData: previousItem
                  });
                  state.currentIndex = state.history.length - 1;
                }
              });
              
              return updatedItem;
            } catch (error: any) {
              // Revert optimistic update
              set(state => {
                const index = state.items.findIndex(item => item[idField] === id);
                if (index !== -1) {
                  state.items[index] = previousItem;
                }
                state.error = error.message;
              });
              throw error;
            }
          },
          
          delete: async (id: number) => {
            const deletedItem = get().items.find(item => item[idField] === id);
            if (!deletedItem) throw new Error('Item not found');
            
            // Optimistic delete
            set(state => {
              state.items = state.items.filter(item => item[idField] !== id);
              state.isDirty = true;
            });
            
            try {
              await service.delete(id);
              
              set(state => {
                // Add to history
                state.history = state.history.slice(0, state.currentIndex + 1);
                state.history.push({
                  action: 'delete',
                  timestamp: Date.now(),
                  data: deletedItem
                });
                state.currentIndex = state.history.length - 1;
              });
            } catch (error: any) {
              // Revert optimistic delete
              set(state => {
                state.items.push(deletedItem);
                state.error = error.message;
              });
              throw error;
            }
          },
          
          bulkDelete: async (ids: number[]) => {
            const deletedItems = get().items.filter(item => ids.includes(item[idField]));
            
            // Optimistic bulk delete
            set(state => {
              state.items = state.items.filter(item => !ids.includes(item[idField]));
              state.isDirty = true;
              state.selectedItems = [];
            });
            
            try {
              await service.bulkDelete(ids);
              
              // Add each deletion to history
              set(state => {
                deletedItems.forEach(item => {
                  state.history.push({
                    action: 'delete',
                    timestamp: Date.now(),
                    data: item
                  });
                });
                state.currentIndex = state.history.length - 1;
              });
            } catch (error: any) {
              // Revert optimistic delete
              set(state => {
                state.items.push(...deletedItems);
                state.error = error.message;
              });
              throw error;
            }
          },
          
          // State management
          setItems: (items: T[]) => set(state => { state.items = items; }),
          setLoading: (loading: boolean) => set(state => { state.loading = loading; }),
          setError: (error: string | null) => set(state => { state.error = error; }),
          setDirty: (dirty: boolean) => set(state => { state.isDirty = dirty; }),
          
          // Selection
          selectItem: (id: number) => set(state => {
            if (!state.selectedItems.includes(id)) {
              state.selectedItems.push(id);
            }
          }),
          
          deselectItem: (id: number) => set(state => {
            state.selectedItems = state.selectedItems.filter(i => i !== id);
          }),
          
          selectAll: () => set(state => {
            state.selectedItems = state.items.map(item => item[idField]);
          }),
          
          deselectAll: () => set(state => {
            state.selectedItems = [];
          }),
          
          // Search and sort
          setSearchTerm: (term: string) => set(state => {
            state.searchTerm = term;
          }),
          
          setSortBy: (field: string | null) => set(state => {
            state.sortBy = field;
          }),
          
          toggleSortOrder: () => set(state => {
            state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
          }),
          
          // Sync
          syncWithServer: async (userId: number) => {
            await get().fetchAll(userId, true);
          },
          
          subscribeToChanges: () => {
            return service.subscribeToChanges((action: string, data: any) => {
              set(state => {
                if (action === 'create') {
                  // Check if item already exists
                  if (!state.items.find(item => item[idField] === data[idField])) {
                    state.items.push(data);
                  }
                } else if (action === 'update') {
                  const index = state.items.findIndex(item => item[idField] === data[idField]);
                  if (index !== -1) {
                    state.items[index] = data;
                  }
                } else if (action === 'delete') {
                  state.items = state.items.filter(item => item[idField] !== data.id);
                }
              });
            });
          },
          
          // Undo/Redo
          undo: () => {
            const state = get();
            if (!state.canUndo()) return;
            
            const entry = state.history[state.currentIndex];
            
            set(state => {
              if (entry.action === 'create') {
                // Undo create by removing item
                state.items = state.items.filter(item => item[idField] !== (entry.data as T)[idField]);
              } else if (entry.action === 'update' && entry.previousData) {
                // Undo update by restoring previous data
                const index = state.items.findIndex(item => item[idField] === (entry.previousData as T)[idField]);
                if (index !== -1) {
                  state.items[index] = entry.previousData as T;
                }
              } else if (entry.action === 'delete') {
                // Undo delete by restoring item
                state.items.push(entry.data as T);
              }
              
              state.currentIndex--;
            });
          },
          
          redo: () => {
            const state = get();
            if (!state.canRedo()) return;
            
            const entry = state.history[state.currentIndex + 1];
            
            set(state => {
              if (entry.action === 'create') {
                // Redo create by adding item
                state.items.push(entry.data as T);
              } else if (entry.action === 'update') {
                // Redo update
                const index = state.items.findIndex(item => item[idField] === (entry.data as T)[idField]);
                if (index !== -1) {
                  state.items[index] = entry.data as T;
                }
              } else if (entry.action === 'delete') {
                // Redo delete
                state.items = state.items.filter(item => item[idField] !== (entry.data as T)[idField]);
              }
              
              state.currentIndex++;
            });
          },
          
          canUndo: () => get().currentIndex >= 0,
          canRedo: () => get().currentIndex < get().history.length - 1,
          
          addToHistory: (entry: HistoryEntry<T>) => set(state => {
            state.history = state.history.slice(0, state.currentIndex + 1);
            state.history.push(entry);
            state.currentIndex = state.history.length - 1;
          }),
          
          clearHistory: () => set(state => {
            state.history = [];
            state.currentIndex = -1;
          })
        })),
        {
          name: `reference-data-${name}`,
          storage: createJSONStorage(() => localStorage),
          partialize: (state) => ({
            items: state.items,
            lastSync: state.lastSync,
            searchTerm: state.searchTerm,
            sortBy: state.sortBy,
            sortOrder: state.sortOrder
          })
        }
      )
    )
  );
}

// Create specific stores
export const usePeriodStore = createReferenceDataStore<Period>(
  'periods',
  periodService,
  'period_id'
);

export const useFinancialCenterStore = createReferenceDataStore<FinancialCenter>(
  'financial-centers',
  financialCenterService,
  'financial_center_id'
);

export const useCostCenterStore = createReferenceDataStore<CostCenter>(
  'cost-centers',
  costCenterService,
  'cost_center_id'
);

export const useNomenclatureStore = createReferenceDataStore<Nomenclature>(
  'nomenclatures',
  nomenclatureService,
  'nomenclature_id'
);

export const useProductStore = createReferenceDataStore<Product>(
  'products',
  productService,
  'product_id'
);

// Conflict resolution helper
export function resolveConflict<T>(
  local: T,
  remote: T,
  strategy: 'local' | 'remote' | 'merge' = 'remote'
): T {
  if (strategy === 'local') return local;
  if (strategy === 'remote') return remote;
  
  // For merge strategy, prefer remote but keep local changes for undefined remote fields
  const merged = { ...local };
  for (const key in remote) {
    if (remote[key] !== undefined) {
      merged[key] = remote[key];
    }
  }
  return merged;
}

// Global sync function
export async function syncAllReferenceData(userId: number): Promise<void> {
  const stores = [
    usePeriodStore,
    useFinancialCenterStore,
    useCostCenterStore,
    useNomenclatureStore,
    useProductStore
  ];
  
  await Promise.all(
    stores.map(store => store.getState().syncWithServer(userId))
  );
}

// Clear all stores
export function clearAllReferenceData(): void {
  const stores = [
    usePeriodStore,
    useFinancialCenterStore,
    useCostCenterStore,
    useNomenclatureStore,
    useProductStore
  ];
  
  stores.forEach(store => {
    store.setState({
      items: [],
      loading: false,
      error: null,
      lastSync: null,
      isDirty: false,
      selectedItems: [],
      searchTerm: '',
      sortBy: null,
      sortOrder: 'asc',
      history: [],
      currentIndex: -1
    });
  });
}
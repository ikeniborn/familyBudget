import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { toastStore } from './toast.store';
import type { Period, FinancialCenter, CostCenter, Nomenclature, BaseReferenceDataState } from '$lib/types';
import api from '$lib/services/api';

// Remove duplicate interface since it's now imported from types

// Create persistent storage helpers
function getStoredData<T>(key: string): T | null {
  if (!browser) return null;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function storeData<T>(key: string, data: T): void {
  if (!browser) return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to store data:', error);
  }
}

// Base store factory function
function createReferenceDataStore<T extends Record<string, any>>(
  name: string,
  idField: keyof T,
  apiEndpoint: string
) {
  const storageKey = `reference-data-${name}`;
  
  // Initialize with stored data
  const storedState = getStoredData<Partial<BaseReferenceDataState<T>>>(storageKey);
  const initialState: BaseReferenceDataState<T> = {
    items: storedState?.items || [],
    loading: false,
    error: null,
    lastSync: storedState?.lastSync || null,
    isDirty: false,
    selectedItems: [],
    searchTerm: storedState?.searchTerm || '',
    sortBy: storedState?.sortBy || null,
    sortOrder: storedState?.sortOrder || 'asc',
  };

  const { subscribe, set, update } = writable<BaseReferenceDataState<T>>(initialState);

  // Store changes to localStorage
  subscribe(state => {
    storeData(storageKey, {
      items: state.items,
      lastSync: state.lastSync,
      searchTerm: state.searchTerm,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder
    });
  });

  return {
    subscribe,

    // CRUD operations
    async fetchAll(userId: number, force = false): Promise<void> {
      const currentState = get({ subscribe });
      
      // Skip if already loaded and not forcing
      if (!force && currentState.items.length > 0 && currentState.lastSync) {
        const timeSinceSync = Date.now() - currentState.lastSync;
        if (timeSinceSync < 60000) return; // 1 minute cache
      }

      update(state => ({ ...state, loading: true, error: null }));

      try {
        const response = await api.get(`${apiEndpoint}?user_id=${userId}`);
        const items = response.data;
        
        update(state => ({
          ...state,
          items,
          lastSync: Date.now(),
          loading: false,
          isDirty: false
        }));
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || error.message || 'Ошибка загрузки данных';
        
        update(state => ({
          ...state,
          error: errorMessage,
          loading: false
        }));
        
        toastStore.error('Ошибка', errorMessage);
      }
    },

    async create(data: Partial<T>): Promise<T> {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const response = await api.post(apiEndpoint, data);
        const newItem = response.data;
        
        update(state => ({
          ...state,
          items: [...state.items, newItem],
          loading: false,
          isDirty: true
        }));
        
        toastStore.success('Успех', 'Запись создана');
        return newItem;
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || error.message || 'Ошибка создания';
        
        update(state => ({
          ...state,
          error: errorMessage,
          loading: false
        }));
        
        toastStore.error('Ошибка', errorMessage);
        throw error;
      }
    },

    async update(id: number, data: Partial<T>): Promise<T> {
      const currentState = get({ subscribe });
      const previousItem = currentState.items.find(item => item[idField] === id);
      
      if (!previousItem) {
        throw new Error('Запись не найдена');
      }

      // Optimistic update
      update(state => ({
        ...state,
        items: state.items.map(item =>
          item[idField] === id ? { ...item, ...data } : item
        ),
        isDirty: true
      }));

      try {
        const response = await api.put(`${apiEndpoint}/${id}`, data);
        const updatedItem = response.data;
        
        update(state => ({
          ...state,
          items: state.items.map(item =>
            item[idField] === id ? updatedItem : item
          ),
          loading: false
        }));
        
        toastStore.success('Успех', 'Запись обновлена');
        return updatedItem;
      } catch (error: any) {
        // Revert optimistic update
        update(state => ({
          ...state,
          items: state.items.map(item =>
            item[idField] === id ? previousItem : item
          ),
          error: error.response?.data?.message || error.message
        }));
        
        const errorMessage = error.response?.data?.message || error.message || 'Ошибка обновления';
        toastStore.error('Ошибка', errorMessage);
        throw error;
      }
    },

    async delete(id: number): Promise<void> {
      const currentState = get({ subscribe });
      const deletedItem = currentState.items.find(item => item[idField] === id);
      
      if (!deletedItem) {
        throw new Error('Запись не найдена');
      }

      // Optimistic delete
      update(state => ({
        ...state,
        items: state.items.filter(item => item[idField] !== id),
        selectedItems: state.selectedItems.filter(itemId => itemId !== id),
        isDirty: true
      }));

      try {
        await api.delete(`${apiEndpoint}/${id}`);
        toastStore.success('Успех', 'Запись удалена');
      } catch (error: any) {
        // Revert optimistic delete
        update(state => ({
          ...state,
          items: [...state.items, deletedItem],
          error: error.response?.data?.message || error.message
        }));
        
        const errorMessage = error.response?.data?.message || error.message || 'Ошибка удаления';
        toastStore.error('Ошибка', errorMessage);
        throw error;
      }
    },

    async bulkDelete(ids: number[]): Promise<void> {
      const currentState = get({ subscribe });
      const deletedItems = currentState.items.filter(item => ids.includes(item[idField] as number));

      // Optimistic bulk delete
      update(state => ({
        ...state,
        items: state.items.filter(item => !ids.includes(item[idField] as number)),
        selectedItems: [],
        isDirty: true
      }));

      try {
        await api.post(`${apiEndpoint}/bulk-delete`, { ids });
        toastStore.success('Успех', `Удалено записей: ${ids.length}`);
      } catch (error: any) {
        // Revert optimistic delete
        update(state => ({
          ...state,
          items: [...state.items, ...deletedItems],
          error: error.response?.data?.message || error.message
        }));
        
        const errorMessage = error.response?.data?.message || error.message || 'Ошибка массового удаления';
        toastStore.error('Ошибка', errorMessage);
        throw error;
      }
    },

    // Selection methods
    selectItem(id: number): void {
      update(state => ({
        ...state,
        selectedItems: state.selectedItems.includes(id) 
          ? state.selectedItems 
          : [...state.selectedItems, id]
      }));
    },

    deselectItem(id: number): void {
      update(state => ({
        ...state,
        selectedItems: state.selectedItems.filter(itemId => itemId !== id)
      }));
    },

    selectAll(): void {
      update(state => ({
        ...state,
        selectedItems: state.items.map(item => item[idField] as number)
      }));
    },

    deselectAll(): void {
      update(state => ({
        ...state,
        selectedItems: []
      }));
    },

    // Search and sort
    setSearchTerm(term: string): void {
      update(state => ({
        ...state,
        searchTerm: term
      }));
    },

    setSortBy(field: string | null): void {
      update(state => ({
        ...state,
        sortBy: field
      }));
    },

    toggleSortOrder(): void {
      update(state => ({
        ...state,
        sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc'
      }));
    },

    // Utility methods
    setError(error: string | null): void {
      update(state => ({ ...state, error }));
    },

    clearError(): void {
      update(state => ({ ...state, error: null }));
    },

    reset(): void {
      set({
        ...initialState,
        items: [],
        lastSync: null
      });
    },

    // Additional methods to match expected API
    async load(userId: number): Promise<void> {
      return this.fetchAll(userId);
    },

    // Map method for array operations
    map<U>(callback: (item: T, index: number, array: T[]) => U): U[] {
      const currentState = get({ subscribe });
      return currentState.items.map(callback);
    },

    // Length getter
    get length(): number {
      const currentState = get({ subscribe });
      return currentState.items.length;
    }
  };
}

// Create specific stores
export const periodStore = createReferenceDataStore<Period>(
  'periods',
  'period_id',
  '/api/periods'
);

export const financialCenterStore = createReferenceDataStore<FinancialCenter>(
  'financial-centers',
  'financial_center_id',
  '/api/financial_centers'
);

export const costCenterStore = createReferenceDataStore<CostCenter>(
  'cost-centers',
  'cost_center_id',
  '/api/cost_centers'
);

export const nomenclatureStore = createReferenceDataStore<Nomenclature>(
  'nomenclatures',
  'nomenclature_id',
  '/api/nomenclatures'
);

// Create enhanced stores with array methods
function createEnhancedStore<T>(baseStore: any) {
  return derived([baseStore], ([$baseStore]) => {
    const items = $baseStore.items || [];
    return {
      ...$baseStore,
      // Array methods
      map: <U>(callback: (item: T, index: number, array: T[]) => U): U[] => items.map(callback),
      filter: (callback: (item: T, index: number, array: T[]) => boolean): T[] => items.filter(callback),
      find: (callback: (item: T, index: number, array: T[]) => boolean): T | undefined => items.find(callback),
      length: items.length,
      
      // Store methods
      load: (userId: number) => baseStore.load(userId),
      fetchAll: (userId: number, force?: boolean) => baseStore.fetchAll(userId, force),
      create: (data: Partial<T>) => baseStore.create(data),
      update: (id: number, data: Partial<T>) => baseStore.update(id, data),
      delete: (id: number) => baseStore.delete(id),
      bulkDelete: (ids: number[]) => baseStore.bulkDelete(ids),
      selectItem: (id: number) => baseStore.selectItem(id),
      deselectItem: (id: number) => baseStore.deselectItem(id),
      selectAll: () => baseStore.selectAll(),
      deselectAll: () => baseStore.deselectAll(),
      setSearchTerm: (term: string) => baseStore.setSearchTerm(term),
      setSortBy: (field: string | null) => baseStore.setSortBy(field),
      toggleSortOrder: () => baseStore.toggleSortOrder(),
      setError: (error: string | null) => baseStore.setError(error),
      clearError: () => baseStore.clearError(),
      reset: () => baseStore.reset()
    };
  });
}

// Enhanced stores with array methods
export const enhancedPeriodStore = createEnhancedStore<Period>(periodStore);
export const enhancedFinancialCenterStore = createEnhancedStore<FinancialCenter>(financialCenterStore);
export const enhancedCostCenterStore = createEnhancedStore<CostCenter>(costCenterStore);
export const enhancedNomenclatureStore = createEnhancedStore<Nomenclature>(nomenclatureStore);

// Derived stores for filtered and sorted data
export const filteredPeriods = derived(
  [periodStore],
  ([$periodStore]) => {
    let filtered = $periodStore.items;
    
    // Apply search filter
    if ($periodStore.searchTerm) {
      const term = $periodStore.searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.period_name?.toLowerCase().includes(term) ||
        item.period_ru_name?.toLowerCase().includes(term)
      );
    }
    
    // Apply sorting
    if ($periodStore.sortBy) {
      filtered.sort((a, b) => {
        const aVal = a[$periodStore.sortBy as keyof Period];
        const bVal = b[$periodStore.sortBy as keyof Period];
        
        if (aVal < bVal) return $periodStore.sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return $periodStore.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return filtered;
  }
);

// Global sync function for all reference data
export async function syncAllReferenceData(userId: number): Promise<void> {
  const stores = [periodStore, financialCenterStore, costCenterStore, nomenclatureStore];
  
  await Promise.all(
    stores.map(store => store.fetchAll(userId, true))
  );
}

// Clear all reference data
export function clearAllReferenceData(): void {
  const stores = [periodStore, financialCenterStore, costCenterStore, nomenclatureStore];
  stores.forEach(store => store.reset());
}
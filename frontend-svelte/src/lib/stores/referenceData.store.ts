import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';
import { toastStore } from './toast.store';
import type { Period, FinancialCenter, CostCenter, Nomenclature, BaseReferenceDataState } from '$lib/types';
import api from '$lib/services/api';

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

// Traditional Svelte Store-based Reference Data Store Class
class ReferenceDataStore<T extends Record<string, any>> {
  private store;
  private storageKey: string;
  
  constructor(
    private name: string,
    private idField: keyof T,
    private apiEndpoint: string
  ) {
    this.storageKey = `reference-data-${name}`;
    this.store = writable<BaseReferenceDataState<T>>(this.getInitialState());

    // Auto-save to localStorage on state changes
    this.store.subscribe(state => {
      storeData(this.storageKey, {
        items: state.items,
        lastSync: state.lastSync,
        searchTerm: state.searchTerm,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder
      });
    });
  }

  private getInitialState(): BaseReferenceDataState<T> {
    const storedState = getStoredData<Partial<BaseReferenceDataState<T>>>(this.storageKey);
    return {
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
  }

  // Store subscription method
  subscribe(run: (value: BaseReferenceDataState<T>) => void) {
    return this.store.subscribe(run);
  }

  // Private state update method
  private updateState(updates: Partial<BaseReferenceDataState<T>>): void {
    this.store.update(state => ({ ...state, ...updates }));
  }

  // Getters that work with current store state
  private getState(): BaseReferenceDataState<T> {
    let currentState: BaseReferenceDataState<T> | undefined;
    const unsubscribe = this.store.subscribe(state => {
      currentState = state;
    });
    unsubscribe();
    return currentState!;
  }

  get items(): T[] {
    return this.getState().items;
  }

  get loading(): boolean {
    return this.getState().loading;
  }

  get error(): string | null {
    return this.getState().error;
  }

  get lastSync(): number | null {
    return this.getState().lastSync;
  }

  get isDirty(): boolean {
    return this.getState().isDirty;
  }

  get selectedItems(): number[] {
    return this.getState().selectedItems;
  }

  get searchTerm(): string {
    return this.getState().searchTerm;
  }

  get sortBy(): string | null {
    return this.getState().sortBy;
  }

  get sortOrder(): 'asc' | 'desc' {
    return this.getState().sortOrder;
  }

  get state(): BaseReferenceDataState<T> {
    return this.getState();
  }

  get length(): number {
    return this.getState().items.length;
  }

  // CRUD operations
  async fetchAll(userId: number, force = false): Promise<void> {
    const currentState = this.getState();
    
    // Skip if already loaded and not forcing
    if (!force && currentState.items.length > 0 && currentState.lastSync) {
      const timeSinceSync = Date.now() - currentState.lastSync;
      if (timeSinceSync < 60000) return; // 1 minute cache
    }

    this.updateState({ loading: true, error: null });

    try {
      const response = await api.get(`${this.apiEndpoint}?user_id=${userId}`);
      // FastAPI returns array directly, not wrapped in { data: ... }
      const items = Array.isArray(response) ? response : response.data || [];
      
      this.updateState({
        items,
        lastSync: Date.now(),
        loading: false,
        isDirty: false
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Ошибка загрузки данных';
      
      this.updateState({
        error: errorMessage,
        loading: false
      });
      
      toastStore.error('Ошибка', errorMessage);
    }
  }

  async create(data: Partial<T>): Promise<T> {
    this.updateState({ loading: true, error: null });

    try {
      const response = await api.post(this.apiEndpoint, data);
      // FastAPI returns object directly, not wrapped in { data: ... }
      const newItem = response.data || response;
      
      this.updateState({
        items: [...this.getState().items, newItem],
        loading: false,
        isDirty: true
      });
      
      toastStore.success('Успех', 'Запись создана');
      return newItem;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Ошибка создания';
      
      this.updateState({
        error: errorMessage,
        loading: false
      });
      
      toastStore.error('Ошибка', errorMessage);
      throw error;
    }
  }

  async update(id: number, data: Partial<T>): Promise<T> {
    const currentState = this.getState();
    const previousItem = currentState.items.find(item => item[this.idField] === id);
    
    if (!previousItem) {
      throw new Error('Запись не найдена');
    }

    // Optimistic update
    this.updateState({
      items: currentState.items.map(item =>
        item[this.idField] === id ? { ...item, ...data } : item
      ),
      isDirty: true
    });

    try {
      const response = await api.put(`${this.apiEndpoint}/${id}`, data);
      // FastAPI returns object directly, not wrapped in { data: ... }
      const updatedItem = response.data || response;
      
      this.updateState({
        items: this.getState().items.map(item =>
          item[this.idField] === id ? updatedItem : item
        ),
        loading: false
      });
      
      toastStore.success('Успех', 'Запись обновлена');
      return updatedItem;
    } catch (error: any) {
      // Revert optimistic update
      this.updateState({
        items: this.getState().items.map(item =>
          item[this.idField] === id ? previousItem : item
        ),
        error: error.response?.data?.message || error.message
      });
      
      const errorMessage = error.response?.data?.message || error.message || 'Ошибка обновления';
      toastStore.error('Ошибка', errorMessage);
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    const currentState = this.getState();
    const deletedItem = currentState.items.find(item => item[this.idField] === id);
    
    if (!deletedItem) {
      throw new Error('Запись не найдена');
    }

    // Optimistic delete
    this.updateState({
      items: currentState.items.filter(item => item[this.idField] !== id),
      selectedItems: currentState.selectedItems.filter(itemId => itemId !== id),
      isDirty: true
    });

    try {
      await api.delete(`${this.apiEndpoint}/${id}`);
      toastStore.success('Успех', 'Запись удалена');
    } catch (error: any) {
      // Revert optimistic delete
      this.updateState({
        items: [...this.getState().items, deletedItem],
        error: error.response?.data?.message || error.message
      });
      
      const errorMessage = error.response?.data?.message || error.message || 'Ошибка удаления';
      toastStore.error('Ошибка', errorMessage);
      throw error;
    }
  }

  async bulkDelete(ids: number[]): Promise<void> {
    const currentState = this.getState();
    const deletedItems = currentState.items.filter(item => ids.includes(item[this.idField] as number));

    // Optimistic bulk delete
    this.updateState({
      items: currentState.items.filter(item => !ids.includes(item[this.idField] as number)),
      selectedItems: [],
      isDirty: true
    });

    try {
      await api.post(`${this.apiEndpoint}/bulk-delete`, { ids });
      toastStore.success('Успех', `Удалено записей: ${ids.length}`);
    } catch (error: any) {
      // Revert optimistic delete
      this.updateState({
        items: [...this.getState().items, ...deletedItems],
        error: error.response?.data?.message || error.message
      });
      
      const errorMessage = error.response?.data?.message || error.message || 'Ошибка массового удаления';
      toastStore.error('Ошибка', errorMessage);
      throw error;
    }
  }

  // Selection methods
  selectItem(id: number): void {
    const currentState = this.getState();
    this.updateState({
      selectedItems: currentState.selectedItems.includes(id) 
        ? currentState.selectedItems 
        : [...currentState.selectedItems, id]
    });
  }

  deselectItem(id: number): void {
    this.updateState({
      selectedItems: this.getState().selectedItems.filter(itemId => itemId !== id)
    });
  }

  selectAll(): void {
    this.updateState({
      selectedItems: this.getState().items.map(item => item[this.idField] as number)
    });
  }

  deselectAll(): void {
    this.updateState({ selectedItems: [] });
  }

  // Search and sort
  setSearchTerm(term: string): void {
    this.updateState({ searchTerm: term });
  }

  setSortBy(field: string | null): void {
    this.updateState({ sortBy: field });
  }

  toggleSortOrder(): void {
    const currentState = this.getState();
    this.updateState({
      sortOrder: currentState.sortOrder === 'asc' ? 'desc' : 'asc'
    });
  }

  // Utility methods
  setError(error: string | null): void {
    this.updateState({ error });
  }

  clearError(): void {
    this.updateState({ error: null });
  }

  reset(): void {
    this.store.set({
      ...this.getInitialState(),
      items: [],
      lastSync: null
    });
  }

  // Additional methods to match expected API
  async load(userId: number): Promise<void> {
    return this.fetchAll(userId);
  }

  // Map method for array operations
  map<U>(callback: (item: T, index: number, array: T[]) => U): U[] {
    return this.getState().items.map(callback);
  }

  // Array methods
  filter(callback: (item: T, index: number, array: T[]) => boolean): T[] {
    return this.getState().items.filter(callback);
  }

  find(callback: (item: T, index: number, array: T[]) => boolean): T | undefined {
    return this.getState().items.find(callback);
  }
}

// Create specific stores
export const periodStore = new ReferenceDataStore<Period>(
  'periods',
  'period_id',
  '/periods/'
);

export const financialCenterStore = new ReferenceDataStore<FinancialCenter>(
  'financial-centers',
  'financial_center_id',
  '/financial_centers/'
);

export const costCenterStore = new ReferenceDataStore<CostCenter>(
  'cost-centers',
  'cost_center_id',
  '/cost_centers/'
);

export const nomenclatureStore = new ReferenceDataStore<Nomenclature>(
  'nomenclatures',
  'nomenclature_id',
  '/nomenclatures/'
);

// Enhanced stores with array methods (backward compatibility)
export const enhancedPeriodStore = periodStore;
export const enhancedFinancialCenterStore = financialCenterStore;
export const enhancedCostCenterStore = costCenterStore;
export const enhancedNomenclatureStore = nomenclatureStore;

// Derived stores for individual data arrays
export const periods = derived(
  periodStore,
  ($periodStore) => $periodStore.items
);

export const financialCenters = derived(
  financialCenterStore,
  ($financialCenterStore) => $financialCenterStore.items
);

export const costCenters = derived(
  costCenterStore,
  ($costCenterStore) => $costCenterStore.items
);

export const nomenclatures = derived(
  nomenclatureStore,
  ($nomenclatureStore) => $nomenclatureStore.items
);

// Filtered periods derived store for reactive filtering
export const filteredPeriods = derived(
  periodStore,
  ($periodStore) => {
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

// Hook-style functions for easier use in components
export function usePeriods() {
  return {
    subscribe: periodStore.subscribe.bind(periodStore),
    fetchAll: (userId: number, force?: boolean) => periodStore.fetchAll(userId, force),
    create: (data: Partial<Period>) => periodStore.create(data),
    update: (id: number, data: Partial<Period>) => periodStore.update(id, data),
    delete: (id: number) => periodStore.delete(id),
    bulkDelete: (ids: number[]) => periodStore.bulkDelete(ids),
    selectItem: (id: number) => periodStore.selectItem(id),
    deselectItem: (id: number) => periodStore.deselectItem(id),
    selectAll: () => periodStore.selectAll(),
    deselectAll: () => periodStore.deselectAll(),
    setSearchTerm: (term: string) => periodStore.setSearchTerm(term),
    setSortBy: (field: string | null) => periodStore.setSortBy(field),
    toggleSortOrder: () => periodStore.toggleSortOrder(),
    reset: () => periodStore.reset()
  };
}

export function useFinancialCenters() {
  return {
    subscribe: financialCenterStore.subscribe.bind(financialCenterStore),
    fetchAll: (userId: number, force?: boolean) => financialCenterStore.fetchAll(userId, force),
    create: (data: Partial<FinancialCenter>) => financialCenterStore.create(data),
    update: (id: number, data: Partial<FinancialCenter>) => financialCenterStore.update(id, data),
    delete: (id: number) => financialCenterStore.delete(id),
    bulkDelete: (ids: number[]) => financialCenterStore.bulkDelete(ids),
    selectItem: (id: number) => financialCenterStore.selectItem(id),
    deselectItem: (id: number) => financialCenterStore.deselectItem(id),
    selectAll: () => financialCenterStore.selectAll(),
    deselectAll: () => financialCenterStore.deselectAll(),
    setSearchTerm: (term: string) => financialCenterStore.setSearchTerm(term),
    setSortBy: (field: string | null) => financialCenterStore.setSortBy(field),
    toggleSortOrder: () => financialCenterStore.toggleSortOrder(),
    reset: () => financialCenterStore.reset()
  };
}

export function useCostCenters() {
  return {
    subscribe: costCenterStore.subscribe.bind(costCenterStore),
    fetchAll: (userId: number, force?: boolean) => costCenterStore.fetchAll(userId, force),
    create: (data: Partial<CostCenter>) => costCenterStore.create(data),
    update: (id: number, data: Partial<CostCenter>) => costCenterStore.update(id, data),
    delete: (id: number) => costCenterStore.delete(id),
    bulkDelete: (ids: number[]) => costCenterStore.bulkDelete(ids),
    selectItem: (id: number) => costCenterStore.selectItem(id),
    deselectItem: (id: number) => costCenterStore.deselectItem(id),
    selectAll: () => costCenterStore.selectAll(),
    deselectAll: () => costCenterStore.deselectAll(),
    setSearchTerm: (term: string) => costCenterStore.setSearchTerm(term),
    setSortBy: (field: string | null) => costCenterStore.setSortBy(field),
    toggleSortOrder: () => costCenterStore.toggleSortOrder(),
    reset: () => costCenterStore.reset()
  };
}

export function useNomenclatures() {
  return {
    subscribe: nomenclatureStore.subscribe.bind(nomenclatureStore),
    fetchAll: (userId: number, force?: boolean) => nomenclatureStore.fetchAll(userId, force),
    create: (data: Partial<Nomenclature>) => nomenclatureStore.create(data),
    update: (id: number, data: Partial<Nomenclature>) => nomenclatureStore.update(id, data),
    delete: (id: number) => nomenclatureStore.delete(id),
    bulkDelete: (ids: number[]) => nomenclatureStore.bulkDelete(ids),
    selectItem: (id: number) => nomenclatureStore.selectItem(id),
    deselectItem: (id: number) => nomenclatureStore.deselectItem(id),
    selectAll: () => nomenclatureStore.selectAll(),
    deselectAll: () => nomenclatureStore.deselectAll(),
    setSearchTerm: (term: string) => nomenclatureStore.setSearchTerm(term),
    setSortBy: (field: string | null) => nomenclatureStore.setSortBy(field),
    toggleSortOrder: () => nomenclatureStore.toggleSortOrder(),
    reset: () => nomenclatureStore.reset()
  };
}

// Global sync function for all reference data
export async function syncAllReferenceData(userId: number): Promise<void> {
  const stores = [
    { store: periodStore, name: 'Периоды' },
    { store: financialCenterStore, name: 'Финансовые центры' },
    { store: costCenterStore, name: 'Центры затрат' },
    { store: nomenclatureStore, name: 'Номенклатуры' }
  ];
  
  // Use Promise.allSettled to prevent one failure from blocking others
  const results = await Promise.allSettled(
    stores.map(({ store }) => store.fetchAll(userId, true))
  );
  
  // Log any failures but don't throw
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Failed to load ${stores[index].name}:`, result.reason);
      // Individual stores already show toast errors, so we don't need to duplicate
    }
  });
  
  // Check if all failed
  const allFailed = results.every(r => r.status === 'rejected');
  if (allFailed) {
    console.error('All reference data stores failed to load');
    // This error will be caught by the dashboard, but won't block the page
    throw new Error('Failed to load any reference data');
  }
}

// Clear all reference data
export function clearAllReferenceData(): void {
  const stores = [periodStore, financialCenterStore, costCenterStore, nomenclatureStore];
  stores.forEach(store => store.reset());
}

// Legacy exports for backward compatibility with existing components
export { periodStore as default };

// Export the store instances with legacy methods for gradual migration
export const periodStoreCompat = periodStore;
export const financialCenterStoreCompat = financialCenterStore;
export const costCenterStoreCompat = costCenterStore;
export const nomenclatureStoreCompat = nomenclatureStore;
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  usePeriodStore,
  useFinancialCenterStore,
  useCostCenterStore,
  useNomenclatureStore,
  useProductStore
} from '../stores/referenceDataStore';
import {
  Period,
  FinancialCenter,
  CostCenter,
  Nomenclature,
  Product,
  ReferenceDataError
} from '../services/referenceDataService';
import {
  validateReferenceData,
  ValidationResult
} from '../utils/validation';
import { toast } from '../components/ui/use-toast';

// Types for hook configuration
interface UseReferenceDataConfig {
  autoFetch?: boolean;
  enableSync?: boolean;
  enableValidation?: boolean;
  enableOptimisticUpdates?: boolean;
  cacheTimeout?: number;
}

interface UseReferenceDataResult<T> {
  // Data
  items: T[];
  loading: boolean;
  error: string | null;
  isDirty: boolean;
  
  // Selection
  selectedItems: number[];
  selectItem: (id: number) => void;
  deselectItem: (id: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  
  // Search and sort
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sortBy: string | null;
  setSortBy: (field: string | null) => void;
  sortOrder: 'asc' | 'desc';
  toggleSortOrder: () => void;
  
  // Filtered and sorted data
  filteredItems: T[];
  
  // CRUD operations
  create: (data: Omit<T, 'id'>) => Promise<T>;
  update: (id: number, data: Partial<T>) => Promise<T>;
  delete: (id: number) => Promise<void>;
  bulkDelete: (ids: number[]) => Promise<void>;
  
  // Validation
  validate: (data: Partial<T>, isUpdate?: boolean, excludeId?: number) => Promise<ValidationResult>;
  
  // Sync
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
  
  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  
  // Utilities
  findById: (id: number) => T | undefined;
  export: (format: 'csv' | 'json') => void;
  import: (data: T[]) => Promise<void>;
}

// Create reference data hook factory
function createReferenceDataHook<T extends { [key: string]: any }>(
  store: any,
  type: 'period' | 'financial_center' | 'cost_center' | 'nomenclature' | 'product',
  idField: keyof T
) {
  return function useReferenceData(config: UseReferenceDataConfig = {}): UseReferenceDataResult<T> {
    const {
      autoFetch = true,
      enableSync = true,
      enableValidation = true,
      enableOptimisticUpdates = true,
      cacheTimeout = 300000 // 5 minutes
    } = config;

    const { user } = useAuthStore();
    const unsubscribeRef = useRef<(() => void) | null>(null);
    
    // Store state
    const {
      items,
      loading,
      error,
      isDirty,
      selectedItems,
      searchTerm,
      sortBy,
      sortOrder,
      history,
      currentIndex,
      
      // Actions
      fetchAll,
      create: storeCreate,
      update: storeUpdate,
      delete: storeDelete,
      bulkDelete: storeBulkDelete,
      setSearchTerm,
      setSortBy,
      toggleSortOrder,
      selectItem,
      deselectItem,
      selectAll,
      deselectAll,
      undo: storeUndo,
      redo: storeRedo,
      canUndo: storeCanUndo,
      canRedo: storeCanRedo,
      syncWithServer,
      subscribeToChanges
    } = store();

    // Auto-fetch on mount
    useEffect(() => {
      if (autoFetch && user?.user_id) {
        fetchAll(user.user_id);
      }
    }, [autoFetch, user?.user_id, fetchAll]);

    // Set up real-time sync
    useEffect(() => {
      if (enableSync) {
        unsubscribeRef.current = subscribeToChanges();
        
        return () => {
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
        };
      }
    }, [enableSync, subscribeToChanges]);

    // Filtered and sorted items
    const filteredItems = useMemo(() => {
      let filtered = [...items];

      // Apply search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(item => {
          return Object.values(item).some(value => 
            String(value).toLowerCase().includes(term)
          );
        });
      }

      // Apply sorting
      if (sortBy) {
        filtered.sort((a, b) => {
          const aVal = a[sortBy];
          const bVal = b[sortBy];
          
          let comparison = 0;
          if (aVal < bVal) comparison = -1;
          else if (aVal > bVal) comparison = 1;
          
          return sortOrder === 'desc' ? -comparison : comparison;
        });
      }

      return filtered;
    }, [items, searchTerm, sortBy, sortOrder]);

    // Enhanced CRUD operations with validation
    const create = useCallback(async (data: Omit<T, 'id'>): Promise<T> => {
      if (!user?.user_id) throw new Error('User not authenticated');

      // Validation
      if (enableValidation) {
        const validation = await validateReferenceData(
          type,
          data,
          user.user_id,
          false
        );

        if (!validation.isValid) {
          const errorMessage = validation.errors.map(e => e.message).join(', ');
          throw new ReferenceDataError(errorMessage, 'VALIDATION_ERROR');
        }

        // Show warnings
        if (validation.warnings.length > 0) {
          toast({
            title: 'Предупреждения',
            description: validation.warnings.map(w => w.message).join(', '),
            variant: 'destructive'
          });
        }
      }

      try {
        const result = await storeCreate({
          ...data,
          user_id: user.user_id
        });

        toast({
          title: 'Успешно',
          description: 'Запись создана'
        });

        return result;
      } catch (error: any) {
        toast({
          title: 'Ошибка',
          description: error.message,
          variant: 'destructive'
        });
        throw error;
      }
    }, [user?.user_id, enableValidation, storeCreate, type]);

    const update = useCallback(async (id: number, data: Partial<T>): Promise<T> => {
      if (!user?.user_id) throw new Error('User not authenticated');

      // Validation
      if (enableValidation) {
        const validation = await validateReferenceData(
          type,
          data,
          user.user_id,
          true,
          id
        );

        if (!validation.isValid) {
          const errorMessage = validation.errors.map(e => e.message).join(', ');
          throw new ReferenceDataError(errorMessage, 'VALIDATION_ERROR');
        }

        // Show warnings
        if (validation.warnings.length > 0) {
          toast({
            title: 'Предупреждения',
            description: validation.warnings.map(w => w.message).join(', ')
          });
        }
      }

      try {
        const result = await storeUpdate(id, data);

        toast({
          title: 'Успешно',
          description: 'Запись обновлена'
        });

        return result;
      } catch (error: any) {
        toast({
          title: 'Ошибка',
          description: error.message,
          variant: 'destructive'
        });
        throw error;
      }
    }, [user?.user_id, enableValidation, storeUpdate, type]);

    const deleteItem = useCallback(async (id: number): Promise<void> => {
      if (!user?.user_id) throw new Error('User not authenticated');

      try {
        await storeDelete(id);

        toast({
          title: 'Успешно',
          description: 'Запись удалена'
        });
      } catch (error: any) {
        toast({
          title: 'Ошибка',
          description: error.message,
          variant: 'destructive'
        });
        throw error;
      }
    }, [user?.user_id, storeDelete]);

    const bulkDelete = useCallback(async (ids: number[]): Promise<void> => {
      if (!user?.user_id) throw new Error('User not authenticated');

      try {
        await storeBulkDelete(ids);

        toast({
          title: 'Успешно',
          description: `Удалено записей: ${ids.length}`
        });
      } catch (error: any) {
        toast({
          title: 'Ошибка',
          description: error.message,
          variant: 'destructive'
        });
        throw error;
      }
    }, [user?.user_id, storeBulkDelete]);

    // Validation
    const validate = useCallback(async (
      data: Partial<T>,
      isUpdate = false,
      excludeId?: number
    ): Promise<ValidationResult> => {
      if (!user?.user_id) {
        return {
          isValid: false,
          errors: [{ field: 'user', message: 'User not authenticated', code: 'AUTH_ERROR' }],
          warnings: []
        };
      }

      return validateReferenceData(type, data, user.user_id, isUpdate, excludeId);
    }, [user?.user_id, type]);

    // Sync operations
    const refresh = useCallback(async (): Promise<void> => {
      if (!user?.user_id) return;
      await fetchAll(user.user_id, true);
    }, [user?.user_id, fetchAll]);

    const sync = useCallback(async (): Promise<void> => {
      if (!user?.user_id) return;
      await syncWithServer(user.user_id);
    }, [user?.user_id, syncWithServer]);

    // Undo/Redo
    const canUndo = storeCanUndo();
    const canRedo = storeCanRedo();
    const undo = storeUndo;
    const redo = storeRedo;

    // Utilities
    const findById = useCallback((id: number): T | undefined => {
      return items.find(item => item[idField] === id);
    }, [items, idField]);

    const exportData = useCallback((format: 'csv' | 'json'): void => {
      const timestamp = new Date().toISOString().split('T')[0];
      
      if (format === 'csv') {
        // Simple CSV export
        const headers = Object.keys(filteredItems[0] || {});
        const csvContent = [
          headers.join(','),
          ...filteredItems.map(item => 
            headers.map(header => `"${String(item[header] || '')}"`).join(',')
          )
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${type}_${timestamp}.csv`;
        link.click();
      } else {
        // JSON export
        const blob = new Blob([JSON.stringify(filteredItems, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${type}_${timestamp}.json`;
        link.click();
      }
    }, [filteredItems, type]);

    const importData = useCallback(async (data: T[]): Promise<void> => {
      if (!user?.user_id) throw new Error('User not authenticated');

      const errors: string[] = [];
      let successCount = 0;

      for (const item of data) {
        try {
          await create(item);
          successCount++;
        } catch (error: any) {
          errors.push(`${item[idField]}: ${error.message}`);
        }
      }

      if (errors.length > 0) {
        toast({
          title: 'Импорт завершен с ошибками',
          description: `Успешно: ${successCount}, Ошибок: ${errors.length}`,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Импорт завершен',
          description: `Импортировано записей: ${successCount}`
        });
      }
    }, [user?.user_id, create, idField]);

    return {
      // Data
      items,
      loading,
      error,
      isDirty,
      
      // Selection
      selectedItems,
      selectItem,
      deselectItem,
      selectAll,
      deselectAll,
      
      // Search and sort
      searchTerm,
      setSearchTerm,
      sortBy,
      setSortBy,
      sortOrder,
      toggleSortOrder,
      
      // Filtered data
      filteredItems,
      
      // CRUD operations
      create,
      update,
      delete: deleteItem,
      bulkDelete,
      
      // Validation
      validate,
      
      // Sync
      refresh,
      sync,
      
      // Undo/Redo
      canUndo,
      canRedo,
      undo,
      redo,
      
      // Utilities
      findById,
      export: exportData,
      import: importData
    };
  };
}

// Export specific hooks
export const usePeriods = createReferenceDataHook<Period>(
  usePeriodStore,
  'period',
  'period_id'
);

export const useFinancialCenters = createReferenceDataHook<FinancialCenter>(
  useFinancialCenterStore,
  'financial_center',
  'financial_center_id'
);

export const useCostCenters = createReferenceDataHook<CostCenter>(
  useCostCenterStore,
  'cost_center',
  'cost_center_id'
);

export const useNomenclatures = createReferenceDataHook<Nomenclature>(
  useNomenclatureStore,
  'nomenclature',
  'nomenclature_id'
);

export const useProducts = createReferenceDataHook<Product>(
  useProductStore,
  'product',
  'product_id'
);

// Global sync hook
export function useGlobalReferenceDataSync() {
  const { user } = useAuthStore();
  
  const syncAll = useCallback(async () => {
    if (!user?.user_id) return;
    
    const stores = [
      usePeriodStore,
      useFinancialCenterStore,
      useCostCenterStore,
      useNomenclatureStore,
      useProductStore
    ];
    
    await Promise.all(
      stores.map(store => store.getState().syncWithServer(user.user_id))
    );
    
    toast({
      title: 'Синхронизация завершена',
      description: 'Все справочники обновлены'
    });
  }, [user?.user_id]);
  
  return { syncAll };
}

// Performance monitoring hook
export function useReferenceDataPerformance() {
  const [performanceMetrics, setPerformanceMetrics] = useState({
    cacheHitRate: 0,
    averageResponseTime: 0,
    errorRate: 0,
    syncFrequency: 0
  });
  
  // This would collect actual metrics in a real implementation
  useEffect(() => {
    // Mock performance data
    setPerformanceMetrics({
      cacheHitRate: 0.85,
      averageResponseTime: 120,
      errorRate: 0.02,
      syncFrequency: 15
    });
  }, []);
  
  return performanceMetrics;
}
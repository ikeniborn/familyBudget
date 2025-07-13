import { useState, useCallback, useRef, useEffect } from 'react';

// Types for optimistic updates
export interface OptimisticUpdate<T> {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  data: T;
  originalData?: T;
  timestamp: number;
  retry?: () => Promise<void>;
}

export interface OptimisticState<T> {
  data: T[];
  pendingUpdates: Map<string, OptimisticUpdate<T>>;
  errors: Map<string, Error>;
}

export interface OptimisticOptions<T> {
  getId: (item: T) => string | number;
  onError?: (error: Error, update: OptimisticUpdate<T>) => void;
  onSuccess?: (update: OptimisticUpdate<T>) => void;
  rollbackOnError?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

// Hook for optimistic updates
export const useOptimisticUpdates = <T>(
  initialData: T[] = [],
  options: OptimisticOptions<T>
) => {
  const {
    getId,
    onError,
    onSuccess,
    rollbackOnError = true,
    maxRetries = 3,
    retryDelay = 1000
  } = options;

  const [state, setState] = useState<OptimisticState<T>>({
    data: initialData,
    pendingUpdates: new Map(),
    errors: new Map()
  });

  const retryCountRef = useRef<Map<string, number>>(new Map());

  // Generate unique update ID
  const generateUpdateId = useCallback(() => {
    return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Apply optimistic update
  const applyOptimisticUpdate = useCallback((update: OptimisticUpdate<T>) => {
    setState(prev => {
      const newData = [...prev.data];
      const itemId = getId(update.data);
      const existingIndex = newData.findIndex(item => getId(item) === itemId);

      switch (update.type) {
        case 'CREATE':
          newData.push(update.data);
          break;
        case 'UPDATE':
          if (existingIndex >= 0) {
            newData[existingIndex] = update.data;
          }
          break;
        case 'DELETE':
          if (existingIndex >= 0) {
            newData.splice(existingIndex, 1);
          }
          break;
      }

      const newPendingUpdates = new Map(prev.pendingUpdates);
      newPendingUpdates.set(update.id, update);

      return {
        ...prev,
        data: newData,
        pendingUpdates: newPendingUpdates
      };
    });
  }, [getId]);

  // Rollback optimistic update
  const rollbackOptimisticUpdate = useCallback((updateId: string) => {
    setState(prev => {
      const update = prev.pendingUpdates.get(updateId);
      if (!update) return prev;

      const newData = [...prev.data];
      const itemId = getId(update.data);
      const existingIndex = newData.findIndex(item => getId(item) === itemId);

      switch (update.type) {
        case 'CREATE':
          // Remove the optimistically added item
          const createdIndex = newData.findIndex(item => getId(item) === itemId);
          if (createdIndex >= 0) {
            newData.splice(createdIndex, 1);
          }
          break;
        case 'UPDATE':
          // Restore original data
          if (existingIndex >= 0 && update.originalData) {
            newData[existingIndex] = update.originalData;
          }
          break;
        case 'DELETE':
          // Restore the deleted item
          if (update.originalData) {
            newData.push(update.originalData);
          }
          break;
      }

      const newPendingUpdates = new Map(prev.pendingUpdates);
      newPendingUpdates.delete(updateId);

      return {
        ...prev,
        data: newData,
        pendingUpdates: newPendingUpdates
      };
    });
  }, [getId]);

  // Confirm optimistic update (when server confirms)
  const confirmOptimisticUpdate = useCallback((updateId: string, serverData?: T) => {
    setState(prev => {
      const update = prev.pendingUpdates.get(updateId);
      if (!update) return prev;

      let newData = [...prev.data];

      // If server returns updated data, use it
      if (serverData) {
        const itemId = getId(update.data);
        const existingIndex = newData.findIndex(item => getId(item) === itemId);
        
        if (existingIndex >= 0) {
          newData[existingIndex] = serverData;
        }
      }

      const newPendingUpdates = new Map(prev.pendingUpdates);
      newPendingUpdates.delete(updateId);

      const newErrors = new Map(prev.errors);
      newErrors.delete(updateId);

      return {
        ...prev,
        data: newData,
        pendingUpdates: newPendingUpdates,
        errors: newErrors
      };
    });

    // Call success callback
    const update = state.pendingUpdates.get(updateId);
    if (update) {
      onSuccess?.(update);
    }
  }, [getId, onSuccess, state.pendingUpdates]);

  // Handle optimistic update error
  const handleOptimisticError = useCallback((updateId: string, error: Error) => {
    const update = state.pendingUpdates.get(updateId);
    if (!update) return;

    const currentRetries = retryCountRef.current.get(updateId) || 0;

    if (currentRetries < maxRetries && update.retry) {
      // Retry the operation
      retryCountRef.current.set(updateId, currentRetries + 1);
      
      setTimeout(async () => {
        try {
          await update.retry!();
          confirmOptimisticUpdate(updateId);
        } catch (retryError) {
          handleOptimisticError(updateId, retryError as Error);
        }
      }, retryDelay * Math.pow(2, currentRetries)); // Exponential backoff
    } else {
      // Max retries reached or no retry function
      setState(prev => {
        const newErrors = new Map(prev.errors);
        newErrors.set(updateId, error);
        
        return {
          ...prev,
          errors: newErrors
        };
      });

      // Rollback if configured
      if (rollbackOnError) {
        rollbackOptimisticUpdate(updateId);
      }

      onError?.(error, update);
    }
  }, [state.pendingUpdates, maxRetries, retryDelay, rollbackOnError, confirmOptimisticUpdate, rollbackOptimisticUpdate, onError]);

  // Create optimistic operation
  const createOptimistic = useCallback(async (
    data: T,
    serverOperation: () => Promise<T | void>
  ): Promise<string> => {
    const updateId = generateUpdateId();
    const update: OptimisticUpdate<T> = {
      id: updateId,
      type: 'CREATE',
      data,
      timestamp: Date.now(),
      retry: serverOperation
    };

    applyOptimisticUpdate(update);

    try {
      const result = await serverOperation();
      confirmOptimisticUpdate(updateId, result || data);
    } catch (error) {
      handleOptimisticError(updateId, error as Error);
    }

    return updateId;
  }, [generateUpdateId, applyOptimisticUpdate, confirmOptimisticUpdate, handleOptimisticError]);

  // Update optimistic operation
  const updateOptimistic = useCallback(async (
    data: T,
    serverOperation: () => Promise<T | void>
  ): Promise<string> => {
    const updateId = generateUpdateId();
    const itemId = getId(data);
    const existingItem = state.data.find(item => getId(item) === itemId);

    const update: OptimisticUpdate<T> = {
      id: updateId,
      type: 'UPDATE',
      data,
      originalData: existingItem,
      timestamp: Date.now(),
      retry: serverOperation
    };

    applyOptimisticUpdate(update);

    try {
      const result = await serverOperation();
      confirmOptimisticUpdate(updateId, result || data);
    } catch (error) {
      handleOptimisticError(updateId, error as Error);
    }

    return updateId;
  }, [generateUpdateId, getId, state.data, applyOptimisticUpdate, confirmOptimisticUpdate, handleOptimisticError]);

  // Delete optimistic operation
  const deleteOptimistic = useCallback(async (
    data: T,
    serverOperation: () => Promise<void>
  ): Promise<string> => {
    const updateId = generateUpdateId();
    const update: OptimisticUpdate<T> = {
      id: updateId,
      type: 'DELETE',
      data,
      originalData: data,
      timestamp: Date.now(),
      retry: serverOperation
    };

    applyOptimisticUpdate(update);

    try {
      await serverOperation();
      confirmOptimisticUpdate(updateId);
    } catch (error) {
      handleOptimisticError(updateId, error as Error);
    }

    return updateId;
  }, [generateUpdateId, applyOptimisticUpdate, confirmOptimisticUpdate, handleOptimisticError]);

  // Retry failed operation
  const retryOperation = useCallback(async (updateId: string) => {
    const update = state.pendingUpdates.get(updateId);
    if (!update || !update.retry) return;

    try {
      await update.retry();
      confirmOptimisticUpdate(updateId);
    } catch (error) {
      handleOptimisticError(updateId, error as Error);
    }
  }, [state.pendingUpdates, confirmOptimisticUpdate, handleOptimisticError]);

  // Clear error
  const clearError = useCallback((updateId: string) => {
    setState(prev => {
      const newErrors = new Map(prev.errors);
      newErrors.delete(updateId);
      return {
        ...prev,
        errors: newErrors
      };
    });
  }, []);

  // Reset all optimistic updates
  const resetOptimistic = useCallback(() => {
    setState({
      data: initialData,
      pendingUpdates: new Map(),
      errors: new Map()
    });
    retryCountRef.current.clear();
  }, [initialData]);

  // Sync data from server
  const syncFromServer = useCallback((serverData: T[]) => {
    setState(prev => {
      // Keep pending updates but update base data
      let newData = [...serverData];

      // Reapply pending updates
      for (const update of prev.pendingUpdates.values()) {
        const itemId = getId(update.data);
        const existingIndex = newData.findIndex(item => getId(item) === itemId);

        switch (update.type) {
          case 'CREATE':
            if (existingIndex < 0) {
              newData.push(update.data);
            }
            break;
          case 'UPDATE':
            if (existingIndex >= 0) {
              newData[existingIndex] = update.data;
            }
            break;
          case 'DELETE':
            if (existingIndex >= 0) {
              newData.splice(existingIndex, 1);
            }
            break;
        }
      }

      return {
        ...prev,
        data: newData
      };
    });
  }, [getId]);

  // Get optimistic state info
  const getOptimisticInfo = useCallback(() => {
    return {
      hasPendingUpdates: state.pendingUpdates.size > 0,
      hasErrors: state.errors.size > 0,
      pendingCount: state.pendingUpdates.size,
      errorCount: state.errors.size,
      pendingUpdates: Array.from(state.pendingUpdates.values()),
      errors: Array.from(state.errors.entries())
    };
  }, [state.pendingUpdates, state.errors]);

  return {
    data: state.data,
    createOptimistic,
    updateOptimistic,
    deleteOptimistic,
    retryOperation,
    clearError,
    resetOptimistic,
    syncFromServer,
    rollbackOptimisticUpdate,
    confirmOptimisticUpdate,
    getOptimisticInfo,
    pendingUpdates: state.pendingUpdates,
    errors: state.errors
  };
};

// Higher-order hook for reference data with optimistic updates
export const useOptimisticReferenceData = <T>(
  service: {
    getAll: (userId: number) => Promise<T[]>;
    create: (data: Omit<T, 'id'>, userId: number) => Promise<T>;
    update: (id: string | number, data: Partial<T>, userId: number) => Promise<T>;
    delete: (id: string | number, userId: number) => Promise<void>;
  },
  userId: number,
  getId: (item: T) => string | number
) => {
  const [initialData, setInitialData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const optimistic = useOptimisticUpdates(initialData, {
    getId,
    rollbackOnError: true,
    maxRetries: 3,
    onError: (err, update) => {
      console.error(`Optimistic ${update.type} failed:`, err);
    }
  });

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await service.getAll(userId);
        setInitialData(data);
        optimistic.syncFromServer(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]);

  // Create with optimistic update
  const create = useCallback(async (data: Omit<T, 'id'>) => {
    const tempId = `temp_${Date.now()}`;
    const optimisticData = { ...data, id: tempId } as T;

    return optimistic.createOptimistic(
      optimisticData,
      async () => {
        const result = await service.create(data, userId);
        return result;
      }
    );
  }, [optimistic, service, userId]);

  // Update with optimistic update
  const update = useCallback(async (id: string | number, data: Partial<T>) => {
    const existingItem = optimistic.data.find(item => getId(item) === id);
    if (!existingItem) throw new Error('Item not found');

    const updatedData = { ...existingItem, ...data };

    return optimistic.updateOptimistic(
      updatedData,
      async () => {
        const result = await service.update(id, data, userId);
        return result;
      }
    );
  }, [optimistic, service, userId, getId]);

  // Delete with optimistic update
  const deleteItem = useCallback(async (id: string | number) => {
    const existingItem = optimistic.data.find(item => getId(item) === id);
    if (!existingItem) throw new Error('Item not found');

    return optimistic.deleteOptimistic(
      existingItem,
      async () => {
        await service.delete(id, userId);
      }
    );
  }, [optimistic, service, userId, getId]);

  // Refresh data from server
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await service.getAll(userId);
      setInitialData(data);
      optimistic.syncFromServer(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  }, [service, userId, optimistic]);

  return {
    data: optimistic.data,
    loading,
    error,
    create,
    update,
    delete: deleteItem,
    refresh,
    retry: optimistic.retryOperation,
    clearError: optimistic.clearError,
    getOptimisticInfo: optimistic.getOptimisticInfo
  };
};
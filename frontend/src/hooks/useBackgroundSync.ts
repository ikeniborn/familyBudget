import { useState, useEffect, useRef, useCallback } from 'react';

// Types for background sync
export interface SyncQueueItem {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'low' | 'normal' | 'high';
}

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  queueSize: number;
  lastSyncTime: number | null;
  errors: Array<{ item: SyncQueueItem; error: string }>;
}

export interface BackgroundSyncOptions {
  syncInterval?: number; // Auto-sync interval in ms
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
  enableAutoSync?: boolean;
  priorityMode?: boolean;
  persistQueue?: boolean;
  onSyncStart?: () => void;
  onSyncComplete?: (synced: number, failed: number) => void;
  onSyncError?: (error: string, item?: SyncQueueItem) => void;
  onConnectionChange?: (isOnline: boolean) => void;
}

// Service interface for sync operations
export interface SyncService {
  sync: (items: SyncQueueItem[]) => Promise<Array<{ success: boolean; item: SyncQueueItem; error?: string }>>;
}

// Hook for background synchronization
export const useBackgroundSync = (
  service: SyncService,
  options: BackgroundSyncOptions = {}
) => {
  const {
    syncInterval = 30000, // 30 seconds
    maxRetries = 3,
    retryDelay = 1000,
    batchSize = 10,
    enableAutoSync = true,
    priorityMode = true,
    persistQueue = true,
    onSyncStart,
    onSyncComplete,
    onSyncError,
    onConnectionChange
  } = options;

  const [state, setState] = useState<SyncState>({
    isOnline: navigator.onLine,
    isSyncing: false,
    queueSize: 0,
    lastSyncTime: null,
    errors: []
  });

  const syncQueue = useRef<SyncQueueItem[]>([]);
  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const isProcessingRef = useRef(false);

  // Load persisted queue on mount
  useEffect(() => {
    if (persistQueue) {
      try {
        const stored = localStorage.getItem('backgroundSyncQueue');
        if (stored) {
          syncQueue.current = JSON.parse(stored);
          setState(prev => ({ ...prev, queueSize: syncQueue.current.length }));
        }
      } catch (error) {
        console.error('Failed to load sync queue:', error);
      }
    }
  }, [persistQueue]);

  // Persist queue changes
  const persistSyncQueue = useCallback(() => {
    if (persistQueue) {
      try {
        localStorage.setItem('backgroundSyncQueue', JSON.stringify(syncQueue.current));
      } catch (error) {
        console.error('Failed to persist sync queue:', error);
      }
    }
  }, [persistQueue]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      onConnectionChange?.(true);
      // Trigger sync when coming back online
      if (syncQueue.current.length > 0) {
        scheduleSync();
      }
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
      onConnectionChange?.(false);
      // Cancel scheduled sync
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onConnectionChange]);

  // Generate unique ID for sync items
  const generateSyncId = useCallback(() => {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Add item to sync queue
  const addToSyncQueue = useCallback((
    type: SyncQueueItem['type'],
    entityType: string,
    data: any,
    priority: SyncQueueItem['priority'] = 'normal'
  ) => {
    const item: SyncQueueItem = {
      id: generateSyncId(),
      type,
      entityType,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
      priority
    };

    syncQueue.current.push(item);
    
    // Sort by priority if enabled
    if (priorityMode) {
      syncQueue.current.sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    }

    setState(prev => ({ ...prev, queueSize: syncQueue.current.length }));
    persistSyncQueue();

    // Schedule sync if online and auto-sync is enabled
    if (state.isOnline && enableAutoSync) {
      scheduleSync();
    }

    return item.id;
  }, [generateSyncId, maxRetries, priorityMode, state.isOnline, enableAutoSync, persistSyncQueue]);

  // Remove item from sync queue
  const removeFromSyncQueue = useCallback((itemId: string) => {
    const index = syncQueue.current.findIndex(item => item.id === itemId);
    if (index >= 0) {
      syncQueue.current.splice(index, 1);
      setState(prev => ({ ...prev, queueSize: syncQueue.current.length }));
      persistSyncQueue();
    }
  }, [persistSyncQueue]);

  // Process sync queue
  const processSyncQueue = useCallback(async () => {
    if (isProcessingRef.current || !state.isOnline || syncQueue.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;
    setState(prev => ({ ...prev, isSyncing: true }));
    onSyncStart?.();

    try {
      // Get items to sync (respecting batch size)
      const itemsToSync = syncQueue.current.slice(0, batchSize);
      
      if (itemsToSync.length === 0) {
        return;
      }

      // Attempt to sync items
      const results = await service.sync(itemsToSync);
      
      let syncedCount = 0;
      let failedCount = 0;
      const newErrors: Array<{ item: SyncQueueItem; error: string }> = [];

      // Process results
      for (const result of results) {
        if (result.success) {
          // Remove successfully synced item
          removeFromSyncQueue(result.item.id);
          syncedCount++;
        } else {
          // Handle failed sync
          const item = syncQueue.current.find(i => i.id === result.item.id);
          if (item) {
            item.retryCount++;
            
            if (item.retryCount >= item.maxRetries) {
              // Max retries reached, remove from queue and add to errors
              removeFromSyncQueue(item.id);
              newErrors.push({ item, error: result.error || 'Max retries exceeded' });
              failedCount++;
            } else {
              // Schedule retry with exponential backoff
              setTimeout(() => {
                scheduleSync();
              }, retryDelay * Math.pow(2, item.retryCount));
            }
          }
        }
      }

      // Update state
      setState(prev => ({
        ...prev,
        lastSyncTime: Date.now(),
        errors: [...prev.errors, ...newErrors]
      }));

      // Report sync completion
      onSyncComplete?.(syncedCount, failedCount);

      // Continue processing if there are more items
      if (syncQueue.current.length > 0) {
        setTimeout(() => {
          processSyncQueue();
        }, 100);
      }

    } catch (error: any) {
      onSyncError?.(error.message || 'Sync failed');
    } finally {
      isProcessingRef.current = false;
      setState(prev => ({ ...prev, isSyncing: false }));
    }
  }, [state.isOnline, batchSize, service, removeFromSyncQueue, retryDelay, onSyncStart, onSyncComplete, onSyncError]);

  // Schedule sync
  const scheduleSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      processSyncQueue();
    }, 100);
  }, [processSyncQueue]);

  // Auto-sync interval
  useEffect(() => {
    if (enableAutoSync && syncInterval > 0) {
      const interval = setInterval(() => {
        if (state.isOnline && syncQueue.current.length > 0) {
          processSyncQueue();
        }
      }, syncInterval);

      return () => clearInterval(interval);
    }
  }, [enableAutoSync, syncInterval, state.isOnline, processSyncQueue]);

  // Manual sync trigger
  const forcSync = useCallback(async () => {
    if (!state.isOnline) {
      throw new Error('Cannot sync while offline');
    }
    await processSyncQueue();
  }, [state.isOnline, processSyncQueue]);

  // Clear sync queue
  const clearSyncQueue = useCallback(() => {
    syncQueue.current = [];
    setState(prev => ({ ...prev, queueSize: 0 }));
    persistSyncQueue();
  }, [persistSyncQueue]);

  // Clear sync errors
  const clearSyncErrors = useCallback(() => {
    setState(prev => ({ ...prev, errors: [] }));
  }, []);

  // Retry failed item
  const retryFailedItem = useCallback((itemId: string) => {
    const error = state.errors.find(e => e.item.id === itemId);
    if (error) {
      // Reset retry count and add back to queue
      const item = { ...error.item, retryCount: 0 };
      syncQueue.current.push(item);
      
      setState(prev => ({
        ...prev,
        queueSize: syncQueue.current.length,
        errors: prev.errors.filter(e => e.item.id !== itemId)
      }));
      
      persistSyncQueue();
      
      if (state.isOnline) {
        scheduleSync();
      }
    }
  }, [state.errors, state.isOnline, persistSyncQueue, scheduleSync]);

  // Get sync statistics
  const getSyncStats = useCallback(() => {
    const now = Date.now();
    const queueItems = syncQueue.current;
    
    return {
      totalQueued: queueItems.length,
      highPriority: queueItems.filter(i => i.priority === 'high').length,
      normalPriority: queueItems.filter(i => i.priority === 'normal').length,
      lowPriority: queueItems.filter(i => i.priority === 'low').length,
      oldestItem: queueItems.length > 0 
        ? Math.min(...queueItems.map(i => i.timestamp))
        : null,
      avgAge: queueItems.length > 0
        ? queueItems.reduce((sum, i) => sum + (now - i.timestamp), 0) / queueItems.length
        : 0,
      errorCount: state.errors.length,
      lastSyncAge: state.lastSyncTime ? now - state.lastSyncTime : null
    };
  }, [state.errors.length, state.lastSyncTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    addToSyncQueue,
    removeFromSyncQueue,
    forcSync,
    clearSyncQueue,
    clearSyncErrors,
    retryFailedItem,
    
    // Info
    getSyncStats,
    queuedItems: syncQueue.current
  };
};

// Default sync service implementation
export const createDefaultSyncService = (
  apiEndpoint: string,
  authToken?: string
): SyncService => {
  return {
    async sync(items: SyncQueueItem[]) {
      const results = [];
      
      for (const item of items) {
        try {
          const response = await fetch(`${apiEndpoint}/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            },
            body: JSON.stringify({
              type: item.type,
              entityType: item.entityType,
              data: item.data,
              timestamp: item.timestamp
            })
          });

          if (response.ok) {
            results.push({ success: true, item });
          } else {
            const errorText = await response.text();
            results.push({ 
              success: false, 
              item, 
              error: `HTTP ${response.status}: ${errorText}` 
            });
          }
        } catch (error: any) {
          results.push({ 
            success: false, 
            item, 
            error: error.message || 'Network error' 
          });
        }
      }
      
      return results;
    }
  };
};

// Hook for entity-specific background sync
export const useEntitySync = <T>(
  entityType: string,
  service: SyncService,
  options: BackgroundSyncOptions = {}
) => {
  const backgroundSync = useBackgroundSync(service, options);

  const syncCreate = useCallback((data: T, priority: SyncQueueItem['priority'] = 'normal') => {
    return backgroundSync.addToSyncQueue('CREATE', entityType, data, priority);
  }, [backgroundSync, entityType]);

  const syncUpdate = useCallback((data: T, priority: SyncQueueItem['priority'] = 'normal') => {
    return backgroundSync.addToSyncQueue('UPDATE', entityType, data, priority);
  }, [backgroundSync, entityType]);

  const syncDelete = useCallback((data: T, priority: SyncQueueItem['priority'] = 'high') => {
    return backgroundSync.addToSyncQueue('DELETE', entityType, data, priority);
  }, [backgroundSync, entityType]);

  const getEntityQueue = useCallback(() => {
    return backgroundSync.queuedItems.filter(item => item.entityType === entityType);
  }, [backgroundSync.queuedItems, entityType]);

  return {
    ...backgroundSync,
    syncCreate,
    syncUpdate,
    syncDelete,
    getEntityQueue
  };
};
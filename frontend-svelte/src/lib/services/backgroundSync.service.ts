import { browser } from '$app/environment';
import { api } from './api';

export interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  resource: string; // 'registry', 'budget', etc.
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
}

class BackgroundSyncService {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private syncInProgress = false;
  private readonly DB_NAME = 'FamilyBudgetSync';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'syncOperations';

  constructor() {
    if (browser) {
      this.initializeDB();
      this.setupEventListeners();
    }
  }

  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store for sync operations
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('type', 'type');
          store.createIndex('resource', 'resource');
        }
      };
    });
  }

  private setupEventListeners(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('Device is online, starting background sync...');
      this.processPendingOperations();
    });

    // Register for background sync if supported
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        // Send message to service worker to set up sync handler
        if (registration.active) {
          registration.active.postMessage({
            type: 'SETUP_BACKGROUND_SYNC'
          });
        }
      });
    }

    // Listen for visibility change to sync when app becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && navigator.onLine) {
        this.processPendingOperations();
      }
    });
  }

  // Queue an operation for background sync
  async queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    if (!this.isInitialized || !this.db) {
      await this.initializeDB();
    }

    const syncOperation: SyncOperation = {
      ...operation,
      id: `${operation.resource}_${operation.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.add(syncOperation);

      request.onsuccess = () => {
        console.log('Operation queued for sync:', syncOperation.id);
        resolve();
        
        // Try to sync immediately if online
        if (navigator.onLine) {
          this.processPendingOperations();
        }
      };

      request.onerror = () => {
        console.error('Failed to queue operation:', request.error);
        reject(request.error);
      };
    });
  }

  // Process all pending operations
  async processPendingOperations(): Promise<void> {
    if (!this.isInitialized || !this.db || this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;

    try {
      const operations = await this.getPendingOperations();
      console.log(`Processing ${operations.length} pending operations`);

      for (const operation of operations) {
        try {
          await this.executeOperation(operation);
          await this.removeOperation(operation.id);
        } catch (error) {
          console.error(`Failed to execute operation ${operation.id}:`, error);
          await this.handleOperationFailure(operation, error);
        }
      }

      // Notify UI about sync completion
      this.dispatchSyncEvent('sync-completed', { 
        processedCount: operations.length 
      });

    } catch (error) {
      console.error('Error processing pending operations:', error);
      this.dispatchSyncEvent('sync-error', { error });
    } finally {
      this.syncInProgress = false;
    }
  }

  private async getPendingOperations(): Promise<SyncOperation[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onsuccess = () => {
        const operations = request.result as SyncOperation[];
        // Sort by timestamp to process in order
        operations.sort((a, b) => a.timestamp - b.timestamp);
        resolve(operations);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  private async executeOperation(operation: SyncOperation): Promise<void> {
    const { type, resource, data } = operation;

    switch (resource) {
      case 'registry':
        await this.syncRegistryOperation(type, data);
        break;
      case 'budget':
        await this.syncBudgetOperation(type, data);
        break;
      case 'nomenclature':
        await this.syncNomenclatureOperation(type, data);
        break;
      case 'cost-center':
        await this.syncCostCenterOperation(type, data);
        break;
      case 'financial-center':
        await this.syncFinancialCenterOperation(type, data);
        break;
      case 'period':
        await this.syncPeriodOperation(type, data);
        break;
      default:
        throw new Error(`Unknown resource type: ${resource}`);
    }
  }

  private async syncRegistryOperation(type: SyncOperation['type'], data: any): Promise<void> {
    switch (type) {
      case 'CREATE':
        await api.registry.create(data);
        break;
      case 'UPDATE':
        await api.registry.update(data.id, data);
        break;
      case 'DELETE':
        await api.registry.delete(data.id);
        break;
    }
  }

  private async syncBudgetOperation(type: SyncOperation['type'], data: any): Promise<void> {
    // Similar implementations for other resources
    // This would call the appropriate API methods
    console.log('Syncing budget operation:', type, data);
  }

  private async syncNomenclatureOperation(type: SyncOperation['type'], data: any): Promise<void> {
    switch (type) {
      case 'CREATE':
        // Implement nomenclature create
        break;
      case 'UPDATE':
        // Implement nomenclature update
        break;
      case 'DELETE':
        // Implement nomenclature delete
        break;
    }
  }

  private async syncCostCenterOperation(type: SyncOperation['type'], data: any): Promise<void> {
    // Similar implementation
    console.log('Syncing cost center operation:', type, data);
  }

  private async syncFinancialCenterOperation(type: SyncOperation['type'], data: any): Promise<void> {
    // Similar implementation
    console.log('Syncing financial center operation:', type, data);
  }

  private async syncPeriodOperation(type: SyncOperation['type'], data: any): Promise<void> {
    // Similar implementation
    console.log('Syncing period operation:', type, data);
  }

  private async handleOperationFailure(operation: SyncOperation, error: any): Promise<void> {
    operation.retryCount++;
    operation.lastError = error.message || 'Unknown error';

    if (operation.retryCount < operation.maxRetries) {
      // Update operation with new retry count
      await this.updateOperation(operation);
      console.log(`Operation ${operation.id} failed, will retry (${operation.retryCount}/${operation.maxRetries})`);
    } else {
      // Max retries reached, remove operation and notify user
      await this.removeOperation(operation.id);
      console.error(`Operation ${operation.id} failed permanently after ${operation.maxRetries} retries`);
      
      this.dispatchSyncEvent('sync-operation-failed', {
        operation,
        error
      });
    }
  }

  private async updateOperation(operation: SyncOperation): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(operation);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async removeOperation(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private dispatchSyncEvent(type: string, detail: any): void {
    const event = new CustomEvent(`backgroundSync:${type}`, { detail });
    window.dispatchEvent(event);
  }

  // Get pending operations count for UI
  async getPendingOperationsCount(): Promise<number> {
    if (!this.isInitialized || !this.db) {
      return 0;
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve(0);
        return;
      }

      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all pending operations (for debugging)
  async clearAllOperations(): Promise<void> {
    if (!this.isInitialized || !this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const backgroundSyncService = browser ? new BackgroundSyncService() : null;

// Convenience functions for queueing common operations
export const queueRegistryCreate = (data: any) => {
  return backgroundSyncService?.queueOperation({
    type: 'CREATE',
    resource: 'registry',
    data,
    maxRetries: 3
  });
};

export const queueRegistryUpdate = (data: any) => {
  return backgroundSyncService?.queueOperation({
    type: 'UPDATE',
    resource: 'registry',
    data,
    maxRetries: 3
  });
};

export const queueRegistryDelete = (id: string) => {
  return backgroundSyncService?.queueOperation({
    type: 'DELETE',
    resource: 'registry',
    data: { id },
    maxRetries: 3
  });
};
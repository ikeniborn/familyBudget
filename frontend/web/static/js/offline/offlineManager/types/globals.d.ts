/**
 * Window namespace extensions for OfflineManager
 * Declares global window.offlineManager and related types
 */

import type { IIndexedDBManager } from './dependencies';

/**
 * OfflineManager class interface
 * Provides offline CRUD operations and synchronization
 */
export interface OfflineManagerClass {
  // ============================================================================
  // Initialization
  // ============================================================================
  db: IIndexedDBManager;
  isInitialized: boolean;
  initializeAsync(): Promise<void>;

  // ============================================================================
  // Network Status
  // ============================================================================
  isOnline(): boolean;

  // ============================================================================
  // Facts (Budget Transactions)
  // ============================================================================
  createFact(factData: any): Promise<any>;
  updateFact(factId: number, updates: any): Promise<any>;
  deleteFact(factId: number): Promise<any>;
  createFactOffline(factData: any): Promise<string>;
  updateFactOffline(factId: number, updates: any): Promise<void>;
  deleteFactOffline(factId: number): Promise<void>;

  // ============================================================================
  // Transfers
  // ============================================================================
  createTransferOffline(transferData: any): Promise<string>;

  // ============================================================================
  // Plans
  // ============================================================================
  createPlanOffline(planData: any): Promise<string>;

  // ============================================================================
  // Recurring Plans
  // ============================================================================
  createRecurringPlanOffline(planData: any): Promise<string>;

  // ============================================================================
  // Synchronization
  // ============================================================================
  syncAll(): Promise<void>;
}

/**
 * Current user information (set by backend template)
 */
export interface CurrentUser {
  id: number;
  email?: string;
  username?: string;
  telegram_id?: number;
}

/**
 * Worker Wrapper for async operations
 */
export interface IWorkerWrapper {
  execute(method: string, params: any): Promise<any>;
  terminate(): void;
  idleTimeout?: number;
}

/**
 * Feature flags debugging interface
 */
export interface OfflineFeatureFlagsDebug {
  get(): any;
  getStatus(): any;
  enable(feature: string): void;
  disable(feature: string): void;
  enableForPercentage(feature: string, percentage: number): void;
  resetAll(): void;
}

// Extend Window interface with typed globals
declare global {
  interface Window {
    // OfflineManager instance
    offlineManager?: OfflineManagerClass;

    // Current user (set by backend template in base.html)
    currentUser?: CurrentUser;

    // Debug mode flag
    DEBUG_MODE?: boolean;

    // Worker wrapper class (loaded globally)
    WorkerWrapper?: new (scriptURL: string, options?: any) => IWorkerWrapper;

    // Feature flags debugging interface
    offlineFeatureFlags?: OfflineFeatureFlagsDebug;

    // Budget WebSocket client
    budgetWSClient?: {
      connect(): void;
      disconnect(): void;
      setEnabled(enabled: boolean): void;
      getStatus(): string;
    };

    // Toast notification functions
    showToast?: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
    showToastWithAction?: (
      message: string,
      type: string,
      actionText: string,
      actionCallback: () => void
    ) => void;

    // Pending sync badge update
    updatePendingSyncBadge?: (count: number, syncInProgress: boolean) => void;
  }
}

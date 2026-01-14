/**
 * Dependency Injection interfaces for OfflineManager
 * ZERO DEPENDENCIES - Pure type definitions
 *
 * This module contains ONLY type definitions for external dependencies.
 * NO imports, NO business logic.
 */

export {}; // Force module scope

/**
 * IndexedDB Manager interface
 * Provides offline storage and synchronization queue management
 */
export interface IIndexedDBManager {
  // ============================================================================
  // Initialization
  // ============================================================================
  init(): Promise<void>;
  clearExpiredCache(): Promise<void>;

  // ============================================================================
  // Sync Queue Management
  // ============================================================================
  getSyncQueue(status?: 'pending' | 'failed' | 'syncing' | 'completed'): Promise<SyncQueueItem[]>;
  addToSyncQueue(queueItem: Partial<SyncQueueItem>): Promise<void>;
  updateSyncQueueItem(id: number, updates: Partial<SyncQueueItem>): Promise<void>;
  deleteSyncQueueItem(id: number): Promise<void>;
  clearCompletedSyncQueue(): Promise<number>;
  countSyncQueue(status: 'pending' | 'failed' | 'syncing' | 'completed'): Promise<number>;

  // ============================================================================
  // Facts (Budget Transactions)
  // ============================================================================
  addFact(fact: OfflineFact): Promise<void>;
  getFact(tempId: string): Promise<OfflineFact | undefined>;
  deleteFact(tempId: string): Promise<void>;

  // ============================================================================
  // Transfers
  // ============================================================================
  addTransfer(transfer: OfflineTransfer): Promise<void>;
  deleteTransfer(tempId: string): Promise<void>;

  // ============================================================================
  // Plans
  // ============================================================================
  addPlan(plan: OfflinePlan): Promise<void>;
  deletePlan(tempId: string): Promise<void>;

  // ============================================================================
  // Recurring Plans
  // ============================================================================
  addRecurringPlan(plan: OfflineRecurringPlan): Promise<void>;
  deleteRecurringPlan(tempId: string): Promise<void>;
  getAllRecurringPlans(includeExpired: boolean): Promise<OfflineRecurringPlan[]>;

  // ============================================================================
  // Deduplication & Hashing
  // ============================================================================
  generateContentHash(data: any): string;
  checkDuplicateByHash(hash: string): Promise<OfflineFact | undefined>;
  _md5(content: string): string;

  // ============================================================================
  // Statistics
  // ============================================================================
  getPendingCount(): Promise<number>;
  getInfo(): Promise<{ pendingCount: number; totalSize: number }>;

  // ============================================================================
  // Maintenance
  // ============================================================================
  clearAll(): Promise<void>;
}

/**
 * Network Detector interface
 * Provides network status detection and automatic offline mode
 */
export interface INetworkDetector {
  // ============================================================================
  // Network Status Detection
  // ============================================================================
  isOnline(): boolean;
  getStatus(): { online: boolean; auto: boolean };

  // ============================================================================
  // Request Feedback
  // ============================================================================
  onRequestSuccess(): void;
  onRequestFailure(): void;

  // ============================================================================
  // Auto Offline Mode
  // ============================================================================
  autoOfflineMode: boolean;
  enableAutoOfflineMode(): void;

  // ============================================================================
  // State Management
  // ============================================================================
  dispatchRestoredState?(): void;

  // ============================================================================
  // Event Listeners
  // ============================================================================
  addEventListener(event: 'online' | 'offline', handler: () => void): void;
  removeEventListener(event: 'online' | 'offline', handler: () => void): void;
}

/**
 * Web Worker Wrapper interface
 * Provides background processing for heavy operations
 */
export interface IWorkerWrapper {
  /**
   * Execute operation in Web Worker
   * @param operation - Operation name (e.g., 'generateSyncHash')
   * @param data - Data to process
   * @returns Promise with operation result
   */
  execute<T = any>(operation: string, data: any): Promise<T>;

  /**
   * Terminate worker and cleanup resources
   */
  terminate(): void;
}

/**
 * Budget WebSocket Client interface
 * Provides real-time updates and connection management
 */
export interface IBudgetWSClient {
  /**
   * Connect to WebSocket server
   */
  connect(): void;

  /**
   * Enable/disable WebSocket client
   * @param enabled - true to enable, false to disable
   */
  setEnabled(enabled: boolean): void;

  /**
   * Get WebSocket connection status
   * @returns Connection status object
   */
  getStatus(): { connected: boolean; enabled: boolean };

  /**
   * Connection status flag
   */
  isConnected: boolean;
}

/**
 * Sync Queue Item
 * Represents a pending synchronization operation
 */
export interface SyncQueueItem {
  id: number;
  entity_type: 'fact' | 'transfer' | 'plan' | 'recurring_plan' | 'list' | 'item';
  operation: 'create' | 'update' | 'delete';
  tempId: string;
  data: any;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  retries: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Offline Fact (Budget Transaction)
 */
export interface OfflineFact {
  tempId: string;
  user_id?: number;
  article_id: number;
  financial_center_id?: number;
  cost_center_id?: number;
  record_type: 'income' | 'expense';
  planned_date: string;
  money: number;
  transfer_id?: string;
  sync_hash?: string;
  fact_comment?: string;
}

/**
 * Offline Transfer
 */
export interface OfflineTransfer {
  tempId: string;
  user_id?: number;
  from_financial_center_id: number;
  to_financial_center_id: number;
  planned_date: string;
  money: number;
  sync_hash?: string;
}

/**
 * Offline Plan
 */
export interface OfflinePlan {
  tempId: string;
  user_id?: number;
  article_id: number;
  financial_center_id?: number;
  cost_center_id?: number;
  record_type: 'income' | 'expense';
  plan_period: string;
  money: number;
}

/**
 * Offline Recurring Plan
 */
export interface OfflineRecurringPlan {
  tempId: string;
  user_id?: number;
  article_id: number;
  financial_center_id?: number;
  cost_center_id?: number;
  record_type: 'income' | 'expense';
  money: number;
  frequency_type: 'monthly' | 'yearly';
  frequency_value: number;
  start_date: string;
  end_date?: string;
}

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

// Extend Window interface
declare global {
  interface Window {
    offlineManager?: OfflineManagerClass;
  }
}

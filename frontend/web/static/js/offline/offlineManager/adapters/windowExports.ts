/**
 * Window Exports Adapter
 * Provides backward compatibility for window.offlineManager
 *
 * This adapter ensures that existing code using window.offlineManager
 * continues to work without modifications while the new modular structure
 * is being integrated.
 */

import {
  initializeOfflineManager,
  isOnline,
  getState,
  createFact,
  createFactOffline,
  updateFact,
  updateFactOffline,
  deleteFact,
  deleteFactOffline,
  createTransfer,
  createTransferOffline,
  deleteTransfer,
  deleteTransferOffline,
  createPlan,
  createPlanOffline,
  updatePlan,
  deletePlan,
  createRecurringPlan,
  createRecurringPlanOffline,
  syncAll,
  getAllUnsyncedItems,
  updatePendingItemData,
  removePendingItem,
  getPendingSyncItems,
  getPendingCount,
} from '../index';
import type { IIndexedDBManager, INetworkDetector, IWorkerWrapper, IBudgetWSClient } from '../types/dependencies';

/**
 * OfflineManager class for backward compatibility
 * Proxies all calls to modular functions
 */
export class OfflineManager {
  /**
   * Constructor
   * @param db - IndexedDB manager (required)
   * @param networkDetector - Network detector (optional)
   * @param workerWrapper - Web Worker wrapper (optional)
   * @param wsClient - WebSocket client (optional)
   */
  constructor(
    db: IIndexedDBManager,
    networkDetector?: INetworkDetector,
    workerWrapper?: IWorkerWrapper,
    wsClient?: IBudgetWSClient
  ) {
    // Initialize state with dependencies
    initializeOfflineManager(db, networkDetector, workerWrapper, wsClient);
  }

  /**
   * Check if online
   */
  get isOnline(): boolean {
    return isOnline();
  }

  /**
   * Get IndexedDB manager instance
   */
  get db(): IIndexedDBManager {
    return getState().db;
  }

  /**
   * Get maxRetries configuration
   */
  get maxRetries(): number {
    return getState().maxRetries;
  }

  /**
   * Initialize (async)
   */
  async init(): Promise<void> {
    // Initialization already done in constructor
    return Promise.resolve();
  }

  // ============================================================================
  // Facts Operations
  // ============================================================================
  createFact = createFact;
  createFactOffline = createFactOffline;
  updateFact = updateFact;
  updateFactOffline = updateFactOffline;
  deleteFact = deleteFact;
  deleteFactOffline = deleteFactOffline;

  // ============================================================================
  // Transfers Operations
  // ============================================================================
  createTransfer = createTransfer;
  createTransferOffline = createTransferOffline;
  deleteTransfer = deleteTransfer;
  deleteTransferOffline = deleteTransferOffline;

  // ============================================================================
  // Plans Operations
  // ============================================================================
  createPlan = createPlan;
  createPlanOffline = createPlanOffline;
  updatePlan = updatePlan;
  deletePlan = deletePlan;
  createRecurringPlan = createRecurringPlan;
  createRecurringPlanOffline = createRecurringPlanOffline;

  // ============================================================================
  // Sync Operations
  // ============================================================================
  syncAll = syncAll;
  sync = syncAll; // Alias for backward compatibility

  // ============================================================================
  // Utility Methods
  // ============================================================================
  getAllUnsyncedItems = getAllUnsyncedItems;
  updatePendingItemData = updatePendingItemData;
  removePendingItem = removePendingItem;
  getPendingSyncItems = getPendingSyncItems;
  getPendingCount = getPendingCount;

  /**
   * Get current user ID (stub)
   * TODO: Implement proper user ID retrieval
   */
  async getCurrentUserId(): Promise<number> {
    // Try window.currentUser (set by backend template)
    if (typeof window !== 'undefined' && (window as any).currentUser?.id) {
      return (window as any).currentUser.id;
    }

    // Try fetch /api/v1/users/me
    try {
      const response = await fetch('/api/v1/users/me', {
        credentials: 'include',
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        const user = await response.json();
        if (user && user.id) return user.id;
      }
    } catch (e) {
      // Ignore errors
    }

    // Fallback: throw error
    throw new Error('Cannot get user ID for offline operation');
  }
}

/**
 * Export to window for global access
 * This maintains 100% backward compatibility with existing code
 */
if (typeof window !== 'undefined') {
  (window as any).OfflineManager = OfflineManager;
}

export default OfflineManager;

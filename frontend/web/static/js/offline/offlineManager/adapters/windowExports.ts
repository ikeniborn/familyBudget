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
  createFact,
  createFactOffline,
  updateFact,
  updateFactOffline,
  deleteFact,
  deleteFactOffline,
  createTransferOffline,
  deleteTransferOffline,
  createPlanOffline,
  createRecurringPlanOffline,
  syncAll,
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
  createTransferOffline = createTransferOffline;
  deleteTransferOffline = deleteTransferOffline;

  // ============================================================================
  // Plans Operations
  // ============================================================================
  createPlanOffline = createPlanOffline;
  createRecurringPlanOffline = createRecurringPlanOffline;

  // ============================================================================
  // Sync Operations
  // ============================================================================
  syncAll = syncAll;
  sync = syncAll; // Alias for backward compatibility
}

/**
 * Export to window for global access
 * This maintains 100% backward compatibility with existing code
 */
if (typeof window !== 'undefined') {
  (window as any).OfflineManager = OfflineManager;
}

export default OfflineManager;

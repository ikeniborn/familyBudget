/**
 * Offline Manager Barrel Export
 * Public API for offline operations and synchronization
 *
 * Usage:
 * ```typescript
 * import { initializeOfflineManager, createFact } from '@web/offline/offlineManager';
 *
 * // Initialize
 * await initializeOfflineManager(db, networkDetector);
 *
 * // Use
 * const fact = await createFact(factData);
 * ```
 */

// ============================================================================
// Core State
// ============================================================================
export {
  getState,
  updateState,
  resetState,
  initializeState,
  createInitialState,
} from './core/OfflineState';

export type {
  OfflineManagerState,
  PendingOperation,
  SyncResult,
} from './core/OfflineState';

// ============================================================================
// Core State Manager
// ============================================================================
export {
  initializeOfflineManager,
  isOnline,
  getNetworkStatus,
  setRefreshUICallback,
  getRefreshUICallback,
  isInitialized,
  isSyncInProgress,
} from './core/stateManager';

// ============================================================================
// Deduplication
// ============================================================================
export {
  createOperationKey,
  getPendingOperation,
  setPendingOperation,
  clearPendingOperation,
  withDeduplication,
} from './core/deduplication';

// ============================================================================
// Facts Operations
// ============================================================================
export {
  createFact,
  createFactOnline,
  createFactOffline,
  updateFact,
  updateFactOffline,
  deleteFact,
  deleteFactOffline,
} from './operations/factsOperations';

// ============================================================================
// Type Definitions (Dependencies)
// ============================================================================
export type {
  IIndexedDBManager,
  INetworkDetector,
  IWorkerWrapper,
  IBudgetWSClient,
  SyncQueueItem,
  OfflineFact,
  OfflineTransfer,
  OfflinePlan,
  OfflineRecurringPlan,
} from './types/dependencies';

// ============================================================================
// Global Window Type
// ============================================================================
export type { OfflineManagerClass } from './types/globals';

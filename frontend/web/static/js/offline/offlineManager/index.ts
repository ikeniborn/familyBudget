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
// Feature Flags
// ============================================================================
export {
  getFeatureFlags,
  enableFeature,
  disableFeature,
  enableForPercentage,
  getFeatureFlagsStatus,
  resetAllFeatures,
} from './core/featureFlags';

export type { OfflineFeatureFlags } from './core/featureFlags';

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
// Transfers Operations
// ============================================================================
export {
  createTransfer,
  createTransferOnline,
  createTransferOffline,
  deleteTransfer,
  deleteTransferOffline,
} from './operations/transfersOperations';

// ============================================================================
// Plans Operations
// ============================================================================
export {
  createPlanOffline,
  createRecurringPlanOffline,
} from './operations/plansOperations';

// ============================================================================
// Sync Engine
// ============================================================================
export {
  syncAll,
} from './sync/syncEngine';

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

// ============================================================================
// Window Export (Backward Compatibility)
// ============================================================================
export { OfflineManager, default } from './adapters/windowExports';

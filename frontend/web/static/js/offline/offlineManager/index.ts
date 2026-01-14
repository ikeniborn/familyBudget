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
  createPlan,
  createPlanOnline,
  createPlanOffline,
  updatePlan,
  deletePlan,
  createRecurringPlan,
  createRecurringPlanOnline,
  createRecurringPlanOffline,
  getPendingRecurringPlans,
} from './operations/plansOperations';

// ============================================================================
// Sync Engine
// ============================================================================
export {
  syncAll,
  clearCompletedSyncQueue,
} from './sync/syncEngine';

export {
  verifyOnServer,
  syncCreate,
  syncUpdate,
  syncDelete,
  isNetworkError,
  cleanDataForSync,
  calculateBackoffDelay,
} from './sync/syncDetails';

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
// WebSocket Adapter
// ============================================================================
export {
  initWS,
  disconnectWS,
  reconnectWS,
  getWSStatus,
  isWSConnected,
  sendWSMessage,
} from './adapters/wsAdapter';

// ============================================================================
// Global Window Type
// ============================================================================
export type { OfflineManagerClass } from './types/globals';

// ============================================================================
// Window Export (Backward Compatibility)
// ============================================================================
export { OfflineManager, default } from './adapters/windowExports';

/**
 * offlineManager - Public API for offline CRUD operations with sync
 *
 * Modular architecture (Phase 2.4: ES Modules Migration):
 * - core/: State management + queue operations
 * - operations/: CRUD operations (create, update, delete)
 * - sync/: Sync engine with retry logic
 *
 * Features:
 * - Offline CRUD for Facts, Transfers, Plans, Shopping Lists
 * - Automatic sync when network restored
 * - Background Sync API support (Chrome, Edge)
 * - Fallback for Safari (polling)
 * - Conflict resolution with retry logic
 * - SmartNetworkDetector integration
 * - Web Worker for sync hash generation
 *
 * Usage:
 * ```typescript
 * import OfflineManager from '@web/offline/offlineManager';
 *
 * const offlineManager = new OfflineManager();
 * await offlineManager.init();
 * await offlineManager.createFact(data);
 * ```
 */

// ============================================================================
// Core State
// ============================================================================

export { getState, updateState, resetState } from './core/OfflineState';
export type {
  OfflineState,
  SyncResult,
  OfflineManagerInfo,
  NetworkStatusChangeOptions
} from './core/OfflineState';

// ============================================================================
// Queue Manager (TODO: Create queueManager.ts)
// ============================================================================

/*
export {
  addToQueue,
  removeFromQueue,
  getQueueItems,
  clearQueue
} from './core/queueManager';
*/

// ============================================================================
// Create Operations (TODO: Create create.ts)
// ============================================================================

/*
export {
  createFact,
  createFactOnline,
  createFactOffline,
  createTransfer,
  createTransferOnline,
  createTransferOffline,
  createPlan,
  createPlanOnline,
  createPlanOffline,
  createRecurringPlan,
  createRecurringPlanOnline,
  createRecurringPlanOffline
} from './operations/create';
*/

// ============================================================================
// Update Operations (TODO: Create update.ts)
// ============================================================================

/*
export {
  updateFact,
  updateFactOnline,
  updateFactOffline
} from './operations/update';
*/

// ============================================================================
// Delete Operations (TODO: Create delete.ts)
// ============================================================================

/*
export {
  deleteFact,
  deleteFactOnline,
  deleteFactOffline
} from './operations/delete';
*/

// ============================================================================
// Sync Engine (TODO: Create syncEngine.ts)
// ============================================================================

/*
export {
  sync,
  syncQueue,
  syncItemEnhanced,
  syncCreateEnhanced,
  syncUpdateEnhanced,
  syncDeleteEnhanced
} from './sync/syncEngine';
*/

// ============================================================================
// Temporary: Re-export legacy class for compatibility
// ============================================================================

// TODO Phase 2.4: Remove after full modularization
// For now, we only have OfflineState, so we can't instantiate OfflineManager yet
// This will be uncommented once operation modules are created

/*
export class OfflineManager {
  constructor() {
    // Implementation using modules
  }
}

export default OfflineManager;
*/

/**
 * Offline Manager - Module Structure
 *
 * Phase 2.4: Foundation (types extracted)
 *
 * STATUS: offlineManager.ts (1,436 lines) - offline sync queue manager
 * STRATEGY: Types extracted, class remains for future gradual refactoring
 *
 * Current usage: window.offlineManager (global instance)
 */

// ============================================================================
// Type Definitions (Phase 2.4: Complete)
// ============================================================================

export {
    createInitialState,
    getState,
    updateState,
    resetState,
    initializeState
} from './core/OfflineState';

export type {
    SyncResult,
    OfflineManagerInfo,
    NetworkStatusChangeOptions,
    PendingOperation,
    OfflineManagerState
} from './core/OfflineState';

// ============================================================================
// Future Modules (not yet implemented)
// ============================================================================

/*
// Operations queue
export {
    queueCreate,
    queueUpdate,
    queueDelete,
    getPendingCount
} from './operations/queue';

// Sync engine
export {
    syncAll,
    syncOne,
    retryFailed
} from './sync/syncEngine';

// Network detection
export {
    detectNetworkStatus,
    onNetworkChange
} from './sync/networkDetector';

// Conflict resolution
export {
    resolveConflict,
    getConflictStrategy
} from './sync/conflictResolver';
*/

/**
 * Offline Manager - State Management
 *
 * Centralized state for offline operations queue and sync status.
 *
 * Phase 2.4: ES Modules Migration
 * Extracted from: frontend/web/static/js/offline/offlineManager.ts
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface SyncResult {
    success: boolean;
    error?: string;
    tempId?: string;
    serverId?: number;
}

export interface OfflineManagerInfo {
    online: boolean;
    pendingCount: number;
    syncInProgress: boolean;
    lastSyncAttempt: string | null;
}

export interface NetworkStatusChangeOptions {
    source?: string;
    [key: string]: any;
}

export interface PendingOperation {
    id: string;
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    entity: 'fact' | 'transfer' | 'plan' | 'shopping_list' | 'shopping_item';
    data: any;
    tempId?: string;
    retryCount: number;
    createdAt: number;
}

// ============================================================================
// State Interface
// ============================================================================

/**
 * Complete state for OfflineManager
 *
 * Manages:
 * - Pending operations queue (IndexedDB)
 * - Sync status and progress
 * - Network detection
 * - Retry logic
 */
export interface OfflineManagerState {
    // IndexedDB manager
    db: any; // IndexedDBManager

    // Sync status
    syncInProgress: boolean;
    isInitialized: boolean;

    // Retry configuration
    retryDelay: number;
    maxRetries: number;
    retryTimeout: ReturnType<typeof setTimeout> | null;

    // Toast debouncing
    lastToastTime: number;
    toastDebounceMs: number;
    lastOfflineToastTime: number;

    // Navigation detection
    isNavigating: boolean;
    navigationTimeout: ReturnType<typeof setTimeout> | null;

    // Pending operations map (dedupe)
    pendingCreates: Map<string, Promise<any>>;

    // Network detection
    networkDetector: any; // SmartNetworkDetector
    isFirstRequest: boolean;
    firstRequestTimeout: number;
    normalTimeout: number;
    optimizedTimeout: number;
}

// ============================================================================
// Initial State Factory
// ============================================================================

/**
 * Create initial Offline Manager state
 */
export function createInitialState(db: any): OfflineManagerState {
    return {
        // IndexedDB manager
        db,

        // Sync status
        syncInProgress: false,
        isInitialized: false,

        // Retry configuration
        retryDelay: 5000, // 5 seconds
        maxRetries: 3,
        retryTimeout: null,

        // Toast debouncing
        lastToastTime: 0,
        toastDebounceMs: 5000, // 5 seconds
        lastOfflineToastTime: 0,

        // Navigation detection
        isNavigating: false,
        navigationTimeout: null,

        // Pending operations
        pendingCreates: new Map(),

        // Network detection
        networkDetector: null,
        isFirstRequest: true,
        firstRequestTimeout: 8000, // 8 seconds for first request
        normalTimeout: 5000, // 5 seconds normally
        optimizedTimeout: 3000 // 3 seconds optimized
    };
}

// ============================================================================
// Singleton State (mimics class instance pattern)
// ============================================================================

let state: OfflineManagerState | null = null;

export const getState = (): OfflineManagerState => {
    if (!state) {
        throw new Error('[OfflineState] State not initialized. Call createInitialState() first.');
    }
    return state;
};

export const updateState = (updates: Partial<OfflineManagerState>): void => {
    if (!state) {
        throw new Error('[OfflineState] State not initialized. Call createInitialState() first.');
    }
    state = { ...state, ...updates };
};

export const resetState = (db: any): void => {
    state = createInitialState(db);
};

export const initializeState = (db: any): void => {
    state = createInitialState(db);
};

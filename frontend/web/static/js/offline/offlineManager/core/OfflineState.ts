/**
 * Offline Manager State Management
 *
 * Central state for offlineManager module.
 * This module has ZERO dependencies to prevent circular dependencies.
 *
 * Phase 2.4: ES Modules Migration
 * Extracted from: frontend/web/static/js/offline/offlineManager.ts lines 42-141
 */

export {}; // Force module scope

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

export interface OfflineState {
  // Database reference (IndexedDBManager)
  db: any;

  // Sync state
  syncInProgress: boolean;
  retryDelay: number;
  maxRetries: number;
  retryTimeout: ReturnType<typeof setTimeout> | null;

  // Initialization
  isInitialized: boolean;

  // Toast management (debouncing)
  lastToastTime: number;
  toastDebounceMs: number;
  lastOfflineToastTime: number;

  // Navigation detection
  isNavigating: boolean;
  navigationTimeout: ReturnType<typeof setTimeout> | null;

  // Deduplication cache
  pendingCreates: Map<string, Promise<any>>;

  // Adaptive timeout for cold backend
  isFirstRequest: boolean;
  firstRequestTimeout: number;
  normalTimeout: number;
  optimizedTimeout: number;

  // Network detector (SmartNetworkDetector)
  networkDetector: any;

  // Web Worker reference (class-level in original)
  workerWrapper: any;
}

// ============================================================================
// State Storage (Singleton)
// ============================================================================

let state: OfflineState = {
  // Database (will be set in init)
  db: null,

  // Sync state
  syncInProgress: false,
  retryDelay: 5000, // 5 seconds
  maxRetries: 5,
  retryTimeout: null,

  // Initialization
  isInitialized: false,

  // Toast management
  lastToastTime: 0,
  toastDebounceMs: 10000, // 10s to prevent spam
  lastOfflineToastTime: 0,

  // Navigation detection
  isNavigating: false,
  navigationTimeout: null,

  // Deduplication
  pendingCreates: new Map(),

  // Adaptive timeout
  isFirstRequest: true,
  firstRequestTimeout: 8000, // 8s for first request (cold backend)
  normalTimeout: 3000,       // 3s for normal requests
  optimizedTimeout: 2000,    // 2s optimized

  // Network detector
  networkDetector: null,

  // Web Worker
  workerWrapper: null
};

// ============================================================================
// State Accessors
// ============================================================================

/**
 * Get current offline manager state (read-only)
 */
export const getState = (): Readonly<OfflineState> => state;

/**
 * Update state (partial updates)
 *
 * @param updates - Partial state object with fields to update
 */
export const updateState = (updates: Partial<OfflineState>): void => {
  state = { ...state, ...updates };
};

/**
 * Reset state to initial values
 */
export const resetState = (): void => {
  // Clean up resources
  if (state.retryTimeout) {
    clearTimeout(state.retryTimeout);
  }
  if (state.navigationTimeout) {
    clearTimeout(state.navigationTimeout);
  }
  if (state.networkDetector) {
    // Network detector cleanup would be handled by its own module
    state.networkDetector = null;
  }

  // Reset state
  state = {
    db: null,
    syncInProgress: false,
    retryDelay: 5000,
    maxRetries: 5,
    retryTimeout: null,
    isInitialized: false,
    lastToastTime: 0,
    toastDebounceMs: 10000,
    lastOfflineToastTime: 0,
    isNavigating: false,
    navigationTimeout: null,
    pendingCreates: new Map(),
    isFirstRequest: true,
    firstRequestTimeout: 8000,
    normalTimeout: 3000,
    optimizedTimeout: 2000,
    networkDetector: null,
    workerWrapper: null
  };
};

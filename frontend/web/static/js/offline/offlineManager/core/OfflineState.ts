/**
 * Central state management for offline operations
 * ZERO DEPENDENCIES to prevent circular deps
 *
 * This module contains ONLY state definition and basic accessors.
 * NO business logic, NO external imports.
 */

export {}; // Force module scope

/**
 * Pending operation tracking for deduplication
 */
export interface PendingOperation {
  operationKey: string;
  promise: Promise<any>;
  timestamp: number;
}

/**
 * Result of sync operation
 */
export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: Array<{ tempId: string; error: string }>;
}

/**
 * Complete state container for OfflineManager
 *
 * Organized into logical sections:
 * 1. Dependencies (injected via DI)
 * 2. Sync status
 * 3. Retry configuration
 * 4. Toast debouncing
 * 5. Navigation tracking
 * 6. Deduplication cache
 * 7. Adaptive timeout
 * 8. UI callback
 */
export interface OfflineManagerState {
  // ============================================================================
  // Dependencies (injected via Dependency Injection)
  // ============================================================================
  db: any; // IIndexedDBManager (avoid circular dependency)
  networkDetector: any | null; // INetworkDetector (optional)
  workerWrapper: any | null; // IWorkerWrapper (optional, Web Worker для тяжёлых операций)
  wsClient: any | null; // IBudgetWSClient (optional, для WebSocket integration)

  // ============================================================================
  // Sync status
  // ============================================================================
  syncInProgress: boolean;
  isInitialized: boolean;

  // ============================================================================
  // Retry configuration
  // ============================================================================
  retryDelay: number; // milliseconds between retries (default: 5000)
  maxRetries: number; // maximum retry attempts (default: 5)
  retryTimeout: ReturnType<typeof setTimeout> | null; // scheduled retry timeout ID

  // ============================================================================
  // Toast debouncing (prevent notification spam)
  // ============================================================================
  lastToastTime: number; // timestamp of last toast notification
  toastDebounceMs: number; // debounce interval in ms (default: 10000)
  lastOfflineToastTime: number; // timestamp of last offline save toast

  // ============================================================================
  // Navigation tracking (suppress false positive warnings during page transitions)
  // ============================================================================
  isNavigating: boolean; // true during beforeunload/HTMX navigation
  navigationTimeout: ReturnType<typeof setTimeout> | null; // navigation grace period timeout

  // ============================================================================
  // Deduplication cache (prevent concurrent duplicate creates)
  // ============================================================================
  pendingCreates: Map<string, PendingOperation>; // operationKey → Promise
  // Note: operationKey format: "${operation}_${entityType}_${contentHash}"
  // Example: "create_fact_abc123" prevents duplicate fact creation

  // ============================================================================
  // Adaptive timeout (cold backend warmup after restart)
  // ============================================================================
  isFirstRequest: boolean; // true until first successful request
  firstRequestTimeout: number; // timeout for cold backend (default: 8000ms, for DB/Redis warmup)
  normalTimeout: number; // timeout for warm backend (default: 3000ms)
  optimizedTimeout: number; // timeout after confirmed success (default: 2000ms)

  // ============================================================================
  // UI callback (for refreshing UI after operations)
  // ============================================================================
  refreshUICallback: ((event: string, data: any) => void) | null;
}

/**
 * Initial state factory
 * Creates fresh state with default values
 */
export const createInitialState = (db: any): OfflineManagerState => ({
  // Dependencies
  db,
  networkDetector: null,
  workerWrapper: null,
  wsClient: null,

  // Sync status
  syncInProgress: false,
  isInitialized: false,

  // Retry configuration
  retryDelay: 5000,
  maxRetries: 5,
  retryTimeout: null,

  // Toast debouncing
  lastToastTime: 0,
  toastDebounceMs: 10000,
  lastOfflineToastTime: 0,

  // Navigation tracking
  isNavigating: false,
  navigationTimeout: null,

  // Deduplication cache
  pendingCreates: new Map(),

  // Adaptive timeout
  isFirstRequest: true,
  firstRequestTimeout: 8000,
  normalTimeout: 3000,
  optimizedTimeout: 2000,

  // UI callback
  refreshUICallback: null,
});

/**
 * Internal singleton state
 * NEVER export this directly - use getState() instead
 */
let state: OfflineManagerState = createInitialState(null as any);

/**
 * Get readonly snapshot of current state
 * @returns Readonly state (prevents accidental mutations)
 */
export const getState = (): Readonly<OfflineManagerState> => state;

/**
 * Update state with partial updates
 * Uses spread operator for immutability
 *
 * @param updates - Partial state updates
 */
export const updateState = (updates: Partial<OfflineManagerState>): void => {
  state = { ...state, ...updates };
};

/**
 * Reset state to initial values
 * Useful for testing and cleanup
 *
 * @param db - Optional db reference to use (defaults to current state.db)
 *
 * NOTE: Preserves db reference (required for functioning), resets optional dependencies
 */
export const resetState = (db?: any): void => {
  // Clear timeouts to prevent memory leaks
  if (state.retryTimeout) {
    clearTimeout(state.retryTimeout);
  }
  if (state.navigationTimeout) {
    clearTimeout(state.navigationTimeout);
  }

  // Use provided db or preserve current db reference
  const dbToUse = db !== undefined ? db : state.db;
  state = createInitialState(dbToUse);
};

/**
 * Initialize state with dependencies (Dependency Injection)
 *
 * Call this ONCE during app initialization:
 * ```typescript
 * import { initializeState } from '@web/offline/offlineManager';
 *
 * const db = new IndexedDBManager();
 * const networkDetector = new SmartNetworkDetector();
 * initializeState(db, networkDetector);
 * ```
 *
 * @param db - IndexedDB manager (required)
 * @param networkDetector - Network status detector (optional)
 * @param workerWrapper - Web Worker wrapper (optional)
 * @param wsClient - WebSocket client (optional)
 */
export const initializeState = (
  db: any,
  networkDetector?: any,
  workerWrapper?: any,
  wsClient?: any
): void => {
  updateState({
    db,
    networkDetector: networkDetector || null,
    workerWrapper: workerWrapper || null,
    wsClient: wsClient || null,
    isInitialized: true,
  });
};

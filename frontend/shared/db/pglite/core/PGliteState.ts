/**
 * Central state for PGlite database
 * ZERO DEPENDENCIES to prevent circular deps
 */
export {};

/**
 * Initialization status for background PGlite setup
 *
 * Flow: not_started → initializing → validating → ready → active
 *
 * - not_started: PGlite disabled or first launch
 * - initializing: Background init in progress (IndexedDB, migrations, sync)
 * - validating: Running validation suite before marking ready
 * - ready: Fully initialized and validated, but user hasn't activated yet
 * - active: User opted-in, PGlite is actively used for queries
 * - error: Initialization failed (user continues on API)
 */
export type InitializationStatus =
  | 'not_started'
  | 'initializing'
  | 'validating'
  | 'ready'
  | 'active'
  | 'error';

/**
 * Connection status (existing, kept for backward compatibility)
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'syncing';

/**
 * Error type for conditional auto-recovery
 *
 * - initialization: Fatal errors during PGlite setup (NO auto-recovery, stay red)
 * - sync: Transient sync errors (auto-recover to green after 5s)
 * - null: Unknown error type (safe default, no auto-recovery)
 */
export type ErrorType = 'initialization' | 'sync' | null;

/**
 * Validation results from runValidationSuite()
 */
export interface ValidationResults {
  allPassed: boolean;
  schemaValid: boolean;
  referenceDataLoaded: boolean;
  queryTestsPassed: boolean;
  performanceAcceptable: boolean;
  timestamp: Date;
  details: {
    schemaVersion: number;
    expectedSchemaVersion: number;
    articleCount: number;
    financialCenterCount: number;
    costCenterCount: number;
    hierarchyCount: number;
    factCount: number;
    planCount: number;
    avgQueryTimeMs: number;
    maxQueryTimeMs: number;
  };
  errors: string[];
}

export interface PGliteState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any | null;                              // PGlite instance (any until task-002)
  isInitialized: boolean;
  connectionStatus: ConnectionStatus;
  initializationStatus: InitializationStatus;  // NEW: Background init status
  validationResults: ValidationResults | null; // NEW: Last validation results
  lastError: Error | null;                     // Changed from string to Error
  errorType: ErrorType;                        // NEW: Error type for conditional auto-recovery
}

// Initial state
const state: PGliteState = {
  db: null,
  isInitialized: false,
  connectionStatus: 'disconnected',
  initializationStatus: 'not_started',
  validationResults: null,
  lastError: null,
  errorType: null  // Default: no auto-recovery (safe conservative approach)
};

export function getState(): PGliteState {
  return state;
}

export function updateState(partial: Partial<PGliteState>): void {
  Object.assign(state, partial);

  // Dispatch state change event for UI updates
  window.dispatchEvent(new CustomEvent('pglite:state:changed', {
    detail: { state }
  }));
}

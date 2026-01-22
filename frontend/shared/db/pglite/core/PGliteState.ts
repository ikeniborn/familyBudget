/**
 * Central state for PGlite database
 * ZERO DEPENDENCIES to prevent circular deps
 */
export {};

export interface PGliteState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any | null;               // PGlite instance (any until task-002)
  isInitialized: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastError: string | null;
}

// Initial state
const state: PGliteState = {
  db: null,
  isInitialized: false,
  connectionStatus: 'disconnected',
  lastError: null
};

export function getState(): PGliteState {
  return state;
}

export function updateState(partial: Partial<PGliteState>): void {
  Object.assign(state, partial);
}

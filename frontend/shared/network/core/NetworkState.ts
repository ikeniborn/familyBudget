/**
 * Central state management for network detection
 * ZERO DEPENDENCIES to prevent circular deps
 *
 * This module contains ONLY state definition and basic accessors.
 * NO business logic, NO external imports (except types).
 *
 * @version 3.0.0
 * @date 2026-01-16
 */

export {}; // Force module scope

import type { NetworkStatus, SmartNetworkDetectorOptions, StatusChangeOptions } from '../types';

/**
 * Complete state container for NetworkDetector
 *
 * Organized into logical sections:
 * 1. Status tracking
 * 2. Error tracking
 * 3. Heartbeat configuration
 * 4. Check throttling
 * 5. Connection quality
 * 6. Callbacks
 * 7. Auto recovery
 */
export interface NetworkDetectorState {
  // ============================================================================
  // Status tracking
  // ============================================================================
  status: NetworkStatus;
  autoOfflineMode: boolean;
  _hasRestoredState: boolean;
  _stateDispatched: boolean;

  // ============================================================================
  // Error tracking
  // ============================================================================
  consecutiveFailures: number;
  maxFailuresBeforeOffline: number;

  // ============================================================================
  // Heartbeat configuration
  // ============================================================================
  heartbeatUrl: string;
  heartbeatIntervals: number[];
  lastHeartbeat: number;
  heartbeatTimer: ReturnType<typeof setTimeout> | null;

  // ============================================================================
  // Check throttling (защита от спама)
  // ============================================================================
  minCheckInterval: number;
  lastCheck: number;

  // ============================================================================
  // Connection quality (Network Information API)
  // ============================================================================
  slowConnectionTypes: ReadonlyArray<'4g' | '3g' | '2g' | 'slow-2g'>;
  degradedRtt: number;

  // ============================================================================
  // Callbacks
  // ============================================================================
  onStatusChange: ((newStatus: NetworkStatus, oldStatus: NetworkStatus, options?: StatusChangeOptions) => void) | null;

  // ============================================================================
  // Auto recovery
  // ============================================================================
  autoRecoveryTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Factory function to create initial state
 * Converts constructor logic from networkDetector.ts:76-114
 */
export const createInitialState = (options: SmartNetworkDetectorOptions = {}): NetworkDetectorState => {
  // Initial status based on navigator.onLine
  const initialStatus: NetworkStatus = navigator.onLine ? 'online' : 'offline';

  return {
    // Status tracking
    status: initialStatus,
    autoOfflineMode: false, // Will be loaded from localStorage via loadOfflineState()
    _hasRestoredState: false,
    _stateDispatched: false,

    // Error tracking
    consecutiveFailures: 0,
    maxFailuresBeforeOffline: options.maxFailures || 3,

    // Heartbeat configuration (progressive backoff intervals)
    heartbeatUrl: options.heartbeatUrl || '/health',
    heartbeatIntervals: options.heartbeatIntervals || [2000, 4000, 20000], // 2s, 4s, 20s
    lastHeartbeat: 0,
    heartbeatTimer: null,

    // Check throttling (spam protection)
    minCheckInterval: options.minCheckInterval || 1000, // 1 sec
    lastCheck: 0,

    // Connection quality thresholds
    // Note: RTT threshold increased from 1000ms → 2500ms → 5000ms to reduce
    // false positives on mobile networks, VPN connections, and page transitions
    slowConnectionTypes: ['slow-2g', '2g'],
    degradedRtt: options.degradedRtt || 5000, // RTT > 5000ms = degraded

    // Callbacks
    onStatusChange: options.onStatusChange || null,

    // Auto recovery
    autoRecoveryTimer: null,
  };
};

// ============================================================================
// Singleton state (private, like OfflineState.ts pattern)
// ============================================================================
let state: NetworkDetectorState = createInitialState();

/**
 * Get current state (readonly)
 */
export const getState = (): Readonly<NetworkDetectorState> => state;

/**
 * Update state (partial updates)
 */
export const updateState = (updates: Partial<NetworkDetectorState>): void => {
  state = { ...state, ...updates };
};

/**
 * Reset state to initial values
 * @param options - Optional new configuration
 */
export const resetState = (options?: SmartNetworkDetectorOptions): void => {
  // Clear timers (prevent memory leaks)
  if (state.heartbeatTimer) {
    clearTimeout(state.heartbeatTimer);
  }
  if (state.autoRecoveryTimer) {
    clearTimeout(state.autoRecoveryTimer);
  }

  state = createInitialState(options);
};

// ============================================================================
// localStorage persistence (auto-offline mode)
// ============================================================================

/**
 * Load auto-offline state from localStorage
 * From networkDetector.ts:496-510
 */
export const loadOfflineState = (): void => {
  try {
    const auto = localStorage.getItem('budget_auto_offline_mode');
    const autoOfflineMode = auto === 'true';

    updateState({
      autoOfflineMode,
      status: autoOfflineMode ? 'offline' : state.status,
    });

    // Cleanup legacy key (if exists)
    localStorage.removeItem('budget_manual_offline_mode');
  } catch (e) {
    // localStorage might be unavailable (incognito mode, browser restrictions)
    if (window.DEBUG_MODE) {
      console.warn('[NetworkState] localStorage unavailable:', e);
    }
    updateState({ autoOfflineMode: false });
  }
};

/**
 * Save auto-offline state to localStorage
 * From networkDetector.ts:515-521
 */
export const saveOfflineState = (): void => {
  try {
    localStorage.setItem('budget_auto_offline_mode', state.autoOfflineMode.toString());
  } catch (e) {
    // Silent failure (localStorage might be unavailable)
  }
};

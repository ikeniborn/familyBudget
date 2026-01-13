/**
 * Budget WebSocket Client Barrel Export
 * Public API for WebSocket real-time updates
 *
 * Usage:
 * ```typescript
 * import { getState, updateState } from '@web/budget/budgetWSClient';
 *
 * // Get current state
 * const state = getState();
 * const connected = state.isConnected;
 *
 * // Update state
 * updateState({ isConnected: true });
 * ```
 */

// ============================================================================
// Core State
// ============================================================================
export {
  getState,
  updateState,
  resetState,
  createInitialState,
} from './core/WSState';

export type {
  BudgetWSState,
  WSBadgeState,
  ConnectionHistoryEntry,
  BrowserInfo,
} from './core/WSState';

// ============================================================================
// Connection Manager
// ============================================================================
export {
  connect,
  disconnect,
  reconnect,
  on,
  off,
} from './core/connectionManager';

// ============================================================================
// Type Definitions (Dependencies)
// ============================================================================
export type {
  ILogger,
  IOfflineManager,
  IListsManager,
  ShoppingItemData,
} from './types/dependencies';

// ============================================================================
// Global Window Type
// ============================================================================
export type { BudgetWSClientClass } from './types/globals';

// ============================================================================
// Window Export (Backward Compatibility)
// ============================================================================
export { BudgetWSClient, default } from './adapters/windowExports';

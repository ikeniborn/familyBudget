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
  forceReconnect,
  on,
  off,
} from './core/connectionManager';

// ============================================================================
// Multi-Tab Support
// ============================================================================
export {
  supportsMultiTab,
  initMultiTab,
  tryBecomeLeader,
  tryBecomeLeaderWithTimeout,
  startLeaderHeartbeat,
} from './multiTab/leaderElection';

export {
  startFollowerMode,
  stopFollowerMode,
  updateConnectionStatus,
} from './multiTab/followerSync';

export {
  handleChannelMessage,
  broadcastWSEvent,
  requestStatus,
} from './multiTab/tabCoordination';

// ============================================================================
// Long Polling Fallback
// ============================================================================
export {
  startLongPolling,
  stopLongPolling,
} from './fallback/longPolling';

export {
  calculateRetryDelay,
  isRetryableError,
  shouldStopOn503,
  getRetryConfig,
} from './fallback/pollRetry';

// ============================================================================
// Mobile/iOS Support
// ============================================================================
export {
  detectIOSDevice,
  needsLongerTimeout,
  detectBrowserType,
  getBrowserInfo,
} from './mobile/browserDetection';

export {
  startNavigationWindow,
  stopNavigationWindow,
  isInNavigationWindow,
  initNavigationDetection,
} from './mobile/navigationDetection';

export {
  initWakeRecovery,
  performWakeHealthCheck,
  startHealthCheckInterval,
  stopHealthCheckInterval,
  startPongTimeout,
  clearPongTimeout,
} from './mobile/wakeRecovery';

// ============================================================================
// Features
// ============================================================================
export {
  recordRTT,
  resetRTT,
  getRTTAverage,
  isSlowConnection,
  getRTTMeasurements,
} from './features/rttMeasurement';

export {
  startClientPing,
  stopClientPing,
  sendClientPing,
  handlePongReceived,
  isConnectionAlive,
} from './features/healthCheck';

export {
  updateStatusIndicator,
  getCurrentBadgeState,
} from './features/statusIndicator';

// ============================================================================
// Event System
// ============================================================================
export {
  handleFactCreated,
  handleFactUpdated,
  handleFactDeleted,
  handlePlanCreated,
  handlePlanUpdated,
  handlePlanDeleted,
  handleTransferCreated,
  handleTransferDeleted,
  handleItemCreated,
  handleItemUpdated,
  handleItemDeleted,
  handleItemCompleted,
  handleEvent,
  dispatchEvent,
} from './integration/eventHandlers';

export {
  notifyHandlers,
  removeAllHandlers,
  getHandlers,
} from './integration/eventRegistration';

// ============================================================================
// Type Definitions (Dependencies)
// ============================================================================
export type {
  ILogger,
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

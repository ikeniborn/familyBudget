/**
 * budgetWSClient - Public API for WebSocket real-time updates
 *
 * Modular architecture (Phase 2.3: ES Modules Migration):
 * - core/: State management + connection logic
 * - features/: Multi-tab, reconnect, RTT, iOS quirks
 * - fallback/: Long polling fallback
 * - integration/: Event dispatcher, diagnostics
 *
 * Features:
 * - WebSocket primary transport (bidirectional, no buffering)
 * - Long Polling fallback (10 second interval)
 * - Automatic reconnection with exponential backoff
 * - Multi-tab support (Web Locks + BroadcastChannel)
 * - Client ping/pong for connection health
 * - RTT measurement and filtering
 * - iOS wake-from-sleep handling
 *
 * Usage:
 * ```typescript
 * import BudgetWSClient from '@web/budget/budgetWSClient';
 *
 * const client = new BudgetWSClient('wss://example.com/ws');
 * await client.connect();
 * client.on('fact_created', (data) => console.log('New fact:', data));
 * ```
 */

// ============================================================================
// Core State
// ============================================================================

export { getState, updateState, resetState } from './core/WSState';
export type {
  WSState,
  WSBadgeState,
  WSEventType,
  WSMessage,
  ConnectionHistoryEntry,
  LastError,
  RTTMetrics,
  WSClientState
} from './core/WSState';

// ============================================================================
// Core Connection (TODO: Create connection.ts)
// ============================================================================

/*
export {
  connect,
  disconnect,
  reconnect,
  send
} from './core/connection';
*/

// ============================================================================
// Features (TODO: Create feature modules)
// ============================================================================

/*
export {
  initMultiTab,
  tryBecomeLeader
} from './features/multiTab';

export {
  scheduleReconnect,
  resetReconnectAttempts
} from './features/reconnect';

export {
  measureRTT,
  updateRTTMetrics,
  isSlowConnection
} from './features/rttFilter';

export {
  handleVisibilityChange,
  performWakeHealthCheck
} from './features/iosQuirks';
*/

// ============================================================================
// Fallback (TODO: Create longPolling.ts)
// ============================================================================

/*
export {
  startLongPolling,
  stopLongPolling
} from './fallback/longPolling';
*/

// ============================================================================
// Integration (TODO: Create integration modules)
// ============================================================================

/*
export {
  dispatchEvent,
  on,
  off
} from './integration/eventDispatcher';

export {
  diagnose,
  showDiagnostics
} from './integration/diagnostics';
*/

// ============================================================================
// Temporary: Re-export legacy class for compatibility
// ============================================================================

// TODO Phase 2.3: Remove after full modularization
// For now, we only have WSState, so we can't instantiate BudgetWSClient yet
// This will be uncommented once connection.ts and other modules are created

/*
export class BudgetWSClient {
  constructor(url: string) {
    // Implementation using modules
  }
}

export default BudgetWSClient;
*/

/**
 * Budget WebSocket Client - Module Structure
 *
 * Phase 2.3: Foundation (types extracted)
 *
 * STATUS: budgetWSClient.ts (2,693 lines) - too complex for immediate modularization
 * STRATEGY: Gradual extraction in future phases
 *
 * Current usage: window.budgetWSClient (global instance)
 */

// ============================================================================
// Type Definitions (Phase 2.3: Complete)
// ============================================================================

export {
  getState,
  updateState,
  resetState,
  createInitialState
} from './core/WSState';

export type {
  WSState,
  WSBadgeState,
  WSEventType,
  WSMessage,
  ConnectionHistoryEntry,
  LastError,
  BudgetWSState
} from './core/WSState';

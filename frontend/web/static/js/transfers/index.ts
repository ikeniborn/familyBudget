/**
 * Transfer Module - Public API
 *
 * Barrel export for all transfer module functionality.
 *
 * Usage:
 * ```typescript
 * import { initTransferModal, openModal } from '@web/transfers';
 * ```
 */

// ============================================================================
// Core State
// ============================================================================
export { getState, updateState, resetState } from './core/TransferState';
export type { TransferState, TransferFormData } from './core/TransferState';

// ============================================================================
// State Manager
// ============================================================================
export {
  initTransferModal,
  updateUIVisibility
} from './core/stateManager';

// ============================================================================
// Operations
// ============================================================================
export {
  openTransferModal,
  closeTransferModal,
  validateTransferData,
  handleTransferSubmit
} from './core/transferOperations';

export { loadTransferData } from './core/dataLoader';

// ============================================================================
// Features
// ============================================================================
export {
  loadTransferPlanHints,
  loadTransferFactHints
} from './features/hints';

export {
  setupQuickDateButtons,
  setupPeriodButtons,
  selectTransferPeriod,
  initTransferPeriodButtons
} from './features/quickDate';

export {
  setupCFOFiltering,
  filterCostCenterDropdown
} from './features/filtering';

// ============================================================================
// UI
// ============================================================================
export { openModal, closeModal } from './ui/modalManager';
export { populateFinancialCenterDropdowns } from './ui/dropdownManager';
export {
  updatePlanHintButtons,
  updateFactHintButtons,
  setTransferAmount
} from './ui/hintButtons';

// ============================================================================
// Integration
// ============================================================================
export {
  getPlanHints,
  getFactHints,
  getFinancialCenters,
  getCostCenters,
  createTransfer
} from './integration/apiService';

export type {
  PlanHintsParams,
  PlanHintsResponse,
  FactHintsParams,
  FactHintsResponse
} from './integration/apiService';

export {
  updateRecentTransactions,
  updateQuickStats
} from './integration/htmxIntegration';

// ============================================================================
// Types
// ============================================================================
export type {
  FinancialCenter,
  CostCenter,
  HintsData
} from './types/transfer';

// ============================================================================
// Backward Compatibility (Window Export)
// ============================================================================
import './adapters/windowExports';

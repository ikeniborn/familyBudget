/**
 * Dashboard Module Entry Point
 *
 * Main entry point for the dashboard module bundle.
 * Exports all public APIs and initializes the module.
 *
 * This module manages:
 * - Add Transaction/Plan modals
 * - Edit Fact/Plan modal
 * - Pending records management (IndexedDB sync queue)
 * - Mobile UI (collapsible sections)
 * - WebSocket event handlers for real-time updates
 */

// ============================================================================
// Core Exports
// ============================================================================

export {
  getState,
  updateState,
  resetState,
  isCacheValid,
  invalidateCache,
  setCacheData,
  setTransactionCategoryTreeSelect,
  setPlanCategoryTreeSelect,
  setEditCategoryTreeSelect,
  incrementPendingCallCount,
  setPendingLock,
  getPendingLock,
} from './core/DashboardState';

export type { DashboardState } from './core/DashboardState';

export {
  initializeStateFromGlobals,
  syncStateToGlobals,
  defineReactiveProperties,
  isInitialized,
  setInitialized,
} from './core/stateManager';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  Category,
  Article,
  FinancialCenter,
  CostCenter,
  CacheEntry,
  DropdownCache,
  PendingRecordEntity,
  PendingRecordStatus,
  RecordType,
  FactType,
  PendingRecordData,
  PendingRecord,
  PendingRecordsRenderResult,
  UnsyncedItemsResult,
  EditRecordType,
  EditFactData,
  EditPlanData,
  TransactionFormData,
  PlanFormData,
  TransferFormData,
  FrequencyType,
  DurationType,
  PlanMode,
  RecurringSettings,
  PlanHintsData,
  FactHintsData,
  SyncResults,
} from './types/dashboard.d';

// Analytics types (task-011)
export type { QuickStats, AccountBalance, RecentFact } from './types/analytics';

// ============================================================================
// Feature Exports
// ============================================================================

// Pending Records (Phase 2)
export {
  // State
  isLoadInProgress,
  acquireLoadLock,
  releaseLoadLock,
  waitForExistingLock,
  getNextCallId,
  getCurrentCallCount,
  // Renderer
  formatShortDate,
  formatAmount,
  getStatusBadge,
  getStatusBadgeMobile,
  getRecordTypeLabel,
  getRecordTypeLabelXs,
  generateHTMLSync,
  generateHTMLAsync,
  shouldUseWorker,
  getWorkerThreshold,
  // Sync operations
  loadPendingRecords,
  retryFailedItems,
  handleSyncResults,
  deletePendingRecord,
  deleteFailedRecords,
  updatePendingCount,
  syncPendingRecords,
  notifyPendingRecords,
  // Transfer split
  splitTransferToFacts,
  handleTransferEditClick,
} from './features/pendingRecords';

// Add Transaction (Phase 3)
export {
  loadTransactionCategories,
  loadFinancialCenters,
  loadCostCenters,
  filterCostCenterDropdown,
  loadFactHints,
  saveTransaction,
  saveTransactionOffline,
  setTransactionDate,
  setupTransactionTypeButtons,
} from './features/addTransaction';

// Add Plan (Phase 3) - kept for backward compatibility with legacy inline JavaScript
export {
  // Plan form operations
  loadPlanCategories,
  savePlan,
  savePlanOffline,
  // Plan hints
  loadPlanHints,
  // Period buttons
  setupPlanPeriodButtons,
  setupPlanTypeButtons,
  updatePlanPeriodButtons,
  // Reminder settings
  toggleReminderSettings,
  togglePlanMode,
  prefillReminderDateTime,
  initReminderCalendarWidget,
  updateReminderDatetime,
  resetReminderFields,
  getCurrentTimeRounded,
  // Recurring settings
  initRecurringFields,
  resetRecurringOnlyFields,
  resetRecurringSettings,
  updateFrequencyFields,
  updateDurationFields,
  updateRecurringPreview,
  collectRecurringSettings,
} from './features/addPlan';

// Edit Modal (Phase 4)
export {
  // Dropdown cache
  remindersMap,
  loadCategoriesForEdit,
  loadEditFinancialCenters,
  loadEditCostCenters,
  loadRemindersForEdit,
  populateFinancialCentersDropdown,
  populateCostCentersDropdown,
  populateOfflineDropdowns,
  // Reminder helpers
  toggleEditReminderSettings,
  initEditReminderCalendarWidget,
  updateEditReminderDatetime,
  populateEditReminderFields,
  resetEditReminderFields,
  getReminderStatusBadge,
  // Form population
  getCurrentEditingRecordType,
  getCurrentEditingPendingId,
  setCurrentEditingState,
  setEditModalMode,
  updateEditCategoryTypeBadge,
  setupEditCategoryTypeButtons,
  initEditCategoryTreeSelect,
  openEditPendingRecord,
  openEditModal,
  closeEditModal,
  // Save operations
  updateFact,
  // Delete operations
  showRecurringDeleteDialog,
  handleRecurringDeleteChoice,
  deleteFromEditModal,
  deleteFactFromDashboard,
} from './features/editModal';

// UI (Phase 5)
export {
  toggleQuickStats,
  toggleAccountBalances,
  applyQuickStatsState,
  applyAccountBalancesState,
  initCollapsibleSections,
  cleanupCollapsibleSections,
} from './ui';

// Integration (Phase 5)
export {
  refreshDashboard,
  refreshRecentTransactions,
  refreshQuickStats,
  refreshAccountBalances,
  refreshDashboardWidgets,
  registerWSEventHandlers,
} from './integration';

// Facts Manager (task-011: Dashboard Query Optimization)
export { factsManager } from './features/factsManager';

// ============================================================================
// Window Exports (for backward compatibility)
// ============================================================================

export { dashboardExports, initWindowExports } from './adapters/windowExports';

// ============================================================================
// Module Initialization
// ============================================================================

import { initWindowExports, dashboardExports } from './adapters/windowExports';
import { setInitialized } from './core/stateManager';



declare const debugLog: (...args: any[]) => void;
/**
 * Initialize dashboard module
 * Called automatically when bundle loads
 */
function initModule(): void {
  // Initialize window exports first
  initWindowExports();

  // Mark as initialized
  setInitialized(true);

  // Call Dashboard.init() to set up forms, event listeners, and WebSocket handlers
  // This is critical for the module to work properly
  dashboardExports.init();

  debugLog('[Dashboard] Module loaded');
}

// Auto-initialize on load
initModule();

// ============================================================================
// Prevent tree-shaking of window exports (v10.1.48 fix)
// ============================================================================

// CRITICAL: Force Vite to keep window exports by explicitly using them
// Without this, production build tree-shakes initWindowExports() call
if (typeof window !== 'undefined') {
  // Mark as used to prevent tree-shaking
  (window as any).__DASHBOARD_LOADED__ = true;
}

// ============================================================================
// Default Export
// ============================================================================

export default dashboardExports;

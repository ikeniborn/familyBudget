/**
 * Dashboard Window Exports
 *
 * Exposes dashboard functions to window.Dashboard namespace for backward compatibility.
 * Follows the pattern from lists/listsManager/adapters/windowExports.ts
 *
 * This adapter allows:
 * 1. HTML onclick handlers to call functions (e.g., onclick="Dashboard.saveTransaction(this)")
 * 2. External code to access dashboard functionality
 * 3. Gradual migration from inline JS to module
 */

import { defineReactiveProperties, initializeStateFromGlobals } from '../core/stateManager';
import { getState, isCacheValid } from '../core/DashboardState';
import { showModalWithSkeleton } from '../utils/modalHelpers';



declare const debugLog: (...args: any[]) => void;
declare const showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;

// Add Transaction imports (Phase 3)
import {
  loadTransactionCategories as loadTransactionCategoriesImpl,
  loadFinancialCenters as loadFinancialCentersImpl,
  loadCostCenters as loadCostCentersImpl,
  filterCostCenterDropdown as filterCostCenterDropdownImpl,
  loadFactHints as loadFactHintsImpl,
  saveTransaction as saveTransactionImpl,
  setTransactionDate as setTransactionDateImpl,
  // v10.1.51: setupTransactionTypeButtons moved to modal open handler
} from '../features/addTransaction';

// Legacy add plan imports removed (v11.x+)
// Reminder and recurring settings still imported from addPlan
import {
  toggleReminderSettings as toggleReminderSettingsImpl,
  togglePlanMode as togglePlanModeImpl,
  prefillReminderDateTime as prefillReminderDateTimeImpl,
  initReminderCalendarWidget as initReminderCalendarWidgetImpl,
  resetReminderFields as resetReminderFieldsImpl,
  initRecurringFields as initRecurringFieldsImpl,
  resetRecurringOnlyFields as resetRecurringOnlyFieldsImpl,
  resetRecurringSettings as resetRecurringSettingsImpl,
  updateFrequencyFields as updateFrequencyFieldsImpl,
  updateDurationFields as updateDurationFieldsImpl,
  updateRecurringPreview as updateRecurringPreviewImpl,
  collectRecurringSettings as collectRecurringSettingsImpl,
} from '../features/addPlan';

// Edit Modal imports (Phase 4)
import {
  openEditModal as openEditModalImpl,
  closeEditModal as closeEditModalImpl,
  updateFact as updateFactImpl,
  deleteFromEditModal as deleteFromEditModalImpl,
  deleteFactFromDashboard as deleteFactFromDashboardImpl,
  toggleEditReminderSettings as toggleEditReminderSettingsImpl,
  handleRecurringDeleteChoice as handleRecurringDeleteChoiceImpl,
  setupEditCategoryTypeButtons as setupEditCategoryTypeButtonsImpl,
} from '../features/editModal';

// Modal Fact imports (v9.0 Tabbed Modals)
import {
  openModalFact as openModalFactImpl,
  closeModalFact as closeModalFactImpl,
} from '../features/modalFact';

import {
  saveFactModal as saveFactModalImpl,
} from '../features/modalFact/saveOperations';

// Modal Plan imports (v9.0 Tabbed Modals)
import {
  openModalPlan as openModalPlanImpl,
  closeModalPlan as closeModalPlanImpl,
} from '../features/modalPlan';

import {
  savePlanModal as savePlanModalImpl,
} from '../features/modalPlan/saveOperations';

// Recent Transactions (Table Optimization v2.0)
import {
  loadRecentTransactions as loadRecentTransactionsImpl,
} from '../recentTransactions';

import {
  togglePlanMode as togglePlanModeNewImpl,
  updateFrequencyFields as updateFrequencyFieldsNewImpl,
  updateYearlyFrequencyValue as updateYearlyFrequencyValueNewImpl,
  updateDurationFields as updateDurationFieldsNewImpl,
} from '../features/modalPlan/recurringSettings';

// FAB Context Modal import (v9.0 Simplified FAB)
import {
  openContextModal as openContextModalImpl,
} from '../features/fab/contextModal';

// UI imports (Phase 5)
import {
  toggleQuickStats as toggleQuickStatsImpl,
  toggleAccountBalances as toggleAccountBalancesImpl,
  initCollapsibleSections as initCollapsibleSectionsImpl,
} from '../ui';

// Integration imports (Phase 5)
import {
  refreshDashboard as refreshDashboardImpl,
  refreshRecentTransactions as refreshRecentTransactionsImpl,
  refreshQuickStats as refreshQuickStatsImpl,
  refreshAccountBalances as refreshAccountBalancesImpl,
  registerWSEventHandlers as registerWSEventHandlersImpl,
} from '../integration';

import type { DashboardExports } from '../types/globals.d';
import type { Category } from '../types/dashboard.d';

// ============================================================================
// Initialization
// ============================================================================

async function init(): Promise<void> {
  // Initialize state from existing globals
  initializeStateFromGlobals();

  // Define reactive properties on window
  defineReactiveProperties();

  // Set up form initialization
  setupFormInitialization();

  // Initialize collapsible sections for mobile UI
  initCollapsibleSectionsImpl();

  // Register WebSocket event handlers for real-time updates
  registerWSEventHandlersImpl();

  debugLog('[Dashboard] Module initialized');
}

/**
 * Set up form initialization on DOMContentLoaded
 */
function setupFormInitialization(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeForms);
  } else {
    // DOM already ready
    initializeForms();
  }
}

/**
 * Initialize forms after DOM is ready
 *
 * v10.1.51: Removed early initialization of period/type buttons
 * These functions should be called when modal is opened, NOT at module initialization.
 * Reason: Modal DOM may not be ready yet, causing "No buttons found" errors.
 */
function initializeForms(): void {
  // v10.1.51: Period/type button initialization moved to modal open handlers
  // setupPlanPeriodButtonsImpl();       // Called in openModalPlan()
  // setupPlanTypeButtonsImpl();         // Called in openModalPlan()
  // setupTransactionTypeButtonsImpl();  // Called in openModalFact()
}

// ============================================================================
// Edit Modal (Phase 4 - IMPLEMENTED)
// ============================================================================

async function openEditModal(recordType: 'fact' | 'plan', recordId: number): Promise<void> {
  return openEditModalImpl(recordType, recordId);
}

function closeEditModal(): void {
  return closeEditModalImpl();
}

async function updateEditFact(event: Event): Promise<void> {
  return updateFactImpl(event);
}

async function deleteFact(): Promise<void> {
  return deleteFromEditModalImpl();
}

async function deleteFactFromDashboard(factId: number, isRecurring: number | boolean): Promise<void> {
  return deleteFactFromDashboardImpl(factId, isRecurring);
}

function toggleEditReminderSettings(): void {
  return toggleEditReminderSettingsImpl();
}

function handleRecurringDeleteChoice(choice: string | null): void {
  return handleRecurringDeleteChoiceImpl(choice);
}

function setupEditCategoryTypeButtons(): void {
  return setupEditCategoryTypeButtonsImpl();
}

/**
 * Open edit modal for a fact from dashboard recent-transactions list.
 * Wrapper for openEditModal('fact', factId).
 */
async function openEditFromDashboard(factId: number): Promise<void> {
  return openEditModalImpl('fact', factId);
}

/**
 * Delete a record from dashboard recent-transactions list.
 * Wrapper for deleteFactFromDashboard(factId, false).
 */
async function deleteRecordFromDashboard(factId: number): Promise<void> {
  return deleteFactFromDashboardImpl(factId, false);
}

/**
 * Alias for handleRecurringDeleteChoice for backward compatibility.
 * HTML uses onclick="recurringDeleteResolve(choice)".
 */
function recurringDeleteResolve(choice: string | null): void {
  return handleRecurringDeleteChoiceImpl(choice);
}

/**
 * Open add transaction modal with skeleton loader.
 *
 * Shows skeleton during data loading for better perceived performance.
 * Uses shared showModalWithSkeleton() helper for consistent UX.
 *
 * @returns Promise that resolves when modal is ready
 */
async function openAddTransactionModal(): Promise<void> {
  const state = getState();

  await showModalWithSkeleton(
    'modal_add_transaction',
    // Check cache
    () =>
      state.transactionCategoryTreeSelect !== null &&
      isCacheValid(state.dropdownCache.categories) &&
      isCacheValid(state.dropdownCache.financialCenters),
    // Load data
    async () => {
      await Promise.all([
        loadTransactionCategoriesImpl(),
        loadFinancialCentersImpl(),
        loadCostCentersImpl()
      ]);
    }
  );
}

// ============================================================================
// Modal Fact (v9.0 Tabbed Modals)
// ============================================================================

function openModalFact(): void {
  // Fire-and-forget async call
  openModalFactImpl().catch(error => {
    console.error('[Dashboard] openModalFact error:', error);
  });
}

function closeModalFact(): void {
  return closeModalFactImpl();
}

function saveFactModal(button: HTMLElement): void {
  // Fire-and-forget async call
  saveFactModalImpl(button).catch(error => {
    console.error('[Dashboard] saveFactModal error:', error);
  });
}

// ============================================================================
// Modal Plan (v9.0 Tabbed Modals)
// ============================================================================

function openModalPlan(): void {
  // Fire-and-forget async call
  openModalPlanImpl().catch(error => {
    console.error('[Dashboard] openModalPlan error:', error);
  });
}

function closeModalPlan(): void {
  return closeModalPlanImpl();
}

function savePlanModal(button: HTMLElement): void {
  // Fire-and-forget async call
  savePlanModalImpl(button).catch(error => {
    console.error('[Dashboard] savePlanModal error:', error);
  });
}

// ============================================================================
// FAB Context Modal (v9.0 Simplified FAB)
// ============================================================================

function openContextModal(): void {
  return openContextModalImpl();
}

/**
 * Open fact transfer modal.
 * Delegates to transfers module openTransferModal.
 * Record type is 'fact' by default in transfers module.
 */
async function openFactTransferModal(): Promise<void> {
  // Set record_type hidden field to 'fact' (for safety)
  const recordTypeInput = document.getElementById('transfer_record_type') as HTMLInputElement | null;
  if (recordTypeInput) {
    recordTypeInput.value = 'fact';
  }

  // Show date section, hide period section
  const dateSection = document.getElementById('transfer-date-section-fact');
  const periodSection = document.getElementById('transfer-period-section-plan');
  if (dateSection) dateSection.classList.remove('hidden');
  if (periodSection) periodSection.classList.add('hidden');

  // Initialize transfer modal lazily on first open (awaited to prevent race conditions)
  if (typeof window.initTransferModal === 'function') {
    await window.initTransferModal(); // Load data (financial centers, categories)
  }

  // Delegate to transfers module
  if (typeof window.openTransferModal === 'function') {
    window.openTransferModal();
  } else {
    // Fallback: open modal directly
    const modal = document.getElementById('transfer_modal');
    if (modal) {
      modal.classList.add('modal-open');
    } else {
      debugLog('[Dashboard] transfer_modal not found');
    }
  }
}

// ============================================================================
// Add Transaction (Phase 3 - IMPLEMENTED)
// ============================================================================

async function loadTransactionCategories(): Promise<void> {
  return loadTransactionCategoriesImpl();
}

function saveTransaction(button: HTMLElement): void {
  return saveTransactionImpl(button);
}

function setTransactionDate(daysOffset: number): void {
  return setTransactionDateImpl(daysOffset);
}

async function loadFinancialCenters(): Promise<void> {
  return loadFinancialCentersImpl();
}

async function loadCostCenters(): Promise<void> {
  return loadCostCentersImpl();
}

async function filterCostCenterDropdown(
  formSelectorOrFcId: string | number | null,
  financialCenterId?: number | null
): Promise<void> {
  // Support both signatures:
  // 1. filterCostCenterDropdown(formSelector, financialCenterId) - from TypeScript module
  // 2. filterCostCenterDropdown(financialCenterId) - legacy onclick handlers
  if (typeof formSelectorOrFcId === 'string' && formSelectorOrFcId.startsWith('#')) {
    // Full signature: formSelector + fcId
    return filterCostCenterDropdownImpl(formSelectorOrFcId, financialCenterId ?? null);
  } else {
    // Legacy: just financialCenterId (assume add transaction form)
    const fcId = typeof formSelectorOrFcId === 'string' ? parseInt(formSelectorOrFcId) : formSelectorOrFcId;
    return filterCostCenterDropdownImpl('#form_modal_add_transaction', fcId);
  }
}

async function loadFactHints(category: Category | null = null): Promise<void> {
  return loadFactHintsImpl(category);
}

// ============================================================================
// Add Plan (Phase 3 - IMPLEMENTED)
// ============================================================================

// Legacy functions removed (v11.x+): loadPlanCategories, savePlan, savePlanOffline, loadPlanHints
// New implementation in features/modalPlan/ used instead

function togglePlanMode(modalId: string): void {
  // Use new implementation for modal_plan, old for legacy modals
  if (modalId === 'modal_plan') {
    return togglePlanModeNewImpl(modalId);
  }
  return togglePlanModeImpl(modalId);
}

function toggleReminderSettings(modalId: string): void {
  return toggleReminderSettingsImpl(modalId);
}

function prefillReminderDateTime(modalId: string): void {
  return prefillReminderDateTimeImpl(modalId);
}

function initReminderCalendarWidget(modalId: string): void {
  return initReminderCalendarWidgetImpl(modalId);
}

function resetReminderFields(modalId: string): void {
  return resetReminderFieldsImpl(modalId);
}

function initRecurringFields(modalId: string): void {
  return initRecurringFieldsImpl(modalId);
}

function resetRecurringOnlyFields(modalId: string): void {
  return resetRecurringOnlyFieldsImpl(modalId);
}

function resetRecurringSettings(modalId: string): void {
  return resetRecurringSettingsImpl(modalId);
}

function updateFrequencyFields(modalId: string): void {
  // Use new implementation for modal_plan
  if (modalId === 'modal_plan') {
    return updateFrequencyFieldsNewImpl(modalId);
  }
  return updateFrequencyFieldsImpl(modalId);
}

function updateDurationFields(modalId: string): void {
  // Use new implementation for modal_plan
  if (modalId === 'modal_plan') {
    return updateDurationFieldsNewImpl(modalId);
  }
  return updateDurationFieldsImpl(modalId);
}

function updateRecurringPreview(modalId: string): void {
  return updateRecurringPreviewImpl(modalId);
}

// New function for modal_plan (yearly frequency value update)
function updateYearlyFrequencyValue(modalId: string): void {
  if (modalId === 'modal_plan') {
    return updateYearlyFrequencyValueNewImpl(modalId);
  }
  // No legacy implementation, do nothing
}

function collectRecurringSettings(modalId: string): ReturnType<typeof collectRecurringSettingsImpl> {
  return collectRecurringSettingsImpl(modalId);
}

// ============================================================================
// Recent Transactions (Table Optimization v2.0)
// ============================================================================

async function loadRecentTransactions(): Promise<void> {
  return loadRecentTransactionsImpl();
}

// ============================================================================
// Transfer placeholders (handled by transfers module)
// ============================================================================

function setTransferRecordType(): void {
  // Transfer functionality is handled by transfers.min.js module
  // This is a passthrough for backward compatibility
  debugLog('[Dashboard] setTransferRecordType - delegated to transfers module');
}

function saveTransfer(): void {
  // Transfer functionality is handled by transfers.min.js module
  debugLog('[Dashboard] saveTransfer - delegated to transfers module');
}

// ============================================================================
// UI (Phase 5 - IMPLEMENTED)
// ============================================================================

function toggleQuickStats(): void {
  return toggleQuickStatsImpl();
}

function toggleAccountBalances(): void {
  return toggleAccountBalancesImpl();
}

// ============================================================================
// Export to Window
// ============================================================================

/**
 * Dashboard exports object
 * Attached to window.Dashboard for global access
 */
export const dashboardExports: DashboardExports = {
  // Initialization
  init,

  // Edit modal (Phase 4 - IMPLEMENTED)
  openEditModal,
  closeEditModal,
  updateEditFact,
  deleteFact,
  deleteFactFromDashboard,
  toggleEditReminderSettings,
  handleRecurringDeleteChoice,
  setupEditCategoryTypeButtons,

  // Add transaction (Phase 3 - IMPLEMENTED)
  loadTransactionCategories,
  saveTransaction,
  setTransactionDate,
  loadFinancialCenters,
  loadCostCenters,
  filterCostCenterDropdown,
  loadFactHints,

  // Add plan (Phase 3 - IMPLEMENTED)
  // Legacy exports removed (v11.x+): loadPlanCategories, savePlan, savePlanOffline, loadPlanHints
  togglePlanMode,
  toggleReminderSettings,
  prefillReminderDateTime,
  initReminderCalendarWidget,
  resetReminderFields,
  initRecurringFields,
  resetRecurringOnlyFields,
  resetRecurringSettings,
  updateFrequencyFields,
  updateDurationFields,
  updateYearlyFrequencyValue,
  updateRecurringPreview,
  collectRecurringSettings,

  // Recent Transactions (Table Optimization v2.0)
  loadRecentTransactions,

  // Transfer (delegated to transfers module)
  setTransferRecordType,
  saveTransfer,

  // UI (Phase 5 - IMPLEMENTED)
  toggleQuickStats,
  toggleAccountBalances,

  // Dashboard-specific functions for HTML onclick handlers
  openEditFromDashboard,
  deleteRecordFromDashboard,
  recurringDeleteResolve,
  openAddTransactionModal,
  openFactTransferModal,

  // Tabbed Modals (v9.0)
  openModalFact,
  closeModalFact,
  saveFactModal,
  openModalPlan,
  closeModalPlan,
  savePlanModal,

  // Simplified FAB (v9.0)
  openContextModal,
};

/**
 * Initialize window exports
 * Called automatically when module loads
 */
export function initWindowExports(): void {
  // Attach to window.Dashboard
  window.Dashboard = dashboardExports;

  // Expose add transaction functions globally for onclick handlers
  window.loadTransactionCategories = loadTransactionCategories;
  window.saveTransaction = saveTransaction;
  window.filterCostCenterDropdown = filterCostCenterDropdown;
  window.setTransactionDate = setTransactionDate;

  // Expose add plan functions globally for onclick handlers
  // Legacy exports removed (v11.x+): loadPlanCategories, savePlan
  window.togglePlanMode = togglePlanMode;
  window.toggleReminderSettings = toggleReminderSettings;

  // Expose recurring functions globally for onclick handlers
  window.initRecurringFields = initRecurringFields;
  window.resetRecurringOnlyFields = resetRecurringOnlyFields;
  window.resetRecurringSettings = resetRecurringSettings;
  window.updateFrequencyFields = updateFrequencyFields;
  window.updateDurationFields = updateDurationFields;
  window.updateYearlyFrequencyValue = updateYearlyFrequencyValue;
  window.updateRecurringPreview = updateRecurringPreview;
  window.collectRecurringSettings = collectRecurringSettings;

  // Expose edit modal functions globally for onclick handlers (Phase 4)
  window.openEditModal = openEditModal;
  window.closeEditModal = closeEditModal;
  window.updateEditFact = updateEditFact;
  // Note: window.deleteFact is exported by facts module with signature (factId: number)
  // Dashboard.deleteFact() (no params) is available via window.Dashboard.deleteFact()
  window.deleteFactFromDashboard = deleteFactFromDashboard;
  window.toggleEditReminderSettings = toggleEditReminderSettings;
  window.handleRecurringDeleteChoice = handleRecurringDeleteChoice;
  window.setupEditCategoryTypeButtons = setupEditCategoryTypeButtons;

  // Expose UI functions globally for onclick handlers (Phase 5)
  window.toggleQuickStats = toggleQuickStats;
  window.toggleAccountBalances = toggleAccountBalances;

  // Expose HTMX refresh functions globally (Phase 5)
  window.refreshDashboard = refreshDashboardImpl;
  window.refreshRecentTransactions = refreshRecentTransactionsImpl;
  window.refreshQuickStats = refreshQuickStatsImpl;
  window.refreshAccountBalances = refreshAccountBalancesImpl;
  window.loadRecentTransactions = loadRecentTransactions;

  // Expose dashboard-specific functions globally for HTML onclick handlers
  window.openEditFromDashboard = openEditFromDashboard;
  window.deleteRecordFromDashboard = deleteRecordFromDashboard;
  window.recurringDeleteResolve = recurringDeleteResolve;
  window.openAddTransactionModal = openAddTransactionModal;
  window.openFactTransferModal = openFactTransferModal;

  // Expose tabbed modals functions globally (v9.0)
  window.openModalFact = openModalFact;
  window.closeModalFact = closeModalFact;
  window.saveFactModal = saveFactModal;
  window.openModalPlan = openModalPlan;
  window.closeModalPlan = closeModalPlan;
  window.savePlanModal = savePlanModal;

  // Expose simplified FAB function globally (v9.0)
  window.openContextModal = openContextModal;

  debugLog('[Dashboard] Window exports initialized');
}

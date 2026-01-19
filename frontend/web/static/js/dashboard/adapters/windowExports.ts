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



declare const debugLog: (...args: any[]) => void;
// Pending Records imports (Phase 2)
import {
  loadPendingRecords as loadPendingRecordsImpl,
  deletePendingRecord as deletePendingRecordImpl,
  retryFailedItems as retryFailedItemsImpl,
  handleTransferEditClick as handleTransferEditClickImpl,
} from '../features/pendingRecords';

// Add Transaction imports (Phase 3)
import {
  loadTransactionCategories as loadTransactionCategoriesImpl,
  loadFinancialCenters as loadFinancialCentersImpl,
  loadCostCenters as loadCostCentersImpl,
  filterCostCenterDropdown as filterCostCenterDropdownImpl,
  loadFactHints as loadFactHintsImpl,
  saveTransaction as saveTransactionImpl,
  saveTransactionOffline as saveTransactionOfflineImpl,
  setTransactionDate as setTransactionDateImpl,
  setupTransactionTypeButtons as setupTransactionTypeButtonsImpl,
} from '../features/addTransaction';

// Add Plan imports (Phase 3)
import {
  loadPlanCategories as loadPlanCategoriesImpl,
  savePlan as savePlanImpl,
  savePlanOffline as savePlanOfflineImpl,
  openAddPlanModal as openAddPlanModalImpl,
  loadPlanHints as loadPlanHintsImpl,
  setupPlanPeriodButtons as setupPlanPeriodButtonsImpl,
  setupPlanTypeButtons as setupPlanTypeButtonsImpl,
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
  openEditPendingRecord as openEditPendingRecordImpl,
  closeEditModal as closeEditModalImpl,
  updateFact as updateFactImpl,
  deleteFromEditModal as deleteFromEditModalImpl,
  deleteFactFromDashboard as deleteFactFromDashboardImpl,
  toggleEditReminderSettings as toggleEditReminderSettingsImpl,
  handleRecurringDeleteChoice as handleRecurringDeleteChoiceImpl,
  setupEditCategoryTypeButtons as setupEditCategoryTypeButtonsImpl,
} from '../features/editModal';

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

  // Set up event listeners for pending records
  setupPendingRecordsListeners();

  // Set up form initialization
  setupFormInitialization();

  // Initialize collapsible sections for mobile UI
  initCollapsibleSectionsImpl();

  // Register WebSocket event handlers for real-time updates
  registerWSEventHandlersImpl();

  debugLog('[Dashboard] Module initialized');
}

/**
 * Set up event listeners for pending records auto-refresh
 */
function setupPendingRecordsListeners(): void {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => loadPendingRecordsImpl(), 500);
    });
  } else {
    // DOM already ready
    setTimeout(() => loadPendingRecordsImpl(), 500);
  }

  // Listen for online/offline events
  window.addEventListener('online', () => loadPendingRecordsImpl());
  window.addEventListener('offline', () => loadPendingRecordsImpl());

  // Listen for offline-sync-complete event
  window.addEventListener('offline-sync-complete', async (event: Event) => {
    const customEvent = event as CustomEvent<{ synced?: number; status?: string }>;
    await loadPendingRecordsImpl();

    const synced = customEvent.detail?.synced || 0;
    if (synced > 0 || customEvent.detail?.status === 'online') {
      // Refresh dashboard widgets
      if (window.htmx) {
        window.htmx.ajax('GET', '/api/v1/facts/recent-html?limit=10', {
          target: '#recent-transactions',
          swap: 'innerHTML',
        });
        window.htmx.ajax('GET', '/api/v1/analytics/quick-stats-html', {
          target: '#quick-stats',
          swap: 'innerHTML',
        });
        window.htmx.ajax('GET', '/api/v1/analytics/account-balances-html', {
          target: '#account-balances',
          swap: 'innerHTML',
        });
      }
    }
  });
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
 */
function initializeForms(): void {
  // Initialize period buttons for plan form
  setupPlanPeriodButtonsImpl();
  setupPlanTypeButtonsImpl();
  setupTransactionTypeButtonsImpl();
}

// ============================================================================
// Edit Modal (Phase 4 - IMPLEMENTED)
// ============================================================================

async function openEditModal(recordType: 'fact' | 'plan', recordId: number): Promise<void> {
  return openEditModalImpl(recordType, recordId);
}

async function openEditPendingRecord(itemId: number, entity: string): Promise<void> {
  return openEditPendingRecordImpl(itemId, entity);
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

// ============================================================================
// Add Transaction (Phase 3 - IMPLEMENTED)
// ============================================================================

async function loadTransactionCategories(): Promise<void> {
  return loadTransactionCategoriesImpl();
}

function saveTransaction(button: HTMLElement): void {
  return saveTransactionImpl(button);
}

async function saveTransactionOffline(button: HTMLElement): Promise<void> {
  return saveTransactionOfflineImpl(button);
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

async function loadPlanCategories(): Promise<void> {
  return loadPlanCategoriesImpl();
}

function openAddPlanModal(): void {
  return openAddPlanModalImpl();
}

function savePlan(button: HTMLElement): void {
  return savePlanImpl(button);
}

async function savePlanOffline(button: HTMLElement): Promise<void> {
  return savePlanOfflineImpl(button);
}

async function loadPlanHints(category: Category | null = null): Promise<void> {
  return loadPlanHintsImpl(category);
}

function togglePlanMode(modalId: string): void {
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
  return updateFrequencyFieldsImpl(modalId);
}

function updateDurationFields(modalId: string): void {
  return updateDurationFieldsImpl(modalId);
}

function updateRecurringPreview(modalId: string): void {
  return updateRecurringPreviewImpl(modalId);
}

function collectRecurringSettings(modalId: string): ReturnType<typeof collectRecurringSettingsImpl> {
  return collectRecurringSettingsImpl(modalId);
}

// ============================================================================
// Pending Records (Phase 2 - IMPLEMENTED)
// ============================================================================

async function loadPendingRecords(): Promise<void> {
  return loadPendingRecordsImpl();
}

async function deletePendingRecord(id: number): Promise<void> {
  return deletePendingRecordImpl(id);
}

async function retryFailedItems(): Promise<void> {
  return retryFailedItemsImpl();
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
  openEditPendingRecord,
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
  saveTransactionOffline,
  setTransactionDate,
  loadFinancialCenters,
  loadCostCenters,
  filterCostCenterDropdown,
  loadFactHints,

  // Add plan (Phase 3 - IMPLEMENTED)
  loadPlanCategories,
  openAddPlanModal,
  savePlan,
  savePlanOffline,
  loadPlanHints,
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
  updateRecurringPreview,
  collectRecurringSettings,

  // Pending records (Phase 2 - IMPLEMENTED)
  loadPendingRecords,
  deletePendingRecord,
  retryFailedItems,

  // Transfer (delegated to transfers module)
  setTransferRecordType,
  saveTransfer,

  // UI (Phase 5 - IMPLEMENTED)
  toggleQuickStats,
  toggleAccountBalances,
};

/**
 * Initialize window exports
 * Called automatically when module loads
 */
export function initWindowExports(): void {
  // Attach to window.Dashboard
  window.Dashboard = dashboardExports;

  // Also expose handleTransferEditClick globally for onclick handlers
  (window as any).handleTransferEditClick = handleTransferEditClickImpl;

  // Expose pending records functions globally for onclick handlers
  (window as any).loadPendingRecords = loadPendingRecords;
  (window as any).deletePendingRecord = deletePendingRecord;
  (window as any).retryFailedItems = retryFailedItems;

  // Expose add transaction functions globally for onclick handlers
  (window as any).loadTransactionCategories = loadTransactionCategories;
  (window as any).saveTransaction = saveTransaction;
  (window as any).filterCostCenterDropdown = filterCostCenterDropdown;

  // Expose add plan functions globally for onclick handlers
  (window as any).loadPlanCategories = loadPlanCategories;
  (window as any).openAddPlanModal = openAddPlanModal;
  (window as any).savePlan = savePlan;
  (window as any).togglePlanMode = togglePlanMode;
  (window as any).toggleReminderSettings = toggleReminderSettings;

  // Expose recurring functions globally for onclick handlers
  (window as any).initRecurringFields = initRecurringFields;
  (window as any).resetRecurringOnlyFields = resetRecurringOnlyFields;
  (window as any).resetRecurringSettings = resetRecurringSettings;
  (window as any).updateFrequencyFields = updateFrequencyFields;
  (window as any).updateDurationFields = updateDurationFields;
  (window as any).updateRecurringPreview = updateRecurringPreview;
  (window as any).collectRecurringSettings = collectRecurringSettings;

  // Expose edit modal functions globally for onclick handlers (Phase 4)
  (window as any).openEditModal = openEditModal;
  (window as any).openEditPendingRecord = openEditPendingRecord;
  (window as any).closeEditModal = closeEditModal;
  (window as any).updateEditFact = updateEditFact;
  (window as any).deleteFact = deleteFact;
  (window as any).deleteFactFromDashboard = deleteFactFromDashboard;
  (window as any).toggleEditReminderSettings = toggleEditReminderSettings;
  (window as any).handleRecurringDeleteChoice = handleRecurringDeleteChoice;
  (window as any).setupEditCategoryTypeButtons = setupEditCategoryTypeButtons;

  // Expose UI functions globally for onclick handlers (Phase 5)
  (window as any).toggleQuickStats = toggleQuickStats;
  (window as any).toggleAccountBalances = toggleAccountBalances;

  // Expose HTMX refresh functions globally (Phase 5)
  (window as any).refreshDashboard = refreshDashboardImpl;
  (window as any).refreshRecentTransactions = refreshRecentTransactionsImpl;
  (window as any).refreshQuickStats = refreshQuickStatsImpl;
  (window as any).refreshAccountBalances = refreshAccountBalancesImpl;

  debugLog('[Dashboard] Window exports initialized');
}

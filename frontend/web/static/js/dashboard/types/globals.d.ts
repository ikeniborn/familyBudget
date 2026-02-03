/**
 * Dashboard Module Global Type Declarations
 *
 * Declares types for window globals and external dependencies
 */

import type {
  Category,
  FinancialCenter,
  CostCenter,
  DropdownCache,
  PendingRecord,
  UnsyncedItemsResult,
  SyncResults,
  EditRecordType,
  RecordType,
  RecurringSettings,
} from './dashboard.d';

// ============================================================================
// CategoryTreeSelect Widget Interface
// ============================================================================

export interface CategoryTreeSelectOptions {
  type?: string;
  showLeafOnly?: boolean;
  mode?: 'create' | 'edit';
  financialCenterId?: number | null;
  onCategoryChange?: (category: Category | null) => void;
}

export interface CategoryTreeSelectInstance {
  updateType(type: string): Promise<void>;
  updateFinancialCenter(fcId: number | null): Promise<void>;
  getSelectedCategory(): Category | null;
  clearSelection(): void;
  setSelectedCategory(categoryId: number, maxRetries?: number, retryDelay?: number): Promise<void>;
  destroy(): void;
  options: CategoryTreeSelectOptions;
}

// ============================================================================
// CalendarWidget Interface
// ============================================================================

export interface CalendarWidgetOptions {
  inputElement: HTMLInputElement;
  mode?: 'single' | 'range';
  minDate?: Date;
  maxDate?: Date;
  onSelect?: (date: Date | Date[]) => void;
}

export interface CalendarWidgetInstance {
  destroy(): void;
  setDate(date: Date): void;
  getDate(): Date | null;
}

// ============================================================================
// OfflineManager Interface
// ============================================================================

export interface OfflineManagerDB {
  generateContentHash(data: object): string;
  _md5(input: string): string;
  addFact(fact: object): Promise<void>;
  addToSyncQueue(item: object): Promise<number>;
  deleteFact(tempId: string): Promise<void>;
  deleteTransfer(tempId: string): Promise<void>;
  deleteSyncQueueItem(id: number): Promise<void>;
}

export interface NetworkDetector {
  getStatus(): 'online' | 'offline';
}

export interface OfflineManager {
  db: OfflineManagerDB;
  isOnline: boolean;
  maxRetries: number;
  networkDetector?: NetworkDetector;
  getPendingSyncItems(): Promise<PendingRecord[]>;
  getAllUnsyncedItems(): Promise<UnsyncedItemsResult>;
  removePendingItem(id: number): Promise<void>;
  sync(): Promise<SyncResults>;
  createFactOffline(data: object): Promise<object>;
  createPlanOffline(data: object): Promise<object>;
  createTransferOffline(data: object): Promise<object>;
  getCurrentUserId(): Promise<number>;
}

// ============================================================================
// BudgetWSClient Interface
// ============================================================================

export interface BudgetWSClient {
  on(event: string, callback: (data: any) => void): void;
  off(event: string, callback: (data: any) => void): void;
  emit(event: string, data: any): void;
}

// ============================================================================
// BudgetShared Namespace
// ============================================================================

export interface DateFormatterStatic {
  formatForDisplay(isoDate: string): string;
  formatForAPI(displayDate: string): string;
  today(): string;
  isValidDisplayFormat(date: string): boolean;
}

export interface RemindersStatic {
  createReminder(factId: string, reminderDatetime: string): Promise<any>;
  updateReminder(factId: string, reminderDatetime: string): Promise<any>;
  deleteReminder(factId: string): Promise<boolean>;
  getRemindersForFacts(factIds: number[]): Promise<any[]>;
}

export interface BudgetSharedNamespace {
  ChoicesCategoryTree: new (selector: string, options: CategoryTreeSelectOptions) => CategoryTreeSelectInstance;
  CalendarWidget: new (options: CalendarWidgetOptions) => CalendarWidgetInstance;
  DateFormatter: DateFormatterStatic;
  Reminders?: RemindersStatic;
}

// ============================================================================
// IncrementalUpdates Interface
// ============================================================================

export interface IncrementalUpdates {
  onFactCreated(data: object): void;
  onFactUpdated(data: object): void;
  onFactDeleted(data: object): void;
  onPlanCreated(data: object): void;
  onPlanUpdated(data: object): void;
  onPlanDeleted(data: object): void;
  onTransferCreated(data: object): void;
  onTransferDeleted(data: object): void;
}

// ============================================================================
// WorkerWrapper Interface
// ============================================================================

export interface WorkerWrapperOptions {
  idleTimeout?: number;
  debugMode?: boolean;
}

export interface WorkerWrapper {
  execute(task: { action: string; data: object }): Promise<any>;
  terminate(): void;
}

export interface WorkerWrapperConstructor {
  new (workerPath: string, options?: WorkerWrapperOptions): WorkerWrapper;
}

// ============================================================================
// HTMX Interface
// ============================================================================

export interface HtmxAjaxOptions {
  target: string;
  swap: string;
}

export interface Htmx {
  ajax(method: string, url: string, options: HtmxAjaxOptions): void;
}

// ============================================================================
// Window Global Extensions
// ============================================================================

declare global {
  interface Window {
    // Dashboard module
    Dashboard?: DashboardExports;

    // External dependencies
    offlineManager?: OfflineManager;
    budgetWSClient?: BudgetWSClient;
    BudgetShared?: BudgetSharedNamespace;
    IncrementalUpdates?: IncrementalUpdates;
    WorkerWrapper?: WorkerWrapperConstructor;

    // Feature flags
    FEATURE_FLAGS?: {
      ENABLE_WEB_WORKERS?: boolean;
    };
    DEBUG_MODE?: boolean;

    // HTMX
    htmx?: Htmx;

    // Legacy globals for backward compatibility
    transactionCategoryTreeSelect?: CategoryTreeSelectInstance | null;
    planCategoryTreeSelect?: CategoryTreeSelectInstance | null;
    editCategoryTreeSelect?: CategoryTreeSelectInstance | null;
    fromCategoryTree?: CategoryTreeSelectInstance | null;
    toCategoryTree?: CategoryTreeSelectInstance | null;
    dropdownCache?: DropdownCache | null;
    allCostCenters?: CostCenter[];

    // Transfer modal integration
    handleTransferEditClick?: (itemId: number, side: 'from' | 'to') => Promise<void>;
    openTransferModal?: () => Promise<void>;

    // =========================================================================
    // Dashboard Window Exports (for HTML onclick handlers)
    // =========================================================================

    // Pending records
    loadPendingRecords?: () => Promise<void>;
    deletePendingRecord?: (id: number) => Promise<void>;
    retryFailedItems?: () => Promise<void>;
    deleteFailedRecords?: () => Promise<void>;

    // Add transaction
    loadTransactionCategories?: () => Promise<void>;
    saveTransaction?: (button: HTMLElement) => void;
    filterCostCenterDropdown?: (formSelectorOrFcId: string | number | null, financialCenterId?: number | null) => Promise<void>;

    // Add plan
    loadPlanCategories?: () => Promise<void>;
    savePlan?: (button: HTMLElement) => void;
    togglePlanMode?: (modalId: string) => void;
    toggleReminderSettings?: (modalId: string) => void;

    // Recurring settings
    initRecurringFields?: (modalId: string) => void;
    resetRecurringOnlyFields?: (modalId: string) => void;
    resetRecurringSettings?: (modalId: string) => void;
    updateFrequencyFields?: (modalId: string) => void;
    updateDurationFields?: (modalId: string) => void;
    updateYearlyFrequencyValue?: (modalId: string) => void;
    updateRecurringPreview?: (modalId: string) => void;
    collectRecurringSettings?: (modalId: string) => RecurringSettings | null;

    // Edit modal
    openEditModal?: (recordType: 'fact' | 'plan', recordId: number) => Promise<void>;
    openEditPendingRecord?: (pendingId: number, entity: string) => Promise<void>;
    closeEditModal?: () => void;
    updateEditFact?: (event: Event) => Promise<void>;
    deleteFact?: (factId: number) => Promise<void>;
    deleteFactFromDashboard?: (factId: number, isRecurring: number | boolean) => Promise<void>;
    toggleEditReminderSettings?: () => void;
    handleRecurringDeleteChoice?: (choice: string | null) => void;
    setupEditCategoryTypeButtons?: () => void;

    // UI
    toggleQuickStats?: () => void;
    toggleAccountBalances?: () => void;

    // HTMX refresh
    refreshDashboard?: () => void;
    refreshRecentTransactions?: () => void;
    refreshQuickStats?: () => void;
    refreshAccountBalances?: () => void;

    // Dashboard-specific (HTML onclick handlers)
    openEditFromDashboard?: (factId: number) => Promise<void>;
    deleteRecordFromDashboard?: (factId: number) => Promise<void>;
    recurringDeleteResolve?: (choice: string | null) => void;
    openAddTransactionModal?: () => Promise<void>;
    openFactTransferModal?: () => Promise<void>;

    // Tabbed Modals (v9.0)
    openModalFact?: () => void;
    closeModalFact?: () => void;
    saveFactModal?: (button: HTMLElement) => void;
    openModalPlan?: () => void;
    closeModalPlan?: () => void;
    savePlanModal?: (button: HTMLElement) => void;

    // Simplified FAB (v9.0)
    openContextModal?: () => void;

    // Dexie Diagnostic Modal (triple-click on green database icon)
    openDexieDiagnostic?: () => void;

    // Facts module shared functions (used by both dashboard and facts)
    updateBatchDeleteButton?: () => void;
    updateFact?: (event: Event) => Promise<void>;
    deleteFromEditModal?: () => Promise<void>;
    saveTransfer?: (button: HTMLElement) => void;
    setTransactionDate?: (offsetDays: number) => void;
    setFactDate?: (offsetDays: number) => void;
    setFactTransferDate?: (offsetDays: number) => void;
    loadFactHints?: (category?: any) => Promise<void>;
  }

  // Global functions
  function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info'): void;
  function debugLog(...args: any[]): void;
  function setButtonLoading(button: HTMLElement, loading: boolean): void;
  function updatePendingSyncBadge(count: number, showAnimation: boolean): void;
}

// ============================================================================
// Dashboard Module Exports Interface
// ============================================================================

export interface DashboardExports {
  // Initialization
  init(): Promise<void>;

  // Edit modal (Phase 4)
  openEditModal(recordType: 'fact' | 'plan', recordId: number): Promise<void>;
  openEditPendingRecord(pendingId: number, entity: string): Promise<void>;
  closeEditModal(): void;
  updateEditFact(event: Event): Promise<void>;
  deleteFact(): Promise<void>;
  deleteFactFromDashboard(factId: number, isRecurring: number | boolean): Promise<void>;
  toggleEditReminderSettings(): void;
  handleRecurringDeleteChoice(choice: string | null): void;
  setupEditCategoryTypeButtons(): void;

  // Add transaction (Phase 3)
  loadTransactionCategories(): Promise<void>;
  saveTransaction(button: HTMLElement): void;
  saveTransactionOffline(button: HTMLElement): Promise<void>;
  setTransactionDate(daysOffset: number): void;
  loadFinancialCenters(): Promise<void>;
  loadCostCenters(): Promise<void>;
  filterCostCenterDropdown(formSelectorOrFcId: string | number | null, financialCenterId?: number | null): Promise<void>;
  loadFactHints(category?: Category | null): Promise<void>;

  // Add plan (Phase 3) - kept for backward compatibility
  loadPlanCategories(): Promise<void>;
  savePlan(button: HTMLElement): void;
  savePlanOffline(button: HTMLElement): Promise<void>;
  loadPlanHints(category?: Category | null): Promise<void>;

  // Plan mode (Phase 3)
  togglePlanMode(modalId: string): void;
  toggleReminderSettings(modalId: string): void;
  prefillReminderDateTime(modalId: string): void;
  initReminderCalendarWidget(modalId: string): void;
  resetReminderFields(modalId: string): void;

  // Recurring settings (Phase 3)
  initRecurringFields(modalId: string): void;
  resetRecurringOnlyFields(modalId: string): void;
  resetRecurringSettings(modalId: string): void;
  updateFrequencyFields(modalId: string): void;
  updateDurationFields(modalId: string): void;
  updateYearlyFrequencyValue(modalId: string): void;
  updateRecurringPreview(modalId: string): void;
  collectRecurringSettings(modalId: string): RecurringSettings | null;

  // Pending records (Phase 2)
  loadPendingRecords(): Promise<void>;
  deletePendingRecord(id: number): Promise<void>;
  retryFailedItems(): Promise<void>;
  deleteFailedRecords(): Promise<void>;

  // Transfer (delegated to transfers module)
  setTransferRecordType(type: RecordType): void;
  saveTransfer(button: HTMLElement): void;

  // UI (Phase 5)
  toggleQuickStats(): void;
  toggleAccountBalances(): void;

  // Dashboard-specific functions for HTML onclick handlers
  openEditFromDashboard(factId: number): Promise<void>;
  deleteRecordFromDashboard(factId: number): Promise<void>;
  recurringDeleteResolve(choice: string | null): void;
  openAddTransactionModal(): Promise<void>;
  openFactTransferModal(): Promise<void>;

  // Tabbed Modals (v9.0)
  openModalFact(): void;
  closeModalFact(): void;
  saveFactModal(button: HTMLElement): void;
  openModalPlan(): void;
  closeModalPlan(): void;
  savePlanModal(button: HTMLElement): void;

  // Simplified FAB (v9.0)
  openContextModal(): void;
}

export {};

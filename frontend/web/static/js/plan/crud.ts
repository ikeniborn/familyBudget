/**
 * Plan CRUD Module
 * Handles plan creation, editing, deletion, and modal management
 *
 * @module plan/crud
 * @version 3.4.0 (Phase 5: TypeScript Consolidation)
 * @description CRUD operations for budget plans with full modal management
 */

import * as PlanHelpers from './helpers';
import * as PlanFactsTable from './factsTable';
import { remindersMap, selectedFactIds } from './factsTable';
import * as FilterAnalyticsSync from './filterAnalyticsSync';

// Import BudgetShared from global
declare const BudgetShared: {
  DateFormatter: {
    formatForDisplay: (isoDate: string) => string;
    formatForAPI: (displayDate: string) => string;
    isValidDisplayFormat: (displayDate: string) => boolean;
  };
  CalendarWidget: any; // Constructor
  ChoicesCategoryTree: any; // Constructor
};

// Global variables from plan.html (set via window in planModal/windowExports)
declare let allCategories: any[];
declare const ModalListenerManager: any;
declare const showNotification: (message: string, type: string) => void;
declare const selectedRecurringPlanIds: Set<number>;

// Module-local state (previously declared as globals, only used in this module)
let editCategoryTreeSelect: any = null;
let editDateCalendar: any = null;
let createCategoryTreeSelect: any = null;
// remindersMap and selectedFactIds are imported from factsTable (see import above)

// Logger class from utils/logger.js (loaded globally via bundle)
declare class Logger {
  constructor(prefix: string, moduleKey: string);
  debug(...args: any[]): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

// Global functions from plan.html
declare function loadFinancialCenters(): Promise<void>;
declare function loadCostCenters(): Promise<void>;
declare function filterCostCenterDropdown(formSelector: string, fcId: number | null): Promise<void>;
declare function resetEditReminderFields(): void;
declare function populateEditReminderFields(datetime: string): void;
declare function initEditReminderCalendarWidget(): void;
declare function getReminderStatusBadge(status: string): { text: string; class: string };
declare function prefillReminderDateTime(modalId: string): void;
declare function togglePlanMode(modalId: string): void;
declare function collectRecurringSettings(modalId: string): any;
declare function resetRecurringSettings(modalId: string): void;
declare function resetReminderFields(modalId: string): void;
declare function setupCreatePlanPeriodButtons(): void;
declare function setSubmitLoading(form: HTMLFormElement, isLoading: boolean): void;
declare function showToast(message: string, type: string): void;
declare function loadRecurringPlans(): Promise<void>;
declare function updateBatchDeleteRecurringPlansButtonState(): void;

// ============================================================================
// Type Definitions
// ============================================================================
// Re-export shared types from helpers for backward compatibility
export type BudgetFact = PlanHelpers.BudgetFact;
export type RecurringPlan = PlanHelpers.RecurringPlan;
export type Reminder = PlanHelpers.Reminder;

// ============================================================================
// Logger Instance
// ============================================================================

const logCrud = new Logger('[PLAN_CRUD]', 'PLAN');

/**
 * Form data for plan creation/editing
 * Module-specific interface for form validation and submission
 */
export interface PlanFormData {
  start_date: string;
  financial_center_id: number;
  record_type: 'expense' | 'income';
  article_id: number;
  cost_center_id?: number | null;
  amount: number;
  description?: string;
  is_recurring: boolean;
  frequency_type?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  frequency_value?: number;
  duration_type?: 'indefinite' | 'until_date' | 'count';
  duration_value?: number | null;
  end_date?: string | null;
  reminder_enabled?: boolean;
  reminder_datetime?: string | null;
  reminder_message?: string | null;
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Current recurring plan being edited
 * Loaded when editing a fact with recurring_plan_id
 */
let currentRecurringPlan: RecurringPlan | null = null;

/**
 * Calendar widget for template end date in edit modal
 * Created when editing recurring plans, destroyed on modal close
 */
let editTemplateEndDateCalendar: any = null;

/**
 * Set of fact IDs currently being deleted
 * Used to prevent race conditions in simultaneous delete operations
 */
const deletingFactIds = new Set<number>();

/**
 * Callback resolver for recurring delete dialog
 * Set when dialog is opened, called when user makes choice
 */
let recurringDeleteResolveCallback: ((choice: 'single' | 'all' | null) => void) | null = null;

/**
 * Calendar widget for recurring plan end date
 * Created when duration type is set to 'end_date', destroyed when changed
 */
let recurringEndDateCalendarWidget: any = null;

/**
 * Get current recurring plan
 */
export function getCurrentRecurringPlan(): RecurringPlan | null {
  return currentRecurringPlan;
}

/**
 * Set current recurring plan
 */
export function setCurrentRecurringPlan(plan: RecurringPlan | null): void {
  currentRecurringPlan = plan;
}

// ============================================================================
// Modal Management
// ============================================================================

// ============================================================================
// Helper Functions for Modal Management
// ============================================================================

/**
 * Populate recurring plan info in edit modal
 * @param plan - Recurring plan data from API
 */
function populateRecurringPlanInfo(plan: RecurringPlan | null): void {
  logCrud.debug('[POPULATE] populating recurring plan info:', plan);

  if (!plan) {
    logCrud.warn('[POPULATE] Plan is null/undefined, skipping');
    return;
  }

  // Update status badge
  const statusBadge = document.getElementById('edit-recurring-status') as HTMLSpanElement | null;
  if (statusBadge) {
    if (plan.is_active) {
      statusBadge.textContent = 'Активен';
      statusBadge.className = 'badge badge-sm badge-success';
    } else {
      statusBadge.textContent = 'Приостановлен';
      statusBadge.className = 'badge badge-sm badge-warning';
    }
  }

  // Update frequency display
  const frequencyEl = document.getElementById('edit-recurring-frequency') as HTMLSpanElement | null;
  if (frequencyEl) {
    frequencyEl.textContent = (plan as any).frequency_display || getFrequencyDisplayText(plan.frequency_type, plan.frequency_value);
  }

  // Update next generation date
  const nextDateEl = document.getElementById('edit-recurring-next-date') as HTMLSpanElement | null;
  if (nextDateEl) {
    if ((plan as any).next_generation_date) {
      nextDateEl.textContent = BudgetShared.DateFormatter.formatForDisplay((plan as any).next_generation_date);
    } else {
      nextDateEl.textContent = plan.is_active ? '—' : 'Приостановлено';
    }
  }

  // Update period (start_date - end_date)
  const periodEl = document.getElementById('edit-recurring-period') as HTMLSpanElement | null;
  if (periodEl) {
    const startStr = BudgetShared.DateFormatter.formatForDisplay(plan.start_date);
    if (plan.end_date) {
      const endStr = BudgetShared.DateFormatter.formatForDisplay(plan.end_date);
      periodEl.textContent = `${startStr} — ${endStr}`;
    } else if ((plan as any).occurrences_count) {
      periodEl.textContent = `с ${startStr} (${(plan as any).occurrences_count} повторений)`;
    } else {
      periodEl.textContent = `с ${startStr} (бессрочно)`;
    }
  }

  // Update generated count
  const generatedEl = document.getElementById('edit-recurring-generated') as HTMLSpanElement | null;
  if (generatedEl) {
    if ((plan as any).occurrences_count) {
      generatedEl.textContent = `${(plan as any).occurrences_generated} / ${(plan as any).occurrences_count}`;
    } else {
      generatedEl.textContent = String((plan as any).occurrences_generated);
    }
  }

  // Pre-fill template fields
  const endDateInput = document.getElementById('edit-template-end-date') as HTMLInputElement | null;
  if (endDateInput && plan.end_date) {
    endDateInput.value = BudgetShared.DateFormatter.formatForDisplay(plan.end_date);
  } else if (endDateInput) {
    endDateInput.value = '';
  }

  const isActiveCheckbox = document.getElementById('edit-template-is-active') as HTMLInputElement | null;
  if (isActiveCheckbox) {
    isActiveCheckbox.checked = plan.is_active;
  }
}

/**
 * Update category type badge in edit modal
 * @param type - Category type (expense, income, debit, credit)
 */
function updateEditCategoryTypeBadge(type: string): void {
  const badge = document.getElementById('edit-category-type-label') as HTMLSpanElement | null;
  if (!badge) return;

  const typeConfig: Record<string, { text: string; class: string }> = {
    expense: { text: 'Расход', class: 'badge-error' },
    income: { text: 'Доход', class: 'badge-success' },
    debit: { text: 'Списание', class: 'badge-info' },
    credit: { text: 'Пополнение', class: 'badge-warning' }
  };

  const config = typeConfig[type] || typeConfig.expense;
  badge.textContent = config.text;
  badge.className = `badge badge-sm ${config.class}`;
}

/**
 * Open add plan modal
 * Shows create form for new plan (regular, recurring, or with reminder)
 */
export function openAddPlanModal(): void {
  const modalId = 'modal_plan';

  // Reset button state
  const form = document.getElementById('form_modal_plan') as HTMLFormElement | null;
  const submitBtn = form?.querySelector('.save-btn') as HTMLButtonElement | null;
  if (submitBtn) {
    submitBtn.disabled = false;
    delete (submitBtn as any).dataset.originalHtml; // Clear cache (if exists)
  }

  // CRITICAL: Reset FC filter state and clear selection for create modals
  if (typeof createCategoryTreeSelect !== 'undefined' && createCategoryTreeSelect) {
    createCategoryTreeSelect.options.financialCenterId = null;
    createCategoryTreeSelect.clearSelection();
    logCrud.debug('[MODAL_CREATE] Plan modal: FC reset and selection cleared');
  }

  // Pre-fill reminder date and time before opening
  prefillReminderDateTime(modalId);

  // Open the modal
  const modal = document.getElementById(modalId) as HTMLDialogElement | null;
  if (modal && modal.showModal) {
    modal.showModal();

    // ✅ FIX: Handle backdrop clicks explicitly
    if (!(modal.dataset.backdropHandlerAdded)) {
      modal.addEventListener('click', (e) => {
        // Close only if click is OUTSIDE modal-box
        const modalBox = modal.querySelector('.modal-box');
        if (modalBox && !modalBox.contains(e.target as Node)) {
          modal.close();
        }
      });
      modal.dataset.backdropHandlerAdded = 'true';
    }

    // ✅ FIX: Initialize plan mode on modal open
    togglePlanMode(modalId);
  }
}

/**
 * Show edit modal for existing fact
 * Loads fact data and populates edit form
 *
 * @param factId - ID of fact to edit
 */
export async function showEditModal(factId: number): Promise<void> {
  logCrud.debug('[SHOW_EDIT_MODAL] Called with factId:', factId);

  const factsData = PlanFactsTable.getFactsData();
  logCrud.debug('[SHOW_EDIT_MODAL] factsData length:', factsData?.length);

  const fact = factsData.find(f => f.id === factId);

  if (!fact) {
    logCrud.error('[SHOW_EDIT_MODAL] Fact not found in factsData! factId:', factId);
    logCrud.error('[SHOW_EDIT_MODAL] Available fact IDs:', factsData?.map(f => f.id));
    return;
  }

  logCrud.debug('[SHOW_EDIT_MODAL] Fact found:', fact);

  // Fill basic fields
  (document.getElementById('edit-id') as HTMLInputElement).value = String(fact.id);
  (document.getElementById('edit-amount') as HTMLInputElement).value = String(Number.parseInt(String(fact.amount), 10));
  (document.getElementById('edit-date') as HTMLInputElement).value = BudgetShared.DateFormatter.formatForDisplay(fact.fact_date);
  (document.getElementById('edit-description') as HTMLTextAreaElement).value = fact.description || '';

  // ✅ FIX: Ensure financial center dropdown is loaded before setting value (race condition fix)
  const fcDropdown = document.getElementById('edit-financial-center') as HTMLSelectElement;
  if (fcDropdown.options.length <= 1) {
    logCrud.debug('[Edit Modal] Financial center dropdown not loaded, loading now...');
    await loadFinancialCenters();
  }
  // Verify the option exists before setting
  if (fact.financial_center_id) {
    const fcOption = Array.from(fcDropdown.options).find(opt => Number(opt.value) === fact.financial_center_id);
    if (fcOption) {
      fcDropdown.value = String(fact.financial_center_id);
      logCrud.debug('[Edit Modal] Set financial center to:', fact.financial_center_id);
    } else {
      logCrud.warn('[Edit Modal] Financial center not found in dropdown:', fact.financial_center_id, '(may be archived/inactive)');
    }
  } else {
    fcDropdown.value = '';  // Explicitly set to empty if no FC
  }

  // ✅ FIX: Ensure cost center dropdown is loaded before setting value (race condition fix)
  const ccDropdown = document.getElementById('edit-cost-center') as HTMLSelectElement;
  if (ccDropdown.options.length <= 1) {
    logCrud.debug('[Edit Modal] Cost center dropdown not loaded, loading now...');
    await loadCostCenters();
  }
  // Verify the option exists before setting (cost center is optional)
  if (fact.cost_center_id) {
    const ccOption = Array.from(ccDropdown.options).find(opt => Number(opt.value) === fact.cost_center_id);
    if (ccOption) {
      ccDropdown.value = String(fact.cost_center_id);
      logCrud.debug('[Edit Modal] Set cost center to:', fact.cost_center_id);
    } else {
      logCrud.warn('[Edit Modal] Cost center not found in dropdown:', fact.cost_center_id, '(may be archived/inactive)');
    }
  } else {
    ccDropdown.value = '';  // Explicitly set to empty if no CC
  }

  // Handle recurring plan info and reminder container visibility
  const recurringPlanIdField = document.getElementById('edit-recurring-plan-id') as HTMLInputElement | null;
  const recurringInfoDiv = document.getElementById('edit-recurring-info') as HTMLDivElement | null;
  const reminderContainer = document.getElementById('edit-reminder-container') as HTMLDivElement | null;
  const templateFieldsDiv = document.getElementById('edit-template-fields') as HTMLDivElement | null;

  // Reset recurring plan state
  currentRecurringPlan = null;

  if (recurringPlanIdField) {
    recurringPlanIdField.value = fact.recurring_plan_id ? String(fact.recurring_plan_id) : '';
  }

  logCrud.debug('[EDIT MODAL] Fact loaded:', fact);
  logCrud.debug('[EDIT MODAL] record_type:', fact.record_type);
  logCrud.debug('[EDIT MODAL] recurring_plan_id:', fact.recurring_plan_id);

  // ✅ OPTIMIZATION: Show modal immediately (don't wait for recurring plan fetch)
  logCrud.debug('[SHOW_EDIT_MODAL] Opening modal...');
  const modal = document.getElementById('edit-modal') as HTMLDialogElement | null;

  if (!modal) {
    logCrud.error('[SHOW_EDIT_MODAL] CRITICAL: Modal element not found! #edit-modal');
    return;
  }

  logCrud.debug('[SHOW_EDIT_MODAL] Modal element found, calling showModal()');
  modal.showModal();
  logCrud.debug('[SHOW_EDIT_MODAL] Modal opened successfully');

  // ✅ FIX: Handle backdrop clicks explicitly (moved up for immediate modal opening)
  if (!(modal.dataset.backdropHandlerAdded)) {
    modal.addEventListener('click', (e) => {
      // Close only if click is directly on dialog (backdrop area)
      if (e.target === modal) {
        modal.close();
      }
    });
    modal.dataset.backdropHandlerAdded = 'true';
  }

  // ✅ OPTIMIZATION: Check if this is recurring plan before fetching
  if (!fact.recurring_plan_id) {
    // Not a recurring plan - hide recurring info section
    logCrud.debug('[EDIT_MODAL] Fact has NO recurring_plan_id, hiding recurring info');
    if (recurringInfoDiv) {
      recurringInfoDiv.classList.add('hidden');
    }
    if (reminderContainer) reminderContainer.classList.remove('hidden'); // Показать reminder
    if (templateFieldsDiv) templateFieldsDiv.classList.add('hidden');
    // ✅ Continue to category initialization (don't return early)
  } else {
    // This is a recurring plan fact - prepare UI
    logCrud.debug('[EDIT_MODAL] Fact has recurring_plan_id, loading plan details asynchronously...');

    if (reminderContainer) reminderContainer.classList.add('hidden'); // Скрыть reminder для recurring
    if (templateFieldsDiv) templateFieldsDiv.classList.add('hidden'); // Скрыть поля шаблона по умолчанию

    // Reset scope to 'single' by default
    const singleRadio = document.querySelector('input[name="edit_scope"][value="single"]') as HTMLInputElement | null;
    if (singleRadio) singleRadio.checked = true;

    // ✅ OPTIMIZATION: Show loading state immediately
    if (recurringInfoDiv) {
      recurringInfoDiv.innerHTML = `
        <div class="flex items-center justify-center py-4">
          <span class="loading loading-spinner loading-md text-primary"></span>
          <span class="ml-2">Загрузка данных регламентного платежа...</span>
        </div>
      `;
      recurringInfoDiv.classList.remove('hidden');
    }

    // ✅ OPTIMIZATION: Fetch асинхронно (non-blocking IIFE)
    (async () => {
      try {
        logCrud.debug('[EDIT_MODAL] Fetching recurring plan:', fact.recurring_plan_id);

        const planResponse = await fetch(
          `/api/v1/recurring-plans/${fact.recurring_plan_id}`,
          { credentials: 'include' }
        );

        logCrud.debug('[EDIT_MODAL] Recurring plan API response status:', planResponse.status);

        if (!planResponse.ok) {
          logCrud.error('[EDIT_MODAL] Failed to load recurring plan:', planResponse.status, planResponse.statusText);
          // Показать error state
          if (recurringInfoDiv) {
            recurringInfoDiv.innerHTML = `
              <div class="alert alert-warning">
                <span>⚠️ Не удалось загрузить данные регламентного платежа</span>
              </div>
            `;
          }
          return;
        }

        currentRecurringPlan = await planResponse.json();
        logCrud.debug('[EDIT_MODAL] Recurring plan loaded successfully:', currentRecurringPlan);

        // Clear loading state and populate content
        if (recurringInfoDiv) {
          recurringInfoDiv.innerHTML = ''; // Clear loading spinner
        }
        populateRecurringPlanInfo(currentRecurringPlan);
        logCrud.debug('[EDIT_MODAL] Recurring plan info populated');

      } catch (error) {
        logCrud.error('[EDIT_MODAL] Error loading recurring plan:', error);
        if (recurringInfoDiv) {
          recurringInfoDiv.innerHTML = `
            <div class="alert alert-error">
              <span>❌ Ошибка: ${escapeHtml((error as Error).message)}</span>
            </div>
          `;
        }
      }
    })();
  } // End of else block (recurring plan loading)

  // Determine category type from allCategories
  const selectedArticle = allCategories.find((a: any) => a.id === fact.article_id);
  const categoryType = selectedArticle ? selectedArticle.type : 'expense';

  // Update category type badge
  updateEditCategoryTypeBadge(categoryType);

  // Destroy previous ChoicesCategoryTree instance if exists
  if (editCategoryTreeSelect) {
    editCategoryTreeSelect.destroy();
    editCategoryTreeSelect = null;
  }

  // Initialize ChoicesCategoryTree for edit modal
  const editSelect = document.getElementById('edit-article') as HTMLSelectElement;
  if (editSelect) {
    // Clear existing options
    editSelect.innerHTML = '<option value="" disabled hidden>-- Выберите категорию --</option>';

    // @ts-ignore - BudgetShared.ChoicesCategoryTree is a constructor
    editCategoryTreeSelect = new BudgetShared.ChoicesCategoryTree('#edit-article', {
      type: categoryType,
      showLeafOnly: true,
      mode: 'edit',  // ✅ Edit mode - preserves category even on initial FC filter
      financialCenterId: fact.financial_center_id,
      onCategoryChange: (category: any) => {
        logCrud.debug('Category changed in edit modal:', category);
      }
    });

    // Wait for initialization to complete, then set selected value
    const initCheckInterval = setInterval(async () => {
      // Check if ChoicesCategoryTree has fully initialized
      if (editCategoryTreeSelect &&
          editCategoryTreeSelect.choices &&
          editCategoryTreeSelect.categoryMap &&
          editCategoryTreeSelect.categoryMap.size > 0) {

        // Get choices from the correct location: _store.choices
        const choicesStore = editCategoryTreeSelect.choices._store?.choices || [];

        logCrud.debug('[Edit Modal] Init check - choices loaded:', choicesStore.length, 'article_id:', fact.article_id);

        if (choicesStore.length > 0) {
          clearInterval(initCheckInterval);

          // Try to set the category (may fail if archived/inactive)
          if (editCategoryTreeSelect.categoryMap.has(fact.article_id)) {
            logCrud.debug('[Edit Modal] Setting category to:', fact.article_id);
            await editCategoryTreeSelect.setSelectedCategory(fact.article_id);

            // Verify it was set
            const selectedValue = editSelect.value;
            logCrud.debug('[Edit Modal] Category set. Dropdown value:', selectedValue);
          } else {
            logCrud.warn('[Edit Modal] Category not found in map:', fact.article_id, '(may be archived/inactive)');
            // Leave default "-- Выберите категорию --" selected
          }

          // Filter cost centers by financial center
          await filterCostCenterDropdown('#edit-form', fact.financial_center_id);
        }
      }
    }, 150); // Check every 150ms

    // Safety timeout to prevent infinite loop
    setTimeout(() => {
      clearInterval(initCheckInterval);
      logCrud.warn('[Edit Modal] Initialization timeout - giving up after 10 seconds');
    }, 10000);
  }

  // Setup financial center change handler for edit modal
  const editFcSelect = document.getElementById('edit-financial-center') as HTMLSelectElement;
  if (editFcSelect && editCategoryTreeSelect) {
    // Register listener with automatic cleanup via ModalListenerManager
    ModalListenerManager.registerListener(editFcSelect, 'change', async (e: Event) => {
      const fcId = editFcSelect.value ? parseInt(editFcSelect.value) : null;
      logCrud.debug(`[plan.html] 🔄 Financial Center changed in edit modal:`, {
        newFcId: fcId,
        currentCategoryValue: editCategoryTreeSelect ? (editCategoryTreeSelect.element ? editCategoryTreeSelect.element.value : null) : null
      });

      // CRITICAL: Stop event propagation to prevent global listeners from interfering
      e.stopPropagation();
      (e as any).stopImmediatePropagation();
      logCrud.debug('[FC_CHANGE] Stopped event propagation');

      // Filter categories by selected FC (will preserve selection if category is still available)
      if (editCategoryTreeSelect) {
        logCrud.debug('[FC_CHANGE] Updating category tree with new FC');
        await editCategoryTreeSelect.updateFinancialCenter(fcId);
        logCrud.debug('[FC_CHANGE] Category tree updated successfully');
      }
      // Filter cost centers by selected FC
      await filterCostCenterDropdown('#edit-form', fcId);

      // Small delay to allow DOM to settle (mobile browser optimization)
      await new Promise(resolve => setTimeout(resolve, 50));
      logCrud.debug('[FC_CHANGE] DOM settled, category dropdown ready');
    });
  }

  // Initialize CalendarWidget for edit modal date input
  const editDateInput = document.getElementById('edit-date') as HTMLInputElement | null;
  if (editDateInput) {
    // Destroy previous calendar instance if exists (prevent memory leak)
    if (editDateCalendar) {
      editDateCalendar.destroy();
      editDateCalendar = null;
    }

    // @ts-ignore - BudgetShared.CalendarWidget is a constructor
    editDateCalendar = new BudgetShared.CalendarWidget({
      mode: 'single',
      inputElement: editDateInput,
      onSelect: (date: Date) => {
        logCrud.debug('Выбрана дата для edit modal:', date);
      }
    });
  }

  // Load reminder data for edit modal
  const reminderCheckbox = document.getElementById('edit-enable-reminder') as HTMLInputElement | null;
  const reminderSettingsDiv = document.getElementById('edit-reminder-settings') as HTMLDivElement | null;
  const reminderStatusBadge = document.getElementById('edit-reminder-status') as HTMLSpanElement | null;

  // Reset reminder fields
  if (reminderCheckbox) reminderCheckbox.checked = false;
  resetEditReminderFields();
  if (reminderSettingsDiv) reminderSettingsDiv.classList.add('hidden');
  if (reminderStatusBadge) {
    reminderStatusBadge.classList.add('hidden');
    reminderStatusBadge.className = 'badge badge-sm badge-ghost hidden';
    reminderStatusBadge.textContent = '';
  }

  // Check existing reminder from pre-loaded map (no extra fetch needed)
  const reminder = remindersMap.get(factId);
  if (reminder) {
    if (reminderCheckbox) reminderCheckbox.checked = true;
    // Populate separate date/hour/minute fields
    populateEditReminderFields(reminder.remind_at);
    if (reminderSettingsDiv) reminderSettingsDiv.classList.remove('hidden');
    // Initialize CalendarWidget for edit reminder date
    initEditReminderCalendarWidget();

    // Show status badge
    if (reminderStatusBadge && reminder.status) {
      const badge = getReminderStatusBadge(reminder.status);
      reminderStatusBadge.textContent = badge.text;
      reminderStatusBadge.className = `badge badge-sm ${badge.class}`;
      reminderStatusBadge.classList.remove('hidden');
    }
  }
}

/**
 * Close edit modal
 * Cleans up calendar widgets and resets form state
 */
export function closeEditModal(): void {
  const modal = document.getElementById('edit-modal') as HTMLDialogElement | null;
  const form = document.getElementById('edit-form') as HTMLFormElement | null;

  if (modal) {
    modal.close();
  }

  if (form) {
    form.reset();
  }

  // Reset recurring plan state
  currentRecurringPlan = null;

  // Destroy template end date calendar if exists
  if (editTemplateEndDateCalendar) {
    editTemplateEndDateCalendar.destroy();
    editTemplateEndDateCalendar = null;
  }

  logCrud.debug('[CRUD] Edit modal closed and cleaned up');
}

// ============================================================================
// Basic CRUD Operations
// ============================================================================

/**
 * Delete fact by ID
 * Shows confirmation dialog before deletion
 *
 * @param factId - ID of fact to delete
 */
export async function deleteFact(factId: number): Promise<void> {
  // Prevent multiple simultaneous deletes of the same fact (race condition protection)
  if (deletingFactIds.has(factId)) {
    logCrud.warn('[CRUD] Delete already in progress for fact:', factId);
    return;
  }

  // Mark as deleting BEFORE async confirm dialog to prevent race condition on double-click
  deletingFactIds.add(factId);

  // Find fact in factsData to check if it's recurring
  const factsData = PlanFactsTable.getFactsData();
  const fact = factsData.find(f => f.id === factId);
  let deleteMode: 'single' | 'all' = 'single'; // default: delete just this fact

  if (fact && fact.recurring_plan_id) {
    // This is a recurring fact - ask user what to delete
    const choice = await showRecurringDeleteDialog();

    if (!choice) {
      // User cancelled — release guard
      deletingFactIds.delete(factId);
      return;
    }

    deleteMode = choice; // 'single' or 'all'
  } else {
    // Regular fact - show standard confirmation
    const confirmed = await showConfirmDialog(
      'Вы уверены, что хотите удалить эту транзакцию? Это действие необратимо.',
      '🗑️ Удаление транзакции'
    );

    if (!confirmed) {
      // User cancelled — release guard
      deletingFactIds.delete(factId);
      return;
    }
  }

  // Find button by data-fact-id attribute
  const button = document.querySelector(`button[data-fact-id="${factId}"]`) as HTMLButtonElement | null;

  // Disable button and show loading state
  if (button) {
    button.disabled = true;
    button.classList.add('loading', 'loading-spinner');
  }

  try {
    if (deleteMode === 'all' && fact && fact.recurring_plan_id) {
      // Delete all facts with same recurring_plan_id
      const recurringPlanId = fact.recurring_plan_id;

      // Find all fact IDs with this recurring_plan_id
      const factIdsToDelete = factsData
        .filter(f => f.recurring_plan_id === recurringPlanId)
        .map(f => f.id);

      logCrud.debug(`[CRUD] Deleting ${factIdsToDelete.length} recurring facts with recurring_plan_id=${recurringPlanId}`);

      // Use batch delete endpoint
      const response = await fetch('/api/v1/facts/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(factIdsToDelete)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP error! status: ${response.status}`);
      }

      // Reload and show success
      deletingFactIds.delete(factId);
      await PlanFactsTable.loadFacts();
      FilterAnalyticsSync.debouncedSyncFiltersToAnalytics();
      PlanHelpers.showToast(`Удалено ${factIdsToDelete.length} регламентных записей`, 'success');
    } else {
      // Delete single fact
      const response = await fetch(`/api/v1/facts/${factId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP error! status: ${response.status}`);
      }

      // Reload BEFORE showing toast (non-blocking)
      deletingFactIds.delete(factId);
      await PlanFactsTable.loadFacts();
      FilterAnalyticsSync.debouncedSyncFiltersToAnalytics();

      // Non-blocking toast notification
      PlanHelpers.showToast('Факт успешно удален', 'success');
    }
  } catch (error) {
    logCrud.error('[CRUD] Error deleting fact:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Reload even on error to sync UI
    deletingFactIds.delete(factId);
    await PlanFactsTable.loadFacts();
    FilterAnalyticsSync.debouncedSyncFiltersToAnalytics();

    // Non-blocking toast notification
    PlanHelpers.showToast('Ошибка: ' + errorMessage, 'error');
  }
}

/**
 * Delete fact from edit modal
 * Shows confirmation dialog, then closes modal and reloads table
 */
export async function deleteFromEditModal(): Promise<void> {
  const factIdInput = document.getElementById('edit-id') as HTMLInputElement | null;

  if (!factIdInput || !factIdInput.value) {
    logCrud.warn('[CRUD] deleteFromEditModal - No fact ID found');
    return;
  }

  const factId = parseInt(factIdInput.value);

  if (isNaN(factId)) {
    logCrud.error('[CRUD] deleteFromEditModal - Invalid fact ID:', factIdInput.value);
    return;
  }

  // Close edit modal before showing dialog
  closeEditModal();

  // Use main deleteFact() which handles both regular and recurring facts
  await deleteFact(factId);
}

// ============================================================================
// Internal Helper Functions
// ============================================================================

/**
 * Escape HTML to prevent XSS attacks
 * Converts special characters to HTML entities
 *
 * @param unsafe - Unsafe string that may contain HTML/JavaScript
 * @returns Escaped string safe for innerHTML
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Show confirmation dialog
 * Wrapper around window.showConfirmDialog with native confirm fallback
 *
 * @param message - Confirmation message
 * @param title - Dialog title
 * @returns Promise that resolves to true if confirmed, false otherwise
 */
async function showConfirmDialog(message: string, title: string): Promise<boolean> {
  if (typeof (window as any).showConfirmDialog === 'function') {
    return await (window as any).showConfirmDialog(message, title);
  }
  return confirm(message);
}

/**
 * Show confirmation dialog with optional checkbox
 * Used for batch operations that need additional user input
 *
 * @param message - Confirmation message
 * @param title - Dialog title
 * @param options - Optional configuration (checkboxLabel, checkboxId, checkboxDefault)
 * @returns Promise with { result: boolean, checkboxValue: boolean }
 */
async function showConfirmDialogWithCheckbox(
  message: string,
  title: string,
  options: {
    checkboxLabel?: string;
    checkboxId?: string;
    checkboxDefault?: boolean;
  } = {}
): Promise<{ result: boolean; checkboxValue: boolean }> {
  logCrud.debug('[CONFIRM_DIALOG] Showing confirmation dialog:', title);

  return new Promise((resolve) => {
    const modalId = 'confirm-dialog-checkbox-modal';
    const checkboxId = options.checkboxId || 'confirm-checkbox';

    const modalHTML = `
      <div class="modal modal-open" id="${modalId}">
        <div class="modal-box">
          <h2 class="text-base sm:text-lg font-semibold mb-1 sm:mb-2">${escapeHtml(title)}</h2>
          <p class="py-4">${escapeHtml(message)}</p>
          ${options.checkboxLabel ? `
            <div class="form-control">
              <label class="label cursor-pointer justify-start gap-2">
                <input type="checkbox" id="${checkboxId}" class="checkbox checkbox-primary"
                       ${options.checkboxDefault ? 'checked' : ''}>
                <span class="label-text">${escapeHtml(options.checkboxLabel)}</span>
              </label>
            </div>
          ` : ''}
          <div class="modal-action">
            <button class="btn" id="confirm-cancel-btn">Отмена</button>
            <button class="btn btn-error" id="confirm-ok-btn">Удалить</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById(modalId) as HTMLElement;
    const okBtn = document.getElementById('confirm-ok-btn') as HTMLButtonElement;
    const cancelBtn = document.getElementById('confirm-cancel-btn') as HTMLButtonElement;
    const checkbox = document.getElementById(checkboxId) as HTMLInputElement | null;

    const cleanup = () => {
      logCrud.debug('[CONFIRM_DIALOG] Cleaning up confirmation dialog');
      modal.remove();
    };

    okBtn.addEventListener('click', () => {
      cleanup();
      const checkboxValue = checkbox ? checkbox.checked : false;
      logCrud.debug('[CONFIRM_DIALOG] User confirmed, checkbox:', checkboxValue);
      resolve({ result: true, checkboxValue });
    });

    cancelBtn.addEventListener('click', () => {
      cleanup();
      logCrud.debug('[CONFIRM_DIALOG] User cancelled');
      resolve({ result: false, checkboxValue: false });
    });
  });
}

// ============================================================================
// Recurring Plan Helpers
// ============================================================================

/**
 * Show recurring plan delete dialog
 * Asks user whether to delete single instance or all occurrences
 *
 * @returns Promise that resolves to 'single', 'all', or null (cancelled)
 */
export function showRecurringDeleteDialog(): Promise<'single' | 'all' | null> {
  return new Promise((resolve) => {
    const modal = document.getElementById('recurring-delete-modal') as HTMLDialogElement | null;

    if (!modal) {
      logCrud.error('[CRUD] Recurring delete modal not found');
      resolve(null);
      return;
    }

    recurringDeleteResolveCallback = resolve;
    modal.showModal();
  });
}

/**
 * Resolve recurring delete dialog with user's choice
 * Called by onclick handlers in plan.html
 *
 * @param choice - 'single', 'all', or null (cancelled)
 */
export function recurringDeleteResolve(choice: 'single' | 'all' | null): void {
  const modal = document.getElementById('recurring-delete-modal') as HTMLDialogElement | null;

  if (modal) {
    modal.close();
  }

  if (recurringDeleteResolveCallback) {
    recurringDeleteResolveCallback(choice);
    recurringDeleteResolveCallback = null;
  }
}

/**
 * Get human-readable frequency display text
 * Converts frequency type + value to Russian text
 *
 * @param type - Frequency type (monthly, quarterly, yearly)
 * @param value - Frequency value (day of month or MMDD for yearly)
 * @returns Human-readable frequency text
 */
function getFrequencyDisplayText(type: string, value: number | null): string {
  logCrud.debug(`[CRUD] getFrequencyDisplayText: type=${type}, value=${value}`);

  switch (type) {
    case 'monthly':
      return value ? `Каждое ${value}-е число месяца` : 'Ежемесячно';
    case 'quarterly':
      return value ? `Каждое ${value}-е число квартала` : 'Ежеквартально';
    case 'yearly':
      if (!value) return 'Ежегодно';
      const month = Math.floor(value / 100);
      const day = value % 100;
      const monthNames = [
        'января',
        'февраля',
        'марта',
        'апреля',
        'мая',
        'июня',
        'июля',
        'августа',
        'сентября',
        'октября',
        'ноября',
        'декабря'
      ];
      const monthName = monthNames[month - 1] || '';
      logCrud.debug(`[CRUD] Yearly decoded: ${value} → ${day} ${monthName}`);
      return `Ежегодно, ${day} ${monthName}`;
    default:
      logCrud.warn(`[CRUD] Unknown frequency type: ${type}`);
      return type;
  }
}

/**
 * Update frequency-specific fields visibility
 * Shows/hides month day picker and yearly picker based on frequency type
 *
 * @param modalId - Modal ID (e.g., 'modal_plan')
 */
export function updateFrequencyFields(modalId: string): void {
  const frequencySelect = document.querySelector(
    `#${modalId} select[name="frequency_type"]`
  ) as HTMLSelectElement | null;
  const monthdayPicker = document.getElementById(`monthday-picker-${modalId}`);
  const yearlyPicker = document.getElementById(`yearly-picker-${modalId}`);

  logCrud.debug('[CRUD] updateFrequencyFields called, modalId:', modalId);

  if (!frequencySelect) return;

  const frequency = frequencySelect.value;
  logCrud.debug('[CRUD] Selected frequency:', frequency);

  // Show/hide appropriate picker based on frequency
  if (monthdayPicker) {
    monthdayPicker.classList.toggle('hidden', frequency !== 'monthly' && frequency !== 'quarterly');
  }

  if (yearlyPicker) {
    yearlyPicker.classList.toggle('hidden', frequency !== 'yearly');
  }

  updateRecurringPreview(modalId);
}

/**
 * Update yearly frequency value (encode month + day to MMDD format)
 * Validates day is valid for selected month
 *
 * @param modalId - Modal ID (e.g., 'modal_plan')
 */
export function updateYearlyFrequencyValue(modalId: string): void {
  const monthSelect = document.querySelector(
    `#${modalId} select[name="frequency_value_month"]`
  ) as HTMLSelectElement | null;
  const daySelect = document.querySelector(
    `#${modalId} select[name="frequency_value_day"]`
  ) as HTMLSelectElement | null;
  const hiddenInput = document.querySelector(
    `#${modalId} input[name="frequency_value_yearly"]`
  ) as HTMLInputElement | null;

  if (!monthSelect || !daySelect || !hiddenInput) return;

  const month = parseInt(monthSelect.value);
  const day = parseInt(daySelect.value);

  logCrud.debug(`[CRUD] updateYearlyFrequencyValue: month=${month}, day=${day}`);

  if (!month || !day) {
    hiddenInput.value = '';
    updateRecurringPreview(modalId);
    return;
  }

  // Validate day for month
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = daysInMonth[month - 1];

  if (day > maxDay) {
    const monthNames = [
      'Январь',
      'Февраль',
      'Март',
      'Апрель',
      'Май',
      'Июнь',
      'Июль',
      'Август',
      'Сентябрь',
      'Октябрь',
      'Ноябрь',
      'Декабрь'
    ];
    alert(`${monthNames[month - 1]} имеет только ${maxDay} дней. Выберите день 1-${maxDay}.`);
    daySelect.value = '';
    hiddenInput.value = '';
    logCrud.warn(`[CRUD] Invalid day ${day} for month ${month}`);
    return;
  }

  // Encode MMDD
  const frequencyValue = month * 100 + day;
  hiddenInput.value = String(frequencyValue);

  logCrud.debug(`[CRUD] Encoded frequency_value: ${frequencyValue} (MMDD format)`);

  updateRecurringPreview(modalId);
}

/**
 * Update duration-specific fields visibility
 * Also initializes/destroys CalendarWidget for end date field
 *
 * @param modalId - Modal ID (e.g., 'modal_plan')
 */
export function updateDurationFields(modalId: string): void {
  const durationSelect = document.querySelector(
    `#${modalId} select[name="duration_type"]`
  ) as HTMLSelectElement | null;
  const occurrencesField = document.getElementById(`occurrences-field-${modalId}`);
  const endDateField = document.getElementById(`end-date-field-${modalId}`);

  if (!durationSelect) return;

  const type = durationSelect.value;
  logCrud.debug('[CRUD] updateDurationFields - Duration type selected:', type);

  // Hide both fields if no selection (empty string)
  if (!type || type === '') {
    if (occurrencesField) occurrencesField.classList.add('hidden');
    if (endDateField) endDateField.classList.add('hidden');
    return;
  }

  if (occurrencesField) {
    occurrencesField.classList.toggle('hidden', type !== 'count');
  }

  if (endDateField) {
    endDateField.classList.toggle('hidden', type !== 'end_date');

    // Initialize/destroy CalendarWidget based on visibility
    const endDateInput = document.getElementById(`recurring_end_date_${modalId}`) as HTMLInputElement | null;
    if (type === 'end_date' && endDateInput) {
      // Initialize CalendarWidget when field becomes visible
      if (!recurringEndDateCalendarWidget && typeof BudgetShared !== 'undefined' && BudgetShared.CalendarWidget) {
        // @ts-ignore - BudgetShared.CalendarWidget is a constructor (defined as 'any' in global.d.ts)
        recurringEndDateCalendarWidget = new BudgetShared.CalendarWidget({
          inputElement: endDateInput,
          mode: 'single',
          minDate: new Date(),
          onSelect: () => updateRecurringPreview(modalId)
        });
      }
    } else {
      // Destroy CalendarWidget when field is hidden
      if (recurringEndDateCalendarWidget) {
        recurringEndDateCalendarWidget.destroy();
        recurringEndDateCalendarWidget = null;
      }
    }
  }

  updateRecurringPreview(modalId);
}

/**
 * Update recurring schedule preview text
 * Builds human-readable preview from frequency and duration settings
 *
 * @param modalId - Modal ID (e.g., 'modal_plan')
 */
export function updateRecurringPreview(modalId: string): void {
  const previewText = document.getElementById(`recurring-preview-text-${modalId}`);
  if (!previewText) return;

  const frequencySelect = document.querySelector(
    `#${modalId} select[name="frequency_type"]`
  ) as HTMLSelectElement | null;
  const frequency = frequencySelect ? frequencySelect.value : 'monthly';

  // Build frequency text
  let frequencyText = '';

  switch (frequency) {
    case 'monthly':
      const monthdaySelect = document.querySelector(
        `#${modalId} select[name="frequency_value_monthday"]`
      ) as HTMLSelectElement | null;
      const monthDay = monthdaySelect ? monthdaySelect.value : '1';
      frequencyText = `Ежемесячно, ${monthDay}-го числа`;
      break;
    case 'quarterly':
      const qMonthdaySelect = document.querySelector(
        `#${modalId} select[name="frequency_value_monthday"]`
      ) as HTMLSelectElement | null;
      const qMonthDay = qMonthdaySelect ? qMonthdaySelect.value : '1';
      frequencyText = `Ежеквартально, ${qMonthDay}-го числа`;
      break;
    case 'yearly':
      const yearlyHiddenInput = document.querySelector(
        `#${modalId} input[name="frequency_value_yearly"]`
      ) as HTMLInputElement | null;
      const yearlyValue = yearlyHiddenInput ? parseInt(yearlyHiddenInput.value) : null;
      if (yearlyValue) {
        frequencyText = getFrequencyDisplayText('yearly', yearlyValue);
      } else {
        frequencyText = 'Ежегодно (выберите дату)';
      }
      break;
  }

  // Build duration text
  let durationText = '';
  const durationSelect = document.querySelector(
    `#${modalId} select[name="duration_type"]`
  ) as HTMLSelectElement | null;
  const type = durationSelect ? durationSelect.value : 'indefinite';

  switch (type) {
    case 'indefinite':
      durationText = 'бессрочно';
      break;
    case 'count':
      const occurrencesInput = document.querySelector(
        `#${modalId} input[name="occurrences_count"]`
      ) as HTMLInputElement | null;
      const count = occurrencesInput ? occurrencesInput.value : '';
      durationText = count ? `${count} повторений` : 'укажите количество';
      break;
    case 'end_date':
      const endDateInput = document.getElementById(`recurring_end_date_${modalId}`) as HTMLInputElement | null;
      const endDate = endDateInput ? endDateInput.value : '';
      durationText = endDate ? `до ${endDate}` : 'укажите дату';
      break;
  }

  previewText.textContent = `${frequencyText}, ${durationText}`;
}

// ============================================================================
// Reminder Helpers
// ============================================================================

/**
 * Update reminder datetime hidden field
 * Combines date, hour, minute into ISO datetime format (YYYY-MM-DDTHH:mm)
 *
 * @param modalId - Modal ID (e.g., 'modal_plan')
 */
export function updateReminderDatetime(modalId: string): void {
  const dateInput = document.getElementById(`reminder_date_${modalId}`) as HTMLInputElement | null;
  const hourSelect = document.getElementById(`reminder_hour_${modalId}`) as HTMLSelectElement | null;
  const minuteSelect = document.getElementById(`reminder_minute_${modalId}`) as HTMLSelectElement | null;
  const hiddenInput = document.getElementById(`reminder_datetime_${modalId}`) as HTMLInputElement | null;

  if (!dateInput || !hourSelect || !minuteSelect || !hiddenInput) return;

  const dateValue = dateInput.value; // DD.MM.YYYY
  const hourValue = hourSelect.value; // HH
  const minuteValue = minuteSelect.value; // MM

  if (dateValue && hourValue && minuteValue) {
    // Parse DD.MM.YYYY to ISO date
    const isoDate = BudgetShared.DateFormatter.formatForAPI(dateValue); // YYYY-MM-DD
    if (isoDate) {
      // Combine into YYYY-MM-DDTHH:mm format
      hiddenInput.value = `${isoDate}T${hourValue}:${minuteValue}`;
    }
  } else {
    hiddenInput.value = '';
  }
}

/**
 * Update edit reminder datetime hidden field
 * Combines date, hour, minute into ISO datetime format (YYYY-MM-DDTHH:mm)
 * Edit modal version with different element IDs
 */
export function updateEditReminderDatetime(): void {
  const dateInput = document.getElementById('edit-reminder-date') as HTMLInputElement | null;
  const hourSelect = document.getElementById('edit-reminder-hour') as HTMLSelectElement | null;
  const minuteSelect = document.getElementById('edit-reminder-minute') as HTMLSelectElement | null;
  const hiddenInput = document.getElementById('edit-reminder-datetime') as HTMLInputElement | null;

  if (!dateInput || !hourSelect || !minuteSelect || !hiddenInput) return;

  const dateValue = dateInput.value; // DD.MM.YYYY
  const hourValue = hourSelect.value; // HH
  const minuteValue = minuteSelect.value; // MM

  if (dateValue && hourValue && minuteValue) {
    // Parse DD.MM.YYYY to ISO date
    const isoDate = BudgetShared.DateFormatter.formatForAPI(dateValue); // YYYY-MM-DD
    if (isoDate) {
      // Combine into YYYY-MM-DDTHH:mm format
      hiddenInput.value = `${isoDate}T${hourValue}:${minuteValue}`;
    }
  } else {
    hiddenInput.value = '';
  }
}

// ============================================================================
// Form Handlers
// ============================================================================

/**
 * Create plan (regular, recurring, or with reminder)
 * Handles form submission from add plan modal
 * @param event - Form submit event
 */
export async function createPlan(event: Event): Promise<void> {
  event.preventDefault();
  const form = (event.target as HTMLFormElement);
  setSubmitLoading(form, true);

  const formData = new FormData(form);
  const modalId = 'modal_plan';

  // Check plan mode from radio buttons
  const planMode = formData.get('plan_mode') || 'regular';
  const isRecurring = (planMode === 'recurring');
  const enableReminder = (planMode === 'reminder');

  // Get reminder datetime (only relevant if in reminder mode)
  const reminderDatetime = enableReminder ? formData.get('reminder_datetime') : null;

  logCrud.debug('[createPlan] Form submitted:', {
    planMode,
    isRecurring,
    enableReminder,
    amount: formData.get('amount'),
    article_id: formData.get('article_id'),
    plan_month: formData.get('plan_month')
  });

  try {
    if (isRecurring) {
      // ===== RECURRING PLAN CREATION =====
      logCrud.debug('[createPlan] Collecting recurring settings for modalId:', modalId);
      const recurringSettings = collectRecurringSettings(modalId);
      logCrud.debug('[createPlan] Collected recurringSettings:', recurringSettings);

      if (!recurringSettings) {
        logCrud.error('[createPlan] collectRecurringSettings() returned null!');
        showToast('Ошибка: не удалось собрать настройки регулярного платежа', 'error');
        setSubmitLoading(form, false);
        return;
      }

      // Get start date from plan_month
      const planMonth = formData.get('plan_month') as string; // "2025-11"
      const startDate = `${planMonth}-01`; // "2025-11-01"

      // Get names from select elements for offline display
      const articleId = parseInt(formData.get('article_id') as string);
      const financialCenterId = parseInt(formData.get('financial_center_id') as string);
      const costCenterId = formData.get('cost_center_id') ? parseInt(formData.get('cost_center_id') as string) : null;

      // Frontend validation
      if (isNaN(articleId) || articleId <= 0) {
        showToast('Выберите категорию', 'warning');
        setSubmitLoading(form, false);
        return;
      }
      if (isNaN(financialCenterId) || financialCenterId <= 0) {
        showToast('Выберите счет', 'warning');
        setSubmitLoading(form, false);
        return;
      }
      const amount = Number.parseInt(formData.get('amount') as string, 10);
      if (!Number.isInteger(amount) || amount <= 0) {
        showToast('Укажите корректную сумму (целое число > 0)', 'warning');
        setSubmitLoading(form, false);
        return;
      }

      const articleSelect = document.querySelector(`#${modalId} select[name="article_id"]`) as HTMLSelectElement | null;
      const financialCenterSelect = document.querySelector(`#${modalId} select[name="financial_center_id"]`) as HTMLSelectElement | null;
      const costCenterSelect = document.querySelector(`#${modalId} select[name="cost_center_id"]`) as HTMLSelectElement | null;

      const articleName = articleSelect?.selectedOptions[0]?.textContent || null;
      const financialCenterName = financialCenterSelect?.selectedOptions[0]?.textContent || null;
      const costCenterName = costCenterId ? (costCenterSelect?.selectedOptions[0]?.textContent || null) : null;

      // Try to get article type from data attribute or fetch (for offline display color)
      let articleType = articleSelect?.selectedOptions[0]?.dataset?.type || null;
      if (!articleType && articleId) {
        try {
          const articleResp = await fetch(`/api/v1/articles/${articleId}`, { credentials: 'include' });
          if (articleResp.ok) {
            const articleData = await articleResp.json();
            articleType = articleData.type;
          }
        } catch (err) {
          // Ignore error - type is optional for offline display
          logCrud.warn('[createPlan] Failed to fetch article type:', err);
        }
      }

      // Build recurring plan data
      const recurringData: any = {
        article_id: articleId,
        financial_center_id: financialCenterId,
        cost_center_id: costCenterId,
        amount: amount,
        description: formData.get('description') || null,
        record_type: 'plan',
        frequency_type: recurringSettings.frequency_type,
        frequency_value: recurringSettings.frequency_value,
        start_date: startDate,
        end_date: recurringSettings.end_date,
        occurrences_count: recurringSettings.occurrences_count,
        // Add names, type, and date for offline display in pending-records-card
        article_name: articleName,
        article_type: articleType,
        financial_center_name: financialCenterName,
        cost_center_name: costCenterName,
        plan_date: startDate,  // For pending records date display
        // Reminder settings
        enable_reminder: formData.get('recurring_enable_reminder') === 'on',
        reminder_hour: formData.get('recurring_enable_reminder') === 'on'
          ? parseInt(formData.get('recurring_reminder_hour') as string)
          : null,
        reminder_minute: formData.get('recurring_enable_reminder') === 'on'
          ? parseInt(formData.get('recurring_reminder_minute') as string)
          : null,
      };

      // Validate reminder time if enabled
      if (recurringData.enable_reminder) {
        if (recurringData.reminder_hour === null || recurringData.reminder_minute === null || isNaN(recurringData.reminder_hour) || isNaN(recurringData.reminder_minute)) {
          showToast('Укажите время напоминания для регулярного платежа', 'warning');
          setSubmitLoading(form, false);
          return;
        }
        logCrud.debug(`[createPlan] Reminder enabled: ${recurringData.reminder_hour.toString().padStart(2, '0')}:${recurringData.reminder_minute.toString().padStart(2, '0')}`);
      }

      logCrud.debug('[createPlan] Recurring data with reminders:', recurringData);
      logCrud.debug('[createPlan] Creating recurring plan:', recurringData);

      // Use OfflineManager if available for offline support
      if ((window as any).offlineManager) {
        const result = await (window as any).offlineManager.createRecurringPlan(recurringData);

        if (result._offline) {
          showToast('Регулярный платеж сохранён оффлайн (будет создан при подключении)', 'warning');
          logCrud.debug('[createPlan] Recurring plan saved offline:', result);
        } else {
          let message = `Регулярный платеж создан! Сгенерировано записей: ${result.occurrences_generated}`;
          if (result.enable_reminder && result.reminder_time_display) {
            message += `. Напоминания в ${result.reminder_time_display}`;
          }
          showToast(message, 'success');
          logCrud.debug('[createPlan] Recurring plan created:', result);
        }

        (document.getElementById('modal_plan') as HTMLDialogElement).close();
        form.reset();
        // Reset recurring settings
        resetRecurringSettings(modalId);
        // Reset reminder settings
        const reminderSettings = document.getElementById('reminder-settings-modal_plan');
        if (reminderSettings) reminderSettings.classList.add('hidden');
        resetReminderFields(modalId);
        await PlanFactsTable.loadFacts();
        setupCreatePlanPeriodButtons();
      } else {
        // Fallback to direct fetch if OfflineManager not available
        const response = await fetch('/api/v1/recurring-plans/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recurringData)
        });

        if (response.ok) {
          const createdPlan = await response.json();
          let message = `Регулярный платеж создан! Сгенерировано записей: ${createdPlan.occurrences_generated}`;
          if (createdPlan.enable_reminder && createdPlan.reminder_time_display) {
            message += `. Напоминания в ${createdPlan.reminder_time_display}`;
          }
          showToast(message, 'success');
          logCrud.debug('[createPlan] Recurring plan created:', createdPlan);

          (document.getElementById('modal_plan') as HTMLDialogElement).close();
          form.reset();
          // Reset recurring settings
          resetRecurringSettings(modalId);
          // Reset reminder settings
          const reminderSettings = document.getElementById('reminder-settings-modal_plan');
          if (reminderSettings) reminderSettings.classList.add('hidden');
          resetReminderFields(modalId);
          await PlanFactsTable.loadFacts();
          setupCreatePlanPeriodButtons();
        } else {
          const error = await response.json();
          let errorMsg = 'Не удалось создать регулярный платеж';
          if (Array.isArray(error.detail)) {
            errorMsg = error.detail.map((e: any) => e.msg || e.message || 'Ошибка').join('; ');
          } else if (error.detail && typeof error.detail === 'object' && error.detail.message) {
            errorMsg = error.detail.message;
          } else if (typeof error.detail === 'string') {
            errorMsg = error.detail;
          }
          showToast('Ошибка: ' + errorMsg, 'error');
        }
      }
      return;
    }

    // ===== REGULAR PLAN CREATION =====
    // Преобразовать plan_month (YYYY-MM) в fact_date (YYYY-MM-01)
    const planMonth = formData.get('plan_month') as string; // "2025-11"
    const factDate = `${planMonth}-01`; // "2025-11-01"

    const data: any = {
      record_type: 'plan',
      amount: Number.parseInt(formData.get('amount') as string, 10),
      article_id: parseInt(formData.get('article_id') as string),
      financial_center_id: parseInt(formData.get('financial_center_id') as string),
      cost_center_id: formData.get('cost_center_id') ? parseInt(formData.get('cost_center_id') as string) : null,
      fact_date: factDate, // Обязательное поле - первое число месяца плана
      description: formData.get('description') || null
    };

    // Use OfflineManager if available, otherwise fallback to direct fetch
    if ((window as any).offlineManager) {
      const result = await (window as any).offlineManager.createPlan(data);

      if (result._offline) {
        showToast('План сохранён оффлайн (будет синхронизирован при подключении)', 'warning');
        logCrud.debug('[createPlan] Saved offline:', result);
      } else {
        showToast('План успешно создан!', 'success');
        logCrud.debug('[createPlan] Saved online:', result);

        // Create reminder if enabled (only for online plans)
        if (enableReminder && reminderDatetime && result.id) {
          const reminderCreated = await (BudgetShared as any).Reminders.createReminder(result.id, reminderDatetime);
          if (reminderCreated) {
            // ✅ FIX 2: Update remindersMap to show icon in table
            remindersMap.set(result.id, reminderCreated);
            showToast('Напоминание установлено', 'success');
          } else {
            showToast('Предупреждение: план создан, но напоминание не установлено', 'warning');
          }
        }
      }

      (document.getElementById('modal_plan') as HTMLDialogElement).close();
      form.reset();
      // Reset reminder settings visibility and fields
      const reminderSettings = document.getElementById('reminder-settings-modal_plan');
      if (reminderSettings) reminderSettings.classList.add('hidden');
      resetReminderFields('modal_plan');
      if (result._offline) {
        await PlanFactsTable.loadFacts(); // только для offline (нет WS-события)
      }
      // для online: WS-событие plan_created обновит таблицу инкрементально

      // Переинициализировать кнопки периода
      setupCreatePlanPeriodButtons();
    } else {
      // Fallback to direct fetch if OfflineManager not available
      const response = await fetch('/api/v1/facts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const createdPlan = await response.json();
        showToast('План успешно создан!', 'success');

        // Create reminder if enabled
        if (enableReminder && reminderDatetime && createdPlan.id) {
          const reminderCreated = await (BudgetShared as any).Reminders.createReminder(createdPlan.id, reminderDatetime);
          if (reminderCreated) {
            // ✅ FIX 2: Update remindersMap to show icon in table
            remindersMap.set(createdPlan.id, reminderCreated);
            showToast('Напоминание установлено', 'success');
          } else {
            showToast('Предупреждение: план создан, но напоминание не установлено', 'warning');
          }
        }

        (document.getElementById('modal_plan') as HTMLDialogElement).close();
        form.reset();
        // Reset reminder settings visibility and fields
        const reminderSettings = document.getElementById('reminder-settings-modal_plan');
        if (reminderSettings) reminderSettings.classList.add('hidden');
        resetReminderFields('modal_plan');
        // WS-событие plan_created обновит таблицу инкрементально

        // Переинициализировать кнопки периода
        setupCreatePlanPeriodButtons();
      } else {
        const error = await response.json();
        showToast('Ошибка: ' + (error.detail || 'Не удалось создать план'), 'error');
      }
    }
  } catch (error) {
    logCrud.error('Error creating plan:', error);
    showToast('Ошибка при создании плана: ' + (error as Error).message, 'error');
  } finally {
    setSubmitLoading(form, false);
  }
}

/**
 * Update fact (single or recurring plan template)
 * Handles form submission from edit modal
 * @param event - Form submit event
 */
export async function updateFact(event: Event): Promise<void> {
  event.preventDefault();

  const formData = new FormData(event.target as HTMLFormElement);
  const factId = formData.get('id') as string;
  const displayDate = formData.get('fact_date') as string;

  // Get recurring plan settings FIRST (needed for validation)
  const recurringPlanId = formData.get('recurring_plan_id') as string;
  const editScope = formData.get('edit_scope') as string;

  // VALIDATION: Check date format BEFORE calling formatForAPI
  // Skip validation for template scope (date field is hidden)
  if (editScope !== 'template') {
    if (!displayDate || !BudgetShared.DateFormatter.isValidDisplayFormat(displayDate)) {
      showNotification('❌ Неверный формат даты. Используйте формат ДД.ММ.ГГГГ (например, 12.12.2025)', 'error');
      return;
    }
  }

  // ========== ALL VALIDATION PASSED - SHOW LOADING ==========
  setSubmitLoading(event.target as HTMLFormElement, true);

  // Build data object with optional center fields
  const data: any = {
    amount: Number.parseInt(formData.get('amount') as string, 10),
    fact_date: editScope !== 'template' ? BudgetShared.DateFormatter.formatForAPI(displayDate) : null,
    article_id: parseInt(formData.get('article_id') as string),
    description: formData.get('description') || null
  };

  // Add center fields if selected
  const financialCenterId = formData.get('financial_center_id') as string;
  const costCenterId = formData.get('cost_center_id') as string;

  if (financialCenterId) {
    data.financial_center_id = parseInt(financialCenterId);
  }

  if (costCenterId) {
    data.cost_center_id = parseInt(costCenterId);
  }

  // Get reminder settings from edit form
  const enableReminder = formData.get('enable_reminder') === 'on';
  const reminderDatetime = formData.get('reminder_datetime') as string;

  try {
    // Логирование вызова updateFact
    const factsData = PlanFactsTable.getFactsData();
    logCrud.debug('[EDIT MODAL] updateFact called:', {
      factId: factId,
      recordType: factsData.find(f => f.id == Number(factId))?.record_type,
      recurringPlanId: recurringPlanId,
      editScope: editScope
    });

    let response: Response;
    let successMessage = '✅ Факт успешно обновлен!';

    // Check if editing recurring plan template
    if (recurringPlanId && editScope === 'template') {
      logCrud.debug('[EDIT MODAL] Updating RECURRING PLAN TEMPLATE');
      // Update recurring plan template
      // Fields that can be updated: amount, description, cost_center_id, end_date, is_active
      const templateData: any = {
        amount: data.amount,
        description: data.description
      };

      // cost_center_id is optional (send null to clear)
      if (costCenterId) {
        templateData.cost_center_id = parseInt(costCenterId);
      } else {
        templateData.cost_center_id = null;
      }

      // Get template-specific fields
      const templateEndDate = formData.get('template_end_date') as string;
      const templateIsActive = formData.get('template_is_active') === 'on';

      // Add end_date if provided (convert from display format to API format)
      if (templateEndDate && BudgetShared.DateFormatter.isValidDisplayFormat(templateEndDate)) {
        templateData.end_date = BudgetShared.DateFormatter.formatForAPI(templateEndDate);
      }

      // Add is_active status
      templateData.is_active = templateIsActive;

      // Update recurring plan with regenerate_future=true to update existing future facts
      response = await fetch(`/api/v1/recurring-plans/${recurringPlanId}?regenerate_future=true`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        body: JSON.stringify(templateData)
      });
      successMessage = '✅ Шаблон обновлен, будущие записи пересозданы!';
    } else {
      logCrud.debug('[EDIT MODAL] Updating SINGLE FACT');
      // Update single fact
      response = await fetch(`/api/v1/facts/${factId}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        body: JSON.stringify(data)
      });
    }

    if (!response.ok) {
      const error = await response.json();
      logCrud.error('Validation errors:', error);

      // Parse validation errors for better UX
      let errorMsg = 'Ошибка сохранения';

      // Handle custom error format: {detail: {message: "...", errors: [...]}}
      if (error.detail && typeof error.detail === 'object') {
        if (Array.isArray(error.detail.errors) && error.detail.errors.length > 0) {
          // Custom validation error format
          errorMsg = error.detail.errors
            .map((e: any) => e.message || e.msg || 'Unknown error')
            .join('; ');
        } else if (typeof error.detail.message === 'string') {
          errorMsg = error.detail.message;
        } else if (typeof error.detail === 'string') {
          errorMsg = error.detail;
        } else if (Array.isArray(error.detail)) {
          // Pydantic format: [{loc: [...], msg: "...", type: "..."}]
          errorMsg = error.detail.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join(', ');
        } else {
          // Fallback: stringify unknown object
          errorMsg = JSON.stringify(error.detail);
        }
      } else if (typeof error.detail === 'string') {
        errorMsg = error.detail;
      } else {
        errorMsg = `HTTP error! status: ${response.status}`;
      }

      throw new Error(errorMsg);
    }

    // Handle reminder update (only for single fact scope, not template)
    if (editScope !== 'template') {
      const existingReminder = remindersMap.get(parseInt(factId));

      if (enableReminder && reminderDatetime) {
        // Create or update reminder
        if (existingReminder) {
          // Update existing reminder
          const updated = await (BudgetShared as any).Reminders.updateReminder(factId, reminderDatetime);
          if (!updated) {
            showNotification('⚠️ Предупреждение: не удалось обновить напоминание', 'warning');
          }
        } else {
          // Create new reminder
          const created = await (BudgetShared as any).Reminders.createReminder(factId, reminderDatetime);
          if (!created) {
            showNotification('⚠️ Предупреждение: не удалось создать напоминание', 'warning');
          }
        }
      } else if (!enableReminder && existingReminder) {
        // Delete reminder if checkbox is unchecked
        const deleted = await (BudgetShared as any).Reminders.deleteReminder(factId);
        if (!deleted) {
          showNotification('⚠️ Предупреждение: не удалось удалить напоминание', 'warning');
        }
      }
    }

    closeEditModal();
    await PlanFactsTable.loadFacts();
    showNotification(successMessage, 'success');
  } catch (error) {
    logCrud.error('Error updating fact:', error);
    const errorMessage = (error as any)?.message || String(error);
    showNotification(`❌ Ошибка: ${errorMessage}`, 'error');
  } finally {
    // ========== ALWAYS RESTORE BUTTON ==========
    setSubmitLoading(event.target as HTMLFormElement, false);
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Batch delete selected facts
 * Shows confirmation dialog with count, deletes all selected facts
 *
 * @description
 * Performs bulk deletion of selected plan facts from the table.
 * - Shows confirmation dialog with count
 * - Displays loading state on button during operation
 * - Forces DOM update for immediate visual feedback
 * - Reloads facts table after successful deletion
 * - Handles errors gracefully with notifications
 *
 * @example
 * // Called from onclick handler in plan.html
 * onclick="window.PlanApp.batchDeleteFacts()"
 */
export async function batchDeleteFacts(): Promise<void> {
  if (selectedFactIds.size === 0) return;

  const count = selectedFactIds.size;
  const confirmed = await showConfirmDialog(
    `Вы уверены, что хотите удалить ${count} транзакций? Это действие необратимо.`,
    '🗑️ Массовое удаление транзакций'
  );

  if (!confirmed) {
    return;
  }

  // ✅ Show loader on button during operation
  const btn = document.getElementById('batch-delete-btn') as HTMLButtonElement | null;
  if (!btn) return;

  const originalText = btn.textContent || '';

  btn.disabled = true;
  btn.classList.add('loading', 'loading-spinner');
  btn.textContent = `Удаление... (${count})`;

  // ✅ Force DOM update before starting async operation (fix: loader visible immediately)
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    const response = await fetch('/api/v1/facts/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Array.from(selectedFactIds))
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    await PlanFactsTable.loadFacts();
    showNotification(`✅ Удалено транзакций: ${result.deleted_count}`, 'success');
  } catch (error) {
    logCrud.error('Error batch deleting facts:', error);
    const errorMessage = (error as any)?.message || String(error);
    showNotification(`❌ Ошибка: ${errorMessage}`, 'error');
  } finally {
    // ✅ Hide loader after operation (success or error)
    btn.classList.remove('loading', 'loading-spinner');
    btn.textContent = originalText;
    // Button state will be updated by updateBatchDeleteButton() after loadFacts()
  }
}

/**
 * Batch delete selected recurring plans
 * Shows confirmation dialog with checkbox, deletes all selected plans
 *
 * @description
 * Performs bulk deletion of selected recurring plans.
 * - Shows confirmation dialog with checkbox for "delete future facts" option
 * - Displays loading state on button during operation
 * - Forces DOM update for immediate visual feedback
 * - Reloads both recurring plans table and facts table after deletion
 * - Handles partial failures (some plans deleted, some failed)
 * - Clears selection after successful deletion
 *
 * @example
 * // Called from onclick handler in plan.html
 * onclick="window.PlanApp.batchDeleteRecurringPlans()"
 */
export async function batchDeleteRecurringPlans(): Promise<void> {
  logCrud.debug('[RECURRING_DELETE] Starting batch delete, selectedIds:', Array.from(selectedRecurringPlanIds));

  if (selectedRecurringPlanIds.size === 0) {
    logCrud.warn('[RECURRING_DELETE] No plans selected');
    return;
  }

  const count = selectedRecurringPlanIds.size;

  // Show confirmation dialog with checkbox for delete_future_facts
  const confirmed = await showConfirmDialogWithCheckbox(
    `Вы уверены, что хотите удалить ${count} регламентных платежей?`,
    '🗑️ Массовое удаление регламентных платежей',
    {
      checkboxLabel: 'Также удалить все будущие записи',
      checkboxId: 'batch-delete-future-facts',
      checkboxDefault: false,
    }
  );

  if (!confirmed.result) {
    logCrud.debug('[RECURRING_DELETE] User cancelled batch delete');
    return;
  }

  const deleteFutureFacts = confirmed.checkboxValue || false;
  logCrud.debug('[RECURRING_DELETE] User confirmed, delete_future_facts:', deleteFutureFacts);

  const btn = document.getElementById('batch-delete-recurring-plans-btn') as HTMLButtonElement | null;
  if (!btn) return;

  btn.disabled = true;
  btn.classList.add('loading', 'loading-spinner');
  btn.textContent = `Удаление... (${count})`;

  // Force UI update before heavy operation
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    const response = await fetch(
      `/api/v1/recurring-plans/batch-delete?delete_future_facts=${deleteFutureFacts}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(Array.from(selectedRecurringPlanIds))
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Batch delete failed');
    }

    const result = await response.json();
    logCrud.debug('[RECURRING_DELETE] Batch delete result:', result);

    // Reload data
    await loadRecurringPlans();
    await PlanFactsTable.loadFacts(); // Reload plan facts table

    // Success notification (SINGLE)
    const message = result.failed && result.failed.length > 0
      ? `✅ Удалено: ${result.deleted_count}, ошибок: ${result.failed.length}`
      : `✅ Удалено регламентных платежей: ${result.deleted_count}`;

    showNotification(message, 'success');
    logCrud.debug('[RECURRING_DELETE] Batch delete completed successfully');

    // Clear selection
    selectedRecurringPlanIds.clear();
    updateBatchDeleteRecurringPlansButtonState();

  } catch (error) {
    logCrud.error('[RECURRING_DELETE] Batch delete error:', error);
    showNotification(`❌ Ошибка массового удаления: ${(error as any)?.message}`, 'error');
  } finally {
    btn.classList.remove('loading', 'loading-spinner');
    updateBatchDeleteRecurringPlansButtonState();
  }
}

logCrud.debug('[CRUD] Plan CRUD module loaded (Phase 3: Week 4 complete)');

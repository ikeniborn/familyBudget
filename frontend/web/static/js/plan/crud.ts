/**
 * Plan CRUD Module
 * Handles plan creation, editing, deletion, and modal management
 *
 * @module plan/crud
 * @version 3.0.0 (Phase 3: Week 3 - Modal Management + Basic CRUD)
 * @description CRUD operations for budget plans with RecurringPlanForm integration
 */

import * as PlanHelpers from './helpers';
import * as PlanFactsTable from './factsTable';

// Import BudgetShared from global
declare const BudgetShared: {
  DateFormatter: {
    formatForDisplay: (isoDate: string) => string;
    formatForAPI: (displayDate: string) => string;
  };
  CalendarWidget: {
    init: (inputId: string, options?: any) => void;
    destroy: (inputId: string) => void;
  };
  ConfirmDialog: {
    show: (options: {
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      confirmClass?: string;
    }) => Promise<boolean>;
  };
};

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Budget fact data structure
 * Matches API response from /api/v1/facts
 */
export interface BudgetFact {
  id: number;
  fact_date: string; // ISO date string
  financial_center_id: number;
  financial_center_name: string;
  cost_center_id: number | null;
  cost_center_name: string | null;
  article_id: number;
  article_name: string;
  amount: number;
  description: string | null;
  user_id: number;
  user_name: string;
  record_type: 'plan' | 'fact';
  recurring_plan_id: number | null;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Recurring plan data structure
 * Matches API response from /api/v1/recurring-plans/{id}
 */
export interface RecurringPlan {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string | null;
  financial_center_id: number;
  cost_center_id: number | null;
  article_id: number;
  amount: number;
  description: string | null;
  frequency_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  frequency_value: number;
  duration_type: 'indefinite' | 'until_date' | 'count';
  duration_value: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Form data for plan creation/editing
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

/**
 * Open add plan modal
 * Shows create form for new plan (regular, recurring, or with reminder)
 */
export async function openAddPlanModal(): Promise<void> {
  console.log('[CRUD] openAddPlanModal - TODO: Implement');
  // TODO: Week 3 - Extract from plan.html line 4319
}

/**
 * Show edit modal for existing fact
 * Loads fact data and populates edit form
 *
 * @param factId - ID of fact to edit
 */
export async function showEditModal(factId: number): Promise<void> {
  console.log('[CRUD] showEditModal - TODO: Implement', factId);
  // TODO: Week 3 - Extract from plan.html line 2606
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

  console.log('[CRUD] Edit modal closed and cleaned up');
}

// ============================================================================
// Basic CRUD Operations
// ============================================================================

/**
 * Create new plan
 * Handles form submission from create modal
 *
 * @param event - Form submit event
 */
export async function createPlan(event: Event): Promise<void> {
  event.preventDefault();
  console.log('[CRUD] createPlan - TODO: Implement');
  // TODO: Week 3 - Extract from plan.html line 3792
}

/**
 * Update existing fact
 * Handles form submission from edit modal
 *
 * @param event - Form submit event
 */
export async function updateFact(event: Event): Promise<void> {
  event.preventDefault();
  console.log('[CRUD] updateFact - TODO: Implement');
  // TODO: Week 3 - Extract from plan.html line 3172
}

/**
 * Delete fact by ID
 * Shows confirmation dialog before deletion
 *
 * @param factId - ID of fact to delete
 */
export async function deleteFact(factId: number): Promise<void> {
  // Prevent multiple simultaneous deletes of the same fact (race condition protection)
  if (deletingFactIds.has(factId)) {
    console.warn('[CRUD] Delete already in progress for fact:', factId);
    return;
  }

  // Find fact in factsData to check if it's recurring
  const factsData = PlanFactsTable.getFactsData();
  const fact = factsData.find(f => f.id === factId);
  let deleteMode: 'single' | 'all' = 'single'; // default: delete just this fact

  if (fact && fact.recurring_plan_id) {
    // This is a recurring fact - ask user what to delete
    const choice = await showRecurringDeleteDialog();

    if (!choice) {
      // User cancelled
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
      return;
    }
  }

  // Find button by data-fact-id attribute
  const button = document.querySelector(`button[data-fact-id="${factId}"]`) as HTMLButtonElement | null;

  // Mark fact as being deleted
  deletingFactIds.add(factId);

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

      console.log(`[CRUD] Deleting ${factIdsToDelete.length} recurring facts with recurring_plan_id=${recurringPlanId}`);

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

      // Non-blocking toast notification
      PlanHelpers.showToast('Факт успешно удален', 'success');
    }
  } catch (error) {
    console.error('[CRUD] Error deleting fact:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Reload even on error to sync UI
    deletingFactIds.delete(factId);
    await PlanFactsTable.loadFacts();

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
    console.warn('[CRUD] deleteFromEditModal - No fact ID found');
    return;
  }

  const factId = parseInt(factIdInput.value);

  if (isNaN(factId)) {
    console.error('[CRUD] deleteFromEditModal - Invalid fact ID:', factIdInput.value);
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
 * Show confirmation dialog
 * Wrapper around BudgetShared.ConfirmDialog
 *
 * @param message - Confirmation message
 * @param title - Dialog title
 * @returns Promise that resolves to true if confirmed, false otherwise
 */
async function showConfirmDialog(message: string, title: string): Promise<boolean> {
  return await BudgetShared.ConfirmDialog.show({
    title,
    message,
    confirmText: 'Удалить',
    cancelText: 'Отмена',
    confirmClass: 'btn-error'
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
      console.error('[CRUD] Recurring delete modal not found');
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
  console.log(`[CRUD] getFrequencyDisplayText: type=${type}, value=${value}`);

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
      console.log(`[CRUD] Yearly decoded: ${value} → ${day} ${monthName}`);
      return `Ежегодно, ${day} ${monthName}`;
    default:
      console.warn(`[CRUD] Unknown frequency type: ${type}`);
      return type;
  }
}

/**
 * Update frequency-specific fields visibility
 * Shows/hides month day picker and yearly picker based on frequency type
 *
 * @param modalId - Modal ID (e.g., 'modal_add_plan')
 */
export function updateFrequencyFields(modalId: string): void {
  const frequencySelect = document.querySelector(
    `#${modalId} select[name="frequency_type"]`
  ) as HTMLSelectElement | null;
  const monthdayPicker = document.getElementById(`monthday-picker-${modalId}`);
  const yearlyPicker = document.getElementById(`yearly-picker-${modalId}`);

  console.log('[CRUD] updateFrequencyFields called, modalId:', modalId);

  if (!frequencySelect) return;

  const frequency = frequencySelect.value;
  console.log('[CRUD] Selected frequency:', frequency);

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
 * @param modalId - Modal ID (e.g., 'modal_add_plan')
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

  console.log(`[CRUD] updateYearlyFrequencyValue: month=${month}, day=${day}`);

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
    console.warn(`[CRUD] Invalid day ${day} for month ${month}`);
    return;
  }

  // Encode MMDD
  const frequencyValue = month * 100 + day;
  hiddenInput.value = String(frequencyValue);

  console.log(`[CRUD] Encoded frequency_value: ${frequencyValue} (MMDD format)`);

  updateRecurringPreview(modalId);
}

/**
 * Update duration-specific fields visibility
 * Also initializes/destroys CalendarWidget for end date field
 *
 * @param modalId - Modal ID (e.g., 'modal_add_plan')
 */
export function updateDurationFields(modalId: string): void {
  const durationSelect = document.querySelector(
    `#${modalId} select[name="duration_type"]`
  ) as HTMLSelectElement | null;
  const occurrencesField = document.getElementById(`occurrences-field-${modalId}`);
  const endDateField = document.getElementById(`end-date-field-${modalId}`);

  if (!durationSelect) return;

  const type = durationSelect.value;
  console.log('[CRUD] updateDurationFields - Duration type selected:', type);

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
 * @param modalId - Modal ID (e.g., 'modal_add_plan')
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
 * @param modalId - Modal ID (e.g., 'modal_add_plan')
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
// Batch Operations
// ============================================================================

/**
 * Batch delete selected facts
 * Shows confirmation dialog with count, deletes all selected facts
 */
export async function batchDeleteFacts(): Promise<void> {
  console.log('[CRUD] batchDeleteFacts - TODO: Week 4');
  // TODO: Week 4 - Extract from plan.html line 3497
}

/**
 * Batch delete selected recurring plans
 * Shows confirmation dialog with checkbox, deletes all selected plans
 */
export async function batchDeleteRecurringPlans(): Promise<void> {
  console.log('[CRUD] batchDeleteRecurringPlans - TODO: Week 4');
  // TODO: Week 4 - Extract from plan.html line 5242
}

console.log('[CRUD] Plan CRUD module loaded (Phase 3: Week 3 skeleton)');

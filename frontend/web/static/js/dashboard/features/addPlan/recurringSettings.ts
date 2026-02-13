/**
 * Recurring Settings for Plan Form
 *
 * Handles recurring plan configuration (frequency, duration, weekday selection).
 */

import { getState, updateState } from '../../core/DashboardState';
import type { RecurringSettings, FrequencyType, DurationType } from '../../types/dashboard.d';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get day names for recurring preview.
 */
const DAY_NAMES = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];

// ============================================================================
// Reset Functions
// ============================================================================

/**
 * Reset only recurring-specific fields (not mode or visibility).
 */
export function resetRecurringOnlyFields(modalId: string): void {
  const frequencySelect = document.querySelector(`#${modalId} select[name="frequency_type"]`) as HTMLSelectElement | null;
  if (frequencySelect) frequencySelect.value = 'monthly';

  const weekdayButtons = document.querySelectorAll(`#weekday-picker-${modalId} .weekday-btn`) as NodeListOf<HTMLElement>;
  weekdayButtons.forEach((btn, i) => btn.classList.toggle('btn-active', i === 0));

  const weekdayHidden = document.querySelector(`#${modalId} input[name="frequency_value_weekday"]`) as HTMLInputElement | null;
  if (weekdayHidden) weekdayHidden.value = '0';

  const monthdaySelect = document.querySelector(`#${modalId} select[name="frequency_value_monthday"]`) as HTMLSelectElement | null;
  if (monthdaySelect) monthdaySelect.value = '1';

  const durationSelect = document.querySelector(`#${modalId} select[name="duration_type"]`) as HTMLSelectElement | null;
  if (durationSelect) durationSelect.value = 'indefinite';

  document.getElementById(`occurrences-field-${modalId}`)?.classList.add('hidden');
  document.getElementById(`end-date-field-${modalId}`)?.classList.add('hidden');

  const recurringReminderCheckbox = document.querySelector(`#${modalId} input[name="recurring_enable_reminder"]`) as HTMLInputElement | null;
  if (recurringReminderCheckbox) {
    recurringReminderCheckbox.checked = false;
    document.getElementById(`recurring-reminder-settings-${modalId}`)?.classList.add('hidden');
  }
}

/**
 * Reset full recurring settings form (mode + fields).
 */
export function resetRecurringSettings(modalId: string): void {
  // Import resetReminderFields dynamically to avoid circular dependency
  import('./reminderSettings').then(({ resetReminderFields }) => {
    // Reset to 'regular' mode (default)
    const regularRadio = document.querySelector(`#${modalId} input[name="plan_mode"][value="regular"]`) as HTMLInputElement | null;
    if (regularRadio) regularRadio.checked = true;

    // Hide both panels
    const settingsDiv = document.getElementById(`recurring-settings-${modalId}`);
    if (settingsDiv) settingsDiv.classList.add('hidden');
    const onetimeReminderSection = document.getElementById(`onetime-reminder-section-${modalId}`);
    if (onetimeReminderSection) onetimeReminderSection.classList.add('hidden');

    // Reset recurring fields
    resetRecurringOnlyFields(modalId);

    // Reset reminder fields
    resetReminderFields(modalId);

    // Update visibility
    updateFrequencyFields(modalId);
  });
}

// ============================================================================
// Initialize Functions
// ============================================================================

/**
 * Initialize recurring fields (weekday buttons, calendar widget, change listeners).
 */
export function initRecurringFields(modalId: string): void {
  // Initialize weekday button handlers
  const weekdayButtons = document.querySelectorAll(`#weekday-picker-${modalId} .weekday-btn`) as NodeListOf<HTMLElement>;
  weekdayButtons.forEach(btn => {
    btn.onclick = () => {
      // Toggle active state
      weekdayButtons.forEach(b => b.classList.remove('btn-active'));
      btn.classList.add('btn-active');
      // Update hidden field
      const hiddenInput = document.querySelector(`#${modalId} input[name="frequency_value_weekday"]`) as HTMLInputElement | null;
      if (hiddenInput && btn.dataset.day) {
        hiddenInput.value = btn.dataset.day;
      }
      updateRecurringPreview(modalId);
    };
  });

  // CalendarWidget for end date is initialized in updateDurationFields() when field becomes visible

  // Add change listeners to update preview
  const frequencySelect = document.querySelector(`#${modalId} select[name="frequency_type"]`) as HTMLSelectElement | null;
  if (frequencySelect) {
    frequencySelect.onchange = () => updateFrequencyFields(modalId);
  }

  const monthdaySelect = document.querySelector(`#${modalId} select[name="frequency_value_monthday"]`) as HTMLSelectElement | null;
  if (monthdaySelect) {
    monthdaySelect.onchange = () => updateRecurringPreview(modalId);
  }

  const occurrencesInput = document.querySelector(`#${modalId} input[name="occurrences_count"]`) as HTMLInputElement | null;
  if (occurrencesInput) {
    occurrencesInput.oninput = () => updateRecurringPreview(modalId);
  }

  // Initialize recurring reminder checkbox handler
  const recurringReminderCheckbox = document.querySelector(`#${modalId} input[name="recurring_enable_reminder"]`) as HTMLInputElement | null;
  if (recurringReminderCheckbox) {
    recurringReminderCheckbox.onchange = () => {
      const recurringReminderSettings = document.getElementById(`recurring-reminder-settings-${modalId}`);
      if (recurringReminderSettings) {
        recurringReminderSettings.classList.toggle('hidden', !recurringReminderCheckbox.checked);
      }
    };
  }
}

// ============================================================================
// Field Visibility Updates
// ============================================================================

/**
 * Update frequency-specific fields visibility.
 */
export function updateFrequencyFields(modalId: string): void {
  const frequencySelect = document.querySelector(`#${modalId} select[name="frequency_type"]`) as HTMLSelectElement | null;
  const weekdayPicker = document.getElementById(`weekday-picker-${modalId}`);
  const monthdayPicker = document.getElementById(`monthday-picker-${modalId}`);

  if (!frequencySelect) return;

  const frequency = frequencySelect.value as FrequencyType;

  // Show/hide appropriate picker
  if (weekdayPicker) {
    weekdayPicker.classList.toggle('hidden', frequency !== 'weekly');
  }

  if (monthdayPicker) {
    monthdayPicker.classList.toggle('hidden', frequency === 'daily' || frequency === 'weekly');
  }

  updateRecurringPreview(modalId);
}

/**
 * Update duration-specific fields visibility.
 * Also initializes/destroys CalendarWidget for end date field.
 */
export function updateDurationFields(modalId: string): void {
  const durationSelect = document.querySelector(`#${modalId} select[name="duration_type"]`) as HTMLSelectElement | null;
  const occurrencesField = document.getElementById(`occurrences-field-${modalId}`);
  const endDateField = document.getElementById(`end-date-field-${modalId}`);

  if (!durationSelect) return;

  const type = durationSelect.value as DurationType;
  const state = getState();

  if (occurrencesField) {
    occurrencesField.classList.toggle('hidden', type !== 'count');
  }

  if (endDateField) {
    endDateField.classList.toggle('hidden', type !== 'end_date');

    // Initialize/destroy CalendarWidget based on visibility
    const endDateInput = document.getElementById(`recurring_end_date_${modalId}`) as HTMLInputElement | null;
    if (type === 'end_date' && endDateInput) {
      // Initialize CalendarWidget when field becomes visible
      if (!state.recurringEndDateCalendarWidget && window.BudgetShared?.CalendarWidget) {
        const widget = new window.BudgetShared.CalendarWidget({
          inputElement: endDateInput,
          mode: 'single',
          minDate: new Date(),
          onSelect: () => updateRecurringPreview(modalId),
        });
        updateState({ recurringEndDateCalendarWidget: widget });
      }
    } else {
      // Destroy CalendarWidget when field is hidden
      if (state.recurringEndDateCalendarWidget) {
        state.recurringEndDateCalendarWidget.destroy();
        updateState({ recurringEndDateCalendarWidget: null });
      }
    }
  }

  updateRecurringPreview(modalId);
}

// ============================================================================
// Preview Update
// ============================================================================

/**
 * Update recurring schedule preview text.
 */
export function updateRecurringPreview(modalId: string): void {
  const previewText = document.getElementById(`recurring-preview-text-${modalId}`);
  if (!previewText) return;

  const frequencySelect = document.querySelector(`#${modalId} select[name="frequency_type"]`) as HTMLSelectElement | null;
  const frequency = (frequencySelect?.value as FrequencyType) || 'monthly';

  // Build frequency text
  let frequencyText = '';

  switch (frequency) {
    case 'daily':
      frequencyText = 'Ежедневно';
      break;
    case 'weekly': {
      const weekdayBtn = document.querySelector(`#weekday-picker-${modalId} .weekday-btn.btn-active`) as HTMLElement | null;
      const dayIndex = weekdayBtn ? parseInt(weekdayBtn.dataset.day || '0') : 0;
      frequencyText = `Еженедельно, ${DAY_NAMES[dayIndex]}`;
      break;
    }
    case 'monthly': {
      const monthdaySelect = document.querySelector(`#${modalId} select[name="frequency_value_monthday"]`) as HTMLSelectElement | null;
      const monthDay = monthdaySelect?.value || '1';
      frequencyText = `Ежемесячно, ${monthDay}-го числа`;
      break;
    }
    case 'quarterly': {
      const qMonthdaySelect = document.querySelector(`#${modalId} select[name="frequency_value_monthday"]`) as HTMLSelectElement | null;
      const qMonthDay = qMonthdaySelect?.value || '1';
      frequencyText = `Ежеквартально, ${qMonthDay}-го числа`;
      break;
    }
  }

  // Build duration text
  let durationText = '';
  const durationSelect = document.querySelector(`#${modalId} select[name="duration_type"]`) as HTMLSelectElement | null;
  const type = (durationSelect?.value as DurationType) || 'indefinite';

  switch (type) {
    case 'indefinite':
      durationText = 'бессрочно';
      break;
    case 'count': {
      const occurrencesInput = document.querySelector(`#${modalId} input[name="occurrences_count"]`) as HTMLInputElement | null;
      const count = occurrencesInput?.value || '';
      durationText = count ? `${count} повторений` : 'укажите количество';
      break;
    }
    case 'end_date': {
      const endDateInput = document.getElementById(`recurring_end_date_${modalId}`) as HTMLInputElement | null;
      const endDate = endDateInput?.value || '';
      durationText = endDate ? `до ${endDate}` : 'укажите дату';
      break;
    }
  }

  previewText.textContent = `${frequencyText}, ${durationText}`;
}

// ============================================================================
// Collect Settings
// ============================================================================

/**
 * Collect recurring settings from form.
 * @returns Recurring settings or null if not recurring mode.
 */
export function collectRecurringSettings(modalId: string): RecurringSettings | null {
  const selectedMode = document.querySelector(`#${modalId} input[name="plan_mode"]:checked`) as HTMLInputElement | null;
  if (!selectedMode || selectedMode.value !== 'recurring') {
    return null;
  }

  const form = document.getElementById(`form_${modalId}`) as HTMLFormElement | null;
  if (!form) return null;

  const frequencyTypeEl = form.querySelector('select[name="frequency_type"]') as HTMLSelectElement | null;
  const frequencyType = (frequencyTypeEl?.value as FrequencyType) || 'monthly';

  // Get frequency value based on type
  let frequencyValue: number | null = null;
  if (frequencyType === 'weekly') {
    const weekdayInput = form.querySelector('input[name="frequency_value_weekday"]') as HTMLInputElement | null;
    frequencyValue = parseInt(weekdayInput?.value || '0') || 0;
  } else if (frequencyType === 'monthly' || frequencyType === 'quarterly') {
    const monthdaySelect = form.querySelector('select[name="frequency_value_monthday"]') as HTMLSelectElement | null;
    frequencyValue = parseInt(monthdaySelect?.value || '1') || 1;
  }

  // Get duration settings
  const durationSelectEl = form.querySelector('select[name="duration_type"]') as HTMLSelectElement | null;
  const durationType = (durationSelectEl?.value as DurationType) || 'indefinite';
  let occurrencesCount: number | null = null;
  let endDate: string | null = null;

  if (durationType === 'count') {
    const occurrencesInput = form.querySelector('input[name="occurrences_count"]') as HTMLInputElement | null;
    occurrencesCount = parseInt(occurrencesInput?.value || '') || null;
  } else if (durationType === 'end_date') {
    const endDateInput = document.getElementById(`recurring_end_date_${modalId}`) as HTMLInputElement | null;
    const endDateValue = endDateInput?.value || '';
    if (endDateValue && window.BudgetShared?.DateFormatter) {
      // Convert DD.MM.YYYY to YYYY-MM-DD
      endDate = window.BudgetShared.DateFormatter.formatForAPI(endDateValue);
    }
  }

  return {
    frequency_type: frequencyType,
    frequency_value: frequencyValue,
    occurrences_count: occurrencesCount,
    end_date: endDate,
  };
}

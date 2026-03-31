/**
 * Recurring Settings UI Manager
 * Handles recurring plan settings UI interactions
 *
 * @module modalPlan/recurringSettings
 */

import { getState, updateState } from '../../core/DashboardState';
import { initReminderCalendarWidget, getCurrentTimeRounded, updateReminderDatetime } from '../addPlan/reminderSettings';

declare const debugLog: (...args: any[]) => void;

/**
 * Toggle plan mode visibility (regular/recurring/reminder)
 */
export function togglePlanMode(modalId: string): void {
  debugLog(`[togglePlanMode] Called with modalId: ${modalId}`);

  const form = document.getElementById(`form_${modalId}`) as HTMLFormElement;
  if (!form) {
    debugLog(`[togglePlanMode] Form not found: form_${modalId}`);
    return;
  }

  // Get selected mode
  const modeRadios = form.querySelectorAll<HTMLInputElement>('input[name="plan_mode"]');
  let selectedMode = 'regular';

  modeRadios.forEach((radio) => {
    if (radio.checked) {
      selectedMode = radio.value;
      debugLog(`[togglePlanMode] Selected mode: ${selectedMode}`);
    }
  });

  // Get sections
  const recurringSettings = document.getElementById(`recurring-settings-${modalId}`);
  const onetimeReminderSection = document.getElementById(`onetime-reminder-section-${modalId}`);

  if (!recurringSettings || !onetimeReminderSection) {
    debugLog('[togglePlanMode] Missing sections:', {
      recurringSettings: !!recurringSettings,
      onetimeReminderSection: !!onetimeReminderSection,
      expectedIds: {
        recurring: `recurring-settings-${modalId}`,
        reminder: `onetime-reminder-section-${modalId}`
      }
    });
    return;
  }

  // Hide all sections first
  recurringSettings.classList.add('hidden');
  onetimeReminderSection.classList.add('hidden');
  debugLog('[togglePlanMode] All sections hidden');

  // Show relevant section
  if (selectedMode === 'recurring') {
    recurringSettings.classList.remove('hidden');
    debugLog('[togglePlanMode] Recurring settings shown');
    initializeRecurringDefaults(modalId);
  } else if (selectedMode === 'reminder') {
    onetimeReminderSection.classList.remove('hidden');
    debugLog('[togglePlanMode] Reminder section shown');
    // Initialize CalendarWidget for reminder date field
    initReminderCalendarWidget(modalId);

    // Explicitly show inner container (in case it was hidden)
    const reminderSettings = document.getElementById(`reminder-settings-${modalId}`);
    if (reminderSettings) {
      reminderSettings.classList.remove('hidden');
    }

    const hourSelect = document.getElementById(`reminder_hour_${modalId}`) as HTMLSelectElement | null;
    const minuteSelect = document.getElementById(`reminder_minute_${modalId}`) as HTMLSelectElement | null;
    if (hourSelect && minuteSelect) {
      const defaultTime = getCurrentTimeRounded();
      hourSelect.value = defaultTime.hour;
      minuteSelect.value = defaultTime.minute;
      updateReminderDatetime(modalId);
    }
  } else {
    debugLog('[togglePlanMode] Regular mode - no additional sections shown');
  }

  debugLog('[RecurringSettings] Plan mode changed:', selectedMode);
}

/**
 * Initialize recurring settings with default values
 */
function initializeRecurringDefaults(modalId: string): void {
  const form = document.getElementById(`form_${modalId}`) as HTMLFormElement;
  if (!form) return;

  // Default: monthly, 1st day, indefinite
  const frequencyType = form.querySelector<HTMLSelectElement>('select[name="frequency_type"]');
  const durationTypeSelect = form.querySelector<HTMLSelectElement>('select[name="duration_type"]');

  if (frequencyType && !frequencyType.value) {
    frequencyType.value = 'monthly';
  }

  if (durationTypeSelect && !durationTypeSelect.value) {
    durationTypeSelect.value = 'count';
  }

  // Show monthday picker by default (for monthly)
  updateFrequencyFields(modalId);
  updateDurationFields(modalId);
  updateRecurringPreview(modalId);
}

/**
 * Update frequency fields based on frequency type
 */
export function updateFrequencyFields(modalId: string): void {
  const form = document.getElementById(`form_${modalId}`) as HTMLFormElement;
  if (!form) return;

  const frequencyType = form.querySelector<HTMLSelectElement>('select[name="frequency_type"]');
  if (!frequencyType) return;

  const monthdayPicker = document.getElementById(`monthday-picker-${modalId}`);
  const yearlyPicker = document.getElementById(`yearly-picker-${modalId}`);

  if (!monthdayPicker || !yearlyPicker) return;

  if (frequencyType.value === 'yearly') {
    // Show yearly picker (month + day)
    monthdayPicker.classList.add('hidden');
    yearlyPicker.classList.remove('hidden');
  } else {
    // Show monthday picker (monthly/quarterly)
    monthdayPicker.classList.remove('hidden');
    yearlyPicker.classList.add('hidden');
  }

  updateRecurringPreview(modalId);
}

/**
 * Update yearly frequency value (MMDD format)
 */
export function updateYearlyFrequencyValue(modalId: string): void {
  const form = document.getElementById(`form_${modalId}`) as HTMLFormElement;
  if (!form) return;

  const monthSelect = form.querySelector<HTMLSelectElement>('select[name="frequency_value_month"]');
  const daySelect = form.querySelector<HTMLSelectElement>('select[name="frequency_value_day"]');
  const yearlyInput = form.querySelector<HTMLInputElement>('input[name="frequency_value_yearly"]');

  if (!monthSelect || !daySelect || !yearlyInput) return;

  const month = monthSelect.value.padStart(2, '0');
  const day = daySelect.value.padStart(2, '0');

  if (month && day) {
    // MMDD format (e.g., "0315" for March 15)
    yearlyInput.value = month + day;
    debugLog('[RecurringSettings] Yearly frequency value:', yearlyInput.value);
  } else {
    yearlyInput.value = '';
  }

  updateRecurringPreview(modalId);
}

/**
 * Update duration fields based on duration type.
 * Also initializes/destroys CalendarWidget for end date field.
 */
export function updateDurationFields(modalId: string): void {
  const form = document.getElementById(`form_${modalId}`) as HTMLFormElement;
  if (!form) return;

  const durationTypeSelect = form.querySelector<HTMLSelectElement>('select[name="duration_type"]');
  if (!durationTypeSelect) return;

  const occurrencesField = document.getElementById(`occurrences-field-${modalId}`);
  const endDateField = document.getElementById(`end-date-field-${modalId}`);

  if (!occurrencesField || !endDateField) return;

  if (durationTypeSelect.value === 'count') {
    occurrencesField.classList.remove('hidden');
    endDateField.classList.add('hidden');
  } else if (durationTypeSelect.value === 'end_date') {
    occurrencesField.classList.add('hidden');
    endDateField.classList.remove('hidden');
  }

  // Initialize/destroy CalendarWidget for end date field
  const endDateInput = document.getElementById(`recurring_end_date_${modalId}`) as HTMLInputElement | null;
  if (durationTypeSelect.value === 'end_date' && endDateInput) {
    // Initialize CalendarWidget when field becomes visible
    const state = getState();
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
    const state = getState();
    if (state.recurringEndDateCalendarWidget) {
      try {
        state.recurringEndDateCalendarWidget.destroy();
      } catch (e) {
        // Ignore cleanup errors
      }
      updateState({ recurringEndDateCalendarWidget: null });
    }
  }

  updateRecurringPreview(modalId);
}

/**
 * Update recurring preview text
 */
function updateRecurringPreview(modalId: string): void {
  const form = document.getElementById(`form_${modalId}`) as HTMLFormElement;
  const previewText = document.getElementById(`recurring-preview-text-${modalId}`);

  if (!form || !previewText) return;

  const frequencyType = form.querySelector<HTMLSelectElement>('select[name="frequency_type"]')?.value;
  const monthdayValue = form.querySelector<HTMLSelectElement>('select[name="frequency_value_monthday"]')?.value;
  const yearlyMonth = form.querySelector<HTMLSelectElement>('select[name="frequency_value_month"]')?.value;
  const yearlyDay = form.querySelector<HTMLSelectElement>('select[name="frequency_value_day"]')?.value;
  const durationType = form.querySelector<HTMLSelectElement>('select[name="duration_type"]')?.value;
  const occurrencesCount = form.querySelector<HTMLInputElement>('input[name="occurrences_count"]')?.value;

  let preview = '';

  // Frequency text
  if (frequencyType === 'monthly') {
    preview = `Ежемесячно ${monthdayValue || '1'}-го числа`;
  } else if (frequencyType === 'quarterly') {
    preview = `Ежеквартально ${monthdayValue || '1'}-го числа`;
  } else if (frequencyType === 'yearly') {
    if (yearlyMonth && yearlyDay) {
      const monthNames = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
      ];
      preview = `Ежегодно ${yearlyDay} ${monthNames[parseInt(yearlyMonth) - 1]}`;
    } else {
      preview = 'Ежегодно';
    }
  }

  // Duration text
  if (durationType === 'count' && occurrencesCount) {
    preview += `, ${occurrencesCount} раз`;
  } else if (durationType === 'end_date') {
    preview += ', до указанной даты';
  } else {
    preview += ', бессрочно';
  }

  previewText.textContent = preview;
}

/**
 * Toggle recurring reminder settings
 */
export function toggleRecurringReminder(modalId: string, enabled: boolean): void {
  const reminderSettings = document.getElementById(`recurring-reminder-settings-${modalId}`);
  if (!reminderSettings) return;

  if (enabled) {
    reminderSettings.classList.remove('hidden');
  } else {
    reminderSettings.classList.add('hidden');
  }
}

/**
 * Extract recurring settings from form
 */
export function extractRecurringSettings(form: HTMLFormElement): any {
  const modeRadios = form.querySelectorAll<HTMLInputElement>('input[name="plan_mode"]');
  let planMode = 'regular';

  modeRadios.forEach((radio) => {
    if (radio.checked) {
      planMode = radio.value;
    }
  });

  if (planMode !== 'recurring') {
    return null; // Not a recurring plan
  }

  const frequencyType = form.querySelector<HTMLSelectElement>('select[name="frequency_type"]')?.value;
  const monthdayValue = form.querySelector<HTMLSelectElement>('select[name="frequency_value_monthday"]')?.value;
  const yearlyValue = form.querySelector<HTMLInputElement>('input[name="frequency_value_yearly"]')?.value;
  const durationType = form.querySelector<HTMLSelectElement>('select[name="duration_type"]')?.value;
  const occurrencesCount = form.querySelector<HTMLInputElement>('input[name="occurrences_count"]')?.value;
  const endDate = form.querySelector<HTMLInputElement>('input[name="recurring_end_date"]')?.value;
  const enableReminder = form.querySelector<HTMLInputElement>('input[name="recurring_enable_reminder"]')?.checked;
  const reminderHour = form.querySelector<HTMLSelectElement>('select[name="recurring_reminder_hour"]')?.value;
  const reminderMinute = form.querySelector<HTMLSelectElement>('select[name="recurring_reminder_minute"]')?.value;

  // Determine frequency_value based on frequency_type
  let frequencyValue: number | null = null;
  if (frequencyType === 'yearly' && yearlyValue) {
    frequencyValue = parseInt(yearlyValue); // MMDD format as integer
  } else if ((frequencyType === 'monthly' || frequencyType === 'quarterly') && monthdayValue) {
    frequencyValue = parseInt(monthdayValue); // Day of month (1-28)
  }

  return {
    frequency_type: frequencyType,
    frequency_value: frequencyValue,
    occurrences_count: durationType === 'count' && occurrencesCount ? parseInt(occurrencesCount) : null,
    end_date: durationType === 'end_date' && endDate ? endDate : null,
    // Reminder settings (if enabled)
    enable_reminder: enableReminder || false,
    reminder_hour: enableReminder && reminderHour ? parseInt(reminderHour) : null,
    reminder_minute: enableReminder && reminderMinute ? parseInt(reminderMinute) : null,
  };
}

/**
 * Extract reminder settings for one-time plan
 */
export function extractReminderSettings(form: HTMLFormElement): any {
  const modeRadios = form.querySelectorAll<HTMLInputElement>('input[name="plan_mode"]');
  let planMode = 'regular';

  modeRadios.forEach((radio) => {
    if (radio.checked) {
      planMode = radio.value;
    }
  });

  if (planMode !== 'reminder') {
    return null; // Not a reminder plan
  }

  const reminderDate = form.querySelector<HTMLInputElement>('input[name="reminder_date"]')?.value;
  const reminderHour = form.querySelector<HTMLSelectElement>('select[name="reminder_hour"]')?.value;
  const reminderMinute = form.querySelector<HTMLSelectElement>('select[name="reminder_minute"]')?.value;

  if (!reminderDate || !reminderHour || !reminderMinute) {
    return null; // Incomplete reminder settings
  }

  // Convert DD.MM.YYYY HH:MM to ISO datetime
  const dateParts = reminderDate.split('.');
  if (dateParts.length !== 3) return null;

  const [day, month, year] = dateParts;
  const reminderDatetime = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${reminderHour}:${reminderMinute}:00`;

  return {
    reminder_datetime: reminderDatetime
  };
}

/**
 * Setup event listeners for recurring settings
 */
export function setupRecurringListeners(modalId: string): void {
  const form = document.getElementById(`form_${modalId}`) as HTMLFormElement;
  if (!form) return;

  // Plan mode change
  const modeRadios = form.querySelectorAll<HTMLInputElement>('input[name="plan_mode"]');
  modeRadios.forEach((radio) => {
    if (!radio.dataset.listenerAttached) {
      radio.addEventListener('change', () => togglePlanMode(modalId));
      radio.dataset.listenerAttached = 'true';
    }
  });

  // Frequency type change
  const frequencyTypeSelect = form.querySelector<HTMLSelectElement>('select[name="frequency_type"]');
  if (frequencyTypeSelect && !frequencyTypeSelect.dataset.listenerAttached) {
    frequencyTypeSelect.addEventListener('change', () => updateFrequencyFields(modalId));
    frequencyTypeSelect.dataset.listenerAttached = 'true';
  }

  // Yearly month/day change
  const yearlyMonth = form.querySelector<HTMLSelectElement>('select[name="frequency_value_month"]');
  const yearlyDay = form.querySelector<HTMLSelectElement>('select[name="frequency_value_day"]');

  if (yearlyMonth && !yearlyMonth.dataset.listenerAttached) {
    yearlyMonth.addEventListener('change', () => updateYearlyFrequencyValue(modalId));
    yearlyMonth.dataset.listenerAttached = 'true';
  }

  if (yearlyDay && !yearlyDay.dataset.listenerAttached) {
    yearlyDay.addEventListener('change', () => updateYearlyFrequencyValue(modalId));
    yearlyDay.dataset.listenerAttached = 'true';
  }

  // Duration type change
  const durationTypeSelect = form.querySelector<HTMLSelectElement>('select[name="duration_type"]');
  if (durationTypeSelect && !durationTypeSelect.dataset.listenerAttached) {
    durationTypeSelect.addEventListener('change', () => updateDurationFields(modalId));
    durationTypeSelect.dataset.listenerAttached = 'true';
  }

  // Occurrences count change (update preview)
  const occurrencesInput = form.querySelector<HTMLInputElement>('input[name="occurrences_count"]');
  if (occurrencesInput && !occurrencesInput.dataset.listenerAttached) {
    occurrencesInput.addEventListener('input', () => updateRecurringPreview(modalId));
    occurrencesInput.dataset.listenerAttached = 'true';
  }

  // Recurring reminder checkbox
  const recurringReminderCheckbox = form.querySelector<HTMLInputElement>('input[name="recurring_enable_reminder"]');
  if (recurringReminderCheckbox && !recurringReminderCheckbox.dataset.listenerAttached) {
    recurringReminderCheckbox.addEventListener('change', (e) => {
      toggleRecurringReminder(modalId, (e.target as HTMLInputElement).checked);
    });
    recurringReminderCheckbox.dataset.listenerAttached = 'true';
  }

  debugLog('[RecurringSettings] Event listeners setup complete for', modalId);
}

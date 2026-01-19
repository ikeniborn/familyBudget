/**
 * Reminder Settings for Plan Form
 *
 * Handles reminder date/time configuration for plans.
 */

import { getState, updateState } from '../../core/DashboardState';
import type { PlanMode } from '../../types/dashboard.d';



declare const debugLog: (...args: any[]) => void;
// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current time + 1 hour, rounded to nearest 5 minutes.
 * Used as default reminder time.
 */
export function getCurrentTimeRounded(): { hour: string; minute: string } {
  const now = new Date();
  // Add 1 hour
  const futureTime = new Date(now.getTime() + 60 * 60 * 1000);
  const hour = futureTime.getHours();
  const minutes = futureTime.getMinutes();
  const roundedMinutes = Math.round(minutes / 5) * 5;

  // Handle overflow (55 rounds to 60)
  if (roundedMinutes === 60) {
    return {
      hour: String((hour + 1) % 24).padStart(2, '0'),
      minute: '00',
    };
  }
  return {
    hour: String(hour).padStart(2, '0'),
    minute: String(roundedMinutes).padStart(2, '0'),
  };
}

/**
 * Pre-fill reminder date/time with default values (tomorrow + current time).
 */
export function prefillReminderDateTime(modalId: string): void {
  const dateInput = document.getElementById(`reminder_date_${modalId}`) as HTMLInputElement | null;
  const hourSelect = document.getElementById(`reminder_hour_${modalId}`) as HTMLSelectElement | null;
  const minuteSelect = document.getElementById(`reminder_minute_${modalId}`) as HTMLSelectElement | null;

  // Set date to tomorrow
  if (dateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const year = tomorrow.getFullYear();
    dateInput.value = `${day}.${month}.${year}`;
  }

  // Set time to current time (rounded to 5 min)
  const time = getCurrentTimeRounded();
  if (hourSelect) {
    hourSelect.value = time.hour;
  }
  if (minuteSelect) {
    minuteSelect.value = time.minute;
  }
}

// ============================================================================
// Reminder Toggle
// ============================================================================

/**
 * Toggle reminder settings visibility in plan modal.
 */
export function toggleReminderSettings(modalId: string): void {
  const checkbox = document.querySelector(`#form_${modalId} input[name="enable_reminder"]`) as HTMLInputElement | null;
  const settingsDiv = document.getElementById(`reminder-settings-${modalId}`);

  if (!checkbox || !settingsDiv) {
    console.warn('[toggleReminderSettings] Elements not found for modal:', modalId);
    return;
  }

  if (checkbox.checked) {
    settingsDiv.classList.remove('hidden');

    // Initialize CalendarWidget for reminder date
    initReminderCalendarWidget(modalId);

    // Update hidden field with current values (already pre-filled on modal open)
    updateReminderDatetime(modalId);
  } else {
    settingsDiv.classList.add('hidden');
  }
}

/**
 * Initialize CalendarWidget for reminder date field.
 */
export function initReminderCalendarWidget(modalId: string): void {
  const dateInput = document.getElementById(`reminder_date_${modalId}`) as HTMLInputElement | null;
  if (!dateInput) return;

  const state = getState();

  // Destroy existing widget if any
  if (state.reminderCalendarWidget) {
    try {
      state.reminderCalendarWidget.destroy();
    } catch (e) {
      // Ignore cleanup errors
    }
    updateState({ reminderCalendarWidget: null });
  }

  // Create new CalendarWidget
  if (window.BudgetShared?.CalendarWidget) {
    const widget = new window.BudgetShared.CalendarWidget({
      inputElement: dateInput,
      mode: 'single',
      minDate: new Date(), // Only future dates
      onSelect: () => {
        updateReminderDatetime(modalId);
      },
    });
    updateState({ reminderCalendarWidget: widget });
  }

  // Add event listeners to update combined datetime
  const hourSelect = document.getElementById(`reminder_hour_${modalId}`) as HTMLSelectElement | null;
  const minuteSelect = document.getElementById(`reminder_minute_${modalId}`) as HTMLSelectElement | null;

  if (hourSelect && !hourSelect.dataset.listenerAttached) {
    hourSelect.addEventListener('change', () => updateReminderDatetime(modalId));
    hourSelect.dataset.listenerAttached = 'true';
  }
  if (minuteSelect && !minuteSelect.dataset.listenerAttached) {
    minuteSelect.addEventListener('change', () => updateReminderDatetime(modalId));
    minuteSelect.dataset.listenerAttached = 'true';
  }
}

/**
 * Update hidden reminder_datetime field from separate date/hour/minute.
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
    const isoDate = window.BudgetShared?.DateFormatter.formatForAPI(dateValue); // YYYY-MM-DD
    if (isoDate) {
      // Combine into YYYY-MM-DDTHH:mm format
      hiddenInput.value = `${isoDate}T${hourValue}:${minuteValue}`;
    }
  } else {
    hiddenInput.value = '';
  }
}

/**
 * Reset reminder fields to empty.
 */
export function resetReminderFields(modalId: string): void {
  const dateInput = document.getElementById(`reminder_date_${modalId}`) as HTMLInputElement | null;
  const hourSelect = document.getElementById(`reminder_hour_${modalId}`) as HTMLSelectElement | null;
  const minuteSelect = document.getElementById(`reminder_minute_${modalId}`) as HTMLSelectElement | null;
  const hiddenInput = document.getElementById(`reminder_datetime_${modalId}`) as HTMLInputElement | null;

  if (dateInput) dateInput.value = '';
  if (hourSelect) hourSelect.value = '';
  if (minuteSelect) minuteSelect.value = '';
  if (hiddenInput) hiddenInput.value = '';
}

// ============================================================================
// Plan Mode Toggle
// ============================================================================

/**
 * Toggle plan mode based on radio button selection
 * Modes: 'regular' | 'recurring' | 'reminder'
 */
export function togglePlanMode(modalId: string): void {
  const selectedMode = document.querySelector(`#${modalId} input[name="plan_mode"]:checked`) as HTMLInputElement | null;
  const mode: PlanMode = (selectedMode?.value as PlanMode) || 'regular';

  debugLog('[togglePlanMode] Mode:', mode);

  const recurringSettingsDiv = document.getElementById(`recurring-settings-${modalId}`);
  const onetimeReminderSection = document.getElementById(`onetime-reminder-section-${modalId}`);
  const reminderModeLabel = document.getElementById(`reminder-mode-label-${modalId}`);

  debugLog('[togglePlanMode] Elements found:', {
      recurringSettingsDiv: !!recurringSettingsDiv,
      onetimeReminderSection: !!onetimeReminderSection,
      reminderModeLabel: !!reminderModeLabel,
    });

  // Get recurring-specific required fields
  const durationTypeSelect = document.querySelector(`#${modalId} select[name="duration_type"]`) as HTMLSelectElement | null;

  // Hide all panels first
  if (recurringSettingsDiv) recurringSettingsDiv.classList.add('hidden');
  if (onetimeReminderSection) {
    debugLog('[togglePlanMode] Hiding onetimeReminderSection, classes BEFORE:', onetimeReminderSection.className);
    onetimeReminderSection.classList.add('hidden');
    debugLog('[togglePlanMode] Hiding onetimeReminderSection, classes AFTER:', onetimeReminderSection.className);
  }

  switch (mode) {
    case 'recurring':
      // Hide reminder radio button for recurring plans (not supported)
      if (reminderModeLabel) {
        reminderModeLabel.classList.add('hidden');
      }
      if (recurringSettingsDiv) {
        recurringSettingsDiv.classList.remove('hidden');
        // Import dynamically to avoid circular dependency
        if (typeof (window as any).initRecurringFields === 'function') {
          (window as any).initRecurringFields(modalId);
        }
        if (typeof (window as any).updateRecurringPreview === 'function') {
          (window as any).updateRecurringPreview(modalId);
        }
      }
      // Enable validation for recurring fields
      if (durationTypeSelect) {
        durationTypeSelect.setAttribute('required', 'required');
      }
      break;

    case 'reminder':
      // Show reminder radio button
      if (reminderModeLabel) {
        reminderModeLabel.classList.remove('hidden');
      }
      if (onetimeReminderSection) {
        onetimeReminderSection.classList.remove('hidden');

        // Also remove 'hidden' from child div (added on modal close)
        const reminderSettings = document.getElementById(`reminder-settings-${modalId}`);
        if (reminderSettings) {
          reminderSettings.classList.remove('hidden');
        }

        initReminderCalendarWidget(modalId);

        // Set default time (current time + 1 hour, rounded to 5 minutes)
        const hourSelect = document.getElementById(`reminder_hour_${modalId}`) as HTMLSelectElement | null;
        const minuteSelect = document.getElementById(`reminder_minute_${modalId}`) as HTMLSelectElement | null;
        if (hourSelect && minuteSelect) {
          const defaultTime = getCurrentTimeRounded();
          hourSelect.value = defaultTime.hour;
          minuteSelect.value = defaultTime.minute;
          // Update hidden field after setting default values
          updateReminderDatetime(modalId);
        }
      } else {
        console.error('[togglePlanMode] onetimeReminderSection NOT FOUND!');
      }
      // Disable validation for recurring fields (they're hidden)
      if (durationTypeSelect) {
        durationTypeSelect.removeAttribute('required');
      }
      break;

    case 'regular':
    default:
      // Show reminder radio button for regular plans
      if (reminderModeLabel) {
        reminderModeLabel.classList.remove('hidden');
      }
      // Both panels hidden - reset fields
      if (typeof (window as any).resetRecurringOnlyFields === 'function') {
        (window as any).resetRecurringOnlyFields(modalId);
      }
      resetReminderFields(modalId);
      // Disable validation for recurring fields (they're hidden)
      if (durationTypeSelect) {
        durationTypeSelect.removeAttribute('required');
      }
      break;
  }
}

/**
 * Reminder Helpers for Edit Modal
 *
 * Handles reminder-related functionality in the edit modal.
 */

import { getState, updateState } from '../../core/DashboardState';

// ============================================================================
// Reminder Settings Toggle
// ============================================================================

/**
 * Toggle reminder settings visibility in edit modal.
 */
export function toggleEditReminderSettings(): void {
  const checkbox = document.getElementById('edit-enable-reminder') as HTMLInputElement | null;
  const settingsDiv = document.getElementById('edit-reminder-settings');

  if (checkbox && settingsDiv) {
    if (checkbox.checked) {
      settingsDiv.classList.remove('hidden');
      initEditReminderCalendarWidget();
    } else {
      settingsDiv.classList.add('hidden');
    }
  }
}

// ============================================================================
// Calendar Widget
// ============================================================================

/**
 * Initialize CalendarWidget for edit modal reminder date.
 */
export function initEditReminderCalendarWidget(): void {
  const dateInput = document.getElementById('edit-reminder-date') as HTMLInputElement | null;
  if (!dateInput) return;

  const state = getState();

  // Destroy existing widget if any
  if (state.editReminderCalendar) {
    try {
      state.editReminderCalendar.destroy();
    } catch (e) {
      // Ignore cleanup errors
    }
    updateState({ editReminderCalendar: null });
  }

  // Create new CalendarWidget
  if (window.BudgetShared?.CalendarWidget) {
    const widget = new window.BudgetShared.CalendarWidget({
      inputElement: dateInput,
      mode: 'single',
      minDate: new Date(),
      onSelect: () => {
        updateEditReminderDatetime();
      },
    });
    updateState({ editReminderCalendar: widget });
  }

  // Add event listeners to update combined datetime
  const hourSelect = document.getElementById('edit-reminder-hour') as HTMLSelectElement | null;
  const minuteSelect = document.getElementById('edit-reminder-minute') as HTMLSelectElement | null;

  if (hourSelect) {
    hourSelect.removeEventListener('change', updateEditReminderDatetime);
    hourSelect.addEventListener('change', updateEditReminderDatetime);
  }
  if (minuteSelect) {
    minuteSelect.removeEventListener('change', updateEditReminderDatetime);
    minuteSelect.addEventListener('change', updateEditReminderDatetime);
  }
}

// ============================================================================
// DateTime Handling
// ============================================================================

/**
 * Update hidden edit reminder_datetime field from separate fields.
 */
export function updateEditReminderDatetime(): void {
  const dateInput = document.getElementById('edit-reminder-date') as HTMLInputElement | null;
  const hourSelect = document.getElementById('edit-reminder-hour') as HTMLSelectElement | null;
  const minuteSelect = document.getElementById('edit-reminder-minute') as HTMLSelectElement | null;
  const hiddenInput = document.getElementById('edit-reminder-datetime') as HTMLInputElement | null;

  if (!dateInput || !hourSelect || !minuteSelect || !hiddenInput) return;

  const dateValue = dateInput.value;
  const hourValue = hourSelect.value;
  const minuteValue = minuteSelect.value;

  if (dateValue && hourValue && minuteValue && window.BudgetShared?.DateFormatter) {
    const isoDate = window.BudgetShared.DateFormatter.formatForAPI(dateValue);
    if (isoDate) {
      hiddenInput.value = `${isoDate}T${hourValue}:${minuteValue}`;
    }
  } else {
    hiddenInput.value = '';
  }
}

/**
 * Populate edit reminder fields from ISO datetime.
 */
export function populateEditReminderFields(isoDatetime: string): void {
  if (!isoDatetime) return;

  const date = new Date(isoDatetime);
  if (isNaN(date.getTime())) return;

  const dateInput = document.getElementById('edit-reminder-date') as HTMLInputElement | null;
  const hourSelect = document.getElementById('edit-reminder-hour') as HTMLSelectElement | null;
  const minuteSelect = document.getElementById('edit-reminder-minute') as HTMLSelectElement | null;

  if (dateInput) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    dateInput.value = `${day}.${month}.${year}`;
  }

  if (hourSelect) {
    hourSelect.value = String(date.getHours()).padStart(2, '0');
  }

  if (minuteSelect) {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.round(minutes / 5) * 5;
    minuteSelect.value = String(roundedMinutes % 60).padStart(2, '0');
  }

  updateEditReminderDatetime();
}

/**
 * Reset edit reminder fields.
 */
export function resetEditReminderFields(): void {
  const dateInput = document.getElementById('edit-reminder-date') as HTMLInputElement | null;
  const hourSelect = document.getElementById('edit-reminder-hour') as HTMLSelectElement | null;
  const minuteSelect = document.getElementById('edit-reminder-minute') as HTMLSelectElement | null;
  const hiddenInput = document.getElementById('edit-reminder-datetime') as HTMLInputElement | null;

  if (dateInput) dateInput.value = '';
  if (hourSelect) hourSelect.value = '';
  if (minuteSelect) minuteSelect.value = '';
  if (hiddenInput) hiddenInput.value = '';
}

// ============================================================================
// Status Badge Helpers
// ============================================================================

/**
 * Get reminder status badge configuration.
 */
export function getReminderStatusBadge(status: string): { text: string; class: string } {
  const statusConfig: Record<string, { text: string; class: string }> = {
    pending: { text: 'Ожидает', class: 'badge-warning' },
    sent: { text: 'Отправлено', class: 'badge-success' },
    failed: { text: 'Ошибка', class: 'badge-error' },
    cancelled: { text: 'Отменено', class: 'badge-ghost' },
  };

  return statusConfig[status] || { text: status, class: 'badge-ghost' };
}

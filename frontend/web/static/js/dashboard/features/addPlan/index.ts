/**
 * Add Plan Feature Module
 *
 * Exports all plan form functionality.
 */

// Legacy plan form and hints removed (v11.x+)
// New implementation in ../modalPlan/ used instead

// Period buttons
export {
  setupPlanPeriodButtons,
  setupPlanTypeButtons,
  updatePlanPeriodButtons,
} from './periodButtons';

// Reminder settings
export {
  toggleReminderSettings,
  togglePlanMode,
  prefillReminderDateTime,
  initReminderCalendarWidget,
  updateReminderDatetime,
  resetReminderFields,
  getCurrentTimeRounded,
} from './reminderSettings';

// Recurring settings
export {
  initRecurringFields,
  resetRecurringOnlyFields,
  resetRecurringSettings,
  updateFrequencyFields,
  updateDurationFields,
  updateRecurringPreview,
  collectRecurringSettings,
} from './recurringSettings';

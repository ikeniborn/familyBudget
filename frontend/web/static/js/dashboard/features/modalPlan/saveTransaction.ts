/**
 * Save transaction operation for modal plan
 *
 * @module modalPlan/saveTransaction
 */

import { refreshUIAfterPlanSave } from '../../shared/utils/uiRefresh';
import { extractRecurringSettings, extractReminderSettings } from './recurringSettings';
import { parseIntOrNull, postAPI } from '../../shared/utils/apiHelpers';

/**
 * Save plan transaction
 */
export async function savePlanTransaction(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);

  // Extract recurring settings (if recurring mode selected)
  const recurringSettings = extractRecurringSettings(form);
  const reminderSettings = extractReminderSettings(form);

  // Determine plan type and settings
  let planData: any;

  if (recurringSettings) {
    // Recurring plan
    planData = {
      record_type: 'plan',
      financial_center_id: parseIntOrNull(formData.get('financial_center_id'))!,
      article_id: parseIntOrNull(formData.get('article_id'))!,
      cost_center_id: parseIntOrNull(formData.get('cost_center_id')),
      amount: Number.parseInt(formData.get('amount') as string, 10),
      description: formData.get('description') || null,
      // Recurring settings
      frequency_type: recurringSettings.frequency_type,
      frequency_value: recurringSettings.frequency_value,
      start_date: (formData.get('plan_month') as string) + '-01', // YYYY-MM-DD
      occurrences_count: recurringSettings.occurrences_count,
      end_date: recurringSettings.end_date,
      // Reminder (optional)
      enable_reminder: recurringSettings.enable_reminder,
      reminder_hour: recurringSettings.reminder_hour,
      reminder_minute: recurringSettings.reminder_minute,
    };
  } else {
    // One-time plan (regular or reminder mode)
    planData = {
      record_type: 'plan',
      fact_date: (formData.get('plan_month') as string) + '-01', // Convert YYYY-MM → YYYY-MM-01 for FactCreate schema
      financial_center_id: parseIntOrNull(formData.get('financial_center_id'))!,
      article_id: parseIntOrNull(formData.get('article_id'))!,
      cost_center_id: parseIntOrNull(formData.get('cost_center_id')),
      amount: Number.parseInt(formData.get('amount') as string, 10),
      description: formData.get('description') || null,
    };
  }

  // POST to appropriate endpoint based on plan mode
  if (recurringSettings) {
    // Recurring plan → /api/v1/recurring-plans
    await postAPI<any>('/api/v1/recurring-plans/', planData, 'SavePlanModal');
  } else {
    // One-time plan (regular/reminder) → /api/v1/facts
    const responseData = await postAPI<any>('/api/v1/facts', planData, 'SavePlanModal');

    // Create reminder if in reminder mode (separate API call)
    if (reminderSettings) {
      await postAPI(
        `/api/v1/reminders/${responseData.id}`,
        { reminder_datetime: reminderSettings.reminder_datetime },
        'SavePlanModal'
      );
    }
  }

  // Update UI
  await refreshUIAfterPlanSave();

  if (typeof window.loadRecentTransactions === 'function') {
    await window.loadRecentTransactions();
  }
}

/**
 * Save transaction operation for modal plan
 *
 * @module modalPlan/saveTransaction
 */

import { refreshUIAfterPlanSave } from '../../shared/utils/uiRefresh';
import { extractRecurringSettings, extractReminderSettings } from './recurringSettings';
import { parseIntOrNull, postAPI } from '../../shared/utils/apiHelpers';
import { getDexieManager, isDexieActive, mapAPIFactToLocal, toCents, db } from '@db/dexie';

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
      record_type: 'plan', // Always 'plan' for budget plans
      plan_month: formData.get('plan_month'), // YYYY-MM (start month)
      financial_center_id: parseIntOrNull(formData.get('financial_center_id'))!,
      article_id: parseIntOrNull(formData.get('article_id'))!,
      cost_center_id: parseIntOrNull(formData.get('cost_center_id')),
      amount: parseFloat(formData.get('amount') as string),
      description: formData.get('description') || null,
      // Recurring settings
      frequency_type: recurringSettings.frequency_type,
      frequency_value: recurringSettings.frequency_value,
      months_count: recurringSettings.months_count,
      start_month: formData.get('plan_month'), // YYYY-MM
      is_active: recurringSettings.is_active,
      // Reminder (optional)
      enable_reminder: recurringSettings.enable_reminder,
      reminder_time: recurringSettings.reminder_time
    };
  } else {
    // One-time plan (regular or reminder mode)
    planData = {
      record_type: 'plan', // Always 'plan' for budget plans
      fact_date: formData.get('plan_month') + '-01', // Convert YYYY-MM → YYYY-MM-01 for FactCreate schema
      financial_center_id: parseIntOrNull(formData.get('financial_center_id'))!,
      article_id: parseIntOrNull(formData.get('article_id'))!,
      cost_center_id: parseIntOrNull(formData.get('cost_center_id')),
      amount: parseFloat(formData.get('amount') as string),
      description: formData.get('description') || null,
      // One-time plan settings
      frequency_type: 'monthly',
      frequency_value: null,
      months_count: 1,
      start_month: formData.get('plan_month'), // YYYY-MM
      is_active: true
    };

    // Add reminder if reminder mode
    if (reminderSettings) {
      planData.reminder_datetime = reminderSettings.reminder_datetime;
    }
  }

  // POST to appropriate endpoint based on plan mode
  if (recurringSettings) {
    // Recurring plan → /api/v1/recurring-plans
    const responseData = await postAPI<any>('/api/v1/recurring-plans', planData, 'SavePlanModal');

    // Write recurring plan to Dexie immediately
    if (isDexieActive()) {
      try {
        const manager = getDexieManager();
        if (manager.isReady()) {
          await db.recurringPlans.put({
            ...responseData,
            amount: toCents(responseData.amount),
            synced_at: new Date()
          });
        }
      } catch (dexieError) {
        console.warn('[SavePlanModal] Failed to write recurring plan to Dexie (non-critical):', dexieError);
      }
    }
  } else {
    // One-time plan (regular/reminder) → /api/v1/facts
    const responseData = await postAPI<any>('/api/v1/facts', planData, 'SavePlanModal');

    // Write one-time plan to Dexie immediately
    if (isDexieActive()) {
      try {
        const manager = getDexieManager();
        if (manager.isReady()) {
          const localFact = mapAPIFactToLocal(responseData);
          await db.budgetFacts.put({ ...localFact, amount: toCents(localFact.amount) });
        }
      } catch (dexieError) {
        console.warn('[SavePlanModal] Failed to write plan to Dexie (non-critical):', dexieError);
      }
    }
  }

  // Update UI
  await refreshUIAfterPlanSave();
}

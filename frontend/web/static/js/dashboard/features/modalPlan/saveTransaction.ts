/**
 * Save transaction operation for modal plan
 *
 * @module modalPlan/saveTransaction
 */

import { refreshUIAfterPlanSave } from '../../shared/utils/uiRefresh';
import { extractRecurringSettings, extractReminderSettings } from './recurringSettings';
import { parseIntOrNull, postAPI } from '../../shared/utils/apiHelpers';
import { getDexieManager, isDexieActive, mapAPIFactToLocal, db, createFact, addPendingOperation, generateUUID, calculateContentHash } from '@db/dexie';
import { getCurrentUserId } from '@shared/utils/userHelpers';

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
    try {
      const responseData = await postAPI<any>('/api/v1/recurring-plans/', planData, 'SavePlanModal');

      // Write recurring plan to Dexie immediately
      if (isDexieActive()) {
        try {
          const manager = getDexieManager();
          if (manager.isReady()) {
            await db.recurringPlans.put({
              ...responseData,
              synced_at: new Date()
            });
          }
        } catch (dexieError) {
          console.warn('[SavePlanModal] Failed to write recurring plan to Dexie (non-critical):', dexieError);
        }
      }
    } catch (error) {
      // Offline fallback: enqueue recurring plan in pendingOperations
      const isOffline = !navigator.onLine
        || (error instanceof TypeError && /fetch/i.test(error.message));

      if (isOffline && isDexieActive()) {
        try {
          const temp_id = generateUUID();
          const content_hash = await calculateContentHash(planData as Record<string, unknown>);
          await addPendingOperation({
            operation: 'create',
            entity_type: 'recurring_plan',
            temp_id,
            server_id: null,
            payload: planData as Record<string, unknown>,
            attempts: 0,
            max_attempts: 3,
            last_error: null,
            next_retry_at: null,
            content_hash,
            created_at: new Date(),
            updated_at: new Date()
          });
          if (typeof (window as any).showToast === 'function') {
            (window as any).showToast('Регулярный план сохранён offline — отправится при подключении', 'info');
          }
          await refreshUIAfterPlanSave();
          return;
        } catch (offlineError) {
          console.error('[SavePlanModal] Failed to save recurring plan offline:', offlineError);
        }
      }

      throw error;
    }
  } else {
    // One-time plan (regular/reminder) → /api/v1/facts
    try {
      const responseData = await postAPI<any>('/api/v1/facts', planData, 'SavePlanModal');

      // Create reminder if in reminder mode (separate API call)
      if (reminderSettings) {
        await postAPI(
          `/api/v1/reminders/${responseData.id}`,
          { reminder_datetime: reminderSettings.reminder_datetime },
          'SavePlanModal'
        );
      }

      // Write one-time plan to Dexie immediately
      if (isDexieActive()) {
        try {
          const manager = getDexieManager();
          if (manager.isReady()) {
            const localFact = mapAPIFactToLocal(responseData);
            await db.budgetFacts.put(localFact);
          }
        } catch (dexieError) {
          console.warn('[SavePlanModal] Failed to write plan to Dexie (non-critical):', dexieError);
        }
      }
    } catch (error) {
      // Offline fallback: enqueue one-time plan in Dexie pendingOperations
      const isOffline = !navigator.onLine
        || (error instanceof TypeError && /fetch/i.test(error.message));

      if (isOffline && isDexieActive()) {
        try {
          const userId = await getCurrentUserId();
          await createFact({
            user_id: userId,
            article_id: planData.article_id,
            financial_center_id: planData.financial_center_id,
            cost_center_id: planData.cost_center_id ?? null,
            date: planData.fact_date,
            amount: planData.amount,
            record_type: 'plan',
            comment: planData.description ?? null,
            transfer_group_id: null,
            is_transfer: false,
            sync_hash: null
          });
          if (reminderSettings) {
            if (typeof (window as any).showToast === 'function') {
              (window as any).showToast('Напоминание будет создано после восстановления связи', 'warning');
            }
          }
          if (typeof (window as any).showToast === 'function') {
            (window as any).showToast('План сохранён offline — отправится при подключении', 'info');
          }
          await refreshUIAfterPlanSave();
          return;
        } catch (offlineError) {
          console.error('[SavePlanModal] Failed to save plan offline:', offlineError);
        }
      }

      throw error;
    }
  }

  // Update UI
  await refreshUIAfterPlanSave();

  if (typeof window.loadRecentTransactions === 'function') {
    await window.loadRecentTransactions();
  }
}

/**
 * Save operations for modal plan
 * Handles both plan transaction and plan transfer save
 *
 * @module modalPlan/saveOperations
 */

import { closeModalPlan } from './index';
import { getCurrentTab } from './tabManager';
import { extractRecurringSettings, extractReminderSettings } from './recurringSettings';
import { refreshUIAfterPlanSave } from '../../shared/utils/uiRefresh';

declare const debugLog: (...args: any[]) => void;

/**
 * Set button loading state
 */
function setButtonLoading(button: HTMLElement, loading: boolean): void {
  const btn = button as HTMLButtonElement;
  btn.disabled = loading;

  if (loading) {
    btn.classList.add('loading');
  } else {
    btn.classList.remove('loading');
  }
}

/**
 * Save plan transaction
 */
async function savePlanTransaction(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);

  // Extract recurring settings (if recurring mode selected)
  const recurringSettings = extractRecurringSettings(form);
  const reminderSettings = extractReminderSettings(form);

  // Determine plan type and settings
  let planData: any;

  if (recurringSettings) {
    // Recurring plan
    planData = {
      record_type: formData.get('plan_type'), // expense/income
      plan_month: formData.get('plan_month'), // YYYY-MM (start month)
      financial_center_id: parseInt(formData.get('financial_center_id') as string),
      article_id: parseInt(formData.get('article_id') as string),
      cost_center_id: formData.get('cost_center_id')
        ? parseInt(formData.get('cost_center_id') as string)
        : null,
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
      record_type: formData.get('plan_type'), // expense/income
      plan_month: formData.get('plan_month'), // YYYY-MM
      financial_center_id: parseInt(formData.get('financial_center_id') as string),
      article_id: parseInt(formData.get('article_id') as string),
      cost_center_id: formData.get('cost_center_id')
        ? parseInt(formData.get('cost_center_id') as string)
        : null,
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

  debugLog('[SavePlanModal] Saving plan transaction:', planData);

  // POST /api/v1/recurring-plans
  const response = await fetch('/api/v1/recurring-plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(planData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  debugLog('[SavePlanModal] Plan saved:', result);

  // Update UI
  await refreshUIAfterPlanSave();
}

/**
 * Save plan transfer
 */
async function savePlanTransfer(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);

  // Build request data for plan transfer
  const data = {
    record_type: 'plan',
    transfer_period: formData.get('transfer_period'), // YYYY-MM
    from_financial_center_id: parseInt(formData.get('from_financial_center_id') as string),
    to_financial_center_id: parseInt(formData.get('to_financial_center_id') as string),
    from_article_id: formData.get('from_article_id')
      ? parseInt(formData.get('from_article_id') as string)
      : null,
    to_article_id: formData.get('to_article_id')
      ? parseInt(formData.get('to_article_id') as string)
      : null,
    amount: parseFloat(formData.get('amount') as string),
    description: formData.get('description') || null
  };

  debugLog('[SavePlanModal] Saving plan transfer:', data);

  // POST /api/v1/admin/transfers
  const response = await fetch('/api/v1/admin/transfers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  debugLog('[SavePlanModal] Plan transfer saved:', result);

  // Update UI
  await refreshUIAfterPlanSave();
}

/**
 * Save plan modal (router function)
 */
export async function savePlanModal(button: HTMLElement): Promise<void> {
  if ((button as HTMLButtonElement).disabled) return;

  const form = document.getElementById('form_modal_plan') as HTMLFormElement;

  if (!form) {
    debugLog('[SavePlanModal] Form not found');
    return;
  }

  const activeTab = getCurrentTab();

  // Set button loading state
  setButtonLoading(button, true);

  // Validate form
  if (!form.checkValidity()) {
    setButtonLoading(button, false);
    form.reportValidity();
    return;
  }

  try {
    if (activeTab === 'transaction') {
      await savePlanTransaction(form);
    } else {
      await savePlanTransfer(form);
    }

    // Close modal on success
    closeModalPlan();

    // Show success toast
    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast('План сохранён', 'success');
    }

  } catch (error) {
    debugLog('[SavePlanModal] Error:', error);
    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast('Ошибка сохранения', 'error');
    }
  } finally {
    setButtonLoading(button, false);
  }
}

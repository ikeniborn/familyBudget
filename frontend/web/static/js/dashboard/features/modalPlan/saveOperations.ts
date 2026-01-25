/**
 * Save operations for modal plan
 * Handles both plan transaction and plan transfer save
 *
 * @module modalPlan/saveOperations
 */

import { closeModalPlan } from './index';
import { getCurrentTab } from './tabManager';

declare const debugLog: (...args: any[]) => void;
declare const htmx: any;

/**
 * Refresh UI components after save
 */
async function refreshUIAfterSave(): Promise<void> {
  debugLog('[SavePlanModal] Refreshing UI components...');

  try {
    // Refresh quick stats (index.html)
    const quickStatsEl = document.getElementById('quick-stats-container');
    if (quickStatsEl && typeof htmx !== 'undefined') {
      htmx.trigger(quickStatsEl, 'load');
    }

    // Refresh account balances (index.html)
    const accountBalancesEl = document.getElementById('account-balances-container');
    if (accountBalancesEl && typeof htmx !== 'undefined') {
      htmx.trigger(accountBalancesEl, 'load');
    }

    // Reload plan table if on plan.html page
    if (typeof (window as any).reloadPlans === 'function') {
      await (window as any).reloadPlans();
    }

    debugLog('[SavePlanModal] UI refresh completed');
  } catch (error) {
    debugLog('[SavePlanModal] Error refreshing UI:', error);
    // Non-critical error, don't throw
  }
}

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

  // Build request data for recurring plan
  const data = {
    record_type: formData.get('record_type'), // expense/income
    plan_month: formData.get('plan_month'), // YYYY-MM
    financial_center_id: parseInt(formData.get('financial_center_id') as string),
    article_id: parseInt(formData.get('article_id') as string),
    cost_center_id: formData.get('cost_center_id')
      ? parseInt(formData.get('cost_center_id') as string)
      : null,
    amount: parseFloat(formData.get('amount') as string),
    description: formData.get('description') || null,
    // Recurring settings (for now, create as one-time plan)
    frequency_type: 'monthly',
    frequency_value: null,
    months_count: 1, // One-time plan
    start_month: formData.get('plan_month'), // YYYY-MM
    is_active: true
  };

  debugLog('[SavePlanModal] Saving plan transaction:', data);

  // POST /api/v1/recurring-plans
  const response = await fetch('/api/v1/recurring-plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  debugLog('[SavePlanModal] Plan saved:', result);

  // Update UI
  await refreshUIAfterSave();
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
  await refreshUIAfterSave();
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

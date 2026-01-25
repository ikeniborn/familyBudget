/**
 * Save operations for modal plan
 * Handles both plan transaction and plan transfer save
 *
 * @module modalPlan/saveOperations
 */

import { closeModalPlan } from './index';
import { getCurrentTab } from './tabManager';

declare const debugLog: (...args: any[]) => void;

/**
 * Show toast notification
 */
function showToast(message: string, type: 'success' | 'error'): void {
  debugLog(`[Toast ${type}] ${message}`);
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

  // TODO: Implement plan transaction save
  // This will use existing addPlan module logic

  debugLog('[SavePlanModal] Saving plan transaction:', formData);
}

/**
 * Save plan transfer
 */
async function savePlanTransfer(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);

  // TODO: Implement plan transfer save

  debugLog('[SavePlanModal] Saving plan transfer:', formData);
}

/**
 * Save plan modal (router function)
 */
export async function savePlanModal(button: HTMLElement): Promise<void> {
  if ((button as HTMLButtonElement).disabled) return;

  const form = document.getElementById('form_modal_plan') as HTMLFormElement;

  if (!form) {
    console.error('[SavePlanModal] Form not found');
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
    showToast('План сохранён', 'success');

  } catch (error) {
    console.error('[SavePlanModal] Error:', error);
    showToast('Ошибка сохранения', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

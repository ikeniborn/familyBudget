/**
 * Save operations for modal plan
 * Router for plan transaction and plan transfer save with code splitting
 *
 * @module modalPlan/saveOperations
 */

import { closeModalPlan } from './index';
import { getCurrentTab } from './tabManager';
import { savePlanTransaction } from './saveTransaction';
import { setButtonLoading } from '../../shared/utils/buttonState';
import { APIError } from '../../shared/utils/apiHelpers';
import {
  disableInactiveTabValidation,
  restoreRequiredValidation,
  disableInactiveTabInputs,
  restoreInactiveTabInputs,
} from '../../shared/utils/tabValidation';

declare const debugLog: (...args: any[]) => void;

const MODAL_ID = 'modal_plan';

/**
 * Save plan modal (router function)
 */
export async function savePlanModal(button: HTMLElement): Promise<void> {
  const btn = button as HTMLButtonElement;
  if (btn.disabled) return;

  // Disable immediately (synchronous) to prevent duplicate calls
  // when both onclick attribute and event listener fire simultaneously
  btn.disabled = true;

  const form = document.getElementById('form_modal_plan') as HTMLFormElement;

  if (!form) {
    debugLog('[SavePlanModal] Form not found');
    btn.disabled = false;
    return;
  }

  const activeTab = getCurrentTab();

  // Set button loading state
  setButtonLoading(button, true);

  disableInactiveTabValidation(MODAL_ID, activeTab);

  // Validate form (only active tab fields)
  if (!form.checkValidity()) {
    setButtonLoading(button, false);
    form.reportValidity();
    restoreRequiredValidation(MODAL_ID); // Restore before return

    // CRITICAL FIX: Show toast notification for validation errors
    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast('Заполните все обязательные поля', 'warning');
    }

    return;
  }

  // Exclude inactive-tab inputs from FormData (shared `name` collision, BUG-005)
  disableInactiveTabInputs(MODAL_ID, activeTab);

  try {
    if (activeTab === 'transaction') {
      await savePlanTransaction(form);
    } else {
      // Lazy load transfer save module (code splitting)
      const { savePlanTransfer } = await import('./saveTransfer');
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
    const message = error instanceof APIError
      ? (error.status === 422
          ? `Проверьте форму: ${error.detail}`
          : `Ошибка (${error.status}): ${error.detail}`)
      : 'Ошибка сохранения';
    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast(message, 'error');
    }
  } finally {
    setButtonLoading(button, false);
    restoreRequiredValidation(MODAL_ID);
    restoreInactiveTabInputs(MODAL_ID);
  }
}

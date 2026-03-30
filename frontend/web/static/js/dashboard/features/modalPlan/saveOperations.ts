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

declare const debugLog: (...args: any[]) => void;

/**
 * Disable required validation on inactive tab (v10.1.52)
 * Prevents "not focusable" errors for hidden required fields
 */
function disableInactiveTabValidation(activeTab: 'transaction' | 'transfer'): void {
  const inactiveTab = activeTab === 'transaction' ? 'transfer' : 'transaction';
  const inactiveTabSelector = `#modal_plan-tab-${inactiveTab}`;
  const inactiveFields = document.querySelectorAll(`${inactiveTabSelector} [required]`);

  inactiveFields.forEach((field) => {
    field.removeAttribute('required');
    field.setAttribute('data-was-required', 'true'); // Mark for restore
  });
}

/**
 * Restore required validation on all tabs (v10.1.52)
 */
function restoreRequiredValidation(): void {
  const fieldsToRestore = document.querySelectorAll('[data-was-required="true"]');
  fieldsToRestore.forEach((field) => {
    field.setAttribute('required', '');
    field.removeAttribute('data-was-required');
  });
}

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

  // v10.1.52: Disable required validation on inactive tab
  disableInactiveTabValidation(activeTab);

  // Validate form (only active tab fields)
  if (!form.checkValidity()) {
    setButtonLoading(button, false);
    form.reportValidity();
    restoreRequiredValidation(); // Restore before return

    // CRITICAL FIX: Show toast notification for validation errors
    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast('Заполните все обязательные поля', 'warning');
    }

    return;
  }

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
    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast('Ошибка сохранения', 'error');
    }
  } finally {
    setButtonLoading(button, false);
    // v10.1.52: Restore required validation after save
    restoreRequiredValidation();
  }
}

/**
 * Save operations for modal fact
 * Router for transaction and transfer save with code splitting
 *
 * @module modalFact/saveOperations
 */

import { closeModalFact } from './index';
import { getCurrentTab } from './tabManager';
import { saveFactTransaction } from './saveTransaction';
import { setButtonLoading } from '../../shared/utils/buttonState';

declare const debugLog: (...args: any[]) => void;

/**
 * Disable required validation on inactive tab (v10.1.52)
 * Prevents "not focusable" errors for hidden required fields
 */
function disableInactiveTabValidation(activeTab: 'transaction' | 'transfer'): void {
  const inactiveTab = activeTab === 'transaction' ? 'transfer' : 'transaction';
  const inactiveTabSelector = `#modal_fact-tab-${inactiveTab}`;
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
 * Save fact modal (router function)
 * Determines which tab is active and calls appropriate save function
 * Transfer save is lazy-loaded to reduce initial bundle size
 */
export async function saveFactModal(button: HTMLElement): Promise<void> {
  if ((button as HTMLButtonElement).disabled) return;

  const form = document.getElementById('form_modal_fact') as HTMLFormElement;

  if (!form) {
    debugLog('[SaveFactModal] Form not found');
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
    return;
  }

  try {
    if (activeTab === 'transaction') {
      await saveFactTransaction(form);
    } else {
      // Lazy load transfer save module (code splitting)
      const { saveFactTransfer } = await import('./saveTransfer');
      await saveFactTransfer(form);
    }

    // Close modal on success
    closeModalFact();

    // Show success toast
    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast('Факт сохранён', 'success');
    }

  } catch (error) {
    debugLog('[SaveFactModal] Error:', error);
    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast('Ошибка сохранения', 'error');
    }
  } finally {
    setButtonLoading(button, false);
    // v10.1.52: Restore required validation after save
    restoreRequiredValidation();
  }
}

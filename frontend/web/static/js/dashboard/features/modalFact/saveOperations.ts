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
import {
  disableInactiveTabValidation,
  restoreRequiredValidation,
} from '../../shared/utils/tabValidation';

declare const debugLog: (...args: any[]) => void;

const MODAL_ID = 'modal_fact';

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

  disableInactiveTabValidation(MODAL_ID, activeTab);

  // Validate form (only active tab fields)
  if (!form.checkValidity()) {
    setButtonLoading(button, false);
    form.reportValidity();
    restoreRequiredValidation(MODAL_ID); // Restore before return

    // UX: Show toast notification for validation errors
    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast('Заполните все обязательные поля', 'warning');
    }

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
    restoreRequiredValidation(MODAL_ID);
  }
}

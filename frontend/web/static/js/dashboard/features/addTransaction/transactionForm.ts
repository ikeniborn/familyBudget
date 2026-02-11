/**
 * Transaction Form Operations
 *
 * Handles form submission, validation, and save operations for transactions.
 */

import { getState } from '../../core/DashboardState';
import { loadPendingRecords } from '../pendingRecords';
import type { TransactionFormData } from '../../types/dashboard.d';



declare const debugLog: (...args: any[]) => void;
// ============================================================================
// Form Submission
// ============================================================================

/**
 * Save transaction (wrapper for form submission with double-click prevention)
 */
export function saveTransaction(button: HTMLElement): void {
  if ((button as HTMLButtonElement).disabled) return; // Already processing
  setButtonLoading(button, true);

  const formId = button.dataset.formId;
  const form = formId ? document.getElementById(formId) as HTMLFormElement | null : null;

  if (form && form.checkValidity()) {
    form.requestSubmit();
  } else {
    // Re-enable button if validation fails
    setButtonLoading(button, false);
    form?.reportValidity();
  }
}

/**
 * Save transaction to offline queue only (without uploading)
 */
export async function saveTransactionOffline(button: HTMLElement): Promise<void> {
  const formId = button.dataset.formId;
  const modalId = button.dataset.modalId;
  const form = formId ? document.getElementById(formId) as HTMLFormElement | null : null;
  const modal = modalId ? document.getElementById(modalId) as HTMLDialogElement | null : null;

  if (!form || !modal) {
    console.error('[saveTransactionOffline] Form or modal not found:', formId, modalId);
    return;
  }

  // Validate form
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  // Disable button and show loading
  setButtonLoading(button, true);

  try {
    const formData = new FormData(form);

    // Helper to get selected option text
    function getSelectedText(selectElement: HTMLSelectElement | null): string | null {
      if (!selectElement) return null;
      const selected = selectElement.options[selectElement.selectedIndex];
      return selected ? selected.text : null;
    }

    // Get form elements for names
    const fcSelect = form.querySelector('[name="financial_center_id"]') as HTMLSelectElement | null;
    const ccSelect = form.querySelector('[name="cost_center_id"]') as HTMLSelectElement | null;

    // Get article name from category tree
    let articleName: string | null = null;
    const state = getState();
    if (state.transactionCategoryTreeSelect?.getSelectedCategory) {
      const selected = state.transactionCategoryTreeSelect.getSelectedCategory();
      articleName = selected ? selected.name : null;
    }

    const data: TransactionFormData = {
      record_type: 'fact',
      fact_type: formData.get('record_type') as 'income' | 'expense',
      amount: parseFloat(formData.get('amount') as string),
      article_id: parseInt(formData.get('article_id') as string),
      article_name: articleName || undefined,
      financial_center_id: parseInt(formData.get('financial_center_id') as string),
      financial_center_name: getSelectedText(fcSelect) || undefined,
      cost_center_id: formData.get('cost_center_id') ? parseInt(formData.get('cost_center_id') as string) : null,
      cost_center_name: getSelectedText(ccSelect) || undefined,
      fact_date: window.BudgetShared?.DateFormatter.formatForAPI(formData.get('fact_date') as string) || '',
      description: (formData.get('description') as string) || null,
    };

    // Force offline save (bypass online check)
    if (window.offlineManager) {
      await window.offlineManager.createFactOffline(data);

      modal.close();
      form.reset();

      // Reset date to today
      const dateInput = form.querySelector('input[name="fact_date"]') as HTMLInputElement | null;
      if (dateInput && window.BudgetShared?.DateFormatter) {
        dateInput.value = window.BudgetShared.DateFormatter.today();
      }

      showToast('Факт сохранен локально (синхронизируется при подключении)', 'warning');
      // Update pending records table
      await loadPendingRecords();
    } else {
      showToast('Ошибка: OfflineManager не доступен', 'error');
    }
  } catch (error) {
    console.error('[saveTransactionOffline] Error:', error);
    showToast('Ошибка при сохранении: ' + (error as Error).message, 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

// ============================================================================
// Quick Date Helpers
// ============================================================================

/**
 * Set transaction date with offset from today
 * @deprecated Legacy function for modal_add_transaction (removed in v11.x)
 * Use setFactDate() from modalFact/dateHelpers.ts for new modals
 */
export function setTransactionDate(daysOffset: number): void {
  const dateInput = document.querySelector('#form_modal_add_transaction input[name="fact_date"]') as HTMLInputElement | null;
  if (dateInput && window.BudgetShared?.DateFormatter) {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    // Use DD.MM.YYYY format
    dateInput.value = window.BudgetShared.DateFormatter.formatForDisplay(date.toISOString().split('T')[0]);
    dateInput.focus();
  }
}

// ============================================================================
// Type Button Handlers
// ============================================================================

/**
 * Set up handlers for transaction type buttons (income/expense)
 */
export function setupTransactionTypeButtons(): void {
  const typeButtons = document.querySelectorAll('.transaction-type-btn') as NodeListOf<HTMLElement>;

  if (typeButtons.length === 0) return;

  typeButtons.forEach(button => {
    if (button.dataset.listenerAttached === 'true') return;

    button.addEventListener('click', function(this: HTMLElement) {
      // Remove btn-active from all buttons
      typeButtons.forEach(btn => btn.classList.remove('btn-active'));

      // Add btn-active to current button
      this.classList.add('btn-active');

      // Check corresponding radio button
      const radio = this.querySelector('input[type="radio"]') as HTMLInputElement | null;
      if (radio) {
        radio.checked = true;
      }

      // Reload only transaction categories with new type
      debugLog('Transaction type changed to:', this.dataset.type);

      // Call loadTransactionCategories from the module
      if (window.Dashboard?.loadTransactionCategories) {
        window.Dashboard.loadTransactionCategories();
      }

      // Update fact hints for new type
      const state = getState();
      const cat = state.transactionCategoryTreeSelect?.getSelectedCategory();
      if (cat && typeof (window as any).loadFactHints === 'function') {
        (window as any).loadFactHints(cat);
      }
    });

    button.dataset.listenerAttached = 'true';
  });
}

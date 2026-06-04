/**
 * Transaction Form Operations
 *
 * Handles form submission, validation, and save operations for transactions.
 */

import { getState } from '../../core/DashboardState';



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

// ============================================================================
// Quick Date Helpers
// ============================================================================

/**
 * Set transaction date with offset from today
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

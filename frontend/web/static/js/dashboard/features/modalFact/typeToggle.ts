/**
 * Transaction Type Toggle Manager for Modal Fact
 * Handles expense/income button switching with CategoryTreeSelect update
 *
 * @module modalFact/typeToggle
 */

import { getState } from '../../core/DashboardState';

declare const debugLog: (...args: any[]) => void;

/**
 * Setup transaction type toggle listeners
 */
export function setupTransactionTypeToggle(): void {
  const modalId = 'modal_fact';
  const tabId = `${modalId}-tab-transaction`;

  // Find all transaction type buttons in transaction tab
  const typeButtons = document.querySelectorAll<HTMLLabelElement>(
    `#${tabId} .transaction-type-btn`
  );

  typeButtons.forEach((button) => {
    // Guard: prevent duplicate listeners on modal re-open
    if (button.dataset.toggleListenerAttached === 'true') return;

    button.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent default label behavior

      const type = button.dataset.type as 'expense' | 'income';
      if (!type) return;

      // Update UI
      updateTransactionTypeUI(type);

      // Update CategoryTreeSelect
      updateCategoryTreeType(type);

      debugLog('[TypeToggle] Transaction type changed to:', type);
    });

    button.dataset.toggleListenerAttached = 'true';
  });

  // BUG-006 (2026-04-22): also react to programmatic `change` on the radios
  // themselves. The click handler above only fires when the surrounding label is
  // clicked; when something else toggles the radio (Choices.js, tests, a11y
  // shortcut) the category tree was left stale with the wrong expense/income set.
  const radios = document.querySelectorAll<HTMLInputElement>(
    `#${tabId} input[type="radio"][name="record_type"]`
  );

  radios.forEach((radio) => {
    if (radio.dataset.toggleListenerAttached === 'true') return;

    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const type = radio.value as 'expense' | 'income';
      if (type !== 'expense' && type !== 'income') return;

      updateTransactionTypeUI(type);
      updateCategoryTreeType(type);
      debugLog('[TypeToggle] record_type radio changed to:', type);
    });

    radio.dataset.toggleListenerAttached = 'true';
  });

  debugLog('[TypeToggle] Transaction type toggle listeners setup');
}

/**
 * Update transaction type UI (button states)
 * Active button: solid color, no outline
 * Inactive button: outline with 50% opacity
 */
function updateTransactionTypeUI(type: 'expense' | 'income'): void {
  const modalId = 'modal_fact';
  const tabId = `${modalId}-tab-transaction`;

  const typeButtons = document.querySelectorAll<HTMLLabelElement>(
    `#${tabId} .transaction-type-btn`
  );

  typeButtons.forEach((button) => {
    const buttonType = button.dataset.type;
    const radioInput = button.querySelector<HTMLInputElement>('input[type="radio"]');

    if (buttonType === type) {
      // Active button: solid color (remove outline)
      button.classList.remove('btn-outline', 'opacity-50');
      button.classList.add('btn-active');
      if (radioInput) radioInput.checked = true;
    } else {
      // Inactive button: outline with low opacity
      button.classList.add('btn-outline', 'opacity-50');
      button.classList.remove('btn-active');
      if (radioInput) radioInput.checked = false;
    }
  });
}

/**
 * Update CategoryTreeSelect type (expense/income)
 */
async function updateCategoryTreeType(type: 'expense' | 'income'): Promise<void> {
  const state = getState();
  const categoryTree = state.transactionCategoryTreeSelect;

  if (!categoryTree) {
    debugLog('[TypeToggle] CategoryTreeSelect not found');
    return;
  }

  try {
    // Update category tree type (triggers category reload)
    await categoryTree.updateType(type);
    debugLog('[TypeToggle] CategoryTreeSelect updated to type:', type);

    // Trigger hints reload (after category type change)
    if (typeof (window as any).loadFactTransactionHints === 'function') {
      (window as any).loadFactTransactionHints();
      debugLog('[TypeToggle] Transaction hints reload triggered');
    }
  } catch (error) {
    debugLog('[TypeToggle] Error updating CategoryTreeSelect:', error);
  }
}


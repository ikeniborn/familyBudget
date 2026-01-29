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
    // Add click listener to label
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
  } catch (error) {
    debugLog('[TypeToggle] Error updating CategoryTreeSelect:', error);
  }
}


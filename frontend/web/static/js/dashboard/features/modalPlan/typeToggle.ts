/**
 * Plan Type Toggle Manager for Modal Plan
 * Handles expense/income button switching with CategoryTreeSelect update
 *
 * @module modalPlan/typeToggle
 */

import { getState } from '../../core/DashboardState';

declare const debugLog: (...args: any[]) => void;

/**
 * Setup plan type toggle listeners
 */
export function setupPlanTypeToggle(): void {
  const modalId = 'modal_plan';
  const tabId = `${modalId}-tab-transaction`;

  // Find all plan type buttons in transaction tab
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
      updatePlanTypeUI(type);

      // Update CategoryTreeSelect
      updatePlanCategoryTreeType(type);

      debugLog('[TypeToggle Plan] Plan type changed to:', type);
    });
  });

  debugLog('[TypeToggle Plan] Plan type toggle listeners setup');
}

/**
 * Update plan type UI (button states)
 */
function updatePlanTypeUI(type: 'expense' | 'income'): void {
  const modalId = 'modal_plan';
  const tabId = `${modalId}-tab-transaction`;

  const typeButtons = document.querySelectorAll<HTMLLabelElement>(
    `#${tabId} .transaction-type-btn`
  );

  typeButtons.forEach((button) => {
    const buttonType = button.dataset.type;
    const radioInput = button.querySelector<HTMLInputElement>('input[type="radio"]');

    if (buttonType === type) {
      // Active button
      button.classList.add('btn-active');
      if (radioInput) radioInput.checked = true;
    } else {
      // Inactive button
      button.classList.remove('btn-active');
      if (radioInput) radioInput.checked = false;
    }
  });
}

/**
 * Update plan CategoryTreeSelect type
 */
async function updatePlanCategoryTreeType(type: 'expense' | 'income'): Promise<void> {
  const state = getState();
  const categoryTree = state.planCategoryTreeSelect;

  if (!categoryTree) {
    debugLog('[TypeToggle Plan] Plan CategoryTreeSelect not found');
    return;
  }

  try {
    // Update category tree type (triggers category reload)
    await categoryTree.updateType(type);
    debugLog('[TypeToggle Plan] Plan CategoryTreeSelect updated to type:', type);
  } catch (error) {
    debugLog('[TypeToggle Plan] Error updating plan CategoryTreeSelect:', error);
  }
}

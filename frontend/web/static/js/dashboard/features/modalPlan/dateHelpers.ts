/**
 * Date Helpers for Modal Plan
 * Functions for setting quick periods (current, next, after next month)
 *
 * @module modalPlan/dateHelpers
 */

/**
 * Set plan period (month) with offset
 * @param monthOffset - Number of months from current (0 = current, 1 = next, 2 = after next)
 */
export function setPlanPeriod(monthOffset: number): void {
  const hiddenInput = document.querySelector<HTMLInputElement>('#modal_plan-tab-transaction input[name="plan_month"]');
  if (!hiddenInput) {
    console.error('[setPlanPeriod] Hidden input not found');
    return;
  }

  const date = new Date();
  date.setMonth(date.getMonth() + monthOffset);

  // Format as YYYY-MM
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  hiddenInput.value = `${year}-${month}`;

  // Update button states
  const buttons = document.querySelectorAll<HTMLButtonElement>('.period-btn');
  buttons.forEach((btn) => {
    if (parseInt(btn.dataset.offset || '0') === monthOffset) {
      btn.classList.add('btn-active');
    } else {
      btn.classList.remove('btn-active');
    }
  });
}

/**
 * Set plan transfer period with offset
 * @param monthOffset - Number of months from current
 */
export function setPlanTransferPeriod(monthOffset: number): void {
  const hiddenInput = document.querySelector<HTMLInputElement>('#modal_plan-tab-transfer input[name="transfer_plan_month"]');
  if (!hiddenInput) {
    console.error('[setPlanTransferPeriod] Hidden input not found');
    return;
  }

  const date = new Date();
  date.setMonth(date.getMonth() + monthOffset);

  // Format as YYYY-MM
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  hiddenInput.value = `${year}-${month}`;

  // Update button states
  const buttons = document.querySelectorAll<HTMLButtonElement>('.transfer-period-btn');
  buttons.forEach((btn) => {
    if (parseInt(btn.dataset.offset || '0') === monthOffset) {
      btn.classList.add('btn-active');
    } else {
      btn.classList.remove('btn-active');
    }
  });
}

// Export to window for onclick handlers
if (typeof window !== 'undefined') {
  (window as any).setPlanPeriod = setPlanPeriod;
  (window as any).setPlanTransferPeriod = setPlanTransferPeriod;
}

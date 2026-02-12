/**
 * Date Helpers for Modal Plan
 * Functions for setting quick periods (current, next, after next month)
 *
 * @module modalPlan/dateHelpers
 */

import { setDateWithOffset, updateButtonActiveState } from '../../shared/utils/dateHelpers';

/**
 * Update transfer period button text with month and year
 * e.g. "Февраль 2026" instead of "Текущий"
 */
export function updateTransferPeriodButtonsText(): void {
  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const buttons = document.querySelectorAll<HTMLButtonElement>('.transfer-period-btn');
  buttons.forEach((btn) => {
    const offset = parseInt(btn.dataset.offset || '0');
    const date = new Date();
    date.setMonth(date.getMonth() + offset);

    const monthName = monthNames[date.getMonth()];
    const year = date.getFullYear();
    btn.textContent = `${monthName} ${year}`;
  });
}

/**
 * Set plan period (month) with offset
 * @param monthOffset - Number of months from current (0 = current, 1 = next, 2 = after next)
 */
export function setPlanPeriod(monthOffset: number): void {
  setDateWithOffset(monthOffset, {
    selector: '#modal_plan-tab-transaction input[name="plan_month"]',
    format: 'YYYY-MM',
    offsetUnit: 'month',
  });

  // Update button states
  updateButtonActiveState(monthOffset, '.period-btn');
}

/**
 * Set plan transfer period with offset
 * @param monthOffset - Number of months from current
 */
export function setPlanTransferPeriod(monthOffset: number): void {
  setDateWithOffset(monthOffset, {
    selector: '#modal_plan-tab-transfer input[name="transfer_plan_month"]',
    format: 'YYYY-MM',
    offsetUnit: 'month',
  });

  // Update button states
  updateButtonActiveState(monthOffset, '.transfer-period-btn');

  // Update button text with month and year
  updateTransferPeriodButtonsText();
}

// Export to window for onclick handlers
if (typeof window !== 'undefined') {
  (window as any).setPlanPeriod = setPlanPeriod;
  (window as any).setPlanTransferPeriod = setPlanTransferPeriod;
}

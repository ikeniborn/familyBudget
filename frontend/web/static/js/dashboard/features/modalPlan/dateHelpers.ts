/**
 * Date Helpers for Modal Plan
 * Functions for setting quick periods (current, next, after next month)
 *
 * @module modalPlan/dateHelpers
 */

import { setDateWithOffset, updateButtonActiveState } from '../../shared/utils/dateHelpers';

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
}

// Export to window for onclick handlers
if (typeof window !== 'undefined') {
  (window as any).setPlanPeriod = setPlanPeriod;
  (window as any).setPlanTransferPeriod = setPlanTransferPeriod;
}

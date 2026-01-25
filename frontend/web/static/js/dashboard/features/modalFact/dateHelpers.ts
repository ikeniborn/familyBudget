/**
 * Date Helpers for Modal Fact
 * Functions for setting quick dates (today, yesterday, etc.)
 *
 * @module modalFact/dateHelpers
 */

import { setDateWithOffset } from '../../shared/utils/dateHelpers';

/**
 * Set fact date with offset
 * @param daysOffset - Number of days from today (0 = today, -1 = yesterday, -2 = day before yesterday)
 */
export function setFactDate(daysOffset: number): void {
  setDateWithOffset(daysOffset, {
    selector: '#modal_fact-tab-transaction input[name="fact_date"]',
    format: 'DD.MM.YYYY',
    offsetUnit: 'day',
  });
}

/**
 * Set fact transfer date with offset
 * @param daysOffset - Number of days from today
 */
export function setFactTransferDate(daysOffset: number): void {
  setDateWithOffset(daysOffset, {
    selector: '#modal_fact-tab-transfer input[name="transfer_date"]',
    format: 'DD.MM.YYYY',
    offsetUnit: 'day',
  });
}

// Export to window for onclick handlers
if (typeof window !== 'undefined') {
  (window as any).setFactDate = setFactDate;
  (window as any).setFactTransferDate = setFactTransferDate;
}

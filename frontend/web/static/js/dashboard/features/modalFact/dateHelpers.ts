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

  // Update button active state
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    '#modal_fact-tab-transaction .flex.gap-1.mb-1 button'
  );

  buttons.forEach((btn, index) => {
    // index 0 = Сегодня (offset 0), index 1 = Вчера (offset -1), index 2 = Позавчера (offset -2)
    const isActive = index === Math.abs(daysOffset);
    btn.classList.toggle('btn-active', isActive);
    btn.classList.toggle('btn-outline', !isActive);
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

  // Update button active state for transfer tab
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    '#modal_fact-tab-transfer .flex.gap-1.mb-1 button'
  );

  buttons.forEach((btn, index) => {
    const isActive = index === Math.abs(daysOffset);
    btn.classList.toggle('btn-active', isActive);
    btn.classList.toggle('btn-outline', !isActive);
  });
}

// Export to window for onclick handlers
if (typeof window !== 'undefined') {
  (window as any).setFactDate = setFactDate;
  (window as any).setFactTransferDate = setFactTransferDate;
}

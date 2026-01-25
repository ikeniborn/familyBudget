/**
 * Date Helpers for Modal Fact
 * Functions for setting quick dates (today, yesterday, etc.)
 *
 * @module modalFact/dateHelpers
 */

/**
 * Set fact date with offset
 * @param daysOffset - Number of days from today (0 = today, -1 = yesterday, -2 = day before yesterday)
 */
export function setFactDate(daysOffset: number): void {
  const dateInput = document.querySelector<HTMLInputElement>('#modal_fact-tab-transaction input[name="fact_date"]');
  if (!dateInput) {
    console.error('[setFactDate] Date input not found');
    return;
  }

  const date = new Date();
  date.setDate(date.getDate() + daysOffset);

  // Format as DD.MM.YYYY
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  dateInput.value = `${day}.${month}.${year}`;
}

/**
 * Set fact transfer date with offset
 * @param daysOffset - Number of days from today
 */
export function setFactTransferDate(daysOffset: number): void {
  const dateInput = document.querySelector<HTMLInputElement>('#modal_fact-tab-transfer input[name="transfer_date"]');
  if (!dateInput) {
    console.error('[setFactTransferDate] Date input not found');
    return;
  }

  const date = new Date();
  date.setDate(date.getDate() + daysOffset);

  // Format as DD.MM.YYYY
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  dateInput.value = `${day}.${month}.${year}`;
}

// Export to window for onclick handlers
if (typeof window !== 'undefined') {
  (window as any).setFactDate = setFactDate;
  (window as any).setFactTransferDate = setFactTransferDate;
}

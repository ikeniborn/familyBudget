/**
 * Generic Date Helpers
 * Reusable functions for date/period manipulation
 *
 * @module shared/utils/dateHelpers
 */

interface DateSetterConfig {
  selector: string;
  format: 'DD.MM.YYYY' | 'YYYY-MM';
  offsetUnit: 'day' | 'month';
}

/**
 * Generic date/period setter with offset
 * @param offset - Number of units from current (0 = current, -1 = previous, 1 = next)
 * @param config - Configuration for selector and format
 */
export function setDateWithOffset(offset: number, config: DateSetterConfig): void {
  const input = document.querySelector<HTMLInputElement>(config.selector);
  if (!input) {
    console.error(`[setDateWithOffset] Input not found: ${config.selector}`);
    return;
  }

  const date = new Date();

  // Apply offset
  if (config.offsetUnit === 'day') {
    date.setDate(date.getDate() + offset);
  } else {
    date.setMonth(date.getMonth() + offset);
  }

  // Format based on config
  let formattedValue: string;
  if (config.format === 'DD.MM.YYYY') {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    formattedValue = `${day}.${month}.${year}`;
  } else {
    // YYYY-MM
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    formattedValue = `${year}-${month}`;
  }

  input.value = formattedValue;
}

/**
 * Update button active state based on offset
 * @param offset - Current offset value
 * @param buttonSelector - Selector for buttons to update
 */
export function updateButtonActiveState(offset: number, buttonSelector: string): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(buttonSelector);
  buttons.forEach((btn) => {
    const btnOffset = parseInt(btn.dataset.offset || '0');
    if (btnOffset === offset) {
      btn.classList.add('btn-active');
    } else {
      btn.classList.remove('btn-active');
    }
  });
}

/**
 * Format date as DD.MM.YYYY
 */
export function formatDateDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Format date as YYYY-MM
 */
export function formatDateYYYYMM(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

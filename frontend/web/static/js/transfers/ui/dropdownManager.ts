/**
 * Transfer Module - Dropdown Manager
 *
 * Populate financial center dropdowns with mutual exclusion.
 * Migrated from: frontend/web/static/js/transfer.js (lines 654-685)
 */

import { getState } from '../core/TransferState';
import type { FinancialCenter } from '../types/transfer';

/**
 * Populate financial center dropdowns with mutual exclusion
 * Migrated from: transfer.js populateFinancialCenterDropdowns() (lines 654-685)
 */
export function populateFinancialCenterDropdowns(): void {
  const state = getState();
  const fromSelect = document.querySelector<HTMLSelectElement>('#from_financial_center');
  const toSelect = document.querySelector<HTMLSelectElement>('#to_financial_center');

  if (!fromSelect || !toSelect) return;

  const fromValue = fromSelect.value;
  const toValue = toSelect.value;

  // FROM dropdown: Exclude selected TO
  populateDropdown(fromSelect, state.financialCenters, toValue);

  // TO dropdown: Exclude selected FROM
  populateDropdown(toSelect, state.financialCenters, fromValue);

  // Restore selections
  fromSelect.value = fromValue;
  toSelect.value = toValue;
}

/**
 * Populate single dropdown
 */
function populateDropdown(
  select: HTMLSelectElement,
  items: FinancialCenter[],
  excludeId: string
): void {
  const placeholder = select.querySelector('option[value=""]');
  select.innerHTML = '';
  if (placeholder) select.appendChild(placeholder);

  const filteredItems = excludeId
    ? items.filter(item => String(item.id) !== excludeId)
    : items;

  filteredItems.forEach(item => {
    const option = document.createElement('option');
    option.value = String(item.id);
    option.textContent = item.name;
    select.appendChild(option);
  });
}

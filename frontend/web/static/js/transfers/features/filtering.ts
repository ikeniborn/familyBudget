/**
 * Transfer Module - FC Filtering
 *
 * Financial center mutual exclusion and category filtering.
 * Migrated from: frontend/web/static/js/transfer.js (lines 687-763, 770-827)
 */

import { getState } from '../core/TransferState';

/**
 * Setup FC filtering (mutual exclusion)
 * Migrated from: transfer.js setupCFOFiltering() (lines 770-827)
 */
export function setupCFOFiltering(): void {
  const fromFCSelect = document.querySelector<HTMLSelectElement>('#from_financial_center');
  const toFCSelect = document.querySelector<HTMLSelectElement>('#to_financial_center');

  if (!fromFCSelect || !toFCSelect) return;

  // FROM FC change
  fromFCSelect.addEventListener('change', async (e: Event) => {
    // CRITICAL: stopPropagation prevents conflicts with global listeners
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Re-populate dropdowns (exclude selected TO from FROM list)
    const { populateFinancialCenterDropdowns } = await import('../ui/dropdownManager');
    populateFinancialCenterDropdowns();

    const fcId = fromFCSelect.value ? parseInt(fromFCSelect.value) : null;
    const state = getState();

    // Update category tree filter
    await state.fromCategoryTree?.updateFinancialCenter(fcId);

    // CRITICAL: iOS Safari delay (DOM settling)
    await new Promise(resolve => setTimeout(resolve, 50));

    // Reload hints
    if (state.recordType === 'plan') {
      const { loadTransferPlanHints } = await import('./hints');
      loadTransferPlanHints('from');
    } else {
      const { loadTransferFactHints } = await import('./hints');
      loadTransferFactHints('from');
    }
  });

  // TO FC change
  toFCSelect.addEventListener('change', async (e: Event) => {
    e.stopPropagation();
    e.stopImmediatePropagation();

    const { populateFinancialCenterDropdowns } = await import('../ui/dropdownManager');
    populateFinancialCenterDropdowns();

    const fcId = toFCSelect.value ? parseInt(toFCSelect.value) : null;
    const state = getState();

    await state.toCategoryTree?.updateFinancialCenter(fcId);
    await new Promise(resolve => setTimeout(resolve, 50));

    if (state.recordType === 'plan') {
      const { loadTransferPlanHints } = await import('./hints');
      loadTransferPlanHints('to');
    } else {
      const { loadTransferFactHints } = await import('./hints');
      loadTransferFactHints('to');
    }
  });
}

/**
 * Filter cost center dropdown based on selected FC
 * NOTE: Currently not used in UI, but kept for future
 * Migrated from: transfer.js filterCostCenterDropdown() (lines 687-716)
 */
export function filterCostCenterDropdown(
  fcId: number | null,
  targetSelectId: string
): void {
  const state = getState();
  const select = document.querySelector<HTMLSelectElement>(targetSelectId);
  if (!select) return;

  // Clear existing options (except placeholder)
  const placeholder = select.querySelector('option[value=""]');
  select.innerHTML = '';
  if (placeholder) select.appendChild(placeholder);

  // Add filtered cost centers
  const filteredCC = fcId
    ? state.costCenters.filter(cc => cc.financial_center_id === fcId)
    : state.costCenters;

  filteredCC.forEach(cc => {
    const option = document.createElement('option');
    option.value = String(cc.id);
    option.textContent = cc.name;
    select.appendChild(option);
  });
}

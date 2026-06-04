/**
 * Transfer Module - Data Loader
 *
 * Load financial centers and cost centers via REST API.
 * Migrated from: frontend/web/static/js/transfer.js (lines 546-763)
 */

import { updateState } from './TransferState';
import type { FinancialCenter, CostCenter } from '../types/transfer';

/**
 * Load transfer data (FC, CC) with cache
 * Migrated from: transfer.js loadTransferData() (lines 546-612)
 */
export async function loadTransferData(): Promise<void> {
  const [financialCenters, costCenters] = await Promise.all([
    loadFinancialCenters(),
    loadCostCenters()
  ]);

  updateState({ financialCenters, costCenters });

  // Populate dropdowns
  const { populateFinancialCenterDropdowns } = await import('../ui/dropdownManager');
  populateFinancialCenterDropdowns();
}

/**
 * Load financial centers from API
 * Migrated from: transfer.js lines 554-589
 */
async function loadFinancialCenters(): Promise<FinancialCenter[]> {
  const { getFinancialCenters } = await import('../integration/apiService');
  return getFinancialCenters();
}

/**
 * Load cost centers from API
 * Migrated from: transfer.js lines 618-653
 */
async function loadCostCenters(): Promise<CostCenter[]> {
  const { getCostCenters } = await import('../integration/apiService');
  return getCostCenters();
}

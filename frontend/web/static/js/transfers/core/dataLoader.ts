/**
 * Transfer Module - Data Loader
 *
 * Load financial centers and cost centers with IndexedDB cache (3600s TTL).
 * Migrated from: frontend/web/static/js/transfer.js (lines 546-763)
 */

import { updateState } from './TransferState';
import type { FinancialCenter, CostCenter } from '../types/transfer';

// Global dependencies
declare const window: any;

const CACHE_TTL = 3600 * 1000; // 3600 seconds

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
 * Load financial centers with IndexedDB cache
 * Migrated from: transfer.js lines 554-589
 */
async function loadFinancialCenters(): Promise<FinancialCenter[]> {
  const cacheKey = 'financial_centers';

  try {
    // Online: Try API
    if (navigator.onLine) {
      const { getFinancialCenters } = await import('../integration/apiService');
      const data = await getFinancialCenters();

      // Cache in IndexedDB
      if (window.offlineManager?.db) {
        await window.offlineManager.db.cacheData(cacheKey, data, CACHE_TTL);
      }

      return data;
    }

    // Offline: Try cache
    if (window.offlineManager?.db) {
      const cached = await window.offlineManager.db.getCachedData(cacheKey);
      if (cached) return cached;
    }
  } catch (err) {
    console.error('[Transfer] Error loading financial centers:', err);

    // Fallback to cache
    if (window.offlineManager?.db) {
      const cached = await window.offlineManager.db.getCachedData(cacheKey);
      if (cached) return cached;
    }
  }

  return []; // Empty fallback
}

/**
 * Load cost centers with IndexedDB cache
 * Migrated from: transfer.js lines 618-653
 */
async function loadCostCenters(): Promise<CostCenter[]> {
  const cacheKey = 'cost_centers';

  try {
    if (navigator.onLine) {
      const { getCostCenters } = await import('../integration/apiService');
      const data = await getCostCenters();

      if (window.offlineManager?.db) {
        await window.offlineManager.db.cacheData(cacheKey, data, CACHE_TTL);
      }

      return data;
    }

    if (window.offlineManager?.db) {
      const cached = await window.offlineManager.db.getCachedData(cacheKey);
      if (cached) return cached;
    }
  } catch (err) {
    console.error('[Transfer] Error loading cost centers:', err);

    if (window.offlineManager?.db) {
      const cached = await window.offlineManager.db.getCachedData(cacheKey);
      if (cached) return cached;
    }
  }

  return [];
}

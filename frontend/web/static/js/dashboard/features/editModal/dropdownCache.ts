/**
 * Dropdown Cache for Edit Modal
 *
 * Handles loading and caching of dropdown data for edit modal.
 */

import { getState, updateState, isCacheValid, setCacheData } from '../../core/DashboardState';
import type { Category, FinancialCenter, CostCenter } from '../../types/dashboard.d';



declare const debugLog: (...args: any[]) => void;
// ============================================================================
// Global State for Edit Modal
// ============================================================================

// Reminders map for edit modal (fact_id -> reminder)
export const remindersMap = new Map<number, any>();

// ============================================================================
// Category Loading
// ============================================================================

/**
 * Load categories for edit modal (with TTL cache).
 * Returns cached data if valid, otherwise fetches from API.
 */
export async function loadCategoriesForEdit(): Promise<Category[]> {
  const state = getState();

  // Check cache first
  if (isCacheValid(state.dropdownCache.categories)) {
    const categories = state.dropdownCache.categories.data as Category[];
    updateState({ allCategories: categories });
    return categories;
  }

  // Load from API
  try {
    const response = await fetch('/api/v1/articles?sort_by=usage_count&limit=1000', {
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      // API returns { articles: [...], total: N }
      const categories = data.articles || [];
      updateState({ allCategories: categories });
      setCacheData('categories', categories);
      return categories;
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  }

  return state.allCategories;
}

// ============================================================================
// Financial Center Loading
// ============================================================================

/**
 * Populate financial centers dropdown.
 */
export function populateFinancialCentersDropdown(
  select: HTMLSelectElement,
  centers: FinancialCenter[],
  selectedId: number | null
): void {
  debugLog('[populateFinancialCentersDropdown] Called with:', {
      centers: centers.length,
      selectedId,
      selectId: select.id,
    });

  // Clear options except first
  while (select.options.length > 1) {
    select.remove(1);
  }

  // Add options
  centers.forEach(fc => {
    const option = document.createElement('option');
    option.value = String(fc.id);
    option.textContent = fc.name;
    if (selectedId && fc.id == selectedId) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

/**
 * Load financial centers for edit modal (with TTL cache).
 */
export async function loadEditFinancialCenters(selectedId: number | null = null): Promise<void> {
  debugLog('[loadEditFinancialCenters] Called with selectedId:', selectedId);

  const select = document.getElementById('edit-financial-center') as HTMLSelectElement | null;
  if (!select) {
    console.error('[loadEditFinancialCenters] Select element not found!');
    return;
  }

  const state = getState();

  // Check cache
  if (isCacheValid(state.dropdownCache.financialCenters)) {
    const centers = state.dropdownCache.financialCenters.data as FinancialCenter[];
    populateFinancialCentersDropdown(select, centers, selectedId);
    return;
  }

  // Load from API
  try {
    const response = await fetch('/api/v1/financial-centers?limit=1000&include_global=true&include_inactive=true', {
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('[loadEditFinancialCenters] API request failed:', response.status);
      showToast(`Ошибка загрузки счетов: ${response.statusText}`, 'error');
      return;
    }

    const data = await response.json();
    const centers = data.financial_centers || [];

    // Update cache
    setCacheData('financialCenters', centers);
    populateFinancialCentersDropdown(select, centers, selectedId);
  } catch (error) {
    console.error('[loadEditFinancialCenters] Exception:', error);
    showToast(`Ошибка загрузки счетов: ${(error as Error).message}`, 'error');
  }
}

// ============================================================================
// Cost Center Loading
// ============================================================================

/**
 * Populate cost centers dropdown.
 */
export function populateCostCentersDropdown(
  select: HTMLSelectElement,
  centers: CostCenter[],
  selectedId: number | null
): void {
  debugLog('[populateCostCentersDropdown] Called with:', {
      centers: centers.length,
      selectedId,
      selectId: select.id,
    });

  // Clear options except first
  while (select.options.length > 1) {
    select.remove(1);
  }

  // Add options
  centers.forEach(cc => {
    const option = document.createElement('option');
    option.value = String(cc.id);
    option.textContent = cc.name;
    if (selectedId && cc.id == selectedId) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

/**
 * Load cost centers for edit modal (with TTL cache).
 */
export async function loadEditCostCenters(selectedId: number | null = null): Promise<void> {
  debugLog('[loadEditCostCenters] Called with selectedId:', selectedId);

  const select = document.getElementById('edit-cost-center') as HTMLSelectElement | null;
  if (!select) {
    console.error('[loadEditCostCenters] Select element not found!');
    return;
  }

  const state = getState();

  // Check cache
  if (isCacheValid(state.dropdownCache.costCenters)) {
    const centers = state.dropdownCache.costCenters.data as CostCenter[];
    updateState({ allCostCenters: centers });
    populateCostCentersDropdown(select, centers, selectedId);
    return;
  }

  // Load from API
  try {
    const response = await fetch('/api/v1/cost-centers?limit=1000', {
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('[loadEditCostCenters] API request failed:', response.status);
      return;
    }

    const data = await response.json();
    const centers = data.cost_centers || [];

    // Update cache and state
    setCacheData('costCenters', centers);
    updateState({ allCostCenters: centers });
    populateCostCentersDropdown(select, centers, selectedId);
  } catch (error) {
    console.error('[loadEditCostCenters] Exception:', error);
  }
}

// ============================================================================
// Reminders Loading
// ============================================================================

/**
 * Load reminder for specific fact (used in edit modal).
 * Optimized with direct GET request instead of fetching all reminders.
 */
export async function loadRemindersForEdit(factIds: number[]): Promise<void> {
  if (!factIds || factIds.length === 0) return;

  try {
    // Edit modal always opens single fact
    const factId = factIds[0];
    const response = await fetch(`/api/v1/reminders/${factId}`, {
      credentials: 'include',
    });

    if (response.ok) {
      const reminder = await response.json();
      if (reminder && reminder.fact_id) {
        remindersMap.set(reminder.fact_id, reminder);
      }
    } else if (response.status === 404) {
      // No reminder exists - ensure removed from map
      remindersMap.delete(factId);
    }
  } catch (error) {
    console.error('[loadRemindersForEdit] Error loading reminder:', error);
  }
}

// ============================================================================
// Offline Mode Helpers
// ============================================================================

/**
 * Populate dropdowns with single option from pending record data (offline mode).
 */
export function populateOfflineDropdowns(data: Record<string, any>): void {
  // Populate financial center dropdown with single option
  const fcSelect = document.getElementById('edit-financial-center') as HTMLSelectElement | null;
  if (fcSelect && data.financial_center_id) {
    while (fcSelect.options.length > 1) fcSelect.remove(1);
    const option = document.createElement('option');
    option.value = String(data.financial_center_id);
    option.textContent = data.financial_center_name || `ФЦ ${data.financial_center_id}`;
    option.selected = true;
    fcSelect.appendChild(option);
  }

  // Populate cost center dropdown with single option
  const ccSelect = document.getElementById('edit-cost-center') as HTMLSelectElement | null;
  if (ccSelect && data.cost_center_id) {
    while (ccSelect.options.length > 1) ccSelect.remove(1);
    const option = document.createElement('option');
    option.value = String(data.cost_center_id);
    option.textContent = data.cost_center_name || `МЗ ${data.cost_center_id}`;
    option.selected = true;
    ccSelect.appendChild(option);
  }
}

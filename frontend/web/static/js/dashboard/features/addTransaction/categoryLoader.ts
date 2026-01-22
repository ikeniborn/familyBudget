/**
 * Category Loader for Transaction Form
 *
 * Handles loading and updating category dropdowns for transaction form.
 */

import {
  getState,
  updateState,
  setTransactionCategoryTreeSelect,
} from '../../core/DashboardState';
import type { Category, CostCenter } from '../../types/dashboard.d';
import { dataLayer } from '../../../data/DataLayer';
import { getCurrentUserId } from '../../../offline/offlineManager/utils/userHelpers';



declare const debugLog: (...args: any[]) => void;
// ============================================================================
// Category Loading
// ============================================================================

/**
 * Load categories for the transaction form
 * Uses CategoryTreeSelect widget for hierarchical category selection
 */
export async function loadTransactionCategories(): Promise<void> {
  try {
    // Check if select element exists (defense in depth)
    const selectElement = document.querySelector('#form_modal_add_transaction select[name="article_id"]');
    if (!selectElement) {
      debugLog('[loadTransactionCategories] Select element not found - skipping initialization');
      return;
    }

    // Get current transaction type
    const typeInput = document.querySelector('#form_modal_add_transaction input[name="record_type"]:checked') as HTMLInputElement | null;
    const transactionType = typeInput?.value || 'expense';

    const state = getState();

    if (state.transactionCategoryTreeSelect) {
      // Update existing instance (more efficient than destroy/recreate)
      await state.transactionCategoryTreeSelect.updateType(transactionType);
    } else if (window.BudgetShared?.ChoicesCategoryTree) {
      // Initialize CategoryTreeSelect for transaction form
      const newInstance = new window.BudgetShared.ChoicesCategoryTree(
        '#form_modal_add_transaction select[name="article_id"]',
        {
          type: transactionType,
          showLeafOnly: true,
          mode: 'create',  // Create mode - prevents phantom auto-select on initial FC filter
          onCategoryChange: (category: Category | null) => {
            if (window.DEBUG_MODE) {
              debugLog('[CATEGORY] Category changed:', {
                categoryId: category?.id,
                categoryName: category?.name,
                timestamp: new Date().toISOString(),
              });
            }
            // Update fact hints for current month
            loadFactHintsForCategory(category);
          },
        }
      );
      setTransactionCategoryTreeSelect(newInstance);
    }

    debugLog('[index.html] Transaction categories loaded');
  } catch (error) {
    console.error('Failed to load transaction categories:', error);
    showToast('Ошибка при загрузке категорий транзакций', 'error');
  }
}

/**
 * Load fact hints for selected category (wrapper)
 */
function loadFactHintsForCategory(category: Category | null): void {
  // Import dynamically to avoid circular dependency
  if (typeof (window as any).loadFactHints === 'function') {
    (window as any).loadFactHints(category);
  } else debugLog('[loadFactHintsForCategory] loadFactHints not available yet');
}

// ============================================================================
// Financial Center Loading
// ============================================================================

/**
 * Load financial centers (accounts) for transaction form
 */
export async function loadFinancialCenters(): Promise<void> {
  try {
    // Get user ID for data layer queries
    const userId = await getCurrentUserId();

    // Use DataLayer (PGlite-first with API fallback)
    const centers = await dataLayer.getFinancialCenters(userId, true);

    if (centers.length === 0) {
      console.warn('No accounts returned');
      showToast('Список счетов пуст. Создайте счет в справочнике.', 'warning');
      return;
    }

    // Populate select in both forms
    const selects = [
      document.querySelector('#form_modal_add_transaction select[name="financial_center_id"]'),
      document.querySelector('#form_modal_add_plan select[name="financial_center_id"]'),
    ];

    selects.forEach(select => {
      if (!select) return;

      // Clear except first option
      while ((select as HTMLSelectElement).options.length > 1) {
        (select as HTMLSelectElement).remove(1);
      }

      // Add accounts
      centers.forEach((fc: { id: number; name: string }) => {
        const option = document.createElement('option');
        option.value = String(fc.id);
        option.textContent = fc.name;
        select.appendChild(option);
      });
    });

    // Add change listeners to filter categories AND cost centers when account changes
    setupFinancialCenterListeners();

  } catch (error) {
    console.error('Failed to load accounts:', error);
    showToast('Ошибка при загрузке счетов', 'error');
  }
}

/**
 * Set up change listeners for financial center selects
 */
function setupFinancialCenterListeners(): void {
  const transactionFcSelect = document.querySelector('#form_modal_add_transaction select[name="financial_center_id"]') as HTMLSelectElement | null;

  if (transactionFcSelect && !transactionFcSelect.dataset.listenerAttached) {
    transactionFcSelect.addEventListener('change', async (e) => {
      const fcId = transactionFcSelect.value ? parseInt(transactionFcSelect.value) : null;

      if (window.DEBUG_MODE) {
        debugLog('[FC_CHANGE] Financial center changed:', {
          fcId: fcId,
          timestamp: new Date().toISOString(),
        });
      }

      // CRITICAL: Stop event propagation to prevent global listeners from interfering
      e.stopPropagation();
      e.stopImmediatePropagation();

      const state = getState();

      // Filter categories by selected FC
      if (state.transactionCategoryTreeSelect) {
        await state.transactionCategoryTreeSelect.updateFinancialCenter(fcId);
      }

      // Filter cost centers by selected FC
      await filterCostCenterDropdown('#form_modal_add_transaction', fcId);

      // Small delay to allow DOM to settle (mobile browser optimization)
      await new Promise(resolve => setTimeout(resolve, 50));

      // Update fact hints ONLY if both FC and category selected
      const selectedCategory = state.transactionCategoryTreeSelect?.getSelectedCategory();
      if (fcId && selectedCategory) {
        loadFactHintsForCategory(selectedCategory);
      }
    });

    transactionFcSelect.dataset.listenerAttached = 'true';
  }

  const planFcSelect = document.querySelector('#form_modal_add_plan select[name="financial_center_id"]') as HTMLSelectElement | null;

  if (planFcSelect && !planFcSelect.dataset.listenerAttached) {
    planFcSelect.addEventListener('change', async (e) => {
      const fcId = planFcSelect.value ? parseInt(planFcSelect.value) : null;

      if (window.DEBUG_MODE) {
        debugLog('[FC_CHANGE] Financial center changed in plan modal:', {
          fcId: fcId,
          timestamp: new Date().toISOString(),
        });
      }

      e.stopPropagation();
      e.stopImmediatePropagation();

      const state = getState();

      // Filter categories by selected FC
      if (state.planCategoryTreeSelect) {
        await state.planCategoryTreeSelect.updateFinancialCenter(fcId);
      }

      // Filter cost centers by selected FC
      await filterCostCenterDropdown('#form_modal_add_plan', fcId);

      // Small delay to allow DOM to settle
      await new Promise(resolve => setTimeout(resolve, 50));

      // Update plan hints ONLY if both FC and category selected
      const selectedCategory = state.planCategoryTreeSelect?.getSelectedCategory();
      if (fcId && selectedCategory && typeof (window as any).loadPlanHints === 'function') {
        (window as any).loadPlanHints(selectedCategory);
      }
    });

    planFcSelect.dataset.listenerAttached = 'true';
  }
}

// ============================================================================
// Cost Center Loading
// ============================================================================

/**
 * Load cost centers (cost locations) for forms
 */
export async function loadCostCenters(): Promise<void> {
  try {
    // Get user ID for data layer queries
    const userId = await getCurrentUserId();

    // Use DataLayer (PGlite-first with API fallback)
    const centers: CostCenter[] = await dataLayer.getCostCenters(userId, null, true);

    // Save to state for filtering
    updateState({ allCostCenters: centers });

    if (centers.length === 0) {
      debugLog('No cost centers available - this is optional');
      return;
    }

    // Populate select in both forms
    const selects = [
      document.querySelector('#form_modal_add_transaction select[name="cost_center_id"]'),
      document.querySelector('#form_modal_add_plan select[name="cost_center_id"]'),
    ];

    selects.forEach(select => {
      if (!select) return;

      // Clear except first option ("-- Не выбрано --")
      while ((select as HTMLSelectElement).options.length > 1) {
        (select as HTMLSelectElement).remove(1);
      }

      // Add cost locations
      centers.forEach((cc: CostCenter) => {
        const option = document.createElement('option');
        option.value = String(cc.id);
        option.textContent = cc.name;
        select.appendChild(option);
      });
    });

  } catch (error) {
    console.error('Failed to load cost centers:', error);
    // Don't show error toast since cost center is optional
    debugLog('Cost centers error is non-critical');
  }
}

/**
 * Filter cost center dropdown by financial center ID.
 * Whitelist pattern: show cost centers without FC restrictions OR linked to this FC.
 */
export async function filterCostCenterDropdown(formSelector: string, financialCenterId: number | null): Promise<void> {
  const select = document.querySelector(`${formSelector} select[name="cost_center_id"]`) as HTMLSelectElement | null;
  if (!select) return;

  const currentValue = select.value;
  const state = getState();
  const allCostCenters = state.allCostCenters;

  // Clear all options except the first one ("-- Не выбрано --")
  while (select.options.length > 1) {
    select.remove(1);
  }

  if (!financialCenterId) {
    // No FC selected - show all cost centers
    allCostCenters.forEach(cc => {
      const option = document.createElement('option');
      option.value = String(cc.id);
      option.textContent = cc.name;
      select.appendChild(option);
    });
    // Restore previous selection if still available
    if (currentValue) select.value = currentValue;
    return;
  }

  // If offline - use cached data, don't make API request
  if (!navigator.onLine || (window.offlineManager && !window.offlineManager.isOnline)) {
    debugLog('[CostCenter] Offline mode - using cached data');
    allCostCenters.forEach(cc => {
      const option = document.createElement('option');
      option.value = String(cc.id);
      option.textContent = cc.name;
      select.appendChild(option);
    });
    if (currentValue) select.value = currentValue;
    return;
  }

  // Fetch filtered cost centers using DataLayer
  try {
    // Get user ID for data layer queries
    const userId = await getCurrentUserId();

    // Use DataLayer (PGlite-first with API fallback)
    const filteredCenters: CostCenter[] = await dataLayer.getCostCenters(userId, financialCenterId, true);

    filteredCenters.forEach(cc => {
      const option = document.createElement('option');
      option.value = String(cc.id);
      option.textContent = cc.name;
      select.appendChild(option);
    });

    // Restore previous selection if still available
    if (currentValue) {
      const exists = filteredCenters.some(cc => String(cc.id) === currentValue);
      if (exists) select.value = currentValue;
    }
  } catch (error) {
    // Don't log as error in offline mode - this is expected behavior
    if (!navigator.onLine || (window.offlineManager && !window.offlineManager.isOnline)) {
      if (window.DEBUG_MODE) {
        debugLog('[CostCenter] Network error in offline mode (expected):', (error as Error).message);
      }
    } else {
      console.warn('[CostCenter] Error filtering cost centers:', (error as Error).message);
    }
    // Fallback to showing all
    allCostCenters.forEach(cc => {
      const option = document.createElement('option');
      option.value = String(cc.id);
      option.textContent = cc.name;
      select.appendChild(option);
    });
  }
}

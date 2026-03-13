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
import { getCurrentUserId } from '@shared/utils/userHelpers';

/**
 * Safe wrapper for showToast (handles case when not loaded yet)
 */
function safeShowToast(message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number): void {
  if (typeof (window as any).showToast === 'function') {
    (window as any).showToast(message, type, duration);
  } else {
    console.warn(`[Toast] ${type.toUpperCase()}: ${message}`);
  }
}

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
    const selectElement = document.querySelector('#modal_fact-tab-transaction select[name="article_id"]');
    if (!selectElement) {
      debugLog('[loadTransactionCategories] Select element not found - skipping initialization');
      return;
    }

    // Get current transaction type
    const typeInput = document.querySelector('#modal_fact-tab-transaction input[name="record_type"]:checked') as HTMLInputElement | null;
    const transactionType = typeInput?.value || 'expense';

    const state = getState();

    if (state.transactionCategoryTreeSelect) {
      // Update existing instance (more efficient than destroy/recreate)
      await state.transactionCategoryTreeSelect.updateType(transactionType);
    } else if (window.BudgetShared?.ChoicesCategoryTree) {
      // Initialize CategoryTreeSelect for transaction form
      const newInstance = new window.BudgetShared.ChoicesCategoryTree(
        '#modal_fact-tab-transaction select[name="article_id"]',
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

    debugLog('[loadTransactionCategories] Transaction categories loaded');
  } catch (error) {
    console.error('Failed to load transaction categories:', error);
    safeShowToast('Ошибка при загрузке категорий транзакций', 'error');
  }
}

/**
 * Load fact hints for selected category (wrapper)
 */
function loadFactHintsForCategory(category: Category | null): void {
  // Try new modal_fact hints function first (v10.x+)
  if (typeof (window as any).loadFactTransactionHints === 'function') {
    (window as any).loadFactTransactionHints();
  }
  // Fallback to legacy modal hints (v9.x)
  else if (typeof (window as any).loadFactHints === 'function') {
    (window as any).loadFactHints(category);
  } else {
    debugLog('[loadFactHintsForCategory] loadFactHints not available yet');
  }
}

// ============================================================================
// Financial Center Loading
// ============================================================================

/**
 * Load financial centers (accounts) for transaction form
 * @param targetSelectors - Optional array of CSS selectors for financial center dropdowns
 */
export async function loadFinancialCenters(targetSelectors?: string[]): Promise<void> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 500; // Start with 500ms
  let centers: any[] = [];

  // RETRY LOOP
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.info(`[loadFinancialCenters] Attempt ${attempt}/${MAX_RETRIES}`);

      // Get user ID for data layer queries
      const userId = await getCurrentUserId();

      // Use DataLayer (Dexie-first with API fallback)
      centers = await dataLayer.getFinancialCenters(userId, true);

      if (centers.length === 0) {
        if (attempt < MAX_RETRIES) {
          console.warn(`[loadFinancialCenters] Empty result on attempt ${attempt}, retrying in ${RETRY_DELAY_MS * attempt}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt)); // Exponential backoff
          continue; // Retry
        } else {
          console.error('[loadFinancialCenters] No accounts returned after all retries');
          safeShowToast('Список счетов пуст. Создайте счет в справочнике.', 'warning');
          return; // EARLY EXIT - НЕ ЗАПОЛНЯЕМ СЕЛЕКТОРЫ
        }
      }

      // SUCCESS - exit retry loop
      console.info(`[loadFinancialCenters] ✅ Loaded ${centers.length} financial centers on attempt ${attempt}`);
      break;

    } catch (error) {
      console.error(`[loadFinancialCenters] Attempt ${attempt} failed:`, error);

      if (attempt < MAX_RETRIES) {
        const delayMs = RETRY_DELAY_MS * attempt;
        console.warn(`[loadFinancialCenters] Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.error('[loadFinancialCenters] All retry attempts exhausted');
        safeShowToast('Ошибка при загрузке счетов', 'error');
        throw error;
      }
    }
  }

  // POPULATE SELECTORS (вне цикла)
  const selectors = targetSelectors || [
    '#modal_fact-tab-transaction select[name="financial_center_id"]',
    '#modal_plan-tab-transaction select[name="financial_center_id"]',
  ];

  // Track populated count
  let populatedCount = 0;

  // Populate each select
  selectors.forEach(selector => {
    const select = document.querySelector(selector) as HTMLSelectElement | null;

    if (!select) {
      debugLog(`[loadFinancialCenters] Selector not found: ${selector}`);
      return;
    }

    // Clear except first option
    while (select.options.length > 1) {
      select.remove(1);
    }

    // Add accounts
    centers.forEach((fc: { id: number; name: string }) => {
      const option = document.createElement('option');
      option.value = String(fc.id);
      option.textContent = fc.name;
      select.appendChild(option);
    });

    populatedCount++;
    debugLog(`[loadFinancialCenters] Populated: ${selector} (${centers.length} accounts)`);
  });

  debugLog(`[loadFinancialCenters] Successfully populated ${populatedCount}/${selectors.length} selects`);

  // Add change listeners to filter categories AND cost centers when account changes
  setupFinancialCenterListeners();

  // Initial state: disable Category and Cost Location until account is selected
  enableDisableCategoryAndCostCenter(null);
}

/**
 * Set up change listeners for financial center selects
 */
function setupFinancialCenterListeners(): void {
  const transactionFcSelect = document.querySelector('#modal_fact-tab-transaction select[name="financial_center_id"]') as HTMLSelectElement | null;

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

      // Enable or disable Category and Cost Location based on account selection
      if (!fcId) {
        enableDisableCategoryAndCostCenter(null, 'fact');
      }

      const state = getState();

      // Filter categories by selected FC
      if (state.transactionCategoryTreeSelect) {
        await state.transactionCategoryTreeSelect.updateFinancialCenter(fcId);
      }

      // Filter cost centers by selected FC
      await filterCostCenterDropdown('#modal_fact-tab-transaction', fcId);

      // Enable Category and Cost Location after filtering when account is selected
      if (fcId) {
        enableDisableCategoryAndCostCenter(fcId, 'fact');
      }

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

  const planFcSelect = document.querySelector('#modal_plan-tab-transaction select[name="financial_center_id"]') as HTMLSelectElement | null;

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

      // Enable or disable Category and Cost Location based on account selection
      if (!fcId) {
        enableDisableCategoryAndCostCenter(null, 'plan');
      }

      const state = getState();

      // Filter categories by selected FC
      if (state.planCategoryTreeSelect) {
        await state.planCategoryTreeSelect.updateFinancialCenter(fcId);
      }

      // Filter cost centers by selected FC
      await filterCostCenterDropdown('#modal_plan-tab-transaction', fcId);

      // Enable Category and Cost Location after filtering when account is selected
      if (fcId) {
        enableDisableCategoryAndCostCenter(fcId, 'plan');
      }

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

    // Use DataLayer (Dexie-first with API fallback)
    const centers: CostCenter[] = await dataLayer.getCostCenters(userId, null, true);

    // Save to state for filtering
    updateState({ allCostCenters: centers });

    if (centers.length === 0) {
      debugLog('No cost centers available - this is optional');
      return;
    }

    // Populate select in both forms (new tab-based selectors)
    const selects = [
      document.querySelector('#modal_fact-tab-transaction select[name="cost_center_id"]'),
      document.querySelector('#modal_plan-tab-transaction select[name="cost_center_id"]'),
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
 * Enable or disable Category and Cost Location selects based on account selection.
 *
 * Category (article_id) is wrapped by ChoicesCategoryTree — must use widget's
 * .disable()/.enable() so Choices.js updates its visual state (is-disabled class).
 * Cost center (cost_center_id) is a plain select — native setAttribute works.
 *
 * @param fcId - selected financial center ID (null means no account selected)
 * @param modalType - 'fact' | 'plan' | null (null means apply to both)
 */
export function enableDisableCategoryAndCostCenter(fcId: number | null, modalType?: 'fact' | 'plan' | null): void {
  const isEnabled = fcId !== null && fcId !== undefined;
  const state = getState();

  // --- Category (ChoicesCategoryTree widget) ---
  if (!modalType || modalType === 'fact') {
    const tree = state.transactionCategoryTreeSelect;
    if (tree) {
      if (isEnabled) {
        tree.enable();
      } else {
        tree.clearSelection(); // clears Choices.js active items + element.value
        tree.disable();
      }
    } else {
      // Widget not yet initialised — fall back to native attribute
      const el = document.querySelector('#modal_fact-tab-transaction select[name="article_id"]') as HTMLSelectElement | null;
      if (el) {
        if (isEnabled) { el.removeAttribute('disabled'); } else { el.setAttribute('disabled', 'disabled'); el.value = ''; }
      }
    }
  }
  if (!modalType || modalType === 'plan') {
    const tree = state.planCategoryTreeSelect;
    if (tree) {
      if (isEnabled) {
        tree.enable();
      } else {
        tree.clearSelection();
        tree.disable();
      }
    } else {
      const el = document.querySelector('#modal_plan-tab-transaction select[name="article_id"]') as HTMLSelectElement | null;
      if (el) {
        if (isEnabled) { el.removeAttribute('disabled'); } else { el.setAttribute('disabled', 'disabled'); el.value = ''; }
      }
    }
  }

  // --- Cost center (plain select, no Choices.js wrapper) ---
  const costCenterSelectors: string[] = [];
  if (!modalType || modalType === 'fact') costCenterSelectors.push('#modal_fact-tab-transaction select[name="cost_center_id"]');
  if (!modalType || modalType === 'plan') costCenterSelectors.push('#modal_plan-tab-transaction select[name="cost_center_id"]');

  costCenterSelectors.forEach(selector => {
    const el = document.querySelector(selector) as HTMLSelectElement | null;
    if (!el) return;
    if (isEnabled) {
      el.removeAttribute('disabled');
    } else {
      el.setAttribute('disabled', 'disabled');
      el.value = '';
    }
  });
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

    // Use DataLayer (Dexie-first with API fallback)
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

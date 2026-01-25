/**
 * Modal Plan Module
 * Main entry point for plan modal with tabs
 *
 * @module modalPlan
 */

import { setupTabListeners, clearTabCache, switchTab } from './tabManager';
import { getState } from '../../core/DashboardState';
import './dateHelpers'; // Import for side effects (window exports)

declare const debugLog: (...args: any[]) => void;

/**
 * Check if dropdown caches are valid
 */
function isCacheValid(cache: any): boolean {
  if (!cache || !cache.timestamp) return false;
  const age = Date.now() - cache.timestamp;
  return age < (cache.ttl || 5 * 60 * 1000); // 5 min default TTL
}

/**
 * Show skeleton loader
 */
function showSkeleton(): void {
  const modalId = 'modal_plan';
  const skeleton = document.getElementById(`${modalId}-loading-skeleton`);
  const formFields = document.getElementById(`${modalId}-form-fields`);

  if (skeleton && formFields) {
    skeleton.classList.remove('hidden');
    formFields.classList.add('hidden');
  }
}

/**
 * Hide skeleton loader
 */
function hideSkeleton(): void {
  const modalId = 'modal_plan';
  const skeleton = document.getElementById(`${modalId}-loading-skeleton`);
  const formFields = document.getElementById(`${modalId}-form-fields`);

  if (skeleton && formFields) {
    skeleton.classList.add('hidden');
    formFields.classList.remove('hidden');
  }
}

/**
 * Load transaction tab data
 * Uses existing addPlan module functions (similar to transaction)
 */
async function loadTransactionTabData(): Promise<void> {
  const state = getState();

  // Check cache validity
  const needsRefresh =
    !isCacheValid(state.dropdownCache.categories) ||
    !isCacheValid(state.dropdownCache.financialCenters) ||
    !isCacheValid(state.dropdownCache.costCenters);

  if (needsRefresh) {
    debugLog('[ModalPlan] Loading transaction data...');

    // Import existing functions from addTransaction module (reuse)
    const { loadTransactionCategories, loadFinancialCenters, loadCostCenters } = await import(
      '../addTransaction/categoryLoader'
    );

    // Load dropdowns
    await Promise.all([
      loadTransactionCategories(),
      loadFinancialCenters(),
      loadCostCenters()
    ]);

    debugLog('[ModalPlan] Transaction data loaded');
  } else {
    debugLog('[ModalPlan] Using cached transaction data');
  }
}

/**
 * Load transfer tab data
 * Initializes CategoryTreeSelect for FROM/TO and loads financial centers
 */
async function loadTransferTabData(): Promise<void> {
  const state = getState();

  // Check if already initialized
  if (state.planTransferFromCategoryTree && state.planTransferToCategoryTree) {
    debugLog('[ModalPlan] Transfer data already initialized');
    return;
  }

  debugLog('[ModalPlan] Loading transfer data...');

  try {
    // 1. Load financial centers (reuse from addTransaction)
    const { loadFinancialCenters } = await import('../addTransaction/categoryLoader');
    await loadFinancialCenters();

    // 2. Populate FROM/TO financial center dropdowns
    const userId = await (await import('../../../offline/offlineManager/utils/userHelpers')).getCurrentUserId();
    const { dataLayer } = await import('../../../data/DataLayer');
    const centers = await dataLayer.getFinancialCenters(userId, true);

    // Populate FROM select
    const fromFcSelect = document.querySelector('#modal_plan-tab-transfer select[name="from_financial_center_id"]') as HTMLSelectElement;
    if (fromFcSelect) {
      while (fromFcSelect.options.length > 1) {
        fromFcSelect.remove(1);
      }
      centers.forEach((fc: { id: number; name: string }) => {
        const option = document.createElement('option');
        option.value = String(fc.id);
        option.textContent = fc.name;
        fromFcSelect.appendChild(option);
      });
    }

    // Populate TO select
    const toFcSelect = document.querySelector('#modal_plan-tab-transfer select[name="to_financial_center_id"]') as HTMLSelectElement;
    if (toFcSelect) {
      while (toFcSelect.options.length > 1) {
        toFcSelect.remove(1);
      }
      centers.forEach((fc: { id: number; name: string }) => {
        const option = document.createElement('option');
        option.value = String(fc.id);
        option.textContent = fc.name;
        toFcSelect.appendChild(option);
      });
    }

    // 3. Initialize ChoicesCategoryTree for FROM (debit/expense)
    if ((window as any).BudgetShared?.ChoicesCategoryTree) {
      const fromCategoryTree = new (window as any).BudgetShared.ChoicesCategoryTree(
        '#modal_plan-tab-transfer select[name="from_article_id"]',
        {
          type: 'expense', // FROM is always expense (debit)
          showLeafOnly: true,
          mode: 'create',
          onCategoryChange: (category: any) => {
            debugLog('[ModalPlan Transfer] FROM category changed:', category);
            // TODO: Load transfer plan hints
          }
        }
      );

      // 4. Initialize ChoicesCategoryTree for TO (credit/income)
      const toCategoryTree = new (window as any).BudgetShared.ChoicesCategoryTree(
        '#modal_plan-tab-transfer select[name="to_article_id"]',
        {
          type: 'income', // TO is always income (credit)
          showLeafOnly: true,
          mode: 'create',
          onCategoryChange: (category: any) => {
            debugLog('[ModalPlan Transfer] TO category changed:', category);
            // TODO: Load transfer plan hints
          }
        }
      );

      // 5. Save instances to state
      const { updateState } = await import('../../core/DashboardState');
      updateState({
        planTransferFromCategoryTree: fromCategoryTree,
        planTransferToCategoryTree: toCategoryTree
      });

      debugLog('[ModalPlan] Transfer CategoryTreeSelect instances created');
    } else {
      console.warn('[ModalPlan] BudgetShared.ChoicesCategoryTree not available');
    }

    debugLog('[ModalPlan] Transfer data loaded');
  } catch (error) {
    console.error('[ModalPlan] Error loading transfer data:', error);
  }
}

/**
 * Open modal plan
 * Always opens with transaction tab active (default)
 */
export async function openModalPlan(): Promise<void> {
  const modalId = 'modal_plan';
  const modal = document.getElementById(modalId) as HTMLDialogElement;

  if (!modal) {
    console.error('[ModalPlan] Modal not found');
    return;
  }

  // Open modal immediately
  modal.showModal();

  // Show skeleton while loading
  showSkeleton();

  // Setup tab listeners (only once)
  setupTabListeners();

  try {
    // Load data for both tabs in parallel
    await Promise.all([
      loadTransactionTabData(),
      loadTransferTabData()
    ]);

    // Hide skeleton
    hideSkeleton();

    // Reset to transaction tab (default)
    switchTab('transaction');

  } catch (error) {
    console.error('[ModalPlan] Error loading data:', error);
    hideSkeleton();
  }
}

/**
 * Close modal plan and clear cache
 */
export function closeModalPlan(): void {
  const modal = document.getElementById('modal_plan') as HTMLDialogElement;
  modal?.close();

  // Clear form
  const form = document.getElementById('form_modal_plan') as HTMLFormElement;
  form?.reset();

  // Clear tab cache
  clearTabCache();
}

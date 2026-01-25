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

  // Hints are already integrated in loadTransactionCategories callback (from addTransaction module)
  // The existing transactionCategoryTreeSelect/planCategoryTreeSelect handles it
  // No additional setup needed
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
            loadPlanTransferHints('from');
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
            loadPlanTransferHints('to');
          }
        }
      );

      // 5. Save instances to state
      const { updateState } = await import('../../core/DashboardState');
      updateState({
        planTransferFromCategoryTree: fromCategoryTree,
        planTransferToCategoryTree: toCategoryTree
      });

      // 6. Setup FC change listeners for transfer hints
      setupTransferFCListeners();

      debugLog('[ModalPlan] Transfer CategoryTreeSelect instances created');
    } else {
      debugLog('[ModalPlan] BudgetShared.ChoicesCategoryTree not available');
    }

    debugLog('[ModalPlan] Transfer data loaded');
  } catch (error) {
    debugLog('[ModalPlan] Error loading transfer data:', error);
  }
}

/**
 * Setup FC change listeners for transfer tab hints
 */
function setupTransferFCListeners(): void {
  const fromFcSelect = document.querySelector('#modal_plan-tab-transfer select[name="from_financial_center_id"]') as HTMLSelectElement;
  const toFcSelect = document.querySelector('#modal_plan-tab-transfer select[name="to_financial_center_id"]') as HTMLSelectElement;

  if (fromFcSelect && !fromFcSelect.dataset.listenerAttached) {
    fromFcSelect.addEventListener('change', () => {
      loadPlanTransferHints('from');
    });
    fromFcSelect.dataset.listenerAttached = 'true';
  }

  if (toFcSelect && !toFcSelect.dataset.listenerAttached) {
    toFcSelect.addEventListener('change', () => {
      loadPlanTransferHints('to');
    });
    toFcSelect.dataset.listenerAttached = 'true';
  }
}

/**
 * Load plan transfer hints for FROM or TO direction
 */
async function loadPlanTransferHints(direction: 'from' | 'to'): Promise<void> {
  const state = getState();
  const tree = direction === 'from' ? state.planTransferFromCategoryTree : state.planTransferToCategoryTree;
  const fcSelect = document.querySelector<HTMLSelectElement>(
    direction === 'from'
      ? '#modal_plan-tab-transfer select[name="from_financial_center_id"]'
      : '#modal_plan-tab-transfer select[name="to_financial_center_id"]'
  );

  const categoryId = tree?.getSelectedCategory()?.id;
  const fcId = fcSelect?.value ? parseInt(fcSelect.value) : null;

  // Update hint buttons to loading or empty state
  updateTransferPlanHintButtons(direction, !categoryId || !fcId ? null : { loading: true });

  if (!categoryId || !fcId) {
    return;
  }

  // Fetch hints from API
  try {
    const periodInput = document.querySelector<HTMLInputElement>('#modal_plan-tab-transfer input[name="transfer_period"]');
    let period = periodInput?.value || '';

    // Convert YYYY-MM format or use current period
    if (!period || period.length < 7) {
      const today = new Date();
      period = formatPeriodYYYYMM(today);
    }

    const articleType = direction === 'from' ? 'expense' : 'income';
    const url = `/api/v1/hints/plan-hints?period=${period}&article_id=${categoryId}&article_type=${articleType}&financial_center_id=${fcId}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    updateTransferPlanHintButtons(direction, data);

    debugLog('[ModalPlan] Transfer hints loaded for', direction, data);
  } catch (error) {
    debugLog('[ModalPlan] Error loading transfer hints:', error);
    updateTransferPlanHintButtons(direction, null);
  }
}

/**
 * Update transfer plan hint buttons
 */
function updateTransferPlanHintButtons(direction: 'from' | 'to', data: any | null): void {
  const planBtn = document.getElementById(
    direction === 'from' ? 'from-hint-prev-plan' : 'to-hint-prev-plan'
  );
  const factBtn = document.getElementById(
    direction === 'from' ? 'from-hint-prev-fact' : 'to-hint-prev-fact'
  );

  if (!planBtn || !factBtn) {
    debugLog('[ModalPlan] Hint buttons not found for', direction);
    return;
  }

  if (data?.loading) {
    planBtn.innerHTML = `<span class="loading loading-spinner loading-xs"></span>`;
    factBtn.innerHTML = `<span class="loading loading-spinner loading-xs"></span>`;
    planBtn.classList.add('btn-disabled');
    factBtn.classList.add('btn-disabled');
    return;
  }

  if (!data) {
    planBtn.textContent = 'План пред.мес: --';
    factBtn.textContent = 'Факт пред.мес: --';
    planBtn.classList.add('btn-disabled');
    factBtn.classList.add('btn-disabled');
    return;
  }

  // Display values with click handlers (clickable for plan hints)
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);

  planBtn.textContent = `План пред.мес: ${formatCurrency(data.prev_period_plan_sum || 0)}`;
  factBtn.textContent = `Факт пред.мес: ${formatCurrency(data.prev_period_fact_sum || 0)}`;
  planBtn.classList.remove('btn-disabled');
  factBtn.classList.remove('btn-disabled');
  planBtn.classList.add('btn-ghost', 'text-info');
  factBtn.classList.add('btn-ghost', 'text-success');

  // Add click handlers to populate amount field
  const amountInput = document.querySelector<HTMLInputElement>('#modal_plan-tab-transfer input[name="amount"]');

  if (amountInput) {
    planBtn.onclick = () => {
      amountInput.value = String(data.prev_period_plan_sum || 0);
      amountInput.focus();
    };

    factBtn.onclick = () => {
      amountInput.value = String(data.prev_period_fact_sum || 0);
      amountInput.focus();
    };
  }
}

/**
 * Format date as YYYY-MM for plan API
 */
function formatPeriodYYYYMM(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Open modal plan
 * Always opens with transaction tab active (default)
 */
export async function openModalPlan(): Promise<void> {
  const modalId = 'modal_plan';
  const modal = document.getElementById(modalId) as HTMLDialogElement;

  if (!modal) {
    debugLog('[ModalPlan] Modal not found');
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
    debugLog('[ModalPlan] Error loading data:', error);
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

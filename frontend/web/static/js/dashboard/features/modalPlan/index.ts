/**
 * Modal Plan Module
 * Main entry point for plan modal with tabs
 *
 * @module modalPlan
 */

import { setupTabListeners, clearTabCache, switchTab } from './tabManager';
import { getState, updateState } from '../../core/DashboardState';
import './dateHelpers'; // Import for side effects (window exports)
import { setupRecurringListeners, togglePlanMode } from './recurringSettings';
import { setupPlanTypeToggle } from './typeToggle';
import { setupPlanPeriodButtons } from '../addPlan/periodButtons'; // v10.1.51: Period buttons setup
import { setupModalKeyboardShortcuts } from '../../shared/utils/keyboardShortcuts';
import type { Category } from '../../types/dashboard';

declare const debugLog: (...args: any[]) => void;

/**
 * Keyboard shortcuts cleanup function
 * Stored to remove listeners when modal closes
 */
let keyboardShortcutsCleanup: (() => void) | null = null;

/**
 * Cache entry with timestamp and TTL
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl?: number;
}

/**
 * Transfer hints data structure (for plan - uses previous period)
 */
interface TransferHintsData {
  loading?: boolean;
  prev_period_plan_sum?: number;
  prev_period_fact_sum?: number;
}

/**
 * Check if dropdown caches are valid
 */
function isCacheValid<T>(cache: CacheEntry<T> | null): boolean {
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
    const { loadFinancialCenters, loadCostCenters } = await import(
      '../addTransaction/categoryLoader'
    );

    // Load financial centers FIRST (now with built-in retry logic)
    await loadFinancialCenters([
      '#modal_plan-tab-transaction select[name="financial_center_id"]'
    ]);

    // Validation removed - retry logic in loadFinancialCenters handles failures

    // Load cost centers
    await loadCostCenters();

    debugLog('[ModalPlan] Transaction data loaded');
  } else {
    debugLog('[ModalPlan] Using cached transaction data');
  }

  // Initialize CategoryTreeSelect for modal_plan transaction tab
  if (!state.planCategoryTreeSelect) {
    // CRITICAL FIX: Verify DOM element exists BEFORE creating ChoicesCategoryTree
    const articleSelect = document.querySelector('#modal_plan-tab-transaction select[name="article_id"]') as HTMLSelectElement | null;

    if (!articleSelect) {
      debugLog('[ModalPlan] Article select not found - DOM not ready yet');
      throw new Error('Article select element not available');
    }

    // Get current plan type (expense/income)
    const typeInput = document.querySelector('#modal_plan-tab-transaction input[name="plan_type"]:checked') as HTMLInputElement | null;
    const planType = typeInput?.value || 'expense';

    if ((window as any).BudgetShared?.ChoicesCategoryTree) {
      const planCategoryTree = new (window as any).BudgetShared.ChoicesCategoryTree(
        '#modal_plan-tab-transaction select[name="article_id"]',
        {
          type: planType,
          showLeafOnly: true,
          mode: 'create',
          onCategoryChange: (category: Category) => {
            debugLog('[ModalPlan] Category changed:', category);
            // Load plan hints if window function available
            if (typeof (window as any).loadPlanHints === 'function') {
              (window as any).loadPlanHints(category);
            }
          }
        }
      );

      // Save instance to state
      updateState({
        planCategoryTreeSelect: planCategoryTree
      });

      debugLog('[ModalPlan] CategoryTreeSelect instance created');
    } else {
      debugLog('[ModalPlan] BudgetShared.ChoicesCategoryTree not available');
      throw new Error('BudgetShared.ChoicesCategoryTree not loaded');
    }
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
    // 1. Load financial centers using centralized function
    const { loadFinancialCenters } = await import('../addTransaction/categoryLoader');
    await loadFinancialCenters([
      '#modal_plan-tab-transfer select[name="from_financial_center_id"]',
      '#modal_plan-tab-transfer select[name="to_financial_center_id"]'
    ]);

    // 2. Initialize ChoicesCategoryTree for FROM (debit - списание)
    if ((window as any).BudgetShared?.ChoicesCategoryTree) {
      const fromCategoryTree = new (window as any).BudgetShared.ChoicesCategoryTree(
        '#modal_plan-tab-transfer select[name="from_article_id"]',
        {
          type: 'debit', // FROM is debit (списание с счёта)
          showLeafOnly: true,
          mode: 'create',
          onCategoryChange: (category: Category) => {
            debugLog('[ModalPlan Transfer] FROM category changed:', category);
            loadPlanTransferHints('from');
          }
        }
      );

      // 3. Initialize ChoicesCategoryTree for TO (credit - пополнение)
      const toCategoryTree = new (window as any).BudgetShared.ChoicesCategoryTree(
        '#modal_plan-tab-transfer select[name="to_article_id"]',
        {
          type: 'credit', // TO is credit (пополнение счёта)
          showLeafOnly: true,
          mode: 'create',
          onCategoryChange: (category: Category) => {
            debugLog('[ModalPlan Transfer] TO category changed:', category);
            loadPlanTransferHints('to');
          }
        }
      );

      // 4. Save instances to state
      const { updateState } = await import('../../core/DashboardState');
      updateState({
        planTransferFromCategoryTree: fromCategoryTree,
        planTransferToCategoryTree: toCategoryTree
      });

      // 5. Setup FC change listeners for transfer hints
      setupTransferFCListeners();

      debugLog('[ModalPlan] Transfer CategoryTreeSelect instances created');
    } else {
      debugLog('[ModalPlan] BudgetShared.ChoicesCategoryTree not available');
    }

    // Update transfer period buttons text with month and year
    const { updateTransferPeriodButtonsText } = await import('./dateHelpers');
    updateTransferPeriodButtonsText();

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
    const url = `/api/v1/analytics/plan-hints?period=${period}&article_id=${categoryId}&article_type=${articleType}&financial_center_id=${fcId}`;

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
function updateTransferPlanHintButtons(direction: 'from' | 'to', data: TransferHintsData | null): void {
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
    // Create loading spinner elements (DOM manipulation for CSP compliance)
    const planSpinner = document.createElement('span');
    planSpinner.className = 'loading loading-spinner loading-xs';
    const factSpinner = document.createElement('span');
    factSpinner.className = 'loading loading-spinner loading-xs';

    planBtn.replaceChildren(planSpinner);
    factBtn.replaceChildren(factSpinner);
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
 * Setup save button click listener as fallback
 * Ensures save button works even if onclick attribute fails
 */
function setupSaveButtonListener(): void {
  const saveButton = document.querySelector('#modal_plan button[onclick*="savePlanModal"]') as HTMLButtonElement;

  if (saveButton && !saveButton.dataset.listenerAttached) {
    saveButton.addEventListener('click', async function(event) {
      event.preventDefault();
      event.stopPropagation();

      // Call the global savePlanModal function
      if (typeof (window as any).savePlanModal === 'function') {
        (window as any).savePlanModal(this);
      } else {
        debugLog('[ModalPlan] savePlanModal not found on window');
      }
    });

    saveButton.dataset.listenerAttached = 'true';
    debugLog('[ModalPlan] Save button listener attached');
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
    debugLog('[ModalPlan] Modal not found');
    return;
  }

  // Prevent duplicate initialization if modal already open (v10.1.51)
  if (modal.open) {
    debugLog('[ModalPlan] Modal already open, skipping re-initialization');
    return;
  }

  // Open modal immediately
  modal.showModal();

  // CRITICAL: Wait for DOM to render before loading data
  // Without this, querySelector in loadTransactionTabData() won't find selectors
  // Double requestAnimationFrame ensures browser completes render
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

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

    // Setup recurring settings listeners
    setupRecurringListeners('modal_plan');

    // Setup plan type toggle listeners
    setupPlanTypeToggle();

    // CRITICAL FIX: Hide skeleton BEFORE period buttons setup
    hideSkeleton();

    // Setup period buttons AFTER skeleton hidden
    setupPlanPeriodButtons();

    // Reset to transaction tab (default)
    switchTab('transaction');

    // Auto-fill current month in both tabs
    // Use window functions (already exported by dateHelpers module)
    if (typeof (window as any).setPlanPeriod === 'function') {
      (window as any).setPlanPeriod(0); // Transaction tab: 0 = current month
    }
    if (typeof (window as any).setPlanTransferPeriod === 'function') {
      (window as any).setPlanTransferPeriod(0); // Transfer tab: 0 = current month
    }

    // Setup save button click handler (fallback if onclick doesn't work)
    setupSaveButtonListener();

    // UX: Setup keyboard shortcuts (Escape to close, Ctrl+Enter to save)
    keyboardShortcutsCleanup = setupModalKeyboardShortcuts(
      'modal_plan',
      () => {
        // Save callback: trigger save button click
        const saveButton = document.querySelector('#modal_plan button[onclick*="savePlanModal"]') as HTMLButtonElement;
        if (saveButton && !saveButton.disabled) {
          saveButton.click();
        }
      },
      () => {
        // Close callback
        closeModalPlan();
      }
    );

  } catch (error) {
    debugLog('[ModalPlan] Critical error loading data:', error);

    // CRITICAL FIX: Always hide skeleton to prevent form lock
    hideSkeleton();

    // CRITICAL FIX: Show user-facing error toast
    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast('Ошибка загрузки формы плана. Попробуйте обновить страницу.', 'error');
    }

    // CRITICAL FIX: Close modal to prevent broken state
    const modal = document.getElementById('modal_plan') as HTMLDialogElement;
    modal?.close();

    // Re-throw to allow caller to handle
    throw error;
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

  // Reset plan mode sections visibility (form.reset() restores radio to "regular"
  // but does not affect CSS classes on the panel sections)
  if (form) {
    togglePlanMode('modal_plan');
  }

  // Clear tab cache
  clearTabCache();

  // UX: Cleanup keyboard shortcuts
  if (keyboardShortcutsCleanup) {
    keyboardShortcutsCleanup();
    keyboardShortcutsCleanup = null;
  }
}

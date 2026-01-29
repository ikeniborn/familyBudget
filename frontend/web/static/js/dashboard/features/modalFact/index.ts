/**
 * Modal Fact Module
 * Main entry point for fact modal with tabs
 *
 * @module modalFact
 */

import { setupTabListeners, clearTabCache, switchTab } from './tabManager';
import { getState } from '../../core/DashboardState';
import './dateHelpers'; // Import for side effects (window exports)
import { setupTransactionTypeToggle } from './typeToggle';
import type { Category } from '../../types/dashboard';

declare const debugLog: (...args: any[]) => void;

/**
 * Cache entry with timestamp and TTL
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl?: number;
}

/**
 * Transfer hints data structure
 */
interface TransferHintsData {
  loading?: boolean;
  period_plan_sum?: number;
  period_fact_sum?: number;
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
  const modalId = 'modal_fact';
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
  const modalId = 'modal_fact';
  const skeleton = document.getElementById(`${modalId}-loading-skeleton`);
  const formFields = document.getElementById(`${modalId}-form-fields`);

  if (skeleton && formFields) {
    skeleton.classList.add('hidden');
    formFields.classList.remove('hidden');
  }
}

/**
 * Load transaction tab data
 * Uses existing addTransaction module functions
 */
async function loadTransactionTabData(): Promise<void> {
  const state = getState();

  // Check cache validity
  const needsRefresh =
    !isCacheValid(state.dropdownCache.categories) ||
    !isCacheValid(state.dropdownCache.financialCenters) ||
    !isCacheValid(state.dropdownCache.costCenters);

  if (needsRefresh) {
    debugLog('[ModalFact] Loading transaction data...');

    // Import existing functions from addTransaction module
    const { loadTransactionCategories, loadFinancialCenters, loadCostCenters } = await import(
      '../addTransaction/categoryLoader'
    );

    // Load financial centers FIRST (now with built-in retry logic)
    await loadFinancialCenters();

    // Validation removed - retry logic in loadFinancialCenters handles failures

    // Load categories and cost centers in parallel (safe - independent operations)
    await Promise.all([
      loadTransactionCategories(),
      loadCostCenters()
    ]);

    debugLog('[ModalFact] Transaction data loaded');
  } else {
    debugLog('[ModalFact] Using cached transaction data');
  }

  // Hints are already integrated in loadTransactionCategories callback
  // No additional setup needed
}

/**
 * Load transfer tab data
 * Initializes CategoryTreeSelect for FROM/TO and loads financial centers
 */
async function loadTransferTabData(): Promise<void> {
  const state = getState();

  // Check if already initialized
  if (state.factTransferFromCategoryTree && state.factTransferToCategoryTree) {
    debugLog('[ModalFact] Transfer data already initialized');
    return;
  }

  debugLog('[ModalFact] Loading transfer data...');

  try {
    // 1. Load financial centers using centralized function
    const { loadFinancialCenters } = await import('../addTransaction/categoryLoader');
    await loadFinancialCenters([
      '#modal_fact-tab-transfer select[name="from_financial_center_id"]',
      '#modal_fact-tab-transfer select[name="to_financial_center_id"]'
    ]);

    // 2. Initialize ChoicesCategoryTree for FROM (debit/expense)
    if ((window as any).BudgetShared?.ChoicesCategoryTree) {
      const fromCategoryTree = new (window as any).BudgetShared.ChoicesCategoryTree(
        '#modal_fact-tab-transfer select[name="from_article_id"]',
        {
          type: 'expense', // FROM is always expense (debit)
          showLeafOnly: true,
          mode: 'create',
          onCategoryChange: (category: Category) => {
            debugLog('[ModalFact Transfer] FROM category changed:', category);
            loadFactTransferHints('from');
          }
        }
      );

      // 3. Initialize ChoicesCategoryTree for TO (credit/income)
      const toCategoryTree = new (window as any).BudgetShared.ChoicesCategoryTree(
        '#modal_fact-tab-transfer select[name="to_article_id"]',
        {
          type: 'income', // TO is always income (credit)
          showLeafOnly: true,
          mode: 'create',
          onCategoryChange: (category: Category) => {
            debugLog('[ModalFact Transfer] TO category changed:', category);
            loadFactTransferHints('to');
          }
        }
      );

      // 4. Save instances to state
      const { updateState } = await import('../../core/DashboardState');
      updateState({
        factTransferFromCategoryTree: fromCategoryTree,
        factTransferToCategoryTree: toCategoryTree
      });

      // 5. Setup FC change listeners for transfer hints
      setupTransferFCListeners();

      debugLog('[ModalFact] Transfer CategoryTreeSelect instances created');
    } else {
      debugLog('[ModalFact] BudgetShared.ChoicesCategoryTree not available');
    }

    debugLog('[ModalFact] Transfer data loaded');
  } catch (error) {
    debugLog('[ModalFact] Error loading transfer data:', error);
  }
}

/**
 * Setup FC change listeners for transfer tab hints
 */
function setupTransferFCListeners(): void {
  const fromFcSelect = document.querySelector('#modal_fact-tab-transfer select[name="from_financial_center_id"]') as HTMLSelectElement;
  const toFcSelect = document.querySelector('#modal_fact-tab-transfer select[name="to_financial_center_id"]') as HTMLSelectElement;

  if (fromFcSelect && !fromFcSelect.dataset.listenerAttached) {
    fromFcSelect.addEventListener('change', () => {
      loadFactTransferHints('from');
    });
    fromFcSelect.dataset.listenerAttached = 'true';
  }

  if (toFcSelect && !toFcSelect.dataset.listenerAttached) {
    toFcSelect.addEventListener('change', () => {
      loadFactTransferHints('to');
    });
    toFcSelect.dataset.listenerAttached = 'true';
  }
}

/**
 * Load fact transfer hints for FROM or TO direction
 */
async function loadFactTransferHints(direction: 'from' | 'to'): Promise<void> {
  const state = getState();
  const tree = direction === 'from' ? state.factTransferFromCategoryTree : state.factTransferToCategoryTree;
  const fcSelect = document.querySelector<HTMLSelectElement>(
    direction === 'from'
      ? '#modal_fact-tab-transfer select[name="from_financial_center_id"]'
      : '#modal_fact-tab-transfer select[name="to_financial_center_id"]'
  );

  const categoryId = tree?.getSelectedCategory()?.id;
  const fcId = fcSelect?.value ? parseInt(fcSelect.value) : null;

  // Update hint buttons to loading or empty state
  updateTransferFactHintButtons(direction, !categoryId || !fcId ? null : { loading: true });

  if (!categoryId || !fcId) {
    return;
  }

  // Fetch hints from API
  try {
    const dateInput = document.querySelector<HTMLInputElement>('#modal_fact-tab-transfer input[name="transfer_date"]');
    let factDate = dateInput?.value || '';

    // Convert DD.MM.YYYY to YYYY-MM-DD
    if (factDate) {
      const parts = factDate.split('.');
      if (parts.length === 3) {
        factDate = `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
      }
    } else {
      // Use today's date if not set
      const today = new Date();
      factDate = formatDateYYYYMMDD(today);
    }

    const articleType = direction === 'from' ? 'expense' : 'income';
    const url = `/api/v1/hints/fact-hints?fact_date=${factDate}&article_id=${categoryId}&article_type=${articleType}&financial_center_id=${fcId}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    updateTransferFactHintButtons(direction, data);

    debugLog('[ModalFact] Transfer hints loaded for', direction, data);
  } catch (error) {
    debugLog('[ModalFact] Error loading transfer hints:', error);
    updateTransferFactHintButtons(direction, null);
  }
}

/**
 * Update transfer fact hint buttons
 */
function updateTransferFactHintButtons(direction: 'from' | 'to', data: TransferHintsData | null): void {
  const planBtn = document.getElementById(
    direction === 'from' ? 'from-hint-period-plan' : 'to-hint-period-plan'
  );
  const factBtn = document.getElementById(
    direction === 'from' ? 'from-hint-period-fact' : 'to-hint-period-fact'
  );

  if (!planBtn || !factBtn) {
    debugLog('[ModalFact] Hint buttons not found for', direction);
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
    planBtn.textContent = 'План мес: --';
    factBtn.textContent = 'Факт мес: --';
    planBtn.classList.add('btn-disabled');
    factBtn.classList.add('btn-disabled');
    return;
  }

  // Display values (display-only, not clickable for fact hints)
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);

  planBtn.textContent = `План мес: ${formatCurrency(data.period_plan_sum || 0)}`;
  factBtn.textContent = `Факт мес: ${formatCurrency(data.period_fact_sum || 0)}`;
  planBtn.classList.remove('btn-disabled');
  factBtn.classList.remove('btn-disabled');
  planBtn.classList.add('btn-ghost', 'text-info');
  factBtn.classList.add('btn-ghost', 'text-success');
}

/**
 * Format date as YYYY-MM-DD for API
 */
function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Setup save button click listener as fallback
 * Ensures save button works even if onclick attribute fails
 */
function setupSaveButtonListener(): void {
  const saveButton = document.querySelector('#modal_fact button[onclick*="saveFactModal"]') as HTMLButtonElement;

  if (saveButton && !saveButton.dataset.listenerAttached) {
    saveButton.addEventListener('click', async function(event) {
      event.preventDefault();
      event.stopPropagation();

      // Call the global saveFactModal function
      if (typeof (window as any).saveFactModal === 'function') {
        (window as any).saveFactModal(this);
      } else {
        debugLog('[ModalFact] saveFactModal not found on window');
      }
    });

    saveButton.dataset.listenerAttached = 'true';
    debugLog('[ModalFact] Save button listener attached');
  }
}

/**
 * Open modal fact
 * Always opens with transaction tab active (default)
 */
export async function openModalFact(): Promise<void> {
  const modalId = 'modal_fact';
  const modal = document.getElementById(modalId) as HTMLDialogElement;

  if (!modal) {
    console.error('[ModalFact] Modal not found');
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

    // Setup transaction type toggle listeners
    setupTransactionTypeToggle();

    // Reset to transaction tab (default)
    switchTab('transaction');

    // Auto-fill today's date in both tabs
    const { setFactDate, setFactTransferDate } = await import('./dateHelpers');
    setFactDate(0); // Transaction tab: 0 = today
    setFactTransferDate(0); // Transfer tab: 0 = today

    // Setup save button click handler (fallback if onclick doesn't work)
    setupSaveButtonListener();

  } catch (error) {
    console.error('[ModalFact] Error loading data:', error);
    hideSkeleton();
  }
}

/**
 * Close modal fact and clear cache
 */
export function closeModalFact(): void {
  const modal = document.getElementById('modal_fact') as HTMLDialogElement;
  modal?.close();

  // Clear form
  const form = document.getElementById('form_modal_fact') as HTMLFormElement;
  form?.reset();

  // Clear tab cache
  clearTabCache();
}

/**
 * Fact Hints for Transaction Form
 *
 * Loads and displays hints (previous period plan/fact amounts) for selected category.
 */

import { getState, updateState } from '../../core/DashboardState';
import type { Category, FactHintsData } from '../../types/dashboard.d';



declare const debugLog: (...args: any[]) => void;
// ============================================================================
// Fact Hints Loading
// ============================================================================

/**
 * Load fact hints (current period plan/fact amounts) for the selected category.
 * Displays hints in modal_add_transaction buttons (hint-period-plan, hint-period-fact).
 * @deprecated Legacy function for modal_add_transaction (removed in v11.x)
 * Use loadFactTransactionHints() from modalFact/index.ts for new modals
 */
export async function loadFactHints(category: Category | null = null): Promise<void> {
  if (window.DEBUG_MODE) {
    debugLog('[FACT_HINTS] loadFactHints() called:', {
      category: category?.id ?? null,
      categoryName: category?.name ?? null,
    });
  }

  const state = getState();

  // 1. Clear debounce timeout
  if (state.factHintsTimeout) {
    clearTimeout(state.factHintsTimeout);
  }
  if (state.factHintsController) {
    state.factHintsController.abort();
  }

  const planBtn = document.getElementById('hint-period-plan');
  const factBtn = document.getElementById('hint-period-fact');
  if (!planBtn || !factBtn) return;

  // Check if BOTH account AND category are selected
  const fcSelect = document.querySelector('#form_modal_add_transaction select[name="financial_center_id"]') as HTMLSelectElement | null;
  const financialCenterId = fcSelect?.value ?? null;
  const articleId = category?.id;

  if (window.DEBUG_MODE) {
    debugLog('[FACT_HINTS] Validation check:', {
      fcId: financialCenterId,
      articleId: articleId,
      bothSelected: !!(financialCenterId && articleId),
    });
  }

  if (!financialCenterId || !articleId) {
    debugLog('[FACT_HINTS] ⚠️ SKIPPED: Missing required fields', {
        fcSelected: !!financialCenterId,
        categorySelected: !!articleId,
      });
    planBtn.innerHTML = 'План мес: --';
    (planBtn as HTMLButtonElement).disabled = true;
    planBtn.className = 'btn btn-xs btn-ghost btn-disabled';
    factBtn.innerHTML = 'Факт мес: --';
    (factBtn as HTMLButtonElement).disabled = true;
    factBtn.className = 'btn btn-xs btn-ghost btn-disabled';
    return;
  }

  debugLog('[FACT_HINTS] ✅ Validation PASSED');

  // 2. Show loading state
  planBtn.innerHTML = '<span class="loading loading-spinner loading-xs"></span>';
  factBtn.innerHTML = '<span class="loading loading-spinner loading-xs"></span>';

  // Create new abort controller
  const controller = new AbortController();
  updateState({
    factHintsController: controller,
  });

  // 3. Debounce 300ms
  const timeout = setTimeout(async () => {
    if (!navigator.onLine) {
      planBtn.innerHTML = 'План мес: --';
      factBtn.innerHTML = 'Факт мес: --';
      return;
    }

    try {
      // Get form values
      const dateInput = document.querySelector('#form_modal_add_transaction input[name="fact_date"]') as HTMLInputElement | null;
      const factDate = window.BudgetShared?.DateFormatter.formatForAPI(dateInput?.value || window.BudgetShared?.DateFormatter.today() || '') || window.BudgetShared?.DateFormatter.today() || '';
      const typeInput = document.querySelector('#form_modal_add_transaction input[name="record_type"]:checked') as HTMLInputElement | null;
      const articleType = typeInput?.value || 'expense';
      const fcSelectEl = document.querySelector('#form_modal_add_transaction select[name="financial_center_id"]') as HTMLSelectElement | null;

      const params = new URLSearchParams({ fact_date: factDate, article_type: articleType });
      params.append('article_id', String(articleId));
      if (fcSelectEl?.value) params.append('financial_center_id', fcSelectEl.value);

      const response = await fetch(`/api/v1/analytics/fact-hints?${params}`, {
        signal: controller.signal,
        credentials: 'include',
      });

      if (response.ok) {
        updateFactHintButtons(await response.json());
      } else {
        planBtn.innerHTML = 'План мес: --';
        factBtn.innerHTML = 'Факт мес: --';
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        console.error('[loadFactHints]', e);
      }
      planBtn.innerHTML = 'План мес: --';
      factBtn.innerHTML = 'Факт мес: --';
    }
  }, 300);

  updateState({
    factHintsTimeout: timeout,
  });
}

/**
 * Update fact hint buttons with data from API.
 */
function updateFactHintButtons(data: FactHintsData): void {
  const planBtn = document.getElementById('hint-period-plan');
  const factBtn = document.getElementById('hint-period-fact');
  if (!planBtn || !factBtn) return;

  const formatAmount = (amt: number | null | undefined): string => {
    if (!amt) return '--';
    const n = parseFloat(String(amt));
    return n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k' : n.toFixed(0);
  };

  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const monthName = monthNames[parseInt(data.period.split('-')[1]) - 1];

  // Plan button
  const planAmt = data.period_plan_sum;
  planBtn.innerHTML = planAmt && planAmt > 0 ? `План ${monthName}: ${formatAmount(planAmt)}` : `План ${monthName}: --`;
  planBtn.className = planAmt && planAmt > 0 ? 'btn btn-xs btn-ghost text-info' : 'btn btn-xs btn-ghost btn-disabled';
  (planBtn as HTMLButtonElement).disabled = true;

  // Fact button
  const factAmt = data.period_fact_sum;
  factBtn.innerHTML = factAmt && factAmt > 0 ? `Факт ${monthName}: ${formatAmount(factAmt)}` : `Факт ${monthName}: --`;
  factBtn.className = factAmt && factAmt > 0 ? 'btn btn-xs btn-ghost text-success' : 'btn btn-xs btn-ghost btn-disabled';
  (factBtn as HTMLButtonElement).disabled = true;
}

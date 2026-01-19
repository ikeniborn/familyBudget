/**
 * Plan Hints for Plan Form
 *
 * Loads and displays hints (previous period plan/fact amounts) for selected category.
 */

import { getState, updateState } from '../../core/DashboardState';
import type { Category, PlanHintsData } from '../../types/dashboard.d';



declare const debugLog: (...args: any[]) => void;
// ============================================================================
// Plan Hints Loading
// ============================================================================

/**
 * Load plan hints (previous period plan/fact amounts) for the selected category.
 * Displays hints in modal_add_plan buttons (hint-prev-plan, hint-prev-fact).
 */
export async function loadPlanHints(category: Category | null = null): Promise<void> {
  if (window.DEBUG_MODE) {
    debugLog('[PLAN_HINTS] loadPlanHints() called:', {
      category: category?.id ?? null,
      categoryName: category?.name ?? null,
      timestamp: new Date().toISOString(),
    });
  }

  const state = getState();

  // Clear existing debounce timeout
  if (state.planHintsTimeout) {
    clearTimeout(state.planHintsTimeout);
  }

  // Cancel pending API call
  if (state.planHintsController) {
    state.planHintsController.abort();
  }

  // Get hint buttons
  const prevPlanBtn = document.getElementById('hint-prev-plan');
  const prevFactBtn = document.getElementById('hint-prev-fact');

  if (!prevPlanBtn || !prevFactBtn) {
    debugLog('[loadPlanHints] Hint buttons not found');
    return;
  }

  // Check if BOTH account AND category are selected
  const cfoSelect = document.querySelector('#form_modal_add_plan select[name="financial_center_id"]') as HTMLSelectElement | null;
  const financialCenterId = cfoSelect?.value ?? null;
  const articleId = category?.id ?? null;

  if (window.DEBUG_MODE) {
    debugLog('[PLAN_HINTS] Validation check:', {
      fcId: financialCenterId,
      articleId: articleId,
      bothSelected: !!(financialCenterId && articleId),
    });
  }

  // If either FC or category NOT selected, show placeholder and return
  if (!financialCenterId || !articleId) {
    debugLog('[PLAN_HINTS] ⚠️ SKIPPED: Missing required fields', {
        fcSelected: !!financialCenterId,
        categorySelected: !!articleId,
      });
    prevPlanBtn.innerHTML = 'План пред. мес: --';
    (prevPlanBtn as HTMLButtonElement).disabled = true;
    prevPlanBtn.className = 'btn btn-xs btn-ghost btn-disabled';
    prevFactBtn.innerHTML = 'Факт пред. мес: --';
    (prevFactBtn as HTMLButtonElement).disabled = true;
    prevFactBtn.className = 'btn btn-xs btn-ghost btn-disabled';
    return;
  }

  debugLog('[PLAN_HINTS] ✅ Validation PASSED - proceeding with API call');

  // Show loading state
  prevPlanBtn.innerHTML = '<span class="loading loading-spinner loading-xs"></span>';
  (prevPlanBtn as HTMLButtonElement).disabled = true;
  prevPlanBtn.className = 'btn btn-xs btn-ghost btn-disabled';

  prevFactBtn.innerHTML = '<span class="loading loading-spinner loading-xs"></span>';
  (prevFactBtn as HTMLButtonElement).disabled = true;
  prevFactBtn.className = 'btn btn-xs btn-ghost btn-disabled';

  // Create new abort controller
  const controller = new AbortController();
  updateState({
    planHintsController: controller,
  });

  // Debounce: wait 300ms after last call
  const timeout = setTimeout(async () => {
    if (!navigator.onLine) {
      prevPlanBtn.innerHTML = 'План пред. мес: --';
      prevFactBtn.innerHTML = 'Факт пред. мес: --';
      return;
    }

    try {
      // Get current planning period from hidden input
      const periodInput = document.querySelector('#form_modal_add_plan input[name="plan_month"]') as HTMLInputElement | null;
      const period = periodInput?.value || new Date().toISOString().slice(0, 7);

      // Get current type (income/expense)
      const typeInput = document.querySelector('#form_modal_add_plan input[name="plan_type"]:checked') as HTMLInputElement | null;
      const articleType = typeInput?.value || 'expense';

      // Build query params
      const params = new URLSearchParams({
        period: period,
        article_type: articleType,
      });

      if (articleId) {
        params.append('article_id', String(articleId));
      }

      if (financialCenterId) {
        params.append('financial_center_id', financialCenterId);
      }

      // Call API
      const response = await fetch(`/api/v1/analytics/plan-hints?${params.toString()}`, {
        signal: controller.signal,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error(`[loadPlanHints] API error: ${response.status}`, errorData);

        // Show error state
        prevPlanBtn.innerHTML = 'План пред. мес: --';
        prevFactBtn.innerHTML = 'Факт пред. мес: --';
        return;
      }

      const data = await response.json();

      // Update hint buttons
      updatePlanHintButtons(data);

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        if (window.DEBUG_MODE) {
          debugLog('[loadPlanHints] Request cancelled (debounce)');
        }
      } else {
        console.error('[loadPlanHints] Failed to load:', error);

        // Show error state
        prevPlanBtn.innerHTML = 'План пред. мес: --';
        prevFactBtn.innerHTML = 'Факт пред. мес: --';
      }
    }
  }, 300);

  updateState({
    planHintsTimeout: timeout,
  });
}

/**
 * Update plan hint buttons with data from API.
 * Buttons become clickable and populate amount field when clicked.
 */
function updatePlanHintButtons(data: PlanHintsData): void {
  const prevPlanBtn = document.getElementById('hint-prev-plan');
  const prevFactBtn = document.getElementById('hint-prev-fact');

  if (!prevPlanBtn || !prevFactBtn) return;

  // Format amounts (show 'k' for thousands)
  const formatAmount = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '--';
    const num = parseFloat(String(amount));
    if (num >= 1000) {
      return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + 'k';
    }
    return num.toFixed(0);
  };

  // Get previous period month name
  const prevPeriodParts = data.prev_period.split('-');
  const prevMonthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const prevMonthName = prevMonthNames[parseInt(prevPeriodParts[1]) - 1];

  // Helper to set plan amount in form
  const setPlanAmount = (amount: number): void => {
    const amountInput = document.querySelector('#form_modal_add_plan input[name="amount"]') as HTMLInputElement | null;
    if (amountInput) {
      amountInput.value = amount.toFixed(0);
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      debugLog('[PLAN_HINTS] Amount set:', amount);
    }
  };

  // Update Plan button
  const planAmount = data.prev_period_plan_sum;
  if (planAmount !== null && planAmount !== undefined && parseFloat(String(planAmount)) > 0) {
    prevPlanBtn.innerHTML = `План ${prevMonthName}: ${formatAmount(planAmount)}₽`;
    (prevPlanBtn as HTMLButtonElement).disabled = false;
    prevPlanBtn.className = 'btn btn-xs btn-outline btn-info';
    (prevPlanBtn as HTMLButtonElement).onclick = () => setPlanAmount(parseFloat(String(planAmount)));
  } else {
    prevPlanBtn.innerHTML = `План ${prevMonthName}: --`;
    (prevPlanBtn as HTMLButtonElement).disabled = true;
    prevPlanBtn.className = 'btn btn-xs btn-ghost btn-disabled';
    (prevPlanBtn as HTMLButtonElement).onclick = null;
  }

  // Update Fact button
  const factAmount = data.prev_period_fact_sum;
  if (factAmount !== null && factAmount !== undefined && parseFloat(String(factAmount)) > 0) {
    prevFactBtn.innerHTML = `Факт ${prevMonthName}: ${formatAmount(factAmount)}₽`;
    (prevFactBtn as HTMLButtonElement).disabled = false;
    prevFactBtn.className = 'btn btn-xs btn-outline btn-success';
    (prevFactBtn as HTMLButtonElement).onclick = () => setPlanAmount(parseFloat(String(factAmount)));
  } else {
    prevFactBtn.innerHTML = `Факт ${prevMonthName}: --`;
    (prevFactBtn as HTMLButtonElement).disabled = true;
    prevFactBtn.className = 'btn btn-xs btn-ghost btn-disabled';
    (prevFactBtn as HTMLButtonElement).onclick = null;
  }
}

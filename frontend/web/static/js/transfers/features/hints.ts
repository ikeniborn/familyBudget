/**
 * Transfer Module - Hints Loading
 *
 * Plan/fact hints with 300ms debounce and AbortController.
 * Migrated from: frontend/web/static/js/transfer.js (lines 136-453)
 */

import { getState, updateState } from '../core/TransferState';

const DEBOUNCE_DELAY = 300;

/**
 * Load transfer plan hints (previous period)
 * Migrated from: transfer.js loadTransferPlanHints() (lines 136-241)
 */
export function loadTransferPlanHints(direction: 'from' | 'to'): void {
  const state = getState();
  const tree = direction === 'from' ? state.fromCategoryTree : state.toCategoryTree;
  const fcSelect = document.querySelector<HTMLSelectElement>(
    direction === 'from' ? '#from_financial_center' : '#to_financial_center'
  );

  const categoryId = tree?.getSelectedCategoryId();
  const fcId = fcSelect?.value ? parseInt(fcSelect.value) : null;

  // Validation: Require BOTH category AND FC
  if (!categoryId || !fcId) {
    import('../ui/hintButtons').then(({ updatePlanHintButtons }) => {
      updatePlanHintButtons(direction, null);
    });
    return;
  }

  // Debounce
  const timeoutKey = direction === 'from' ? 'hintsFrom' : 'hintsTo';
  const hintsState = state[timeoutKey];

  clearTimeout(hintsState.timeout || undefined);
  hintsState.controller?.abort();

  // Show loading
  import('../ui/hintButtons').then(({ updatePlanHintButtons }) => {
    updatePlanHintButtons(direction, { loading: true });
  });

  hintsState.timeout = window.setTimeout(async () => {
    const controller = new AbortController();
    updateState({
      [timeoutKey]: { ...hintsState, controller }
    });

    try {
      // Offline check
      if (!navigator.onLine) {
        const { updatePlanHintButtons } = await import('../ui/hintButtons');
        updatePlanHintButtons(direction, null);
        return;
      }

      const period = getPeriodFromUI();
      const articleType = direction === 'from' ? 'debit' : 'credit';

      const { getPlanHints } = await import('../integration/apiService');
      const data = await getPlanHints({
        period,
        articleType,
        articleId: categoryId,
        financialCenterId: fcId,
        signal: controller.signal
      });

      const { updatePlanHintButtons } = await import('../ui/hintButtons');
      updatePlanHintButtons(direction, data);

      // Update state
      if (direction === 'from') {
        updateState({ fromHints: data });
      } else {
        updateState({ toHints: data });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;

      console.error(`[Transfer] Error loading ${direction} plan hints:`, err);
      const { updatePlanHintButtons } = await import('../ui/hintButtons');
      updatePlanHintButtons(direction, null);
    }
  }, DEBOUNCE_DELAY);

  updateState({ [timeoutKey]: hintsState });
}

/**
 * Load transfer fact hints (current period)
 * Migrated from: transfer.js loadTransferFactHints() (lines 310-419)
 */
export function loadTransferFactHints(direction: 'from' | 'to'): void {
  const state = getState();
  const tree = direction === 'from' ? state.fromCategoryTree : state.toCategoryTree;
  const fcSelect = document.querySelector<HTMLSelectElement>(
    direction === 'from' ? '#from_financial_center' : '#to_financial_center'
  );

  const categoryId = tree?.getSelectedCategoryId();
  const fcId = fcSelect?.value ? parseInt(fcSelect.value) : null;

  // Validation: Require BOTH category AND FC
  if (!categoryId || !fcId) {
    import('../ui/hintButtons').then(({ updateFactHintButtons }) => {
      updateFactHintButtons(direction, null);
    });
    return;
  }

  // Debounce
  const timeoutKey = direction === 'from' ? 'hintsFrom' : 'hintsTo';
  const hintsState = state[timeoutKey];

  clearTimeout(hintsState.timeout || undefined);
  hintsState.controller?.abort();

  // Show loading
  import('../ui/hintButtons').then(({ updateFactHintButtons }) => {
    updateFactHintButtons(direction, { loading: true });
  });

  hintsState.timeout = window.setTimeout(async () => {
    const controller = new AbortController();
    updateState({
      [timeoutKey]: { ...hintsState, controller }
    });

    try {
      if (!navigator.onLine) {
        const { updateFactHintButtons } = await import('../ui/hintButtons');
        updateFactHintButtons(direction, null);
        return;
      }

      const factDate = getFactDateFromUI();
      const articleType = direction === 'from' ? 'debit' : 'credit';

      const { getFactHints } = await import('../integration/apiService');
      const data = await getFactHints({
        factDate,
        articleType,
        articleId: categoryId,
        financialCenterId: fcId,
        signal: controller.signal
      });

      const { updateFactHintButtons } = await import('../ui/hintButtons');
      updateFactHintButtons(direction, data);

      if (direction === 'from') {
        updateState({ fromHints: data });
      } else {
        updateState({ toHints: data });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;

      console.error(`[Transfer] Error loading ${direction} fact hints:`, err);
      const { updateFactHintButtons } = await import('../ui/hintButtons');
      updateFactHintButtons(direction, null);
    }
  }, DEBOUNCE_DELAY);

  updateState({ [timeoutKey]: hintsState });
}

/**
 * Get period from UI (YYYY-MM)
 */
function getPeriodFromUI(): string {
  const periodInput = document.querySelector<HTMLInputElement>('#transfer_plan_month');
  return periodInput?.value || new Date().toISOString().substring(0, 7);
}

/**
 * Get fact date from UI (YYYY-MM-DD)
 */
function getFactDateFromUI(): string {
  const dateInput = document.querySelector<HTMLInputElement>('#transfer_date');
  return dateInput?.value || new Date().toISOString().substring(0, 10);
}

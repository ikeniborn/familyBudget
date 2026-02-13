/**
 * Transfer Module - State Manager
 *
 * Handles widget initialization and UI visibility updates.
 * Migrated from: frontend/web/static/js/transfer.js (lines 459-526, 59-76)
 */

import { getState, updateState } from './TransferState';
import { loadTransferData } from './dataLoader';

// Global dependencies (provided by base.html and budgetShared.ts)
declare const BudgetShared: any;
declare const debugLog: (...args: any[]) => void;

// Lazy initialization flag
let isInitialized = false;

/**
 * Initialize transfer modal widgets
 * Called on DOMContentLoaded
 *
 * Migrated from: transfer.js initTransferModal() (lines 459-526)
 */
export async function initTransferModal(): Promise<void> {
  if (isInitialized) {
    debugLog('[Transfer] Already initialized, skipping');
    return;
  }
  // 1. Create CalendarWidget
  const dateWidget = new BudgetShared.CalendarWidget('#transfer_date', {
    dateFormat: 'Y-m-d',
    onChange: () => {
      const state = getState();
      if (state.recordType === 'fact') {
        // Import dynamically to avoid circular dependency
        import('../features/hints').then(({ loadTransferFactHints }) => {
          loadTransferFactHints('from');
          loadTransferFactHints('to');
        });
      }
    }
  });

  debugLog('[Transfer] CalendarWidget created');

  // 2. Create ChoicesCategoryTree (FROM - debit)
  const fromCategoryTree = new BudgetShared.ChoicesCategoryTree(
    '#from_article',
    {
      type: 'debit',
      mode: 'create', // CRITICAL: prevents phantom auto-select
      onCategoryChange: () => {
        const state = getState();
        if (state.recordType === 'plan') {
          import('../features/hints').then(({ loadTransferPlanHints }) => {
            loadTransferPlanHints('from');
          });
        } else {
          import('../features/hints').then(({ loadTransferFactHints }) => {
            loadTransferFactHints('from');
          });
        }
      }
    }
  );

  // 3. Create ChoicesCategoryTree (TO - credit)
  const toCategoryTree = new BudgetShared.ChoicesCategoryTree(
    '#to_article',
    {
      type: 'credit',
      mode: 'create',
      onCategoryChange: () => {
        const state = getState();
        if (state.recordType === 'plan') {
          import('../features/hints').then(({ loadTransferPlanHints }) => {
            loadTransferPlanHints('to');
          });
        } else {
          import('../features/hints').then(({ loadTransferFactHints }) => {
            loadTransferFactHints('to');
          });
        }
      }
    }
  );

  // 4. Update state with widget instances
  updateState({ dateWidget, fromCategoryTree, toCategoryTree });

  // 5. Load financial data
  await loadTransferData();

  // 6. Setup event listeners
  const { setupCFOFiltering } = await import('../features/filtering');
  setupCFOFiltering();

  const { setupQuickDateButtons, setupPeriodButtons } = await import('../features/quickDate');
  setupQuickDateButtons();
  setupPeriodButtons();

  isInitialized = true;
  debugLog('[Transfer] Modal initialized');
}

/**
 * Update UI visibility based on record type
 * Migrated from: transfer.js updateQuickDateButtonsVisibility() (lines 59-76)
 */
export function updateUIVisibility(): void {
  const state = getState();
  const factSection = document.getElementById('transfer-date-section-fact');
  const planSection = document.getElementById('transfer-period-section-plan');

  if (!factSection || !planSection) return;

  if (state.recordType === 'plan') {
    factSection.classList.add('hidden');
    planSection.classList.remove('hidden');

    // Initialize period buttons
    import('../features/quickDate').then(({ initTransferPeriodButtons, selectTransferPeriod }) => {
      initTransferPeriodButtons();
      selectTransferPeriod(0); // Select first period by default
    });
  } else {
    factSection.classList.remove('hidden');
    planSection.classList.add('hidden');
  }

  updateTransferHintsVisibility();
}

/**
 * Update hints visibility based on record type
 * Migrated from: transfer.js updateTransferHintsVisibility() (lines 37-54)
 */
function updateTransferHintsVisibility(): void {
  const fromHints = document.getElementById('transfer-from-hints');
  const toHints = document.getElementById('transfer-to-hints');

  // Always show hints for BOTH fact and plan
  fromHints?.classList.remove('hidden');
  toHints?.classList.remove('hidden');

  const state = getState();
  if (state.recordType === 'plan') {
    import('../features/hints').then(({ loadTransferPlanHints }) => {
      loadTransferPlanHints('from');
      loadTransferPlanHints('to');
    });
  } else {
    import('../features/hints').then(({ loadTransferFactHints }) => {
      loadTransferFactHints('from');
      loadTransferFactHints('to');
    });
  }
}

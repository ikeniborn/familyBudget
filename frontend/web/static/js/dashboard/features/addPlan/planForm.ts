/**
 * Plan Form Operations
 *
 * Handles form submission, validation, and save operations for plans.
 */

import { getState, setPlanCategoryTreeSelect, isCacheValid } from '../../core/DashboardState';
import { loadFinancialCenters, loadCostCenters } from '../addTransaction/categoryLoader';
import { loadPlanHints } from './planHints';
import { setupPlanPeriodButtons } from './periodButtons';
import { prefillReminderDateTime, togglePlanMode } from './reminderSettings';
import { showModalWithSkeleton } from '../../utils/modalHelpers';
import type { Category } from '../../types/dashboard.d';



declare const debugLog: (...args: any[]) => void;
declare const showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
// ============================================================================
// Category Loading
// ============================================================================

/**
 * Load categories for the plan form
 */
export async function loadPlanCategories(): Promise<void> {
  try {
    // Check if select element exists (defense in depth)
    const selectElement = document.querySelector('#form_modal_add_plan select[name="article_id"]');
    if (!selectElement) {
      debugLog('[loadPlanCategories] Select element not found - skipping initialization');
      return;
    }

    // Get current plan type
    const typeInput = document.querySelector('#form_modal_add_plan input[name="plan_type"]:checked') as HTMLInputElement | null;
    const planType = typeInput?.value || 'expense';

    const state = getState();

    if (state.planCategoryTreeSelect) {
      // Update existing instance (more efficient than destroy/recreate)
      await state.planCategoryTreeSelect.updateType(planType);
    } else if (window.BudgetShared?.ChoicesCategoryTree) {
      // Initialize CategoryTreeSelect for plan form
      const newInstance = new window.BudgetShared.ChoicesCategoryTree(
        '#form_modal_add_plan select[name="article_id"]',
        {
          type: planType,
          showLeafOnly: true,
          mode: 'create',  // Create mode - prevents phantom auto-select on initial FC filter
          onCategoryChange: (category: Category | null) => {
            debugLog('Plan category changed:', category);
            // Update plan hints based on selected category
            loadPlanHints(category);
          },
        }
      );
      setPlanCategoryTreeSelect(newInstance);
    }

    debugLog('[index.html] Plan categories loaded');
  } catch (error) {
    console.error('Failed to load plan categories:', error);
    showToast('Ошибка при загрузке категорий планов', 'error');
  }
}

// ============================================================================
// Form Submission
// ============================================================================

/**
 * Save plan (wrapper for form submission with double-click prevention)
 */
export function savePlan(button: HTMLElement): void {
  if (window.DEBUG_MODE) {
    debugLog('[savePlan] ========== START ==========');
    debugLog('[savePlan] Button element:', button);
    debugLog('[savePlan] Button disabled:', (button as HTMLButtonElement).disabled);
    debugLog('[savePlan] Form ID from dataset:', button.dataset.formId);
  }

  if ((button as HTMLButtonElement).disabled) {
    if (window.DEBUG_MODE) {
      console.warn('[savePlan] ⚠️ Button already disabled, returning early');
    }
    return;
  }

  setButtonLoading(button, true);
  debugLog('[savePlan] ✅ Button disabled and loading state set');

  const formId = button.dataset.formId;
  const form = formId ? document.getElementById(formId) as HTMLFormElement | null : null;
  debugLog('[savePlan] Form element found:', !!form, form?.id);

  if (form && form.checkValidity()) {
    if (window.DEBUG_MODE) {
      debugLog('[savePlan] ✅ Form is valid, calling requestSubmit()');
    }
    form.requestSubmit();
  } else {
    if (window.DEBUG_MODE) {
      console.warn('[savePlan] ⚠️ Form invalid or not found, re-enabling button');
    }
    // Re-enable button if validation fails
    setButtonLoading(button, false);
    form?.reportValidity();
  }

  debugLog('[savePlan] ========== END ==========');
}

// ============================================================================
// Modal Operations
// ============================================================================

/**
 * Open Add Plan modal with skeleton loader and pre-filled reminder date/time
 * Shows skeleton during data loading for better perceived performance
 */
/**
 * Open add plan modal with skeleton loader.
 *
 * Shows skeleton during data loading for better perceived performance.
 * Uses shared showModalWithSkeleton() helper for consistent UX.
 *
 * @returns Promise that resolves when modal is ready
 */
export async function openAddPlanModal(): Promise<void> {
  const modalId = 'modal_add_plan';
  const state = getState();

  // Reset button state BEFORE opening modal
  const form = document.getElementById('form_modal_add_plan') as HTMLFormElement | null;
  const submitBtn = form?.querySelector('.save-btn') as HTMLButtonElement | null;
  if (submitBtn) {
    submitBtn.disabled = false;
    delete submitBtn.dataset.originalHtml; // Clear cache (if exists)
  }

  await showModalWithSkeleton(
    modalId,
    // Check cache
    () =>
      state.planCategoryTreeSelect !== null &&
      isCacheValid(state.dropdownCache.categories) &&
      isCacheValid(state.dropdownCache.financialCenters),
    // Load data with context-aware post-load setup
    async () => {
      const currentState = getState();
      const hasCached = currentState.planCategoryTreeSelect !== null;

      if (hasCached) {
        // Cached: reset FC filter BEFORE updating widget
        if (currentState.planCategoryTreeSelect) {
          currentState.planCategoryTreeSelect.options.financialCenterId = null;
          currentState.planCategoryTreeSelect.clearSelection();
          debugLog('[MODAL_CREATE] Plan modal: FC reset and selection cleared');
        }
        togglePlanMode(modalId);
        loadPlanCategories(); // Non-awaited async update
      } else {
        // Non-cached: load all data, then reset FC filter AFTER
        await Promise.all([
          loadPlanCategories(),
          loadFinancialCenters(),
          loadCostCenters()
        ]);

        const updatedState = getState();
        if (updatedState.planCategoryTreeSelect) {
          updatedState.planCategoryTreeSelect.options.financialCenterId = null;
          updatedState.planCategoryTreeSelect.clearSelection();
          debugLog('[MODAL_CREATE] Plan modal: FC reset and selection cleared');
        }
        togglePlanMode(modalId);
      }
    },
    // Setup UI (synchronous operations)
    () => {
      setupPlanPeriodButtons();
      prefillReminderDateTime(modalId);
    }
  );
}

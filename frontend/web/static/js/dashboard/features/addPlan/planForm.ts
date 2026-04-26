/**
 * Plan Form Operations
 *
 * Handles form submission, validation, and save operations for plans.
 */

import { getState, setPlanCategoryTreeSelect, isCacheValid } from '../../core/DashboardState';
import { loadPendingRecords } from '../pendingRecords';
import { loadFinancialCenters, loadCostCenters } from '../addTransaction/categoryLoader';
import { loadPlanHints } from './planHints';
import { setupPlanPeriodButtons } from './periodButtons';
import { prefillReminderDateTime, togglePlanMode } from './reminderSettings';
import { showModalWithSkeleton } from '../../utils/modalHelpers';
import type { PlanFormData, Category } from '../../types/dashboard.d';



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

/**
 * Save plan to offline queue only (without uploading)
 */
export async function savePlanOffline(button: HTMLElement): Promise<void> {
  const formId = button.dataset.formId;
  const modalId = button.dataset.modalId;
  const form = formId ? document.getElementById(formId) as HTMLFormElement | null : null;
  const modal = modalId ? document.getElementById(modalId) as HTMLDialogElement | null : null;

  if (!form || !modal) {
    console.error('[savePlanOffline] Form or modal not found:', formId, modalId);
    return;
  }

  // Validate form
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  // Disable button and show loading
  setButtonLoading(button, true);

  try {
    const formData = new FormData(form);

    // Convert plan_month (YYYY-MM) to fact_date (YYYY-MM-01)
    const planMonth = formData.get('plan_month') as string;
    const factDate = `${planMonth}-01`;

    // Helper to get selected option text
    function getSelectedText(selectElement: HTMLSelectElement | null): string | null {
      if (!selectElement) return null;
      const selected = selectElement.options[selectElement.selectedIndex];
      return selected ? selected.text : null;
    }

    // Get form elements for names
    const fcSelect = form.querySelector('[name="financial_center_id"]') as HTMLSelectElement | null;
    const ccSelect = form.querySelector('[name="cost_center_id"]') as HTMLSelectElement | null;

    // Get article name from category tree
    let articleName: string | null = null;
    const state = getState();
    if (state.planCategoryTreeSelect?.getSelectedCategory) {
      const selected = state.planCategoryTreeSelect.getSelectedCategory();
      articleName = selected ? selected.name : null;
    }

    const data: PlanFormData = {
      record_type: 'plan',
      fact_type: formData.get('plan_type') as 'income' | 'expense',
      amount: Number.parseInt(formData.get('amount') as string, 10),
      article_id: parseInt(formData.get('article_id') as string),
      article_name: articleName || undefined,
      financial_center_id: parseInt(formData.get('financial_center_id') as string),
      financial_center_name: getSelectedText(fcSelect) || undefined,
      cost_center_id: formData.get('cost_center_id') ? parseInt(formData.get('cost_center_id') as string) : null,
      cost_center_name: getSelectedText(ccSelect) || undefined,
      fact_date: factDate,
      plan_date: planMonth,  // Keep original for display
      description: (formData.get('description') as string) || null,
    };

    // Force offline save (bypass online check)
    if (window.offlineManager) {
      const result = await window.offlineManager.createPlanOffline(data);

      modal.close();
      form.reset();

      showToast('План сохранен локально (синхронизируется при подключении)', 'warning');
      debugLog('[savePlanOffline] Saved:', result);
      // Update pending records table
      await loadPendingRecords();
    } else {
      showToast('Ошибка: OfflineManager не доступен', 'error');
    }
  } catch (error) {
    console.error('[savePlanOffline] Error:', error);
    showToast('Ошибка при сохранении: ' + (error as Error).message, 'error');
  } finally {
    setButtonLoading(button, false);
  }
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

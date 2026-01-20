/**
 * Plan CRUD Module
 * Handles plan creation, editing, deletion, and modal management
 *
 * @module plan/crud
 * @version 3.0.0 (Phase 3: Week 3 - Modal Management + Basic CRUD)
 * @description CRUD operations for budget plans with RecurringPlanForm integration
 */

import * as PlanHelpers from './helpers';
import * as PlanFactsTable from './factsTable';

// Import BudgetShared from global
declare const BudgetShared: {
  DateFormatter: {
    formatForDisplay: (isoDate: string) => string;
    formatForAPI: (displayDate: string) => string;
  };
  CalendarWidget: {
    init: (inputId: string, options?: any) => void;
    destroy: (inputId: string) => void;
  };
  ConfirmDialog: {
    show: (options: {
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      confirmClass?: string;
    }) => Promise<boolean>;
  };
};

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Budget fact data structure
 * Matches API response from /api/v1/facts
 */
export interface BudgetFact {
  id: number;
  fact_date: string; // ISO date string
  financial_center_id: number;
  financial_center_name: string;
  cost_center_id: number | null;
  cost_center_name: string | null;
  article_id: number;
  article_name: string;
  amount: number;
  description: string | null;
  user_id: number;
  user_name: string;
  record_type: 'plan' | 'fact';
  recurring_plan_id: number | null;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Recurring plan data structure
 * Matches API response from /api/v1/recurring-plans/{id}
 */
export interface RecurringPlan {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string | null;
  financial_center_id: number;
  cost_center_id: number | null;
  article_id: number;
  amount: number;
  description: string | null;
  frequency_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  frequency_value: number;
  duration_type: 'indefinite' | 'until_date' | 'count';
  duration_value: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Form data for plan creation/editing
 */
export interface PlanFormData {
  start_date: string;
  financial_center_id: number;
  record_type: 'expense' | 'income';
  article_id: number;
  cost_center_id?: number | null;
  amount: number;
  description?: string;
  is_recurring: boolean;
  frequency_type?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  frequency_value?: number;
  duration_type?: 'indefinite' | 'until_date' | 'count';
  duration_value?: number | null;
  end_date?: string | null;
  reminder_enabled?: boolean;
  reminder_datetime?: string | null;
  reminder_message?: string | null;
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Current recurring plan being edited
 * Loaded when editing a fact with recurring_plan_id
 */
let currentRecurringPlan: RecurringPlan | null = null;

/**
 * Calendar widget for template end date in edit modal
 * Created when editing recurring plans, destroyed on modal close
 */
let editTemplateEndDateCalendar: any = null;

/**
 * Set of fact IDs currently being deleted
 * Used to prevent race conditions in simultaneous delete operations
 */
const deletingFactIds = new Set<number>();

/**
 * Get current recurring plan
 */
export function getCurrentRecurringPlan(): RecurringPlan | null {
  return currentRecurringPlan;
}

/**
 * Set current recurring plan
 */
export function setCurrentRecurringPlan(plan: RecurringPlan | null): void {
  currentRecurringPlan = plan;
}

// ============================================================================
// Modal Management
// ============================================================================

/**
 * Open add plan modal
 * Shows create form for new plan (regular, recurring, or with reminder)
 */
export async function openAddPlanModal(): Promise<void> {
  console.log('[CRUD] openAddPlanModal - TODO: Implement');
  // TODO: Week 3 - Extract from plan.html line 4319
}

/**
 * Show edit modal for existing fact
 * Loads fact data and populates edit form
 *
 * @param factId - ID of fact to edit
 */
export async function showEditModal(factId: number): Promise<void> {
  console.log('[CRUD] showEditModal - TODO: Implement', factId);
  // TODO: Week 3 - Extract from plan.html line 2606
}

/**
 * Close edit modal
 * Cleans up calendar widgets and resets form state
 */
export function closeEditModal(): void {
  const modal = document.getElementById('edit-modal') as HTMLDialogElement | null;
  const form = document.getElementById('edit-form') as HTMLFormElement | null;

  if (modal) {
    modal.close();
  }

  if (form) {
    form.reset();
  }

  // Reset recurring plan state
  currentRecurringPlan = null;

  // Destroy template end date calendar if exists
  if (editTemplateEndDateCalendar) {
    editTemplateEndDateCalendar.destroy();
    editTemplateEndDateCalendar = null;
  }

  console.log('[CRUD] Edit modal closed and cleaned up');
}

// ============================================================================
// Basic CRUD Operations
// ============================================================================

/**
 * Create new plan
 * Handles form submission from create modal
 *
 * @param event - Form submit event
 */
export async function createPlan(event: Event): Promise<void> {
  event.preventDefault();
  console.log('[CRUD] createPlan - TODO: Implement');
  // TODO: Week 3 - Extract from plan.html line 3792
}

/**
 * Update existing fact
 * Handles form submission from edit modal
 *
 * @param event - Form submit event
 */
export async function updateFact(event: Event): Promise<void> {
  event.preventDefault();
  console.log('[CRUD] updateFact - TODO: Implement');
  // TODO: Week 3 - Extract from plan.html line 3172
}

/**
 * Delete fact by ID
 * Shows confirmation dialog before deletion
 *
 * @param factId - ID of fact to delete
 */
export async function deleteFact(factId: number): Promise<void> {
  // Prevent multiple simultaneous deletes of the same fact (race condition protection)
  if (deletingFactIds.has(factId)) {
    console.warn('[CRUD] Delete already in progress for fact:', factId);
    return;
  }

  // Find fact in factsData to check if it's recurring
  const factsData = PlanFactsTable.getFactsData();
  const fact = factsData.find(f => f.id === factId);
  let deleteMode: 'single' | 'all' = 'single'; // default: delete just this fact

  if (fact && fact.recurring_plan_id) {
    // This is a recurring fact - ask user what to delete
    // TODO: Week 4 - Implement showRecurringDeleteDialog()
    console.warn('[CRUD] Recurring delete dialog not yet implemented (Week 4)');
    const confirmed = await showConfirmDialog(
      'Это регламентная запись. Удалить только эту запись?',
      '🗑️ Удаление регламентной записи'
    );

    if (!confirmed) {
      return;
    }

    // For now, default to 'single' mode
    deleteMode = 'single';
  } else {
    // Regular fact - show standard confirmation
    const confirmed = await showConfirmDialog(
      'Вы уверены, что хотите удалить эту транзакцию? Это действие необратимо.',
      '🗑️ Удаление транзакции'
    );

    if (!confirmed) {
      return;
    }
  }

  // Find button by data-fact-id attribute
  const button = document.querySelector(`button[data-fact-id="${factId}"]`) as HTMLButtonElement | null;

  // Mark fact as being deleted
  deletingFactIds.add(factId);

  // Disable button and show loading state
  if (button) {
    button.disabled = true;
    button.classList.add('loading', 'loading-spinner');
  }

  try {
    // TODO: Week 4 - deleteMode will be set to 'all' by showRecurringDeleteDialog()
    // @ts-ignore - deleteMode is always 'single' in Week 3, 'all' branch for Week 4
    if (deleteMode === 'all' && fact && fact.recurring_plan_id) {
      // Delete all facts with same recurring_plan_id
      const recurringPlanId = fact.recurring_plan_id;

      // Find all fact IDs with this recurring_plan_id
      const factIdsToDelete = factsData
        .filter(f => f.recurring_plan_id === recurringPlanId)
        .map(f => f.id);

      console.log(`[CRUD] Deleting ${factIdsToDelete.length} recurring facts with recurring_plan_id=${recurringPlanId}`);

      // Use batch delete endpoint
      const response = await fetch('/api/v1/facts/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(factIdsToDelete)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP error! status: ${response.status}`);
      }

      // Reload and show success
      deletingFactIds.delete(factId);
      await PlanFactsTable.loadFacts();
      PlanHelpers.showToast(`Удалено ${factIdsToDelete.length} регламентных записей`, 'success');
    } else {
      // Delete single fact
      const response = await fetch(`/api/v1/facts/${factId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP error! status: ${response.status}`);
      }

      // Reload BEFORE showing toast (non-blocking)
      deletingFactIds.delete(factId);
      await PlanFactsTable.loadFacts();

      // Non-blocking toast notification
      PlanHelpers.showToast('Факт успешно удален', 'success');
    }
  } catch (error) {
    console.error('[CRUD] Error deleting fact:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Reload even on error to sync UI
    deletingFactIds.delete(factId);
    await PlanFactsTable.loadFacts();

    // Non-blocking toast notification
    PlanHelpers.showToast('Ошибка: ' + errorMessage, 'error');
  }
}

/**
 * Delete fact from edit modal
 * Shows confirmation dialog, then closes modal and reloads table
 */
export async function deleteFromEditModal(): Promise<void> {
  const factIdInput = document.getElementById('edit-id') as HTMLInputElement | null;

  if (!factIdInput || !factIdInput.value) {
    console.warn('[CRUD] deleteFromEditModal - No fact ID found');
    return;
  }

  const factId = parseInt(factIdInput.value);

  if (isNaN(factId)) {
    console.error('[CRUD] deleteFromEditModal - Invalid fact ID:', factIdInput.value);
    return;
  }

  // Close edit modal before showing dialog
  closeEditModal();

  // Use main deleteFact() which handles both regular and recurring facts
  await deleteFact(factId);
}

// ============================================================================
// Internal Helper Functions
// ============================================================================

/**
 * Show confirmation dialog
 * Wrapper around BudgetShared.ConfirmDialog
 *
 * @param message - Confirmation message
 * @param title - Dialog title
 * @returns Promise that resolves to true if confirmed, false otherwise
 */
async function showConfirmDialog(message: string, title: string): Promise<boolean> {
  return await BudgetShared.ConfirmDialog.show({
    title,
    message,
    confirmText: 'Удалить',
    cancelText: 'Отмена',
    confirmClass: 'btn-error'
  });
}

// ============================================================================
// Helper Functions (for Week 4: Batch Operations & Recurring Helpers)
// ============================================================================

/**
 * Batch delete selected facts
 * Shows confirmation dialog with count, deletes all selected facts
 */
export async function batchDeleteFacts(): Promise<void> {
  console.log('[CRUD] batchDeleteFacts - TODO: Week 4');
  // TODO: Week 4 - Extract from plan.html line 3497
}

/**
 * Show recurring plan delete dialog
 * Asks user whether to delete single instance or all occurrences
 */
export function showRecurringDeleteDialog(): void {
  console.log('[CRUD] showRecurringDeleteDialog - TODO: Week 4');
  // TODO: Week 4 - Extract from plan.html line 3361
}

/**
 * Batch delete selected recurring plans
 * Shows confirmation dialog with checkbox, deletes all selected plans
 */
export async function batchDeleteRecurringPlans(): Promise<void> {
  console.log('[CRUD] batchDeleteRecurringPlans - TODO: Week 4');
  // TODO: Week 4 - Extract from plan.html line 5242
}

console.log('[CRUD] Plan CRUD module loaded (Phase 3: Week 3 skeleton)');

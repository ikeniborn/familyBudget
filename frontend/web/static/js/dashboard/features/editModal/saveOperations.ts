/**
 * Save Operations for Edit Modal
 *
 * Handles saving/updating facts and plans from the edit modal.
 */

import { closeEditModal, getCurrentEditingRecordType } from './formPopulation';
import {
  validateFactForm,
  buildFactDataFromForm,
  updateOnlineRecord,
  updateReminder,
} from './helpers';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Set submit button loading state.
 */
function setSubmitLoading(form: HTMLFormElement, loading: boolean): void {
  const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
  if (submitBtn) {
    submitBtn.disabled = loading;
    if (loading) {
      submitBtn.innerHTML = '<span class="loading loading-spinner loading-sm"></span> Сохранение...';
    } else {
      submitBtn.innerHTML = 'Сохранить';
    }
  }
}

/**
 * Refresh dashboard widgets via HTMX.
 */
function refreshDashboardWidgets(): void {
  if (window.htmx) {
    window.htmx.ajax('GET', '/api/v1/facts/recent-html?limit=10', {
      target: '#recent-transactions',
      swap: 'innerHTML',
    });
    window.htmx.ajax('GET', '/api/v1/analytics/quick-stats-html', {
      target: '#quick-stats',
      swap: 'innerHTML',
    });
    window.htmx.ajax('GET', '/api/v1/analytics/account-balances-html', {
      target: '#account-balances',
      swap: 'innerHTML',
    });
  }
}

// ============================================================================
// Update Fact
// ============================================================================

/**
 * Update fact from edit modal (handles both online and pending records).
 * Refactored to use helper functions for better maintainability.
 */
export async function updateFact(event: Event): Promise<void> {
  event.preventDefault();
  event.stopPropagation();  // Prevent event bubbling

  const form = event.target as HTMLFormElement;
  const formData = new FormData(form);
  const recordId = formData.get('id') as string;

  // Validation
  const validationError = validateFactForm(formData);
  if (validationError) {
    showToast(validationError, 'error');
    return;
  }

  // Show loading state
  setSubmitLoading(form, true);

  // Build data object
  const data = buildFactDataFromForm(formData);

  const currentEditingRecordType = getCurrentEditingRecordType();

  // Handle online record update
  const editScope = formData.get('edit_scope') as string;

  try {
    const { successMessage } = await updateOnlineRecord(recordId, data, formData);

    // Handle reminder update for plans (only for single fact scope, not template)
    await updateReminder(recordId, formData, currentEditingRecordType || 'fact', editScope);

    closeEditModal();
    refreshDashboardWidgets();
    showToast(successMessage, 'success');
  } catch (error) {
    console.error('[SAVE_EDIT] Error updating fact:', error);
    showToast('Ошибка сохранения: ' + (error as Error).message, 'error');

    // Do NOT reload page - keep modal open for retry
    // User can fix validation errors and resubmit
  } finally {
    setSubmitLoading(form, false);
  }
}

/**
 * Save Operations for Edit Modal
 *
 * Handles saving/updating facts and plans from the edit modal.
 */

import { getState } from '../../core/DashboardState';
import { loadPendingRecords } from '../pendingRecords';
import { closeEditModal, getCurrentEditingPendingId, getCurrentEditingRecordType } from './formPopulation';
import { remindersMap } from './dropdownCache';

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
 */
export async function updateFact(event: Event): Promise<void> {
  event.preventDefault();
  event.stopPropagation();  // Prevent event bubbling

  const form = event.target as HTMLFormElement;
  const formData = new FormData(form);
  const recordId = formData.get('id') as string;
  const displayDate = formData.get('fact_date') as string;

  // Validation: Check date format
  if (!displayDate || !window.BudgetShared?.DateFormatter.isValidDisplayFormat(displayDate)) {
    showToast('Неверный формат даты. Используйте формат ДД.ММ.ГГГГ', 'error');
    return;
  }

  // Show loading state
  setSubmitLoading(form, true);

  // Build data object
  const data: Record<string, any> = {
    amount: parseFloat(formData.get('amount') as string),
    fact_date: window.BudgetShared?.DateFormatter.formatForAPI(displayDate),
    article_id: parseInt(formData.get('article_id') as string),
    description: (formData.get('description') as string) || null,
  };

  // Add center fields if selected
  const financialCenterId = formData.get('financial_center_id') as string;
  const costCenterId = formData.get('cost_center_id') as string;

  if (financialCenterId) {
    data.financial_center_id = parseInt(financialCenterId);
  }

  if (costCenterId) {
    data.cost_center_id = parseInt(costCenterId);
  }

  const currentEditingPendingId = getCurrentEditingPendingId();
  const currentEditingRecordType = getCurrentEditingRecordType();

  // Handle pending record update
  if (currentEditingPendingId !== null) {
    try {
      if (!window.offlineManager) {
        throw new Error('OfflineManager не доступен');
      }

      // Get original pending item to preserve display names
      const { items } = await window.offlineManager.getAllUnsyncedItems();
      const originalItem = items.find((i: { id: number }) => i.id === currentEditingPendingId);
      const originalData = originalItem?.data || {};

      // Get display names from form selects
      const fcSelect = document.getElementById('edit-financial-center') as HTMLSelectElement | null;
      const ccSelect = document.getElementById('edit-cost-center') as HTMLSelectElement | null;
      const financialCenterName = fcSelect?.selectedOptions[0]?.text || originalData.financial_center_name;
      const costCenterName = ccSelect?.selectedOptions[0]?.text || originalData.cost_center_name;

      // Get article name from category tree
      const state = getState();
      let articleName = originalData.article_name;
      if (state.editCategoryTreeSelect?.getSelectedCategory) {
        const selected = state.editCategoryTreeSelect.getSelectedCategory();
        if (selected) articleName = selected.name;
      }

      // Merge new data with original
      const mergedData = {
        ...originalData,
        ...data,
        article_name: articleName,
        financial_center_name: financialCenterName,
        cost_center_name: costCenterName,
      };

      // Get reminder settings for plans
      if (currentEditingRecordType === 'plan') {
        const enableReminder = formData.get('enable_reminder') === 'on';
        const reminderDatetime = formData.get('reminder_datetime') as string;
        if (enableReminder && reminderDatetime) {
          mergedData.reminder_datetime = reminderDatetime;
        }
      }

      // Update pending record in IndexedDB
      await (window.offlineManager as any).updatePendingItemData(currentEditingPendingId, mergedData);

      closeEditModal();
      await loadPendingRecords();
      showToast('Запись обновлена (ожидает синхронизации)', 'success');
    } catch (error) {
      console.error('Error updating pending record:', error);
      showToast('Ошибка обновления записи: ' + (error as Error).message, 'error');
    } finally {
      setSubmitLoading(form, false);
    }
    return;
  }

  // Handle online record update
  const enableReminder = formData.get('enable_reminder') === 'on';
  const reminderDatetime = formData.get('reminder_datetime') as string;

  // Get recurring plan settings
  const recurringPlanId = formData.get('recurring_plan_id') as string;
  const editScope = formData.get('edit_scope') as string;

  try {
    let response: Response;
    let successMessage = 'Запись успешно обновлена';

    // Check if editing recurring plan template
    if (recurringPlanId && editScope === 'template') {
      // Update recurring plan template
      const templateData: Record<string, any> = {
        amount: data.amount,
        description: data.description,
      };

      if (costCenterId) {
        templateData.cost_center_id = parseInt(costCenterId);
      }

      response = await fetch(`/api/v1/recurring-plans/${recurringPlanId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(templateData),
      });
      successMessage = 'Шаблон регламентного платежа обновлен';
    } else {
      // Update single fact
      response = await fetch(`/api/v1/admin/facts/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
    }

    if (!response.ok) {
      const error = await response.json();
      let errorMsg = 'Ошибка сохранения';

      if (error.detail && typeof error.detail === 'object') {
        if (Array.isArray(error.detail.errors) && error.detail.errors.length > 0) {
          errorMsg = error.detail.errors.map((e: any) => e.message || e.msg || 'Unknown error').join('; ');
        } else if (typeof error.detail.message === 'string') {
          errorMsg = error.detail.message;
        } else if (typeof error.detail === 'string') {
          errorMsg = error.detail;
        } else if (Array.isArray(error.detail)) {
          errorMsg = error.detail.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join(', ');
        }
      } else if (typeof error.detail === 'string') {
        errorMsg = error.detail;
      }

      throw new Error(errorMsg);
    }

    // Handle reminder update for plans (only for single fact scope, not template)
    // Type assertion needed due to conflicting BudgetShared declarations across modules
    const budgetShared = window.BudgetShared as typeof window.BudgetShared & {
      Reminders?: {
        createReminder(factId: string, reminderDatetime: string): Promise<any>;
        updateReminder(factId: string, reminderDatetime: string): Promise<any>;
        deleteReminder(factId: string): Promise<boolean>;
      };
    };

    if (currentEditingRecordType === 'plan' && editScope !== 'template' && budgetShared?.Reminders) {
      const existingReminder = remindersMap.get(parseInt(recordId));

      if (enableReminder && reminderDatetime) {
        if (existingReminder) {
          const updated = await budgetShared.Reminders.updateReminder(recordId, reminderDatetime);
          if (!updated) {
            showToast('Предупреждение: не удалось обновить напоминание', 'warning');
          } else {
            remindersMap.set(parseInt(recordId), updated);
          }
        } else {
          const created = await budgetShared.Reminders.createReminder(recordId, reminderDatetime);
          if (!created) {
            showToast('Предупреждение: не удалось создать напоминание', 'warning');
          } else {
            remindersMap.set(parseInt(recordId), created);
          }
        }
      } else if (!enableReminder && existingReminder) {
        const deleted = await budgetShared.Reminders.deleteReminder(recordId);
        if (!deleted) {
          showToast('Предупреждение: не удалось удалить напоминание', 'warning');
        } else {
          remindersMap.delete(parseInt(recordId));
        }
      }
    }

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

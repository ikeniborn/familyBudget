/**
 * Helper functions for edit modal save operations
 * Extracted from saveOperations.ts to improve maintainability
 */

import { getState } from '../../core/DashboardState';
import { remindersMap } from './dropdownCache';

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate fact form data
 * @returns Error message if invalid, null if valid
 */
export function validateFactForm(formData: FormData): string | null {
  const displayDate = formData.get('fact_date') as string;

  if (!displayDate || !window.BudgetShared?.DateFormatter.isValidDisplayFormat(displayDate)) {
    return 'Неверный формат даты. Используйте формат ДД.ММ.ГГГГ';
  }

  return null;
}

// ============================================================================
// Data Building
// ============================================================================

/**
 * Build fact data object from form data
 */
export function buildFactDataFromForm(formData: FormData): Record<string, any> {
  const displayDate = formData.get('fact_date') as string;

  const data: Record<string, any> = {
    amount: Number.parseInt(formData.get('amount') as string, 10),
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

  return data;
}

/**
 * Get display names from form selects for pending records
 */
export function getDisplayNamesFromForm(originalData: any): {
  articleName: string;
  financialCenterName: string;
  costCenterName: string;
} {
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

  return { articleName, financialCenterName, costCenterName };
}

// ============================================================================
// Pending Record Update
// ============================================================================

/**
 * Update pending record in IndexedDB
 */
export async function updatePendingRecord(
  pendingId: number,
  data: Record<string, any>,
  formData: FormData,
  recordType: string
): Promise<void> {
  if (!window.offlineManager) {
    throw new Error('OfflineManager не доступен');
  }

  // Get original pending item to preserve display names
  const { items } = await window.offlineManager.getAllUnsyncedItems();
  const originalItem = items.find((i: { id: number }) => i.id === pendingId);
  const originalData = originalItem?.data || {};

  // Get display names
  const { articleName, financialCenterName, costCenterName } = getDisplayNamesFromForm(originalData);

  // Merge new data with original
  const mergedData = {
    ...originalData,
    ...data,
    article_name: articleName,
    financial_center_name: financialCenterName,
    cost_center_name: costCenterName,
  };

  // Get reminder settings for plans
  if (recordType === 'plan') {
    const enableReminder = formData.get('enable_reminder') === 'on';
    const reminderDatetime = formData.get('reminder_datetime') as string;
    if (enableReminder && reminderDatetime) {
      mergedData.reminder_datetime = reminderDatetime;
    }
  }

  // Update pending record in IndexedDB
  await (window.offlineManager as any).updatePendingItemData(pendingId, mergedData);
}

// ============================================================================
// Online Record Update
// ============================================================================

/**
 * Update online fact or recurring plan template
 */
export async function updateOnlineRecord(
  recordId: string,
  data: Record<string, any>,
  formData: FormData
): Promise<{ response: Response; successMessage: string }> {
  const costCenterId = formData.get('cost_center_id') as string;
  const recurringPlanId = formData.get('recurring_plan_id') as string;
  const editScope = formData.get('edit_scope') as string;

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

  return { response, successMessage };
}

// ============================================================================
// Reminder Update
// ============================================================================

/**
 * Update reminder for plan (only for single fact scope, not template)
 */
export async function updateReminder(
  recordId: string,
  formData: FormData,
  recordType: string,
  editScope: string
): Promise<void> {
  // Type assertion needed due to conflicting BudgetShared declarations across modules
  const budgetShared = window.BudgetShared as typeof window.BudgetShared & {
    Reminders?: {
      createReminder(factId: string, reminderDatetime: string): Promise<any>;
      updateReminder(factId: string, reminderDatetime: string): Promise<any>;
      deleteReminder(factId: string): Promise<boolean>;
    };
  };

  if (recordType !== 'plan' || editScope === 'template' || !budgetShared?.Reminders) {
    return;
  }

  const enableReminder = formData.get('enable_reminder') === 'on';
  const reminderDatetime = formData.get('reminder_datetime') as string;
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

/**
 * Delete Operations for Edit Modal
 *
 * Handles deletion of facts/plans from the edit modal and dashboard.
 */

import { loadPendingRecords } from '../pendingRecords';
import { closeEditModal, getCurrentEditingPendingId } from './formPopulation';

declare const debugLog: (...args: any[]) => void;
// ============================================================================
// Recurring Delete Dialog
// ============================================================================

// Promise resolve callback for recurring delete dialog
let recurringDeleteResolveCallback: ((value: string | null) => void) | null = null;

/**
 * Show recurring delete dialog and return user's choice.
 * @returns Promise resolving to 'single', 'all', or null if cancelled
 */
export function showRecurringDeleteDialog(): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = document.getElementById('recurring-delete-modal') as HTMLDialogElement | null;
    if (!dialog) {
      resolve(null);
      return;
    }

    recurringDeleteResolveCallback = resolve;
    dialog.showModal();
  });
}

/**
 * Handle recurring delete dialog choice.
 */
export function handleRecurringDeleteChoice(choice: string | null): void {
  const dialog = document.getElementById('recurring-delete-modal') as HTMLDialogElement | null;
  dialog?.close();

  if (recurringDeleteResolveCallback) {
    recurringDeleteResolveCallback(choice);
    recurringDeleteResolveCallback = null;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

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
// Delete from Edit Modal
// ============================================================================

/**
 * Delete record from edit modal.
 */
export async function deleteFromEditModal(): Promise<void> {
  const recordIdEl = document.getElementById('edit-id') as HTMLInputElement | null;
  const recordId = recordIdEl?.value;
  if (!recordId) return;

  // Confirm deletion
  const confirmed = await window.showConfirmDialog(
    'Вы уверены, что хотите удалить эту запись? Это действие необратимо.',
    'Подтверждение удаления'
  );
  if (!confirmed) {
    return;
  }

  const currentEditingPendingId = getCurrentEditingPendingId();

  // Handle pending record deletion
  if (currentEditingPendingId !== null) {
    try {
      if (!window.offlineManager) {
        throw new Error('OfflineManager не доступен');
      }

      await window.offlineManager.removePendingItem(currentEditingPendingId);
      closeEditModal();
      await loadPendingRecords();
      showToast('Запись удалена из очереди', 'success');
      return;
    } catch (error) {
      console.error('Error deleting pending record:', error);
      showToast('Ошибка удаления: ' + (error as Error).message, 'error');
      return;
    }
  }

  // Handle online record deletion
  try {
    const response = await fetch(`/api/v1/facts/${recordId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    closeEditModal();
    refreshDashboardWidgets();
    await loadPendingRecords();

    showToast('Запись успешно удалена', 'success');
  } catch (error) {
    console.error('Error deleting fact:', error);
    showToast('Ошибка: ' + (error as Error).message, 'error');
  }
}

// ============================================================================
// Delete from Dashboard
// ============================================================================

/**
 * Delete a fact from dashboard recent-transactions list.
 * Handles both regular and recurring facts.
 */
export async function deleteFactFromDashboard(factId: number, isRecurring: number | boolean): Promise<void> {
  try {
    let deleteMode = 'single'; // default: delete just this fact

    if (isRecurring) {
      // This is a recurring fact - ask user what to delete
      const choice = await showRecurringDeleteDialog();

      if (!choice) {
        // User cancelled
        return;
      }

      deleteMode = choice; // 'single' or 'all'
    } else {
      // Regular fact - show standard confirmation
      const confirmed = await window.showConfirmDialog(
        'Вы уверены, что хотите удалить эту запись? Это действие необратимо.',
        'Подтверждение удаления'
      );

      if (!confirmed) {
        return;
      }
    }

    if (deleteMode === 'all' && isRecurring) {
      // First, get the fact to retrieve recurring_plan_id
      const factResponse = await fetch(`/api/v1/facts/${factId}`, { credentials: 'include' });
      if (!factResponse.ok) {
        throw new Error('Ошибка загрузки записи');
      }

      const fact = await factResponse.json();
      const recurringPlanId = fact.recurring_plan_id;

      if (!recurringPlanId) {
        throw new Error('У записи отсутствует recurring_plan_id');
      }

      // Get all facts with same recurring_plan_id
      const allFactsResponse = await fetch(
        `/api/v1/facts?recurring_plan_id=${recurringPlanId}&limit=1000`,
        { credentials: 'include' }
      );
      if (!allFactsResponse.ok) {
        throw new Error('Ошибка получения списка регламентных записей');
      }

      const allFactsData = await allFactsResponse.json();
      const factIdsToDelete = allFactsData.facts.map((f: any) => f.id);

      debugLog(`Deleting ${factIdsToDelete.length} recurring facts with recurring_plan_id=${recurringPlanId}`);

      // Use batch delete endpoint
      const response = await fetch('/api/v1/facts/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(factIdsToDelete),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP error! status: ${response.status}`);
      }

      // Reload recent transactions
      refreshDashboardWidgets();
      showToast(`Удалено ${factIdsToDelete.length} регламентных записей`, 'success');
    } else {
      // Delete single fact
      const response = await fetch(`/api/v1/facts/${factId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP error! status: ${response.status}`);
      }

      // Reload recent transactions
      refreshDashboardWidgets();
      showToast('Запись успешно удалена', 'success');
    }
  } catch (error) {
    console.error('Error deleting fact:', error);
    showToast('Ошибка удаления: ' + ((error as Error).message || String(error)), 'error');
  }
}

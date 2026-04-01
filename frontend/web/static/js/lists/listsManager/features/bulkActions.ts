/**
 * Bulk actions for shopping list items
 * Handles marking all as completed/uncompleted and deleting completed items
 */

// Импорты из других модулей
import { getState } from '../core/ListsState';
import { toggleItemCompleted, deleteMultipleItems } from '../core/listOperations';
import { renderCurrentView } from '../rendering/tableBuilder';

// Глобальные функции из base.html (типизированы в globals.d.ts)
declare const showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;

/**
 * Mark all items as completed
 */
export async function markAllCompleted(): Promise<void> {
  const state = getState();
  const uncompleted = state.currentItems.filter((item) => !item.is_completed);

  if (uncompleted.length === 0) {
    showToast('Все товары уже отмечены', 'info');
    return;
  }

  for (const item of uncompleted) {
    await toggleItemCompleted(item.id, true);
  }

  renderCurrentView();
  showToast(`Отмечено: ${uncompleted.length}`, 'success');
}

/**
 * Unmark all items
 */
export async function unmarkAllCompleted(): Promise<void> {
  const state = getState();
  const completed = state.currentItems.filter((item) => item.is_completed);

  if (completed.length === 0) {
    showToast('Нет отмеченных товаров', 'info');
    return;
  }

  for (const item of completed) {
    await toggleItemCompleted(item.id, false);
  }

  renderCurrentView();
  showToast(`Снято отметок: ${completed.length}`, 'success');
}

/**
 * Delete all completed items
 */
export async function deleteCompleted(): Promise<void> {
  const state = getState();
  const completedItems = state.currentItems.filter((item) => item.is_completed);

  if (completedItems.length === 0) {
    showToast('Нет выполненных товаров', 'info');
    return;
  }

  const itemIds = completedItems.map((i) => i.id);
  await deleteMultipleItems(itemIds, true);  // caller already confirmed

  renderCurrentView();
  showToast(`Удалено: ${completedItems.length}`, 'success');
}

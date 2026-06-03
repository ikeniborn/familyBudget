/**
 * Window Exports Adapters
 * Wrapper functions for onclick handlers that require confirmation dialogs
 */

// Импорты из модульной структуры
import {
  markAllCompleted,
  unmarkAllCompleted,
  deleteCompleted,
  toggleListsFAB,
  getState
} from '../index';

import {
  openEditListModal,
  closeEditListModal,
  handleEditList
} from '../ui/modalManager';

// Глобальные функции из base.html (типизированы в globals.d.ts)
declare const showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
declare const showConfirmDialog: (message: string, title?: string) => Promise<boolean>;

/**
 * Mark all items as completed - with confirmation dialog
 */
export async function markAllCompletedWithConfirm(): Promise<void> {
  toggleListsFAB(); // Close FAB first

  const state = getState();
  const uncompletedCount = state.currentItems.filter((item) => !item.is_completed).length;

  if (uncompletedCount === 0) {
    showToast('Все товары уже отмечены', 'info');
    return;
  }

  const confirmed = await showConfirmDialog(
    `Отметить все ${uncompletedCount} товаров как выполненные?`,
    '✅ Отметить все'
  );

  if (confirmed) {
    await markAllCompleted();
  }
}

/**
 * Unmark all items - with confirmation dialog
 */
export async function unmarkAllCompletedWithConfirm(): Promise<void> {
  toggleListsFAB(); // Close FAB first

  const state = getState();
  const completedCount = state.currentItems.filter((item) => item.is_completed).length;

  if (completedCount === 0) {
    showToast('Нет отмеченных товаров', 'info');
    return;
  }

  const confirmed = await showConfirmDialog(
    `Снять отметки с ${completedCount} товаров?`,
    '☐ Снять отметки'
  );

  if (confirmed) {
    await unmarkAllCompleted();
  }
}

/**
 * Delete all completed items - with confirmation dialog
 */
export async function deleteCompletedWithConfirm(): Promise<void> {
  toggleListsFAB(); // Close FAB first

  const state = getState();
  const completedItems = state.currentItems.filter((item) => item.is_completed);

  if (completedItems.length === 0) {
    showToast('Нет отмеченных товаров', 'info');
    return;
  }

  const confirmed = await showConfirmDialog(
    `Удалить ${completedItems.length} отмеченных товаров?\nЭто действие необратимо.`,
    '🗑️ Удаление товаров'
  );

  if (confirmed) {
    await deleteCompleted();
  }
}

// Edit list modal exports
(window as any).openEditListModal = openEditListModal;
(window as any).closeEditListModal = closeEditListModal;
(window as any).handleEditList = handleEditList;

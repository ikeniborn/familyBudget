/**
 * UI Adapter
 * Manages UI callbacks, toasts, and navbar badge updates
 *
 * Extracted from offlineManager.js:132-144, 316-329, 341-365
 */

import { getState, updateState } from '../core/OfflineState';

/**
 * Show toast with debouncing to prevent spam
 * Prevents showing multiple toasts during rapid network transitions
 *
 * @param message - Toast message
 * @param type - Toast type (success, warning, error, info)
 */
export function showToastDebounced(
  message: string,
  type: 'success' | 'warning' | 'error' | 'info'
): void {
  const state = getState();
  const now = Date.now();

  // Debounce to prevent spam during rapid network transitions
  if (now - state.lastToastTime < state.toastDebounceMs) {
    return; // Skip toast (too soon after last one)
  }

  // Show toast via global function
  if (typeof window !== 'undefined' && typeof (window as any).showToast === 'function') {
    (window as any).showToast(message, type);
    updateState({ lastToastTime: now });
  }
}

/**
 * Show offline save toast with action button
 * Special toast for offline save with "Enable offline mode" action
 */
export function showOfflineSaveToast(): void {
  const state = getState();
  const now = Date.now();

  // Debounce offline save toasts (3 seconds)
  const OFFLINE_SAVE_DEBOUNCE_MS = 3000;

  if (now - state.lastOfflineToastTime < OFFLINE_SAVE_DEBOUNCE_MS) {
    return; // Skip toast (too soon after last offline save)
  }

  // Show toast with action button via global function
  if (typeof window !== 'undefined' && typeof (window as any).showToastWithAction === 'function') {
    (window as any).showToastWithAction(
      'Сохранено локально. Синхронизируем при восстановлении связи.',
      'info',
      'Включить офлайн режим',
      () => {
        // Action callback - enable auto-offline mode
        if (typeof (window as any).offlineManager?.enableAutoOfflineMode === 'function') {
          (window as any).offlineManager.enableAutoOfflineMode();
        }
      }
    );

    updateState({ lastOfflineToastTime: now });
  } else if (typeof window !== 'undefined' && typeof (window as any).showToast === 'function') {
    // Fallback: show regular toast if showToastWithAction not available
    (window as any).showToast(
      'Сохранено локально. Синхронизируем при восстановлении связи.',
      'info'
    );

    updateState({ lastOfflineToastTime: now });
  }
}

/**
 * Update navbar badge with pending sync items count
 * Shows count of items waiting to be synced
 */
export async function updateNavbarBadge(): Promise<void> {
  // Check if global function exists
  if (typeof window === 'undefined' || typeof (window as any).updatePendingSyncBadge !== 'function') {
    return; // Function not available
  }

  const state = getState();

  try {
    // Get pending items count from database
    const pendingCount = await getPendingCount();

    // Update badge via global function
    (window as any).updatePendingSyncBadge(pendingCount, state.syncInProgress);
  } catch (error) {
    // Ignore errors in badge update (non-critical)
  }
}

/**
 * Show toast for sync completion
 * Called after successful sync to show results
 *
 * @param syncedCount - Number of successfully synced items
 * @param failedCount - Number of failed items
 */
export function showSyncCompleteToast(syncedCount: number, failedCount: number): void {
  if (syncedCount > 0 && failedCount === 0) {
    showToastDebounced(
      `Синхронизировано: ${syncedCount} записей`,
      'success'
    );
  } else if (syncedCount > 0 && failedCount > 0) {
    showToastDebounced(
      `Синхронизировано: ${syncedCount}, ошибок: ${failedCount}`,
      'warning'
    );
  } else if (failedCount > 0) {
    showToastDebounced(
      `Ошибок синхронизации: ${failedCount}`,
      'error'
    );
  }
}

/**
 * Show toast for network status change
 *
 * @param status - Network status (online, offline, degraded)
 */
export function showNetworkStatusToast(status: 'online' | 'offline' | 'degraded'): void {
  if (status === 'offline') {
    showToastDebounced('Работаем оффлайн', 'warning');
  } else if (status === 'online') {
    showToastDebounced('Соединение восстановлено', 'success');
  } else if (status === 'degraded') {
    showToastDebounced('Соединение нестабильно', 'warning');
  }
}

/**
 * Get pending items count from database
 * @private
 *
 * @returns Number of pending items in sync queue
 */
async function getPendingCount(): Promise<number> {
  const state = getState();

  try {
    if (state.db && typeof state.db.getPendingCount === 'function') {
      return await state.db.getPendingCount();
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Global function declarations
 * These are placeholders for TypeScript - actual implementations exist in window scope
 * Note: showToast is declared in networkStateManager.ts to avoid duplicate identifier
 */
declare global {
  interface Window {
    showToastWithAction?: (
      message: string,
      type: string,
      actionText: string,
      actionCallback: () => void
    ) => void;
    updatePendingSyncBadge?: (count: number, syncing: boolean) => void;
    offlineManager?: any;
  }
}

/**
 * Network State Manager
 * Coordinates network status changes between WebSocket, Sync, and UI
 *
 * Extracted from offlineManager.js:236-409
 */

import { getState, updateState } from './OfflineState';
import { syncAll } from '../sync/syncEngine';

/**
 * Handle network status change from SmartNetworkDetector
 * Main coordinator between WebSocket, Sync, Toast notifications
 *
 * @param newStatus - New network status (online, offline, degraded)
 * @param oldStatus - Previous network status
 */
export async function handleNetworkStatusChange(
  newStatus: 'online' | 'offline' | 'degraded',
  oldStatus: 'online' | 'offline' | 'degraded'
): Promise<void> {
  const state = getState();

  // Update state
  updateState({ networkStatus: newStatus });

  if (newStatus === 'offline') {
    // ========================================================================
    // Transition to OFFLINE
    // ========================================================================

    // Disconnect WebSocket to prevent reconnection attempts
    if (state.wsClient) {
      state.wsClient.setEnabled(false);
    }

    // Show offline toast (debounced)
    showToastDebounced('Работаем оффлайн', 'warning');

    // Dispatch offline event
    window.dispatchEvent(new CustomEvent('offline-status-change', {
      detail: { online: false, status: newStatus }
    }));

  } else if (oldStatus === 'offline' && (newStatus === 'online' || newStatus === 'degraded')) {
    // ========================================================================
    // Recovery from OFFLINE → ONLINE/DEGRADED
    // ========================================================================

    // Reconnect WebSocket
    if (state.wsClient) {
      state.wsClient.setEnabled(true);
    }

    // Sync pending items
    const syncResults = await syncAll();

    // Show combined toast with sync results
    if (syncResults.syncedCount > 0) {
      showToastDebounced(
        `Онлайн. Синхронизировано: ${syncResults.syncedCount} записей`,
        'success'
      );
    } else if (syncResults.failedCount > 0) {
      showToastDebounced(
        `Соединение восстановлено. Ошибок синхронизации: ${syncResults.failedCount}`,
        'warning'
      );
    } else {
      showToastDebounced('Соединение восстановлено', 'success');
    }

    // Dispatch recovery event
    window.dispatchEvent(new CustomEvent('offline-sync-complete', {
      detail: {
        status: newStatus,
        synced: syncResults.syncedCount,
        failed: syncResults.failedCount
      }
    }));

    // Update navbar badge
    if (typeof updatePendingSyncBadge === 'function') {
      const pendingCount = await getPendingCount();
      updatePendingSyncBadge(pendingCount, false);
    }

  } else if (newStatus === 'degraded' && oldStatus === 'online') {
    // ========================================================================
    // Degradation: ONLINE → DEGRADED
    // ========================================================================

    showToastDebounced('Соединение нестабильно', 'warning');

    // Dispatch degraded event
    window.dispatchEvent(new CustomEvent('offline-status-change', {
      detail: { online: true, status: newStatus }
    }));
  }

  // Dispatch generic status change event
  window.dispatchEvent(new CustomEvent('offline-status-change', {
    detail: { online: newStatus !== 'offline', status: newStatus }
  }));
}

/**
 * Handle online event (browser online)
 * Wrapper for handleNetworkStatusChange
 */
export async function handleOnline(): Promise<void> {
  await handleNetworkStatusChange('online', 'offline');
}

/**
 * Handle offline event (browser offline)
 * Wrapper for handleNetworkStatusChange
 */
export async function handleOffline(): Promise<void> {
  await handleNetworkStatusChange('offline', 'online');
}

/**
 * Handle auto-offline recovery
 * Called when automatic offline mode is enabled and network recovers
 */
export async function handleAutoOfflineRecovery(): Promise<void> {
  const state = getState();

  if (!state.autoOfflineMode) {
    return; // Auto-offline not enabled
  }

  // Disable auto-offline mode
  updateState({ autoOfflineMode: false });

  // Show recovery toast
  showToastDebounced('Автоматический офлайн режим отключён', 'info');

  // Trigger normal recovery
  await handleNetworkStatusChange('online', 'offline');
}

/**
 * Enable automatic offline mode
 * User manually switches to offline mode even when online
 */
export function enableAutoOfflineMode(): void {
  updateState({ autoOfflineMode: true });

  // Show confirmation toast
  showToastDebounced('Автоматический офлайн режим включён', 'info');

  // Dispatch event
  window.dispatchEvent(new CustomEvent('offline-mode-change', {
    detail: { autoOfflineMode: true }
  }));
}

/**
 * Show toast with debouncing to prevent spam
 * Uses global showToast function if available
 *
 * @param message - Toast message
 * @param type - Toast type (success, warning, error, info)
 */
function showToastDebounced(message: string, type: 'success' | 'warning' | 'error' | 'info'): void {
  const state = getState();
  const now = Date.now();
  const DEBOUNCE_MS = 10000; // 10 seconds

  // Debounce to prevent spam during rapid network transitions
  if (now - state.lastToastTime < DEBOUNCE_MS) {
    return;
  }

  if (typeof (window as any).showToast === 'function') {
    (window as any).showToast(message, type);
    updateState({ lastToastTime: now });
  }
}

/**
 * Get pending items count from sync queue
 * @private
 */
async function getPendingCount(): Promise<number> {
  const state = getState();

  try {
    return await state.db.getPendingCount();
  } catch (e) {
    return 0;
  }
}

/**
 * Global function declarations (defined elsewhere)
 * These are placeholders for TypeScript - actual implementations exist in window scope
 */
declare global {
  interface Window {
    showToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
    updatePendingSyncBadge?: (count: number, syncing: boolean) => void;
  }
}

// Ensure globals are available
declare function updatePendingSyncBadge(count: number, syncing: boolean): void;

/**
 * Pending Records Sync Operations
 *
 * Handles synchronization operations:
 * - Load and display pending records
 * - Retry failed items
 * - Delete failed/pending records
 * - Handle sync results
 */

import type { PendingRecord, SyncResults } from '../../types/dashboard.d';
import {
  isLoadInProgress,
  acquireLoadLock,
  releaseLoadLock,
  waitForExistingLock,
  getNextCallId,
} from './pendingState';
import {
  generateHTMLSync,
  generateHTMLAsync,
  shouldUseWorker,
} from './pendingRenderer';



declare const debugLog: (...args: any[]) => void;
// ============================================================================
// Load Pending Records
// ============================================================================

/**
 * Load and display pending records from sync queue
 * Implements deduplication to prevent race conditions
 */
export async function loadPendingRecords(): Promise<void> {
  const callId = getNextCallId();

  if (window.DEBUG_MODE) {
    debugLog(`[PENDING][DEDUP] loadPendingRecords called (call #${callId})`);
  }

  // Deduplication: If another call is in progress, wait for it
  if (isLoadInProgress()) {
    debugLog(`[PENDING][DEDUP] Call #${callId} waiting for existing operation`);
    await waitForExistingLock();
    if (window.DEBUG_MODE) {
      debugLog(`[PENDING][DEDUP] Call #${callId} completed (deduped)`);
    }
    return;
  }

  if (window.DEBUG_MODE) {
    debugLog(`[PENDING][DEDUP] Call #${callId} starting (first caller)`);
  }

  // Acquire lock
  const { resolve } = acquireLoadLock();

  try {
    await loadPendingRecordsImpl(callId);
  } finally {
    debugLog(`[PENDING][DEDUP] Call #${callId} releasing lock`);
    releaseLoadLock();
    resolve();
  }

  if (window.DEBUG_MODE) {
    debugLog(`[PENDING][DEDUP] Call #${callId} completed (executed)`);
  }
}

/**
 * Implementation of loadPendingRecords (internal)
 */
async function loadPendingRecordsImpl(callId: number): Promise<void> {
  if (window.DEBUG_MODE) {
    debugLog(`[PENDING] Starting implementation (call #${callId})...`);
  }

  const card = document.getElementById('pending-records-card');
  const tbody = document.getElementById('pending-records-tbody');
  const mobileList = document.getElementById('pending-records-mobile');
  const countBadge = document.getElementById('pending-count-badge');
  const actionsDiv = document.getElementById('pending-records-actions');
  const retryBtn = document.getElementById('retry-sync-btn');
  const deleteFailedBtn = document.getElementById('delete-failed-btn');

  debugLog('[loadPendingRecords] Card found:', !!card, 'Tbody found:', !!tbody, 'Mobile found:', !!mobileList);

  if (!card || !tbody || !mobileList) {
    debugLog('[loadPendingRecords] Card, tbody or mobileList not found');
    return;
  }

  if (!window.offlineManager) {
    debugLog('[loadPendingRecords] offlineManager not ready, retrying in 500ms...');
    setTimeout(() => loadPendingRecords(), 500);
    return;
  }

  debugLog('[loadPendingRecords] offlineManager ready, getting unsynced items...');

  try {
    // Get all unsynced items (pending + failed)
    const { items: pendingItems, hasRetryable, hasManualModeItems } = await window.offlineManager.getAllUnsyncedItems();

    debugLog('[loadPendingRecords] Found unsynced items:', pendingItems.length, 'hasRetryable:', hasRetryable, 'hasManualModeItems:', hasManualModeItems);

    // Update navbar pending sync badge
    if (typeof updatePendingSyncBadge === 'function') {
      updatePendingSyncBadge(pendingItems.length, false);
    }

    if (pendingItems.length === 0) {
      card.classList.add('hidden');
      if (actionsDiv) actionsDiv.classList.add('hidden');
      if (countBadge) countBadge.textContent = '0';
      return;
    }

    // Show the card
    card.classList.remove('hidden');

    // Show/hide buttons based on item types
    const showActions = hasRetryable;
    if (actionsDiv) {
      if (showActions) {
        actionsDiv.classList.remove('hidden');
      } else {
        actionsDiv.classList.add('hidden');
      }
    }

    // Retry button - show when there are failed items
    const hasFailed = pendingItems.some((item: PendingRecord) => item.status === 'failed');
    if (retryBtn) {
      if (hasRetryable) {
        retryBtn.classList.remove('hidden');
      } else {
        retryBtn.classList.add('hidden');
      }
    }

    // Delete failed button - show when there are failed items
    if (deleteFailedBtn) {
      if (hasFailed) {
        deleteFailedBtn.classList.remove('hidden');
      } else {
        deleteFailedBtn.classList.add('hidden');
      }
    }

    // Generate HTML using worker or sync based on item count
    const maxRetries = window.offlineManager?.maxRetries || 5;
    let result;

    if (shouldUseWorker(pendingItems.length)) {
      // Worker path (for large datasets)
      result = await generateHTMLAsync(pendingItems, maxRetries);

      debugLog(`[loadPendingRecords] Used worker for ${pendingItems.length} items`);
    } else {
      // Sync path (for small datasets)
      result = generateHTMLSync(pendingItems, maxRetries);

      if (window.DEBUG_MODE) {
        debugLog(`[loadPendingRecords] Small dataset (${pendingItems.length} items), used sync`);
      }
    }

    // Update DOM
    if (countBadge) countBadge.textContent = String(result.itemCount);
    tbody.innerHTML = result.desktopHTML;
    mobileList.innerHTML = result.mobileHTML;

  } catch (error) {
    console.error('[Pending Records] Error loading:', error);
  }
}

// ============================================================================
// Retry Operations
// ============================================================================

/**
 * Retry failed items (user clicks "Повторить" button)
 */
export async function retryFailedItems(): Promise<void> {
  if (!window.offlineManager) {
    showToast('Менеджер синхронизации недоступен', 'error');
    return;
  }

  const isOnline = navigator.onLine && window.offlineManager.isOnline;
  if (!isOnline) {
    showToast('Нет подключения к серверу', 'warning');
    return;
  }

  try {
    showToast('Повторная синхронизация...', 'info');
    // Sync ALL pending items
    const results = await window.offlineManager.sync();
    // Note: loadPendingRecords() is called automatically via
    // 'offline-sync-complete' event dispatched from syncAll()

    // Show appropriate message and refresh UI
    await handleSyncResults(results);
  } catch (error) {
    console.error('[Retry Sync] Error:', error);
    showToast('Ошибка синхронизации: ' + (error as Error).message, 'error');
  }
}

/**
 * Handle sync results - show toast and refresh UI
 */
export async function handleSyncResults(results: SyncResults): Promise<void> {
  if (results.synced > 0 && results.failed === 0) {
    showToast(`Синхронизировано: ${results.synced} записей`, 'success');
    // Reload recent records and metrics only if something was synced
    refreshDashboardWidgets();
  } else if (results.synced > 0 && results.failed > 0) {
    showToast(`Синхронизировано: ${results.synced}, ошибок: ${results.failed}`, 'warning');
    refreshDashboardWidgets();
  } else if (results.failed > 0) {
    showToast(`Ошибка синхронизации: ${results.failed} записей`, 'error');
  } else if (results.skipped) {
    showToast('Нечего синхронизировать', 'info');
  } else {
    showToast('Синхронизация завершена', 'success');
  }
}

/**
 * Refresh dashboard widgets after sync
 */
function refreshDashboardWidgets(): void {
  if (!window.htmx) return;

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

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Delete a single pending record
 */
export async function deletePendingRecord(itemId: number): Promise<void> {
  if (!window.offlineManager) {
    showToast('Менеджер синхронизации недоступен', 'error');
    return;
  }

  try {
    // Get item details to know which store to delete from
    const { items } = await window.offlineManager.getAllUnsyncedItems();
    const item = items.find((i: PendingRecord) => i.id === itemId);

    if (!item) {
      showToast('Запись не найдена', 'error');
      return;
    }

    // Delete from sync queue
    await window.offlineManager.db.deleteSyncQueueItem(itemId);

    // Delete from entity store (facts/transfers/plans)
    if (item.tempId) {
      if (item.entity === 'fact' || item.entity === 'plan' || item.entity === 'recurring') {
        await window.offlineManager.db.deleteFact(item.tempId);
      } else if (item.entity === 'transfer') {
        await window.offlineManager.db.deleteTransfer(item.tempId);
      }
    }

    showToast('Запись удалена', 'success');
    await loadPendingRecords();

  } catch (error) {
    console.error('[Delete Pending] Error:', error);
    showToast('Ошибка удаления: ' + (error as Error).message, 'error');
  }
}

/**
 * Delete failed records (user clicks "Удалить ошибочные" button)
 */
export async function deleteFailedRecords(): Promise<void> {
  if (!window.offlineManager) {
    showToast('Менеджер синхронизации недоступен', 'error');
    return;
  }

  // Confirm deletion
  if (!confirm('Удалить все записи с ошибками? Это действие нельзя отменить.')) {
    return;
  }

  try {
    const { items } = await window.offlineManager.getAllUnsyncedItems();
    const failedItems = items.filter((item: PendingRecord) => item.status === 'failed');

    if (failedItems.length === 0) {
      showToast('Нет ошибочных записей для удаления', 'info');
      return;
    }

    let deletedCount = 0;
    for (const item of failedItems) {
      // Delete from sync queue
      await window.offlineManager.db.deleteSyncQueueItem(item.id);

      // Delete from IndexedDB facts/transfers/plans store
      if (item.tempId) {
        if (item.entity === 'fact' || item.entity === 'plan') {
          await window.offlineManager.db.deleteFact(item.tempId);
        } else if (item.entity === 'transfer') {
          await window.offlineManager.db.deleteTransfer(item.tempId);
        }
      }
      deletedCount++;
    }

    showToast(`Удалено ${deletedCount} ошибочных записей`, 'success');
    await loadPendingRecords();

  } catch (error) {
    console.error('[Delete Failed] Error:', error);
    showToast('Ошибка удаления: ' + (error as Error).message, 'error');
  }
}

// ============================================================================
// Count Update
// ============================================================================

/**
 * Update pending count badge (called from other modules)
 */
export async function updatePendingCount(): Promise<number> {
  const countBadge = document.getElementById('pending-count-badge');
  const card = document.getElementById('pending-records-card');
  const actionsDiv = document.getElementById('pending-records-actions');
  const retryBtn = document.getElementById('retry-sync-btn');

  if (!countBadge || !window.offlineManager) {
    return 0;
  }

  try {
    const { items: pendingItems, hasRetryable } = await window.offlineManager.getAllUnsyncedItems();
    countBadge.textContent = String(pendingItems.length);

    // Update card visibility
    if (card) {
      if (pendingItems.length > 0) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    }

    // Show/hide action buttons based on item types
    const showActions = hasRetryable && pendingItems.length > 0;
    if (actionsDiv) {
      if (showActions) {
        actionsDiv.classList.remove('hidden');
      } else {
        actionsDiv.classList.add('hidden');
      }
    }

    // Retry button - show when there are failed items
    if (retryBtn) {
      if (hasRetryable) {
        retryBtn.classList.remove('hidden');
      } else {
        retryBtn.classList.add('hidden');
      }
    }

    return pendingItems.length;

  } catch (error) {
    // InvalidStateError: Connection closing is transient - ignore silently
    if ((error as Error).name === 'InvalidStateError') {
      if (window.DEBUG_MODE) {
        console.warn('[Pending Count] IndexedDB connection closing (transient)');
      }
      return 0;
    }
    console.error('[Pending Count] Error:', error);
    return 0;
  }
}

// ============================================================================
// Legacy Support
// ============================================================================

/**
 * Legacy function for backward compatibility
 */
export async function syncPendingRecords(): Promise<SyncResults | undefined> {
  if (!window.offlineManager) return undefined;
  return await window.offlineManager.sync();
}

/**
 * Notify user about pending records (without auto-sync)
 */
export async function notifyPendingRecords(): Promise<void> {
  if (!window.offlineManager) {
    return;
  }

  try {
    const pendingItems = await window.offlineManager.getPendingSyncItems();
    if (pendingItems.length > 0) {
      showToast(`Есть ${pendingItems.length} записей в ожидании синхронизации`, 'info');
      // Update UI
      await loadPendingRecords();
    }
  } catch (error) {
    debugLog('[notifyPendingRecords] Error:', error);
  }
}

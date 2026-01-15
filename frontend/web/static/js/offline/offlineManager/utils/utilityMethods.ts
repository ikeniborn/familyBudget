/**
 * Utility Methods
 * Helper functions for sync queue inspection and management
 *
 * Extracted from offlineManager.js:1615-1745
 *
 * These methods provide read-only access to sync queue state and help with
 * integration with Service Worker background sync.
 */

import { getState } from '../core/OfflineState';
import { updateNavbarBadge } from '../adapters/uiAdapter';
import { showToastDebounced } from '../adapters/uiAdapter';
import type { SyncQueueItem } from '../types/dependencies';

/**
 * Get count of pending sync items
 * Quick method to check how many items are waiting to sync
 *
 * @returns Number of pending items in sync queue
 *
 * @example
 * ```typescript
 * const count = await getPendingCount();
 * if (count > 0) {
 *   // Output: "5 items waiting to sync"
 * }
 * ```
 */
export async function getPendingCount(): Promise<number> {
  const state = getState();

  try {
    if (state.db && typeof state.db.getPendingCount === 'function') {
      return await state.db.getPendingCount();
    }
    return 0;
  } catch (error) {
    console.error('[OfflineManager] Failed to get pending count:', error);
    return 0;
  }
}

/**
 * Get detailed info about offline manager state
 * Diagnostic method for debugging and monitoring
 *
 * @returns State information object
 *
 * @example
 * ```typescript
 * const info = await getInfo();
 * // Output: { isInitialized: true, syncInProgress: false, networkStatus: 'online', ... }
 * ```
 */
export async function getInfo(): Promise<any> {
  const state = getState();

  try {
    if (state.db && typeof state.db.getInfo === 'function') {
      return await state.db.getInfo();
    }

    // Fallback: return basic state
    return {
      isInitialized: state.isInitialized,
      syncInProgress: state.syncInProgress,
      networkStatus: state.networkStatus,
      autoOfflineMode: state.autoOfflineMode,
      isNavigating: state.isNavigating,
      pendingCreatesCount: state.pendingCreates.size,
    };
  } catch (error) {
    console.error('[OfflineManager] Failed to get info:', error);
    return null;
  }
}

/**
 * Get single sync queue item by ID
 * Useful for inspecting specific failed items
 *
 * @param id - Sync queue item ID
 * @returns Sync queue item or null if not found
 *
 * @example
 * ```typescript
 * const item = await getSyncQueueItem(123);
 * if (item && item.status === 'failed') {
 *   // Handle failed item: item.error_message
 * }
 * ```
 */
export async function getSyncQueueItem(id: number): Promise<SyncQueueItem | null> {
  const state = getState();

  try {
    if (state.db && typeof state.db.getSyncQueueItem === 'function') {
      return await state.db.getSyncQueueItem(id);
    }
    return null;
  } catch (error) {
    console.error('[OfflineManager] Failed to get sync queue item:', error);
    return null;
  }
}

/**
 * Get all pending sync items
 * Returns only items with status='pending' (excludes failed)
 *
 * @returns Array of pending sync queue items
 *
 * @example
 * ```typescript
 * const pending = await getPendingSyncItems();
 * // Output: "5 items waiting to sync"
 * ```
 */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const state = getState();

  try {
    if (state.db && typeof state.db.getSyncQueue === 'function') {
      return await state.db.getSyncQueue('pending');
    }
    return [];
  } catch (error) {
    console.error('[OfflineManager] Failed to get pending sync items:', error);
    return [];
  }
}

/**
 * Get all unsynced items (pending + failed)
 * Comprehensive view of all items that need attention
 *
 * @returns Object with categorized sync queue items
 *
 * @example
 * ```typescript
 * const { items, pendingItems, failedItems, needsRetry } = await getAllUnsyncedItems();
 * // Output: Total unsynced: 7
 * // Pending: 5, Failed: 2
 * // Some items can be retried: true
 * ```
 */
export async function getAllUnsyncedItems(): Promise<{
  items: SyncQueueItem[];
  pendingItems: SyncQueueItem[];
  failedItems: SyncQueueItem[];
  needsRetry: boolean;
}> {
  const state = getState();

  try {
    if (state.db && typeof state.db.getSyncQueue === 'function') {
      const pendingItems = await state.db.getSyncQueue('pending');
      const failedItems = await state.db.getSyncQueue('failed');

      return {
        items: [...pendingItems, ...failedItems],
        pendingItems,
        failedItems,
        needsRetry: failedItems.some((item: SyncQueueItem) => item.retries < 5),
      };
    }

    return {
      items: [],
      pendingItems: [],
      failedItems: [],
      needsRetry: false,
    };
  } catch (error) {
    console.error('[OfflineManager] Failed to get all unsynced items:', error);
    return {
      items: [],
      pendingItems: [],
      failedItems: [],
      needsRetry: false,
    };
  }
}

/**
 * Update data of pending sync queue item
 * Allows modifying item data before sync (e.g., updating timestamps)
 *
 * @param itemId - Sync queue item ID
 * @param data - New data to set
 *
 * @example
 * ```typescript
 * await updatePendingItemData(123, { ...existingData, updated_at: Date.now() });
 * ```
 */
export async function updatePendingItemData(itemId: number, data: any): Promise<void> {
  const state = getState();

  try {
    if (state.db && typeof state.db.updateSyncQueueItem === 'function') {
      await state.db.updateSyncQueueItem(itemId, { data });
    }
  } catch (error) {
    console.error('[OfflineManager] Failed to update pending item data:', error);
    throw error;
  }
}

/**
 * Remove item from sync queue
 * Use with caution - removes item without syncing
 *
 * @param itemId - Sync queue item ID to remove
 *
 * @example
 * ```typescript
 * // Remove permanently failed item after manual server fix
 * await removePendingItem(123);
 * ```
 */
export async function removePendingItem(itemId: number): Promise<void> {
  const state = getState();

  try {
    if (state.db && typeof state.db.deleteSyncQueueItem === 'function') {
      await state.db.deleteSyncQueueItem(itemId);
    }
  } catch (error) {
    console.error('[OfflineManager] Failed to remove pending item:', error);
    throw error;
  }
}

/**
 * Handle sync completion event from Service Worker
 * Called when background sync completes (Chrome/Edge Background Sync API)
 *
 * Updates UI and shows notification about sync results
 *
 * @param data - Sync completion data
 * @param data.synced - Number of successfully synced items
 * @param data.failed - Number of failed items
 *
 * @example
 * ```typescript
 * // Called by Service Worker after background sync
 * self.addEventListener('sync', async (event) => {
 *   if (event.tag === 'budget-sync') {
 *     const results = await syncAllPendingItems();
 *     await handleSyncComplete({
 *       synced: results.successCount,
 *       failed: results.failedCount
 *     });
 *   }
 * });
 * ```
 */
export async function handleSyncComplete(data: { synced: number; failed: number }): Promise<void> {
  try {
    // Update navbar badge with new pending count
    await updateNavbarBadge();

    // Show toast notification about sync results
    if (data.synced > 0 && data.failed === 0) {
      showToastDebounced(`Синхронизировано: ${data.synced} записей`, 'success');
    } else if (data.synced > 0 && data.failed > 0) {
      showToastDebounced(
        `Синхронизировано: ${data.synced}, ошибок: ${data.failed}`,
        'warning'
      );
    } else if (data.failed > 0) {
      showToastDebounced(`Ошибок синхронизации: ${data.failed}`, 'error');
    }

    // Dispatch custom event for other parts of app
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('offline-sync-complete', {
          detail: {
            synced: data.synced,
            failed: data.failed,
            timestamp: Date.now(),
          },
        })
      );
    }
  } catch (error) {
    console.error('[OfflineManager] Failed to handle sync complete:', error);
  }
}

/**
 * Get summary of sync queue state
 * High-level overview for dashboard/debugging
 *
 * @returns Summary object with counts and status
 *
 * @example
 * ```typescript
 * const summary = await getSyncQueueSummary();
 * // Output: {
 * //   totalPending: 5,
 * //   totalFailed: 2,
 * //   needsRetry: true,
 * //   oldestPending: { id: 123, createdAt: 1234567890, ... }
 * // }
 * ```
 */
export async function getSyncQueueSummary(): Promise<{
  totalPending: number;
  totalFailed: number;
  needsRetry: boolean;
  oldestPending: SyncQueueItem | null;
}> {
  try {
    const { pendingItems, failedItems, needsRetry } = await getAllUnsyncedItems();

    // Find oldest pending item
    let oldestPending: SyncQueueItem | null = null;
    if (pendingItems.length > 0) {
      oldestPending = pendingItems.reduce((oldest, current) => {
        return current.createdAt < oldest.createdAt ? current : oldest;
      });
    }

    return {
      totalPending: pendingItems.length,
      totalFailed: failedItems.length,
      needsRetry,
      oldestPending,
    };
  } catch (error) {
    console.error('[OfflineManager] Failed to get sync queue summary:', error);
    return {
      totalPending: 0,
      totalFailed: 0,
      needsRetry: false,
      oldestPending: null,
    };
  }
}

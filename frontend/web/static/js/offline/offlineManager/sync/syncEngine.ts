/**
 * Sync Engine
 * Main orchestrator for synchronizing offline data with server
 *
 * Extracted from offlineManager.js:1026-1570 (SYNC section)
 */

import { getState, updateState } from '../core/OfflineState';
import { isOnline } from '../core/stateManager';
import type { SyncQueueItem } from '../types/dependencies';
import {
  syncCreate,
  syncUpdate,
  syncDelete,
  verifyOnServer,
  isNetworkError,
  calculateBackoffDelay,
} from './syncDetails';

/**
 * Sync all pending items
 * Returns sync result with counts
 */
export async function syncAll(): Promise<{ success: boolean; syncedCount: number; failedCount: number }> {
  const state = getState();

  // Prevent concurrent sync
  if (state.syncInProgress) {
    return { success: false, syncedCount: 0, failedCount: 0 };
  }

  // Check if online
  if (!isOnline()) {
    return { success: false, syncedCount: 0, failedCount: 0 };
  }

  updateState({ syncInProgress: true });

  try {
    const queue = await state.db.getSyncQueue('pending');

    if (queue.length === 0) {
      return { success: true, syncedCount: 0, failedCount: 0 };
    }

    // Sequential sync for small batches (<10), parallel for large batches
    const results = queue.length < 10
      ? await syncSequential(queue)
      : await syncParallel(queue);

    const syncedCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return { success: failedCount === 0, syncedCount, failedCount };
  } finally {
    updateState({ syncInProgress: false });
  }
}

/**
 * Sequential sync for small batches
 */
async function syncSequential(queue: SyncQueueItem[]): Promise<Array<{ success: boolean }>> {
  const results = [];

  for (const item of queue) {
    const result = await syncItem(item);
    results.push(result);
  }

  return results;
}

/**
 * Parallel sync for large batches (4 concurrent items, 100ms delay)
 */
async function syncParallel(queue: SyncQueueItem[]): Promise<Array<{ success: boolean }>> {
  const results = [];
  const batchSize = 4;

  for (let i = 0; i < queue.length; i += batchSize) {
    const batch = queue.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(item => syncItem(item)));
    results.push(...batchResults);

    // 100ms delay between batches
    if (i + batchSize < queue.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Sync single item
 * Advanced version with verification, retry logic, and error detection
 */
async function syncItem(item: SyncQueueItem): Promise<{ success: boolean }> {
  const state = getState();

  try {
    await state.db.updateSyncQueueItem(item.id, { status: 'syncing' });

    // Execute sync operation based on operation type
    let response: any;

    if (item.operation === 'create') {
      response = await syncCreate(item);

      // Verification after create
      const verified = await verifyOnServer(item, response);
      if (!verified) {
        throw new Error('Verification failed: Entity not found on server after create');
      }
    } else if (item.operation === 'update') {
      response = await syncUpdate(item);
    } else if (item.operation === 'delete') {
      await syncDelete(item);
      response = null; // DELETE doesn't return data
    } else {
      throw new Error(`Unknown operation: ${item.operation}`);
    }

    // Mark as completed
    await state.db.updateSyncQueueItem(item.id, {
      status: 'completed',
      completedAt: Date.now(),
    });

    // Delete from IndexedDB (cleanup local copy)
    if (item.operation === 'create') {
      await deleteLocalCopy(item.entity_type, item.tempId);
    }

    return { success: true };
  } catch (error) {
    // Determine error type and decide retry strategy
    const isNetwork = isNetworkError(error);
    const newRetries = item.retries + 1;
    const maxRetries = 5;

    if (isNetwork && newRetries < maxRetries) {
      // Network error - mark as pending for retry with backoff
      const backoffDelay = calculateBackoffDelay(newRetries);

      await state.db.updateSyncQueueItem(item.id, {
        status: 'pending',
        retries: newRetries,
        lastError: String(error),
        nextRetryAt: Date.now() + backoffDelay,
      });
    } else {
      // Application error or max retries exceeded - mark as failed
      await state.db.updateSyncQueueItem(item.id, {
        status: 'failed',
        retries: newRetries,
        lastError: String(error),
        failedAt: Date.now(),
      });
    }

    return { success: false };
  }
}

/**
 * Clear completed sync queue items
 * Removes items with status 'completed' older than retentionMs
 *
 * @param retentionMs - Keep completed items for this duration (default: 24 hours)
 * @returns Number of deleted items
 */
export async function clearCompletedSyncQueue(retentionMs: number = 24 * 60 * 60 * 1000): Promise<number> {
  const state = getState();
  const completedItems = await state.db.getSyncQueue('completed');

  const now = Date.now();
  let deletedCount = 0;

  for (const item of completedItems) {
    const completedAt = item.completedAt || item.updatedAt;
    const age = now - completedAt;

    if (age > retentionMs) {
      await state.db.deleteSyncQueueItem(item.id);
      deletedCount++;
    }
  }

  return deletedCount;
}

/**
 * Delete local copy after successful sync
 */
async function deleteLocalCopy(entityType: string, tempId: string): Promise<void> {
  const state = getState();

  const deleters: Record<string, (id: string) => Promise<void>> = {
    fact: state.db.deleteFact.bind(state.db),
    transfer: state.db.deleteTransfer.bind(state.db),
    plan: state.db.deletePlan.bind(state.db),
    recurring_plan: state.db.deleteRecurringPlan.bind(state.db),
  };

  const deleter = deleters[entityType];
  if (deleter) {
    await deleter(tempId);
  }
}

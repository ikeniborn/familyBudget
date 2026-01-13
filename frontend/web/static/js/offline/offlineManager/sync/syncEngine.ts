/**
 * Sync Engine
 * Main orchestrator for synchronizing offline data with server
 *
 * Extracted from offlineManager.js:1026-1570 (SYNC section)
 */

import { getState, updateState } from '../core/OfflineState';
import { isOnline } from '../core/stateManager';
import type { SyncQueueItem } from '../types/dependencies';

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
 */
async function syncItem(item: SyncQueueItem): Promise<{ success: boolean }> {
  const state = getState();

  try {
    await state.db.updateSyncQueueItem(item.id, { status: 'syncing' });

    // Send to server
    const endpoint = getEndpoint(item.entity_type);
    const response = await fetch(endpoint, {
      method: getMethod(item.operation),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item.data),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }

    // Mark as completed
    await state.db.updateSyncQueueItem(item.id, { status: 'completed' });

    // Delete from IndexedDB
    if (item.operation === 'create') {
      await deleteLocalCopy(item.entity_type, item.tempId);
    }

    return { success: true };
  } catch (error) {
    // Mark as failed
    await state.db.updateSyncQueueItem(item.id, {
      status: 'failed',
      retries: item.retries + 1,
      lastError: String(error),
    });

    return { success: false };
  }
}

/**
 * Get API endpoint for entity type
 */
function getEndpoint(entityType: string): string {
  const endpoints: Record<string, string> = {
    fact: '/api/v1/facts',
    transfer: '/api/v1/transfers',
    plan: '/api/v1/plans',
    recurring_plan: '/api/v1/recurring-plans',
  };
  return endpoints[entityType] || '/api/v1/facts';
}

/**
 * Get HTTP method for operation
 */
function getMethod(operation: string): string {
  const methods: Record<string, string> = {
    create: 'POST',
    update: 'PATCH',
    delete: 'DELETE',
  };
  return methods[operation] || 'POST';
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

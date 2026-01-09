/**
 * Offline Manager - Sync Queue Operations
 *
 * Basic operations for managing sync queue (add, status, processing strategy).
 *
 * Phase 3: Testing Infrastructure - Step 3.3
 * Extracted from: frontend/web/static/js/offline/offlineManager.ts
 */

import type { IndexedDBManager, SyncQueueEntry } from '../../idb';

// ============================================================================
// Type Definitions
// ============================================================================

export interface SyncQueueItem {
    id?: number;
    operation: 'create' | 'update' | 'delete';
    entityType: 'fact' | 'transfer' | 'plan' | 'recurring' | 'shopping_list' | 'shopping_item';
    data: any;
    tempId?: string;
    status: 'pending' | 'syncing' | 'completed' | 'failed';
    syncAttempts?: number;
    createdAt: number;
    updatedAt?: number;
}

export interface QueueStatus {
    total: number;
    pending: number;
    syncing: number;
    completed: number;
    failed: number;
    hasRetryable: boolean;
}

export interface SyncResult {
    synced: number;
    failed: number;
    needsRetry: boolean;
    items: Array<{
        id?: number;
        status: 'success' | 'error';
        entity?: string;
        operation?: string;
        error?: string;
    }>;
}

export interface SyncQueueOptions {
    parallelThreshold?: number;  // Use parallel processing for queues > this size
    batchSize?: number;           // Batch size for parallel processing
    batchDelay?: number;          // Delay between batches (ms)
}

// ============================================================================
// Queue Status Functions
// ============================================================================

/**
 * Get sync queue status and statistics
 *
 * @param db - IndexedDB manager instance
 * @returns Queue status with counts by status
 *
 * @example
 * ```typescript
 * const status = await getQueueStatus(db);
 * // status.pending: number of pending items
 * // status.failed: number of failed items
 * ```
 */
export async function getQueueStatus(db: IndexedDBManager): Promise<QueueStatus> {
    const allItems = await db.getSyncQueue();

    const status: QueueStatus = {
        total: allItems.length,
        pending: 0,
        syncing: 0,
        completed: 0,
        failed: 0,
        hasRetryable: false
    };

    for (const item of allItems) {
        switch (item.status) {
            case 'pending':
                status.pending++;
                status.hasRetryable = true;
                break;
            case 'syncing':
                status.syncing++;
                break;
            case 'completed':
                status.completed++;
                break;
            case 'failed':
                status.failed++;
                break;
        }
    }

    return status;
}

/**
 * Get count of pending items in sync queue
 *
 * @param db - IndexedDB manager instance
 * @returns Number of pending items
 */
export async function getPendingCount(db: IndexedDBManager): Promise<number> {
    const pendingItems = await db.getSyncQueue('pending');
    return pendingItems.length;
}

/**
 * Clear completed items from sync queue
 *
 * @param db - IndexedDB manager instance
 * @returns Number of items cleared
 */
export async function clearCompletedItems(db: IndexedDBManager): Promise<number> {
    return await db.clearCompletedSyncQueue();
}

// ============================================================================
// Queue Processing Strategy
// ============================================================================

/**
 * Determine optimal processing strategy based on queue size
 *
 * @param queueSize - Number of items in queue
 * @param options - Processing options
 * @returns Processing strategy ('sequential' or 'parallel')
 *
 * @example
 * ```typescript
 * const queue = await db.getSyncQueue('pending');
 * const strategy = getProcessingStrategy(queue.length);
 * // strategy = 'parallel' if queue.length > 10, else 'sequential'
 * ```
 */
export function getProcessingStrategy(
    queueSize: number,
    options: SyncQueueOptions = {}
): 'sequential' | 'parallel' {
    const threshold = options.parallelThreshold ?? 10;
    return queueSize > threshold ? 'parallel' : 'sequential';
}

/**
 * Calculate batch configuration for parallel processing
 *
 * @param queueSize - Number of items in queue
 * @param options - Processing options
 * @returns Batch configuration
 */
export function calculateBatchConfig(
    queueSize: number,
    options: SyncQueueOptions = {}
): {
    batchSize: number;
    batchCount: number;
    batchDelay: number;
} {
    const batchSize = options.batchSize ?? 4;
    const batchDelay = options.batchDelay ?? 100;
    const batchCount = Math.ceil(queueSize / batchSize);

    return {
        batchSize,
        batchCount,
        batchDelay
    };
}

// ============================================================================
// Queue Item Management
// ============================================================================

/**
 * Add item to sync queue
 *
 * @param db - IndexedDB manager instance
 * @param item - Sync queue item to add
 * @returns ID of added item
 *
 * @example
 * ```typescript
 * const id = await addToQueue(db, {
 *   operation: 'create',
 *   entityType: 'fact',
 *   data: { amount: 1000, ... },
 *   tempId: 'temp-123',
 *   status: 'pending',
 *   createdAt: Date.now()
 * });
 * ```
 */
export async function addToQueue(
    db: IndexedDBManager,
    item: Omit<SyncQueueItem, 'id'>
): Promise<number> {
    const queueItem: any = {
        operation: item.operation,
        entityType: item.entityType,
        data: item.data,
        tempId: item.tempId,
        status: item.status || 'pending',
        syncAttempts: item.syncAttempts || 0,
        timestamp: item.createdAt || Date.now()
    };

    return await db.addToSyncQueue(queueItem);
}

/**
 * Update sync queue item status
 *
 * @param db - IndexedDB manager instance
 * @param itemId - Item ID to update
 * @param updates - Fields to update
 *
 * @example
 * ```typescript
 * await updateQueueItem(db, 123, { status: 'completed' });
 * ```
 */
export async function updateQueueItem(
    db: IndexedDBManager,
    itemId: number,
    updates: Partial<SyncQueueItem>
): Promise<void> {
    const updateData: any = {};

    if (updates.status !== undefined) {
        updateData.status = updates.status;
    }
    if (updates.syncAttempts !== undefined) {
        updateData.syncAttempts = updates.syncAttempts;
    }
    if (updates.updatedAt !== undefined) {
        updateData.updatedAt = updates.updatedAt;
    }

    await db.updateSyncQueueItem(itemId, updateData);
}

/**
 * Mark item for retry after network error
 *
 * @param db - IndexedDB manager instance
 * @param itemId - Item ID to retry
 * @param currentAttempts - Current number of sync attempts
 * @returns Updated attempts count
 *
 * @example
 * ```typescript
 * const attempts = await markForRetry(db, 123, 0);
 * // attempts = 1
 * ```
 */
export async function markForRetry(
    db: IndexedDBManager,
    itemId: number,
    currentAttempts: number
): Promise<number> {
    const newAttempts = currentAttempts + 1;

    await updateQueueItem(db, itemId, {
        status: 'pending',
        syncAttempts: newAttempts,
        updatedAt: Date.now()
    });

    return newAttempts;
}

/**
 * Mark item as permanently failed
 *
 * @param db - IndexedDB manager instance
 * @param itemId - Item ID to mark as failed
 */
export async function markAsFailed(
    db: IndexedDBManager,
    itemId: number
): Promise<void> {
    await updateQueueItem(db, itemId, {
        status: 'failed',
        updatedAt: Date.now()
    });
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Check if error is network-related (retryable)
 *
 * @param error - Error object or message
 * @returns true if network error, false otherwise
 *
 * @example
 * ```typescript
 * try {
 *   await syncItem(item);
 * } catch (error) {
 *   if (isNetworkError(error)) {
 *     await markForRetry(db, item.id, item.syncAttempts);
 *   } else {
 *     await markAsFailed(db, item.id);
 *   }
 * }
 * ```
 */
export function isNetworkError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message || String(error);

    return (
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('network') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ETIMEDOUT')
    );
}

/**
 * Check if HTTP status code is retryable
 *
 * @param statusCode - HTTP status code
 * @returns true if retryable, false otherwise
 *
 * Retryable codes:
 * - 408 Request Timeout
 * - 429 Too Many Requests
 * - 500 Internal Server Error
 * - 502 Bad Gateway
 * - 503 Service Unavailable
 * - 504 Gateway Timeout
 */
export function isRetryableStatusCode(statusCode: number): boolean {
    return [408, 429, 500, 502, 503, 504].includes(statusCode);
}

// ============================================================================
// Queue Statistics
// ============================================================================

/**
 * Get detailed queue statistics (for monitoring/debugging)
 *
 * @param db - IndexedDB manager instance
 * @returns Detailed statistics
 */
export async function getQueueStatistics(db: IndexedDBManager): Promise<{
    status: QueueStatus;
    oldestPending?: SyncQueueEntry;
    failedItems: SyncQueueEntry[];
    retryableCount: number;
}> {
    const status = await getQueueStatus(db);
    const allItems = await db.getSyncQueue();

    const pendingItems = allItems.filter((item: any) => item.status === 'pending');
    const failedItems = allItems.filter((item: any) => item.status === 'failed');

    const oldestPending = pendingItems.length > 0
        ? pendingItems.reduce((oldest: any, current: any) =>
            current.timestamp < oldest.timestamp ? current : oldest
          )
        : undefined;

    const retryableCount = pendingItems.filter((item: any) =>
        (item.syncAttempts || 0) > 0
    ).length;

    return {
        status,
        oldestPending,
        failedItems,
        retryableCount
    };
}

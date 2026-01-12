import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    getQueueStatus,
    getPendingCount,
    clearCompletedItems,
    getProcessingStrategy,
    calculateBatchConfig,
    addToQueue,
    updateQueueItem,
    markForRetry,
    markAsFailed,
    isNetworkError,
    isRetryableStatusCode,
    getQueueStatistics,
    type SyncQueueItem,
    type QueueStatus
} from '@web/offline/offlineManager/operations/syncQueue';

// TODO: Enable when offlineManager is migrated to modular structure (Phase 2.1-2.5)
describe.skip('SyncQueue', () => {
    let mockDb: any;

    beforeEach(() => {
        mockDb = {
            getSyncQueue: vi.fn(),
            addToSyncQueue: vi.fn(),
            updateSyncQueueItem: vi.fn(),
            clearCompletedSyncQueue: vi.fn()
        };
    });

    describe('getQueueStatus', () => {
        it('should return empty status for empty queue', async () => {
            mockDb.getSyncQueue.mockResolvedValue([]);

            const status = await getQueueStatus(mockDb);

            expect(status).toEqual({
                total: 0,
                pending: 0,
                syncing: 0,
                completed: 0,
                failed: 0,
                hasRetryable: false
            });
        });

        it('should count items by status', async () => {
            const queueItems = [
                { id: 1, status: 'pending' },
                { id: 2, status: 'pending' },
                { id: 3, status: 'syncing' },
                { id: 4, status: 'completed' },
                { id: 5, status: 'completed' },
                { id: 6, status: 'completed' },
                { id: 7, status: 'failed' }
            ];

            mockDb.getSyncQueue.mockResolvedValue(queueItems);

            const status = await getQueueStatus(mockDb);

            expect(status).toEqual({
                total: 7,
                pending: 2,
                syncing: 1,
                completed: 3,
                failed: 1,
                hasRetryable: true
            });
        });

        it('should set hasRetryable to true when pending items exist', async () => {
            mockDb.getSyncQueue.mockResolvedValue([
                { id: 1, status: 'pending' }
            ]);

            const status = await getQueueStatus(mockDb);

            expect(status.hasRetryable).toBe(true);
        });

        it('should set hasRetryable to false when no pending items', async () => {
            mockDb.getSyncQueue.mockResolvedValue([
                { id: 1, status: 'completed' },
                { id: 2, status: 'failed' }
            ]);

            const status = await getQueueStatus(mockDb);

            expect(status.hasRetryable).toBe(false);
        });
    });

    describe('getPendingCount', () => {
        it('should return count of pending items', async () => {
            const pendingItems = [
                { id: 1, status: 'pending' },
                { id: 2, status: 'pending' },
                { id: 3, status: 'pending' }
            ];

            mockDb.getSyncQueue.mockResolvedValue(pendingItems);

            const count = await getPendingCount(mockDb);

            expect(count).toBe(3);
            expect(mockDb.getSyncQueue).toHaveBeenCalledWith('pending');
        });

        it('should return 0 when no pending items', async () => {
            mockDb.getSyncQueue.mockResolvedValue([]);

            const count = await getPendingCount(mockDb);

            expect(count).toBe(0);
        });
    });

    describe('clearCompletedItems', () => {
        it('should clear completed items and return count', async () => {
            mockDb.clearCompletedSyncQueue.mockResolvedValue(5);

            const count = await clearCompletedItems(mockDb);

            expect(count).toBe(5);
            expect(mockDb.clearCompletedSyncQueue).toHaveBeenCalled();
        });
    });

    describe('getProcessingStrategy', () => {
        it('should return sequential for small queues (<= 10 items)', () => {
            expect(getProcessingStrategy(5)).toBe('sequential');
            expect(getProcessingStrategy(10)).toBe('sequential');
        });

        it('should return parallel for large queues (> 10 items)', () => {
            expect(getProcessingStrategy(11)).toBe('parallel');
            expect(getProcessingStrategy(50)).toBe('parallel');
            expect(getProcessingStrategy(100)).toBe('parallel');
        });

        it('should respect custom parallel threshold', () => {
            expect(getProcessingStrategy(15, { parallelThreshold: 20 })).toBe('sequential');
            expect(getProcessingStrategy(21, { parallelThreshold: 20 })).toBe('parallel');
        });
    });

    describe('calculateBatchConfig', () => {
        it('should calculate batch configuration with defaults', () => {
            const config = calculateBatchConfig(16);

            expect(config).toEqual({
                batchSize: 4,
                batchCount: 4,  // 16 / 4 = 4 batches
                batchDelay: 100
            });
        });

        it('should round up batch count for uneven division', () => {
            const config = calculateBatchConfig(15);

            expect(config.batchCount).toBe(4);  // ceil(15 / 4) = 4
        });

        it('should respect custom batch size', () => {
            const config = calculateBatchConfig(20, { batchSize: 5 });

            expect(config).toEqual({
                batchSize: 5,
                batchCount: 4,  // 20 / 5 = 4 batches
                batchDelay: 100
            });
        });

        it('should respect custom batch delay', () => {
            const config = calculateBatchConfig(10, { batchDelay: 200 });

            expect(config.batchDelay).toBe(200);
        });
    });

    describe('addToQueue', () => {
        it('should add item to queue and return ID', async () => {
            mockDb.addToSyncQueue.mockResolvedValue(123);

            const item: Omit<SyncQueueItem, 'id'> = {
                operation: 'create',
                entityType: 'fact',
                data: { amount: 1000 },
                tempId: 'temp-1',
                status: 'pending',
                createdAt: Date.now()
            };

            const id = await addToQueue(mockDb, item);

            expect(id).toBe(123);
            expect(mockDb.addToSyncQueue).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'create',
                    entityType: 'fact',
                    data: { amount: 1000 },
                    tempId: 'temp-1',
                    status: 'pending'
                })
            );
        });

        it('should default status to pending if not provided', async () => {
            mockDb.addToSyncQueue.mockResolvedValue(456);

            const item = {
                operation: 'update' as const,
                entityType: 'fact' as const,
                data: {},
                createdAt: Date.now()
            };

            await addToQueue(mockDb, item);

            expect(mockDb.addToSyncQueue).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'pending' })
            );
        });

        it('should default syncAttempts to 0 if not provided', async () => {
            mockDb.addToSyncQueue.mockResolvedValue(789);

            const item: Omit<SyncQueueItem, 'id'> = {
                operation: 'delete',
                entityType: 'plan',
                data: {},
                status: 'pending',
                createdAt: Date.now()
            };

            await addToQueue(mockDb, item);

            expect(mockDb.addToSyncQueue).toHaveBeenCalledWith(
                expect.objectContaining({ syncAttempts: 0 })
            );
        });
    });

    describe('updateQueueItem', () => {
        it('should update item status', async () => {
            await updateQueueItem(mockDb, 123, { status: 'completed' });

            expect(mockDb.updateSyncQueueItem).toHaveBeenCalledWith(123, {
                status: 'completed'
            });
        });

        it('should update syncAttempts', async () => {
            await updateQueueItem(mockDb, 456, { syncAttempts: 3 });

            expect(mockDb.updateSyncQueueItem).toHaveBeenCalledWith(456, {
                syncAttempts: 3
            });
        });

        it('should update multiple fields', async () => {
            const now = Date.now();

            await updateQueueItem(mockDb, 789, {
                status: 'failed',
                syncAttempts: 5,
                updatedAt: now
            });

            expect(mockDb.updateSyncQueueItem).toHaveBeenCalledWith(789, {
                status: 'failed',
                syncAttempts: 5,
                updatedAt: now
            });
        });

        it('should ignore undefined fields', async () => {
            await updateQueueItem(mockDb, 111, {
                status: 'syncing'
                // syncAttempts and updatedAt are undefined
            });

            expect(mockDb.updateSyncQueueItem).toHaveBeenCalledWith(111, {
                status: 'syncing'
                // Only status is included
            });
        });
    });

    describe('markForRetry', () => {
        it('should increment sync attempts and set status to pending', async () => {
            const newAttempts = await markForRetry(mockDb, 123, 0);

            expect(newAttempts).toBe(1);
            expect(mockDb.updateSyncQueueItem).toHaveBeenCalledWith(123,
                expect.objectContaining({
                    status: 'pending',
                    syncAttempts: 1
                })
            );
        });

        it('should increment existing attempts', async () => {
            const newAttempts = await markForRetry(mockDb, 456, 2);

            expect(newAttempts).toBe(3);
            expect(mockDb.updateSyncQueueItem).toHaveBeenCalledWith(456,
                expect.objectContaining({
                    syncAttempts: 3
                })
            );
        });

        it('should set updatedAt timestamp', async () => {
            const beforeTime = Date.now();
            await markForRetry(mockDb, 789, 0);
            const afterTime = Date.now();

            const callArgs = mockDb.updateSyncQueueItem.mock.calls[0][1];
            expect(callArgs.updatedAt).toBeGreaterThanOrEqual(beforeTime);
            expect(callArgs.updatedAt).toBeLessThanOrEqual(afterTime);
        });
    });

    describe('markAsFailed', () => {
        it('should set status to failed', async () => {
            await markAsFailed(mockDb, 123);

            expect(mockDb.updateSyncQueueItem).toHaveBeenCalledWith(123,
                expect.objectContaining({
                    status: 'failed'
                })
            );
        });

        it('should set updatedAt timestamp', async () => {
            const beforeTime = Date.now();
            await markAsFailed(mockDb, 456);
            const afterTime = Date.now();

            const callArgs = mockDb.updateSyncQueueItem.mock.calls[0][1];
            expect(callArgs.updatedAt).toBeGreaterThanOrEqual(beforeTime);
            expect(callArgs.updatedAt).toBeLessThanOrEqual(afterTime);
        });
    });

    describe('isNetworkError', () => {
        it('should detect NetworkError', () => {
            expect(isNetworkError(new Error('NetworkError: Failed to connect'))).toBe(true);
        });

        it('should detect Failed to fetch', () => {
            expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
        });

        it('should detect timeout errors', () => {
            expect(isNetworkError(new Error('Request timeout'))).toBe(true);
            expect(isNetworkError(new Error('Connection timeout'))).toBe(true);
        });

        it('should detect ECONNREFUSED', () => {
            expect(isNetworkError(new Error('ECONNREFUSED'))).toBe(true);
        });

        it('should detect ETIMEDOUT', () => {
            expect(isNetworkError(new Error('ETIMEDOUT'))).toBe(true);
        });

        it('should return false for non-network errors', () => {
            expect(isNetworkError(new Error('Validation failed'))).toBe(false);
            expect(isNetworkError(new Error('Not found'))).toBe(false);
            expect(isNetworkError(new Error('Unauthorized'))).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(isNetworkError(null)).toBe(false);
            expect(isNetworkError(undefined)).toBe(false);
        });

        it('should handle error objects without message', () => {
            expect(isNetworkError({ toString: () => 'network error' })).toBe(true);
            expect(isNetworkError({ toString: () => 'other error' })).toBe(false);
        });
    });

    describe('isRetryableStatusCode', () => {
        it('should identify retryable 4xx codes', () => {
            expect(isRetryableStatusCode(408)).toBe(true); // Request Timeout
            expect(isRetryableStatusCode(429)).toBe(true); // Too Many Requests
        });

        it('should identify retryable 5xx codes', () => {
            expect(isRetryableStatusCode(500)).toBe(true); // Internal Server Error
            expect(isRetryableStatusCode(502)).toBe(true); // Bad Gateway
            expect(isRetryableStatusCode(503)).toBe(true); // Service Unavailable
            expect(isRetryableStatusCode(504)).toBe(true); // Gateway Timeout
        });

        it('should not identify non-retryable codes', () => {
            expect(isRetryableStatusCode(200)).toBe(false); // OK
            expect(isRetryableStatusCode(201)).toBe(false); // Created
            expect(isRetryableStatusCode(400)).toBe(false); // Bad Request
            expect(isRetryableStatusCode(401)).toBe(false); // Unauthorized
            expect(isRetryableStatusCode(404)).toBe(false); // Not Found
        });
    });

    describe('getQueueStatistics', () => {
        it('should return detailed statistics', async () => {
            const queueItems = [
                { id: 1, status: 'pending', timestamp: 1000, syncAttempts: 0 },
                { id: 2, status: 'pending', timestamp: 2000, syncAttempts: 1 },
                { id: 3, status: 'pending', timestamp: 1500, syncAttempts: 2 },
                { id: 4, status: 'completed', timestamp: 3000 },
                { id: 5, status: 'failed', timestamp: 4000 }
            ];

            mockDb.getSyncQueue.mockResolvedValue(queueItems);

            const stats = await getQueueStatistics(mockDb);

            expect(stats.status.total).toBe(5);
            expect(stats.status.pending).toBe(3);
            expect(stats.status.completed).toBe(1);
            expect(stats.status.failed).toBe(1);
            expect(stats.oldestPending).toEqual(queueItems[0]); // timestamp 1000
            expect(stats.failedItems).toEqual([queueItems[4]]);
            expect(stats.retryableCount).toBe(2); // Items with syncAttempts > 0
        });

        it('should handle empty queue', async () => {
            mockDb.getSyncQueue.mockResolvedValue([]);

            const stats = await getQueueStatistics(mockDb);

            expect(stats.status.total).toBe(0);
            expect(stats.oldestPending).toBeUndefined();
            expect(stats.failedItems).toEqual([]);
            expect(stats.retryableCount).toBe(0);
        });

        it('should identify oldest pending item correctly', async () => {
            const queueItems = [
                { id: 1, status: 'pending', timestamp: 3000 },
                { id: 2, status: 'pending', timestamp: 1000 },  // Oldest
                { id: 3, status: 'pending', timestamp: 2000 }
            ];

            mockDb.getSyncQueue.mockResolvedValue(queueItems);

            const stats = await getQueueStatistics(mockDb);

            expect(stats.oldestPending).toEqual(queueItems[1]);
        });

        it('should count retryable items (syncAttempts > 0)', async () => {
            const queueItems = [
                { id: 1, status: 'pending', syncAttempts: 0 },
                { id: 2, status: 'pending', syncAttempts: 1 },  // Retryable
                { id: 3, status: 'pending', syncAttempts: 3 },  // Retryable
                { id: 4, status: 'pending' }  // No syncAttempts field
            ];

            mockDb.getSyncQueue.mockResolvedValue(queueItems);

            const stats = await getQueueStatistics(mockDb);

            expect(stats.retryableCount).toBe(2);
        });
    });
});

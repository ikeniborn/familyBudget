import { describe, it, expect, beforeEach, vi } from 'vitest';
// DISABLED: Import fails before describe.skip() is evaluated
// Uncomment when offlineManager modular migration is complete (Phase 2.1-2.5)
/*
import {
    generateOperationKey,
    isOperationInProgress,
    getPendingOperation,
    registerOperation,
    unregisterOperation,
    executeWithDeduplication,
    checkContentDuplicate,
    getDeduplicationStats,
    clearDeduplicationCache
} from '@web/offline/offlineManager/operations/deduplication';
*/

// TODO: Enable when offlineManager is migrated to modular structure (Phase 2.1-2.5)
describe.skip('Deduplication', () => {
    beforeEach(() => {
        // Clear cache before each test
        clearDeduplicationCache();
    });

    describe('generateOperationKey', () => {
        it('should generate unique keys for same entity', () => {
            const key1 = generateOperationKey('fact', { amount: 1000 });
            const key2 = generateOperationKey('fact', { amount: 1000 });

            expect(key1).not.toBe(key2); // Different due to timestamp + random
            expect(key1).toMatch(/^fact_\d+_0\.\d+$/);
            expect(key2).toMatch(/^fact_\d+_0\.\d+$/);
        });

        it('should include entity type in key', () => {
            const factKey = generateOperationKey('fact', {});
            const transferKey = generateOperationKey('transfer', {});

            expect(factKey).toMatch(/^fact_/);
            expect(transferKey).toMatch(/^transfer_/);
        });

        it('should generate keys with timestamp and random components', () => {
            const key = generateOperationKey('fact', {});
            const parts = key.split('_');

            expect(parts).toHaveLength(3);
            expect(parts[0]).toBe('fact');
            expect(Number(parts[1])).toBeGreaterThan(0); // Timestamp
            expect(Number(parts[2])).toBeGreaterThan(0); // Random
            expect(Number(parts[2])).toBeLessThan(1);
        });
    });

    describe('operation tracking', () => {
        it('should track operation as in progress', () => {
            const key = 'test_123_456';
            const promise = Promise.resolve({ id: 1 });

            expect(isOperationInProgress(key)).toBe(false);

            registerOperation(key, promise);

            expect(isOperationInProgress(key)).toBe(true);
        });

        it('should retrieve pending operation', () => {
            const key = 'test_123_456';
            const promise = Promise.resolve({ id: 1 });

            registerOperation(key, promise);

            const pending = getPendingOperation(key);
            expect(pending).toBe(promise);
        });

        it('should return undefined for non-existent operation', () => {
            const pending = getPendingOperation('nonexistent');
            expect(pending).toBeUndefined();
        });

        it('should unregister completed operation', () => {
            const key = 'test_123_456';
            const promise = Promise.resolve({ id: 1 });

            registerOperation(key, promise);
            expect(isOperationInProgress(key)).toBe(true);

            unregisterOperation(key);
            expect(isOperationInProgress(key)).toBe(false);
        });
    });

    describe('executeWithDeduplication', () => {
        it('should execute operation when not in progress', async () => {
            const key = 'test_operation_1';
            const operation = vi.fn().mockResolvedValue({ id: 123 });

            const result = await executeWithDeduplication(key, operation);

            expect(operation).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ id: 123 });
            // Operation should be cleaned up after completion
            expect(isOperationInProgress(key)).toBe(false);
        });

        it('should return existing promise when operation in progress', async () => {
            const key = 'test_operation_2';
            const operation1 = vi.fn().mockResolvedValue({ id: 123 });
            const operation2 = vi.fn().mockResolvedValue({ id: 456 });

            // Start first operation (don't await yet)
            const promise1 = executeWithDeduplication(key, operation1);

            // Try second operation with same key (should deduplicate)
            const promise2 = executeWithDeduplication(key, operation2);

            // Wait for both
            const [result1, result2] = await Promise.all([promise1, promise2]);

            // First operation should be called
            expect(operation1).toHaveBeenCalledTimes(1);
            // Second operation should NOT be called (deduplicated)
            expect(operation2).not.toHaveBeenCalled();
            // Both should return same result
            expect(result1).toEqual({ id: 123 });
            expect(result2).toEqual({ id: 123 });
        });

        it('should cleanup after operation completion', async () => {
            const key = 'test_operation_3';
            const operation = vi.fn().mockResolvedValue({ id: 123 });

            expect(isOperationInProgress(key)).toBe(false);

            await executeWithDeduplication(key, operation);

            expect(isOperationInProgress(key)).toBe(false);
        });

        it('should cleanup even if operation fails', async () => {
            const key = 'test_operation_4';
            const operation = vi.fn().mockRejectedValue(new Error('Failed'));

            expect(isOperationInProgress(key)).toBe(false);

            try {
                await executeWithDeduplication(key, operation);
            } catch (error: any) {
                expect(error.message).toBe('Failed');
            }

            // Should cleanup even after failure
            expect(isOperationInProgress(key)).toBe(false);
        });

        it('should handle multiple sequential operations with same key', async () => {
            const key = 'test_operation_5';
            const operation1 = vi.fn().mockResolvedValue({ id: 1 });
            const operation2 = vi.fn().mockResolvedValue({ id: 2 });

            // First operation
            const result1 = await executeWithDeduplication(key, operation1);
            expect(result1).toEqual({ id: 1 });

            // Second operation (after first completes)
            const result2 = await executeWithDeduplication(key, operation2);
            expect(result2).toEqual({ id: 2 });

            // Both operations should be called
            expect(operation1).toHaveBeenCalledTimes(1);
            expect(operation2).toHaveBeenCalledTimes(1);
        });
    });

    describe('checkContentDuplicate', () => {
        it('should detect duplicate by content hash', async () => {
            const mockDb = {
                generateContentHash: vi.fn().mockReturnValue('hash_123'),
                checkDuplicateByHash: vi.fn().mockResolvedValue({
                    tempId: 'temp-1',
                    amount: 1000
                })
            };

            const data = { amount: 1000, description: 'Test' };
            const isDuplicate = await checkContentDuplicate(mockDb as any, data);

            expect(isDuplicate).toBe(true);
            expect(mockDb.generateContentHash).toHaveBeenCalledWith(data);
            expect(mockDb.checkDuplicateByHash).toHaveBeenCalledWith('hash_123');
        });

        it('should return false when no duplicate found', async () => {
            const mockDb = {
                generateContentHash: vi.fn().mockReturnValue('hash_456'),
                checkDuplicateByHash: vi.fn().mockResolvedValue(null)
            };

            const data = { amount: 2000, description: 'Unique' };
            const isDuplicate = await checkContentDuplicate(mockDb as any, data);

            expect(isDuplicate).toBe(false);
            expect(mockDb.generateContentHash).toHaveBeenCalledWith(data);
            expect(mockDb.checkDuplicateByHash).toHaveBeenCalledWith('hash_456');
        });

        it('should use db hash generation for consistency', async () => {
            const mockDb = {
                generateContentHash: vi.fn().mockReturnValue('custom_hash'),
                checkDuplicateByHash: vi.fn().mockResolvedValue(null)
            };

            await checkContentDuplicate(mockDb as any, { test: 'data' });

            expect(mockDb.generateContentHash).toHaveBeenCalledTimes(1);
        });
    });

    describe('getDeduplicationStats', () => {
        it('should return empty stats initially', () => {
            const stats = getDeduplicationStats();

            expect(stats.pendingCount).toBe(0);
            expect(stats.pendingKeys).toEqual([]);
        });

        it('should track pending operations count', () => {
            const key1 = 'op1';
            const key2 = 'op2';

            registerOperation(key1, Promise.resolve(1));
            registerOperation(key2, Promise.resolve(2));

            const stats = getDeduplicationStats();

            expect(stats.pendingCount).toBe(2);
            expect(stats.pendingKeys).toContain(key1);
            expect(stats.pendingKeys).toContain(key2);
        });

        it('should update stats after cleanup', () => {
            const key1 = 'op1';
            const key2 = 'op2';

            registerOperation(key1, Promise.resolve(1));
            registerOperation(key2, Promise.resolve(2));

            unregisterOperation(key1);

            const stats = getDeduplicationStats();

            expect(stats.pendingCount).toBe(1);
            expect(stats.pendingKeys).toEqual([key2]);
        });
    });

    describe('clearDeduplicationCache', () => {
        it('should clear all pending operations', () => {
            registerOperation('op1', Promise.resolve(1));
            registerOperation('op2', Promise.resolve(2));
            registerOperation('op3', Promise.resolve(3));

            let stats = getDeduplicationStats();
            expect(stats.pendingCount).toBe(3);

            clearDeduplicationCache();

            stats = getDeduplicationStats();
            expect(stats.pendingCount).toBe(0);
            expect(stats.pendingKeys).toEqual([]);
        });

        it('should allow re-registration after clear', () => {
            const key = 'test_op';

            registerOperation(key, Promise.resolve(1));
            expect(isOperationInProgress(key)).toBe(true);

            clearDeduplicationCache();
            expect(isOperationInProgress(key)).toBe(false);

            registerOperation(key, Promise.resolve(2));
            expect(isOperationInProgress(key)).toBe(true);
        });
    });

    describe('real-world deduplication scenarios', () => {
        it('should prevent duplicate creates during rapid clicks', async () => {
            // Use real timers for this test (async delays)
            vi.useRealTimers();

            const key = generateOperationKey('fact', { amount: 1000 });
            let callCount = 0;
            const createFact = vi.fn().mockImplementation(async () => {
                callCount++;
                // Simulate slow API call
                await new Promise(resolve => setTimeout(resolve, 10));
                return { id: 123 };
            });

            // Simulate 3 rapid clicks
            const results = await Promise.all([
                executeWithDeduplication(key, createFact),
                executeWithDeduplication(key, createFact),
                executeWithDeduplication(key, createFact)
            ]);

            // Only 1 API call should be made
            expect(createFact).toHaveBeenCalledTimes(1);
            // All should return same result
            expect(results).toEqual([
                { id: 123 },
                { id: 123 },
                { id: 123 }
            ]);

            // Restore fake timers
            vi.useFakeTimers();
        });

        it('should allow different operations to run in parallel', async () => {
            const key1 = generateOperationKey('fact', { amount: 1000 });
            const key2 = generateOperationKey('fact', { amount: 2000 });

            const op1 = vi.fn().mockResolvedValue({ id: 1 });
            const op2 = vi.fn().mockResolvedValue({ id: 2 });

            const results = await Promise.all([
                executeWithDeduplication(key1, op1),
                executeWithDeduplication(key2, op2)
            ]);

            // Both operations should execute
            expect(op1).toHaveBeenCalledTimes(1);
            expect(op2).toHaveBeenCalledTimes(1);
            expect(results).toEqual([{ id: 1 }, { id: 2 }]);
        });

        it('should handle deduplication across entity types', async () => {
            const factKey = generateOperationKey('fact', {});
            const transferKey = generateOperationKey('transfer', {});

            const factOp = vi.fn().mockResolvedValue({ id: 1 });
            const transferOp = vi.fn().mockResolvedValue({ id: 2 });

            const results = await Promise.all([
                executeWithDeduplication(factKey, factOp),
                executeWithDeduplication(transferKey, transferOp)
            ]);

            // Both should execute (different keys)
            expect(factOp).toHaveBeenCalledTimes(1);
            expect(transferOp).toHaveBeenCalledTimes(1);
            expect(results).toEqual([{ id: 1 }, { id: 2 }]);
        });
    });
});

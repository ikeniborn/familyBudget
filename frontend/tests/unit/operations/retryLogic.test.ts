import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    calculateRetryDelay,
    calculateRetrySchedule,
    shouldRetry,
    isRetryDue,
    getRetryDelay,
    filterDueRetries,
    getNextRetryTime,
    calculateRetryStats,
    addJitter,
    calculateRetryDelayWithJitter,
    executeWithRetry,
    type RetryConfig,
    type RetrySchedule
} from '@web/offline/offlineManager/operations/retryLogic';

// TODO: Enable when offlineManager is migrated to modular structure (Phase 2.1-2.5)
describe.skip('RetryLogic', () => {
    describe('calculateRetryDelay', () => {
        it('should calculate exponential backoff (default config)', () => {
            // Default: baseDelay=5000, multiplier=2, maxDelay=30000
            expect(calculateRetryDelay(0)).toBe(5000);   // 5s * 2^0 = 5s
            expect(calculateRetryDelay(1)).toBe(10000);  // 5s * 2^1 = 10s
            expect(calculateRetryDelay(2)).toBe(20000);  // 5s * 2^2 = 20s
            expect(calculateRetryDelay(3)).toBe(30000);  // 5s * 2^3 = 40s (capped at 30s)
            expect(calculateRetryDelay(4)).toBe(30000);  // 5s * 2^4 = 80s (capped at 30s)
        });

        it('should respect custom base delay', () => {
            const config: Partial<RetryConfig> = { baseDelay: 2000 };

            expect(calculateRetryDelay(0, config)).toBe(2000);  // 2s
            expect(calculateRetryDelay(1, config)).toBe(4000);  // 4s
            expect(calculateRetryDelay(2, config)).toBe(8000);  // 8s
        });

        it('should respect custom multiplier', () => {
            const config: Partial<RetryConfig> = {
                baseDelay: 1000,
                multiplier: 3
            };

            expect(calculateRetryDelay(0, config)).toBe(1000);  // 1s * 3^0 = 1s
            expect(calculateRetryDelay(1, config)).toBe(3000);  // 1s * 3^1 = 3s
            expect(calculateRetryDelay(2, config)).toBe(9000);  // 1s * 3^2 = 9s
        });

        it('should cap delay at maxDelay', () => {
            const config: Partial<RetryConfig> = {
                baseDelay: 5000,
                maxDelay: 15000
            };

            expect(calculateRetryDelay(2, config)).toBe(15000);  // 20s capped to 15s
            expect(calculateRetryDelay(3, config)).toBe(15000);  // 40s capped to 15s
        });
    });

    describe('calculateRetrySchedule', () => {
        it('should calculate schedule for first retry', () => {
            const schedule = calculateRetrySchedule(0);

            expect(schedule.attempt).toBe(1);
            expect(schedule.delay).toBe(5000);
            expect(schedule.shouldRetry).toBe(true);
            expect(schedule.nextRetryAt).toBeGreaterThan(Date.now());
        });

        it('should calculate schedule for subsequent retries', () => {
            const schedule1 = calculateRetrySchedule(1);
            expect(schedule1.delay).toBe(10000);  // 2nd attempt = 10s

            const schedule2 = calculateRetrySchedule(2);
            expect(schedule2.delay).toBe(20000);  // 3rd attempt = 20s
        });

        it('should indicate no retry when max attempts reached', () => {
            const schedule = calculateRetrySchedule(5);  // Default maxAttempts = 5

            expect(schedule.shouldRetry).toBe(false);
            expect(schedule.delay).toBe(0);
            expect(schedule.nextRetryAt).toBe(0);
        });

        it('should respect custom max attempts', () => {
            const schedule = calculateRetrySchedule(2, { maxAttempts: 3 });

            expect(schedule.shouldRetry).toBe(true);  // 3rd attempt allowed

            const scheduleMax = calculateRetrySchedule(3, { maxAttempts: 3 });
            expect(scheduleMax.shouldRetry).toBe(false);  // 4th attempt not allowed
        });
    });

    describe('shouldRetry', () => {
        it('should allow retry within max attempts', () => {
            expect(shouldRetry(0)).toBe(true);  // 1st attempt
            expect(shouldRetry(1)).toBe(true);  // 2nd attempt
            expect(shouldRetry(4)).toBe(true);  // 5th attempt (last)
        });

        it('should deny retry after max attempts', () => {
            expect(shouldRetry(5)).toBe(false);  // 6th attempt (default max = 5)
            expect(shouldRetry(10)).toBe(false);
        });

        it('should respect custom max attempts', () => {
            expect(shouldRetry(2, { maxAttempts: 3 })).toBe(true);
            expect(shouldRetry(3, { maxAttempts: 3 })).toBe(false);
        });
    });

    describe('isRetryDue', () => {
        it('should return true for past timestamps', () => {
            const pastTime = Date.now() - 1000;  // 1 second ago
            expect(isRetryDue(pastTime)).toBe(true);
        });

        it('should return false for future timestamps', () => {
            const futureTime = Date.now() + 5000;  // 5 seconds from now
            expect(isRetryDue(futureTime)).toBe(false);
        });

        it('should return true for current time (edge case)', () => {
            const now = Date.now();
            expect(isRetryDue(now)).toBe(true);
        });
    });

    describe('getRetryDelay', () => {
        it('should return remaining time until retry', () => {
            const futureTime = Date.now() + 3000;  // 3 seconds from now
            const delay = getRetryDelay(futureTime);

            expect(delay).toBeGreaterThan(2900);  // ~3s (accounting for execution time)
            expect(delay).toBeLessThanOrEqual(3000);
        });

        it('should return 0 for past timestamps', () => {
            const pastTime = Date.now() - 1000;
            expect(getRetryDelay(pastTime)).toBe(0);
        });

        it('should return 0 for overdue retries', () => {
            const veryPastTime = Date.now() - 10000;  // 10 seconds ago
            expect(getRetryDelay(veryPastTime)).toBe(0);
        });
    });

    describe('filterDueRetries', () => {
        it('should filter items due for retry', () => {
            const now = Date.now();
            const items = [
                { id: 1, nextRetryAt: now - 1000 },   // Overdue
                { id: 2, nextRetryAt: now - 500 },    // Overdue
                { id: 3, nextRetryAt: now + 5000 },   // Future
                { id: 4, nextRetryAt: now + 10000 }   // Future
            ];

            const dueItems = filterDueRetries(items);

            expect(dueItems).toHaveLength(2);
            expect(dueItems[0].id).toBe(1);
            expect(dueItems[1].id).toBe(2);
        });

        it('should return empty array when no items are due', () => {
            const items = [
                { id: 1, nextRetryAt: Date.now() + 5000 },
                { id: 2, nextRetryAt: Date.now() + 10000 }
            ];

            const dueItems = filterDueRetries(items);

            expect(dueItems).toEqual([]);
        });

        it('should handle items without nextRetryAt', () => {
            const items = [
                { id: 1, nextRetryAt: Date.now() - 1000 },
                { id: 2 },  // No nextRetryAt
                { id: 3, nextRetryAt: undefined }
            ];

            const dueItems = filterDueRetries(items);

            expect(dueItems).toHaveLength(1);
            expect(dueItems[0].id).toBe(1);
        });
    });

    describe('getNextRetryTime', () => {
        it('should return earliest future retry time', () => {
            const now = Date.now();
            const items = [
                { id: 1, nextRetryAt: now + 10000 },  // 10s
                { id: 2, nextRetryAt: now + 5000 },   // 5s (earliest)
                { id: 3, nextRetryAt: now + 15000 }   // 15s
            ];

            const nextTime = getNextRetryTime(items);

            expect(nextTime).toBe(now + 5000);
        });

        it('should return null when no items scheduled', () => {
            const items: Array<{ id: number; nextRetryAt?: number }> = [
                { id: 1 },
                { id: 2, nextRetryAt: undefined }
            ];

            const nextTime = getNextRetryTime(items);

            expect(nextTime).toBeNull();
        });

        it('should ignore past retry times', () => {
            const now = Date.now();
            const items = [
                { id: 1, nextRetryAt: now - 1000 },   // Past (ignored)
                { id: 2, nextRetryAt: now + 5000 },   // Future
                { id: 3, nextRetryAt: now - 500 }     // Past (ignored)
            ];

            const nextTime = getNextRetryTime(items);

            expect(nextTime).toBe(now + 5000);
        });

        it('should return null when all retries are overdue', () => {
            const now = Date.now();
            const items = [
                { id: 1, nextRetryAt: now - 1000 },
                { id: 2, nextRetryAt: now - 2000 }
            ];

            const nextTime = getNextRetryTime(items);

            expect(nextTime).toBeNull();
        });
    });

    describe('calculateRetryStats', () => {
        it('should calculate statistics for items with retries', () => {
            const items = [
                { id: 1, syncAttempts: 0 },
                { id: 2, syncAttempts: 1 },
                { id: 3, syncAttempts: 2 },
                { id: 4, syncAttempts: 3 },
                { id: 5, syncAttempts: 0 }
            ];

            const stats = calculateRetryStats(items);

            expect(stats.totalItems).toBe(5);
            expect(stats.itemsWithRetries).toBe(3);  // Items with syncAttempts > 0
            expect(stats.totalAttempts).toBe(6);     // 0+1+2+3+0
            expect(stats.averageAttempts).toBe(1.2); // 6/5
            expect(stats.maxAttempts).toBe(3);
        });

        it('should handle items without syncAttempts field', () => {
            const items = [
                { id: 1, syncAttempts: 2 },
                { id: 2 },  // No syncAttempts (treated as 0)
                { id: 3, syncAttempts: undefined }  // undefined (treated as 0)
            ];

            const stats = calculateRetryStats(items);

            expect(stats.totalItems).toBe(3);
            expect(stats.itemsWithRetries).toBe(1);
            expect(stats.totalAttempts).toBe(2);
            expect(stats.averageAttempts).toBeCloseTo(0.67, 1);
            expect(stats.maxAttempts).toBe(2);
        });

        it('should return zeros for empty array', () => {
            const stats = calculateRetryStats([]);

            expect(stats.totalItems).toBe(0);
            expect(stats.itemsWithRetries).toBe(0);
            expect(stats.totalAttempts).toBe(0);
            expect(stats.averageAttempts).toBe(0);
            expect(stats.maxAttempts).toBe(0);
        });
    });

    describe('addJitter', () => {
        it('should add jitter within specified percentage', () => {
            const delay = 10000;  // 10 seconds
            const jitterPercent = 10;  // ±10%

            // Run multiple times to test randomness
            for (let i = 0; i < 100; i++) {
                const withJitter = addJitter(delay, jitterPercent);

                expect(withJitter).toBeGreaterThanOrEqual(9000);   // -10%
                expect(withJitter).toBeLessThanOrEqual(11000);     // +10%
            }
        });

        it('should use default 10% jitter when not specified', () => {
            const delay = 5000;

            for (let i = 0; i < 100; i++) {
                const withJitter = addJitter(delay);

                expect(withJitter).toBeGreaterThanOrEqual(4500);
                expect(withJitter).toBeLessThanOrEqual(5500);
            }
        });

        it('should return rounded integer', () => {
            const delay = 7500;
            const withJitter = addJitter(delay, 10);

            expect(withJitter).toBe(Math.round(withJitter));
        });
    });

    describe('calculateRetryDelayWithJitter', () => {
        it('should combine exponential backoff with jitter', () => {
            const attempts = 1;  // Should give 10s base delay

            for (let i = 0; i < 100; i++) {
                const delay = calculateRetryDelayWithJitter(attempts);

                // 10s ±10% = 9s-11s
                expect(delay).toBeGreaterThanOrEqual(9000);
                expect(delay).toBeLessThanOrEqual(11000);
            }
        });

        it('should respect custom jitter percentage', () => {
            const attempts = 0;  // 5s base delay

            for (let i = 0; i < 100; i++) {
                const delay = calculateRetryDelayWithJitter(attempts, {}, 20);

                // 5s ±20% = 4s-6s
                expect(delay).toBeGreaterThanOrEqual(4000);
                expect(delay).toBeLessThanOrEqual(6000);
            }
        });
    });

    describe('executeWithRetry', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        it('should succeed on first attempt', async () => {
            const operation = vi.fn().mockResolvedValue({ success: true });

            const result = await executeWithRetry(operation);

            expect(result).toEqual({ success: true });
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('should retry on failure and eventually succeed', async () => {
            vi.useRealTimers();  // Use real timers for async delays

            const operation = vi.fn()
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Timeout'))
                .mockResolvedValueOnce({ success: true });

            const resultPromise = executeWithRetry(operation, {
                baseDelay: 10,  // Very short delay for testing
                maxAttempts: 5
            });

            const result = await resultPromise;

            expect(result).toEqual({ success: true });
            expect(operation).toHaveBeenCalledTimes(3);

            vi.useFakeTimers();  // Restore fake timers
        });

        it('should throw after max attempts exhausted', async () => {
            vi.useRealTimers();

            const operation = vi.fn().mockRejectedValue(new Error('Permanent failure'));

            await expect(
                executeWithRetry(operation, {
                    baseDelay: 10,
                    maxAttempts: 3
                })
            ).rejects.toThrow('Operation failed after 3 attempts');

            expect(operation).toHaveBeenCalledTimes(3);

            vi.useFakeTimers();
        });

        it('should include last error message in final error', async () => {
            vi.useRealTimers();

            const operation = vi.fn().mockRejectedValue(new Error('Custom error'));

            await expect(
                executeWithRetry(operation, {
                    baseDelay: 10,
                    maxAttempts: 2
                })
            ).rejects.toThrow('Last error: Custom error');

            vi.useFakeTimers();
        });
    });
});

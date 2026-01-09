/**
 * Offline Manager - Retry Logic
 *
 * Exponential backoff retry mechanism for failed sync operations.
 *
 * Phase 3: Testing Infrastructure - Step 3.4
 * Extracted from: frontend/web/static/js/offline/offlineManager.ts
 */

// Silent logger - only in debug mode
const _retryLog = window.DEBUG_MODE ? console.log.bind(console) : function() {};

// ============================================================================
// Type Definitions
// ============================================================================

export interface RetryConfig {
    baseDelay: number;        // Base delay in ms (e.g., 5000 = 5s)
    maxDelay: number;         // Maximum delay in ms (e.g., 30000 = 30s)
    maxAttempts: number;      // Maximum retry attempts (e.g., 5)
    multiplier: number;       // Backoff multiplier (e.g., 2 for doubling)
}

export interface RetrySchedule {
    attempt: number;
    delay: number;
    nextRetryAt: number;
    shouldRetry: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    baseDelay: 5000,      // 5 seconds
    maxDelay: 30000,      // 30 seconds
    maxAttempts: 5,       // 5 attempts total
    multiplier: 2         // Double each time
};

// ============================================================================
// Retry Delay Calculation
// ============================================================================

/**
 * Calculate exponential backoff delay
 *
 * Formula: delay = min(baseDelay * (multiplier ^ attempts), maxDelay)
 *
 * Example with baseDelay=5000, multiplier=2:
 * - Attempt 1: 5s  (5000 * 2^0 = 5000)
 * - Attempt 2: 10s (5000 * 2^1 = 10000)
 * - Attempt 3: 20s (5000 * 2^2 = 20000)
 * - Attempt 4: 30s (5000 * 2^3 = 40000, capped at maxDelay)
 * - Attempt 5: 30s (capped)
 *
 * @param attempts - Number of failed attempts (0-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(
    attempts: number,
    config: Partial<RetryConfig> = {}
): number {
    const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };

    // Calculate exponential delay
    const delay = cfg.baseDelay * Math.pow(cfg.multiplier, attempts);

    // Cap at maximum delay
    return Math.min(delay, cfg.maxDelay);
}

/**
 * Calculate retry schedule for an item
 *
 * @param currentAttempts - Current number of attempts
 * @param config - Retry configuration
 * @returns Retry schedule with delay and next retry time
 */
export function calculateRetrySchedule(
    currentAttempts: number,
    config: Partial<RetryConfig> = {}
): RetrySchedule {
    const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };

    const shouldRetry = currentAttempts < cfg.maxAttempts;
    const delay = shouldRetry ? calculateRetryDelay(currentAttempts, cfg) : 0;
    const nextRetryAt = shouldRetry ? Date.now() + delay : 0;

    return {
        attempt: currentAttempts + 1,
        delay,
        nextRetryAt,
        shouldRetry
    };
}

// ============================================================================
// Retry Decision Logic
// ============================================================================

/**
 * Determine if item should be retried
 *
 * @param attempts - Current number of attempts
 * @param config - Retry configuration
 * @returns true if should retry, false if max attempts reached
 */
export function shouldRetry(
    attempts: number,
    config: Partial<RetryConfig> = {}
): boolean {
    const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
    return attempts < cfg.maxAttempts;
}

/**
 * Check if retry is due (enough time has passed)
 *
 * @param nextRetryAt - Timestamp of next scheduled retry
 * @returns true if retry is due, false if still waiting
 */
export function isRetryDue(nextRetryAt: number): boolean {
    return Date.now() >= nextRetryAt;
}

/**
 * Get time remaining until next retry
 *
 * @param nextRetryAt - Timestamp of next scheduled retry
 * @returns Milliseconds until retry (0 if overdue)
 */
export function getRetryDelay(nextRetryAt: number): number {
    const remaining = nextRetryAt - Date.now();
    return Math.max(0, remaining);
}

// ============================================================================
// Retry Queue Management
// ============================================================================

/**
 * Filter items that are due for retry
 *
 * @param items - Array of items with nextRetryAt timestamps
 * @returns Items that are ready to retry
 */
export function filterDueRetries<T extends { nextRetryAt?: number }>(
    items: T[]
): T[] {
    const now = Date.now();
    return items.filter(item =>
        item.nextRetryAt !== undefined && item.nextRetryAt <= now
    );
}

/**
 * Find next scheduled retry time from a list of items
 *
 * @param items - Array of items with nextRetryAt timestamps
 * @returns Timestamp of next retry, or null if none scheduled
 */
export function getNextRetryTime<T extends { nextRetryAt?: number }>(
    items: T[]
): number | null {
    const scheduledItems = items.filter(item =>
        item.nextRetryAt !== undefined && item.nextRetryAt > Date.now()
    );

    if (scheduledItems.length === 0) {
        return null;
    }

    return Math.min(...scheduledItems.map(item => item.nextRetryAt!));
}

// ============================================================================
// Retry Statistics
// ============================================================================

/**
 * Calculate retry statistics for monitoring
 *
 * @param items - Array of items with attempt counts
 * @returns Retry statistics
 */
export function calculateRetryStats<T extends { syncAttempts?: number }>(
    items: T[]
): {
    totalItems: number;
    itemsWithRetries: number;
    totalAttempts: number;
    averageAttempts: number;
    maxAttempts: number;
} {
    const totalItems = items.length;
    const itemsWithRetries = items.filter(item => (item.syncAttempts ?? 0) > 0).length;
    const totalAttempts = items.reduce((sum, item) => sum + (item.syncAttempts ?? 0), 0);
    const averageAttempts = totalItems > 0 ? totalAttempts / totalItems : 0;
    const maxAttempts = items.reduce(
        (max, item) => Math.max(max, item.syncAttempts ?? 0),
        0
    );

    return {
        totalItems,
        itemsWithRetries,
        totalAttempts,
        averageAttempts,
        maxAttempts
    };
}

// ============================================================================
// Jitter (Optional)
// ============================================================================

/**
 * Add random jitter to delay to prevent thundering herd
 *
 * @param delay - Base delay in milliseconds
 * @param jitterPercent - Jitter percentage (0-100), e.g. 10 = ±10%
 * @returns Delay with jitter applied
 *
 * @example
 * ```typescript
 * const delay = 5000;  // 5 seconds
 * const withJitter = addJitter(delay, 10);  // 4500-5500ms (±10%)
 * ```
 */
export function addJitter(delay: number, jitterPercent: number = 10): number {
    const jitterAmount = delay * (jitterPercent / 100);
    const randomJitter = (Math.random() * 2 - 1) * jitterAmount;  // -jitter to +jitter
    return Math.round(delay + randomJitter);
}

/**
 * Calculate retry delay with jitter (exponential backoff + randomization)
 *
 * @param attempts - Number of failed attempts
 * @param config - Retry configuration
 * @param jitterPercent - Jitter percentage (default 10%)
 * @returns Delay with jitter in milliseconds
 */
export function calculateRetryDelayWithJitter(
    attempts: number,
    config: Partial<RetryConfig> = {},
    jitterPercent: number = 10
): number {
    const baseDelay = calculateRetryDelay(attempts, config);
    return addJitter(baseDelay, jitterPercent);
}

// ============================================================================
// Retry Execution Helpers
// ============================================================================

/**
 * Execute operation with automatic retry on failure
 *
 * @param operation - Async function to execute
 * @param config - Retry configuration
 * @returns Result of operation
 * @throws Error if all retries exhausted
 *
 * @example
 * ```typescript
 * const result = await executeWithRetry(
 *   async () => await syncItemToServer(item),
 *   { maxAttempts: 3, baseDelay: 2000 }
 * );
 * ```
 */
export async function executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
): Promise<T> {
    const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < cfg.maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            console.warn(`[RetryLogic] Attempt ${attempt + 1}/${cfg.maxAttempts} failed:`, error.message);

            // If this was the last attempt, throw
            if (attempt === cfg.maxAttempts - 1) {
                break;
            }

            // Wait before next retry
            const delay = calculateRetryDelay(attempt, cfg);
            _retryLog(`[RetryLogic] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // All retries exhausted
    throw new Error(
        `Operation failed after ${cfg.maxAttempts} attempts. Last error: ${lastError?.message || 'Unknown'}`
    );
}

/**
 * Retry utility for handling transient failures
 *
 * Provides exponential backoff retry logic with configurable options.
 * Used for network requests and database operations that may fail temporarily.
 */

import { logger } from './logger';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /**
   * Maximum number of attempts (including initial attempt)
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Base delay in milliseconds for exponential backoff
   * @default 2000
   */
  baseDelay?: number;

  /**
   * Operation name for logging purposes
   * @default "operation"
   */
  operationName?: string;

  /**
   * Predicate to determine if error should trigger retry
   * @default () => true (retry all errors)
   */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Execute operation with retry logic and exponential backoff
 *
 * @param operation - Async operation to execute
 * @param options - Retry configuration
 * @returns Result of successful operation
 * @throws Error if all retry attempts fail
 *
 * @example
 * ```typescript
 * const data = await withRetry(
 *   async () => {
 *     const response = await fetch('/api/data');
 *     if (!response.ok) throw new Error(`HTTP ${response.status}`);
 *     return response.json();
 *   },
 *   {
 *     maxAttempts: 3,
 *     baseDelay: 2000,
 *     operationName: 'fetch-data',
 *     shouldRetry: (err) => !err.message.includes('401')
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 2000,
    operationName = 'operation',
    shouldRetry = () => true
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();

      if (attempt > 1) {
        logger.info(`[RETRY] ${operationName} succeeded on attempt ${attempt}/${maxAttempts}`);
      }

      return result;
    } catch (error) {
      lastError = error as Error;
      logger.warn(`[RETRY] ${operationName} attempt ${attempt}/${maxAttempts} failed`, error);

      // Check if we should retry this error
      if (!shouldRetry(lastError)) {
        logger.error(`[RETRY] ${operationName} failed with non-retryable error`, lastError);
        throw lastError;
      }

      // If this was the last attempt, don't wait
      if (attempt === maxAttempts) {
        break;
      }

      // Exponential backoff: 2s, 4s, 8s, ...
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.info(`[RETRY] ${operationName} retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All attempts failed
  logger.error(`[RETRY] ${operationName} failed after ${maxAttempts} attempts`, lastError);
  throw new Error(`Failed to ${operationName} after ${maxAttempts} attempts: ${lastError?.message}`);
}

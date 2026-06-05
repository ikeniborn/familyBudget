/**
 * Poll Retry Module
 * Handles exponential backoff and retry logic for long polling
 *
 * Extracted from budgetWSClient.js:1543-1577 (poll retry logic)
 */

/**
 * Calculate poll retry delay with exponential backoff and jitter
 *
 * @param retryCount Current retry attempt (1-based)
 * @param baseDelay Base delay in milliseconds (default: 2000)
 * @param maxDelay Maximum delay in milliseconds (default: 30000)
 * @returns Delay in milliseconds with jitter applied
 */
export function calculateRetryDelay(
  retryCount: number,
  baseDelay: number = 2000,
  maxDelay: number = 30000
): number {
  // Exponential backoff: baseDelay * 2^(retryCount - 1)
  const exponentialDelay = baseDelay * Math.pow(2, retryCount - 1);

  // Add jitter (±10% random variation) to prevent thundering herd
  const jitter = exponentialDelay * 0.2 * Math.random();
  const delayWithJitter = exponentialDelay + jitter;

  // Cap at maxDelay
  return Math.min(delayWithJitter, maxDelay);
}

/**
 * Determine if error is retryable
 *
 * @param error Error object or message
 * @returns True if error should be retried
 */
export function isRetryableError(error: any): boolean {
  if (!error) {
    return false;
  }

  const message = error.message || String(error);

  // Network errors (retryable)
  if (
    message.includes('NetworkError') ||
    message.includes('Failed to fetch') ||
    message.includes('timeout') ||
    message.includes('503')
  ) {
    return true;
  }

  // Authentication errors (not retryable)
  if (message.includes('401') || message.includes('403')) {
    return false;
  }

  // Client errors (not retryable)
  if (message.includes('400') || message.includes('404')) {
    return false;
  }

  // Abort errors (not retryable, intentional)
  if (error.name === 'AbortError') {
    return false;
  }

  // Unknown errors (retryable)
  return true;
}

/**
 * Get retry configuration
 *
 * @returns Retry configuration object
 */
export function getRetryConfig(): {
  baseDelay: number;
  maxDelay: number;
  maxRetries: number;
} {
  return {
    baseDelay: 2000, // 2s base delay
    maxDelay: 30000, // 30s max delay
    maxRetries: 10, // 10 retries max
  };
}

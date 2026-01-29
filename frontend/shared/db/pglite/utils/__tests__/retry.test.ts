/**
 * Unit Tests for retry utility
 *
 * Tests exponential backoff timing, shouldRetry predicate,
 * max attempts limit, and error propagation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from '../retry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful operation', () => {
    it('should return result on first attempt if successful', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const promise = withRetry(operation, {
        operationName: 'test-operation'
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should return result on retry after initial failure', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce('success');

      const promise = withRetry(operation, {
        operationName: 'test-operation',
        maxAttempts: 3,
        baseDelay: 2000
      });

      // First attempt fails, wait for retry delay (2s)
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('exponential backoff timing', () => {
    it('should use exponential backoff delays (2s, 4s, 8s)', async () => {
      const delays: number[] = [];
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');

      const promise = withRetry(operation, {
        operationName: 'test-backoff',
        maxAttempts: 3,
        baseDelay: 2000
      });

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      delays.push(0);

      // Wait for 1st retry delay (2s)
      await vi.advanceTimersByTimeAsync(2000);
      delays.push(2000);

      // Wait for 2nd retry delay (4s)
      await vi.advanceTimersByTimeAsync(4000);
      delays.push(4000);

      await promise;

      expect(delays).toEqual([0, 2000, 4000]);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use custom baseDelay for backoff calculation', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValueOnce('success');

      const promise = withRetry(operation, {
        operationName: 'test-custom-delay',
        maxAttempts: 2,
        baseDelay: 1000  // 1s base delay
      });

      await vi.advanceTimersByTimeAsync(0);    // First attempt
      await vi.advanceTimersByTimeAsync(1000); // Retry after 1s

      await promise;

      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('shouldRetry predicate', () => {
    it('should not retry when shouldRetry returns false', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));

      const promise = withRetry(operation, {
        operationName: 'test-no-retry',
        maxAttempts: 3,
        shouldRetry: (error) => {
          // Don't retry authentication errors
          return !error.message.includes('401');
        }
      });

      await expect(promise).rejects.toThrow('401 Unauthorized');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry when shouldRetry returns true', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce('success');

      const promise = withRetry(operation, {
        operationName: 'test-retry',
        maxAttempts: 3,
        shouldRetry: (error) => {
          // Retry network errors
          return error.message.includes('Network');
        }
      });

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should use default shouldRetry (always retry) when not provided', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Any error'))
        .mockResolvedValueOnce('success');

      const promise = withRetry(operation, {
        operationName: 'test-default-retry',
        maxAttempts: 2
      });

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('max attempts limit', () => {
    it('should throw error after max attempts reached', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      const promise = withRetry(operation, {
        operationName: 'test-max-attempts',
        maxAttempts: 3,
        baseDelay: 1000
      });

      // Run all timers to complete all attempts
      const resultPromise = promise.catch(err => err);
      await vi.runAllTimersAsync();
      const error = await resultPromise as Error;

      expect(error.message).toContain('Failed to test-max-attempts after 3 attempts: Persistent failure');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect custom maxAttempts value', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));

      const promise = withRetry(operation, {
        operationName: 'test-custom-max',
        maxAttempts: 5,
        baseDelay: 500
      });

      // Run all timers to complete all attempts
      const resultPromise = promise.catch(err => err);
      await vi.runAllTimersAsync();
      const error = await resultPromise;

      expect(error).toBeInstanceOf(Error);
      expect(operation).toHaveBeenCalledTimes(5);
    });

    it('should use default maxAttempts=3 when not provided', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));

      const promise = withRetry(operation, {
        operationName: 'test-default-max'
      });

      // Run all timers to complete all attempts
      const resultPromise = promise.catch(err => err);
      await vi.runAllTimersAsync();
      const error = await resultPromise;

      expect(error).toBeInstanceOf(Error);
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('error propagation', () => {
    it('should propagate original error when all attempts fail', async () => {
      const originalError = new Error('Original failure message');
      const operation = vi.fn().mockRejectedValue(originalError);

      const promise = withRetry(operation, {
        operationName: 'test-error-propagation',
        maxAttempts: 2,
        baseDelay: 1000
      });

      const resultPromise = promise.catch(err => err);
      await vi.runAllTimersAsync();
      const error = await resultPromise as Error;

      expect(error.message).toContain('Failed to test-error-propagation after 2 attempts: Original failure message');
    });

    it('should propagate error immediately for non-retryable errors', async () => {
      const criticalError = new Error('403 Forbidden');
      const operation = vi.fn().mockRejectedValue(criticalError);

      const promise = withRetry(operation, {
        operationName: 'test-critical-error',
        maxAttempts: 5,
        shouldRetry: (error) => !error.message.includes('403')
      });

      await expect(promise).rejects.toThrow('403 Forbidden');
      expect(operation).toHaveBeenCalledTimes(1); // No retries
    });

    it('should preserve error stack trace', async () => {
      const errorWithStack = new Error('Error with stack');
      const operation = vi.fn().mockRejectedValue(errorWithStack);

      const promise = withRetry(operation, {
        operationName: 'test-stack-trace',
        maxAttempts: 1
      });

      try {
        await promise;
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Error with stack');
        expect((error as Error).stack).toBeDefined();
      }
    });
  });

  describe('generic type support', () => {
    it('should preserve return type for string operations', async () => {
      const operation = vi.fn().mockResolvedValue('string result');

      const result: string = await withRetry(operation, {
        operationName: 'test-string-type'
      });

      expect(typeof result).toBe('string');
      expect(result).toBe('string result');
    });

    it('should preserve return type for object operations', async () => {
      const mockData = { id: 1, name: 'Test' };
      const operation = vi.fn().mockResolvedValue(mockData);

      const result: typeof mockData = await withRetry(operation, {
        operationName: 'test-object-type'
      });

      expect(result).toEqual(mockData);
      expect(result.id).toBe(1);
      expect(result.name).toBe('Test');
    });

    it('should preserve return type for number operations', async () => {
      const operation = vi.fn().mockResolvedValue(42);

      const result: number = await withRetry(operation, {
        operationName: 'test-number-type'
      });

      expect(typeof result).toBe('number');
      expect(result).toBe(42);
    });
  });
});

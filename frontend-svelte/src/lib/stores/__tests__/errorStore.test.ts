import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { errorStore, type AppError } from '../error.store';

// Mock console.error to avoid noise in tests
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Error Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    errorStore.clearError();
  });

  afterEach(() => {
    errorStore.clearError();
  });

  describe('Initial State', () => {
    it('should initialize with null error', () => {
      const error = get(errorStore);
      expect(error).toBeNull();
    });
  });

  describe('Set Error from Error Object', () => {
    it('should set error from Error object', () => {
      const testError = new Error('Test error message');
      testError.stack = 'Error stack trace';
      
      errorStore.setError(testError, 'Additional details');
      
      const error = get(errorStore);
      expect(error).toMatchObject({
        id: expect.any(String),
        message: 'Test error message',
        details: 'Additional details',
        timestamp: expect.any(Date),
        stack: 'Error stack trace'
      });
      
      expect(mockConsoleError).toHaveBeenCalledWith('Application error:', error);
    });

    it('should set error from Error object without details', () => {
      const testError = new Error('Simple error');
      
      errorStore.setError(testError);
      
      const error = get(errorStore);
      expect(error).toMatchObject({
        message: 'Simple error',
        details: undefined,
        stack: expect.any(String)
      });
    });

    it('should handle Error object without stack', () => {
      const testError = new Error('Error without stack');
      delete testError.stack;
      
      errorStore.setError(testError);
      
      const error = get(errorStore);
      expect(error).toMatchObject({
        message: 'Error without stack',
        stack: undefined
      });
    });
  });

  describe('Set Error from String', () => {
    it('should set error from string message', () => {
      errorStore.setError('String error message', 'String details');
      
      const error = get(errorStore);
      expect(error).toMatchObject({
        id: expect.any(String),
        message: 'String error message',
        details: 'String details',
        timestamp: expect.any(Date),
        stack: undefined
      });
      
      expect(mockConsoleError).toHaveBeenCalledWith('Application error:', error);
    });

    it('should set error from string without details', () => {
      errorStore.setError('Simple string error');
      
      const error = get(errorStore);
      expect(error).toMatchObject({
        message: 'Simple string error',
        details: undefined,
        stack: undefined
      });
    });
  });

  describe('Error ID Generation', () => {
    it('should generate unique IDs for different errors', () => {
      vi.useFakeTimers();
      
      errorStore.setError('Error 1');
      const error1 = get(errorStore);
      
      vi.advanceTimersByTime(1);
      
      errorStore.setError('Error 2');
      const error2 = get(errorStore);
      
      expect(error1?.id).not.toBe(error2?.id);
      
      vi.useRealTimers();
    });

    it('should use timestamp as ID', () => {
      const mockTimestamp = 1234567890123;
      vi.useFakeTimers();
      vi.setSystemTime(mockTimestamp);
      
      errorStore.setError('Timestamp error');
      const error = get(errorStore);
      
      expect(error?.id).toBe(mockTimestamp.toString());
      
      vi.useRealTimers();
    });
  });

  describe('Clear Error', () => {
    it('should clear error state', () => {
      errorStore.setError('Test error');
      
      let error = get(errorStore);
      expect(error).not.toBeNull();
      
      errorStore.clearError();
      
      error = get(errorStore);
      expect(error).toBeNull();
    });

    it('should handle clearing when no error exists', () => {
      expect(get(errorStore)).toBeNull();
      
      errorStore.clearError();
      
      expect(get(errorStore)).toBeNull();
    });
  });

  describe('Global Error Handler', () => {
    it('should handle global errors', () => {
      errorStore.handleGlobalError('Global error message', 'Global details');
      
      const error = get(errorStore);
      expect(error).toMatchObject({
        message: 'Global error message',
        details: 'Global details'
      });
    });

    it('should handle global Error objects', () => {
      const globalError = new Error('Global Error object');
      
      errorStore.handleGlobalError(globalError, 'Error details');
      
      const error = get(errorStore);
      expect(error).toMatchObject({
        message: 'Global Error object',
        details: 'Error details',
        stack: expect.any(String)
      });
    });
  });

  describe('Timestamp Handling', () => {
    it('should set timestamp when error occurs', () => {
      const beforeTime = new Date();
      
      errorStore.setError('Timestamp test');
      
      const afterTime = new Date();
      const error = get(errorStore);
      
      expect(error?.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(error?.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('Console Logging', () => {
    it('should log all errors to console', () => {
      const testError = new Error('Console test error');
      
      errorStore.setError(testError, 'Console details');
      
      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Application error:',
        expect.objectContaining({
          message: 'Console test error',
          details: 'Console details'
        })
      );
    });
  });

  describe('Error Replacement', () => {
    it('should replace previous error when new error is set', () => {
      errorStore.setError('First error');
      const firstError = get(errorStore);
      
      errorStore.setError('Second error');
      const secondError = get(errorStore);
      
      expect(firstError?.message).toBe('First error');
      expect(secondError?.message).toBe('Second error');
      expect(secondError?.id).not.toBe(firstError?.id);
    });
  });

  describe('Error Object Structure', () => {
    it('should maintain consistent error structure', () => {
      errorStore.setError('Structure test', 'Test details');
      
      const error = get(errorStore);
      
      expect(error).toHaveProperty('id');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('details');
      expect(error).toHaveProperty('timestamp');
      expect(error).toHaveProperty('stack');
      
      expect(typeof error?.id).toBe('string');
      expect(typeof error?.message).toBe('string');
      expect(error?.details).toBe('Test details');
      expect(error?.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Reactivity', () => {
    it('should trigger subscribers when error changes', () => {
      const mockSubscriber = vi.fn();
      const unsubscribe = errorStore.subscribe(mockSubscriber);
      
      // Clear the initial subscription call
      mockSubscriber.mockClear();
      
      errorStore.setError('Reactive test');
      
      expect(mockSubscriber).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Reactive test'
        })
      );
      
      mockSubscriber.mockClear();
      
      errorStore.clearError();
      
      expect(mockSubscriber).toHaveBeenCalledWith(null);
      
      unsubscribe();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string error', () => {
      errorStore.setError('');
      
      const error = get(errorStore);
      expect(error?.message).toBe('');
    });

    it('should handle empty details', () => {
      errorStore.setError('Test message', '');
      
      const error = get(errorStore);
      expect(error?.details).toBe('');
    });

    it('should handle multiple consecutive errors', () => {
      errorStore.setError('Error 1');
      errorStore.setError('Error 2');
      errorStore.setError('Error 3');
      
      const error = get(errorStore);
      expect(error?.message).toBe('Error 3');
    });
  });
});
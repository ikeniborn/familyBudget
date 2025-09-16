import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { toastStore, toasts, useToast, toastStoreCompat } from '$lib/stores/toast.store';
import type { Toast, ToastType } from '$lib/stores/toast.store';

describe('Toast Store', () => {
  beforeEach(() => {
    // Clear all toasts before each test
    toastStore.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    toastStore.clear();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Store Initialization', () => {
    it('should initialize with empty toasts array', () => {
      const state = get(toastStore);
      expect(state.toasts).toEqual([]);
      expect(state.toasts).toHaveLength(0);
    });

    it('should have all required methods', () => {
      expect(typeof toastStore.success).toBe('function');
      expect(typeof toastStore.error).toBe('function');
      expect(typeof toastStore.warning).toBe('function');
      expect(typeof toastStore.info).toBe('function');
      expect(typeof toastStore.show).toBe('function');
      expect(typeof toastStore.remove).toBe('function');
      expect(typeof toastStore.clear).toBe('function');
      expect(typeof toastStore.subscribe).toBe('function');
    });
  });

  describe('Toast Creation', () => {
    it('should create success toast', () => {
      const toastId = toastStore.success('Success Title', 'Success message');

      expect(toastId).toMatch(/^toast-\d+$/);

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(1);

      const toast = state.toasts[0];
      expect(toast.id).toBe(toastId);
      expect(toast.type).toBe('success');
      expect(toast.title).toBe('Success Title');
      expect(toast.message).toBe('Success message');
    });

    it('should create error toast', () => {
      const toastId = toastStore.error('Error Title', 'Error message');

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(1);

      const toast = state.toasts[0];
      expect(toast.type).toBe('error');
      expect(toast.title).toBe('Error Title');
      expect(toast.message).toBe('Error message');
    });

    it('should create warning toast', () => {
      const toastId = toastStore.warning('Warning Title', 'Warning message');

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(1);

      const toast = state.toasts[0];
      expect(toast.type).toBe('warning');
      expect(toast.title).toBe('Warning Title');
      expect(toast.message).toBe('Warning message');
    });

    it('should create info toast', () => {
      const toastId = toastStore.info('Info Title', 'Info message');

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(1);

      const toast = state.toasts[0];
      expect(toast.type).toBe('info');
      expect(toast.title).toBe('Info Title');
      expect(toast.message).toBe('Info message');
    });

    it('should create toast without message', () => {
      const toastId = toastStore.success('Title Only');

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(1);

      const toast = state.toasts[0];
      expect(toast.title).toBe('Title Only');
      expect(toast.message).toBeUndefined();
    });

    it('should create toast with custom duration', () => {
      const toastId = toastStore.success('Custom Duration', undefined, 3000);

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(1);

      const toast = state.toasts[0];
      expect(toast.title).toBe('Custom Duration');
      expect(toast.message).toBeUndefined();
    });

    it('should generate unique IDs for each toast', () => {
      const id1 = toastStore.success('Toast 1');
      const id2 = toastStore.success('Toast 2');
      const id3 = toastStore.success('Toast 3');

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(3);

      const ids = state.toasts.map(t => t.id);
      expect(new Set(ids).size).toBe(3); // All unique
    });
  });

  describe('Generic Show Method', () => {
    it('should create toast using show method', () => {
      const toastId = toastStore.show({
        type: 'success',
        title: 'Generic Toast',
        message: 'Generic message',
        duration: 2000
      });

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(1);

      const toast = state.toasts[0];
      expect(toast.id).toBe(toastId);
      expect(toast.type).toBe('success');
      expect(toast.title).toBe('Generic Toast');
      expect(toast.message).toBe('Generic message');
    });

    it('should handle minimal toast object', () => {
      const toastId = toastStore.show({
        type: 'error',
        title: 'Minimal Toast'
      });

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(1);

      const toast = state.toasts[0];
      expect(toast.type).toBe('error');
      expect(toast.title).toBe('Minimal Toast');
      expect(toast.message).toBeUndefined();
    });
  });

  describe('Toast Removal', () => {
    it('should remove specific toast by ID', () => {
      const id1 = toastStore.success('Toast 1');
      const id2 = toastStore.error('Toast 2');
      const id3 = toastStore.warning('Toast 3');

      let state = get(toastStore);
      expect(state.toasts).toHaveLength(3);

      toastStore.remove(id2);

      state = get(toastStore);
      expect(state.toasts).toHaveLength(2);
      expect(state.toasts[0].id).toBe(id1);
      expect(state.toasts[1].id).toBe(id3);
    });

    it('should handle removing non-existent toast', () => {
      toastStore.success('Existing Toast');

      let state = get(toastStore);
      expect(state.toasts).toHaveLength(1);

      // Try to remove non-existent toast
      toastStore.remove('non-existent-id');

      state = get(toastStore);
      expect(state.toasts).toHaveLength(1); // Should remain unchanged
    });

    it('should remove first toast', () => {
      const id1 = toastStore.success('First');
      const id2 = toastStore.success('Second');
      const id3 = toastStore.success('Third');

      toastStore.remove(id1);

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(2);
      expect(state.toasts[0].id).toBe(id2);
      expect(state.toasts[1].id).toBe(id3);
    });

    it('should remove last toast', () => {
      const id1 = toastStore.success('First');
      const id2 = toastStore.success('Second');
      const id3 = toastStore.success('Third');

      toastStore.remove(id3);

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(2);
      expect(state.toasts[0].id).toBe(id1);
      expect(state.toasts[1].id).toBe(id2);
    });
  });

  describe('Clear All Toasts', () => {
    it('should clear all toasts', () => {
      toastStore.success('Toast 1');
      toastStore.error('Toast 2');
      toastStore.warning('Toast 3');

      let state = get(toastStore);
      expect(state.toasts).toHaveLength(3);

      toastStore.clear();

      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
      expect(state.toasts).toEqual([]);
    });

    it('should handle clearing empty toast list', () => {
      let state = get(toastStore);
      expect(state.toasts).toHaveLength(0);

      toastStore.clear();

      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });
  });

  describe('Auto-dismiss Functionality', () => {
    it('should auto-dismiss toast after default duration (5000ms)', () => {
      const toastId = toastStore.success('Auto dismiss test');

      let state = get(toastStore);
      expect(state.toasts).toHaveLength(1);

      // Fast forward 4999ms - should still be there
      vi.advanceTimersByTime(4999);
      state = get(toastStore);
      expect(state.toasts).toHaveLength(1);

      // Fast forward 1ms more - should be removed
      vi.advanceTimersByTime(1);
      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });

    it('should auto-dismiss toast after custom duration', () => {
      const toastId = toastStore.success('Custom duration test', undefined, 3000);

      let state = get(toastStore);
      expect(state.toasts).toHaveLength(1);

      // Fast forward 2999ms - should still be there
      vi.advanceTimersByTime(2999);
      state = get(toastStore);
      expect(state.toasts).toHaveLength(1);

      // Fast forward 1ms more - should be removed
      vi.advanceTimersByTime(1);
      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });

    it('should not auto-dismiss when duration is 0', () => {
      const toastId = toastStore.success('No auto dismiss', undefined, 0);

      let state = get(toastStore);
      expect(state.toasts).toHaveLength(1);

      // Fast forward way past normal duration
      vi.advanceTimersByTime(10000);
      state = get(toastStore);
      expect(state.toasts).toHaveLength(1); // Should still be there
    });

    it('should not auto-dismiss when duration is negative', () => {
      const toastId = toastStore.success('Negative duration', undefined, -1000);

      let state = get(toastStore);
      expect(state.toasts).toHaveLength(1);

      vi.advanceTimersByTime(5000);
      state = get(toastStore);
      expect(state.toasts).toHaveLength(1); // Should still be there
    });

    it('should handle multiple toasts with different durations', () => {
      const id1 = toastStore.success('Short', undefined, 1000);
      const id2 = toastStore.success('Medium', undefined, 3000);
      const id3 = toastStore.success('Long', undefined, 5000);

      let state = get(toastStore);
      expect(state.toasts).toHaveLength(3);

      // After 1000ms, first should be removed
      vi.advanceTimersByTime(1000);
      state = get(toastStore);
      expect(state.toasts).toHaveLength(2);
      expect(state.toasts.find(t => t.title === 'Short')).toBeUndefined();

      // After 2000ms more (3000ms total), second should be removed
      vi.advanceTimersByTime(2000);
      state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts.find(t => t.title === 'Medium')).toBeUndefined();

      // After 2000ms more (5000ms total), third should be removed
      vi.advanceTimersByTime(2000);
      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });
  });

  describe('Derived Store', () => {
    it('should have derived toasts store', () => {
      expect(toasts).toBeDefined();
      expect(typeof toasts.subscribe).toBe('function');
    });

    it('should reflect changes in derived store', () => {
      toastStore.success('Derived test');

      const derivedState = get(toasts);
      expect(derivedState).toHaveLength(1);
      expect(derivedState[0].title).toBe('Derived test');
    });

    it('should update derived store when toasts change', () => {
      const id1 = toastStore.success('First');
      const id2 = toastStore.error('Second');

      let derivedState = get(toasts);
      expect(derivedState).toHaveLength(2);

      toastStore.remove(id1);

      derivedState = get(toasts);
      expect(derivedState).toHaveLength(1);
      expect(derivedState[0].title).toBe('Second');
    });
  });

  describe('UseToast Hook', () => {
    it('should provide all toast methods', () => {
      const toast = useToast();

      expect(typeof toast.success).toBe('function');
      expect(typeof toast.error).toBe('function');
      expect(typeof toast.warning).toBe('function');
      expect(typeof toast.info).toBe('function');
      expect(typeof toast.show).toBe('function');
      expect(typeof toast.remove).toBe('function');
      expect(typeof toast.clear).toBe('function');
    });

    it('should create toasts using hook methods', () => {
      const toast = useToast();

      const id1 = toast.success('Hook success');
      const id2 = toast.error('Hook error');

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(2);
      expect(state.toasts[0].title).toBe('Hook success');
      expect(state.toasts[1].title).toBe('Hook error');
    });

    it('should remove toasts using hook methods', () => {
      const toast = useToast();

      const id1 = toast.success('To be removed');
      const id2 = toast.error('To stay');

      toast.remove(id1);

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].title).toBe('To stay');
    });

    it('should clear toasts using hook method', () => {
      const toast = useToast();

      toast.success('Toast 1');
      toast.error('Toast 2');

      let state = get(toastStore);
      expect(state.toasts).toHaveLength(2);

      toast.clear();

      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });
  });

  describe('Legacy Compatibility', () => {
    it('should export toastStoreCompat', () => {
      expect(toastStoreCompat).toBeDefined();
      expect(toastStoreCompat).toBe(toastStore);
    });

    it('should work with legacy import patterns', () => {
      expect(typeof toastStoreCompat.success).toBe('function');
      expect(typeof toastStoreCompat.error).toBe('function');
      expect(typeof toastStoreCompat.warning).toBe('function');
      expect(typeof toastStoreCompat.info).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty title', () => {
      const toastId = toastStore.success('');

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].title).toBe('');
    });

    it('should handle very long titles', () => {
      const longTitle = 'This is a very long title that might cause issues if not handled properly by the toast store implementation';

      const toastId = toastStore.success(longTitle);

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].title).toBe(longTitle);
    });

    it('should handle special characters in title and message', () => {
      const specialTitle = 'Title with <>&"\'';
      const specialMessage = 'Message with <script>alert("test")</script>';

      const toastId = toastStore.success(specialTitle, specialMessage);

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].title).toBe(specialTitle);
      expect(state.toasts[0].message).toBe(specialMessage);
    });

    it('should handle unicode characters', () => {
      const unicodeTitle = '🎉 Success! 成功 ✅';
      const unicodeMessage = '操作成功完成 🚀';

      const toastId = toastStore.success(unicodeTitle, unicodeMessage);

      const state = get(toastStore);
      expect(state.toasts[0].title).toBe(unicodeTitle);
      expect(state.toasts[0].message).toBe(unicodeMessage);
    });

    it('should handle rapid toast creation', () => {
      const toastIds: string[] = [];

      // Create 100 toasts rapidly
      for (let i = 0; i < 100; i++) {
        const id = toastStore.success(`Rapid Toast ${i}`);
        toastIds.push(id);
      }

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(100);

      // Verify all IDs are unique
      expect(new Set(toastIds).size).toBe(100);
    });

    it('should handle rapid toast removal', () => {
      const toastIds: string[] = [];

      // Create toasts
      for (let i = 0; i < 50; i++) {
        const id = toastStore.success(`Toast ${i}`);
        toastIds.push(id);
      }

      let state = get(toastStore);
      expect(state.toasts).toHaveLength(50);

      // Remove all toasts rapidly
      for (const id of toastIds) {
        toastStore.remove(id);
      }

      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('should handle large number of toasts efficiently', () => {
      const start = performance.now();

      // Add 1000 toasts
      for (let i = 0; i < 1000; i++) {
        toastStore.success(`Performance Test ${i}`);
      }

      const addingTime = performance.now() - start;

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(1000);

      const clearStart = performance.now();
      toastStore.clear();
      const clearingTime = performance.now() - clearStart;

      // Operations should complete within reasonable time
      expect(addingTime).toBeLessThan(1000); // 1 second
      expect(clearingTime).toBeLessThan(100); // 100ms

      const finalState = get(toastStore);
      expect(finalState.toasts).toHaveLength(0);
    });

    it('should handle concurrent operations gracefully', () => {
      // Simulate concurrent operations
      const operations = [];

      for (let i = 0; i < 50; i++) {
        operations.push(() => toastStore.success(`Concurrent ${i}`));
        operations.push(() => toastStore.error(`Error ${i}`));
      }

      // Execute all operations
      operations.forEach(op => op());

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(100);

      // Verify data integrity
      const titles = state.toasts.map(t => t.title);
      const uniqueTitles = new Set(titles);
      expect(uniqueTitles.size).toBe(100); // All unique
    });
  });
});
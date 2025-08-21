import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { toastStore, useToast, type Toast } from '../toast.store';

describe('Toast Store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    toastStore.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    toastStore.clear();
  });

  describe('Initial State', () => {
    it('should initialize with empty toasts array', () => {
      const state = get(toastStore);
      expect(state.toasts).toEqual([]);
    });
  });

  describe('Adding Toasts', () => {
    it('should add success toast', () => {
      const id = toastStore.success('Success!', 'Operation completed');
      const state = get(toastStore);
      
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0]).toMatchObject({
        id: expect.stringContaining('toast-'),
        type: 'success',
        title: 'Success!',
        message: 'Operation completed'
      });
      expect(id).toBe(state.toasts[0].id);
    });

    it('should add error toast', () => {
      const id = toastStore.error('Error!', 'Something went wrong');
      const state = get(toastStore);
      
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0]).toMatchObject({
        type: 'error',
        title: 'Error!',
        message: 'Something went wrong'
      });
    });

    it('should add warning toast', () => {
      const id = toastStore.warning('Warning!', 'Be careful');
      const state = get(toastStore);
      
      expect(state.toasts[0]).toMatchObject({
        type: 'warning',
        title: 'Warning!',
        message: 'Be careful'
      });
    });

    it('should add info toast', () => {
      const id = toastStore.info('Info', 'Here is some information');
      const state = get(toastStore);
      
      expect(state.toasts[0]).toMatchObject({
        type: 'info',
        title: 'Info',
        message: 'Here is some information'
      });
    });

    it('should add toast without message', () => {
      toastStore.success('Title only');
      const state = get(toastStore);
      
      expect(state.toasts[0]).toMatchObject({
        type: 'success',
        title: 'Title only',
        message: undefined
      });
    });

    it('should add toast using show method', () => {
      const toast: Omit<Toast, 'id'> = {
        type: 'success',
        title: 'Custom toast',
        message: 'Custom message',
        duration: 3000
      };
      
      const id = toastStore.show(toast);
      const state = get(toastStore);
      
      expect(state.toasts[0]).toMatchObject(toast);
      expect(state.toasts[0].id).toBe(id);
    });
  });

  describe('Unique IDs', () => {
    it('should generate unique IDs for each toast', () => {
      const id1 = toastStore.success('Toast 1');
      const id2 = toastStore.success('Toast 2');
      const id3 = toastStore.error('Toast 3');
      
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
      
      const state = get(toastStore);
      const ids = state.toasts.map(t => t.id);
      const uniqueIds = [...new Set(ids)];
      
      expect(uniqueIds).toHaveLength(3);
    });
  });

  describe('Auto Removal', () => {
    it('should auto-remove toast after default duration', () => {
      toastStore.success('Auto remove');
      
      let state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      
      // Fast-forward default duration (5000ms)
      vi.advanceTimersByTime(5000);
      
      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });

    it('should auto-remove toast after custom duration', () => {
      toastStore.success('Auto remove', 'Message', 2000);
      
      let state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      
      // Fast-forward less than duration
      vi.advanceTimersByTime(1000);
      state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      
      // Fast-forward to exceed duration
      vi.advanceTimersByTime(1500);
      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });

    it('should not auto-remove toast with duration 0', () => {
      toastStore.success('Persistent', 'Message', 0);
      
      let state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      
      // Fast-forward a long time
      vi.advanceTimersByTime(10000);
      
      state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
    });

    it('should not auto-remove toast with negative duration', () => {
      toastStore.success('Persistent', 'Message', -1);
      
      let state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      
      vi.advanceTimersByTime(10000);
      
      state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
    });
  });

  describe('Manual Removal', () => {
    it('should remove toast by ID', () => {
      const id1 = toastStore.success('Toast 1');
      const id2 = toastStore.success('Toast 2');
      
      let state = get(toastStore);
      expect(state.toasts).toHaveLength(2);
      
      toastStore.remove(id1);
      
      state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].id).toBe(id2);
    });

    it('should handle removing non-existent toast ID gracefully', () => {
      toastStore.success('Toast 1');
      
      let state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      
      toastStore.remove('non-existent-id');
      
      state = get(toastStore);
      expect(state.toasts).toHaveLength(1); // Should remain unchanged
    });
  });

  describe('Clear All', () => {
    it('should clear all toasts', () => {
      toastStore.success('Toast 1');
      toastStore.error('Toast 2');
      toastStore.warning('Toast 3');
      
      let state = get(toastStore);
      expect(state.toasts).toHaveLength(3);
      
      toastStore.clear();
      
      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });
  });

  describe('Multiple Toasts', () => {
    it('should handle multiple toasts correctly', () => {
      const id1 = toastStore.success('Toast 1');
      const id2 = toastStore.error('Toast 2');
      const id3 = toastStore.warning('Toast 3');
      
      const state = get(toastStore);
      expect(state.toasts).toHaveLength(3);
      
      const types = state.toasts.map(t => t.type);
      expect(types).toEqual(['success', 'error', 'warning']);
    });

    it('should maintain order of toasts', () => {
      toastStore.success('First');
      toastStore.error('Second');
      toastStore.warning('Third');
      
      const state = get(toastStore);
      const titles = state.toasts.map(t => t.title);
      
      expect(titles).toEqual(['First', 'Second', 'Third']);
    });

    it('should remove correct toast when multiple have same type', () => {
      const id1 = toastStore.success('Success 1');
      const id2 = toastStore.success('Success 2');
      const id3 = toastStore.success('Success 3');
      
      toastStore.remove(id2);
      
      const state = get(toastStore);
      expect(state.toasts).toHaveLength(2);
      
      const titles = state.toasts.map(t => t.title);
      expect(titles).toEqual(['Success 1', 'Success 3']);
    });
  });

  describe('Use Toast Hook', () => {
    it('should return same toast store instance', () => {
      const hook1 = useToast();
      const hook2 = useToast();
      
      expect(hook1).toBe(hook2);
      expect(hook1).toBe(toastStore);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty title', () => {
      const id = toastStore.success('');
      const state = get(toastStore);
      
      expect(state.toasts[0].title).toBe('');
    });

    it('should handle undefined message', () => {
      const id = toastStore.success('Title', undefined);
      const state = get(toastStore);
      
      expect(state.toasts[0].message).toBeUndefined();
    });

    it('should handle concurrent removals', () => {
      const id1 = toastStore.success('Toast 1', 'Message', 1000);
      const id2 = toastStore.success('Toast 2', 'Message', 1500);
      
      // Manually remove first toast
      toastStore.remove(id1);
      
      let state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      
      // Let auto-removal run for second toast
      vi.advanceTimersByTime(1500);
      
      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });
  });

  describe('Reactivity', () => {
    it('should trigger subscribers when toasts change', () => {
      const mockSubscriber = vi.fn();
      const unsubscribe = toastStore.subscribe(mockSubscriber);
      
      // Clear the initial subscription call
      mockSubscriber.mockClear();
      
      toastStore.success('Test');
      
      expect(mockSubscriber).toHaveBeenCalledWith({
        toasts: expect.arrayContaining([
          expect.objectContaining({ title: 'Test' })
        ])
      });
      
      unsubscribe();
    });
  });
});
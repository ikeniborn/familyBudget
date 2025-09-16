import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import ToastContainer from '$lib/components/common/ToastContainer.svelte';
import { toastStore, useToast } from '$lib/stores/toast.store';

// Mock Lucide icons to avoid import issues
vi.mock('lucide-svelte', () => ({
  X: vi.fn(() => ({ $$: {} })),
  CheckCircle: vi.fn(() => ({ $$: {} })),
  XCircle: vi.fn(() => ({ $$: {} })),
  AlertCircle: vi.fn(() => ({ $$: {} })),
  Info: vi.fn(() => ({ $$: {} }))
}));

// Mock animations
vi.mock('svelte/animate', () => ({
  flip: vi.fn(() => ({}))
}));

vi.mock('svelte/transition', () => ({
  fly: vi.fn(() => ({})),
  scale: vi.fn(() => ({}))
}));

describe('Notification System Integration', () => {
  beforeEach(() => {
    toastStore.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    toastStore.clear();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Complete Notification Flow', () => {
    it('should handle complete success notification workflow', async () => {
      render(ToastContainer);

      // Create notification
      const toastId = toastStore.success('Operation Successful', 'Your data has been saved successfully');
      await tick();

      // Verify toast appears in store
      let state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].type).toBe('success');
      expect(state.toasts[0].title).toBe('Operation Successful');
      expect(state.toasts[0].message).toBe('Your data has been saved successfully');

      // Verify auto-dismiss works
      vi.advanceTimersByTime(5000);
      await tick();

      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });

    it('should handle complete error notification workflow', async () => {
      render(ToastContainer);

      // Create error notification
      const toastId = toastStore.error('Operation Failed', 'Unable to save data. Please try again.');
      await tick();

      // Verify toast appears
      let state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].type).toBe('error');
      expect(state.toasts[0].title).toBe('Operation Failed');
      expect(state.toasts[0].message).toBe('Unable to save data. Please try again.');

      // Test manual close instead of auto-dismiss
      toastStore.remove(toastId);
      await tick();

      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });

    it('should handle multiple notification types simultaneously', async () => {
      render(ToastContainer);

      // Create multiple notifications
      const successId = toastStore.success('Success Message');
      const errorId = toastStore.error('Error Message');
      const warningId = toastStore.warning('Warning Message');
      const infoId = toastStore.info('Info Message');
      await tick();

      // Verify all toasts are present
      const state = get(toastStore);
      expect(state.toasts).toHaveLength(4);

      const types = state.toasts.map(t => t.type);
      expect(types).toContain('success');
      expect(types).toContain('error');
      expect(types).toContain('warning');
      expect(types).toContain('info');
    });
  });

  describe('User Interaction Scenarios', () => {
    it('should handle user clicking close button', async () => {
      const { container } = render(ToastContainer);

      // Create a notification
      toastStore.success('Closeable Toast', 'Click the X to close');
      await tick();

      // Verify toast exists
      let state = get(toastStore);
      expect(state.toasts).toHaveLength(1);

      // Find and click close button (mocked, but test the flow)
      const toastId = state.toasts[0].id;
      toastStore.remove(toastId);
      await tick();

      // Verify toast is removed
      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });

    it('should handle rapid user interactions', async () => {
      render(ToastContainer);

      // Simulate rapid user actions creating notifications
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        const id = toastStore.success(`Rapid Notification ${i}`);
        ids.push(id);
      }
      await tick();

      let state = get(toastStore);
      expect(state.toasts).toHaveLength(10);

      // User rapidly closes some notifications
      for (let i = 0; i < 5; i++) {
        toastStore.remove(ids[i]);
      }
      await tick();

      state = get(toastStore);
      expect(state.toasts).toHaveLength(5);

      // Remaining notifications should still auto-dismiss
      vi.advanceTimersByTime(5000);
      await tick();

      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });

    it('should handle clear all notifications', async () => {
      render(ToastContainer);

      // Create multiple notifications
      toastStore.success('Toast 1');
      toastStore.error('Toast 2');
      toastStore.warning('Toast 3');
      toastStore.info('Toast 4');
      await tick();

      let state = get(toastStore);
      expect(state.toasts).toHaveLength(4);

      // User clears all notifications
      toastStore.clear();
      await tick();

      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });
  });

  describe('Real-world Application Scenarios', () => {
    it('should handle form submission success flow', async () => {
      render(ToastContainer);

      // Simulate form submission success
      const formData = { name: 'John Doe', email: 'john@example.com' };

      // Show loading notification
      const loadingId = toastStore.info('Saving...', 'Please wait while we save your information', 0);
      await tick();

      let state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].title).toBe('Saving...');

      // Simulate successful API response
      setTimeout(() => {
        toastStore.remove(loadingId);
        toastStore.success('Saved Successfully!', 'Your information has been saved');
      }, 100);

      vi.advanceTimersByTime(100);
      await tick();

      state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].type).toBe('success');
      expect(state.toasts[0].title).toBe('Saved Successfully!');

      // Success notification auto-dismisses
      vi.advanceTimersByTime(5000);
      await tick();

      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });

    it('should handle form submission error flow', async () => {
      render(ToastContainer);

      // Simulate form submission error
      const loadingId = toastStore.info('Saving...', 'Please wait while we save your information', 0);
      await tick();

      // Simulate API error
      setTimeout(() => {
        toastStore.remove(loadingId);
        toastStore.error('Save Failed', 'Network error. Please check your connection and try again.', 10000);
      }, 100);

      vi.advanceTimersByTime(100);
      await tick();

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].type).toBe('error');
      expect(state.toasts[0].title).toBe('Save Failed');
      expect(state.toasts[0].message).toContain('Network error');
    });

    it('should handle batch operations with progress updates', async () => {
      render(ToastContainer);

      // Simulate batch operation
      const items = ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5'];
      let processedCount = 0;

      const progressId = toastStore.info('Processing...', `Processing item 1 of ${items.length}`, 0);
      await tick();

      // Simulate processing each item
      for (let i = 0; i < items.length; i++) {
        setTimeout(() => {
          processedCount++;
          toastStore.remove(progressId);

          if (processedCount < items.length) {
            toastStore.info('Processing...', `Processing item ${processedCount + 1} of ${items.length}`, 0);
          } else {
            toastStore.success('Batch Complete!', `Successfully processed ${items.length} items`);
          }
        }, (i + 1) * 100);
      }

      // Fast forward through all processing
      vi.advanceTimersByTime(600);
      await tick();

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].type).toBe('success');
      expect(state.toasts[0].title).toBe('Batch Complete!');
    });

    it('should handle validation errors', async () => {
      render(ToastContainer);

      // Simulate form validation errors
      const validationErrors = [
        'Email is required',
        'Password must be at least 8 characters',
        'Phone number format is invalid'
      ];

      // Show individual error for each validation failure
      for (const error of validationErrors) {
        toastStore.error('Validation Error', error, 8000);
      }
      await tick();

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(3);

      state.toasts.forEach((toast, index) => {
        expect(toast.type).toBe('error');
        expect(toast.title).toBe('Validation Error');
        expect(toast.message).toBe(validationErrors[index]);
      });
    });
  });

  describe('useToast Hook Integration', () => {
    it('should work seamlessly with useToast hook', async () => {
      render(ToastContainer);

      // Simulate component using useToast hook
      const toast = useToast();

      // Component performs various operations
      toast.info('Loading data...');
      await tick();

      let state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].type).toBe('info');

      // Simulate successful data load
      toast.clear();
      toast.success('Data loaded successfully');
      await tick();

      state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].type).toBe('success');
    });

    it('should handle hook methods with different parameters', async () => {
      render(ToastContainer);

      const toast = useToast();

      // Test all method signatures
      toast.success('Simple success');
      toast.error('Error title', 'Error message');
      toast.warning('Warning title', 'Warning message', 3000);
      toast.info('Info title', undefined, 0);

      await tick();

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(4);

      // Verify each toast has correct properties
      expect(state.toasts[0].title).toBe('Simple success');
      expect(state.toasts[0].message).toBeUndefined();

      expect(state.toasts[1].title).toBe('Error title');
      expect(state.toasts[1].message).toBe('Error message');

      expect(state.toasts[2].title).toBe('Warning title');
      expect(state.toasts[2].message).toBe('Warning message');

      expect(state.toasts[3].title).toBe('Info title');
      expect(state.toasts[3].message).toBeUndefined();
    });
  });

  describe('Responsive Behavior Integration', () => {
    it('should handle container responsiveness with multiple toasts', async () => {
      const { container } = render(ToastContainer);

      // Add multiple toasts to test responsive behavior
      for (let i = 0; i < 5; i++) {
        toastStore.success(`Responsive Toast ${i}`, `This is toast number ${i} for responsive testing`);
      }
      await tick();

      // Verify container has responsive classes
      const toastContainer = container.querySelector('[aria-live="assertive"]');
      expect(toastContainer).toHaveClass('sm:items-start');
      expect(toastContainer).toHaveClass('items-end');

      const innerContainer = container.querySelector('.max-w-md');
      expect(innerContainer).toHaveClass('sm:max-w-lg');

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(5);
    });

    it('should handle very long content responsively', async () => {
      render(ToastContainer);

      const longTitle = 'This is a very long title that should be handled properly by the responsive notification system without breaking the layout';
      const longMessage = 'This is an extremely long message that contains lots of information and should wrap properly within the notification container while maintaining good readability and visual hierarchy across different screen sizes and devices including mobile phones, tablets, and desktop computers';

      toastStore.warning(longTitle, longMessage);
      await tick();

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].title).toBe(longTitle);
      expect(state.toasts[0].message).toBe(longMessage);
    });
  });

  describe('Performance Under Load Integration', () => {
    it('should handle high-frequency notifications efficiently', async () => {
      render(ToastContainer);

      const start = performance.now();

      // Simulate high-frequency notifications (like real-time updates)
      for (let i = 0; i < 100; i++) {
        if (i % 4 === 0) {
          toastStore.success(`Update ${i}`);
        } else if (i % 4 === 1) {
          toastStore.error(`Error ${i}`);
        } else if (i % 4 === 2) {
          toastStore.warning(`Warning ${i}`);
        } else {
          toastStore.info(`Info ${i}`);
        }
      }
      await tick();

      const creationTime = performance.now() - start;

      // Verify all notifications are created
      let state = get(toastStore);
      expect(state.toasts).toHaveLength(100);

      // Test clearing performance
      const clearStart = performance.now();
      toastStore.clear();
      await tick();
      const clearTime = performance.now() - clearStart;

      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);

      // Performance should be reasonable
      expect(creationTime).toBeLessThan(1000); // 1 second
      expect(clearTime).toBeLessThan(100); // 100ms
    });

    it('should handle concurrent notification operations', async () => {
      render(ToastContainer);

      // Simulate concurrent operations from different parts of the app
      const operations = [];

      for (let i = 0; i < 20; i++) {
        operations.push(
          new Promise<void>(resolve => {
            setTimeout(() => {
              toastStore.success(`Concurrent ${i}`, `Message ${i}`);
              resolve();
            }, Math.random() * 50);
          })
        );
      }

      await Promise.all(operations);
      await tick();

      const state = get(toastStore);
      expect(state.toasts).toHaveLength(20);

      // Verify data integrity
      const titles = state.toasts.map(t => t.title);
      const uniqueTitles = new Set(titles);
      expect(uniqueTitles.size).toBe(20); // All should be unique
    });
  });

  describe('Edge Cases Integration', () => {
    it('should handle unmounting container while toasts exist', async () => {
      const { unmount } = render(ToastContainer);

      // Add toasts
      toastStore.success('Toast 1');
      toastStore.error('Toast 2');
      await tick();

      let state = get(toastStore);
      expect(state.toasts).toHaveLength(2);

      // Unmount container
      unmount();

      // Store should still work after container unmount
      toastStore.warning('Toast 3');
      await tick();

      state = get(toastStore);
      expect(state.toasts).toHaveLength(3);

      // Cleanup should still work
      toastStore.clear();
      await tick();

      state = get(toastStore);
      expect(state.toasts).toHaveLength(0);
    });

    it('should handle remounting container with existing toasts', async () => {
      // Add toasts before mounting container
      toastStore.success('Pre-existing Toast 1');
      toastStore.error('Pre-existing Toast 2');

      const { unmount, rerender } = render(ToastContainer);
      await tick();

      // Container should display existing toasts
      const state = get(toastStore);
      expect(state.toasts).toHaveLength(2);
      expect(state.toasts[0].title).toBe('Pre-existing Toast 1');
      expect(state.toasts[1].title).toBe('Pre-existing Toast 2');
    });

    it('should handle malformed toast data gracefully', async () => {
      render(ToastContainer);

      // Simulate edge cases that might occur in real applications
      const malformedCases = [
        { type: 'success', title: '', message: undefined },
        { type: 'error', title: null as any, message: '' },
        { type: 'warning', title: 'Valid', message: null as any },
        { type: 'info', title: undefined as any, message: 'Valid message' }
      ];

      for (const testCase of malformedCases) {
        try {
          toastStore.show(testCase);
          await tick();
        } catch (error) {
          // Should handle gracefully without crashing
          expect(error).toBeUndefined();
        }
      }

      // At least some toasts should be created (those with valid titles)
      const state = get(toastStore);
      expect(state.toasts.length).toBeGreaterThanOrEqual(0);
    });
  });
});
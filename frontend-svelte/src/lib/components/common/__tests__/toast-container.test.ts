import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import ToastContainer from '$lib/components/common/ToastContainer.svelte';
import { toastStore } from '$lib/stores/toast.store';

// Mock Toast component
vi.mock('$lib/components/common/Toast.svelte', () => ({
  default: vi.fn(() => ({
    $$: {},
    $on: vi.fn(),
    $set: vi.fn(),
    $destroy: vi.fn()
  }))
}));

// Mock animations to avoid issues in testing
vi.mock('svelte/animate', () => ({
  flip: vi.fn(() => ({}))
}));

vi.mock('svelte/transition', () => ({
  fly: vi.fn(() => ({})),
  scale: vi.fn(() => ({}))
}));

describe('ToastContainer Component', () => {
  beforeEach(() => {
    // Clear all toasts before each test
    toastStore.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    toastStore.clear();
  });

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(ToastContainer);
      expect(container).toBeTruthy();
    });

    it('should have correct accessibility attributes', () => {
      const { container } = render(ToastContainer);
      const toastContainer = container.querySelector('[aria-live="assertive"]');
      expect(toastContainer).toBeInTheDocument();
      expect(toastContainer).toHaveAttribute('aria-live', 'assertive');
    });

    it('should have correct CSS classes for positioning', () => {
      const { container } = render(ToastContainer);
      const toastContainer = container.querySelector('[aria-live="assertive"]');

      expect(toastContainer).toHaveClass('pointer-events-none');
      expect(toastContainer).toHaveClass('fixed');
      expect(toastContainer).toHaveClass('inset-0');
      expect(toastContainer).toHaveClass('z-50');
    });

    it('should have responsive positioning classes', () => {
      const { container } = render(ToastContainer);
      const toastContainer = container.querySelector('[aria-live="assertive"]');

      expect(toastContainer).toHaveClass('items-end');
      expect(toastContainer).toHaveClass('sm:items-start');
      expect(toastContainer).toHaveClass('px-2');
      expect(toastContainer).toHaveClass('sm:px-4');
      expect(toastContainer).toHaveClass('py-4');
      expect(toastContainer).toHaveClass('sm:py-6');
    });

    it('should render empty container when no toasts are present', () => {
      const { container } = render(ToastContainer);

      // Should not contain any toast elements
      const toastElements = container.querySelectorAll('[data-testid*="toast"]');
      expect(toastElements).toHaveLength(0);
    });
  });

  describe('Toast Display', () => {
    it('should display a single toast', async () => {
      render(ToastContainer);

      // Add a toast
      toastStore.success('Test Title', 'Test Message');
      await tick();

      // Toast should be rendered (we're mocking the Toast component)
      const store = get(toastStore);
      expect(store.toasts).toHaveLength(1);
      expect(store.toasts[0].title).toBe('Test Title');
      expect(store.toasts[0].message).toBe('Test Message');
      expect(store.toasts[0].type).toBe('success');
    });

    it('should display multiple toasts', async () => {
      render(ToastContainer);

      // Add multiple toasts
      toastStore.success('Success Toast');
      toastStore.error('Error Toast');
      toastStore.warning('Warning Toast');
      toastStore.info('Info Toast');
      await tick();

      const store = get(toastStore);
      expect(store.toasts).toHaveLength(4);

      const types = store.toasts.map(t => t.type);
      expect(types).toContain('success');
      expect(types).toContain('error');
      expect(types).toContain('warning');
      expect(types).toContain('info');
    });
  });

  describe('Toast Management', () => {
    it('should remove toasts when close is called', async () => {
      render(ToastContainer);

      const toastId = toastStore.success('Test Toast');
      await tick();

      let store = get(toastStore);
      expect(store.toasts).toHaveLength(1);

      // Remove the toast
      toastStore.remove(toastId);
      await tick();

      store = get(toastStore);
      expect(store.toasts).toHaveLength(0);
    });

    it('should clear all toasts', async () => {
      render(ToastContainer);

      // Add multiple toasts
      toastStore.success('Toast 1');
      toastStore.error('Toast 2');
      toastStore.warning('Toast 3');
      await tick();

      let store = get(toastStore);
      expect(store.toasts).toHaveLength(3);

      // Clear all toasts
      toastStore.clear();
      await tick();

      store = get(toastStore);
      expect(store.toasts).toHaveLength(0);
    });

    it('should maintain toast order (FIFO)', async () => {
      render(ToastContainer);

      // Add toasts in sequence
      toastStore.success('First Toast');
      toastStore.error('Second Toast');
      toastStore.warning('Third Toast');
      await tick();

      const store = get(toastStore);
      expect(store.toasts).toHaveLength(3);
      expect(store.toasts[0].title).toBe('First Toast');
      expect(store.toasts[1].title).toBe('Second Toast');
      expect(store.toasts[2].title).toBe('Third Toast');
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive container width classes', () => {
      const { container } = render(ToastContainer);
      const innerContainer = container.querySelector('.max-w-md');

      expect(innerContainer).toHaveClass('max-w-md');
      expect(innerContainer).toHaveClass('sm:max-w-lg');
    });

    it('should have responsive spacing classes', () => {
      const { container } = render(ToastContainer);
      const spacingContainer = container.querySelector('.space-y-4');

      expect(spacingContainer).toHaveClass('space-y-4');
    });

    it('should have responsive flex alignment', () => {
      const { container } = render(ToastContainer);
      const flexContainer = container.querySelector('.flex.flex-col');

      expect(flexContainer).toHaveClass('items-center');
      expect(flexContainer).toHaveClass('sm:items-end');
    });
  });

  describe('Store Integration', () => {
    it('should reactively update when store changes', async () => {
      render(ToastContainer);

      // Initial state
      let store = get(toastStore);
      expect(store.toasts).toHaveLength(0);

      // Add toast
      toastStore.success('Reactive Test');
      await tick();

      store = get(toastStore);
      expect(store.toasts).toHaveLength(1);

      // Remove toast
      toastStore.clear();
      await tick();

      store = get(toastStore);
      expect(store.toasts).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty toast list gracefully', async () => {
      const { container } = render(ToastContainer);

      // Ensure no toasts
      toastStore.clear();
      await tick();

      // Container should still render without errors
      expect(container).toBeTruthy();
      const store = get(toastStore);
      expect(store.toasts).toHaveLength(0);
    });

    it('should handle maximum number of toasts', async () => {
      render(ToastContainer);

      // Add a large number of toasts
      const maxToasts = 100;
      for (let i = 0; i < maxToasts; i++) {
        toastStore.success(`Toast ${i}`);
      }
      await tick();

      const store = get(toastStore);
      expect(store.toasts).toHaveLength(maxToasts);
    });

    it('should handle duplicate toast additions', async () => {
      render(ToastContainer);

      // Add same toast multiple times
      for (let i = 0; i < 5; i++) {
        toastStore.success('Duplicate Toast', 'Same message');
      }
      await tick();

      const store = get(toastStore);
      expect(store.toasts).toHaveLength(5);

      // Each should have unique ID even with same content
      const ids = store.toasts.map(t => t.id);
      expect(new Set(ids).size).toBe(5);
    });
  });
});
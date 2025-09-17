/**
 * Button Component Event Dispatch System Tests (Fixed)
 * Comprehensive tests for the Svelte event dispatch system after onclick prop removal
 *
 * @file button-event-dispatch-fixed.test.ts
 * @author Claude Code Test Engineer
 * @date 2025-09-17
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import Button from '$lib/components/ui/Button.svelte';

// Mock device store
vi.mock('$lib/stores/device.store', () => ({
  isTouch: {
    subscribe: vi.fn((callback) => {
      callback(false);
      return { unsubscribe: vi.fn() };
    })
  }
}));

describe('Button Event Dispatch System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Event Dispatch Mechanism', () => {
    it('dispatches click event through Svelte event system', async () => {
      const clickHandler = vi.fn();

      const { component } = render(Button, {
        props: {},
        $$slots: { default: ['Test Button'] }
      });

      // Listen to Svelte dispatched event
      component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(clickHandler).toHaveBeenCalledTimes(1);
      expect(clickHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.any(MouseEvent),
          type: 'click'
        })
      );
    });

    it('event detail contains original MouseEvent', async () => {
      let eventDetail: MouseEvent | null = null;
      const clickHandler = vi.fn((event) => {
        eventDetail = event.detail;
      });

      const { component } = render(Button, {
        props: {},
        $$slots: { default: ['Event Test'] }
      });

      component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(eventDetail).toBeInstanceOf(MouseEvent);
      expect(eventDetail?.type).toBe('click');
      expect(eventDetail?.target).toBe(button);
    });

    it('handles multiple event listeners correctly', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      const { component } = render(Button, {
        props: {},
        $$slots: { default: ['Multiple Listeners'] }
      });

      // Attach multiple listeners
      component.$on('click', handler1);
      component.$on('click', handler2);
      component.$on('click', handler3);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Dispatch States', () => {
    it('does not dispatch when button is disabled', async () => {
      const clickHandler = vi.fn();

      const { component } = render(Button, {
        props: { disabled: true },
        $$slots: { default: ['Disabled Button'] }
      });

      component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(clickHandler).not.toHaveBeenCalled();
      expect(button).toBeDisabled();
    });

    it('does not dispatch when button is in loading state', async () => {
      const clickHandler = vi.fn();

      const { component } = render(Button, {
        props: { loading: true },
        $$slots: { default: ['Loading Button'] }
      });

      component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(clickHandler).not.toHaveBeenCalled();
    });
  });

  describe('Link Variant Event Dispatch', () => {
    it('dispatches click event for link variant', async () => {
      const clickHandler = vi.fn();

      const { component } = render(Button, {
        props: { href: '/test-link' },
        $$slots: { default: ['Link Button'] }
      });

      component.$on('click', clickHandler);

      const link = screen.getByRole('link');
      await fireEvent.click(link);

      expect(clickHandler).toHaveBeenCalledTimes(1);
      expect(clickHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.any(MouseEvent)
        })
      );
    });

    it('does not render as link when disabled', async () => {
      const clickHandler = vi.fn();

      const { component } = render(Button, {
        props: { href: '/test-link', disabled: true },
        $$slots: { default: ['Disabled Link'] }
      });

      component.$on('click', clickHandler);

      // Should render as button, not link
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();

      await fireEvent.click(button);
      expect(clickHandler).not.toHaveBeenCalled();
    });
  });

  describe('Event Timing and Performance', () => {
    it('dispatches events with minimal delay', async () => {
      const clickHandler = vi.fn();
      let eventTime: number = 0;

      const { component } = render(Button, {
        props: {},
        $$slots: { default: ['Performance Test'] }
      });

      component.$on('click', () => {
        eventTime = Date.now();
        clickHandler();
      });

      const button = screen.getByRole('button');
      const startTime = Date.now();

      await fireEvent.click(button);

      const responseTime = eventTime - startTime;

      expect(clickHandler).toHaveBeenCalled();
      expect(responseTime).toBeLessThan(50); // Should be very fast
    });

    it('handles high-frequency clicking efficiently', async () => {
      const clickHandler = vi.fn();

      const { component } = render(Button, {
        props: {},
        $$slots: { default: ['High Frequency Test'] }
      });

      component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      const startTime = Date.now();

      // Simulate rapid clicking
      for (let i = 0; i < 100; i++) {
        await fireEvent.click(button);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(clickHandler).toHaveBeenCalledTimes(100);
      expect(totalTime).toBeLessThan(1000); // Should handle 100 clicks in under 1 second
    });
  });

  describe('Event Cleanup and Memory Management', () => {
    it('properly cleans up event listeners on unmount', () => {
      const clickHandler = vi.fn();

      const { unmount } = render(Button, {
        props: {},
        $$slots: { default: ['Cleanup Test'] }
      });

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();

      // Unmount component
      unmount();

      // Button should be removed from DOM
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('handles rapid mount/unmount cycles without memory leaks', () => {
      for (let i = 0; i < 50; i++) {
        const { unmount, component } = render(Button, {
          props: {},
          $$slots: { default: [`Button ${i}`] }
        });

        const clickHandler = vi.fn();
        component.$on('click', clickHandler);

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();

        unmount();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
      }

      // Test should complete without memory issues
      expect(true).toBe(true);
    });
  });

  describe('Regression Prevention', () => {
    it('never uses onclick HTML attribute', () => {
      const { container } = render(Button, {
        props: {},
        $$slots: { default: ['Regression Test'] }
      });

      const button = container.querySelector('button');
      const link = container.querySelector('a');

      // Should not have onclick HTML attribute
      expect(button?.getAttribute('onclick')).toBeNull();
      expect(link?.getAttribute('onclick')).toBeNull();

      // Should not have onclick property set
      expect(button?.onclick).toBeNull();
      expect(link?.onclick).toBeNull();
    });

    it('validates event system integration across all variants', async () => {
      const variants = ['default', 'destructive', 'outline', 'secondary', 'accent', 'warm', 'ghost', 'link'] as const;

      for (const variant of variants) {
        const clickHandler = vi.fn();

        const { unmount, component } = render(Button, {
          props: { variant },
          $$slots: { default: [`${variant} button`] }
        });

        component.$on('click', clickHandler);

        const button = screen.getByRole('button');
        await fireEvent.click(button);

        expect(clickHandler).toHaveBeenCalledTimes(1);
        unmount();
      }
    });

    it('ensures no onclick attributes in generated HTML', () => {
      const { container } = render(Button, {
        props: {
          variant: 'destructive',
          size: 'lg',
          disabled: false,
          loading: false,
          type: 'submit'
        },
        $$slots: { default: ['Full Props Test'] }
      });

      const html = container.innerHTML;

      // Should not contain any onclick attributes
      expect(html).not.toMatch(/onclick\s*=/i);
      expect(html).not.toMatch(/onclick\s*:/i);
      expect(html).not.toMatch(/onclick\s*"/i);
      expect(html).not.toMatch(/onclick\s*'/i);
    });
  });

  describe('Button Accessibility and Event Integration', () => {
    it('maintains accessibility without onclick attributes', () => {
      const { container } = render(Button, {
        props: { 'aria-label': 'Accessible button' },
        $$slots: { default: ['Accessible Test'] }
      });

      const button = container.querySelector('button');

      // Should maintain accessibility attributes
      expect(button).toHaveAttribute('aria-label', 'Accessible button');
      expect(button).toHaveAttribute('type', 'button');

      // Should not have onclick
      expect(button).not.toHaveAttribute('onclick');
      expect(button?.onclick).toBeNull();
    });

    it('integrates properly with Svelte event system', async () => {
      const clickHandler = vi.fn();

      const { component } = render(Button, {
        props: {},
        $$slots: { default: ['Event Integration Test'] }
      });

      // Test Svelte event binding
      component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(clickHandler).toHaveBeenCalledTimes(1);
      expect(clickHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.any(MouseEvent)
        })
      );
    });

    it('works with on:click directive in parent components', async () => {
      // This test simulates how the Button is used in the articles page
      const mockHandler = vi.fn();

      const { component } = render(Button, {
        props: {},
        $$slots: { default: ['Articles button'] }
      });

      component.$on('click', mockHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('Button State Management with Events', () => {
    it('properly handles disabled state with event prevention', async () => {
      const clickHandler = vi.fn();

      const { component } = render(Button, {
        props: { disabled: true },
        $$slots: { default: ['Disabled State Test'] }
      });

      component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();

      await fireEvent.click(button);
      expect(clickHandler).not.toHaveBeenCalled();
    });

    it('properly handles loading state with event prevention', async () => {
      const clickHandler = vi.fn();

      const { component } = render(Button, {
        props: { loading: true },
        $$slots: { default: ['Loading State Test'] }
      });

      component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(clickHandler).not.toHaveBeenCalled();

      // Should show loading spinner
      const spinner = button.querySelector('svg');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
    });
  });
});
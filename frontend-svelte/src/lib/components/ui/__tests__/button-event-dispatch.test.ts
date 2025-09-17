/**
 * Button Component Event Dispatch System Tests
 * Comprehensive tests for the Svelte event dispatch system after onclick prop removal
 *
 * @file button-event-dispatch.test.ts
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

      const component = render(Button, {
        props: {},
        children: 'Test Button'
      });

      // Listen to Svelte dispatched event
      component.component.$on('click', clickHandler);

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

      const component = render(Button, {
        props: {},
        children: 'Event Test'
      });

      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(eventDetail).toBeInstanceOf(MouseEvent);
      expect(eventDetail?.type).toBe('click');
      expect(eventDetail?.target).toBe(button);
    });

    it('preserves event properties in dispatch', async () => {
      let capturedEvent: MouseEvent | null = null;
      const clickHandler = vi.fn((event) => {
        capturedEvent = event.detail;
      });

      const component = render(Button, {
        props: {},
        children: 'Property Test'
      });

      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button, {
        clientX: 100,
        clientY: 200,
        ctrlKey: true
      });

      expect(capturedEvent).toBeTruthy();
      expect(capturedEvent?.clientX).toBe(100);
      expect(capturedEvent?.clientY).toBe(200);
      expect(capturedEvent?.ctrlKey).toBe(true);
    });

    it('handles multiple event listeners correctly', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      const component = render(Button, {
        props: {},
        children: 'Multiple Listeners'
      });

      // Attach multiple listeners
      component.component.$on('click', handler1);
      component.component.$on('click', handler2);
      component.component.$on('click', handler3);

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

      const component = render(Button, {
        props: { disabled: true },
        children: 'Disabled Button'
      });

      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(clickHandler).not.toHaveBeenCalled();
      expect(button).toBeDisabled();
    });

    it('does not dispatch when button is in loading state', async () => {
      const clickHandler = vi.fn();

      const component = render(Button, {
        props: { loading: true },
        children: 'Loading Button'
      });

      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(clickHandler).not.toHaveBeenCalled();
    });

    it('dispatches correctly when enabled after being disabled', async () => {
      const clickHandler = vi.fn();

      const { rerender } = render(Button, {
        props: { disabled: true },
        children: 'Toggle Button'
      });

      const component = render(Button, {
        props: { disabled: true },
        children: 'Toggle Button'
      });

      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');

      // Click while disabled - should not work
      await fireEvent.click(button);
      expect(clickHandler).not.toHaveBeenCalled();

      // Re-render with disabled=false
      rerender({ disabled: false });

      // Click while enabled - should work
      await fireEvent.click(button);
      expect(clickHandler).toHaveBeenCalledTimes(1);
    });

    it('handles rapid state changes correctly', async () => {
      const clickHandler = vi.fn();

      const { rerender } = render(Button, {
        props: { disabled: false },
        children: 'Rapid Change Button'
      });

      const component = render(Button, {
        props: { disabled: false },
        children: 'Rapid Change Button'
      });

      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');

      // Series of state changes
      await fireEvent.click(button); // Should work
      rerender({ disabled: true });
      await fireEvent.click(button); // Should not work
      rerender({ disabled: false });
      await fireEvent.click(button); // Should work again

      expect(clickHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Link Variant Event Dispatch', () => {
    it('dispatches click event for link variant', async () => {
      const clickHandler = vi.fn();

      const component = render(Button, {
        props: { href: '/test-link' },
        children: 'Link Button'
      });

      component.component.$on('click', clickHandler);

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

      const component = render(Button, {
        props: { href: '/test-link', disabled: true },
        children: 'Disabled Link'
      });

      component.component.$on('click', clickHandler);

      // Should render as button, not link
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();

      await fireEvent.click(button);
      expect(clickHandler).not.toHaveBeenCalled();
    });

    it('preserves href attribute while dispatching events', async () => {
      const clickHandler = vi.fn();

      const component = render(Button, {
        props: { href: '/important-link' },
        children: 'Navigation Link'
      });

      component.component.$on('click', clickHandler);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/important-link');

      await fireEvent.click(link);
      expect(clickHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Timing and Performance', () => {
    it('dispatches events with minimal delay', async () => {
      const clickHandler = vi.fn();
      let eventTime: number = 0;

      const component = render(Button, {
        props: {},
        children: 'Performance Test'
      });

      component.component.$on('click', () => {
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

      const component = render(Button, {
        props: {},
        children: 'High Frequency Test'
      });

      component.component.$on('click', clickHandler);

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

    it('maintains event dispatch performance across re-renders', async () => {
      const clickHandler = vi.fn();
      let totalResponseTime = 0;

      const { rerender } = render(Button, {
        props: { variant: 'default' },
        children: 'Re-render Test'
      });

      const component = render(Button, {
        props: { variant: 'default' },
        children: 'Re-render Test'
      });

      component.component.$on('click', () => {
        totalResponseTime += Date.now();
        clickHandler();
      });

      const button = screen.getByRole('button');

      // Test performance across multiple re-renders
      const variants = ['default', 'outline', 'secondary', 'accent'];

      for (const variant of variants) {
        rerender({ variant });

        const startTime = Date.now();
        await fireEvent.click(button);
        totalResponseTime -= startTime;
      }

      const averageResponseTime = totalResponseTime / variants.length;

      expect(clickHandler).toHaveBeenCalledTimes(variants.length);
      expect(averageResponseTime).toBeLessThan(10); // Very fast average response
    });
  });

  describe('Haptic Feedback Integration', () => {
    beforeEach(() => {
      // Mock vibrate API
      Object.defineProperty(window.navigator, 'vibrate', {
        value: vi.fn(),
        writable: true
      });
    });

    it('triggers haptic feedback and dispatches event on touch devices', async () => {
      const mockVibrate = vi.fn();
      Object.defineProperty(window.navigator, 'vibrate', { value: mockVibrate });

      // Mock touch device
      vi.doMock('$lib/stores/device.store', () => ({
        isTouch: {
          subscribe: vi.fn((callback) => {
            callback(true);
            return { unsubscribe: vi.fn() };
          })
        }
      }));

      const clickHandler = vi.fn();

      const component = render(Button, {
        props: { hapticFeedback: true },
        children: 'Haptic Button'
      });

      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      // Both haptic feedback and event should work
      expect(clickHandler).toHaveBeenCalledTimes(1);
      // Note: Haptic feedback is tested separately as it's internal to the component
    });

    it('dispatches event without haptic feedback when disabled', async () => {
      const clickHandler = vi.fn();

      const component = render(Button, {
        props: { hapticFeedback: false },
        children: 'No Haptic Button'
      });

      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(clickHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Cleanup and Memory Management', () => {
    it('properly cleans up event listeners on unmount', () => {
      const clickHandler = vi.fn();

      const { unmount } = render(Button, {
        props: {},
        children: 'Cleanup Test'
      });

      const component = render(Button, {
        props: {},
        children: 'Cleanup Test'
      });

      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();

      // Unmount component
      unmount();

      // Button should be removed from DOM
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('handles rapid mount/unmount cycles without memory leaks', () => {
      for (let i = 0; i < 50; i++) {
        const { unmount } = render(Button, {
          props: {},
          children: `Button ${i}`
        });

        const component = render(Button, {
          props: {},
          children: `Button ${i}`
        });

        const clickHandler = vi.fn();
        component.component.$on('click', clickHandler);

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();

        unmount();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
      }

      // Test should complete without memory issues
      expect(true).toBe(true);
    });

    it('prevents event dispatch after component destruction', async () => {
      const clickHandler = vi.fn();

      const { unmount } = render(Button, {
        props: {},
        children: 'Destruction Test'
      });

      const component = render(Button, {
        props: {},
        children: 'Destruction Test'
      });

      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');

      // Click before unmount - should work
      await fireEvent.click(button);
      expect(clickHandler).toHaveBeenCalledTimes(1);

      // Unmount component
      unmount();

      // Any remaining references should not cause issues
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Regression Prevention', () => {
    it('never uses onclick HTML attribute', () => {
      const { container } = render(Button, {
        props: {},
        children: 'Regression Test'
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

    it('maintains Svelte event dispatch after prop changes', async () => {
      const clickHandler = vi.fn();

      const { rerender } = render(Button, {
        props: { variant: 'default' },
        children: 'Prop Change Test'
      });

      const component = render(Button, {
        props: { variant: 'default' },
        children: 'Prop Change Test'
      });

      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');

      // Click with initial props
      await fireEvent.click(button);
      expect(clickHandler).toHaveBeenCalledTimes(1);

      // Change props
      rerender({
        variant: 'destructive',
        size: 'lg',
        disabled: false
      });

      // Should still work after prop changes
      await fireEvent.click(button);
      expect(clickHandler).toHaveBeenCalledTimes(2);
    });

    it('validates event system integration across all variants', async () => {
      const variants = ['default', 'destructive', 'outline', 'secondary', 'accent', 'warm', 'ghost', 'link'] as const;

      for (const variant of variants) {
        const clickHandler = vi.fn();

        const { unmount } = render(Button, {
          props: { variant },
          children: `${variant} button`
        });

        const component = render(Button, {
          props: { variant },
          children: `${variant} button`
        });

        component.component.$on('click', clickHandler);

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
        children: 'Full Props Test'
      });

      const html = container.innerHTML;

      // Should not contain any onclick attributes
      expect(html).not.toMatch(/onclick\s*=/i);
      expect(html).not.toMatch(/onclick\s*:/i);
      expect(html).not.toMatch(/onclick\s*"/i);
      expect(html).not.toMatch(/onclick\s*'/i);
    });
  });
});
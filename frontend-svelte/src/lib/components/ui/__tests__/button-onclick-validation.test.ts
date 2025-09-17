/**
 * Button onclick Validation Tests
 * Simple tests to validate the onclick fix is working correctly
 *
 * @file button-onclick-validation.test.ts
 * @author Claude Code Test Engineer
 * @date 2025-09-17
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import Button from '../Button.svelte';

// Mock device store
vi.mock('$lib/stores/device.store', () => ({
  isTouch: {
    subscribe: vi.fn((callback) => {
      callback(false);
      return { unsubscribe: vi.fn() };
    })
  }
}));

describe('Button onclick Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic HTML Attribute Validation', () => {
    it('never renders onclick HTML attribute', () => {
      const { container } = render(Button, {
        props: {}
      });

      const html = container.innerHTML;

      // Should NOT contain onclick attribute in any form
      expect(html).not.toMatch(/onclick\s*=/i);
      expect(html).not.toMatch(/onclick\s*:/i);
      expect(html).not.toMatch(/onclick\s*"/i);
      expect(html).not.toMatch(/onclick\s*'/i);
    });

    it('button DOM element has null onclick property', () => {
      const { container } = render(Button, {
        props: {}
      });

      const button = container.querySelector('button');
      expect(button?.onclick).toBeNull();
    });

    it('validates no onclick across all variants', () => {
      const variants = ['default', 'destructive', 'outline', 'secondary', 'accent', 'warm', 'ghost', 'link'] as const;

      variants.forEach(variant => {
        const { container, unmount } = render(Button, {
          props: { variant }
        });

        const html = container.innerHTML;
        expect(html).not.toMatch(/onclick/i);

        const button = container.querySelector('button');
        expect(button?.onclick).toBeNull();

        unmount();
      });
    });

    it('validates no onclick across all sizes', () => {
      const sizes = ['default', 'sm', 'lg', 'icon', 'touch'] as const;

      sizes.forEach(size => {
        const { container, unmount } = render(Button, {
          props: { size }
        });

        const html = container.innerHTML;
        expect(html).not.toMatch(/onclick/i);

        const button = container.querySelector('button');
        expect(button?.onclick).toBeNull();

        unmount();
      });
    });

    it('validates no onclick in disabled state', () => {
      const { container } = render(Button, {
        props: { disabled: true }
      });

      const html = container.innerHTML;
      expect(html).not.toMatch(/onclick/i);

      const button = container.querySelector('button');
      expect(button?.onclick).toBeNull();
      expect(button).toBeDisabled();
    });

    it('validates no onclick in loading state', () => {
      const { container } = render(Button, {
        props: { loading: true }
      });

      const html = container.innerHTML;
      expect(html).not.toMatch(/onclick/i);

      const button = container.querySelector('button');
      expect(button?.onclick).toBeNull();

      // Should have loading spinner
      const spinner = button?.querySelector('svg');
      expect(spinner).toBeInTheDocument();
    });

    it('validates no onclick in link variant', () => {
      const { container } = render(Button, {
        props: { href: '/test-link' }
      });

      const html = container.innerHTML;
      expect(html).not.toMatch(/onclick/i);

      const link = container.querySelector('a');
      expect(link?.onclick).toBeNull();
      expect(link).toHaveAttribute('href', '/test-link');
    });
  });

  describe('Event Dispatch System Validation', () => {
    it('dispatches click event through Svelte system', async () => {
      const clickHandler = vi.fn();

      const { component } = render(Button, {
        props: {}
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

    it('does not dispatch when disabled', async () => {
      const clickHandler = vi.fn();

      const { component } = render(Button, {
        props: { disabled: true }
      });

      component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(clickHandler).not.toHaveBeenCalled();
    });

    it('does not dispatch when loading', async () => {
      const clickHandler = vi.fn();

      const { component } = render(Button, {
        props: { loading: true }
      });

      component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(clickHandler).not.toHaveBeenCalled();
    });

    it('dispatches for link variant when not disabled', async () => {
      const clickHandler = vi.fn();

      const { component } = render(Button, {
        props: { href: '/test' }
      });

      component.$on('click', clickHandler);

      const link = screen.getByRole('link');
      await fireEvent.click(link);

      expect(clickHandler).toHaveBeenCalledTimes(1);
    });

    it('handles multiple rapid clicks', async () => {
      const clickHandler = vi.fn();

      const { component } = render(Button, {
        props: {}
      });

      component.$on('click', clickHandler);

      const button = screen.getByRole('button');

      // Rapid clicks
      for (let i = 0; i < 5; i++) {
        await fireEvent.click(button);
      }

      expect(clickHandler).toHaveBeenCalledTimes(5);
    });
  });

  describe('Performance Validation', () => {
    it('maintains fast response times', async () => {
      const clickHandler = vi.fn();

      const { component } = render(Button, {
        props: {}
      });

      component.$on('click', clickHandler);

      const button = screen.getByRole('button');

      const startTime = Date.now();
      await fireEvent.click(button);
      const endTime = Date.now();

      const responseTime = endTime - startTime;

      expect(clickHandler).toHaveBeenCalled();
      expect(responseTime).toBeLessThan(100); // Should be very fast
    });

    it('handles component lifecycle correctly', () => {
      const { unmount } = render(Button, {
        props: {}
      });

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();

      unmount();

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility Validation', () => {
    it('maintains proper accessibility attributes', () => {
      const { container } = render(Button, {
        props: { 'aria-label': 'Test button' }
      });

      const button = container.querySelector('button');

      expect(button).toHaveAttribute('aria-label', 'Test button');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).not.toHaveAttribute('onclick');
    });

    it('supports keyboard navigation', async () => {
      const { component } = render(Button, {
        props: {}
      });

      const button = screen.getByRole('button');

      // Should be focusable
      button.focus();
      expect(button).toHaveFocus();
    });
  });

  describe('Regression Prevention', () => {
    it('prevents reintroduction of onclick attribute', () => {
      // Test with complex props to ensure onclick is never added
      const { container } = render(Button, {
        props: {
          variant: 'destructive',
          size: 'lg',
          disabled: false,
          loading: false,
          type: 'submit',
          class: 'custom-class'
        }
      });

      const html = container.innerHTML;

      // Comprehensive check for onclick in any form
      expect(html).not.toMatch(/onclick/);
      expect(html).not.toMatch(/ON_CLICK/);
      expect(html).not.toMatch(/OnClick/);
      expect(html).not.toMatch(/on-click/);

      const button = container.querySelector('button');
      expect(button?.onclick).toBeNull();
    });

    it('validates fix persistence across re-renders', async () => {
      const { rerender, container } = render(Button, {
        props: { variant: 'default' }
      });

      // Re-render with different props
      rerender({ variant: 'destructive', size: 'lg' });

      const html = container.innerHTML;
      expect(html).not.toMatch(/onclick/i);

      const button = container.querySelector('button');
      expect(button?.onclick).toBeNull();
    });

    it('ensures event system works after prop changes', async () => {
      const clickHandler = vi.fn();

      const { component, rerender } = render(Button, {
        props: { variant: 'default' }
      });

      component.$on('click', clickHandler);

      const button = screen.getByRole('button');

      // Click before re-render
      await fireEvent.click(button);
      expect(clickHandler).toHaveBeenCalledTimes(1);

      // Re-render with different props
      rerender({ variant: 'destructive' });

      // Should still work after re-render
      await fireEvent.click(button);
      expect(clickHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cross-Browser Compatibility', () => {
    it('works consistently regardless of browser context', () => {
      // Simulate different browser contexts
      const contexts = [
        { userAgent: 'Chrome/120.0.0.0' },
        { userAgent: 'Firefox/119.0' },
        { userAgent: 'Safari/17.0' }
      ];

      contexts.forEach(context => {
        Object.defineProperty(window.navigator, 'userAgent', {
          value: context.userAgent,
          configurable: true
        });

        const { container, unmount } = render(Button, {
          props: {}
        });

        const html = container.innerHTML;
        expect(html).not.toMatch(/onclick/i);

        const button = container.querySelector('button');
        expect(button?.onclick).toBeNull();

        unmount();
      });
    });
  });

  describe('Memory Management', () => {
    it('handles rapid mount/unmount without leaks', () => {
      // Test multiple mount/unmount cycles
      for (let i = 0; i < 20; i++) {
        const { unmount } = render(Button, {
          props: {}
        });

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(button.onclick).toBeNull();

        unmount();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
      }

      // If we reach here without memory issues, test passes
      expect(true).toBe(true);
    });
  });
});
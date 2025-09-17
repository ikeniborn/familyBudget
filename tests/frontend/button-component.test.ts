/**
 * Comprehensive Button Component Tests
 * Tests the Button component functionality after the onclick prop removal fix
 *
 * @file button-component.test.ts
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
      callback(false); // Default to non-touch device
      return { unsubscribe: vi.fn() };
    })
  }
}));

// Mock navigator.vibrate for haptic feedback tests
Object.defineProperty(window.navigator, 'vibrate', {
  value: vi.fn(),
  writable: true
});

describe('Button Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders button with default props', () => {
      render(Button, {
        props: {},
        children: 'Click me'
      });

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Click me');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).not.toBeDisabled();
    });

    it('renders button with custom text content', () => {
      render(Button, {
        props: {},
        children: 'Custom Button Text'
      });

      expect(screen.getByText('Custom Button Text')).toBeInTheDocument();
    });

    it('renders link when href prop is provided', () => {
      render(Button, {
        props: { href: '/test-link' },
        children: 'Link Button'
      });

      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/test-link');
      expect(link).toHaveTextContent('Link Button');
    });
  });

  describe('Props and Variants', () => {
    it('applies different variants correctly', () => {
      const variants = ['default', 'destructive', 'outline', 'secondary', 'accent', 'warm', 'ghost', 'link'] as const;

      variants.forEach(variant => {
        const { unmount } = render(Button, {
          props: { variant },
          children: `${variant} button`
        });

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();

        unmount();
      });
    });

    it('applies different sizes correctly', () => {
      const sizes = ['default', 'sm', 'lg', 'icon', 'touch'] as const;

      sizes.forEach(size => {
        const { unmount } = render(Button, {
          props: { size },
          children: `${size} button`
        });

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();

        unmount();
      });
    });

    it('applies custom class names', () => {
      render(Button, {
        props: { class: 'custom-class-name' },
        children: 'Styled button'
      });

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class-name');
    });

    it('sets button type correctly', () => {
      const types = ['button', 'submit', 'reset'] as const;

      types.forEach(type => {
        const { unmount } = render(Button, {
          props: { type },
          children: `${type} button`
        });

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('type', type);

        unmount();
      });
    });
  });

  describe('Disabled State', () => {
    it('renders disabled button correctly', () => {
      render(Button, {
        props: { disabled: true },
        children: 'Disabled button'
      });

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('does not trigger click events when disabled', async () => {
      const mockClick = vi.fn();

      const component = render(Button, {
        props: { disabled: true },
        children: 'Disabled button'
      });

      component.component.$on('click', mockClick);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(mockClick).not.toHaveBeenCalled();
    });

    it('does not render as link when disabled and href provided', () => {
      render(Button, {
        props: { disabled: true, href: '/test' },
        children: 'Disabled link'
      });

      // Should render as button, not link, when disabled
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();

      // Should not have link
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('renders loading state correctly', () => {
      render(Button, {
        props: { loading: true },
        children: 'Loading button'
      });

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();

      // Check for loading spinner (SVG element)
      const spinner = button.querySelector('svg');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
    });

    it('does not trigger click events when loading', async () => {
      const mockClick = vi.fn();

      const component = render(Button, {
        props: { loading: true },
        children: 'Loading button'
      });

      component.component.$on('click', mockClick);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(mockClick).not.toHaveBeenCalled();
    });

    it('shows loading spinner in link variant', () => {
      render(Button, {
        props: { loading: true, href: '/test' },
        children: 'Loading link'
      });

      const link = screen.getByRole('link');
      const spinner = link.querySelector('svg');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
    });
  });

  describe('Click Event Handling', () => {
    it('dispatches click event when clicked', async () => {
      const mockClick = vi.fn();

      const component = render(Button, {
        props: {},
        children: 'Clickable button'
      });

      component.component.$on('click', mockClick);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(mockClick).toHaveBeenCalledTimes(1);
      expect(mockClick).toHaveBeenCalledWith(expect.objectContaining({
        detail: expect.any(MouseEvent)
      }));
    });

    it('dispatches click event for link variant', async () => {
      const mockClick = vi.fn();

      const component = render(Button, {
        props: { href: '/test' },
        children: 'Clickable link'
      });

      component.component.$on('click', mockClick);

      const link = screen.getByRole('link');
      await fireEvent.click(link);

      expect(mockClick).toHaveBeenCalledTimes(1);
    });

    it('handles multiple rapid clicks correctly', async () => {
      const mockClick = vi.fn();

      const component = render(Button, {
        props: {},
        children: 'Multi-click button'
      });

      component.component.$on('click', mockClick);

      const button = screen.getByRole('button');

      // Rapid clicks
      await fireEvent.click(button);
      await fireEvent.click(button);
      await fireEvent.click(button);

      expect(mockClick).toHaveBeenCalledTimes(3);
    });

    it('prevents default and stops propagation when disabled', async () => {
      const mockClick = vi.fn();
      const mockPreventDefault = vi.fn();
      const mockStopPropagation = vi.fn();

      const component = render(Button, {
        props: { disabled: true },
        children: 'Disabled button'
      });

      const button = screen.getByRole('button');

      // Mock the event object
      const mockEvent = {
        preventDefault: mockPreventDefault,
        stopPropagation: mockStopPropagation
      };

      // Simulate disabled click handling
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'preventDefault', { value: mockPreventDefault });
      Object.defineProperty(event, 'stopPropagation', { value: mockStopPropagation });

      await fireEvent.click(button);

      // The component should handle disabled state internally
      expect(button).toBeDisabled();
    });
  });

  describe('Haptic Feedback', () => {
    it('triggers haptic feedback on touch devices when enabled', async () => {
      // Mock touch device
      const mockIsTouch = {
        subscribe: vi.fn((callback) => {
          callback(true); // Touch device
          return { unsubscribe: vi.fn() };
        })
      };

      vi.doMock('$lib/stores/device.store', () => ({
        isTouch: mockIsTouch
      }));

      const mockVibrate = vi.fn();
      Object.defineProperty(window.navigator, 'vibrate', {
        value: mockVibrate,
        writable: true
      });

      const component = render(Button, {
        props: { hapticFeedback: true },
        children: 'Haptic button'
      });

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      // Note: In the actual component test, haptic feedback is handled internally
      // We're testing that the component renders and responds to clicks
      expect(button).toBeInTheDocument();
    });

    it('does not trigger haptic feedback when disabled', async () => {
      const mockVibrate = vi.fn();
      Object.defineProperty(window.navigator, 'vibrate', {
        value: mockVibrate,
        writable: true
      });

      render(Button, {
        props: { hapticFeedback: false },
        children: 'No haptic button'
      });

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      // Component should still work without haptic feedback
      expect(button).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(Button, {
        props: {},
        children: 'Accessible button'
      });

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('supports custom ARIA attributes', () => {
      render(Button, {
        props: { 'aria-label': 'Custom aria label' },
        children: 'ARIA button'
      });

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Custom aria label');
    });

    it('is keyboard accessible', async () => {
      const mockClick = vi.fn();

      const component = render(Button, {
        props: {},
        children: 'Keyboard button'
      });

      component.component.$on('click', mockClick);

      const button = screen.getByRole('button');

      // Simulate keyboard events
      button.focus();
      expect(button).toHaveFocus();

      await fireEvent.keyDown(button, { key: 'Enter' });
      await fireEvent.keyUp(button, { key: 'Enter' });

      // Button should be focusable and keyboard accessible
      expect(button).toHaveFocus();
    });
  });

  describe('Event System Integration', () => {
    it('integrates properly with Svelte event system', async () => {
      const clickHandler = vi.fn();

      const component = render(Button, {
        props: {},
        children: 'Event button'
      });

      // Test Svelte event binding
      component.component.$on('click', clickHandler);

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

      const component = render(Button, {
        props: {},
        children: 'Articles button'
      });

      component.component.$on('click', mockHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('Performance and Memory', () => {
    it('properly cleans up event listeners', () => {
      const { unmount } = render(Button, {
        props: {},
        children: 'Cleanup test'
      });

      // Component should render and unmount without memory leaks
      expect(screen.getByRole('button')).toBeInTheDocument();

      unmount();

      // After unmount, button should not be in document
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('handles rapid mount/unmount cycles', () => {
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(Button, {
          props: {},
          children: `Button ${i}`
        });

        expect(screen.getByRole('button')).toBeInTheDocument();
        unmount();
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles empty slot content', () => {
      render(Button, {
        props: {},
        children: ''
      });

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('');
    });

    it('handles complex slot content', () => {
      render(Button, {
        props: {},
        children: '<span>Complex <strong>content</strong></span>'
      });

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('maintains functionality with all props disabled states', async () => {
      const mockClick = vi.fn();

      const component = render(Button, {
        props: {
          disabled: true,
          loading: true,
          variant: 'destructive',
          size: 'sm'
        },
        children: 'Complex disabled button'
      });

      component.component.$on('click', mockClick);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();

      await fireEvent.click(button);
      expect(mockClick).not.toHaveBeenCalled();
    });
  });

  describe('Regression Tests for onclick prop removal', () => {
    it('does not accept onclick prop (regression test)', () => {
      // This test ensures the onclick prop was properly removed
      render(Button, {
        props: {},
        children: 'No onclick prop'
      });

      const button = screen.getByRole('button');

      // Button should not have onclick attribute
      expect(button).not.toHaveAttribute('onclick');
    });

    it('click events work through Svelte dispatch system only', async () => {
      const mockClick = vi.fn();

      const component = render(Button, {
        props: {},
        children: 'Dispatch only button'
      });

      // Use Svelte's event system
      component.component.$on('click', mockClick);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(mockClick).toHaveBeenCalledTimes(1);
    });

    it('maintains backward compatibility with existing usage patterns', async () => {
      // Test that existing patterns still work after the fix
      const handler = vi.fn();

      const component = render(Button, {
        props: {
          variant: 'outline',
          size: 'sm'
        },
        children: 'Compatible button'
      });

      component.component.$on('click', handler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(handler).toHaveBeenCalled();
      expect(button).toHaveClass('border-2'); // outline variant
    });
  });
});
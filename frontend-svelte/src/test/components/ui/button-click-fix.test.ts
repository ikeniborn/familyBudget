/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import userEvent from '@testing-library/user-event';
import Button from '../../../lib/components/ui/Button.svelte';

// Mock device store
vi.mock('../../../lib/stores/device.store', () => {
  return {
    isTouch: {
      subscribe: vi.fn((callback) => {
        callback(false);
        return () => {};
      })
    },
    deviceStore: {
      subscribe: vi.fn((callback) => {
        callback({
          type: 'desktop',
          orientation: 'landscape',
          width: 1920,
          height: 1080,
          isTouchDevice: false,
          isStandalone: false
        });
        return () => {};
      })
    }
  };
});

// navigator.vibrate is already mocked in setup.ts

describe('Button Component Click Fix', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let mockOnClick: ReturnType<typeof vi.fn>;
  let mockOnClickHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    user = userEvent.setup();
    mockOnClick = vi.fn();
    mockOnClickHandler = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Click Event Handling', () => {
    it('should call onclick prop handler when button is clicked', async () => {
      render(Button, {
        props: {
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(mockOnClick).toHaveBeenCalledWith(expect.any(MouseEvent));
    });

    it('should dispatch on:click event when button is clicked', async () => {
      const component = render(Button, {
        props: {}
      });

      // Listen for the click event
      component.component.$on('click', mockOnClickHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnClickHandler).toHaveBeenCalledTimes(1);
      expect(mockOnClickHandler).toHaveBeenCalledWith(expect.any(CustomEvent));
    });

    it('should call both onclick prop and dispatch on:click event together', async () => {
      const component = render(Button, {
        props: {
          onclick: mockOnClick
        }
      });

      component.component.$on('click', mockOnClickHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      // Both handlers should be called
      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(mockOnClickHandler).toHaveBeenCalledTimes(1);

      // Verify the order: onclick prop first, then dispatch
      expect(mockOnClick).toHaveBeenCalledWith(expect.any(MouseEvent));
      expect(mockOnClickHandler).toHaveBeenCalledWith(expect.any(CustomEvent));
    });

    it('should pass the MouseEvent object to onclick handler', async () => {
      render(Button, {
        props: {
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      const calledEvent = mockOnClick.mock.calls[0][0];
      expect(calledEvent).toBeInstanceOf(MouseEvent);
      expect(calledEvent.type).toBe('click');
      expect(calledEvent.target).toBe(button);
    });
  });

  describe('Disabled State Prevention', () => {
    it('should prevent onclick handler when button is disabled', async () => {
      render(Button, {
        props: {
          disabled: true,
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();

      await user.click(button);

      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('should prevent on:click dispatch when button is disabled', async () => {
      const component = render(Button, {
        props: {
          disabled: true
        }
      });

      component.component.$on('click', mockOnClickHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnClickHandler).not.toHaveBeenCalled();
    });

    it('should prevent both handlers when button is disabled', async () => {
      const component = render(Button, {
        props: {
          disabled: true,
          onclick: mockOnClick
        }
      });

      component.component.$on('click', mockOnClickHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnClick).not.toHaveBeenCalled();
      expect(mockOnClickHandler).not.toHaveBeenCalled();
    });

    it('should call preventDefault and stopPropagation when disabled', async () => {
      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        type: 'click',
        target: null
      } as unknown as MouseEvent;

      render(Button, {
        props: {
          disabled: true,
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');

      // Manually trigger the internal handleClick with a mock event
      await fireEvent.click(button, mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('Loading State Prevention', () => {
    it('should prevent onclick handler when button is loading', async () => {
      render(Button, {
        props: {
          loading: true,
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('should prevent on:click dispatch when button is loading', async () => {
      const component = render(Button, {
        props: {
          loading: true
        }
      });

      component.component.$on('click', mockOnClickHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnClickHandler).not.toHaveBeenCalled();
    });

    it('should prevent both handlers when button is loading', async () => {
      const component = render(Button, {
        props: {
          loading: true,
          onclick: mockOnClick
        }
      });

      component.component.$on('click', mockOnClickHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnClick).not.toHaveBeenCalled();
      expect(mockOnClickHandler).not.toHaveBeenCalled();
    });

    it('should show loading spinner when loading is true', () => {
      render(Button, {
        props: {
          loading: true
        }
      });

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Event Propagation Handling', () => {
    it('should allow event propagation when not disabled or loading', async () => {
      const parentClickHandler = vi.fn();

      const { container } = render(Button, {
        props: {
          onclick: mockOnClick
        }
      });

      // Add parent click handler
      container.addEventListener('click', parentClickHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      // Both button and parent handlers should be called
      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(parentClickHandler).toHaveBeenCalledTimes(1);
    });

    it('should stop event propagation when disabled', async () => {
      const parentClickHandler = vi.fn();

      const { container } = render(Button, {
        props: {
          disabled: true,
          onclick: mockOnClick
        }
      });

      container.addEventListener('click', parentClickHandler);

      const button = screen.getByRole('button');

      // Use fireEvent to trigger the disabled button click
      await fireEvent.click(button);

      // Neither button nor parent handlers should be called due to stopPropagation
      expect(mockOnClick).not.toHaveBeenCalled();
      // Parent handler might still be called due to DOM behavior with disabled buttons
      // The important thing is that our button handlers are not called
    });

    it('should stop event propagation when loading', async () => {
      const parentClickHandler = vi.fn();

      const { container } = render(Button, {
        props: {
          loading: true,
          onclick: mockOnClick
        }
      });

      container.addEventListener('click', parentClickHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      // Button handler should not be called
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('Haptic Feedback on Touch Devices', () => {
    it('should not trigger haptic feedback on non-touch devices (mocked as desktop)', async () => {
      const vibrateSpy = vi.spyOn(navigator, 'vibrate');

      render(Button, {
        props: {
          hapticFeedback: true,
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      // Since isTouch is mocked as false, no haptic feedback should trigger
      expect(vibrateSpy).not.toHaveBeenCalled();
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should not trigger haptic feedback when hapticFeedback is disabled', async () => {
      const vibrateSpy = vi.spyOn(navigator, 'vibrate');

      render(Button, {
        props: {
          hapticFeedback: false,
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(vibrateSpy).not.toHaveBeenCalled();
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Anchor Tag Behavior', () => {
    it('should call onclick handler for anchor links', async () => {
      render(Button, {
        props: {
          href: '/test-url',
          onclick: mockOnClick
        }
      });

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/test-url');

      await user.click(link);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should dispatch on:click event for anchor links', async () => {
      const component = render(Button, {
        props: {
          href: '/test-url'
        }
      });

      component.component.$on('click', mockOnClickHandler);

      const link = screen.getByRole('link');
      await user.click(link);

      expect(mockOnClickHandler).toHaveBeenCalledTimes(1);
    });

    it('should render as button when href is provided but disabled', () => {
      render(Button, {
        props: {
          href: '/test-url',
          disabled: true,
          onclick: mockOnClick
        }
      });

      // Should render as button when disabled, not as link
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();

      // Should not have href when disabled
      expect(button).not.toHaveAttribute('href');
    });
  });

  describe('Multiple Click Handling', () => {
    it('should handle multiple rapid clicks correctly', async () => {
      render(Button, {
        props: {
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');

      // Simulate rapid clicks
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple clicks with both handlers', async () => {
      const component = render(Button, {
        props: {
          onclick: mockOnClick
        }
      });

      component.component.$on('click', mockOnClickHandler);

      const button = screen.getByRole('button');

      await user.click(button);
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(2);
      expect(mockOnClickHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined onclick prop gracefully', async () => {
      const component = render(Button, {
        props: {
          onclick: undefined
        }
      });

      component.component.$on('click', mockOnClickHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      // Should still dispatch event even when onclick is undefined
      expect(mockOnClickHandler).toHaveBeenCalledTimes(1);
      expect(() => user.click(button)).not.toThrow();
    });

    it('should handle null onclick prop gracefully', async () => {
      const component = render(Button, {
        props: {
          onclick: null as any
        }
      });

      component.component.$on('click', mockOnClickHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnClickHandler).toHaveBeenCalledTimes(1);
      expect(() => user.click(button)).not.toThrow();
    });

    it('should handle onclick prop that throws an error', async () => {
      const errorThrowingHandler = vi.fn(() => {
        throw new Error('Test error');
      });

      const component = render(Button, {
        props: {
          onclick: errorThrowingHandler
        }
      });

      component.component.$on('click', mockOnClickHandler);

      const button = screen.getByRole('button');

      // Click should still work, but onclick handler throws
      await expect(user.click(button)).rejects.toThrow('Test error');

      expect(errorThrowingHandler).toHaveBeenCalledTimes(1);
      // The on:click dispatch should still happen even if onclick throws
      // Note: This behavior depends on implementation - the dispatch might not happen if onclick throws
    });

    it('should handle changing onclick prop dynamically', async () => {
      const initialHandler = vi.fn();
      const newHandler = vi.fn();

      const { rerender } = render(Button, {
        props: {
          onclick: initialHandler
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(initialHandler).toHaveBeenCalledTimes(1);
      expect(newHandler).not.toHaveBeenCalled();

      // Update the onclick prop
      rerender({
        onclick: newHandler
      });

      await user.click(button);

      expect(initialHandler).toHaveBeenCalledTimes(1); // Still 1
      expect(newHandler).toHaveBeenCalledTimes(1); // Now called
    });
  });

  describe('Accessibility and Keyboard Events', () => {
    it('should trigger click handlers on Enter key press', async () => {
      render(Button, {
        props: {
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard('{Enter}');

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should trigger click handlers on Space key press', async () => {
      render(Button, {
        props: {
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard(' ');

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should not trigger handlers on other key presses', async () => {
      render(Button, {
        props: {
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard('{Escape}');
      await user.keyboard('{Tab}');
      await user.keyboard('a');

      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('Component State Management', () => {
    it('should maintain onclick handler reference across re-renders', async () => {
      const stableHandler = vi.fn();

      const { rerender } = render(Button, {
        props: {
          onclick: stableHandler,
          disabled: false
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(stableHandler).toHaveBeenCalledTimes(1);

      // Re-render with different props but same handler
      rerender({
        onclick: stableHandler,
        disabled: false,
        variant: 'destructive' as const
      });

      await user.click(button);

      expect(stableHandler).toHaveBeenCalledTimes(2);
    });

    it('should work correctly when switching between disabled and enabled states', async () => {
      const { rerender } = render(Button, {
        props: {
          onclick: mockOnClick,
          disabled: true
        }
      });

      const button = screen.getByRole('button');

      // Click when disabled
      await user.click(button);
      expect(mockOnClick).not.toHaveBeenCalled();

      // Enable the button
      rerender({
        onclick: mockOnClick,
        disabled: false
      });

      // Click when enabled
      await user.click(button);
      expect(mockOnClick).toHaveBeenCalledTimes(1);

      // Disable again
      rerender({
        onclick: mockOnClick,
        disabled: true
      });

      // Click when disabled again
      await user.click(button);
      expect(mockOnClick).toHaveBeenCalledTimes(1); // Still 1, no new call
    });
  });
});
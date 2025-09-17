import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import userEvent from '@testing-library/user-event';
import Button from '$lib/components/ui/Button.svelte';

// Mock device store for consistent testing
vi.mock('$lib/stores/device.store', () => {
  return {
    isTouch: {
      subscribe: vi.fn((callback) => {
        callback(false); // Default to desktop
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

// Mock navigator.vibrate for haptic feedback tests
Object.defineProperty(navigator, 'vibrate', {
  writable: true,
  value: vi.fn(),
});

// Mock console methods to avoid noise in tests
const consoleMock = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

vi.stubGlobal('console', consoleMock);

describe('Button Component Event Forwarding Validation - Comprehensive Test Suite', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let mockClickHandler: ReturnType<typeof vi.fn>;
  let mockEventDispatcher: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    user = userEvent.setup();
    mockClickHandler = vi.fn();
    mockEventDispatcher = vi.fn();
    vi.clearAllMocks();
    consoleMock.log.mockClear();
    consoleMock.warn.mockClear();
    consoleMock.error.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Event Forwarding Core Functionality', () => {
    it('should forward click events using Svelte on:click directive', async () => {
      const component = render(Button, {
        props: {
          'data-testid': 'forward-test-button'
        }
      });

      // Listen for the on:click event that should be dispatched
      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByTestId('forward-test-button');
      await user.click(button);

      expect(mockEventDispatcher).toHaveBeenCalledTimes(1);
      expect(mockEventDispatcher).toHaveBeenCalledWith(expect.any(CustomEvent));
    });

    it('should execute internal haptic feedback without blocking event propagation', async () => {
      const component = render(Button, {
        props: {
          hapticFeedback: true,
          'data-testid': 'haptic-button'
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByTestId('haptic-button');
      await user.click(button);

      // Both haptic feedback AND event forwarding should work
      expect(consoleMock.log).toHaveBeenCalledWith(
        expect.stringContaining('Button clicked - haptic feedback handler')
      );
      expect(consoleMock.log).toHaveBeenCalledWith(
        expect.stringContaining('Click event propagating to parent handlers')
      );
      expect(mockEventDispatcher).toHaveBeenCalledTimes(1);
    });

    it('should propagate MouseEvent details through CustomEvent', async () => {
      const component = render(Button, {
        props: {}
      });

      let capturedEvent: CustomEvent;
      component.component.$on('click', (event: CustomEvent) => {
        capturedEvent = event;
        mockEventDispatcher(event);
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(capturedEvent!).toBeInstanceOf(CustomEvent);
      expect(capturedEvent!.type).toBe('click');
      expect(capturedEvent!.detail).toBeInstanceOf(MouseEvent);
      expect(capturedEvent!.detail.type).toBe('click');
      expect(capturedEvent!.detail.target).toBe(button);
    });

    it('should support multiple on:click event listeners', async () => {
      const component = render(Button, {
        props: {}
      });

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      component.component.$on('click', handler1);
      component.component.$on('click', handler2);
      component.component.$on('click', handler3);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('should maintain event ordering: haptic feedback → event forwarding', async () => {
      const component = render(Button, {
        props: {}
      });

      const eventHandler = vi.fn();
      component.component.$on('click', eventHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      // Check console logs to verify order
      const logCalls = consoleMock.log.mock.calls;
      const hapticIndex = logCalls.findIndex(call =>
        call[0]?.includes('Button clicked - haptic feedback handler')
      );
      const propagateIndex = logCalls.findIndex(call =>
        call[0]?.includes('Click event propagating to parent handlers')
      );

      expect(hapticIndex).toBeLessThan(propagateIndex);
      expect(eventHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Disabled State Event Prevention', () => {
    it('should prevent all events when button is disabled', async () => {
      const component = render(Button, {
        props: {
          disabled: true
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();

      await user.click(button);

      expect(mockEventDispatcher).not.toHaveBeenCalled();
      expect(consoleMock.log).toHaveBeenCalledWith(
        expect.stringContaining('Button disabled or loading, preventing click')
      );
    });

    it('should call preventDefault and stopPropagation for disabled buttons', async () => {
      render(Button, {
        props: {
          disabled: true
        }
      });

      const button = screen.getByRole('button');

      // Create a mock event to track preventDefault/stopPropagation
      const mockEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(mockEvent, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(mockEvent, 'stopPropagation');

      fireEvent(button, mockEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('should maintain disabled visual state', () => {
      render(Button, {
        props: {
          disabled: true
        }
      });

      const button = screen.getByRole('button');
      expect(button).toHaveClass('disabled:pointer-events-none');
      expect(button).toHaveClass('disabled:opacity-50');
    });

    it('should prevent event forwarding even with onclick prop when disabled', async () => {
      const component = render(Button, {
        props: {
          disabled: true,
          onclick: mockClickHandler
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockClickHandler).not.toHaveBeenCalled();
      expect(mockEventDispatcher).not.toHaveBeenCalled();
    });
  });

  describe('3. Loading State Event Prevention', () => {
    it('should prevent all events when button is loading', async () => {
      const component = render(Button, {
        props: {
          loading: true
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockEventDispatcher).not.toHaveBeenCalled();
      expect(consoleMock.log).toHaveBeenCalledWith(
        expect.stringContaining('Button disabled or loading, preventing click')
      );
    });

    it('should display loading spinner correctly', () => {
      render(Button, {
        props: {
          loading: true
        }
      });

      const loadingSpinner = document.querySelector('.animate-spin');
      expect(loadingSpinner).toBeInTheDocument();
      expect(loadingSpinner?.tagName).toBe('svg');

      // Check for spinner paths
      const circle = loadingSpinner?.querySelector('circle');
      const path = loadingSpinner?.querySelector('path');
      expect(circle).toBeInTheDocument();
      expect(path).toBeInTheDocument();
    });

    it('should prevent both onclick and event forwarding when loading', async () => {
      const component = render(Button, {
        props: {
          loading: true,
          onclick: mockClickHandler
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockClickHandler).not.toHaveBeenCalled();
      expect(mockEventDispatcher).not.toHaveBeenCalled();
    });

    it('should handle rapid state changes between loading and enabled', async () => {
      const { rerender } = render(Button, {
        props: {
          loading: false,
          onclick: mockClickHandler
        }
      });

      const button = screen.getByRole('button');

      // Click when not loading
      await user.click(button);
      expect(mockClickHandler).toHaveBeenCalledTimes(1);

      // Set to loading
      rerender({ loading: true, onclick: mockClickHandler });
      await user.click(button);
      expect(mockClickHandler).toHaveBeenCalledTimes(1); // Still 1

      // Set back to not loading
      rerender({ loading: false, onclick: mockClickHandler });
      await user.click(button);
      expect(mockClickHandler).toHaveBeenCalledTimes(2); // Now 2
    });
  });

  describe('4. Haptic Feedback Integration', () => {
    it('should not interfere with event forwarding when haptic feedback is enabled', async () => {
      const component = render(Button, {
        props: {
          hapticFeedback: true
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockEventDispatcher).toHaveBeenCalledTimes(1);
      expect(consoleMock.log).toHaveBeenCalledWith(
        expect.stringContaining('Click event propagating to parent handlers')
      );
    });

    it('should still forward events when haptic feedback is disabled', async () => {
      const component = render(Button, {
        props: {
          hapticFeedback: false
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockEventDispatcher).toHaveBeenCalledTimes(1);
    });

    it('should not call navigator.vibrate on desktop (mocked)', async () => {
      const vibrateSpy = vi.spyOn(navigator, 'vibrate');

      render(Button, {
        props: {
          hapticFeedback: true
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      // Since isTouch is mocked as false, no vibration should occur
      expect(vibrateSpy).not.toHaveBeenCalled();
    });

    it('should handle haptic feedback errors gracefully', async () => {
      // Mock vibrate to throw an error
      const originalVibrate = navigator.vibrate;
      vi.spyOn(navigator, 'vibrate').mockImplementation(() => {
        throw new Error('Vibration not supported');
      });

      const component = render(Button, {
        props: {
          hapticFeedback: true
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');

      // Should not throw and should still forward events
      await expect(user.click(button)).resolves.not.toThrow();
      expect(mockEventDispatcher).toHaveBeenCalledTimes(1);

      // Restore original
      navigator.vibrate = originalVibrate;
    });
  });

  describe('5. Link/Anchor Button Event Forwarding', () => {
    it('should forward events for anchor elements when href is provided', async () => {
      const component = render(Button, {
        props: {
          href: '/test-link'
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/test-link');

      await user.click(link);

      expect(mockEventDispatcher).toHaveBeenCalledTimes(1);
    });

    it('should handle both onclick prop and event forwarding for links', async () => {
      const component = render(Button, {
        props: {
          href: '/test-link',
          onclick: mockClickHandler
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const link = screen.getByRole('link');
      await user.click(link);

      expect(mockClickHandler).toHaveBeenCalledTimes(1);
      expect(mockEventDispatcher).toHaveBeenCalledTimes(1);
    });

    it('should render as button (not link) when href provided but disabled', async () => {
      const component = render(Button, {
        props: {
          href: '/should-not-work',
          disabled: true
        }
      });

      component.component.$on('click', mockEventDispatcher);

      // Should render as button, not link when disabled
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
      expect(button).not.toHaveAttribute('href');

      // Should not find a link element
      expect(screen.queryByRole('link')).not.toBeInTheDocument();

      await user.click(button);
      expect(mockEventDispatcher).not.toHaveBeenCalled();
    });
  });

  describe('6. Multiple Event Handler Support', () => {
    it('should support both onclick prop and on:click listeners simultaneously', async () => {
      const component = render(Button, {
        props: {
          onclick: mockClickHandler
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockClickHandler).toHaveBeenCalledTimes(1);
      expect(mockEventDispatcher).toHaveBeenCalledTimes(1);

      // Verify onclick is called before event dispatch
      expect(mockClickHandler.mock.invocationCallOrder[0])
        .toBeLessThan(mockEventDispatcher.mock.invocationCallOrder[0]);
    });

    it('should handle dynamic onclick prop changes', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const { rerender } = render(Button, {
        props: {
          onclick: handler1
        }
      });

      const button = screen.getByRole('button');

      // Test first handler
      await user.click(button);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();

      // Change the onclick prop
      rerender({ onclick: handler2 });

      // Test second handler
      await user.click(button);
      expect(handler1).toHaveBeenCalledTimes(1); // Still 1
      expect(handler2).toHaveBeenCalledTimes(1); // Now called
    });

    it('should work with restProps event handlers', async () => {
      const onMouseOver = vi.fn();
      const onMouseOut = vi.fn();

      const component = render(Button, {
        props: {
          onclick: mockClickHandler,
          onmouseover: onMouseOver,
          onmouseout: onMouseOut
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');

      await user.hover(button);
      expect(onMouseOver).toHaveBeenCalledTimes(1);

      await user.click(button);
      expect(mockClickHandler).toHaveBeenCalledTimes(1);
      expect(mockEventDispatcher).toHaveBeenCalledTimes(1);

      await user.unhover(button);
      expect(onMouseOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('7. Event Bubbling and Propagation', () => {
    it('should allow event bubbling to parent containers', async () => {
      const parentHandler = vi.fn();
      const { container } = render(Button, {
        props: {
          onclick: mockClickHandler
        }
      });

      container.addEventListener('click', parentHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockClickHandler).toHaveBeenCalledTimes(1);
      expect(parentHandler).toHaveBeenCalledTimes(1);
    });

    it('should stop propagation when button is disabled', async () => {
      const parentHandler = vi.fn();

      const { container } = render(Button, {
        props: {
          disabled: true,
          onclick: mockClickHandler
        }
      });

      container.addEventListener('click', parentHandler);

      const button = screen.getByRole('button');

      // Use fireEvent to trigger disabled button behavior
      const mockEvent = new MouseEvent('click', { bubbles: true });
      const stopPropagationSpy = vi.spyOn(mockEvent, 'stopPropagation');

      fireEvent(button, mockEvent);

      expect(stopPropagationSpy).toHaveBeenCalled();
      expect(mockClickHandler).not.toHaveBeenCalled();
    });

    it('should stop propagation when button is loading', async () => {
      const parentHandler = vi.fn();

      const { container } = render(Button, {
        props: {
          loading: true,
          onclick: mockClickHandler
        }
      });

      container.addEventListener('click', parentHandler);

      const button = screen.getByRole('button');

      const mockEvent = new MouseEvent('click', { bubbles: true });
      const stopPropagationSpy = vi.spyOn(mockEvent, 'stopPropagation');

      fireEvent(button, mockEvent);

      expect(stopPropagationSpy).toHaveBeenCalled();
      expect(mockClickHandler).not.toHaveBeenCalled();
    });
  });

  describe('8. Keyboard Navigation and Accessibility', () => {
    it('should forward events on Enter key press', async () => {
      const component = render(Button, {
        props: {
          onclick: mockClickHandler
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard('{Enter}');

      expect(mockClickHandler).toHaveBeenCalledTimes(1);
      expect(mockEventDispatcher).toHaveBeenCalledTimes(1);
    });

    it('should forward events on Space key press', async () => {
      const component = render(Button, {
        props: {
          onclick: mockClickHandler
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard(' ');

      expect(mockClickHandler).toHaveBeenCalledTimes(1);
      expect(mockEventDispatcher).toHaveBeenCalledTimes(1);
    });

    it('should maintain proper focus classes for accessibility', () => {
      render(Button, {
        props: {}
      });

      const button = screen.getByRole('button');

      expect(button).toHaveClass('focus-visible:outline-none');
      expect(button).toHaveClass('focus-visible:ring-2');
      expect(button).toHaveClass('focus-visible:ring-offset-2');
    });

    it('should not trigger on irrelevant keyboard keys', async () => {
      const component = render(Button, {
        props: {
          onclick: mockClickHandler
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard('{Escape}');
      await user.keyboard('{Tab}');
      await user.keyboard('a');
      await user.keyboard('{ArrowDown}');

      expect(mockClickHandler).not.toHaveBeenCalled();
      expect(mockEventDispatcher).not.toHaveBeenCalled();
    });
  });

  describe('9. Edge Cases and Error Handling', () => {
    it('should handle undefined onclick prop gracefully', async () => {
      const component = render(Button, {
        props: {
          onclick: undefined
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');

      await expect(user.click(button)).resolves.not.toThrow();
      expect(mockEventDispatcher).toHaveBeenCalledTimes(1);
    });

    it('should handle null onclick prop gracefully', async () => {
      const component = render(Button, {
        props: {
          onclick: null as any
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');

      await expect(user.click(button)).resolves.not.toThrow();
      expect(mockEventDispatcher).toHaveBeenCalledTimes(1);
    });

    it('should propagate onclick errors while still forwarding events', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Test error from onclick');
      });

      const component = render(Button, {
        props: {
          onclick: errorHandler
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');

      await expect(user.click(button)).rejects.toThrow('Test error from onclick');
      expect(errorHandler).toHaveBeenCalledTimes(1);
      // Event should still be dispatched even if onclick throws
      expect(mockEventDispatcher).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid successive clicks without losing events', async () => {
      const component = render(Button, {
        props: {
          onclick: mockClickHandler
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');

      // Simulate rapid clicking
      for (let i = 0; i < 10; i++) {
        await user.click(button);
      }

      expect(mockClickHandler).toHaveBeenCalledTimes(10);
      expect(mockEventDispatcher).toHaveBeenCalledTimes(10);
    });

    it('should work correctly across all button variants and sizes', async () => {
      const variants = ['default', 'destructive', 'outline', 'secondary', 'accent', 'warm', 'ghost', 'link'] as const;
      const sizes = ['default', 'sm', 'lg', 'icon', 'touch'] as const;

      for (const variant of variants) {
        for (const size of sizes) {
          const testHandler = vi.fn();
          const testEventHandler = vi.fn();

          const component = render(Button, {
            props: {
              variant,
              size,
              onclick: testHandler,
              'data-testid': `${variant}-${size}-btn`
            }
          });

          component.component.$on('click', testEventHandler);

          const button = screen.getByTestId(`${variant}-${size}-btn`);
          await user.click(button);

          expect(testHandler).toHaveBeenCalledTimes(1);
          expect(testEventHandler).toHaveBeenCalledTimes(1);

          // Clean up for next iteration
          testHandler.mockClear();
          testEventHandler.mockClear();
        }
      }
    });

    it('should handle button type changes without affecting event forwarding', async () => {
      const { rerender } = render(Button, {
        props: {
          type: 'button',
          onclick: mockClickHandler
        }
      });

      const component = render(Button, {
        props: {
          type: 'button'
        }
      });

      component.component.$on('click', mockEventDispatcher);

      const button = screen.getByRole('button');

      // Test as button
      await user.click(button);
      expect(mockEventDispatcher).toHaveBeenCalledTimes(1);

      // Change to submit type
      rerender({ type: 'submit', onclick: mockClickHandler });
      expect(button).toHaveAttribute('type', 'submit');

      await user.click(button);
      expect(mockEventDispatcher).toHaveBeenCalledTimes(2);

      // Change to reset type
      rerender({ type: 'reset', onclick: mockClickHandler });
      expect(button).toHaveAttribute('type', 'reset');

      await user.click(button);
      expect(mockEventDispatcher).toHaveBeenCalledTimes(3);
    });
  });

  describe('10. Performance and Memory Management', () => {
    it('should not create memory leaks with event listeners', async () => {
      const component = render(Button, {
        props: {}
      });

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      // Add multiple listeners
      const unsubscribe1 = component.component.$on('click', handler1);
      const unsubscribe2 = component.component.$on('click', handler2);
      const unsubscribe3 = component.component.$on('click', handler3);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);

      // Cleanup
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();

      // Click again - handlers should not be called
      await user.click(button);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('should handle component destruction gracefully', async () => {
      const { unmount } = render(Button, {
        props: {
          onclick: mockClickHandler
        }
      });

      // Component should unmount without errors
      expect(() => unmount()).not.toThrow();
    });

    it('should handle frequent prop updates without degradation', async () => {
      const { rerender } = render(Button, {
        props: {
          variant: 'default',
          onclick: mockClickHandler
        }
      });

      const component = render(Button, {
        props: {
          variant: 'default'
        }
      });

      component.component.$on('click', mockEventDispatcher);

      // Simulate frequent updates
      const variants = ['default', 'outline', 'secondary', 'accent'] as const;
      const button = screen.getByRole('button');

      for (let i = 0; i < 20; i++) {
        const variant = variants[i % variants.length];
        rerender({ variant, onclick: mockClickHandler });
        await user.click(button);
      }

      expect(mockEventDispatcher).toHaveBeenCalledTimes(20);
    });
  });
});
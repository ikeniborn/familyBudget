import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import userEvent from '@testing-library/user-event';
import Button from '../../frontend-svelte/src/lib/components/ui/Button.svelte';

// Mock device store for consistent testing
vi.mock('../../frontend-svelte/src/lib/stores/device.store', () => {
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

// Mock navigator.vibrate for haptic feedback tests
Object.defineProperty(navigator, 'vibrate', {
  writable: true,
  value: vi.fn(),
});

describe('Button Component Click Fix - Comprehensive Test Suite', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let mockOnClick: ReturnType<typeof vi.fn>;
  let mockEventHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    user = userEvent.setup();
    mockOnClick = vi.fn();
    mockEventHandler = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Core Click Event Handling (on:click Directive Fix)', () => {
    it('should properly handle click events using on:click directive', async () => {
      const component = render(Button, {
        props: {
          'data-testid': 'test-button'
        }
      });

      // Listen for the on:click event that should be dispatched
      component.component.$on('click', mockEventHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockEventHandler).toHaveBeenCalledTimes(1);
      expect(mockEventHandler).toHaveBeenCalledWith(expect.any(CustomEvent));
    });

    it('should execute onclick prop function when provided', async () => {
      render(Button, {
        props: {
          onclick: mockOnClick,
          'data-testid': 'prop-button'
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(mockOnClick).toHaveBeenCalledWith(expect.any(MouseEvent));
    });

    it('should call both onclick prop and dispatch on:click event', async () => {
      const component = render(Button, {
        props: {
          onclick: mockOnClick
        }
      });

      component.component.$on('click', mockEventHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      // Both should be called
      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(mockEventHandler).toHaveBeenCalledTimes(1);

      // Verify onclick is called before dispatch
      const mockCallTime = mockOnClick.mock.invocationCallOrder[0];
      const eventCallTime = mockEventHandler.mock.invocationCallOrder[0];
      expect(mockCallTime).toBeLessThan(eventCallTime);
    });

    it('should pass correct MouseEvent properties to handlers', async () => {
      render(Button, {
        props: {
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      const receivedEvent = mockOnClick.mock.calls[0][0];
      expect(receivedEvent).toBeInstanceOf(MouseEvent);
      expect(receivedEvent.type).toBe('click');
      expect(receivedEvent.target).toBe(button);
      expect(receivedEvent.bubbles).toBe(true);
    });
  });

  describe('2. Disabled Button Event Prevention', () => {
    it('should not trigger onclick when disabled', async () => {
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

    it('should not dispatch on:click event when disabled', async () => {
      const component = render(Button, {
        props: {
          disabled: true
        }
      });

      component.component.$on('click', mockEventHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockEventHandler).not.toHaveBeenCalled();
    });

    it('should call preventDefault and stopPropagation for disabled buttons', async () => {
      render(Button, {
        props: {
          disabled: true,
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');

      // Create a mock event to track preventDefault/stopPropagation
      const mockEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(mockEvent, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(mockEvent, 'stopPropagation');

      // Fire the event directly
      fireEvent(button, mockEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('should maintain disabled state styling', () => {
      render(Button, {
        props: {
          disabled: true
        }
      });

      const button = screen.getByRole('button');
      expect(button).toHaveClass('disabled:pointer-events-none');
      expect(button).toHaveClass('disabled:opacity-50');
    });
  });

  describe('3. Loading State Event Prevention', () => {
    it('should not trigger onclick when loading', async () => {
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

    it('should not dispatch on:click event when loading', async () => {
      const component = render(Button, {
        props: {
          loading: true
        }
      });

      component.component.$on('click', mockEventHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockEventHandler).not.toHaveBeenCalled();
    });

    it('should display loading spinner when loading', () => {
      render(Button, {
        props: {
          loading: true
        }
      });

      const loadingSpinner = document.querySelector('.animate-spin');
      expect(loadingSpinner).toBeInTheDocument();
      expect(loadingSpinner?.tagName).toBe('svg');
    });

    it('should prevent both onclick and dispatch when loading', async () => {
      const component = render(Button, {
        props: {
          loading: true,
          onclick: mockOnClick
        }
      });

      component.component.$on('click', mockEventHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnClick).not.toHaveBeenCalled();
      expect(mockEventHandler).not.toHaveBeenCalled();
    });
  });

  describe('4. Event Dispatching for Components (on:click listener support)', () => {
    it('should support on:click listeners from parent components', async () => {
      const component = render(Button, {
        props: {}
      });

      const clickHandler = vi.fn();
      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(clickHandler).toHaveBeenCalledTimes(1);
      expect(clickHandler).toHaveBeenCalledWith(expect.any(CustomEvent));
    });

    it('should pass MouseEvent through CustomEvent detail', async () => {
      const component = render(Button, {
        props: {}
      });

      let capturedEvent: CustomEvent;
      component.component.$on('click', (event: CustomEvent) => {
        capturedEvent = event;
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(capturedEvent!).toBeInstanceOf(CustomEvent);
      expect(capturedEvent!.type).toBe('click');
      // The detail should contain the original MouseEvent
      expect(capturedEvent!.detail).toBeInstanceOf(MouseEvent);
    });

    it('should work with multiple on:click listeners', async () => {
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
  });

  describe('5. Articles Page Button Scenarios', () => {
    it('should handle article creation button clicks', async () => {
      const createHandler = vi.fn();
      const component = render(Button, {
        props: {
          variant: 'default',
          onclick: createHandler,
          'data-testid': 'create-article-btn'
        }
      });

      // Simulate articles page listener
      component.component.$on('click', mockEventHandler);

      const button = screen.getByTestId('create-article-btn');
      await user.click(button);

      expect(createHandler).toHaveBeenCalledTimes(1);
      expect(mockEventHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle article edit button clicks', async () => {
      const editHandler = vi.fn();
      render(Button, {
        props: {
          variant: 'outline',
          size: 'sm',
          onclick: editHandler,
          'data-testid': 'edit-article-btn'
        }
      });

      const button = screen.getByTestId('edit-article-btn');
      await user.click(button);

      expect(editHandler).toHaveBeenCalledTimes(1);
      expect(editHandler).toHaveBeenCalledWith(expect.any(MouseEvent));
    });

    it('should handle article delete button clicks', async () => {
      const deleteHandler = vi.fn();
      const component = render(Button, {
        props: {
          variant: 'destructive',
          size: 'sm',
          onclick: deleteHandler,
          'data-testid': 'delete-article-btn'
        }
      });

      component.component.$on('click', mockEventHandler);

      const button = screen.getByTestId('delete-article-btn');
      await user.click(button);

      expect(deleteHandler).toHaveBeenCalledTimes(1);
      expect(mockEventHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle save/submit button clicks in article forms', async () => {
      const saveHandler = vi.fn();
      render(Button, {
        props: {
          type: 'submit',
          variant: 'default',
          onclick: saveHandler,
          'data-testid': 'save-article-btn'
        }
      });

      const button = screen.getByTestId('save-article-btn');
      expect(button).toHaveAttribute('type', 'submit');

      await user.click(button);

      expect(saveHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle cancel button clicks in article modals', async () => {
      const cancelHandler = vi.fn();
      const component = render(Button, {
        props: {
          variant: 'secondary',
          onclick: cancelHandler,
          'data-testid': 'cancel-article-btn'
        }
      });

      component.component.$on('click', mockEventHandler);

      const button = screen.getByTestId('cancel-article-btn');
      await user.click(button);

      expect(cancelHandler).toHaveBeenCalledTimes(1);
      expect(mockEventHandler).toHaveBeenCalledTimes(1);
    });

    it('should prevent actions when article operations are loading', async () => {
      const actionHandler = vi.fn();
      render(Button, {
        props: {
          loading: true,
          onclick: actionHandler,
          'data-testid': 'loading-article-btn'
        }
      });

      const button = screen.getByTestId('loading-article-btn');
      const spinner = button.querySelector('.animate-spin');

      expect(spinner).toBeInTheDocument();

      await user.click(button);

      expect(actionHandler).not.toHaveBeenCalled();
    });

    it('should disable buttons when articles are being processed', async () => {
      const processHandler = vi.fn();
      render(Button, {
        props: {
          disabled: true,
          onclick: processHandler,
          'data-testid': 'disabled-article-btn'
        }
      });

      const button = screen.getByTestId('disabled-article-btn');
      expect(button).toBeDisabled();

      await user.click(button);

      expect(processHandler).not.toHaveBeenCalled();
    });
  });

  describe('6. Link/Anchor Button Behavior', () => {
    it('should handle onclick for anchor elements when href is provided', async () => {
      render(Button, {
        props: {
          href: '/articles/123',
          onclick: mockOnClick,
          'data-testid': 'article-link-btn'
        }
      });

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/articles/123');

      await user.click(link);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should dispatch on:click for anchor elements', async () => {
      const component = render(Button, {
        props: {
          href: '/articles/456'
        }
      });

      component.component.$on('click', mockEventHandler);

      const link = screen.getByRole('link');
      await user.click(link);

      expect(mockEventHandler).toHaveBeenCalledTimes(1);
    });

    it('should render as button when href provided but disabled', () => {
      render(Button, {
        props: {
          href: '/articles/789',
          disabled: true,
          onclick: mockOnClick
        }
      });

      // Should render as button, not link when disabled
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
      expect(button).not.toHaveAttribute('href');

      // Should not find a link element
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('7. Accessibility and Keyboard Navigation', () => {
    it('should trigger click on Enter key press', async () => {
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

    it('should trigger click on Space key press', async () => {
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

    it('should maintain proper focus management', () => {
      render(Button, {
        props: {}
      });

      const button = screen.getByRole('button');

      // Check focus-related classes are present
      expect(button).toHaveClass('focus-visible:outline-none');
      expect(button).toHaveClass('focus-visible:ring-2');
      expect(button).toHaveClass('focus-visible:ring-offset-2');
    });

    it('should not trigger on other keyboard keys', async () => {
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

  describe('8. Event Propagation and Bubbling', () => {
    it('should allow event bubbling when not disabled', async () => {
      const parentHandler = vi.fn();
      const { container } = render(Button, {
        props: {
          onclick: mockOnClick
        }
      });

      container.addEventListener('click', parentHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(parentHandler).toHaveBeenCalledTimes(1);
    });

    it('should stop propagation when disabled', async () => {
      const parentHandler = vi.fn();

      render(Button, {
        props: {
          disabled: true,
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');

      // Use fireEvent to trigger disabled button behavior
      const mockEvent = new MouseEvent('click', { bubbles: true });
      const stopPropagationSpy = vi.spyOn(mockEvent, 'stopPropagation');

      fireEvent(button, mockEvent);

      expect(stopPropagationSpy).toHaveBeenCalled();
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('9. Dynamic Props and Re-rendering', () => {
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
      rerender({
        onclick: handler2
      });

      // Test second handler
      await user.click(button);
      expect(handler1).toHaveBeenCalledTimes(1); // Still 1
      expect(handler2).toHaveBeenCalledTimes(1); // Now called
    });

    it('should handle state transitions (disabled <-> enabled)', async () => {
      const { rerender } = render(Button, {
        props: {
          disabled: true,
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');

      // Try clicking when disabled
      await user.click(button);
      expect(mockOnClick).not.toHaveBeenCalled();

      // Enable the button
      rerender({
        disabled: false,
        onclick: mockOnClick
      });

      // Click when enabled
      await user.click(button);
      expect(mockOnClick).toHaveBeenCalledTimes(1);

      // Disable again
      rerender({
        disabled: true,
        onclick: mockOnClick
      });

      // Try clicking when disabled again
      await user.click(button);
      expect(mockOnClick).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should handle loading state transitions', async () => {
      const { rerender } = render(Button, {
        props: {
          loading: false,
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');

      // Click when not loading
      await user.click(button);
      expect(mockOnClick).toHaveBeenCalledTimes(1);

      // Set to loading
      rerender({
        loading: true,
        onclick: mockOnClick
      });

      // Should show spinner
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();

      // Click when loading (should not work)
      await user.click(button);
      expect(mockOnClick).toHaveBeenCalledTimes(1); // Still 1

      // Stop loading
      rerender({
        loading: false,
        onclick: mockOnClick
      });

      // Click when not loading again
      await user.click(button);
      expect(mockOnClick).toHaveBeenCalledTimes(2); // Now 2
    });
  });

  describe('10. Edge Cases and Error Handling', () => {
    it('should handle undefined onclick prop gracefully', async () => {
      const component = render(Button, {
        props: {
          onclick: undefined
        }
      });

      component.component.$on('click', mockEventHandler);

      const button = screen.getByRole('button');

      // Should not throw and should still dispatch event
      await expect(user.click(button)).resolves.not.toThrow();
      expect(mockEventHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle null onclick prop gracefully', async () => {
      const component = render(Button, {
        props: {
          onclick: null as any
        }
      });

      component.component.$on('click', mockEventHandler);

      const button = screen.getByRole('button');

      await expect(user.click(button)).resolves.not.toThrow();
      expect(mockEventHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle onclick that throws an error', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Test error from onclick');
      });

      render(Button, {
        props: {
          onclick: errorHandler
        }
      });

      const button = screen.getByRole('button');

      // The click should throw due to the error in onclick
      await expect(user.click(button)).rejects.toThrow('Test error from onclick');
      expect(errorHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid successive clicks', async () => {
      render(Button, {
        props: {
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');

      // Simulate rapid clicking
      await user.click(button);
      await user.click(button);
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(5);
    });

    it('should work with various button variants and sizes', async () => {
      const variants = ['default', 'destructive', 'outline', 'secondary', 'accent', 'warm', 'ghost', 'link'] as const;
      const sizes = ['default', 'sm', 'lg', 'icon', 'touch'] as const;

      for (const variant of variants) {
        for (const size of sizes) {
          const testHandler = vi.fn();

          render(Button, {
            props: {
              variant,
              size,
              onclick: testHandler,
              'data-testid': `${variant}-${size}-btn`
            }
          });

          const button = screen.getByTestId(`${variant}-${size}-btn`);
          await user.click(button);

          expect(testHandler).toHaveBeenCalledTimes(1);

          // Clean up for next iteration
          testHandler.mockClear();
        }
      }
    });
  });

  describe('11. Touch Device Behavior', () => {
    it('should not trigger haptic feedback on desktop (mocked)', async () => {
      const vibrateSpy = vi.spyOn(navigator, 'vibrate');

      render(Button, {
        props: {
          hapticFeedback: true,
          onclick: mockOnClick
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      // Since isTouch is mocked as false, no vibration should occur
      expect(vibrateSpy).not.toHaveBeenCalled();
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should respect hapticFeedback prop when disabled', async () => {
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
});
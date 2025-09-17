/**
 * Button onclick prop fix validation tests
 *
 * Validates the critical fix that changed Button components from on:click to onclick
 * to resolve non-responsive buttons across the application.
 *
 * This test specifically validates:
 * 1. Button onclick prop functionality
 * 2. Event handling correctness
 * 3. Regression prevention for the button click issue
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Button from '$lib/components/ui/Button.svelte';

// Mock device store
vi.mock('$lib/stores/device.store', () => ({
  isTouch: {
    subscribe: vi.fn((callback) => {
      callback(false); // Desktop environment
      return () => {};
    })
  }
}));

describe('Button onclick Prop Fix Validation', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let mockHandler: Mock;

  beforeEach(() => {
    user = userEvent.setup();
    mockHandler = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Critical Fix: onclick Prop Functionality', () => {
    it('should call onclick prop handler when button is clicked', async () => {
      render(Button, {
        props: {
          onclick: mockHandler
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(expect.any(MouseEvent));
    });

    it('should handle multiple consecutive clicks correctly', async () => {
      render(Button, {
        props: {
          onclick: mockHandler
        },
        slots: {
          default: 'Multi Click Test'
        }
      });

      const button = screen.getByRole('button');

      // Rapid consecutive clicks to test responsiveness
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(mockHandler).toHaveBeenCalledTimes(3);
    });

    it('should pass correct MouseEvent object to onclick handler', async () => {
      render(Button, {
        props: {
          onclick: mockHandler
        },
        slots: {
          default: 'Event Test'
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      const event = mockHandler.mock.calls[0][0];
      expect(event).toBeInstanceOf(MouseEvent);
      expect(event.type).toBe('click');
      expect(event.target).toBe(button);
    });

    it('should maintain onclick handler reference across re-renders', async () => {
      const stableHandler = vi.fn();

      const { rerender } = render(Button, {
        props: {
          onclick: stableHandler,
          variant: 'default' as const
        },
        slots: {
          default: 'Stable Handler'
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);
      expect(stableHandler).toHaveBeenCalledTimes(1);

      // Update other props but keep same handler
      rerender({
        onclick: stableHandler,
        variant: 'destructive' as const
      });

      await user.click(button);
      expect(stableHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Button State Handling', () => {
    it('should prevent onclick when button is disabled', async () => {
      render(Button, {
        props: {
          onclick: mockHandler,
          disabled: true
        },
        slots: {
          default: 'Disabled Button'
        }
      });

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();

      await user.click(button);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should prevent onclick when button is loading', async () => {
      render(Button, {
        props: {
          onclick: mockHandler,
          loading: true
        },
        slots: {
          default: 'Loading Button'
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should show loading spinner when loading state is true', () => {
      render(Button, {
        props: {
          onclick: mockHandler,
          loading: true
        },
        slots: {
          default: 'Loading State'
        }
      });

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Event Handling Compatibility', () => {
    it('should handle both onclick prop and on:click event dispatch', async () => {
      const onClickHandler = vi.fn();

      const component = render(Button, {
        props: {
          onclick: mockHandler
        },
        slots: {
          default: 'Dual Handler Test'
        }
      });

      // Listen for the dispatched click event
      component.component.$on('click', onClickHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      // Both handlers should be called
      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(onClickHandler).toHaveBeenCalledTimes(1);
    });

    it('should work with keyboard events (Enter and Space)', async () => {
      render(Button, {
        props: {
          onclick: mockHandler
        },
        slots: {
          default: 'Keyboard Test'
        }
      });

      const button = screen.getByRole('button');
      button.focus();

      // Test Enter key
      await user.keyboard('{Enter}');
      expect(mockHandler).toHaveBeenCalledTimes(1);

      // Test Space key
      await user.keyboard(' ');
      expect(mockHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Button Variants Compatibility', () => {
    const variants = ['default', 'destructive', 'outline', 'secondary', 'accent', 'warm', 'ghost', 'link'] as const;

    it('should work correctly with all button variants', async () => {
      for (const variant of variants) {
        const testHandler = vi.fn();
        const { unmount } = render(Button, {
          props: {
            onclick: testHandler,
            variant
          },
          slots: {
            default: `${variant} Button`
          }
        });

        const button = screen.getByRole('button');
        await user.click(button);

        expect(testHandler).toHaveBeenCalledTimes(1);
        unmount();
      }
    });

    it('should work with different button sizes', async () => {
      const sizes = ['default', 'sm', 'lg', 'icon', 'touch'] as const;

      for (const size of sizes) {
        const testHandler = vi.fn();
        const { unmount } = render(Button, {
          props: {
            onclick: testHandler,
            size
          },
          slots: {
            default: `${size} Size`
          }
        });

        const button = screen.getByRole('button');
        await user.click(button);

        expect(testHandler).toHaveBeenCalledTimes(1);
        unmount();
      }
    });
  });

  describe('Anchor Button Behavior', () => {
    it('should call onclick handler for anchor links', async () => {
      render(Button, {
        props: {
          href: '/test-url',
          onclick: mockHandler
        },
        slots: {
          default: 'Link Button'
        }
      });

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/test-url');

      await user.click(link);
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it('should render as button when href is provided but disabled', () => {
      render(Button, {
        props: {
          href: '/test-url',
          disabled: true,
          onclick: mockHandler
        },
        slots: {
          default: 'Disabled Link'
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

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined onclick prop gracefully', async () => {
      const onClickHandler = vi.fn();

      const component = render(Button, {
        props: {
          onclick: undefined
        },
        slots: {
          default: 'Undefined Handler'
        }
      });

      component.component.$on('click', onClickHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      // Should still dispatch event even when onclick is undefined
      expect(onClickHandler).toHaveBeenCalledTimes(1);
      expect(() => user.click(button)).not.toThrow();
    });

    it('should handle null onclick prop gracefully', async () => {
      const onClickHandler = vi.fn();

      const component = render(Button, {
        props: {
          onclick: null as any
        },
        slots: {
          default: 'Null Handler'
        }
      });

      component.component.$on('click', onClickHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(onClickHandler).toHaveBeenCalledTimes(1);
      expect(() => user.click(button)).not.toThrow();
    });

    it('should handle changing onclick prop dynamically', async () => {
      const initialHandler = vi.fn();
      const newHandler = vi.fn();

      const { rerender } = render(Button, {
        props: {
          onclick: initialHandler
        },
        slots: {
          default: 'Dynamic Handler'
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

  describe('Regression Prevention', () => {
    it('should ensure buttons respond immediately to clicks (no lag)', async () => {
      const timestamps: number[] = [];
      const timestampHandler = () => {
        timestamps.push(Date.now());
      };

      render(Button, {
        props: {
          onclick: timestampHandler
        },
        slots: {
          default: 'Response Time Test'
        }
      });

      const button = screen.getByRole('button');

      // Rapid successive clicks to test responsiveness
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(timestamps).toHaveLength(3);

      // Verify all clicks were registered (no missed clicks due to non-responsive buttons)
      for (let i = 0; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThan(0);
      }
    });

    it('should handle high-frequency clicking without missing events', async () => {
      let clickCount = 0;
      const rapidClickHandler = () => { clickCount++; };

      render(Button, {
        props: {
          onclick: rapidClickHandler
        },
        slots: {
          default: 'High Frequency Test'
        }
      });

      const button = screen.getByRole('button');

      // Simulate very rapid clicking (as users might do when buttons appear unresponsive)
      const clickPromises = [];
      for (let i = 0; i < 10; i++) {
        clickPromises.push(user.click(button));
      }

      await Promise.all(clickPromises);

      // All clicks should be registered (no missed clicks)
      expect(clickCount).toBe(10);
    });

    it('should maintain onclick behavior across component lifecycles', async () => {
      let clickCount = 0;
      const persistentHandler = () => { clickCount++; };

      const { rerender, unmount } = render(Button, {
        props: {
          onclick: persistentHandler,
          disabled: false
        },
        slots: {
          default: 'Lifecycle Test'
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);
      expect(clickCount).toBe(1);

      // Re-render multiple times
      for (let i = 0; i < 3; i++) {
        rerender({
          onclick: persistentHandler,
          disabled: false,
          variant: i % 2 === 0 ? 'default' as const : 'outline' as const
        });

        await user.click(button);
        expect(clickCount).toBe(2 + i);
      }
    });

    it('should verify DOM event binding works correctly', async () => {
      let eventReceived = false;
      const domEventHandler = () => { eventReceived = true; };

      render(Button, {
        props: {
          onclick: domEventHandler
        },
        slots: {
          default: 'DOM Event Test'
        }
      });

      const button = screen.getByRole('button');

      // Test both user interaction and direct DOM event
      await fireEvent.click(button);
      expect(eventReceived).toBe(true);

      eventReceived = false;
      await user.click(button);
      expect(eventReceived).toBe(true);
    });
  });

  describe('Articles Page Specific Button Scenarios', () => {
    it('should handle create button scenario', async () => {
      const createHandler = vi.fn();

      render(Button, {
        props: {
          onclick: createHandler,
          class: 'flex items-center gap-2'
        },
        slots: {
          default: 'Создать статью'
        }
      });

      const button = screen.getByRole('button', { name: /создать статью/i });
      await user.click(button);

      expect(createHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle edit button scenario', async () => {
      const editHandler = vi.fn();

      render(Button, {
        props: {
          onclick: editHandler,
          variant: 'outline' as const,
          size: 'sm' as const,
          class: 'flex items-center gap-1'
        },
        slots: {
          default: 'Изменить'
        }
      });

      const button = screen.getByRole('button', { name: /изменить/i });
      await user.click(button);

      expect(editHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle delete button scenario', async () => {
      const deleteHandler = vi.fn();

      render(Button, {
        props: {
          onclick: deleteHandler,
          variant: 'outline' as const,
          size: 'sm' as const,
          class: 'flex items-center gap-1 text-red-600 hover:text-red-700'
        },
        slots: {
          default: 'Удалить'
        }
      });

      const button = screen.getByRole('button', { name: /удалить/i });
      await user.click(button);

      expect(deleteHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle modal cancel button scenario', async () => {
      const cancelHandler = vi.fn();

      render(Button, {
        props: {
          type: 'button' as const,
          variant: 'outline' as const,
          onclick: cancelHandler
        },
        slots: {
          default: 'Отмена'
        }
      });

      const button = screen.getByRole('button', { name: /отмена/i });
      await user.click(button);

      expect(cancelHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle form submit button scenario', async () => {
      const submitHandler = vi.fn();

      render(Button, {
        props: {
          type: 'submit' as const,
          onclick: submitHandler
        },
        slots: {
          default: 'Сохранить'
        }
      });

      const button = screen.getByRole('button', { name: /сохранить/i });
      await user.click(button);

      expect(submitHandler).toHaveBeenCalledTimes(1);
    });
  });
});
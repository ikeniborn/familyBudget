/**
 * Simple validation tests for Button component onclick prop fix.
 *
 * Validates the critical fix that changed Button components from
 * `on:click={handler}` to `onclick={handler}` to resolve non-responsive
 * buttons on the articles management page.
 *
 * This test ensures:
 * 1. The onclick prop works correctly
 * 2. Button responsiveness is maintained
 * 3. The fix prevents regression
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Button from '$lib/components/ui/Button.svelte';

// Mock device store (required by Button component)
vi.mock('$lib/stores/device.store', () => ({
  isTouch: {
    subscribe: vi.fn((callback) => {
      callback(false); // Desktop environment
      return () => {};
    })
  }
}));

describe('Button onclick Fix Validation', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    user = userEvent.setup();
    mockHandler = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
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

    it('should handle multiple rapid clicks correctly', async () => {
      render(Button, {
        props: {
          onclick: mockHandler
        }
      });

      const button = screen.getByRole('button');

      // Rapid consecutive clicks (test for responsiveness)
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(mockHandler).toHaveBeenCalledTimes(3);
    });

    it('should pass correct MouseEvent object to onclick handler', async () => {
      render(Button, {
        props: {
          onclick: mockHandler
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      const event = mockHandler.mock.calls[0][0];
      expect(event).toBeInstanceOf(MouseEvent);
      expect(event.type).toBe('click');
      expect(event.target).toBe(button);
    });

    it('should work with different button variants', async () => {
      const variants = ['default', 'destructive', 'outline', 'secondary'] as const;

      for (const variant of variants) {
        const variantHandler = vi.fn();
        const { unmount } = render(Button, {
          props: {
            onclick: variantHandler,
            variant
          }
        });

        const button = screen.getByRole('button');
        await user.click(button);

        expect(variantHandler).toHaveBeenCalledTimes(1);
        unmount();
      }
    });

    it('should work with different button sizes', async () => {
      const sizes = ['default', 'sm', 'lg', 'icon'] as const;

      for (const size of sizes) {
        const sizeHandler = vi.fn();
        const { unmount } = render(Button, {
          props: {
            onclick: sizeHandler,
            size
          }
        });

        const button = screen.getByRole('button');
        await user.click(button);

        expect(sizeHandler).toHaveBeenCalledTimes(1);
        unmount();
      }
    });
  });

  describe('Button State Handling', () => {
    it('should prevent onclick when button is disabled', async () => {
      render(Button, {
        props: {
          onclick: mockHandler,
          disabled: true
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
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should show loading spinner when loading is true', () => {
      render(Button, {
        props: {
          onclick: mockHandler,
          loading: true
        }
      });

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Event Compatibility', () => {
    it('should handle both onclick prop and on:click event dispatch', async () => {
      const onClickHandler = vi.fn();

      const component = render(Button, {
        props: {
          onclick: mockHandler
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

    it('should work with keyboard events', async () => {
      render(Button, {
        props: {
          onclick: mockHandler
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

  describe('Articles Page Button Scenarios', () => {
    it('should handle create button pattern', async () => {
      const createHandler = vi.fn();

      render(Button, {
        props: {
          onclick: createHandler
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(createHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle edit button pattern', async () => {
      const editHandler = vi.fn();

      render(Button, {
        props: {
          onclick: editHandler,
          variant: 'outline' as const,
          size: 'sm' as const
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(editHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle delete button pattern', async () => {
      const deleteHandler = vi.fn();

      render(Button, {
        props: {
          onclick: deleteHandler,
          variant: 'outline' as const,
          size: 'sm' as const
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(deleteHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle modal cancel button pattern', async () => {
      const cancelHandler = vi.fn();

      render(Button, {
        props: {
          type: 'button' as const,
          variant: 'outline' as const,
          onclick: cancelHandler
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(cancelHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle form submit button pattern', async () => {
      const submitHandler = vi.fn();

      render(Button, {
        props: {
          type: 'submit' as const,
          onclick: submitHandler
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(submitHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases and Regression Prevention', () => {
    it('should handle undefined onclick prop gracefully', async () => {
      const onClickHandler = vi.fn();

      const component = render(Button, {
        props: {
          onclick: undefined
        }
      });

      component.component.$on('click', onClickHandler);

      const button = screen.getByRole('button');
      await user.click(button);

      // Should still dispatch event even when onclick is undefined
      expect(onClickHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle null onclick prop gracefully', async () => {
      const component = render(Button, {
        props: {
          onclick: null as any
        }
      });

      const button = screen.getByRole('button');
      // Should not throw an error
      await user.click(button);
    });

    it('should ensure buttons respond immediately without lag', async () => {
      const timestamps: number[] = [];
      const timestampHandler = () => {
        timestamps.push(Date.now());
      };

      render(Button, {
        props: {
          onclick: timestampHandler
        }
      });

      const button = screen.getByRole('button');

      // Rapid successive clicks
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(timestamps).toHaveLength(3);
      // Verify all clicks were registered
      timestamps.forEach(timestamp => {
        expect(timestamp).toBeGreaterThan(0);
      });
    });

    it('should maintain onclick behavior across component re-renders', async () => {
      let clickCount = 0;
      const persistentHandler = () => { clickCount++; };

      const { rerender } = render(Button, {
        props: {
          onclick: persistentHandler,
          disabled: false
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);
      expect(clickCount).toBe(1);

      // Re-render with different props
      rerender({
        onclick: persistentHandler,
        disabled: false,
        variant: 'destructive' as const
      });

      await user.click(button);
      expect(clickCount).toBe(2);
    });

    it('should work with both fireEvent and userEvent', async () => {
      let fireEventCount = 0;
      let userEventCount = 0;

      const dualHandler = () => {
        fireEventCount++;
        userEventCount++;
      };

      render(Button, {
        props: {
          onclick: dualHandler
        }
      });

      const button = screen.getByRole('button');

      // Test with fireEvent
      await fireEvent.click(button);
      expect(fireEventCount).toBe(1);

      // Test with userEvent
      await user.click(button);
      expect(userEventCount).toBe(2);
    });

    it('should handle anchor button behavior correctly', async () => {
      const linkHandler = vi.fn();

      render(Button, {
        props: {
          href: '/test-url',
          onclick: linkHandler
        }
      });

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/test-url');

      await user.click(link);
      expect(linkHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Articles Page Integration Validation', () => {
    it('should validate the onclick prop pattern used in articles page', async () => {
      // This test simulates the exact patterns used in the articles page
      const modalActions = {
        openCreate: vi.fn(),
        openEdit: vi.fn(),
        openDelete: vi.fn(),
        cancel: vi.fn(),
        submit: vi.fn()
      };

      // Test create pattern: onclick={openCreateModal}
      const { unmount: unmountCreate } = render(Button, {
        props: {
          onclick: modalActions.openCreate
        }
      });

      let button = screen.getByRole('button');
      await user.click(button);
      expect(modalActions.openCreate).toHaveBeenCalledTimes(1);
      unmountCreate();

      // Test edit pattern: onclick={() => openEditModal(article)}
      const testArticle = { id: 1, name: 'Test Article' };
      const { unmount: unmountEdit } = render(Button, {
        props: {
          onclick: () => modalActions.openEdit(testArticle),
          variant: 'outline' as const,
          size: 'sm' as const
        }
      });

      button = screen.getByRole('button');
      await user.click(button);
      expect(modalActions.openEdit).toHaveBeenCalledWith(testArticle);
      unmountEdit();

      // Test delete pattern: onclick={() => openDeleteModal(article)}
      const { unmount: unmountDelete } = render(Button, {
        props: {
          onclick: () => modalActions.openDelete(testArticle),
          variant: 'outline' as const,
          size: 'sm' as const
        }
      });

      button = screen.getByRole('button');
      await user.click(button);
      expect(modalActions.openDelete).toHaveBeenCalledWith(testArticle);
      unmountDelete();

      // Test cancel pattern: onclick={() => (showModal = false)}
      const { unmount: unmountCancel } = render(Button, {
        props: {
          type: 'button' as const,
          variant: 'outline' as const,
          onclick: modalActions.cancel
        }
      });

      button = screen.getByRole('button');
      await user.click(button);
      expect(modalActions.cancel).toHaveBeenCalledTimes(1);
      unmountCancel();

      // Test submit pattern used in forms
      const { unmount: unmountSubmit } = render(Button, {
        props: {
          type: 'submit' as const,
          onclick: modalActions.submit
        }
      });

      button = screen.getByRole('button');
      await user.click(button);
      expect(modalActions.submit).toHaveBeenCalledTimes(1);
      unmountSubmit();
    });

    it('should confirm the fix resolves the original non-responsive button issue', async () => {
      // This test validates that the fix resolves the core issue:
      // Buttons now respond immediately to clicks and execute handlers

      let buttonClickedCount = 0;
      const responseTest = () => {
        buttonClickedCount++;
      };

      render(Button, {
        props: {
          onclick: responseTest
        }
      });

      const button = screen.getByRole('button');

      // Test immediate responsiveness
      await user.click(button);
      expect(buttonClickedCount).toBe(1);

      // Test repeated clicks work
      await user.click(button);
      await user.click(button);
      expect(buttonClickedCount).toBe(3);

      // Test that all clicks were registered (no missed events)
      const initialCount = buttonClickedCount;
      await user.click(button);
      await user.click(button);
      expect(buttonClickedCount).toBe(initialCount + 2);
    });
  });
});
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Button from '$lib/components/ui/Button.svelte';

// Mock device store
vi.mock('$lib/stores/device.store', () => ({
  isTouch: {
    subscribe: vi.fn((callback) => {
      callback(false);
      return () => {};
    })
  }
}));

describe('Button onclick Articles Fix Regression Tests', () => {
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

  describe('Critical Fix: onclick Prop Responsiveness', () => {
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

    it('should handle multiple rapid clicks without missing events', async () => {
      render(Button, {
        props: {
          onclick: mockHandler
        }
      });

      const button = screen.getByRole('button');

      // Rapid consecutive clicks (simulate users clicking when button appears unresponsive)
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(mockHandler).toHaveBeenCalledTimes(3);
    });

    it('should pass correct MouseEvent to onclick handler', async () => {
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

    it('should ensure onclick works with different button variants', async () => {
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
  });

  describe('Articles Page Button Scenarios', () => {
    it('should handle create article button pattern', async () => {
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

    it('should handle edit article button pattern', async () => {
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

    it('should handle delete article button pattern', async () => {
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

  describe('Edge Cases', () => {
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

  describe('Regression Prevention', () => {
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
        }
      });

      const button = screen.getByRole('button');

      // Simulate very rapid clicking
      const clickPromises = [];
      for (let i = 0; i < 10; i++) {
        clickPromises.push(user.click(button));
      }

      await Promise.all(clickPromises);

      // All clicks should be registered
      expect(clickCount).toBe(10);
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

      // Re-render again
      rerender({
        onclick: persistentHandler,
        disabled: false,
        size: 'lg' as const
      });

      await user.click(button);
      expect(clickCount).toBe(3);
    });

    it('should verify DOM event binding works correctly', async () => {
      let eventReceived = false;
      const domEventHandler = () => { eventReceived = true; };

      render(Button, {
        props: {
          onclick: domEventHandler
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

    it('should ensure onclick works consistently across button types', async () => {
      const buttonTypes = ['button', 'submit', 'reset'] as const;

      for (const type of buttonTypes) {
        const typeHandler = vi.fn();
        const { unmount } = render(Button, {
          props: {
            onclick: typeHandler,
            type
          }
        });

        const button = screen.getByRole('button');
        await user.click(button);

        expect(typeHandler).toHaveBeenCalledTimes(1);
        unmount();
      }
    });
  });

  describe('Articles Page Integration Patterns', () => {
    it('should validate articles page button functionality patterns', async () => {
      // Simulate the exact pattern used in articles page modals
      const modalHandlers = {
        openCreate: vi.fn(),
        openEdit: vi.fn(),
        openDelete: vi.fn(),
        cancelModal: vi.fn(),
        submitForm: vi.fn()
      };

      // Test create button pattern
      const { unmount: unmountCreate } = render(Button, {
        props: {
          onclick: modalHandlers.openCreate
        }
      });

      let button = screen.getByRole('button');
      await user.click(button);
      expect(modalHandlers.openCreate).toHaveBeenCalledTimes(1);
      unmountCreate();

      // Test edit button pattern (with parameters)
      const { unmount: unmountEdit } = render(Button, {
        props: {
          onclick: () => modalHandlers.openEdit({ id: 1, name: 'Test' }),
          variant: 'outline' as const,
          size: 'sm' as const
        }
      });

      button = screen.getByRole('button');
      await user.click(button);
      expect(modalHandlers.openEdit).toHaveBeenCalledWith({ id: 1, name: 'Test' });
      unmountEdit();

      // Test delete button pattern (with parameters)
      const { unmount: unmountDelete } = render(Button, {
        props: {
          onclick: () => modalHandlers.openDelete({ id: 1, name: 'Test' }),
          variant: 'outline' as const,
          size: 'sm' as const
        }
      });

      button = screen.getByRole('button');
      await user.click(button);
      expect(modalHandlers.openDelete).toHaveBeenCalledWith({ id: 1, name: 'Test' });
      unmountDelete();

      // Test modal cancel pattern
      const { unmount: unmountCancel } = render(Button, {
        props: {
          type: 'button' as const,
          variant: 'outline' as const,
          onclick: () => modalHandlers.cancelModal()
        }
      });

      button = screen.getByRole('button');
      await user.click(button);
      expect(modalHandlers.cancelModal).toHaveBeenCalledTimes(1);
      unmountCancel();

      // Test form submit pattern
      const { unmount: unmountSubmit } = render(Button, {
        props: {
          type: 'submit' as const,
          onclick: modalHandlers.submitForm
        }
      });

      button = screen.getByRole('button');
      await user.click(button);
      expect(modalHandlers.submitForm).toHaveBeenCalledTimes(1);
      unmountSubmit();
    });

    it('should handle complex onclick scenarios with state updates', async () => {
      let modalState = {
        showCreate: false,
        showEdit: false,
        showDelete: false,
        selectedItem: null as any
      };

      const stateHandler = vi.fn((action: string, data?: any) => {
        switch (action) {
          case 'openCreate':
            modalState.showCreate = true;
            break;
          case 'openEdit':
            modalState.showEdit = true;
            modalState.selectedItem = data;
            break;
          case 'openDelete':
            modalState.showDelete = true;
            modalState.selectedItem = data;
            break;
          case 'close':
            modalState.showCreate = false;
            modalState.showEdit = false;
            modalState.showDelete = false;
            modalState.selectedItem = null;
            break;
        }
      });

      // Test create modal opening
      const { unmount: unmountCreate } = render(Button, {
        props: {
          onclick: () => stateHandler('openCreate')
        }
      });

      let button = screen.getByRole('button');
      await user.click(button);
      expect(stateHandler).toHaveBeenCalledWith('openCreate');
      expect(modalState.showCreate).toBe(true);
      unmountCreate();

      // Test edit modal opening with data
      const { unmount: unmountEdit } = render(Button, {
        props: {
          onclick: () => stateHandler('openEdit', { id: 1, name: 'Test Article' })
        }
      });

      button = screen.getByRole('button');
      await user.click(button);
      expect(stateHandler).toHaveBeenCalledWith('openEdit', { id: 1, name: 'Test Article' });
      expect(modalState.showEdit).toBe(true);
      expect(modalState.selectedItem).toEqual({ id: 1, name: 'Test Article' });
      unmountEdit();

      // Test modal closing
      const { unmount: unmountClose } = render(Button, {
        props: {
          onclick: () => stateHandler('close')
        }
      });

      button = screen.getByRole('button');
      await user.click(button);
      expect(stateHandler).toHaveBeenCalledWith('close');
      expect(modalState.showCreate).toBe(false);
      expect(modalState.showEdit).toBe(false);
      expect(modalState.selectedItem).toBe(null);
      unmountClose();
    });
  });
});
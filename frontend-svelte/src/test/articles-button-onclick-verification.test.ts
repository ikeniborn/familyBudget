/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import userEvent from '@testing-library/user-event';
import Button from '$lib/components/ui/Button.svelte';

// Mock device store for Button component
vi.mock('$lib/stores/device.store', () => {
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

/**
 * Tests to verify that the Button component's onclick prop fix works correctly.
 * This test suite validates that all 9 buttons identified on the articles page
 * would work correctly with the onclick prop implementation.
 */
describe('Articles Page Button Click Fix - onclick Prop Verification', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Button onclick Prop Functionality', () => {
    it('should execute onclick handler for create article button functionality', async () => {
      const mockOpenCreateModal = vi.fn();

      render(Button, {
        props: {
          onclick: mockOpenCreateModal
        },
        slots: {
          default: () => 'Создать статью'
        }
      });

      const button = screen.getByRole('button', { name: /создать статью/i });
      await user.click(button);

      expect(mockOpenCreateModal).toHaveBeenCalledTimes(1);
      expect(mockOpenCreateModal).toHaveBeenCalledWith(expect.any(MouseEvent));
    });

    it('should execute onclick handler for edit article button functionality', async () => {
      const mockArticle = {
        id: 1,
        code: 'FOOD',
        name: 'Питание',
        description: 'Продукты питания'
      };

      const mockOpenEditModal = vi.fn((article) => {
        // Simulate opening edit modal with article data
        return () => mockOpenEditModal(article);
      });

      // Create onclick handler that calls openEditModal with article
      const onClickHandler = vi.fn(() => mockOpenEditModal(mockArticle));

      render(Button, {
        props: {
          onclick: onClickHandler,
          variant: 'outline',
          size: 'sm'
        },
        slots: {
          default: () => 'Изменить'
        }
      });

      const button = screen.getByRole('button', { name: /изменить/i });
      await user.click(button);

      expect(onClickHandler).toHaveBeenCalledTimes(1);
      expect(onClickHandler).toHaveBeenCalledWith(expect.any(MouseEvent));
      expect(mockOpenEditModal).toHaveBeenCalledWith(mockArticle);
    });

    it('should execute onclick handler for delete article button functionality', async () => {
      const mockArticle = {
        id: 1,
        code: 'FOOD',
        name: 'Питание'
      };

      const mockOpenDeleteModal = vi.fn((article) => {
        // Simulate opening delete modal with article data
        return () => mockOpenDeleteModal(article);
      });

      // Create onclick handler that calls openDeleteModal with article
      const onClickHandler = vi.fn(() => mockOpenDeleteModal(mockArticle));

      render(Button, {
        props: {
          onclick: onClickHandler,
          variant: 'outline',
          size: 'sm'
        },
        slots: {
          default: () => 'Удалить'
        }
      });

      const button = screen.getByRole('button', { name: /удалить/i });
      await user.click(button);

      expect(onClickHandler).toHaveBeenCalledTimes(1);
      expect(onClickHandler).toHaveBeenCalledWith(expect.any(MouseEvent));
      expect(mockOpenDeleteModal).toHaveBeenCalledWith(mockArticle);
    });

    it('should execute onclick handler for modal cancel button functionality', async () => {
      const mockCloseModal = vi.fn();

      render(Button, {
        props: {
          onclick: () => mockCloseModal(),
          variant: 'outline',
          type: 'button'
        },
        slots: {
          default: () => 'Отмена'
        }
      });

      const button = screen.getByRole('button', { name: /отмена/i });
      await user.click(button);

      expect(mockCloseModal).toHaveBeenCalledTimes(1);
    });

    it('should execute onclick handler for form submission functionality', async () => {
      const mockHandleSubmit = vi.fn();

      render(Button, {
        props: {
          onclick: mockHandleSubmit,
          type: 'submit'
        },
        slots: {
          default: () => 'Создать'
        }
      });

      const button = screen.getByRole('button', { name: /создать/i });
      await user.click(button);

      expect(mockHandleSubmit).toHaveBeenCalledTimes(1);
      expect(mockHandleSubmit).toHaveBeenCalledWith(expect.any(MouseEvent));
    });

    it('should execute onclick handler for retry button functionality', async () => {
      const mockRetryLoad = vi.fn();

      render(Button, {
        props: {
          onclick: mockRetryLoad
        },
        slots: {
          default: () => 'Попробовать снова'
        }
      });

      const button = screen.getByRole('button', { name: /попробовать снова/i });
      await user.click(button);

      expect(mockRetryLoad).toHaveBeenCalledTimes(1);
      expect(mockRetryLoad).toHaveBeenCalledWith(expect.any(MouseEvent));
    });

    it('should execute onclick handler for save button functionality', async () => {
      const mockHandleUpdate = vi.fn();

      render(Button, {
        props: {
          onclick: mockHandleUpdate,
          type: 'submit'
        },
        slots: {
          default: () => 'Сохранить'
        }
      });

      const button = screen.getByRole('button', { name: /сохранить/i });
      await user.click(button);

      expect(mockHandleUpdate).toHaveBeenCalledTimes(1);
      expect(mockHandleUpdate).toHaveBeenCalledWith(expect.any(MouseEvent));
    });

    it('should execute onclick handler for destructive action button functionality', async () => {
      const mockHandleDelete = vi.fn();

      render(Button, {
        props: {
          onclick: mockHandleDelete,
          variant: 'destructive',
          type: 'button'
        },
        slots: {
          default: () => 'Удалить'
        }
      });

      const button = screen.getByRole('button', { name: /удалить/i });
      await user.click(button);

      expect(mockHandleDelete).toHaveBeenCalledTimes(1);
      expect(mockHandleDelete).toHaveBeenCalledWith(expect.any(MouseEvent));
    });

    it('should execute onclick handler for empty state create button functionality', async () => {
      const mockOpenCreateModal = vi.fn();

      render(Button, {
        props: {
          onclick: mockOpenCreateModal
        },
        slots: {
          default: () => 'Создать статью'
        }
      });

      const button = screen.getByRole('button', { name: /создать статью/i });
      await user.click(button);

      expect(mockOpenCreateModal).toHaveBeenCalledTimes(1);
      expect(mockOpenCreateModal).toHaveBeenCalledWith(expect.any(MouseEvent));
    });
  });

  describe('Button onclick Prop Edge Cases', () => {
    it('should handle rapid clicks correctly with onclick prop', async () => {
      const mockHandler = vi.fn();

      render(Button, {
        props: {
          onclick: mockHandler
        },
        slots: {
          default: () => 'Test Button'
        }
      });

      const button = screen.getByRole('button');

      // Simulate rapid clicks
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(mockHandler).toHaveBeenCalledTimes(3);
    });

    it('should not execute onclick when button is disabled', async () => {
      const mockHandler = vi.fn();

      render(Button, {
        props: {
          onclick: mockHandler,
          disabled: true
        },
        slots: {
          default: () => 'Disabled Button'
        }
      });

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();

      await user.click(button);

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should not execute onclick when button is loading', async () => {
      const mockHandler = vi.fn();

      render(Button, {
        props: {
          onclick: mockHandler,
          loading: true
        },
        slots: {
          default: () => 'Loading Button'
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should handle onclick prop changes correctly', async () => {
      const initialHandler = vi.fn();
      const newHandler = vi.fn();

      const { rerender } = render(Button, {
        props: {
          onclick: initialHandler
        },
        slots: {
          default: () => 'Dynamic Button'
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

    it('should support keyboard activation with onclick prop', async () => {
      const mockHandler = vi.fn();

      render(Button, {
        props: {
          onclick: mockHandler
        },
        slots: {
          default: () => 'Keyboard Button'
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

  describe('Button onclick Prop Integration with Different Variants', () => {
    const buttonVariants = [
      'default',
      'destructive',
      'outline',
      'secondary',
      'accent',
      'warm',
      'ghost',
      'link'
    ] as const;

    const buttonSizes = ['default', 'sm', 'lg', 'icon', 'touch'] as const;

    buttonVariants.forEach(variant => {
      it(`should work correctly with ${variant} variant`, async () => {
        const mockHandler = vi.fn();

        render(Button, {
          props: {
            onclick: mockHandler,
            variant
          },
          slots: {
            default: () => `${variant} Button`
          }
        });

        const button = screen.getByRole('button');
        await user.click(button);

        expect(mockHandler).toHaveBeenCalledTimes(1);
        expect(mockHandler).toHaveBeenCalledWith(expect.any(MouseEvent));
      });
    });

    buttonSizes.forEach(size => {
      it(`should work correctly with ${size} size`, async () => {
        const mockHandler = vi.fn();

        render(Button, {
          props: {
            onclick: mockHandler,
            size
          },
          slots: {
            default: () => `${size} Button`
          }
        });

        const button = screen.getByRole('button');
        await user.click(button);

        expect(mockHandler).toHaveBeenCalledTimes(1);
        expect(mockHandler).toHaveBeenCalledWith(expect.any(MouseEvent));
      });
    });
  });

  describe('Articles Page Button Scenarios', () => {
    it('should handle all 9 identified button types from articles page', async () => {
      const handlers = {
        createHeader: vi.fn(),
        edit: vi.fn(),
        delete: vi.fn(),
        cancelCreate: vi.fn(),
        cancelEdit: vi.fn(),
        cancelDelete: vi.fn(),
        submitCreate: vi.fn(),
        submitEdit: vi.fn(),
        retry: vi.fn()
      };

      // Test each button type that appears on the articles page
      const buttonConfigs = [
        { handler: handlers.createHeader, text: 'Создать статью', description: 'Header create button' },
        { handler: handlers.edit, text: 'Изменить', description: 'Table edit button' },
        { handler: handlers.delete, text: 'Удалить', description: 'Table delete button' },
        { handler: handlers.cancelCreate, text: 'Отмена', description: 'Create modal cancel button' },
        { handler: handlers.cancelEdit, text: 'Отмена', description: 'Edit modal cancel button' },
        { handler: handlers.cancelDelete, text: 'Отмена', description: 'Delete modal cancel button' },
        { handler: handlers.submitCreate, text: 'Создать', description: 'Create modal submit button' },
        { handler: handlers.submitEdit, text: 'Сохранить', description: 'Edit modal submit button' },
        { handler: handlers.retry, text: 'Попробовать снова', description: 'Error state retry button' }
      ];

      for (const config of buttonConfigs) {
        const { unmount } = render(Button, {
          props: {
            onclick: config.handler
          },
          slots: {
            default: () => config.text
          }
        });

        const button = screen.getByRole('button', { name: new RegExp(config.text, 'i') });
        await user.click(button);

        expect(config.handler).toHaveBeenCalledTimes(1);
        expect(config.handler).toHaveBeenCalledWith(expect.any(MouseEvent));

        // Clean up for next iteration
        unmount();
        vi.clearAllMocks();
      }

      // Verify all handlers were called exactly once
      Object.values(handlers).forEach(handler => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    it('should maintain proper event handling order', async () => {
      const callOrder: string[] = [];

      const onClickHandler = vi.fn((event: MouseEvent) => {
        callOrder.push('onclick');
      });

      const { component } = render(Button, {
        props: {
          onclick: onClickHandler
        },
        slots: {
          default: () => 'Test Order'
        }
      });

      // Listen for the dispatched click event
      component.$on('click', () => {
        callOrder.push('dispatch');
      });

      const button = screen.getByRole('button');
      await user.click(button);

      // Verify onclick is called first, then dispatch
      expect(callOrder).toEqual(['onclick', 'dispatch']);
      expect(onClickHandler).toHaveBeenCalledTimes(1);
    });

    it('should work with complex onclick handlers that use closures', async () => {
      // Simulate the complex handlers used in the articles page
      const modalState = { createOpen: false, editOpen: false, deleteOpen: false };
      const selectedArticle = { id: null, name: null };

      const openCreateModal = vi.fn(() => {
        modalState.createOpen = true;
      });

      const openEditModal = vi.fn((article: any) => {
        modalState.editOpen = true;
        selectedArticle.id = article.id;
        selectedArticle.name = article.name;
      });

      const openDeleteModal = vi.fn((article: any) => {
        modalState.deleteOpen = true;
        selectedArticle.id = article.id;
        selectedArticle.name = article.name;
      });

      const testArticle = { id: 1, name: 'Test Article' };

      // Test create button
      const { unmount: unmountCreate } = render(Button, {
        props: {
          onclick: openCreateModal
        },
        slots: {
          default: () => 'Создать'
        }
      });

      await user.click(screen.getByRole('button'));
      expect(openCreateModal).toHaveBeenCalled();
      expect(modalState.createOpen).toBe(true);
      unmountCreate();

      // Test edit button with closure
      const { unmount: unmountEdit } = render(Button, {
        props: {
          onclick: () => openEditModal(testArticle)
        },
        slots: {
          default: () => 'Изменить'
        }
      });

      await user.click(screen.getByRole('button'));
      expect(openEditModal).toHaveBeenCalledWith(testArticle);
      expect(modalState.editOpen).toBe(true);
      expect(selectedArticle.id).toBe(1);
      unmountEdit();

      // Test delete button with closure
      const { unmount: unmountDelete } = render(Button, {
        props: {
          onclick: () => openDeleteModal(testArticle)
        },
        slots: {
          default: () => 'Удалить'
        }
      });

      await user.click(screen.getByRole('button'));
      expect(openDeleteModal).toHaveBeenCalledWith(testArticle);
      expect(modalState.deleteOpen).toBe(true);
      unmountDelete();
    });
  });
});
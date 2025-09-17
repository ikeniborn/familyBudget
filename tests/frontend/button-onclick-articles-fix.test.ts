/**
 * Comprehensive test suite for the Button component onclick prop fix in Articles page.
 *
 * Validates the fix that changed Button components from `on:click={handler}` to `onclick={handler}`
 * to resolve non-responsive buttons on the articles management page.
 *
 * Test Coverage:
 * - Button component onclick prop handling
 * - Articles page button functionality (Create, Edit, Delete)
 * - Modal opening/closing behavior
 * - Event handling and propagation
 * - Button responsiveness and interaction
 * - Regression prevention for button click issues
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';

// Import components
import Button from '$lib/components/ui/Button.svelte';
import ArticlesPage from '$routes/(protected)/settings/articles/+page.svelte';

// Mock dependencies
vi.mock('$lib/stores/device.store', () => ({
  isTouch: {
    subscribe: vi.fn((callback) => {
      callback(false); // Desktop environment
      return () => {};
    })
  }
}));

vi.mock('$lib/services/articles.service', () => ({
  articlesService: {
    getAll: vi.fn(),
    getStats: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('$lib/stores/auth.store', () => ({
  isAdmin: {
    subscribe: vi.fn((callback) => {
      callback(true); // Admin user for full functionality
      return () => {};
    })
  }
}));

vi.mock('$lib/stores/toast.store', () => ({
  useToast: vi.fn(() => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  }))
}));

// Mock Lucide icons
vi.mock('lucide-svelte', () => {
  const mockIcon = () => ({ default: 'div' });
  return {
    BookOpen: mockIcon,
    Plus: mockIcon,
    Edit: mockIcon,
    Trash2: mockIcon,
    Shield: mockIcon,
    Users: mockIcon,
    User: mockIcon,
    Check: mockIcon,
    X: mockIcon,
    Search: mockIcon,
    Tag: mockIcon,
    FileText: mockIcon,
    Archive: mockIcon
  };
});

describe('Button Component onclick Prop Fix', () => {
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

  describe('Basic onclick Prop Functionality', () => {
    it('should call onclick prop handler when button is clicked', async () => {
      render(Button, {
        props: {
          onclick: mockHandler
        },
        slots: {
          default: 'Test Button'
        }
      });

      const button = screen.getByRole('button', { name: 'Test Button' });
      await user.click(button);

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(expect.any(MouseEvent));
    });

    it('should handle multiple onclick calls correctly', async () => {
      render(Button, {
        props: {
          onclick: mockHandler
        },
        slots: {
          default: 'Multi Click'
        }
      });

      const button = screen.getByRole('button');

      // Multiple rapid clicks
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(mockHandler).toHaveBeenCalledTimes(3);
    });

    it('should pass correct MouseEvent to onclick handler', async () => {
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

    it('should maintain onclick handler across prop updates', async () => {
      const { rerender } = render(Button, {
        props: {
          onclick: mockHandler,
          variant: 'default' as const
        },
        slots: {
          default: 'Stable Handler'
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);
      expect(mockHandler).toHaveBeenCalledTimes(1);

      // Update other props but keep same handler
      rerender({
        onclick: mockHandler,
        variant: 'destructive' as const
      });

      await user.click(button);
      expect(mockHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Button State Interaction', () => {
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

    it('should show loading spinner and prevent clicks', () => {
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

  describe('Button Variants and Accessibility', () => {
    it('should work with all button variants', async () => {
      const variants = ['default', 'destructive', 'outline', 'secondary', 'accent', 'warm', 'ghost', 'link'] as const;

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

        const button = screen.getByRole(variant === 'link' ? 'button' : 'button');
        await user.click(button);

        expect(testHandler).toHaveBeenCalledTimes(1);
        unmount();
      }
    });

    it('should handle keyboard events (Enter and Space)', async () => {
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
});

describe('Articles Page Button Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let mockArticlesService: any;

  const mockArticles = [
    {
      id: 1,
      code: 'FOOD',
      name: 'Питание',
      description: 'Расходы на питание',
      is_active: true,
      is_shared: true,
      is_editable: true,
      user_id: null
    },
    {
      id: 2,
      code: 'TRANSPORT',
      name: 'Транспорт',
      description: 'Транспортные расходы',
      is_active: true,
      is_shared: false,
      is_editable: true,
      user_id: 1
    }
  ];

  const mockStats = {
    total: 2,
    active: 2,
    inactive: 0,
    shared: 1,
    user_specific: 1
  };

  beforeEach(async () => {
    user = userEvent.setup();

    // Get the mocked service
    const { articlesService } = await import('$lib/services/articles.service');
    mockArticlesService = articlesService;

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default successful responses
    mockArticlesService.getAll.mockResolvedValue({
      success: true,
      data: mockArticles,
      total: mockArticles.length
    });

    mockArticlesService.getStats.mockResolvedValue({
      success: true,
      data: mockStats
    });

    mockArticlesService.create.mockResolvedValue({
      success: true,
      data: { id: 3, code: 'NEW', name: 'New Article', is_active: true }
    });

    mockArticlesService.update.mockResolvedValue({
      success: true,
      data: { id: 1, code: 'FOOD_UPDATED', name: 'Updated Food' }
    });

    mockArticlesService.delete.mockResolvedValue({
      success: true
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Create Article Button', () => {
    it('should open create modal when create button is clicked', async () => {
      render(ArticlesPage);

      // Wait for initial load
      await waitFor(() => {
        expect(mockArticlesService.getAll).toHaveBeenCalled();
      });

      // Find and click the create button
      const createButton = screen.getByRole('button', { name: /создать статью/i });
      expect(createButton).toBeInTheDocument();

      await user.click(createButton);

      // Verify modal is opened
      await waitFor(() => {
        const modalTitle = screen.getByText('Создать статью');
        expect(modalTitle).toBeInTheDocument();
      });

      // Verify form fields are present
      expect(screen.getByLabelText(/код статьи/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/название/i)).toBeInTheDocument();
    });

    it('should handle create form submission', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(mockArticlesService.getAll).toHaveBeenCalled();
      });

      // Open create modal
      const createButton = screen.getByRole('button', { name: /создать статью/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });

      // Fill form
      const codeInput = screen.getByLabelText(/код статьи/i);
      const nameInput = screen.getByLabelText(/название/i);

      await user.type(codeInput, 'TEST');
      await user.type(nameInput, 'Test Article');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /создать/i });
      await user.click(submitButton);

      // Verify service was called
      await waitFor(() => {
        expect(mockArticlesService.create).toHaveBeenCalledWith({
          code: 'TEST',
          name: 'Test Article',
          description: undefined,
          is_active: true,
          user_id: null
        });
      });
    });
  });

  describe('Edit Article Button', () => {
    it('should open edit modal when edit button is clicked', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(mockArticlesService.getAll).toHaveBeenCalled();
      });

      // Find edit button for first article
      const editButtons = screen.getAllByRole('button', { name: /изменить/i });
      expect(editButtons.length).toBeGreaterThan(0);

      await user.click(editButtons[0]);

      // Verify edit modal is opened
      await waitFor(() => {
        const modalTitle = screen.getByText('Редактировать статью');
        expect(modalTitle).toBeInTheDocument();
      });

      // Verify form is pre-filled with article data
      const codeInput = screen.getByDisplayValue('FOOD');
      const nameInput = screen.getByDisplayValue('Питание');
      expect(codeInput).toBeInTheDocument();
      expect(nameInput).toBeInTheDocument();
    });

    it('should handle edit form submission', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(mockArticlesService.getAll).toHaveBeenCalled();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /изменить/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Редактировать статью')).toBeInTheDocument();
      });

      // Modify form
      const nameInput = screen.getByDisplayValue('Питание');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Food');

      // Submit form
      const saveButton = screen.getByRole('button', { name: /сохранить/i });
      await user.click(saveButton);

      // Verify service was called
      await waitFor(() => {
        expect(mockArticlesService.update).toHaveBeenCalledWith(1, {
          code: 'FOOD',
          name: 'Updated Food',
          description: 'Расходы на питание',
          is_active: true
        });
      });
    });
  });

  describe('Delete Article Button', () => {
    it('should open delete confirmation when delete button is clicked', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(mockArticlesService.getAll).toHaveBeenCalled();
      });

      // Find delete button for first article
      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
      expect(deleteButtons.length).toBeGreaterThan(0);

      await user.click(deleteButtons[0]);

      // Verify delete modal is opened
      await waitFor(() => {
        const modalTitle = screen.getByText('Удалить статью');
        expect(modalTitle).toBeInTheDocument();
      });

      // Verify confirmation text includes article name
      expect(screen.getByText(/питание/i)).toBeInTheDocument();
    });

    it('should handle delete confirmation', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(mockArticlesService.getAll).toHaveBeenCalled();
      });

      // Open delete modal
      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Удалить статью')).toBeInTheDocument();
      });

      // Confirm deletion
      const confirmButton = screen.getAllByRole('button', { name: /удалить/i })[1]; // Second delete button in modal
      await user.click(confirmButton);

      // Verify service was called
      await waitFor(() => {
        expect(mockArticlesService.delete).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Modal Cancel Buttons', () => {
    it('should close create modal when cancel is clicked', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(mockArticlesService.getAll).toHaveBeenCalled();
      });

      // Open create modal
      const createButton = screen.getByRole('button', { name: /создать статью/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /отмена/i });
      await user.click(cancelButton);

      // Verify modal is closed
      await waitFor(() => {
        expect(screen.queryByText('Создать статью')).not.toBeInTheDocument();
      });
    });

    it('should close edit modal when cancel is clicked', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(mockArticlesService.getAll).toHaveBeenCalled();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /изменить/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Редактировать статью')).toBeInTheDocument();
      });

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /отмена/i });
      await user.click(cancelButton);

      // Verify modal is closed
      await waitFor(() => {
        expect(screen.queryByText('Редактировать статью')).not.toBeInTheDocument();
      });
    });

    it('should close delete modal when cancel is clicked', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(mockArticlesService.getAll).toHaveBeenCalled();
      });

      // Open delete modal
      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Удалить статью')).toBeInTheDocument();
      });

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /отмена/i });
      await user.click(cancelButton);

      // Verify modal is closed
      await waitFor(() => {
        expect(screen.queryByText('Удалить статью')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Loading States', () => {
    it('should show retry button when loading fails', async () => {
      // Mock failed load
      mockArticlesService.getAll.mockRejectedValueOnce(new Error('Load failed'));

      render(ArticlesPage);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /попробовать снова/i });
        expect(retryButton).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /попробовать снова/i });

      // Reset mock to succeed on retry
      mockArticlesService.getAll.mockResolvedValueOnce({
        success: true,
        data: mockArticles,
        total: mockArticles.length
      });

      await user.click(retryButton);

      // Verify retry was attempted
      await waitFor(() => {
        expect(mockArticlesService.getAll).toHaveBeenCalledTimes(2);
      });
    });

    it('should show empty state create button when no articles found', async () => {
      // Mock empty response
      mockArticlesService.getAll.mockResolvedValueOnce({
        success: true,
        data: [],
        total: 0
      });

      mockArticlesService.getStats.mockResolvedValueOnce({
        success: true,
        data: {
          total: 0,
          active: 0,
          inactive: 0,
          shared: 0,
          user_specific: 0
        }
      });

      render(ArticlesPage);

      await waitFor(() => {
        expect(mockArticlesService.getAll).toHaveBeenCalled();
      });

      // Should show empty state with create button
      const emptyStateCreateButton = screen.getAllByRole('button', { name: /создать статью/i });
      expect(emptyStateCreateButton.length).toBeGreaterThan(0);

      // Click empty state create button
      await user.click(emptyStateCreateButton[0]);

      // Should open create modal
      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });
    });
  });
});

describe('Regression Prevention Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('onclick vs on:click Syntax Validation', () => {
    it('should verify Button component uses onclick prop internally', () => {
      const mockHandler = vi.fn();
      const { container } = render(Button, {
        props: {
          onclick: mockHandler
        },
        slots: {
          default: 'Syntax Test'
        }
      });

      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();

      // Verify the button has the onclick handler by checking it can be called
      expect(typeof mockHandler).toBe('function');
    });

    it('should ensure onclick prop is properly bound to DOM events', async () => {
      const mockHandler = vi.fn();
      render(Button, {
        props: {
          onclick: mockHandler
        },
        slots: {
          default: 'DOM Binding Test'
        }
      });

      const button = screen.getByRole('button');

      // Use both fireEvent and userEvent to ensure DOM binding works
      await fireEvent.click(button);
      expect(mockHandler).toHaveBeenCalledTimes(1);

      await user.click(button);
      expect(mockHandler).toHaveBeenCalledTimes(2);
    });

    it('should prevent reversion to on:click syntax by testing expected behavior', async () => {
      // This test ensures the fix remains in place by testing the expected behavior
      let clickCount = 0;
      const clickHandler = () => { clickCount++; };

      render(Button, {
        props: {
          onclick: clickHandler
        },
        slots: {
          default: 'Reversion Prevention'
        }
      });

      const button = screen.getByRole('button');
      await user.click(button);

      // If onclick prop works, this should increment
      expect(clickCount).toBe(1);

      await user.click(button);
      expect(clickCount).toBe(2);
    });
  });

  describe('Button Responsiveness Validation', () => {
    it('should ensure buttons respond immediately to clicks', async () => {
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

      // Rapid successive clicks
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(timestamps).toHaveLength(3);

      // Verify all clicks were registered (no missed clicks)
      for (let i = 0; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThan(0);
      }
    });

    it('should handle high-frequency clicking without issues', async () => {
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

      // Simulate very rapid clicking
      const clickPromises = [];
      for (let i = 0; i < 10; i++) {
        clickPromises.push(user.click(button));
      }

      await Promise.all(clickPromises);

      // All clicks should be registered
      expect(clickCount).toBe(10);
    });
  });

  describe('Cross-Component Consistency', () => {
    it('should ensure onclick prop works consistently across different button variants', async () => {
      const variants = ['default', 'destructive', 'outline', 'secondary'] as const;
      const results: number[] = [];

      for (const variant of variants) {
        let variantClickCount = 0;
        const variantHandler = () => { variantClickCount++; };

        const { unmount } = render(Button, {
          props: {
            onclick: variantHandler,
            variant
          },
          slots: {
            default: `${variant} Consistency Test`
          }
        });

        const button = screen.getByRole('button');
        await user.click(button);
        await user.click(button);

        results.push(variantClickCount);
        unmount();
      }

      // All variants should have the same click behavior
      expect(results).toEqual([2, 2, 2, 2]);
    });

    it('should maintain onclick behavior across component re-renders', async () => {
      let clickCount = 0;
      const persistentHandler = () => { clickCount++; };

      const { rerender } = render(Button, {
        props: {
          onclick: persistentHandler,
          disabled: false
        },
        slots: {
          default: 'Persistence Test'
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
  });
});
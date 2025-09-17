/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import userEvent from '@testing-library/user-event';
import ArticlesPage from '../routes/(protected)/settings/articles/+page.svelte';
import type { Article, ArticleStats, ApiResponse } from '$lib/types';

// Mock stores
vi.mock('$lib/stores/auth.store', () => ({
  isAdmin: {
    subscribe: vi.fn((callback) => {
      callback(true); // Mock as admin user
      return () => {};
    })
  }
}));

vi.mock('$lib/stores/toast.store', () => {
  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  };
  return {
    useToast: () => mockToast,
    toast: mockToast
  };
});

// Mock articles service
vi.mock('$lib/services/articles.service', () => ({
  articlesService: {
    getAll: vi.fn(),
    getStats: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getById: vi.fn(),
    bulkDelete: vi.fn()
  }
}));

// Mock Lucide icons
vi.mock('lucide-svelte', () => {
  const MockIcon = () => '<div data-testid="mock-icon"></div>';
  return {
    BookOpen: MockIcon,
    Plus: MockIcon,
    Edit: MockIcon,
    Trash2: MockIcon,
    Shield: MockIcon,
    Users: MockIcon,
    User: MockIcon,
    Check: MockIcon,
    X: MockIcon,
    Search: MockIcon,
    Tag: MockIcon,
    FileText: MockIcon,
    Archive: MockIcon
  };
});

describe('Articles Page Button Click Fix Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let mockArticlesService: any;

  // Test data
  const mockArticles: Article[] = [
    {
      id: 1,
      article_id: 1,
      code: 'FOOD',
      name: 'Питание',
      description: 'Продукты питания',
      is_active: true,
      user_id: 1,
      is_editable: true,
      is_shared: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    },
    {
      id: 2,
      article_id: 2,
      code: 'TRANSPORT',
      name: 'Транспорт',
      description: 'Транспортные расходы',
      is_active: true,
      user_id: 1,
      is_editable: true,
      is_shared: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    },
    {
      id: 3,
      article_id: 3,
      code: 'INACTIVE',
      name: 'Неактивная статья',
      description: 'Неактивная статья для тестов',
      is_active: false,
      user_id: 1,
      is_editable: false,
      is_shared: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    }
  ];

  const mockStats: ArticleStats = {
    total: 3,
    active: 2,
    inactive: 1,
    shared: 1,
    user_specific: 2
  };

  const mockApiResponse = <T>(data: T, success = true): ApiResponse<T> => ({
    success,
    data,
    error: success ? undefined : 'Test error'
  });

  beforeEach(async () => {
    user = userEvent.setup();
    vi.clearAllMocks();

    // Get the mocked service
    const { articlesService } = await import('$lib/services/articles.service');
    mockArticlesService = articlesService;

    // Setup default successful API responses
    mockArticlesService.getAll.mockResolvedValue(mockApiResponse(mockArticles));
    mockArticlesService.getStats.mockResolvedValue(mockApiResponse(mockStats));
    mockArticlesService.create.mockResolvedValue(mockApiResponse(mockArticles[0]));
    mockArticlesService.update.mockResolvedValue(mockApiResponse(mockArticles[0]));
    mockArticlesService.delete.mockResolvedValue(mockApiResponse({ message: 'Deleted successfully' }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Header Create Button', () => {
    it('should open create modal when create button is clicked using onclick prop', async () => {
      render(ArticlesPage);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /создать статью/i });
      expect(createButton).toBeInTheDocument();

      await user.click(createButton);

      // Check that create modal is opened
      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
        expect(screen.getByLabelText(/код статьи/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/название/i)).toBeInTheDocument();
      });
    });

    it('should have onclick prop function that opens modal', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      // Find the create button and verify it has an onclick handler
      const createButton = screen.getByRole('button', { name: /создать статью/i });

      // Check that button responds to click events
      await user.click(createButton);

      // Verify modal opens (proving onclick worked)
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });
    });
  });

  describe('Table Edit Buttons', () => {
    it('should open edit modal with correct article when edit button is clicked', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      // Find edit button for first article
      const editButtons = screen.getAllByRole('button', { name: /изменить/i });
      expect(editButtons).toHaveLength(2); // Only editable articles have edit buttons

      await user.click(editButtons[0]);

      // Check that edit modal is opened with correct data
      await waitFor(() => {
        expect(screen.getByText('Редактировать статью')).toBeInTheDocument();
        expect(screen.getByDisplayValue('FOOD')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Питание')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Продукты питания')).toBeInTheDocument();
      });
    });

    it('should use onclick prop for edit button functionality', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /изменить/i });

      // Test second edit button (Transport article)
      await user.click(editButtons[1]);

      await waitFor(() => {
        expect(screen.getByText('Редактировать статью')).toBeInTheDocument();
        expect(screen.getByDisplayValue('TRANSPORT')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Транспорт')).toBeInTheDocument();
      });
    });

    it('should not show edit button for non-editable articles', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      // The inactive article (non-editable) should not have an edit button
      const editButtons = screen.getAllByRole('button', { name: /изменить/i });
      expect(editButtons).toHaveLength(2); // Only 2 editable articles out of 3 total
    });
  });

  describe('Table Delete Buttons', () => {
    it('should open delete modal with correct article when delete button is clicked', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
      expect(deleteButtons).toHaveLength(2); // Only editable articles have delete buttons

      await user.click(deleteButtons[0]);

      // Check that delete modal is opened with correct article
      await waitFor(() => {
        expect(screen.getByText('Удалить статью')).toBeInTheDocument();
        expect(screen.getByText('"Питание"')).toBeInTheDocument();
        expect(screen.getByText(/это действие нельзя отменить/i)).toBeInTheDocument();
      });
    });

    it('should use onclick prop for delete button functionality', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });

      // Test second delete button (Transport article)
      await user.click(deleteButtons[1]);

      await waitFor(() => {
        expect(screen.getByText('Удалить статью')).toBeInTheDocument();
        expect(screen.getByText('"Транспорт"')).toBeInTheDocument();
      });
    });

    it('should not show delete button for non-editable articles', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      // The inactive article (non-editable) should not have a delete button
      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
      expect(deleteButtons).toHaveLength(2); // Only 2 editable articles out of 3 total
    });
  });

  describe('Modal Cancel Buttons', () => {
    it('should close create modal when cancel button is clicked using onclick prop', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      // Open create modal
      const createButton = screen.getByRole('button', { name: /создать статью/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });

      // Click cancel button
      const cancelButton = screen.getByRole('button', { name: /отмена/i });
      await user.click(cancelButton);

      // Check modal is closed
      await waitFor(() => {
        expect(screen.queryByText('Создать статью')).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should close edit modal when cancel button is clicked using onclick prop', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /изменить/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Редактировать статью')).toBeInTheDocument();
      });

      // Click cancel button
      const cancelButton = screen.getByRole('button', { name: /отмена/i });
      await user.click(cancelButton);

      // Check modal is closed
      await waitFor(() => {
        expect(screen.queryByText('Редактировать статью')).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should close delete modal when cancel button is clicked using onclick prop', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      // Open delete modal
      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Удалить статью')).toBeInTheDocument();
      });

      // Click cancel button
      const cancelButton = screen.getByRole('button', { name: /отмена/i });
      await user.click(cancelButton);

      // Check modal is closed
      await waitFor(() => {
        expect(screen.queryByText('Удалить статью')).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Modal Submit Buttons', () => {
    it('should handle form submission when create submit button is clicked', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      // Open create modal
      const createButton = screen.getByRole('button', { name: /создать статью/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });

      // Fill form
      await user.type(screen.getByLabelText(/код статьи/i), 'TEST');
      await user.type(screen.getByLabelText(/название/i), 'Тестовая статья');
      await user.type(screen.getByLabelText(/описание/i), 'Описание тестовой статьи');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /^создать$/i });
      await user.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(mockArticlesService.create).toHaveBeenCalledWith({
          code: 'TEST',
          name: 'Тестовая статья',
          description: 'Описание тестовой статьи',
          is_active: true,
          user_id: null
        });
      });
    });

    it('should handle form submission when edit submit button is clicked', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
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
      await user.type(nameInput, 'Обновленное питание');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /сохранить/i });
      await user.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(mockArticlesService.update).toHaveBeenCalledWith(1, {
          code: 'FOOD',
          name: 'Обновленное питание',
          description: 'Продукты питания',
          is_active: true
        });
      });
    });

    it('should handle deletion when delete submit button is clicked', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      // Open delete modal
      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Удалить статью')).toBeInTheDocument();
      });

      // Confirm deletion
      const confirmDeleteButton = screen.getAllByRole('button', { name: /удалить/i })[1]; // Second "удалить" button in modal
      await user.click(confirmDeleteButton);

      // Verify API call
      await waitFor(() => {
        expect(mockArticlesService.delete).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Error State Retry Button', () => {
    it('should retry loading when retry button is clicked using onclick prop', async () => {
      // Mock API failure first
      mockArticlesService.getAll.mockRejectedValueOnce(new Error('Network error'));
      mockArticlesService.getStats.mockRejectedValueOnce(new Error('Network error'));

      render(ArticlesPage);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText('Ошибка загрузки')).toBeInTheDocument();
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Reset mocks to successful responses
      mockArticlesService.getAll.mockResolvedValue(mockApiResponse(mockArticles));
      mockArticlesService.getStats.mockResolvedValue(mockApiResponse(mockStats));

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /попробовать снова/i });
      await user.click(retryButton);

      // Verify retry attempt
      await waitFor(() => {
        expect(mockArticlesService.getAll).toHaveBeenCalledTimes(2); // Initial call + retry
        expect(mockArticlesService.getStats).toHaveBeenCalledTimes(2); // Initial call + retry
      });

      // Verify successful load after retry
      await waitFor(() => {
        expect(screen.queryByText('Ошибка загрузки')).not.toBeInTheDocument();
        expect(screen.getByText('FOOD')).toBeInTheDocument();
        expect(screen.getByText('Питание')).toBeInTheDocument();
      });
    });

    it('should use onclick prop for retry functionality', async () => {
      // Mock API failure
      mockArticlesService.getAll.mockRejectedValueOnce(new Error('API Error'));
      mockArticlesService.getStats.mockRejectedValueOnce(new Error('API Error'));

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Ошибка загрузки')).toBeInTheDocument();
      });

      // Reset to successful responses
      mockArticlesService.getAll.mockResolvedValue(mockApiResponse(mockArticles));
      mockArticlesService.getStats.mockResolvedValue(mockApiResponse(mockStats));

      const retryButton = screen.getByRole('button', { name: /попробовать снова/i });

      // Verify the button responds to clicks (proves onclick is working)
      await user.click(retryButton);

      // Check that the retry logic executed
      await waitFor(() => {
        expect(screen.queryByText('Ошибка загрузки')).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty State Create Button', () => {
    it('should open create modal when empty state create button is clicked', async () => {
      // Mock empty articles response
      mockArticlesService.getAll.mockResolvedValue(mockApiResponse([]));
      mockArticlesService.getStats.mockResolvedValue(mockApiResponse({
        total: 0,
        active: 0,
        inactive: 0,
        shared: 0,
        user_specific: 0
      }));

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Статьи не найдены')).toBeInTheDocument();
        expect(screen.getByText('Создайте первую статью')).toBeInTheDocument();
      });

      // Click the empty state create button
      const createButton = screen.getByRole('button', { name: /создать статью/i });
      await user.click(createButton);

      // Verify modal opens
      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
        expect(screen.getByLabelText(/код статьи/i)).toBeInTheDocument();
      });
    });
  });

  describe('Button Event Handler Integration', () => {
    it('should properly execute onclick handlers without conflicts', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      // Test multiple button interactions in sequence
      const createButton = screen.getByRole('button', { name: /создать статью/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /отмена/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Создать статью')).not.toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /изменить/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Редактировать статью')).toBeInTheDocument();
      });

      // Verify no console errors occurred
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should maintain button functionality after component re-renders', async () => {
      const { rerender } = render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      // First interaction
      const createButton = screen.getByRole('button', { name: /создать статью/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /отмена/i });
      await user.click(cancelButton);

      // Trigger re-render
      rerender(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      // Test button still works after re-render
      const createButtonAfterRerender = screen.getByRole('button', { name: /создать статью/i });
      await user.click(createButtonAfterRerender);

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });
    });
  });

  describe('Button Accessibility', () => {
    it('should support keyboard navigation for buttons with onclick props', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /создать статью/i });

      // Focus the button
      createButton.focus();
      expect(createButton).toHaveFocus();

      // Trigger with Enter key
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });
    });

    it('should support space key activation for buttons with onclick props', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /создать статью/i });
      createButton.focus();

      // Trigger with Space key
      await user.keyboard(' ');

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });
    });
  });
});
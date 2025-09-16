/**
 * Frontend tests for articles settings component.
 * Tests UI behavior, form handling, error processing, and 409 conflict handling.
 * Tests both shared and user-specific articles with proper permission handling.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import ArticlesPage from '../../frontend-svelte/src/routes/(protected)/settings/articles/+page.svelte';
import { articlesService } from '../../frontend-svelte/src/lib/services/articles.service';
import { isAdmin } from '../../frontend-svelte/src/lib/stores/auth.store';
import { createMockApiResponse, waitForAsync } from '../../frontend-svelte/src/test/utils';

// Mock the articles service
vi.mock('../../frontend-svelte/src/lib/services/articles.service', () => ({
  articlesService: {
    getAll: vi.fn(),
    getStats: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulkDelete: vi.fn(),
  }
}));

// Mock auth store
vi.mock('../../frontend-svelte/src/lib/stores/auth.store', () => ({
  isAdmin: {
    subscribe: vi.fn((callback) => {
      callback(false); // Default to regular user
      return () => {};
    })
  }
}));

// Mock toast notifications
vi.mock('../../frontend-svelte/src/lib/stores/toast.store', () => ({
  useToast: vi.fn(() => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }))
}));

describe('Articles Settings Component', () => {
  const mockArticlesService = articlesService as any;
  let mockIsAdmin = false;

  const mockArticles = [
    {
      id: 1,
      code: 'FOOD',
      name: 'Питание',
      description: 'Расходы на питание',
      is_active: true,
      is_shared: false,
      is_editable: true,
      user_id: 1,
      created_at: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 2,
      code: 'TRANSPORT',
      name: 'Транспорт',
      description: 'Транспортные расходы',
      is_active: false,
      is_shared: true,
      is_editable: false,
      user_id: null,
      created_at: '2025-01-02T00:00:00.000Z'
    },
    {
      id: 3,
      code: 'HOUSING',
      name: 'Жильё',
      description: 'Расходы на жильё',
      is_active: true,
      is_shared: true,
      is_editable: true,
      user_id: null,
      created_at: '2025-01-03T00:00:00.000Z'
    }
  ];

  const mockStats = {
    total: 3,
    active: 2,
    inactive: 1,
    shared: 2,
    user_specific: 1
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset admin status
    mockIsAdmin = false;
    (isAdmin.subscribe as Mock).mockImplementation((callback) => {
      callback(mockIsAdmin);
      return () => {};
    });

    // Default service mocks
    mockArticlesService.getAll.mockResolvedValue(createMockApiResponse(mockArticles));
    mockArticlesService.getStats.mockResolvedValue(createMockApiResponse(mockStats));
    mockArticlesService.create.mockResolvedValue(createMockApiResponse({
      id: 4,
      code: 'NEW_ARTICLE',
      name: 'Новая статья',
      description: 'Описание новой статьи',
      is_active: true,
      is_shared: false,
      is_editable: true
    }));
    mockArticlesService.update.mockResolvedValue(createMockApiResponse({
      id: 1,
      code: 'FOOD',
      name: 'Обновлённое питание',
      description: 'Обновлённое описание',
      is_active: false,
      is_shared: false,
      is_editable: true
    }));
    mockArticlesService.delete.mockResolvedValue(createMockApiResponse({
      message: 'Article deleted successfully'
    }));
    mockArticlesService.bulkDelete.mockResolvedValue(createMockApiResponse({
      message: 'Articles deleted successfully',
      deleted_count: 2
    }));
  });

  describe('Component Rendering', () => {
    it('renders articles page with title', async () => {
      render(ArticlesPage);

      expect(screen.getByText('Управление статьями')).toBeInTheDocument();
      expect(screen.getByText('Управление категориями статей для группировки номенклатур')).toBeInTheDocument();
    });

    it('displays create button', async () => {
      render(ArticlesPage);

      expect(screen.getByText('Создать статью')).toBeInTheDocument();
    });

    it('displays statistics cards', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Should show statistics
      expect(screen.getByText('Всего')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Активные')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Неактивные')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Общие')).toBeInTheDocument();
      expect(screen.getByText('Личные')).toBeInTheDocument();
    });

    it('displays loading state initially', () => {
      render(ArticlesPage);

      expect(screen.getByText('Загрузка статей...')).toBeInTheDocument();
    });

    it('displays articles table after loading', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Check table headers
      expect(screen.getByText('Код и название')).toBeInTheDocument();
      expect(screen.getByText('Описание')).toBeInTheDocument();
      expect(screen.getByText('Тип')).toBeInTheDocument();
      expect(screen.getByText('Статус')).toBeInTheDocument();
      expect(screen.getByText('Действия')).toBeInTheDocument();

      // Check articles are displayed
      expect(screen.getByText('FOOD')).toBeInTheDocument();
      expect(screen.getByText('Питание')).toBeInTheDocument();
      expect(screen.getByText('TRANSPORT')).toBeInTheDocument();
      expect(screen.getByText('Транспорт')).toBeInTheDocument();
    });

    it('displays article type badges correctly', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Should show shared and personal badges
      expect(screen.getByText('Общая')).toBeInTheDocument();
      expect(screen.getByText('Личная')).toBeInTheDocument();
    });

    it('displays article status badges correctly', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Should show active and inactive badges
      expect(screen.getByText('Активна')).toBeInTheDocument();
      expect(screen.getByText('Неактивна')).toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('displays error state when loading fails', async () => {
      mockArticlesService.getAll.mockRejectedValue(new Error('Network error'));

      render(ArticlesPage);
      await waitForAsync();

      expect(screen.getByText('Ошибка загрузки')).toBeInTheDocument();
      expect(screen.getByText('Попробовать снова')).toBeInTheDocument();
    });

    it('displays empty state when no articles found', async () => {
      mockArticlesService.getAll.mockResolvedValue(createMockApiResponse([]));
      mockArticlesService.getStats.mockResolvedValue(createMockApiResponse({
        total: 0, active: 0, inactive: 0, shared: 0, user_specific: 0
      }));

      render(ArticlesPage);
      await waitForAsync();

      expect(screen.getByText('Статьи не найдены')).toBeInTheDocument();
      expect(screen.getByText('Создайте первую статью')).toBeInTheDocument();
    });

    it('retries loading when retry button is clicked', async () => {
      mockArticlesService.getAll.mockRejectedValueOnce(new Error('Network error'));
      mockArticlesService.getAll.mockResolvedValueOnce(createMockApiResponse(mockArticles));

      render(ArticlesPage);
      await waitForAsync();

      expect(screen.getByText('Ошибка загрузки')).toBeInTheDocument();

      const retryButton = screen.getByText('Попробовать снова');
      await fireEvent.click(retryButton);
      await waitForAsync();

      expect(screen.getByText('Питание')).toBeInTheDocument();
    });
  });

  describe('Filtering and Search', () => {
    it('displays search input and filters', async () => {
      render(ArticlesPage);
      await waitForAsync();

      expect(screen.getByPlaceholderText('Поиск по названию, коду или описанию...')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Все статусы')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Все типы')).toBeInTheDocument();
    });

    it('filters articles by search term', async () => {
      render(ArticlesPage);
      await waitForAsync();

      const searchInput = screen.getByPlaceholderText('Поиск по названию, коду или описанию...');

      await userEvent.type(searchInput, 'FOOD');
      await waitForAsync();

      // Should show only FOOD article
      expect(screen.getByText('FOOD')).toBeInTheDocument();
      expect(screen.queryByText('TRANSPORT')).not.toBeInTheDocument();
    });

    it('filters articles by active status', async () => {
      render(ArticlesPage);
      await waitForAsync();

      const statusFilter = screen.getByDisplayValue('Все статусы');

      await userEvent.selectOptions(statusFilter, 'active');
      await waitForAsync();

      // Should show only active articles
      expect(screen.getByText('FOOD')).toBeInTheDocument();
      expect(screen.getByText('HOUSING')).toBeInTheDocument();
      expect(screen.queryByText('TRANSPORT')).not.toBeInTheDocument();
    });

    it('filters articles by shared type', async () => {
      render(ArticlesPage);
      await waitForAsync();

      const sharedFilter = screen.getByDisplayValue('Все типы');

      await userEvent.selectOptions(sharedFilter, 'shared');
      await waitForAsync();

      // Should show only shared articles
      expect(screen.getByText('TRANSPORT')).toBeInTheDocument();
      expect(screen.getByText('HOUSING')).toBeInTheDocument();
      expect(screen.queryByText('FOOD')).not.toBeInTheDocument();
    });

    it('shows no results message when search yields no results', async () => {
      render(ArticlesPage);
      await waitForAsync();

      const searchInput = screen.getByPlaceholderText('Поиск по названию, коду или описанию...');

      await userEvent.type(searchInput, 'NONEXISTENT');
      await waitForAsync();

      expect(screen.getByText('Статьи не найдены')).toBeInTheDocument();
      expect(screen.getByText('Попробуйте изменить критерии поиска')).toBeInTheDocument();
    });
  });

  describe('Create Article', () => {
    it('opens create modal when create button is clicked', async () => {
      render(ArticlesPage);
      await waitForAsync();

      const createButton = screen.getByText('Создать статью');
      await fireEvent.click(createButton);

      expect(screen.getByText('Создать статью')).toBeInTheDocument();
      expect(screen.getByLabelText('Код статьи *')).toBeInTheDocument();
      expect(screen.getByLabelText('Название *')).toBeInTheDocument();
      expect(screen.getByLabelText('Описание')).toBeInTheDocument();
    });

    it('creates article successfully', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Open create modal
      const createButton = screen.getByText('Создать статью');
      await fireEvent.click(createButton);

      // Fill form
      const codeInput = screen.getByLabelText('Код статьи *');
      const nameInput = screen.getByLabelText('Название *');
      const descriptionInput = screen.getByLabelText('Описание');

      await userEvent.type(codeInput, 'NEWCODE');
      await userEvent.type(nameInput, 'Новая статья');
      await userEvent.type(descriptionInput, 'Описание новой статьи');

      // Submit form
      const submitButton = screen.getByRole('button', { name: 'Создать' });
      await fireEvent.click(submitButton);

      await waitForAsync();

      // Verify service was called
      expect(mockArticlesService.create).toHaveBeenCalledWith({
        code: 'NEWCODE',
        name: 'Новая статья',
        description: 'Описание новой статьи',
        is_active: true,
        user_id: null
      });

      // Verify data is reloaded
      expect(mockArticlesService.getAll).toHaveBeenCalledTimes(2); // Initial load + after create
    });

    it('shows admin-only fields when user is admin', async () => {
      mockIsAdmin = true;
      (isAdmin.subscribe as Mock).mockImplementation((callback) => {
        callback(mockIsAdmin);
        return () => {};
      });

      render(ArticlesPage);
      await waitForAsync();

      const createButton = screen.getByText('Создать статью');
      await fireEvent.click(createButton);

      expect(screen.getByText('Тип статьи')).toBeInTheDocument();
      expect(screen.getByText('Общая статья (доступна всем пользователям)')).toBeInTheDocument();
    });

    it('handles create error with 409 conflict', async () => {
      mockArticlesService.create.mockRejectedValue(new Error('Article with code \'DUPLICATE\' already exists'));

      render(ArticlesPage);
      await waitForAsync();

      // Open create modal
      const createButton = screen.getByText('Создать статью');
      await fireEvent.click(createButton);

      // Fill form
      const codeInput = screen.getByLabelText('Код статьи *');
      const nameInput = screen.getByLabelText('Название *');

      await userEvent.type(codeInput, 'DUPLICATE');
      await userEvent.type(nameInput, 'Дублирующаяся статья');

      // Submit form
      const submitButton = screen.getByRole('button', { name: 'Создать' });
      await fireEvent.click(submitButton);

      await waitForAsync();

      // Error should be displayed via toast (mocked)
      expect(mockArticlesService.create).toHaveBeenCalled();
    });

    it('validates required fields', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Open create modal
      const createButton = screen.getByText('Создать статью');
      await fireEvent.click(createButton);

      // Try to submit without filling required fields
      const submitButton = screen.getByRole('button', { name: 'Создать' });
      await fireEvent.click(submitButton);

      // Form should not submit (browser validation)
      expect(mockArticlesService.create).not.toHaveBeenCalled();
    });

    it('closes modal when cancel is clicked', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Open create modal
      const createButton = screen.getByText('Создать статью');
      await fireEvent.click(createButton);

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: 'Отмена' });
      await fireEvent.click(cancelButton);

      // Modal should be closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Edit Article', () => {
    it('opens edit modal when edit button is clicked', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Find and click edit button for editable article
      const editButtons = screen.getAllByText('Изменить');
      await fireEvent.click(editButtons[0]);

      expect(screen.getByText('Редактировать статью')).toBeInTheDocument();
      expect(screen.getByDisplayValue('FOOD')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Питание')).toBeInTheDocument();
    });

    it('updates article successfully', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Open edit modal
      const editButtons = screen.getAllByText('Изменить');
      await fireEvent.click(editButtons[0]);

      // Update fields
      const nameInput = screen.getByDisplayValue('Питание');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Обновлённое питание');

      // Submit form
      const submitButton = screen.getByRole('button', { name: 'Сохранить' });
      await fireEvent.click(submitButton);

      await waitForAsync();

      // Verify service was called
      expect(mockArticlesService.update).toHaveBeenCalledWith(1, {
        code: 'FOOD',
        name: 'Обновлённое питание',
        description: 'Расходы на питание',
        is_active: true
      });
    });

    it('shows only edit buttons for editable articles', async () => {
      render(ArticlesPage);
      await waitForAsync();

      const editButtons = screen.getAllByText('Изменить');

      // Should show edit button only for editable articles (FOOD and HOUSING in mock data)
      expect(editButtons).toHaveLength(2);
    });

    it('handles update error', async () => {
      mockArticlesService.update.mockRejectedValue(new Error('Update failed'));

      render(ArticlesPage);
      await waitForAsync();

      // Open edit modal
      const editButtons = screen.getAllByText('Изменить');
      await fireEvent.click(editButtons[0]);

      // Submit form
      const submitButton = screen.getByRole('button', { name: 'Сохранить' });
      await fireEvent.click(submitButton);

      await waitForAsync();

      // Error should be handled via toast (mocked)
      expect(mockArticlesService.update).toHaveBeenCalled();
    });
  });

  describe('Delete Article', () => {
    it('opens delete modal when delete button is clicked', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Find and click delete button
      const deleteButtons = screen.getAllByText('Удалить');
      await fireEvent.click(deleteButtons[0]);

      expect(screen.getByText('Удалить статью')).toBeInTheDocument();
      expect(screen.getByText('Вы уверены, что хотите удалить статью')).toBeInTheDocument();
      expect(screen.getByText('"Питание"')).toBeInTheDocument();
    });

    it('deletes article successfully', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Open delete modal
      const deleteButtons = screen.getAllByText('Удалить');
      await fireEvent.click(deleteButtons[0]);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: 'Удалить' });
      await fireEvent.click(confirmButton);

      await waitForAsync();

      // Verify service was called
      expect(mockArticlesService.delete).toHaveBeenCalledWith(1);

      // Verify data is reloaded
      expect(mockArticlesService.getAll).toHaveBeenCalledTimes(2); // Initial load + after delete
    });

    it('shows only delete buttons for deletable articles', async () => {
      render(ArticlesPage);
      await waitForAsync();

      const deleteButtons = screen.getAllByText('Удалить');

      // Should show delete button only for editable articles (same as edit)
      expect(deleteButtons).toHaveLength(2);
    });

    it('cancels deletion when cancel is clicked', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Open delete modal
      const deleteButtons = screen.getAllByText('Удалить');
      await fireEvent.click(deleteButtons[0]);

      // Cancel deletion
      const cancelButton = screen.getByRole('button', { name: 'Отмена' });
      await fireEvent.click(cancelButton);

      // Service should not be called
      expect(mockArticlesService.delete).not.toHaveBeenCalled();
    });

    it('handles delete error', async () => {
      mockArticlesService.delete.mockRejectedValue(new Error('Delete failed'));

      render(ArticlesPage);
      await waitForAsync();

      // Open delete modal
      const deleteButtons = screen.getAllByText('Удалить');
      await fireEvent.click(deleteButtons[0]);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: 'Удалить' });
      await fireEvent.click(confirmButton);

      await waitForAsync();

      // Error should be handled via toast (mocked)
      expect(mockArticlesService.delete).toHaveBeenCalled();
    });
  });

  describe('Permission Handling', () => {
    it('shows appropriate actions for shared articles when user is admin', async () => {
      mockIsAdmin = true;
      (isAdmin.subscribe as Mock).mockImplementation((callback) => {
        callback(mockIsAdmin);
        return () => {};
      });

      // Update mock to show shared articles as editable for admin
      const adminMockArticles = mockArticles.map(article => ({
        ...article,
        is_editable: article.is_shared ? true : article.is_editable
      }));
      mockArticlesService.getAll.mockResolvedValue(createMockApiResponse(adminMockArticles));

      render(ArticlesPage);
      await waitForAsync();

      // Admin should see edit/delete buttons for all articles
      const editButtons = screen.getAllByText('Изменить');
      const deleteButtons = screen.getAllByText('Удалить');

      expect(editButtons.length).toBeGreaterThanOrEqual(3);
      expect(deleteButtons.length).toBeGreaterThanOrEqual(3);
    });

    it('hides edit/delete buttons for non-editable shared articles for regular users', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Regular user should not see edit/delete for non-editable shared articles
      const editButtons = screen.getAllByText('Изменить');
      const deleteButtons = screen.getAllByText('Удалить');

      // Should only show for editable articles (FOOD and HOUSING where is_editable=true)
      expect(editButtons).toHaveLength(2);
      expect(deleteButtons).toHaveLength(2);
    });

    it('shows correct UI state based on user permissions', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Check that shared articles are marked appropriately
      expect(screen.getByText('Общая')).toBeInTheDocument();
      expect(screen.getByText('Личная')).toBeInTheDocument();

      // Verify that non-editable shared articles don't have action buttons
      const rows = screen.getAllByRole('row');

      // Find the TRANSPORT row (shared, non-editable)
      const transportRow = rows.find(row => row.textContent?.includes('TRANSPORT'));
      expect(transportRow).toBeDefined();

      // This row should not have edit/delete buttons
      expect(transportRow?.querySelector('button')).toBeNull();
    });
  });

  describe('Data Refresh and Real-time Updates', () => {
    it('refreshes statistics after CRUD operations', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Initial load should call getStats
      expect(mockArticlesService.getStats).toHaveBeenCalledTimes(1);

      // Create article should trigger stats refresh
      const createButton = screen.getByText('Создать статью');
      await fireEvent.click(createButton);

      const codeInput = screen.getByLabelText('Код статьи *');
      const nameInput = screen.getByLabelText('Название *');

      await userEvent.type(codeInput, 'REFRESH');
      await userEvent.type(nameInput, 'Тест обновления');

      const submitButton = screen.getByRole('button', { name: 'Создать' });
      await fireEvent.click(submitButton);

      await waitForAsync();

      // Should call getStats again after creation
      expect(mockArticlesService.getStats).toHaveBeenCalledTimes(2);
    });

    it('handles concurrent modifications gracefully', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Simulate external modification by changing mock data
      const modifiedArticles = [...mockArticles];
      modifiedArticles[0] = { ...modifiedArticles[0], name: 'Externally Modified' };

      mockArticlesService.getAll.mockResolvedValue(createMockApiResponse(modifiedArticles));

      // Trigger refresh by performing an operation
      const editButtons = screen.getAllByText('Изменить');
      await fireEvent.click(editButtons[0]);

      const cancelButton = screen.getByRole('button', { name: 'Отмена' });
      await fireEvent.click(cancelButton);

      // Component should handle the modified data correctly
      expect(mockArticlesService.getAll).toHaveBeenCalled();
    });
  });

  describe('Accessibility and UX', () => {
    it('provides proper ARIA labels and roles', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Check table structure
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(5);
      expect(screen.getAllByRole('row')).toHaveLength(4); // 3 data rows + 1 header row
    });

    it('supports keyboard navigation', async () => {
      render(ArticlesPage);
      await waitForAsync();

      // Test that buttons are focusable
      const createButton = screen.getByText('Создать статью');
      createButton.focus();
      expect(document.activeElement).toBe(createButton);

      // Test form field focus
      await fireEvent.click(createButton);

      const codeInput = screen.getByLabelText('Код статьи *');
      codeInput.focus();
      expect(document.activeElement).toBe(codeInput);
    });

    it('displays proper loading indicators', async () => {
      // Test loading state
      mockArticlesService.getAll.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(createMockApiResponse(mockArticles)), 100))
      );

      render(ArticlesPage);

      expect(screen.getByText('Загрузка статей...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Загрузка статей...')).not.toBeInTheDocument();
      });
    });

    it('shows appropriate empty states with helpful messaging', async () => {
      mockArticlesService.getAll.mockResolvedValue(createMockApiResponse([]));
      mockArticlesService.getStats.mockResolvedValue(createMockApiResponse({
        total: 0, active: 0, inactive: 0, shared: 0, user_specific: 0
      }));

      render(ArticlesPage);
      await waitForAsync();

      expect(screen.getByText('Статьи не найдены')).toBeInTheDocument();
      expect(screen.getByText('Создайте первую статью')).toBeInTheDocument();
    });
  });

  describe('Error Recovery', () => {
    it('recovers from network errors', async () => {
      // Start with network error
      mockArticlesService.getAll.mockRejectedValueOnce(new Error('Network error'));

      render(ArticlesPage);
      await waitForAsync();

      expect(screen.getByText('Ошибка загрузки')).toBeInTheDocument();

      // Fix the network and retry
      mockArticlesService.getAll.mockResolvedValueOnce(createMockApiResponse(mockArticles));

      const retryButton = screen.getByText('Попробовать снова');
      await fireEvent.click(retryButton);
      await waitForAsync();

      expect(screen.getByText('Питание')).toBeInTheDocument();
      expect(screen.queryByText('Ошибка загрузки')).not.toBeInTheDocument();
    });

    it('handles partial failures gracefully', async () => {
      // Stats loading fails but articles load successfully
      mockArticlesService.getStats.mockRejectedValue(new Error('Stats error'));

      render(ArticlesPage);
      await waitForAsync();

      // Articles should still be displayed
      expect(screen.getByText('Питание')).toBeInTheDocument();

      // Stats might show default values or error state
      // The component should not crash
      expect(screen.getByText('Управление статьями')).toBeInTheDocument();
    });
  });
});
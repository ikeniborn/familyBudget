/**
 * Frontend tests for articles settings component.
 * Tests UI behavior, form handling, error processing, admin permissions, and shared articles.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import ArticlesPage from '../../frontend-svelte/src/routes/(protected)/settings/articles/+page.svelte';
import * as api from '../../frontend-svelte/src/lib/services/api';
import { createMockApiResponse, createMockAxiosResponse, waitForAsync } from '../../frontend-svelte/src/test/utils';
import { isAdmin } from '../../frontend-svelte/src/lib/stores/auth.store';

// Mock the API module
vi.mock('../../frontend-svelte/src/lib/services/api', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

// Mock articles service
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
  isAdmin: { subscribe: vi.fn() }
}));

// Mock toast notifications
vi.mock('../../frontend-svelte/src/lib/stores/toast.store', () => ({
  toastStore: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  })
}));

describe('Articles Settings Component', () => {
  const mockApiGet = api.get as Mock;
  const mockApiPost = api.post as Mock;
  const mockApiPut = api.put as Mock;
  const mockApiDelete = api.delete as Mock;

  const mockArticles = [
    {
      article_id: 1,
      article_code: 'ART001',
      article_name: 'Test Article 1',
      description: 'Test description 1',
      is_active: true,
      user_id: 1,
      created_by: 1,
      managed_by: 1,
      is_shared: false,
      is_editable: true,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z'
    },
    {
      article_id: 2,
      article_code: 'SHARED001',
      article_name: 'Shared Article',
      description: 'Shared description',
      is_active: true,
      user_id: null,
      created_by: 1,
      managed_by: 1,
      is_shared: true,
      is_editable: false,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z'
    },
    {
      article_id: 3,
      article_code: 'ART003',
      article_name: 'Inactive Article',
      description: 'Inactive description',
      is_active: false,
      user_id: 1,
      created_by: 1,
      managed_by: 1,
      is_shared: false,
      is_editable: true,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z'
    }
  ];

  const mockStats = {
    total: 3,
    active: 2,
    inactive: 1,
    shared: 1,
    user_specific: 2
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful API responses by default
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/articles/stats')) {
        return Promise.resolve(createMockAxiosResponse({ success: true, data: mockStats }));
      }
      if (url.includes('/articles/')) {
        return Promise.resolve(createMockAxiosResponse({ success: true, data: mockArticles, total: mockArticles.length }));
      }
      return Promise.resolve(createMockAxiosResponse({ success: true, data: [] }));
    });

    // Mock auth store subscription
    const mockIsAdmin = isAdmin as any;
    mockIsAdmin.subscribe = vi.fn((callback: (value: boolean) => void) => {
      callback(false); // Default to non-admin
      return () => {}; // Unsubscribe function
    });
  });

  describe('Component Initialization', () => {
    it('should render articles page with loading state', async () => {
      render(ArticlesPage);

      expect(screen.getByText('Управление статьями')).toBeInTheDocument();
      expect(screen.getByText('Загрузка...')).toBeInTheDocument();
    });

    it('should load articles data on mount', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/articles/');
        expect(mockApiGet).toHaveBeenCalledWith('/articles/stats');
      });
    });

    it('should display error state when loading fails', async () => {
      mockApiGet.mockRejectedValueOnce(new Error('Network error'));

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText(/Ошибка загрузки/)).toBeInTheDocument();
      });
    });
  });

  describe('Statistics Cards', () => {
    it('should display statistics cards with correct data', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Всего статей')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument(); // Total
        expect(screen.getByText('Активные статьи')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // Active
        expect(screen.getByText('Неактивные статьи')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument(); // Inactive
        expect(screen.getByText('Общие статьи')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument(); // Shared
        expect(screen.getByText('Пользовательские статьи')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // User specific
      });
    });

    it('should handle zero statistics gracefully', async () => {
      const emptyStats = { total: 0, active: 0, inactive: 0, shared: 0, user_specific: 0 };
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/articles/stats')) {
          return Promise.resolve(createMockAxiosResponse({ success: true, data: emptyStats }));
        }
        return Promise.resolve(createMockAxiosResponse({ success: true, data: [], total: 0 }));
      });

      render(ArticlesPage);

      await waitFor(() => {
        const zeroElements = screen.getAllByText('0');
        expect(zeroElements.length).toBeGreaterThanOrEqual(5); // All stats should be 0
      });
    });
  });

  describe('Articles Table', () => {
    it('should display articles in table format', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument();
        expect(screen.getByText('ART001')).toBeInTheDocument();
        expect(screen.getByText('Shared Article')).toBeInTheDocument();
        expect(screen.getByText('SHARED001')).toBeInTheDocument();
        expect(screen.getByText('Inactive Article')).toBeInTheDocument();
        expect(screen.getByText('ART003')).toBeInTheDocument();
      });
    });

    it('should show shared article badges correctly', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Общая')).toBeInTheDocument(); // Shared badge
      });
    });

    it('should show active/inactive status badges', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getAllByText('Активная')).toHaveLength(2); // Two active articles
        expect(screen.getByText('Неактивная')).toBeInTheDocument(); // One inactive article
      });
    });

    it('should handle empty articles list', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/articles/stats')) {
          return Promise.resolve(createMockAxiosResponse({ success: true, data: { total: 0, active: 0, inactive: 0, shared: 0, user_specific: 0 } }));
        }
        return Promise.resolve(createMockAxiosResponse({ success: true, data: [], total: 0 }));
      });

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Статьи не найдены')).toBeInTheDocument();
      });
    });
  });

  describe('Create Article Modal', () => {
    it('should open create modal when add button is clicked', async () => {
      const user = userEvent.setup();
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Добавить статью')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Добавить статью');
      await user.click(addButton);

      expect(screen.getByText('Создание статьи')).toBeInTheDocument();
      expect(screen.getByLabelText('Код статьи')).toBeInTheDocument();
      expect(screen.getByLabelText('Название статьи')).toBeInTheDocument();
      expect(screen.getByLabelText('Описание')).toBeInTheDocument();
    });

    it('should create new article successfully', async () => {
      const user = userEvent.setup();
      const newArticle = {
        article_id: 4,
        article_code: 'NEW001',
        article_name: 'New Article',
        description: 'New description',
        is_active: true,
        user_id: 1,
        created_by: 1,
        managed_by: 1,
        is_shared: false,
        is_editable: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      };

      mockApiPost.mockResolvedValueOnce(createMockAxiosResponse({ success: true, data: newArticle }));

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Добавить статью')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Добавить статью');
      await user.click(addButton);

      // Fill form
      await user.type(screen.getByLabelText('Код статьи'), 'NEW001');
      await user.type(screen.getByLabelText('Название статьи'), 'New Article');
      await user.type(screen.getByLabelText('Описание'), 'New description');

      // Submit form
      const saveButton = screen.getByText('Сохранить');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/articles/', expect.objectContaining({
          code: 'NEW001',
          name: 'New Article',
          description: 'New description',
          is_active: true
        }));
      });
    });

    it('should handle duplicate code error (409)', async () => {
      const user = userEvent.setup();
      mockApiPost.mockRejectedValueOnce({
        response: {
          status: 409,
          data: { success: false, error: "Article with code 'DUP001' already exists" }
        }
      });

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Добавить статью')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Добавить статью');
      await user.click(addButton);

      // Fill form with duplicate code
      await user.type(screen.getByLabelText('Код статьи'), 'DUP001');
      await user.type(screen.getByLabelText('Название статьи'), 'Duplicate Article');

      // Submit form
      const saveButton = screen.getByText('Сохранить');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/статья с кодом.*уже существует/i)).toBeInTheDocument();
      });
    });

    it('should validate required fields', async () => {
      const user = userEvent.setup();
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Добавить статью')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Добавить статью');
      await user.click(addButton);

      // Try to submit without filling required fields
      const saveButton = screen.getByText('Сохранить');
      await user.click(saveButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText('Код статьи обязателен')).toBeInTheDocument();
        expect(screen.getByText('Название статьи обязательно')).toBeInTheDocument();
      });
    });
  });

  describe('Edit Article Modal', () => {
    it('should open edit modal with pre-filled data', async () => {
      const user = userEvent.setup();
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument();
      });

      // Find and click edit button for first article
      const editButtons = screen.getAllByRole('button', { name: /редактировать/i });
      await user.click(editButtons[0]);

      expect(screen.getByText('Редактирование статьи')).toBeInTheDocument();
      expect(screen.getByDisplayValue('ART001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Article 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test description 1')).toBeInTheDocument();
    });

    it('should update article successfully', async () => {
      const user = userEvent.setup();
      const updatedArticle = { ...mockArticles[0], article_name: 'Updated Article' };

      mockApiPut.mockResolvedValueOnce(createMockAxiosResponse({ success: true, data: updatedArticle }));

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /редактировать/i });
      await user.click(editButtons[0]);

      // Update name
      const nameInput = screen.getByDisplayValue('Test Article 1');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Article');

      // Submit form
      const saveButton = screen.getByText('Сохранить');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockApiPut).toHaveBeenCalledWith('/articles/1', expect.objectContaining({
          name: 'Updated Article'
        }));
      });
    });

    it('should not allow editing shared articles for non-admin users', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Shared Article')).toBeInTheDocument();
      });

      // Shared article should not have edit button for regular users
      const editButtons = screen.getAllByRole('button', { name: /редактировать/i });
      // Should only have edit buttons for user's own articles (not shared ones)
      expect(editButtons).toHaveLength(2); // Only for user articles, not shared
    });
  });

  describe('Delete Article', () => {
    it('should open delete confirmation modal', async () => {
      const user = userEvent.setup();
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument();
      });

      // Find and click delete button
      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
      await user.click(deleteButtons[0]);

      expect(screen.getByText('Подтвердите удаление')).toBeInTheDocument();
      expect(screen.getByText(/Вы уверены, что хотите удалить статью/)).toBeInTheDocument();
    });

    it('should delete article successfully', async () => {
      const user = userEvent.setup();
      mockApiDelete.mockResolvedValueOnce(createMockAxiosResponse({ success: true, data: { message: 'Article deleted successfully' } }));

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument();
      });

      // Open delete modal
      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
      await user.click(deleteButtons[0]);

      // Confirm deletion
      const confirmButton = screen.getByText('Удалить');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockApiDelete).toHaveBeenCalledWith('/articles/1');
      });
    });

    it('should handle delete error gracefully', async () => {
      const user = userEvent.setup();
      mockApiDelete.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { success: false, error: 'Cannot delete article with associated nomenclatures' }
        }
      });

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument();
      });

      // Open delete modal
      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
      await user.click(deleteButtons[0]);

      // Confirm deletion
      const confirmButton = screen.getByText('Удалить');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Cannot delete article with associated nomenclatures/)).toBeInTheDocument();
      });
    });
  });

  describe('Bulk Delete Articles', () => {
    it('should show bulk delete button when articles are selected', async () => {
      const user = userEvent.setup();
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument();
      });

      // Select articles using checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]); // Select first article
      await user.click(checkboxes[1]); // Select second article

      expect(screen.getByText('Удалить выбранные (2)')).toBeInTheDocument();
    });

    it('should perform bulk delete successfully', async () => {
      const user = userEvent.setup();
      mockApiPost.mockResolvedValueOnce(createMockAxiosResponse({
        success: true,
        data: { message: 'Successfully deleted 2 articles', deleted_count: 2 }
      }));

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument();
      });

      // Select articles
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      // Click bulk delete
      const bulkDeleteButton = screen.getByText('Удалить выбранные (2)');
      await user.click(bulkDeleteButton);

      // Confirm bulk deletion
      const confirmButton = screen.getByText('Удалить выбранные');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/articles/bulk-delete', {
          article_ids: [1, 3] // Based on mockArticles data
        });
      });
    });
  });

  describe('Admin Features', () => {
    beforeEach(() => {
      // Mock admin user
      const mockIsAdmin = isAdmin as any;
      mockIsAdmin.subscribe = vi.fn((callback: (value: boolean) => void) => {
        callback(true); // Set as admin
        return () => {};
      });
    });

    it('should show shared article creation option for admin', async () => {
      const user = userEvent.setup();
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Добавить статью')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Добавить статью');
      await user.click(addButton);

      expect(screen.getByLabelText('Общая статья')).toBeInTheDocument();
    });

    it('should allow admin to create shared articles', async () => {
      const user = userEvent.setup();
      const sharedArticle = {
        article_id: 5,
        article_code: 'ADMIN001',
        article_name: 'Admin Shared Article',
        description: 'Admin created shared article',
        is_active: true,
        user_id: null,
        created_by: 1,
        managed_by: 1,
        is_shared: true,
        is_editable: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      };

      mockApiPost.mockResolvedValueOnce(createMockAxiosResponse({ success: true, data: sharedArticle }));

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Добавить статью')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Добавить статью');
      await user.click(addButton);

      // Fill form as shared article
      await user.type(screen.getByLabelText('Код статьи'), 'ADMIN001');
      await user.type(screen.getByLabelText('Название статьи'), 'Admin Shared Article');
      await user.type(screen.getByLabelText('Описание'), 'Admin created shared article');
      await user.click(screen.getByLabelText('Общая статья'));

      // Submit form
      const saveButton = screen.getByText('Сохранить');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/articles/', expect.objectContaining({
          code: 'ADMIN001',
          name: 'Admin Shared Article',
          description: 'Admin created shared article',
          user_id: null, // Shared article
          is_active: true
        }));
      });
    });

    it('should allow admin to edit shared articles', async () => {
      const user = userEvent.setup();
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Shared Article')).toBeInTheDocument();
      });

      // Admin should see edit button for shared articles
      const editButtons = screen.getAllByRole('button', { name: /редактировать/i });
      expect(editButtons).toHaveLength(3); // All articles including shared ones
    });
  });

  describe('Search and Filtering', () => {
    it('should filter articles by search term', async () => {
      const user = userEvent.setup();
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument();
        expect(screen.getByText('Shared Article')).toBeInTheDocument();
        expect(screen.getByText('Inactive Article')).toBeInTheDocument();
      });

      // Search for "Test"
      const searchInput = screen.getByPlaceholderText('Поиск статей...');
      await user.type(searchInput, 'Test');

      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument();
        expect(screen.queryByText('Shared Article')).not.toBeInTheDocument();
      });
    });

    it('should filter articles by active status', async () => {
      const user = userEvent.setup();
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument();
        expect(screen.getByText('Inactive Article')).toBeInTheDocument();
      });

      // Filter by active status
      const activeFilter = screen.getByLabelText('Только активные');
      await user.click(activeFilter);

      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument();
        expect(screen.queryByText('Inactive Article')).not.toBeInTheDocument();
      });
    });

    it('should show no results message when search yields no matches', async () => {
      const user = userEvent.setup();
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument();
      });

      // Search for non-existent article
      const searchInput = screen.getByPlaceholderText('Поиск статей...');
      await user.type(searchInput, 'NonExistentArticle');

      await waitFor(() => {
        expect(screen.getByText('Статьи не найдены')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API call fails', async () => {
      mockApiGet.mockRejectedValueOnce(new Error('Network error'));

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText(/Ошибка загрузки данных/)).toBeInTheDocument();
      });
    });

    it('should handle server errors gracefully', async () => {
      mockApiGet.mockRejectedValueOnce({
        response: {
          status: 500,
          data: { success: false, error: 'Internal server error' }
        }
      });

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText(/Ошибка сервера/)).toBeInTheDocument();
      });
    });

    it('should retry loading data after error', async () => {
      const user = userEvent.setup();
      mockApiGet.mockRejectedValueOnce(new Error('Network error'));

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText(/Ошибка загрузки данных/)).toBeInTheDocument();
      });

      // Reset mock to return successful response
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/articles/stats')) {
          return Promise.resolve(createMockAxiosResponse({ success: true, data: mockStats }));
        }
        if (url.includes('/articles/')) {
          return Promise.resolve(createMockAxiosResponse({ success: true, data: mockArticles, total: mockArticles.length }));
        }
        return Promise.resolve(createMockAxiosResponse({ success: true, data: [] }));
      });

      // Click retry button
      const retryButton = screen.getByText('Повторить');
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile view', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument();
      });

      // Mobile-specific elements should be present
      expect(screen.getByRole('main')).toHaveClass('mobile-optimized'); // Assuming this class exists
    });
  });
});
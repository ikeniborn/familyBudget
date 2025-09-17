/**
 * Articles Page Button Integration Tests
 * Integration tests for button interactions after the onclick to on:click fix
 *
 * @file articles-button-integration.test.ts
 * @author Claude Code Test Engineer
 * @date 2025-09-17
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import ArticlesPage from '$routes/(protected)/settings/articles/+page.svelte';
import type { Article, ArticleStats } from '$lib/types';

// Mock dependencies
vi.mock('$lib/stores/device.store', () => ({
  isTouch: {
    subscribe: vi.fn((callback) => {
      callback(false);
      return { unsubscribe: vi.fn() };
    })
  }
}));

vi.mock('$lib/stores/auth.store', () => ({
  isAdmin: {
    subscribe: vi.fn((callback) => {
      callback(true);
      return { unsubscribe: vi.fn() };
    })
  }
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn()
};

vi.mock('$lib/stores/toast.store', () => ({
  useToast: () => mockToast
}));

// Mock articles service
const mockArticlesService = {
  getAll: vi.fn(),
  getStats: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
};

vi.mock('$lib/services/articles.service', () => ({
  articlesService: mockArticlesService
}));

describe('Articles Page Button Integration', () => {
  const mockArticles: Article[] = [
    {
      id: 1,
      code: 'FOOD',
      name: 'Питание',
      description: 'Расходы на питание',
      is_active: true,
      is_shared: false,
      is_editable: true,
      user_id: 1,
      created_at: '2025-09-17T10:00:00Z',
      updated_at: '2025-09-17T10:00:00Z'
    },
    {
      id: 2,
      code: 'TRANSPORT',
      name: 'Транспорт',
      description: 'Транспортные расходы',
      is_active: true,
      is_shared: true,
      is_editable: true,
      user_id: 1,
      created_at: '2025-09-17T10:00:00Z',
      updated_at: '2025-09-17T10:00:00Z'
    },
    {
      id: 3,
      code: 'READONLY',
      name: 'Только чтение',
      description: 'Неизменяемая статья',
      is_active: false,
      is_shared: false,
      is_editable: false,
      user_id: 1,
      created_at: '2025-09-17T10:00:00Z',
      updated_at: '2025-09-17T10:00:00Z'
    }
  ];

  const mockStats: ArticleStats = {
    total: 3,
    active: 2,
    inactive: 1,
    shared: 1,
    user_specific: 2
  };

  beforeEach(() => {
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
      data: { id: 4, ...mockArticles[0] }
    });

    mockArticlesService.update.mockResolvedValue({
      success: true,
      data: mockArticles[0]
    });

    mockArticlesService.delete.mockResolvedValue({
      success: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Primary Action Button Integration', () => {
    it('integrates create button with modal workflow', async () => {
      render(ArticlesPage);

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /создать статью/i })).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /создать статью/i });

      // Step 1: Click create button
      await fireEvent.click(createButton);

      // Step 2: Verify modal opens
      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });

      // Step 3: Fill form
      const codeInput = screen.getByLabelText(/код статьи/i);
      const nameInput = screen.getByLabelText(/название/i);
      const descriptionInput = screen.getByLabelText(/описание/i);

      await fireEvent.input(codeInput, { target: { value: 'INTEGRATION' } });
      await fireEvent.input(nameInput, { target: { value: 'Интеграционный тест' } });
      await fireEvent.input(descriptionInput, { target: { value: 'Тестовое описание' } });

      // Step 4: Submit form
      const submitButton = screen.getByRole('button', { name: /^создать$/i });
      await fireEvent.click(submitButton);

      // Step 5: Verify API call
      await waitFor(() => {
        expect(mockArticlesService.create).toHaveBeenCalledWith({
          code: 'INTEGRATION',
          name: 'Интеграционный тест',
          description: 'Тестовое описание',
          is_active: true,
          user_id: null
        });
      });

      // Step 6: Verify success toast
      expect(mockToast.success).toHaveBeenCalledWith(
        'Article "Интеграционный тест" created successfully'
      );

      // Step 7: Verify modal closes and data reloads
      await waitFor(() => {
        expect(screen.queryByText('Создать статью')).not.toBeInTheDocument();
        expect(mockArticlesService.getAll).toHaveBeenCalledTimes(2); // Initial load + reload
      });
    });

    it('handles create button error workflow', async () => {
      // Mock API error
      mockArticlesService.create.mockRejectedValueOnce(new Error('Create failed'));

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /создать статью/i })).toBeInTheDocument();
      });

      // Open modal and submit
      const createButton = screen.getByRole('button', { name: /создать статью/i });
      await fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });

      const codeInput = screen.getByLabelText(/код статьи/i);
      const nameInput = screen.getByLabelText(/название/i);

      await fireEvent.input(codeInput, { target: { value: 'FAIL' } });
      await fireEvent.input(nameInput, { target: { value: 'Failed Article' } });

      const submitButton = screen.getByRole('button', { name: /^создать$/i });
      await fireEvent.click(submitButton);

      // Verify error handling
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Failed to create article: Create failed'
        );
      });

      // Modal should remain open for retry
      expect(screen.getByText('Создать статью')).toBeInTheDocument();
    });

    it('handles empty state create button workflow', async () => {
      // Mock empty articles response
      mockArticlesService.getAll.mockResolvedValue({
        success: true,
        data: [],
        total: 0
      });

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText(/статьи не найдены/i)).toBeInTheDocument();
      });

      // Find create button in empty state
      const createButtons = screen.getAllByRole('button', { name: /создать статью/i });
      expect(createButtons.length).toBeGreaterThan(0);

      // Click empty state create button
      await fireEvent.click(createButtons[createButtons.length - 1]);

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });
    });
  });

  describe('Row Action Button Integration', () => {
    it('integrates edit button with modal workflow', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /изменить/i });
        expect(editButtons.length).toBeGreaterThan(0);
      });

      // Step 1: Click edit button for first editable article
      const editButtons = screen.getAllByRole('button', { name: /изменить/i });
      await fireEvent.click(editButtons[0]);

      // Step 2: Verify edit modal opens with pre-filled data
      await waitFor(() => {
        expect(screen.getByText('Редактировать статью')).toBeInTheDocument();
        expect(screen.getByDisplayValue('FOOD')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Питание')).toBeInTheDocument();
      });

      // Step 3: Modify data
      const nameInput = screen.getByDisplayValue('Питание');
      await fireEvent.input(nameInput, { target: { value: 'Обновленное питание' } });

      // Step 4: Save changes
      const saveButton = screen.getByRole('button', { name: /сохранить/i });
      await fireEvent.click(saveButton);

      // Step 5: Verify API call
      await waitFor(() => {
        expect(mockArticlesService.update).toHaveBeenCalledWith(1, {
          code: 'FOOD',
          name: 'Обновленное питание',
          description: 'Расходы на питание',
          is_active: true
        });
      });

      // Step 6: Verify success workflow
      expect(mockToast.success).toHaveBeenCalledWith(
        'Article "Обновленное питание" updated successfully'
      );

      await waitFor(() => {
        expect(screen.queryByText('Редактировать статью')).not.toBeInTheDocument();
        expect(mockArticlesService.getAll).toHaveBeenCalledTimes(2);
      });
    });

    it('integrates delete button with confirmation workflow', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
        expect(deleteButtons.length).toBeGreaterThan(0);
      });

      // Step 1: Click delete button
      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
      await fireEvent.click(deleteButtons[0]);

      // Step 2: Verify confirmation modal
      await waitFor(() => {
        expect(screen.getByText('Удалить статью')).toBeInTheDocument();
        expect(screen.getByText(/вы уверены/i)).toBeInTheDocument();
        expect(screen.getByText('"Питание"')).toBeInTheDocument();
      });

      // Step 3: Confirm deletion
      const confirmDeleteButton = screen.getByRole('button', { name: /^удалить$/i });
      await fireEvent.click(confirmDeleteButton);

      // Step 4: Verify API call and success workflow
      await waitFor(() => {
        expect(mockArticlesService.delete).toHaveBeenCalledWith(1);
      });

      expect(mockToast.success).toHaveBeenCalledWith(
        'Article "Питание" deleted successfully'
      );

      await waitFor(() => {
        expect(screen.queryByText('Удалить статью')).not.toBeInTheDocument();
        expect(mockArticlesService.getAll).toHaveBeenCalledTimes(2);
      });
    });

    it('does not show action buttons for non-editable articles', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('READONLY')).toBeInTheDocument();
      });

      // Find the readonly article row
      const readonlyRow = screen.getByText('READONLY').closest('tr');
      expect(readonlyRow).toBeInTheDocument();

      // Verify no action buttons in this row
      const editButtons = readonlyRow?.querySelectorAll('button');
      expect(editButtons).toHaveLength(0);
    });
  });

  describe('Modal Cancel Button Integration', () => {
    it('integrates create modal cancel button', async () => {
      render(ArticlesPage);

      // Open create modal
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /создать статью/i });
        expect(createButton).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /создать статью/i });
      await fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });

      // Fill some data
      const codeInput = screen.getByLabelText(/код статьи/i);
      await fireEvent.input(codeInput, { target: { value: 'TEMP' } });

      // Cancel should close modal without saving
      const cancelButton = screen.getByRole('button', { name: /отмена/i });
      await fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Создать статью')).not.toBeInTheDocument();
      });

      // Should not have called create API
      expect(mockArticlesService.create).not.toHaveBeenCalled();
    });

    it('integrates edit modal cancel button', async () => {
      render(ArticlesPage);

      // Open edit modal
      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /изменить/i });
        expect(editButtons.length).toBeGreaterThan(0);
      });

      const editButtons = screen.getAllByRole('button', { name: /изменить/i });
      await fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Редактировать статью')).toBeInTheDocument();
      });

      // Modify data
      const nameInput = screen.getByDisplayValue('Питание');
      await fireEvent.input(nameInput, { target: { value: 'Измененное название' } });

      // Cancel should discard changes
      const cancelButton = screen.getByRole('button', { name: /отмена/i });
      await fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Редактировать статью')).not.toBeInTheDocument();
      });

      // Should not have called update API
      expect(mockArticlesService.update).not.toHaveBeenCalled();
    });

    it('integrates delete modal cancel button', async () => {
      render(ArticlesPage);

      // Open delete modal
      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
        expect(deleteButtons.length).toBeGreaterThan(0);
      });

      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
      await fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Удалить статью')).toBeInTheDocument();
      });

      // Cancel should prevent deletion
      const cancelButton = screen.getByRole('button', { name: /отмена/i });
      await fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Удалить статью')).not.toBeInTheDocument();
      });

      // Should not have called delete API
      expect(mockArticlesService.delete).not.toHaveBeenCalled();
    });
  });

  describe('Error State Button Integration', () => {
    it('integrates retry button with error recovery', async () => {
      // Mock initial failure
      mockArticlesService.getAll.mockRejectedValueOnce(new Error('Network error'));

      render(ArticlesPage);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText(/ошибка загрузки/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /попробовать снова/i });
      expect(retryButton).toBeInTheDocument();

      // Mock successful retry
      mockArticlesService.getAll.mockResolvedValueOnce({
        success: true,
        data: mockArticles,
        total: mockArticles.length
      });

      // Click retry
      await fireEvent.click(retryButton);

      // Verify recovery
      await waitFor(() => {
        expect(mockArticlesService.getAll).toHaveBeenCalledTimes(2);
        expect(screen.queryByText(/ошибка загрузки/i)).not.toBeInTheDocument();
        expect(screen.getByText('FOOD')).toBeInTheDocument();
      });
    });

    it('handles persistent errors with retry button', async () => {
      // Mock persistent failure
      mockArticlesService.getAll.mockRejectedValue(new Error('Persistent error'));

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText(/ошибка загрузки/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /попробовать снова/i });

      // Multiple retry attempts
      await fireEvent.click(retryButton);
      await fireEvent.click(retryButton);
      await fireEvent.click(retryButton);

      // Should still show error state
      await waitFor(() => {
        expect(screen.getByText(/ошибка загрузки/i)).toBeInTheDocument();
        expect(mockArticlesService.getAll).toHaveBeenCalledTimes(4); // Initial + 3 retries
      });
    });
  });

  describe('Button State Management Integration', () => {
    it('manages button states during API operations', async () => {
      // Mock slow API response
      let resolveCreate: (value: any) => void;
      const createPromise = new Promise((resolve) => {
        resolveCreate = resolve;
      });
      mockArticlesService.create.mockReturnValue(createPromise);

      render(ArticlesPage);

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /создать статью/i });
        expect(createButton).toBeInTheDocument();
      });

      // Open modal and submit
      const createButton = screen.getByRole('button', { name: /создать статью/i });
      await fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });

      const codeInput = screen.getByLabelText(/код статьи/i);
      const nameInput = screen.getByLabelText(/название/i);

      await fireEvent.input(codeInput, { target: { value: 'SLOW' } });
      await fireEvent.input(nameInput, { target: { value: 'Медленный тест' } });

      const submitButton = screen.getByRole('button', { name: /^создать$/i });
      await fireEvent.click(submitButton);

      // Button should be in loading state (implementation dependent)
      // Resolve the API call
      resolveCreate!({
        success: true,
        data: { id: 4, code: 'SLOW', name: 'Медленный тест' }
      });

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalled();
      });
    });

    it('handles rapid button clicking gracefully', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /создать статью/i });
        expect(createButton).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /создать статью/i });

      // Rapid clicks should only open one modal
      await fireEvent.click(createButton);
      await fireEvent.click(createButton);
      await fireEvent.click(createButton);

      await waitFor(() => {
        const modalTitles = screen.getAllByText('Создать статью');
        expect(modalTitles).toHaveLength(1);
      });
    });
  });

  describe('Cross-Button Workflow Integration', () => {
    it('integrates full CRUD workflow through buttons', async () => {
      render(ArticlesPage);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('FOOD')).toBeInTheDocument();
      });

      // 1. Create new article
      const createButton = screen.getByRole('button', { name: /создать статью/i });
      await fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });

      const codeInput = screen.getByLabelText(/код статьи/i);
      const nameInput = screen.getByLabelText(/название/i);

      await fireEvent.input(codeInput, { target: { value: 'WORKFLOW' } });
      await fireEvent.input(nameInput, { target: { value: 'Workflow Test' } });

      const createSubmitButton = screen.getByRole('button', { name: /^создать$/i });
      await fireEvent.click(createSubmitButton);

      await waitFor(() => {
        expect(mockArticlesService.create).toHaveBeenCalled();
        expect(screen.queryByText('Создать статью')).not.toBeInTheDocument();
      });

      // 2. Edit existing article
      const editButtons = screen.getAllByRole('button', { name: /изменить/i });
      await fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Редактировать статью')).toBeInTheDocument();
      });

      const editNameInput = screen.getByDisplayValue('Питание');
      await fireEvent.input(editNameInput, { target: { value: 'Измененное питание' } });

      const saveButton = screen.getByRole('button', { name: /сохранить/i });
      await fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockArticlesService.update).toHaveBeenCalled();
        expect(screen.queryByText('Редактировать статью')).not.toBeInTheDocument();
      });

      // 3. Delete article
      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
      await fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Удалить статью')).toBeInTheDocument();
      });

      const confirmDeleteButton = screen.getByRole('button', { name: /^удалить$/i });
      await fireEvent.click(confirmDeleteButton);

      await waitFor(() => {
        expect(mockArticlesService.delete).toHaveBeenCalled();
        expect(screen.queryByText('Удалить статью')).not.toBeInTheDocument();
      });

      // Verify all operations completed successfully
      expect(mockArticlesService.create).toHaveBeenCalledTimes(1);
      expect(mockArticlesService.update).toHaveBeenCalledTimes(1);
      expect(mockArticlesService.delete).toHaveBeenCalledTimes(1);
      expect(mockToast.success).toHaveBeenCalledTimes(3);
    });

    it('handles mixed success and error scenarios', async () => {
      // Mock mixed responses
      mockArticlesService.create.mockResolvedValueOnce({ success: true, data: {} });
      mockArticlesService.update.mockRejectedValueOnce(new Error('Update failed'));
      mockArticlesService.delete.mockResolvedValueOnce({ success: true });

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('FOOD')).toBeInTheDocument();
      });

      // 1. Successful create
      const createButton = screen.getByRole('button', { name: /создать статью/i });
      await fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });

      const codeInput = screen.getByLabelText(/код статьи/i);
      const nameInput = screen.getByLabelText(/название/i);

      await fireEvent.input(codeInput, { target: { value: 'SUCCESS' } });
      await fireEvent.input(nameInput, { target: { value: 'Success Test' } });

      const createSubmitButton = screen.getByRole('button', { name: /^создать$/i });
      await fireEvent.click(createSubmitButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Article "Success Test" created successfully');
      });

      // 2. Failed update
      const editButtons = screen.getAllByRole('button', { name: /изменить/i });
      await fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Редактировать статью')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /сохранить/i });
      await fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to update article: Update failed');
      });

      // 3. Successful delete (after canceling update)
      const cancelButton = screen.getByRole('button', { name: /отмена/i });
      await fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Редактировать статью')).not.toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
      await fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Удалить статью')).toBeInTheDocument();
      });

      const confirmDeleteButton = screen.getByRole('button', { name: /^удалить$/i });
      await fireEvent.click(confirmDeleteButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledTimes(2); // Create + Delete success
        expect(mockToast.error).toHaveBeenCalledTimes(1); // Update error
      });
    });
  });
});
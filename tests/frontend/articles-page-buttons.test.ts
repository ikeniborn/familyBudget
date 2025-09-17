/**
 * Articles Page Button Functionality Tests
 * Tests button interactions on the articles management page after the onclick fix
 *
 * @file articles-page-buttons.test.ts
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
      callback(true); // Mock admin user
      return { unsubscribe: vi.fn() };
    })
  }
}));

vi.mock('$lib/stores/toast.store', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  })
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

describe('Articles Page Button Functionality', () => {
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
      code: 'HOUSE',
      name: 'Жилье',
      description: 'Расходы на жилье',
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

    // Setup default mock responses
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

  describe('Main Action Buttons', () => {
    it('renders create article button correctly', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /создать статью/i });
        expect(createButton).toBeInTheDocument();
        expect(createButton).not.toBeDisabled();
      });
    });

    it('create button opens modal when clicked', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /создать статью/i });
        expect(createButton).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /создать статью/i });
      await fireEvent.click(createButton);

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });
    });

    it('retry button works when there is an error', async () => {
      // Mock API error
      mockArticlesService.getAll.mockRejectedValueOnce(new Error('API Error'));

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText(/ошибка загрузки/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /попробовать снова/i });
      expect(retryButton).toBeInTheDocument();

      // Reset mock to success
      mockArticlesService.getAll.mockResolvedValue({
        success: true,
        data: mockArticles,
        total: mockArticles.length
      });

      await fireEvent.click(retryButton);

      // Should reload articles
      await waitFor(() => {
        expect(mockArticlesService.getAll).toHaveBeenCalledTimes(2);
      });
    });

    it('create button in empty state works', async () => {
      // Mock empty articles
      mockArticlesService.getAll.mockResolvedValue({
        success: true,
        data: [],
        total: 0
      });

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText(/статьи не найдены/i)).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /создать статью/i });
      await fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });
    });
  });

  describe('Table Action Buttons', () => {
    it('renders edit buttons for editable articles', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /изменить/i });
        // Should have edit buttons for editable articles (FOOD and TRANSPORT)
        expect(editButtons).toHaveLength(2);
      });
    });

    it('renders delete buttons for deletable articles', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
        // Should have delete buttons for editable articles (FOOD and TRANSPORT)
        expect(deleteButtons).toHaveLength(2);
      });
    });

    it('edit button opens edit modal with correct data', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /изменить/i });
        expect(editButtons[0]).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /изменить/i });
      await fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Редактировать статью')).toBeInTheDocument();
        // Should pre-populate with article data
        expect(screen.getByDisplayValue('FOOD')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Питание')).toBeInTheDocument();
      });
    });

    it('delete button opens delete confirmation modal', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
        expect(deleteButtons[0]).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
      await fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Удалить статью')).toBeInTheDocument();
        expect(screen.getByText(/вы уверены/i)).toBeInTheDocument();
      });
    });

    it('does not render action buttons for non-editable articles', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        // Wait for articles to load
        expect(screen.getByText('HOUSE')).toBeInTheDocument();
      });

      // Find the row with HOUSE article
      const houseRow = screen.getByText('HOUSE').closest('tr');
      expect(houseRow).toBeInTheDocument();

      // Should not have edit/delete buttons in this row
      const editButtonsInRow = houseRow?.querySelectorAll('button[aria-label*="изменить"], button:has(.lucide-edit)');
      const deleteButtonsInRow = houseRow?.querySelectorAll('button[aria-label*="удалить"], button:has(.lucide-trash-2)');

      expect(editButtonsInRow).toHaveLength(0);
      expect(deleteButtonsInRow).toHaveLength(0);
    });
  });

  describe('Modal Buttons', () => {
    describe('Create Modal Buttons', () => {
      beforeEach(async () => {
        render(ArticlesPage);

        await waitFor(() => {
          const createButton = screen.getByRole('button', { name: /создать статью/i });
          expect(createButton).toBeInTheDocument();
        });

        const createButton = screen.getByRole('button', { name: /создать статью/i });
        await fireEvent.click(createButton);

        await waitFor(() => {
          expect(screen.getByText('Создать статью')).toBeInTheDocument();
        });
      });

      it('cancel button closes create modal', async () => {
        const cancelButton = screen.getByRole('button', { name: /отмена/i });
        expect(cancelButton).toBeInTheDocument();

        await fireEvent.click(cancelButton);

        await waitFor(() => {
          expect(screen.queryByText('Создать статью')).not.toBeInTheDocument();
        });
      });

      it('create button submits form and closes modal', async () => {
        // Fill form
        const codeInput = screen.getByLabelText(/код статьи/i);
        const nameInput = screen.getByLabelText(/название/i);
        const descriptionInput = screen.getByLabelText(/описание/i);

        await fireEvent.input(codeInput, { target: { value: 'TEST' } });
        await fireEvent.input(nameInput, { target: { value: 'Тестовая статья' } });
        await fireEvent.input(descriptionInput, { target: { value: 'Описание тестовой статьи' } });

        const submitButton = screen.getByRole('button', { name: /^создать$/i });
        await fireEvent.click(submitButton);

        await waitFor(() => {
          expect(mockArticlesService.create).toHaveBeenCalledWith({
            code: 'TEST',
            name: 'Тестовая статья',
            description: 'Описание тестовой статьи',
            is_active: true,
            user_id: null
          });
        });

        await waitFor(() => {
          expect(screen.queryByText('Создать статью')).not.toBeInTheDocument();
        });
      });
    });

    describe('Edit Modal Buttons', () => {
      beforeEach(async () => {
        render(ArticlesPage);

        await waitFor(() => {
          const editButtons = screen.getAllByRole('button', { name: /изменить/i });
          expect(editButtons[0]).toBeInTheDocument();
        });

        const editButtons = screen.getAllByRole('button', { name: /изменить/i });
        await fireEvent.click(editButtons[0]);

        await waitFor(() => {
          expect(screen.getByText('Редактировать статью')).toBeInTheDocument();
        });
      });

      it('cancel button closes edit modal', async () => {
        const cancelButton = screen.getByRole('button', { name: /отмена/i });
        expect(cancelButton).toBeInTheDocument();

        await fireEvent.click(cancelButton);

        await waitFor(() => {
          expect(screen.queryByText('Редактировать статью')).not.toBeInTheDocument();
        });
      });

      it('save button submits changes and closes modal', async () => {
        const nameInput = screen.getByDisplayValue('Питание');
        await fireEvent.input(nameInput, { target: { value: 'Обновленное питание' } });

        const saveButton = screen.getByRole('button', { name: /сохранить/i });
        await fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockArticlesService.update).toHaveBeenCalledWith(1, {
            code: 'FOOD',
            name: 'Обновленное питание',
            description: 'Расходы на питание',
            is_active: true
          });
        });

        await waitFor(() => {
          expect(screen.queryByText('Редактировать статью')).not.toBeInTheDocument();
        });
      });
    });

    describe('Delete Modal Buttons', () => {
      beforeEach(async () => {
        render(ArticlesPage);

        await waitFor(() => {
          const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
          expect(deleteButtons[0]).toBeInTheDocument();
        });

        const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
        await fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
          expect(screen.getByText('Удалить статью')).toBeInTheDocument();
        });
      });

      it('cancel button closes delete modal', async () => {
        const cancelButton = screen.getByRole('button', { name: /отмена/i });
        expect(cancelButton).toBeInTheDocument();

        await fireEvent.click(cancelButton);

        await waitFor(() => {
          expect(screen.queryByText('Удалить статью')).not.toBeInTheDocument();
        });
      });

      it('delete button confirms deletion and closes modal', async () => {
        const deleteButton = screen.getByRole('button', { name: /^удалить$/i });
        expect(deleteButton).toBeInTheDocument();

        await fireEvent.click(deleteButton);

        await waitFor(() => {
          expect(mockArticlesService.delete).toHaveBeenCalledWith(1);
        });

        await waitFor(() => {
          expect(screen.queryByText('Удалить статью')).not.toBeInTheDocument();
        });
      });
    });
  });

  describe('Button Event System Validation', () => {
    it('all buttons use proper Svelte event dispatch system', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /создать статью/i })).toBeInTheDocument();
      });

      // Get all buttons on the page
      const allButtons = screen.getAllByRole('button');

      // Each button should not have onclick attribute (regression test)
      allButtons.forEach(button => {
        expect(button).not.toHaveAttribute('onclick');
      });

      // Verify buttons are clickable through Svelte event system
      const createButton = screen.getByRole('button', { name: /создать статью/i });
      await fireEvent.click(createButton);

      // Should open modal, proving event system works
      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });
    });

    it('buttons maintain functionality after multiple interactions', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /создать статью/i });
        expect(createButton).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /создать статью/i });

      // Multiple clicks should work consistently
      await fireEvent.click(createButton);
      await waitFor(() => expect(screen.getByText('Создать статью')).toBeInTheDocument());

      const cancelButton = screen.getByRole('button', { name: /отмена/i });
      await fireEvent.click(cancelButton);
      await waitFor(() => expect(screen.queryByText('Создать статью')).not.toBeInTheDocument());

      // Should still work after modal close
      await fireEvent.click(createButton);
      await waitFor(() => expect(screen.getByText('Создать статью')).toBeInTheDocument());
    });

    it('handles rapid button clicking gracefully', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /создать статью/i });
        expect(createButton).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /создать статью/i });

      // Rapid clicks
      await fireEvent.click(createButton);
      await fireEvent.click(createButton);
      await fireEvent.click(createButton);

      // Should only open one modal
      const modalTitles = screen.getAllByText('Создать статью');
      expect(modalTitles).toHaveLength(1);
    });
  });

  describe('Error Handling in Button Actions', () => {
    it('handles API errors gracefully during create', async () => {
      mockArticlesService.create.mockRejectedValueOnce(new Error('Create failed'));

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

      // Fill form and submit
      const codeInput = screen.getByLabelText(/код статьи/i);
      const nameInput = screen.getByLabelText(/название/i);

      await fireEvent.input(codeInput, { target: { value: 'FAIL' } });
      await fireEvent.input(nameInput, { target: { value: 'Failed Article' } });

      const submitButton = screen.getByRole('button', { name: /^создать$/i });
      await fireEvent.click(submitButton);

      // Should handle error but keep modal open for retry
      await waitFor(() => {
        expect(mockArticlesService.create).toHaveBeenCalled();
      });

      // Modal should remain open after error
      expect(screen.getByText('Создать статью')).toBeInTheDocument();
    });

    it('handles API errors gracefully during update', async () => {
      mockArticlesService.update.mockRejectedValueOnce(new Error('Update failed'));

      render(ArticlesPage);

      // Open edit modal
      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /изменить/i });
        expect(editButtons[0]).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /изменить/i });
      await fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Редактировать статью')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /сохранить/i });
      await fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockArticlesService.update).toHaveBeenCalled();
      });

      // Modal should remain open after error
      expect(screen.getByText('Редактировать статью')).toBeInTheDocument();
    });

    it('handles API errors gracefully during delete', async () => {
      mockArticlesService.delete.mockRejectedValueOnce(new Error('Delete failed'));

      render(ArticlesPage);

      // Open delete modal
      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
        expect(deleteButtons[0]).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
      await fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Удалить статью')).toBeInTheDocument();
      });

      const confirmDeleteButton = screen.getByRole('button', { name: /^удалить$/i });
      await fireEvent.click(confirmDeleteButton);

      await waitFor(() => {
        expect(mockArticlesService.delete).toHaveBeenCalled();
      });

      // Modal should remain open after error
      expect(screen.getByText('Удалить статью')).toBeInTheDocument();
    });
  });

  describe('Performance and Responsiveness', () => {
    it('buttons respond immediately to clicks', async () => {
      render(ArticlesPage);

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /создать статью/i });
        expect(createButton).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /создать статью/i });

      const startTime = Date.now();
      await fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Should respond within reasonable time (less than 500ms)
      expect(responseTime).toBeLessThan(500);
    });

    it('maintains performance with many articles', async () => {
      // Mock many articles
      const manyArticles = Array.from({ length: 100 }, (_, i) => ({
        ...mockArticles[0],
        id: i + 1,
        code: `CODE_${i}`,
        name: `Article ${i}`
      }));

      mockArticlesService.getAll.mockResolvedValue({
        success: true,
        data: manyArticles,
        total: manyArticles.length
      });

      render(ArticlesPage);

      await waitFor(() => {
        expect(screen.getByText('Article 0')).toBeInTheDocument();
      });

      // Should render all action buttons efficiently
      const editButtons = screen.getAllByRole('button', { name: /изменить/i });
      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });

      expect(editButtons.length).toBeGreaterThan(0);
      expect(deleteButtons.length).toBeGreaterThan(0);

      // Test interaction with first button
      const startTime = Date.now();
      await fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Редактировать статью')).toBeInTheDocument();
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Performance should not degrade significantly with many items
      expect(responseTime).toBeLessThan(1000);
    });
  });
});
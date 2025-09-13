/**
 * Frontend tests for financial centers settings component.
 * Tests UI behavior, form handling, error processing, and 400 conflict handling.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import FinancialCentersPage from '../../frontend-svelte/src/routes/(protected)/settings/financial-centers/+page.svelte';
import * as api from '../../frontend-svelte/src/lib/services/api';
import { createMockAxiosResponse, waitForAsync } from '../../frontend-svelte/src/test/utils';

// Mock the API module
vi.mock('../../frontend-svelte/src/lib/services/api', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

// Mock toast notifications
vi.mock('../../frontend-svelte/src/lib/stores/toast.store', () => ({
  toastStore: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }
}));

describe('Financial Centers Settings Component', () => {
  const mockApiGet = api.get as Mock;
  const mockApiPost = api.post as Mock;
  const mockApiPut = api.put as Mock;
  const mockApiDelete = api.delete as Mock;

  const mockFinancialCenters = [
    {
      id: 1,
      name: 'Семейный бюджет',
      is_active: true,
      user_id: 1
    },
    {
      id: 2,
      name: 'Личные финансы',
      is_active: true,
      user_id: 1
    },
    {
      id: 3,
      name: 'Инвестиции',
      is_active: false,
      user_id: 1
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockApiGet.mockResolvedValue(createMockAxiosResponse(mockFinancialCenters));
    mockApiPost.mockResolvedValue(createMockAxiosResponse({
      id: 4,
      name: 'Новый ЦФО',
      is_active: true,
      user_id: 1
    }));
    mockApiPut.mockResolvedValue(createMockAxiosResponse({
      id: 1,
      name: 'Обновленный ЦФО',
      is_active: false,
      user_id: 1
    }));
    mockApiDelete.mockResolvedValue(createMockAxiosResponse({
      message: 'Financial center deleted successfully'
    }));
  });

  describe('Component Rendering', () => {
    it('renders financial centers page with title', async () => {
      render(FinancialCentersPage);

      expect(screen.getByText('Управление ЦФО')).toBeInTheDocument();
    });

    it('displays statistics cards', async () => {
      render(FinancialCentersPage);
      await waitForAsync();

      // Should show total centers count
      expect(screen.getByText('Всего ЦФО')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();

      // Should show active/inactive counts
      expect(screen.getByText('Активных')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 active
      expect(screen.getByText('Неактивных')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // 1 inactive
    });

    it('displays financial centers list', async () => {
      render(FinancialCentersPage);
      await waitForAsync();

      expect(screen.getByText('Семейный бюджет')).toBeInTheDocument();
      expect(screen.getByText('Личные финансы')).toBeInTheDocument();
      expect(screen.getByText('Инвестиции')).toBeInTheDocument();
    });

    it('shows active/inactive badges correctly', async () => {
      render(FinancialCentersPage);
      await waitForAsync();

      // Should have active badges
      const activeBadges = screen.getAllByText('Активный');
      expect(activeBadges).toHaveLength(2);

      // Should have inactive badge
      const inactiveBadge = screen.getByText('Неактивный');
      expect(inactiveBadge).toBeInTheDocument();
    });
  });

  describe('Financial Center Creation', () => {
    it('opens create modal when add button is clicked', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      expect(screen.getByText('Добавить новый ЦФО')).toBeInTheDocument();
    });

    it('creates new financial center successfully', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      // Fill form
      const nameInput = screen.getByLabelText('Название ЦФО');
      await user.type(nameInput, 'Резервный фонд');

      // Active checkbox should be checked by default
      const activeCheckbox = screen.getByLabelText('Активный');
      expect(activeCheckbox).toBeChecked();

      // Submit form
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/api/financial_centers/', {
          name: 'Резервный фонд',
          is_active: true
        });
      });
    });

    it('handles 400 conflict error when creating duplicate financial center', async () => {
      // Mock 400 error response for duplicate name
      const conflictError = {
        response: {
          status: 400,
          data: {
            detail: 'ЦФО с названием "Семейный бюджет" уже существует'
          }
        }
      };
      mockApiPost.mockRejectedValueOnce(conflictError);

      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      // Fill form with duplicate name
      const nameInput = screen.getByLabelText('Название ЦФО');
      await user.type(nameInput, 'Семейный бюджет');

      // Submit form
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        // Should display specific error message from server
        expect(screen.getByText('ЦФО с названием "Семейный бюджет" уже существует')).toBeInTheDocument();
      });
    });

    it('handles general error during financial center creation', async () => {
      const generalError = {
        response: {
          status: 500,
          data: {
            detail: 'Внутренняя ошибка сервера'
          }
        }
      };
      mockApiPost.mockRejectedValueOnce(generalError);

      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Open create modal and submit
      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название ЦФО');
      await user.type(nameInput, 'Тест ошибки');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Внутренняя ошибка сервера')).toBeInTheDocument();
      });
    });

    it('validates required fields in create form', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      // Try to submit without filling required name field
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      expect(screen.getByText('Название ЦФО обязательно')).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  describe('Financial Center Editing', () => {
    it('opens edit modal when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Find and click edit button for first center
      const editButtons = screen.getAllByText('Редактировать');
      await user.click(editButtons[0]);

      expect(screen.getByText('Редактировать ЦФО')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Семейный бюджет')).toBeInTheDocument();
    });

    it('updates financial center successfully', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Open edit modal
      const editButtons = screen.getAllByText('Редактировать');
      await user.click(editButtons[0]);

      // Update name
      const nameInput = screen.getByDisplayValue('Семейный бюджет');
      await user.clear(nameInput);
      await user.type(nameInput, 'Семейный бюджет (Обновлено)');

      // Toggle active status
      const activeCheckbox = screen.getByLabelText('Активный');
      await user.click(activeCheckbox); // Should uncheck it

      // Submit form
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiPut).toHaveBeenCalledWith('/api/financial_centers/1', {
          name: 'Семейный бюджет (Обновлено)',
          is_active: false
        });
      });
    });

    it('handles error during financial center update', async () => {
      const updateError = {
        response: {
          status: 400,
          data: {
            detail: 'ЦФО с названием "Личные финансы" уже существует'
          }
        }
      };
      mockApiPut.mockRejectedValueOnce(updateError);

      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Open edit modal and submit
      const editButtons = screen.getAllByText('Редактировать');
      await user.click(editButtons[0]);

      const nameInput = screen.getByDisplayValue('Семейный бюджет');
      await user.clear(nameInput);
      await user.type(nameInput, 'Личные финансы'); // Duplicate name

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('ЦФО с названием "Личные финансы" уже существует')).toBeInTheDocument();
      });
    });
  });

  describe('Financial Center Deletion', () => {
    it('opens delete confirmation when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Find and click delete button
      const deleteButtons = screen.getAllByText('Удалить');
      await user.click(deleteButtons[0]);

      expect(screen.getByText('Подтвердите удаление')).toBeInTheDocument();
      expect(screen.getByText(/Вы уверены, что хотите удалить ЦФО "Семейный бюджет"/)).toBeInTheDocument();
    });

    it('deletes financial center successfully', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Open delete confirmation
      const deleteButtons = screen.getAllByText('Удалить');
      await user.click(deleteButtons[0]);

      // Confirm deletion
      const confirmButton = screen.getByText('Удалить');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockApiDelete).toHaveBeenCalledWith('/api/financial_centers/1');
      });
    });

    it('handles error during financial center deletion', async () => {
      const deleteError = {
        response: {
          status: 400,
          data: {
            detail: 'Нельзя удалить ЦФО, используемый в транзакциях'
          }
        }
      };
      mockApiDelete.mockRejectedValueOnce(deleteError);

      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Open delete confirmation and confirm
      const deleteButtons = screen.getAllByText('Удалить');
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByText('Удалить');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Нельзя удалить ЦФО, используемый в транзакциях')).toBeInTheDocument();
      });
    });

    it('cancels deletion when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Open delete confirmation
      const deleteButtons = screen.getAllByText('Удалить');
      await user.click(deleteButtons[0]);

      // Cancel deletion
      const cancelButton = screen.getByText('Отмена');
      await user.click(cancelButton);

      // API should not be called
      expect(mockApiDelete).not.toHaveBeenCalled();

      // Confirmation dialog should be closed
      expect(screen.queryByText('Подтвердите удаление')).not.toBeInTheDocument();
    });
  });

  describe('Bulk Operations', () => {
    it('allows selecting multiple financial centers', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Find selection checkboxes
      const checkboxes = screen.getAllByRole('checkbox');

      // Select first two centers (skip the "select all" checkbox)
      await user.click(checkboxes[1]); // First center
      await user.click(checkboxes[2]); // Second center

      // Should show bulk actions
      expect(screen.getByText('Выбрано: 2')).toBeInTheDocument();
      expect(screen.getByText('Удалить выбранные')).toBeInTheDocument();
    });

    it('performs bulk delete operation', async () => {
      // Mock bulk delete endpoint
      mockApiPost.mockResolvedValue(createMockAxiosResponse({
        message: 'Deleted 2 financial centers'
      }));

      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Select financial centers
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      // Click bulk delete
      const bulkDeleteButton = screen.getByText('Удалить выбранные');
      await user.click(bulkDeleteButton);

      // Confirm in dialog
      const confirmButton = screen.getByText('Удалить выбранные');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/api/financial_centers/bulk-delete', [1, 2]);
      });
    });

    it('clears selection after successful bulk operation', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Select financial centers
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      expect(screen.getByText('Выбрано: 2')).toBeInTheDocument();

      // Perform bulk delete
      const bulkDeleteButton = screen.getByText('Удалить выбранные');
      await user.click(bulkDeleteButton);

      const confirmButton = screen.getByText('Удалить выбранные');
      await user.click(confirmButton);

      await waitFor(() => {
        // Selection should be cleared
        expect(screen.queryByText('Выбрано: 2')).not.toBeInTheDocument();
      });
    });

    it('handles bulk operation errors', async () => {
      const bulkError = {
        response: {
          status: 400,
          data: {
            detail: 'Некоторые ЦФО нельзя удалить, так как они используются в транзакциях'
          }
        }
      };
      mockApiPost.mockRejectedValueOnce(bulkError);

      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Select centers and perform bulk delete
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      const bulkDeleteButton = screen.getByText('Удалить выбранные');
      await user.click(bulkDeleteButton);

      const confirmButton = screen.getByText('Удалить выбранные');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Некоторые ЦФО нельзя удалить, так как они используются в транзакциях')).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filtering', () => {
    it('searches financial centers by name', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Find search input
      const searchInput = screen.getByPlaceholderText('Поиск ЦФО...');
      await user.type(searchInput, 'Семейный');

      // Should filter displayed centers locally
      await waitFor(() => {
        expect(screen.getByText('Семейный бюджет')).toBeInTheDocument();
        expect(screen.queryByText('Личные финансы')).not.toBeInTheDocument();
        expect(screen.queryByText('Инвестиции')).not.toBeInTheDocument();
      });
    });

    it('filters centers by active status', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Find status filter dropdown
      const statusFilter = screen.getByLabelText('Фильтр по статусу');
      await user.selectOptions(statusFilter, 'active');

      // Should show only active centers
      await waitFor(() => {
        expect(screen.getByText('Семейный бюджет')).toBeInTheDocument();
        expect(screen.getByText('Личные финансы')).toBeInTheDocument();
        expect(screen.queryByText('Инвестиции')).not.toBeInTheDocument();
      });
    });

    it('filters centers by inactive status', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Find status filter dropdown
      const statusFilter = screen.getByLabelText('Фильтр по статусу');
      await user.selectOptions(statusFilter, 'inactive');

      // Should show only inactive centers
      await waitFor(() => {
        expect(screen.queryByText('Семейный бюджет')).not.toBeInTheDocument();
        expect(screen.queryByText('Личные финансы')).not.toBeInTheDocument();
        expect(screen.getByText('Инвестиции')).toBeInTheDocument();
      });
    });

    it('clears search when search input is emptied', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Search for specific center
      const searchInput = screen.getByPlaceholderText('Поиск ЦФО...');
      await user.type(searchInput, 'Семейный');

      expect(screen.getByText('Семейный бюджет')).toBeInTheDocument();
      expect(screen.queryByText('Личные финансы')).not.toBeInTheDocument();

      // Clear search
      await user.clear(searchInput);

      // Should show all centers again
      await waitFor(() => {
        expect(screen.getByText('Семейный бюджет')).toBeInTheDocument();
        expect(screen.getByText('Личные финансы')).toBeInTheDocument();
        expect(screen.getByText('Инвестиции')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States and Error Handling', () => {
    it('shows loading indicator while fetching financial centers', async () => {
      // Mock slow API response
      mockApiGet.mockImplementation(() => new Promise(resolve =>
        setTimeout(() => resolve(createMockAxiosResponse(mockFinancialCenters)), 100)
      ));

      render(FinancialCentersPage);

      expect(screen.getByText('Загрузка...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Загрузка...')).not.toBeInTheDocument();
      });
    });

    it('shows loading state during financial center creation', async () => {
      // Mock slow API response
      mockApiPost.mockImplementation(() => new Promise(resolve =>
        setTimeout(() => resolve(createMockAxiosResponse({ id: 4 })), 100)
      ));

      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Open create modal and submit
      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название ЦФО');
      await user.type(nameInput, 'Тест загрузки');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      // Should show loading state
      expect(screen.getByText('Сохранение...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Сохранение...')).not.toBeInTheDocument();
      });
    });

    it('handles API failure gracefully', async () => {
      mockApiGet.mockRejectedValueOnce(new Error('Network error'));

      render(FinancialCentersPage);
      await waitForAsync();

      expect(screen.getByText('Ошибка загрузки данных')).toBeInTheDocument();
    });

    it('provides retry functionality after error', async () => {
      mockApiGet
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockAxiosResponse(mockFinancialCenters));

      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      expect(screen.getByText('Ошибка загрузки данных')).toBeInTheDocument();

      // Click retry
      const retryButton = screen.getByText('Повторить');
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Семейный бюджет')).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('validates financial center name is not empty', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      // Try to submit with empty name
      const nameInput = screen.getByLabelText('Название ЦФО');
      await user.clear(nameInput);

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      expect(screen.getByText('Название ЦФО обязательно')).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('validates financial center name length', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      // Enter too long name
      const nameInput = screen.getByLabelText('Название ЦФО');
      const longName = 'А'.repeat(256); // Assuming max length is 255
      await user.type(nameInput, longName);

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      expect(screen.getByText('Название слишком длинное (максимум 255 символов)')).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('trims whitespace from financial center name', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      // Enter name with leading/trailing spaces
      const nameInput = screen.getByLabelText('Название ЦФО');
      await user.type(nameInput, '   Тестовый ЦФО   ');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        // Should call API with trimmed name
        expect(mockApiPost).toHaveBeenCalledWith('/api/financial_centers/', {
          name: 'Тестовый ЦФО',
          is_active: true
        });
      });
    });
  });

  describe('Data Refresh', () => {
    it('refreshes data after successful operations', async () => {
      const user = userEvent.setup();
      render(FinancialCentersPage);
      await waitForAsync();

      // Reset mock call count
      mockApiGet.mockClear();

      // Create new financial center
      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название ЦФО');
      await user.type(nameInput, 'Новый ЦФО');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        // Should call get again to refresh data
        expect(mockApiGet).toHaveBeenCalledWith('/api/financial_centers/');
      });
    });
  });
});
/**
 * Frontend tests for cost centers settings component.
 * Tests UI behavior, form handling, error processing, and 400 conflict handling.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import CostCentersPage from '../../frontend-svelte/src/routes/(protected)/settings/cost-centers/+page.svelte';
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

describe('Cost Centers Settings Component', () => {
  const mockApiGet = api.get as Mock;
  const mockApiPost = api.post as Mock;
  const mockApiPut = api.put as Mock;
  const mockApiDelete = api.delete as Mock;

  const mockCostCenters = [
    {
      id: 1,
      name: 'Домашние расходы',
      is_active: true,
      user_id: 1
    },
    {
      id: 2,
      name: 'Коммунальные услуги',
      is_active: true,
      user_id: 1
    },
    {
      id: 3,
      name: 'Развлечения',
      is_active: false,
      user_id: 1
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockApiGet.mockResolvedValue(createMockAxiosResponse(mockCostCenters));
    mockApiPost.mockResolvedValue(createMockAxiosResponse({
      id: 4,
      name: 'Новый МВЗ',
      is_active: true,
      user_id: 1
    }));
    mockApiPut.mockResolvedValue(createMockAxiosResponse({
      id: 1,
      name: 'Обновленный МВЗ',
      is_active: false,
      user_id: 1
    }));
    mockApiDelete.mockResolvedValue(createMockAxiosResponse({
      message: 'Cost center deleted successfully'
    }));
  });

  describe('Component Rendering', () => {
    it('renders cost centers page with title', async () => {
      render(CostCentersPage);

      expect(screen.getByText('Управление МВЗ')).toBeInTheDocument();
    });

    it('displays statistics cards', async () => {
      render(CostCentersPage);
      await waitForAsync();

      // Should show total centers count
      expect(screen.getByText('Всего МВЗ')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();

      // Should show active/inactive counts
      expect(screen.getByText('Активных')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 active
      expect(screen.getByText('Неактивных')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // 1 inactive
    });

    it('displays cost centers list', async () => {
      render(CostCentersPage);
      await waitForAsync();

      expect(screen.getByText('Домашние расходы')).toBeInTheDocument();
      expect(screen.getByText('Коммунальные услуги')).toBeInTheDocument();
      expect(screen.getByText('Развлечения')).toBeInTheDocument();
    });

    it('shows active/inactive badges correctly', async () => {
      render(CostCentersPage);
      await waitForAsync();

      // Should have active badges
      const activeBadges = screen.getAllByText('Активный');
      expect(activeBadges).toHaveLength(2);

      // Should have inactive badge
      const inactiveBadge = screen.getByText('Неактивный');
      expect(inactiveBadge).toBeInTheDocument();
    });
  });

  describe('Cost Center Creation', () => {
    it('opens create modal when add button is clicked', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      expect(screen.getByText('Добавить новый МВЗ')).toBeInTheDocument();
    });

    it('creates new cost center successfully', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      // Fill form
      const nameInput = screen.getByLabelText('Название МВЗ');
      await user.type(nameInput, 'Транспортные расходы');

      // Active checkbox should be checked by default
      const activeCheckbox = screen.getByLabelText('Активный');
      expect(activeCheckbox).toBeChecked();

      // Submit form
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/api/cost_centers/', {
          name: 'Транспортные расходы',
          is_active: true
        });
      });
    });

    it('handles 400 conflict error when creating duplicate cost center', async () => {
      // Mock 400 error response for duplicate name
      const conflictError = {
        response: {
          status: 400,
          data: {
            detail: 'МВЗ с названием "Домашние расходы" уже существует'
          }
        }
      };
      mockApiPost.mockRejectedValueOnce(conflictError);

      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      // Fill form with duplicate name
      const nameInput = screen.getByLabelText('Название МВЗ');
      await user.type(nameInput, 'Домашние расходы');

      // Submit form
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        // Should display specific error message from server
        expect(screen.getByText('МВЗ с названием "Домашние расходы" уже существует')).toBeInTheDocument();
      });
    });

    it('handles general error during cost center creation', async () => {
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
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal and submit
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название МВЗ');
      await user.type(nameInput, 'Тест ошибки');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Внутренняя ошибка сервера')).toBeInTheDocument();
      });
    });

    it('validates required fields in create form', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      // Try to submit without filling required name field
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      expect(screen.getByText('Название МВЗ обязательно')).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  describe('Cost Center Editing', () => {
    it('opens edit modal when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Find and click edit button for first center
      const editButtons = screen.getAllByText('Редактировать');
      await user.click(editButtons[0]);

      expect(screen.getByText('Редактировать МВЗ')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Домашние расходы')).toBeInTheDocument();
    });

    it('updates cost center successfully', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open edit modal
      const editButtons = screen.getAllByText('Редактировать');
      await user.click(editButtons[0]);

      // Update name
      const nameInput = screen.getByDisplayValue('Домашние расходы');
      await user.clear(nameInput);
      await user.type(nameInput, 'Домашние расходы (Обновлено)');

      // Toggle active status
      const activeCheckbox = screen.getByLabelText('Активный');
      await user.click(activeCheckbox); // Should uncheck it

      // Submit form
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiPut).toHaveBeenCalledWith('/api/cost_centers/1', {
          name: 'Домашние расходы (Обновлено)',
          is_active: false
        });
      });
    });

    it('handles error during cost center update', async () => {
      const updateError = {
        response: {
          status: 400,
          data: {
            detail: 'МВЗ с названием "Коммунальные услуги" уже существует'
          }
        }
      };
      mockApiPut.mockRejectedValueOnce(updateError);

      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open edit modal and submit
      const editButtons = screen.getAllByText('Редактировать');
      await user.click(editButtons[0]);

      const nameInput = screen.getByDisplayValue('Домашние расходы');
      await user.clear(nameInput);
      await user.type(nameInput, 'Коммунальные услуги'); // Duplicate name

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('МВЗ с названием "Коммунальные услуги" уже существует')).toBeInTheDocument();
      });
    });
  });

  describe('Cost Center Deletion', () => {
    it('opens delete confirmation when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Find and click delete button
      const deleteButtons = screen.getAllByText('Удалить');
      await user.click(deleteButtons[0]);

      expect(screen.getByText('Подтвердите удаление')).toBeInTheDocument();
      expect(screen.getByText(/Вы уверены, что хотите удалить МВЗ "Домашние расходы"/)).toBeInTheDocument();
    });

    it('deletes cost center successfully', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open delete confirmation
      const deleteButtons = screen.getAllByText('Удалить');
      await user.click(deleteButtons[0]);

      // Confirm deletion
      const confirmButton = screen.getByText('Удалить');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockApiDelete).toHaveBeenCalledWith('/api/cost_centers/1');
      });
    });

    it('handles error during cost center deletion', async () => {
      const deleteError = {
        response: {
          status: 400,
          data: {
            detail: 'Нельзя удалить МВЗ, используемый в транзакциях'
          }
        }
      };
      mockApiDelete.mockRejectedValueOnce(deleteError);

      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open delete confirmation and confirm
      const deleteButtons = screen.getAllByText('Удалить');
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByText('Удалить');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Нельзя удалить МВЗ, используемый в транзакциях')).toBeInTheDocument();
      });
    });

    it('cancels deletion when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
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
    it('allows selecting multiple cost centers', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
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
        message: 'Deleted 2 cost centers'
      }));

      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Select cost centers
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
        expect(mockApiPost).toHaveBeenCalledWith('/api/cost_centers/bulk-delete', [1, 2]);
      });
    });

    it('selects all cost centers when select all checkbox is clicked', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Find and click "select all" checkbox
      const selectAllCheckbox = screen.getByRole('checkbox', { name: /выбрать все/i });
      await user.click(selectAllCheckbox);

      // Should show all selected
      expect(screen.getByText('Выбрано: 3')).toBeInTheDocument();
    });

    it('deselects all when select all checkbox is clicked again', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Select all first
      const selectAllCheckbox = screen.getByRole('checkbox', { name: /выбрать все/i });
      await user.click(selectAllCheckbox);
      expect(screen.getByText('Выбрано: 3')).toBeInTheDocument();

      // Deselect all
      await user.click(selectAllCheckbox);
      expect(screen.queryByText('Выбрано:')).not.toBeInTheDocument();
    });

    it('handles bulk operation errors', async () => {
      const bulkError = {
        response: {
          status: 400,
          data: {
            detail: 'Некоторые МВЗ нельзя удалить, так как они используются в транзакциях'
          }
        }
      };
      mockApiPost.mockRejectedValueOnce(bulkError);

      const user = userEvent.setup();
      render(CostCentersPage);
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
        expect(screen.getByText('Некоторые МВЗ нельзя удалить, так как они используются в транзакциях')).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filtering', () => {
    it('searches cost centers by name', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Find search input
      const searchInput = screen.getByPlaceholderText('Поиск МВЗ...');
      await user.type(searchInput, 'Домашние');

      // Should filter displayed centers locally
      await waitFor(() => {
        expect(screen.getByText('Домашние расходы')).toBeInTheDocument();
        expect(screen.queryByText('Коммунальные услуги')).not.toBeInTheDocument();
        expect(screen.queryByText('Развлечения')).not.toBeInTheDocument();
      });
    });

    it('filters centers by active status', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Find status filter dropdown
      const statusFilter = screen.getByLabelText('Фильтр по статусу');
      await user.selectOptions(statusFilter, 'active');

      // Should show only active centers
      await waitFor(() => {
        expect(screen.getByText('Домашние расходы')).toBeInTheDocument();
        expect(screen.getByText('Коммунальные услуги')).toBeInTheDocument();
        expect(screen.queryByText('Развлечения')).not.toBeInTheDocument();
      });
    });

    it('filters centers by inactive status', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Find status filter dropdown
      const statusFilter = screen.getByLabelText('Фильтр по статусу');
      await user.selectOptions(statusFilter, 'inactive');

      // Should show only inactive centers
      await waitFor(() => {
        expect(screen.queryByText('Домашние расходы')).not.toBeInTheDocument();
        expect(screen.queryByText('Коммунальные услуги')).not.toBeInTheDocument();
        expect(screen.getByText('Развлечения')).toBeInTheDocument();
      });
    });

    it('combines search with status filter', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Apply search
      const searchInput = screen.getByPlaceholderText('Поиск МВЗ...');
      await user.type(searchInput, 'расходы');

      // Apply status filter
      const statusFilter = screen.getByLabelText('Фильтр по статусу');
      await user.selectOptions(statusFilter, 'active');

      // Should show only active centers matching search
      await waitFor(() => {
        expect(screen.getByText('Домашние расходы')).toBeInTheDocument();
        expect(screen.queryByText('Коммунальные услуги')).not.toBeInTheDocument();
        expect(screen.queryByText('Развлечения')).not.toBeInTheDocument();
      });
    });

    it('shows no results message when search yields no matches', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Search for non-existent center
      const searchInput = screen.getByPlaceholderText('Поиск МВЗ...');
      await user.type(searchInput, 'Несуществующий МВЗ');

      await waitFor(() => {
        expect(screen.getByText('МВЗ не найдены')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States and Error Handling', () => {
    it('shows loading indicator while fetching cost centers', async () => {
      // Mock slow API response
      mockApiGet.mockImplementation(() => new Promise(resolve =>
        setTimeout(() => resolve(createMockAxiosResponse(mockCostCenters)), 100)
      ));

      render(CostCentersPage);

      expect(screen.getByText('Загрузка...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Загрузка...')).not.toBeInTheDocument();
      });
    });

    it('shows loading state during cost center creation', async () => {
      // Mock slow API response
      mockApiPost.mockImplementation(() => new Promise(resolve =>
        setTimeout(() => resolve(createMockAxiosResponse({ id: 4 })), 100)
      ));

      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal and submit
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название МВЗ');
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

      render(CostCentersPage);
      await waitForAsync();

      expect(screen.getByText('Ошибка загрузки данных')).toBeInTheDocument();
    });

    it('provides retry functionality after error', async () => {
      mockApiGet
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockAxiosResponse(mockCostCenters));

      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      expect(screen.getByText('Ошибка загрузки данных')).toBeInTheDocument();

      // Click retry
      const retryButton = screen.getByText('Повторить');
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Домашние расходы')).toBeInTheDocument();
      });
    });

    it('closes modals after successful operations', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      expect(screen.getByText('Добавить новый МВЗ')).toBeInTheDocument();

      // Fill and submit form
      const nameInput = screen.getByLabelText('Название МВЗ');
      await user.type(nameInput, 'Успешное создание');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('Добавить новый МВЗ')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('validates cost center name is not empty', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      // Try to submit with empty name
      const nameInput = screen.getByLabelText('Название МВЗ');
      await user.clear(nameInput);

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      expect(screen.getByText('Название МВЗ обязательно')).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('validates cost center name length', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      // Enter too long name
      const nameInput = screen.getByLabelText('Название МВЗ');
      const longName = 'А'.repeat(256); // Assuming max length is 255
      await user.type(nameInput, longName);

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      expect(screen.getByText('Название слишком длинное (максимум 255 символов)')).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('trims whitespace from cost center name', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      // Enter name with leading/trailing spaces
      const nameInput = screen.getByLabelText('Название МВЗ');
      await user.type(nameInput, '   Тестовый МВЗ   ');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        // Should call API with trimmed name
        expect(mockApiPost).toHaveBeenCalledWith('/api/cost_centers/', {
          name: 'Тестовый МВЗ',
          is_active: true
        });
      });
    });

    it('validates cost center name contains valid characters', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      // Test various valid names
      const validNames = [
        'МВЗ-001',
        'Центр затрат № 1',
        'Cost Center 1',
        'МВЗ_Продукты_2025',
        'Administrative Expenses'
      ];

      for (const validName of validNames) {
        const nameInput = screen.getByLabelText('Название МВЗ');
        await user.clear(nameInput);
        await user.type(nameInput, validName);

        const submitButton = screen.getByText('Сохранить');
        await user.click(submitButton);

        // Should not show validation errors for valid names
        expect(screen.queryByText('Некорректный формат названия')).not.toBeInTheDocument();

        // Clear for next iteration
        await user.click(screen.getByText('Отмена'));
        await user.click(addButton);
      }
    });
  });

  describe('Data Refresh', () => {
    it('refreshes data after successful operations', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Reset mock call count
      mockApiGet.mockClear();

      // Create new cost center
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название МВЗ');
      await user.type(nameInput, 'Новый МВЗ');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        // Should call get again to refresh data
        expect(mockApiGet).toHaveBeenCalledWith('/api/cost_centers/');
      });
    });

    it('updates statistics after data changes', async () => {
      // Mock updated data with one more center
      const updatedCostCenters = [
        ...mockCostCenters,
        {
          id: 4,
          name: 'Новый МВЗ',
          is_active: true,
          user_id: 1
        }
      ];

      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Verify initial statistics
      expect(screen.getByText('3')).toBeInTheDocument(); // Total

      // Mock API to return updated data
      mockApiGet.mockResolvedValueOnce(createMockAxiosResponse(updatedCostCenters));

      // Create new cost center
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название МВЗ');
      await user.type(nameInput, 'Новый МВЗ');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        // Should show updated statistics
        expect(screen.getByText('4')).toBeInTheDocument(); // Updated total
      });
    });
  });
});
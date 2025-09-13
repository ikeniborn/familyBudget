/**
 * Frontend tests for periods settings component.
 * Tests UI behavior, form handling, error processing, and 409 conflict handling.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import PeriodsPage from '../../frontend-svelte/src/routes/(protected)/settings/periods/+page.svelte';
import * as api from '../../frontend-svelte/src/lib/services/api';
import { createMockApiResponse, createMockAxiosResponse, waitForAsync } from '../../frontend-svelte/src/test/utils';

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

describe('Periods Settings Component', () => {
  const mockApiGet = api.get as Mock;
  const mockApiPost = api.post as Mock;
  const mockApiPut = api.put as Mock;
  const mockApiDelete = api.delete as Mock;

  const mockPeriods = [
    {
      id: 1,
      period_name: 'Январь 2025',
      period_year: 2025,
      period_month: 1,
      is_active: true,
      ru_name: 'Январь 2025',
      date: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 2,
      period_name: 'Февраль 2025',
      period_year: 2025,
      period_month: 2,
      is_active: false,
      ru_name: 'Февраль 2025',
      date: '2025-02-01T00:00:00.000Z'
    },
    {
      id: 3,
      period_name: 'Март 2025',
      period_year: 2025,
      period_month: 3,
      is_active: true,
      ru_name: 'Март 2025',
      date: '2025-03-01T00:00:00.000Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock - return periods
    mockApiGet.mockResolvedValue(createMockAxiosResponse(mockPeriods));
    mockApiPost.mockResolvedValue(createMockAxiosResponse({
      id: 4,
      period_name: 'Новый период',
      period_year: 2025,
      period_month: 4,
      is_active: true
    }));
    mockApiPut.mockResolvedValue(createMockAxiosResponse({
      id: 1,
      period_name: 'Обновленный период',
      is_active: false
    }));
    mockApiDelete.mockResolvedValue(createMockAxiosResponse({ message: 'Period deleted successfully' }));
  });

  describe('Component Rendering', () => {
    it('renders periods page with title', async () => {
      render(PeriodsPage);

      expect(screen.getByText('Управление периодами')).toBeInTheDocument();
    });

    it('displays statistics cards', async () => {
      render(PeriodsPage);
      await waitForAsync();

      // Should show total periods count
      expect(screen.getByText('Всего периодов')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();

      // Should show active/inactive counts
      expect(screen.getByText('Активных')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 active periods
      expect(screen.getByText('Неактивных')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // 1 inactive period
    });

    it('displays periods list', async () => {
      render(PeriodsPage);
      await waitForAsync();

      expect(screen.getByText('Январь 2025')).toBeInTheDocument();
      expect(screen.getByText('Февраль 2025')).toBeInTheDocument();
      expect(screen.getByText('Март 2025')).toBeInTheDocument();
    });

    it('shows active/inactive badges correctly', async () => {
      render(PeriodsPage);
      await waitForAsync();

      // Should have active badges
      const activeBadges = screen.getAllByText('Активный');
      expect(activeBadges).toHaveLength(2);

      // Should have inactive badge
      const inactiveBadge = screen.getByText('Неактивный');
      expect(inactiveBadge).toBeInTheDocument();
    });
  });

  describe('Period Creation', () => {
    it('opens create modal when add button is clicked', async () => {
      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить период');
      await user.click(addButton);

      expect(screen.getByText('Добавить новый период')).toBeInTheDocument();
    });

    it('creates new period successfully', async () => {
      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить период');
      await user.click(addButton);

      // Fill form
      const nameInput = screen.getByLabelText('Название периода');
      await user.type(nameInput, 'Апрель 2025');

      const yearInput = screen.getByLabelText('Год');
      await user.clear(yearInput);
      await user.type(yearInput, '2025');

      const monthSelect = screen.getByLabelText('Месяц');
      await user.selectOptions(monthSelect, '4');

      // Submit form
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/api/periods/', {
          period_name: 'Апрель 2025',
          period_year: 2025,
          period_month: 4,
          is_active: true
        });
      });
    });

    it('handles 409 conflict error when creating duplicate period', async () => {
      // Mock 409 error response
      const conflictError = {
        response: {
          status: 409,
          data: {
            detail: 'Период на дату 2025-01-01 уже существует'
          }
        }
      };
      mockApiPost.mockRejectedValueOnce(conflictError);

      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить период');
      await user.click(addButton);

      // Fill form with duplicate data
      const nameInput = screen.getByLabelText('Название периода');
      await user.type(nameInput, 'Январь 2025');

      const yearInput = screen.getByLabelText('Год');
      await user.clear(yearInput);
      await user.type(yearInput, '2025');

      const monthSelect = screen.getByLabelText('Месяц');
      await user.selectOptions(monthSelect, '1');

      // Submit form
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        // Should display specific error message from server
        expect(screen.getByText('Период на дату 2025-01-01 уже существует')).toBeInTheDocument();
      });
    });

    it('handles general error during period creation', async () => {
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
      render(PeriodsPage);
      await waitForAsync();

      // Open create modal and submit
      const addButton = screen.getByText('Добавить период');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название периода');
      await user.type(nameInput, 'Тест ошибки');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Внутренняя ошибка сервера')).toBeInTheDocument();
      });
    });

    it('validates required fields in create form', async () => {
      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить период');
      await user.click(addButton);

      // Try to submit without filling required fields
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      // Should not call API without required data
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  describe('Period Editing', () => {
    it('opens edit modal when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      // Find and click edit button for first period
      const editButtons = screen.getAllByText('Редактировать');
      await user.click(editButtons[0]);

      expect(screen.getByText('Редактировать период')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Январь 2025')).toBeInTheDocument();
    });

    it('updates period successfully', async () => {
      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      // Open edit modal
      const editButtons = screen.getAllByText('Редактировать');
      await user.click(editButtons[0]);

      // Update name
      const nameInput = screen.getByDisplayValue('Январь 2025');
      await user.clear(nameInput);
      await user.type(nameInput, 'Январь 2025 (Обновлено)');

      // Toggle active status
      const activeCheckbox = screen.getByLabelText('Активный период');
      await user.click(activeCheckbox);

      // Submit form
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiPut).toHaveBeenCalledWith('/api/periods/1', {
          period_name: 'Январь 2025 (Обновлено)',
          is_active: false
        });
      });
    });

    it('handles error during period update', async () => {
      const updateError = {
        response: {
          status: 400,
          data: {
            detail: 'Неверные данные для обновления'
          }
        }
      };
      mockApiPut.mockRejectedValueOnce(updateError);

      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      // Open edit modal and submit
      const editButtons = screen.getAllByText('Редактировать');
      await user.click(editButtons[0]);

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Неверные данные для обновления')).toBeInTheDocument();
      });
    });
  });

  describe('Period Deletion', () => {
    it('opens delete confirmation when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      // Find and click delete button
      const deleteButtons = screen.getAllByText('Удалить');
      await user.click(deleteButtons[0]);

      expect(screen.getByText('Подтвердите удаление')).toBeInTheDocument();
      expect(screen.getByText(/Вы уверены, что хотите удалить период "Январь 2025"/)).toBeInTheDocument();
    });

    it('deletes period successfully', async () => {
      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      // Open delete confirmation
      const deleteButtons = screen.getAllByText('Удалить');
      await user.click(deleteButtons[0]);

      // Confirm deletion
      const confirmButton = screen.getByText('Удалить');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockApiDelete).toHaveBeenCalledWith('/api/periods/1');
      });
    });

    it('handles error during period deletion', async () => {
      const deleteError = {
        response: {
          status: 400,
          data: {
            detail: 'Нельзя удалить период, используемый в транзакциях'
          }
        }
      };
      mockApiDelete.mockRejectedValueOnce(deleteError);

      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      // Open delete confirmation and confirm
      const deleteButtons = screen.getAllByText('Удалить');
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByText('Удалить');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Нельзя удалить период, используемый в транзакциях')).toBeInTheDocument();
      });
    });

    it('cancels deletion when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(PeriodsPage);
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

  describe('Loading States', () => {
    it('shows loading indicator while fetching periods', async () => {
      // Mock slow API response
      mockApiGet.mockImplementation(() => new Promise(resolve =>
        setTimeout(() => resolve(createMockAxiosResponse(mockPeriods)), 100)
      ));

      render(PeriodsPage);

      expect(screen.getByText('Загрузка...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Загрузка...')).not.toBeInTheDocument();
      });
    });

    it('shows loading state during period creation', async () => {
      // Mock slow API response
      mockApiPost.mockImplementation(() => new Promise(resolve =>
        setTimeout(() => resolve(createMockAxiosResponse({ id: 4 })), 100)
      ));

      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      // Open create modal and submit
      const addButton = screen.getByText('Добавить период');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название периода');
      await user.type(nameInput, 'Тест загрузки');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      // Should show loading state
      expect(screen.getByText('Сохранение...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Сохранение...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('handles API failure gracefully', async () => {
      mockApiGet.mockRejectedValueOnce(new Error('Network error'));

      render(PeriodsPage);
      await waitForAsync();

      expect(screen.getByText('Ошибка загрузки данных')).toBeInTheDocument();
    });

    it('provides retry functionality after error', async () => {
      mockApiGet
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockAxiosResponse(mockPeriods));

      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      expect(screen.getByText('Ошибка загрузки данных')).toBeInTheDocument();

      // Click retry
      const retryButton = screen.getByText('Повторить');
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Январь 2025')).toBeInTheDocument();
      });
    });

    it('closes modals after successful operations', async () => {
      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить период');
      await user.click(addButton);

      expect(screen.getByText('Добавить новый период')).toBeInTheDocument();

      // Fill and submit form
      const nameInput = screen.getByLabelText('Название периода');
      await user.type(nameInput, 'Успешное создание');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('Добавить новый период')).not.toBeInTheDocument();
      });
    });
  });

  describe('Data Refresh', () => {
    it('refreshes data after successful create operation', async () => {
      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      // Reset mock call count
      mockApiGet.mockClear();

      // Create new period
      const addButton = screen.getByText('Добавить период');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название периода');
      await user.type(nameInput, 'Новый период');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        // Should call get again to refresh data
        expect(mockApiGet).toHaveBeenCalledWith('/api/periods/');
      });
    });

    it('refreshes data after successful update operation', async () => {
      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      // Reset mock call count
      mockApiGet.mockClear();

      // Edit period
      const editButtons = screen.getAllByText('Редактировать');
      await user.click(editButtons[0]);

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        // Should call get again to refresh data
        expect(mockApiGet).toHaveBeenCalledWith('/api/periods/');
      });
    });

    it('refreshes data after successful delete operation', async () => {
      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      // Reset mock call count
      mockApiGet.mockClear();

      // Delete period
      const deleteButtons = screen.getAllByText('Удалить');
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByText('Удалить');
      await user.click(confirmButton);

      await waitFor(() => {
        // Should call get again to refresh data
        expect(mockApiGet).toHaveBeenCalledWith('/api/periods/');
      });
    });
  });

  describe('Form Validation', () => {
    it('validates period name is not empty', async () => {
      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить период');
      await user.click(addButton);

      // Try to submit with empty name
      const nameInput = screen.getByLabelText('Название периода');
      await user.clear(nameInput);

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      expect(screen.getByText('Название периода обязательно')).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('validates year is valid', async () => {
      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить период');
      await user.click(addButton);

      // Enter invalid year
      const yearInput = screen.getByLabelText('Год');
      await user.clear(yearInput);
      await user.type(yearInput, '1900');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      expect(screen.getByText('Год должен быть между 2020 и 2030')).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('validates month is selected', async () => {
      const user = userEvent.setup();
      render(PeriodsPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить период');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название периода');
      await user.type(nameInput, 'Тест валидации');

      // Don't select month
      const monthSelect = screen.getByLabelText('Месяц');
      await user.selectOptions(monthSelect, '');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      expect(screen.getByText('Выберите месяц')).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });
});
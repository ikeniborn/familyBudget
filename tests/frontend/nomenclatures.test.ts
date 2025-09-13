/**
 * Frontend tests for nomenclatures settings component.
 * Tests UI behavior, form handling, error processing, and 400 conflict handling.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import NomenclaturesPage from '../../frontend-svelte/src/routes/(protected)/settings/nomenclatures/+page.svelte';
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

describe('Nomenclatures Settings Component', () => {
  const mockApiGet = api.get as Mock;
  const mockApiPost = api.post as Mock;
  const mockApiPut = api.put as Mock;
  const mockApiDelete = api.delete as Mock;

  const mockNomenclatures = [
    {
      id: 1,
      name: 'Продукты питания',
      account_name: 'Продуктовый счет',
      bill_name: 'Покупки еды',
      operation: 'Расход',
      is_budget: true,
      is_fact: true,
      is_active: true
    },
    {
      id: 2,
      name: 'Транспорт',
      account_name: 'Транспортные расходы',
      bill_name: 'Оплата проезда',
      operation: 'Расход',
      is_budget: true,
      is_fact: false,
      is_active: true
    },
    {
      id: 3,
      name: 'Развлечения',
      account_name: 'Досуг',
      bill_name: 'Развлекательные мероприятия',
      operation: 'Расход',
      is_budget: false,
      is_fact: true,
      is_active: false
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockApiGet.mockResolvedValue(createMockAxiosResponse(mockNomenclatures));
    mockApiPost.mockResolvedValue(createMockAxiosResponse({
      id: 4,
      name: 'Новая номенклатура',
      account_name: 'Новый счет',
      is_budget: true,
      is_fact: true,
      is_active: true
    }));
    mockApiPut.mockResolvedValue(createMockAxiosResponse({
      id: 1,
      name: 'Обновленная номенклатура',
      is_active: false
    }));
    mockApiDelete.mockResolvedValue(createMockAxiosResponse({
      message: 'Nomenclature deleted successfully'
    }));
  });

  describe('Component Rendering', () => {
    it('renders nomenclatures page with title', async () => {
      render(NomenclaturesPage);

      expect(screen.getByText('Управление номенклатурами')).toBeInTheDocument();
    });

    it('displays statistics cards', async () => {
      render(NomenclaturesPage);
      await waitForAsync();

      // Should show total nomenclatures count
      expect(screen.getByText('Всего номенклатур')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();

      // Should show active/inactive counts
      expect(screen.getByText('Активных')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 active
      expect(screen.getByText('Неактивных')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // 1 inactive

      // Should show budget/fact counts
      expect(screen.getByText('Бюджетных')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 budget
      expect(screen.getByText('Фактических')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 fact
    });

    it('displays nomenclatures list', async () => {
      render(NomenclaturesPage);
      await waitForAsync();

      expect(screen.getByText('Продукты питания')).toBeInTheDocument();
      expect(screen.getByText('Транспорт')).toBeInTheDocument();
      expect(screen.getByText('Развлечения')).toBeInTheDocument();
    });

    it('shows nomenclature details in table', async () => {
      render(NomenclaturesPage);
      await waitForAsync();

      // Should show account names
      expect(screen.getByText('Продуктовый счет')).toBeInTheDocument();
      expect(screen.getByText('Транспортные расходы')).toBeInTheDocument();

      // Should show budget/fact badges
      expect(screen.getAllByText('Бюджет')).toHaveLength(2);
      expect(screen.getAllByText('Факт')).toHaveLength(2);
    });
  });

  describe('Nomenclature Creation', () => {
    it('opens create modal when add button is clicked', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить номенклатуру');
      await user.click(addButton);

      expect(screen.getByText('Добавить новую номенклатуру')).toBeInTheDocument();
    });

    it('creates new nomenclature successfully', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить номенклатуру');
      await user.click(addButton);

      // Fill form
      const nameInput = screen.getByLabelText('Название');
      await user.type(nameInput, 'Коммунальные услуги');

      const accountNameInput = screen.getByLabelText('Название счета');
      await user.type(accountNameInput, 'ЖКХ');

      const billNameInput = screen.getByLabelText('Название счета-фактуры');
      await user.type(billNameInput, 'Оплата ЖКХ');

      const operationInput = screen.getByLabelText('Операция');
      await user.type(operationInput, 'Расход');

      // Set checkboxes
      const budgetCheckbox = screen.getByLabelText('Бюджетная');
      await user.click(budgetCheckbox);

      const factCheckbox = screen.getByLabelText('Фактическая');
      await user.click(factCheckbox);

      // Submit form
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/api/nomenclatures/', {
          name: 'Коммунальные услуги',
          account_name: 'ЖКХ',
          bill_name: 'Оплата ЖКХ',
          operation: 'Расход',
          is_budget: true,
          is_fact: true,
          is_active: true
        });
      });
    });

    it('handles 400 conflict error when creating duplicate nomenclature', async () => {
      // Mock 400 error response for duplicate name
      const conflictError = {
        response: {
          status: 400,
          data: {
            detail: 'Номенклатура с названием "Продукты питания" уже существует'
          }
        }
      };
      mockApiPost.mockRejectedValueOnce(conflictError);

      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить номенклатуру');
      await user.click(addButton);

      // Fill form with duplicate name
      const nameInput = screen.getByLabelText('Название');
      await user.type(nameInput, 'Продукты питания');

      // Submit form
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        // Should display specific error message from server
        expect(screen.getByText('Номенклатура с названием "Продукты питания" уже существует')).toBeInTheDocument();
      });
    });

    it('handles general error during nomenclature creation', async () => {
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
      render(NomenclaturesPage);
      await waitForAsync();

      // Open create modal and submit
      const addButton = screen.getByText('Добавить номенклатуру');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название');
      await user.type(nameInput, 'Тест ошибки');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Внутренняя ошибка сервера')).toBeInTheDocument();
      });
    });

    it('validates required fields in create form', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить номенклатуру');
      await user.click(addButton);

      // Try to submit without filling required name field
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      expect(screen.getByText('Название обязательно')).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  describe('Nomenclature Editing', () => {
    it('opens edit modal when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Find and click edit button for first nomenclature
      const editButtons = screen.getAllByText('Редактировать');
      await user.click(editButtons[0]);

      expect(screen.getByText('Редактировать номенклатуру')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Продукты питания')).toBeInTheDocument();
    });

    it('updates nomenclature successfully', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Open edit modal
      const editButtons = screen.getAllByText('Редактировать');
      await user.click(editButtons[0]);

      // Update name
      const nameInput = screen.getByDisplayValue('Продукты питания');
      await user.clear(nameInput);
      await user.type(nameInput, 'Продукты питания (Обновлено)');

      // Update account name
      const accountNameInput = screen.getByDisplayValue('Продуктовый счет');
      await user.clear(accountNameInput);
      await user.type(accountNameInput, 'Обновленный продуктовый счет');

      // Toggle is_fact checkbox
      const factCheckbox = screen.getByLabelText('Фактическая');
      await user.click(factCheckbox); // Uncheck it

      // Submit form
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiPut).toHaveBeenCalledWith('/api/nomenclatures/1', {
          name: 'Продукты питания (Обновлено)',
          account_name: 'Обновленный продуктовый счет',
          is_fact: false
        });
      });
    });

    it('handles error during nomenclature update', async () => {
      const updateError = {
        response: {
          status: 400,
          data: {
            detail: 'Номенклатура с названием "Транспорт" уже существует'
          }
        }
      };
      mockApiPut.mockRejectedValueOnce(updateError);

      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Open edit modal and submit
      const editButtons = screen.getAllByText('Редактировать');
      await user.click(editButtons[0]);

      const nameInput = screen.getByDisplayValue('Продукты питания');
      await user.clear(nameInput);
      await user.type(nameInput, 'Транспорт'); // Duplicate name

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Номенклатура с названием "Транспорт" уже существует')).toBeInTheDocument();
      });
    });
  });

  describe('Nomenclature Deletion', () => {
    it('opens delete confirmation when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Find and click delete button
      const deleteButtons = screen.getAllByText('Удалить');
      await user.click(deleteButtons[0]);

      expect(screen.getByText('Подтвердите удаление')).toBeInTheDocument();
      expect(screen.getByText(/Вы уверены, что хотите удалить номенклатуру "Продукты питания"/)).toBeInTheDocument();
    });

    it('deletes nomenclature successfully', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Open delete confirmation
      const deleteButtons = screen.getAllByText('Удалить');
      await user.click(deleteButtons[0]);

      // Confirm deletion
      const confirmButton = screen.getByText('Удалить');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockApiDelete).toHaveBeenCalledWith('/api/nomenclatures/1');
      });
    });

    it('handles error during nomenclature deletion', async () => {
      const deleteError = {
        response: {
          status: 400,
          data: {
            detail: 'Нельзя удалить номенклатуру, используемую в транзакциях'
          }
        }
      };
      mockApiDelete.mockRejectedValueOnce(deleteError);

      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Open delete confirmation and confirm
      const deleteButtons = screen.getAllByText('Удалить');
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByText('Удалить');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Нельзя удалить номенклатуру, используемую в транзакциях')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Search', () => {
    it('filters nomenclatures by budget flag', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Find budget filter checkbox
      const budgetFilter = screen.getByLabelText('Показать только бюджетные');
      await user.click(budgetFilter);

      await waitFor(() => {
        // Should call API with is_budget filter
        expect(mockApiGet).toHaveBeenCalledWith('/api/nomenclatures/?is_budget=true');
      });
    });

    it('filters nomenclatures by fact flag', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Find fact filter checkbox
      const factFilter = screen.getByLabelText('Показать только фактические');
      await user.click(factFilter);

      await waitFor(() => {
        // Should call API with is_fact filter
        expect(mockApiGet).toHaveBeenCalledWith('/api/nomenclatures/?is_fact=true');
      });
    });

    it('searches nomenclatures by name', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Find search input
      const searchInput = screen.getByPlaceholderText('Поиск номенклатур...');
      await user.type(searchInput, 'Продукты');

      // Should filter displayed nomenclatures locally
      await waitFor(() => {
        expect(screen.getByText('Продукты питания')).toBeInTheDocument();
        expect(screen.queryByText('Транспорт')).not.toBeInTheDocument();
        expect(screen.queryByText('Развлечения')).not.toBeInTheDocument();
      });
    });

    it('combines multiple filters', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Apply both budget and fact filters
      const budgetFilter = screen.getByLabelText('Показать только бюджетные');
      const factFilter = screen.getByLabelText('Показать только фактические');

      await user.click(budgetFilter);
      await user.click(factFilter);

      await waitFor(() => {
        // Should call API with both filters
        expect(mockApiGet).toHaveBeenCalledWith('/api/nomenclatures/?is_budget=true&is_fact=true');
      });
    });
  });

  describe('Bulk Operations', () => {
    it('allows selecting multiple nomenclatures', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Find selection checkboxes
      const checkboxes = screen.getAllByRole('checkbox');

      // Select first two nomenclatures
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      // Should show bulk actions
      expect(screen.getByText('Выбрано: 2')).toBeInTheDocument();
      expect(screen.getByText('Удалить выбранные')).toBeInTheDocument();
    });

    it('performs bulk delete operation', async () => {
      // Mock bulk delete endpoint
      mockApiPost.mockResolvedValue(createMockAxiosResponse({
        message: 'Deleted 2 nomenclatures'
      }));

      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Select nomenclatures
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      // Click bulk delete
      const bulkDeleteButton = screen.getByText('Удалить выбранные');
      await user.click(bulkDeleteButton);

      // Confirm in dialog
      const confirmButton = screen.getByText('Удалить выбранные');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/api/nomenclatures/bulk-delete', [1, 2]);
      });
    });

    it('clears selection after successful bulk operation', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Select nomenclatures
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

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
  });

  describe('Loading States and Error Handling', () => {
    it('shows loading indicator while fetching nomenclatures', async () => {
      // Mock slow API response
      mockApiGet.mockImplementation(() => new Promise(resolve =>
        setTimeout(() => resolve(createMockAxiosResponse(mockNomenclatures)), 100)
      ));

      render(NomenclaturesPage);

      expect(screen.getByText('Загрузка...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Загрузка...')).not.toBeInTheDocument();
      });
    });

    it('handles API failure gracefully', async () => {
      mockApiGet.mockRejectedValueOnce(new Error('Network error'));

      render(NomenclaturesPage);
      await waitForAsync();

      expect(screen.getByText('Ошибка загрузки данных')).toBeInTheDocument();
    });

    it('provides retry functionality after error', async () => {
      mockApiGet
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockAxiosResponse(mockNomenclatures));

      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      expect(screen.getByText('Ошибка загрузки данных')).toBeInTheDocument();

      // Click retry
      const retryButton = screen.getByText('Повторить');
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Продукты питания')).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('validates nomenclature name is not empty', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить номенклатуру');
      await user.click(addButton);

      // Try to submit with empty name
      const nameInput = screen.getByLabelText('Название');
      await user.clear(nameInput);

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      expect(screen.getByText('Название обязательно')).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('validates nomenclature name length', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить номенклатуру');
      await user.click(addButton);

      // Enter too long name
      const nameInput = screen.getByLabelText('Название');
      const longName = 'А'.repeat(256); // Assuming max length is 255
      await user.type(nameInput, longName);

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      expect(screen.getByText('Название слишком длинное (максимум 255 символов)')).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('validates at least one type is selected (budget or fact)', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      const addButton = screen.getByText('Добавить номенклатуру');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название');
      await user.type(nameInput, 'Тест валидации');

      // Make sure both checkboxes are unchecked
      const budgetCheckbox = screen.getByLabelText('Бюджетная');
      const factCheckbox = screen.getByLabelText('Фактическая');

      if (budgetCheckbox.checked) await user.click(budgetCheckbox);
      if (factCheckbox.checked) await user.click(factCheckbox);

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      expect(screen.getByText('Выберите хотя бы один тип: бюджетная или фактическая')).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  describe('Data Refresh', () => {
    it('refreshes data after successful operations', async () => {
      const user = userEvent.setup();
      render(NomenclaturesPage);
      await waitForAsync();

      // Reset mock call count
      mockApiGet.mockClear();

      // Create new nomenclature
      const addButton = screen.getByText('Добавить номенклатуру');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название');
      await user.type(nameInput, 'Новая номенклатура');

      const budgetCheckbox = screen.getByLabelText('Бюджетная');
      await user.click(budgetCheckbox);

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        // Should call get again to refresh data
        expect(mockApiGet).toHaveBeenCalledWith('/api/nomenclatures/');
      });
    });
  });
});
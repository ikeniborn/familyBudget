/**
 * Frontend unit tests for cost center creation fix.
 * Tests the fix that added the required 'code' field to API requests.
 * Verifies both successful creation and validation errors.
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

describe('Cost Centers Creation Fix Tests', () => {
  const mockApiGet = api.get as Mock;
  const mockApiPost = api.post as Mock;
  const mockApiPut = api.put as Mock;

  const mockCostCenters = [
    {
      id: 1,
      code: 'HOME',
      name: 'Домашние расходы',
      description: 'Центр затрат для домашних расходов',
      is_active: true,
      user_id: 1
    },
    {
      id: 2,
      code: 'UTIL',
      name: 'Коммунальные услуги',
      description: 'Центр затрат для коммунальных услуг',
      is_active: true,
      user_id: 1
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for getting cost centers list
    mockApiGet.mockResolvedValue(createMockAxiosResponse(mockCostCenters));

    // Default mock for successful creation
    mockApiPost.mockResolvedValue(createMockAxiosResponse({
      id: 3,
      code: 'TRANSP',
      name: 'Транспортные расходы',
      description: 'Центр затрат для транспортных расходов',
      is_active: true,
      user_id: 1
    }));
  });

  describe('Code Field Requirement Tests', () => {
    it('sends both code and name fields when creating cost center', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      // Fill in both code and name fields
      const codeInput = screen.getByLabelText('Код МВЗ');
      const nameInput = screen.getByLabelText('Название МВЗ');
      const descriptionInput = screen.getByLabelText('Описание');

      await user.type(codeInput, 'TRANSP');
      await user.type(nameInput, 'Транспортные расходы');
      await user.type(descriptionInput, 'Центр затрат для транспортных расходов');

      // Active checkbox should be checked by default
      const activeCheckbox = screen.getByLabelText('Активный');
      expect(activeCheckbox).toBeChecked();

      // Submit form
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        // Verify that API call includes all required fields
        expect(mockApiPost).toHaveBeenCalledWith('/api/cost_centers/', {
          code: 'TRANSP',
          name: 'Транспортные расходы',
          description: 'Центр затрат для транспортных расходов',
          is_active: true
        });
      });
    });

    it('validates code field is required', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      // Fill only name field, leave code empty
      const nameInput = screen.getByLabelText('Название МВЗ');
      await user.type(nameInput, 'Тестовый МВЗ');

      // Try to submit without code
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Код МВЗ обязателен')).toBeInTheDocument();
      });

      // API should not be called
      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('validates name field is required', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      // Fill only code field, leave name empty
      const codeInput = screen.getByLabelText('Код МВЗ');
      await user.type(codeInput, 'TEST');

      // Try to submit without name
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Название МВЗ обязательно')).toBeInTheDocument();
      });

      // API should not be called
      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('validates both code and name are required', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      // Try to submit without filling required fields
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      // Should show both validation errors
      await waitFor(() => {
        expect(screen.getByText('Код МВЗ обязателен')).toBeInTheDocument();
        expect(screen.getByText('Название МВЗ обязательно')).toBeInTheDocument();
      });

      // API should not be called
      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('validates code field length constraints', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      const codeInput = screen.getByLabelText('Код МВЗ');
      const nameInput = screen.getByLabelText('Название МВЗ');

      // Test code too long (>20 characters)
      const longCode = 'A'.repeat(21);
      await user.type(codeInput, longCode);
      await user.type(nameInput, 'Тестовое название');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Код МВЗ должен содержать не более 20 символов')).toBeInTheDocument();
      });

      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('trims whitespace from code and name fields', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      // Enter fields with leading/trailing spaces
      const codeInput = screen.getByLabelText('Код МВЗ');
      const nameInput = screen.getByLabelText('Название МВЗ');

      await user.type(codeInput, '   TRIM_TEST   ');
      await user.type(nameInput, '   Тестовое название   ');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        // Should call API with trimmed values
        expect(mockApiPost).toHaveBeenCalledWith('/api/cost_centers/', {
          code: 'TRIM_TEST',
          name: 'Тестовое название',
          description: '',
          is_active: true
        });
      });
    });
  });

  describe('API Error Handling Tests', () => {
    it('handles 422 validation error for missing code field', async () => {
      // Mock 422 validation error (simulating backend validation)
      const validationError = {
        response: {
          status: 422,
          data: {
            success: false,
            error: 'Validation failed',
            details: {
              code: ['Field is required']
            }
          }
        }
      };
      mockApiPost.mockRejectedValueOnce(validationError);

      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal and submit with data that would trigger validation error
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название МВЗ');
      await user.type(nameInput, 'Тест валидации');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Validation failed')).toBeInTheDocument();
      });
    });

    it('handles 409 conflict error for duplicate code', async () => {
      // Mock 409 conflict error for duplicate code
      const conflictError = {
        response: {
          status: 409,
          data: {
            success: false,
            error: 'МВЗ с кодом "HOME" already exists'
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

      // Fill form with duplicate code
      const codeInput = screen.getByLabelText('Код МВЗ');
      const nameInput = screen.getByLabelText('Название МВЗ');

      await user.type(codeInput, 'HOME'); // Duplicate code from mock data
      await user.type(nameInput, 'Другое название');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('МВЗ с кодом "HOME" already exists')).toBeInTheDocument();
      });
    });

    it('handles 400 bad request for duplicate name', async () => {
      // Mock 400 error for duplicate name
      const duplicateError = {
        response: {
          status: 400,
          data: {
            detail: 'МВЗ с названием "Домашние расходы" уже существует'
          }
        }
      };
      mockApiPost.mockRejectedValueOnce(duplicateError);

      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      // Fill form with duplicate name
      const codeInput = screen.getByLabelText('Код МВЗ');
      const nameInput = screen.getByLabelText('Название МВЗ');

      await user.type(codeInput, 'NEW_CODE');
      await user.type(nameInput, 'Домашние расходы'); // Duplicate name

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('МВЗ с названием "Домашние расходы" уже существует')).toBeInTheDocument();
      });
    });

    it('handles general server error (500)', async () => {
      // Mock 500 internal server error
      const serverError = {
        response: {
          status: 500,
          data: {
            detail: 'Внутренняя ошибка сервера'
          }
        }
      };
      mockApiPost.mockRejectedValueOnce(serverError);

      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal and submit valid data
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      const codeInput = screen.getByLabelText('Код МВЗ');
      const nameInput = screen.getByLabelText('Название МВЗ');

      await user.type(codeInput, 'ERROR_TEST');
      await user.type(nameInput, 'Тест ошибки сервера');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Внутренняя ошибка сервера')).toBeInTheDocument();
      });
    });
  });

  describe('Form Behavior Tests', () => {
    it('shows all required form fields in create modal', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      // Verify all form fields are present
      expect(screen.getByLabelText('Код МВЗ')).toBeInTheDocument();
      expect(screen.getByLabelText('Название МВЗ')).toBeInTheDocument();
      expect(screen.getByLabelText('Описание')).toBeInTheDocument();
      expect(screen.getByLabelText('Активный')).toBeInTheDocument();

      // Verify code and name are marked as required
      expect(screen.getByLabelText('Код МВЗ')).toHaveAttribute('required');
      expect(screen.getByLabelText('Название МВЗ')).toHaveAttribute('required');
    });

    it('resets form when modal is closed and reopened', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      // Fill fields
      const codeInput = screen.getByLabelText('Код МВЗ');
      const nameInput = screen.getByLabelText('Название МВЗ');

      await user.type(codeInput, 'TEMP');
      await user.type(nameInput, 'Временный МВЗ');

      // Close modal without saving
      const cancelButton = screen.getByText('Отмена');
      await user.click(cancelButton);

      // Reopen modal
      await user.click(addButton);

      // Fields should be empty
      expect(screen.getByLabelText('Код МВЗ')).toHaveValue('');
      expect(screen.getByLabelText('Название МВЗ')).toHaveValue('');
      expect(screen.getByLabelText('Описание')).toHaveValue('');
      expect(screen.getByLabelText('Активный')).toBeChecked(); // Should maintain default
    });

    it('disables submit button during API request', async () => {
      // Mock slow API response
      mockApiPost.mockImplementation(() => new Promise(resolve =>
        setTimeout(() => resolve(createMockAxiosResponse({ id: 4 })), 100)
      ));

      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      // Fill form
      const codeInput = screen.getByLabelText('Код МВЗ');
      const nameInput = screen.getByLabelText('Название МВЗ');

      await user.type(codeInput, 'LOADING');
      await user.type(nameInput, 'Тест загрузки');

      // Submit form
      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      // Button should be disabled and show loading state
      expect(screen.getByText('Сохранение...')).toBeInTheDocument();
      expect(screen.getByText('Сохранение...')).toBeDisabled();

      // Wait for completion
      await waitFor(() => {
        expect(screen.queryByText('Сохранение...')).not.toBeInTheDocument();
      });
    });

    it('closes modal after successful creation', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Open create modal
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      expect(screen.getByText('Добавить новый МВЗ')).toBeInTheDocument();

      // Fill and submit form
      const codeInput = screen.getByLabelText('Код МВЗ');
      const nameInput = screen.getByLabelText('Название МВЗ');

      await user.type(codeInput, 'SUCCESS');
      await user.type(nameInput, 'Успешное создание');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      // Modal should close after successful creation
      await waitFor(() => {
        expect(screen.queryByText('Добавить новый МВЗ')).not.toBeInTheDocument();
      });
    });
  });

  describe('Data Refresh After Creation', () => {
    it('refreshes cost centers list after successful creation', async () => {
      const user = userEvent.setup();
      render(CostCentersPage);
      await waitForAsync();

      // Clear mock call count to track new calls
      mockApiGet.mockClear();

      // Open create modal and submit valid data
      const addButton = screen.getByText('Добавить МВЗ');
      await user.click(addButton);

      const codeInput = screen.getByLabelText('Код МВЗ');
      const nameInput = screen.getByLabelText('Название МВЗ');

      await user.type(codeInput, 'REFRESH');
      await user.type(nameInput, 'Тест обновления');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      // Should call get to refresh data
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/api/cost_centers/');
      });
    });
  });
});
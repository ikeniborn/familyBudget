/**
 * Frontend tests for financial centers error handling improvements.
 * Tests proper error message display, field validation, and handling of [object Object] fixes.
 * Verifies that validation errors are properly formatted and displayed to users.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import FinancialCentersPage from '../routes/(protected)/settings/financial-centers/+page.svelte';
import { api } from '$lib/services/api';
import { createMockAxiosResponse, waitForAsync } from './utils';

// Mock the API module
vi.mock('$lib/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

// Mock toast store with spy functions
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

vi.mock('$lib/stores/toast.store', () => ({
  useToast: () => mockToast,
  toastStore: mockToast
}));

describe('Financial Centers Error Handling', () => {
  const mockApiGet = api.get as Mock;
  const mockApiPost = api.post as Mock;
  const mockApiPut = api.put as Mock;
  const mockApiDelete = api.delete as Mock;

  const mockFinancialCenters = [
    {
      id: 1,
      name: 'Семейный бюджет',
      code: 'СБ',
      description: 'Основной семейный бюджет',
      is_active: true,
      user_id: 1
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful responses
    mockApiGet.mockResolvedValue({
      success: true,
      data: mockFinancialCenters,
      total: mockFinancialCenters.length
    });

    mockToast.success.mockClear();
    mockToast.error.mockClear();
  });

  describe('Field Name Validation Error Handling', () => {
    it('displays proper validation error when name field is missing', async () => {
      const user = userEvent.setup();

      // Mock 422 validation error response
      mockApiPost.mockRejectedValue({
        response: {
          status: 422,
          data: {
            detail: [
              {
                loc: ['body', 'name'],
                msg: 'field required',
                type: 'value_error.missing'
              }
            ]
          }
        }
      });

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      // Open add modal
      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      // Try to submit without filling name field
      const submitButton = screen.getByText('Создать');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Ошибка при создании ЦФО',
          'Ошибка валидации: name: field required'
        );
      });
    });

    it('displays proper validation error when name field is empty', async () => {
      const user = userEvent.setup();

      // Mock 422 validation error for empty name
      mockApiPost.mockRejectedValue({
        response: {
          status: 422,
          data: {
            detail: [
              {
                loc: ['body', 'name'],
                msg: 'ensure this value has at least 1 characters',
                type: 'value_error.any_str.min_length'
              }
            ]
          }
        }
      });

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      // Open add modal
      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      // Enter empty name and submit
      const nameInput = screen.getByLabelText('Название ЦФО *');
      await user.clear(nameInput);
      await user.type(nameInput, '   '); // Whitespace only
      await user.clear(nameInput); // Clear to empty

      const submitButton = screen.getByText('Создать');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Ошибка при создании ЦФО',
          'Ошибка валидации: name: ensure this value has at least 1 characters'
        );
      });
    });

    it('displays proper validation error when name field exceeds maximum length', async () => {
      const user = userEvent.setup();

      // Mock 422 validation error for too long name
      mockApiPost.mockRejectedValue({
        response: {
          status: 422,
          data: {
            detail: [
              {
                loc: ['body', 'name'],
                msg: 'ensure this value has at most 255 characters',
                type: 'value_error.any_str.max_length'
              }
            ]
          }
        }
      });

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      // Open add modal
      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      // Enter overly long name
      const nameInput = screen.getByLabelText('Название ЦФО *');
      const longName = 'x'.repeat(256); // Exceeds 255 character limit
      await user.type(nameInput, longName);

      const submitButton = screen.getByText('Создать');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Ошибка при создании ЦФО',
          'Ошибка валидации: name: ensure this value has at most 255 characters'
        );
      });
    });

    it('displays proper validation error when is_active field has invalid type', async () => {
      const user = userEvent.setup();

      // Mock 422 validation error for invalid boolean
      mockApiPost.mockRejectedValue({
        response: {
          status: 422,
          data: {
            detail: [
              {
                loc: ['body', 'is_active'],
                msg: 'value is not a valid boolean',
                type: 'type_error.bool'
              }
            ]
          }
        }
      });

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      // Open add modal
      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      // Fill name field
      const nameInput = screen.getByLabelText('Название ЦФО *');
      await user.type(nameInput, 'Тестовый ЦФО');

      const submitButton = screen.getByText('Создать');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Ошибка при создании ЦФО',
          'Ошибка валидации: is_active: value is not a valid boolean'
        );
      });
    });
  });

  describe('Multiple Field Validation Errors', () => {
    it('displays multiple validation errors properly formatted', async () => {
      const user = userEvent.setup();

      // Mock 422 validation error with multiple field errors
      mockApiPost.mockRejectedValue({
        response: {
          status: 422,
          data: {
            detail: [
              {
                loc: ['body', 'name'],
                msg: 'field required',
                type: 'value_error.missing'
              },
              {
                loc: ['body', 'is_active'],
                msg: 'value is not a valid boolean',
                type: 'type_error.bool'
              }
            ]
          }
        }
      });

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      // Open add modal
      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      const submitButton = screen.getByText('Создать');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Ошибка при создании ЦФО',
          'Ошибка валидации: name: field required, is_active: value is not a valid boolean'
        );
      });
    });

    it('handles nested field validation errors correctly', async () => {
      const user = userEvent.setup();

      // Mock 422 validation error with nested loc array
      mockApiPost.mockRejectedValue({
        response: {
          status: 422,
          data: {
            detail: [
              {
                loc: ['body', 'data', 'name'],
                msg: 'String too short',
                type: 'value_error.any_str.min_length'
              }
            ]
          }
        }
      });

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      const submitButton = screen.getByText('Создать');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Ошибка при создании ЦФО',
          'Ошибка валидации: name: String too short'
        );
      });
    });
  });

  describe('Conflict Error Handling (409)', () => {
    it('displays proper error message for duplicate financial center name', async () => {
      const user = userEvent.setup();

      // Mock 409 conflict error
      mockApiPost.mockRejectedValue({
        response: {
          status: 409,
          data: {
            success: false,
            error: "ЦФО с названием 'Семейный бюджет' уже существует"
          }
        }
      });

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      // Open add modal
      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      // Enter duplicate name
      const nameInput = screen.getByLabelText('Название ЦФО *');
      await user.type(nameInput, 'Семейный бюджет');

      const submitButton = screen.getByText('Создать');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Ошибка при создании ЦФО',
          "ЦФО с названием 'Семейный бюджет' уже существует"
        );
      });
    });

    it('displays proper error message for duplicate during update', async () => {
      const user = userEvent.setup();

      // First render with data
      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      // Mock 409 conflict error for update
      mockApiPut.mockRejectedValue({
        response: {
          status: 409,
          data: {
            success: false,
            error: "ЦФО с названием 'Личные финансы' уже существует"
          }
        }
      });

      // Click edit button for the first financial center
      const editButtons = screen.getAllByTitle('Изменить');
      await user.click(editButtons[0]);

      // Change name to conflicting value
      const nameInput = screen.getByLabelText('Название ЦФО *');
      await user.clear(nameInput);
      await user.type(nameInput, 'Личные финансы');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Ошибка при обновлении ЦФО',
          "ЦФО с названием 'Личные финансы' уже существует"
        );
      });
    });
  });

  describe('Generic Error Handling', () => {
    it('displays generic error message when error response has no specific details', async () => {
      const user = userEvent.setup();

      // Mock generic error response
      mockApiPost.mockRejectedValue({
        response: {
          status: 500,
          data: {
            success: false,
            error: 'Внутренняя ошибка сервера'
          }
        }
      });

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название ЦФО *');
      await user.type(nameInput, 'Тестовый ЦФО');

      const submitButton = screen.getByText('Создать');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Ошибка при создании ЦФО',
          'Внутренняя ошибка сервера'
        );
      });
    });

    it('displays network error message when server is unreachable', async () => {
      const user = userEvent.setup();

      // Mock network error (no response)
      mockApiPost.mockRejectedValue({
        request: {},
        message: 'Network Error'
      });

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название ЦФО *');
      await user.type(nameInput, 'Тестовый ЦФО');

      const submitButton = screen.getByText('Создать');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Ошибка при создании ЦФО',
          'Сервер не отвечает'
        );
      });
    });

    it('handles malformed error response gracefully', async () => {
      const user = userEvent.setup();

      // Mock malformed error response
      mockApiPost.mockRejectedValue({
        response: {
          status: 400,
          data: null // Malformed response
        }
      });

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название ЦФО *');
      await user.type(nameInput, 'Тестовый ЦФО');

      const submitButton = screen.getByText('Создать');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Ошибка при создании ЦФО',
          'Ошибка сервера: 400'
        );
      });
    });
  });

  describe('Object Error Prevention', () => {
    it('prevents [object Object] display by properly handling error objects', async () => {
      const user = userEvent.setup();

      // Mock error with object in detail
      mockApiPost.mockRejectedValue({
        response: {
          status: 422,
          data: {
            detail: [
              {
                loc: ['body', 'name'],
                msg: 'field required',
                type: 'value_error.missing',
                ctx: { limit_value: 1 } // Extra context that could cause [object Object]
              }
            ]
          }
        }
      });

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      const submitButton = screen.getByText('Создать');
      await user.click(submitButton);

      await waitFor(() => {
        // Verify no [object Object] appears in error message
        const errorCall = mockToast.error.mock.calls[0];
        expect(errorCall[1]).not.toContain('[object Object]');
        expect(errorCall[1]).toBe('Ошибка валидации: name: field required');
      });
    });

    it('handles error response with nested objects properly', async () => {
      const user = userEvent.setup();

      // Mock error with complex nested structure
      mockApiPost.mockRejectedValue({
        response: {
          status: 422,
          data: {
            detail: {
              name: ['Field is required', 'Must not be empty'],
              code: ['Code must be unique']
            }
          }
        }
      });

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      const submitButton = screen.getByText('Создать');
      await user.click(submitButton);

      await waitFor(() => {
        // Should still handle gracefully without [object Object]
        const errorCall = mockToast.error.mock.calls[0];
        expect(errorCall[1]).not.toContain('[object Object]');
        expect(typeof errorCall[1]).toBe('string');
      });
    });

    it('converts error detail string to proper message format', async () => {
      const user = userEvent.setup();

      // Mock error with string detail instead of array
      mockApiPost.mockRejectedValue({
        response: {
          status: 422,
          data: {
            detail: 'Name field is required and cannot be empty'
          }
        }
      });

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      const submitButton = screen.getByText('Создать');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Ошибка при создании ЦФО',
          'Ошибка валидации: Name field is required and cannot be empty'
        );
      });
    });
  });

  describe('Success Message Handling', () => {
    it('displays success message when financial center is created successfully', async () => {
      const user = userEvent.setup();

      // Mock successful creation
      mockApiPost.mockResolvedValue({
        success: true,
        data: {
          id: 2,
          name: 'Новый ЦФО',
          code: 'НЦ',
          is_active: true,
          user_id: 1
        }
      });

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название ЦФО *');
      await user.type(nameInput, 'Новый ЦФО');

      const submitButton = screen.getByText('Создать');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('ЦФО успешно создан');
      });
    });

    it('displays success message when financial center is updated successfully', async () => {
      const user = userEvent.setup();

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      // Mock successful update
      mockApiPut.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          name: 'Обновленный ЦФО',
          code: 'ОЦ',
          is_active: false,
          user_id: 1
        }
      });

      // Click edit button
      const editButtons = screen.getAllByTitle('Изменить');
      await user.click(editButtons[0]);

      const nameInput = screen.getByLabelText('Название ЦФО *');
      await user.clear(nameInput);
      await user.type(nameInput, 'Обновленный ЦФО');

      const submitButton = screen.getByText('Сохранить');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('ЦФО успешно обновлен');
      });
    });
  });

  describe('Loading States and UX', () => {
    it('shows loading indicator during form submission', async () => {
      const user = userEvent.setup();

      // Mock delayed response
      let resolvePromise: (value: any) => void;
      const delayedPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockApiPost.mockReturnValue(delayedPromise);

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название ЦФО *');
      await user.type(nameInput, 'Тестовый ЦФО');

      const submitButton = screen.getByText('Создать');
      await user.click(submitButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Сохранение...')).toBeInTheDocument();
      });

      // Resolve the promise
      resolvePromise!({
        success: true,
        data: { id: 2, name: 'Тестовый ЦФО', is_active: true, user_id: 1 }
      });

      // Loading state should disappear
      await waitFor(() => {
        expect(screen.queryByText('Сохранение...')).not.toBeInTheDocument();
      });
    });

    it('disables form submission during loading', async () => {
      const user = userEvent.setup();

      // Mock delayed response
      const delayedPromise = new Promise(() => {}); // Never resolves
      mockApiPost.mockReturnValue(delayedPromise);

      render(FinancialCentersPage);
      await waitFor(() => expect(screen.getByText('Управление ЦФО')).toBeInTheDocument());

      const addButton = screen.getByText('Добавить ЦФО');
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Название ЦФО *');
      await user.type(nameInput, 'Тестовый ЦФО');

      const submitButton = screen.getByText('Создать');
      await user.click(submitButton);

      // Button should be disabled during loading
      await waitFor(() => {
        const savingButton = screen.getByText('Сохранение...');
        expect(savingButton).toBeDisabled();
      });
    });
  });
});
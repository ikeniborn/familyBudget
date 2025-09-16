/**
 * Comprehensive frontend tests for period creation functionality.
 * Tests period creation form submission, auto-calculation of dates, error handling,
 * success message display, and period list refresh after creation.
 *
 * This test suite focuses on:
 * - Period creation form submission and validation
 * - Auto-calculation of period dates based on month selection
 * - Error handling for failed API requests and constraint violations
 * - Success message display with proper toast notifications
 * - Period list refresh after successful creation
 * - Form reset and UI state management
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PeriodsPage from '../../frontend-svelte/src/routes/(protected)/settings/periods/+page.svelte';
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
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn()
};

vi.mock('../../frontend-svelte/src/lib/stores/toast.store', () => ({
  toastStore: mockToast
}));

describe('Period Creation Form Tests', () => {
  const mockApiGet = api.get as Mock;
  const mockApiPost = api.post as Mock;
  const mockApiPut = api.put as Mock;
  const mockApiDelete = api.delete as Mock;

  const mockPeriodsData = {
    success: true,
    data: [
      {
        period_id: 1,
        period_code: "202001",
        period_name: "2025 Янв",
        ru_name: "2025 Янв",
        date_begin: "2025-01-01",
        date_end: "2025-01-31",
        period_year: 2025,
        period_month: 1,
        is_closed: "N",
        user_id: 1
      },
      {
        period_id: 2,
        period_code: "202002",
        period_name: "2025 Фев",
        ru_name: "2025 Фев",
        date_begin: "2025-02-01",
        date_end: "2025-02-28",
        period_year: 2025,
        period_month: 2,
        is_closed: "N",
        user_id: 1
      }
    ],
    total: 2
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful periods list API call by default
    mockApiGet.mockResolvedValue(createMockAxiosResponse(mockPeriodsData));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Period Creation Form Submission', () => {
    it('should successfully create a new period with auto-calculated dates', async () => {
      const user = userEvent.setup();

      // Mock successful creation response
      const createdPeriod = {
        period_id: 3,
        period_code: "202003",
        period_name: "2025 Мар",
        ru_name: "2025 Мар",
        date_begin: "2025-03-01",
        date_end: "2025-03-31",
        period_year: 2025,
        period_month: 3,
        is_closed: "N",
        user_id: 1
      };

      mockApiPost.mockResolvedValueOnce(
        createMockAxiosResponse({
          success: true,
          data: createdPeriod
        })
      );

      // Mock updated periods list after creation
      const updatedPeriodsData = {
        ...mockPeriodsData,
        data: [...mockPeriodsData.data, createdPeriod],
        total: 3
      };
      mockApiGet.mockResolvedValueOnce(createMockAxiosResponse(updatedPeriodsData));

      render(PeriodsPage);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Управление периодами')).toBeInTheDocument();
      });

      // Open creation modal
      const createButton = screen.getByRole('button', { name: /создать период/i });
      await user.click(createButton);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByText('Создать новый период')).toBeInTheDocument();
      });

      // Fill form with year and month (dates should auto-calculate)
      const yearInput = screen.getByLabelText(/год/i);
      const monthSelect = screen.getByLabelText(/месяц/i);

      await user.clear(yearInput);
      await user.type(yearInput, '2025');

      await user.selectOptions(monthSelect, '3'); // March

      // Submit form
      const submitButton = screen.getByRole('button', { name: /создать/i });
      await user.click(submitButton);

      // Wait for API call and response
      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/api/periods/', expect.objectContaining({
          period_year: 2025,
          period_month: 3,
          period_name: expect.stringContaining('2025'),
          start_date: expect.stringContaining('2025-03-01'),
          end_date: expect.stringContaining('2025-03-31')
        }));
      });

      // Verify success toast and modal close
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          expect.stringContaining('Период успешно создан')
        );
      });

      // Verify periods list was refreshed
      expect(mockApiGet).toHaveBeenCalledWith('/api/periods/');
    });

    it('should auto-calculate period dates based on selected month', async () => {
      const user = userEvent.setup();

      render(PeriodsPage);

      // Open creation modal
      const createButton = screen.getByRole('button', { name: /создать период/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать новый период')).toBeInTheDocument();
      });

      // Test different months for date auto-calculation
      const testCases = [
        { month: 1, expectedStart: '2025-01-01', expectedEnd: '2025-01-31' },
        { month: 2, expectedStart: '2025-02-01', expectedEnd: '2025-02-28' }, // Non-leap year
        { month: 4, expectedStart: '2025-04-01', expectedEnd: '2025-04-30' }, // 30 days
        { month: 12, expectedStart: '2025-12-01', expectedEnd: '2025-12-31' }
      ];

      const yearInput = screen.getByLabelText(/год/i);
      const monthSelect = screen.getByLabelText(/месяц/i);
      const startDateInput = screen.getByLabelText(/дата начала/i);
      const endDateInput = screen.getByLabelText(/дата окончания/i);

      await user.clear(yearInput);
      await user.type(yearInput, '2025');

      for (const testCase of testCases) {
        await user.selectOptions(monthSelect, testCase.month.toString());

        // Wait for auto-calculation to complete
        await waitFor(() => {
          expect(startDateInput).toHaveValue(testCase.expectedStart);
          expect(endDateInput).toHaveValue(testCase.expectedEnd);
        });
      }
    });

    it('should handle leap year February correctly', async () => {
      const user = userEvent.setup();

      render(PeriodsPage);

      const createButton = screen.getByRole('button', { name: /создать период/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать новый период')).toBeInTheDocument();
      });

      const yearInput = screen.getByLabelText(/год/i);
      const monthSelect = screen.getByLabelText(/месяц/i);
      const endDateInput = screen.getByLabelText(/дата окончания/i);

      // Test leap year (2024)
      await user.clear(yearInput);
      await user.type(yearInput, '2024');
      await user.selectOptions(monthSelect, '2'); // February

      await waitFor(() => {
        expect(endDateInput).toHaveValue('2024-02-29'); // Leap year February
      });

      // Test non-leap year (2025)
      await user.clear(yearInput);
      await user.type(yearInput, '2025');
      await user.selectOptions(monthSelect, '2'); // February

      await waitFor(() => {
        expect(endDateInput).toHaveValue('2025-02-28'); // Regular February
      });
    });
  });

  describe('Error Handling for Failed Requests', () => {
    it('should handle API error responses gracefully', async () => {
      const user = userEvent.setup();

      // Mock API error response
      mockApiPost.mockRejectedValueOnce({
        response: {
          status: 422,
          data: {
            success: false,
            error: "Missing required fields: date and ru_name"
          }
        }
      });

      render(PeriodsPage);

      const createButton = screen.getByRole('button', { name: /создать период/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать новый период')).toBeInTheDocument();
      });

      // Submit form with invalid data
      const submitButton = screen.getByRole('button', { name: /создать/i });
      await user.click(submitButton);

      // Verify error toast
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('Missing required fields')
        );
      });

      // Modal should remain open for correction
      expect(screen.getByText('Создать новый период')).toBeInTheDocument();
    });

    it('should handle duplicate period constraint violations', async () => {
      const user = userEvent.setup();

      // Mock 409 conflict response for duplicate period
      mockApiPost.mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            success: false,
            error: "Period for date 2025-01-01 already exists (user-specific)"
          }
        }
      });

      render(PeriodsPage);

      const createButton = screen.getByRole('button', { name: /создать период/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать новый период')).toBeInTheDocument();
      });

      // Fill form with duplicate data
      const yearInput = screen.getByLabelText(/год/i);
      const monthSelect = screen.getByLabelText(/месяц/i);

      await user.clear(yearInput);
      await user.type(yearInput, '2025');
      await user.selectOptions(monthSelect, '1'); // January - already exists

      const submitButton = screen.getByRole('button', { name: /создать/i });
      await user.click(submitButton);

      // Verify conflict error handling
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('already exists')
        );
      });
    });

    it('should handle network errors', async () => {
      const user = userEvent.setup();

      // Mock network error
      mockApiPost.mockRejectedValueOnce(new Error('Network Error'));

      render(PeriodsPage);

      const createButton = screen.getByRole('button', { name: /создать период/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать новый период')).toBeInTheDocument();
      });

      const yearInput = screen.getByLabelText(/год/i);
      const monthSelect = screen.getByLabelText(/месяц/i);

      await user.clear(yearInput);
      await user.type(yearInput, '2025');
      await user.selectOptions(monthSelect, '5');

      const submitButton = screen.getByRole('button', { name: /создать/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('Произошла ошибка при создании периода')
        );
      });
    });

    it('should handle server errors (500)', async () => {
      const user = userEvent.setup();

      mockApiPost.mockRejectedValueOnce({
        response: {
          status: 500,
          data: {
            success: false,
            error: "Internal server error during period creation"
          }
        }
      });

      render(PeriodsPage);

      const createButton = screen.getByRole('button', { name: /создать период/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать новый период')).toBeInTheDocument();
      });

      const yearInput = screen.getByLabelText(/год/i);
      const monthSelect = screen.getByLabelText(/месяц/i);

      await user.clear(yearInput);
      await user.type(yearInput, '2025');
      await user.selectOptions(monthSelect, '6');

      const submitButton = screen.getByRole('button', { name: /создать/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('Internal server error')
        );
      });
    });
  });

  describe('Form Validation and UI State Management', () => {
    it('should validate required fields before submission', async () => {
      const user = userEvent.setup();

      render(PeriodsPage);

      const createButton = screen.getByRole('button', { name: /создать период/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать новый период')).toBeInTheDocument();
      });

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /создать/i });
      await user.click(submitButton);

      // Should show validation errors without making API call
      expect(mockApiPost).not.toHaveBeenCalled();

      // Check for validation error indicators
      const yearInput = screen.getByLabelText(/год/i);
      const monthSelect = screen.getByLabelText(/месяц/i);

      expect(yearInput).toBeInvalid();
      expect(monthSelect).toBeInvalid();
    });

    it('should show loading state during form submission', async () => {
      const user = userEvent.setup();

      // Mock delayed API response to test loading state
      let resolveApiCall: (value: any) => void;
      const apiPromise = new Promise(resolve => {
        resolveApiCall = resolve;
      });
      mockApiPost.mockReturnValueOnce(apiPromise);

      render(PeriodsPage);

      const createButton = screen.getByRole('button', { name: /создать период/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать новый период')).toBeInTheDocument();
      });

      const yearInput = screen.getByLabelText(/год/i);
      const monthSelect = screen.getByLabelText(/месяц/i);

      await user.clear(yearInput);
      await user.type(yearInput, '2025');
      await user.selectOptions(monthSelect, '7');

      const submitButton = screen.getByRole('button', { name: /создать/i });
      await user.click(submitButton);

      // Check loading state
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(screen.getByText(/создание/i)).toBeInTheDocument(); // Loading text
      });

      // Resolve API call
      resolveApiCall!(createMockAxiosResponse({
        success: true,
        data: { period_id: 99, period_name: '2025 Июл' }
      }));

      // Verify loading state clears
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should reset form after successful creation', async () => {
      const user = userEvent.setup();

      mockApiPost.mockResolvedValueOnce(
        createMockAxiosResponse({
          success: true,
          data: { period_id: 4, period_name: '2025 Апр' }
        })
      );

      render(PeriodsPage);

      const createButton = screen.getByRole('button', { name: /создать период/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать новый период')).toBeInTheDocument();
      });

      const yearInput = screen.getByLabelText(/год/i);
      const monthSelect = screen.getByLabelText(/месяц/i);

      await user.clear(yearInput);
      await user.type(yearInput, '2025');
      await user.selectOptions(monthSelect, '4');

      const submitButton = screen.getByRole('button', { name: /создать/i });
      await user.click(submitButton);

      // Wait for success
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalled();
      });

      // Verify modal closed (form reset)
      await waitFor(() => {
        expect(screen.queryByText('Создать новый период')).not.toBeInTheDocument();
      });
    });
  });

  describe('Success Message Display and List Refresh', () => {
    it('should show success message and refresh periods list', async () => {
      const user = userEvent.setup();

      const newPeriod = {
        period_id: 5,
        period_code: "202008",
        period_name: "2025 Авг",
        ru_name: "2025 Авг",
        date_begin: "2025-08-01",
        date_end: "2025-08-31",
        period_year: 2025,
        period_month: 8,
        is_closed: "N",
        user_id: 1
      };

      // Mock successful creation
      mockApiPost.mockResolvedValueOnce(
        createMockAxiosResponse({
          success: true,
          data: newPeriod
        })
      );

      // Mock updated list after creation
      const updatedList = {
        success: true,
        data: [...mockPeriodsData.data, newPeriod],
        total: 3
      };

      // First call returns original data, second call returns updated data
      mockApiGet
        .mockResolvedValueOnce(createMockAxiosResponse(mockPeriodsData))
        .mockResolvedValueOnce(createMockAxiosResponse(updatedList));

      render(PeriodsPage);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('2025 Янв')).toBeInTheDocument();
        expect(screen.getByText('2025 Фев')).toBeInTheDocument();
      });

      // Create new period
      const createButton = screen.getByRole('button', { name: /создать период/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать новый период')).toBeInTheDocument();
      });

      const yearInput = screen.getByLabelText(/год/i);
      const monthSelect = screen.getByLabelText(/месяц/i);

      await user.clear(yearInput);
      await user.type(yearInput, '2025');
      await user.selectOptions(monthSelect, '8');

      const submitButton = screen.getByRole('button', { name: /создать/i });
      await user.click(submitButton);

      // Wait for success message
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          expect.stringMatching(/период.*создан/i)
        );
      });

      // Verify list was refreshed (second API call)
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledTimes(2);
      });

      // Check new period appears in the list
      await waitFor(() => {
        expect(screen.getByText('2025 Авг')).toBeInTheDocument();
      });
    });

    it('should update statistics after successful creation', async () => {
      const user = userEvent.setup();

      const newPeriod = {
        period_id: 6,
        period_code: "202009",
        period_name: "2025 Сен",
        ru_name: "2025 Сен",
        date_begin: "2025-09-01",
        date_end: "2025-09-30",
        period_year: 2025,
        period_month: 9,
        is_closed: "N",
        user_id: 1
      };

      mockApiPost.mockResolvedValueOnce(
        createMockAxiosResponse({
          success: true,
          data: newPeriod
        })
      );

      const updatedList = {
        success: true,
        data: [...mockPeriodsData.data, newPeriod],
        total: 3
      };

      mockApiGet
        .mockResolvedValueOnce(createMockAxiosResponse(mockPeriodsData))
        .mockResolvedValueOnce(createMockAxiosResponse(updatedList));

      render(PeriodsPage);

      // Check initial statistics
      await waitFor(() => {
        expect(screen.getByText('Всего периодов')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // Total count
      });

      // Create period
      const createButton = screen.getByRole('button', { name: /создать период/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Создать новый период')).toBeInTheDocument();
      });

      const yearInput = screen.getByLabelText(/год/i);
      const monthSelect = screen.getByLabelText(/месяц/i);

      await user.clear(yearInput);
      await user.type(yearInput, '2025');
      await user.selectOptions(monthSelect, '9');

      const submitButton = screen.getByRole('button', { name: /создать/i });
      await user.click(submitButton);

      // Wait for statistics to update
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument(); // Updated count
      });
    });
  });

  describe('Period Name Auto-Generation', () => {
    it('should auto-generate Russian period names correctly', async () => {
      const user = userEvent.setup();

      mockApiPost.mockImplementation((url, data) => {
        // Verify the period_name is auto-generated correctly
        const expectedNames: Record<number, string> = {
          1: '2025 Янв',
          2: '2025 Фев',
          3: '2025 Мар',
          4: '2025 Апр',
          5: '2025 Май',
          6: '2025 Июн',
          7: '2025 Июл',
          8: '2025 Авг',
          9: '2025 Сен',
          10: '2025 Окт',
          11: '2025 Ноя',
          12: '2025 Дек'
        };

        const expectedName = expectedNames[data.period_month];
        expect(data.period_name).toBe(expectedName);

        return Promise.resolve(createMockAxiosResponse({
          success: true,
          data: { period_id: 99, period_name: expectedName }
        }));
      });

      render(PeriodsPage);

      const createButton = screen.getByRole('button', { name: /создать период/i });

      // Test all months
      for (let month = 1; month <= 12; month++) {
        await user.click(createButton);

        await waitFor(() => {
          expect(screen.getByText('Создать новый период')).toBeInTheDocument();
        });

        const yearInput = screen.getByLabelText(/год/i);
        const monthSelect = screen.getByLabelText(/месяц/i);

        await user.clear(yearInput);
        await user.type(yearInput, '2025');
        await user.selectOptions(monthSelect, month.toString());

        const submitButton = screen.getByRole('button', { name: /создать/i });
        await user.click(submitButton);

        // Wait for API call to complete
        await waitFor(() => {
          expect(mockApiPost).toHaveBeenLastCalledWith('/api/periods/',
            expect.objectContaining({
              period_month: month,
              period_year: 2025
            })
          );
        });

        // Wait for modal to close before next iteration
        await waitFor(() => {
          expect(screen.queryByText('Создать новый период')).not.toBeInTheDocument();
        });
      }
    });
  });
});
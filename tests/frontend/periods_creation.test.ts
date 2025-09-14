/**
 * Test suite for period creation UI functionality
 * Tests auto-calculation of dates, error handling, and period_code generation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { writable } from 'svelte/store';
import PeriodCreationForm from '$lib/components/PeriodCreationForm.svelte';
import PeriodsPage from '$routes/(protected)/settings/periods/+page.svelte';
import * as periodService from '$lib/services/period.service';
import * as toastStore from '$lib/stores/toast.store';

// Mock the services and stores
vi.mock('$lib/services/period.service');
vi.mock('$lib/stores/toast.store');

describe('Period Creation Form Submission', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully submit form with auto-calculated dates', async () => {
        const mockCreatePeriod = vi.spyOn(periodService, 'createPeriod');
        mockCreatePeriod.mockResolvedValue({
            success: true,
            data: {
                id: 1,
                code: '202006',
                period_dt: '2025-10-01',
                period_ru_name: '2025 Окт',
                period_start_date: '2025-10-01',
                period_end_date: '2025-10-31',
                period_year: 2025,
                period_month: 10,
                is_active: true
            }
        });

        const mockShowSuccess = vi.spyOn(toastStore, 'showSuccess');

        const { component } = render(PeriodCreationForm, {
            props: {
                onSuccess: vi.fn()
            }
        });

        const user = userEvent.setup();

        // Select October 2025
        const monthSelect = screen.getByLabelText('Месяц');
        const yearInput = screen.getByLabelText('Год');

        await user.selectOptions(monthSelect, '10');
        await user.clear(yearInput);
        await user.type(yearInput, '2025');

        // Submit form
        const submitButton = screen.getByRole('button', { name: /создать/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockCreatePeriod).toHaveBeenCalledWith({
                period_dt: '2025-10-01',
                period_ru_name: '2025 Окт',
                period_start_date: '2025-10-01',
                period_end_date: '2025-10-31',
                period_year: 2025,
                period_month: 10,
                is_active: true
            });
        });

        expect(mockShowSuccess).toHaveBeenCalledWith('Период успешно создан');
    });

    it('should auto-calculate correct dates for each month', async () => {
        const testCases = [
            { month: 1, days: 31, name: 'Янв' },
            { month: 2, days: 28, name: 'Фев' }, // Non-leap year
            { month: 3, days: 31, name: 'Мар' },
            { month: 4, days: 30, name: 'Апр' },
            { month: 5, days: 31, name: 'Май' },
            { month: 6, days: 30, name: 'Июн' },
            { month: 7, days: 31, name: 'Июл' },
            { month: 8, days: 31, name: 'Авг' },
            { month: 9, days: 30, name: 'Сен' },
            { month: 10, days: 31, name: 'Окт' },
            { month: 11, days: 30, name: 'Ноя' },
            { month: 12, days: 31, name: 'Дек' }
        ];

        for (const testCase of testCases) {
            const { component } = render(PeriodCreationForm);
            const user = userEvent.setup();

            const monthSelect = screen.getByLabelText('Месяц');
            const yearInput = screen.getByLabelText('Год');

            await user.selectOptions(monthSelect, testCase.month.toString());
            await user.clear(yearInput);
            await user.type(yearInput, '2025');

            const startDateInput = screen.getByLabelText('Дата начала') as HTMLInputElement;
            const endDateInput = screen.getByLabelText('Дата окончания') as HTMLInputElement;
            const periodNameInput = screen.getByLabelText('Название периода') as HTMLInputElement;

            await waitFor(() => {
                const monthStr = testCase.month.toString().padStart(2, '0');
                expect(startDateInput.value).toBe(`2025-${monthStr}-01`);
                expect(endDateInput.value).toBe(`2025-${monthStr}-${testCase.days.toString().padStart(2, '0')}`);
                expect(periodNameInput.value).toBe(`2025 ${testCase.name}`);
            });

            component.$destroy();
        }
    });

    it('should handle leap year February correctly', async () => {
        const { component } = render(PeriodCreationForm);
        const user = userEvent.setup();

        const monthSelect = screen.getByLabelText('Месяц');
        const yearInput = screen.getByLabelText('Год');

        // Test leap year (2024)
        await user.selectOptions(monthSelect, '2');
        await user.clear(yearInput);
        await user.type(yearInput, '2024');

        const endDateLeap = screen.getByLabelText('Дата окончания') as HTMLInputElement;
        await waitFor(() => {
            expect(endDateLeap.value).toBe('2024-02-29');
        });

        // Test non-leap year (2025)
        await user.clear(yearInput);
        await user.type(yearInput, '2025');

        const endDateNonLeap = screen.getByLabelText('Дата окончания') as HTMLInputElement;
        await waitFor(() => {
            expect(endDateNonLeap.value).toBe('2025-02-28');
        });
    });
});

describe('Error Handling for Failed Requests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle 422 validation error', async () => {
        const mockCreatePeriod = vi.spyOn(periodService, 'createPeriod');
        mockCreatePeriod.mockRejectedValue({
            status: 422,
            response: {
                data: {
                    success: false,
                    error: 'Validation failed',
                    details: {
                        period_dt: ['Field is required']
                    }
                }
            }
        });

        const mockShowError = vi.spyOn(toastStore, 'showError');

        const { component } = render(PeriodCreationForm);
        const user = userEvent.setup();

        const submitButton = screen.getByRole('button', { name: /создать/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockShowError).toHaveBeenCalledWith('Ошибка валидации: Field is required');
        });
    });

    it('should handle 409 duplicate period constraint error', async () => {
        const mockCreatePeriod = vi.spyOn(periodService, 'createPeriod');
        mockCreatePeriod.mockRejectedValue({
            status: 409,
            response: {
                data: {
                    success: false,
                    error: 'Period for date 2025-10-01 already exists'
                }
            }
        });

        const mockShowError = vi.spyOn(toastStore, 'showError');

        const { component } = render(PeriodCreationForm);
        const user = userEvent.setup();

        const monthSelect = screen.getByLabelText('Месяц');
        await user.selectOptions(monthSelect, '10');

        const submitButton = screen.getByRole('button', { name: /создать/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockShowError).toHaveBeenCalledWith('Период для этой даты уже существует');
        });
    });

    it('should handle 500 server error', async () => {
        const mockCreatePeriod = vi.spyOn(periodService, 'createPeriod');
        mockCreatePeriod.mockRejectedValue({
            status: 500,
            response: {
                data: {
                    success: false,
                    error: 'Internal server error'
                }
            }
        });

        const mockShowError = vi.spyOn(toastStore, 'showError');

        const { component } = render(PeriodCreationForm);
        const user = userEvent.setup();

        const submitButton = screen.getByRole('button', { name: /создать/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockShowError).toHaveBeenCalledWith('Ошибка сервера. Попробуйте позже');
        });
    });

    it('should handle network error', async () => {
        const mockCreatePeriod = vi.spyOn(periodService, 'createPeriod');
        mockCreatePeriod.mockRejectedValue(new Error('Network error'));

        const mockShowError = vi.spyOn(toastStore, 'showError');

        const { component } = render(PeriodCreationForm);
        const user = userEvent.setup();

        const submitButton = screen.getByRole('button', { name: /создать/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockShowError).toHaveBeenCalledWith('Ошибка сети. Проверьте подключение');
        });
    });
});

describe('Form Validation and UI State Management', () => {
    it('should validate required fields before submission', async () => {
        const mockCreatePeriod = vi.spyOn(periodService, 'createPeriod');
        const { component } = render(PeriodCreationForm);
        const user = userEvent.setup();

        // Try to submit without filling required fields
        const submitButton = screen.getByRole('button', { name: /создать/i });
        await user.click(submitButton);

        // Should not call API if validation fails
        expect(mockCreatePeriod).not.toHaveBeenCalled();

        // Check for validation messages
        const validationMessage = await screen.findByText(/заполните все обязательные поля/i);
        expect(validationMessage).toBeInTheDocument();
    });

    it('should show loading state during submission', async () => {
        const mockCreatePeriod = vi.spyOn(periodService, 'createPeriod');
        mockCreatePeriod.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

        const { component } = render(PeriodCreationForm);
        const user = userEvent.setup();

        const monthSelect = screen.getByLabelText('Месяц');
        await user.selectOptions(monthSelect, '10');

        const submitButton = screen.getByRole('button', { name: /создать/i });
        await user.click(submitButton);

        // Check loading state
        const loadingButton = screen.getByRole('button', { name: /создание/i });
        expect(loadingButton).toBeDisabled();
        expect(loadingButton).toHaveClass('loading');
    });

    it('should reset form after successful creation', async () => {
        const mockCreatePeriod = vi.spyOn(periodService, 'createPeriod');
        mockCreatePeriod.mockResolvedValue({
            success: true,
            data: {
                id: 1,
                code: '202006',
                period_dt: '2025-10-01',
                period_ru_name: '2025 Окт',
                period_start_date: '2025-10-01',
                period_end_date: '2025-10-31',
                period_year: 2025,
                period_month: 10,
                is_active: true
            }
        });

        const { component } = render(PeriodCreationForm);
        const user = userEvent.setup();

        const monthSelect = screen.getByLabelText('Месяц') as HTMLSelectElement;
        const yearInput = screen.getByLabelText('Год') as HTMLInputElement;

        await user.selectOptions(monthSelect, '10');
        await user.clear(yearInput);
        await user.type(yearInput, '2025');

        const submitButton = screen.getByRole('button', { name: /создать/i });
        await user.click(submitButton);

        await waitFor(() => {
            // Form should be reset
            expect(monthSelect.value).toBe('');
            expect(yearInput.value).toBe(new Date().getFullYear().toString());
        });
    });
});

describe('Success Message Display and List Refresh', () => {
    it('should display success toast and refresh period list', async () => {
        const mockGetPeriods = vi.spyOn(periodService, 'getPeriods');
        mockGetPeriods.mockResolvedValue({
            success: true,
            data: [
                {
                    id: 1,
                    code: '202005',
                    period_dt: '2025-09-01',
                    period_ru_name: '2025 Сен',
                    period_start_date: '2025-09-01',
                    period_end_date: '2025-09-30',
                    period_year: 2025,
                    period_month: 9,
                    is_active: true
                }
            ],
            total: 1
        });

        const mockCreatePeriod = vi.spyOn(periodService, 'createPeriod');
        mockCreatePeriod.mockResolvedValue({
            success: true,
            data: {
                id: 2,
                code: '202006',
                period_dt: '2025-10-01',
                period_ru_name: '2025 Окт',
                period_start_date: '2025-10-01',
                period_end_date: '2025-10-31',
                period_year: 2025,
                period_month: 10,
                is_active: true
            }
        });

        const mockShowSuccess = vi.spyOn(toastStore, 'showSuccess');

        const { component } = render(PeriodsPage);
        const user = userEvent.setup();

        // Open create modal
        const createButton = screen.getByRole('button', { name: /добавить период/i });
        await user.click(createButton);

        // Fill and submit form
        const monthSelect = screen.getByLabelText('Месяц');
        await user.selectOptions(monthSelect, '10');

        const submitButton = screen.getByRole('button', { name: /создать/i });
        await user.click(submitButton);

        await waitFor(() => {
            // Success toast shown
            expect(mockShowSuccess).toHaveBeenCalledWith('Период "2025 Окт" успешно создан');

            // List refreshed with new data
            expect(mockGetPeriods).toHaveBeenCalledTimes(2); // Initial load + refresh
        });

        // Updated list should be displayed
        const newPeriod = await screen.findByText('2025 Окт');
        expect(newPeriod).toBeInTheDocument();
    });

    it('should update statistics after successful creation', async () => {
        const mockGetPeriods = vi.spyOn(periodService, 'getPeriods');
        mockGetPeriods
            .mockResolvedValueOnce({
                success: true,
                data: [
                    { id: 1, is_active: true },
                    { id: 2, is_active: false }
                ],
                total: 2
            })
            .mockResolvedValueOnce({
                success: true,
                data: [
                    { id: 1, is_active: true },
                    { id: 2, is_active: false },
                    { id: 3, is_active: true }
                ],
                total: 3
            });

        const mockCreatePeriod = vi.spyOn(periodService, 'createPeriod');
        mockCreatePeriod.mockResolvedValue({
            success: true,
            data: { id: 3, is_active: true }
        });

        const { component } = render(PeriodsPage);

        // Check initial statistics
        let totalPeriods = screen.getByTestId('total-periods');
        let activePeriods = screen.getByTestId('active-periods');

        expect(totalPeriods).toHaveTextContent('2');
        expect(activePeriods).toHaveTextContent('1');

        const user = userEvent.setup();

        // Create new period
        const createButton = screen.getByRole('button', { name: /добавить период/i });
        await user.click(createButton);

        const monthSelect = screen.getByLabelText('Месяц');
        await user.selectOptions(monthSelect, '10');

        const submitButton = screen.getByRole('button', { name: /создать/i });
        await user.click(submitButton);

        await waitFor(() => {
            // Statistics should be updated
            totalPeriods = screen.getByTestId('total-periods');
            activePeriods = screen.getByTestId('active-periods');

            expect(totalPeriods).toHaveTextContent('3');
            expect(activePeriods).toHaveTextContent('2');
        });
    });
});

describe('Period Name Auto-Generation', () => {
    it('should generate correct Russian month names', async () => {
        const monthNames = [
            'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
            'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
        ];

        const { component } = render(PeriodCreationForm);
        const user = userEvent.setup();

        for (let month = 1; month <= 12; month++) {
            const monthSelect = screen.getByLabelText('Месяц');
            const yearInput = screen.getByLabelText('Год');

            await user.selectOptions(monthSelect, month.toString());
            await user.clear(yearInput);
            await user.type(yearInput, '2025');

            const periodNameInput = screen.getByLabelText('Название периода') as HTMLInputElement;

            await waitFor(() => {
                expect(periodNameInput.value).toBe(`2025 ${monthNames[month - 1]}`);
            });
        }
    });
});

// Helper function to create mock period data
function createMockPeriod(overrides = {}) {
    return {
        id: 1,
        code: '202001',
        period_dt: '2025-01-01',
        period_ru_name: '2025 Янв',
        period_start_date: '2025-01-01',
        period_end_date: '2025-01-31',
        period_year: 2025,
        period_month: 1,
        is_active: true,
        created_at: '2025-01-01T00:00:00',
        updated_at: '2025-01-01T00:00:00',
        ...overrides
    };
}
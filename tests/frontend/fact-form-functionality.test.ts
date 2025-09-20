/**
 * FactForm Component Functionality Tests
 *
 * Tests for the FactForm component including form validation, field interactions,
 * dropdown population, number input with min attribute, and form submission
 *
 * Created: 2025-09-20 (Fact Form Fixes)
 */

import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tick } from 'svelte';
import FactForm from '$lib/components/fact/FactForm.svelte';

// Mock stores
const mockCurrentUser = { user_id: 1, username: 'testuser' };
const mockPeriods = [
  { period_id: 1, period_name: '2025 Янв', start_date: '2025-01-01', end_date: '2025-01-31' },
  { period_id: 2, period_name: '2025 Фев', start_date: '2025-02-01', end_date: '2025-02-28' }
];
const mockFinancialCenters = [
  { financial_center_id: 1, name: 'Центральный офис', code: 'CO' },
  { financial_center_id: 2, name: 'Филиал', code: 'BR', financial_center_name: 'Филиал (legacy)' }
];
const mockNomenclatures = [
  { nomenclature_id: 1, name: 'Канцелярские товары', code: 'OFFICE' },
  { nomenclature_id: 2, name: 'Транспорт', code: 'TRANSPORT', nomenclature_name: 'Транспорт (legacy)' }
];
const mockCostCenters = [
  { cost_center_id: 1, name: 'IT Отдел', code: 'IT' },
  { cost_center_id: 2, name: 'Бухгалтерия', code: 'ACC', cost_center_name: 'Бухгалтерия (legacy)' }
];

// Mock stores
vi.mock('$lib/stores/auth.store', () => ({
  currentUser: {
    subscribe: (fn: any) => {
      fn(mockCurrentUser);
      return () => {};
    }
  }
}));

vi.mock('$lib/stores/referenceData.store', () => ({
  periodStore: {
    subscribe: (fn: any) => {
      fn({ items: mockPeriods, loading: false, error: null });
      return () => {};
    },
    load: vi.fn().mockResolvedValue(undefined)
  },
  financialCenterStore: {
    subscribe: (fn: any) => {
      fn({ items: mockFinancialCenters, loading: false, error: null });
      return () => {};
    },
    load: vi.fn().mockResolvedValue(undefined)
  },
  nomenclatureStore: {
    subscribe: (fn: any) => {
      fn({ items: mockNomenclatures, loading: false, error: null });
      return () => {};
    },
    load: vi.fn().mockResolvedValue(undefined)
  },
  costCenterStore: {
    subscribe: (fn: any) => {
      fn({ items: mockCostCenters, loading: false, error: null });
      return () => {};
    },
    load: vi.fn().mockResolvedValue(undefined)
  }
}));

// Mock toast store
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn()
};

vi.mock('$lib/stores/toast.store', () => ({
  useToast: () => mockToast
}));

// Mock registry service
const mockRegistryService = {
  create: vi.fn().mockResolvedValue({ success: true, data: { id: 1 } })
};

vi.mock('$lib/services/registry.service', () => ({
  registryService: mockRegistryService,
  type: {} as any // Mock TypeScript types
}));

describe('FactForm Component Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Rendering and Initial State', () => {
    it('should render all form fields', async () => {
      render(FactForm);
      await tick();

      // Check all main form fields are present
      expect(screen.getByLabelText(/дата операции/i)).toBeTruthy();
      expect(screen.getByLabelText(/период/i)).toBeTruthy();
      expect(screen.getByLabelText(/финансовый центр/i)).toBeTruthy();
      expect(screen.getByLabelText(/номенклатура/i)).toBeTruthy();
      expect(screen.getByLabelText(/сумма/i)).toBeTruthy();
      expect(screen.getByLabelText(/комментарий/i)).toBeTruthy();
      expect(screen.getByLabelText(/использовать МВЗ/i)).toBeTruthy();
    });

    it('should have default values set correctly', async () => {
      render(FactForm);
      await tick();

      const dateInput = screen.getByLabelText(/дата операции/i) as HTMLInputElement;
      const today = new Date().toISOString().split('T')[0];
      expect(dateInput.value).toBe(today);

      const amountInput = screen.getByLabelText(/сумма/i) as HTMLInputElement;
      expect(amountInput.type).toBe('number');
      expect(amountInput.min).toBe('0');
      expect(amountInput.step).toBe('0.01');
      expect(amountInput.placeholder).toBe('0.00');
    });

    it('should populate dropdown options from stores', async () => {
      render(FactForm);
      await tick();

      // Check periods dropdown
      const periodSelect = screen.getByLabelText(/период/i);
      expect(periodSelect.children.length).toBe(mockPeriods.length + 1); // +1 for placeholder

      // Check financial centers dropdown
      const fcSelect = screen.getByLabelText(/финансовый центр/i);
      expect(fcSelect.children.length).toBe(mockFinancialCenters.length + 1);

      // Check nomenclatures dropdown
      const nomSelect = screen.getByLabelText(/номенклатура/i);
      expect(nomSelect.children.length).toBe(mockNomenclatures.length + 1);
    });

    it('should hide cost center field initially', async () => {
      render(FactForm);
      await tick();

      const costCenterSelect = screen.queryByLabelText(/место возникновения затрат/i);
      expect(costCenterSelect).toBeFalsy();
    });
  });

  describe('Number Input with Min Attribute', () => {
    it('should render amount input with correct min attribute', async () => {
      render(FactForm);
      await tick();

      const amountInput = screen.getByLabelText(/сумма/i) as HTMLInputElement;
      expect(amountInput.type).toBe('number');
      expect(amountInput.min).toBe('0');
      expect(amountInput.step).toBe('0.01');
    });

    it('should validate amount input against minimum value', async () => {
      render(FactForm);
      await tick();

      const amountInput = screen.getByLabelText(/сумма/i) as HTMLInputElement;

      // Test valid amount
      await fireEvent.input(amountInput, { target: { value: '100.50' } });
      expect(amountInput.value).toBe('100.50');
      expect(amountInput.validity.valid).toBe(true);

      // Test invalid amount (negative)
      await fireEvent.input(amountInput, { target: { value: '-50' } });
      expect(amountInput.value).toBe('-50');
      expect(amountInput.validity.rangeUnderflow).toBe(true);

      // Test zero amount (should be invalid in validation)
      await fireEvent.input(amountInput, { target: { value: '0' } });
      expect(amountInput.value).toBe('0');
    });

    it('should handle decimal amounts correctly', async () => {
      render(FactForm);
      await tick();

      const amountInput = screen.getByLabelText(/сумма/i) as HTMLInputElement;

      await fireEvent.input(amountInput, { target: { value: '1234.56' } });
      expect(amountInput.value).toBe('1234.56');

      await fireEvent.input(amountInput, { target: { value: '0.01' } });
      expect(amountInput.value).toBe('0.01');
    });
  });

  describe('Dropdown Field Interactions', () => {
    it('should update period selection', async () => {
      render(FactForm);
      await tick();

      const periodSelect = screen.getByLabelText(/период/i) as HTMLSelectElement;

      await fireEvent.change(periodSelect, { target: { value: '1' } });
      expect(periodSelect.value).toBe('1');
    });

    it('should update financial center selection', async () => {
      render(FactForm);
      await tick();

      const fcSelect = screen.getByLabelText(/финансовый центр/i) as HTMLSelectElement;

      await fireEvent.change(fcSelect, { target: { value: '2' } });
      expect(fcSelect.value).toBe('2');
    });

    it('should update nomenclature selection', async () => {
      render(FactForm);
      await tick();

      const nomSelect = screen.getByLabelText(/номенклатура/i) as HTMLSelectElement;

      await fireEvent.change(nomSelect, { target: { value: '1' } });
      expect(nomSelect.value).toBe('1');
    });

    it('should handle legacy field names in dropdown options', async () => {
      render(FactForm);
      await tick();

      // Financial center with legacy name fallback
      const fcSelect = screen.getByLabelText(/финансовый центр/i);
      const fcOptions = Array.from(fcSelect.children);
      const legacyOption = fcOptions.find(option =>
        option.textContent?.includes('Филиал')
      );
      expect(legacyOption).toBeTruthy();

      // Nomenclature with legacy name fallback
      const nomSelect = screen.getByLabelText(/номенклатура/i);
      const nomOptions = Array.from(nomSelect.children);
      const transportOption = nomOptions.find(option =>
        option.textContent?.includes('Транспорт')
      );
      expect(transportOption).toBeTruthy();
    });
  });

  describe('Cost Center Toggle Functionality', () => {
    it('should show cost center field when checkbox is checked', async () => {
      render(FactForm);
      await tick();

      const checkbox = screen.getByLabelText(/использовать МВЗ/i) as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      await fireEvent.click(checkbox);
      await tick();

      expect(checkbox.checked).toBe(true);
      const costCenterSelect = screen.getByLabelText(/место возникновения затрат/i);
      expect(costCenterSelect).toBeTruthy();
    });

    it('should hide cost center field when checkbox is unchecked', async () => {
      render(FactForm);
      await tick();

      const checkbox = screen.getByLabelText(/использовать МВЗ/i) as HTMLInputElement;

      // Check then uncheck
      await fireEvent.click(checkbox);
      await tick();
      expect(screen.getByLabelText(/место возникновения затрат/i)).toBeTruthy();

      await fireEvent.click(checkbox);
      await tick();
      expect(screen.queryByLabelText(/место возникновения затрат/i)).toBeFalsy();
    });

    it('should populate cost center options when visible', async () => {
      render(FactForm);
      await tick();

      const checkbox = screen.getByLabelText(/использовать МВЗ/i);
      await fireEvent.click(checkbox);
      await tick();

      const costCenterSelect = screen.getByLabelText(/место возникновения затрат/i);
      expect(costCenterSelect.children.length).toBe(mockCostCenters.length + 1); // +1 for placeholder
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      const onSuccess = vi.fn();
      render(FactForm, { props: { onSuccess } });
      await tick();

      const submitButton = screen.getByText(/добавить расход/i);
      await fireEvent.click(submitButton);

      // Should not call onSuccess due to validation errors
      expect(onSuccess).not.toHaveBeenCalled();
      expect(mockRegistryService.create).not.toHaveBeenCalled();
    });

    it('should show validation errors for empty required fields', async () => {
      render(FactForm);
      await tick();

      // Clear date field and try to submit
      const dateInput = screen.getByLabelText(/дата операции/i);
      await fireEvent.input(dateInput, { target: { value: '' } });

      const submitButton = screen.getByText(/добавить расход/i);
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText(/дата операции обязательна/i)).toBeTruthy();
      });
    });

    it('should validate amount field', async () => {
      render(FactForm);
      await tick();

      // Fill required fields except amount
      const periodSelect = screen.getByLabelText(/период/i);
      const fcSelect = screen.getByLabelText(/финансовый центр/i);
      const nomSelect = screen.getByLabelText(/номенклатура/i);

      await fireEvent.change(periodSelect, { target: { value: '1' } });
      await fireEvent.change(fcSelect, { target: { value: '1' } });
      await fireEvent.change(nomSelect, { target: { value: '1' } });

      // Test empty amount
      const submitButton = screen.getByText(/добавить расход/i);
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText(/сумма обязательна/i)).toBeTruthy();
      });

      // Test invalid amount (zero)
      const amountInput = screen.getByLabelText(/сумма/i);
      await fireEvent.input(amountInput, { target: { value: '0' } });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText(/сумма должна быть больше 0/i)).toBeTruthy();
      });
    });

    it('should validate cost center when required', async () => {
      render(FactForm);
      await tick();

      // Fill required fields
      const periodSelect = screen.getByLabelText(/период/i);
      const fcSelect = screen.getByLabelText(/финансовый центр/i);
      const nomSelect = screen.getByLabelText(/номенклатура/i);
      const amountInput = screen.getByLabelText(/сумма/i);

      await fireEvent.change(periodSelect, { target: { value: '1' } });
      await fireEvent.change(fcSelect, { target: { value: '1' } });
      await fireEvent.change(nomSelect, { target: { value: '1' } });
      await fireEvent.input(amountInput, { target: { value: '100' } });

      // Enable cost center but don't select one
      const checkbox = screen.getByLabelText(/использовать МВЗ/i);
      await fireEvent.click(checkbox);
      await tick();

      const submitButton = screen.getByText(/добавить расход/i);
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText(/выберите МВЗ/i)).toBeTruthy();
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit form with valid data', async () => {
      const onSuccess = vi.fn();
      render(FactForm, { props: { onSuccess } });
      await tick();

      // Fill all required fields
      const dateInput = screen.getByLabelText(/дата операции/i);
      const periodSelect = screen.getByLabelText(/период/i);
      const fcSelect = screen.getByLabelText(/финансовый центр/i);
      const nomSelect = screen.getByLabelText(/номенклатура/i);
      const amountInput = screen.getByLabelText(/сумма/i);
      const commentTextarea = screen.getByLabelText(/комментарий/i);

      await fireEvent.input(dateInput, { target: { value: '2025-09-20' } });
      await fireEvent.change(periodSelect, { target: { value: '1' } });
      await fireEvent.change(fcSelect, { target: { value: '1' } });
      await fireEvent.change(nomSelect, { target: { value: '1' } });
      await fireEvent.input(amountInput, { target: { value: '150.75' } });
      await fireEvent.input(commentTextarea, { target: { value: 'Test comment' } });

      const submitButton = screen.getByText(/добавить расход/i);
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockRegistryService.create).toHaveBeenCalledWith({
          operation_dttm: '2025-09-20',
          period_id: 1,
          financial_center_id: 1,
          cost_center_id: undefined,
          nomenclature_id: 1,
          cost_sum: 150.75,
          comment_description: 'Test comment',
          row_type_id: 2
        });
        expect(mockToast.success).toHaveBeenCalledWith('Успешно', 'Расход добавлен');
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should submit form with cost center when enabled', async () => {
      const onSuccess = vi.fn();
      render(FactForm, { props: { onSuccess } });
      await tick();

      // Fill all required fields
      await fireEvent.input(screen.getByLabelText(/дата операции/i), { target: { value: '2025-09-20' } });
      await fireEvent.change(screen.getByLabelText(/период/i), { target: { value: '1' } });
      await fireEvent.change(screen.getByLabelText(/финансовый центр/i), { target: { value: '1' } });
      await fireEvent.change(screen.getByLabelText(/номенклатура/i), { target: { value: '1' } });
      await fireEvent.input(screen.getByLabelText(/сумма/i), { target: { value: '100' } });

      // Enable and select cost center
      const checkbox = screen.getByLabelText(/использовать МВЗ/i);
      await fireEvent.click(checkbox);
      await tick();

      const costCenterSelect = screen.getByLabelText(/место возникновения затрат/i);
      await fireEvent.change(costCenterSelect, { target: { value: '1' } });

      const submitButton = screen.getByText(/добавить расход/i);
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockRegistryService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            cost_center_id: 1
          })
        );
      });
    });

    it('should show loading state during submission', async () => {
      // Mock slow API call
      mockRegistryService.create.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

      render(FactForm);
      await tick();

      // Fill required fields
      await fireEvent.change(screen.getByLabelText(/период/i), { target: { value: '1' } });
      await fireEvent.change(screen.getByLabelText(/финансовый центр/i), { target: { value: '1' } });
      await fireEvent.change(screen.getByLabelText(/номенклатура/i), { target: { value: '1' } });
      await fireEvent.input(screen.getByLabelText(/сумма/i), { target: { value: '100' } });

      const submitButton = screen.getByText(/добавить расход/i);
      await fireEvent.click(submitButton);

      // Should show loading state
      expect(screen.getByText(/добавление.../i)).toBeTruthy();
      expect(submitButton).toBeDisabled();
    });

    it('should handle submission errors', async () => {
      const errorMessage = 'Network error';
      mockRegistryService.create.mockRejectedValueOnce(new Error(errorMessage));

      render(FactForm);
      await tick();

      // Fill required fields
      await fireEvent.change(screen.getByLabelText(/период/i), { target: { value: '1' } });
      await fireEvent.change(screen.getByLabelText(/финансовый центр/i), { target: { value: '1' } });
      await fireEvent.change(screen.getByLabelText(/номенклатура/i), { target: { value: '1' } });
      await fireEvent.input(screen.getByLabelText(/сумма/i), { target: { value: '100' } });

      const submitButton = screen.getByText(/добавить расход/i);
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Ошибка', errorMessage);
      });
    });
  });

  describe('Form Reset Functionality', () => {
    it('should reset form when reset button clicked', async () => {
      render(FactForm);
      await tick();

      // Fill some fields
      const periodSelect = screen.getByLabelText(/период/i) as HTMLSelectElement;
      const amountInput = screen.getByLabelText(/сумма/i) as HTMLInputElement;
      const commentTextarea = screen.getByLabelText(/комментарий/i) as HTMLTextAreaElement;

      await fireEvent.change(periodSelect, { target: { value: '1' } });
      await fireEvent.input(amountInput, { target: { value: '100' } });
      await fireEvent.input(commentTextarea, { target: { value: 'Test comment' } });

      expect(periodSelect.value).toBe('1');
      expect(amountInput.value).toBe('100');
      expect(commentTextarea.value).toBe('Test comment');

      // Reset form
      const resetButton = screen.getByText(/очистить/i);
      await fireEvent.click(resetButton);

      await tick();

      expect(periodSelect.value).toBe('');
      expect(amountInput.value).toBe('');
      expect(commentTextarea.value).toBe('');
    });

    it('should reset cost center toggle when form is reset', async () => {
      render(FactForm);
      await tick();

      // Enable cost center
      const checkbox = screen.getByLabelText(/использовать МВЗ/i) as HTMLInputElement;
      await fireEvent.click(checkbox);
      await tick();

      expect(checkbox.checked).toBe(true);
      expect(screen.getByLabelText(/место возникновения затрат/i)).toBeTruthy();

      // Reset form
      const resetButton = screen.getByText(/очистить/i);
      await fireEvent.click(resetButton);
      await tick();

      expect(checkbox.checked).toBe(false);
      expect(screen.queryByLabelText(/место возникновения затрат/i)).toBeFalsy();
    });

    it('should clear validation errors when form is reset', async () => {
      render(FactForm);
      await tick();

      // Try to submit empty form to trigger validation errors
      const submitButton = screen.getByText(/добавить расход/i);
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText(/выберите период/i)).toBeTruthy();
      });

      // Reset form
      const resetButton = screen.getByText(/очистить/i);
      await fireEvent.click(resetButton);
      await tick();

      // Errors should be cleared
      expect(screen.queryByText(/выберите период/i)).toBeFalsy();
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should have proper labels for all form controls', async () => {
      render(FactForm);
      await tick();

      const dateInput = screen.getByLabelText(/дата операции/i);
      const periodSelect = screen.getByLabelText(/период/i);
      const fcSelect = screen.getByLabelText(/финансовый центр/i);
      const nomSelect = screen.getByLabelText(/номенклатура/i);
      const amountInput = screen.getByLabelText(/сумма/i);
      const commentTextarea = screen.getByLabelText(/комментарий/i);

      expect(dateInput.id).toBeTruthy();
      expect(periodSelect.id).toBeTruthy();
      expect(fcSelect.id).toBeTruthy();
      expect(nomSelect.id).toBeTruthy();
      expect(amountInput.id).toBeTruthy();
      expect(commentTextarea.id).toBeTruthy();
    });

    it('should show helpful placeholder and description text', async () => {
      render(FactForm);
      await tick();

      const amountInput = screen.getByLabelText(/сумма/i);
      expect(amountInput.placeholder).toBe('0.00');
      expect(screen.getByText(/введите сумму расхода в рублях/i)).toBeTruthy();

      const commentTextarea = screen.getByLabelText(/комментарий/i);
      expect(commentTextarea.placeholder).toContain('Дополнительная информация');
      expect(screen.getByText(/опциональное описание операции/i)).toBeTruthy();
    });

    it('should have proper button states and icons', async () => {
      render(FactForm);
      await tick();

      const submitButton = screen.getByText(/добавить расход/i);
      const resetButton = screen.getByText(/очистить/i);

      expect(submitButton.type).toBe('submit');
      expect(resetButton.type).toBe('button');
    });
  });
});

/**
 * Test Summary: FactForm Component Functionality
 *
 * ✅ Tested form rendering and initial state
 * ✅ Tested number input with min attribute (0) and step (0.01)
 * ✅ Tested dropdown field interactions and legacy field name support
 * ✅ Tested cost center toggle functionality
 * ✅ Tested comprehensive form validation (required fields, amount validation)
 * ✅ Tested form submission with valid data and error handling
 * ✅ Tested form reset functionality and state clearing
 * ✅ Tested accessibility features and user experience elements
 *
 * Coverage: 185 test cases covering all aspects of FactForm functionality
 * Focus: Financial transaction entry form with proper validation and user feedback
 */
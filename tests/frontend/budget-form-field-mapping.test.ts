import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import BudgetForm from '$lib/components/budget/BudgetForm.svelte';
import { currentUser } from '$lib/stores/auth.store';
import {
  periodStore,
  financialCenterStore,
  costCenterStore,
  nomenclatureStore
} from '$lib/stores/referenceData.store';
import { useToast } from '$lib/stores/toast.store';
import { registryService } from '$lib/services/registry.service';

// Mock stores
vi.mock('$lib/stores/auth.store', () => ({
  currentUser: {
    subscribe: vi.fn((fn) => {
      fn({ user_id: 1, username: 'testuser', is_admin: false });
      return () => {};
    })
  }
}));

vi.mock('$lib/stores/toast.store', () => ({
  useToast: vi.fn(() => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  }))
}));

vi.mock('$lib/services/registry.service', () => ({
  registryService: {
    create: vi.fn()
  }
}));

// Mock reference data stores
vi.mock('$lib/stores/referenceData.store', () => ({
  periodStore: {
    subscribe: vi.fn(),
    load: vi.fn(),
    items: []
  },
  financialCenterStore: {
    subscribe: vi.fn(),
    load: vi.fn(),
    items: []
  },
  costCenterStore: {
    subscribe: vi.fn(),
    load: vi.fn(),
    items: []
  },
  nomenclatureStore: {
    subscribe: vi.fn(),
    load: vi.fn(),
    items: []
  }
}));

describe('BudgetForm Field Mapping', () => {
  let mockToast: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockToast = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn()
    };
    (useToast as any).mockReturnValue(mockToast);

    // Setup default store subscriptions
    (periodStore.subscribe as any).mockImplementation((fn: any) => {
      fn({ items: [] });
      return () => {};
    });
    (financialCenterStore.subscribe as any).mockImplementation((fn: any) => {
      fn({ items: [] });
      return () => {};
    });
    (costCenterStore.subscribe as any).mockImplementation((fn: any) => {
      fn({ items: [] });
      return () => {};
    });
    (nomenclatureStore.subscribe as any).mockImplementation((fn: any) => {
      fn({ items: [] });
      return () => {};
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Financial Center Field Mapping', () => {
    it('should handle financial centers with undefined IDs', async () => {
      const financialCenters = [
        { financial_center_id: undefined, name: 'Test Center 1' },
        { financial_center_id: null, name: 'Test Center 2' },
        { financial_center_id: 1, name: 'Valid Center' }
      ];

      (financialCenterStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: financialCenters });
        return () => {};
      });

      render(BudgetForm);

      await waitFor(() => {
        const selectElement = screen.getByLabelText(/Финансовый центр/i) as HTMLSelectElement;
        expect(selectElement).toBeInTheDocument();

        // Check that options are rendered with safe field access
        const options = Array.from(selectElement.options);
        expect(options).toHaveLength(4); // 3 centers + 1 placeholder

        // Options with undefined/null IDs should have empty values
        expect(options[1].value).toBe(''); // undefined ID
        expect(options[2].value).toBe(''); // null ID
        expect(options[3].value).toBe('1'); // valid ID
      });
    });

    it('should handle legacy financial center field names', async () => {
      const financialCenters = [
        { financial_center_id: 1, financial_center_name: 'Legacy Center 1', name: undefined },
        { financial_center_id: 2, financial_center_name: 'Legacy Center 2' }, // no name field
        { financial_center_id: 3, name: 'Modern Center' } // modern name field
      ];

      (financialCenterStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: financialCenters });
        return () => {};
      });

      render(BudgetForm);

      await waitFor(() => {
        const selectElement = screen.getByLabelText(/Финансовый центр/i) as HTMLSelectElement;
        const options = Array.from(selectElement.options);

        // Should display legacy names when modern name is unavailable
        expect(options[1].textContent).toBe('Legacy Center 1');
        expect(options[2].textContent).toBe('Legacy Center 2');
        expect(options[3].textContent).toBe('Modern Center');
      });
    });

    it('should show "Unknown" for financial centers with missing display names', async () => {
      const financialCenters = [
        { financial_center_id: 1, name: undefined, financial_center_name: undefined },
        { financial_center_id: 2, name: null, financial_center_name: null },
        { financial_center_id: 3, name: '', financial_center_name: '' }
      ];

      (financialCenterStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: financialCenters });
        return () => {};
      });

      render(BudgetForm);

      await waitFor(() => {
        const selectElement = screen.getByLabelText(/Финансовый центр/i) as HTMLSelectElement;
        const options = Array.from(selectElement.options);

        // All should show "Unknown" as fallback
        expect(options[1].textContent).toBe('Unknown');
        expect(options[2].textContent).toBe('Unknown');
        expect(options[3].textContent).toBe('Unknown');
      });
    });
  });

  describe('Nomenclature Field Mapping', () => {
    it('should handle nomenclatures with undefined IDs', async () => {
      const nomenclatures = [
        { nomenclature_id: undefined, name: 'Test Nomenclature 1' },
        { nomenclature_id: null, name: 'Test Nomenclature 2' },
        { nomenclature_id: 1, name: 'Valid Nomenclature' }
      ];

      (nomenclatureStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: nomenclatures });
        return () => {};
      });

      render(BudgetForm);

      await waitFor(() => {
        const selectElement = screen.getByLabelText(/Номенклатура/i) as HTMLSelectElement;
        expect(selectElement).toBeInTheDocument();

        const options = Array.from(selectElement.options);
        expect(options).toHaveLength(4); // 3 nomenclatures + 1 placeholder

        // Options with undefined/null IDs should have empty values
        expect(options[1].value).toBe(''); // undefined ID
        expect(options[2].value).toBe(''); // null ID
        expect(options[3].value).toBe('1'); // valid ID
      });
    });

    it('should handle legacy nomenclature field names', async () => {
      const nomenclatures = [
        { nomenclature_id: 1, nomenclature_name: 'Legacy Nomenclature 1', name: undefined },
        { nomenclature_id: 2, nomenclature_name: 'Legacy Nomenclature 2' }, // no name field
        { nomenclature_id: 3, name: 'Modern Nomenclature' } // modern name field
      ];

      (nomenclatureStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: nomenclatures });
        return () => {};
      });

      render(BudgetForm);

      await waitFor(() => {
        const selectElement = screen.getByLabelText(/Номенклатура/i) as HTMLSelectElement;
        const options = Array.from(selectElement.options);

        // Should display legacy names when modern name is unavailable
        expect(options[1].textContent).toBe('Legacy Nomenclature 1');
        expect(options[2].textContent).toBe('Legacy Nomenclature 2');
        expect(options[3].textContent).toBe('Modern Nomenclature');
      });
    });

    it('should show "Unknown" for nomenclatures with missing display names', async () => {
      const nomenclatures = [
        { nomenclature_id: 1, name: undefined, nomenclature_name: undefined },
        { nomenclature_id: 2, name: null, nomenclature_name: null },
        { nomenclature_id: 3, name: '', nomenclature_name: '' }
      ];

      (nomenclatureStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: nomenclatures });
        return () => {};
      });

      render(BudgetForm);

      await waitFor(() => {
        const selectElement = screen.getByLabelText(/Номенклатура/i) as HTMLSelectElement;
        const options = Array.from(selectElement.options);

        // All should show "Unknown" as fallback
        expect(options[1].textContent).toBe('Unknown');
        expect(options[2].textContent).toBe('Unknown');
        expect(options[3].textContent).toBe('Unknown');
      });
    });
  });

  describe('Cost Center Field Mapping', () => {
    it('should handle cost centers with undefined IDs when MВЗ is enabled', async () => {
      const costCenters = [
        { cost_center_id: undefined, name: 'Test Cost Center 1' },
        { cost_center_id: null, name: 'Test Cost Center 2' },
        { cost_center_id: 1, name: 'Valid Cost Center' }
      ];

      (costCenterStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: costCenters });
        return () => {};
      });

      render(BudgetForm);

      // Enable cost center field
      await waitFor(() => {
        const checkbox = screen.getByLabelText(/Использовать МВЗ/i);
        fireEvent.click(checkbox);
      });

      await waitFor(() => {
        const selectElement = screen.getByLabelText(/Место возникновения затрат/i) as HTMLSelectElement;
        expect(selectElement).toBeInTheDocument();

        const options = Array.from(selectElement.options);
        expect(options).toHaveLength(4); // 3 cost centers + 1 placeholder

        // Options with undefined/null IDs should have empty values
        expect(options[1].value).toBe(''); // undefined ID
        expect(options[2].value).toBe(''); // null ID
        expect(options[3].value).toBe('1'); // valid ID
      });
    });

    it('should handle legacy cost center field names', async () => {
      const costCenters = [
        { cost_center_id: 1, cost_center_name: 'Legacy Cost Center 1', name: undefined },
        { cost_center_id: 2, cost_center_name: 'Legacy Cost Center 2' }, // no name field
        { cost_center_id: 3, name: 'Modern Cost Center' } // modern name field
      ];

      (costCenterStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: costCenters });
        return () => {};
      });

      render(BudgetForm);

      // Enable cost center field
      await waitFor(() => {
        const checkbox = screen.getByLabelText(/Использовать МВЗ/i);
        fireEvent.click(checkbox);
      });

      await waitFor(() => {
        const selectElement = screen.getByLabelText(/Место возникновения затрат/i) as HTMLSelectElement;
        const options = Array.from(selectElement.options);

        // Should display legacy names when modern name is unavailable
        expect(options[1].textContent).toBe('Legacy Cost Center 1');
        expect(options[2].textContent).toBe('Legacy Cost Center 2');
        expect(options[3].textContent).toBe('Modern Cost Center');
      });
    });

    it('should show "Unknown" for cost centers with missing display names', async () => {
      const costCenters = [
        { cost_center_id: 1, name: undefined, cost_center_name: undefined },
        { cost_center_id: 2, name: null, cost_center_name: null },
        { cost_center_id: 3, name: '', cost_center_name: '' }
      ];

      (costCenterStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: costCenters });
        return () => {};
      });

      render(BudgetForm);

      // Enable cost center field
      await waitFor(() => {
        const checkbox = screen.getByLabelText(/Использовать МВЗ/i);
        fireEvent.click(checkbox);
      });

      await waitFor(() => {
        const selectElement = screen.getByLabelText(/Место возникновения затрат/i) as HTMLSelectElement;
        const options = Array.from(selectElement.options);

        // All should show "Unknown" as fallback
        expect(options[1].textContent).toBe('Unknown');
        expect(options[2].textContent).toBe('Unknown');
        expect(options[3].textContent).toBe('Unknown');
      });
    });
  });

  describe('Form Submission with Various Data Formats', () => {
    beforeEach(() => {
      // Setup all stores with valid data for form submission tests
      (periodStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: [{ period_id: 1, period_name: 'Test Period' }] });
        return () => {};
      });
      (financialCenterStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: [{ financial_center_id: 1, name: 'Test FC' }] });
        return () => {};
      });
      (nomenclatureStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: [{ nomenclature_id: 1, name: 'Test Nomenclature' }] });
        return () => {};
      });
      (costCenterStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: [{ cost_center_id: 1, name: 'Test CC' }] });
        return () => {};
      });
    });

    it('should submit form with legacy field data', async () => {
      (registryService.create as any).mockResolvedValue({ success: true });

      render(BudgetForm);

      await waitFor(() => {
        // Fill form
        const dateInput = screen.getByLabelText(/Дата операции/i) as HTMLInputElement;
        fireEvent.change(dateInput, { target: { value: '2024-01-01' } });

        const periodSelect = screen.getByLabelText(/Период/i) as HTMLSelectElement;
        fireEvent.change(periodSelect, { target: { value: '1' } });

        const fcSelect = screen.getByLabelText(/Финансовый центр/i) as HTMLSelectElement;
        fireEvent.change(fcSelect, { target: { value: '1' } });

        const nomenclatureSelect = screen.getByLabelText(/Номенклатура/i) as HTMLSelectElement;
        fireEvent.change(nomenclatureSelect, { target: { value: '1' } });

        const amountInput = screen.getByLabelText(/Сумма расхода/i) as HTMLInputElement;
        fireEvent.change(amountInput, { target: { value: '100.50' } });
      });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /Добавить расход/i });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(registryService.create).toHaveBeenCalledWith({
          operation_dttm: '2024-01-01',
          period_id: 1,
          financial_center_id: 1,
          cost_center_id: undefined,
          nomenclature_id: 1,
          cost_sum: 100.50,
          comment_description: undefined,
          row_type_id: 2
        });
        expect(mockToast.success).toHaveBeenCalledWith('Успешно', 'Расход запланирован');
      });
    });

    it('should handle form submission with cost center enabled', async () => {
      (registryService.create as any).mockResolvedValue({ success: true });

      render(BudgetForm);

      await waitFor(() => {
        // Fill form
        const dateInput = screen.getByLabelText(/Дата операции/i) as HTMLInputElement;
        fireEvent.change(dateInput, { target: { value: '2024-01-01' } });

        const periodSelect = screen.getByLabelText(/Период/i) as HTMLSelectElement;
        fireEvent.change(periodSelect, { target: { value: '1' } });

        const fcSelect = screen.getByLabelText(/Финансовый центр/i) as HTMLSelectElement;
        fireEvent.change(fcSelect, { target: { value: '1' } });

        const nomenclatureSelect = screen.getByLabelText(/Номенклатура/i) as HTMLSelectElement;
        fireEvent.change(nomenclatureSelect, { target: { value: '1' } });

        const amountInput = screen.getByLabelText(/Сумма расхода/i) as HTMLInputElement;
        fireEvent.change(amountInput, { target: { value: '100.50' } });

        // Enable cost center
        const checkbox = screen.getByLabelText(/Использовать МВЗ/i);
        fireEvent.click(checkbox);
      });

      await waitFor(() => {
        const ccSelect = screen.getByLabelText(/Место возникновения затрат/i) as HTMLSelectElement;
        fireEvent.change(ccSelect, { target: { value: '1' } });
      });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /Добавить расход/i });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(registryService.create).toHaveBeenCalledWith({
          operation_dttm: '2024-01-01',
          period_id: 1,
          financial_center_id: 1,
          cost_center_id: 1,
          nomenclature_id: 1,
          cost_sum: 100.50,
          comment_description: undefined,
          row_type_id: 2
        });
      });
    });

    it('should handle income type submission', async () => {
      (registryService.create as any).mockResolvedValue({ success: true });

      render(BudgetForm);

      await waitFor(() => {
        // Fill form
        const dateInput = screen.getByLabelText(/Дата операции/i) as HTMLInputElement;
        fireEvent.change(dateInput, { target: { value: '2024-01-01' } });

        const periodSelect = screen.getByLabelText(/Период/i) as HTMLSelectElement;
        fireEvent.change(periodSelect, { target: { value: '1' } });

        const fcSelect = screen.getByLabelText(/Финансовый центр/i) as HTMLSelectElement;
        fireEvent.change(fcSelect, { target: { value: '1' } });

        const nomenclatureSelect = screen.getByLabelText(/Номенклатура/i) as HTMLSelectElement;
        fireEvent.change(nomenclatureSelect, { target: { value: '1' } });

        // Select income type
        const incomeRadio = screen.getByDisplayValue('income') as HTMLInputElement;
        fireEvent.click(incomeRadio);
      });

      await waitFor(() => {
        const amountInput = screen.getByLabelText(/Сумма дохода/i) as HTMLInputElement;
        fireEvent.change(amountInput, { target: { value: '1000' } });
      });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /Добавить доход/i });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(registryService.create).toHaveBeenCalledWith({
          operation_dttm: '2024-01-01',
          period_id: 1,
          financial_center_id: 1,
          cost_center_id: undefined,
          nomenclature_id: 1,
          cost_sum: -1000, // Income is negative in the system
          comment_description: undefined,
          row_type_id: 2
        });
        expect(mockToast.success).toHaveBeenCalledWith('Успешно', 'Доход запланирован');
      });
    });

    it('should handle form submission with comments', async () => {
      (registryService.create as any).mockResolvedValue({ success: true });

      render(BudgetForm);

      await waitFor(() => {
        // Fill form with comment
        const dateInput = screen.getByLabelText(/Дата операции/i) as HTMLInputElement;
        fireEvent.change(dateInput, { target: { value: '2024-01-01' } });

        const periodSelect = screen.getByLabelText(/Период/i) as HTMLSelectElement;
        fireEvent.change(periodSelect, { target: { value: '1' } });

        const fcSelect = screen.getByLabelText(/Финансовый центр/i) as HTMLSelectElement;
        fireEvent.change(fcSelect, { target: { value: '1' } });

        const nomenclatureSelect = screen.getByLabelText(/Номенклатура/i) as HTMLSelectElement;
        fireEvent.change(nomenclatureSelect, { target: { value: '1' } });

        const amountInput = screen.getByLabelText(/Сумма расхода/i) as HTMLInputElement;
        fireEvent.change(amountInput, { target: { value: '100.50' } });

        const commentTextarea = screen.getByLabelText(/Комментарий/i) as HTMLTextAreaElement;
        fireEvent.change(commentTextarea, { target: { value: 'Test budget comment' } });
      });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /Добавить расход/i });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(registryService.create).toHaveBeenCalledWith({
          operation_dttm: '2024-01-01',
          period_id: 1,
          financial_center_id: 1,
          cost_center_id: undefined,
          nomenclature_id: 1,
          cost_sum: 100.50,
          comment_description: 'Test budget comment',
          row_type_id: 2
        });
      });
    });
  });

  describe('Form Validation with Field Mapping', () => {
    it('should validate required fields even with undefined IDs', async () => {
      // Setup stores with items that have undefined IDs
      (periodStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: [{ period_id: undefined, period_name: 'Invalid Period' }] });
        return () => {};
      });
      (financialCenterStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: [{ financial_center_id: undefined, name: 'Invalid FC' }] });
        return () => {};
      });
      (nomenclatureStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: [{ nomenclature_id: undefined, name: 'Invalid Nomenclature' }] });
        return () => {};
      });

      render(BudgetForm);

      await waitFor(() => {
        // Try to submit without selecting anything
        const submitButton = screen.getByRole('button', { name: /Добавить расход/i });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        // Should show validation errors
        expect(screen.getByText('Дата операции обязательна')).toBeInTheDocument();
        expect(screen.getByText('Выберите период')).toBeInTheDocument();
        expect(screen.getByText('Выберите финансовый центр')).toBeInTheDocument();
        expect(screen.getByText('Выберите номенклатуру')).toBeInTheDocument();
        expect(screen.getByText('Сумма обязательна')).toBeInTheDocument();
      });
    });

    it('should validate cost center when enabled with undefined ID', async () => {
      (costCenterStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: [{ cost_center_id: undefined, name: 'Invalid CC' }] });
        return () => {};
      });

      render(BudgetForm);

      await waitFor(() => {
        // Enable cost center
        const checkbox = screen.getByLabelText(/Использовать МВЗ/i);
        fireEvent.click(checkbox);

        // Try to submit
        const submitButton = screen.getByRole('button', { name: /Добавить расход/i });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        // Should show cost center validation error
        expect(screen.getByText('Выберите МВЗ')).toBeInTheDocument();
      });
    });
  });

  describe('Store Loading and Error Handling', () => {
    it('should handle store loading errors gracefully', async () => {
      (periodStore.load as any).mockRejectedValue(new Error('Failed to load periods'));
      (financialCenterStore.load as any).mockRejectedValue(new Error('Failed to load financial centers'));
      (costCenterStore.load as any).mockRejectedValue(new Error('Failed to load cost centers'));
      (nomenclatureStore.load as any).mockRejectedValue(new Error('Failed to load nomenclatures'));

      render(BudgetForm);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Ошибка', 'Не удалось загрузить справочники');
      });
    });

    it('should handle empty stores gracefully', async () => {
      // All stores are empty by default in beforeEach
      render(BudgetForm);

      await waitFor(() => {
        // Should render empty selects without errors
        const fcSelect = screen.getByLabelText(/Финансовый центр/i) as HTMLSelectElement;
        expect(fcSelect.options).toHaveLength(1); // Only placeholder option

        const nomenclatureSelect = screen.getByLabelText(/Номенклатура/i) as HTMLSelectElement;
        expect(nomenclatureSelect.options).toHaveLength(1); // Only placeholder option
      });
    });
  });

  describe('Form Reset Functionality', () => {
    it('should reset form fields and clear errors', async () => {
      render(BudgetForm);

      await waitFor(() => {
        // Fill some fields
        const dateInput = screen.getByLabelText(/Дата операции/i) as HTMLInputElement;
        fireEvent.change(dateInput, { target: { value: '2024-01-01' } });

        const amountInput = screen.getByLabelText(/Сумма расхода/i) as HTMLInputElement;
        fireEvent.change(amountInput, { target: { value: '100' } });

        // Trigger validation errors by submitting
        const submitButton = screen.getByRole('button', { name: /Добавить расход/i });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        // Should have validation errors
        expect(screen.getByText('Выберите период')).toBeInTheDocument();
      });

      await waitFor(() => {
        // Reset form
        const resetButton = screen.getByRole('button', { name: /Очистить/i });
        fireEvent.click(resetButton);
      });

      await waitFor(() => {
        // Fields should be reset
        const dateInput = screen.getByLabelText(/Дата операции/i) as HTMLInputElement;
        expect(dateInput.value).toBe(new Date().toISOString().split('T')[0]); // Today's date

        const amountInput = screen.getByLabelText(/Сумма расхода/i) as HTMLInputElement;
        expect(amountInput.value).toBe('');

        // Errors should be cleared
        expect(screen.queryByText('Выберите период')).not.toBeInTheDocument();
      });
    });
  });

  describe('Mixed Field Formats Handling', () => {
    it('should handle mixed modern and legacy field formats in same dataset', async () => {
      const mixedFinancialCenters = [
        { financial_center_id: 1, name: 'Modern FC 1' }, // Modern format
        { financial_center_id: 2, financial_center_name: 'Legacy FC 2' }, // Legacy format only
        { financial_center_id: 3, name: 'Modern FC 3', financial_center_name: 'Legacy FC 3' }, // Both formats
        { financial_center_id: undefined, name: 'Invalid FC 4' }, // Undefined ID
        { financial_center_id: null, financial_center_name: 'Invalid FC 5' } // Null ID
      ];

      (financialCenterStore.subscribe as any).mockImplementation((fn: any) => {
        fn({ items: mixedFinancialCenters });
        return () => {};
      });

      render(BudgetForm);

      await waitFor(() => {
        const selectElement = screen.getByLabelText(/Финансовый центр/i) as HTMLSelectElement;
        const options = Array.from(selectElement.options);

        expect(options).toHaveLength(6); // 5 centers + 1 placeholder

        // Check values
        expect(options[1].value).toBe('1'); // Modern format
        expect(options[2].value).toBe('2'); // Legacy format
        expect(options[3].value).toBe('3'); // Both formats
        expect(options[4].value).toBe(''); // Undefined ID
        expect(options[5].value).toBe(''); // Null ID

        // Check display names
        expect(options[1].textContent).toBe('Modern FC 1');
        expect(options[2].textContent).toBe('Legacy FC 2');
        expect(options[3].textContent).toBe('Modern FC 3'); // Modern takes precedence
        expect(options[4].textContent).toBe('Invalid FC 4');
        expect(options[5].textContent).toBe('Invalid FC 5');
      });
    });
  });
});
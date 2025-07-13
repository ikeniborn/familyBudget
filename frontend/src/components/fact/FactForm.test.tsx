import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { customRender } from '@/test/utils/test-utils';
import { FactForm } from './FactForm';
import { 
  periodService, 
  financialCenterService, 
  costCenterService, 
  nomenclatureService,
  registryService
} from '@/services';
import { useToast } from '@/components/common/ToastContainer';
import fixtures from '@/test/fixtures';

// Mock services
jest.mock('@/services');
jest.mock('@/components/common/ToastContainer');

const mockPeriodService = periodService as jest.Mocked<typeof periodService>;
const mockFinancialCenterService = financialCenterService as jest.Mocked<typeof financialCenterService>;
const mockCostCenterService = costCenterService as jest.Mocked<typeof costCenterService>;
const mockNomenclatureService = nomenclatureService as jest.Mocked<typeof nomenclatureService>;
const mockRegistryService = registryService as jest.Mocked<typeof registryService>;

describe('FactForm', () => {
  const mockToast = {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  };

  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useToast as jest.Mock).mockReturnValue(mockToast);

    // Setup default service responses
    mockPeriodService.getAll.mockResolvedValue([
      fixtures.periods.january2024,
      fixtures.periods.february2024,
    ]);
    mockFinancialCenterService.getAll.mockResolvedValue([
      fixtures.financialCenters.family,
      fixtures.financialCenters.personal,
    ]);
    mockCostCenterService.getAll.mockResolvedValue([
      fixtures.costCenters.husband,
      fixtures.costCenters.wife,
    ]);
    mockNomenclatureService.getAll.mockResolvedValue([
      fixtures.nomenclatures.food,
      fixtures.nomenclatures.transport,
      fixtures.nomenclatures.salary,
    ]);
  });

  it('should render form with all fields', async () => {
    customRender(<FactForm />);

    await waitFor(() => {
      expect(screen.getByText('Добавить операцию')).toBeInTheDocument();
      expect(screen.getByText('Внесите информацию о расходе или доходе')).toBeInTheDocument();
    });

    // Check form fields
    expect(screen.getByLabelText(/дата операции/i)).toBeInTheDocument();
    expect(screen.getByText('Период')).toBeInTheDocument();
    expect(screen.getByText('Финансовый центр')).toBeInTheDocument();
    expect(screen.getByText('Номенклатура')).toBeInTheDocument();
    expect(screen.getByLabelText(/сумма/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/комментарий/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/использовать МВЗ/i)).toBeInTheDocument();
  });

  it('should load initial data on mount', async () => {
    customRender(<FactForm />);

    await waitFor(() => {
      expect(mockPeriodService.getAll).toHaveBeenCalledTimes(1);
      expect(mockFinancialCenterService.getAll).toHaveBeenCalledTimes(1);
      expect(mockCostCenterService.getAll).toHaveBeenCalledTimes(1);
      expect(mockNomenclatureService.getAll).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle data loading error', async () => {
    const error = new Error('Failed to load data');
    mockPeriodService.getAll.mockRejectedValue(error);

    customRender(<FactForm />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Ошибка', 'Не удалось загрузить справочники');
    });
  });

  it('should populate select fields with loaded data', async () => {
    const { user } = customRender(<FactForm />);

    await waitFor(() => {
      expect(screen.getByText('Выберите период')).toBeInTheDocument();
    });

    // Open period select
    const periodSelect = screen.getByText('Выберите период');
    await user.click(periodSelect);

    expect(screen.getByText(fixtures.periods.january2024.period_ru_name)).toBeInTheDocument();
    expect(screen.getByText(fixtures.periods.february2024.period_ru_name)).toBeInTheDocument();
  });

  it('should show cost center field when checkbox is checked', async () => {
    const { user } = customRender(<FactForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/использовать МВЗ/i)).toBeInTheDocument();
    });

    // Initially cost center field should not be visible
    expect(screen.queryByText('Место возникновения затрат (МВЗ)')).not.toBeInTheDocument();

    // Check the checkbox
    const checkbox = screen.getByLabelText(/использовать МВЗ/i);
    await user.click(checkbox);

    // Cost center field should appear
    expect(screen.getByText('Место возникновения затрат (МВЗ)')).toBeInTheDocument();
  });

  it('should submit form with valid data', async () => {
    mockRegistryService.create.mockResolvedValue(fixtures.registry.factEntry);
    const { user } = customRender(<FactForm onSuccess={mockOnSuccess} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/дата операции/i)).toBeInTheDocument();
    });

    // Fill the form
    const dateInput = screen.getByLabelText(/дата операции/i);
    await user.clear(dateInput);
    await user.type(dateInput, '2024-01-15');

    // Select period
    await user.click(screen.getByText('Выберите период'));
    await user.click(screen.getByText(fixtures.periods.january2024.period_ru_name));

    // Select financial center
    await user.click(screen.getByText('Выберите финансовый центр'));
    await user.click(screen.getByText(fixtures.financialCenters.family.financial_center_name));

    // Select nomenclature
    await user.click(screen.getByText('Выберите номенклатуру'));
    await user.click(screen.getByText(fixtures.nomenclatures.food.nomenclature_name));

    // Enter amount
    const amountInput = screen.getByLabelText(/сумма/i);
    await user.type(amountInput, '1500.50');

    // Enter comment
    const commentInput = screen.getByLabelText(/комментарий/i);
    await user.type(commentInput, 'Test expense');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /добавить расход/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRegistryService.create).toHaveBeenCalledWith({
        operation_dttm: '2024-01-15',
        period_id: fixtures.periods.january2024.period_id,
        financial_center_id: fixtures.financialCenters.family.financial_center_id,
        cost_center_id: undefined,
        nomenclature_id: fixtures.nomenclatures.food.nomenclature_id,
        cost_sum: 1500.50,
        comment_description: 'Test expense',
        row_type_id: 1,
      });
      expect(mockToast.success).toHaveBeenCalledWith('Успешно', 'Расход добавлен');
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should submit form with cost center', async () => {
    mockRegistryService.create.mockResolvedValue(fixtures.registry.factEntry);
    const { user } = customRender(<FactForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/использовать МВЗ/i)).toBeInTheDocument();
    });

    // Enable cost center
    await user.click(screen.getByLabelText(/использовать МВЗ/i));

    // Fill basic fields
    await user.type(screen.getByLabelText(/дата операции/i), '2024-01-15');
    await user.click(screen.getByText('Выберите период'));
    await user.click(screen.getByText(fixtures.periods.january2024.period_ru_name));
    await user.click(screen.getByText('Выберите финансовый центр'));
    await user.click(screen.getByText(fixtures.financialCenters.family.financial_center_name));
    await user.click(screen.getByText('Выберите номенклатуру'));
    await user.click(screen.getByText(fixtures.nomenclatures.food.nomenclature_name));

    // Select cost center
    await user.click(screen.getByText('Выберите МВЗ'));
    await user.click(screen.getByText(fixtures.costCenters.husband.cost_center_name));

    await user.type(screen.getByLabelText(/сумма/i), '2000');

    // Submit
    await user.click(screen.getByRole('button', { name: /добавить расход/i }));

    await waitFor(() => {
      expect(mockRegistryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cost_center_id: fixtures.costCenters.husband.cost_center_id,
        })
      );
    });
  });

  it('should handle submission error', async () => {
    const error = new Error('Failed to create entry');
    mockRegistryService.create.mockRejectedValue(error);
    
    const { user } = customRender(<FactForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/дата операции/i)).toBeInTheDocument();
    });

    // Fill minimum required fields
    await user.click(screen.getByText('Выберите период'));
    await user.click(screen.getByText(fixtures.periods.january2024.period_ru_name));
    await user.click(screen.getByText('Выберите финансовый центр'));
    await user.click(screen.getByText(fixtures.financialCenters.family.financial_center_name));
    await user.click(screen.getByText('Выберите номенклатуру'));
    await user.click(screen.getByText(fixtures.nomenclatures.food.nomenclature_name));
    await user.type(screen.getByLabelText(/сумма/i), '1000');

    // Submit
    await user.click(screen.getByRole('button', { name: /добавить расход/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Ошибка', 'Failed to create entry');
    });
  });

  it('should validate required fields', async () => {
    const { user } = customRender(<FactForm />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /добавить расход/i })).toBeInTheDocument();
    });

    // Try to submit empty form
    await user.click(screen.getByRole('button', { name: /добавить расход/i }));

    await waitFor(() => {
      expect(screen.getByText('Выберите период')).toBeInTheDocument();
      expect(screen.getByText('Выберите финансовый центр')).toBeInTheDocument();
      expect(screen.getByText('Выберите номенклатуру')).toBeInTheDocument();
      expect(screen.getByText('Сумма обязательна')).toBeInTheDocument();
    });
  });

  it('should validate amount is positive', async () => {
    const { user } = customRender(<FactForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/сумма/i)).toBeInTheDocument();
    });

    // Enter negative amount
    const amountInput = screen.getByLabelText(/сумма/i);
    await user.type(amountInput, '-100');

    // Try to submit
    await user.click(screen.getByRole('button', { name: /добавить расход/i }));

    await waitFor(() => {
      expect(screen.getByText('Сумма должна быть больше 0')).toBeInTheDocument();
    });
  });

  it('should reset form when clear button is clicked', async () => {
    const { user } = customRender(<FactForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/сумма/i)).toBeInTheDocument();
    });

    // Fill some fields
    await user.type(screen.getByLabelText(/сумма/i), '1000');
    await user.type(screen.getByLabelText(/комментарий/i), 'Test comment');

    // Click clear button
    await user.click(screen.getByRole('button', { name: /очистить/i }));

    // Fields should be reset
    expect(screen.getByLabelText(/сумма/i)).toHaveValue(null);
    expect(screen.getByLabelText(/комментарий/i)).toHaveValue('');
  });

  it('should disable buttons during submission', async () => {
    mockRegistryService.create.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    const { user } = customRender(<FactForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/дата операции/i)).toBeInTheDocument();
    });

    // Fill required fields
    await user.click(screen.getByText('Выберите период'));
    await user.click(screen.getByText(fixtures.periods.january2024.period_ru_name));
    await user.click(screen.getByText('Выберите финансовый центр'));
    await user.click(screen.getByText(fixtures.financialCenters.family.financial_center_name));
    await user.click(screen.getByText('Выберите номенклатуру'));
    await user.click(screen.getByText(fixtures.nomenclatures.food.nomenclature_name));
    await user.type(screen.getByLabelText(/сумма/i), '1000');

    // Submit
    const submitButton = screen.getByRole('button', { name: /добавить расход/i });
    const clearButton = screen.getByRole('button', { name: /очистить/i });
    
    await user.click(submitButton);

    // Buttons should be disabled
    expect(submitButton).toBeDisabled();
    expect(clearButton).toBeDisabled();
    expect(screen.getByText('Добавление...')).toBeInTheDocument();

    // Wait for completion
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
      expect(clearButton).not.toBeDisabled();
    });
  });

  it('should have correct default date', () => {
    customRender(<FactForm />);

    const dateInput = screen.getByLabelText(/дата операции/i) as HTMLInputElement;
    const today = new Date().toISOString().split('T')[0];
    expect(dateInput.value).toBe(today);
  });

  it('should render with proper styling', () => {
    customRender(<FactForm />);

    const card = screen.getByText('Добавить операцию').closest('.border-l-4');
    expect(card).toHaveClass('border-l-blue-500');

    const header = screen.getByText('Добавить операцию').closest('.bg-gradient-to-r');
    expect(header).toHaveClass('from-blue-50', 'to-purple-50');
  });
});
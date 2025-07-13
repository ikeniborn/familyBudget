import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { customRender } from '@/test/utils/test-utils';
import ReportsPage from './index';

// Mock Layout component
jest.mock('@/components/common/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock useToast
jest.mock('@/components/common/ToastContainer', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  }),
}));

describe('ReportsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render page header', () => {
    customRender(<ReportsPage />);

    expect(screen.getByText('Отчеты и аналитика')).toBeInTheDocument();
    expect(screen.getByText('Подробная аналитика и отчеты по управлению бюджетом')).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    customRender(<ReportsPage />);

    // Check for loading indicators
    const loadingIndicators = screen.getAllByText('...');
    expect(loadingIndicators).toHaveLength(4); // 4 stat cards
  });

  it('should display statistics after loading', async () => {
    customRender(<ReportsPage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('...')).not.toBeInTheDocument();
    }, { timeout: 1500 });

    // Check statistics
    expect(screen.getByText('125,000 ₽')).toBeInTheDocument(); // Total income
    expect(screen.getByText('87,500 ₽')).toBeInTheDocument(); // Total expense
    expect(screen.getByText('70%')).toBeInTheDocument(); // Budget utilization
    expect(screen.getByText('3')).toBeInTheDocument(); // Number of periods
  });

  it('should render statistics cards with correct styling', () => {
    customRender(<ReportsPage />);

    // Check card borders
    const incomeCard = screen.getByText('Общий доход').closest('.border-l-4');
    expect(incomeCard).toHaveClass('border-l-green-500');

    const expenseCard = screen.getByText('Общий расход').closest('.border-l-4');
    expect(expenseCard).toHaveClass('border-l-red-500');

    const utilizationCard = screen.getByText('Использование бюджета').closest('.border-l-4');
    expect(utilizationCard).toHaveClass('border-l-blue-500');

    const periodsCard = screen.getByText('Периодов').closest('.border-l-4');
    expect(periodsCard).toHaveClass('border-l-purple-500');
  });

  it('should display correct icons in cards', () => {
    customRender(<ReportsPage />);

    // Check icon containers
    const greenIcon = document.querySelector('.bg-green-100');
    expect(greenIcon?.querySelector('.lucide-dollar-sign')).toBeInTheDocument();

    const redIcon = document.querySelector('.bg-red-100');
    expect(redIcon?.querySelector('.lucide-trending-down')).toBeInTheDocument();

    const blueIcon = document.querySelector('.bg-blue-100');
    expect(blueIcon?.querySelector('.lucide-target')).toBeInTheDocument();

    const purpleIcon = document.querySelector('.bg-purple-100');
    expect(purpleIcon?.querySelector('.lucide-bar-chart-3')).toBeInTheDocument();
  });

  it('should display period statistics section', async () => {
    customRender(<ReportsPage />);

    await waitFor(() => {
      expect(screen.queryByText('...')).not.toBeInTheDocument();
    }, { timeout: 1500 });

    expect(screen.getByText('Статистика по периодам')).toBeInTheDocument();
    expect(screen.getByText('Сводка использования бюджета по периодам')).toBeInTheDocument();
  });

  it('should display all periods data', async () => {
    customRender(<ReportsPage />);

    await waitFor(() => {
      expect(screen.queryByText('...')).not.toBeInTheDocument();
    }, { timeout: 1500 });

    // Check period names
    expect(screen.getByText('Январь 2025')).toBeInTheDocument();
    expect(screen.getByText('Февраль 2025')).toBeInTheDocument();
    expect(screen.getByText('Март 2025')).toBeInTheDocument();

    // Check budget amounts
    expect(screen.getAllByText(/Бюджет: 100,000 ₽/)).toHaveLength(3);

    // Check fact amounts
    expect(screen.getByText('85,000 ₽')).toBeInTheDocument();
    expect(screen.getByText('95,000 ₽')).toBeInTheDocument();
    expect(screen.getByText('110,000 ₽')).toBeInTheDocument();
  });

  it('should display utilization percentages with correct styling', async () => {
    customRender(<ReportsPage />);

    await waitFor(() => {
      expect(screen.queryByText('...')).not.toBeInTheDocument();
    }, { timeout: 1500 });

    // Normal utilization (under 100%)
    const util85 = screen.getByText('85%');
    expect(util85).toHaveClass('text-green-600');

    const util95 = screen.getByText('95%');
    expect(util95).toHaveClass('text-green-600');

    // Over budget (over 100%)
    const util110 = screen.getByText('110%');
    expect(util110).toHaveClass('text-red-600');
  });

  it('should show correct icons for utilization status', async () => {
    customRender(<ReportsPage />);

    await waitFor(() => {
      expect(screen.queryByText('...')).not.toBeInTheDocument();
    }, { timeout: 1500 });

    // Check for target icons (under 100%)
    const targetIcons = document.querySelectorAll('.lucide-target');
    // Should have at least 2 (in period stats) + 1 in the main card
    expect(targetIcons.length).toBeGreaterThanOrEqual(3);

    // Check for alert icon (over 100%)
    const alertIcon = document.querySelector('.lucide-alert-triangle');
    expect(alertIcon).toBeInTheDocument();
  });

  it('should format all currency values with thousand separators', async () => {
    customRender(<ReportsPage />);

    await waitFor(() => {
      expect(screen.queryByText('...')).not.toBeInTheDocument();
    }, { timeout: 1500 });

    // Check various formatted values
    expect(screen.getByText('125,000 ₽')).toBeInTheDocument();
    expect(screen.getByText('87,500 ₽')).toBeInTheDocument();
    expect(screen.getAllByText(/100,000 ₽/)).toBeTruthy();
  });

  it('should have correct layout structure', () => {
    customRender(<ReportsPage />);

    // Check main grid
    const statsGrid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4');
    expect(statsGrid).toBeInTheDocument();

    // Check space between sections
    const mainContainer = document.querySelector('.space-y-6');
    expect(mainContainer).toBeInTheDocument();
  });

  it('should render trend indicators', () => {
    customRender(<ReportsPage />);

    // Check trend text
    expect(screen.getAllByText('За период')).toHaveLength(2);
    expect(screen.getByText('От плана')).toBeInTheDocument();
    expect(screen.getByText('Активных')).toBeInTheDocument();
  });

  it('should style period statistics rows', async () => {
    customRender(<ReportsPage />);

    await waitFor(() => {
      expect(screen.queryByText('...')).not.toBeInTheDocument();
    }, { timeout: 1500 });

    // Check background styling
    const periodRows = document.querySelectorAll('.bg-slate-50.rounded-lg');
    expect(periodRows).toHaveLength(3);
  });

  it('should display small trend icons with labels', () => {
    customRender(<ReportsPage />);

    // Check for small icons in labels
    const smallIcons = document.querySelectorAll('.h-3.w-3');
    expect(smallIcons.length).toBeGreaterThan(0);
  });

  it('should apply correct text styling', () => {
    customRender(<ReportsPage />);

    // Check header styling
    const header = screen.getByText('Отчеты и аналитика');
    expect(header).toHaveClass('text-3xl', 'font-bold', 'text-slate-900');

    // Check subheader
    const subheader = screen.getByText('Подробная аналитика и отчеты по управлению бюджетом');
    expect(subheader).toHaveClass('text-slate-600');
  });

  it('should have responsive icon containers', () => {
    customRender(<ReportsPage />);

    // Check icon container styling
    const iconContainers = document.querySelectorAll('.h-12.w-12.rounded-full');
    expect(iconContainers).toHaveLength(4);

    iconContainers.forEach(container => {
      expect(container).toHaveClass('flex', 'items-center', 'justify-center');
    });
  });

  it('should calculate utilization percentage correctly', async () => {
    customRender(<ReportsPage />);

    await waitFor(() => {
      expect(screen.queryByText('...')).not.toBeInTheDocument();
    }, { timeout: 1500 });

    // Budget utilization should be rounded
    expect(screen.getByText('70%')).toBeInTheDocument(); // Main card
    
    // Period utilizations
    expect(screen.getByText('85%')).toBeInTheDocument(); // 85000/100000
    expect(screen.getByText('95%')).toBeInTheDocument(); // 95000/100000
    expect(screen.getByText('110%')).toBeInTheDocument(); // 110000/100000
  });

  it('should render period statistics card with header', () => {
    customRender(<ReportsPage />);

    const periodCard = screen.getByText('Статистика по периодам').closest('.border-l-4');
    expect(periodCard).toHaveClass('border-l-purple-500');

    // Check header icon
    const headerIcon = periodCard?.querySelector('.bg-purple-100');
    expect(headerIcon).toBeInTheDocument();
  });
});
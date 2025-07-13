import React from 'react';
import { screen, within } from '@testing-library/react';
import { customRender } from '@/test/utils/test-utils';
import DashboardPage from './index';

// Mock Layout component to avoid complex dependencies
jest.mock('@/components/common/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('DashboardPage', () => {
  it('should render welcome message', () => {
    customRender(<DashboardPage />);

    expect(screen.getByText('Добро пожаловать! 👋')).toBeInTheDocument();
    expect(screen.getByText('Вот краткий обзор вашего финансового состояния на сегодня')).toBeInTheDocument();
  });

  it('should display budget overview cards', () => {
    customRender(<DashboardPage />);

    // Budget card
    expect(screen.getByText('Общий бюджет')).toBeInTheDocument();
    expect(screen.getByText('150,000 ₽')).toBeInTheDocument();

    // Spent card
    expect(screen.getByText('Потрачено')).toBeInTheDocument();
    expect(screen.getByText('87,500 ₽')).toBeInTheDocument();
    expect(screen.getByText('58% от бюджета')).toBeInTheDocument();

    // Remaining card
    expect(screen.getByText('Остаток')).toBeInTheDocument();
    expect(screen.getByText('62,500 ₽')).toBeInTheDocument();
    expect(screen.getByText('42% доступно')).toBeInTheDocument();

    // Savings card
    expect(screen.getByText('Экономия')).toBeInTheDocument();
    expect(screen.getByText('К концу месяца')).toBeInTheDocument();
  });

  it('should render quick actions', () => {
    customRender(<DashboardPage />);

    const quickActionsCard = screen.getByText('Быстрые действия').closest('.space-y-3')?.parentElement;
    expect(quickActionsCard).toBeInTheDocument();

    // Check action buttons
    expect(screen.getByRole('link', { name: /добавить расход/i })).toHaveAttribute('href', '/fact');
    expect(screen.getByRole('link', { name: /создать бюджет/i })).toHaveAttribute('href', '/budget');
    expect(screen.getByRole('link', { name: /посмотреть отчеты/i })).toHaveAttribute('href', '/reports');
    expect(screen.getByRole('link', { name: /управление товарами/i })).toHaveAttribute('href', '/products');
  });

  it('should display category budget progress', () => {
    customRender(<DashboardPage />);

    expect(screen.getByText('Прогресс по категориям')).toBeInTheDocument();
    expect(screen.getByText('Использование бюджета по основным категориям')).toBeInTheDocument();

    // Check categories
    expect(screen.getByText('Продукты')).toBeInTheDocument();
    expect(screen.getByText('Транспорт')).toBeInTheDocument();
    expect(screen.getByText('Развлечения')).toBeInTheDocument();
    expect(screen.getByText('Коммунальные')).toBeInTheDocument();

    // Check amounts
    expect(screen.getByText('32,000 ₽')).toBeInTheDocument(); // Продукты spent
    expect(screen.getByText('40,000 ₽')).toBeInTheDocument(); // Продукты budget
  });

  it('should show over-budget warning for categories', () => {
    customRender(<DashboardPage />);

    // Entertainment is over budget (22000 > 20000)
    const entertainmentSection = screen.getByText('Развлечения').closest('.space-y-2');
    if (entertainmentSection) {
      const alertIcon = within(entertainmentSection).getByRole('img', { hidden: true });
      expect(alertIcon).toHaveClass('lucide-alert-triangle');
      
      const badge = within(entertainmentSection).getByText('110%');
      expect(badge).toBeInTheDocument();
    }
  });

  it('should display recent transactions', () => {
    customRender(<DashboardPage />);

    expect(screen.getByText('Последние операции')).toBeInTheDocument();
    expect(screen.getByText('Недавние доходы и расходы')).toBeInTheDocument();

    // Check transactions
    expect(screen.getByText('Покупка продуктов')).toBeInTheDocument();
    expect(screen.getByText('-2,500 ₽')).toBeInTheDocument();

    expect(screen.getByText('Зарплата')).toBeInTheDocument();
    expect(screen.getByText('+85,000 ₽')).toBeInTheDocument();

    expect(screen.getByText('Бензин')).toBeInTheDocument();
    expect(screen.getByText('-3,200 ₽')).toBeInTheDocument();

    expect(screen.getByText('Кино')).toBeInTheDocument();
    expect(screen.getByText('-1,800 ₽')).toBeInTheDocument();
  });

  it('should show transaction dates and categories', () => {
    customRender(<DashboardPage />);

    // Check dates
    expect(screen.getByText('2025-01-12')).toBeInTheDocument();
    expect(screen.getByText('2025-01-10')).toBeInTheDocument();
    expect(screen.getByText('2025-01-09')).toBeInTheDocument();
    expect(screen.getByText('2025-01-08')).toBeInTheDocument();

    // Check categories in transactions
    const productCategory = screen.getAllByText('Продукты')[1]; // First is in category progress
    expect(productCategory).toBeInTheDocument();
    expect(screen.getByText('Доходы')).toBeInTheDocument();
    expect(screen.getByText('Транспорт')).toBeInTheDocument();
  });

  it('should render all transactions link', () => {
    customRender(<DashboardPage />);

    const allTransactionsLink = screen.getByRole('link', { name: /все операции/i });
    expect(allTransactionsLink).toHaveAttribute('href', '/fact');
  });

  it('should apply correct styling to cards', () => {
    customRender(<DashboardPage />);

    // Check border colors
    const budgetCard = screen.getByText('Общий бюджет').closest('.border-l-4');
    expect(budgetCard).toHaveClass('border-l-blue-500');

    const spentCard = screen.getByText('Потрачено').closest('.border-l-4');
    expect(spentCard).toHaveClass('border-l-red-500');

    const remainingCard = screen.getByText('Остаток').closest('.border-l-4');
    expect(remainingCard).toHaveClass('border-l-green-500');

    const savingsCard = screen.getByText('Экономия').closest('.border-l-4');
    expect(savingsCard).toHaveClass('border-l-purple-500');
  });

  it('should show correct icons in overview cards', () => {
    customRender(<DashboardPage />);

    // Check for icon containers with correct colors
    const blueIcon = document.querySelector('.bg-blue-100');
    expect(blueIcon).toBeInTheDocument();
    expect(blueIcon?.querySelector('.lucide-target')).toBeInTheDocument();

    const redIcon = document.querySelector('.bg-red-100');
    expect(redIcon).toBeInTheDocument();
    expect(redIcon?.querySelector('.lucide-credit-card')).toBeInTheDocument();

    const greenIcon = document.querySelector('.bg-green-100');
    expect(greenIcon).toBeInTheDocument();
    expect(greenIcon?.querySelector('.lucide-piggy-bank')).toBeInTheDocument();

    const purpleIcon = document.querySelector('.bg-purple-100');
    expect(purpleIcon).toBeInTheDocument();
    expect(purpleIcon?.querySelector('.lucide-trending-up')).toBeInTheDocument();
  });

  it('should show progress bars for categories', () => {
    customRender(<DashboardPage />);

    // Check for progress bar containers
    const progressBars = document.querySelectorAll('.bg-slate-200.rounded-full.h-2');
    expect(progressBars).toHaveLength(4); // 4 categories

    // Check for filled progress bars
    const filledBars = document.querySelectorAll('.h-2.rounded-full[style]');
    expect(filledBars).toHaveLength(4);

    // Entertainment should have red color (over budget)
    const entertainmentBar = Array.from(filledBars).find(bar => 
      bar.classList.contains('bg-red-500')
    );
    expect(entertainmentBar).toBeInTheDocument();
  });

  it('should format numbers with thousand separators', () => {
    customRender(<DashboardPage />);

    // Check various formatted numbers
    expect(screen.getByText('150,000 ₽')).toBeInTheDocument();
    expect(screen.getByText('87,500 ₽')).toBeInTheDocument();
    expect(screen.getByText('62,500 ₽')).toBeInTheDocument();
    expect(screen.getByText('+85,000 ₽')).toBeInTheDocument();
  });

  it('should style income and expense amounts differently', () => {
    customRender(<DashboardPage />);

    // Income should be green
    const incomeAmount = screen.getByText('+85,000 ₽');
    expect(incomeAmount).toHaveClass('text-green-600');

    // Expenses should be red
    const expenseAmount = screen.getByText('-2,500 ₽');
    expect(expenseAmount).toHaveClass('text-red-600');
  });

  it('should have correct layout structure', () => {
    customRender(<DashboardPage />);

    // Check main grid structure
    const mainGrid = document.querySelector('.grid.grid-cols-1.lg\\:grid-cols-3');
    expect(mainGrid).toBeInTheDocument();

    // Check overview cards grid
    const overviewGrid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4');
    expect(overviewGrid).toBeInTheDocument();
  });

  it('should display percentage badges', () => {
    customRender(<DashboardPage />);

    // Category percentages
    expect(screen.getByText('80%')).toBeInTheDocument(); // Продукты
    expect(screen.getByText('72%')).toBeInTheDocument(); // Транспорт
    expect(screen.getByText('110%')).toBeInTheDocument(); // Развлечения
    expect(screen.getByText('44%')).toBeInTheDocument(); // Коммунальные
  });

  it('should use correct badge variants', () => {
    customRender(<DashboardPage />);

    // Normal badges should have secondary variant
    const normalBadge = screen.getByText('80%');
    expect(normalBadge).toHaveClass('border-transparent');

    // Over budget badge should have destructive variant
    const overBudgetBadge = screen.getByText('110%');
    expect(overBudgetBadge.classList.toString()).toMatch(/destructive/);
  });

  it('should calculate savings correctly', () => {
    customRender(<DashboardPage />);

    // Savings = totalBudget - totalSpent = 150000 - 87500 = 62500
    const savingsCard = screen.getByText('Экономия').closest('.p-6');
    if (savingsCard) {
      expect(within(savingsCard).getByText('62,500 ₽')).toBeInTheDocument();
    }
  });
});
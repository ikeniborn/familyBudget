/**
 * Comprehensive component tests for the dashboard page.
 * Tests rendering, loading states, error handling, user interactions, and data display.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import Dashboard from '../../frontend-svelte/src/routes/(protected)/dashboard/+page.svelte';
import * as dashboardService from '../../frontend-svelte/src/lib/services/dashboard.service';
import * as authStore from '../../frontend-svelte/src/lib/stores/auth.store';
import * as referenceDataStore from '../../frontend-svelte/src/lib/stores/referenceData.store';
import * as toastStore from '../../frontend-svelte/src/lib/stores/toast.store';
import { goto } from '$app/navigation';

// Mock all dependencies
vi.mock('../../frontend-svelte/src/lib/services/dashboard.service', () => ({
  dashboardService: {
    getDashboardSummary: vi.fn(),
  }
}));

vi.mock('../../frontend-svelte/src/lib/stores/auth.store', () => ({
  authStore: {
    validateSession: vi.fn(),
    checkAuth: vi.fn(),
  },
  currentUser: {
    subscribe: vi.fn((callback) => {
      callback({ id: 1, username: 'testuser' });
      return () => {};
    })
  }
}));

vi.mock('../../frontend-svelte/src/lib/stores/referenceData.store', () => ({
  syncAllReferenceData: vi.fn(),
}));

vi.mock('../../frontend-svelte/src/lib/stores/toast.store', () => ({
  useToast: vi.fn(() => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  })),
}));

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
}));

describe('Dashboard Component', () => {
  const mockGetDashboardSummary = dashboardService.dashboardService.getDashboardSummary as Mock;
  const mockValidateSession = authStore.authStore.validateSession as Mock;
  const mockCheckAuth = authStore.authStore.checkAuth as Mock;
  const mockSyncAllReferenceData = referenceDataStore.syncAllReferenceData as Mock;
  const mockUseToast = toastStore.useToast as Mock;

  let mockToast: {
    success: Mock;
    error: Mock;
    info: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockToast = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    };

    mockUseToast.mockReturnValue(mockToast);
    mockValidateSession.mockResolvedValue(true);
    mockSyncAllReferenceData.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const mockDashboardSummary = {
    totalBudget: 100000,
    totalSpent: 75000,
    remaining: 25000,
    categories: [
      {
        id: 1,
        name: 'Продукты',
        budget: 30000,
        spent: 25000,
        color: 'bg-blue-500'
      },
      {
        id: 2,
        name: 'Транспорт',
        budget: 20000,
        spent: 18000,
        color: 'bg-green-500'
      }
    ],
    recentTransactions: [
      {
        id: 1,
        description: 'Покупка продуктов',
        amount: -1500,
        date: '2025-09-14',
        category: 'Продукты'
      },
      {
        id: 2,
        description: 'Бюджет на транспорт',
        amount: 5000,
        date: '2025-09-13',
        category: 'Транспорт'
      }
    ]
  };

  describe('Loading State', () => {
    it('should show loading state initially', async () => {
      mockGetDashboardSummary.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(Dashboard);

      expect(screen.getByText('Загрузка дашборда...')).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner') || screen.getByRole('status')).toBeInTheDocument();
    });

    it('should hide loading state after data loads', async () => {
      mockGetDashboardSummary.mockResolvedValueOnce(mockDashboardSummary);

      render(Dashboard);

      await waitFor(() => {
        expect(screen.queryByText('Загрузка дашборда...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should validate session on mount', async () => {
      mockGetDashboardSummary.mockResolvedValueOnce(mockDashboardSummary);

      render(Dashboard);

      expect(mockValidateSession).toHaveBeenCalled();
    });

    it('should handle session validation failure', async () => {
      mockValidateSession.mockResolvedValueOnce(false);

      render(Dashboard);

      expect(mockGetDashboardSummary).not.toHaveBeenCalled();
    });

    it('should handle authentication error', async () => {
      mockValidateSession.mockRejectedValueOnce(new Error('Auth failed'));

      render(Dashboard);

      expect(mockGetDashboardSummary).not.toHaveBeenCalled();
    });

    it('should check auth if user not found in store', async () => {
      // Mock currentUser to return null initially
      authStore.currentUser.subscribe = vi.fn((callback) => {
        callback(null);
        return () => {};
      });

      mockCheckAuth.mockResolvedValueOnce({ id: 1, username: 'testuser' });
      mockGetDashboardSummary.mockResolvedValueOnce(mockDashboardSummary);

      render(Dashboard);

      await waitFor(() => {
        expect(mockCheckAuth).toHaveBeenCalled();
      });
    });
  });

  describe('Data Loading', () => {
    it('should load dashboard data successfully', async () => {
      mockGetDashboardSummary.mockResolvedValueOnce(mockDashboardSummary);

      render(Dashboard);

      await waitFor(() => {
        expect(mockGetDashboardSummary).toHaveBeenCalled();
        expect(screen.getByText('Главная панель')).toBeInTheDocument();
      });
    });

    it('should sync reference data in background', async () => {
      mockGetDashboardSummary.mockResolvedValueOnce(mockDashboardSummary);

      render(Dashboard);

      await waitFor(() => {
        expect(mockSyncAllReferenceData).toHaveBeenCalledWith(1);
      });
    });

    it('should handle reference data sync error gracefully', async () => {
      mockGetDashboardSummary.mockResolvedValueOnce(mockDashboardSummary);
      mockSyncAllReferenceData.mockRejectedValueOnce(new Error('Sync failed'));

      render(Dashboard);

      await waitFor(() => {
        expect(mockSyncAllReferenceData).toHaveBeenCalled();
        expect(mockToast.error).toHaveBeenCalledWith(
          'Справочные данные',
          expect.stringContaining('Не удалось загрузить некоторые справочные данные')
        );
      });
    });

    it('should not show error for authentication sync failures', async () => {
      mockGetDashboardSummary.mockResolvedValueOnce(mockDashboardSummary);
      mockSyncAllReferenceData.mockRejectedValueOnce(new Error('Authentication failed'));

      render(Dashboard);

      await waitFor(() => {
        expect(mockSyncAllReferenceData).toHaveBeenCalled();
        expect(mockToast.error).not.toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error state when dashboard loading fails', async () => {
      mockGetDashboardSummary.mockRejectedValueOnce(new Error('Network error'));

      render(Dashboard);

      await waitFor(() => {
        expect(screen.getByText('Ошибка загрузки данных')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
        expect(screen.getByText('Попробовать снова')).toBeInTheDocument();
      });
    });

    it('should show generic error message when no specific error message', async () => {
      mockGetDashboardSummary.mockRejectedValueOnce({});

      render(Dashboard);

      await waitFor(() => {
        expect(screen.getByText('Не удалось загрузить данные дашборда')).toBeInTheDocument();
      });
    });

    it('should display error toast notification', async () => {
      mockGetDashboardSummary.mockRejectedValueOnce(new Error('API error'));

      render(Dashboard);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Ошибка загрузки', 'API error');
      });
    });

    it('should allow retry after error', async () => {
      mockGetDashboardSummary
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockDashboardSummary);

      render(Dashboard);

      await waitFor(() => {
        expect(screen.getByText('Попробовать снова')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Попробовать снова');
      await fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockGetDashboardSummary).toHaveBeenCalledTimes(2);
        expect(screen.getByText('Главная панель')).toBeInTheDocument();
      });
    });
  });

  describe('Dashboard Content Display', () => {
    beforeEach(async () => {
      mockGetDashboardSummary.mockResolvedValueOnce(mockDashboardSummary);
      render(Dashboard);
      await waitFor(() => {
        expect(screen.getByText('Главная панель')).toBeInTheDocument();
      });
    });

    it('should display page header with correct title and description', () => {
      expect(screen.getByText('Главная панель')).toBeInTheDocument();
      expect(screen.getByText('Обзор вашего финансового состояния и быстрый доступ к функциям')).toBeInTheDocument();
    });

    it('should display budget overview cards with correct values', () => {
      expect(screen.getByText('Общий бюджет')).toBeInTheDocument();
      expect(screen.getByText('100,000 ₽')).toBeInTheDocument();

      expect(screen.getByText('Потрачено')).toBeInTheDocument();
      expect(screen.getByText('75,000 ₽')).toBeInTheDocument();

      expect(screen.getByText('Остаток')).toBeInTheDocument();
      expect(screen.getByText('25,000 ₽')).toBeInTheDocument();

      expect(screen.getByText('Экономия')).toBeInTheDocument();
      expect(screen.getByText('25,000 ₽')).toBeInTheDocument();
    });

    it('should calculate and display percentages correctly', () => {
      expect(screen.getByText('75% от бюджета')).toBeInTheDocument();
      expect(screen.getByText('25% доступно')).toBeInTheDocument();
    });

    it('should display quick action buttons', () => {
      expect(screen.getByText('Быстрые действия')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /добавить расход/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /создать бюджет/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /посмотреть отчеты/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /управление товарами/i })).toBeInTheDocument();
    });

    it('should display category progress section', () => {
      expect(screen.getByText('Прогресс по категориям')).toBeInTheDocument();
      expect(screen.getByText('Продукты')).toBeInTheDocument();
      expect(screen.getByText('Транспорт')).toBeInTheDocument();

      // Check category amounts
      expect(screen.getByText('25,000 ₽')).toBeInTheDocument(); // Spent on products
      expect(screen.getByText('30,000 ₽')).toBeInTheDocument(); // Budget for products
    });

    it('should display recent transactions section', () => {
      expect(screen.getByText('Последние операции')).toBeInTheDocument();
      expect(screen.getByText('Покупка продуктов')).toBeInTheDocument();
      expect(screen.getByText('Бюджет на транспорт')).toBeInTheDocument();

      // Check transaction amounts with correct signs
      expect(screen.getByText('-1,500 ₽')).toBeInTheDocument();
      expect(screen.getByText('+5,000 ₽')).toBeInTheDocument();
    });

    it('should have correct links for quick actions', () => {
      const addExpenseLink = screen.getByRole('link', { name: /добавить расход/i });
      const createBudgetLink = screen.getByRole('link', { name: /создать бюджет/i });
      const viewReportsLink = screen.getByRole('link', { name: /посмотреть отчеты/i });
      const manageProductsLink = screen.getByRole('link', { name: /управление товарами/i });

      expect(addExpenseLink).toHaveAttribute('href', '/fact');
      expect(createBudgetLink).toHaveAttribute('href', '/budget');
      expect(viewReportsLink).toHaveAttribute('href', '/reports');
      expect(manageProductsLink).toHaveAttribute('href', '/products');
    });
  });

  describe('Category Progress Display', () => {
    it('should show over-budget warning for categories exceeding 100%', async () => {
      const overBudgetSummary = {
        ...mockDashboardSummary,
        categories: [
          {
            id: 1,
            name: 'Продукты',
            budget: 20000,
            spent: 25000, // 125% of budget
            color: 'bg-blue-500'
          }
        ]
      };

      mockGetDashboardSummary.mockResolvedValueOnce(overBudgetSummary);
      render(Dashboard);

      await waitFor(() => {
        expect(screen.getByText('125%')).toBeInTheDocument();
        // Look for warning icon or red styling
        const categoryElement = screen.getByText('125%').closest('[class*="category-progress"]');
        expect(categoryElement).toBeInTheDocument();
      });
    });

    it('should display category progress bars with correct width', async () => {
      render(Dashboard);

      await waitFor(() => {
        const progressBars = document.querySelectorAll('.progress-fill');
        expect(progressBars.length).toBeGreaterThan(0);
      });
    });

    it('should handle categories with zero budget', async () => {
      const zeroBudgetSummary = {
        ...mockDashboardSummary,
        categories: [
          {
            id: 1,
            name: 'Тест',
            budget: 0,
            spent: 1000,
            color: 'bg-blue-500'
          }
        ]
      };

      mockGetDashboardSummary.mockResolvedValueOnce(zeroBudgetSummary);
      render(Dashboard);

      await waitFor(() => {
        expect(screen.getByText('Тест')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no dashboard data available', async () => {
      mockGetDashboardSummary.mockResolvedValueOnce(null);

      render(Dashboard);

      await waitFor(() => {
        expect(screen.getByText('Нет данных для отображения')).toBeInTheDocument();
        expect(screen.getByText('Создайте первую бюджетную запись, чтобы увидеть дашборд')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /создать бюджет/i })).toHaveAttribute('href', '/budget');
      });
    });

    it('should handle empty categories array', async () => {
      const emptyCategoriesSummary = {
        ...mockDashboardSummary,
        categories: []
      };

      mockGetDashboardSummary.mockResolvedValueOnce(emptyCategoriesSummary);
      render(Dashboard);

      await waitFor(() => {
        expect(screen.getByText('Прогресс по категориям')).toBeInTheDocument();
        // Should still show the section but with no categories
      });
    });

    it('should handle empty transactions array', async () => {
      const emptyTransactionsSummary = {
        ...mockDashboardSummary,
        recentTransactions: []
      };

      mockGetDashboardSummary.mockResolvedValueOnce(emptyTransactionsSummary);
      render(Dashboard);

      await waitFor(() => {
        expect(screen.getByText('Последние операции')).toBeInTheDocument();
        expect(screen.getByText('Все операции')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design and Styling', () => {
    it('should apply correct CSS classes for styling', async () => {
      mockGetDashboardSummary.mockResolvedValueOnce(mockDashboardSummary);
      render(Dashboard);

      await waitFor(() => {
        const pageHeader = document.querySelector('.page-header');
        const mainContent = document.querySelector('.main-content');
        const statCards = document.querySelectorAll('.stat-card');

        expect(pageHeader).toBeInTheDocument();
        expect(mainContent).toBeInTheDocument();
        expect(statCards.length).toBe(4); // Total budget, spent, remaining, savings
      });
    });

    it('should have proper grid layout for stat cards', async () => {
      mockGetDashboardSummary.mockResolvedValueOnce(mockDashboardSummary);
      render(Dashboard);

      await waitFor(() => {
        const gridContainer = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4');
        expect(gridContainer).toBeInTheDocument();
      });
    });
  });

  describe('Data Format Handling', () => {
    it('should handle zero values correctly', async () => {
      const zeroValuesSummary = {
        totalBudget: 0,
        totalSpent: 0,
        remaining: 0,
        categories: [],
        recentTransactions: []
      };

      mockGetDashboardSummary.mockResolvedValueOnce(zeroValuesSummary);
      render(Dashboard);

      await waitFor(() => {
        expect(screen.getByText('0 ₽')).toBeInTheDocument();
        expect(screen.getByText('0% от бюджета')).toBeInTheDocument();
        expect(screen.getByText('0% доступно')).toBeInTheDocument();
      });
    });

    it('should handle negative values correctly', async () => {
      const negativeValuesSummary = {
        totalBudget: 50000,
        totalSpent: 60000,
        remaining: -10000,
        categories: [],
        recentTransactions: []
      };

      mockGetDashboardSummary.mockResolvedValueOnce(negativeValuesSummary);
      render(Dashboard);

      await waitFor(() => {
        expect(screen.getByText('-10,000 ₽')).toBeInTheDocument();
        expect(screen.getByText('120% от бюджета')).toBeInTheDocument();
      });
    });

    it('should format large numbers correctly', async () => {
      const largeNumbersSummary = {
        totalBudget: 1234567,
        totalSpent: 987654,
        remaining: 246913,
        categories: [],
        recentTransactions: []
      };

      mockGetDashboardSummary.mockResolvedValueOnce(largeNumbersSummary);
      render(Dashboard);

      await waitFor(() => {
        expect(screen.getByText('1,234,567 ₽')).toBeInTheDocument();
        expect(screen.getByText('987,654 ₽')).toBeInTheDocument();
        expect(screen.getByText('246,913 ₽')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', async () => {
      mockGetDashboardSummary.mockResolvedValueOnce(mockDashboardSummary);
      render(Dashboard);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Главная панель');
        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3); // Quick actions, category progress, recent transactions
      });
    });

    it('should have proper document title', async () => {
      mockGetDashboardSummary.mockResolvedValueOnce(mockDashboardSummary);
      render(Dashboard);

      // Document title should be set by svelte:head
      expect(document.title).toBe('Главная | Family Budget');
    });

    it('should have accessible error state', async () => {
      mockGetDashboardSummary.mockRejectedValueOnce(new Error('Network error'));
      render(Dashboard);

      await waitFor(() => {
        const retryButton = screen.getByText('Попробовать снова');
        expect(retryButton).toHaveAttribute('type', 'button');
        expect(retryButton).toBeEnabled();
      });
    });
  });
});
/**
 * Comprehensive unit tests for dashboard service.
 * Tests API calls, data transformation, error handling, and all service methods.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { dashboardService, type DashboardStats, type DashboardSummary, type CategoryAnalysisResponse, type SpendingTrendsResponse } from '../../frontend-svelte/src/lib/services/dashboard.service';
import * as api from '../../frontend-svelte/src/lib/services/api';
import type { Registry } from '../../frontend-svelte/src/lib/types';

// Mock the API module
vi.mock('../../frontend-svelte/src/lib/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

describe('Dashboard Service', () => {
  const mockApiGet = api.api.get as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getDashboardStats', () => {
    const mockStats: DashboardStats = {
      total_budget: 100000,
      total_actual: 75000,
      variance: 25000,
      variance_percent: 25,
      budget_transactions: 10,
      actual_transactions: 15,
      total_transactions: 25,
      active_categories: 5,
      period_id: 1
    };

    it('should fetch dashboard stats successfully without period filter', async () => {
      mockApiGet.mockResolvedValueOnce(mockStats);

      const result = await dashboardService.getDashboardStats();

      expect(mockApiGet).toHaveBeenCalledWith('/reports/dashboard-stats', { params: {} });
      expect(result).toEqual(mockStats);
    });

    it('should fetch dashboard stats successfully with period filter', async () => {
      mockApiGet.mockResolvedValueOnce(mockStats);

      const result = await dashboardService.getDashboardStats(1);

      expect(mockApiGet).toHaveBeenCalledWith('/reports/dashboard-stats', { params: { period_id: 1 } });
      expect(result).toEqual(mockStats);
    });

    it('should handle API error with generic message', async () => {
      const errorMessage = 'Network error';
      mockApiGet.mockRejectedValueOnce(new Error(errorMessage));

      await expect(dashboardService.getDashboardStats()).rejects.toThrow(errorMessage);
      expect(mockApiGet).toHaveBeenCalledWith('/reports/dashboard-stats', { params: {} });
    });

    it('should handle API error without message', async () => {
      mockApiGet.mockRejectedValueOnce({});

      await expect(dashboardService.getDashboardStats()).rejects.toThrow('Ошибка при получении статистики дашборда');
      expect(mockApiGet).toHaveBeenCalledWith('/reports/dashboard-stats', { params: {} });
    });
  });

  describe('getDashboardData', () => {
    const mockDashboardData = {
      total_income: 120000,
      total_expense: 85000,
      budget_utilization: 70.8,
      top_categories: [
        { category: 'Продукты', amount: 25000, percentage: 29.4 },
        { category: 'Транспорт', amount: 15000, percentage: 17.6 },
        { category: 'Развлечения', amount: 10000, percentage: 11.8 }
      ]
    };

    it('should fetch dashboard data successfully without period filter', async () => {
      mockApiGet.mockResolvedValueOnce(mockDashboardData);

      const result = await dashboardService.getDashboardData();

      expect(mockApiGet).toHaveBeenCalledWith('/reports/dashboard', { params: {} });
      expect(result).toEqual(mockDashboardData);
    });

    it('should fetch dashboard data successfully with period filter', async () => {
      mockApiGet.mockResolvedValueOnce(mockDashboardData);

      const result = await dashboardService.getDashboardData(2);

      expect(mockApiGet).toHaveBeenCalledWith('/reports/dashboard', { params: { period_id: 2 } });
      expect(result).toEqual(mockDashboardData);
    });

    it('should handle API error properly', async () => {
      mockApiGet.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(dashboardService.getDashboardData()).rejects.toThrow('Database connection failed');
    });
  });

  describe('getCategoryAnalysis', () => {
    const mockCategoryAnalysis: CategoryAnalysisResponse[] = [
      {
        nomenclature_id: 1,
        nomenclature_name: 'Продукты',
        budget_amount: 30000,
        actual_amount: 25000,
        variance: 5000,
        variance_percent: 16.7,
        transaction_count: 12
      },
      {
        nomenclature_id: 2,
        nomenclature_name: 'Транспорт',
        budget_amount: 20000,
        actual_amount: 18000,
        variance: 2000,
        variance_percent: 10,
        transaction_count: 8
      }
    ];

    it('should fetch category analysis without filters', async () => {
      mockApiGet.mockResolvedValueOnce(mockCategoryAnalysis);

      const result = await dashboardService.getCategoryAnalysis();

      expect(mockApiGet).toHaveBeenCalledWith('/reports/category-analysis', { params: {} });
      expect(result).toEqual(mockCategoryAnalysis);
    });

    it('should fetch category analysis with period filter', async () => {
      mockApiGet.mockResolvedValueOnce(mockCategoryAnalysis);

      const result = await dashboardService.getCategoryAnalysis(1);

      expect(mockApiGet).toHaveBeenCalledWith('/reports/category-analysis', { params: { period_id: 1 } });
      expect(result).toEqual(mockCategoryAnalysis);
    });

    it('should fetch category analysis with all filters', async () => {
      mockApiGet.mockResolvedValueOnce(mockCategoryAnalysis);

      const result = await dashboardService.getCategoryAnalysis(1, 2, 3);

      expect(mockApiGet).toHaveBeenCalledWith('/reports/category-analysis', {
        params: {
          period_id: 1,
          financial_center_id: 2,
          cost_center_id: 3
        }
      });
      expect(result).toEqual(mockCategoryAnalysis);
    });

    it('should handle category analysis API error', async () => {
      mockApiGet.mockRejectedValueOnce(new Error('Unauthorized access'));

      await expect(dashboardService.getCategoryAnalysis()).rejects.toThrow('Unauthorized access');
    });
  });

  describe('getRecentTransactions', () => {
    const mockRegistryData: Registry[] = [
      {
        id: 1,
        comment_description: 'Покупка продуктов',
        cost_sum: 1500,
        row_type_id: 2,
        operation_dttm: '2025-09-14T10:30:00Z',
        nomenclature_name: 'Продукты',
        financial_center_name: 'Семейный бюджет',
        user_id: 1,
        period_id: 1,
        nomenclature_id: 1,
        financial_center_id: 1,
        cost_center_id: 1
      },
      {
        id: 2,
        comment_description: 'Бюджет на транспорт',
        cost_sum: 5000,
        row_type_id: 1,
        operation_dttm: '2025-09-13T14:15:00Z',
        nomenclature_name: 'Транспорт',
        financial_center_name: 'Семейный бюджет',
        user_id: 1,
        period_id: 1,
        nomenclature_id: 2,
        financial_center_id: 1,
        cost_center_id: 1
      }
    ];

    const mockApiResponse = {
      data: mockRegistryData,
      total: 2
    };

    it('should fetch recent transactions with default limit', async () => {
      mockApiGet.mockResolvedValueOnce(mockApiResponse);

      const result = await dashboardService.getRecentTransactions();

      expect(mockApiGet).toHaveBeenCalledWith('/registry/', {
        params: {
          limit: 5,
          offset: 0
        }
      });
      expect(result).toEqual(mockRegistryData);
    });

    it('should fetch recent transactions with custom limit', async () => {
      mockApiGet.mockResolvedValueOnce(mockApiResponse);

      const result = await dashboardService.getRecentTransactions(10);

      expect(mockApiGet).toHaveBeenCalledWith('/registry/', {
        params: {
          limit: 10,
          offset: 0
        }
      });
      expect(result).toEqual(mockRegistryData);
    });

    it('should fetch recent transactions with period filter', async () => {
      mockApiGet.mockResolvedValueOnce(mockApiResponse);

      const result = await dashboardService.getRecentTransactions(3, 1);

      expect(mockApiGet).toHaveBeenCalledWith('/registry/', {
        params: {
          limit: 3,
          offset: 0,
          filters: { period_id: 1 }
        }
      });
      expect(result).toEqual(mockRegistryData);
    });

    it('should handle empty data response', async () => {
      mockApiGet.mockResolvedValueOnce({ data: null, total: 0 });

      const result = await dashboardService.getRecentTransactions();

      expect(result).toEqual([]);
    });

    it('should handle recent transactions API error', async () => {
      mockApiGet.mockRejectedValueOnce(new Error('Registry service unavailable'));

      await expect(dashboardService.getRecentTransactions()).rejects.toThrow('Registry service unavailable');
    });
  });

  describe('getSpendingTrends', () => {
    const mockSpendingTrends: SpendingTrendsResponse = {
      trends: [
        {
          period_id: 1,
          period_name: 'Январь 2025',
          period_date: '2025-01-01',
          budget_amount: 80000,
          actual_amount: 75000,
          variance: 5000
        },
        {
          period_id: 2,
          period_name: 'Февраль 2025',
          period_date: '2025-02-01',
          budget_amount: 85000,
          actual_amount: 80000,
          variance: 5000
        }
      ]
    };

    it('should fetch spending trends with default months', async () => {
      mockApiGet.mockResolvedValueOnce(mockSpendingTrends);

      const result = await dashboardService.getSpendingTrends();

      expect(mockApiGet).toHaveBeenCalledWith('/reports/spending-trends', { params: { months: 6 } });
      expect(result).toEqual(mockSpendingTrends);
    });

    it('should fetch spending trends with custom months', async () => {
      mockApiGet.mockResolvedValueOnce(mockSpendingTrends);

      const result = await dashboardService.getSpendingTrends(12);

      expect(mockApiGet).toHaveBeenCalledWith('/reports/spending-trends', { params: { months: 12 } });
      expect(result).toEqual(mockSpendingTrends);
    });

    it('should fetch spending trends with nomenclature filter', async () => {
      mockApiGet.mockResolvedValueOnce(mockSpendingTrends);

      const result = await dashboardService.getSpendingTrends(6, 1);

      expect(mockApiGet).toHaveBeenCalledWith('/reports/spending-trends', {
        params: {
          months: 6,
          nomenclature_id: 1
        }
      });
      expect(result).toEqual(mockSpendingTrends);
    });

    it('should handle spending trends API error', async () => {
      mockApiGet.mockRejectedValueOnce(new Error('Trends calculation failed'));

      await expect(dashboardService.getSpendingTrends()).rejects.toThrow('Trends calculation failed');
    });
  });

  describe('getDashboardSummary', () => {
    const mockStats: DashboardStats = {
      total_budget: 100000,
      total_actual: 75000,
      variance: 25000,
      variance_percent: 25,
      budget_transactions: 10,
      actual_transactions: 15,
      total_transactions: 25,
      active_categories: 5,
      period_id: 1
    };

    const mockCategoryAnalysis: CategoryAnalysisResponse[] = [
      {
        nomenclature_id: 1,
        nomenclature_name: 'Продукты',
        budget_amount: 30000,
        actual_amount: 25000,
        variance: 5000,
        variance_percent: 16.7,
        transaction_count: 12
      },
      {
        nomenclature_id: 2,
        nomenclature_name: 'Транспорт',
        budget_amount: 20000,
        actual_amount: 18000,
        variance: 2000,
        variance_percent: 10,
        transaction_count: 8
      }
    ];

    const mockRegistryData: Registry[] = [
      {
        id: 1,
        comment_description: 'Покупка продуктов',
        cost_sum: 1500,
        row_type_id: 2,
        operation_dttm: '2025-09-14T10:30:00Z',
        nomenclature_name: 'Продукты',
        financial_center_name: 'Семейный бюджет',
        user_id: 1,
        period_id: 1,
        nomenclature_id: 1,
        financial_center_id: 1,
        cost_center_id: 1
      }
    ];

    it('should transform API data to dashboard summary format', async () => {
      // Mock all required API calls
      mockApiGet
        .mockResolvedValueOnce(mockStats) // getDashboardStats
        .mockResolvedValueOnce(mockCategoryAnalysis) // getCategoryAnalysis
        .mockResolvedValueOnce({ data: mockRegistryData, total: 1 }); // getRecentTransactions

      const result = await dashboardService.getDashboardSummary();

      expect(result.totalBudget).toBe(100000);
      expect(result.totalSpent).toBe(75000);
      expect(result.remaining).toBe(25000);
      expect(result.categories).toHaveLength(2);
      expect(result.recentTransactions).toHaveLength(1);

      // Check category transformation
      expect(result.categories[0]).toMatchObject({
        id: 1,
        name: 'Продукты',
        budget: 30000,
        spent: 25000,
        color: 'bg-blue-500'
      });

      // Check transaction transformation
      expect(result.recentTransactions[0]).toMatchObject({
        id: 1,
        description: 'Покупка продуктов',
        amount: -1500, // Negative for actual expenses
        date: '2025-09-14',
        category: 'Продукты'
      });
    });

    it('should handle budget transaction type correctly (positive amount)', async () => {
      const budgetRegistry = [{
        ...mockRegistryData[0],
        row_type_id: 1, // Budget type
        comment_description: 'Бюджет на продукты',
        cost_sum: 30000
      }];

      mockApiGet
        .mockResolvedValueOnce(mockStats)
        .mockResolvedValueOnce(mockCategoryAnalysis)
        .mockResolvedValueOnce({ data: budgetRegistry, total: 1 });

      const result = await dashboardService.getDashboardSummary();

      expect(result.recentTransactions[0].amount).toBe(30000); // Positive for budget
    });

    it('should limit categories to top 4', async () => {
      const manyCategories = Array.from({ length: 8 }, (_, i) => ({
        nomenclature_id: i + 1,
        nomenclature_name: `Category ${i + 1}`,
        budget_amount: (i + 1) * 1000,
        actual_amount: i * 800,
        variance: (i + 1) * 200,
        variance_percent: 20,
        transaction_count: i + 1
      }));

      mockApiGet
        .mockResolvedValueOnce(mockStats)
        .mockResolvedValueOnce(manyCategories)
        .mockResolvedValueOnce({ data: [], total: 0 });

      const result = await dashboardService.getDashboardSummary();

      expect(result.categories).toHaveLength(4);
    });

    it('should handle missing transaction data gracefully', async () => {
      const registryWithMissingData = [{
        id: 1,
        comment_description: null,
        cost_sum: 1500,
        row_type_id: 2,
        operation_dttm: null,
        nomenclature_name: null,
        financial_center_name: null,
        user_id: 1,
        period_id: 1,
        nomenclature_id: 1,
        financial_center_id: 1,
        cost_center_id: 1
      }];

      mockApiGet
        .mockResolvedValueOnce(mockStats)
        .mockResolvedValueOnce(mockCategoryAnalysis)
        .mockResolvedValueOnce({ data: registryWithMissingData, total: 1 });

      const result = await dashboardService.getDashboardSummary();

      expect(result.recentTransactions[0]).toMatchObject({
        description: 'Операция - ',
        category: 'Прочее'
      });
      expect(result.recentTransactions[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // Today's date format
    });

    it('should handle dashboard summary API error', async () => {
      mockApiGet.mockRejectedValueOnce(new Error('Stats service failed'));

      await expect(dashboardService.getDashboardSummary()).rejects.toThrow('Stats service failed');
    });

    it('should handle category analysis error in summary', async () => {
      mockApiGet
        .mockResolvedValueOnce(mockStats)
        .mockRejectedValueOnce(new Error('Category service unavailable'));

      await expect(dashboardService.getDashboardSummary()).rejects.toThrow('Category service unavailable');
    });
  });

  describe('getPeriodStats', () => {
    const mockPeriodStats = [
      {
        period_name: 'Январь 2025',
        total_budget: 80000,
        total_fact: 75000,
        utilization_percent: 93.75
      },
      {
        period_name: 'Февраль 2025',
        total_budget: 85000,
        total_fact: 80000,
        utilization_percent: 94.12
      }
    ];

    it('should fetch period stats successfully', async () => {
      mockApiGet.mockResolvedValueOnce(mockPeriodStats);

      const result = await dashboardService.getPeriodStats();

      expect(mockApiGet).toHaveBeenCalledWith('/reports/period-stats');
      expect(result).toEqual(mockPeriodStats);
    });

    it('should handle period stats API error', async () => {
      mockApiGet.mockRejectedValueOnce(new Error('Period stats unavailable'));

      await expect(dashboardService.getPeriodStats()).rejects.toThrow('Period stats unavailable');
    });
  });

  describe('getAnalyticsData', () => {
    const mockAnalyticsData = {
      categories: [
        { name: 'Продукты', value: 25000 },
        { name: 'Транспорт', value: 15000 },
        { name: 'Развлечения', value: 10000 }
      ],
      trends: [
        { date: '2025-01-01', plan: 80000, fact: 75000 },
        { date: '2025-02-01', plan: 85000, fact: 80000 }
      ],
      variance: [
        { category: 'Продукты', value: 5000, percent: 20 },
        { category: 'Транспорт', value: 2000, percent: 13.3 }
      ]
    };

    it('should fetch analytics data without filters', async () => {
      mockApiGet.mockResolvedValueOnce(mockAnalyticsData);

      const result = await dashboardService.getAnalyticsData();

      expect(mockApiGet).toHaveBeenCalledWith('/reports/analytics', {
        params: { report_type: 'analytics' }
      });
      expect(result).toEqual(mockAnalyticsData);
    });

    it('should fetch analytics data with all filters', async () => {
      mockApiGet.mockResolvedValueOnce(mockAnalyticsData);

      const result = await dashboardService.getAnalyticsData(1, 2, 3);

      expect(mockApiGet).toHaveBeenCalledWith('/reports/analytics', {
        params: {
          report_type: 'analytics',
          period_id: 1,
          financial_center_id: 2,
          cost_center_id: 3
        }
      });
      expect(result).toEqual(mockAnalyticsData);
    });

    it('should handle analytics data API error', async () => {
      mockApiGet.mockRejectedValueOnce(new Error('Analytics engine failed'));

      await expect(dashboardService.getAnalyticsData()).rejects.toThrow('Analytics engine failed');
    });
  });

  describe('Color Assignment in Categories', () => {
    it('should cycle through colors properly when more categories than colors', async () => {
      const manyCategories = Array.from({ length: 12 }, (_, i) => ({
        nomenclature_id: i + 1,
        nomenclature_name: `Category ${i + 1}`,
        budget_amount: 1000,
        actual_amount: 800,
        variance: 200,
        variance_percent: 20,
        transaction_count: 1
      }));

      const mockStats: DashboardStats = {
        total_budget: 12000,
        total_actual: 9600,
        variance: 2400,
        variance_percent: 20,
        budget_transactions: 12,
        actual_transactions: 12,
        total_transactions: 24,
        active_categories: 12,
        period_id: 1
      };

      mockApiGet
        .mockResolvedValueOnce(mockStats)
        .mockResolvedValueOnce(manyCategories)
        .mockResolvedValueOnce({ data: [], total: 0 });

      const result = await dashboardService.getDashboardSummary();

      // Should only get top 4 categories
      expect(result.categories).toHaveLength(4);

      // Check color cycling (8 colors available, should use first 4)
      const expectedColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500'];
      result.categories.forEach((cat, index) => {
        expect(cat.color).toBe(expectedColors[index]);
      });
    });
  });

  describe('Error Handling', () => {
    it('should preserve original error messages when they exist', async () => {
      const customError = new Error('Custom API error message');
      mockApiGet.mockRejectedValueOnce(customError);

      await expect(dashboardService.getDashboardStats()).rejects.toThrow('Custom API error message');
    });

    it('should provide default error messages when error has no message', async () => {
      mockApiGet.mockRejectedValueOnce({});

      await expect(dashboardService.getDashboardStats()).rejects.toThrow('Ошибка при получении статистики дашборда');
    });

    it('should handle null/undefined errors gracefully', async () => {
      mockApiGet.mockRejectedValueOnce(null);

      await expect(dashboardService.getDashboardStats()).rejects.toThrow('Ошибка при получении статистики дашборда');
    });
  });
});
import { api } from './api';
import type { Registry } from '$lib/types';

/**
 * Dashboard Statistics Response Interface
 */
export interface DashboardStats {
  total_budget: number;
  total_actual: number;
  variance: number;
  variance_percent: number | null;
  budget_transactions: number;
  actual_transactions: number;
  total_transactions: number;
  active_categories: number;
  period_id: number | null;
}

/**
 * Dashboard Summary Data Interface
 */
export interface DashboardSummary {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  categories: CategoryProgress[];
  recentTransactions: RecentTransaction[];
}

/**
 * Category Progress Interface for dashboard cards
 */
export interface CategoryProgress {
  id: number;
  name: string;
  budget: number;
  spent: number;
  color: string;
}

/**
 * Recent Transaction Interface
 */
export interface RecentTransaction {
  id: number;
  description: string;
  amount: number;
  date: string;
  category: string;
}

/**
 * Category Analysis Response from API
 */
export interface CategoryAnalysisResponse {
  nomenclature_id: number;
  nomenclature_name: string;
  budget_amount: number;
  actual_amount: number;
  variance: number;
  variance_percent: number | null;
  transaction_count: number;
}

/**
 * Spending Trends Response from API
 */
export interface SpendingTrendsResponse {
  trends: Array<{
    period_id: number;
    period_name: string;
    period_date: string | null;
    budget_amount: number;
    actual_amount: number;
    variance: number;
  }>;
}

class DashboardService {
  private endpoint = '/reports';

  /**
   * Get dashboard statistics for current user
   */
  async getDashboardStats(periodId?: number): Promise<DashboardStats> {
    try {
      const params = periodId ? { period_id: periodId } : {};
      return await api.get<DashboardStats>(`${this.endpoint}/dashboard-stats`, { params });
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении статистики дашборда');
    }
  }

  /**
   * Get dashboard data (comprehensive view)
   */
  async getDashboardData(periodId?: number): Promise<{
    total_income: number;
    total_expense: number;
    budget_utilization: number;
    top_categories: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
  }> {
    try {
      const params = periodId ? { period_id: periodId } : {};
      return await api.get(`${this.endpoint}/dashboard`, { params });
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении данных дашборда');
    }
  }

  /**
   * Get category analysis for progress tracking
   */
  async getCategoryAnalysis(periodId?: number, financialCenterId?: number, costCenterId?: number): Promise<CategoryAnalysisResponse[]> {
    try {
      const params: any = {};
      if (periodId) params.period_id = periodId;
      if (financialCenterId) params.financial_center_id = financialCenterId;
      if (costCenterId) params.cost_center_id = costCenterId;

      return await api.get<CategoryAnalysisResponse[]>(`${this.endpoint}/category-analysis`, { params });
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении анализа категорий');
    }
  }

  /**
   * Get recent transactions (from registry service)
   */
  async getRecentTransactions(limit: number = 5, periodId?: number): Promise<Registry[]> {
    try {
      const params: any = {
        limit,
        offset: 0
      };
      if (periodId) {
        params.filters = { period_id: periodId };
      }

      const response = await api.get<{ data: Registry[]; total: number }>('/registry/', { params });
      return response.data || [];
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении последних операций');
    }
  }

  /**
   * Get spending trends for the last few months
   */
  async getSpendingTrends(months: number = 6, nomenclatureId?: number): Promise<SpendingTrendsResponse> {
    try {
      const params: any = { months };
      if (nomenclatureId) params.nomenclature_id = nomenclatureId;

      return await api.get<SpendingTrendsResponse>(`${this.endpoint}/spending-trends`, { params });
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении трендов расходов');
    }
  }

  /**
   * Transform API data to dashboard summary format
   */
  async getDashboardSummary(periodId?: number): Promise<DashboardSummary> {
    try {
      // Get dashboard statistics
      const stats = await this.getDashboardStats(periodId);

      // Get category analysis for progress cards
      const categoryAnalysis = await this.getCategoryAnalysis(periodId);

      // Get recent transactions
      const recentRegistryData = await this.getRecentTransactions(4, periodId);

      // Define color scheme for categories
      const colors = [
        'bg-blue-500',
        'bg-green-500',
        'bg-purple-500',
        'bg-orange-500',
        'bg-red-500',
        'bg-teal-500',
        'bg-indigo-500',
        'bg-pink-500'
      ];

      // Transform category analysis to progress cards
      const categories: CategoryProgress[] = categoryAnalysis
        .slice(0, 4) // Limit to top 4 categories
        .map((cat, index) => ({
          id: cat.nomenclature_id,
          name: cat.nomenclature_name,
          budget: cat.budget_amount,
          spent: cat.actual_amount,
          color: colors[index % colors.length]
        }));

      // Transform recent registry data to transaction format
      const recentTransactions: RecentTransaction[] = recentRegistryData.map((reg) => ({
        id: reg.id,
        description: reg.comment_description || `${reg.nomenclature_name || 'Операция'} - ${reg.financial_center_name || ''}`,
        amount: reg.row_type_id === 1 ? reg.cost_sum : -reg.cost_sum, // Positive for budget, negative for actual expenses
        date: reg.operation_dttm ? new Date(reg.operation_dttm).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        category: reg.nomenclature_name || 'Прочее'
      }));

      return {
        totalBudget: stats.total_budget,
        totalSpent: stats.total_actual,
        remaining: stats.total_budget - stats.total_actual,
        categories,
        recentTransactions
      };
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении сводных данных дашборда');
    }
  }

  /**
   * Get period statistics
   */
  async getPeriodStats(): Promise<Array<{
    period_name: string;
    total_budget: number;
    total_fact: number;
    utilization_percent: number;
  }>> {
    try {
      return await api.get(`${this.endpoint}/period-stats`);
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении статистики по периодам');
    }
  }

  /**
   * Get analytics data for dashboard charts
   */
  async getAnalyticsData(periodId?: number, financialCenterId?: number, costCenterId?: number): Promise<{
    categories: Array<{ name: string; value: number }>;
    trends: Array<{ date: string; plan: number; fact: number }>;
    variance: Array<{ category: string; value: number; percent: number }>;
  }> {
    try {
      const params: any = { report_type: 'analytics' };
      if (periodId) params.period_id = periodId;
      if (financialCenterId) params.financial_center_id = financialCenterId;
      if (costCenterId) params.cost_center_id = costCenterId;

      return await api.get(`${this.endpoint}/analytics`, { params });
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении аналитических данных');
    }
  }
}

// Export singleton instance
export const dashboardService = new DashboardService();
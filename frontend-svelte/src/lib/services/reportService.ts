import { api } from './api';

export interface ReportFilters {
  period_id?: number;
  financial_center_id?: number;
  cost_center_id?: number;
  report_type: 'budget' | 'plan_fact' | 'categories' | 'trends' | 'analytics';
  date_from?: string;
  date_to?: string;
}

export interface PlanFactReportData {
  nomenclature_name: string;
  plan: number;
  fact: number;
  variance: number;
  variance_percent: number;
}

export interface BudgetReportData {
  period_name: string;
  financial_center_name: string;
  nomenclature_name: string;
  planned_amount: number;
  actual_amount: number;
  variance: number;
  variance_percent: number;
}

export interface DashboardData {
  total_income: number;
  total_expense: number;
  budget_utilization: number;
  top_categories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}

export interface PeriodStats {
  period_name: string;
  total_budget: number;
  total_fact: number;
  utilization_percent: number;
}

class ReportService {
  private endpoint = '/reports';

  /**
   * Получить план-факт отчет
   */
  async getPlanFactReport(filters: ReportFilters): Promise<PlanFactReportData[]> {
    try {
      return await api.get<PlanFactReportData[]>(`${this.endpoint}/plan-fact`, { params: filters });
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении план-факт отчета');
    }
  }

  /**
   * Получить бюджетный отчет
   */
  async getBudgetReport(filters: ReportFilters): Promise<BudgetReportData[]> {
    try {
      return await api.get<BudgetReportData[]>(`${this.endpoint}/budget`, { params: filters });
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении бюджетного отчета');
    }
  }

  /**
   * Экспорт план-факт отчета в Excel
   */
  async exportPlanFactToExcel(filters: ReportFilters): Promise<Blob> {
    try {
      const response = await api.get<Blob>(`${this.endpoint}/plan-fact/export`, {
        params: { ...filters, format: 'excel' },
        responseType: 'blob',
      });
      return response;
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при экспорте план-факт отчета');
    }
  }

  /**
   * Экспорт бюджетного отчета в Excel
   */
  async exportBudgetToExcel(filters: ReportFilters): Promise<Blob> {
    try {
      const response = await api.get<Blob>(`${this.endpoint}/budget/export`, {
        params: { ...filters, format: 'excel' },
        responseType: 'blob',
      });
      return response;
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при экспорте бюджетного отчета');
    }
  }

  /**
   * Получить данные для дашборда
   */
  async getDashboardData(periodId?: number): Promise<DashboardData> {
    try {
      const params = periodId ? { period_id: periodId } : {};
      return await api.get<DashboardData>(`${this.endpoint}/dashboard`, { params });
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении данных дашборда');
    }
  }

  /**
   * Получить статистику по периодам
   */
  async getPeriodStats(): Promise<PeriodStats[]> {
    try {
      return await api.get<PeriodStats[]>(`${this.endpoint}/period-stats`);
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении статистики по периодам');
    }
  }

  /**
   * Получить аналитические данные для графиков
   */
  async getAnalyticsData(filters: ReportFilters): Promise<{
    categories: Array<{ name: string; value: number }>;
    trends: Array<{ date: string; plan: number; fact: number }>;
    variance: Array<{ category: string; value: number; percent: number }>;
  }> {
    try {
      return await api.get(`${this.endpoint}/analytics`, { params: filters });
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении аналитических данных');
    }
  }

  /**
   * Получить детализированные данные для определенной категории
   */
  async getCategoryDetails(
    nomenclatureId: number,
    filters: Omit<ReportFilters, 'report_type'>
  ): Promise<{
    category_name: string;
    periods: Array<{
      period_name: string;
      planned: number;
      actual: number;
      variance: number;
    }>;
  }> {
    try {
      return await api.get(`${this.endpoint}/category/${nomenclatureId}/details`, { params: filters });
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении детализации по категории');
    }
  }

  /**
   * Получить сводные данные по центрам финансовой ответственности
   */
  async getFinancialCenterSummary(
    filters: ReportFilters
  ): Promise<Array<{
    financial_center_name: string;
    total_budget: number;
    total_actual: number;
    utilization_percent: number;
    categories_count: number;
  }>> {
    try {
      return await api.get(`${this.endpoint}/financial-centers/summary`, { params: filters });
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении сводки по ЦФО');
    }
  }
}

// Export singleton instance
export const reportService = new ReportService();
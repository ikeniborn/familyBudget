import apiClient, { handleApiError } from './apiClient';

export interface ReportFilters {
  period_id?: number;
  financial_center_id?: number;
  cost_center_id?: number;
  report_type: 'budget' | 'plan_fact';
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

class ReportService {
  private endpoint = '/reports';

  // Получить план-факт отчет
  async getPlanFactReport(filters: ReportFilters): Promise<PlanFactReportData[]> {
    try {
      const response = await apiClient.get(`${this.endpoint}/plan-fact`, { params: filters });
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Получить бюджетный отчет
  async getBudgetReport(filters: ReportFilters): Promise<BudgetReportData[]> {
    try {
      const response = await apiClient.get(`${this.endpoint}/budget`, { params: filters });
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Экспорт план-факт отчета в Excel
  async exportPlanFactToExcel(filters: ReportFilters): Promise<Blob> {
    try {
      const response = await apiClient.get(`${this.endpoint}/plan-fact/export`, {
        params: { ...filters, format: 'excel' },
        responseType: 'blob',
      });
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Экспорт бюджетного отчета в Excel
  async exportBudgetToExcel(filters: ReportFilters): Promise<Blob> {
    try {
      const response = await apiClient.get(`${this.endpoint}/budget/export`, {
        params: { ...filters, format: 'excel' },
        responseType: 'blob',
      });
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Получить дашборд данные
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
      const response = await apiClient.get(`${this.endpoint}/dashboard`, { params });
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Получить статистику по периодам
  async getPeriodStats(): Promise<Array<{
    period_name: string;
    total_budget: number;
    total_fact: number;
    utilization_percent: number;
  }>> {
    try {
      const response = await apiClient.get(`${this.endpoint}/period-stats`);
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }
}

export const reportService = new ReportService();
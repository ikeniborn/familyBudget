import { ReportFilters } from '../components/reports/ReportFilters';

// Mock data interfaces - replace with actual API interfaces
interface RawReportData {
  periods?: Array<{
    period_id: number;
    period_name: string;
    period_ru_name: string;
    planned_amount: number;
    actual_amount: number;
    financial_center_name?: string;
    cost_center_name?: string;
    nomenclature_name?: string;
    date_created?: string;
    [key: string]: any;
  }>;
  
  categories?: Array<{
    nomenclature_name: string;
    total_amount: number;
    financial_center_name?: string;
    [key: string]: any;
  }>;
  
  budget_summary?: {
    total_planned: number;
    total_actual: number;
    utilization_percent: number;
  };
  
  time_series?: Array<{
    date: string;
    amount: number;
    type: 'plan' | 'fact';
    nomenclature_name?: string;
    [key: string]: any;
  }>;
}

export interface TransformedReportData {
  planFactData?: Array<{
    name: string;
    planned_amount: number;
    actual_amount: number;
    category?: string;
    period_name?: string;
    [key: string]: any;
  }>;
  
  categoryData?: Array<{
    category: string;
    amount: number;
    color?: string;
    [key: string]: any;
  }>;
  
  budgetData?: {
    currentValue: number;
    maxValue: number;
    category?: string;
  };
  
  timeSeriesData?: Array<{
    date: string | Date;
    value: number;
    series?: string;
    [key: string]: any;
  }>;
  
  varianceData?: Array<{
    name: string;
    value: number;
    category?: string;
    [key: string]: any;
  }>;
  
  composedData?: Array<Record<string, any>>;
  composedSeries?: Array<{
    dataKey: string;
    name: string;
    type: 'bar' | 'line';
    color: string;
    yAxisId?: 'left' | 'right';
  }>;
}

class ReportDataTransformer {
  /**
   * Transform raw report data based on filters and report type
   */
  transform(rawData: RawReportData, filters: ReportFilters): TransformedReportData {
    const result: TransformedReportData = {};

    switch (filters.report_type) {
      case 'plan_fact':
        result.planFactData = this.transformPlanFactData(rawData);
        result.timeSeriesData = this.transformTimeSeriesData(rawData);
        result.varianceData = this.transformVarianceData(rawData);
        result.composedData = this.transformComposedData(rawData);
        result.composedSeries = this.getComposedSeries('plan_fact');
        break;
        
      case 'budget':
        result.planFactData = this.transformBudgetPlanFactData(rawData);
        result.categoryData = this.transformCategoryData(rawData);
        result.budgetData = this.transformBudgetData(rawData);
        result.composedData = this.transformComposedData(rawData);
        result.composedSeries = this.getComposedSeries('budget');
        break;
    }

    return result;
  }

  /**
   * Transform plan-fact data for bar charts
   */
  private transformPlanFactData(rawData: RawReportData) {
    if (!rawData.periods) return [];

    return rawData.periods.map(period => ({
      name: period.period_ru_name || period.period_name,
      planned_amount: period.planned_amount || 0,
      actual_amount: period.actual_amount || 0,
      category: period.nomenclature_name,
      period_name: period.period_ru_name,
      financial_center: period.financial_center_name,
      cost_center: period.cost_center_name,
      period_id: period.period_id,
    }));
  }

  /**
   * Transform budget data for budget-specific charts
   */
  private transformBudgetPlanFactData(rawData: RawReportData) {
    if (!rawData.categories) return [];

    return rawData.categories.map(category => ({
      name: category.nomenclature_name,
      planned_amount: category.total_amount * 0.8, // Mock planned as 80% of total
      actual_amount: category.total_amount,
      category: category.nomenclature_name,
      financial_center: category.financial_center_name,
    }));
  }

  /**
   * Transform category distribution data for pie charts
   */
  private transformCategoryData(rawData: RawReportData) {
    if (!rawData.categories) return [];

    return rawData.categories.map(category => ({
      category: category.nomenclature_name,
      amount: category.total_amount,
      financial_center: category.financial_center_name,
    }));
  }

  /**
   * Transform budget utilization data for gauge charts
   */
  private transformBudgetData(rawData: RawReportData) {
    if (!rawData.budget_summary) return undefined;

    return {
      currentValue: rawData.budget_summary.total_actual,
      maxValue: rawData.budget_summary.total_planned,
      utilization: rawData.budget_summary.utilization_percent,
    };
  }

  /**
   * Transform time series data for line charts
   */
  private transformTimeSeriesData(rawData: RawReportData) {
    if (!rawData.time_series) return [];

    // Group by date and combine plan/fact
    const grouped = rawData.time_series.reduce((acc, item) => {
      const date = item.date;
      if (!acc[date]) {
        acc[date] = { date, plan: 0, fact: 0 };
      }
      
      if (item.type === 'plan') {
        acc[date].plan += item.amount;
      } else {
        acc[date].fact += item.amount;
      }
      
      return acc;
    }, {} as Record<string, any>);

    // Convert to time series format
    return Object.values(grouped).flatMap((item: any) => [
      {
        date: item.date,
        value: item.plan,
        series: 'План',
      },
      {
        date: item.date,
        value: item.fact,
        series: 'Факт',
      },
    ]);
  }

  /**
   * Transform variance data for waterfall charts
   */
  private transformVarianceData(rawData: RawReportData) {
    if (!rawData.periods) return [];

    return rawData.periods.map(period => ({
      name: period.period_ru_name || period.period_name,
      value: (period.actual_amount || 0) - (period.planned_amount || 0),
      category: period.nomenclature_name,
      planned: period.planned_amount,
      actual: period.actual_amount,
    }));
  }

  /**
   * Transform data for composed charts
   */
  private transformComposedData(rawData: RawReportData) {
    if (!rawData.periods) return [];

    return rawData.periods.map(period => ({
      name: period.period_ru_name || period.period_name,
      plan: period.planned_amount || 0,
      fact: period.actual_amount || 0,
      variance: (period.actual_amount || 0) - (period.planned_amount || 0),
      utilization: period.planned_amount > 0 
        ? ((period.actual_amount || 0) / period.planned_amount) 
        : 0,
      period_id: period.period_id,
    }));
  }

  /**
   * Get series configuration for composed charts
   */
  private getComposedSeries(reportType: string) {
    if (reportType === 'plan_fact') {
      return [
        {
          dataKey: 'plan',
          name: 'План',
          type: 'bar' as const,
          color: '#3B82F6',
          yAxisId: 'left' as const,
        },
        {
          dataKey: 'fact',
          name: 'Факт',
          type: 'bar' as const,
          color: '#10B981',
          yAxisId: 'left' as const,
        },
        {
          dataKey: 'utilization',
          name: 'Выполнение (%)',
          type: 'line' as const,
          color: '#F59E0B',
          yAxisId: 'right' as const,
        },
      ];
    } else {
      return [
        {
          dataKey: 'plan',
          name: 'Бюджет',
          type: 'bar' as const,
          color: '#3B82F6',
          yAxisId: 'left' as const,
        },
        {
          dataKey: 'fact',
          name: 'Факт',
          type: 'line' as const,
          color: '#10B981',
          yAxisId: 'left' as const,
        },
      ];
    }
  }

  /**
   * Generate mock data for development/testing
   */
  generateMockData(filters: ReportFilters): RawReportData {
    const periods = [
      {
        period_id: 1,
        period_name: 'January 2025',
        period_ru_name: 'Январь 2025',
        planned_amount: 100000,
        actual_amount: 85000,
        nomenclature_name: 'Операционные расходы',
        financial_center_name: 'Административный центр',
        cost_center_name: 'Управление',
        date_created: '2025-01-15',
      },
      {
        period_id: 2,
        period_name: 'February 2025',
        period_ru_name: 'Февраль 2025',
        planned_amount: 120000,
        actual_amount: 135000,
        nomenclature_name: 'Маркетинг',
        financial_center_name: 'Продажи',
        cost_center_name: 'Реклама',
        date_created: '2025-02-15',
      },
      {
        period_id: 3,
        period_name: 'March 2025',
        period_ru_name: 'Март 2025',
        planned_amount: 95000,
        actual_amount: 92000,
        nomenclature_name: 'IT расходы',
        financial_center_name: 'Технический центр',
        cost_center_name: 'Разработка',
        date_created: '2025-03-15',
      },
    ];

    const categories = [
      {
        nomenclature_name: 'Операционные расходы',
        total_amount: 85000,
        financial_center_name: 'Административный центр',
      },
      {
        nomenclature_name: 'Маркетинг',
        total_amount: 135000,
        financial_center_name: 'Продажи',
      },
      {
        nomenclature_name: 'IT расходы',
        total_amount: 92000,
        financial_center_name: 'Технический центр',
      },
    ];

    const budget_summary = {
      total_planned: 315000,
      total_actual: 312000,
      utilization_percent: 99.05,
    };

    const time_series = [
      { date: '2025-01-01', amount: 100000, type: 'plan' as const },
      { date: '2025-01-01', amount: 85000, type: 'fact' as const },
      { date: '2025-02-01', amount: 120000, type: 'plan' as const },
      { date: '2025-02-01', amount: 135000, type: 'fact' as const },
      { date: '2025-03-01', amount: 95000, type: 'plan' as const },
      { date: '2025-03-01', amount: 92000, type: 'fact' as const },
    ];

    return {
      periods,
      categories,
      budget_summary,
      time_series,
    };
  }
}

export const reportDataTransformer = new ReportDataTransformer();
export default reportDataTransformer;
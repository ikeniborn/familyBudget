import { reportDataTransformer } from '../reportDataTransformer';
import { ReportFilters } from '../../components/reports/ReportFilters';

describe('ReportDataTransformer', () => {
  describe('generateMockData', () => {
    it('generates mock data for plan_fact report type', () => {
      const filters: ReportFilters = {
        report_type: 'plan_fact',
      };

      const mockData = reportDataTransformer.generateMockData(filters);

      expect(mockData).toHaveProperty('periods');
      expect(mockData).toHaveProperty('categories');
      expect(mockData).toHaveProperty('budget_summary');
      expect(mockData).toHaveProperty('time_series');

      expect(Array.isArray(mockData.periods)).toBe(true);
      expect(mockData.periods?.length).toBeGreaterThan(0);
      expect(Array.isArray(mockData.categories)).toBe(true);
      expect(mockData.categories?.length).toBeGreaterThan(0);
    });

    it('generates mock data for budget report type', () => {
      const filters: ReportFilters = {
        report_type: 'budget',
      };

      const mockData = reportDataTransformer.generateMockData(filters);

      expect(mockData).toHaveProperty('periods');
      expect(mockData).toHaveProperty('categories');
      expect(mockData).toHaveProperty('budget_summary');
      expect(mockData).toHaveProperty('time_series');
    });

    it('includes required fields in periods data', () => {
      const filters: ReportFilters = { report_type: 'plan_fact' };
      const mockData = reportDataTransformer.generateMockData(filters);

      mockData.periods?.forEach(period => {
        expect(period).toHaveProperty('period_id');
        expect(period).toHaveProperty('period_name');
        expect(period).toHaveProperty('period_ru_name');
        expect(period).toHaveProperty('planned_amount');
        expect(period).toHaveProperty('actual_amount');
        expect(period).toHaveProperty('nomenclature_name');
        expect(period).toHaveProperty('financial_center_name');
        expect(period).toHaveProperty('cost_center_name');
        expect(period).toHaveProperty('date_created');

        expect(typeof period.planned_amount).toBe('number');
        expect(typeof period.actual_amount).toBe('number');
        expect(period.planned_amount).toBeGreaterThan(0);
        expect(period.actual_amount).toBeGreaterThan(0);
      });
    });

    it('includes required fields in categories data', () => {
      const filters: ReportFilters = { report_type: 'budget' };
      const mockData = reportDataTransformer.generateMockData(filters);

      mockData.categories?.forEach(category => {
        expect(category).toHaveProperty('nomenclature_name');
        expect(category).toHaveProperty('total_amount');
        expect(category).toHaveProperty('financial_center_name');

        expect(typeof category.total_amount).toBe('number');
        expect(category.total_amount).toBeGreaterThan(0);
        expect(typeof category.nomenclature_name).toBe('string');
      });
    });

    it('includes valid budget summary data', () => {
      const filters: ReportFilters = { report_type: 'plan_fact' };
      const mockData = reportDataTransformer.generateMockData(filters);

      expect(mockData.budget_summary).toHaveProperty('total_planned');
      expect(mockData.budget_summary).toHaveProperty('total_actual');
      expect(mockData.budget_summary).toHaveProperty('utilization_percent');

      expect(typeof mockData.budget_summary?.total_planned).toBe('number');
      expect(typeof mockData.budget_summary?.total_actual).toBe('number');
      expect(typeof mockData.budget_summary?.utilization_percent).toBe('number');

      expect(mockData.budget_summary?.total_planned).toBeGreaterThan(0);
      expect(mockData.budget_summary?.total_actual).toBeGreaterThan(0);
      expect(mockData.budget_summary?.utilization_percent).toBeGreaterThan(0);
    });

    it('includes valid time series data', () => {
      const filters: ReportFilters = { report_type: 'plan_fact' };
      const mockData = reportDataTransformer.generateMockData(filters);

      expect(Array.isArray(mockData.time_series)).toBe(true);
      
      mockData.time_series?.forEach(item => {
        expect(item).toHaveProperty('date');
        expect(item).toHaveProperty('amount');
        expect(item).toHaveProperty('type');

        expect(typeof item.date).toBe('string');
        expect(typeof item.amount).toBe('number');
        expect(['plan', 'fact']).toContain(item.type);
        expect(item.amount).toBeGreaterThan(0);
      });
    });
  });

  describe('transform', () => {
    let mockRawData: any;

    beforeEach(() => {
      mockRawData = {
        periods: [
          {
            period_id: 1,
            period_name: 'January 2025',
            period_ru_name: 'Январь 2025',
            planned_amount: 100000,
            actual_amount: 85000,
            nomenclature_name: 'Operations',
            financial_center_name: 'Admin Center',
            cost_center_name: 'Management',
            date_created: '2025-01-15',
          },
          {
            period_id: 2,
            period_name: 'February 2025',
            period_ru_name: 'Февраль 2025',
            planned_amount: 120000,
            actual_amount: 135000,
            nomenclature_name: 'Marketing',
            financial_center_name: 'Sales Center',
            cost_center_name: 'Advertising',
            date_created: '2025-02-15',
          },
        ],
        categories: [
          {
            nomenclature_name: 'Operations',
            total_amount: 85000,
            financial_center_name: 'Admin Center',
          },
          {
            nomenclature_name: 'Marketing',
            total_amount: 135000,
            financial_center_name: 'Sales Center',
          },
        ],
        budget_summary: {
          total_planned: 220000,
          total_actual: 220000,
          utilization_percent: 100,
        },
        time_series: [
          { date: '2025-01-01', amount: 100000, type: 'plan' as const },
          { date: '2025-01-01', amount: 85000, type: 'fact' as const },
          { date: '2025-02-01', amount: 120000, type: 'plan' as const },
          { date: '2025-02-01', amount: 135000, type: 'fact' as const },
        ],
      };
    });

    it('transforms data for plan_fact report type', () => {
      const filters: ReportFilters = { report_type: 'plan_fact' };
      const result = reportDataTransformer.transform(mockRawData, filters);

      expect(result).toHaveProperty('planFactData');
      expect(result).toHaveProperty('timeSeriesData');
      expect(result).toHaveProperty('varianceData');
      expect(result).toHaveProperty('composedData');
      expect(result).toHaveProperty('composedSeries');

      expect(Array.isArray(result.planFactData)).toBe(true);
      expect(Array.isArray(result.timeSeriesData)).toBe(true);
      expect(Array.isArray(result.varianceData)).toBe(true);
      expect(Array.isArray(result.composedData)).toBe(true);
      expect(Array.isArray(result.composedSeries)).toBe(true);
    });

    it('transforms data for budget report type', () => {
      const filters: ReportFilters = { report_type: 'budget' };
      const result = reportDataTransformer.transform(mockRawData, filters);

      expect(result).toHaveProperty('planFactData');
      expect(result).toHaveProperty('categoryData');
      expect(result).toHaveProperty('budgetData');
      expect(result).toHaveProperty('composedData');
      expect(result).toHaveProperty('composedSeries');

      expect(Array.isArray(result.planFactData)).toBe(true);
      expect(Array.isArray(result.categoryData)).toBe(true);
      expect(result.budgetData).toBeDefined();
      expect(Array.isArray(result.composedData)).toBe(true);
      expect(Array.isArray(result.composedSeries)).toBe(true);
    });

    it('correctly transforms plan fact data', () => {
      const filters: ReportFilters = { report_type: 'plan_fact' };
      const result = reportDataTransformer.transform(mockRawData, filters);

      expect(result.planFactData).toHaveLength(2);
      
      const firstItem = result.planFactData![0];
      expect(firstItem).toMatchObject({
        name: 'Январь 2025',
        planned_amount: 100000,
        actual_amount: 85000,
        category: 'Operations',
        period_name: 'Январь 2025',
        financial_center: 'Admin Center',
        cost_center: 'Management',
        period_id: 1,
      });
    });

    it('correctly transforms category data for budget reports', () => {
      const filters: ReportFilters = { report_type: 'budget' };
      const result = reportDataTransformer.transform(mockRawData, filters);

      expect(result.categoryData).toHaveLength(2);
      
      const firstCategory = result.categoryData![0];
      expect(firstCategory).toMatchObject({
        category: 'Operations',
        amount: 85000,
        financial_center: 'Admin Center',
      });
    });

    it('correctly transforms budget utilization data', () => {
      const filters: ReportFilters = { report_type: 'budget' };
      const result = reportDataTransformer.transform(mockRawData, filters);

      expect(result.budgetData).toMatchObject({
        currentValue: 220000,
        maxValue: 220000,
        utilization: 100,
      });
    });

    it('correctly transforms time series data', () => {
      const filters: ReportFilters = { report_type: 'plan_fact' };
      const result = reportDataTransformer.transform(mockRawData, filters);

      expect(result.timeSeriesData).toHaveLength(4); // 2 dates × 2 series (plan + fact)
      
      const planItem = result.timeSeriesData!.find(item => 
        item.date === '2025-01-01' && item.series === 'План'
      );
      const factItem = result.timeSeriesData!.find(item => 
        item.date === '2025-01-01' && item.series === 'Факт'
      );

      expect(planItem).toMatchObject({
        date: '2025-01-01',
        value: 100000,
        series: 'План',
      });

      expect(factItem).toMatchObject({
        date: '2025-01-01',
        value: 85000,
        series: 'Факт',
      });
    });

    it('correctly calculates variance data', () => {
      const filters: ReportFilters = { report_type: 'plan_fact' };
      const result = reportDataTransformer.transform(mockRawData, filters);

      expect(result.varianceData).toHaveLength(2);
      
      const firstVariance = result.varianceData![0];
      expect(firstVariance).toMatchObject({
        name: 'Январь 2025',
        value: -15000, // 85000 - 100000
        category: 'Operations',
        planned: 100000,
        actual: 85000,
      });

      const secondVariance = result.varianceData![1];
      expect(secondVariance).toMatchObject({
        name: 'Февраль 2025',
        value: 15000, // 135000 - 120000
        category: 'Marketing',
        planned: 120000,
        actual: 135000,
      });
    });

    it('handles empty data gracefully', () => {
      const emptyData = {
        periods: [],
        categories: [],
        budget_summary: undefined,
        time_series: [],
      };

      const filters: ReportFilters = { report_type: 'plan_fact' };
      const result = reportDataTransformer.transform(emptyData, filters);

      expect(result.planFactData).toEqual([]);
      expect(result.timeSeriesData).toEqual([]);
      expect(result.varianceData).toEqual([]);
      expect(result.composedData).toEqual([]);
    });

    it('handles missing data properties gracefully', () => {
      const incompleteData = {};

      const filters: ReportFilters = { report_type: 'plan_fact' };
      const result = reportDataTransformer.transform(incompleteData, filters);

      expect(result.planFactData).toEqual([]);
      expect(result.timeSeriesData).toEqual([]);
      expect(result.varianceData).toEqual([]);
      expect(result.composedData).toEqual([]);
    });

    it('correctly calculates composed chart utilization', () => {
      const filters: ReportFilters = { report_type: 'plan_fact' };
      const result = reportDataTransformer.transform(mockRawData, filters);

      expect(result.composedData).toHaveLength(2);
      
      const firstComposed = result.composedData![0];
      expect(firstComposed).toMatchObject({
        name: 'Январь 2025',
        plan: 100000,
        fact: 85000,
        variance: -15000,
        utilization: 0.85, // 85000 / 100000
        period_id: 1,
      });

      const secondComposed = result.composedData![1];
      expect(secondComposed).toMatchObject({
        name: 'Февраль 2025',
        plan: 120000,
        fact: 135000,
        variance: 15000,
        utilization: 1.125, // 135000 / 120000
        period_id: 2,
      });
    });

    it('returns correct series configuration for plan_fact reports', () => {
      const filters: ReportFilters = { report_type: 'plan_fact' };
      const result = reportDataTransformer.transform(mockRawData, filters);

      expect(result.composedSeries).toHaveLength(3);
      expect(result.composedSeries![0]).toMatchObject({
        dataKey: 'plan',
        name: 'План',
        type: 'bar',
        color: '#3B82F6',
        yAxisId: 'left',
      });
      expect(result.composedSeries![1]).toMatchObject({
        dataKey: 'fact',
        name: 'Факт',
        type: 'bar',
        color: '#10B981',
        yAxisId: 'left',
      });
      expect(result.composedSeries![2]).toMatchObject({
        dataKey: 'utilization',
        name: 'Выполнение (%)',
        type: 'line',
        color: '#F59E0B',
        yAxisId: 'right',
      });
    });

    it('returns correct series configuration for budget reports', () => {
      const filters: ReportFilters = { report_type: 'budget' };
      const result = reportDataTransformer.transform(mockRawData, filters);

      expect(result.composedSeries).toHaveLength(2);
      expect(result.composedSeries![0]).toMatchObject({
        dataKey: 'plan',
        name: 'Бюджет',
        type: 'bar',
        color: '#3B82F6',
        yAxisId: 'left',
      });
      expect(result.composedSeries![1]).toMatchObject({
        dataKey: 'fact',
        name: 'Факт',
        type: 'line',
        color: '#10B981',
        yAxisId: 'left',
      });
    });
  });
});
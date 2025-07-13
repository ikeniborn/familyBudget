import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Layout } from '../../components/common/Layout';
import { Card, CardContent } from '../../components/ui/card';
import { useToast } from '../../components/common/ToastContainer';
import { ReportFilters, type ReportFilters as ReportFiltersType } from '../../components/reports/ReportFilters';
import { ViewModeToggle, type ViewMode } from '../../components/reports/ViewModeToggle';
import { ChartSelector, type ChartType } from '../../components/reports/ChartSelector';
import DynamicChartRenderer from '../../components/reports/DynamicChartRenderer';
import { BudgetTable } from '../../components/reports/BudgetTable';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { reportDataTransformer } from '../../services/reportDataTransformer';
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Target,
  AlertTriangle,
  Download,
  RefreshCw,
  Settings,
} from 'lucide-react';

// Custom hook for debounced values
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const EnhancedReportsPage: React.FC = () => {
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingReportData, setIsLoadingReportData] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [filters, setFilters] = useState<ReportFiltersType>({
    report_type: 'plan_fact',
  });

  const toast = useToast();
  const { getPreference, setPreference, isLoading: preferencesLoading } = useUserPreferences();

  // Get user preferences with memoization
  const viewMode = useMemo(() => 
    getPreference('reportsViewMode', 'table') as ViewMode, 
    [getPreference]
  );
  
  const chartType = useMemo(() => 
    getPreference('reportsChartType', 'plan_fact_bar') as ChartType, 
    [getPreference]
  );

  // Debounce filters to prevent excessive API calls
  const debouncedFilters = useDebounce(filters, 300);

  // Mock dashboard data
  const dashboardData = useMemo(() => ({
    total_income: 125000,
    total_expense: 87500,
    budget_utilization: 70,
  }), []);

  const periodStats = useMemo(() => [
    { period_name: 'Январь 2025', total_budget: 100000, total_fact: 85000, utilization_percent: 85 },
    { period_name: 'Февраль 2025', total_budget: 100000, total_fact: 95000, utilization_percent: 95 },
    { period_name: 'Март 2025', total_budget: 100000, total_fact: 110000, utilization_percent: 110 }
  ], []);

  // Load initial data
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoadingStats(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Load report data when filters change
  useEffect(() => {
    loadReportData(debouncedFilters);
  }, [debouncedFilters]);

  const loadReportData = useCallback(async (currentFilters: ReportFiltersType) => {
    setIsLoadingReportData(true);
    setReportError(null);

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate mock data based on filters
      const rawData = reportDataTransformer.generateMockData(currentFilters);
      const transformedData = reportDataTransformer.transform(rawData, currentFilters);
      
      setReportData(transformedData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки данных отчета';
      setReportError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoadingReportData(false);
    }
  }, [toast]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: ReportFiltersType) => {
    setFilters(newFilters);
  }, []);

  // Handle view mode change with persistence
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setPreference('reportsViewMode', mode);
  }, [setPreference]);

  // Handle chart type change with persistence
  const handleChartTypeChange = useCallback((type: ChartType) => {
    setPreference('reportsChartType', type);
  }, [setPreference]);

  // Handle chart interactions
  const handleChartClick = useCallback((data: any) => {
    console.log('Chart element clicked:', data);
    toast.info(`Выбран элемент: ${data.name || data.category || 'Неизвестно'}`);
  }, [toast]);

  // Handle data refresh
  const handleRefresh = useCallback(() => {
    loadReportData(filters);
  }, [loadReportData, filters]);

  // Memoized table data for performance
  const tableData = useMemo(() => {
    if (!reportData?.planFactData) return [];
    return reportData.planFactData;
  }, [reportData]);

  if (preferencesLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-2" />
            <p className="text-gray-500">Загрузка настроек...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Отчеты и аналитика</h1>
            <p className="text-slate-600">
              Подробная аналитика и отчеты по управлению бюджетом
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isLoadingReportData}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingReportData ? 'animate-spin' : ''}`} />
              Обновить
            </button>
            
            <ViewModeToggle
              currentMode={viewMode}
              onModeChange={handleViewModeChange}
              disabled={isLoadingReportData}
            />
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Общий доход</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {isLoadingStats ? '...' : dashboardData.total_income.toLocaleString()} ₽
                  </p>
                  <p className="text-xs text-green-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    За период
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Общий расход</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {isLoadingStats ? '...' : dashboardData.total_expense.toLocaleString()} ₽
                  </p>
                  <p className="text-xs text-red-600 flex items-center mt-1">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    За период
                  </p>
                </div>
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Использование бюджета</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {isLoadingStats ? '...' : Math.round(dashboardData.budget_utilization)}%
                  </p>
                  <p className="text-xs text-blue-600 flex items-center mt-1">
                    <Target className="h-3 w-3 mr-1" />
                    От плана
                  </p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Периодов</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {isLoadingStats ? '...' : periodStats.length}
                  </p>
                  <p className="text-xs text-purple-600 flex items-center mt-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    Активных
                  </p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-1">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="h-5 w-5 text-gray-600" />
                  <h3 className="font-semibold text-slate-900">Фильтры отчета</h3>
                </div>
                
                <ReportFilters
                  onApplyFilters={handleFiltersChange}
                  isLoading={isLoadingReportData}
                />
                
                {viewMode === 'chart' && (
                  <ChartSelector
                    selectedType={chartType}
                    onTypeChange={handleChartTypeChange}
                    reportType={filters.report_type}
                    disabled={isLoadingReportData}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Main Content Area */}
          <Card className="lg:col-span-3">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">
                  {viewMode === 'chart' ? 'Графическое представление' : 'Табличные данные'}
                </h3>
                {viewMode === 'chart' && reportData && (
                  <div className="text-sm text-gray-500">
                    Тип: {chartType.replace('_', ' ')}
                  </div>
                )}
              </div>

              {/* Content with smooth transitions */}
              <div className="transition-all duration-300 ease-in-out">
                {viewMode === 'chart' ? (
                  <DynamicChartRenderer
                    chartType={chartType}
                    data={reportData || {}}
                    filters={filters}
                    loading={isLoadingReportData}
                    error={reportError}
                    onChartClick={handleChartClick}
                  />
                ) : (
                  <div className="space-y-4">
                    {isLoadingReportData ? (
                      <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-2" />
                          <p className="text-gray-500">Загрузка данных таблицы...</p>
                        </div>
                      </div>
                    ) : reportError ? (
                      <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg">
                        <div className="text-center">
                          <AlertTriangle className="h-8 w-8 mx-auto text-red-500 mb-2" />
                          <p className="text-red-600 font-medium">Ошибка загрузки данных</p>
                          <p className="text-red-500 text-sm mt-1">{reportError}</p>
                        </div>
                      </div>
                    ) : (
                      <BudgetTable 
                        data={tableData}
                        loading={isLoadingReportData}
                      />
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Period Statistics - Always visible */}
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Статистика по периодам</h3>
                <p className="text-sm text-slate-600">Сводка использования бюджета по периодам</p>
              </div>
            </div>
            <div className="space-y-3">
              {periodStats.map((period, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">{period.period_name}</p>
                    <p className="text-sm text-slate-600">
                      Бюджет: {period.total_budget.toLocaleString()} ₽
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">
                      {period.total_fact.toLocaleString()} ₽
                    </p>
                    <div className="flex items-center gap-1">
                      {period.utilization_percent > 100 ? (
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                      ) : (
                        <Target className="h-3 w-3 text-green-500" />
                      )}
                      <span className={`text-sm ${
                        period.utilization_percent > 100 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {Math.round(period.utilization_percent)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default EnhancedReportsPage;
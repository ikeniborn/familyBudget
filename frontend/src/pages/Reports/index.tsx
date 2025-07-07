import React, { useState } from 'react';
import { Layout } from '../../components/common/Layout';
import { ReportFilters, type ReportFilters as ReportFiltersType } from '../../components/reports/ReportFilters';
import { PlanFactChart } from '../../components/reports/PlanFactChart';
import { BudgetTable } from '../../components/reports/BudgetTable';
import { useToast } from '../../components/common/ToastContainer';
import { reportService } from '../../services';

interface ReportData {
  nomenclature_name: string;
  plan: number;
  fact: number;
  variance: number;
  variance_percent: number;
}

const ReportsPage: React.FC = () => {
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<ReportFiltersType | null>(null);
  const toast = useToast();

  const handleApplyFilters = async (filters: ReportFiltersType) => {
    setIsLoading(true);
    setCurrentFilters(filters);
    
    try {
      const data = await reportService.getPlanFactReport(filters);
      setReportData(data);
    } catch (error: any) {
      console.error('Ошибка загрузки отчета:', error);
      toast.error('Ошибка', error.message || 'Не удалось загрузить данные отчета');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!currentFilters) {
      toast.error('Ошибка', 'Сначала примените фильтры');
      return;
    }

    try {
      const blob = await reportService.exportPlanFactToExcel(currentFilters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plan-fact-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Успешно', 'Отчет экспортирован');
    } catch (error: any) {
      console.error('Ошибка экспорта:', error);
      toast.error('Ошибка', error.message || 'Не удалось экспортировать отчет');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Отчетность</h1>
          <p className="mt-1 text-sm text-gray-600">
            Аналитика и отчеты по бюджету
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <ReportFilters 
              onApplyFilters={handleApplyFilters}
              isLoading={isLoading}
            />
          </div>
          
          <div className="lg:col-span-3 space-y-6">
            {currentFilters?.report_type === 'plan_fact' && (
              <PlanFactChart 
                data={reportData}
                isLoading={isLoading}
              />
            )}
            
            <BudgetTable 
              data={reportData}
              isLoading={isLoading}
              onExport={handleExport}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ReportsPage;
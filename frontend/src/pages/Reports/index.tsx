import React, { useState } from 'react';
import { Layout } from '../../components/common/Layout';
import { ReportFilters, type ReportFilters as ReportFiltersType } from '../../components/reports/ReportFilters';
import { PlanFactChart } from '../../components/reports/PlanFactChart';
import { BudgetTable } from '../../components/reports/BudgetTable';
import { useToast } from '../../components/common/ToastContainer';

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
      const params = new URLSearchParams();
      if (filters.period_id) params.append('period_id', filters.period_id.toString());
      if (filters.financial_center_id) params.append('financial_center_id', filters.financial_center_id.toString());
      params.append('report_type', filters.report_type);

      const response = await fetch(`/api/reports/plan-fact?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      } else {
        toast.error('Ошибка', 'Не удалось загрузить данные отчета');
      }
    } catch (error) {
      console.error('Ошибка загрузки отчета:', error);
      toast.error('Ошибка', 'Не удалось загрузить данные отчета');
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
      const params = new URLSearchParams();
      if (currentFilters.period_id) params.append('period_id', currentFilters.period_id.toString());
      if (currentFilters.financial_center_id) params.append('financial_center_id', currentFilters.financial_center_id.toString());
      params.append('report_type', currentFilters.report_type);
      params.append('format', 'excel');

      const response = await fetch(`/api/reports/plan-fact/export?${params}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `plan-fact-report-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('Успешно', 'Отчет экспортирован');
      } else {
        toast.error('Ошибка', 'Не удалось экспортировать отчет');
      }
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      toast.error('Ошибка', 'Не удалось экспортировать отчет');
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
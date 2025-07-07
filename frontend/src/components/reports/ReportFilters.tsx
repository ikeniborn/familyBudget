import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { Select } from '../common/form/Select';
import { Button } from '../common/form/Button';
import type { Period, FinancialCenter } from '../../types';
import { periodService, financialCenterService } from '../../services';

interface ReportFiltersProps {
  onApplyFilters: (filters: ReportFilters) => void;
  isLoading?: boolean;
}

export interface ReportFilters {
  period_id?: number;
  financial_center_id?: number;
  report_type: 'budget' | 'plan_fact';
}

export const ReportFilters: React.FC<ReportFiltersProps> = ({ 
  onApplyFilters, 
  isLoading = false 
}) => {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [financialCenters, setFinancialCenters] = useState<FinancialCenter[]>([]);
  const [filters, setFilters] = useState<ReportFilters>({
    report_type: 'plan_fact',
  });

  useEffect(() => {
    loadFiltersData();
  }, []);

  const loadFiltersData = async () => {
    try {
      const [periodsData, fcData] = await Promise.all([
        periodService.getAll(),
        financialCenterService.getAll(),
      ]);

      setPeriods(periodsData);
      setFinancialCenters(fcData);
    } catch (error: any) {
      console.error('Ошибка загрузки данных фильтров:', error);
    }
  };

  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: key === 'report_type' ? value : parseInt(value),
    }));
  };

  const handleApplyFilters = () => {
    onApplyFilters(filters);
  };

  const periodOptions = [
    { value: '', label: 'Все периоды' },
    ...periods.map(period => ({
      value: period.period_id.toString(),
      label: period.period_ru_name,
    })),
  ];

  const financialCenterOptions = [
    { value: '', label: 'Все ФЦ' },
    ...financialCenters.map(fc => ({
      value: fc.financial_center_id.toString(),
      label: fc.financial_center_name,
    })),
  ];

  const reportTypeOptions = [
    { value: 'plan_fact', label: 'План-факт анализ' },
    { value: 'budget', label: 'Бюджет по статьям' },
  ];

  return (
    <Card title="Фильтры отчета">
      <div className="space-y-4">
        <Select
          label="Тип отчета"
          options={reportTypeOptions}
          value={filters.report_type}
          onChange={(e) => handleFilterChange('report_type', e.target.value)}
        />

        <Select
          label="Период"
          options={periodOptions}
          value={filters.period_id?.toString() || ''}
          onChange={(e) => handleFilterChange('period_id', e.target.value)}
        />

        <Select
          label="Финансовый центр"
          options={financialCenterOptions}
          value={filters.financial_center_id?.toString() || ''}
          onChange={(e) => handleFilterChange('financial_center_id', e.target.value)}
        />

        <Button
          variant="primary"
          onClick={handleApplyFilters}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Загрузка...' : 'Применить фильтры'}
        </Button>
      </div>
    </Card>
  );
};
import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Label } from '../ui/label';
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
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="report-type">Тип отчета</Label>
        <Select onValueChange={(value) => handleFilterChange('report_type', value)} defaultValue={filters.report_type}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите тип отчета" />
          </SelectTrigger>
          <SelectContent>
            {reportTypeOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="period">Период</Label>
        <Select onValueChange={(value) => handleFilterChange('period_id', value)} defaultValue={filters.period_id?.toString() || ''}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите период" />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="financial-center">Финансовый центр</Label>
        <Select onValueChange={(value) => handleFilterChange('financial_center_id', value)} defaultValue={filters.financial_center_id?.toString() || ''}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите ФЦ" />
          </SelectTrigger>
          <SelectContent>
            {financialCenterOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={handleApplyFilters}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? 'Загрузка...' : 'Применить фильтры'}
      </Button>
    </div>
  );
};
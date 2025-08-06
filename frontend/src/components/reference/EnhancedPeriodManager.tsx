import React, { useState, useEffect, useMemo } from 'react';
import { CRUDTable, type CRUDField } from './CRUDTable';
import { Badge } from '../ui/badge';
import { toast } from '../ui/use-toast';
import { useAuthStore } from '../../stores/authStore';
import { periodService } from '../../services/periodService';
import { registryService } from '../../services/registryService';
import { Calendar, AlertCircle, Activity } from 'lucide-react';

interface Period {
  id: number;
  period_id: number;
  period_name: string;
  period_year: number;
  period_month: number;
  period_start_date?: string;
  period_end_date?: string;
  user_id: number;
  transaction_count?: number;
  created_at?: string;
  updated_at?: string;
}

const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export const EnhancedPeriodManager: React.FC = () => {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionCounts, setTransactionCounts] = useState<Record<number, number>>({});
  const { user } = useAuthStore();

  // Check for period overlap
  const checkPeriodOverlap = (year: number, month: number, excludeId?: number): boolean => {
    return periods.some(p => 
      p.period_id !== excludeId && 
      p.period_year === year && 
      p.period_month === month
    );
  };

  // Generate date range for period
  const generatePeriodDates = (year: number, month: number): { start: string; end: string } => {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0); // Last day of month
    
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  // Auto-generate period name
  const generatePeriodName = (year: number, month: number): string => {
    return `${monthNames[month - 1]} ${year}`;
  };

  // Define fields for CRUD table
  const fields: CRUDField<Period>[] = [
    {
      key: 'period_name',
      label: 'Название периода',
      type: 'text',
      required: false,
      width: 'w-64',
      renderCell: (value) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span>{value}</span>
        </div>
      ),
      renderEdit: () => null, // Auto-generated, read-only
    },
    {
      key: 'period_year',
      label: 'Год',
      type: 'number',
      required: true,
      width: 'w-24',
      validation: (value) => {
        const year = Number(value);
        const currentYear = new Date().getFullYear();
        if (year < currentYear - 5 || year > currentYear + 5) {
          return `Год должен быть между ${currentYear - 5} и ${currentYear + 5}`;
        }
        return null;
      },
    },
    {
      key: 'period_month',
      label: 'Месяц',
      type: 'select',
      required: true,
      width: 'w-40',
      options: monthNames.map((name, index) => ({
        value: String(index + 1),
        label: name,
      })),
      renderCell: (value) => (
        <span className="font-medium">
          {monthNames[value - 1] || '-'}
        </span>
      ),
    },
    {
      key: 'period_start_date',
      label: 'Начало',
      type: 'date',
      width: 'w-32',
      renderCell: (value) => {
        if (!value) return '-';
        return new Date(value).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      },
      renderEdit: () => null, // Auto-generated, read-only
    },
    {
      key: 'period_end_date',
      label: 'Конец',
      type: 'date',
      width: 'w-32',
      renderCell: (value) => {
        if (!value) return '-';
        return new Date(value).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      },
      renderEdit: () => null, // Auto-generated, read-only
    },
    {
      key: 'transaction_count',
      label: 'Транзакций',
      type: 'number',
      width: 'w-28',
      sortable: true,
      renderCell: (value) => {
        if (value === undefined || value === null) return '-';
        return (
          <Badge variant={value > 0 ? "default" : "secondary"}>
            {value}
          </Badge>
        );
      },
      renderEdit: () => null, // Read-only
    },
    {
      key: 'created_at',
      label: 'Создан',
      type: 'date',
      width: 'w-32',
      sortable: true,
      filterable: false,
      renderCell: (value) => {
        if (!value) return '-';
        return new Date(value).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      },
      renderEdit: () => null, // Read-only in edit mode
    },
  ];

  // Fetch periods
  const fetchPeriods = async () => {
    if (!user?.user_id) return;
    
    try {
      setLoading(true);
      const periods = await periodService.getAll({ user_id: user.user_id });
      const periodsData = periods.map((p: any) => {
        const dates = generatePeriodDates(p.period_year, p.period_month);
        return {
          ...p,
          id: p.period_id, // Map period_id to id for CRUD table
          period_start_date: dates.start,
          period_end_date: dates.end,
        };
      });
      setPeriods(periodsData);
      
      // Fetch transaction counts for each period
      await fetchTransactionCounts(periodsData);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить периоды',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch transaction counts
  const fetchTransactionCounts = async (periodsData: Period[]) => {
    try {
      const counts: Record<number, number> = {};
      
      // In a real implementation, this would be a single API call
      // For now, we'll simulate with individual calls or use registry endpoint
      for (const period of periodsData) {
        try {
          const registryData = await registryService.getAll({
            user_id: user?.user_id,
            period_id: period.period_id
          });
          counts[period.period_id] = registryData.length || 0;
        } catch (error) {
          counts[period.period_id] = 0;
        }
      }
      
      setTransactionCounts(counts);
      
      // Update periods with transaction counts
      setPeriods(prev => prev.map(p => ({
        ...p,
        transaction_count: counts[p.period_id] || 0
      })));
    } catch (error) {
      console.error('Failed to fetch transaction counts:', error);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, [user]);

  // Add period with validation
  const handleAdd = async (data: Omit<Period, 'id'>) => {
    if (!user?.user_id) return;
    
    const year = Number(data.period_year);
    const month = Number(data.period_month);
    
    // Check for overlap
    if (checkPeriodOverlap(year, month)) {
      toast({
        title: 'Ошибка',
        description: `Период ${monthNames[month - 1]} ${year} уже существует`,
        variant: 'destructive',
      });
      throw new Error('Период уже существует');
    }
    
    // Auto-generate period name
    const periodName = generatePeriodName(year, month);
    const dates = generatePeriodDates(year, month);
    
    const newPeriod = {
      ...data,
      period_name: periodName,
      period_year: year,
      period_month: month,
      period_start_date: dates.start,
      period_end_date: dates.end,
      user_id: user.user_id,
    };

    try {
      // Remove fields that don't exist in API
      const { period_order, is_active, ...periodData } = newPeriod as any;
      await periodService.create(periodData);
      await fetchPeriods();
      
      toast({
        title: 'Успешно',
        description: `Период ${periodName} создан`,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось добавить период');
    }
  };

  // Update period with validation
  const handleUpdate = async (id: number, data: Partial<Period>) => {
    const year = data.period_year ? Number(data.period_year) : undefined;
    const month = data.period_month ? Number(data.period_month) : undefined;
    
    // Check for overlap if year or month changed
    if (year && month) {
      if (checkPeriodOverlap(year, month, id)) {
        toast({
          title: 'Ошибка',
          description: `Период ${monthNames[month - 1]} ${year} уже существует`,
          variant: 'destructive',
        });
        throw new Error('Период уже существует');
      }
    }
    
    const updateData: any = {
      ...data,
      period_month: month,
      period_year: year,
    };
    
    // Update dates if year or month changed
    if (year && month) {
      const dates = generatePeriodDates(year, month);
      updateData.period_start_date = dates.start;
      updateData.period_end_date = dates.end;
      
      // Update name if year or month changed and name matches auto-generated pattern
      const currentPeriod = periods.find(p => p.period_id === id);
      if (currentPeriod) {
        const expectedName = generatePeriodName(currentPeriod.period_year, currentPeriod.period_month);
        if (currentPeriod.period_name === expectedName) {
          updateData.period_name = generatePeriodName(year, month);
        }
      }
    }

    try {
      await periodService.update(id, updateData);
      await fetchPeriods();
      
      toast({
        title: 'Успешно',
        description: 'Период обновлен',
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось обновить период');
    }
  };

  // Delete period with transaction check
  const handleDelete = async (id: number) => {
    const period = periods.find(p => p.period_id === id);
    
    if (period && period.transaction_count && period.transaction_count > 0) {
      const confirmed = window.confirm(
        `Период "${period.period_name}" содержит ${period.transaction_count} транзакций. Вы уверены, что хотите удалить его?`
      );
      
      if (!confirmed) {
        throw new Error('Удаление отменено');
      }
    }

    try {
      await periodService.delete(id);
      await fetchPeriods();
      
      toast({
        title: 'Успешно',
        description: 'Период удален',
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить период');
    }
  };

  // Bulk delete periods
  const handleBulkDelete = async (ids: number[]) => {
    const periodsWithTransactions = periods.filter(
      p => ids.includes(p.period_id) && p.transaction_count && p.transaction_count > 0
    );
    
    if (periodsWithTransactions.length > 0) {
      const totalTransactions = periodsWithTransactions.reduce(
        (sum, p) => sum + (p.transaction_count || 0), 0
      );
      
      const confirmed = window.confirm(
        `${periodsWithTransactions.length} из выбранных периодов содержат транзакции (всего ${totalTransactions}). Вы уверены, что хотите удалить их?`
      );
      
      if (!confirmed) {
        throw new Error('Удаление отменено');
      }
    }

    try {
      await Promise.all(ids.map(id => periodService.delete(id)));
      await fetchPeriods();
      
      toast({
        title: 'Успешно',
        description: `Удалено периодов: ${ids.length}`,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить периоды');
    }
  };

  // Enhanced export with additional fields
  const handleExport = () => {
    const csvContent = [
      ['ID', 'Название', 'Год', 'Месяц', 'Начало', 'Конец', 'Транзакций', 'Создан'].join(','),
      ...periods.map(p => [
        p.period_id,
        `"${p.period_name}"`,
        p.period_year,
        p.period_month,
        p.period_start_date || '',
        p.period_end_date || '',
        p.transaction_count || 0,
        p.created_at ? new Date(p.created_at).toLocaleDateString('ru-RU') : '',
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `periods_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Enhanced import with validation
  const handleImport = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').slice(1); // Skip header
    
    const newPeriods: Omit<Period, 'id'>[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const [, name, year, month] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      const periodYear = Number(year);
      const periodMonth = Number(month);
      
      // Validate data
      if (checkPeriodOverlap(periodYear, periodMonth)) {
        errors.push(`Строка ${i + 2}: Период ${monthNames[periodMonth - 1]} ${periodYear} уже существует`);
        continue;
      }
      
      newPeriods.push({
        period_name: generatePeriodName(periodYear, periodMonth),
        period_year: periodYear,
        period_month: periodMonth,
        user_id: user!.user_id,
      } as Omit<Period, 'id'>);
    }
    
    if (errors.length > 0) {
      toast({
        title: 'Ошибки при импорте',
        description: errors.join('\n'),
        variant: 'destructive',
      });
    }

    // Add valid periods
    for (const period of newPeriods) {
      await handleAdd(period);
    }
    
    if (newPeriods.length > 0) {
      toast({
        title: 'Импорт завершен',
        description: `Добавлено периодов: ${newPeriods.length}`,
      });
    }
  };

  // Custom action to toggle active status
  const customActions = (item: Period) => {
    if (item.transaction_count && item.transaction_count > 0) {
      return (
        <div className="text-xs text-gray-500">
          {item.transaction_count} транз.
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Warning about overlapping periods */}
      {periods.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Информация о периодах</p>
            <p className="mt-1">
              Каждый период должен быть уникальным. Система автоматически проверяет пересечения периодов
              и генерирует даты начала и конца на основе выбранного месяца и года.
            </p>
          </div>
        </div>
      )}
      
      <CRUDTable
        title="Управление периодами"
        data={periods}
        fields={fields}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        loading={loading}
        searchable={true}
        exportable={true}
        importable={true}
        onExport={handleExport}
        onImport={handleImport}
        emptyMessage="Нет добавленных периодов. Нажмите 'Добавить период' для создания нового."
        addButtonText="Добавить период"
        customActions={customActions}
      />
    </div>
  );
};
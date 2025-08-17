import React, { useState, useEffect, useMemo } from 'react';
import { CRUDTable, type CRUDField } from './CRUDTable';
import { Badge } from '../ui/badge';
import { toast } from '../ui/use-toast';
import { useAuthStore } from '../../stores/authStore';
import { periodService } from '../../services/periodService';
import { registryService } from '../../services/registryService';
import { Calendar, AlertCircle, Activity, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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
  const [customAddDialogOpen, setCustomAddDialogOpen] = useState(false);
  const [newPeriodData, setNewPeriodData] = useState<{
    period_year: number;
    period_month: number;
    period_start_date: string;
    period_end_date: string;
  }>({
    period_year: new Date().getFullYear(),
    period_month: new Date().getMonth() + 1,
    period_start_date: '',
    period_end_date: ''
  });
  const { user } = useAuthStore();

  // Динамически генерируем название периода
  const dynamicPeriodName = useMemo(() => {
    if (newPeriodData.period_year && newPeriodData.period_month) {
      return generatePeriodName(newPeriodData.period_year, newPeriodData.period_month);
    }
    return '';
  }, [newPeriodData.period_year, newPeriodData.period_month]);

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
      type: 'custom' as const,
      required: false,
      width: 'w-64',
      renderCell: (value) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span>{value}</span>
        </div>
      ),
      renderEdit: (_value, _onChange, item) => {
        // For editing mode, show the existing name
        if (item && item.id) {
          return (
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">{item.period_name || ''}</span>
              <span className="text-xs text-gray-400 ml-auto">(не редактируется)</span>
            </div>
          );
        }
        // For new period - this won't be shown as we'll override it in the dialog
        return (
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500 italic">Будет сгенерировано автоматически</span>
          </div>
        );
      },
    },
    {
      key: 'period_year',
      label: 'Год',
      type: 'select',
      required: true,
      width: 'w-24',
      options: Array.from({length: 11}, (_, i) => ({
        value: String(2020 + i),
        label: String(2020 + i)
      })),
      renderCell: (value) => value || '-',
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
      required: true,
      renderCell: (value) => {
        if (!value) return '-';
        return new Date(value).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      },
    },
    {
      key: 'period_end_date',
      label: 'Конец',
      type: 'date',
      width: 'w-32',
      required: true,
      renderCell: (value) => {
        if (!value) return '-';
        return new Date(value).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      },
      validation: (value, formData) => {
        if (formData?.period_start_date && value) {
          const startDate = new Date(formData.period_start_date);
          const endDate = new Date(value);
          if (endDate < startDate) {
            return 'Дата окончания должна быть позже даты начала';
          }
        }
        return null;
      },
    },
  ];

  // Fetch periods
  const fetchPeriods = async () => {
    if (!user?.user_id) return;
    
    try {
      setLoading(true);
      const periods = await periodService.getAll({ user_id: user.user_id });
      const periodsData = periods.map((p: any) => {
        // Use existing dates if available, otherwise generate defaults
        const dates = generatePeriodDates(p.period_year, p.period_month);
        return {
          ...p,
          id: p.period_id, // Map period_id to id for CRUD table
          period_start_date: p.period_start_date || dates.start,
          period_end_date: p.period_end_date || dates.end,
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
    
    // Use provided dates or generate defaults
    const startDate = data.period_start_date || generatePeriodDates(year, month).start;
    const endDate = data.period_end_date || generatePeriodDates(year, month).end;
    
    const newPeriod = {
      ...data,
      period_name: periodName,
      period_year: year,
      period_month: month,
      period_start_date: startDate,
      period_end_date: endDate,
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
    
    // Keep the dates from the form if provided
    if (data.period_start_date) {
      updateData.period_start_date = data.period_start_date;
    }
    if (data.period_end_date) {
      updateData.period_end_date = data.period_end_date;
    }
    
    // Update name if year or month changed
    if (year && month) {
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

  // Handle custom add button click
  const handleCustomAddClick = () => {
    // Reset form data with defaults
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const dates = generatePeriodDates(year, month);
    
    setNewPeriodData({
      period_year: year,
      period_month: month,
      period_start_date: dates.start,
      period_end_date: dates.end
    });
    setCustomAddDialogOpen(true);
  };

  // Handle custom add submit
  const handleCustomAddSubmit = async () => {
    try {
      await handleAdd({
        ...newPeriodData,
        period_name: dynamicPeriodName,
        user_id: user?.user_id || 0
      } as Omit<Period, 'id'>);
      setCustomAddDialogOpen(false);
    } catch (error) {
      // Error is already handled in handleAdd
    }
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
        onAdd={async () => {
          // Override with custom dialog
          handleCustomAddClick();
        }}
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

      {/* Custom Add Dialog */}
      <Dialog open={customAddDialogOpen} onOpenChange={setCustomAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить период</DialogTitle>
            <DialogDescription>
              Заполните поля для создания нового периода
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Dynamic Period Name */}
            <div>
              <label className="text-sm font-medium">Название периода</label>
              <div className="mt-1 flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 font-medium">
                  {dynamicPeriodName || 'Выберите год и месяц'}
                </span>
              </div>
            </div>

            {/* Year */}
            <div>
              <label className="text-sm font-medium">
                Год <span className="text-red-500">*</span>
              </label>
              <Select
                value={String(newPeriodData.period_year)}
                onValueChange={(value) => {
                  const year = Number(value);
                  const dates = generatePeriodDates(year, newPeriodData.period_month);
                  setNewPeriodData({
                    ...newPeriodData,
                    period_year: year,
                    period_start_date: dates.start,
                    period_end_date: dates.end
                  });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 11 }, (_, i) => 2020 + i).map(year => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month */}
            <div>
              <label className="text-sm font-medium">
                Месяц <span className="text-red-500">*</span>
              </label>
              <Select
                value={String(newPeriodData.period_month)}
                onValueChange={(value) => {
                  const month = Number(value);
                  const dates = generatePeriodDates(newPeriodData.period_year, month);
                  setNewPeriodData({
                    ...newPeriodData,
                    period_month: month,
                    period_start_date: dates.start,
                    period_end_date: dates.end
                  });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((name, index) => (
                    <SelectItem key={index + 1} value={String(index + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div>
              <label className="text-sm font-medium">
                Начало <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={newPeriodData.period_start_date}
                onChange={(e) => setNewPeriodData({
                  ...newPeriodData,
                  period_start_date: e.target.value
                })}
                className="mt-1"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="text-sm font-medium">
                Конец <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={newPeriodData.period_end_date}
                onChange={(e) => setNewPeriodData({
                  ...newPeriodData,
                  period_end_date: e.target.value
                })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomAddDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCustomAddSubmit}>
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { CRUDTable, type CRUDField } from './CRUDTable';
import { Badge } from '../ui/badge';
import { toast } from '../ui/use-toast';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../api/client';

interface Period {
  id: number;
  period_id: number;
  period_name: string;
  period_year: number;
  period_month: number;
  period_order: number;
  user_id: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export const PeriodManager: React.FC = () => {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  // Define fields for CRUD table
  const fields: CRUDField<Period>[] = [
    {
      key: 'period_name',
      label: 'Название периода',
      type: 'text',
      required: true,
      width: 'w-64',
      validation: (value) => {
        if (!value || value.trim().length < 3) {
          return 'Название должно содержать минимум 3 символа';
        }
        return null;
      },
    },
    {
      key: 'period_year',
      label: 'Год',
      type: 'number',
      required: true,
      width: 'w-24',
      validation: (value) => {
        const year = Number(value);
        if (year < 2020 || year > 2030) {
          return 'Год должен быть между 2020 и 2030';
        }
        return null;
      },
    },
    {
      key: 'period_month',
      label: 'Месяц',
      type: 'select',
      required: true,
      width: 'w-32',
      options: monthNames.map((name, index) => ({
        value: String(index + 1),
        label: name,
      })),
      renderCell: (value) => monthNames[value - 1] || '-',
    },
    {
      key: 'period_order',
      label: 'Порядок',
      type: 'number',
      required: true,
      width: 'w-24',
      validation: (value) => {
        if (Number(value) < 1) {
          return 'Порядок должен быть больше 0';
        }
        return null;
      },
    },
    {
      key: 'is_active',
      label: 'Активен',
      type: 'boolean',
      width: 'w-24',
      renderCell: (value) => value ? (
        <Badge variant="default">Активен</Badge>
      ) : (
        <Badge variant="secondary">Неактивен</Badge>
      ),
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
      const response = await apiClient.get(`/periods?user_id=${user.user_id}`);
      setPeriods(response.data.map((p: any) => ({
        ...p,
        id: p.period_id, // Map period_id to id for CRUD table
      })));
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

  useEffect(() => {
    fetchPeriods();
  }, [user]);

  // Add period
  const handleAdd = async (data: Omit<Period, 'id'>) => {
    if (!user?.user_id) return;
    
    const newPeriod = {
      ...data,
      user_id: user.user_id,
      period_month: Number(data.period_month),
      is_active: data.is_active || true,
    };

    try {
      await apiClient.post('/periods', newPeriod);
      await fetchPeriods();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось добавить период');
    }
  };

  // Update period
  const handleUpdate = async (id: number, data: Partial<Period>) => {
    const updateData = {
      ...data,
      period_month: data.period_month ? Number(data.period_month) : undefined,
    };

    try {
      await apiClient.put(`/periods/${id}`, updateData);
      await fetchPeriods();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось обновить период');
    }
  };

  // Delete period
  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/periods/${id}`);
      await fetchPeriods();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить период');
    }
  };

  // Bulk delete periods
  const handleBulkDelete = async (ids: number[]) => {
    try {
      // API doesn't support bulk delete, so we'll delete one by one
      await Promise.all(ids.map(id => apiClient.delete(`/periods/${id}`)));
      await fetchPeriods();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить периоды');
    }
  };

  // Export periods
  const handleExport = () => {
    const csvContent = [
      ['ID', 'Название', 'Год', 'Месяц', 'Порядок', 'Активен', 'Создан'].join(','),
      ...periods.map(p => [
        p.period_id,
        `"${p.period_name}"`,
        p.period_year,
        p.period_month,
        p.period_order,
        p.is_active ? 'Да' : 'Нет',
        p.created_at ? new Date(p.created_at).toLocaleDateString('ru-RU') : '',
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `periods_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Import periods
  const handleImport = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').slice(1); // Skip header
    
    const newPeriods: Omit<Period, 'id'>[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [, name, year, month, order, isActive] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      newPeriods.push({
        period_name: name,
        period_year: Number(year),
        period_month: Number(month),
        period_order: Number(order),
        is_active: isActive === 'Да',
        user_id: user!.user_id,
      } as Omit<Period, 'id'>);
    }

    // Add periods one by one
    for (const period of newPeriods) {
      await handleAdd(period);
    }
  };

  return (
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
    />
  );
};
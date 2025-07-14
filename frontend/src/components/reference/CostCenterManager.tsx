import React, { useState, useEffect } from 'react';
import { CRUDTable, type CRUDField } from './CRUDTable';
import { Badge } from '../ui/badge';
import { toast } from '../ui/use-toast';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../api/client';

interface CostCenter {
  id: number;
  cost_center_id: number;
  cost_center_name: string;
  cost_center_order: number;
  user_id: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const CostCenterManager: React.FC = () => {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  // Define fields for CRUD table
  const fields: CRUDField<CostCenter>[] = [
    {
      key: 'cost_center_name',
      label: 'Название МВЗ',
      type: 'text',
      required: true,
      width: 'w-96',
      validation: (value) => {
        if (!value || value.trim().length < 3) {
          return 'Название должно содержать минимум 3 символа';
        }
        if (value.trim().length > 100) {
          return 'Название не должно превышать 100 символов';
        }
        return null;
      },
    },
    {
      key: 'cost_center_order',
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
      label: 'Статус',
      type: 'boolean',
      width: 'w-32',
      renderCell: (value) => value ? (
        <Badge variant="default">Активен</Badge>
      ) : (
        <Badge variant="secondary">Неактивен</Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Дата создания',
      type: 'date',
      width: 'w-40',
      sortable: true,
      filterable: false,
      renderCell: (value) => {
        if (!value) return '-';
        return new Date(value).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      },
      renderEdit: () => null, // Read-only in edit mode
    },
  ];

  // Fetch cost centers
  const fetchCostCenters = async () => {
    if (!user?.user_id) return;
    
    try {
      setLoading(true);
      const response = await apiClient.get(`/cost_centers?user_id=${user.user_id}`);
      setCostCenters(response.data.map((cc: any) => ({
        ...cc,
        id: cc.cost_center_id, // Map cost_center_id to id for CRUD table
      })));
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить центры затрат',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostCenters();
  }, [user]);

  // Add cost center
  const handleAdd = async (data: Omit<CostCenter, 'id'>) => {
    if (!user?.user_id) return;
    
    const newCostCenter = {
      ...data,
      user_id: user.user_id,
      is_active: data.is_active !== false, // Default to true if not specified
    };

    try {
      await apiClient.post('/cost_centers', newCostCenter);
      await fetchCostCenters();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось добавить центр затрат');
    }
  };

  // Update cost center
  const handleUpdate = async (id: number, data: Partial<CostCenter>) => {
    try {
      await apiClient.put(`/cost_centers/${id}`, data);
      await fetchCostCenters();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось обновить центр затрат');
    }
  };

  // Delete cost center
  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/cost_centers/${id}`);
      await fetchCostCenters();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить центр затрат');
    }
  };

  // Bulk delete cost centers
  const handleBulkDelete = async (ids: number[]) => {
    try {
      // API doesn't support bulk delete, so we'll delete one by one
      await Promise.all(ids.map(id => apiClient.delete(`/cost_centers/${id}`)));
      await fetchCostCenters();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить центры затрат');
    }
  };

  // Export cost centers
  const handleExport = () => {
    const csvContent = [
      ['ID', 'Название МВЗ', 'Порядок', 'Статус', 'Дата создания'].join(','),
      ...costCenters.map(cc => [
        cc.cost_center_id,
        `"${cc.cost_center_name}"`,
        cc.cost_center_order,
        cc.is_active ? 'Активен' : 'Неактивен',
        cc.created_at ? new Date(cc.created_at).toLocaleDateString('ru-RU') : '',
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cost_centers_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Import cost centers
  const handleImport = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').slice(1); // Skip header
    
    const newCostCenters: Omit<CostCenter, 'id'>[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [, name, order, status] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      newCostCenters.push({
        cost_center_name: name,
        cost_center_order: Number(order),
        is_active: status === 'Активен',
        user_id: user!.user_id,
      } as Omit<CostCenter, 'id'>);
    }

    // Add cost centers one by one
    for (const cc of newCostCenters) {
      await handleAdd(cc);
    }
  };

  return (
    <CRUDTable
      title="Места возникновения затрат (МВЗ)"
      data={costCenters}
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
      emptyMessage="Нет добавленных центров затрат. Нажмите 'Добавить МВЗ' для создания нового."
      addButtonText="Добавить МВЗ"
    />
  );
};
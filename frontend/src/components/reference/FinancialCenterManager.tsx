import React, { useState, useEffect } from 'react';
import { CRUDTable, CRUDField } from './CRUDTable';
import { Badge } from '../ui/badge';
import { toast } from '../ui/use-toast';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../api/client';

interface FinancialCenter {
  id: number;
  financial_center_id: number;
  financial_center_name: string;
  financial_center_order: number;
  user_id: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const FinancialCenterManager: React.FC = () => {
  const [financialCenters, setFinancialCenters] = useState<FinancialCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  // Define fields for CRUD table
  const fields: CRUDField<FinancialCenter>[] = [
    {
      key: 'financial_center_name',
      label: 'Название ЦФО',
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
      key: 'financial_center_order',
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

  // Fetch financial centers
  const fetchFinancialCenters = async () => {
    if (!user?.user_id) return;
    
    try {
      setLoading(true);
      const response = await apiClient.get(`/financial_centers?user_id=${user.user_id}`);
      setFinancialCenters(response.data.map((fc: any) => ({
        ...fc,
        id: fc.financial_center_id, // Map financial_center_id to id for CRUD table
      })));
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить финансовые центры',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialCenters();
  }, [user]);

  // Add financial center
  const handleAdd = async (data: Omit<FinancialCenter, 'id'>) => {
    if (!user?.user_id) return;
    
    const newFinancialCenter = {
      ...data,
      user_id: user.user_id,
      is_active: data.is_active !== false, // Default to true if not specified
    };

    try {
      await apiClient.post('/financial_centers', newFinancialCenter);
      await fetchFinancialCenters();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось добавить финансовый центр');
    }
  };

  // Update financial center
  const handleUpdate = async (id: number, data: Partial<FinancialCenter>) => {
    try {
      await apiClient.put(`/financial_centers/${id}`, data);
      await fetchFinancialCenters();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось обновить финансовый центр');
    }
  };

  // Delete financial center
  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/financial_centers/${id}`);
      await fetchFinancialCenters();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить финансовый центр');
    }
  };

  // Bulk delete financial centers
  const handleBulkDelete = async (ids: number[]) => {
    try {
      // API doesn't support bulk delete, so we'll delete one by one
      await Promise.all(ids.map(id => apiClient.delete(`/financial_centers/${id}`)));
      await fetchFinancialCenters();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить финансовые центры');
    }
  };

  // Export financial centers
  const handleExport = () => {
    const csvContent = [
      ['ID', 'Название ЦФО', 'Порядок', 'Статус', 'Дата создания'].join(','),
      ...financialCenters.map(fc => [
        fc.financial_center_id,
        `"${fc.financial_center_name}"`,
        fc.financial_center_order,
        fc.is_active ? 'Активен' : 'Неактивен',
        fc.created_at ? new Date(fc.created_at).toLocaleDateString('ru-RU') : '',
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `financial_centers_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Import financial centers
  const handleImport = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').slice(1); // Skip header
    
    const newFinancialCenters: Omit<FinancialCenter, 'id'>[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [, name, order, status] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      newFinancialCenters.push({
        financial_center_name: name,
        financial_center_order: Number(order),
        is_active: status === 'Активен',
        user_id: user!.user_id,
      } as Omit<FinancialCenter, 'id'>);
    }

    // Add financial centers one by one
    for (const fc of newFinancialCenters) {
      await handleAdd(fc);
    }
  };

  return (
    <CRUDTable
      title="Центры финансовой ответственности (ЦФО)"
      data={financialCenters}
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
      emptyMessage="Нет добавленных финансовых центров. Нажмите 'Добавить ЦФО' для создания нового."
      addButtonText="Добавить ЦФО"
    />
  );
};
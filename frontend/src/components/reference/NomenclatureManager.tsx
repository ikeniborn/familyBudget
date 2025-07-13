import React, { useState, useEffect } from 'react';
import { CRUDTable, CRUDField } from './CRUDTable';
import { Badge } from '../ui/badge';
import { toast } from '../ui/use-toast';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../api/client';

interface Nomenclature {
  id: number;
  nomenclature_id: number;
  nomenclature_name: string;
  nomenclature_type: 'INCOME' | 'EXPENSE';
  parent_id?: number | null;
  nomenclature_order: number;
  user_id: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const NomenclatureManager: React.FC = () => {
  const [nomenclatures, setNomenclatures] = useState<Nomenclature[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  // Define fields for CRUD table
  const fields: CRUDField<Nomenclature>[] = [
    {
      key: 'nomenclature_name',
      label: 'Название категории',
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
      key: 'nomenclature_type',
      label: 'Тип',
      type: 'select',
      required: true,
      width: 'w-32',
      options: [
        { value: 'INCOME', label: 'Доход' },
        { value: 'EXPENSE', label: 'Расход' },
      ],
      renderCell: (value) => {
        switch (value) {
          case 'INCOME':
            return <Badge variant="default" className="bg-green-600">Доход</Badge>;
          case 'EXPENSE':
            return <Badge variant="destructive">Расход</Badge>;
          default:
            return '-';
        }
      },
    },
    {
      key: 'parent_id',
      label: 'Родительская категория',
      type: 'select',
      width: 'w-64',
      options: [], // Will be populated dynamically
      renderCell: (value, item) => {
        if (!value) return <span className="text-gray-500">—</span>;
        const parent = nomenclatures.find(n => n.nomenclature_id === value);
        return parent ? parent.nomenclature_name : '-';
      },
      renderEdit: (value, onChange, item) => {
        const availableParents = nomenclatures.filter(n => 
          n.nomenclature_id !== item.nomenclature_id && 
          n.nomenclature_type === item.nomenclature_type
        );
        
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            className="h-8 w-full rounded border px-2"
          >
            <option value="">Нет родительской категории</option>
            {availableParents.map(parent => (
              <option key={parent.nomenclature_id} value={parent.nomenclature_id}>
                {parent.nomenclature_name}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: 'nomenclature_order',
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
        <Badge variant="default">Активна</Badge>
      ) : (
        <Badge variant="secondary">Неактивна</Badge>
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
        });
      },
      renderEdit: () => null, // Read-only in edit mode
    },
  ];

  // Fetch nomenclatures
  const fetchNomenclatures = async () => {
    if (!user?.user_id) return;
    
    try {
      setLoading(true);
      const response = await apiClient.get(`/nomenclatures?user_id=${user.user_id}`);
      setNomenclatures(response.data.map((n: any) => ({
        ...n,
        id: n.nomenclature_id, // Map nomenclature_id to id for CRUD table
      })));
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить номенклатуры',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNomenclatures();
  }, [user]);

  // Add nomenclature
  const handleAdd = async (data: Omit<Nomenclature, 'id'>) => {
    if (!user?.user_id) return;
    
    const newNomenclature = {
      ...data,
      user_id: user.user_id,
      is_active: data.is_active !== false, // Default to true if not specified
      parent_id: data.parent_id || null,
    };

    try {
      await apiClient.post('/nomenclatures', newNomenclature);
      await fetchNomenclatures();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось добавить номенклатуру');
    }
  };

  // Update nomenclature
  const handleUpdate = async (id: number, data: Partial<Nomenclature>) => {
    try {
      await apiClient.put(`/nomenclatures/${id}`, data);
      await fetchNomenclatures();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось обновить номенклатуру');
    }
  };

  // Delete nomenclature
  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/nomenclatures/${id}`);
      await fetchNomenclatures();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить номенклатуру');
    }
  };

  // Bulk delete nomenclatures
  const handleBulkDelete = async (ids: number[]) => {
    try {
      // API doesn't support bulk delete, so we'll delete one by one
      await Promise.all(ids.map(id => apiClient.delete(`/nomenclatures/${id}`)));
      await fetchNomenclatures();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить номенклатуры');
    }
  };

  // Export nomenclatures
  const handleExport = () => {
    const csvContent = [
      ['ID', 'Название', 'Тип', 'Родительская категория', 'Порядок', 'Статус', 'Дата создания'].join(','),
      ...nomenclatures.map(n => [
        n.nomenclature_id,
        `"${n.nomenclature_name}"`,
        n.nomenclature_type === 'INCOME' ? 'Доход' : 'Расход',
        n.parent_id ? `"${nomenclatures.find(p => p.nomenclature_id === n.parent_id)?.nomenclature_name || ''}"` : '',
        n.nomenclature_order,
        n.is_active ? 'Активна' : 'Неактивна',
        n.created_at ? new Date(n.created_at).toLocaleDateString('ru-RU') : '',
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `nomenclatures_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Import nomenclatures
  const handleImport = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').slice(1); // Skip header
    
    const newNomenclatures: Omit<Nomenclature, 'id'>[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [, name, type, parentName, order, status] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      // Find parent ID if parent name is provided
      let parentId = null;
      if (parentName) {
        const parent = nomenclatures.find(n => n.nomenclature_name === parentName);
        parentId = parent ? parent.nomenclature_id : null;
      }
      
      newNomenclatures.push({
        nomenclature_name: name,
        nomenclature_type: type === 'Доход' ? 'INCOME' : 'EXPENSE',
        parent_id: parentId,
        nomenclature_order: Number(order),
        is_active: status === 'Активна',
        user_id: user!.user_id,
      } as Omit<Nomenclature, 'id'>);
    }

    // Add nomenclatures one by one
    for (const n of newNomenclatures) {
      await handleAdd(n);
    }
  };

  return (
    <CRUDTable
      title="Категории доходов и расходов"
      data={nomenclatures}
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
      emptyMessage="Нет добавленных категорий. Нажмите 'Добавить категорию' для создания новой."
      addButtonText="Добавить категорию"
    />
  );
};
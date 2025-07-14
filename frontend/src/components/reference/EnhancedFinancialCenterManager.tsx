import React, { useState, useEffect } from 'react';
import { CRUDTable, type CRUDField } from './CRUDTable';
import { Badge } from '../ui/badge';
import { toast } from '../ui/use-toast';
import { useAuthStore } from '../../stores/authStore';
import { financialCenterService } from '../../services/financialCenterService';
import { costCenterService } from '../../services/costCenterService';
import { registryService } from '../../services/registryService';
import { Building2, ChevronRight, BarChart3, Users, Activity } from 'lucide-react';

interface FinancialCenter {
  id: number;
  financial_center_id: number;
  financial_center_name: string;
  financial_center_description?: string;
  parent_id?: number | null;
  financial_center_order: number;
  user_id: number;
  is_active?: boolean;
  usage_stats?: {
    cost_centers_count: number;
    transactions_count: number;
    total_amount: number;
  };
  children?: FinancialCenter[];
  created_at?: string;
  updated_at?: string;
}

export const EnhancedFinancialCenterManager: React.FC = () => {
  const [financialCenters, setFinancialCenters] = useState<FinancialCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const { user } = useAuthStore();

  // Build hierarchy tree
  const buildHierarchy = (items: FinancialCenter[]): FinancialCenter[] => {
    const map = new Map<number, FinancialCenter>();
    const roots: FinancialCenter[] = [];

    // First pass: create map
    items.forEach(item => {
      map.set(item.financial_center_id, { ...item, children: [] });
    });

    // Second pass: build tree
    items.forEach(item => {
      const node = map.get(item.financial_center_id)!;
      if (item.parent_id && map.has(item.parent_id)) {
        const parent = map.get(item.parent_id)!;
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  // Flatten hierarchy for table display
  const flattenHierarchy = (items: FinancialCenter[], level = 0): FinancialCenter[] => {
    const result: FinancialCenter[] = [];
    
    items.forEach(item => {
      result.push({ ...item, level });
      if (item.children && item.children.length > 0) {
        result.push(...flattenHierarchy(item.children, level + 1));
      }
    });
    
    return result;
  };

  // Define fields for CRUD table
  const fields: CRUDField<FinancialCenter>[] = [
    {
      key: 'financial_center_name',
      label: 'Название ЦФО',
      type: 'text',
      required: true,
      width: 'w-96',
      renderCell: (value, item: any) => (
        <div 
          className="flex items-center gap-2"
          style={{ paddingLeft: `${(item.level || 0) * 24}px` }}
        >
          <Building2 className="h-4 w-4 text-gray-500" />
          <span className="font-medium">{value}</span>
          {item.children && item.children.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {item.children.length} подразд.
            </Badge>
          )}
          {item.is_active && (
            <Badge variant="default" className="ml-2">
              <Activity className="h-3 w-3 mr-1" />
              Активный
            </Badge>
          )}
        </div>
      ),
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
      key: 'financial_center_description',
      label: 'Описание',
      type: 'text',
      width: 'w-96',
      renderCell: (value) => (
        <span className="text-gray-600 text-sm">
          {value || '-'}
        </span>
      ),
      validation: (value) => {
        if (value && value.trim().length > 500) {
          return 'Описание не должно превышать 500 символов';
        }
        return null;
      },
    },
    {
      key: 'parent_id',
      label: 'Родительский ЦФО',
      type: 'select',
      width: 'w-64',
      options: [], // Will be populated dynamically
      renderCell: (value, item) => {
        if (!value) return <span className="text-gray-500">—</span>;
        const parent = financialCenters.find(fc => fc.financial_center_id === value);
        return parent ? (
          <div className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-gray-400" />
            <span className="text-sm">{parent.financial_center_name}</span>
          </div>
        ) : '-';
      },
      renderEdit: (value, onChange, item) => {
        // Filter out self and descendants to prevent circular references
        const availableParents = financialCenters.filter(fc => {
          if (fc.financial_center_id === item.financial_center_id) return false;
          // TODO: Also filter out descendants
          return true;
        });
        
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            className="h-8 w-full rounded border px-2"
          >
            <option value="">Нет родительского ЦФО</option>
            {availableParents.map(parent => (
              <option key={parent.financial_center_id} value={parent.financial_center_id}>
                {parent.financial_center_name}
              </option>
            ))}
          </select>
        );
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
      key: 'usage_stats',
      label: 'Статистика',
      type: 'custom',
      width: 'w-64',
      sortable: false,
      filterable: false,
      renderCell: (value: any) => {
        if (!showStats || !value) return '-';
        
        return (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-gray-500" />
              <span>{value.cost_centers_count || 0} МВЗ</span>
            </div>
            <div className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3 text-gray-500" />
              <span>{value.transactions_count || 0} транз.</span>
            </div>
          </div>
        );
      },
      renderEdit: () => null, // Read-only
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
      const financialCenters = await financialCenterService.getAll({ user_id: user.user_id });
      const data = financialCenters.map((fc: any) => ({
        ...fc,
        id: fc.financial_center_id, // Map financial_center_id to id for CRUD table
      }));
      
      // Build hierarchy and flatten for display
      const hierarchy = buildHierarchy(data);
      const flattened = flattenHierarchy(hierarchy);
      
      setFinancialCenters(flattened);
      
      // Fetch usage statistics if enabled
      if (showStats) {
        await fetchUsageStatistics(flattened);
      }
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

  // Fetch usage statistics
  const fetchUsageStatistics = async (centers: FinancialCenter[]) => {
    try {
      // In a real implementation, this would be a single API call
      // For now, we'll simulate with individual calls
      const statsMap: Record<number, any> = {};
      
      for (const center of centers) {
        try {
          // Fetch cost centers count
          const costCenters = await costCenterService.getAll({
            user_id: user?.user_id,
            financial_center_id: center.financial_center_id
          });
          
          // Fetch transactions count and amount
          const transactions = await registryService.getAll({
            user_id: user?.user_id,
            financial_center_id: center.financial_center_id
          });
          
          statsMap[center.financial_center_id] = {
            cost_centers_count: costCenters.length || 0,
            transactions_count: transactions.length || 0,
            total_amount: transactions.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0),
          };
        } catch (error) {
          statsMap[center.financial_center_id] = {
            cost_centers_count: 0,
            transactions_count: 0,
            total_amount: 0,
          };
        }
      }
      
      // Update financial centers with stats
      setFinancialCenters(prev => prev.map(fc => ({
        ...fc,
        usage_stats: statsMap[fc.financial_center_id] || {
          cost_centers_count: 0,
          transactions_count: 0,
          total_amount: 0,
        }
      })));
    } catch (error) {
      console.error('Failed to fetch usage statistics:', error);
    }
  };

  useEffect(() => {
    fetchFinancialCenters();
  }, [user, showStats]);

  // Add financial center
  const handleAdd = async (data: Omit<FinancialCenter, 'id'>) => {
    if (!user?.user_id) return;
    
    const newFinancialCenter = {
      ...data,
      user_id: user.user_id,
      is_active: data.is_active !== false, // Default to true if not specified
      parent_id: data.parent_id || null,
    };

    try {
      await financialCenterService.create(newFinancialCenter);
      await fetchFinancialCenters();
      
      toast({
        title: 'Успешно',
        description: 'Финансовый центр создан',
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось добавить финансовый центр');
    }
  };

  // Update financial center
  const handleUpdate = async (id: number, data: Partial<FinancialCenter>) => {
    // Prevent circular references
    if (data.parent_id === id) {
      toast({
        title: 'Ошибка',
        description: 'ЦФО не может быть родительским для самого себя',
        variant: 'destructive',
      });
      throw new Error('Circular reference detected');
    }

    try {
      await financialCenterService.update(id, data);
      await fetchFinancialCenters();
      
      toast({
        title: 'Успешно',
        description: 'Финансовый центр обновлен',
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось обновить финансовый центр');
    }
  };

  // Delete financial center
  const handleDelete = async (id: number) => {
    const fc = financialCenters.find(f => f.financial_center_id === id);
    
    // Check if has children
    if (fc && fc.children && fc.children.length > 0) {
      toast({
        title: 'Ошибка',
        description: 'Нельзя удалить ЦФО с подразделениями. Сначала удалите или переместите подразделения.',
        variant: 'destructive',
      });
      throw new Error('Cannot delete parent financial center');
    }
    
    // Check usage
    if (fc && fc.usage_stats && fc.usage_stats.cost_centers_count > 0) {
      const confirmed = window.confirm(
        `ЦФО "${fc.financial_center_name}" используется в ${fc.usage_stats.cost_centers_count} МВЗ. Вы уверены, что хотите удалить его?`
      );
      
      if (!confirmed) {
        throw new Error('Удаление отменено');
      }
    }

    try {
      await financialCenterService.delete(id);
      await fetchFinancialCenters();
      
      toast({
        title: 'Успешно',
        description: 'Финансовый центр удален',
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить финансовый центр');
    }
  };

  // Bulk delete financial centers
  const handleBulkDelete = async (ids: number[]) => {
    // Check for parents in selection
    const hasParents = financialCenters.some(fc => 
      ids.includes(fc.financial_center_id) && fc.children && fc.children.length > 0
    );
    
    if (hasParents) {
      toast({
        title: 'Ошибка',
        description: 'В выборке есть ЦФО с подразделениями. Удалите сначала подразделения.',
        variant: 'destructive',
      });
      throw new Error('Cannot delete parent financial centers');
    }

    try {
      await Promise.all(ids.map(id => financialCenterService.delete(id)));
      await fetchFinancialCenters();
      
      toast({
        title: 'Успешно',
        description: `Удалено финансовых центров: ${ids.length}`,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить финансовые центры');
    }
  };

  // Enhanced export
  const handleExport = () => {
    const csvContent = [
      ['ID', 'Название ЦФО', 'Описание', 'Родительский ЦФО', 'Порядок', 'Статус', 'МВЗ', 'Транзакций', 'Дата создания'].join(','),
      ...financialCenters.map(fc => {
        const parent = fc.parent_id ? 
          financialCenters.find(p => p.financial_center_id === fc.parent_id)?.financial_center_name || '' : '';
        
        return [
          fc.financial_center_id,
          `"${fc.financial_center_name}"`,
          `"${fc.financial_center_description || ''}"`,
          `"${parent}"`,
          fc.financial_center_order,
          fc.is_active ? 'Активен' : 'Неактивен',
          fc.usage_stats?.cost_centers_count || 0,
          fc.usage_stats?.transactions_count || 0,
          fc.created_at ? new Date(fc.created_at).toLocaleDateString('ru-RU') : '',
        ].join(',');
      })
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
      
      const [, name, description, parentName, order, status] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      // Find parent ID if parent name is provided
      let parentId = null;
      if (parentName) {
        const parent = financialCenters.find(fc => fc.financial_center_name === parentName);
        parentId = parent ? parent.financial_center_id : null;
      }
      
      newFinancialCenters.push({
        financial_center_name: name,
        financial_center_description: description || undefined,
        parent_id: parentId,
        financial_center_order: Number(order),
        is_active: status === 'Активен',
        user_id: user!.user_id,
      } as Omit<FinancialCenter, 'id'>);
    }

    // Add financial centers one by one
    for (const fc of newFinancialCenters) {
      await handleAdd(fc);
    }
    
    toast({
      title: 'Импорт завершен',
      description: `Добавлено финансовых центров: ${newFinancialCenters.length}`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Statistics toggle */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-gray-600" />
            <div>
              <h3 className="font-medium">Статистика использования</h3>
              <p className="text-sm text-gray-600">
                Показать количество МВЗ и транзакций для каждого ЦФО
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showStats}
              onChange={(e) => setShowStats(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
      
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
    </div>
  );
};
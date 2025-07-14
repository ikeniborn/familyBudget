import React, { useState, useEffect } from 'react';
import { CRUDTable, type CRUDField } from './CRUDTable';
import { Badge } from '../ui/badge';
import { toast } from '../ui/use-toast';
import { useAuthStore } from '../../stores/authStore';
import { costCenterService } from '../../services/costCenterService';
import { financialCenterService } from '../../services/financialCenterService';
import { registryService } from '../../services/registryService';
import { Briefcase, Building2, DollarSign, History, Copy, AlertCircle } from 'lucide-react';

interface CostCenter {
  id: number;
  cost_center_id: number;
  cost_center_name: string;
  cost_center_description?: string;
  financial_center_id?: number | null;
  budget_limit?: number;
  budget_period?: 'monthly' | 'quarterly' | 'yearly';
  cost_center_order: number;
  user_id: number;
  is_active?: boolean;
  current_usage?: number;
  usage_percentage?: number;
  history?: CostCenterHistory[];
  created_at?: string;
  updated_at?: string;
}

interface CostCenterHistory {
  id: number;
  action: 'created' | 'updated' | 'budget_changed' | 'activated' | 'deactivated';
  old_value?: any;
  new_value?: any;
  changed_by: number;
  changed_at: string;
  description?: string;
}

interface FinancialCenter {
  financial_center_id: number;
  financial_center_name: string;
}

export const EnhancedCostCenterManager: React.FC = () => {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [financialCenters, setFinancialCenters] = useState<FinancialCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedForCopy, setSelectedForCopy] = useState<number[]>([]);
  const { user } = useAuthStore();

  // Fetch financial centers for dropdown
  const fetchFinancialCenters = async () => {
    if (!user?.user_id) return;
    
    try {
      const financialCenters = await financialCenterService.getAll({ user_id: user.user_id });
      setFinancialCenters(financialCenters);
    } catch (error) {
      console.error('Failed to fetch financial centers:', error);
    }
  };

  // Define fields for CRUD table
  const fields: CRUDField<CostCenter>[] = [
    {
      key: 'cost_center_name',
      label: 'Название МВЗ',
      type: 'text',
      required: true,
      width: 'w-96',
      renderCell: (value, item) => (
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-gray-500" />
          <span className="font-medium">{value}</span>
          {item.is_active && (
            <Badge variant="default" className="ml-2">
              Активный
            </Badge>
          )}
          {item.budget_limit && item.usage_percentage !== undefined && (
            <Badge 
              variant={item.usage_percentage > 90 ? "destructive" : item.usage_percentage > 70 ? "secondary" : "default"}
              className="ml-2"
            >
              {item.usage_percentage.toFixed(0)}%
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
      key: 'cost_center_description',
      label: 'Описание',
      type: 'text',
      width: 'w-96',
      renderCell: (value) => (
        <span className="text-gray-600 text-sm">
          {value || '-'}
        </span>
      ),
    },
    {
      key: 'financial_center_id',
      label: 'Финансовый центр',
      type: 'select',
      width: 'w-64',
      options: financialCenters.map(fc => ({
        value: String(fc.financial_center_id),
        label: fc.financial_center_name,
      })),
      renderCell: (value) => {
        if (!value) return <span className="text-gray-500">Не назначен</span>;
        const fc = financialCenters.find(f => f.financial_center_id === value);
        return fc ? (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-500" />
            <span className="text-sm">{fc.financial_center_name}</span>
          </div>
        ) : '-';
      },
    },
    {
      key: 'budget_limit',
      label: 'Бюджетный лимит',
      type: 'number',
      width: 'w-40',
      renderCell: (value, item) => {
        if (!value) return <span className="text-gray-500">Не установлен</span>;
        
        const periodText = item.budget_period === 'monthly' ? 'мес.' : 
                          item.budget_period === 'quarterly' ? 'кв.' : 'год';
        
        return (
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gray-500" />
            <span className="font-medium">
              {value.toLocaleString('ru-RU')} ₽/{periodText}
            </span>
          </div>
        );
      },
      validation: (value) => {
        if (value && Number(value) < 0) {
          return 'Лимит не может быть отрицательным';
        }
        return null;
      },
    },
    {
      key: 'budget_period',
      label: 'Период',
      type: 'select',
      width: 'w-32',
      options: [
        { value: 'monthly', label: 'Месяц' },
        { value: 'quarterly', label: 'Квартал' },
        { value: 'yearly', label: 'Год' },
      ],
      renderCell: (value) => {
        const labels: Record<string, string> = {
          monthly: 'Месячный',
          quarterly: 'Квартальный',
          yearly: 'Годовой',
        };
        return value ? labels[value] || value : '-';
      },
    },
    {
      key: 'current_usage',
      label: 'Использовано',
      type: 'number',
      width: 'w-40',
      sortable: true,
      renderCell: (value, item) => {
        if (!value && value !== 0) return '-';
        
        return (
          <div className="text-sm">
            <div className="font-medium">{value.toLocaleString('ru-RU')} ₽</div>
            {item.budget_limit && (
              <div className="text-xs text-gray-500">
                из {item.budget_limit.toLocaleString('ru-RU')} ₽
              </div>
            )}
          </div>
        );
      },
      renderEdit: () => null, // Read-only
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
      
      // Fetch financial centers first
      await fetchFinancialCenters();
      
      const costCentersResponse = await costCenterService.getAll({ user_id: user.user_id });
      const costCentersData = costCentersResponse.map((cc: any) => ({
        ...cc,
        id: cc.cost_center_id, // Map cost_center_id to id for CRUD table
      }));
      
      // Fetch usage data for each cost center
      await fetchUsageData(costCentersData);
      
      setCostCenters(costCentersData);
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

  // Fetch usage data
  const fetchUsageData = async (centers: CostCenter[]) => {
    try {
      // In a real implementation, this would be a single API call
      const usageMap: Record<number, number> = {};
      
      for (const center of centers) {
        try {
          const registryData = await registryService.getAll({
            user_id: user?.user_id,
            cost_center_id: center.cost_center_id
          });
          
          const totalUsage = registryData.reduce((sum: number, tx: any) => 
            sum + (tx.amount || 0), 0
          );
          
          usageMap[center.cost_center_id] = totalUsage;
        } catch (error) {
          usageMap[center.cost_center_id] = 0;
        }
      }
      
      // Update cost centers with usage data
      setCostCenters(prev => prev.map(cc => {
        const usage = usageMap[cc.cost_center_id] || 0;
        const percentage = cc.budget_limit ? (usage / cc.budget_limit) * 100 : 0;
        
        return {
          ...cc,
          current_usage: usage,
          usage_percentage: percentage,
        };
      }));
    } catch (error) {
      console.error('Failed to fetch usage data:', error);
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
      financial_center_id: data.financial_center_id ? Number(data.financial_center_id) : null,
      budget_limit: data.budget_limit ? Number(data.budget_limit) : null,
    };

    try {
      await costCenterService.create(newCostCenter);
      await fetchCostCenters();
      
      toast({
        title: 'Успешно',
        description: 'Центр затрат создан',
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось добавить центр затрат');
    }
  };

  // Update cost center
  const handleUpdate = async (id: number, data: Partial<CostCenter>) => {
    const updateData: any = {
      ...data,
      financial_center_id: data.financial_center_id !== undefined ? 
        (data.financial_center_id ? Number(data.financial_center_id) : null) : undefined,
      budget_limit: data.budget_limit !== undefined ? 
        (data.budget_limit ? Number(data.budget_limit) : null) : undefined,
    };

    try {
      await costCenterService.update(id, updateData);
      await fetchCostCenters();
      
      toast({
        title: 'Успешно',
        description: 'Центр затрат обновлен',
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось обновить центр затрат');
    }
  };

  // Delete cost center
  const handleDelete = async (id: number) => {
    const cc = costCenters.find(c => c.cost_center_id === id);
    
    if (cc && cc.current_usage && cc.current_usage > 0) {
      const confirmed = window.confirm(
        `Центр затрат "${cc.cost_center_name}" имеет транзакции на сумму ${cc.current_usage.toLocaleString('ru-RU')} ₽. Вы уверены, что хотите удалить его?`
      );
      
      if (!confirmed) {
        throw new Error('Удаление отменено');
      }
    }

    try {
      await costCenterService.delete(id);
      await fetchCostCenters();
      
      toast({
        title: 'Успешно',
        description: 'Центр затрат удален',
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить центр затрат');
    }
  };

  // Bulk delete cost centers
  const handleBulkDelete = async (ids: number[]) => {
    const centersWithUsage = costCenters.filter(
      cc => ids.includes(cc.cost_center_id) && cc.current_usage && cc.current_usage > 0
    );
    
    if (centersWithUsage.length > 0) {
      const totalUsage = centersWithUsage.reduce(
        (sum, cc) => sum + (cc.current_usage || 0), 0
      );
      
      const confirmed = window.confirm(
        `${centersWithUsage.length} из выбранных центров затрат имеют транзакции на общую сумму ${totalUsage.toLocaleString('ru-RU')} ₽. Вы уверены, что хотите удалить их?`
      );
      
      if (!confirmed) {
        throw new Error('Удаление отменено');
      }
    }

    try {
      await Promise.all(ids.map(id => costCenterService.delete(id)));
      await fetchCostCenters();
      
      toast({
        title: 'Успешно',
        description: `Удалено центров затрат: ${ids.length}`,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить центры затрат');
    }
  };

  // Bulk copy cost centers
  const handleBulkCopy = async () => {
    if (selectedForCopy.length === 0) {
      toast({
        title: 'Ошибка',
        description: 'Выберите центры затрат для копирования',
        variant: 'destructive',
      });
      return;
    }

    try {
      for (const id of selectedForCopy) {
        const original = costCenters.find(cc => cc.cost_center_id === id);
        if (!original) continue;
        
        const copyData = {
          ...original,
          cost_center_name: `${original.cost_center_name} (копия)`,
          is_active: false, // Deactivate copies by default
        };
        
        delete (copyData as any).id;
        delete (copyData as any).cost_center_id;
        delete (copyData as any).current_usage;
        delete (copyData as any).usage_percentage;
        delete (copyData as any).created_at;
        delete (copyData as any).updated_at;
        
        await handleAdd(copyData);
      }
      
      setSelectedForCopy([]);
      
      toast({
        title: 'Успешно',
        description: `Скопировано центров затрат: ${selectedForCopy.length}`,
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось скопировать центры затрат',
        variant: 'destructive',
      });
    }
  };

  // Enhanced export
  const handleExport = () => {
    const csvContent = [
      ['ID', 'Название МВЗ', 'Описание', 'Финансовый центр', 'Бюджетный лимит', 'Период', 'Использовано', 'Процент', 'Порядок', 'Статус', 'Дата создания'].join(','),
      ...costCenters.map(cc => {
        const fc = cc.financial_center_id ? 
          financialCenters.find(f => f.financial_center_id === cc.financial_center_id)?.financial_center_name || '' : '';
        
        const periodText = cc.budget_period === 'monthly' ? 'Месяц' : 
                          cc.budget_period === 'quarterly' ? 'Квартал' : 
                          cc.budget_period === 'yearly' ? 'Год' : '';
        
        return [
          cc.cost_center_id,
          `"${cc.cost_center_name}"`,
          `"${cc.cost_center_description || ''}"`,
          `"${fc}"`,
          cc.budget_limit || '',
          periodText,
          cc.current_usage || 0,
          cc.usage_percentage ? `${cc.usage_percentage.toFixed(0)}%` : '',
          cc.cost_center_order,
          cc.is_active ? 'Активен' : 'Неактивен',
          cc.created_at ? new Date(cc.created_at).toLocaleDateString('ru-RU') : '',
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cost_centers_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Enhanced import
  const handleImport = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').slice(1); // Skip header
    
    const newCostCenters: Omit<CostCenter, 'id'>[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [, name, description, fcName, limit, period, , , order, status] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      // Find financial center ID
      let fcId = null;
      if (fcName) {
        const fc = financialCenters.find(f => f.financial_center_name === fcName);
        fcId = fc ? fc.financial_center_id : null;
      }
      
      // Map period
      const periodMap: Record<string, string> = {
        'Месяц': 'monthly',
        'Квартал': 'quarterly',
        'Год': 'yearly',
      };
      
      newCostCenters.push({
        cost_center_name: name,
        cost_center_description: description || undefined,
        financial_center_id: fcId,
        budget_limit: limit ? Number(limit) : undefined,
        budget_period: periodMap[period] as any || 'monthly',
        cost_center_order: Number(order),
        is_active: status === 'Активен',
        user_id: user!.user_id,
      } as Omit<CostCenter, 'id'>);
    }

    // Add cost centers one by one
    for (const cc of newCostCenters) {
      await handleAdd(cc);
    }
    
    toast({
      title: 'Импорт завершен',
      description: `Добавлено центров затрат: ${newCostCenters.length}`,
    });
  };

  // Custom actions
  const customActions = (item: CostCenter) => {
    return (
      <div className="flex items-center gap-2">
        <button
          className="p-1 hover:bg-gray-100 rounded"
          title="Копировать"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedForCopy(prev => 
              prev.includes(item.cost_center_id) 
                ? prev.filter(id => id !== item.cost_center_id)
                : [...prev, item.cost_center_id]
            );
          }}
        >
          <Copy className={`h-4 w-4 ${selectedForCopy.includes(item.cost_center_id) ? 'text-blue-600' : 'text-gray-500'}`} />
        </button>
        {showHistory && (
          <button
            className="p-1 hover:bg-gray-100 rounded"
            title="История"
            onClick={(e) => {
              e.stopPropagation();
              // Show history modal
              toast({
                title: 'История изменений',
                description: 'Функция в разработке',
              });
            }}
          >
            <History className="h-4 w-4 text-gray-500" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Info and actions */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">Управление центрами затрат</p>
              <p>
                Центры затрат (МВЗ) привязываются к финансовым центрам (ЦФО) и могут иметь бюджетные лимиты.
                Система автоматически отслеживает использование бюджета.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedForCopy.length > 0 && (
              <button
                onClick={handleBulkCopy}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Копировать ({selectedForCopy.length})
              </button>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showHistory}
                onChange={(e) => setShowHistory(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">История</span>
            </label>
          </div>
        </div>
      </div>
      
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
        customActions={customActions}
      />
    </div>
  );
};
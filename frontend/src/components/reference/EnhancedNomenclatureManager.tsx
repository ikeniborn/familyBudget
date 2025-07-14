import React, { useState, useEffect } from 'react';
import { CRUDTable, type CRUDField } from './CRUDTable';
import { Badge } from '../ui/badge';
import { toast } from '../ui/use-toast';
import { useAuthStore } from '../../stores/authStore';
import { nomenclatureService } from '../../services';
import {
  Tags,
  ChevronRight,
  ChevronDown,
  Circle,
  Square,
  Palette,
  FileJson,
  Upload,
  Download,
  AlertCircle,
  Zap,
  ShoppingCart,
  Home,
  Car,
  Heart,
  Utensils,
  Gift,
  Briefcase,
  Book,
  Music,
  Plane,
  DollarSign,
  CreditCard,
  Wallet,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
} from 'lucide-react';

interface Nomenclature {
  id: number;
  nomenclature_id: number;
  nomenclature_name: string;
  nomenclature_type: 'INCOME' | 'EXPENSE';
  parent_id?: number | null;
  nomenclature_order: number;
  color?: string;
  icon?: string;
  auto_rules?: AutoCategorizationRule[];
  user_id: number;
  is_active?: boolean;
  is_expanded?: boolean;
  level?: number;
  children?: Nomenclature[];
  transaction_count?: number;
  total_amount?: number;
  created_at?: string;
  updated_at?: string;
}

interface AutoCategorizationRule {
  id?: number;
  rule_type: 'contains' | 'starts_with' | 'ends_with' | 'equals' | 'regex';
  pattern: string;
  case_sensitive: boolean;
  priority: number;
}

// Available icons for categories
const availableIcons = [
  { name: 'shopping-cart', icon: ShoppingCart, label: 'Покупки' },
  { name: 'home', icon: Home, label: 'Дом' },
  { name: 'car', icon: Car, label: 'Транспорт' },
  { name: 'heart', icon: Heart, label: 'Здоровье' },
  { name: 'utensils', icon: Utensils, label: 'Еда' },
  { name: 'gift', icon: Gift, label: 'Подарки' },
  { name: 'briefcase', icon: Briefcase, label: 'Работа' },
  { name: 'book', icon: Book, label: 'Образование' },
  { name: 'music', icon: Music, label: 'Развлечения' },
  { name: 'plane', icon: Plane, label: 'Путешествия' },
  { name: 'dollar-sign', icon: DollarSign, label: 'Доходы' },
  { name: 'credit-card', icon: CreditCard, label: 'Платежи' },
  { name: 'wallet', icon: Wallet, label: 'Сбережения' },
  { name: 'trending-up', icon: TrendingUp, label: 'Инвестиции' },
  { name: 'trending-down', icon: TrendingDown, label: 'Расходы' },
  { name: 'more-horizontal', icon: MoreHorizontal, label: 'Прочее' },
];

// Predefined colors for categories
const categoryColors = [
  { value: '#3B82F6', label: 'Синий' },
  { value: '#10B981', label: 'Зеленый' },
  { value: '#EF4444', label: 'Красный' },
  { value: '#F59E0B', label: 'Оранжевый' },
  { value: '#8B5CF6', label: 'Фиолетовый' },
  { value: '#EC4899', label: 'Розовый' },
  { value: '#06B6D4', label: 'Голубой' },
  { value: '#F97316', label: 'Коралловый' },
  { value: '#84CC16', label: 'Лайм' },
  { value: '#6366F1', label: 'Индиго' },
];

export const EnhancedNomenclatureManager: React.FC = () => {
  const [nomenclatures, setNomenclatures] = useState<Nomenclature[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTreeView, setShowTreeView] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [showAutoRules, setShowAutoRules] = useState(false);
  const { user } = useAuthStore();

  // Build hierarchy tree
  const buildHierarchy = (items: Nomenclature[]): Nomenclature[] => {
    const map = new Map<number, Nomenclature>();
    const roots: Nomenclature[] = [];

    // First pass: create map
    items.forEach(item => {
      map.set(item.nomenclature_id, { ...item, children: [] });
    });

    // Second pass: build tree
    items.forEach(item => {
      const node = map.get(item.nomenclature_id)!;
      if (item.parent_id && map.has(item.parent_id)) {
        const parent = map.get(item.parent_id)!;
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort by type (INCOME first) and then by order
    roots.sort((a, b) => {
      if (a.nomenclature_type !== b.nomenclature_type) {
        return a.nomenclature_type === 'INCOME' ? -1 : 1;
      }
      return a.nomenclature_order - b.nomenclature_order;
    });

    return roots;
  };

  // Flatten hierarchy for table display
  const flattenHierarchy = (items: Nomenclature[], level = 0): Nomenclature[] => {
    const result: Nomenclature[] = [];
    
    items.forEach(item => {
      const isExpanded = expandedIds.has(item.nomenclature_id);
      result.push({ ...item, level, is_expanded: isExpanded });
      
      if (item.children && item.children.length > 0 && (isExpanded || !showTreeView)) {
        result.push(...flattenHierarchy(item.children, level + 1));
      }
    });
    
    return result;
  };

  // Toggle node expansion
  const toggleExpanded = (id: number) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Get icon component
  const getIconComponent = (iconName?: string) => {
    if (!iconName) return Tags;
    const iconConfig = availableIcons.find(i => i.name === iconName);
    return iconConfig?.icon || Tags;
  };

  // Define fields for CRUD table
  const fields: CRUDField<Nomenclature>[] = [
    {
      key: 'nomenclature_name',
      label: 'Название категории',
      type: 'text',
      required: true,
      width: 'w-96',
      renderCell: (value, item: any) => {
        const Icon = getIconComponent(item.icon);
        const hasChildren = item.children && item.children.length > 0;
        
        return (
          <div 
            className="flex items-center gap-2"
            style={{ paddingLeft: showTreeView ? `${(item.level || 0) * 24}px` : '0' }}
          >
            {showTreeView && hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(item.nomenclature_id);
                }}
                className="p-0.5 hover:bg-gray-100 rounded"
              >
                {item.is_expanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </button>
            )}
            {(!showTreeView || !hasChildren) && (
              <div className="w-5" />
            )}
            
            <div
              className="p-1.5 rounded"
              style={{ backgroundColor: item.color ? `${item.color}20` : '#e5e7eb' }}
            >
              <Icon 
                className="h-4 w-4" 
                style={{ color: item.color || '#6b7280' }}
              />
            </div>
            
            <span className="font-medium">{value}</span>
            
            {hasChildren && (
              <Badge variant="secondary" className="ml-2">
                {item.children.length} подкат.
              </Badge>
            )}
            
            {item.auto_rules && item.auto_rules.length > 0 && (
              <Badge variant="outline" className="ml-2">
                <Zap className="h-3 w-3 mr-1" />
                Авто
              </Badge>
            )}
          </div>
        );
      },
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
      key: 'color',
      label: 'Цвет',
      type: 'custom',
      width: 'w-32',
      renderCell: (value) => (
        <div className="flex items-center gap-2">
          <div 
            className="w-6 h-6 rounded border"
            style={{ backgroundColor: value || '#e5e7eb' }}
          />
          <span className="text-sm text-gray-600">
            {value || 'По умолчанию'}
          </span>
        </div>
      ),
      renderEdit: (value, onChange) => (
        <div className="flex items-center gap-2">
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 h-8 rounded border px-2"
          >
            <option value="">По умолчанию</option>
            {categoryColors.map(color => (
              <option key={color.value} value={color.value}>
                {color.label}
              </option>
            ))}
          </select>
          <div 
            className="w-8 h-8 rounded border"
            style={{ backgroundColor: value || '#e5e7eb' }}
          />
        </div>
      ),
    },
    {
      key: 'icon',
      label: 'Иконка',
      type: 'custom',
      width: 'w-40',
      renderCell: (value) => {
        const Icon = getIconComponent(value);
        const iconConfig = availableIcons.find(i => i.name === value);
        return (
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-gray-600" />
            <span className="text-sm text-gray-600">
              {iconConfig?.label || 'По умолчанию'}
            </span>
          </div>
        );
      },
      renderEdit: (value, onChange) => (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-full rounded border px-2"
        >
          <option value="">По умолчанию</option>
          {availableIcons.map(icon => (
            <option key={icon.name} value={icon.name}>
              {icon.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'transaction_count',
      label: 'Использование',
      type: 'custom',
      width: 'w-32',
      sortable: true,
      filterable: false,
      renderCell: (value, item) => {
        if (!item.transaction_count) return '-';
        return (
          <div className="text-sm">
            <div>{item.transaction_count} транз.</div>
            {item.total_amount && (
              <div className="text-xs text-gray-500">
                {item.total_amount.toLocaleString('ru-RU')} ₽
              </div>
            )}
          </div>
        );
      },
      renderEdit: () => null, // Read-only
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
  ];

  // Fetch nomenclatures
  const fetchNomenclatures = async () => {
    if (!user?.user_id) return;
    
    try {
      setLoading(true);
      const responseData = await nomenclatureService.getAll();
      const data = responseData.map((n: any) => ({
        ...n,
        id: n.nomenclature_id, // Map nomenclature_id to id for CRUD table
      }));
      
      // Build hierarchy and flatten for display
      const hierarchy = buildHierarchy(data);
      const flattened = flattenHierarchy(hierarchy);
      
      setNomenclatures(flattened);
      
      // Expand all by default
      const allIds = new Set(data.map((n: any) => n.nomenclature_id));
      setExpandedIds(allIds);
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
      color: data.color || undefined,
      icon: data.icon || undefined,
    };

    try {
      await nomenclatureService.create(newNomenclature);
      await fetchNomenclatures();
      
      toast({
        title: 'Успешно',
        description: 'Категория создана',
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось добавить категорию');
    }
  };

  // Update nomenclature
  const handleUpdate = async (id: number, data: Partial<Nomenclature>) => {
    // Prevent circular references
    if (data.parent_id === id) {
      toast({
        title: 'Ошибка',
        description: 'Категория не может быть родительской для самой себя',
        variant: 'destructive',
      });
      throw new Error('Circular reference detected');
    }

    try {
      await nomenclatureService.update(id, data);
      await fetchNomenclatures();
      
      toast({
        title: 'Успешно',
        description: 'Категория обновлена',
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось обновить категорию');
    }
  };

  // Delete nomenclature
  const handleDelete = async (id: number) => {
    const nom = nomenclatures.find(n => n.nomenclature_id === id);
    
    // Check if has children
    if (nom && nom.children && nom.children.length > 0) {
      toast({
        title: 'Ошибка',
        description: 'Нельзя удалить категорию с подкатегориями. Сначала удалите или переместите подкатегории.',
        variant: 'destructive',
      });
      throw new Error('Cannot delete parent category');
    }
    
    // Check usage
    if (nom && nom.transaction_count && nom.transaction_count > 0) {
      const confirmed = window.confirm(
        `Категория "${nom.nomenclature_name}" используется в ${nom.transaction_count} транзакциях. Вы уверены, что хотите удалить её?`
      );
      
      if (!confirmed) {
        throw new Error('Удаление отменено');
      }
    }

    try {
      await nomenclatureService.delete(id);
      await fetchNomenclatures();
      
      toast({
        title: 'Успешно',
        description: 'Категория удалена',
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить категорию');
    }
  };

  // Bulk delete nomenclatures
  const handleBulkDelete = async (ids: number[]) => {
    // Check for parents in selection
    const hasParents = nomenclatures.some(n => 
      ids.includes(n.nomenclature_id) && n.children && n.children.length > 0
    );
    
    if (hasParents) {
      toast({
        title: 'Ошибка',
        description: 'В выборке есть категории с подкатегориями. Удалите сначала подкатегории.',
        variant: 'destructive',
      });
      throw new Error('Cannot delete parent categories');
    }

    try {
      await Promise.all(ids.map(id => nomenclatureService.delete(id)));
      await fetchNomenclatures();
      
      toast({
        title: 'Успешно',
        description: `Удалено категорий: ${ids.length}`,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить категории');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const csvContent = [
      ['ID', 'Название', 'Тип', 'Родительская категория', 'Цвет', 'Иконка', 'Порядок', 'Статус', 'Транзакций', 'Сумма'].join(','),
      ...nomenclatures.map(n => {
        const parent = n.parent_id ? 
          nomenclatures.find(p => p.nomenclature_id === n.parent_id)?.nomenclature_name || '' : '';
        
        return [
          n.nomenclature_id,
          `"${n.nomenclature_name}"`,
          n.nomenclature_type === 'INCOME' ? 'Доход' : 'Расход',
          `"${parent}"`,
          n.color || '',
          n.icon || '',
          n.nomenclature_order,
          n.is_active ? 'Активна' : 'Неактивна',
          n.transaction_count || 0,
          n.total_amount || 0,
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `nomenclatures_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Export to JSON
  const handleExportJSON = () => {
    const hierarchy = buildHierarchy(nomenclatures);
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      user_id: user?.user_id,
      nomenclatures: hierarchy,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `nomenclatures_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  // Import from CSV
  const handleImportCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').slice(1); // Skip header
    
    const newNomenclatures: Omit<Nomenclature, 'id'>[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [, name, type, parentName, color, icon, order, status] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
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
        color: color || undefined,
        icon: icon || undefined,
        nomenclature_order: Number(order),
        is_active: status === 'Активна',
        user_id: user!.user_id,
      } as Omit<Nomenclature, 'id'>);
    }

    // Add nomenclatures one by one
    for (const n of newNomenclatures) {
      await handleAdd(n);
    }
    
    toast({
      title: 'Импорт завершен',
      description: `Добавлено категорий: ${newNomenclatures.length}`,
    });
  };

  // Import from JSON
  const handleImportJSON = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.nomenclatures || !Array.isArray(data.nomenclatures)) {
        throw new Error('Неверный формат файла');
      }
      
      // Recursively import nomenclatures
      const importNomenclature = async (nom: any, parentId?: number) => {
        const newNom = {
          nomenclature_name: nom.nomenclature_name,
          nomenclature_type: nom.nomenclature_type,
          parent_id: parentId || null,
          color: nom.color,
          icon: nom.icon,
          nomenclature_order: nom.nomenclature_order || 1,
          is_active: nom.is_active !== false,
          user_id: user!.user_id,
        };
        
        const newItem = await nomenclatureService.create(newNom);
        const createdId = response.data.nomenclature_id;
        
        // Import children
        if (nom.children && Array.isArray(nom.children)) {
          for (const child of nom.children) {
            await importNomenclature(child, createdId);
          }
        }
      };
      
      // Import all root nomenclatures
      for (const nom of data.nomenclatures) {
        await importNomenclature(nom);
      }
      
      await fetchNomenclatures();
      
      toast({
        title: 'Импорт завершен',
        description: 'Категории успешно импортированы',
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка импорта',
        description: error.message || 'Не удалось импортировать файл',
        variant: 'destructive',
      });
    }
  };

  // Custom import handler
  const handleImport = async (file: File) => {
    if (file.name.endsWith('.json')) {
      await handleImportJSON(file);
    } else {
      await handleImportCSV(file);
    }
  };

  return (
    <div className="space-y-4">
      {/* Info and controls */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">Управление категориями</p>
              <p>
                Создайте иерархическую структуру категорий доходов и расходов. 
                Используйте цвета и иконки для визуального разделения.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showTreeView}
                onChange={(e) => setShowTreeView(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Древовидный вид</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAutoRules}
                onChange={(e) => setShowAutoRules(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Авто-правила</span>
            </label>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportJSON}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
              >
                <FileJson className="h-4 w-4" />
                JSON
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Auto-categorization rules info */}
      {showAutoRules && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Автоматическая категоризация</p>
              <p>
                Настройте правила для автоматического определения категории транзакций
                на основе описания. Функция будет доступна в следующей версии.
              </p>
            </div>
          </div>
        </div>
      )}
      
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
        onExport={handleExportCSV}
        onImport={handleImport}
        emptyMessage="Нет добавленных категорий. Нажмите 'Добавить категорию' для создания новой."
        addButtonText="Добавить категорию"
      />
    </div>
  );
};
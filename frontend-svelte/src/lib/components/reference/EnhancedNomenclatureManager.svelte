<script lang="ts">
  import { onMount } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { createEventDispatcher } from 'svelte';
  import { 
    createSvelteTable, 
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    type ColumnDef
  } from '@tanstack/svelte-table';
  import { 
    Tags,
    ChevronRight,
    ChevronDown,
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
    Plus,
    Edit,
    Trash2,
    ChevronsUpDown,
    ChevronUp
  } from 'lucide-svelte';
  
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Table from '$lib/components/ui/Table.svelte';
  import TableBody from '$lib/components/ui/TableBody.svelte';
  import TableCell from '$lib/components/ui/TableCell.svelte';
  import TableHead from '$lib/components/ui/TableHead.svelte';
  import TableHeader from '$lib/components/ui/TableHeader.svelte';
  import TableRow from '$lib/components/ui/TableRow.svelte';
  
  import { authStore } from '$lib/stores/auth.store';
  import { toastStore } from '$lib/stores/toast.store';
  import { nomenclatureService } from '$lib/services';
  import type { Nomenclature, AutoCategorizationRule } from '$lib/types';

  const dispatch = createEventDispatcher();

  // Component state
  let nomenclatures: Nomenclature[] = [];
  let loading = true;
  let showTreeView = true;
  let expandedIds = new Set<number>();
  let showAutoRules = false;
  let editingItem: Nomenclature | null = null;
  let addDialogOpen = false;
  let fileInput: HTMLInputElement;

  // Table state
  const sorting = writable([]);
  const columnFilters = writable([]);
  const globalFilter = writable('');
  const rowSelection = writable({});

  // Form state for new/edit item
  let formData: Partial<Nomenclature> = {};
  let formErrors: Record<string, string> = {};

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

  // Build hierarchy tree
  function buildHierarchy(items: Nomenclature[]): Nomenclature[] {
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
  }

  // Flatten hierarchy for table display
  function flattenHierarchy(items: Nomenclature[], level = 0): Nomenclature[] {
    const result: Nomenclature[] = [];
    
    items.forEach(item => {
      const isExpanded = expandedIds.has(item.nomenclature_id);
      result.push({ ...item, level, is_expanded: isExpanded });
      
      if (item.children && item.children.length > 0 && (isExpanded || !showTreeView)) {
        result.push(...flattenHierarchy(item.children, level + 1));
      }
    });
    
    return result;
  }

  // Toggle node expansion
  function toggleExpanded(id: number) {
    if (expandedIds.has(id)) {
      expandedIds.delete(id);
    } else {
      expandedIds.add(id);
    }
    expandedIds = new Set(expandedIds);
    refreshTableData();
  }

  // Get icon component
  function getIconComponent(iconName?: string) {
    if (!iconName) return Tags;
    const iconConfig = availableIcons.find(i => i.name === iconName);
    return iconConfig?.icon || Tags;
  }

  // Refresh table data with hierarchy
  function refreshTableData() {
    const hierarchyData = buildHierarchy(nomenclatures);
    displayData = flattenHierarchy(hierarchyData);
  }

  // Define table columns
  const columns: ColumnDef<Nomenclature>[] = [
    {
      accessorKey: 'nomenclature_name',
      header: 'Название категории',
      cell: ({ row }) => {
        const item = row.original;
        const Icon = getIconComponent(item.icon);
        const hasChildren = item.children && item.children.length > 0;
        
        return {
          component: 'div',
          props: {
            class: 'flex items-center gap-2',
            style: `padding-left: ${showTreeView ? (item.level || 0) * 24 : 0}px`
          },
          children: [
            // Expand/collapse button
            showTreeView && hasChildren ? {
              component: 'button',
              props: {
                class: 'p-0.5 hover:bg-gray-100 rounded',
                onClick: (e: Event) => {
                  e.stopPropagation();
                  toggleExpanded(item.nomenclature_id);
                }
              },
              children: item.is_expanded ? ChevronDown : ChevronRight
            } : { component: 'div', props: { class: 'w-5' } },
            
            // Icon with color background
            {
              component: 'div',
              props: {
                class: 'p-1.5 rounded',
                style: `background-color: ${item.color ? `${item.color}20` : '#e5e7eb'}`
              },
              children: {
                component: Icon,
                props: {
                  class: 'h-4 w-4',
                  style: `color: ${item.color || '#6b7280'}`
                }
              }
            },
            
            // Name
            { component: 'span', props: { class: 'font-medium' }, children: item.nomenclature_name },
            
            // Children count badge
            hasChildren ? {
              component: Badge,
              props: { variant: 'secondary', class: 'ml-2' },
              children: `${item.children!.length} подкат.`
            } : null,
            
            // Auto rules badge
            item.auto_rules && item.auto_rules.length > 0 ? {
              component: Badge,
              props: { variant: 'outline', class: 'ml-2' },
              children: [
                { component: Zap, props: { class: 'h-3 w-3 mr-1' } },
                'Авто'
              ]
            } : null
          ].filter(Boolean)
        };
      },
    },
    {
      accessorKey: 'nomenclature_type',
      header: 'Тип',
      cell: ({ getValue }) => {
        const value = getValue() as string;
        switch (value) {
          case 'INCOME':
            return { component: Badge, props: { variant: 'default', class: 'bg-green-600' }, children: 'Доход' };
          case 'EXPENSE':
            return { component: Badge, props: { variant: 'destructive' }, children: 'Расход' };
          default:
            return '-';
        }
      },
    },
    {
      accessorKey: 'parent_id',
      header: 'Родительская категория',
      cell: ({ getValue, row }) => {
        const value = getValue() as number;
        if (!value) return { component: 'span', props: { class: 'text-gray-500' }, children: '—' };
        const parent = nomenclatures.find(n => n.nomenclature_id === value);
        return parent ? parent.nomenclature_name : '-';
      },
    },
    {
      accessorKey: 'color',
      header: 'Цвет',
      cell: ({ getValue }) => {
        const value = getValue() as string;
        return {
          component: 'div',
          props: { class: 'flex items-center gap-2' },
          children: [
            {
              component: 'div',
              props: {
                class: 'w-6 h-6 rounded border',
                style: `background-color: ${value || '#e5e7eb'}`
              }
            },
            {
              component: 'span',
              props: { class: 'text-sm text-gray-600' },
              children: value || 'По умолчанию'
            }
          ]
        };
      },
    },
    {
      accessorKey: 'icon',
      header: 'Иконка',
      cell: ({ getValue }) => {
        const value = getValue() as string;
        const Icon = getIconComponent(value);
        const iconConfig = availableIcons.find(i => i.name === value);
        return {
          component: 'div',
          props: { class: 'flex items-center gap-2' },
          children: [
            { component: Icon, props: { class: 'h-4 w-4 text-gray-600' } },
            {
              component: 'span',
              props: { class: 'text-sm text-gray-600' },
              children: iconConfig?.label || 'По умолчанию'
            }
          ]
        };
      },
    },
    {
      accessorKey: 'transaction_count',
      header: 'Использование',
      cell: ({ row }) => {
        const item = row.original;
        if (!item.transaction_count) return '-';
        return {
          component: 'div',
          props: { class: 'text-sm' },
          children: [
            { component: 'div', children: `${item.transaction_count} транз.` },
            item.total_amount ? {
              component: 'div',
              props: { class: 'text-xs text-gray-500' },
              children: `${item.total_amount.toLocaleString('ru-RU')} ₽`
            } : null
          ].filter(Boolean)
        };
      },
      enableSorting: true,
    },
    {
      accessorKey: 'nomenclature_order',
      header: 'Порядок',
    },
    {
      accessorKey: 'is_active',
      header: 'Статус',
      cell: ({ getValue }) => {
        const value = getValue() as boolean;
        return value ? 
          { component: Badge, props: { variant: 'default' }, children: 'Активна' } :
          { component: Badge, props: { variant: 'secondary' }, children: 'Неактивна' };
      },
    },
  ];

  // Display data (flattened hierarchy)
  let displayData: Nomenclature[] = [];
  
  // Table options
  $: options = {
    data: displayData,
    columns,
    state: {
      sorting: $sorting,
      columnFilters: $columnFilters,
      globalFilter: $globalFilter,
      rowSelection: $rowSelection,
    },
    onSortingChange: (updater: any) => sorting.update(updater),
    onColumnFiltersChange: (updater: any) => columnFilters.update(updater),
    onGlobalFilterChange: (updater: any) => globalFilter.update(updater),
    onRowSelectionChange: (updater: any) => rowSelection.update(updater),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  };

  const table = createSvelteTable(options);

  // Reactive statements
  $: selectedRowsCount = Object.keys($rowSelection).length;
  $: if (nomenclatures.length > 0) refreshTableData();

  // Fetch nomenclatures
  async function fetchNomenclatures() {
    if (!$authStore.user?.user_id) return;
    
    try {
      loading = true;
      const responseData = await nomenclatureService.getAll();
      const data = responseData.map((n: any) => ({
        ...n,
        id: n.nomenclature_id, // Map nomenclature_id to id for table
      }));
      
      nomenclatures = data;
      
      // Expand all by default
      const allIds = new Set(data.map((n: any) => n.nomenclature_id));
      expandedIds = allIds;
      
      refreshTableData();
    } catch (error) {
      toastStore.error('Ошибка', 'Не удалось загрузить номенклатуры');
    } finally {
      loading = false;
    }
  }

  // Add nomenclature
  async function handleAdd() {
    if (!$authStore.user?.user_id) return;
    
    if (!validateForm()) return;
    
    const newNomenclature = {
      ...formData,
      user_id: $authStore.user.user_id,
      is_active: formData.is_active !== false,
      parent_id: formData.parent_id || null,
      color: formData.color || undefined,
      icon: formData.icon || undefined,
    };

    try {
      await nomenclatureService.create(newNomenclature);
      await fetchNomenclatures();
      
      toastStore.success('Успешно', 'Категория создана');
      resetForm();
      addDialogOpen = false;
    } catch (error: any) {
      toastStore.error('Ошибка', error.response?.data?.detail || 'Не удалось добавить категорию');
    }
  }

  // Update nomenclature
  async function handleUpdate() {
    if (!editingItem || !$authStore.user?.user_id) return;
    
    // Prevent circular references
    if (formData.parent_id === editingItem.nomenclature_id) {
      toastStore.error('Ошибка', 'Категория не может быть родительской для самой себя');
      return;
    }

    if (!validateForm()) return;

    try {
      await nomenclatureService.update(editingItem.nomenclature_id, formData);
      await fetchNomenclatures();
      
      toastStore.success('Успешно', 'Категория обновлена');
      resetForm();
    } catch (error: any) {
      toastStore.error('Ошибка', error.response?.data?.detail || 'Не удалось обновить категорию');
    }
  }

  // Delete nomenclature
  async function handleDelete(item: Nomenclature) {
    // Check if has children
    if (item.children && item.children.length > 0) {
      toastStore.error('Ошибка', 'Нельзя удалить категорию с подкатегориями. Сначала удалите или переместите подкатегории.');
      return;
    }
    
    // Check usage
    if (item.transaction_count && item.transaction_count > 0) {
      const confirmed = confirm(
        `Категория "${item.nomenclature_name}" используется в ${item.transaction_count} транзакциях. Вы уверены, что хотите удалить её?`
      );
      
      if (!confirmed) return;
    }

    try {
      await nomenclatureService.delete(item.nomenclature_id);
      await fetchNomenclatures();
      
      toastStore.success('Успешно', 'Категория удалена');
    } catch (error: any) {
      toastStore.error('Ошибка', error.response?.data?.detail || 'Не удалось удалить категорию');
    }
  }

  // Bulk delete nomenclatures
  async function handleBulkDelete() {
    const selectedRows = $table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    const ids = selectedRows.map(row => row.original.nomenclature_id);
    
    // Check for parents in selection
    const hasParents = nomenclatures.some(n => 
      ids.includes(n.nomenclature_id) && n.children && n.children.length > 0
    );
    
    if (hasParents) {
      toastStore.error('Ошибка', 'В выборке есть категории с подкатегориями. Удалите сначала подкатегории.');
      return;
    }

    if (!confirm(`Вы уверены, что хотите удалить ${ids.length} категорий?`)) return;

    try {
      await Promise.all(ids.map(id => nomenclatureService.delete(id)));
      await fetchNomenclatures();
      
      toastStore.success('Успешно', `Удалено категорий: ${ids.length}`);
      rowSelection.set({});
    } catch (error: any) {
      toastStore.error('Ошибка', error.response?.data?.detail || 'Не удалось удалить категории');
    }
  }

  // Export to CSV
  function handleExportCSV() {
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
  }

  // Export to JSON
  function handleExportJSON() {
    const hierarchy = buildHierarchy(nomenclatures);
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      user_id: $authStore.user?.user_id,
      nomenclatures: hierarchy,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `nomenclatures_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  }

  // Import from file
  async function handleImport(file: File) {
    if (file.name.endsWith('.json')) {
      await handleImportJSON(file);
    } else {
      await handleImportCSV(file);
    }
  }

  // Import from CSV
  async function handleImportCSV(file: File) {
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
        user_id: $authStore.user!.user_id,
      } as Omit<Nomenclature, 'id'>);
    }

    // Add nomenclatures one by one
    for (const n of newNomenclatures) {
      await nomenclatureService.create(n);
    }
    
    await fetchNomenclatures();
    toastStore.success('Импорт завершен', `Добавлено категорий: ${newNomenclatures.length}`);
  }

  // Import from JSON
  async function handleImportJSON(file: File) {
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
          user_id: $authStore.user!.user_id,
        };
        
        const response = await nomenclatureService.create(newNom);
        const createdId = response.nomenclature_id;
        
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
      toastStore.success('Импорт завершен', 'Категории успешно импортированы');
    } catch (error: any) {
      toastStore.error('Ошибка импорта', error.message || 'Не удалось импортировать файл');
    }
  }

  // Form validation
  function validateForm(): boolean {
    formErrors = {};
    
    if (!formData.nomenclature_name || formData.nomenclature_name.trim().length < 3) {
      formErrors.nomenclature_name = 'Название должно содержать минимум 3 символа';
    }
    if (formData.nomenclature_name && formData.nomenclature_name.trim().length > 100) {
      formErrors.nomenclature_name = 'Название не должно превышать 100 символов';
    }
    if (!formData.nomenclature_type) {
      formErrors.nomenclature_type = 'Выберите тип категории';
    }
    if (!formData.nomenclature_order || Number(formData.nomenclature_order) < 1) {
      formErrors.nomenclature_order = 'Порядок должен быть больше 0';
    }
    
    return Object.keys(formErrors).length === 0;
  }

  // Reset form
  function resetForm() {
    formData = {
      nomenclature_type: 'EXPENSE',
      nomenclature_order: 1,
      is_active: true
    };
    formErrors = {};
    editingItem = null;
  }

  // Start editing
  function startEdit(item: Nomenclature) {
    editingItem = item;
    formData = { ...item };
    addDialogOpen = true;
  }

  // Handle file input
  function handleFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      handleImport(file);
      if (fileInput) {
        fileInput.value = '';
      }
    }
  }

  // Initialize
  onMount(() => {
    fetchNomenclatures();
    resetForm();
  });
</script>

<div class="space-y-4">
  <!-- Info and controls -->
  <Card class="p-4">
    <div class="flex items-start justify-between">
      <div class="flex items-start gap-3">
        <AlertCircle class="h-5 w-5 text-blue-600 mt-0.5" />
        <div class="text-sm text-gray-700">
          <p class="font-medium mb-1">Управление категориями</p>
          <p>
            Создайте иерархическую структуру категорий доходов и расходов. 
            Используйте цвета и иконки для визуального разделения.
          </p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={showTreeView}
            class="rounded"
          />
          <span class="text-sm">Древовидный вид</span>
        </label>
        
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={showAutoRules}
            class="rounded"
          />
          <span class="text-sm">Авто-правила</span>
        </label>
        
        <div class="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            on:click={handleExportJSON}
          >
            <FileJson class="h-4 w-4 mr-2" />
            JSON
          </Button>
        </div>
      </div>
    </div>
  </Card>
  
  <!-- Auto-categorization rules info -->
  {#if showAutoRules}
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div class="flex items-start gap-3">
        <Zap class="h-5 w-5 text-yellow-600 mt-0.5" />
        <div class="text-sm text-yellow-800">
          <p class="font-medium mb-1">Автоматическая категоризация</p>
          <p>
            Настройте правила для автоматического определения категории транзакций
            на основе описания. Функция будет доступна в следующей версии.
          </p>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Table -->
  <Card class="p-6">
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">Категории доходов и расходов</h2>
        <div class="flex gap-2">
          {#if selectedRowsCount > 0}
            <Button variant="destructive" size="sm" on:click={handleBulkDelete}>
              <Trash2 class="h-4 w-4 mr-2" />
              Удалить ({selectedRowsCount})
            </Button>
          {/if}
          
          <Button variant="outline" size="sm" on:click={handleExportCSV}>
            <Download class="h-4 w-4 mr-2" />
            Экспорт
          </Button>
          
          <Button variant="outline" size="sm" on:click={() => fileInput.click()}>
            <Upload class="h-4 w-4 mr-2" />
            Импорт
          </Button>
          <input
            bind:this={fileInput}
            type="file"
            accept=".csv,.json"
            class="hidden"
            on:change={handleFileSelected}
          />
          
          <Button on:click={() => { resetForm(); addDialogOpen = true; }}>
            <Plus class="h-4 w-4 mr-2" />
            Добавить категорию
          </Button>
        </div>
      </div>

      <!-- Search -->
      <div class="max-w-sm">
        <Input
          placeholder="Поиск категорий..."
          bind:value={$globalFilter}
        />
      </div>

      <!-- Table -->
      {#if loading}
        <div class="flex justify-center items-center py-8">
          <div class="text-gray-600">Загрузка данных...</div>
        </div>
      {:else}
        <div class="rounded-md border">
          <Table>
            <TableHeader>
              {#each $table.getHeaderGroups() as headerGroup (headerGroup.id)}
                <TableRow>
                  {#each headerGroup.headers as header (header.id)}
                    <TableHead>
                      {#if !header.isPlaceholder}
                        {#if header.id === 'select'}
                          <input
                            type="checkbox"
                            checked={$table.getIsAllPageRowsSelected()}
                            on:change={(e) => $table.toggleAllPageRowsSelected(e.target.checked)}
                          />
                        {:else if header.column.getCanSort()}
                          <div
                            class="cursor-pointer select-none flex items-center gap-1"
                            on:click={header.column.getToggleSortingHandler()}
                            on:keydown={(e) => e.key === 'Enter' && header.column.getToggleSortingHandler()?.(e)}
                            role="button"
                            tabindex="0"
                          >
                            <svelte:component 
                              this={flexRender(header.column.columnDef.header, header.getContext())}
                            />
                            {#if header.column.getIsSorted() === 'asc'}
                              <ChevronUp class="h-4 w-4" />
                            {:else if header.column.getIsSorted() === 'desc'}
                              <ChevronDown class="h-4 w-4" />
                            {:else}
                              <ChevronsUpDown class="h-4 w-4 opacity-50" />
                            {/if}
                          </div>
                        {:else}
                          <svelte:component 
                            this={flexRender(header.column.columnDef.header, header.getContext())}
                          />
                        {/if}
                      {/if}
                    </TableHead>
                  {/each}
                </TableRow>
              {/each}
            </TableHeader>
            <TableBody>
              {#if $table.getRowModel().rows.length > 0}
                {#each $table.getRowModel().rows as row (row.id)}
                  <TableRow class:selected={row.getIsSelected()}>
                    {#each row.getVisibleCells() as cell (cell.id)}
                      <TableCell>
                        {#if cell.column.id === 'select'}
                          <input
                            type="checkbox"
                            checked={row.getIsSelected()}
                            disabled={!row.getCanSelect()}
                            on:change={(e) => row.toggleSelected(e.target.checked)}
                          />
                        {:else if cell.column.id === 'actions'}
                          <div class="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              on:click={() => startEdit(row.original)}
                            >
                              <Edit class="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              on:click={() => handleDelete(row.original)}
                            >
                              <Trash2 class="h-4 w-4" />
                            </Button>
                          </div>
                        {:else}
                          {#if cell.column.id === 'nomenclature_name'}
                            <div 
                              class="flex items-center gap-2"
                              style="padding-left: {showTreeView ? (row.original.level || 0) * 24 : 0}px"
                            >
                              {#if showTreeView && row.original.children && row.original.children.length > 0}
                                <button
                                  on:click={(e) => {
                                    e.stopPropagation();
                                    toggleExpanded(row.original.nomenclature_id);
                                  }}
                                  class="p-0.5 hover:bg-gray-100 rounded"
                                >
                                  {#if row.original.is_expanded}
                                    <ChevronDown class="h-4 w-4 text-gray-500" />
                                  {:else}
                                    <ChevronRight class="h-4 w-4 text-gray-500" />
                                  {/if}
                                </button>
                              {:else if showTreeView}
                                <div class="w-5"></div>
                              {/if}
                              
                              <div
                                class="p-1.5 rounded"
                                style="background-color: {row.original.color ? `${row.original.color}20` : '#e5e7eb'}"
                              >
                                <svelte:component 
                                  this={getIconComponent(row.original.icon)}
                                  class="h-4 w-4"
                                  style="color: {row.original.color || '#6b7280'}"
                                />
                              </div>
                              
                              <span class="font-medium">{row.original.nomenclature_name}</span>
                              
                              {#if row.original.children && row.original.children.length > 0}
                                <Badge variant="secondary" class="ml-2">
                                  {row.original.children.length} подкат.
                                </Badge>
                              {/if}
                              
                              {#if row.original.auto_rules && row.original.auto_rules.length > 0}
                                <Badge variant="outline" class="ml-2">
                                  <Zap class="h-3 w-3 mr-1" />
                                  Авто
                                </Badge>
                              {/if}
                            </div>
                          {:else}
                            <svelte:component 
                              this={flexRender(cell.column.columnDef.cell, cell.getContext())}
                            />
                          {/if}
                        {/if}
                      </TableCell>
                    {/each}
                  </TableRow>
                {/each}
              {:else}
                <TableRow>
                  <TableCell colSpan={columns.length + 2} class="h-24 text-center">
                    Нет добавленных категорий. Нажмите 'Добавить категорию' для создания новой.
                  </TableCell>
                </TableRow>
              {/if}
            </TableBody>
          </Table>
        </div>
      {/if}

      <!-- Pagination -->
      {#if !loading && $table.getPageCount() > 1}
        <div class="flex items-center justify-between">
          <div class="text-sm text-gray-600">
            Показано {$table.getState().pagination.pageIndex * 10 + 1} -{' '}
            {Math.min(
              ($table.getState().pagination.pageIndex + 1) * 10,
              displayData.length
            )}{' '}
            из {displayData.length}
          </div>
          <div class="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              on:click={() => $table.previousPage()}
              disabled={!$table.getCanPreviousPage()}
            >
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              on:click={() => $table.nextPage()}
              disabled={!$table.getCanNextPage()}
            >
              Вперед
            </Button>
          </div>
        </div>
      {/if}
    </div>
  </Card>
</div>

<!-- Add/Edit Dialog -->
<Dialog bind:open={addDialogOpen}>
  <div class="space-y-4">
    <div class="text-lg font-semibold">
      {editingItem ? 'Редактировать категорию' : 'Добавить категорию'}
    </div>
    
    <!-- Name -->
    <div>
      <label class="text-sm font-medium">
        Название категории <span class="text-red-500">*</span>
      </label>
      <Input
        bind:value={formData.nomenclature_name}
        placeholder="Введите название категории"
        class="mt-1"
        error={formErrors.nomenclature_name}
      />
      {#if formErrors.nomenclature_name}
        <p class="text-red-500 text-xs mt-1">{formErrors.nomenclature_name}</p>
      {/if}
    </div>

    <!-- Type -->
    <div>
      <label class="text-sm font-medium">
        Тип <span class="text-red-500">*</span>
      </label>
      <Select bind:value={formData.nomenclature_type} class="mt-1">
        <option value="">Выберите тип</option>
        <option value="INCOME">Доход</option>
        <option value="EXPENSE">Расход</option>
      </Select>
      {#if formErrors.nomenclature_type}
        <p class="text-red-500 text-xs mt-1">{formErrors.nomenclature_type}</p>
      {/if}
    </div>

    <!-- Parent Category -->
    <div>
      <label class="text-sm font-medium">Родительская категория</label>
      <Select bind:value={formData.parent_id} class="mt-1">
        <option value="">Нет родительской категории</option>
        {#each nomenclatures.filter(n => n.nomenclature_id !== editingItem?.nomenclature_id && n.nomenclature_type === formData.nomenclature_type) as parent}
          <option value={parent.nomenclature_id}>{parent.nomenclature_name}</option>
        {/each}
      </Select>
    </div>

    <!-- Color -->
    <div>
      <label class="text-sm font-medium">Цвет</label>
      <div class="flex items-center gap-2 mt-1">
        <Select bind:value={formData.color} class="flex-1">
          <option value="">По умолчанию</option>
          {#each categoryColors as color}
            <option value={color.value}>{color.label}</option>
          {/each}
        </Select>
        <div 
          class="w-8 h-8 rounded border"
          style="background-color: {formData.color || '#e5e7eb'}"
        ></div>
      </div>
    </div>

    <!-- Icon -->
    <div>
      <label class="text-sm font-medium">Иконка</label>
      <Select bind:value={formData.icon} class="mt-1">
        <option value="">По умолчанию</option>
        {#each availableIcons as icon}
          <option value={icon.name}>{icon.label}</option>
        {/each}
      </Select>
    </div>

    <!-- Order -->
    <div>
      <label class="text-sm font-medium">
        Порядок <span class="text-red-500">*</span>
      </label>
      <Input
        type="number"
        bind:value={formData.nomenclature_order}
        min="1"
        class="mt-1"
        error={formErrors.nomenclature_order}
      />
      {#if formErrors.nomenclature_order}
        <p class="text-red-500 text-xs mt-1">{formErrors.nomenclature_order}</p>
      {/if}
    </div>

    <!-- Active Status -->
    <div class="flex items-center gap-2">
      <input
        type="checkbox"
        bind:checked={formData.is_active}
        id="is_active"
        class="rounded"
      />
      <label for="is_active" class="text-sm cursor-pointer">Активная категория</label>
    </div>

    <!-- Dialog Actions -->
    <div class="flex justify-end gap-2 pt-4">
      <Button variant="outline" on:click={() => { addDialogOpen = false; resetForm(); }}>
        Отмена
      </Button>
      <Button on:click={editingItem ? handleUpdate : handleAdd}>
        {editingItem ? 'Обновить' : 'Добавить'}
      </Button>
    </div>
  </div>
</Dialog>

<style>
  .selected {
    @apply bg-blue-50;
  }
</style>
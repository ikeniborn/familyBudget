import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { toast } from '../ui/use-toast';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Search,
  Filter,
  Download,
  Upload,
  CheckSquare,
  Square,
  MoreVertical,
} from 'lucide-react';
import { clsx } from 'clsx';

// Generic types for CRUD operations
export interface CRUDField<T = any> {
  key: keyof T;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'custom';
  required?: boolean;
  options?: { value: string; label: string }[];
  renderCell?: (value: any, item: T) => React.ReactNode;
  renderEdit?: (value: any, onChange: (value: any) => void, item: T) => React.ReactNode;
  validation?: (value: any) => string | null;
  width?: string;
  sortable?: boolean;
  filterable?: boolean;
}

export interface CRUDTableProps<T extends { id: number | string }> {
  title: string;
  data: T[];
  fields: CRUDField<T>[];
  onAdd: (item: Omit<T, 'id'>) => Promise<void>;
  onUpdate: (id: T['id'], item: Partial<T>) => Promise<void>;
  onDelete: (id: T['id']) => Promise<void>;
  onBulkDelete?: (ids: T['id'][]) => Promise<void>;
  loading?: boolean;
  searchable?: boolean;
  exportable?: boolean;
  importable?: boolean;
  onExport?: () => void;
  onImport?: (file: File) => Promise<void>;
  emptyMessage?: string;
  addButtonText?: string;
  customActions?: (item: T) => React.ReactNode;
}

export function CRUDTable<T extends { id: number | string }>({
  title,
  data,
  fields,
  onAdd,
  onUpdate,
  onDelete,
  onBulkDelete,
  loading = false,
  searchable = true,
  exportable = false,
  importable = false,
  onExport,
  onImport,
  emptyMessage = 'Нет данных',
  addButtonText = 'Добавить',
  customActions,
}: CRUDTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<T['id'] | null>(null);
  const [editingData, setEditingData] = useState<Partial<T>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newItemData, setNewItemData] = useState<Partial<T>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<T['id'] | null>(null);
  const [selectedIds, setSelectedIds] = useState<T['id'][]>([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [sortField, setSortField] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filter data based on search query
  const filteredData = data.filter((item) => {
    if (!searchQuery) return true;
    
    return fields.some((field) => {
      if (!field.filterable !== false) {
        const value = item[field.key];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(searchQuery.toLowerCase());
      }
      return false;
    });
  });

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortField) return 0;
    
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Handle sorting
  const handleSort = (field: keyof T) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Start editing
  const startEditing = (item: T) => {
    setEditingId(item.id);
    setEditingData({ ...item });
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingId(null);
    setEditingData({});
  };

  // Save editing
  const saveEditing = async () => {
    if (!editingId) return;

    // Validate fields
    for (const field of fields) {
      if (field.required && !editingData[field.key]) {
        toast({
          title: 'Ошибка валидации',
          description: `Поле "${field.label}" обязательно для заполнения`,
          variant: 'destructive',
        });
        return;
      }

      if (field.validation) {
        const error = field.validation(editingData[field.key]);
        if (error) {
          toast({
            title: 'Ошибка валидации',
            description: error,
            variant: 'destructive',
          });
          return;
        }
      }
    }

    try {
      await onUpdate(editingId, editingData);
      setEditingId(null);
      setEditingData({});
      toast({
        title: 'Успешно',
        description: 'Запись обновлена',
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить запись',
        variant: 'destructive',
      });
    }
  };

  // Handle add new item
  const handleAdd = async () => {
    // Validate fields
    for (const field of fields) {
      if (field.required && !newItemData[field.key]) {
        toast({
          title: 'Ошибка валидации',
          description: `Поле "${field.label}" обязательно для заполнения`,
          variant: 'destructive',
        });
        return;
      }

      if (field.validation) {
        const error = field.validation(newItemData[field.key]);
        if (error) {
          toast({
            title: 'Ошибка валидации',
            description: error,
            variant: 'destructive',
          });
          return;
        }
      }
    }

    try {
      await onAdd(newItemData as Omit<T, 'id'>);
      setIsAddDialogOpen(false);
      setNewItemData({});
      toast({
        title: 'Успешно',
        description: 'Запись добавлена',
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить запись',
        variant: 'destructive',
      });
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      await onDelete(deleteConfirmId);
      setDeleteConfirmId(null);
      toast({
        title: 'Успешно',
        description: 'Запись удалена',
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить запись',
        variant: 'destructive',
      });
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (!onBulkDelete || selectedIds.length === 0) return;

    try {
      await onBulkDelete(selectedIds);
      setSelectedIds([]);
      setBulkDeleteConfirm(false);
      toast({
        title: 'Успешно',
        description: `Удалено записей: ${selectedIds.length}`,
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить записи',
        variant: 'destructive',
      });
    }
  };

  // Toggle selection
  const toggleSelection = (id: T['id']) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  // Toggle all selection
  const toggleAllSelection = () => {
    if (selectedIds.length === sortedData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedData.map(item => item.id));
    }
  };

  // Handle file import
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onImport) {
      try {
        await onImport(file);
        toast({
          title: 'Успешно',
          description: 'Данные импортированы',
        });
      } catch (error) {
        toast({
          title: 'Ошибка',
          description: 'Не удалось импортировать данные',
          variant: 'destructive',
        });
      }
    }
  };

  // Render cell value
  const renderCellValue = (field: CRUDField<T>, item: T) => {
    const value = item[field.key];

    if (editingId === item.id) {
      if (field.renderEdit) {
        return field.renderEdit(
          editingData[field.key],
          (newValue) => setEditingData({ ...editingData, [field.key]: newValue }),
          item
        );
      }

      switch (field.type) {
        case 'text':
        case 'number':
        case 'date':
          return (
            <Input
              type={field.type}
              value={editingData[field.key] || ''}
              onChange={(e) => setEditingData({
                ...editingData,
                [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value
              })}
              className="h-8"
            />
          );
        case 'boolean':
          return (
            <Checkbox
              checked={editingData[field.key] || false}
              onCheckedChange={(checked) => setEditingData({
                ...editingData,
                [field.key]: checked
              })}
            />
          );
        case 'select':
          return (
            <select
              value={editingData[field.key] || ''}
              onChange={(e) => setEditingData({
                ...editingData,
                [field.key]: e.target.value
              })}
              className="h-8 w-full rounded border px-2"
            >
              <option value="">Выберите...</option>
              {field.options?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          );
        default:
          return value;
      }
    }

    if (field.renderCell) {
      return field.renderCell(value, item);
    }

    switch (field.type) {
      case 'boolean':
        return value ? (
          <Badge variant="default">Да</Badge>
        ) : (
          <Badge variant="secondary">Нет</Badge>
        );
      case 'date':
        return value ? new Date(value as any).toLocaleDateString('ru-RU') : '-';
      default:
        return value || '-';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <div className="flex items-center gap-2">
            {searchable && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Поиск..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-64 pl-8"
                />
              </div>
            )}
            {selectedIds.length > 0 && onBulkDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Удалить ({selectedIds.length})
              </Button>
            )}
            {importable && (
              <label>
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-1" />
                    Импорт
                  </span>
                </Button>
                <input
                  type="file"
                  hidden
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileImport}
                />
              </label>
            )}
            {exportable && (
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-4 w-4 mr-1" />
                Экспорт
              </Button>
            )}
            <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {addButtonText}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : sortedData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {emptyMessage}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {onBulkDelete && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === sortedData.length && sortedData.length > 0}
                        onCheckedChange={toggleAllSelection}
                      />
                    </TableHead>
                  )}
                  {fields.map((field) => (
                    <TableHead
                      key={String(field.key)}
                      className={clsx(
                        field.width,
                        field.sortable !== false && 'cursor-pointer hover:bg-gray-50'
                      )}
                      onClick={() => field.sortable !== false && handleSort(field.key)}
                    >
                      <div className="flex items-center gap-1">
                        {field.label}
                        {field.sortable !== false && sortField === field.key && (
                          <span className="text-xs">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="w-24">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((item) => (
                  <TableRow key={String(item.id)}>
                    {onBulkDelete && (
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(item.id)}
                          onCheckedChange={() => toggleSelection(item.id)}
                        />
                      </TableCell>
                    )}
                    {fields.map((field) => (
                      <TableCell key={String(field.key)}>
                        {renderCellValue(field, item)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {editingId === item.id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={saveEditing}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={cancelEditing}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => startEditing(item)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600"
                              onClick={() => setDeleteConfirmId(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            {customActions && customActions(item)}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить запись</DialogTitle>
            <DialogDescription>
              Заполните поля для создания новой записи
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {fields.map((field) => {
              if (field.type === 'custom' && field.renderEdit) {
                return (
                  <div key={String(field.key)}>
                    <label className="text-sm font-medium">{field.label}</label>
                    {field.renderEdit(
                      newItemData[field.key],
                      (value) => setNewItemData({ ...newItemData, [field.key]: value }),
                      {} as T
                    )}
                  </div>
                );
              }

              return (
                <div key={String(field.key)}>
                  <label className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={newItemData[field.key] || ''}
                      onChange={(e) => setNewItemData({
                        ...newItemData,
                        [field.key]: e.target.value
                      })}
                      className="mt-1 w-full rounded border p-2"
                    >
                      <option value="">Выберите...</option>
                      {field.options?.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'boolean' ? (
                    <div className="mt-1">
                      <Checkbox
                        checked={newItemData[field.key] || false}
                        onCheckedChange={(checked) => setNewItemData({
                          ...newItemData,
                          [field.key]: checked
                        })}
                      />
                    </div>
                  ) : (
                    <Input
                      type={field.type}
                      value={newItemData[field.key] || ''}
                      onChange={(e) => setNewItemData({
                        ...newItemData,
                        [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value
                      })}
                      className="mt-1"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleAdd}>
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтверждение удаления</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить эту запись? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтверждение удаления</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить {selectedIds.length} записей? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">
              Удалить все
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
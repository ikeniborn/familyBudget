import React, { useState, useEffect } from 'react';
import { DataTable } from '../common/DataTable';
import { Card } from '../common/Card';
import { Button } from '../common/form/Button';
import { Loading } from '../common/Loading';
import { useToast } from '../common/ToastContainer';
import { Input } from '../common/form/Input';
import { ProductImport } from './ProductImport';
import { Search, Filter, Trash2, Upload } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Product } from '../../types';
import { productService } from '../../services';

interface ProductListProps {
  onEdit?: (product: Product) => void;
  refreshKey?: number;
}

export const ProductList: React.FC<ProductListProps> = ({ 
  onEdit,
  refreshKey = 0 
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    status: ''
  });
  const toast = useToast();

  useEffect(() => {
    loadProducts();
  }, [refreshKey]);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const data = await productService.getAll();
      setProducts(data);
    } catch (error: any) {
      console.error('Ошибка загрузки продуктов:', error);
      toast.error('Ошибка', error.message || 'Не удалось загрузить список продуктов');
    } finally {
      setIsLoading(false);
    }
  };

  // Фильтрация продуктов
  const filteredProducts = products.filter(product => {
    if (filters.search && !product.product_name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.category && product.category_name !== filters.category) {
      return false;
    }
    if (filters.status) {
      if (filters.status === 'active' && !product.is_active) return false;
      if (filters.status === 'inactive' && product.is_active) return false;
    }
    return true;
  });

  // Получение уникальных категорий
  const categories = [...new Set(products.map(p => p.category_name).filter(Boolean))];

  const handleBulkDelete = async () => {
    if (!window.confirm(`Вы уверены, что хотите удалить ${selectedProducts.size} продуктов?`)) {
      return;
    }

    try {
      await Promise.all(Array.from(selectedProducts).map(id => productService.delete(id)));
      toast.success('Успешно', `Удалено ${selectedProducts.size} продуктов`);
      setSelectedProducts(new Set());
      loadProducts();
    } catch (error: any) {
      console.error('Ошибка при удалении продуктов:', error);
      toast.error('Ошибка', error.message || 'Не удалось удалить продукты');
    }
  };

  const handleDelete = async (productId: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот продукт?')) {
      return;
    }

    try {
      await productService.delete(productId);
      toast.success('Успешно', 'Продукт удален');
      loadProducts();
    } catch (error: any) {
      console.error('Ошибка при удалении продукта:', error);
      toast.error('Ошибка', error.message || 'Не удалось удалить продукт');
    }
  };

  const columns: ColumnDef<Product>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={(e) => {
            const checked = e.target.checked;
            table.toggleAllPageRowsSelected(checked);
            if (checked) {
              const newSelected = new Set(selectedProducts);
              table.getRowModel().rows.forEach(row => {
                newSelected.add(row.original.product_id!);
              });
              setSelectedProducts(newSelected);
            } else {
              setSelectedProducts(new Set());
            }
          }}
          className="rounded border-gray-300"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedProducts.has(row.original.product_id!)}
          onChange={(e) => {
            const newSelected = new Set(selectedProducts);
            if (e.target.checked) {
              newSelected.add(row.original.product_id!);
            } else {
              newSelected.delete(row.original.product_id!);
            }
            setSelectedProducts(newSelected);
          }}
          className="rounded border-gray-300"
        />
      ),
    },
    {
      header: 'Наименование',
      accessorKey: 'product_name',
    },
    {
      header: 'Категория',
      accessorKey: 'category_name',
    },
    {
      header: 'Единица',
      accessorKey: 'unit_measure',
    },
    {
      header: 'Штрихкод',
      accessorKey: 'barcode',
      cell: ({ row }) => {
        const barcode = row.original.barcode;
        return barcode || <span className="text-gray-400">—</span>;
      },
    },
    {
      header: 'Статус',
      accessorKey: 'is_active',
      cell: ({ row }) => {
        const isActive = row.original.is_active;
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            isActive 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {isActive ? 'Активный' : 'Неактивный'}
          </span>
        );
      },
    },
    {
      header: 'Описание',
      accessorKey: 'description',
      cell: ({ row }) => {
        const description = row.original.description;
        return description ? (
          <span className="text-sm text-gray-600" title={description}>
            {description.length > 30 ? `${description.substring(0, 30)}...` : description}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        );
      },
    },
    {
      header: 'Действия',
      id: 'actions',
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="flex gap-2">
            {onEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit(product)}
              >
                Изменить
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDelete(product.product_id!)}
              className="text-red-600 hover:text-red-700"
            >
              Удалить
            </Button>
          </div>
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <Card title="Список продуктов">
        <Loading />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Фильтры и действия */}
      <Card title="Управление продуктами">
        <div className="space-y-4">
          {/* Строка поиска и фильтров */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Поиск продуктов..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>
            
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Все категории</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Все статусы</option>
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
            </select>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setFilters({ search: '', category: '', status: '' })}
              >
                <Filter className="h-4 w-4 mr-1" />
                Сбросить
              </Button>
            </div>
          </div>

          {/* Действия */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              {selectedProducts.size > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Удалить выбранные ({selectedProducts.size})
                </Button>
              )}
            </div>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowImport(true)}
            >
              <Upload className="h-4 w-4 mr-1" />
              Импорт данных
            </Button>
          </div>
        </div>
      </Card>

      {/* Таблица продуктов */}
      <Card title={`Список продуктов (${filteredProducts.length})`}>
        {isLoading ? (
          <Loading />
        ) : (
          <DataTable
            data={filteredProducts}
            columns={columns}
            pageSize={15}
          />
        )}
      </Card>

      {/* Диалог импорта */}
      {showImport && (
        <ProductImport
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            setShowImport(false);
            loadProducts();
          }}
        />
      )}
    </div>
  );
};
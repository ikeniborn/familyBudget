import React, { useState, useEffect } from 'react';
import { DataTable } from '../common/DataTable';
import { Card } from '../common/Card';
import { Button } from '../common/form/Button';
import { Loading } from '../common/Loading';
import { useToast } from '../common/ToastContainer';
import type { ColumnDef } from '@tanstack/react-table';
import type { Product } from '../../types';

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
  const toast = useToast();

  useEffect(() => {
    loadProducts();
  }, [refreshKey]);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/products');
      
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      } else {
        toast.error('Ошибка', 'Не удалось загрузить список продуктов');
      }
    } catch (error) {
      console.error('Ошибка загрузки продуктов:', error);
      toast.error('Ошибка', 'Не удалось загрузить список продуктов');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (productId: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот продукт?')) {
      return;
    }

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Успешно', 'Продукт удален');
        loadProducts();
      } else {
        toast.error('Ошибка', 'Не удалось удалить продукт');
      }
    } catch (error) {
      console.error('Ошибка при удалении продукта:', error);
      toast.error('Ошибка', 'Не удалось удалить продукт');
    }
  };

  const columns: ColumnDef<Product>[] = [
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
                size="small"
                onClick={() => onEdit(product)}
              >
                Изменить
              </Button>
            )}
            <Button
              variant="secondary"
              size="small"
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
    <Card title="Список продуктов">
      <DataTable
        data={products}
        columns={columns}
        searchPlaceholder="Поиск продуктов..."
        pageSize={15}
      />
    </Card>
  );
};
import React, { useState, useEffect } from 'react';
import { DataTable } from '../common/DataTable';
import { Card } from '../common/Card';
import { Loading } from '../common/Loading';
import { useToast } from '../common/ToastContainer';
import type { ColumnDef } from '@tanstack/react-table';
import type { Registry } from '../../types';

interface ExtendedRegistry extends Registry {
  period_name?: string;
  financial_center_name?: string;
  cost_center_name?: string;
  nomenclature_name?: string;
}

export const BudgetList: React.FC = () => {
  const [budget, setBudget] = useState<ExtendedRegistry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    loadBudget();
  }, []);

  const loadBudget = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/registry?row_type_id=2&limit=50');
      
      if (response.ok) {
        const data = await response.json();
        setBudget(data);
      } else {
        toast.error('Ошибка', 'Не удалось загрузить планы бюджета');
      }
    } catch (error) {
      console.error('Ошибка загрузки бюджета:', error);
      toast.error('Ошибка', 'Не удалось загрузить планы бюджета');
    } finally {
      setIsLoading(false);
    }
  };

  const columns: ColumnDef<ExtendedRegistry>[] = [
    {
      header: 'Дата',
      accessorKey: 'operation_dttm',
      cell: ({ row }) => {
        const date = new Date(row.original.operation_dttm);
        return date.toLocaleDateString('ru-RU');
      },
    },
    {
      header: 'Период',
      accessorKey: 'period_name',
    },
    {
      header: 'Тип',
      accessorKey: 'cost_sum',
      cell: ({ row }) => {
        const amount = row.original.cost_sum;
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            amount > 0 
              ? 'bg-red-100 text-red-800' 
              : 'bg-green-100 text-green-800'
          }`}>
            {amount > 0 ? 'Расход' : 'Доход'}
          </span>
        );
      },
    },
    {
      header: 'ФЦ',
      accessorKey: 'financial_center_name',
    },
    {
      header: 'МВЗ',
      accessorKey: 'cost_center_name',
    },
    {
      header: 'Номенклатура',
      accessorKey: 'nomenclature_name',
    },
    {
      header: 'Сумма',
      accessorKey: 'cost_sum',
      cell: ({ row }) => {
        const amount = Math.abs(row.original.cost_sum);
        return new Intl.NumberFormat('ru-RU', {
          style: 'currency',
          currency: 'RUB',
        }).format(amount);
      },
    },
    {
      header: 'Комментарий',
      accessorKey: 'comment_description',
      cell: ({ row }) => {
        const comment = row.original.comment_description;
        return comment ? (
          <span className="text-sm text-gray-600" title={comment}>
            {comment.length > 50 ? `${comment.substring(0, 50)}...` : comment}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <Card title="Запланированный бюджет">
        <Loading />
      </Card>
    );
  }

  return (
    <Card title="Запланированный бюджет">
      <DataTable
        data={budget}
        columns={columns}
        searchPlaceholder="Поиск по бюджету..."
        pageSize={10}
      />
    </Card>
  );
};
import React, { useState, useEffect } from 'react';
import { DataTable } from '../common/DataTable';
import { Card } from '../common/Card';
import { Loading } from '../common/Loading';
import { useToast } from '../common/ToastContainer';
import { registryService } from '../../services';
import type { ColumnDef } from '@tanstack/react-table';
import type { Registry } from '../../types';

interface ExtendedRegistry extends Registry {
  period_name?: string;
  financial_center_name?: string;
  cost_center_name?: string;
  nomenclature_name?: string;
}

export const FactList: React.FC = () => {
  const [facts, setFacts] = useState<ExtendedRegistry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    loadFacts();
  }, []);

  const loadFacts = async () => {
    try {
      setIsLoading(true);
      const data = await registryService.getFacts({ limit: 50 });
      setFacts(data);
    } catch (error) {
      console.error('Ошибка загрузки расходов:', error);
      toast.error('Ошибка', error instanceof Error ? error.message : 'Не удалось загрузить список расходов');
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
        const amount = row.original.cost_sum;
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
      <Card title="Последние расходы">
        <Loading />
      </Card>
    );
  }

  return (
    <Card title="Последние расходы">
      <DataTable
        data={facts}
        columns={columns}
        searchPlaceholder="Поиск по расходам..."
        pageSize={10}
      />
    </Card>
  );
};
import React from 'react';
import { DataTable } from '../common/DataTable';
import { Card } from '../common/Card';
import { Button } from '../common/form/Button';
import type { ColumnDef } from '@tanstack/react-table';

interface BudgetTableData {
  nomenclature_name: string;
  plan: number;
  fact: number;
  variance: number;
  variance_percent: number;
}

interface BudgetTableProps {
  data: BudgetTableData[];
  isLoading?: boolean;
  onExport?: () => void;
}

export const BudgetTable: React.FC<BudgetTableProps> = ({ 
  data, 
  isLoading = false,
  onExport 
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    }).format(Math.abs(value));
  };

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const columns: ColumnDef<BudgetTableData>[] = [
    {
      header: 'Номенклатура',
      accessorKey: 'nomenclature_name',
    },
    {
      header: 'План',
      accessorKey: 'plan',
      cell: ({ row }) => formatCurrency(row.original.plan),
    },
    {
      header: 'Факт',
      accessorKey: 'fact',
      cell: ({ row }) => formatCurrency(row.original.fact),
    },
    {
      header: 'Отклонение',
      accessorKey: 'variance',
      cell: ({ row }) => {
        const variance = row.original.variance;
        return (
          <span className={variance > 0 ? 'text-red-600' : 'text-green-600'}>
            {variance > 0 ? '+' : ''}{formatCurrency(variance)}
          </span>
        );
      },
    },
    {
      header: 'Отклонение %',
      accessorKey: 'variance_percent',
      cell: ({ row }) => {
        const percent = row.original.variance_percent;
        return (
          <span className={percent > 0 ? 'text-red-600' : 'text-green-600'}>
            {formatPercent(percent)}
          </span>
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <Card title="Таблица план-факт">
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      title="Таблица план-факт"
      className="space-y-4"
    >
      {onExport && (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={onExport}
            className="mb-4"
          >
            Экспорт в Excel
          </Button>
        </div>
      )}
      
      <DataTable
        data={data}
        columns={columns}
        searchPlaceholder="Поиск по номенклатуре..."
        pageSize={15}
      />
    </Card>
  );
};
import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Card } from '../common/Card';

interface PlanFactData {
  nomenclature_name: string;
  plan: number;
  fact: number;
  variance: number;
  variance_percent: number;
}

interface PlanFactChartProps {
  data: PlanFactData[];
  isLoading?: boolean;
}

export const PlanFactChart: React.FC<PlanFactChartProps> = ({ 
  data, 
  isLoading = false 
}) => {
  if (isLoading) {
    return (
      <Card title="График план-факт">
        <div className="h-96 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card title="График план-факт">
        <div className="h-96 flex items-center justify-center">
          <p className="text-gray-500">Нет данных для отображения</p>
        </div>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(value));
  };

  return (
    <Card title="График план-факт">
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 60,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="nomenclature_name" 
              angle={-45}
              textAnchor="end"
              height={100}
              interval={0}
            />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip 
              formatter={(value: number) => [formatCurrency(value), '']}
              labelStyle={{ color: '#374151' }}
            />
            <Legend />
            <Bar 
              dataKey="plan" 
              fill="#3B82F6" 
              name="План"
              radius={[2, 2, 0, 0]}
            />
            <Bar 
              dataKey="fact" 
              fill="#EF4444" 
              name="Факт"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
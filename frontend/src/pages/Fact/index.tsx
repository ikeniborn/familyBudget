import React, { useState } from 'react';
import { Layout } from '../../components/common/Layout';
import { FactForm } from '../../components/fact/FactForm';
import { FactList } from '../../components/fact/FactList';
import { Card, CardContent } from '../../components/ui/card';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard,
  Calendar,
  Activity
} from 'lucide-react';

const FactPage: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleFactAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Mock статистика для демонстрации
  const stats = {
    totalExpenses: 87500,
    todayExpenses: 5200,
    monthExpenses: 45000,
    lastExpense: new Date().toISOString()
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Учет расходов и доходов</h1>
          <p className="text-slate-600">
            Фиксируйте все фактические операции для точного контроля бюджета
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Расходы сегодня</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats.todayExpenses.toLocaleString()} ₽
                  </p>
                  <p className="text-xs text-red-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +15% от вчера
                  </p>
                </div>
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">За текущий месяц</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats.monthExpenses.toLocaleString()} ₽
                  </p>
                  <p className="text-xs text-blue-600 flex items-center mt-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date().toLocaleDateString('ru-RU', { month: 'long' })}
                  </p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Всего расходов</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats.totalExpenses.toLocaleString()} ₽
                  </p>
                  <p className="text-xs text-purple-600 flex items-center mt-1">
                    <Activity className="h-3 w-3 mr-1" />
                    За все время
                  </p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Последняя операция</p>
                  <p className="text-lg font-bold text-slate-900">
                    Сегодня
                  </p>
                  <p className="text-xs text-green-600 flex items-center mt-1">
                    <Activity className="h-3 w-3 mr-1" />
                    {new Date(stats.lastExpense).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Form Section */}
          <div className="xl:col-span-1">
            <FactForm onSuccess={handleFactAdded} />
          </div>
          
          {/* List Section */}
          <div className="xl:col-span-2">
            <FactList key={refreshKey} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default FactPage;
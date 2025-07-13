import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/common/Layout';
import { Card, CardContent } from '../../components/ui/card';
import { useToast } from '../../components/common/ToastContainer';
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Calendar,
  Target,
  AlertTriangle,
  Download
} from 'lucide-react';

const ReportsPage: React.FC = () => {
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const toast = useToast();

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setIsLoadingStats(false);
    }, 1000);
  }, []);

  // Mock data
  const dashboardData = {
    total_income: 125000,
    total_expense: 87500,
    budget_utilization: 70,
  };

  const periodStats = [
    { period_name: 'Январь 2025', total_budget: 100000, total_fact: 85000, utilization_percent: 85 },
    { period_name: 'Февраль 2025', total_budget: 100000, total_fact: 95000, utilization_percent: 95 },
    { period_name: 'Март 2025', total_budget: 100000, total_fact: 110000, utilization_percent: 110 }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Отчеты и аналитика</h1>
          <p className="text-slate-600">
            Подробная аналитика и отчеты по управлению бюджетом
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Общий доход</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {isLoadingStats ? '...' : dashboardData.total_income.toLocaleString()} ₽
                  </p>
                  <p className="text-xs text-green-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    За период
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Общий расход</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {isLoadingStats ? '...' : dashboardData.total_expense.toLocaleString()} ₽
                  </p>
                  <p className="text-xs text-red-600 flex items-center mt-1">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    За период
                  </p>
                </div>
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Использование бюджета</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {isLoadingStats ? '...' : Math.round(dashboardData.budget_utilization)}%
                  </p>
                  <p className="text-xs text-blue-600 flex items-center mt-1">
                    <Target className="h-3 w-3 mr-1" />
                    От плана
                  </p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Периодов</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {isLoadingStats ? '...' : periodStats.length}
                  </p>
                  <p className="text-xs text-purple-600 flex items-center mt-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    Активных
                  </p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Period Statistics */}
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Статистика по периодам</h3>
                <p className="text-sm text-slate-600">Сводка использования бюджета по периодам</p>
              </div>
            </div>
            <div className="space-y-3">
              {periodStats.map((period, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">{period.period_name}</p>
                    <p className="text-sm text-slate-600">
                      Бюджет: {period.total_budget.toLocaleString()} ₽
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">
                      {period.total_fact.toLocaleString()} ₽
                    </p>
                    <div className="flex items-center gap-1">
                      {period.utilization_percent > 100 ? (
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                      ) : (
                        <Target className="h-3 w-3 text-green-500" />
                      )}
                      <span className={`text-sm ${
                        period.utilization_percent > 100 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {Math.round(period.utilization_percent)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ReportsPage;
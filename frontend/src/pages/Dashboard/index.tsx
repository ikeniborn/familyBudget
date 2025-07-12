import React from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/common/Layout';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  Calculator, 
  BarChart3, 
  Package,
  Plus,
  ArrowRight,
  Target,
  PiggyBank,
  AlertTriangle
} from 'lucide-react';

const DashboardPage: React.FC = () => {
  // Mock data for demonstration
  const budgetSummary = {
    totalBudget: 150000,
    totalSpent: 87500,
    remaining: 62500,
    categories: [
      { name: 'Продукты', budget: 40000, spent: 32000, color: 'bg-blue-500' },
      { name: 'Транспорт', budget: 25000, spent: 18000, color: 'bg-green-500' },
      { name: 'Развлечения', budget: 20000, spent: 22000, color: 'bg-red-500' },
      { name: 'Коммунальные', budget: 35000, spent: 15500, color: 'bg-purple-500' },
    ]
  };

  const recentTransactions = [
    { id: 1, description: 'Покупка продуктов', amount: -2500, date: '2025-01-12', category: 'Продукты' },
    { id: 2, description: 'Зарплата', amount: 85000, date: '2025-01-10', category: 'Доходы' },
    { id: 3, description: 'Бензин', amount: -3200, date: '2025-01-09', category: 'Транспорт' },
    { id: 4, description: 'Кино', amount: -1800, date: '2025-01-08', category: 'Развлечения' },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Добро пожаловать! 👋</h1>
          <p className="text-slate-600">
            Вот краткий обзор вашего финансового состояния на сегодня
          </p>
        </div>

        {/* Budget Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Общий бюджет</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {budgetSummary.totalBudget.toLocaleString()} ₽
                  </p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Потрачено</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {budgetSummary.totalSpent.toLocaleString()} ₽
                  </p>
                  <p className="text-xs text-red-600 flex items-center mt-1">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    58% от бюджета
                  </p>
                </div>
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Остаток</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {budgetSummary.remaining.toLocaleString()} ₽
                  </p>
                  <p className="text-xs text-green-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    42% доступно
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <PiggyBank className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Экономия</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {(budgetSummary.totalBudget - budgetSummary.totalSpent).toLocaleString()} ₽
                  </p>
                  <p className="text-xs text-purple-600 flex items-center mt-1">
                    <DollarSign className="h-3 w-3 mr-1" />
                    К концу месяца
                  </p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Plus className="h-5 w-5 mr-2" />
                Быстрые действия
              </CardTitle>
              <CardDescription>
                Управляйте вашим бюджетом одним кликом
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full justify-start" variant="outline">
                <Link to="/fact">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Добавить расход
                </Link>
              </Button>
              <Button asChild className="w-full justify-start" variant="outline">
                <Link to="/budget">
                  <Calculator className="h-4 w-4 mr-2" />
                  Создать бюджет
                </Link>
              </Button>
              <Button asChild className="w-full justify-start" variant="outline">
                <Link to="/reports">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Посмотреть отчеты
                </Link>
              </Button>
              <Button asChild className="w-full justify-start" variant="outline">
                <Link to="/products">
                  <Package className="h-4 w-4 mr-2" />
                  Управление товарами
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Category Budget Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Прогресс по категориям</CardTitle>
              <CardDescription>
                Использование бюджета по основным категориям
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {budgetSummary.categories.map((category, index) => {
                const percentage = (category.spent / category.budget) * 100;
                const isOverBudget = percentage > 100;
                
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{category.name}</span>
                      <div className="flex items-center space-x-2">
                        {isOverBudget && (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                        <Badge variant={isOverBudget ? "destructive" : "secondary"}>
                          {percentage.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${isOverBudget ? 'bg-red-500' : category.color}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{category.spent.toLocaleString()} ₽</span>
                      <span>{category.budget.toLocaleString()} ₽</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Последние операции</CardTitle>
              <CardDescription>
                Недавние доходы и расходы
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{transaction.description}</p>
                      <p className="text-xs text-slate-500">{transaction.category}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString()} ₽
                      </p>
                      <p className="text-xs text-slate-500">{transaction.date}</p>
                    </div>
                  </div>
                ))}
                <Button asChild variant="ghost" className="w-full">
                  <Link to="/fact">
                    Все операции
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;
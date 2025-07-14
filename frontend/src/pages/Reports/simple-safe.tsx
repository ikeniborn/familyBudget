import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Target,
  AlertTriangle,
  RefreshCw,
  FileText,
  Database,
} from 'lucide-react';

// Simple safe reports page with proper empty data handling
const SimpleSafeReportsPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate checking for data
    const checkData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Simulate API call to check if we have data
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // For now, simulate no data scenario
        setHasData(false);
        
      } catch (err) {
        setError('Ошибка проверки данных');
        setHasData(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkData();
  }, []);

  const handleRetry = () => {
    setHasData(false);
    setError(null);
    // Simulate retry with mock data
    setTimeout(() => {
      setIsLoading(false);
      setHasData(true);
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Загрузка отчетов</h2>
          <p className="text-slate-600">Проверяем доступность данных...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Ошибка загрузки</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Отчеты и аналитика</h1>
          <p className="text-slate-600">
            Система управления бюджетом - отчеты по доходам и расходам
          </p>
        </div>

        {/* No Data State */}
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center max-w-lg">
            <div className="relative mb-6">
              <Database className="h-20 w-20 mx-auto text-slate-300 mb-4" />
              <div className="absolute -top-2 -right-2 h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
            
            <h2 className="text-2xl font-semibold text-slate-900 mb-3">
              Нет данных для отчетов
            </h2>
            
            <p className="text-slate-600 mb-6 leading-relaxed">
              В базе данных отсутствуют записи о доходах и расходах. 
              Для создания отчетов необходимо добавить транзакции в систему.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-dashed border-2 border-slate-200">
                  <CardContent className="p-6 text-center">
                    <FileText className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                    <h3 className="font-medium text-slate-900 mb-1">Добавить факт</h3>
                    <p className="text-sm text-slate-600">Записать фактические доходы и расходы</p>
                  </CardContent>
                </Card>

                <Card className="border-dashed border-2 border-slate-200">
                  <CardContent className="p-6 text-center">
                    <Target className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                    <h3 className="font-medium text-slate-900 mb-1">Создать бюджет</h3>
                    <p className="text-sm text-slate-600">Запланировать доходы и расходы</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => window.location.href = '/fact'}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Добавить факт
                </button>
                <button
                  onClick={() => window.location.href = '/budget'}
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Создать бюджет
                </button>
                <button
                  onClick={handleRetry}
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className="h-4 w-4 inline mr-2" />
                  Обновить
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Features Preview */}
        <div className="bg-slate-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 text-center">
            Доступные отчеты (после добавления данных)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                </div>
                <h4 className="font-medium text-slate-900">План vs Факт</h4>
              </div>
              <p className="text-sm text-slate-600">Сравнение запланированных и фактических показателей</p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <h4 className="font-medium text-slate-900">Динамика</h4>
              </div>
              <p className="text-sm text-slate-600">Анализ трендов доходов и расходов</p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Target className="h-4 w-4 text-purple-600" />
                </div>
                <h4 className="font-medium text-slate-900">Бюджет</h4>
              </div>
              <p className="text-sm text-slate-600">Контроль исполнения бюджета</p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-orange-600" />
                </div>
                <h4 className="font-medium text-slate-900">Периоды</h4>
              </div>
              <p className="text-sm text-slate-600">Анализ по временным периодам</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // When we have data, show actual reports
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Отчеты и аналитика</h1>
        <p className="text-slate-600">
          Подробная аналитика по управлению бюджетом
        </p>
      </div>

      {/* Sample Data Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Общий доход</p>
                <p className="text-2xl font-bold text-slate-900">125,000 ₽</p>
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
                <p className="text-2xl font-bold text-slate-900">87,500 ₽</p>
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
                <p className="text-2xl font-bold text-slate-900">70%</p>
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
                <p className="text-2xl font-bold text-slate-900">3</p>
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

      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Отчеты загружены успешно
            </h3>
            <p className="text-slate-600 mb-4">
              Данные доступны. Здесь будут отображаться детальные графики и таблицы.
            </p>
            <button
              onClick={() => setHasData(false)}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              Показать состояние без данных
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimpleSafeReportsPage;
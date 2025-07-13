import React from 'react';
import { Layout } from '../../components/common/Layout';

const SimpleReportsPage: React.FC = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Отчеты и аналитика
              </h1>
              <p className="text-gray-600">
                Анализ данных и отчеты по бюджету
              </p>
            </div>

            {/* Simple Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-l-blue-500">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 text-sm font-semibold">₽</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Общий доход</p>
                    <p className="text-2xl font-bold text-gray-900">1,250,000</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-l-red-500">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-red-600 text-sm font-semibold">₽</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Общий расход</p>
                    <p className="text-2xl font-bold text-gray-900">980,000</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-l-green-500">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 text-sm font-semibold">+</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Экономия</p>
                    <p className="text-2xl font-bold text-gray-900">270,000</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-l-purple-500">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 text-sm font-semibold">%</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Использование бюджета</p>
                    <p className="text-2xl font-bold text-gray-900">78%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Simple Content */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Отчеты (упрощенная версия)
              </h2>
              <p className="text-gray-600 mb-4">
                Страница отчетов успешно загрузилась! 
                Здесь будут отображаться детальные отчеты и графики.
              </p>
              
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">План vs Факт</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Планировалось:</span>
                      <span className="ml-2 font-semibold">1,200,000 ₽</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Потрачено:</span>
                      <span className="ml-2 font-semibold">980,000 ₽</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Отклонение:</span>
                      <span className="ml-2 font-semibold text-green-600">-220,000 ₽</span>
                    </div>
                  </div>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Основные категории</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Операционные расходы</span>
                      <span className="font-semibold">450,000 ₽</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Маркетинг</span>
                      <span className="font-semibold">280,000 ₽</span>
                    </div>
                    <div className="flex justify-between">
                      <span>IT расходы</span>
                      <span className="font-semibold">250,000 ₽</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SimpleReportsPage;
import React from 'react';

const ReportsPage: React.FC = () => {
  console.log('ReportsPage rendering...');
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Отчеты и аналитика</h1>
          <p className="text-slate-600">
            Подробная аналитика и отчеты по управлению бюджетом
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Статистика</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
              <p className="text-sm text-slate-600">Общий доход</p>
              <p className="text-2xl font-bold">125,000 ₽</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
              <p className="text-sm text-slate-600">Общий расход</p>
              <p className="text-2xl font-bold">87,500 ₽</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
              <p className="text-sm text-slate-600">Использование бюджета</p>
              <p className="text-2xl font-bold">70%</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
              <p className="text-sm text-slate-600">Периодов</p>
              <p className="text-2xl font-bold">3</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
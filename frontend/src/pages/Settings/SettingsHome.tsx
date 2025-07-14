import React from 'react';
import { Settings } from 'lucide-react';
import { SettingsNavigation } from './SettingsNavigation';

export const SettingsHome: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-slate-600" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Настройки системы
            </h1>
            <p className="text-slate-600 mt-1">
              Управление справочниками и настройками приложения
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Cards */}
      <SettingsNavigation />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-gray-900">12</div>
          <div className="text-sm text-gray-600">Активных периодов</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-gray-900">5</div>
          <div className="text-sm text-gray-600">Финансовых центров</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-gray-900">23</div>
          <div className="text-sm text-gray-600">Категорий</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-gray-900">156</div>
          <div className="text-sm text-gray-600">Продуктов</div>
        </div>
      </div>
    </div>
  );
};
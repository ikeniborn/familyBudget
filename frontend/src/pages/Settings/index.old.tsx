import React, { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '../../components/common/Layout';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { EnhancedPeriodManager } from '../../components/reference/EnhancedPeriodManager';
import { EnhancedFinancialCenterManager } from '../../components/reference/EnhancedFinancialCenterManager';
import { EnhancedCostCenterManager } from '../../components/reference/EnhancedCostCenterManager';
import { EnhancedNomenclatureManager } from '../../components/reference/EnhancedNomenclatureManager';
import { ProductManager } from '../../components/reference/ProductManager';
import {
  Calendar,
  Building2,
  Briefcase,
  Tags,
  Package,
  Users,
  Settings as SettingsIcon,
  ChevronRight,
  Database,
  FileText,
  Shield,
} from 'lucide-react';

// Tab configuration
const referenceDataTabs = [
  {
    id: 'periods',
    label: 'Периоды',
    icon: Calendar,
    description: 'Управление временными периодами для планирования бюджета',
    color: 'blue',
  },
  {
    id: 'financial-centers',
    label: 'Финансовые центры',
    icon: Building2,
    description: 'Центры финансовой ответственности (ЦФО)',
    color: 'green',
  },
  {
    id: 'cost-centers',
    label: 'Центры затрат',
    icon: Briefcase,
    description: 'Места возникновения затрат (МВЗ)',
    color: 'purple',
  },
  {
    id: 'nomenclatures',
    label: 'Номенклатуры',
    icon: Tags,
    description: 'Категории доходов и расходов',
    color: 'orange',
  },
  {
    id: 'products',
    label: 'Продукты',
    icon: Package,
    description: 'Каталог продуктов и услуг',
    color: 'pink',
  },
  {
    id: 'users',
    label: 'Пользователи',
    icon: Users,
    description: 'Управление пользователями системы',
    color: 'indigo',
  },
];

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get active tab from URL or default to 'periods'
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTabFromUrl = pathParts.length > 1 ? pathParts[1] : 'periods';
  const [activeTab, setActiveTab] = useState(activeTabFromUrl);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    navigate(`/settings/${value}`);
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
      green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
      purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
      orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
      pink: { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200' },
      indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header with breadcrumbs */}
        <div className="border-b pb-4">
          <Breadcrumbs />
          
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <SettingsIcon className="h-8 w-8 text-slate-600" />
              Настройки системы
            </h1>
            <p className="text-slate-600 mt-2">
              Управление справочниками и настройками приложения
            </p>
          </div>
        </div>

        {/* Quick navigation cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {referenceDataTabs.map((tab) => {
            const Icon = tab.icon;
            const colors = getColorClasses(tab.color);
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  relative p-4 rounded-lg border-2 transition-all duration-200
                  ${isActive 
                    ? `${colors.border} ${colors.bg} shadow-lg scale-105` 
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`
                    p-2 rounded-lg
                    ${isActive ? colors.bg : 'bg-gray-100'}
                  `}>
                    <Icon className={`h-5 w-5 ${isActive ? colors.text : 'text-gray-600'}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className={`font-semibold ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
                      {tab.label}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {tab.description}
                    </p>
                  </div>
                  <ChevronRight className={`
                    h-5 w-5 transition-transform
                    ${isActive ? 'text-gray-700 translate-x-1' : 'text-gray-400'}
                  `} />
                </div>
                {isActive && (
                  <div className={`absolute inset-x-0 bottom-0 h-1 ${colors.bg} rounded-b-lg`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Tabs content */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 h-auto p-1 bg-gray-100">
            {referenceDataTabs.map((tab) => {
              const Icon = tab.icon;
              const colors = getColorClasses(tab.color);
              
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-md transition-all
                    data-[state=active]:bg-white data-[state=active]:shadow-sm
                  `}
                >
                  <Icon className={`h-4 w-4 ${activeTab === tab.id ? colors.text : 'text-gray-500'}`} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Content for each tab */}
          <TabsContent value="periods" className="space-y-4">
            <EnhancedPeriodManager />
          </TabsContent>

          <TabsContent value="financial-centers" className="space-y-4">
            <EnhancedFinancialCenterManager />
          </TabsContent>

          <TabsContent value="cost-centers" className="space-y-4">
            <EnhancedCostCenterManager />
          </TabsContent>

          <TabsContent value="nomenclatures" className="space-y-4">
            <EnhancedNomenclatureManager />
          </TabsContent>

          <TabsContent value="products" className="space-y-4">
            <ProductManager />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Users className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Управление пользователями</h2>
                    <p className="text-sm text-gray-600">Пользователи и их права доступа</p>
                  </div>
                </div>
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  Добавить пользователя
                </button>
              </div>
              {/* Users component will go here */}
              <div className="text-center py-12 text-gray-500">
                <Shield className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>Компонент управления пользователями будет здесь</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Additional settings section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="h-6 w-6 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Импорт/Экспорт</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Массовое обновление справочников через файлы
            </p>
            <div className="space-y-2">
              <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left">
                Импорт из Excel
              </button>
              <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left">
                Экспорт в CSV
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-6 w-6 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Безопасность</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Настройки безопасности и аудит изменений
            </p>
            <div className="space-y-2">
              <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left">
                История изменений
              </button>
              <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left">
                Настройки доступа
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsPage;
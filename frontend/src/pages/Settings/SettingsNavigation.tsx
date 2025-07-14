import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import {
  Calendar,
  Building2,
  Briefcase,
  Tags,
  Package,
  Users,
  Settings,
  FileText,
  Shield,
  Database,
  ChevronRight,
  Layers,
  BookOpen,
  CreditCard,
} from 'lucide-react';

interface SettingCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  items: SettingItem[];
}

interface SettingItem {
  id: string;
  label: string;
  description: string;
  path: string;
  icon: React.ElementType;
}

const settingsCategories: SettingCategory[] = [
  {
    id: 'reference-data',
    title: 'Справочники',
    description: 'Основные справочники системы',
    icon: Database,
    color: 'blue',
    items: [
      {
        id: 'periods',
        label: 'Периоды',
        description: 'Управление временными периодами',
        path: '/settings/periods',
        icon: Calendar,
      },
      {
        id: 'financial-centers',
        label: 'Финансовые центры',
        description: 'Центры финансовой ответственности',
        path: '/settings/financial-centers',
        icon: Building2,
      },
      {
        id: 'cost-centers',
        label: 'Центры затрат',
        description: 'Места возникновения затрат',
        path: '/settings/cost-centers',
        icon: Briefcase,
      },
    ],
  },
  {
    id: 'catalog-data',
    title: 'Каталоги',
    description: 'Управление каталогами и категориями',
    icon: BookOpen,
    color: 'green',
    items: [
      {
        id: 'nomenclatures',
        label: 'Номенклатуры',
        description: 'Категории доходов и расходов',
        path: '/settings/nomenclatures',
        icon: Tags,
      },
      {
        id: 'products',
        label: 'Продукты',
        description: 'Каталог продуктов и услуг',
        path: '/settings/products',
        icon: Package,
      },
    ],
  },
  {
    id: 'system-settings',
    title: 'Система',
    description: 'Системные настройки и безопасность',
    icon: Settings,
    color: 'purple',
    items: [
      {
        id: 'users',
        label: 'Пользователи',
        description: 'Управление пользователями',
        path: '/settings/users',
        icon: Users,
      },
      {
        id: 'security',
        label: 'Безопасность',
        description: 'Настройки безопасности',
        path: '/settings/security',
        icon: Shield,
      },
      {
        id: 'import-export',
        label: 'Импорт/Экспорт',
        description: 'Массовые операции с данными',
        path: '/settings/import-export',
        icon: FileText,
      },
    ],
  },
];

const getColorClasses = (color: string) => {
  const colors: Record<string, { bg: string; text: string; border: string; hover: string }> = {
    blue: { 
      bg: 'bg-blue-50', 
      text: 'text-blue-600', 
      border: 'border-blue-200',
      hover: 'hover:bg-blue-100' 
    },
    green: { 
      bg: 'bg-green-50', 
      text: 'text-green-600', 
      border: 'border-green-200',
      hover: 'hover:bg-green-100' 
    },
    purple: { 
      bg: 'bg-purple-50', 
      text: 'text-purple-600', 
      border: 'border-purple-200',
      hover: 'hover:bg-purple-100' 
    },
  };
  return colors[color] || colors.blue;
};

export const SettingsNavigation: React.FC = () => {
  const location = useLocation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {settingsCategories.map((category) => {
        const Icon = category.icon;
        const colors = getColorClasses(category.color);
        
        return (
          <Card key={category.id} className="overflow-hidden">
            <div className={`${colors.bg} ${colors.border} border-b p-4`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white`}>
                  <Icon className={`h-6 w-6 ${colors.text}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{category.title}</h3>
                  <p className="text-sm text-gray-600">{category.description}</p>
                </div>
              </div>
            </div>
            
            <CardContent className="p-0">
              <div className="divide-y">
                {category.items.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = location.pathname === item.path;
                  
                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      className={`
                        block px-4 py-3 transition-colors
                        ${isActive 
                          ? `${colors.bg} ${colors.border} border-l-4` 
                          : `hover:bg-gray-50`
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ItemIcon className={`h-5 w-5 ${isActive ? colors.text : 'text-gray-400'}`} />
                          <div>
                            <p className={`font-medium ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
                              {item.label}
                            </p>
                            <p className="text-sm text-gray-500">
                              {item.description}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className={`h-4 w-4 ${isActive ? colors.text : 'text-gray-400'}`} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  separator?: React.ReactNode;
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items = [],
  separator = <ChevronRight className="h-4 w-4 text-gray-400" />,
  className = '',
}) => {
  const location = useLocation();

  // Auto-generate breadcrumbs from path if items not provided
  const breadcrumbItems = items.length > 0 ? items : generateBreadcrumbsFromPath(location.pathname);

  if (breadcrumbItems.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center space-x-2 ${className}`}>
      {/* Home link */}
      <Link
        to="/"
        className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>

      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1;

        return (
          <React.Fragment key={index}>
            {separator}
            {isLast || !item.href ? (
              <span className="flex items-center text-sm font-medium text-gray-900">
                {item.icon && <span className="mr-1">{item.icon}</span>}
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                {item.icon && <span className="mr-1">{item.icon}</span>}
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

// Helper function to generate breadcrumbs from URL path
function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
  const paths = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  const pathLabels: Record<string, string> = {
    settings: 'Настройки',
    periods: 'Периоды',
    'financial-centers': 'Финансовые центры',
    'cost-centers': 'Центры затрат',
    nomenclatures: 'Номенклатуры',
    products: 'Продукты',
    users: 'Пользователи',
    reports: 'Отчеты',
    dashboard: 'Панель управления',
    fact: 'Факт',
    budget: 'Бюджет',
  };

  let currentPath = '';
  paths.forEach((path, index) => {
    currentPath += `/${path}`;
    breadcrumbs.push({
      label: pathLabels[path] || path.charAt(0).toUpperCase() + path.slice(1),
      href: index < paths.length - 1 ? currentPath : undefined,
    });
  });

  return breadcrumbs;
}

export default Breadcrumbs;
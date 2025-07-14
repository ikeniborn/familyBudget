import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { NotificationDropdown } from './NotificationDropdown';
import { 
  Menu, 
  X, 
  Home, 
  Calculator, 
  CreditCard, 
  BarChart3, 
  Package,
  FileText,
  LogOut,
  User,
  ClipboardList,
  Settings
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { name: 'Главная', path: '/dashboard', icon: Home },
  { name: 'Факт', path: '/fact', icon: CreditCard },
  { name: 'Бюджет', path: '/budget', icon: Calculator },
  { name: 'Отчеты', path: '/reports', icon: BarChart3 },
  { name: 'Продукты', path: '/products', icon: Package },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Card
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 border-r-2 rounded-none flex-shrink-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b bg-gradient-to-r from-blue-600 to-purple-600">
            <h1 className="text-xl font-bold text-white">💰 FamilyBudget</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <CardContent className="flex-1 p-4">
            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || 
                  (item.path === '/settings' && location.pathname.startsWith('/settings'));
                
                return (
                  <Button
                    key={item.path}
                    variant={isActive ? "default" : "ghost"}
                    className={clsx(
                      'w-full justify-start h-12 text-left font-medium',
                      isActive
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-700 hover:bg-slate-100'
                    )}
                    onClick={() => {
                      setSidebarOpen(false);
                      if (!isActive) {
                        navigate(item.path);
                      }
                    }}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Button>
                );
              })}
            </nav>
          </CardContent>

          {/* User info */}
          <div className="border-t bg-slate-50/50 p-4">
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {user?.first_name || user?.username || 'Пользователь'}
                    </p>
                    <p className="text-xs text-slate-500">ID: {user?.user_id}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-red-500"
                  title="Выйти"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </Card>

      {/* Main content */}
      <div className="flex-1 flex flex-col w-full">
        {/* Top bar */}
        <Card className="sticky top-0 z-10 rounded-none border-b-2 shadow-sm">
          <CardContent className="flex h-16 items-center p-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="mr-2 lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </Button>
            
            <div className="flex flex-1 items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">
                  {navItems.find(item => item.path === location.pathname || 
                    (item.path === '/settings' && location.pathname.startsWith('/settings')))?.name || 'Страница'}
                </h2>
                <p className="text-sm text-slate-500">
                  Управление семейным бюджетом
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <NotificationDropdown />
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navigate('/form-validation')}
                  title="Валидация форм"
                >
                  <ClipboardList className="h-5 w-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navigate('/settings', { replace: true })}
                  title="Настройки"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Page content */}
        <main className="flex-1">
          <div className="p-6">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
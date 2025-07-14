import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Users, UserPlus, UserCheck, UserX, Mail, Shield, Calendar } from 'lucide-react';
import { Badge } from '../../components/ui/badge';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'blocked';
  lastLogin: string;
  created: string;
}

const mockUsers: User[] = [
  {
    id: 1,
    name: 'Иван Петров',
    email: 'ivan@example.com',
    role: 'Администратор',
    status: 'active',
    lastLogin: '2 часа назад',
    created: '01.01.2024',
  },
  {
    id: 2,
    name: 'Мария Сидорова',
    email: 'maria@example.com',
    role: 'Пользователь',
    status: 'active',
    lastLogin: '1 день назад',
    created: '15.01.2024',
  },
  {
    id: 3,
    name: 'Алексей Иванов',
    email: 'alex@example.com',
    role: 'Пользователь',
    status: 'inactive',
    lastLogin: '1 месяц назад',
    created: '20.12.2023',
  },
];

export const UsersPage: React.FC = () => {
  const getStatusBadge = (status: User['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Активен</Badge>;
      case 'inactive':
        return <Badge className="bg-yellow-100 text-yellow-800">Неактивен</Badge>;
      case 'blocked':
        return <Badge className="bg-red-100 text-red-800">Заблокирован</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-slate-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Управление пользователями</h1>
            <p className="text-slate-600">Пользователи системы и их права доступа</p>
          </div>
        </div>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Добавить пользователя
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-gray-600">Всего пользователей</p>
              </div>
              <Users className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">2</p>
                <p className="text-sm text-gray-600">Активных</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">1</p>
                <p className="text-sm text-gray-600">Неактивных</p>
              </div>
              <UserX className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-gray-600">Заблокированных</p>
              </div>
              <Shield className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Список пользователей</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Пользователь</th>
                  <th className="text-left py-3 px-4">Роль</th>
                  <th className="text-left py-3 px-4">Статус</th>
                  <th className="text-left py-3 px-4">Последний вход</th>
                  <th className="text-left py-3 px-4">Создан</th>
                  <th className="text-right py-3 px-4">Действия</th>
                </tr>
              </thead>
              <tbody>
                {mockUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm">{user.role}</span>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">{user.lastLogin}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {user.created}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline">
                          Изменить
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                          Блокировать
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Roles */}
      <Card>
        <CardHeader>
          <CardTitle>Роли и права доступа</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Администратор</h4>
                <Badge>1 пользователь</Badge>
              </div>
              <p className="text-sm text-gray-600">
                Полный доступ ко всем функциям системы
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Пользователь</h4>
                <Badge>2 пользователя</Badge>
              </div>
              <p className="text-sm text-gray-600">
                Доступ к созданию и редактированию записей
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Гость</h4>
                <Badge variant="secondary">0 пользователей</Badge>
              </div>
              <p className="text-sm text-gray-600">
                Только просмотр данных без возможности редактирования
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
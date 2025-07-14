import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Shield, History, Key, UserCheck, AlertTriangle, Lock } from 'lucide-react';

export const SecurityPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-slate-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Безопасность</h1>
          <p className="text-slate-600">Управление безопасностью и аудит системы</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Audit History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              История изменений
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Просмотр всех изменений в системе с возможностью фильтрации.
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">Последние изменения</p>
                  <p className="text-sm text-gray-500">1,245 записей за последние 30 дней</p>
                </div>
                <Button size="sm">Просмотр</Button>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">Удаленные записи</p>
                  <p className="text-sm text-gray-500">23 записи доступны для восстановления</p>
                </div>
                <Button size="sm" variant="outline">Управление</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Access Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Контроль доступа
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Настройка прав доступа и ролей пользователей.
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-gray-600" />
                  <div>
                    <p className="font-medium">Роли и права</p>
                    <p className="text-sm text-gray-500">3 роли настроено</p>
                  </div>
                </div>
                <Button size="sm" variant="outline">Настроить</Button>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-gray-600" />
                  <div>
                    <p className="font-medium">Ограничения доступа</p>
                    <p className="text-sm text-gray-500">По IP и времени</p>
                  </div>
                </div>
                <Button size="sm" variant="outline">Изменить</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Status */}
      <Card>
        <CardHeader>
          <CardTitle>Статус безопасности</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Shield className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Защита активна</p>
                  <p className="text-sm text-green-700">Все системы работают нормально</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-900">Требуется внимание</p>
                  <p className="text-sm text-yellow-700">2 пользователя без активности 90+ дней</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <History className="h-6 w-6 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">Последний аудит</p>
                  <p className="text-sm text-blue-700">Выполнен 3 дня назад</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Последняя активность</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { user: 'Иван Петров', action: 'Изменил период "Январь 2024"', time: '5 минут назад' },
              { user: 'Мария Сидорова', action: 'Добавила новую номенклатуру', time: '1 час назад' },
              { user: 'Система', action: 'Автоматическое резервное копирование', time: '3 часа назад' },
              { user: 'Алексей Иванов', action: 'Экспортировал данные продуктов', time: '5 часов назад' },
            ].map((activity, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{activity.user}</p>
                  <p className="text-sm text-gray-600">{activity.action}</p>
                </div>
                <span className="text-sm text-gray-500">{activity.time}</span>
              </div>
            ))}
          </div>
          
          <Button variant="outline" className="w-full mt-4">
            Показать всю активность
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
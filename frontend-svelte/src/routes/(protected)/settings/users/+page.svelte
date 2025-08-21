<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { Users, UserPlus, UserCheck, UserX, Mail, Shield, Calendar } from 'lucide-svelte';

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

  const getStatusBadge = (status: User['status']) => {
    switch (status) {
      case 'active':
        return { class: 'bg-green-100 text-green-800', text: 'Активен' };
      case 'inactive':
        return { class: 'bg-yellow-100 text-yellow-800', text: 'Неактивен' };
      case 'blocked':
        return { class: 'bg-red-100 text-red-800', text: 'Заблокирован' };
    }
  };

  const addUser = () => {
    // TODO: Implement add user functionality
    console.log('Add user');
  };

  const editUser = (userId: number) => {
    // TODO: Implement edit user functionality
    console.log('Edit user:', userId);
  };

  const blockUser = (userId: number) => {
    // TODO: Implement block user functionality
    console.log('Block user:', userId);
  };
</script>

<svelte:head>
  <title>Управление пользователями - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <Users class="h-8 w-8 text-slate-600" />
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Управление пользователями</h1>
        <p class="text-slate-600">Пользователи системы и их права доступа</p>
      </div>
    </div>
    <Button on:click={addUser}>
      <UserPlus class="h-4 w-4 mr-2" />
      Добавить пользователя
    </Button>
  </div>

  <!-- Statistics -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">3</p>
            <p class="text-sm text-gray-600">Всего пользователей</p>
          </div>
          <Users class="h-8 w-8 text-gray-400" />
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">2</p>
            <p class="text-sm text-gray-600">Активных</p>
          </div>
          <UserCheck class="h-8 w-8 text-green-500" />
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">1</p>
            <p class="text-sm text-gray-600">Неактивных</p>
          </div>
          <UserX class="h-8 w-8 text-yellow-500" />
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">0</p>
            <p class="text-sm text-gray-600">Заблокированных</p>
          </div>
          <Shield class="h-8 w-8 text-red-500" />
        </div>
      </div>
    </Card>
  </div>

  <!-- Users Table -->
  <Card>
    <div class="p-6">
      <h2 class="text-xl font-semibold mb-4">Список пользователей</h2>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b">
              <th class="text-left py-3 px-4">Пользователь</th>
              <th class="text-left py-3 px-4">Роль</th>
              <th class="text-left py-3 px-4">Статус</th>
              <th class="text-left py-3 px-4">Последний вход</th>
              <th class="text-left py-3 px-4">Создан</th>
              <th class="text-right py-3 px-4">Действия</th>
            </tr>
          </thead>
          <tbody>
            {#each mockUsers as user}
              {@const statusBadge = getStatusBadge(user.status)}
              <tr class="border-b hover:bg-gray-50">
                <td class="py-3 px-4">
                  <div>
                    <p class="font-medium">{user.name}</p>
                    <p class="text-sm text-gray-500 flex items-center gap-1">
                      <Mail class="h-3 w-3" />
                      {user.email}
                    </p>
                  </div>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm">{user.role}</span>
                </td>
                <td class="py-3 px-4">
                  <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold {statusBadge.class}">
                    {statusBadge.text}
                  </span>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm text-gray-600">{user.lastLogin}</span>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm text-gray-600 flex items-center gap-1">
                    <Calendar class="h-3 w-3" />
                    {user.created}
                  </span>
                </td>
                <td class="py-3 px-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" on:click={() => editUser(user.id)}>
                      Изменить
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      class="text-red-600 hover:text-red-700"
                      on:click={() => blockUser(user.id)}
                    >
                      Блокировать
                    </Button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </Card>

  <!-- Roles -->
  <Card>
    <div class="p-6">
      <h2 class="text-xl font-semibold mb-4">Роли и права доступа</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-4 border rounded-lg">
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-medium">Администратор</h4>
            <Badge>1 пользователь</Badge>
          </div>
          <p class="text-sm text-gray-600">
            Полный доступ ко всем функциям системы
          </p>
        </div>
        
        <div class="p-4 border rounded-lg">
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-medium">Пользователь</h4>
            <Badge>2 пользователя</Badge>
          </div>
          <p class="text-sm text-gray-600">
            Доступ к созданию и редактированию записей
          </p>
        </div>
        
        <div class="p-4 border rounded-lg">
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-medium">Гость</h4>
            <Badge variant="secondary">0 пользователей</Badge>
          </div>
          <p class="text-sm text-gray-600">
            Только просмотр данных без возможности редактирования
          </p>
        </div>
      </div>
    </div>
  </Card>
</div>
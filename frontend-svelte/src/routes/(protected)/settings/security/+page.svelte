<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { Shield, History, Key, UserCheck, AlertTriangle, Lock } from 'lucide-svelte';

  interface Activity {
    user: string;
    action: string;
    time: string;
  }

  const recentActivity: Activity[] = [
    { user: 'Иван Петров', action: 'Изменил период "Январь 2024"', time: '5 минут назад' },
    { user: 'Мария Сидорова', action: 'Добавила новую номенклатуру', time: '1 час назад' },
    { user: 'Система', action: 'Автоматическое резервное копирование', time: '3 часа назад' },
    { user: 'Алексей Иванов', action: 'Экспортировал данные продуктов', time: '5 часов назад' },
  ];

  const viewAuditHistory = () => {
    // TODO: Implement audit history view
    console.log('View audit history');
  };

  const manageDeletedRecords = () => {
    // TODO: Implement deleted records management
    console.log('Manage deleted records');
  };

  const configureRoles = () => {
    // TODO: Implement roles configuration
    console.log('Configure roles');
  };

  const changeAccessRestrictions = () => {
    // TODO: Implement access restrictions management
    console.log('Change access restrictions');
  };

  const showAllActivity = () => {
    // TODO: Implement show all activity
    console.log('Show all activity');
  };
</script>

<svelte:head>
  <title>Безопасность - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center gap-3">
    <Shield class="h-8 w-8 text-slate-600" />
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Безопасность</h1>
      <p class="text-slate-600">Управление безопасностью и аудит системы</p>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Audit History -->
    <Card>
      <div class="p-6 space-y-4">
        <div class="flex items-center gap-2 mb-4">
          <History class="h-5 w-5" />
          <h2 class="text-xl font-semibold">История изменений</h2>
        </div>
        
        <p class="text-sm text-gray-600">
          Просмотр всех изменений в системе с возможностью фильтрации.
        </p>
        
        <div class="space-y-2">
          <div class="flex items-center justify-between py-2 border-b">
            <div>
              <p class="font-medium">Последние изменения</p>
              <p class="text-sm text-gray-500">1,245 записей за последние 30 дней</p>
            </div>
            <Button size="sm" on:click={viewAuditHistory}>Просмотр</Button>
          </div>
          
          <div class="flex items-center justify-between py-2 border-b">
            <div>
              <p class="font-medium">Удаленные записи</p>
              <p class="text-sm text-gray-500">23 записи доступны для восстановления</p>
            </div>
            <Button size="sm" variant="outline" on:click={manageDeletedRecords}>Управление</Button>
          </div>
        </div>
      </div>
    </Card>

    <!-- Access Control -->
    <Card>
      <div class="p-6 space-y-4">
        <div class="flex items-center gap-2 mb-4">
          <UserCheck class="h-5 w-5" />
          <h2 class="text-xl font-semibold">Контроль доступа</h2>
        </div>
        
        <p class="text-sm text-gray-600">
          Настройка прав доступа и ролей пользователей.
        </p>
        
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-3">
              <Key class="h-5 w-5 text-gray-600" />
              <div>
                <p class="font-medium">Роли и права</p>
                <p class="text-sm text-gray-500">3 роли настроено</p>
              </div>
            </div>
            <Button size="sm" variant="outline" on:click={configureRoles}>Настроить</Button>
          </div>
          
          <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-3">
              <Lock class="h-5 w-5 text-gray-600" />
              <div>
                <p class="font-medium">Ограничения доступа</p>
                <p class="text-sm text-gray-500">По IP и времени</p>
              </div>
            </div>
            <Button size="sm" variant="outline" on:click={changeAccessRestrictions}>Изменить</Button>
          </div>
        </div>
      </div>
    </Card>
  </div>

  <!-- Security Status -->
  <Card>
    <div class="p-6">
      <h2 class="text-xl font-semibold mb-4">Статус безопасности</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div class="flex items-center gap-3">
            <Shield class="h-6 w-6 text-green-600" />
            <div>
              <p class="font-medium text-green-900">Защита активна</p>
              <p class="text-sm text-green-700">Все системы работают нормально</p>
            </div>
          </div>
        </div>
        
        <div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div class="flex items-center gap-3">
            <AlertTriangle class="h-6 w-6 text-yellow-600" />
            <div>
              <p class="font-medium text-yellow-900">Требуется внимание</p>
              <p class="text-sm text-yellow-700">2 пользователя без активности 90+ дней</p>
            </div>
          </div>
        </div>
        
        <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div class="flex items-center gap-3">
            <History class="h-6 w-6 text-blue-600" />
            <div>
              <p class="font-medium text-blue-900">Последний аудит</p>
              <p class="text-sm text-blue-700">Выполнен 3 дня назад</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Card>

  <!-- Recent Activity -->
  <Card>
    <div class="p-6">
      <h2 class="text-xl font-semibold mb-4">Последняя активность</h2>
      <div class="space-y-3">
        {#each recentActivity as activity}
          <div class="flex items-center justify-between py-2 border-b last:border-0">
            <div>
              <p class="font-medium">{activity.user}</p>
              <p class="text-sm text-gray-600">{activity.action}</p>
            </div>
            <span class="text-sm text-gray-500">{activity.time}</span>
          </div>
        {/each}
      </div>
      
      <Button variant="outline" class="w-full mt-4" on:click={showAllActivity}>
        Показать всю активность
      </Button>
    </div>
  </Card>
</div>
<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import UserModal from '$lib/components/modals/UserModal.svelte';
  import ConfirmDeleteModal from '$lib/components/modals/ConfirmDeleteModal.svelte';
  import { Users, UserPlus, UserCheck, UserX, Mail, Shield, Calendar, Trash2 } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { userService } from '$lib/services/userService';
  import { useToast } from '$lib/stores/toast.store';
  import { isAdmin, currentUser } from '$lib/stores';

  const toast = useToast();
  import type { User } from '$lib/types';

  interface UserStats {
    total: number;
    active: number;
    inactive: number;
    blocked: number;
  }

  let users: User[] = [];
  let userStats: UserStats = {
    total: 0,
    active: 0,
    inactive: 0,
    blocked: 0
  };
  let loading = true;
  let showUserModal = false;
  let selectedUser: User | null = null;
  let showDeleteModal = false;
  let userToDelete: User | null = null;
  let deleting = false;

  onMount(() => {
    loadUsers();
    loadUserStats();
  });

  async function loadUsers() {
    try {
      loading = true;
      users = await userService.getAllUsers();
    } catch (error: any) {
      toast.error(
        'Ошибка при загрузке пользователей',
        error.message
      );
    } finally {
      loading = false;
    }
  }

  async function loadUserStats() {
    try {
      userStats = await userService.getUsersStats();
    } catch (error: any) {
      console.error('Failed to load user stats:', error);
    }
  }

  const getStatusBadge = (user: User) => {
    if (user.is_active) {
      return { class: 'bg-green-100 text-green-800', text: 'Активен' };
    } else {
      return { class: 'bg-red-100 text-red-800', text: 'Заблокирован' };
    }
  };

  function formatDate(dateString: string | null | undefined) {
    if (!dateString) return 'Не указано';
    try {
      return new Date(dateString).toLocaleDateString('ru-RU');
    } catch {
      return 'Не указано';
    }
  }

  function handleAddUser() {
    selectedUser = null;
    showUserModal = true;
  }

  function handleEditUser(user: User) {
    selectedUser = user;
    showUserModal = true;
  }

  async function handleToggleUserStatus(user: User) {
    try {
      await userService.toggleUserStatus(user.id);
      toast.success(
        `Пользователь ${user.is_active ? 'заблокирован' : 'разблокирован'}`
      );
      await loadUsers();
      await loadUserStats();
    } catch (error: any) {
      toast.error(
        'Ошибка при изменении статуса пользователя',
        error.message
      );
    }
  }

  function handleUserModalSuccess() {
    showUserModal = false;
    loadUsers();
    loadUserStats();
  }

  function handleDeleteUser(user: User) {
    userToDelete = user;
    showDeleteModal = true;
  }

  async function handleConfirmDelete() {
    if (!userToDelete) return;
    
    try {
      deleting = true;
      const response = await userService.deleteUser(userToDelete.id);
      toast.success(response.message || 'Пользователь успешно удален');
      
      showDeleteModal = false;
      userToDelete = null;
      await loadUsers();
      await loadUserStats();
    } catch (error: any) {
      toast.error(
        'Ошибка при удалении пользователя',
        error.message
      );
    } finally {
      deleting = false;
    }
  }

  function handleCloseDeleteModal() {
    showDeleteModal = false;
    userToDelete = null;
  }
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
    {#if $isAdmin}
      <Button on:click={handleAddUser}>
        <UserPlus class="h-4 w-4 mr-2" />
        Добавить пользователя
      </Button>
    {/if}
  </div>

  <!-- Statistics -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">{userStats.total}</p>
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
            <p class="text-2xl font-bold">{userStats.active}</p>
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
            <p class="text-2xl font-bold">{userStats.inactive}</p>
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
            <p class="text-2xl font-bold">{userStats.blocked}</p>
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
              <th class="text-left py-3 px-4">Метод входа</th>
              <th class="text-left py-3 px-4">Создан</th>
              <th class="text-right py-3 px-4">Действия</th>
            </tr>
          </thead>
          <tbody>
            {#if loading}
              <tr>
                <td colspan="6" class="py-8 text-center text-gray-500">
                  Загрузка пользователей...
                </td>
              </tr>
            {:else if users.length === 0}
              <tr>
                <td colspan="6" class="py-8 text-center text-gray-500">
                  Пользователи не найдены
                </td>
              </tr>
            {:else}
              {#each users as user}
                {@const statusBadge = getStatusBadge(user)}
                <tr class="border-b hover:bg-gray-50">
                  <td class="py-3 px-4">
                    <div>
                      <p class="font-medium">{user.user_name}</p>
                      {#if user.user_email}
                        <p class="text-sm text-gray-500 flex items-center gap-1">
                          <Mail class="h-3 w-3" />
                          {user.user_email}
                        </p>
                      {/if}
                    </div>
                  </td>
                  <td class="py-3 px-4">
                    <span class="text-sm">
                      {user.id === 1 ? 'Администратор' : 'Пользователь'}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold {statusBadge.class}">
                      {statusBadge.text}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <span class="text-sm text-gray-600">
                      {user.auth_method === 'telegram' ? 'Telegram' : 'Пароль'}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <span class="text-sm text-gray-600 flex items-center gap-1">
                      <Calendar class="h-3 w-3" />
                      {formatDate(user.created_at)}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      {#if $isAdmin}
                        <Button size="sm" variant="outline" on:click={() => handleEditUser(user)}>
                          Изменить
                        </Button>
                        {#if user.id !== 1}
                          <Button
                            size="sm"
                            variant="outline"
                            class={user.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                            on:click={() => handleToggleUserStatus(user)}
                          >
                            {user.is_active ? 'Заблокировать' : 'Разблокировать'}
                          </Button>
                        {/if}
                        {#if user.id !== $currentUser?.id && user.id !== 1}
                          <Button 
                            size="sm" 
                            variant="outline"
                            class="text-red-600 hover:text-red-700 hover:bg-red-50"
                            on:click={() => handleDeleteUser(user)}
                            title="Удалить пользователя"
                          >
                            <Trash2 class="h-4 w-4" />
                          </Button>
                        {/if}
                      {:else}
                        <span class="text-sm text-gray-500">Нет доступа</span>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
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
            <Badge>{userStats.total > 0 ? userStats.total - 1 : 0} пользователей</Badge>
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

<!-- User Modal -->
<UserModal 
  bind:open={showUserModal}
  user={selectedUser}
  on:success={handleUserModalSuccess}
  on:close={() => showUserModal = false}
/>

<!-- Delete Confirmation Modal -->
<ConfirmDeleteModal 
  bind:open={showDeleteModal}
  user={userToDelete}
  loading={deleting}
  on:confirm={handleConfirmDelete}
  on:close={handleCloseDeleteModal}
/>
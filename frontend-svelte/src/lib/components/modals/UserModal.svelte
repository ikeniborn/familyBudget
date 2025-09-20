<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import { createEventDispatcher } from 'svelte';
  import { userService } from '$lib/services/userService';
  import { useToast } from '$lib/stores/toast.store';

  const toast = useToast();
  import type { User } from '$lib/types';

  export let open = false;
  export let user: User | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    success: User;
  }>();

  let formData = {
    user_name: '',
    user_email: '',
    username: '',
    password: '',
    auth_method: 'password'
  };

  let loading = false;
  let errors: Record<string, string> = {};

  $: isEditing = !!user;
  $: modalTitle = isEditing ? 'Редактирование пользователя' : 'Добавить пользователя';

  // Update form data when user prop changes
  $: if (user) {
    formData = {
      user_name: user.user_name || '',
      user_email: user.user_email || '',
      username: user.username || '',
      password: '',
      auth_method: user.auth_method || 'password'
    };
  } else {
    formData = {
      user_name: '',
      user_email: '',
      username: '',
      password: '',
      auth_method: 'password'
    };
  }

  function validateForm() {
    errors = {};

    if (!formData.user_name.trim()) {
      errors.user_name = 'Имя пользователя обязательно';
    }

    if (!isEditing && !formData.password) {
      errors.password = 'Пароль обязателен при создании пользователя';
    }

    if (formData.password && formData.password.length < 6) {
      errors.password = 'Пароль должен содержать минимум 6 символов';
    }

    if (formData.user_email && !formData.user_email.includes('@')) {
      errors.user_email = 'Некорректный email';
    }

    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) return;

    loading = true;
    try {
      let result: User;

      if (isEditing && user) {
        result = await userService.updateUserAsAdmin(user.id, {
          user_name: formData.user_name,
          user_email: formData.user_email || undefined,
          username: formData.username || undefined,
          password: formData.password || undefined
        });
        toast.success('Пользователь успешно обновлен');
      } else {
        result = await userService.createUser({
          user_name: formData.user_name,
          user_email: formData.user_email || undefined,
          username: formData.username || undefined,
          password: formData.password,
          auth_method: formData.auth_method
        });
        toast.success('Пользователь успешно создан');
      }

      dispatch('success', result);
      handleClose();
    } catch (error: any) {
      toast.error(
        'Произошла ошибка',
        error.message
      );
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    open = false;
    formData = {
      user_name: '',
      user_email: '',
      username: '',
      password: '',
      auth_method: 'password'
    };
    errors = {};
    dispatch('close');
  }
</script>

<Modal bind:open on:close={handleClose} title={modalTitle} size="md">
  <div class="p-6 bg-white border border-gray-200 rounded-lg">
    <form on:submit|preventDefault={handleSubmit} class="space-y-6">
      <!-- Имя пользователя -->
      <div class="space-y-2">
        <label for="user_name" class="block text-sm font-medium text-gray-700">
          Имя пользователя *
        </label>
        <Input
          id="user_name"
          bind:value={formData.user_name}
          placeholder="Введите имя пользователя"
          hasError={!!errors.user_name}
          required
        />
        {#if errors.user_name}
          <div class="text-sm text-red-600">{errors.user_name}</div>
        {/if}
      </div>

      <!-- Email -->
      <div class="space-y-2">
        <label for="user_email" class="block text-sm font-medium text-gray-700">
          Email
        </label>
        <Input
          id="user_email"
          type="email"
          bind:value={formData.user_email}
          placeholder="Введите email"
          hasError={!!errors.user_email}
          readonly={false}
          disabled={false}
        />
        {#if errors.user_email}
          <div class="text-sm text-red-600">{errors.user_email}</div>
        {/if}
      </div>

      <!-- Логин -->
      <div class="space-y-2">
        <label for="username" class="block text-sm font-medium text-gray-700">
          Логин
        </label>
        <Input
          id="username"
          bind:value={formData.username}
          placeholder="Введите логин"
          hasError={!!errors.username}
          readonly={false}
          disabled={false}
        />
        {#if errors.username}
          <div class="text-sm text-red-600">{errors.username}</div>
        {/if}
      </div>

      <!-- Пароль -->
      <div class="space-y-2">
        <label for="password" class="block text-sm font-medium text-gray-700">
          Пароль {isEditing ? '(оставьте пустым, если не нужно менять)' : '*'}
        </label>
        <Input
          id="password"
          type="password"
          bind:value={formData.password}
          placeholder={isEditing ? 'Новый пароль' : 'Введите пароль'}
          hasError={!!errors.password}
          required={!isEditing}
          readonly={false}
          disabled={false}
        />
        {#if errors.password}
          <div class="text-sm text-red-600">{errors.password}</div>
        {/if}
      </div>

      <!-- Метод аутентификации -->
      <div class="space-y-2">
        <label for="auth_method" class="block text-sm font-medium text-gray-700">
          Метод аутентификации
        </label>
        <select
          id="auth_method"
          bind:value={formData.auth_method}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="password">Пароль</option>
          <option value="telegram">Telegram</option>
        </select>
      </div>
    </form>
  </div>

  <svelte:fragment slot="footer">
    <div class="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
      <Button variant="outline" on:click={handleClose} disabled={loading}>
        Отмена
      </Button>
      <Button on:click={handleSubmit} disabled={loading}>
        {loading ? 'Сохранение...' : isEditing ? 'Сохранить' : 'Создать'}
      </Button>
    </div>
  </svelte:fragment>
</Modal>
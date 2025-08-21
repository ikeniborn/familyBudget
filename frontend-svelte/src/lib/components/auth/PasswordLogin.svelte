<script lang="ts">
  import { goto } from '$app/navigation';
  import { setCurrentUser } from '$lib/stores/auth.store';
  import { useToast } from '$lib/stores/toast.store';
  import { api } from '$lib/services/api';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import type { User } from '$types';

  export let onSwitchToTelegram: () => void = () => {};

  let username = '';
  let password = '';
  let error = '';
  let isLoading = false;
  
  const toast = useToast();

  interface PasswordAuthResponse {
    success: boolean;
    user?: {
      id: number;
      username: string;
      firstName?: string;
      lastName?: string;
    };
    token?: string;
    error?: string;
  }

  async function handleSubmit() {
    error = '';
    isLoading = true;

    try {
      const response = await api.post<PasswordAuthResponse>('/auth/password', {
        username,
        password
      });

      if (response.success && response.user) {
        const user: User = {
          user_id: response.user.id,
          user_name: response.user.username || '',
          user_telegram_id: 0,
          first_name: response.user.firstName || '',
          last_name: response.user.lastName || '',
          username: response.user.username || '',
          authMethod: 'password'
        };

        setCurrentUser(user);
        
        if (response.token) {
          localStorage.setItem('auth_token', response.token);
        }

        toast.success('Успешно', 'Вы вошли в систему');
        goto('/dashboard');
      } else {
        error = response.error || 'Ошибка входа';
      }
    } catch (err: any) {
      console.error('Password login error:', err);
      error = err.message || 'Ошибка входа. Попробуйте еще раз.';
    } finally {
      isLoading = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && username && password && !isLoading) {
      handleSubmit();
    }
  }
</script>

<Card class="max-w-md w-full p-8 space-y-6">
  <div class="text-center">
    <h1 class="text-3xl font-bold text-gray-900 mb-2">
      💰 Family Budget
    </h1>
    <p class="text-gray-600">
      Управление семейным бюджетом
    </p>
  </div>

  <div class="space-y-4">
    <h2 class="text-xl font-semibold text-center text-gray-800">
      Вход с логином и паролем
    </h2>
    
    <p class="text-sm text-gray-600 text-center">
      Введите ваши данные для входа в систему
    </p>

    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
      <div class="space-y-4">
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700 mb-1">
            Имя пользователя
          </label>
          <Input
            id="username"
            type="text"
            bind:value={username}
            placeholder="Введите имя пользователя"
            required
            disabled={isLoading}
            on:keydown={handleKeydown}
            class="w-full"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
            Пароль
          </label>
          <Input
            id="password"
            type="password"
            bind:value={password}
            placeholder="Введите пароль"
            required
            disabled={isLoading}
            on:keydown={handleKeydown}
            class="w-full"
          />
        </div>
      </div>

      {#if error}
        <div class="rounded-md bg-red-50 p-4">
          <div class="text-sm text-red-800">{error}</div>
        </div>
      {/if}

      <Button
        type="submit"
        disabled={!username || !password || isLoading}
        class="w-full"
      >
        {#if isLoading}
          Вход...
        {:else}
          Войти
        {/if}
      </Button>
    </form>

    <div class="relative">
      <div class="absolute inset-0 flex items-center">
        <div class="w-full border-t border-gray-300"></div>
      </div>
      <div class="relative flex justify-center text-sm">
        <span class="px-2 bg-white text-gray-500">Или</span>
      </div>
    </div>

    <Button
      variant="outline"
      class="w-full"
      on:click={onSwitchToTelegram}
    >
      Войти через Telegram
    </Button>
  </div>

  <div class="text-xs text-gray-500 text-center">
    <p>
      Используйте ваше имя пользователя и пароль для входа в систему Family Budget.
    </p>
  </div>
</Card>
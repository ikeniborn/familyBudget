<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { isAuthenticated } from '$lib/stores/auth.store';
  import TelegramLoginButton from '$lib/components/auth/TelegramLoginButton.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  
  let returnUrl: string | null = null;
  
  onMount(() => {
    // Redirect if already authenticated
    if ($isAuthenticated) {
      goto('/dashboard');
      return;
    }
    
    // Get return URL from query parameters
    returnUrl = $page.url.searchParams.get('returnUrl');
  });
  
  // Watch for authentication changes
  $: if ($isAuthenticated && returnUrl) {
    goto(returnUrl);
  } else if ($isAuthenticated) {
    goto('/dashboard');
  }
</script>

<svelte:head>
  <title>Вход - Family Budget</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
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
        Войти в систему
      </h2>
      
      <p class="text-sm text-gray-600 text-center">
        Используйте Telegram для быстрого и безопасного входа
      </p>
      
      <div class="flex justify-center">
        <TelegramLoginButton
          botName="familybudget_test_bot"
          buttonSize="large"
          showAvatar={true}
        />
      </div>
    </div>
    
    <div class="text-xs text-gray-500 text-center">
      <p>
        Нажимая кнопку входа, вы соглашаетесь с использованием данных Telegram
        для аутентификации в системе Family Budget.
      </p>
    </div>
  </Card>
</div>
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { isAuthenticated } from '$lib/stores/auth.store';
  import { authService } from '$lib/services/auth.service';
  import TelegramLoginButton from '$lib/components/auth/TelegramLoginButton.svelte';
  import PasswordLogin from '$lib/components/auth/PasswordLogin.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  
  let returnUrl: string | null = null;
  let passwordAuthEnabled = false;
  let showPasswordLogin = false;
  let loading = false;
  
  onMount(async () => {
    // Redirect if already authenticated
    if ($isAuthenticated) {
      goto('/dashboard');
      return;
    }
    
    // Get return URL from query parameters
    returnUrl = $page.url.searchParams.get('returnUrl');
    
    // Check if password auth is enabled
    try {
      loading = true;
      const response = await authService.checkPasswordAuthEnabled();
      passwordAuthEnabled = response.enabled;
    } catch (error) {
      console.error('Error checking password auth:', error);
    } finally {
      loading = false;
    }
  });
  
  // Watch for authentication changes
  $: if ($isAuthenticated && returnUrl) {
    goto(returnUrl);
  } else if ($isAuthenticated) {
    goto('/dashboard');
  }
  
  function handleSwitchToTelegram() {
    showPasswordLogin = false;
  }
  
  function handleSwitchToPassword() {
    showPasswordLogin = true;
  }
</script>

<svelte:head>
  <title>Вход - Family Budget</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
  {#if showPasswordLogin}
    <PasswordLogin onSwitchToTelegram={handleSwitchToTelegram} />
  {:else}
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

        {#if passwordAuthEnabled && !loading}
          <div class="mt-6">
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300" />
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-white text-gray-500">Или</span>
              </div>
            </div>
            
            <div class="mt-6">
              <Button
                variant="outline"
                class="w-full"
                on:click={handleSwitchToPassword}
              >
                Войти с логином и паролем
              </Button>
            </div>
          </div>
        {/if}
      </div>
      
      <div class="text-xs text-gray-500 text-center">
        <p>
          Нажимая кнопку входа, вы соглашаетесь с использованием данных Telegram
          для аутентификации в системе Family Budget.
        </p>
      </div>
    </Card>
  {/if}
</div>
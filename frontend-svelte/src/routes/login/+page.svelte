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
  import FinancialIcon from '$lib/components/ui/FinancialIcon.svelte';
  
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

<div class="abstract-layout flex items-center justify-center p-4">
  <!-- Geometric Decorations -->
  <div class="geometric-decoration circle-1"></div>
  <div class="geometric-decoration circle-2"></div>
  <div class="geometric-decoration rectangle-1"></div>
  <div class="geometric-decoration triangle-1"></div>

  {#if showPasswordLogin}
    <PasswordLogin onSwitchToTelegram={handleSwitchToTelegram} />
  {:else}
    <div class="design-card elevated max-w-lg w-full">
      <div class="design-card-body space-y-8">
        <!-- Header with Financial Icons -->
        <div class="text-center space-y-6">
          <!-- Financial Icons Display -->
          <div class="flex justify-center space-x-6 mb-8">
            <FinancialIcon icon="$" variant="navy" size="lg" />
            <FinancialIcon icon="📊" variant="beige" size="lg" />
            <FinancialIcon icon="%" variant="steel" size="lg" />
          </div>
          
          <div>
            <h1 class="display-heading text-center">
              ДОМАШНИЙ<br>БУХГАЛТЕР
            </h1>
            <p class="subtitle text-center">
              Сохраняем и приумножаем вместе!
            </p>
          </div>
        </div>

        <!-- Login Section -->
        <div class="space-y-6">
          <div class="text-center space-y-2">
            <h2 class="text-xl font-semibold">
              Войти в систему
            </h2>
            <p class="text-muted-foreground">
              Используйте Telegram для быстрого и безопасного входа
            </p>
          </div>
          
          <div class="flex justify-center">
            <TelegramLoginButton
              botName="familybudget_test_bot"
              buttonSize="large"
              showAvatar={true}
            />
          </div>

          {#if passwordAuthEnabled && !loading}
            <div class="space-y-4">
              <div class="relative">
                <div class="absolute inset-0 flex items-center">
                  <div class="w-full border-t border-border"></div>
                </div>
                <div class="relative flex justify-center text-sm">
                  <span class="px-3 bg-card text-muted-foreground">Или</span>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="lg"
                class="w-full"
                on:click={handleSwitchToPassword}
              >
                Войти с логином и паролем
              </Button>
            </div>
          {/if}
        </div>
      </div>
      
      <div class="design-card-footer">
        <p class="text-xs text-muted-foreground text-center">
          Нажимая кнопку входа, вы соглашаетесь с использованием данных Telegram
          для аутентификации в системе Family Budget.
        </p>
      </div>
    </div>
  {/if}
</div>
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { isAuthenticated } from '$lib/stores/auth.store';
  import { authService } from '$lib/services/auth.service';
  import PasswordLogin from '$lib/components/auth/PasswordLogin.svelte';
  import AbstractGraphics from '$lib/components/auth/AbstractGraphics.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { getEffectiveBotName, shouldUseMockAuth } from '$lib/config/auth';
  import { browser } from '$app/environment';
  import { dev } from '$app/environment';
  
  let returnUrl: string | null = null;
  let passwordAuthEnabled = true; // Включена по умолчанию
  let showPasswordLogin = true;   // По умолчанию показывать логин/пароль
  let loading = false;
  
  let authCheckCompleted = false;
  
  onMount(async () => {
    console.log('[LOGIN] onMount started', { isAuthenticated: $isAuthenticated });
    
    // Only redirect if already authenticated and this is initial check
    if ($isAuthenticated && !authCheckCompleted) {
      console.log('[LOGIN] Already authenticated, redirecting to dashboard');
      goto('/dashboard');
      return;
    }
    
    // Get return URL from query parameters
    returnUrl = $page.url.searchParams.get('returnUrl');
    console.log('[LOGIN] Return URL:', returnUrl);
    
    // Check if password auth is enabled (опционально)
    try {
      loading = true;
      const response = await authService.checkPasswordAuthEnabled();
      passwordAuthEnabled = response.enabled;
      console.log('[LOGIN] Password auth enabled:', passwordAuthEnabled);
    } catch (error) {
      console.error('[LOGIN] Error checking password auth:', error);
      // Если проверка не удалась, оставляем включенной
      passwordAuthEnabled = true;
    } finally {
      loading = false;
      authCheckCompleted = true;
      console.log('[LOGIN] Mount completed', { loading, authCheckCompleted });
    }
  });
  
</script>

<svelte:head>
  <title>Вход - Family Budget</title>
</svelte:head>

<div class="login-page">
  <div class="login-container">
    <!-- Abstract Graphics Section -->
    <div class="graphics-section">
      <AbstractGraphics />
    </div>
    
    <!-- Main Login Content -->
    <div class="content-section">
      <!-- Header Section -->
      <div class="header-section">
        <h1 class="main-title">
          ДОМАШНИЙ<br />БУХГАЛТЕР
        </h1>
        <p class="subtitle">
          Сохраняем и приумножаем вместе!
        </p>
      </div>

      <!-- Auth Method Toggle -->
      <div class="auth-toggle">
        <div class="toggle-container">
          <button 
            class="toggle-button" 
            class:active={showPasswordLogin}
            onclick={() => showPasswordLogin = true}
          >
            Логин / Пароль
          </button>
          <button 
            class="toggle-button" 
            class:active={!showPasswordLogin}
            onclick={() => showPasswordLogin = false}
          >
            Telegram
          </button>
        </div>
      </div>

      <!-- Auth Forms Section -->
      <div class="auth-forms-section">
        {#if showPasswordLogin}
          <div class="password-login-wrapper">
            <PasswordLogin />
          </div>
        {:else}
          <!-- Telegram Login Button Section -->
          <div class="button-section">
            <Button
              variant="default"
              size="lg"
              class="login-button"
              disabled={loading}
              onclick={() => {
                console.log('[LOGIN] Кнопка входа нажата!');
                console.log('[LOGIN] State:', { browser, dev, loading, authCheckCompleted });
                console.log('[LOGIN] shouldUseMockAuth():', shouldUseMockAuth());
                
                if (loading || !authCheckCompleted) {
                  console.log('[LOGIN] Выход - приложение еще загружается');
                  return;
                }
                
                if ($isAuthenticated) {
                  console.log('[LOGIN] Выход - уже авторизован');
                  goto('/dashboard');
                  return;
                }
                
                console.log('[LOGIN] Запуск Telegram OAuth с botName:', getEffectiveBotName());
                console.log('[LOGIN] returnUrl:', returnUrl || undefined);
                
                // Start Telegram OAuth redirect flow
                authService.startTelegramOAuth(getEffectiveBotName(), returnUrl || undefined);
              }}
            >
              {loading ? 'Загрузка...' : (dev ? 'Войти (Тест)' : 'Войти')}
            </Button>
            
            <div class="telegram-info">
              <p class="telegram-description">
                Нажмите кнопку выше для входа через Telegram
              </p>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .login-container {
    width: 100%;
    max-width: 450px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .graphics-section {
    width: 100%;
    margin-bottom: 3rem;
  }

  .content-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2.5rem;
  }

  .header-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .main-title {
    font-size: 2.5rem;
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: #000000;
    margin: 0;
  }

  .subtitle {
    font-size: 1rem;
    color: #6b7280;
    font-weight: 400;
    margin: 0;
  }

  .auth-toggle {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .toggle-container {
    display: flex;
    background: #f3f4f6;
    border-radius: 0.75rem;
    padding: 0.25rem;
    gap: 0.25rem;
  }

  .toggle-button {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: none;
    background: transparent;
    color: #6b7280;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    white-space: nowrap;
  }

  .toggle-button.active {
    background: #1e3a5f;
    color: white;
    box-shadow: 0 2px 4px rgba(30, 58, 95, 0.1);
  }

  .toggle-button:hover:not(.active) {
    background: #e5e7eb;
    color: #374151;
  }

  .auth-forms-section {
    width: 100%;
  }

  .password-login-wrapper {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .button-section {
    width: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .telegram-info {
    text-align: center;
  }

  .telegram-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
    line-height: 1.4;
  }

  :global(.login-button) {
    width: 100%;
    background: #1e3a5f !important;
    border: none !important;
    border-radius: 0.75rem !important;
    padding: 1rem 2rem !important;
    font-size: 1.125rem !important;
    font-weight: 600 !important;
    color: white !important;
    transition: all 0.2s ease-in-out !important;
    box-shadow: 0 4px 12px rgba(30, 58, 95, 0.2) !important;
  }

  :global(.login-button:hover) {
    background: #2d4a6d !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 6px 20px rgba(30, 58, 95, 0.3) !important;
  }

  :global(.login-button:disabled) {
    background: #9ca3af !important;
    transform: none !important;
    box-shadow: none !important;
    cursor: not-allowed !important;
  }


  /* Mobile responsive adjustments */
  @media (max-width: 640px) {
    .login-page {
      padding: 1rem;
    }

    .login-container {
      max-width: 100%;
    }

    .graphics-section {
      margin-bottom: 2rem;
    }

    .content-section {
      gap: 3rem;
    }

    .main-title {
      font-size: 2rem;
    }

    .subtitle {
      font-size: 0.9375rem;
    }

    :global(.login-button) {
      padding: 0.875rem 1.5rem !important;
      font-size: 1rem !important;
    }
  }

  @media (max-width: 480px) {
    .graphics-section {
      margin-bottom: 1.5rem;
    }

    .content-section {
      gap: 2.5rem;
    }

    .main-title {
      font-size: 1.75rem;
    }

    .subtitle {
      font-size: 0.875rem;
    }
  }
</style>
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { isAuthenticated } from '$lib/stores/auth.store';
  import { authService } from '$lib/services/auth.service';
  import TelegramLoginButton from '$lib/components/auth/TelegramLoginButton.svelte';
  import PasswordLogin from '$lib/components/auth/PasswordLogin.svelte';
  import AbstractGraphics from '$lib/components/auth/AbstractGraphics.svelte';
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

<div class="login-page">
  {#if showPasswordLogin}
    <div class="password-login-container">
      <PasswordLogin onSwitchToTelegram={handleSwitchToTelegram} />
    </div>
  {:else}
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

        <!-- Login Button Section -->
        <div class="button-section">
          <Button
            variant="primary"
            size="lg"
            class="login-button"
            on:click={() => {
              // Handle login - for now just show Telegram login
              const telegramButton = document.querySelector('iframe[src*="telegram"]');
              if (telegramButton) {
                telegramButton.click();
              }
            }}
          >
            Войти
          </Button>
          
          <!-- Hidden Telegram button for functionality -->
          <div class="hidden-telegram">
            <TelegramLoginButton
              botName="familybudget_test_bot"
              buttonSize="large"
              showAvatar={false}
            />
          </div>
        </div>
      </div>
    </div>
  {/if}
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

  .password-login-container {
    width: 100%;
    max-width: 28rem;
  }

  .login-container {
    width: 100%;
    max-width: 400px;
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
    gap: 4rem;
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

  .button-section {
    width: 100%;
    position: relative;
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

  .hidden-telegram {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
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
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
      <AbstractGraphics />
      
      <!-- Main Login Content -->
      <div class="login-content">
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
        <div class="login-section">
          <div class="login-button-container">
            <TelegramLoginButton
              botName="familybudget_test_bot"
              buttonSize="large"
              showAvatar={true}
            />
          </div>

          {#if passwordAuthEnabled && !loading}
            <div class="alternative-login">
              <div class="divider">
                <div class="divider-line"></div>
                <span class="divider-text">Или</span>
                <div class="divider-line"></div>
              </div>
              
              <Button
                variant="outline"
                size="lg"
                class="alternative-button"
                on:click={handleSwitchToPassword}
              >
                Войти с логином и паролем
              </Button>
            </div>
          {/if}
        </div>

        <!-- Footer Notice -->
        <div class="footer-notice">
          <p>
            Нажимая кнопку входа, вы соглашаетесь с использованием данных Telegram
            для аутентификации в системе Family Budget.
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .login-page {
    min-height: 100vh;
    background: linear-gradient(135deg, hsl(0, 0%, 98%) 0%, hsl(0, 0%, 94%) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    position: relative;
    overflow: hidden;
  }

  .login-page::before {
    content: '';
    position: absolute;
    top: -10%;
    left: -10%;
    width: 120%;
    height: 120%;
    background: 
      radial-gradient(circle at 20% 30%, hsla(203, 46%, 66%, 0.08) 0%, transparent 50%),
      radial-gradient(circle at 80% 70%, hsla(40, 33%, 70%, 0.06) 0%, transparent 50%),
      radial-gradient(circle at 60% 20%, hsla(210, 69%, 25%, 0.04) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }

  .password-login-container {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 28rem;
  }

  .login-container {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 28rem;
    background: hsla(0, 0%, 100%, 0.95);
    border-radius: 1rem;
    padding: 2rem;
    box-shadow: 
      0 20px 60px rgba(30, 58, 95, 0.1),
      0 8px 25px rgba(30, 58, 95, 0.05);
    backdrop-filter: blur(10px);
    border: 1px solid hsla(205, 24%, 73%, 0.2);
  }

  .header-section {
    text-align: center;
    margin-bottom: 2rem;
  }

  .main-title {
    font-size: clamp(2.25rem, 6vw, 3rem);
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.025em;
    color: hsl(210, 69%, 25%);
    margin-bottom: 1rem;
    text-shadow: 0 2px 4px rgba(30, 58, 95, 0.1);
  }

  .subtitle {
    font-size: 1.125rem;
    color: hsl(205, 24%, 45%);
    font-weight: 500;
    margin-bottom: 0;
  }

  .login-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .login-button-container {
    display: flex;
    justify-content: center;
  }

  /* Custom styling for Telegram login button */
  :global(.telegram-login-button iframe) {
    border-radius: 0.75rem !important;
    box-shadow: 0 4px 20px rgba(30, 58, 95, 0.15) !important;
    transition: all 0.2s ease-in-out !important;
    border: none !important;
  }

  :global(.telegram-login-button iframe:hover) {
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 30px rgba(30, 58, 95, 0.2) !important;
  }

  .alternative-login {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background: hsl(205, 24%, 73%);
  }

  .divider-text {
    font-size: 0.875rem;
    color: hsl(205, 24%, 45%);
    padding: 0 0.5rem;
    background: hsl(0, 0%, 100%);
  }

  :global(.alternative-button) {
    width: 100%;
    border-color: hsl(205, 24%, 73%);
    color: hsl(210, 69%, 25%);
    background: hsl(0, 0%, 100%);
    transition: all 0.2s ease-in-out;
  }

  :global(.alternative-button:hover) {
    background: hsl(203, 46%, 96%);
    border-color: hsl(203, 46%, 66%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(30, 58, 95, 0.1);
  }

  .footer-notice {
    text-align: center;
    padding-top: 1.5rem;
    border-top: 1px solid hsl(205, 24%, 90%);
  }

  .footer-notice p {
    font-size: 0.75rem;
    color: hsl(205, 24%, 55%);
    line-height: 1.4;
    margin: 0;
  }

  /* Mobile responsive adjustments */
  @media (max-width: 640px) {
    .login-page {
      padding: 0.75rem;
    }

    .login-container {
      padding: 1.5rem;
      border-radius: 0.75rem;
    }

    .main-title {
      font-size: clamp(1.875rem, 8vw, 2.5rem);
    }

    .subtitle {
      font-size: 1rem;
    }

    .header-section {
      margin-bottom: 1.5rem;
    }

    .login-section {
      margin-bottom: 1.5rem;
    }
  }

  @media (max-width: 480px) {
    .main-title {
      font-size: clamp(1.625rem, 10vw, 2rem);
    }

    .subtitle {
      font-size: 0.9375rem;
    }

    .footer-notice p {
      font-size: 0.6875rem;
    }
  }

  /* Enhanced hover effects for the login container */
  .login-container {
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }

  .login-container:hover {
    transform: translateY(-2px);
    box-shadow: 
      0 25px 70px rgba(30, 58, 95, 0.12),
      0 10px 30px rgba(30, 58, 95, 0.08);
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .login-page {
      background: linear-gradient(135deg, hsl(210, 11%, 15%) 0%, hsl(210, 11%, 11%) 100%);
    }

    .login-container {
      background: hsla(210, 11%, 20%, 0.95);
      border-color: hsla(205, 24%, 73%, 0.1);
    }

    .main-title {
      color: hsl(203, 46%, 80%);
    }

    .subtitle {
      color: hsl(205, 24%, 65%);
    }

    .divider-line {
      background: hsl(205, 24%, 40%);
    }

    .divider-text {
      color: hsl(205, 24%, 65%);
      background: hsl(210, 11%, 20%);
    }

    .footer-notice {
      border-color: hsl(205, 24%, 30%);
    }

    .footer-notice p {
      color: hsl(205, 24%, 65%);
    }
  }
</style>
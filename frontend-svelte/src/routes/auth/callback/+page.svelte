<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authStore, isAuthenticated } from '$lib/stores/auth.store';
  import { parseTelegramAuthFromUrl, parseTelegramAuthFromQuery, isAuthDataExpired } from '$lib/utils/telegram-oauth';
  import { dev } from '$app/environment';
  import Button from '$lib/components/ui/Button.svelte';
  
  let loading = true;
  let error: string | null = null;
  let authData: any = null;
  let authProcessed = false; // Flag to prevent double processing

  onMount(async () => {
    console.log('[CALLBACK] onMount started', { 
      isAuthenticated: $isAuthenticated, 
      authProcessed,
      url: $page.url.href 
    });
    
    // Prevent double processing
    if (authProcessed) {
      console.log('[CALLBACK] Auth already processed, skipping');
      return;
    }
    
    // Check if already authenticated - but allow processing to complete
    if ($isAuthenticated) {
      console.log('[CALLBACK] Already authenticated, redirecting to dashboard');
      authProcessed = true;
      goto('/dashboard');
      return;
    }

    try {
      console.log('[CALLBACK] Parsing auth data from URL');
      // Try to parse auth data from URL (both hash and query parameters)
      authData = parseTelegramAuthFromUrl() || parseTelegramAuthFromQuery();
      console.log('[CALLBACK] Parsed auth data:', authData);
      
      if (!authData) {
        throw new Error('Отсутствуют данные авторизации Telegram');
      }

      // Check if auth data is expired
      if (isAuthDataExpired(authData.auth_date)) {
        throw new Error('Данные авторизации устарели. Пожалуйста, войдите снова.');
      }

      // Client-side validation (mainly for development)
      // Real validation should always happen on the server
      if (!dev) {
        // In production, we still do basic client validation
        // but the server will do the real validation with bot token
        console.log('[CALLBACK] Validating Telegram auth data...');
      }

      console.log('[CALLBACK] Logging in with Telegram OAuth');
      // Mark as processed before making the request to prevent race conditions
      authProcessed = true;
      
      // Attempt to log in using the auth data
      await authStore.loginWithTelegramOAuth(authData);
      console.log('[CALLBACK] Login successful');
      
      // Get return URL from state parameter or default to dashboard
      const returnUrl = $page.url.searchParams.get('state') || '/dashboard';
      console.log('[CALLBACK] Return URL:', returnUrl);
      
      // Clear the URL hash to remove auth data
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        console.log('[CALLBACK] Cleared URL hash');
      }
      
      // Small delay to ensure state is properly updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Redirect to intended destination
      console.log('[CALLBACK] Redirecting to:', returnUrl);
      goto(returnUrl);
      
    } catch (err: any) {
      console.error('[CALLBACK] OAuth callback error:', err);
      error = err.message || 'Ошибка при авторизации через Telegram';
      loading = false;
      authProcessed = false; // Reset flag on error to allow retry
    }
  });

  function handleRetryLogin() {
    console.log('[CALLBACK] Retry login clicked');
    authProcessed = false; // Reset processing flag
    error = null;
    goto('/login');
  }

  function handleManualLogin() {
    console.log('[CALLBACK] Manual login clicked');
    // Clear any existing auth state
    authStore.logout();
    authProcessed = false; // Reset processing flag
    goto('/login');
  }
</script>

<svelte:head>
  <title>Авторизация - Family Budget</title>
</svelte:head>

<div class="callback-page">
  <div class="callback-container">
    {#if loading}
      <!-- Loading State -->
      <div class="loading-section">
        <div class="loading-spinner"></div>
        <h2>Авторизация через Telegram</h2>
        <p class="loading-text">Подождите, идет обработка данных авторизации...</p>
        
        {#if authData && dev}
          <div class="debug-info">
            <details>
              <summary>Отладочная информация (только в разработке)</summary>
              <pre>{JSON.stringify(authData, null, 2)}</pre>
            </details>
          </div>
        {/if}
      </div>
    {:else if error}
      <!-- Error State -->
      <div class="error-section">
        <div class="error-icon">⚠️</div>
        <h2>Ошибка авторизации</h2>
        <p class="error-message">{error}</p>
        
        <div class="error-actions">
          <Button
            variant="default"
            size="lg"
            on:click={handleRetryLogin}
          >
            Попробовать снова
          </Button>
          
          <Button
            variant="secondary"
            size="lg"
            on:click={handleManualLogin}
          >
            Вернуться к входу
          </Button>
        </div>

        {#if dev}
          <div class="debug-info">
            <details>
              <summary>Техническая информация</summary>
              <div class="debug-content">
                <p><strong>URL:</strong> {$page.url.href}</p>
                <p><strong>Hash:</strong> {$page.url.hash}</p>
                <p><strong>Search params:</strong> {$page.url.search}</p>
                {#if authData}
                  <p><strong>Auth data:</strong></p>
                  <pre>{JSON.stringify(authData, null, 2)}</pre>
                {/if}
              </div>
            </details>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .callback-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .callback-container {
    width: 100%;
    max-width: 500px;
    background: white;
    border-radius: 1rem;
    padding: 3rem 2rem;
    text-align: center;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .loading-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .loading-spinner {
    width: 3rem;
    height: 3rem;
    border: 3px solid #f3f4f6;
    border-top: 3px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .loading-section h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #1f2937;
  }

  .loading-text {
    margin: 0;
    color: #6b7280;
    font-size: 1rem;
  }

  .error-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .error-icon {
    font-size: 3rem;
  }

  .error-section h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #dc2626;
  }

  .error-message {
    margin: 0;
    color: #374151;
    font-size: 1rem;
    line-height: 1.5;
  }

  .error-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    margin-top: 1rem;
  }

  .debug-info {
    margin-top: 2rem;
    text-align: left;
    font-size: 0.875rem;
  }

  .debug-info details {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .debug-info summary {
    cursor: pointer;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .debug-info pre {
    background: #1f2937;
    color: #f9fafb;
    padding: 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    overflow-x: auto;
    margin: 0;
  }

  .debug-content {
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
    color: #374151;
  }

  .debug-content p {
    margin: 0.25rem 0;
  }

  .debug-content strong {
    color: #1f2937;
  }

  /* Mobile responsive */
  @media (max-width: 640px) {
    .callback-container {
      padding: 2rem 1.5rem;
      margin: 1rem;
    }

    .loading-section h2,
    .error-section h2 {
      font-size: 1.25rem;
    }

    .error-actions {
      gap: 0.5rem;
    }

    .debug-info {
      font-size: 0.75rem;
    }
  }
</style>
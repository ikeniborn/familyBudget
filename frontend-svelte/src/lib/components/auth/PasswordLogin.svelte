<script lang="ts">
  import { goto } from '$app/navigation';
  import { setCurrentUser } from '$lib/stores/auth.store';
  import { useToast } from '$lib/stores/toast.store';
  import { authService } from '$lib/services/auth.service';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import type { User } from '$types';


  let username = '';
  let password = '';
  let confirmPassword = '';
  let firstName = '';
  let lastName = '';
  let error = '';
  let isLoading = false;
  let showRegister = false;
  
  const toast = useToast();

  async function handleLogin() {
    error = '';
    isLoading = true;

    try {
      const response = await authService.loginWithPassword(username, password);

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
        toast.success('Успешно', 'Вы вошли в систему');
        goto('/dashboard');
      } else {
        error = response.error || 'Ошибка входа';
      }
    } catch (err: any) {
      console.error('Password login error:', err);
      error = err.response?.data?.error || err.message || 'Ошибка входа. Попробуйте еще раз.';
    } finally {
      isLoading = false;
    }
  }
  
  async function handleRegister() {
    error = '';
    
    if (password !== confirmPassword) {
      error = 'Пароли не совпадают';
      return;
    }
    
    if (password.length < 6) {
      error = 'Пароль должен содержать минимум 6 символов';
      return;
    }
    
    isLoading = true;

    try {
      const response = await authService.register(username, password, firstName, lastName);

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
        toast.success('Успешно', 'Аккаунт создан и вы вошли в систему');
        goto('/dashboard');
      } else {
        error = response.error || 'Ошибка регистрации';
      }
    } catch (err: any) {
      console.error('Register error:', err);
      error = err.response?.data?.error || err.message || 'Ошибка регистрации. Попробуйте еще раз.';
    } finally {
      isLoading = false;
    }
  }
  
  function handleSubmit() {
    if (showRegister) {
      handleRegister();
    } else {
      handleLogin();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && username && password && !isLoading) {
      handleSubmit();
    }
  }
</script>

<div class="auth-card">
  <div class="auth-toggle-mini">
    <button 
      class="toggle-mini-button" 
      class:active={!showRegister}
      on:click={() => { showRegister = false; error = ''; }}
    >
      Вход
    </button>
    <button 
      class="toggle-mini-button" 
      class:active={showRegister}
      on:click={() => { showRegister = true; error = ''; }}
    >
      Регистрация
    </button>
  </div>

  <form on:submit|preventDefault={handleSubmit} class="auth-form">
    <div class="form-fields">
      {#if showRegister}
        <div class="form-group">
          <label for="firstName" class="form-label">
            Имя
          </label>
          <Input
            id="firstName"
            type="text"
            bind:value={firstName}
            placeholder="Введите имя"
            required
            disabled={isLoading}
            on:keydown={handleKeydown}
            class="form-input"
          />
        </div>
        
        <div class="form-group">
          <label for="lastName" class="form-label">
            Фамилия
          </label>
          <Input
            id="lastName"
            type="text"
            bind:value={lastName}
            placeholder="Введите фамилию"
            disabled={isLoading}
            on:keydown={handleKeydown}
            class="form-input"
          />
        </div>
      {/if}
      
      <div class="form-group">
        <label for="username" class="form-label">
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
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label for="password" class="form-label">
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
          class="form-input"
        />
      </div>
      
      {#if showRegister}
        <div class="form-group">
          <label for="confirmPassword" class="form-label">
            Подтверждение пароля
          </label>
          <Input
            id="confirmPassword"
            type="password"
            bind:value={confirmPassword}
            placeholder="Повторите пароль"
            required
            disabled={isLoading}
            on:keydown={handleKeydown}
            class="form-input"
          />
        </div>
      {/if}
    </div>

    {#if error}
      <div class="error-message">
        <div class="error-text">{error}</div>
      </div>
    {/if}

    <Button
      type="submit"
      disabled={!username || !password || (showRegister && (!confirmPassword)) || isLoading}
      class="auth-submit-button"
    >
      {#if isLoading}
        {showRegister ? 'Создание...' : 'Вход...'}
      {:else}
        {showRegister ? 'Создать аккаунт' : 'Войти'}
      {/if}
    </Button>
  </form>
</div>

<style>
  .auth-card {
    width: 100%;
    max-width: 400px;
    background: white;
    padding: 2rem;
    border-radius: 1rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .auth-toggle-mini {
    display: flex;
    background: #f3f4f6;
    border-radius: 0.5rem;
    padding: 0.25rem;
    gap: 0.25rem;
  }

  .toggle-mini-button {
    flex: 1;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    border: none;
    background: transparent;
    color: #6b7280;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
  }

  .toggle-mini-button.active {
    background: #1e3a5f;
    color: white;
    box-shadow: 0 1px 2px rgba(30, 58, 95, 0.1);
  }

  .toggle-mini-button:hover:not(.active) {
    background: #e5e7eb;
    color: #374151;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-fields {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  :global(.form-input) {
    width: 100% !important;
    padding: 0.75rem !important;
    border: 1px solid #d1d5db !important;
    border-radius: 0.5rem !important;
    font-size: 0.875rem !important;
    transition: all 0.2s ease-in-out !important;
  }

  :global(.form-input:focus) {
    outline: none !important;
    border-color: #1e3a5f !important;
    box-shadow: 0 0 0 3px rgba(30, 58, 95, 0.1) !important;
  }

  .error-message {
    padding: 0.75rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.5rem;
  }

  .error-text {
    font-size: 0.875rem;
    color: #dc2626;
    text-align: center;
  }

  :global(.auth-submit-button) {
    width: 100% !important;
    background: #1e3a5f !important;
    border: none !important;
    border-radius: 0.5rem !important;
    padding: 0.875rem 1.5rem !important;
    font-size: 1rem !important;
    font-weight: 600 !important;
    color: white !important;
    transition: all 0.2s ease-in-out !important;
    box-shadow: 0 2px 4px rgba(30, 58, 95, 0.2) !important;
  }

  :global(.auth-submit-button:hover:not([disabled])) {
    background: #2d4a6d !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 8px rgba(30, 58, 95, 0.3) !important;
  }

  :global(.auth-submit-button[disabled]) {
    background: #9ca3af !important;
    transform: none !important;
    box-shadow: none !important;
    cursor: not-allowed !important;
  }

  /* Mobile responsive adjustments */
  @media (max-width: 640px) {
    .auth-card {
      padding: 1.5rem;
    }

    :global(.form-input) {
      padding: 0.625rem !important;
      font-size: 0.8125rem !important;
    }

    :global(.auth-submit-button) {
      padding: 0.75rem 1.25rem !important;
      font-size: 0.9375rem !important;
    }
  }
</style>
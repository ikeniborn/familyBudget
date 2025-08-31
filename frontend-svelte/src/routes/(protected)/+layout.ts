import { browser } from '$app/environment';
import { authStore } from '$lib/stores/auth.store';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent, data }) => {
  // Загружаем данные родителя и серверные данные
  await parent();
  
  // Если есть данные пользователя с сервера, обновляем store
  if (data?.user && browser) {
    authStore.setUser({
      user_id: data.user.id || data.user.user_id,
      user_name: data.user.user_name || data.user.username || '',
      user_telegram_id: data.user.telegram_id || 0,
      first_name: data.user.first_name || '',
      last_name: data.user.last_name || '',
      username: data.user.username || '',
      authMethod: 'password'
    });
  }
  
  return {
    // Возвращаем флаг, что мы на клиенте и статус аутентификации с сервера
    isClient: browser,
    authenticated: data?.authenticated || false,
    user: data?.user || null
  };
};

// Включаем SSR для корректной проверки авторизации на сервере
export const ssr = true;
export const prerender = false;
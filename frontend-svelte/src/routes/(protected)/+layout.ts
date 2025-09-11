import { browser } from '$app/environment';
import { authStore } from '$lib/stores/auth.store';
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { get } from 'svelte/store';

export const load: LayoutLoad = async ({ parent, data }) => {
  // Загружаем данные родителя и серверные данные
  await parent();
  
  // Client-side authentication check
  if (browser) {
    // Get current auth state
    const authState = get(authStore);
    
    // If not authenticated at all, redirect immediately
    if (!authState.isAuthenticated && !authState.isLoading) {
      throw redirect(302, '/login');
    }
    
    // If we have a user but session not validated yet, validate it
    if (authState.user && !authState.sessionValidated) {
      try {
        const isValid = await authStore.validateSession();
        if (!isValid) {
          // Session invalid, auth store will clear state
          throw redirect(302, '/login');
        }
      } catch (error) {
        console.error('Session validation failed:', error);
        authStore.clearAuth();
        throw redirect(302, '/login');
      }
    }
    
    // If there's server user data, update the store (SSR hydration)
    if (data?.user) {
      // Create proper AuthUser object with all required fields
      const userData = {
        // Required fields for AuthUser interface
        id: data.user.id || data.user.user_id, // Primary key (required)
        role: (data.user.role as 'admin' | 'user') || 'user', // Role (required)
        
        // User interface fields
        user_name: data.user.user_name || data.user.username || 'User',
        user_email: data.user.user_email || data.user.email || null,
        username: data.user.username || null,
        telegram_id: data.user.telegram_id ? String(data.user.telegram_id) : null,
        auth_method: data.user.auth_method || 'password',
        is_active: data.user.is_active !== undefined ? data.user.is_active : true,
        created_at: data.user.created_at || null,
        updated_at: data.user.updated_at || null,
        
        // AuthUser-specific fields
        user_id: data.user.id || data.user.user_id, // Compatibility field
        authMethod: 'password' as const
      };

      // Validate required fields before setting user
      if (!userData.id) {
        console.error('🚨 Protected layout: User data missing required id field:', data.user);
        throw redirect(302, '/login');
      }
      
      if (!userData.role) {
        console.warn('⚠️ Protected layout: User data missing role, defaulting to "user"');
        userData.role = 'user';
      }

      console.log('🔧 Protected layout: Setting user with role:', userData.role);
      try {
        authStore.setUser(userData);
        console.log('✅ Protected layout: User set successfully');
      } catch (error) {
        console.error('🚨 Protected layout: Error setting user:', error);
        console.error('🚨 Protected layout: Failed userData:', userData);
        // Don't throw error to avoid breaking the layout
      }
    }
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
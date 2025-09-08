import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';
import type { User, AuthResponse, AuthMeResponse } from '$types';
import { authService } from '$lib/services/auth.service';
import api from '$lib/services/api';
import type { TelegramAuthData } from '$lib/utils/telegram-oauth';

interface AuthUser extends User {
  authMethod?: 'telegram' | 'password';
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Persistent storage helpers
function getStoredAuth(): AuthState | null {
  if (!browser) return null;
  try {
    const stored = localStorage.getItem('auth-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        user: parsed.state?.user || null,
        isAuthenticated: parsed.state?.isAuthenticated || false,
        isLoading: false,
        error: null
      };
    }
  } catch (error) {
    console.error('Failed to parse stored auth:', error);
  }
  return null;
}

function storeAuth(state: AuthState) {
  if (!browser) return;
  try {
    const toStore = {
      state: {
        user: state.user,
        isAuthenticated: state.isAuthenticated
      },
      version: 0
    };
    localStorage.setItem('auth-storage', JSON.stringify(toStore));
  } catch (error) {
    console.error('Failed to store auth:', error);
  }
}

function getInitialState(): AuthState {
  const storedState = getStoredAuth();
  return storedState || {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null
  };
}

// Create the main writable store
const { subscribe, set, update } = writable<AuthState>(getInitialState());

// Auto-save to localStorage when state changes
let initialized = false;
subscribe((state) => {
  if (initialized) {
    storeAuth(state);
  } else {
    initialized = true;
  }
});

// Authentication methods
const authStore = {
  subscribe,
  
  // Get current user
  getUser(): AuthUser | null {
    let currentUser: AuthUser | null = null;
    const unsubscribe = subscribe(state => {
      currentUser = state.user;
    });
    unsubscribe();
    return currentUser;
  },
  
  // Authentication methods
  async login(telegramData: any): Promise<void> {
    update(state => ({ ...state, isLoading: true, error: null }));
    try {
      const response = await api.post<AuthResponse>('/auth/telegram', telegramData);
      
      if (response.success && response.user) {
        update(state => ({
          ...state,
          user: { ...response.user, authMethod: 'telegram' as const },
          isAuthenticated: true,
          isLoading: false,
          error: null
        }));
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      update(state => ({
        ...state,
        isLoading: false,
        error: errorMessage,
        isAuthenticated: false
      }));
      throw error;
    }
  },

  async loginWithTelegramOAuth(authData: TelegramAuthData): Promise<void> {
    update(state => ({ ...state, isLoading: true, error: null }));
    try {
      const response = await authService.loginWithTelegramOAuth(authData);
      update(state => ({
        ...state,
        user: { ...response.user, authMethod: 'telegram' as const },
        isAuthenticated: true,
        isLoading: false,
        error: null
      }));
    } catch (error: any) {
      const errorMessage = error.message || 'OAuth login failed';
      update(state => ({
        ...state,
        isLoading: false,
        error: errorMessage,
        isAuthenticated: false
      }));
      throw error;
    }
  },

  async logout(): Promise<void> {
    update(state => ({ ...state, isLoading: true }));
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear local state
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    }
  },

  async checkAuth(): Promise<void> {
    update(state => ({ ...state, isLoading: true }));
    try {
      const response = await api.get<AuthMeResponse>('/auth/me');
      if (response.success && response.user) {
        update(state => ({
          ...state,
          user: response.user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        }));
      } else {
        update(state => ({
          ...state,
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        }));
      }
    } catch (error: any) {
      // 401 errors are expected when user is not authenticated - don't log or show errors
      if (error?.response?.status !== 401) {
        console.warn('Unexpected error during auth check:', error);
      }
      
      update(state => ({
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      }));
    }
  },

  setUser(user: AuthUser): void {
    update(state => ({
      ...state,
      user,
      isAuthenticated: true,
      isLoading: false,
      error: null
    }));
  },

  clearError(): void {
    update(state => ({ ...state, error: null }));
  }
};

// Export individual derived stores for convenience
export const currentUser = derived(authStore, ($auth) => $auth.user);
export const isAuthenticated = derived(authStore, ($auth) => $auth.isAuthenticated);
export const isAuthLoading = derived(authStore, ($auth) => $auth.isLoading);
export const authError = derived(authStore, ($auth) => $auth.error);
export const isAdmin = derived(authStore, ($auth) => $auth.user?.id === 1);

// Export alias for compatibility  
export const setCurrentUser = (user: AuthUser) => authStore.setUser(user);

// Additional helper functions for components
export function useAuth() {
  let currentState: AuthState;
  const unsubscribe = authStore.subscribe(state => {
    currentState = state;
  });
  
  return {
    get user() { return currentState.user; },
    get isAuthenticated() { return currentState.isAuthenticated; },
    get isLoading() { return currentState.isLoading; },
    get error() { return currentState.error; },
    login: (telegramData: any) => authStore.login(telegramData),
    loginWithTelegramOAuth: (authData: TelegramAuthData) => authStore.loginWithTelegramOAuth(authData),
    logout: () => authStore.logout(),
    checkAuth: () => authStore.checkAuth(),
    setUser: (user: AuthUser) => authStore.setUser(user),
    clearError: () => authStore.clearError(),
    destroy: () => unsubscribe()
  };
}

// Legacy exports for backward compatibility with existing components
export { authStore as default };

// Export the store instance with legacy methods for gradual migration
export const authStoreCompat = {
  subscribe: authStore.subscribe,
  login: authStore.login,
  loginWithTelegramOAuth: authStore.loginWithTelegramOAuth,
  logout: authStore.logout,
  checkAuth: authStore.checkAuth,
  setUser: authStore.setUser,
  clearError: authStore.clearError
};

export { authStore };
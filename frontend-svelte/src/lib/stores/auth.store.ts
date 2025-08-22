import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { User } from '$types';
import { authService } from '$services/auth.service';
import api from '$services/api';
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

function createAuthStore() {
  const storedState = getStoredAuth();
  const initialState: AuthState = storedState || {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null
  };

  const { subscribe, set, update } = writable<AuthState>(initialState);

  // Store changes to localStorage
  let currentState = initialState;
  subscribe(state => {
    currentState = state;
    storeAuth(state);
  });

  return {
    subscribe,
    
    async login(telegramData: any): Promise<void> {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const response = await api.post('/auth/telegram', telegramData);
        const data = response.data;
        
        if (data.success && data.user) {
          const newState: AuthState = {
            user: { ...data.user, authMethod: 'telegram' as const },
            isAuthenticated: true,
            isLoading: false,
            error: null
          };
          set(newState);
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
        const newState: AuthState = {
          user: { ...response.user, authMethod: 'telegram' as const },
          isAuthenticated: true,
          isLoading: false,
          error: null
        };
        set(newState);
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
        const newState: AuthState = {
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        };
        set(newState);
      }
    },

    async checkAuth(): Promise<void> {
      update(state => ({ ...state, isLoading: true }));
      try {
        const response = await api.get('/auth/me');
        if (response.data && response.data.user) {
          const newState: AuthState = {
            user: response.data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null
          };
          set(newState);
        } else {
          const newState: AuthState = {
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null
          };
          set(newState);
        }
      } catch (error) {
        const newState: AuthState = {
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        };
        set(newState);
      }
    },

    setUser(user: AuthUser): void {
      const newState: AuthState = {
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      };
      set(newState);
    },

    clearError(): void {
      update(state => ({ ...state, error: null }));
    }
  };
}

export const authStore = createAuthStore();

// Derived stores for easy access
export const currentUser = derived(
  authStore,
  $authStore => $authStore.user
);

export const isAuthenticated = derived(
  authStore,
  $authStore => $authStore.isAuthenticated
);

export const isAuthLoading = derived(
  authStore,
  $authStore => $authStore.isLoading
);

export const authError = derived(
  authStore,
  $authStore => $authStore.error
);

// Export alias for compatibility  
export const setCurrentUser = authStore.setUser;
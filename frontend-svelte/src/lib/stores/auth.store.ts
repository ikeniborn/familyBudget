import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';
import type { User, AuthResponse, AuthMeResponse } from '$types';
import { authService } from '$lib/services/auth.service';
import api from '$lib/services/api';
import type { TelegramAuthData } from '$lib/utils/telegram-oauth';

interface AuthUser extends User {
  user_id?: number; // Add user_id for compatibility with services
  authMethod?: 'telegram' | 'password';
  role: 'admin' | 'user'; // Make role required to ensure it's always present
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
      const user = parsed.state?.user || null;
      
      // Validate that the user object has the required fields
      if (user && (!user.id || !user.role)) {
        console.warn('🚨 Stored user data is incomplete, clearing cache:', user);
        console.warn('🚨 Missing fields - id:', !user.id, 'role:', !user.role);
        console.warn('🚨 User object keys:', Object.keys(user || {}));
        localStorage.removeItem('auth-storage');
        return null;
      }
      
      // Critical fix: Ensure role is properly typed with strong validation
      if (user && typeof user.role === 'string') {
        // Use the same strict role validation as checkAuth
        let validRole: 'admin' | 'user';
        
        if (user.role === 'admin') {
          validRole = 'admin' as const;
        } else if (user.role === 'user') {
          validRole = 'user' as const;
        } else if (user.role.toLowerCase() === 'admin') {
          validRole = 'admin' as const;
        } else {
          console.warn('🚨 Invalid role value:', user.role, 'setting to "user"');
          validRole = 'user' as const;
        }
        
        // Force the role to be the validated value
        user.role = validRole;
        console.log('✅ Restored user from localStorage with validated role:', user.role);
        console.log('✅ Role type:', typeof user.role);
      } else if (user) {
        // If role is missing, set default
        console.warn('🚨 User missing role, setting default "user"');
        user.role = 'user' as const;
      }
      
      return {
        user,
        isAuthenticated: parsed.state?.isAuthenticated || false,
        isLoading: false,
        error: null
      };
    }
  } catch (error) {
    console.error('Failed to parse stored auth:', error);
    localStorage.removeItem('auth-storage');
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
    
    // Debug logging for role preservation
    if (state.user?.role) {
      console.log('💾 Storing user with role:', state.user.role);
    }
    
    localStorage.setItem('auth-storage', JSON.stringify(toStore));
    
    // Verify storage worked
    const stored = localStorage.getItem('auth-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log('💾 Verification - stored role:', parsed.state?.user?.role);
    }
  } catch (error) {
    console.error('Failed to store auth:', error);
  }
}

function getInitialState(): AuthState {
  const storedState = getStoredAuth();
  console.log('🔄 Auth store initial state from localStorage:', storedState);
  
  const initialState = storedState || {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null
  };
  
  if (initialState.user) {
    console.log('👤 Initial user from localStorage:', initialState.user);
    console.log('🔑 Initial user role:', initialState.user.role);
  }
  
  return initialState;
}

// Create the main writable store with enhanced update protection
const { subscribe, set, update: originalUpdate } = writable<AuthState>(getInitialState());

// Enhanced update function that protects role field
const update = (updater: (current: AuthState) => AuthState) => {
  originalUpdate((currentState) => {
    const newState = updater(currentState);
    
    // Critical protection: Ensure role is never lost during updates
    if (newState.user && currentState.user && currentState.user.role && !newState.user.role) {
      console.warn('🛡️ ROLE PROTECTION: Preserving role from previous state');
      newState.user.role = currentState.user.role;
    }
    
    // Validate final state
    if (newState.user && !newState.user.role) {
      console.error('🚨 CRITICAL: Role is still undefined after protection!');
      if (currentState.user?.role) {
        console.log('🔧 EMERGENCY FIX: Restoring role from current state');
        newState.user.role = currentState.user.role;
      } else {
        console.log('🔧 EMERGENCY FIX: Setting default user role');
        newState.user.role = 'user' as const;
      }
    }
    
    return newState;
  });
};

// Auto-save to localStorage when state changes
let initialized = false;
subscribe((state) => {
  if (initialized) {
    // Critical fix: Ensure role is preserved before storing
    if (state.user && !state.user.role) {
      console.error('🚨 CRITICAL: Role is undefined before storage!', state.user);
      // Don't store corrupted data
      return;
    }
    storeAuth(state);
    
    // Verify storage worked
    if (state.user) {
      console.log('💾 Auto-saved user with role:', state.user.role);
    }
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
        // Use consistent role validation logic
        let userRole: 'admin' | 'user';
        
        if (response.user.role === 'admin') {
          userRole = 'admin' as const;
        } else if (response.user.role === 'user') {
          userRole = 'user' as const;
        } else if (typeof response.user.role === 'string' && response.user.role.toLowerCase() === 'admin') {
          userRole = 'admin' as const;
        } else {
          userRole = 'user' as const; // safe default
        }

        const userData: AuthUser = { 
          ...response.user, 
          role: userRole,
          authMethod: 'telegram' as const 
        };

        console.log('📱 Telegram login - original role:', response.user.role);
        console.log('📱 Telegram login - processed role:', userRole);
        console.log('📱 Telegram login - normalized userData:', userData);

        update(state => ({
          ...state,
          user: userData,
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
      
      // Use consistent role validation logic
      let userRole: 'admin' | 'user';
      
      if (response.user.role === 'admin') {
        userRole = 'admin' as const;
      } else if (response.user.role === 'user') {
        userRole = 'user' as const;
      } else if (typeof response.user.role === 'string' && response.user.role.toLowerCase() === 'admin') {
        userRole = 'admin' as const;
      } else {
        userRole = 'user' as const; // safe default
      }

      const userData: AuthUser = { 
        ...response.user, 
        role: userRole,
        authMethod: 'telegram' as const 
      };

      console.log('📱 Telegram OAuth - original role:', response.user.role);
      console.log('📱 Telegram OAuth - processed role:', userRole);
      console.log('📱 Telegram OAuth - normalized userData:', userData);

      update(state => ({
        ...state,
        user: userData,
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

  async loginWithPassword(username: string, password: string): Promise<void> {
    update(state => ({ ...state, isLoading: true, error: null }));
    try {
      const response = await authService.loginWithPassword(username, password);
      
      if (response.success && response.user) {
        // Use consistent role validation logic
        let userRole: 'admin' | 'user';
        
        if (response.user.role === 'admin') {
          userRole = 'admin' as const;
        } else if (response.user.role === 'user') {
          userRole = 'user' as const;
        } else if (typeof response.user.role === 'string' && response.user.role.toLowerCase() === 'admin') {
          userRole = 'admin' as const;
        } else {
          userRole = 'user' as const; // safe default
        }
        
        // Transform auth service response to User type
        // CRITICAL: Ensure all required fields are present
        const userData: AuthUser = {
          id: response.user.id || response.user.user_id,
          user_id: response.user.id || response.user.user_id, // Add user_id for compatibility
          user_name: response.user.user_name || [response.user.firstName, response.user.lastName].filter(Boolean).join(' ') || response.user.username || 'User',
          user_email: response.user.user_email || response.user.email || null,
          username: response.user.username || response.user.user_login,
          telegram_id: response.user.telegram_id || null,
          auth_method: 'password',
          role: userRole, // Use validated role - CRITICAL FIELD
          is_active: response.user.is_active !== undefined ? response.user.is_active : true,
          authMethod: 'password' as const
        };
        
        console.log('🔐 Password login - original role:', response.user.role);
        console.log('🔐 Password login - processed role:', userRole);
        console.log('🔐 Password login - normalized userData:', userData);
        
        // CRITICAL: Validate userData before setting
        if (!userData.id) {
          console.error('❌ Password login - userData missing id!', userData);
          throw new Error('User data is incomplete - missing id');
        }
        
        if (!userData.role) {
          console.error('❌ Password login - userData missing role!', userData);
          userData.role = 'user'; // Emergency fallback
        }
        
        update(state => ({
          ...state,
          user: userData,
          isAuthenticated: true,
          isLoading: false,
          error: null
        }));
      } else {
        throw new Error(response.error || 'Password login failed');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Password login failed';
      update(state => ({
        ...state,
        isLoading: false,
        error: errorMessage,
        isAuthenticated: false
      }));
      throw error;
    }
  },

  async register(username: string, password: string, firstName?: string, lastName?: string): Promise<void> {
    update(state => ({ ...state, isLoading: true, error: null }));
    try {
      const response = await authService.register(username, password, firstName, lastName);
      
      if (response.success && response.user) {
        // Use consistent role validation logic
        let userRole: 'admin' | 'user';
        
        if (response.user.role === 'admin') {
          userRole = 'admin' as const;
        } else if (response.user.role === 'user') {
          userRole = 'user' as const;
        } else if (typeof response.user.role === 'string' && response.user.role.toLowerCase() === 'admin') {
          userRole = 'admin' as const;
        } else {
          userRole = 'user' as const; // safe default
        }
        
        // Transform auth service response to User type
        // CRITICAL: Ensure all required fields are present
        const userData: AuthUser = {
          id: response.user.id,
          user_id: response.user.id, // Add user_id for compatibility
          user_name: [response.user.firstName, response.user.lastName].filter(Boolean).join(' ').trim() || response.user.username || 'User',
          user_email: null,
          username: response.user.username,
          telegram_id: null,
          auth_method: 'password',
          role: userRole, // Use validated role - CRITICAL FIELD
          is_active: true,
          authMethod: 'password' as const
        };
        
        console.log('📝 Registration - original role:', response.user.role);
        console.log('📝 Registration - processed role:', userRole);
        console.log('📝 Registration - normalized userData:', userData);
        
        // CRITICAL: Validate userData before setting
        if (!userData.id) {
          console.error('❌ Registration - userData missing id!', userData);
          throw new Error('User data is incomplete - missing id');
        }
        
        if (!userData.role) {
          console.error('❌ Registration - userData missing role!', userData);
          userData.role = 'user'; // Emergency fallback
        }
        
        update(state => ({
          ...state,
          user: userData,
          isAuthenticated: true,
          isLoading: false,
          error: null
        }));
      } else {
        throw new Error(response.error || 'Registration failed');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed';
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
      const response = await api.get<{success: boolean, user: User, authenticated: boolean}>('/auth/me');
      
      console.log('🔍 Auth check response:', response);
      console.log('🔍 Full response structure:', JSON.stringify(response, null, 2));
      
      // Handle different response formats
      let userData: User | null = null;
      if (response.success && response.user) {
        userData = response.user;
        console.log('📝 Using response.user:', userData);
      } else if (response.user) {
        userData = response.user;
        console.log('📝 Using response.user (no success flag):', userData);
      } else if (response.authenticated && (response as any).id) {
        // Handle case where user data is directly in response
        userData = response as any;
        console.log('📝 Using response directly:', userData);
      }
      
      if (userData) {
        console.log('🔍 Raw userData before normalization:', JSON.stringify(userData, null, 2));
        console.log('🔑 Raw userData.role value:', userData.role);
        console.log('🔑 Raw userData.role type:', typeof userData.role);
        
        // Critical fix: Ensure role is properly preserved as string literal type
        // Use explicit type assertion to ensure TypeScript treats this as literal type
        let userRole: 'admin' | 'user';
        
        // Direct assignment with strict validation - no conditional logic that might lose the type
        if (userData.role === 'admin') {
          userRole = 'admin' as const;
        } else if (userData.role === 'user') {
          userRole = 'user' as const;
        } else if (typeof userData.role === 'string' && userData.role.toLowerCase() === 'admin') {
          userRole = 'admin' as const;
        } else {
          userRole = 'user' as const; // safe default
        }
        
        console.log('🔄 Processed role:', userRole);
        console.log('🔄 Role type after processing:', typeof userRole);
        
        // Create the normalized user with explicit role assignment
        const normalizedUser: AuthUser = {
          id: userData.id,
          user_id: userData.id,
          user_name: userData.user_name,
          user_email: userData.user_email,
          username: userData.username,
          telegram_id: userData.telegram_id,
          auth_method: userData.auth_method,
          is_active: userData.is_active ?? true,
          created_at: userData.created_at,
          updated_at: userData.updated_at,
          // CRITICAL: Assign role last to ensure it's not overwritten
          role: userRole
        };
        
        // Additional validation - ensure role is preserved
        if (normalizedUser.role !== userRole) {
          console.error('❌ Role was not preserved during object creation!');
          normalizedUser.role = userRole; // Force assignment
        }
        
        console.log('✅ Final normalized user data:', JSON.stringify(normalizedUser, null, 2));
        console.log('🔑 Final user role:', normalizedUser.role);
        console.log('🔑 Final role type:', typeof normalizedUser.role);
        console.log('🔍 Admin check:', normalizedUser.role === 'admin');
        
        // Update store with the properly typed user
        update(state => {
          const newState = {
            ...state,
            user: normalizedUser,
            isAuthenticated: true,
            isLoading: false,
            error: null
          };
          
          // Verify role is preserved in the state update
          console.log('📦 State being set - user role:', newState.user?.role);
          return newState;
        });
        
        // Verify the store update worked - shorter timeout for faster feedback
        setTimeout(() => {
          let currentState: any;
          const unsubscribe = subscribe(state => {
            currentState = state;
          });
          unsubscribe();
          
          console.log('🔄 Final store state after update:');
          console.log('  - user exists:', !!currentState.user);
          console.log('  - user role:', currentState.user?.role);
          console.log('  - isAuthenticated:', currentState.isAuthenticated);
          console.log('  - isAdmin would be:', currentState.user?.role === 'admin');
        }, 10);
        
      } else {
        console.log('❌ No user data in auth response');
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
    // Validate user has required fields before setting
    if (!user.id || !user.role) {
      console.error('🚨 setUser: Invalid user data - missing id or role:', user);
      return;
    }
    
    console.log('🔧 setUser called with role:', user.role);
    
    update(state => {
      const newState = {
        ...state,
        user: {
          ...user,
          role: user.role // Explicitly preserve role
        },
        isAuthenticated: true,
        isLoading: false,
        error: null
      };
      
      console.log('🔧 setUser - new state user role:', newState.user.role);
      return newState;
    });
  },

  clearError(): void {
    update(state => ({ ...state, error: null }));
  },

  // Debug helper to clear localStorage and refresh auth
  async debugRefreshAuth(): Promise<void> {
    console.log('🔧 DEBUG: Clearing localStorage and refreshing auth');
    if (browser) {
      localStorage.removeItem('auth-storage');
    }
    await this.checkAuth();
  },

  // Debug helper to get current state
  getDebugState(): AuthState {
    let currentState: AuthState;
    const unsubscribe = subscribe(state => {
      currentState = state;
    });
    unsubscribe();
    return currentState!;
  }
};

// Export individual derived stores for convenience
export const currentUser = derived(authStore, ($auth) => $auth.user);
export const isAuthenticated = derived(authStore, ($auth) => $auth.isAuthenticated);
export const isAuthLoading = derived(authStore, ($auth) => $auth.isLoading);
export const authError = derived(authStore, ($auth) => $auth.error);
export const isAdmin = derived(authStore, ($auth) => {
  const user = $auth.user;
  const role = user?.role;
  const isAdminResult = role === 'admin';
  
  // Enhanced debug logging
  console.log('🔍 isAdmin derived check:', {
    userExists: !!user,
    userId: user?.id,
    role: role,
    roleType: typeof role,
    isAuthenticated: $auth.isAuthenticated,
    isAdminResult: isAdminResult
  });
  
  // Additional validation
  if (user && !role) {
    console.warn('⚠️ User exists but role is missing:', user);
  }
  
  return isAdminResult;
});

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
    loginWithPassword: (username: string, password: string) => authStore.loginWithPassword(username, password),
    register: (username: string, password: string, firstName?: string, lastName?: string) => authStore.register(username, password, firstName, lastName),
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
  loginWithPassword: authStore.loginWithPassword,
  register: authStore.register,
  logout: authStore.logout,
  checkAuth: authStore.checkAuth,
  setUser: authStore.setUser,
  clearError: authStore.clearError
};

export { authStore };
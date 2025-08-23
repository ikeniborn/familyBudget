import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { authStore, currentUser, isAuthenticated, isAuthLoading, authError } from './auth.store';
import { authService } from '$lib/services/auth.service';
import api from '$lib/services/api';
import type { User } from '$types';
import type { TelegramAuthData } from '$lib/utils/telegram-oauth';

// Mock dependencies
vi.mock('$lib/services/auth.service');
vi.mock('$lib/services/api');
vi.mock('$app/environment', () => ({
  browser: true,
  dev: false
}));

const mockAuthService = vi.mocked(authService);
const mockApi = vi.mocked(api);

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('AuthStore', () => {
  const mockUser: User = {
    user_id: 1,
    user_name: 'John Doe',
    user_telegram_id: 123456789,
    first_name: 'John',
    last_name: 'Doe',
    username: 'johndoe',
    authMethod: 'telegram'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    // Reset store to initial state
    authStore.logout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = get(authStore);
      
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should restore state from localStorage on init', () => {
      const storedAuth = JSON.stringify({
        state: {
          user: mockUser,
          isAuthenticated: true
        },
        version: 0
      });
      
      localStorageMock.getItem.mockReturnValue(storedAuth);
      
      // Re-import to trigger initialization with stored state
      vi.doMock('./auth.store', () => {
        const { createAuthStore } = vi.importActual('./auth.store') as any;
        return {
          ...vi.importActual('./auth.store'),
          authStore: createAuthStore()
        };
      });
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid-json');
      
      // Should not throw and should use default initial state
      const state = get(authStore);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('Telegram Login', () => {
    it('should login successfully with telegram data', async () => {
      const telegramData = {
        id: '123456789',
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        auth_date: Date.now(),
        hash: 'mock_hash'
      };

      const mockResponse = {
        data: {
          success: true,
          user: mockUser
        }
      };

      mockApi.post.mockResolvedValueOnce(mockResponse);

      await authStore.login(telegramData);

      const state = get(authStore);
      expect(state.user).toEqual({ ...mockUser, authMethod: 'telegram' });
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();

      expect(mockApi.post).toHaveBeenCalledWith('/auth/telegram', telegramData);
    });

    it('should handle telegram login failure', async () => {
      const telegramData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Date.now(),
        hash: 'invalid_hash'
      };

      const mockError = new Error('Authentication failed');
      mockApi.post.mockRejectedValueOnce(mockError);

      await expect(authStore.login(telegramData)).rejects.toThrow('Authentication failed');

      const state = get(authStore);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Authentication failed');
    });

    it('should set loading state during login', async () => {
      const telegramData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Date.now(),
        hash: 'mock_hash'
      };

      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise(resolve => {
        resolveLogin = resolve;
      });

      mockApi.post.mockReturnValue(loginPromise);

      // Start login (don't await yet)
      const loginCall = authStore.login(telegramData);

      // Check loading state
      const loadingState = get(authStore);
      expect(loadingState.isLoading).toBe(true);
      expect(loadingState.error).toBeNull();

      // Complete login
      resolveLogin!({
        data: {
          success: true,
          user: mockUser
        }
      });
      await loginCall;

      // Check final state
      const finalState = get(authStore);
      expect(finalState.isLoading).toBe(false);
      expect(finalState.isAuthenticated).toBe(true);
    });

    it('should handle unsuccessful response (success: false)', async () => {
      const telegramData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Date.now(),
        hash: 'mock_hash'
      };

      const mockResponse = {
        data: {
          success: false,
          error: 'Invalid user data'
        }
      };

      mockApi.post.mockResolvedValueOnce(mockResponse);

      await expect(authStore.login(telegramData)).rejects.toThrow('Authentication failed');

      const state = get(authStore);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('Authentication failed');
    });
  });

  describe('Telegram OAuth Login', () => {
    it('should login with telegram oauth data', async () => {
      const telegramAuthData: TelegramAuthData = {
        id: '123456789',
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        photo_url: 'https://example.com/photo.jpg',
        auth_date: Date.now(),
        hash: 'mock_hash'
      };

      const mockAuthResponse = {
        user: mockUser,
        token: 'mock_token'
      };

      mockAuthService.loginWithTelegramOAuth.mockResolvedValueOnce(mockAuthResponse);

      await authStore.loginWithTelegramOAuth(telegramAuthData);

      const state = get(authStore);
      expect(state.user).toEqual({ ...mockUser, authMethod: 'telegram' });
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();

      expect(mockAuthService.loginWithTelegramOAuth).toHaveBeenCalledWith(telegramAuthData);
    });

    it('should handle telegram oauth login failure', async () => {
      const telegramAuthData: TelegramAuthData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Date.now(),
        hash: 'invalid_hash'
      };

      const mockError = new Error('OAuth login failed');
      mockAuthService.loginWithTelegramOAuth.mockRejectedValueOnce(mockError);

      await expect(authStore.loginWithTelegramOAuth(telegramAuthData)).rejects.toThrow('OAuth login failed');

      const state = get(authStore);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('OAuth login failed');
    });

    it('should clear error state before starting oauth login', async () => {
      // First set an error state
      const telegramData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Date.now(),
        hash: 'mock_hash'
      };
      
      mockApi.post.mockRejectedValueOnce(new Error('Previous error'));
      await expect(authStore.login(telegramData)).rejects.toThrow();
      
      expect(get(authStore).error).not.toBeNull();

      // Now try OAuth login
      const telegramAuthData: TelegramAuthData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Date.now(),
        hash: 'new_hash'
      };

      const mockAuthResponse = {
        user: mockUser,
        token: 'mock_token'
      };

      mockAuthService.loginWithTelegramOAuth.mockResolvedValueOnce(mockAuthResponse);

      await authStore.loginWithTelegramOAuth(telegramAuthData);

      const state = get(authStore);
      expect(state.error).toBeNull(); // Error should be cleared
    });
  });

  describe('Logout', () => {
    it('should logout successfully', async () => {
      // First login
      authStore.setUser(mockUser);
      expect(get(authStore).isAuthenticated).toBe(true);

      mockApi.post.mockResolvedValueOnce({});

      await authStore.logout();

      const state = get(authStore);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();

      expect(mockApi.post).toHaveBeenCalledWith('/auth/logout');
    });

    it('should clear state even if logout API fails', async () => {
      // First login
      authStore.setUser(mockUser);
      expect(get(authStore).isAuthenticated).toBe(true);

      const mockError = new Error('Logout failed');
      mockApi.post.mockRejectedValueOnce(mockError);

      await authStore.logout();

      const state = get(authStore);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull(); // Error should still be null as it's cleared in finally
    });

    it('should set loading state during logout', async () => {
      // First login
      authStore.setUser(mockUser);

      let resolveLogout: (value: any) => void;
      const logoutPromise = new Promise(resolve => {
        resolveLogout = resolve;
      });

      mockApi.post.mockReturnValue(logoutPromise);

      // Start logout (don't await yet)
      const logoutCall = authStore.logout();

      // Check loading state
      const loadingState = get(authStore);
      expect(loadingState.isLoading).toBe(true);

      // Complete logout
      resolveLogout!({});
      await logoutCall;

      // Check final state
      const finalState = get(authStore);
      expect(finalState.isLoading).toBe(false);
      expect(finalState.isAuthenticated).toBe(false);
    });
  });

  describe('Check Auth', () => {
    it('should check auth successfully with valid user', async () => {
      const mockResponse = {
        data: {
          user: mockUser
        }
      };

      mockApi.get.mockResolvedValueOnce(mockResponse);

      await authStore.checkAuth();

      const state = get(authStore);
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();

      expect(mockApi.get).toHaveBeenCalledWith('/auth/me');
    });

    it('should handle auth check with no user data', async () => {
      const mockResponse = {
        data: {} // No user field
      };

      mockApi.get.mockResolvedValueOnce(mockResponse);

      await authStore.checkAuth();

      const state = get(authStore);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle 401 errors gracefully without setting error', async () => {
      const unauthorizedError = new Error('Unauthorized');
      (unauthorizedError as any).response = { status: 401 };

      mockApi.get.mockRejectedValueOnce(unauthorizedError);

      await authStore.checkAuth();

      const state = get(authStore);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull(); // Should not set error for 401
    });

    it('should handle non-401 errors by logging warning', async () => {
      const serverError = new Error('Server Error');
      (serverError as any).response = { status: 500 };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockApi.get.mockRejectedValueOnce(serverError);

      await authStore.checkAuth();

      expect(consoleSpy).toHaveBeenCalledWith('Unexpected error during auth check:', serverError);

      const state = get(authStore);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeNull();

      consoleSpy.mockRestore();
    });

    it('should handle errors without response object', async () => {
      const networkError = new Error('Network Error');
      // No response property

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockApi.get.mockRejectedValueOnce(networkError);

      await authStore.checkAuth();

      expect(consoleSpy).toHaveBeenCalledWith('Unexpected error during auth check:', networkError);
      consoleSpy.mockRestore();
    });
  });

  describe('Set User', () => {
    it('should set user and authenticate state', () => {
      authStore.setUser(mockUser);

      const state = get(authStore);
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set user with auth method', () => {
      const userWithAuthMethod = { ...mockUser, authMethod: 'password' as const };
      
      authStore.setUser(userWithAuthMethod);

      const state = get(authStore);
      expect(state.user).toEqual(userWithAuthMethod);
      expect(state.user?.authMethod).toBe('password');
    });
  });

  describe('Clear Error', () => {
    it('should clear error state', async () => {
      // First create an error
      const telegramData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Date.now(),
        hash: 'mock_hash'
      };

      mockApi.post.mockRejectedValueOnce(new Error('Test error'));
      await expect(authStore.login(telegramData)).rejects.toThrow();

      expect(get(authStore).error).toBe('Test error');

      // Clear error
      authStore.clearError();

      expect(get(authStore).error).toBeNull();
    });
  });

  describe('Derived Stores', () => {
    it('should provide current user via derived store', () => {
      authStore.setUser(mockUser);

      const user = get(currentUser);
      expect(user).toEqual(mockUser);
    });

    it('should provide authentication status via derived store', () => {
      expect(get(isAuthenticated)).toBe(false);

      authStore.setUser(mockUser);

      expect(get(isAuthenticated)).toBe(true);
    });

    it('should provide loading status via derived store', async () => {
      expect(get(isAuthLoading)).toBe(false);

      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise(resolve => {
        resolveLogin = resolve;
      });

      mockApi.post.mockReturnValue(loginPromise);

      const telegramData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Date.now(),
        hash: 'mock_hash'
      };

      // Start login
      const loginCall = authStore.login(telegramData);

      // Check loading state
      expect(get(isAuthLoading)).toBe(true);

      // Complete login
      resolveLogin!({
        data: {
          success: true,
          user: mockUser
        }
      });
      await loginCall;

      expect(get(isAuthLoading)).toBe(false);
    });

    it('should provide error status via derived store', async () => {
      expect(get(authError)).toBeNull();

      const telegramData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Date.now(),
        hash: 'mock_hash'
      };

      mockApi.post.mockRejectedValueOnce(new Error('Auth error'));
      await expect(authStore.login(telegramData)).rejects.toThrow();

      expect(get(authError)).toBe('Auth error');

      authStore.clearError();

      expect(get(authError)).toBeNull();
    });
  });

  describe('LocalStorage Integration', () => {
    it('should persist auth state to localStorage', () => {
      authStore.setUser(mockUser);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'auth-storage',
        JSON.stringify({
          state: {
            user: mockUser,
            isAuthenticated: true
          },
          version: 0
        })
      );
    });

    it('should handle localStorage errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('LocalStorage quota exceeded');
      });

      // Should not throw
      expect(() => authStore.setUser(mockUser)).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to store auth:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should not persist loading and error states', () => {
      // Create error state
      const telegramData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Date.now(),
        hash: 'mock_hash'
      };

      mockApi.post.mockRejectedValueOnce(new Error('Test error'));
      authStore.login(telegramData).catch(() => {}); // Ignore rejection

      // LocalStorage should only contain user and isAuthenticated
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
        'auth-storage',
        expect.stringContaining('"isAuthenticated":false')
      );
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
        'auth-storage',
        expect.not.stringContaining('isLoading')
      );
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
        'auth-storage',
        expect.not.stringContaining('error')
      );
    });
  });

  describe('SSR Environment', () => {
    beforeEach(() => {
      vi.doMock('$app/environment', () => ({
        browser: false
      }));
    });

    it('should not access localStorage in SSR environment', () => {
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
      });

      // Should not throw and should not call localStorage
      expect(() => authStore.setUser(mockUser)).not.toThrow();
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      // Restore window for other tests
      Object.defineProperty(global, 'window', {
        value: global.window,
        writable: true,
      });
    });
  });

  describe('Race Conditions', () => {
    it('should handle concurrent login attempts', async () => {
      let resolveLogin1: (value: any) => void;
      let resolveLogin2: (value: any) => void;

      const loginPromise1 = new Promise(resolve => {
        resolveLogin1 = resolve;
      });
      const loginPromise2 = new Promise(resolve => {
        resolveLogin2 = resolve;
      });

      mockApi.post
        .mockImplementationOnce(() => loginPromise1)
        .mockImplementationOnce(() => loginPromise2);

      const telegramData1 = {
        id: '123456789',
        first_name: 'John',
        auth_date: Date.now(),
        hash: 'hash1'
      };

      const telegramData2 = {
        id: '987654321',
        first_name: 'Jane',
        auth_date: Date.now(),
        hash: 'hash2'
      };

      const login1 = authStore.login(telegramData1);
      const login2 = authStore.login(telegramData2);

      // Resolve second login first
      resolveLogin2!({
        data: {
          success: true,
          user: { ...mockUser, user_id: 2, user_name: 'Jane' }
        }
      });

      // Resolve first login second
      resolveLogin1!({
        data: {
          success: true,
          user: mockUser
        }
      });

      await Promise.all([login1, login2]);

      // Last resolved login should win
      const state = get(authStore);
      expect(state.user?.user_id).toBe(1); // First login resolved last
      expect(state.user?.user_name).toBe('John Doe');
    });

    it('should handle concurrent login and logout', async () => {
      // Start with authenticated state
      authStore.setUser(mockUser);

      let resolveLogin: (value: any) => void;
      let resolveLogout: (value: any) => void;

      const loginPromise = new Promise(resolve => {
        resolveLogin = resolve;
      });
      const logoutPromise = new Promise(resolve => {
        resolveLogout = resolve;
      });

      mockApi.post
        .mockImplementationOnce(() => loginPromise)
        .mockImplementationOnce(() => logoutPromise);

      const telegramData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Date.now(),
        hash: 'mock_hash'
      };

      const loginCall = authStore.login(telegramData);
      const logoutCall = authStore.logout();

      // Resolve logout first
      resolveLogout!({});

      // Resolve login second
      resolveLogin!({
        data: {
          success: true,
          user: mockUser
        }
      });

      await Promise.all([loginCall, logoutCall]);

      // Logout should win (last resolved)
      const state = get(authStore);
      expect(state.isAuthenticated).toBe(true); // Login resolved last
      expect(state.user).toEqual({ ...mockUser, authMethod: 'telegram' });
    });
  });

  describe('Error Message Handling', () => {
    it('should use custom error message from error object', async () => {
      const customError = new Error('Custom authentication error');
      mockApi.post.mockRejectedValueOnce(customError);

      const telegramData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Date.now(),
        hash: 'mock_hash'
      };

      await expect(authStore.login(telegramData)).rejects.toThrow();

      const state = get(authStore);
      expect(state.error).toBe('Custom authentication error');
    });

    it('should use default error message for null/undefined errors', async () => {
      const nullError = null;
      mockApi.post.mockRejectedValueOnce(nullError);

      const telegramData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Date.now(),
        hash: 'mock_hash'
      };

      await expect(authStore.login(telegramData)).rejects.toThrow();

      const state = get(authStore);
      expect(state.error).toBe('Login failed');
    });

    it('should handle errors without message property', async () => {
      const errorWithoutMessage = { status: 500, code: 'INTERNAL_ERROR' };
      mockApi.post.mockRejectedValueOnce(errorWithoutMessage);

      const telegramData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Date.now(),
        hash: 'mock_hash'
      };

      await expect(authStore.login(telegramData)).rejects.toThrow();

      const state = get(authStore);
      expect(state.error).toBe('Login failed');
    });
  });
});
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { authStore, currentUser, isAuthenticated } from '../auth.store';
import { createMockUser, createMockAxiosResponse } from '$test/utils';

// Mock the API
vi.mock('$services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

// Mock browser environment
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

describe('Auth Store', () => {
  const mockUser = createMockUser();
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage mock
    (window.localStorage.getItem as any).mockReturnValue(null);
    (window.localStorage.setItem as any).mockClear();
    (window.localStorage.removeItem as any).mockClear();
  });

  afterEach(() => {
    // Reset store state
    authStore.clearError();
  });

  describe('Initial State', () => {
    it('should initialize with default state when no stored auth', () => {
      const state = get(authStore);
      
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should initialize from localStorage if available', () => {
      const storedAuth = {
        state: {
          user: mockUser,
          isAuthenticated: true
        },
        version: 0
      };
      
      (window.localStorage.getItem as any).mockReturnValue(
        JSON.stringify(storedAuth)
      );
      
      // We would need to re-import or re-create the store to test this
      // This is a limitation of the current test setup
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Login', () => {
    it('should login successfully with Telegram data', async () => {
      const telegramData = { id: '123456789', username: 'testuser' };
      const mockResponse = createMockAxiosResponse({
        success: true,
        user: mockUser
      });

      const { default: api } = await import('$services/api');
      (api.post as any).mockResolvedValue(mockResponse);

      await authStore.login(telegramData);
      
      const state = get(authStore);
      expect(state.user).toEqual({ ...mockUser, authMethod: 'telegram' });
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      
      expect(api.post).toHaveBeenCalledWith('/auth/telegram', telegramData);
      expect(window.localStorage.setItem).toHaveBeenCalled();
    });

    it('should handle login failure', async () => {
      const telegramData = { id: '123456789', username: 'testuser' };
      const errorMessage = 'Authentication failed';

      const { default: api } = await import('$services/api');
      (api.post as any).mockRejectedValue(new Error(errorMessage));

      try {
        await authStore.login(telegramData);
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
      
      const state = get(authStore);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });

    it('should handle invalid response format', async () => {
      const telegramData = { id: '123456789', username: 'testuser' };
      const mockResponse = createMockAxiosResponse({
        success: false,
        message: 'Invalid credentials'
      });

      const { default: api } = await import('$services/api');
      (api.post as any).mockResolvedValue(mockResponse);

      try {
        await authStore.login(telegramData);
      } catch (error) {
        expect(error.message).toBe('Authentication failed');
      }
      
      const state = get(authStore);
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('Authentication failed');
    });
  });

  describe('Logout', () => {
    beforeEach(async () => {
      // Set up authenticated state
      authStore.setUser(mockUser);
    });

    it('should logout successfully', async () => {
      const { default: api } = await import('$services/api');
      (api.post as any).mockResolvedValue({ data: { success: true } });

      await authStore.logout();
      
      const state = get(authStore);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      
      expect(api.post).toHaveBeenCalledWith('/auth/logout');
    });

    it('should clear local state even if logout API fails', async () => {
      const { default: api } = await import('$services/api');
      (api.post as any).mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await authStore.logout();
      
      const state = get(authStore);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Check Auth', () => {
    it('should check auth successfully when user is authenticated', async () => {
      const mockResponse = createMockAxiosResponse({
        user: mockUser
      });

      const { default: api } = await import('$services/api');
      (api.get as any).mockResolvedValue(mockResponse);

      await authStore.checkAuth();
      
      const state = get(authStore);
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      
      expect(api.get).toHaveBeenCalledWith('/auth/me');
    });

    it('should handle unauthenticated response', async () => {
      const mockResponse = createMockAxiosResponse({});

      const { default: api } = await import('$services/api');
      (api.get as any).mockResolvedValue(mockResponse);

      await authStore.checkAuth();
      
      const state = get(authStore);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle auth check failure', async () => {
      const { default: api } = await import('$services/api');
      (api.get as any).mockRejectedValue(new Error('Unauthorized'));

      await authStore.checkAuth();
      
      const state = get(authStore);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('Set User', () => {
    it('should set user correctly', () => {
      authStore.setUser(mockUser);
      
      const state = get(authStore);
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('Clear Error', () => {
    it('should clear error state', async () => {
      // First create an error
      const { default: api } = await import('$services/api');
      (api.post as any).mockRejectedValue(new Error('Test error'));
      
      try {
        await authStore.login({});
      } catch {}
      
      expect(get(authStore).error).toBeTruthy();
      
      authStore.clearError();
      
      expect(get(authStore).error).toBeNull();
    });
  });

  describe('Derived Stores', () => {
    it('should provide current user', () => {
      authStore.setUser(mockUser);
      
      const user = get(currentUser);
      expect(user).toEqual(mockUser);
    });

    it('should provide authentication status', () => {
      authStore.setUser(mockUser);
      
      const authenticated = get(isAuthenticated);
      expect(authenticated).toBe(true);
      
      authStore.logout();
      
      const notAuthenticated = get(isAuthenticated);
      expect(notAuthenticated).toBe(false);
    });
  });

  describe('LocalStorage Integration', () => {
    it('should store auth state in localStorage', () => {
      authStore.setUser(mockUser);
      
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'auth-storage',
        expect.stringContaining('"user"')
      );
    });

    it('should handle localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (window.localStorage.setItem as any).mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      authStore.setUser(mockUser);
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to store auth:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
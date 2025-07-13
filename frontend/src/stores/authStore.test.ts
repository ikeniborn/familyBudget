import { act, renderHook } from '@testing-library/react';
import { useAuthStore } from './authStore';
import apiClient from '../services/apiClient';
import fixtures from '@/test/fixtures';

jest.mock('../services/apiClient');
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Reset store state
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setUser(null as any);
    });
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('login', () => {
    it('should login successfully with telegram data', async () => {
      const telegramData = {
        id: 123456789,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        auth_date: Date.now(),
        hash: 'test_hash',
      };

      const mockResponse = {
        data: {
          success: true,
          user: {
            ...fixtures.users.activeUser,
            authMethod: 'telegram',
          },
        },
      };

      mockedApiClient.post.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login(telegramData);
      });

      expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/telegram', telegramData);
      expect(result.current.user).toEqual(mockResponse.data.user);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle login error', async () => {
      const telegramData = { id: 123456789 };
      const errorMessage = 'Invalid authentication data';
      
      mockedApiClient.post.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.login(telegramData);
        })
      ).rejects.toThrow(errorMessage);

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
    });

    it('should set loading state during login', async () => {
      const telegramData = { id: 123456789 };
      
      mockedApiClient.post.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      const { result } = renderHook(() => useAuthStore());

      const loginPromise = act(async () => {
        await result.current.login(telegramData);
      });

      // Check loading state immediately after starting login
      expect(result.current.isLoading).toBe(true);

      await loginPromise;
    });

    it('should handle unsuccessful login response', async () => {
      const telegramData = { id: 123456789 };
      
      mockedApiClient.post.mockResolvedValue({
        data: { success: false, error: 'Authentication failed' },
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login(telegramData);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      mockedApiClient.post.mockResolvedValue({ data: { success: true } });

      const { result } = renderHook(() => useAuthStore());
      
      // Set initial authenticated state
      act(() => {
        result.current.setUser(fixtures.users.activeUser as any);
      });

      expect(result.current.isAuthenticated).toBe(true);

      await act(async () => {
        await result.current.logout();
      });

      expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/logout');
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should clear state even if logout API call fails', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockedApiClient.post.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuthStore());
      
      // Set initial authenticated state
      act(() => {
        result.current.setUser(fixtures.users.activeUser as any);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(consoleError).toHaveBeenCalledWith('Logout error:', expect.any(Error));
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      
      consoleError.mockRestore();
    });
  });

  describe('checkAuth', () => {
    it('should check authentication and set user', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: {
          user: fixtures.users.activeUser,
        },
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/auth/me');
      expect(result.current.user).toEqual(fixtures.users.activeUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle unauthenticated response', async () => {
      mockedApiClient.get.mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle checkAuth error', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('setUser', () => {
    it('should set user and authentication state', () => {
      const { result } = renderHook(() => useAuthStore());

      const userWithAuth = {
        ...fixtures.users.activeUser,
        authMethod: 'password' as const,
      };

      act(() => {
        result.current.setUser(userWithAuth);
      });

      expect(result.current.user).toEqual(userWithAuth);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('persistence', () => {
    it('should persist user and authentication state to localStorage', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(fixtures.users.activeUser as any);
      });

      const stored = localStorage.getItem('auth-storage');
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored!);
      expect(parsed.state.user).toEqual(fixtures.users.activeUser);
      expect(parsed.state.isAuthenticated).toBe(true);
    });

    it('should restore state from localStorage', () => {
      // Set initial state in localStorage
      const initialState = {
        state: {
          user: fixtures.users.activeUser,
          isAuthenticated: true,
        },
        version: 0,
      };
      localStorage.setItem('auth-storage', JSON.stringify(initialState));

      // Create new store instance
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.user).toEqual(fixtures.users.activeUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should not persist loading and error state', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(fixtures.users.activeUser as any);
      });

      const stored = localStorage.getItem('auth-storage');
      const parsed = JSON.parse(stored!);
      
      expect(parsed.state).not.toHaveProperty('isLoading');
      expect(parsed.state).not.toHaveProperty('error');
    });
  });

  describe('concurrent state updates', () => {
    it('should handle multiple rapid state changes', async () => {
      const { result } = renderHook(() => useAuthStore());

      mockedApiClient.post.mockResolvedValue({
        data: { success: true, user: fixtures.users.activeUser },
      });
      mockedApiClient.get.mockResolvedValue({
        data: { user: fixtures.users.activeUser },
      });

      await act(async () => {
        // Trigger multiple async operations
        const promises = [
          result.current.login({ id: 123 }),
          result.current.checkAuth(),
        ];
        await Promise.all(promises);
      });

      // Final state should be consistent
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toBeTruthy();
    });
  });
});
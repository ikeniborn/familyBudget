import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the api service
vi.mock('./api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  }
}));

// Mock telegram-oauth utilities
vi.mock('$lib/utils/telegram-oauth', () => ({
  startTelegramOAuth: vi.fn()
}));

// Mock SvelteKit environment
vi.mock('$app/environment', () => ({
  browser: true
}));

import { authService, type LoginData, type AuthResponse, type PasswordAuthResponse } from './auth.service';
import type { User } from '$types';
import type { TelegramAuthData } from '$lib/utils/telegram-oauth';
import { api } from './api';
import { startTelegramOAuth } from '$lib/utils/telegram-oauth';

const mockApi = vi.mocked(api);
const mockStartTelegramOAuth = vi.mocked(startTelegramOAuth);

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    const mockLoginData: LoginData = {
      id: '123456789',
      first_name: 'John',
      last_name: 'Doe',
      username: 'johndoe',
      photo_url: 'https://example.com/photo.jpg',
      auth_date: 1640995200,
      hash: 'valid-hash'
    };

    const mockUser: User = {
      user_id: 1,
      user_name: 'John Doe',
      user_telegram_id: 123456789,
      first_name: 'John',
      last_name: 'Doe',
      username: 'johndoe',
      authMethod: 'telegram'
    };

    const mockAuthResponse: AuthResponse = {
      user: mockUser,
      token: 'mock-jwt-token'
    };

    it('should successfully login with Telegram data', async () => {
      mockApi.post.mockResolvedValue(mockAuthResponse);

      const result = await authService.login(mockLoginData);

      expect(mockApi.post).toHaveBeenCalledWith('/auth/telegram', mockLoginData);
      expect(result).toEqual(mockAuthResponse);
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'mock-jwt-token');
    });

    it('should not save token if not provided in response', async () => {
      const responseWithoutToken = { ...mockAuthResponse, token: undefined };
      mockApi.post.mockResolvedValue(responseWithoutToken);

      await authService.login(mockLoginData);

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('API Error');
      mockApi.post.mockRejectedValue(apiError);

      await expect(authService.login(mockLoginData)).rejects.toThrow('API Error');
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('startTelegramOAuth', () => {
    it('should call the telegram OAuth utility with correct parameters', () => {
      const botName = 'test_bot';
      const returnUrl = '/dashboard';

      authService.startTelegramOAuth(botName, returnUrl);

      expect(mockStartTelegramOAuth).toHaveBeenCalledWith(botName, returnUrl);
    });

    it('should call the telegram OAuth utility without return URL', () => {
      const botName = 'test_bot';

      authService.startTelegramOAuth(botName);

      expect(mockStartTelegramOAuth).toHaveBeenCalledWith(botName, undefined);
    });
  });

  describe('loginWithTelegramOAuth', () => {
    const mockTelegramAuthData: TelegramAuthData = {
      id: '123456789',
      first_name: 'John',
      last_name: 'Doe',
      username: 'johndoe',
      photo_url: 'https://example.com/photo.jpg',
      auth_date: 1640995200,
      hash: 'valid-hash'
    };

    const mockAuthResponse: AuthResponse = {
      user: {
        user_id: 1,
        user_name: 'John Doe',
        user_telegram_id: 123456789,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        authMethod: 'telegram'
      },
      token: 'mock-jwt-token'
    };

    it('should convert Telegram auth data and login successfully', async () => {
      mockApi.post.mockResolvedValue(mockAuthResponse);

      const result = await authService.loginWithTelegramOAuth(mockTelegramAuthData);

      expect(mockApi.post).toHaveBeenCalledWith('/auth/telegram', {
        id: '123456789',
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        photo_url: 'https://example.com/photo.jpg',
        auth_date: 1640995200,
        hash: 'valid-hash'
      });
      expect(result).toEqual(mockAuthResponse);
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'mock-jwt-token');
    });

    it('should handle optional fields correctly', async () => {
      const minimalAuthData: TelegramAuthData = {
        id: '123456789',
        first_name: 'John',
        auth_date: 1640995200,
        hash: 'valid-hash'
      };

      mockApi.post.mockResolvedValue(mockAuthResponse);

      await authService.loginWithTelegramOAuth(minimalAuthData);

      expect(mockApi.post).toHaveBeenCalledWith('/auth/telegram', {
        id: '123456789',
        first_name: 'John',
        last_name: undefined,
        username: undefined,
        photo_url: undefined,
        auth_date: 1640995200,
        hash: 'valid-hash'
      });
    });
  });

  describe('loginWithPassword', () => {
    const mockPasswordResponse: PasswordAuthResponse = {
      success: true,
      user: {
        id: 1,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User'
      },
      token: 'password-jwt-token'
    };

    it('should successfully login with password', async () => {
      mockApi.post.mockResolvedValue(mockPasswordResponse);

      const result = await authService.loginWithPassword('testuser', 'password123');

      expect(mockApi.post).toHaveBeenCalledWith('/auth/password', {
        username: 'testuser',
        password: 'password123'
      });
      expect(result).toEqual(mockPasswordResponse);
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'password-jwt-token');
    });

    it('should handle failed password login', async () => {
      const failedResponse: PasswordAuthResponse = {
        success: false,
        error: 'Invalid credentials'
      };
      mockApi.post.mockResolvedValue(failedResponse);

      const result = await authService.loginWithPassword('testuser', 'wrong-password');

      expect(result).toEqual(failedResponse);
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('checkPasswordAuthEnabled', () => {
    it('should check if password auth is enabled', async () => {
      const mockResponse = { enabled: true };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await authService.checkPasswordAuthEnabled();

      expect(mockApi.get).toHaveBeenCalledWith('/auth/password-enabled');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('logout', () => {
    it('should successfully logout and clear token', async () => {
      mockApi.post.mockResolvedValue({});

      await authService.logout();

      expect(mockApi.post).toHaveBeenCalledWith('/auth/logout');
      expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });

    it('should clear token even if logout API call fails', async () => {
      const apiError = new Error('Logout error');
      mockApi.post.mockRejectedValue(apiError);

      // The logout method doesn't catch API errors, but always clears the token in finally block
      try {
        await authService.logout();
      } catch (error) {
        // Expected to throw, but should still clear token
      }

      expect(mockApi.post).toHaveBeenCalledWith('/auth/logout');
      expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('getCurrentUser', () => {
    const mockUser: User = {
      user_id: 1,
      user_name: 'John Doe',
      user_telegram_id: 123456789,
      first_name: 'John',
      last_name: 'Doe',
      username: 'johndoe',
      authMethod: 'telegram'
    };

    it('should get current user successfully', async () => {
      mockApi.get.mockResolvedValue(mockUser);

      const result = await authService.getCurrentUser();

      expect(mockApi.get).toHaveBeenCalledWith('/auth/me');
      expect(result).toEqual(mockUser);
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      mockApi.get.mockResolvedValue({});

      const result = await authService.validateToken();

      expect(mockApi.get).toHaveBeenCalledWith('/auth/validate');
      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      const apiError = new Error('Invalid token');
      mockApi.get.mockRejectedValue(apiError);

      const result = await authService.validateToken();

      expect(result).toBe(false);
    });
  });

  describe('Token management', () => {
    describe('getToken', () => {
      it('should get token from localStorage when in browser', () => {
        const mockToken = 'stored-token';
        vi.mocked(localStorage.getItem).mockReturnValue(mockToken);

        const result = authService.getToken();

        expect(localStorage.getItem).toHaveBeenCalledWith('auth_token');
        expect(result).toBe(mockToken);
      });

      it('should return null when token is not in localStorage', () => {
        vi.mocked(localStorage.getItem).mockReturnValue(null);

        const result = authService.getToken();

        expect(result).toBeNull();
      });
    });

    describe('isAuthenticated', () => {
      it('should return true when token exists', () => {
        vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

        const result = authService.isAuthenticated();

        expect(result).toBe(true);
      });

      it('should return false when token does not exist', () => {
        vi.mocked(localStorage.getItem).mockReturnValue(null);

        const result = authService.isAuthenticated();

        expect(result).toBe(false);
      });

      it('should return false when token is empty string', () => {
        vi.mocked(localStorage.getItem).mockReturnValue('');

        const result = authService.isAuthenticated();

        expect(result).toBe(false);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete login flow with Telegram OAuth', async () => {
      const telegramData: TelegramAuthData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'valid-hash'
      };

      const mockResponse: AuthResponse = {
        user: {
          user_id: 1,
          user_name: 'John',
          user_telegram_id: 123456789,
          first_name: 'John',
          authMethod: 'telegram'
        },
        token: 'jwt-token'
      };

      mockApi.post.mockResolvedValue(mockResponse);
      // Mock localStorage to return the token
      vi.mocked(localStorage.getItem).mockReturnValue('jwt-token');

      const result = await authService.loginWithTelegramOAuth(telegramData);

      expect(result).toEqual(mockResponse);
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'jwt-token');
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should handle complete logout flow', async () => {
      // First set a token
      vi.mocked(localStorage.getItem).mockReturnValue('existing-token');
      expect(authService.isAuthenticated()).toBe(true);

      // Logout
      mockApi.post.mockResolvedValue({});
      await authService.logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
      
      // After logout, token should be cleared
      vi.mocked(localStorage.getItem).mockReturnValue(null);
      expect(authService.isAuthenticated()).toBe(false);
    });
  });
});
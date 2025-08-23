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

      expect(mockApi.post).toHaveBeenCalledWith('/api/auth/telegram', mockLoginData);
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

      expect(mockApi.post).toHaveBeenCalledWith('/api/auth/telegram', {
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

      expect(mockApi.post).toHaveBeenCalledWith('/api/auth/telegram', {
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

      expect(mockApi.post).toHaveBeenCalledWith('/api/auth/login', {
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

      expect(mockApi.get).toHaveBeenCalledWith('/api/auth/password-auth-enabled');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('logout', () => {
    it('should successfully logout and clear token', async () => {
      mockApi.post.mockResolvedValue({});

      await authService.logout();

      expect(mockApi.post).toHaveBeenCalledWith('/api/auth/logout');
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

      expect(mockApi.post).toHaveBeenCalledWith('/api/auth/logout');
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

      expect(mockApi.get).toHaveBeenCalledWith('/api/auth/me');
      expect(result).toEqual(mockUser);
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      mockApi.get.mockResolvedValue({});

      const result = await authService.validateToken();

      expect(mockApi.get).toHaveBeenCalledWith('/api/auth/validate');
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

        expect(localStorage.getItem).toHaveBeenCalledWith('access_token');
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

    it('should handle session expiration during API calls', async () => {
      // Setup: user is initially authenticated
      vi.mocked(localStorage.getItem).mockReturnValue('expired-token');
      expect(authService.isAuthenticated()).toBe(true);

      // Mock API returning 401 Unauthorized
      const unauthorizedError = new Error('Unauthorized');
      unauthorizedError.name = 'ApiError';
      (unauthorizedError as any).status = 401;
      mockApi.get.mockRejectedValue(unauthorizedError);

      // Validate token should fail
      const isValid = await authService.validateToken();
      expect(isValid).toBe(false);

      // Token should still exist in localStorage (service doesn't auto-clear on 401)
      expect(authService.getToken()).toBe('expired-token');
    });

    it('should handle network errors during authentication', async () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';
      mockApi.post.mockRejectedValue(networkError);

      const loginData: LoginData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'valid-hash'
      };

      await expect(authService.login(loginData)).rejects.toThrow('Network Error');
      
      // Token should not be saved on network error
      expect(localStorage.setItem).not.toHaveBeenCalled();
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed API responses', async () => {
      const malformedResponse = { 
        // Missing required fields
        someField: 'value' 
      };
      mockApi.post.mockResolvedValue(malformedResponse);

      const loginData: LoginData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'valid-hash'
      };

      const result = await authService.login(loginData);
      
      // Should handle gracefully even with malformed response
      expect(result).toEqual(malformedResponse);
      // Token should not be saved if not present in response
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should handle empty string token in response', async () => {
      const responseWithEmptyToken = {
        user: {
          user_id: 1,
          user_name: 'John',
          authMethod: 'telegram' as const
        },
        token: '' // Empty string token
      };
      mockApi.post.mockResolvedValue(responseWithEmptyToken);

      const loginData: LoginData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'valid-hash'
      };

      await authService.login(loginData);
      
      // Should save empty token (let the calling code decide validity)
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', '');
    });

    it('should handle null token in response', async () => {
      const responseWithNullToken = {
        user: {
          user_id: 1,
          user_name: 'John',
          authMethod: 'telegram' as const
        },
        token: null as any // null token
      };
      mockApi.post.mockResolvedValue(responseWithNullToken);

      const loginData: LoginData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'valid-hash'
      };

      await authService.login(loginData);
      
      // Should not save null token
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should handle localStorage errors gracefully', async () => {
      // Mock localStorage.setItem to throw
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('LocalStorage quota exceeded');
      });

      const mockResponse: AuthResponse = {
        user: {
          user_id: 1,
          user_name: 'John',
          authMethod: 'telegram'
        },
        token: 'valid-token'
      };
      mockApi.post.mockResolvedValue(mockResponse);

      const loginData: LoginData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'valid-hash'
      };

      // Should not throw error even if localStorage fails
      expect(async () => await authService.login(loginData)).not.toThrow();
      
      const result = await authService.login(loginData);
      expect(result).toEqual(mockResponse);
    });

    it('should handle concurrent login attempts', async () => {
      let resolveLogin1: (value: AuthResponse) => void;
      let resolveLogin2: (value: AuthResponse) => void;

      const loginPromise1 = new Promise<AuthResponse>(resolve => {
        resolveLogin1 = resolve;
      });
      const loginPromise2 = new Promise<AuthResponse>(resolve => {
        resolveLogin2 = resolve;
      });

      mockApi.post
        .mockImplementationOnce(() => loginPromise1)
        .mockImplementationOnce(() => loginPromise2);

      const loginData1: LoginData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'hash1'
      };

      const loginData2: LoginData = {
        id: '987654321',
        first_name: 'Jane',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'hash2'
      };

      const login1 = authService.login(loginData1);
      const login2 = authService.login(loginData2);

      const response1: AuthResponse = {
        user: { user_id: 1, user_name: 'John', authMethod: 'telegram' },
        token: 'token1'
      };
      const response2: AuthResponse = {
        user: { user_id: 2, user_name: 'Jane', authMethod: 'telegram' },
        token: 'token2'
      };

      // Resolve in different order
      resolveLogin2!(response2);
      resolveLogin1!(response1);

      const [result1, result2] = await Promise.all([login1, login2]);

      expect(result1).toEqual(response1);
      expect(result2).toEqual(response2);
      
      // Last token should be saved (race condition)
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'token1');
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'token2');
    });

    it('should handle very long tokens', async () => {
      const longToken = 'a'.repeat(10000); // 10KB token
      const response: AuthResponse = {
        user: { user_id: 1, user_name: 'John', authMethod: 'telegram' },
        token: longToken
      };
      mockApi.post.mockResolvedValue(response);

      const loginData: LoginData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'valid-hash'
      };

      await authService.login(loginData);
      
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', longToken);
    });
  });

  describe('Browser Environment Edge Cases', () => {
    it('should handle SSR environment (no window)', async () => {
      // Mock window as undefined
      Object.defineProperty(globalThis, 'window', {
        value: undefined,
        writable: true,
      });

      // Token operations should not crash
      expect(() => authService.getToken()).not.toThrow();
      expect(() => authService.isAuthenticated()).not.toThrow();
      expect(authService.getToken()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);

      // Should not try to save token in SSR
      const response: AuthResponse = {
        user: { user_id: 1, user_name: 'John', authMethod: 'telegram' },
        token: 'test-token'
      };
      mockApi.post.mockResolvedValue(response);

      const loginData: LoginData = {
        id: '123456789',
        first_name: 'John',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'valid-hash'
      };

      await expect(authService.login(loginData)).resolves.not.toThrow();
      
      // Restore window for other tests
      Object.defineProperty(globalThis, 'window', {
        value: global.window,
        writable: true,
      });
    });

    it('should not call startTelegramOAuth when browser is false', () => {
      // Mock browser environment
      vi.doMock('$app/environment', () => ({
        browser: false
      }));

      // Should exit early without calling OAuth function
      authService.startTelegramOAuth('test_bot', '/dashboard');
      
      expect(mockStartTelegramOAuth).not.toHaveBeenCalled();
    });
  });

  describe('Password Authentication Edge Cases', () => {
    it('should handle password login with minimal user data', async () => {
      const minimalResponse: PasswordAuthResponse = {
        success: true,
        user: {
          id: 1,
          username: 'testuser'
          // firstName and lastName are optional
        },
        token: 'password-token'
      };
      mockApi.post.mockResolvedValue(minimalResponse);

      const result = await authService.loginWithPassword('testuser', 'password');
      
      expect(result).toEqual(minimalResponse);
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'password-token');
    });

    it('should handle password auth disabled response format variations', async () => {
      const testCases = [
        { enabled: false },
        { enabled: 0 }, // Falsy number
        { enabled: null }, // Null
        { enabled: undefined }, // Undefined
        { } // Missing enabled field
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        mockApi.get.mockResolvedValue(testCase);
        
        const result = await authService.checkPasswordAuthEnabled();
        
        expect(mockApi.get).toHaveBeenCalledWith('/api/auth/password-auth-enabled');
        expect(result).toEqual(testCase);
      }
    });

    it('should handle special characters in username and password', async () => {
      const specialUsername = 'user@domain.com';
      const specialPassword = 'p@$$w0rd!#$%^&*()';
      
      const response: PasswordAuthResponse = {
        success: true,
        user: {
          id: 1,
          username: specialUsername,
          firstName: 'Test',
          lastName: 'User'
        },
        token: 'special-token'
      };
      mockApi.post.mockResolvedValue(response);

      await authService.loginWithPassword(specialUsername, specialPassword);
      
      expect(mockApi.post).toHaveBeenCalledWith('/api/auth/login', {
        username: specialUsername,
        password: specialPassword
      });
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'special-token');
    });

    it('should handle empty username and password', async () => {
      const response: PasswordAuthResponse = {
        success: false,
        error: 'Username and password are required'
      };
      mockApi.post.mockResolvedValue(response);

      const result = await authService.loginWithPassword('', '');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Token Validation Edge Cases', () => {
    it('should handle validate token with different error types', async () => {
      const errorTypes = [
        new Error('Network error'),
        { status: 401, message: 'Unauthorized' },
        { status: 403, message: 'Forbidden' },
        { status: 500, message: 'Internal Server Error' },
        null, // Unexpected null response
        undefined // Unexpected undefined response
      ];

      for (const error of errorTypes) {
        vi.clearAllMocks();
        mockApi.get.mockRejectedValue(error);
        
        const result = await authService.validateToken();
        
        expect(result).toBe(false);
        expect(mockApi.get).toHaveBeenCalledWith('/api/auth/validate');
      }
    });

    it('should handle getCurrentUser with different user data formats', async () => {
      const userFormats = [
        {
          user_id: 1,
          user_name: 'John Doe',
          user_telegram_id: 123456789,
          first_name: 'John',
          last_name: 'Doe',
          username: 'johndoe',
          authMethod: 'telegram' as const
        },
        {
          user_id: 2,
          user_name: 'Jane',
          authMethod: 'password' as const
          // Missing optional fields
        },
        {
          user_id: 3,
          user_name: '',
          authMethod: 'telegram' as const,
          first_name: '',
          last_name: ''
          // Empty strings
        }
      ];

      for (const userFormat of userFormats) {
        vi.clearAllMocks();
        mockApi.get.mockResolvedValue(userFormat);
        
        const result = await authService.getCurrentUser();
        
        expect(result).toEqual(userFormat);
        expect(mockApi.get).toHaveBeenCalledWith('/api/auth/me');
      }
    });
  });
});
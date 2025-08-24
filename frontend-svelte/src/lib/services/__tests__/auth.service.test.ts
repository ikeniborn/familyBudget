import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authService } from '../auth.service';
import { api } from '../api';
import type { PasswordAuthResponse, RegisterResponse, RefreshTokenResponse } from '../auth.service';

// Моки
vi.mock('../api');
vi.mock('$app/environment', () => ({
  browser: true,
  dev: false
}));

const mockApi = vi.mocked(api);

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('loginWithPassword', () => {
    it('должен успешно логинить пользователя с паролем', async () => {
      const username = 'testuser';
      const password = 'testpassword';
      
      const mockResponse: PasswordAuthResponse = {
        success: true,
        user: {
          id: 1,
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User'
        },
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123'
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await authService.loginWithPassword(username, password);

      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', {
        username,
        password
      });

      expect(result).toEqual(mockResponse);
      expect(localStorageMock.getItem('access_token')).toBe('access_token_123');
      expect(localStorageMock.getItem('refresh_token')).toBe('refresh_token_123');
      expect(localStorageMock.getItem('auth_token')).toBe('access_token_123'); // обратная совместимость
    });

    it('должен поддерживать обратную совместимость с token полем', async () => {
      const username = 'testuser';
      const password = 'testpassword';
      
      const mockResponse: PasswordAuthResponse = {
        success: true,
        user: {
          id: 1,
          username: 'testuser'
        },
        token: 'legacy_token_123' // только старое поле token
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await authService.loginWithPassword(username, password);

      expect(result).toEqual(mockResponse);
      expect(localStorageMock.getItem('access_token')).toBe('legacy_token_123');
      expect(localStorageMock.getItem('auth_token')).toBe('legacy_token_123');
      expect(localStorageMock.getItem('refresh_token')).toBeNull();
    });

    it('должен обрабатывать неуспешный логин', async () => {
      const username = 'testuser';
      const password = 'wrongpassword';
      
      const mockResponse: PasswordAuthResponse = {
        success: false,
        error: 'Invalid credentials'
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await authService.loginWithPassword(username, password);

      expect(result).toEqual(mockResponse);
      expect(localStorageMock.getItem('access_token')).toBeNull();
      expect(localStorageMock.getItem('refresh_token')).toBeNull();
    });
  });

  describe('register', () => {
    it('должен успешно регистрировать пользователя', async () => {
      const username = 'newuser';
      const password = 'newpassword';
      const firstName = 'New';
      const lastName = 'User';
      
      const mockResponse: RegisterResponse = {
        success: true,
        user: {
          id: 2,
          username: 'newuser',
          firstName: 'New',
          lastName: 'User'
        },
        accessToken: 'new_access_token_123',
        refreshToken: 'new_refresh_token_123'
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await authService.register(username, password, firstName, lastName);

      expect(mockApi.post).toHaveBeenCalledWith('/auth/register', {
        username,
        password,
        userName: 'New User'
      });

      expect(result).toEqual(mockResponse);
      expect(localStorageMock.getItem('access_token')).toBe('new_access_token_123');
      expect(localStorageMock.getItem('refresh_token')).toBe('new_refresh_token_123');
    });

    it('должен регистрировать пользователя без имени и фамилии', async () => {
      const username = 'newuser';
      const password = 'newpassword';
      
      const mockResponse: RegisterResponse = {
        success: true,
        user: {
          id: 2,
          username: 'newuser'
        },
        accessToken: 'new_access_token_123',
        refreshToken: 'new_refresh_token_123'
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await authService.register(username, password);

      expect(mockApi.post).toHaveBeenCalledWith('/auth/register', {
        username,
        password,
        userName: 'newuser'
      });

      expect(result).toEqual(mockResponse);
    });

    it('должен обрабатывать ошибки регистрации', async () => {
      const username = 'existinguser';
      const password = 'password';
      
      const mockResponse: RegisterResponse = {
        success: false,
        error: 'User already exists'
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await authService.register(username, password);

      expect(result).toEqual(mockResponse);
      expect(localStorageMock.getItem('access_token')).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    it('должен успешно обновлять токен доступа', async () => {
      localStorageMock.setItem('refresh_token', 'existing_refresh_token');
      
      const mockResponse: RefreshTokenResponse = {
        success: true,
        accessToken: 'new_access_token_456',
        refreshToken: 'new_refresh_token_456'
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await authService.refreshAccessToken();

      expect(mockApi.post).toHaveBeenCalledWith('/auth/refresh', {
        refreshToken: 'existing_refresh_token'
      });

      expect(result).toBe('new_access_token_456');
      expect(localStorageMock.getItem('access_token')).toBe('new_access_token_456');
      expect(localStorageMock.getItem('refresh_token')).toBe('new_refresh_token_456');
    });

    it('должен использовать старый refresh токен, если новый не предоставлен', async () => {
      localStorageMock.setItem('refresh_token', 'existing_refresh_token');
      
      const mockResponse: RefreshTokenResponse = {
        success: true,
        accessToken: 'new_access_token_456'
        // refreshToken отсутствует
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await authService.refreshAccessToken();

      expect(result).toBe('new_access_token_456');
      expect(localStorageMock.getItem('access_token')).toBe('new_access_token_456');
      expect(localStorageMock.getItem('refresh_token')).toBe('existing_refresh_token'); // старый токен
    });

    it('должен возвращать null, если нет refresh токена', async () => {
      const result = await authService.refreshAccessToken();

      expect(result).toBeNull();
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it('должен очищать токены при ошибке обновления', async () => {
      localStorageMock.setItem('refresh_token', 'invalid_refresh_token');
      localStorageMock.setItem('access_token', 'old_access_token');

      mockApi.post.mockRejectedValue(new Error('Invalid refresh token'));

      const result = await authService.refreshAccessToken();

      expect(result).toBeNull();
      expect(localStorageMock.getItem('access_token')).toBeNull();
      expect(localStorageMock.getItem('refresh_token')).toBeNull();
    });

    it('должен обрабатывать неуспешный ответ сервера', async () => {
      localStorageMock.setItem('refresh_token', 'existing_refresh_token');
      
      const mockResponse: RefreshTokenResponse = {
        success: false,
        error: 'Refresh token expired'
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await authService.refreshAccessToken();

      expect(result).toBeNull();
    });
  });

  describe('checkPasswordAuthEnabled', () => {
    it('должен проверять доступность аутентификации по паролю', async () => {
      const mockResponse = { enabled: true };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await authService.checkPasswordAuthEnabled();

      expect(mockApi.get).toHaveBeenCalledWith('/auth/password-auth-enabled');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('logout', () => {
    it('должен успешно выходить из системы', async () => {
      localStorageMock.setItem('access_token', 'test_access_token');
      localStorageMock.setItem('refresh_token', 'test_refresh_token');

      mockApi.post.mockResolvedValue({});

      await authService.logout();

      expect(mockApi.post).toHaveBeenCalledWith('/auth/logout');
      expect(localStorageMock.getItem('access_token')).toBeNull();
      expect(localStorageMock.getItem('refresh_token')).toBeNull();
      expect(localStorageMock.getItem('auth_token')).toBeNull();
    });

    it('должен очищать токены даже при ошибке API', async () => {
      localStorageMock.setItem('access_token', 'test_access_token');
      localStorageMock.setItem('refresh_token', 'test_refresh_token');

      mockApi.post.mockRejectedValue(new Error('Server error'));

      await authService.logout();

      expect(localStorageMock.getItem('access_token')).toBeNull();
      expect(localStorageMock.getItem('refresh_token')).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('должен получать данные текущего пользователя', async () => {
      const mockUser = {
        user_id: 1,
        user_name: 'Test User',
        user_telegram_id: 0,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        authMethod: 'password'
      };

      mockApi.get.mockResolvedValue(mockUser);

      const result = await authService.getCurrentUser();

      expect(mockApi.get).toHaveBeenCalledWith('/auth/me');
      expect(result).toEqual(mockUser);
    });
  });

  describe('validateToken', () => {
    it('должен возвращать true для действительного токена', async () => {
      mockApi.get.mockResolvedValue({});

      const result = await authService.validateToken();

      expect(mockApi.get).toHaveBeenCalledWith('/auth/validate');
      expect(result).toBe(true);
    });

    it('должен возвращать false для недействительного токена', async () => {
      mockApi.get.mockRejectedValue(new Error('Unauthorized'));

      const result = await authService.validateToken();

      expect(result).toBe(false);
    });
  });

  describe('Управление токенами', () => {
    it('должен сохранять и получать access токен', () => {
      authService['saveTokens']('test_access_token', 'test_refresh_token');

      expect(authService.getToken()).toBe('test_access_token');
      expect(authService.getAccessToken()).toBe('test_access_token');
      expect(authService.getRefreshToken()).toBe('test_refresh_token');
    });

    it('должен поддерживать обратную совместимость с auth_token', () => {
      localStorageMock.setItem('auth_token', 'legacy_token');

      expect(authService.getToken()).toBe('legacy_token');
      expect(authService.getAccessToken()).toBe('legacy_token');
    });

    it('должен приоритизировать access_token над auth_token', () => {
      localStorageMock.setItem('auth_token', 'legacy_token');
      localStorageMock.setItem('access_token', 'new_token');

      expect(authService.getToken()).toBe('new_token');
    });

    it('должен очищать все токены', () => {
      localStorageMock.setItem('access_token', 'test_access_token');
      localStorageMock.setItem('refresh_token', 'test_refresh_token');
      localStorageMock.setItem('auth_token', 'test_auth_token');

      authService['clearTokens']();

      expect(localStorageMock.getItem('access_token')).toBeNull();
      expect(localStorageMock.getItem('refresh_token')).toBeNull();
      expect(localStorageMock.getItem('auth_token')).toBeNull();
    });

    it('должен проверять аутентификацию', () => {
      expect(authService.isAuthenticated()).toBe(false);

      localStorageMock.setItem('access_token', 'test_token');
      expect(authService.isAuthenticated()).toBe(true);

      authService['clearTokens']();
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('Обработка состояния в не-браузерном окружении', () => {
    it('должен возвращать null для токенов в серверном окружении', () => {
      // Мокаем серверное окружение
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        configurable: true
      });

      expect(authService.getToken()).toBeNull();
      expect(authService.getRefreshToken()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);

      // Восстанавливаем localStorage
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        configurable: true
      });
    });
  });

  describe('Автоматическое обновление токенов', () => {
    it('должен автоматически обновлять токены при истечении', async () => {
      // Устанавливаем старые токены
      localStorageMock.setItem('access_token', 'expired_token');
      localStorageMock.setItem('refresh_token', 'valid_refresh_token');

      const mockRefreshResponse: RefreshTokenResponse = {
        success: true,
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token'
      };

      mockApi.post.mockResolvedValue(mockRefreshResponse);

      const newToken = await authService.refreshAccessToken();

      expect(newToken).toBe('new_access_token');
      expect(localStorageMock.getItem('access_token')).toBe('new_access_token');
      expect(localStorageMock.getItem('refresh_token')).toBe('new_refresh_token');
    });
  });
});
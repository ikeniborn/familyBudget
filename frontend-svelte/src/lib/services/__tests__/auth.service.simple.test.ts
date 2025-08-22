import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authService } from '../auth.service';
import { api } from '../api';

// Моки
vi.mock('../api');
vi.mock('$app/environment', () => ({
  browser: true,
  dev: false
}));

const mockApi = vi.mocked(api);

describe('AuthService - Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Token management', () => {
    it('должен сохранять и получать access токен', () => {
      // Устанавливаем токен в localStorage
      localStorage.setItem('access_token', 'test_access_token');

      const token = authService.getToken();
      expect(token).toBe('test_access_token');
    });

    it('должен проверять аутентификацию', () => {
      expect(authService.isAuthenticated()).toBe(false);

      localStorage.setItem('access_token', 'test_token');
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('должен поддерживать обратную совместимость с auth_token', () => {
      localStorage.setItem('auth_token', 'legacy_token');
      expect(authService.getToken()).toBe('legacy_token');

      // access_token имеет приоритет
      localStorage.setItem('access_token', 'new_token');
      expect(authService.getToken()).toBe('new_token');
    });
  });

  describe('loginWithPassword', () => {
    it('должен успешно логинить пользователя', async () => {
      const mockResponse = {
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

      const result = await authService.loginWithPassword('testuser', 'password123');

      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', {
        username: 'testuser',
        password: 'password123'
      });

      expect(result).toEqual(mockResponse);
      expect(localStorage.getItem('access_token')).toBe('access_token_123');
      expect(localStorage.getItem('refresh_token')).toBe('refresh_token_123');
    });

    it('должен обрабатывать ошибки входа', async () => {
      const mockResponse = {
        success: false,
        error: 'Invalid credentials'
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await authService.loginWithPassword('testuser', 'wrongpassword');

      expect(result).toEqual(mockResponse);
      expect(localStorage.getItem('access_token')).toBeNull();
    });
  });

  describe('register', () => {
    it('должен успешно регистрировать пользователя', async () => {
      const mockResponse = {
        success: true,
        user: {
          id: 2,
          username: 'newuser',
          firstName: 'New',
          lastName: 'User'
        },
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token'
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await authService.register('newuser', 'password123', 'New', 'User');

      expect(mockApi.post).toHaveBeenCalledWith('/auth/register', {
        username: 'newuser',
        password: 'password123',
        firstName: 'New',
        lastName: 'User'
      });

      expect(result).toEqual(mockResponse);
      expect(localStorage.getItem('access_token')).toBe('new_access_token');
      expect(localStorage.getItem('refresh_token')).toBe('new_refresh_token');
    });
  });

  describe('logout', () => {
    it('должен очищать токены', async () => {
      localStorage.setItem('access_token', 'test_token');
      localStorage.setItem('refresh_token', 'test_refresh');

      mockApi.post.mockResolvedValue({});

      await authService.logout();

      expect(mockApi.post).toHaveBeenCalledWith('/auth/logout');
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    it('должен обновлять токен доступа', async () => {
      localStorage.setItem('refresh_token', 'existing_refresh_token');
      
      const mockResponse = {
        success: true,
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token'
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await authService.refreshAccessToken();

      expect(mockApi.post).toHaveBeenCalledWith('/auth/refresh', {
        refreshToken: 'existing_refresh_token'
      });

      expect(result).toBe('new_access_token');
      expect(localStorage.getItem('access_token')).toBe('new_access_token');
      expect(localStorage.getItem('refresh_token')).toBe('new_refresh_token');
    });

    it('должен возвращать null без refresh токена', async () => {
      const result = await authService.refreshAccessToken();
      expect(result).toBeNull();
      expect(mockApi.post).not.toHaveBeenCalled();
    });
  });
});
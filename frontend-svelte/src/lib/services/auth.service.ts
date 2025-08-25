import { api } from './api';
import type { User } from '$types';
import { startTelegramOAuth } from '$lib/utils/telegram-oauth';
import type { TelegramAuthData } from '$lib/utils/telegram-oauth';
import { browser } from '$app/environment';

export interface LoginData {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface PasswordAuthResponse {
  success: boolean;
  user?: {
    id: number;
    username: string;
    firstName?: string;
    lastName?: string;
  };
  accessToken?: string;
  refreshToken?: string;
  token?: string; // Обратная совместимость
  error?: string;
}

export interface RegisterResponse {
  success: boolean;
  user?: {
    id: number;
    username: string;
    firstName?: string;
    lastName?: string;
  };
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

class AuthService {
  async login(data: LoginData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/telegram', data);
    if (response.token) {
      this.saveToken(response.token);
    }
    return response;
  }

  /**
   * Initiates Telegram OAuth redirect flow
   * @param botName - Telegram bot username
   * @param returnUrl - URL to return to after authentication
   */
  startTelegramOAuth(botName: string, returnUrl?: string): void {
    console.log('authService.startTelegramOAuth вызвана!');
    console.log('browser:', browser);
    console.log('botName:', botName);
    console.log('returnUrl:', returnUrl);
    
    if (!browser) {
      console.log('Выход из authService.startTelegramOAuth - browser = false');
      return;
    }
    
    console.log('Вызов startTelegramOAuth из utils...');
    startTelegramOAuth(botName, returnUrl);
  }

  /**
   * Login with Telegram OAuth data (from redirect callback)
   * @param authData - Telegram auth data from OAuth callback
   */
  async loginWithTelegramOAuth(authData: TelegramAuthData): Promise<AuthResponse> {
    // Convert TelegramAuthData to LoginData format
    const loginData: LoginData = {
      id: authData.id,
      first_name: authData.first_name,
      last_name: authData.last_name,
      username: authData.username,
      photo_url: authData.photo_url,
      auth_date: authData.auth_date,
      hash: authData.hash
    };
    
    return this.login(loginData);
  }

  async loginWithPassword(username: string, password: string): Promise<PasswordAuthResponse> {
    try {
      const response = await api.post<any>('/auth/login', {
        username,
        password
      });
      
      // Backend возвращает {user: {...}, message: "..."}
      // Преобразуем в ожидаемый формат
      const result: PasswordAuthResponse = {
        success: true,
        user: {
          id: response.user.id,
          username: response.user.username,
          firstName: response.user.user_name?.split(' ')[0],
          lastName: response.user.user_name?.split(' ')[1]
        }
      };
      
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Login failed'
      };
    }
  }

  async register(username: string, password: string, firstName?: string, lastName?: string): Promise<RegisterResponse> {
    try {
      // Объединяем firstName и lastName в user_name
      const user_name = [firstName, lastName].filter(Boolean).join(' ').trim() || username;
      
      const response = await api.post<any>('/auth/register', {
        username,
        password,
        user_name,
        email: null // Optional field
      });
      
      // Backend возвращает {user: {...}, message: "..."}
      // Преобразуем в ожидаемый формат
      const result: RegisterResponse = {
        success: true,
        user: {
          id: response.user.id,
          username: response.user.username,
          firstName: response.user.user_name?.split(' ')[0],
          lastName: response.user.user_name?.split(' ')[1]
        }
      };
      
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Registration failed'
      };
    }
  }
  
  async refreshAccessToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      return null;
    }
    
    try {
      const response = await api.post<any>('/auth/refresh', {
        refreshToken
      });
      
      // Обрабатываем новую структуру ответа от сервера
      if (response.success && response.tokens?.accessToken) {
        this.saveTokens(response.tokens.accessToken, response.tokens.refreshToken || refreshToken);
        return response.tokens.accessToken;
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
      this.clearTokens();
    }
    
    return null;
  }

  async checkPasswordAuthEnabled(): Promise<{ enabled: boolean }> {
    return api.get<{ enabled: boolean }>('/auth/password-auth-enabled');
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      this.clearTokens();
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await api.get<any>('/auth/me');
    // Backend возвращает {user: {...}}
    if (response && response.user) {
      return response.user;
    }
    // FastAPI возвращает user напрямую
    return response;
  }

  async validateToken(): Promise<boolean> {
    try {
      await api.get('/auth/validate');
      return true;
    } catch {
      return false;
    }
  }

  private saveToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  private saveTokens(accessToken: string, refreshToken?: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('auth_token', accessToken); // Обратная совместимость
      
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }
    }
  }

  
  private clearTokens(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth_token'); // Обратная совместимость
    }
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token') || localStorage.getItem('auth_token');
    }
    return null;
  }
  
  getAccessToken(): string | null {
    return this.getToken();
  }
  
  getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('refresh_token');
    }
    return null;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const authService = new AuthService();
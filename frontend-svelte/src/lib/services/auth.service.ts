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
  token?: string;
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
    if (!browser) return;
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
    const response = await api.post<PasswordAuthResponse>('/auth/password', {
      username,
      password
    });
    if (response.token) {
      this.saveToken(response.token);
    }
    return response;
  }

  async checkPasswordAuthEnabled(): Promise<{ enabled: boolean }> {
    return api.get<{ enabled: boolean }>('/auth/password-enabled');
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      this.clearToken();
    }
  }

  async getCurrentUser(): Promise<User> {
    return api.get<User>('/auth/me');
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

  private clearToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const authService = new AuthService();
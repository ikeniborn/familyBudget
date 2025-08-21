import { BaseService } from './base.service';
import { api } from './api';
import type { User } from '$lib/types';

export interface CreateUserData {
  user_name: string;
  user_telegram_id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface UpdateUserData {
  user_name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface UserProfile {
  user_id: number;
  user_name: string;
  user_telegram_id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  authMethod?: 'telegram' | 'password';
  created_at?: string;
  updated_at?: string;
}

export interface UserSettings {
  theme?: 'light' | 'dark' | 'system';
  language?: 'ru' | 'en';
  currency?: 'RUB' | 'USD' | 'EUR';
  date_format?: 'dd.mm.yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd';
  notifications?: {
    email?: boolean;
    telegram?: boolean;
    push?: boolean;
  };
  default_period_id?: number;
}

class UserService extends BaseService<User, CreateUserData, UpdateUserData> {
  constructor() {
    super('/users');
  }

  /**
   * Получить текущего пользователя
   */
  async getCurrentUser(): Promise<UserProfile> {
    try {
      return await api.get<UserProfile>('/auth/me');
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении данных пользователя');
    }
  }

  /**
   * Поиск пользователей
   */
  async searchUsers(query: string): Promise<User[]> {
    try {
      return await api.get<User[]>(`${this.endpoint}/search`, {
        params: { q: query }
      });
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при поиске пользователей');
    }
  }

  /**
   * Обновить профиль текущего пользователя
   */
  async updateProfile(data: UpdateUserData): Promise<UserProfile> {
    try {
      return await api.put<UserProfile>('/auth/profile', data);
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при обновлении профиля');
    }
  }

  /**
   * Получить настройки пользователя
   */
  async getSettings(): Promise<UserSettings> {
    try {
      return await api.get<UserSettings>('/auth/settings');
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении настроек');
    }
  }

  /**
   * Обновить настройки пользователя
   */
  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    try {
      return await api.put<UserSettings>('/auth/settings', settings);
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при обновлении настроек');
    }
  }

  /**
   * Получить статистику пользователя
   */
  async getUserStats(): Promise<{
    periods_count: number;
    records_count: number;
    total_budget: number;
    total_actual: number;
    categories_count: number;
    last_activity: string;
  }> {
    try {
      return await api.get('/auth/stats');
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении статистики');
    }
  }

  /**
   * Изменить пароль (если используется парольная аутентификация)
   */
  async changePassword(data: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<void> {
    try {
      if (data.new_password !== data.confirm_password) {
        throw new Error('Пароли не совпадают');
      }

      await api.post('/auth/change-password', {
        current_password: data.current_password,
        new_password: data.new_password
      });
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при смене пароля');
    }
  }

  /**
   * Удалить учетную запись
   */
  async deleteAccount(): Promise<void> {
    try {
      await api.delete('/auth/account');
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при удалении аккаунта');
    }
  }

  /**
   * Экспорт всех данных пользователя
   */
  async exportUserData(): Promise<Blob> {
    try {
      return await api.get<Blob>('/auth/export', {
        responseType: 'blob'
      });
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при экспорте данных');
    }
  }

  /**
   * Получить активные сессии пользователя
   */
  async getActiveSessions(): Promise<Array<{
    session_id: string;
    ip_address: string;
    user_agent: string;
    created_at: string;
    last_activity: string;
    is_current: boolean;
  }>> {
    try {
      return await api.get('/auth/sessions');
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении сессий');
    }
  }

  /**
   * Завершить сессию
   */
  async terminateSession(sessionId: string): Promise<void> {
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при завершении сессии');
    }
  }

  /**
   * Завершить все сессии кроме текущей
   */
  async terminateAllOtherSessions(): Promise<void> {
    try {
      await api.post('/auth/sessions/terminate-others');
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при завершении сессий');
    }
  }

  /**
   * Проверить доступность имени пользователя
   */
  async checkUsernameAvailability(username: string): Promise<{ available: boolean }> {
    try {
      return await api.get(`${this.endpoint}/check-username`, {
        params: { username }
      });
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при проверке доступности имени');
    }
  }

  /**
   * Получить рекомендации по безопасности
   */
  async getSecurityRecommendations(): Promise<{
    password_strength?: 'weak' | 'medium' | 'strong';
    two_factor_enabled: boolean;
    last_password_change?: string;
    suspicious_activities: Array<{
      type: string;
      description: string;
      date: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  }> {
    try {
      return await api.get('/auth/security');
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении рекомендаций безопасности');
    }
  }

  /**
   * Получить лог активности пользователя
   */
  async getActivityLog(params: {
    page?: number;
    limit?: number;
    date_from?: string;
    date_to?: string;
    action_type?: string;
  } = {}): Promise<{
    data: Array<{
      id: number;
      action_type: string;
      description: string;
      ip_address: string;
      user_agent: string;
      created_at: string;
    }>;
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      return await api.get('/auth/activity', { params });
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при получении лога активности');
    }
  }
}

// Export singleton instance
export const userService = new UserService();
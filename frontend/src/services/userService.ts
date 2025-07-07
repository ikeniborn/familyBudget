import { BaseService } from './baseService';
import apiClient, { handleApiError } from './apiClient';
import type { User } from '../types';

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

class UserService extends BaseService<User, CreateUserData, UpdateUserData> {
  constructor() {
    super('/users');
  }

  // Получить текущего пользователя
  async getCurrentUser(): Promise<User> {
    try {
      const response = await apiClient.get('/auth/me');
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Поиск пользователей
  async searchUsers(query: string): Promise<User[]> {
    try {
      const response = await apiClient.get(`${this.endpoint}/search`, {
        params: { q: query }
      });
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }
}

export const userService = new UserService();
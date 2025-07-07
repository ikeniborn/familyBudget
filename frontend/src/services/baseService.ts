import type { AxiosResponse } from 'axios';
import apiClient, { handleApiError } from './apiClient';

export abstract class BaseService<T, CreateT = Partial<T>, UpdateT = Partial<T>> {
  protected endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  // Получить все записи
  async getAll(params?: Record<string, any>): Promise<T[]> {
    try {
      const response: AxiosResponse<T[]> = await apiClient.get(
        this.endpoint,
        { params }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Получить запись по ID
  async getById(id: number | string): Promise<T> {
    try {
      const response: AxiosResponse<T> = await apiClient.get(
        `${this.endpoint}/${id}`
      );
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Создать новую запись
  async create(data: CreateT): Promise<T> {
    try {
      const response: AxiosResponse<T> = await apiClient.post(
        this.endpoint,
        data
      );
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Обновить запись
  async update(id: number | string, data: UpdateT): Promise<T> {
    try {
      const response: AxiosResponse<T> = await apiClient.put(
        `${this.endpoint}/${id}`,
        data
      );
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Удалить запись
  async delete(id: number | string): Promise<void> {
    try {
      await apiClient.delete(`${this.endpoint}/${id}`);
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Частичное обновление записи
  async patch(id: number | string, data: Partial<UpdateT>): Promise<T> {
    try {
      const response: AxiosResponse<T> = await apiClient.patch(
        `${this.endpoint}/${id}`,
        data
      );
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Получить записи с пагинацией
  async getPaginated(params: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    [key: string]: any;
  } = {}): Promise<{
    data: T[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const response: AxiosResponse<{
        data: T[];
        total: number;
        page: number;
        totalPages: number;
      }> = await apiClient.get(this.endpoint, { params });
      
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }
}
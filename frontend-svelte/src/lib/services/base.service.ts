import { api } from './api';

export abstract class BaseService<T, CreateT = Partial<T>, UpdateT = Partial<T>> {
  protected endpoint: string;

  constructor(endpoint: string) {
    // Ensure endpoint has trailing slash for FastAPI compatibility
    this.endpoint = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
  }

  // Get all records
  async getAll(params?: Record<string, any>): Promise<T[]> {
    try {
      const response = await api.get<T[]>(this.endpoint, { params });
      return response;
    } catch (error: any) {
      throw new Error(error.message || `Failed to fetch ${this.endpoint}`);
    }
  }

  // Get record by ID
  async getById(id: number | string): Promise<T> {
    try {
      const response = await api.get<T>(`${this.endpoint}/${id}`);
      return response;
    } catch (error: any) {
      throw new Error(error.message || `Failed to fetch ${this.endpoint}/${id}`);
    }
  }

  // Create new record
  async create(data: CreateT): Promise<T> {
    try {
      const response = await api.post<T>(this.endpoint, data);
      return response;
    } catch (error: any) {
      throw new Error(error.message || `Failed to create ${this.endpoint}`);
    }
  }

  // Update record
  async update(id: number | string, data: UpdateT): Promise<T> {
    try {
      const response = await api.put<T>(`${this.endpoint}/${id}`, data);
      return response;
    } catch (error: any) {
      throw new Error(error.message || `Failed to update ${this.endpoint}/${id}`);
    }
  }

  // Delete record
  async delete(id: number | string): Promise<void> {
    try {
      await api.delete(`${this.endpoint}/${id}`);
    } catch (error: any) {
      throw new Error(error.message || `Failed to delete ${this.endpoint}/${id}`);
    }
  }

  // Bulk delete records
  async bulkDelete(ids: (number | string)[]): Promise<void> {
    try {
      // Most APIs don't support bulk delete, so we'll delete one by one
      await Promise.all(ids.map(id => this.delete(id)));
    } catch (error: any) {
      throw new Error(error.message || `Failed to delete multiple ${this.endpoint} records`);
    }
  }

  // Partial update record
  async patch(id: number | string, data: Partial<UpdateT>): Promise<T> {
    try {
      const response = await api.patch<T>(`${this.endpoint}/${id}`, data);
      return response;
    } catch (error: any) {
      throw new Error(error.message || `Failed to patch ${this.endpoint}/${id}`);
    }
  }

  // Get records with pagination
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
      const response = await api.get<{
        data: T[];
        total: number;
        page: number;
        totalPages: number;
      }>(this.endpoint, { params });
      
      return response;
    } catch (error: any) {
      throw new Error(error.message || `Failed to fetch paginated ${this.endpoint}`);
    }
  }
}
import { api } from './api';
import type { Registry, PaginatedResponse } from '$types';

export interface CreateRegistryDto {
  period_id: number;
  financial_center_id: number;
  cost_center_id: number;
  nomenclature_id: number;
  row_type: 'plan' | 'fact';
  amount: number;
  description?: string;
}

export interface UpdateRegistryDto extends Partial<CreateRegistryDto> {}

export interface RegistryFilters {
  period_id?: number;
  financial_center_id?: number;
  cost_center_id?: number;
  nomenclature_id?: number;
  row_type?: 'plan' | 'fact';
  date_from?: string;
  date_to?: string;
}

class RegistryService {
  async getAll(params?: {
    page?: number;
    pageSize?: number;
    filters?: RegistryFilters;
  }): Promise<PaginatedResponse<Registry>> {
    return api.get<PaginatedResponse<Registry>>('/registry', { params });
  }

  async getById(id: number): Promise<Registry> {
    return api.get<Registry>(`/registry/${id}`);
  }

  async create(data: CreateRegistryDto): Promise<Registry> {
    return api.post<Registry>('/registry', data);
  }

  async createBulk(data: CreateRegistryDto[]): Promise<Registry[]> {
    return api.post<Registry[]>('/registry/bulk', data);
  }

  async update(id: number, data: UpdateRegistryDto): Promise<Registry> {
    return api.put<Registry>(`/registry/${id}`, data);
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/registry/${id}`);
  }

  async deleteBulk(ids: number[]): Promise<void> {
    await api.post('/registry/bulk-delete', { ids });
  }

  async getSummary(filters?: RegistryFilters): Promise<{
    total_plan: number;
    total_fact: number;
    difference: number;
    execution_rate: number;
  }> {
    return api.get('/registry/summary', { params: filters });
  }

  async export(format: 'csv' | 'excel', filters?: RegistryFilters): Promise<Blob> {
    const response = await api.get(`/registry/export/${format}`, {
      params: filters,
      responseType: 'blob'
    });
    return response as unknown as Blob;
  }

  async import(file: File, format: 'csv' | 'excel'): Promise<{
    imported: number;
    errors: string[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/registry/import/${format}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }
}

export const registryService = new RegistryService();
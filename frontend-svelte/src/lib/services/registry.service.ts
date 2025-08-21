import { api } from './api';
import type { Registry, PaginatedResponse } from '$types';

export interface CreateRegistryData {
  operation_dttm: string;
  period_id: number;
  financial_center_id: number;
  cost_center_id?: number;
  nomenclature_id: number;
  cost_sum: number;
  comment_description?: string;
  row_type_id: number;
}

export interface UpdateRegistryData {
  operation_dttm?: string;
  period_id?: number;
  financial_center_id?: number;
  cost_center_id?: number;
  nomenclature_id?: number;
  cost_sum?: number;
  comment_description?: string;
  row_type_id?: number;
}

export interface RegistryFilters {
  period_id?: number;
  financial_center_id?: number;
  cost_center_id?: number;
  nomenclature_id?: number;
  row_type_id?: number;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
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

  async create(data: CreateRegistryData): Promise<Registry> {
    return api.post<Registry>('/registry', data);
  }

  async createBulk(data: CreateRegistryData[]): Promise<Registry[]> {
    return api.post<Registry[]>('/registry/bulk', data);
  }

  async update(id: number, data: UpdateRegistryData): Promise<Registry> {
    return api.put<Registry>(`/registry/${id}`, data);
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/registry/${id}`);
  }

  async deleteBulk(ids: number[]): Promise<void> {
    await api.post('/registry/bulk-delete', { ids });
  }

  // Get records with filters
  async getWithFilters(filters: RegistryFilters): Promise<Registry[]> {
    const response = await api.get<Registry[]>('/registry', { params: filters });
    return response;
  }

  // Get facts (row_type_id = 1)
  async getFacts(filters?: Omit<RegistryFilters, 'row_type_id'>): Promise<Registry[]> {
    return this.getWithFilters({ ...filters, row_type_id: 1 });
  }

  // Get plans/budget (row_type_id = 2)
  async getBudget(filters?: Omit<RegistryFilters, 'row_type_id'>): Promise<Registry[]> {
    return this.getWithFilters({ ...filters, row_type_id: 2 });
  }

  // Get summary by period
  async getSummaryByPeriod(periodId: number): Promise<{
    total_facts: number;
    total_budget: number;
    variance: number;
    variance_percent: number;
  }> {
    return api.get(`/registry/summary/period/${periodId}`);
  }

  // Get stats by nomenclature
  async getStatsByNomenclature(params: {
    period_id?: number;
    financial_center_id?: number;
  }): Promise<Array<{
    nomenclature_id: number;
    nomenclature_name: string;
    total_facts: number;
    total_budget: number;
    variance: number;
    variance_percent: number;
  }>> {
    return api.get('/registry/stats/nomenclature', { params });
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
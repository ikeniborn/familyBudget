import { BaseService } from './baseService';
import apiClient, { handleApiError } from './apiClient';
import type { Registry } from '../types';

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

class RegistryService extends BaseService<Registry, CreateRegistryData, UpdateRegistryData> {
  constructor() {
    super('/registry');
  }

  // Получить записи с фильтрами
  async getWithFilters(filters: RegistryFilters): Promise<Registry[]> {
    try {
      const response = await apiClient.get(this.endpoint, { params: filters });
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Получить факты (row_type_id = 1)
  async getFacts(filters?: Omit<RegistryFilters, 'row_type_id'>): Promise<Registry[]> {
    return this.getWithFilters({ ...filters, row_type_id: 1 });
  }

  // Получить планы/бюджет (row_type_id = 2)
  async getBudget(filters?: Omit<RegistryFilters, 'row_type_id'>): Promise<Registry[]> {
    return this.getWithFilters({ ...filters, row_type_id: 2 });
  }

  // Получить сводку по периоду
  async getSummaryByPeriod(periodId: number): Promise<{
    total_facts: number;
    total_budget: number;
    variance: number;
    variance_percent: number;
  }> {
    try {
      const response = await apiClient.get(`${this.endpoint}/summary/period/${periodId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Получить статистику по номенклатуре
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
    try {
      const response = await apiClient.get(`${this.endpoint}/stats/nomenclature`, { params });
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }
}

export const registryService = new RegistryService();
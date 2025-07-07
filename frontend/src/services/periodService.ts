import { BaseService } from './baseService';
import apiClient, { handleApiError } from './apiClient';
import type { Period } from '../types';

export interface CreatePeriodData {
  period_dt: string;
  period_name: string;
  period_ru_name: string;
}

export interface UpdatePeriodData {
  period_dt?: string;
  period_name?: string;
  period_ru_name?: string;
}

class PeriodService extends BaseService<Period, CreatePeriodData, UpdatePeriodData> {
  constructor() {
    super('/periods');
  }

  // Получить активные периоды
  async getActivePeriods(): Promise<Period[]> {
    try {
      const response = await apiClient.get(`${this.endpoint}/active`);
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Получить текущий период
  async getCurrentPeriod(): Promise<Period | null> {
    try {
      const response = await apiClient.get(`${this.endpoint}/current`);
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }
}

export const periodService = new PeriodService();
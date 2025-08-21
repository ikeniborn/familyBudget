import { api } from './api';
import type { Period, PaginatedResponse } from '$types';

export interface CreatePeriodDto {
  name: string;
  start_date: string;
  end_date: string;
}

export interface UpdatePeriodDto extends Partial<CreatePeriodDto> {
  is_closed?: boolean;
}

class PeriodsService {
  async getAll(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<PaginatedResponse<Period>> {
    return api.get<PaginatedResponse<Period>>('/periods', { params });
  }

  async getById(id: number): Promise<Period> {
    return api.get<Period>(`/periods/${id}`);
  }

  async getCurrent(): Promise<Period | null> {
    try {
      return await api.get<Period>('/periods/current');
    } catch {
      return null;
    }
  }

  async create(data: CreatePeriodDto): Promise<Period> {
    return api.post<Period>('/periods', data);
  }

  async update(id: number, data: UpdatePeriodDto): Promise<Period> {
    return api.put<Period>(`/periods/${id}`, data);
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/periods/${id}`);
  }

  async close(id: number): Promise<Period> {
    return api.post<Period>(`/periods/${id}/close`);
  }

  async reopen(id: number): Promise<Period> {
    return api.post<Period>(`/periods/${id}/reopen`);
  }
}

export const periodsService = new PeriodsService();
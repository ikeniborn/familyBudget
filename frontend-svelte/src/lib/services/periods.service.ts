import { BaseService } from './base.service';
import type { Period, AdminPeriod } from '$types';
import api from './api';

export interface CreatePeriodData {
  period_name: string;
  period_year: number;
  period_month: number;
  is_active?: boolean;  // Optional, defaults to true on backend
}

export interface UpdatePeriodData {
  period_name?: string;
  period_year?: number;
  period_month?: number;
  is_active?: boolean;  // For updating active status
}

class PeriodsService extends BaseService<Period, CreatePeriodData, UpdatePeriodData> {
  constructor() {
    super('/periods');
  }

  // Override getAll to include user_id parameter
  async getByUserId(_userId: number): Promise<Period[]> {
    try {
      const response = await this.getAll();
      // Map period_id to id for consistency with UI components
      return response.map((p: any) => ({
        ...p,
        id: p.period_id,
      }));
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch periods');
    }
  }

  // Admin API - Get all periods with user information
  async getAllWithUsers(): Promise<AdminPeriod[]> {
    try {
      const response = await api.get<AdminPeriod[]>('/admin/periods');
      // Map period_id to id for consistency with UI components
      return response.map((p: any) => ({
        ...p,
        id: p.period_id,
      }));
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch admin periods');
    }
  }

  // Export to CSV
  async exportToCsv(data: Period[] | AdminPeriod[], isAdmin: boolean = false): Promise<string> {
    const headers = isAdmin 
      ? ['ID', 'Название', 'Год', 'Месяц', 'Пользователь', 'Email', 'Username', 'Дата создания']
      : ['ID', 'Название', 'Год', 'Месяц', 'Дата создания'];
    
    const csvContent = [
      headers.join(','),
      ...data.map(p => {
        const baseData = [
          p.period_id,
          `"${p.period_name}"`,
          p.period_year,
          p.period_month,
        ];
        
        if (isAdmin && 'user_name' in p) {
          const adminPeriod = p as AdminPeriod;
          baseData.push(
            `"${adminPeriod.user_name}"`,
            `"${adminPeriod.user_email || ''}"`,
            `"${adminPeriod.username || ''}"`,
          );
        }
        
        baseData.push(p.created_at ? new Date(p.created_at).toLocaleDateString('ru-RU') : '');
        
        return baseData.join(',');
      })
    ].join('\n');

    return csvContent;
  }

  // Import from CSV
  async importFromCsv(csvText: string, _userId: number): Promise<CreatePeriodData[]> {
    const lines = csvText.split('\n').slice(1); // Skip header
    const newPeriods: CreatePeriodData[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [, name, year, month] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      newPeriods.push({
        period_name: name,
        period_year: Number(year),
        period_month: Number(month),
      });
    }

    return newPeriods;
  }
}

export const periodsService = new PeriodsService();
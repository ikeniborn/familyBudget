import { BaseService } from './base.service';
import type { Period } from '$types';

export interface CreatePeriodData {
  period_name: string;
  period_year: number;
  period_month: number;
  user_id: number;
}

export interface UpdatePeriodData {
  period_name?: string;
  period_year?: number;
  period_month?: number;
}

class PeriodsService extends BaseService<Period, CreatePeriodData, UpdatePeriodData> {
  constructor() {
    super('/periods');
  }

  // Override getAll to include user_id parameter
  async getByUserId(userId: number): Promise<Period[]> {
    try {
      const response = await this.getAll({ user_id: userId });
      // Map period_id to id for consistency with UI components
      return response.map((p: any) => ({
        ...p,
        id: p.period_id,
      }));
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch periods');
    }
  }

  // Export to CSV
  async exportToCsv(data: Period[]): Promise<string> {
    const csvContent = [
      ['ID', 'Название', 'Год', 'Месяц', 'Дата создания'].join(','),
      ...data.map(p => [
        p.period_id,
        `"${p.period_name}"`,
        p.period_year,
        p.period_month,
        p.created_at ? new Date(p.created_at).toLocaleDateString('ru-RU') : '',
      ].join(','))
    ].join('\n');

    return csvContent;
  }

  // Import from CSV
  async importFromCsv(csvText: string, userId: number): Promise<CreatePeriodData[]> {
    const lines = csvText.split('\n').slice(1); // Skip header
    const newPeriods: CreatePeriodData[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [, name, year, month] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      newPeriods.push({
        period_name: name,
        period_year: Number(year),
        period_month: Number(month),
        user_id: userId,
      });
    }

    return newPeriods;
  }
}

export const periodsService = new PeriodsService();
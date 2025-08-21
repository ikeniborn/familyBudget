import { BaseService } from './base.service';
import type { Period } from '$types';

export interface CreatePeriodData {
  period_name: string;
  period_year: number;
  period_month: number;
  period_order: number;
  user_id: number;
  is_active?: boolean;
}

export interface UpdatePeriodData {
  period_name?: string;
  period_year?: number;
  period_month?: number;
  period_order?: number;
  is_active?: boolean;
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
    const monthNames = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];

    const csvContent = [
      ['ID', 'Название', 'Год', 'Месяц', 'Порядок', 'Активен', 'Дата создания'].join(','),
      ...data.map(p => [
        p.period_id,
        `"${p.period_name}"`,
        p.period_year,
        p.period_month,
        p.period_order,
        p.is_active ? 'Да' : 'Нет',
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
      
      const [, name, year, month, order, isActive] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      newPeriods.push({
        period_name: name,
        period_year: Number(year),
        period_month: Number(month),
        period_order: Number(order),
        is_active: isActive === 'Да',
        user_id: userId,
      });
    }

    return newPeriods;
  }
}

export const periodsService = new PeriodsService();
import { BaseService } from './base.service';
import type { FinancialCenter } from '$types';

export interface CreateFinancialCenterData {
  financial_center_name: string;
  financial_center_order: number;
  user_id: number;
  is_active?: boolean;
}

export interface UpdateFinancialCenterData {
  financial_center_name?: string;
  financial_center_order?: number;
  is_active?: boolean;
}

class FinancialCentersService extends BaseService<FinancialCenter, CreateFinancialCenterData, UpdateFinancialCenterData> {
  constructor() {
    super('/financial_centers');
  }

  // Override getAll to include user_id parameter
  async getByUserId(userId: number): Promise<FinancialCenter[]> {
    try {
      const response = await this.getAll({ user_id: userId });
      // Map financial_center_id to id for consistency with UI components
      return response.map((fc: any) => ({
        ...fc,
        id: fc.financial_center_id,
      }));
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch financial centers');
    }
  }

  // Export to CSV
  async exportToCsv(data: FinancialCenter[]): Promise<string> {
    const csvContent = [
      ['ID', 'Название ЦФО', 'Порядок', 'Статус', 'Дата создания'].join(','),
      ...data.map(fc => [
        fc.financial_center_id,
        `"${fc.financial_center_name}"`,
        fc.financial_center_order,
        fc.is_active ? 'Активен' : 'Неактивен',
        fc.created_at ? new Date(fc.created_at).toLocaleDateString('ru-RU') : '',
      ].join(','))
    ].join('\n');

    return csvContent;
  }

  // Import from CSV
  async importFromCsv(csvText: string, userId: number): Promise<CreateFinancialCenterData[]> {
    const lines = csvText.split('\n').slice(1); // Skip header
    const newFinancialCenters: CreateFinancialCenterData[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [, name, order, status] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      newFinancialCenters.push({
        financial_center_name: name,
        financial_center_order: Number(order),
        is_active: status === 'Активен',
        user_id: userId,
      });
    }

    return newFinancialCenters;
  }
}

export const financialCentersService = new FinancialCentersService();
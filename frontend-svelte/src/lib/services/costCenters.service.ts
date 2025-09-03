import { BaseService } from './base.service';
import type { CostCenter } from '$types';

export interface CreateCostCenterData {
  cost_center_name: string;
  user_id: number;
  is_active?: boolean;
}

export interface UpdateCostCenterData {
  cost_center_name?: string;
  is_active?: boolean;
}

class CostCentersService extends BaseService<CostCenter, CreateCostCenterData, UpdateCostCenterData> {
  constructor() {
    super('/cost_centers');
  }

  // Override getAll to include user_id parameter
  async getByUserId(userId: number): Promise<CostCenter[]> {
    try {
      const response = await this.getAll({ user_id: userId });
      // Map cost_center_id to id for consistency with UI components
      return response.map((cc: any) => ({
        ...cc,
        id: cc.cost_center_id,
      }));
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch cost centers');
    }
  }

  // Export to CSV
  async exportToCsv(data: CostCenter[]): Promise<string> {
    const csvContent = [
      ['ID', 'Название МВЗ', 'Статус', 'Дата создания'].join(','),
      ...data.map(cc => [
        cc.cost_center_id,
        `"${cc.cost_center_name}"`,
        cc.is_active ? 'Активен' : 'Неактивен',
        cc.created_at ? new Date(cc.created_at).toLocaleDateString('ru-RU') : '',
      ].join(','))
    ].join('\n');

    return csvContent;
  }

  // Import from CSV
  async importFromCsv(csvText: string, userId: number): Promise<CreateCostCenterData[]> {
    const lines = csvText.split('\n').slice(1); // Skip header
    const newCostCenters: CreateCostCenterData[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [, name, status] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      newCostCenters.push({
        cost_center_name: name,
        is_active: status === 'Активен',
        user_id: userId,
      });
    }

    return newCostCenters;
  }
}

export const costCentersService = new CostCentersService();
import { BaseService } from './base.service';
import type { Nomenclature } from '$types';

export interface CreateNomenclatureData {
  nomenclature_name: string;
  nomenclature_type?: 'INCOME' | 'EXPENSE';
  account_name: string;
  bill_name: string;
  operation_name: string;
  is_budget?: boolean;
  is_fact?: boolean;
  parent_id?: number | null;
  color?: string;
  icon?: string;
  user_id: number;
  is_active?: boolean;
}

export interface UpdateNomenclatureData {
  nomenclature_name?: string;
  nomenclature_type?: 'INCOME' | 'EXPENSE';
  account_name?: string;
  bill_name?: string;
  operation_name?: string;
  is_budget?: boolean;
  is_fact?: boolean;
  parent_id?: number | null;
  color?: string;
  icon?: string;
  is_active?: boolean;
}

class NomenclaturesService extends BaseService<Nomenclature, CreateNomenclatureData, UpdateNomenclatureData> {
  constructor() {
    super('/nomenclatures');
  }

  // Override getAll to include user_id parameter
  async getByUserId(userId: number): Promise<Nomenclature[]> {
    try {
      const response = await this.getAll({ user_id: userId });
      // Map nomenclature_id to id for consistency with UI components
      return response.map((n: any) => ({
        ...n,
        id: n.nomenclature_id,
      }));
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch nomenclatures');
    }
  }

  // Export to CSV
  async exportToCsv(data: Nomenclature[]): Promise<string> {
    const csvContent = [
      ['ID', 'Номенклатура', 'Тип', 'Счёт', 'Статья', 'Операция', 'План', 'Факт', 'Статус', 'Дата создания'].join(','),
      ...data.map(n => [
        n.nomenclature_id,
        `"${n.nomenclature_name}"`,
        n.nomenclature_type || 'EXPENSE',
        `"${n.account_name}"`,
        `"${n.bill_name}"`,
        `"${n.operation_name}"`,
        n.is_budget ? 'Да' : 'Нет',
        n.is_fact ? 'Да' : 'Нет',
        n.is_active ? 'Активен' : 'Неактивен',
        n.created_at ? new Date(n.created_at).toLocaleDateString('ru-RU') : '',
      ].join(','))
    ].join('\n');

    return csvContent;
  }

  // Import from CSV
  async importFromCsv(csvText: string, userId: number): Promise<CreateNomenclatureData[]> {
    const lines = csvText.split('\n').slice(1); // Skip header
    const newNomenclatures: CreateNomenclatureData[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [, name, type, account, bill, operation, budget, fact, status] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      newNomenclatures.push({
        nomenclature_name: name,
        nomenclature_type: (type as 'INCOME' | 'EXPENSE') || 'EXPENSE',
        account_name: account || 'Счёт',
        bill_name: bill || 'Статья',
        operation_name: operation || 'Операция',
        is_budget: budget === 'Да',
        is_fact: fact === 'Да',
        is_active: status === 'Активен',
        user_id: userId,
      });
    }

    return newNomenclatures;
  }
}

export const nomenclaturesService = new NomenclaturesService();
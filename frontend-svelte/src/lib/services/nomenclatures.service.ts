import { BaseService } from './base.service';
import type { Nomenclature, AdminNomenclature } from '$types';
import api from './api';

export interface CreateNomenclatureData {
  name: string;  // Updated to match backend schema
  code?: string;
  description?: string;
  nomenclature_type?: 'INCOME' | 'EXPENSE';
  account_name?: string;
  bill_name?: string;
  operation?: string;  // Updated to match backend schema
  is_budget?: boolean;
  is_fact?: boolean;
  is_active?: boolean;
}

export interface UpdateNomenclatureData {
  name?: string;  // Updated to match backend schema
  code?: string;
  description?: string;
  nomenclature_type?: 'INCOME' | 'EXPENSE';
  account_name?: string;
  bill_name?: string;
  operation?: string;  // Updated to match backend schema
  is_budget?: boolean;
  is_fact?: boolean;
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

  // Admin API - Get all nomenclatures with user information
  async getAllWithUsers(): Promise<AdminNomenclature[]> {
    try {
      const response = await api.get<{success: boolean, data: AdminNomenclature[], total: number}>('/admin/references/nomenclature');
      
      
      // The api.get() method returns the full response object {success, data, total}
      if (!response || typeof response !== 'object') {
        console.error('❌ Invalid admin nomenclatures API response:', response);
        throw new Error('Invalid response from admin nomenclatures API');
      }

      // Handle different response formats
      let nomenclatures: any[] = [];
      if (response.success && Array.isArray(response.data)) {
        nomenclatures = response.data;
      } else if (Array.isArray(response)) {
        nomenclatures = response;
      } else if (response.data && Array.isArray(response.data)) {
        nomenclatures = response.data;
      } else {
        console.error('❌ No valid nomenclatures data in response:', response);
        throw new Error('No nomenclatures data in API response');
      }
      
      
      // Map nomenclature_id to id for consistency and ensure all AdminNomenclature fields are present
      const mappedNomenclatures = nomenclatures.map((n: any) => {
        const mappedN = {
          ...n,
          // Ensure id is properly mapped
          id: n.nomenclature_id || n.id,
          
          // Ensure all AdminNomenclature fields are present with fallbacks
          user_name: n.user_name || 'Неизвестный пользователь',
          user_email: n.user_email || null,
          username: n.username || null,
          telegram_id: n.telegram_id ? String(n.telegram_id) : null,
          
          // Ensure other required fields are present
          user_id: n.user_id || 0,
          nomenclature_id: n.nomenclature_id || n.id || 0,
          nomenclature_name: n.nomenclature_name || '',
          nomenclature_type: n.nomenclature_type || 'EXPENSE',
          account_name: n.account_name || undefined,
          bill_name: n.bill_name || undefined,
          operation_name: n.operation_name || undefined,
          operation: n.operation || undefined,
          is_budget: n.is_budget !== undefined ? n.is_budget : true,
          is_fact: n.is_fact !== undefined ? n.is_fact : true,
          is_active: n.is_active !== undefined ? n.is_active : true
        };
        
        return mappedN;
      });

      
      return mappedNomenclatures;
    } catch (error: any) {
      console.error('❌ Error fetching admin nomenclatures:', error);
      console.error('❌ Error stack:', error.stack);
      
      // If it's a network or API error, provide more context
      if (error.response) {
        console.error('❌ Response status:', error.response.status);
        console.error('❌ Response data:', error.response.data);
      }
      
      throw new Error(error.message || 'Failed to fetch admin nomenclatures');
    }
  }

  // Export to CSV - updated to support admin data
  async exportToCsv(data: Nomenclature[] | AdminNomenclature[], isAdmin: boolean = false): Promise<string> {
    const headers = isAdmin
      ? ['ID', 'Номенклатура', 'Тип', 'План', 'Факт', 'Статус', 'Дата создания', 'Пользователь', 'Email', 'Username', 'Telegram ID']
      : ['ID', 'Номенклатура', 'Тип', 'План', 'Факт', 'Статус', 'Дата создания'];
    
    const csvContent = [
      headers.join(','),
      ...data.map(n => {
        const baseData = [
          n.nomenclature_id,
          `"${n.nomenclature_name || n.name}"`,
          n.nomenclature_type || 'EXPENSE',
          n.is_budget ? 'Да' : 'Нет',
          n.is_fact ? 'Да' : 'Нет',
          n.is_active ? 'Активен' : 'Неактивен',
          n.created_at ? new Date(n.created_at).toLocaleDateString('ru-RU') : ''
        ];
        
        if (isAdmin && 'user_name' in n) {
          const adminN = n as AdminNomenclature;
          baseData.push(
            `"${adminN.user_name}"`,
            `"${adminN.user_email || ''}"`,
            `"${adminN.username || ''}"`,
            `"${adminN.telegram_id || ''}"`
          );
        }
        
        return baseData.join(',');
      })
    ].join('\n');

    return csvContent;
  }

  // Export to CSV (legacy method for backward compatibility)
  async exportToCsvLegacy(data: Nomenclature[]): Promise<string> {
    const csvContent = [
      ['ID', 'Номенклатура', 'Тип', 'План', 'Факт', 'Статус', 'Дата создания'].join(','),
      ...data.map(n => [
        n.nomenclature_id,
        `"${n.nomenclature_name || n.name}"`,
        n.nomenclature_type || 'EXPENSE',
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
        name: name,  // Updated to match backend schema
        account_name: account || undefined,
        bill_name: bill || undefined,
        operation: operation || undefined,  // Updated to match backend schema
        is_budget: budget === 'Да',
        is_fact: fact === 'Да',
        is_active: status === 'Активен',
      });
    }

    return newNomenclatures;
  }
}

export const nomenclaturesService = new NomenclaturesService();
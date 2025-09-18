import { BaseService } from './base.service';
import type { Period, AdminPeriod } from '$types';
import api from './api';

export interface CreatePeriodData {
  period_name: string;
  period_year: number;
  period_month: number;
  user_id?: number;
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
      const response = await api.get<{success: boolean, data: AdminPeriod[], total: number}>('/admin/periods');
      
      
      // The api.get() method returns the full response object {success, data, total}
      if (!response || typeof response !== 'object') {
        console.error('❌ Invalid admin periods API response:', response);
        throw new Error('Invalid response from admin periods API');
      }

      // Handle different response formats
      let periods: any[] = [];
      if (response.success && Array.isArray(response.data)) {
        periods = response.data;
      } else if (Array.isArray(response)) {
        periods = response;
      } else if (response.data && Array.isArray(response.data)) {
        periods = response.data;
      } else {
        console.error('❌ No valid periods data in response:', response);
        throw new Error('No periods data in API response');
      }
      
      
      // Map period_id to id for consistency and ensure all AdminPeriod fields are present
      const mappedPeriods = periods.map((p: any) => {
        const mappedPeriod = {
          ...p,
          // Ensure id is properly mapped
          id: p.period_id || p.id,
          
          // Ensure period_name is available (map from ru_name if needed for legacy compatibility)
          period_name: p.period_name || p.ru_name || '',
          period_ru_name: p.period_ru_name || p.ru_name || '',
          
          // Handle date fields
          created_at: p.created_at || p.date || null,
          
          // Ensure all AdminPeriod fields are present with fallbacks
          user_name: p.user_name || 'Неизвестный пользователь',
          user_email: p.user_email || null,
          username: p.username || null,
          telegram_id: p.telegram_id ? String(p.telegram_id) : null,
          
          // Ensure other required fields are present
          user_id: p.user_id || 0,
          period_id: p.period_id || p.id || 0,
          period_year: p.period_year || (p.date ? new Date(p.date).getFullYear() : new Date().getFullYear()),
          period_month: p.period_month || (p.date ? new Date(p.date).getMonth() + 1 : new Date().getMonth() + 1),
          is_active: p.is_active !== undefined ? p.is_active : true
        };
        
        return mappedPeriod;
      });

      
      return mappedPeriods;
    } catch (error: any) {
      console.error('❌ Error fetching admin periods:', error);
      console.error('❌ Error stack:', error.stack);
      
      // If it's a network or API error, provide more context
      if (error.response) {
        console.error('❌ Response status:', error.response.status);
        console.error('❌ Response data:', error.response.data);
      }
      
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
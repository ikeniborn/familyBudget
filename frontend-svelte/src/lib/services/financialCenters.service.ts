import { BaseService } from './base.service';
import type { FinancialCenter, AdminFinancialCenter } from '$types';
import api from './api';

export interface CreateFinancialCenterData {
  financial_center_name: string;
  user_id: number;
  is_active?: boolean;
}

export interface UpdateFinancialCenterData {
  financial_center_name?: string;
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

  // Admin API - Get all financial centers with user information
  async getAllWithUsers(): Promise<AdminFinancialCenter[]> {
    try {
      console.log('🔍 Fetching admin financial centers from /api/admin/references/financial_center...');
      const response = await api.get<{success: boolean, data: AdminFinancialCenter[], total: number}>('/admin/references/financial_center');
      
      console.log('📦 Raw API response:', response);
      
      // The api.get() method returns the full response object {success, data, total}
      if (!response || typeof response !== 'object') {
        console.error('❌ Invalid admin financial centers API response:', response);
        throw new Error('Invalid response from admin financial centers API');
      }

      // Handle different response formats
      let financialCenters: any[] = [];
      if (response.success && Array.isArray(response.data)) {
        financialCenters = response.data;
      } else if (Array.isArray(response)) {
        financialCenters = response;
      } else if (response.data && Array.isArray(response.data)) {
        financialCenters = response.data;
      } else {
        console.error('❌ No valid financial centers data in response:', response);
        throw new Error('No financial centers data in API response');
      }
      
      console.log(`📋 Received ${financialCenters.length} financial centers from API`);
      console.log('📋 First financial center sample:', financialCenters[0]);
      
      // Map financial_center_id to id for consistency and ensure all AdminFinancialCenter fields are present
      const mappedFinancialCenters = financialCenters.map((fc: any) => {
        const mappedFC = {
          ...fc,
          // Ensure id is properly mapped
          id: fc.financial_center_id || fc.id,
          
          // Ensure all AdminFinancialCenter fields are present with fallbacks
          user_name: fc.user_name || 'Неизвестный пользователь',
          user_email: fc.user_email || null,
          username: fc.username || null,
          telegram_id: fc.telegram_id ? String(fc.telegram_id) : null,
          
          // Ensure other required fields are present
          user_id: fc.user_id || 0,
          financial_center_id: fc.financial_center_id || fc.id || 0,
          financial_center_name: fc.financial_center_name || '',
          is_active: fc.is_active !== undefined ? fc.is_active : true
        };
        
        console.log('🔧 Mapped financial center:', mappedFC);
        return mappedFC;
      });

      console.log(`✅ Loaded ${mappedFinancialCenters.length} admin financial centers with user information`);
      
      return mappedFinancialCenters;
    } catch (error: any) {
      console.error('❌ Error fetching admin financial centers:', error);
      console.error('❌ Error stack:', error.stack);
      
      // If it's a network or API error, provide more context
      if (error.response) {
        console.error('❌ Response status:', error.response.status);
        console.error('❌ Response data:', error.response.data);
      }
      
      throw new Error(error.message || 'Failed to fetch admin financial centers');
    }
  }

  // Export to CSV - updated to support admin data
  async exportToCsv(data: FinancialCenter[] | AdminFinancialCenter[], isAdmin: boolean = false): Promise<string> {
    const headers = isAdmin
      ? ['ID', 'Название ЦФО', 'Пользователь', 'Email', 'Username', 'Статус', 'Дата создания']
      : ['ID', 'Название ЦФО', 'Статус', 'Дата создания'];
    
    const csvContent = [
      headers.join(','),
      ...data.map(fc => {
        const baseData = [
          fc.financial_center_id,
          `"${fc.financial_center_name}"`,
        ];
        
        if (isAdmin && 'user_name' in fc) {
          const adminFC = fc as AdminFinancialCenter;
          baseData.push(
            `"${adminFC.user_name}"`,
            `"${adminFC.user_email || ''}"`,
            `"${adminFC.username || ''}"`,
          );
        }
        
        baseData.push(
          fc.is_active ? 'Активен' : 'Неактивен',
          fc.created_at ? new Date(fc.created_at).toLocaleDateString('ru-RU') : ''
        );
        
        return baseData.join(',');
      })
    ].join('\n');

    return csvContent;
  }

  // Import from CSV
  async importFromCsv(csvText: string, userId: number): Promise<CreateFinancialCenterData[]> {
    const lines = csvText.split('\n').slice(1); // Skip header
    const newFinancialCenters: CreateFinancialCenterData[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [, name, status] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      newFinancialCenters.push({
        financial_center_name: name,
        is_active: status === 'Активен',
        user_id: userId,
      });
    }

    return newFinancialCenters;
  }
}

export const financialCentersService = new FinancialCentersService();
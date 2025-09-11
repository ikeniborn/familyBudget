import { BaseService } from './base.service';
import type { CostCenter, AdminCostCenter } from '$types';
import api from './api';

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

  // Admin API - Get all cost centers with user information
  async getAllWithUsers(): Promise<AdminCostCenter[]> {
    try {
      console.log('🔍 Fetching admin cost centers from /api/admin/references/cost_center...');
      const response = await api.get<{success: boolean, data: AdminCostCenter[], total: number}>('/admin/references/cost_center');
      
      console.log('📦 Raw API response:', response);
      
      // The api.get() method returns the full response object {success, data, total}
      if (!response || typeof response !== 'object') {
        console.error('❌ Invalid admin cost centers API response:', response);
        throw new Error('Invalid response from admin cost centers API');
      }

      // Handle different response formats
      let costCenters: any[] = [];
      if (response.success && Array.isArray(response.data)) {
        costCenters = response.data;
      } else if (Array.isArray(response)) {
        costCenters = response;
      } else if (response.data && Array.isArray(response.data)) {
        costCenters = response.data;
      } else {
        console.error('❌ No valid cost centers data in response:', response);
        throw new Error('No cost centers data in API response');
      }
      
      console.log(`📋 Received ${costCenters.length} cost centers from API`);
      console.log('📋 First cost center sample:', costCenters[0]);
      
      // Map cost_center_id to id for consistency and ensure all AdminCostCenter fields are present
      const mappedCostCenters = costCenters.map((cc: any) => {
        const mappedCC = {
          ...cc,
          // Ensure id is properly mapped
          id: cc.cost_center_id || cc.id,
          
          // Ensure all AdminCostCenter fields are present with fallbacks
          user_name: cc.user_name || 'Неизвестный пользователь',
          user_email: cc.user_email || null,
          username: cc.username || null,
          telegram_id: cc.telegram_id ? String(cc.telegram_id) : null,
          
          // Ensure other required fields are present
          user_id: cc.user_id || 0,
          cost_center_id: cc.cost_center_id || cc.id || 0,
          cost_center_name: cc.cost_center_name || '',
          is_active: cc.is_active !== undefined ? cc.is_active : true
        };
        
        console.log('🔧 Mapped cost center:', mappedCC);
        return mappedCC;
      });

      console.log(`✅ Loaded ${mappedCostCenters.length} admin cost centers with user information`);
      
      return mappedCostCenters;
    } catch (error: any) {
      console.error('❌ Error fetching admin cost centers:', error);
      console.error('❌ Error stack:', error.stack);
      
      // If it's a network or API error, provide more context
      if (error.response) {
        console.error('❌ Response status:', error.response.status);
        console.error('❌ Response data:', error.response.data);
      }
      
      throw new Error(error.message || 'Failed to fetch admin cost centers');
    }
  }

  // Export to CSV - updated to support admin data
  async exportToCsv(data: CostCenter[] | AdminCostCenter[], isAdmin: boolean = false): Promise<string> {
    const headers = isAdmin
      ? ['ID', 'Название МВЗ', 'Пользователь', 'Email', 'Username', 'Статус', 'Дата создания']
      : ['ID', 'Название МВЗ', 'Статус', 'Дата создания'];
    
    const csvContent = [
      headers.join(','),
      ...data.map(cc => {
        const baseData = [
          cc.cost_center_id,
          `"${cc.cost_center_name}"`,
        ];
        
        if (isAdmin && 'user_name' in cc) {
          const adminCC = cc as AdminCostCenter;
          baseData.push(
            `"${adminCC.user_name}"`,
            `"${adminCC.user_email || ''}"`,
            `"${adminCC.username || ''}"`,
          );
        }
        
        baseData.push(
          cc.is_active ? 'Активен' : 'Неактивен',
          cc.created_at ? new Date(cc.created_at).toLocaleDateString('ru-RU') : ''
        );
        
        return baseData.join(',');
      })
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
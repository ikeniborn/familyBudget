/**
 * Service for admin operations
 */
import api from './api';
import type { User, Sharing } from '$lib/types/index.js';

interface AdminUsersResponse {
  success: boolean;
  data: User[];
  total: number;
}

interface AdminReferencesResponse {
  success: boolean;
  data: any[];
  total: number;
}

interface AdminSharingResponse {
  success: boolean;
  data: Sharing[];
  total: number;
}

export const adminService = {
  // Get all users
  async getAllUsers(skip = 0, limit = 100): Promise<AdminUsersResponse> {
    return api.get<AdminUsersResponse>(`/admin/users?skip=${skip}&limit=${limit}`);
  },

  // Get all references of specified type
  async getAllReferences(
    resourceType: string, 
    userId?: number, 
    skip = 0, 
    limit = 100
  ): Promise<AdminReferencesResponse> {
    let url = `/admin/references/${resourceType}?skip=${skip}&limit=${limit}`;
    if (userId) {
      url += `&user_id=${userId}`;
    }
    return api.get<AdminReferencesResponse>(url);
  },

  // Update reference item
  async updateReference(resourceType: string, itemId: number, updateData: any) {
    return api.put(`/admin/references/${resourceType}/${itemId}`, updateData);
  },

  // Delete reference item
  async deleteReference(resourceType: string, itemId: number) {
    return api.delete(`/admin/references/${resourceType}/${itemId}`);
  },

  // Get all sharing configurations
  async getAllSharing(skip = 0, limit = 100): Promise<AdminSharingResponse> {
    return api.get<AdminSharingResponse>(`/admin/sharing?skip=${skip}&limit=${limit}`);
  }
};
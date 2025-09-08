/**
 * Service for handling data sharing between users
 */
import api from './api';
import type { Sharing, SharingCreate, SharingUpdate, User } from '$lib/types/index.js';

interface SharingListResponse {
  success: boolean;
  data: Sharing[];
  total: number;
}

interface AvailableUsersResponse {
  success: boolean;
  data: User[];
}

export const sharingService = {
  // Get current user's sharing configurations
  async getMyShares(skip = 0, limit = 100): Promise<SharingListResponse> {
    return api.get<SharingListResponse>(`/sharing/my-shares?skip=${skip}&limit=${limit}`);
  },

  // Get data shared with current user
  async getSharedWithMe(skip = 0, limit = 100): Promise<SharingListResponse> {
    return api.get<SharingListResponse>(`/sharing/shared-with-me?skip=${skip}&limit=${limit}`);
  },

  // Create new sharing configuration
  async createSharing(sharingData: SharingCreate) {
    return api.post('/sharing/create', sharingData);
  },

  // Update sharing configuration
  async updateSharing(sharingId: number, sharingData: SharingUpdate) {
    return api.put(`/sharing/${sharingId}`, sharingData);
  },

  // Delete sharing configuration
  async deleteSharing(sharingId: number) {
    return api.delete(`/sharing/${sharingId}`);
  },

  // Get available users for sharing
  async getAvailableUsers(): Promise<AvailableUsersResponse> {
    return api.get<AvailableUsersResponse>('/sharing/available-users');
  }
};
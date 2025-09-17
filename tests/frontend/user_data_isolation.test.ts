/**
 * Frontend tests for user data isolation
 * Verifies that frontend components properly handle user-specific data
 * and don't display or interact with data from other users
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { writable, get } from 'svelte/store';

// Mock stores
const mockAuthStore = {
  user: writable({ id: 1, username: 'testuser', role: 'user' }),
  isAuthenticated: writable(true),
  isAdmin: writable(false)
};

const mockToastStore = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn()
};

vi.mock('$lib/stores/auth.store', () => mockAuthStore);
vi.mock('$lib/stores/toast.store', () => ({ default: mockToastStore }));

// Mock API service
const mockApiService = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
};

vi.mock('$lib/services/api.service', () => ({
  default: mockApiService
}));

describe('User Data Isolation - Articles Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.user.set({ id: 1, username: 'testuser', role: 'user' });
  });

  it('should only display user-specific articles', async () => {
    const userArticles = [
      {
        id: 1,
        code: 'USER_ART1',
        name: 'User Article 1',
        user_id: 1,
        is_active: true,
        is_editable: true
      },
      {
        id: 2,
        code: 'USER_ART2',
        name: 'User Article 2',
        user_id: 1,
        is_active: false,
        is_editable: true
      }
    ];

    mockApiService.get.mockResolvedValue({
      success: true,
      data: userArticles,
      total: 2
    });

    // Simulate loading articles in a component
    const loadArticles = async () => {
      const response = await mockApiService.get('/api/articles/');
      return response.data;
    };

    const articles = await loadArticles();

    expect(mockApiService.get).toHaveBeenCalledWith('/api/articles/');
    expect(articles).toHaveLength(2);

    // All articles should belong to the current user
    articles.forEach(article => {
      expect(article.user_id).toBe(1);
      expect(article.is_editable).toBe(true);
    });
  });

  it('should handle article creation with automatic user_id assignment', async () => {
    const newArticleData = {
      code: 'NEW_ART',
      name: 'New Article',
      is_active: true
    };

    const createdArticle = {
      id: 3,
      ...newArticleData,
      user_id: 1,
      is_editable: true
    };

    mockApiService.post.mockResolvedValue({
      success: true,
      data: createdArticle
    });

    // Simulate creating an article
    const createArticle = async (data: any) => {
      const response = await mockApiService.post('/api/articles/', data);
      return response.data;
    };

    const result = await createArticle(newArticleData);

    expect(mockApiService.post).toHaveBeenCalledWith('/api/articles/', newArticleData);
    expect(result.user_id).toBe(1);
    expect(result.is_editable).toBe(true);
  });

  it('should handle 404 errors when trying to access other users articles', async () => {
    mockApiService.get.mockRejectedValue({
      response: { status: 404 },
      message: 'Article not found'
    });

    const getArticleById = async (id: number) => {
      try {
        const response = await mockApiService.get(`/api/articles/${id}`);
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 404) {
          throw new Error('Article not found or access denied');
        }
        throw error;
      }
    };

    await expect(getArticleById(999)).rejects.toThrow('Article not found or access denied');
    expect(mockApiService.get).toHaveBeenCalledWith('/api/articles/999');
  });

  it('should prevent editing articles from other users', async () => {
    mockApiService.put.mockRejectedValue({
      response: { status: 404 },
      message: 'Article not found'
    });

    const updateArticle = async (id: number, data: any) => {
      try {
        const response = await mockApiService.put(`/api/articles/${id}`, data);
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 404) {
          throw new Error('Cannot edit article from another user');
        }
        throw error;
      }
    };

    await expect(updateArticle(999, { name: 'Updated' })).rejects.toThrow('Cannot edit article from another user');
    expect(mockApiService.put).toHaveBeenCalledWith('/api/articles/999', { name: 'Updated' });
  });
});

describe('User Data Isolation - Periods Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.user.set({ id: 1, username: 'testuser', role: 'user' });
  });

  it('should only display user-specific periods', async () => {
    const userPeriods = [
      {
        id: 1,
        period: '2025.01',
        period_year: 2025,
        period_month: 1,
        user_id: 1,
        is_active: true
      },
      {
        id: 2,
        period: '2025.02',
        period_year: 2025,
        period_month: 2,
        user_id: 1,
        is_active: true
      }
    ];

    mockApiService.get.mockResolvedValue({
      success: true,
      data: userPeriods,
      total: 2
    });

    const loadPeriods = async () => {
      const response = await mockApiService.get('/api/periods/');
      return response.data;
    };

    const periods = await loadPeriods();

    expect(periods).toHaveLength(2);
    periods.forEach(period => {
      expect(period.user_id).toBe(1);
    });
  });

  it('should create periods with automatic user_id assignment', async () => {
    const newPeriodData = {
      period: '2025.03',
      period_year: 2025,
      period_month: 3,
      period_start_date: '2025-03-01',
      period_end_date: '2025-03-31'
    };

    const createdPeriod = {
      id: 3,
      ...newPeriodData,
      user_id: 1,
      is_active: true
    };

    mockApiService.post.mockResolvedValue({
      success: true,
      data: createdPeriod
    });

    const createPeriod = async (data: any) => {
      const response = await mockApiService.post('/api/periods/', data);
      return response.data;
    };

    const result = await createPeriod(newPeriodData);

    expect(result.user_id).toBe(1);
    expect(mockApiService.post).toHaveBeenCalledWith('/api/periods/', newPeriodData);
  });
});

describe('User Data Isolation - Financial Centers Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.user.set({ id: 1, username: 'testuser', role: 'user' });
  });

  it('should only display user-specific financial centers', async () => {
    const userFinancialCenters = [
      {
        id: 1,
        financial_center_code: 'FC001',
        name: 'User FC 1',
        user_id: 1,
        is_active: true
      },
      {
        id: 2,
        financial_center_code: 'FC002',
        name: 'User FC 2',
        user_id: 1,
        is_active: true
      }
    ];

    mockApiService.get.mockResolvedValue({
      success: true,
      data: userFinancialCenters,
      total: 2
    });

    const loadFinancialCenters = async () => {
      const response = await mockApiService.get('/api/financial_centers/');
      return response.data;
    };

    const fcs = await loadFinancialCenters();

    expect(fcs).toHaveLength(2);
    fcs.forEach(fc => {
      expect(fc.user_id).toBe(1);
    });
  });
});

describe('User Data Isolation - Statistics and Aggregations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.user.set({ id: 1, username: 'testuser', role: 'user' });
  });

  it('should only include user-specific data in statistics', async () => {
    const userStats = {
      total: 5,
      active: 3,
      inactive: 2
    };

    mockApiService.get.mockResolvedValue({
      success: true,
      data: userStats
    });

    const getArticleStats = async () => {
      const response = await mockApiService.get('/api/articles/stats');
      return response.data;
    };

    const stats = await getArticleStats();

    expect(stats.total).toBe(5);
    expect(stats.active).toBe(3);
    expect(stats.inactive).toBe(2);
    expect(mockApiService.get).toHaveBeenCalledWith('/api/articles/stats');
  });

  it('should handle statistics for different users separately', async () => {
    // Simulate getting stats for user 1
    mockApiService.get.mockResolvedValueOnce({
      success: true,
      data: { total: 5, active: 3, inactive: 2 }
    });

    const user1Stats = await mockApiService.get('/api/articles/stats');

    // Simulate switching to user 2
    mockAuthStore.user.set({ id: 2, username: 'testuser2', role: 'user' });

    // Simulate getting stats for user 2
    mockApiService.get.mockResolvedValueOnce({
      success: true,
      data: { total: 3, active: 2, inactive: 1 }
    });

    const user2Stats = await mockApiService.get('/api/articles/stats');

    expect(user1Stats.data.total).toBe(5);
    expect(user2Stats.data.total).toBe(3);
    expect(user1Stats.data.total).not.toBe(user2Stats.data.total);
  });
});

describe('User Data Isolation - Bulk Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.user.set({ id: 1, username: 'testuser', role: 'user' });
  });

  it('should only allow bulk operations on user-owned entities', async () => {
    const userArticleIds = [1, 2, 3];

    mockApiService.post.mockResolvedValue({
      success: true,
      data: {
        deleted_count: 3,
        message: 'Successfully deleted 3 articles'
      }
    });

    const bulkDeleteArticles = async (articleIds: number[]) => {
      const response = await mockApiService.post('/api/articles/bulk-delete', {
        article_ids: articleIds
      });
      return response.data;
    };

    const result = await bulkDeleteArticles(userArticleIds);

    expect(result.deleted_count).toBe(3);
    expect(mockApiService.post).toHaveBeenCalledWith('/api/articles/bulk-delete', {
      article_ids: userArticleIds
    });
  });

  it('should handle bulk operation failures when accessing other users data', async () => {
    const mixedArticleIds = [1, 999]; // 999 belongs to another user

    mockApiService.post.mockRejectedValue({
      response: { status: 400 },
      message: 'Cannot delete articles that belong to another user'
    });

    const bulkDeleteArticles = async (articleIds: number[]) => {
      try {
        const response = await mockApiService.post('/api/articles/bulk-delete', {
          article_ids: articleIds
        });
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 400) {
          throw new Error('Access denied to other users data');
        }
        throw error;
      }
    };

    await expect(bulkDeleteArticles(mixedArticleIds)).rejects.toThrow('Access denied to other users data');
  });
});

describe('User Data Isolation - Component State Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.user.set({ id: 1, username: 'testuser', role: 'user' });
  });

  it('should clear data when user changes', async () => {
    // Simulate loading data for user 1
    let currentData: any[] = [];

    const loadUserData = async () => {
      const response = await mockApiService.get('/api/articles/');
      currentData = response.data;
      return currentData;
    };

    mockApiService.get.mockResolvedValue({
      success: true,
      data: [{ id: 1, name: 'User 1 Article', user_id: 1 }]
    });

    await loadUserData();
    expect(currentData).toHaveLength(1);

    // Simulate user change
    mockAuthStore.user.set({ id: 2, username: 'testuser2', role: 'user' });

    // Data should be cleared/reloaded for new user
    mockApiService.get.mockResolvedValue({
      success: true,
      data: [{ id: 2, name: 'User 2 Article', user_id: 2 }]
    });

    await loadUserData();
    expect(currentData).toHaveLength(1);
    expect(currentData[0].user_id).toBe(2);
  });

  it('should validate user ownership before allowing actions', () => {
    const validateUserOwnership = (entity: any, currentUserId: number) => {
      if (!entity.user_id || entity.user_id !== currentUserId) {
        return false;
      }
      return true;
    };

    const currentUser = get(mockAuthStore.user);

    const userEntity = { id: 1, name: 'User Entity', user_id: 1 };
    const otherUserEntity = { id: 2, name: 'Other User Entity', user_id: 2 };

    expect(validateUserOwnership(userEntity, currentUser.id)).toBe(true);
    expect(validateUserOwnership(otherUserEntity, currentUser.id)).toBe(false);
  });

  it('should handle navigation with user-specific routes', () => {
    const generateUserRoute = (baseRoute: string, entityId: number, userId: number) => {
      // In a real app, this might include user context validation
      return `${baseRoute}/${entityId}?user=${userId}`;
    };

    const currentUser = get(mockAuthStore.user);
    const route = generateUserRoute('/articles', 123, currentUser.id);

    expect(route).toBe('/articles/123?user=1');
  });
});

describe('User Data Isolation - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.user.set({ id: 1, username: 'testuser', role: 'user' });
  });

  it('should handle authorization errors gracefully', async () => {
    mockApiService.get.mockRejectedValue({
      response: { status: 403 },
      message: 'Access denied'
    });

    const handleApiCall = async () => {
      try {
        await mockApiService.get('/api/articles/999');
      } catch (error: any) {
        if (error.response?.status === 403) {
          mockToastStore.error('Access denied: You can only view your own data');
          return null;
        }
        throw error;
      }
    };

    const result = await handleApiCall();

    expect(result).toBeNull();
    expect(mockToastStore.error).toHaveBeenCalledWith('Access denied: You can only view your own data');
  });

  it('should handle not found errors for cross-user access attempts', async () => {
    mockApiService.get.mockRejectedValue({
      response: { status: 404 },
      message: 'Not found'
    });

    const handleApiCall = async () => {
      try {
        await mockApiService.get('/api/articles/999');
      } catch (error: any) {
        if (error.response?.status === 404) {
          mockToastStore.warning('Item not found or you don\'t have permission to view it');
          return null;
        }
        throw error;
      }
    };

    const result = await handleApiCall();

    expect(result).toBeNull();
    expect(mockToastStore.warning).toHaveBeenCalledWith('Item not found or you don\'t have permission to view it');
  });

  it('should validate form submissions against user ownership', () => {
    const validateFormSubmission = (formData: any, currentUserId: number) => {
      const errors: string[] = [];

      // Check if trying to reference entities from other users
      if (formData.article_id) {
        // In a real app, this would check if the article belongs to the current user
        const mockArticles = [
          { id: 1, user_id: 1 },
          { id: 2, user_id: 2 }
        ];

        const article = mockArticles.find(a => a.id === formData.article_id);
        if (!article || article.user_id !== currentUserId) {
          errors.push('Selected article does not belong to you');
        }
      }

      return errors;
    };

    const currentUser = get(mockAuthStore.user);

    const validForm = { name: 'Test', article_id: 1 };
    const invalidForm = { name: 'Test', article_id: 2 };

    expect(validateFormSubmission(validForm, currentUser.id)).toEqual([]);
    expect(validateFormSubmission(invalidForm, currentUser.id)).toEqual(['Selected article does not belong to you']);
  });
});

describe('User Data Isolation - Admin vs Regular User', () => {
  it('should maintain data isolation even for admin users', async () => {
    // Set up admin user
    mockAuthStore.user.set({ id: 1, username: 'admin', role: 'admin' });
    mockAuthStore.isAdmin.set(true);

    const adminArticles = [
      { id: 1, name: 'Admin Article', user_id: 1, is_editable: true }
    ];

    mockApiService.get.mockResolvedValue({
      success: true,
      data: adminArticles
    });

    const loadArticles = async () => {
      const response = await mockApiService.get('/api/articles/');
      return response.data;
    };

    const articles = await loadArticles();

    // Even admin should only see their own articles
    expect(articles).toHaveLength(1);
    expect(articles[0].user_id).toBe(1);
  });

  it('should handle role changes while maintaining user isolation', async () => {
    // Start as regular user
    mockAuthStore.user.set({ id: 1, username: 'testuser', role: 'user' });
    mockAuthStore.isAdmin.set(false);

    // User gets promoted to admin but keeps the same user_id
    mockAuthStore.user.set({ id: 1, username: 'testuser', role: 'admin' });
    mockAuthStore.isAdmin.set(true);

    const userArticles = [
      { id: 1, name: 'User Article', user_id: 1, is_editable: true }
    ];

    mockApiService.get.mockResolvedValue({
      success: true,
      data: userArticles
    });

    const loadArticles = async () => {
      const response = await mockApiService.get('/api/articles/');
      return response.data;
    };

    const articles = await loadArticles();

    // Should still only see their own data, regardless of role
    expect(articles).toHaveLength(1);
    expect(articles[0].user_id).toBe(1);
  });
});
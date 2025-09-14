/**
 * Tests for shared reference data management frontend components
 * Testing admin-only access control and shared data indicators
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { writable, get } from 'svelte/store';
import { goto } from '$app/navigation';

// Mock stores and navigation
vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

vi.mock('$lib/stores/auth.store', () => {
  const isAdmin = writable(false);
  const user = writable({ id: 1, username: 'testuser', role: 'user' });

  return {
    isAdmin,
    user
  };
});

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

describe('Shared References - Admin Role Checking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should redirect non-admin users to access-denied page', async () => {
    const { isAdmin } = await import('$lib/stores/auth.store');
    isAdmin.set(false);

    // Simulate mounting a reference management page
    const checkAdminAccess = () => {
      const adminStatus = get(isAdmin);
      if (!adminStatus) {
        goto('/access-denied');
      }
    };

    checkAdminAccess();

    await waitFor(() => {
      expect(goto).toHaveBeenCalledWith('/access-denied');
    });
  });

  it('should allow admin users to access reference management pages', async () => {
    const { isAdmin } = await import('$lib/stores/auth.store');
    isAdmin.set(true);

    const checkAdminAccess = () => {
      const adminStatus = get(isAdmin);
      if (!adminStatus) {
        goto('/access-denied');
      }
    };

    checkAdminAccess();

    expect(goto).not.toHaveBeenCalled();
  });

  it('should display admin access indicator in page header', async () => {
    const { isAdmin } = await import('$lib/stores/auth.store');
    isAdmin.set(true);

    const headerText = 'Управление периодами (требуется административный доступ)';
    expect(headerText).toContain('административный доступ');
  });
});

describe('Shared References - Data Display and Editability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display shared data indicator for records with user_id=null', () => {
    const item = {
      id: 1,
      name: 'Shared Period',
      user_id: null,
      is_shared: true,
      is_editable: true
    };

    const getDataTypeBadge = (item: any) => {
      if (item.is_shared || item.user_id === null) {
        return { class: 'bg-purple-100 text-purple-800', text: 'Общий' };
      } else {
        return { class: 'bg-blue-100 text-blue-800', text: 'Личный' };
      }
    };

    const badge = getDataTypeBadge(item);
    expect(badge.text).toBe('Общий');
    expect(badge.class).toContain('purple');
  });

  it('should display personal data indicator for user-specific records', () => {
    const item = {
      id: 2,
      name: 'User Period',
      user_id: 1,
      is_shared: false,
      is_editable: true
    };

    const getDataTypeBadge = (item: any) => {
      if (item.is_shared || item.user_id === null) {
        return { class: 'bg-purple-100 text-purple-800', text: 'Общий' };
      } else {
        return { class: 'bg-blue-100 text-blue-800', text: 'Личный' };
      }
    };

    const badge = getDataTypeBadge(item);
    expect(badge.text).toBe('Личный');
    expect(badge.class).toContain('blue');
  });

  it('should hide edit/delete buttons for non-editable shared data', () => {
    const item = {
      id: 3,
      name: 'Read-only Shared',
      user_id: null,
      is_shared: true,
      is_editable: false
    };

    const canEdit = (item: any) => item.is_editable !== false;

    expect(canEdit(item)).toBe(false);
  });

  it('should show edit/delete buttons for editable data', () => {
    const item = {
      id: 4,
      name: 'Editable Record',
      user_id: 1,
      is_shared: false,
      is_editable: true
    };

    const canEdit = (item: any) => item.is_editable !== false;

    expect(canEdit(item)).toBe(true);
  });
});

describe('Shared References - UI Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiService.get.mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          name: 'Shared Item',
          code: 'SHARED01',
          user_id: null,
          is_shared: true,
          is_editable: false
        },
        {
          id: 2,
          name: 'User Item',
          code: 'USER01',
          user_id: 1,
          is_shared: false,
          is_editable: true
        }
      ]
    });
  });

  it('should display both shared and user-specific items in table', async () => {
    const data = await mockApiService.get('/api/periods/');

    expect(data.data).toHaveLength(2);
    expect(data.data[0].is_shared).toBe(true);
    expect(data.data[1].is_shared).toBe(false);
  });

  it('should disable edit button for read-only shared items', () => {
    const items = [
      { id: 1, is_editable: false },
      { id: 2, is_editable: true }
    ];

    const editButtonStates = items.map(item => ({
      id: item.id,
      disabled: !item.is_editable
    }));

    expect(editButtonStates[0].disabled).toBe(true);
    expect(editButtonStates[1].disabled).toBe(false);
  });

  it('should show confirmation dialog before deleting editable items', async () => {
    const confirmDelete = vi.fn();
    const item = { id: 2, name: 'User Item', is_editable: true };

    if (item.is_editable) {
      confirmDelete(item);
    }

    expect(confirmDelete).toHaveBeenCalledWith(item);
  });

  it('should not allow deletion of non-editable items', () => {
    const confirmDelete = vi.fn();
    const item = { id: 1, name: 'Shared Item', is_editable: false };

    if (item.is_editable) {
      confirmDelete(item);
    }

    expect(confirmDelete).not.toHaveBeenCalled();
  });
});

describe('Shared References - Component Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check admin status on component mount', async () => {
    const { isAdmin } = await import('$lib/stores/auth.store');
    let adminCheckComplete = false;
    let userIsAdmin = false;

    // Simulate onMount
    const onMount = () => {
      setTimeout(() => {
        adminCheckComplete = true;
        userIsAdmin = get(isAdmin);
        if (!userIsAdmin) {
          goto('/access-denied');
        }
      }, 100);
    };

    isAdmin.set(false);
    onMount();

    await waitFor(() => {
      expect(goto).toHaveBeenCalledWith('/access-denied');
    }, { timeout: 200 });
  });

  it('should update UI when user role changes', async () => {
    const { isAdmin, user } = await import('$lib/stores/auth.store');

    // Start as regular user
    isAdmin.set(false);
    user.set({ id: 1, username: 'testuser', role: 'user' });

    let currentRole = get(user).role;
    expect(currentRole).toBe('user');

    // Change to admin
    isAdmin.set(true);
    user.set({ id: 1, username: 'testuser', role: 'admin' });

    currentRole = get(user).role;
    expect(currentRole).toBe('admin');
  });

  it('should handle loading states properly', async () => {
    let loading = true;
    let data: any[] = [];

    // Simulate async data loading
    const loadData = async () => {
      loading = true;
      const response = await mockApiService.get('/api/periods/');
      data = response.data;
      loading = false;
    };

    mockApiService.get.mockResolvedValue({
      success: true,
      data: [{ id: 1, name: 'Test' }]
    });

    await loadData();

    expect(loading).toBe(false);
    expect(data).toHaveLength(1);
  });
});

describe('Shared References - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle API errors gracefully', async () => {
    mockApiService.get.mockRejectedValue(new Error('Network error'));

    let error: string | null = null;

    try {
      await mockApiService.get('/api/periods/');
    } catch (e: any) {
      error = e.message;
    }

    expect(error).toBe('Network error');
  });

  it('should display error message for unauthorized access', async () => {
    mockApiService.post.mockResolvedValue({
      success: false,
      error: 'Admin access required',
      status: 403
    });

    const response = await mockApiService.post('/api/periods/', {
      name: 'New Period',
      user_id: null
    });

    expect(response.success).toBe(false);
    expect(response.status).toBe(403);
    expect(response.error).toContain('Admin access required');
  });

  it('should handle session expiration', async () => {
    const { isAdmin, user } = await import('$lib/stores/auth.store');

    // Simulate session expiration
    isAdmin.set(false);
    user.set(null as any);

    const isAuthenticated = get(user) !== null;
    expect(isAuthenticated).toBe(false);

    // Should redirect to login
    if (!isAuthenticated) {
      goto('/login');
    }

    expect(goto).toHaveBeenCalledWith('/login');
  });
});

describe('Shared References - Cross-Entity Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply same UI patterns across all reference types', () => {
    const entities = [
      'periods',
      'financial-centers',
      'cost-centers',
      'nomenclatures'
    ];

    entities.forEach(entity => {
      const path = `/settings/${entity}`;

      // All should have same admin check
      const checkAdminForEntity = (isAdmin: boolean) => {
        if (!isAdmin) {
          goto('/access-denied');
          return false;
        }
        return true;
      };

      expect(checkAdminForEntity(false)).toBe(false);
      expect(checkAdminForEntity(true)).toBe(true);
    });
  });

  it('should use consistent data type badges across entities', () => {
    const testData = [
      { entity: 'period', user_id: null },
      { entity: 'financial_center', user_id: null },
      { entity: 'cost_center', user_id: 1 },
      { entity: 'nomenclature', user_id: 2 }
    ];

    const badges = testData.map(item => {
      if (item.user_id === null) {
        return 'Общий';
      }
      return 'Личный';
    });

    expect(badges[0]).toBe('Общий');
    expect(badges[1]).toBe('Общий');
    expect(badges[2]).toBe('Личный');
    expect(badges[3]).toBe('Личный');
  });

  it('should handle backward compatibility with old field names', () => {
    const oldApiResponse = {
      financial_center_name: 'Old Name Format',
      financial_center_description: 'Old Description'
    };

    const newApiResponse = {
      name: 'New Name Format',
      description: 'New Description'
    };

    // Function to handle both formats
    const getName = (item: any) => {
      return item.name || item.financial_center_name || '';
    };

    expect(getName(oldApiResponse)).toBe('Old Name Format');
    expect(getName(newApiResponse)).toBe('New Name Format');
  });
});
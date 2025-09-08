import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { isAdmin, authStore } from '../../stores/auth.store';
import { createMockUser } from '../../../test/utils';

// Mock the API to prevent network calls
vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
    get: vi.fn().mockResolvedValue({ data: { success: true } })
  }
}));

describe('isAdmin utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when user_id is 1', () => {
    const adminUser = createMockUser({ id: 1, user_name: 'Admin User' });
    authStore.setUser(adminUser);
    
    const adminStatus = get(isAdmin);
    expect(adminStatus).toBe(true);
  });

  it('should return false when user_id is not 1', () => {
    const regularUser = createMockUser({ id: 2, user_name: 'Regular User' });
    authStore.setUser(regularUser);
    
    const adminStatus = get(isAdmin);
    expect(adminStatus).toBe(false);
  });

  it('should return false when user_id is 0', () => {
    const invalidUser = createMockUser({ id: 0, user_name: 'Invalid User' });
    authStore.setUser(invalidUser);
    
    const adminStatus = get(isAdmin);
    expect(adminStatus).toBe(false);
  });

  it('should return false when user_id is negative', () => {
    const negativeUser = createMockUser({ id: -1, user_name: 'Negative User' });
    authStore.setUser(negativeUser);
    
    const adminStatus = get(isAdmin);
    expect(adminStatus).toBe(false);
  });

  it('should return false when user is null', async () => {
    await authStore.logout();
    
    const adminStatus = get(isAdmin);
    expect(adminStatus).toBe(false);
  });

  it('should return false when user is undefined', () => {
    // Manually set the store to have undefined user
    authStore.subscribe(() => {});
    const state = get(authStore);
    (state as any).user = undefined;
    
    const adminStatus = get(isAdmin);
    expect(adminStatus).toBe(false);
  });

  it('should return false when user.id is undefined', () => {
    const userWithoutId = { ...createMockUser(), id: undefined } as any;
    authStore.setUser(userWithoutId);
    
    const adminStatus = get(isAdmin);
    expect(adminStatus).toBe(false);
  });

  it('should return false when user.id is null', () => {
    const userWithNullId = { ...createMockUser(), id: null } as any;
    authStore.setUser(userWithNullId);
    
    const adminStatus = get(isAdmin);
    expect(adminStatus).toBe(false);
  });

  it('should reactively update when user changes', async () => {
    // Start with non-admin user
    const regularUser = createMockUser({ id: 2 });
    authStore.setUser(regularUser);
    
    let adminStatus = get(isAdmin);
    expect(adminStatus).toBe(false);
    
    // Change to admin user
    const adminUser = createMockUser({ id: 1 });
    authStore.setUser(adminUser);
    
    adminStatus = get(isAdmin);
    expect(adminStatus).toBe(true);
    
    // Logout and wait for completion
    await authStore.logout();
    
    adminStatus = get(isAdmin);
    expect(adminStatus).toBe(false);
  });

  it('should handle string user_id correctly', () => {
    // Some APIs might return string IDs
    const userWithStringId = { ...createMockUser(), id: '1' } as any;
    authStore.setUser(userWithStringId);
    
    const adminStatus = get(isAdmin);
    // This should be false because '1' !== 1
    expect(adminStatus).toBe(false);
  });

  it('should handle large user_id correctly', () => {
    const userWithLargeId = createMockUser({ id: 999999 });
    authStore.setUser(userWithLargeId);
    
    const adminStatus = get(isAdmin);
    expect(adminStatus).toBe(false);
  });

  it('should maintain type safety', () => {
    // This test ensures TypeScript compilation - runtime check
    const adminUser = createMockUser({ id: 1 });
    authStore.setUser(adminUser);
    
    const adminStatus: boolean = get(isAdmin);
    expect(typeof adminStatus).toBe('boolean');
    expect(adminStatus).toBe(true);
  });

  describe('Performance tests', () => {
    it('should compute admin status efficiently', () => {
      const adminUser = createMockUser({ id: 1 });
      authStore.setUser(adminUser);
      
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        get(isAdmin);
      }
      const end = performance.now();
      
      // Should complete 1000 calls in reasonable time (< 100ms)
      expect(end - start).toBeLessThan(100);
    });

    it('should not cause memory leaks with multiple subscriptions', () => {
      const adminUser = createMockUser({ id: 1 });
      authStore.setUser(adminUser);
      
      // Create multiple subscriptions and unsubscribe
      const unsubscribes = [];
      for (let i = 0; i < 100; i++) {
        const unsubscribe = isAdmin.subscribe(() => {});
        unsubscribes.push(unsubscribe);
      }
      
      // Unsubscribe all
      unsubscribes.forEach(unsub => unsub());
      
      // Should still work correctly
      const adminStatus = get(isAdmin);
      expect(adminStatus).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle concurrent user changes', async () => {
      const adminUser = createMockUser({ id: 1 });
      const regularUser = createMockUser({ id: 2 });
      
      // Rapidly change users
      authStore.setUser(adminUser);
      authStore.setUser(regularUser);
      authStore.setUser(adminUser);
      
      const adminStatus = get(isAdmin);
      expect(adminStatus).toBe(true);
    });

    it('should handle auth state corruption gracefully', () => {
      // Simulate corrupted auth state
      const corruptedUser = null;
      authStore.setUser(corruptedUser as any);
      
      expect(() => {
        const adminStatus = get(isAdmin);
        expect(adminStatus).toBe(false);
      }).not.toThrow();
    });
  });
});
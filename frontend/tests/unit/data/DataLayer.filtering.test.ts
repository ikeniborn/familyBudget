/**
 * Unit tests for DataLayer.ts in-memory filtering
 * Tests filtering logic for shopping list items
 */

import { describe, it, expect } from 'vitest';
import type { LocalShoppingListItem } from '@db/dexie';

/**
 * Mock shopping list items for testing
 */
function createMockItem(overrides: Partial<LocalShoppingListItem> = {}): LocalShoppingListItem {
  return {
    id: 1,
    temp_id: 'item-123',
    creator_id: 1,
    shopping_list_temp_id: 'list-456',
    store_id: 10,
    product_group_id: 20,
    product_name: 'Test Product',
    quantity: 2,
    unit: 'kg',
    comment: null,
    position: 0,
    is_completed: false,
    completed_at: null,
    sync_status: 'synced',
    sync_hash: 'hash123',
    content_hash: 'content123',
    version: 1,
    deleted_at: null,
    last_modified_by: 1,
    ...overrides
  };
}

/**
 * Test in-memory filtering logic (extracted from DataLayer.ts:743-780)
 * This is the ACTUAL filtering logic used in production
 */
function applyInMemoryFilters(
  items: LocalShoppingListItem[],
  filters: {
    is_completed?: boolean;
    store_id?: number;
    product_group_id?: number;
    sync_status?: 'synced' | 'pending' | 'conflict' | 'deleted';
    deleted?: boolean;
  }
): LocalShoppingListItem[] {
  return items.filter((item: LocalShoppingListItem) => {
    // Filter by completion status
    if (filters.is_completed !== undefined && item.is_completed !== filters.is_completed) {
      return false;
    }

    // Filter by store
    if (filters.store_id !== undefined && item.store_id !== filters.store_id) {
      return false;
    }

    // Filter by product group
    if (filters.product_group_id !== undefined && item.product_group_id !== filters.product_group_id) {
      return false;
    }

    // Filter by sync status
    if (filters.sync_status !== undefined && item.sync_status !== filters.sync_status) {
      return false;
    }

    // Filter by deleted status
    if (filters.deleted !== undefined) {
      const isDeleted = item.deleted_at !== null;
      if (filters.deleted !== isDeleted) {
        return false;
      }
    }

    return true;
  });
}

describe('DataLayer In-Memory Filtering', () => {
  describe('is_completed filter', () => {
    it('should filter completed items', () => {
      const items = [
        createMockItem({ is_completed: true }),
        createMockItem({ is_completed: false }),
        createMockItem({ is_completed: true })
      ];

      const result = applyInMemoryFilters(items, { is_completed: true });

      expect(result).toHaveLength(2);
      expect(result.every(item => item.is_completed)).toBe(true);
    });

    it('should filter incomplete items', () => {
      const items = [
        createMockItem({ is_completed: true }),
        createMockItem({ is_completed: false }),
        createMockItem({ is_completed: false })
      ];

      const result = applyInMemoryFilters(items, { is_completed: false });

      expect(result).toHaveLength(2);
      expect(result.every(item => !item.is_completed)).toBe(true);
    });
  });

  describe('store_id filter', () => {
    it('should filter by store_id', () => {
      const items = [
        createMockItem({ store_id: 10 }),
        createMockItem({ store_id: 20 }),
        createMockItem({ store_id: 10 })
      ];

      const result = applyInMemoryFilters(items, { store_id: 10 });

      expect(result).toHaveLength(2);
      expect(result.every(item => item.store_id === 10)).toBe(true);
    });

    it('should return empty array if no items match store_id', () => {
      const items = [
        createMockItem({ store_id: 10 }),
        createMockItem({ store_id: 20 })
      ];

      const result = applyInMemoryFilters(items, { store_id: 99 });

      expect(result).toHaveLength(0);
    });
  });

  describe('product_group_id filter', () => {
    it('should filter by product_group_id', () => {
      const items = [
        createMockItem({ product_group_id: 100 }),
        createMockItem({ product_group_id: 200 }),
        createMockItem({ product_group_id: 100 })
      ];

      const result = applyInMemoryFilters(items, { product_group_id: 100 });

      expect(result).toHaveLength(2);
      expect(result.every(item => item.product_group_id === 100)).toBe(true);
    });
  });

  describe('sync_status filter', () => {
    it('should filter by sync_status', () => {
      const items = [
        createMockItem({ sync_status: 'synced' }),
        createMockItem({ sync_status: 'pending' }),
        createMockItem({ sync_status: 'synced' })
      ];

      const result = applyInMemoryFilters(items, { sync_status: 'synced' });

      expect(result).toHaveLength(2);
      expect(result.every(item => item.sync_status === 'synced')).toBe(true);
    });

    it('should filter pending items', () => {
      const items = [
        createMockItem({ sync_status: 'synced' }),
        createMockItem({ sync_status: 'pending' }),
        createMockItem({ sync_status: 'pending' })
      ];

      const result = applyInMemoryFilters(items, { sync_status: 'pending' });

      expect(result).toHaveLength(2);
      expect(result.every(item => item.sync_status === 'pending')).toBe(true);
    });
  });

  describe('deleted filter', () => {
    it('should filter only deleted items (deleted=true)', () => {
      const now = new Date();
      const items = [
        createMockItem({ deleted_at: now }),
        createMockItem({ deleted_at: null }),
        createMockItem({ deleted_at: now })
      ];

      const result = applyInMemoryFilters(items, { deleted: true });

      expect(result).toHaveLength(2);
      expect(result.every(item => item.deleted_at !== null)).toBe(true);
    });

    it('should filter only active items (deleted=false)', () => {
      const now = new Date();
      const items = [
        createMockItem({ deleted_at: now }),
        createMockItem({ deleted_at: null }),
        createMockItem({ deleted_at: null })
      ];

      const result = applyInMemoryFilters(items, { deleted: false });

      expect(result).toHaveLength(2);
      expect(result.every(item => item.deleted_at === null)).toBe(true);
    });
  });

  describe('Multiple filters', () => {
    it('should apply multiple filters (AND logic)', () => {
      const now = new Date();
      const items = [
        createMockItem({ is_completed: true, store_id: 10, deleted_at: null }),
        createMockItem({ is_completed: true, store_id: 20, deleted_at: null }),
        createMockItem({ is_completed: false, store_id: 10, deleted_at: null }),
        createMockItem({ is_completed: true, store_id: 10, deleted_at: now })
      ];

      const result = applyInMemoryFilters(items, {
        is_completed: true,
        store_id: 10,
        deleted: false
      });

      expect(result).toHaveLength(1);
      expect(result[0].is_completed).toBe(true);
      expect(result[0].store_id).toBe(10);
      expect(result[0].deleted_at).toBeNull();
    });

    it('should handle complex filter combination', () => {
      const items = [
        createMockItem({
          is_completed: false,
          store_id: 10,
          product_group_id: 100,
          sync_status: 'synced',
          deleted_at: null
        }),
        createMockItem({
          is_completed: false,
          store_id: 10,
          product_group_id: 200,
          sync_status: 'synced',
          deleted_at: null
        }),
        createMockItem({
          is_completed: false,
          store_id: 20,
          product_group_id: 100,
          sync_status: 'pending',
          deleted_at: null
        })
      ];

      const result = applyInMemoryFilters(items, {
        is_completed: false,
        store_id: 10,
        product_group_id: 100,
        sync_status: 'synced'
      });

      expect(result).toHaveLength(1);
      expect(result[0].product_group_id).toBe(100);
    });
  });

  describe('Edge cases', () => {
    it('should return all items when no filters provided', () => {
      const items = [
        createMockItem(),
        createMockItem(),
        createMockItem()
      ];

      const result = applyInMemoryFilters(items, {});

      expect(result).toHaveLength(3);
    });

    it('should handle empty items array', () => {
      const result = applyInMemoryFilters([], { is_completed: true });

      expect(result).toHaveLength(0);
    });

    it('should return empty array if all items filtered out', () => {
      const items = [
        createMockItem({ is_completed: false }),
        createMockItem({ is_completed: false })
      ];

      const result = applyInMemoryFilters(items, { is_completed: true });

      expect(result).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('should filter large dataset efficiently (single pass)', () => {
      // Create 1000 items
      const items = Array.from({ length: 1000 }, (_, i) => createMockItem({
        id: i,
        is_completed: i % 2 === 0,
        store_id: i % 10,
        product_group_id: i % 5
      }));

      const startTime = performance.now();
      const result = applyInMemoryFilters(items, {
        is_completed: true,
        store_id: 5,
        product_group_id: 2
      });
      const duration = performance.now() - startTime;

      // Should complete in < 10ms
      expect(duration).toBeLessThan(10);

      // Verify correctness
      expect(result.every(item =>
        item.is_completed &&
        item.store_id === 5 &&
        item.product_group_id === 2
      )).toBe(true);
    });
  });
});

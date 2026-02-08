/**
 * Unit tests for modalManager.ts list creation fallback
 * Tests 2-strategy fallback for finding newly created lists
 */

import { describe, it, expect } from 'vitest';

/**
 * Mock ShoppingList type
 */
interface ShoppingList {
  id: number;
  temp_id?: string;
  name: string;
  created_at: string;
}

/**
 * Mock API response
 */
interface CreateListResponse {
  id: number;
  name: string;
  temp_id?: string;
}

/**
 * Test list creation fallback logic (extracted from modalManager.ts:100-121)
 * This is the ACTUAL fallback logic used in production
 */
function findCreatedList(
  shoppingLists: ShoppingList[],
  apiResponse: CreateListResponse
): ShoppingList | null {
  let foundList: ShoppingList | null = null;
  let listId = apiResponse.id;

  // Strategy 1: Find by server ID (preferred)
  foundList = shoppingLists.find(l => l.id === apiResponse.id) || null;

  // Strategy 2: Find most recently created list with matching name
  // NOTE: API response doesn't include temp_id, so we can't search by it
  if (!foundList) {
    const matchingLists = shoppingLists
      .filter(l => l.name === apiResponse.name)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (matchingLists.length > 0) {
      foundList = matchingLists[0];
      listId = foundList.id;
    }
  }

  return foundList;
}

describe('Modal Manager List Creation Fallback', () => {
  describe('Strategy 1: Find by server ID', () => {
    it('should find list by server ID', () => {
      const shoppingLists: ShoppingList[] = [
        { id: 100, name: 'Groceries', created_at: '2026-02-08T10:00:00Z' },
        { id: 101, name: 'Hardware', created_at: '2026-02-08T11:00:00Z' },
        { id: 102, name: 'Books', created_at: '2026-02-08T12:00:00Z' }
      ];

      const apiResponse: CreateListResponse = {
        id: 101,
        name: 'Hardware'
      };

      const result = findCreatedList(shoppingLists, apiResponse);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(101);
      expect(result?.name).toBe('Hardware');
    });

    it('should return first matching list if ID found', () => {
      const shoppingLists: ShoppingList[] = [
        { id: 100, name: 'Groceries', created_at: '2026-02-08T10:00:00Z' },
        { id: 100, name: 'Duplicate', created_at: '2026-02-08T11:00:00Z' } // Shouldn't happen, but defensive
      ];

      const apiResponse: CreateListResponse = {
        id: 100,
        name: 'Groceries'
      };

      const result = findCreatedList(shoppingLists, apiResponse);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(100);
      expect(result?.name).toBe('Groceries'); // First match
    });
  });

  describe('Strategy 2: Find by name (most recent)', () => {
    it('should find list by name if ID not found', () => {
      const shoppingLists: ShoppingList[] = [
        { id: 200, name: 'Groceries', created_at: '2026-02-08T10:00:00Z' },
        { id: 201, name: 'Hardware', created_at: '2026-02-08T11:00:00Z' }
      ];

      // API returned ID 999 (not in state), but name matches
      const apiResponse: CreateListResponse = {
        id: 999,
        name: 'Hardware'
      };

      const result = findCreatedList(shoppingLists, apiResponse);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(201); // Found by name
      expect(result?.name).toBe('Hardware');
    });

    it('should return most recent list if multiple lists with same name', () => {
      const shoppingLists: ShoppingList[] = [
        { id: 300, name: 'Groceries', created_at: '2026-02-08T10:00:00Z' },
        { id: 301, name: 'Groceries', created_at: '2026-02-08T12:00:00Z' }, // Most recent
        { id: 302, name: 'Groceries', created_at: '2026-02-08T11:00:00Z' }
      ];

      // API returned ID not in state
      const apiResponse: CreateListResponse = {
        id: 999,
        name: 'Groceries'
      };

      const result = findCreatedList(shoppingLists, apiResponse);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(301); // Most recent (12:00)
      expect(result?.created_at).toBe('2026-02-08T12:00:00Z');
    });
  });

  describe('Fallback failure scenarios', () => {
    it('should return null if list not found by ID or name', () => {
      const shoppingLists: ShoppingList[] = [
        { id: 100, name: 'Groceries', created_at: '2026-02-08T10:00:00Z' },
        { id: 101, name: 'Hardware', created_at: '2026-02-08T11:00:00Z' }
      ];

      // API returned ID and name not in state
      const apiResponse: CreateListResponse = {
        id: 999,
        name: 'Books'
      };

      const result = findCreatedList(shoppingLists, apiResponse);

      expect(result).toBeNull();
    });

    it('should return null if state is empty', () => {
      const shoppingLists: ShoppingList[] = [];

      const apiResponse: CreateListResponse = {
        id: 100,
        name: 'Groceries'
      };

      const result = findCreatedList(shoppingLists, apiResponse);

      expect(result).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle lists with no temp_id', () => {
      const shoppingLists: ShoppingList[] = [
        { id: 100, name: 'Groceries', created_at: '2026-02-08T10:00:00Z' } // No temp_id
      ];

      const apiResponse: CreateListResponse = {
        id: 100,
        name: 'Groceries'
      };

      const result = findCreatedList(shoppingLists, apiResponse);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(100);
    });

    it('should prefer Strategy 1 (ID) over Strategy 2 (name)', () => {
      const shoppingLists: ShoppingList[] = [
        { id: 100, name: 'Hardware', created_at: '2026-02-08T10:00:00Z' },
        { id: 101, name: 'Groceries', created_at: '2026-02-08T11:00:00Z' } // Matches by name
      ];

      // API returned ID 100, name "Groceries" (name mismatch but ID match)
      const apiResponse: CreateListResponse = {
        id: 100,
        name: 'Groceries'
      };

      const result = findCreatedList(shoppingLists, apiResponse);

      // Should find by ID (Strategy 1), not by name
      expect(result).not.toBeNull();
      expect(result?.id).toBe(100);
      expect(result?.name).toBe('Hardware'); // NOT "Groceries"
    });

    it('should handle empty string names', () => {
      const shoppingLists: ShoppingList[] = [
        { id: 100, name: '', created_at: '2026-02-08T10:00:00Z' }
      ];

      const apiResponse: CreateListResponse = {
        id: 999,
        name: ''
      };

      const result = findCreatedList(shoppingLists, apiResponse);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(100);
      expect(result?.name).toBe('');
    });

    it('should handle special characters in names', () => {
      const shoppingLists: ShoppingList[] = [
        { id: 100, name: 'Список №1 <test>', created_at: '2026-02-08T10:00:00Z' }
      ];

      const apiResponse: CreateListResponse = {
        id: 999,
        name: 'Список №1 <test>'
      };

      const result = findCreatedList(shoppingLists, apiResponse);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(100);
    });
  });

  describe('Race condition scenarios', () => {
    it('should handle case where API response faster than Dexie sync', () => {
      // Dexie hasn't synced yet - list not in state
      const shoppingLists: ShoppingList[] = [];

      const apiResponse: CreateListResponse = {
        id: 100,
        name: 'New List'
      };

      const result = findCreatedList(shoppingLists, apiResponse);

      // Should return null (expected failure - toast will warn user)
      expect(result).toBeNull();
    });

    it('should handle delayed Dexie sync with name fallback', () => {
      // Dexie synced with temp_id, but server ID not updated yet
      const shoppingLists: ShoppingList[] = [
        { id: 0, temp_id: 'temp-123', name: 'New List', created_at: '2026-02-08T12:00:00Z' }
      ];

      const apiResponse: CreateListResponse = {
        id: 100,
        name: 'New List'
      };

      const result = findCreatedList(shoppingLists, apiResponse);

      // Should find by name (Strategy 2)
      expect(result).not.toBeNull();
      expect(result?.name).toBe('New List');
      expect(result?.temp_id).toBe('temp-123');
    });
  });
});

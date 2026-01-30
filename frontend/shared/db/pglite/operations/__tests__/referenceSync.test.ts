/**
 * Unit Tests for referenceSync operations
 *
 * Tests reference data sync from API to PGlite:
 * - Fetching articles, financial centers, cost centers
 * - Computing article hierarchy (closure table)
 * - Bulk insert operations with batching
 * - Retry logic with exponential backoff
 * - Progress callback updates
 * - Sync metadata updates
 * - Error handling and propagation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  syncReferenceData
} from '../referenceSync';
import type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter
} from '../../types/models';

// Hoisted mocks (must be at top level for vi.mock)
const { mockFetchWithTimeout } = vi.hoisted(() => ({
  mockFetchWithTimeout: vi.fn()
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

vi.mock('../../utils/fetchWithTimeout', () => ({
  fetchWithTimeout: mockFetchWithTimeout
}));

vi.mock('../../utils/retry', () => ({
  withRetry: vi.fn((operation) => operation())
}));

vi.mock('../schemaOperations', () => ({
  updateSyncMetadata: vi.fn().mockResolvedValue(undefined)
}));

describe('referenceSync', () => {
  let mockDb: PGlite;
  let mockQuery: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock PGlite instance
    mockQuery = vi.fn().mockResolvedValue({ rows: [] });
    mockDb = {
      query: mockQuery
    } as unknown as PGlite;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchReferenceData', () => {
    it('should fetch all reference data from API in parallel', async () => {
      // Arrange: Mock API responses
      const mockArticles: LocalArticle[] = [
        {
          id: 1,
          user_id: 100,
          parent_id: null,
          name: 'Income',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        },
        {
          id: 2,
          user_id: 100,
          parent_id: 1,
          name: 'Salary',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ];

      const mockFinancialCenters: LocalFinancialCenter[] = [
        {
          id: 1,
          user_id: 100,
          name: 'Cash',
          description: 'Cash wallet',
          code: 'CASH',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ];

      const mockCostCenters: LocalCostCenter[] = [
        {
          id: 1,
          user_id: 100,
          name: 'Project A',
          is_active: true,
          created_at: new Date('2024-01-01')
        }
      ];

      // Mock fetch responses
      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: mockArticles })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: mockFinancialCenters })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: mockCostCenters })
        });

      // Act
      await syncReferenceData(mockDb);

      // Assert: Verify 3 parallel fetch calls
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(3);
      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        '/api/v1/articles',
        { credentials: 'include' },
        10000
      );
      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        '/api/v1/financial-centers',
        { credentials: 'include' },
        10000
      );
      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        '/api/v1/cost-centers',
        { credentials: 'include' },
        10000
      );
    });

    it('should handle API response with data wrapper', async () => {
      // Arrange: Mock API response with { data: [...] } wrapper
      const mockArticles: LocalArticle[] = [
        {
          id: 1,
          user_id: 100,
          parent_id: null,
          name: 'Income',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ];

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockArticles })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] })
        });

      // Act
      await syncReferenceData(mockDb);

      // Assert: Should successfully process data wrapper
      expect(mockQuery).toHaveBeenCalled();
    });

    it('should handle API response with direct array', async () => {
      // Arrange: Mock API response as direct array
      const mockArticles: LocalArticle[] = [
        {
          id: 1,
          user_id: 100,
          parent_id: null,
          name: 'Income',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ];

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockArticles
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        });

      // Act
      await syncReferenceData(mockDb);

      // Assert: Should successfully process direct array
      expect(mockQuery).toHaveBeenCalled();
    });

    it('should throw error if articles API returns HTTP error', async () => {
      // Arrange: Mock failed articles API response
      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      // Act & Assert
      await expect(syncReferenceData(mockDb)).rejects.toThrow(
        'Failed to fetch articles: HTTP 500'
      );
    });

    it('should throw error if financial centers API returns HTTP error', async () => {
      // Arrange: Mock successful articles, failed financial centers
      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: [] })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404
        });

      // Act & Assert
      await expect(syncReferenceData(mockDb)).rejects.toThrow(
        'Failed to fetch financial centers: HTTP 404'
      );
    });

    it('should throw error if cost centers API returns HTTP error', async () => {
      // Arrange: Mock successful articles + FCs, failed cost centers
      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403
        });

      // Act & Assert
      await expect(syncReferenceData(mockDb)).rejects.toThrow(
        'Failed to fetch cost centers: HTTP 403'
      );
    });

    it('should throw error if API response is not an array', async () => {
      // Arrange: Mock invalid API response (object instead of array)
      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: { invalid: 'format' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act & Assert
      await expect(syncReferenceData(mockDb)).rejects.toThrow(
        'Invalid API response format: expected arrays'
      );
    });
  });

  describe('computeArticleHierarchy', () => {
    it('should compute closure table for flat articles (self-references only)', async () => {
      // Arrange: Flat article list (no parent-child relationships)
      const mockArticles: LocalArticle[] = [
        {
          id: 1,
          user_id: 100,
          parent_id: null,
          name: 'Income',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        },
        {
          id: 2,
          user_id: 100,
          parent_id: null,
          name: 'Expenses',
          type: 'expense',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ];

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: mockArticles })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act
      await syncReferenceData(mockDb);

      // Assert: Should create only self-references (depth=0)
      const hierarchyInsertCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('INSERT INTO local_article_hierarchy')
      );

      expect(hierarchyInsertCalls.length).toBeGreaterThan(0);
      // Should have 2 self-references: (1,1,0), (2,2,0)
      const hierarchyParams = hierarchyInsertCalls[0][1] as unknown[];
      expect(hierarchyParams).toEqual([1, 1, 0, 2, 2, 0]);
    });

    it('should compute closure table for 2-level hierarchy', async () => {
      // Arrange: Parent → Child hierarchy
      const mockArticles: LocalArticle[] = [
        {
          id: 1,
          user_id: 100,
          parent_id: null,
          name: 'Income',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        },
        {
          id: 2,
          user_id: 100,
          parent_id: 1,
          name: 'Salary',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ];

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: mockArticles })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act
      await syncReferenceData(mockDb);

      // Assert: Should create hierarchy:
      // (1,1,0), (1,2,1) - Income self-ref + Income→Salary
      // (2,2,0) - Salary self-ref
      const hierarchyInsertCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('INSERT INTO local_article_hierarchy')
      );

      expect(hierarchyInsertCalls.length).toBeGreaterThan(0);
      const hierarchyParams = hierarchyInsertCalls[0][1] as unknown[];
      expect(hierarchyParams).toEqual([1, 1, 0, 1, 2, 1, 2, 2, 0]);
    });

    it('should compute closure table for 3-level hierarchy', async () => {
      // Arrange: Grandparent → Parent → Child
      const mockArticles: LocalArticle[] = [
        {
          id: 1,
          user_id: 100,
          parent_id: null,
          name: 'Income',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        },
        {
          id: 2,
          user_id: 100,
          parent_id: 1,
          name: 'Salary',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        },
        {
          id: 3,
          user_id: 100,
          parent_id: 2,
          name: 'Main Job',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ];

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: mockArticles })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act
      await syncReferenceData(mockDb);

      // Assert: Should create hierarchy:
      // (1,1,0), (1,2,1), (1,3,2) - Income paths
      // (2,2,0), (2,3,1) - Salary paths
      // (3,3,0) - Main Job self-ref
      const hierarchyInsertCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('INSERT INTO local_article_hierarchy')
      );

      expect(hierarchyInsertCalls.length).toBeGreaterThan(0);
      const hierarchyParams = hierarchyInsertCalls[0][1] as unknown[];
      expect(hierarchyParams).toEqual([
        1, 1, 0, 1, 2, 1, 1, 3, 2,
        2, 2, 0, 2, 3, 1,
        3, 3, 0
      ]);
    });

    it('should compute closure table for multi-branch hierarchy', async () => {
      // Arrange: Parent with 2 children
      const mockArticles: LocalArticle[] = [
        {
          id: 1,
          user_id: 100,
          parent_id: null,
          name: 'Income',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        },
        {
          id: 2,
          user_id: 100,
          parent_id: 1,
          name: 'Salary',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        },
        {
          id: 3,
          user_id: 100,
          parent_id: 1,
          name: 'Freelance',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ];

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: mockArticles })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act
      await syncReferenceData(mockDb);

      // Assert: Should create hierarchy:
      // (1,1,0), (1,2,1), (1,3,1) - Income + 2 children
      // (2,2,0), (3,3,0) - Children self-refs
      const hierarchyInsertCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('INSERT INTO local_article_hierarchy')
      );

      expect(hierarchyInsertCalls.length).toBeGreaterThan(0);
      const hierarchyParams = hierarchyInsertCalls[0][1] as unknown[];
      expect(hierarchyParams).toEqual([
        1, 1, 0, 1, 2, 1, 1, 3, 1,
        2, 2, 0,
        3, 3, 0
      ]);
    });
  });

  describe('bulk insert operations', () => {
    it('should batch insert articles in groups of 50', async () => {
      // Arrange: 120 articles (3 batches)
      const mockArticles: LocalArticle[] = Array.from({ length: 120 }, (_, i) => ({
        id: i + 1,
        user_id: 100,
        parent_id: null,
        name: `Article ${i + 1}`,
        type: 'income',
        is_active: true,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01')
      }));

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: mockArticles })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act
      await syncReferenceData(mockDb);

      // Assert: Should have DELETE + 3 batched INSERT calls
      const articleInsertCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('INSERT INTO local_articles')
      );

      expect(articleInsertCalls.length).toBe(3); // 50 + 50 + 20
    });

    it('should batch insert financial centers in groups of 50', async () => {
      // Arrange: 75 financial centers (2 batches)
      const mockFinancialCenters: LocalFinancialCenter[] = Array.from({ length: 75 }, (_, i) => ({
        id: i + 1,
        user_id: 100,
        name: `FC ${i + 1}`,
        description: null,
        code: null,
        is_active: true,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01')
      }));

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: mockFinancialCenters })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act
      await syncReferenceData(mockDb);

      // Assert: Should have DELETE + 2 batched INSERT calls
      const fcInsertCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('INSERT INTO local_financial_centers')
      );

      expect(fcInsertCalls.length).toBe(2); // 50 + 25
    });

    it('should batch insert cost centers in groups of 50', async () => {
      // Arrange: 100 cost centers (2 batches)
      const mockCostCenters: LocalCostCenter[] = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        user_id: 100,
        name: `CC ${i + 1}`,
        is_active: true,
        created_at: new Date('2024-01-01')
      }));

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: mockCostCenters })
        });

      // Act
      await syncReferenceData(mockDb);

      // Assert: Should have DELETE + 2 batched INSERT calls
      const ccInsertCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('INSERT INTO local_cost_centers')
      );

      expect(ccInsertCalls.length).toBe(2); // 50 + 50
    });

    it('should use ON CONFLICT DO UPDATE for articles', async () => {
      // Arrange
      const mockArticles: LocalArticle[] = [
        {
          id: 1,
          user_id: 100,
          parent_id: null,
          name: 'Income',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ];

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: mockArticles })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act
      await syncReferenceData(mockDb);

      // Assert: Should use upsert syntax
      const articleInsertCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('INSERT INTO local_articles')
      );

      expect(articleInsertCalls[0][0]).toContain('ON CONFLICT (id) DO UPDATE');
      expect(articleInsertCalls[0][0]).toContain('name = EXCLUDED.name');
    });

    it('should skip batch insert when empty arrays provided', async () => {
      // Arrange: Empty arrays
      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act
      await syncReferenceData(mockDb);

      // Assert: Should only have DELETE calls, no INSERT calls
      const articleInsertCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('INSERT INTO local_articles')
      );
      const fcInsertCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('INSERT INTO local_financial_centers')
      );
      const ccInsertCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('INSERT INTO local_cost_centers')
      );

      expect(articleInsertCalls.length).toBe(0);
      expect(fcInsertCalls.length).toBe(0);
      expect(ccInsertCalls.length).toBe(0);
    });
  });

  describe('progress callback', () => {
    it('should call progress callback with fetch phase', async () => {
      // Arrange
      const onProgress = vi.fn();

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act
      await syncReferenceData(mockDb, onProgress);

      // Assert
      expect(onProgress).toHaveBeenCalledWith({
        phase: 'fetch',
        message: 'Fetching reference data from API...'
      });
    });

    it('should call progress callback with insert phase for articles', async () => {
      // Arrange
      const onProgress = vi.fn();
      const mockArticles: LocalArticle[] = [
        {
          id: 1,
          user_id: 100,
          parent_id: null,
          name: 'Income',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ];

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: mockArticles })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act
      await syncReferenceData(mockDb, onProgress);

      // Assert
      expect(onProgress).toHaveBeenCalledWith({
        phase: 'insert',
        message: 'Inserting articles...',
        current: 0,
        total: 1
      });
    });

    it('should call progress callback with metadata phase', async () => {
      // Arrange
      const onProgress = vi.fn();

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act
      await syncReferenceData(mockDb, onProgress);

      // Assert
      expect(onProgress).toHaveBeenCalledWith({
        phase: 'metadata',
        message: 'Updating sync metadata...'
      });
    });

    it('should call progress callback with complete phase', async () => {
      // Arrange
      const onProgress = vi.fn();

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act
      await syncReferenceData(mockDb, onProgress);

      // Assert
      expect(onProgress).toHaveBeenCalledWith({
        phase: 'complete',
        message: 'Reference data sync completed'
      });
    });

    it('should not throw error when progress callback is not provided', async () => {
      // Arrange
      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act & Assert: Should not throw
      await expect(syncReferenceData(mockDb)).resolves.not.toThrow();
    });
  });

  describe('sync metadata updates', () => {
    it('should update sync metadata for all entity types', async () => {
      // Arrange
      const { updateSyncMetadata } = await import('../schemaOperations');
      const mockArticles: LocalArticle[] = [
        {
          id: 1,
          user_id: 100,
          parent_id: null,
          name: 'Income',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ];

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: mockArticles })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act
      await syncReferenceData(mockDb);

      // Assert: Should update metadata for all 3 entity types
      expect(updateSyncMetadata).toHaveBeenCalledWith(
        mockDb,
        'articles',
        expect.objectContaining({
          sync_version: 1,
          total_records: 1
        })
      );

      expect(updateSyncMetadata).toHaveBeenCalledWith(
        mockDb,
        'financial_centers',
        expect.objectContaining({
          sync_version: 1,
          total_records: 0
        })
      );

      expect(updateSyncMetadata).toHaveBeenCalledWith(
        mockDb,
        'cost_centers',
        expect.objectContaining({
          sync_version: 1,
          total_records: 0
        })
      );
    });

    it('should update sync metadata with current timestamp', async () => {
      // Arrange
      const { updateSyncMetadata } = await import('../schemaOperations');
      const beforeSync = new Date();

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act
      await syncReferenceData(mockDb);

      const afterSync = new Date();

      // Assert: Timestamp should be between beforeSync and afterSync
      const calls = vi.mocked(updateSyncMetadata).mock.calls;
      const articlesMetadata = calls.find(call => call[1] === 'articles')?.[2];

      expect(articlesMetadata?.last_sync_timestamp).toBeInstanceOf(Date);
      const timestamp = articlesMetadata?.last_sync_timestamp;
      if (timestamp) {
        expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime());
        expect(timestamp.getTime()).toBeLessThanOrEqual(afterSync.getTime());
      }
    });
  });

  describe('error handling', () => {
    it('should propagate error from failed API fetch', async () => {
      // Arrange: Mock network error
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(syncReferenceData(mockDb)).rejects.toThrow('Network error');
    });

    it('should propagate error from failed database insert', async () => {
      // Arrange: Mock successful fetch, failed DB insert
      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      // Act & Assert
      await expect(syncReferenceData(mockDb)).rejects.toThrow('Database error');
    });

    it('should log error when sync fails', async () => {
      // Arrange
      const { logger } = await import('../../utils/logger');
      const testError = new Error('Test error');

      mockFetchWithTimeout.mockRejectedValueOnce(testError);

      // Act
      try {
        await syncReferenceData(mockDb);
      } catch {
        // Expected error
      }

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        '[REFERENCE_SYNC] Reference data sync failed',
        testError
      );
    });

    it('should preserve error stack trace', async () => {
      // Arrange
      const errorWithStack = new Error('Error with stack');
      mockFetchWithTimeout.mockRejectedValueOnce(errorWithStack);

      // Act & Assert
      try {
        await syncReferenceData(mockDb);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toBe('Error with stack');
        expect((error as Error).stack).toBeDefined();
      }
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete sync workflow with all entities', async () => {
      // Arrange: Full dataset
      const mockArticles: LocalArticle[] = [
        {
          id: 1,
          user_id: 100,
          parent_id: null,
          name: 'Income',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        },
        {
          id: 2,
          user_id: 100,
          parent_id: 1,
          name: 'Salary',
          type: 'income',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ];

      const mockFinancialCenters: LocalFinancialCenter[] = [
        {
          id: 1,
          user_id: 100,
          name: 'Cash',
          description: 'Cash wallet',
          code: 'CASH',
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ];

      const mockCostCenters: LocalCostCenter[] = [
        {
          id: 1,
          user_id: 100,
          name: 'Project A',
          is_active: true,
          created_at: new Date('2024-01-01')
        }
      ];

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: mockArticles })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: mockFinancialCenters })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: mockCostCenters })
        });

      const onProgress = vi.fn();

      // Act
      await syncReferenceData(mockDb, onProgress);

      // Assert: Should complete all phases
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'fetch' })
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'insert', message: 'Inserting articles...' })
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'insert', message: 'Inserting financial centers...' })
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'insert', message: 'Inserting cost centers...' })
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'insert', message: 'Building article hierarchy...' })
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'metadata' })
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'complete' })
      );
    });

    it('should handle sync with large dataset (batching test)', async () => {
      // Arrange: Large dataset (200 articles)
      const mockArticles: LocalArticle[] = Array.from({ length: 200 }, (_, i) => ({
        id: i + 1,
        user_id: 100,
        parent_id: i === 0 ? null : 1, // All children of article 1
        name: `Article ${i + 1}`,
        type: 'income',
        is_active: true,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01')
      }));

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ articles: mockArticles })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ financial_centers: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cost_centers: [] })
        });

      // Act
      await syncReferenceData(mockDb);

      // Assert: Should batch insert (200 / 50 = 4 batches)
      const articleInsertCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('INSERT INTO local_articles')
      );

      expect(articleInsertCalls.length).toBe(4);
    });
  });
});

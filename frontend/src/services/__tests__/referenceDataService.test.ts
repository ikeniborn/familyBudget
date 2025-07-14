import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  periodService,
  financialCenterService,
  costCenterService,
  nomenclatureService,
  productService,
  Period,
  FinancialCenter,
  CostCenter,
  Nomenclature,
  Product
} from '../referenceDataService';

// Mock fetch
global.fetch = jest.fn();

describe('ReferenceDataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear service caches
    periodService.clearCache();
    financialCenterService.clearCache();
    costCenterService.clearCache();
    nomenclatureService.clearCache();
    productService.clearCache();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('BaseReferenceDataService', () => {
    describe('getAll', () => {
      it('should fetch all items for a user', async () => {
        const mockPeriods: Period[] = [
          {
            period_id: 1,
            period_name: 'Январь 2024',
            period_year: 2024,
            period_month: 1,
            period_order: 202401,
            user_id: 1,
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockPeriods
        });

        const result = await periodService.getAll(1);
        
        expect(global.fetch).toHaveBeenCalledWith('/api/periods?user_id=1');
        expect(result).toEqual(mockPeriods);
      });

      it('should use cache for subsequent calls within cache time', async () => {
        const mockPeriods: Period[] = [{ period_id: 1 } as Period];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockPeriods
        });

        // First call
        await periodService.getAll(1);
        
        // Second call should use cache
        const result = await periodService.getAll(1);
        
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(result).toEqual(mockPeriods);
      });

      it('should handle fetch errors', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        });

        await expect(periodService.getAll(1)).rejects.toThrow('Failed to fetch periods');
      });

      it('should retry on failure', async () => {
        // First two attempts fail, third succeeds
        (global.fetch as jest.Mock)
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Error'
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Error'
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => []
          });

        const result = await periodService.getAll(1);
        
        expect(global.fetch).toHaveBeenCalledTimes(3);
        expect(result).toEqual([]);
      });
    });

    describe('getById', () => {
      it('should fetch a single item by id', async () => {
        const mockPeriod: Period = { period_id: 1 } as Period;

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockPeriod
        });

        const result = await periodService.getById(1, 1);
        
        expect(global.fetch).toHaveBeenCalledWith('/api/periods/1?user_id=1');
        expect(result).toEqual(mockPeriod);
      });
    });

    describe('create', () => {
      it('should create a new item', async () => {
        const newPeriod = {
          period_name: 'Февраль 2024',
          period_year: 2024,
          period_month: 2,
          period_order: 202402,
          is_active: true
        };

        const createdPeriod: Period = {
          ...newPeriod,
          period_id: 2,
          user_id: 1,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => createdPeriod
        });

        const result = await periodService.create(newPeriod, 1);
        
        expect(global.fetch).toHaveBeenCalledWith('/api/periods', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ...newPeriod, user_id: 1 })
        });
        expect(result).toEqual(createdPeriod);
      });

      it('should invalidate cache after creation', async () => {
        const mockPeriods: Period[] = [{ period_id: 1 } as Period];
        const newPeriod = { period_name: 'Test' } as Omit<Period, 'period_id'>;
        const createdPeriod: Period = { ...newPeriod, period_id: 2 } as Period;

        // Initial fetch
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockPeriods
        });
        await periodService.getAll(1);

        // Create new period
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => createdPeriod
        });
        await periodService.create(newPeriod, 1);

        // Next getAll should fetch again (cache invalidated)
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => [...mockPeriods, createdPeriod]
        });
        await periodService.getAll(1);

        expect(global.fetch).toHaveBeenCalledTimes(3);
      });
    });

    describe('update', () => {
      it('should update an existing item', async () => {
        const updates = { period_name: 'Updated Name' };
        const updatedPeriod: Period = {
          period_id: 1,
          period_name: 'Updated Name',
          period_year: 2024,
          period_month: 1,
          period_order: 202401,
          user_id: 1,
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => updatedPeriod
        });

        const result = await periodService.update(1, updates, 1);
        
        expect(global.fetch).toHaveBeenCalledWith('/api/periods/1', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ...updates, user_id: 1 })
        });
        expect(result).toEqual(updatedPeriod);
      });
    });

    describe('delete', () => {
      it('should delete an item', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({})
        });

        await periodService.delete(1, 1);
        
        expect(global.fetch).toHaveBeenCalledWith('/api/periods/1?user_id=1', {
          method: 'DELETE'
        });
      });

      it('should invalidate cache after deletion', async () => {
        // Delete period
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({})
        });
        await periodService.delete(1, 1);

        // Verify cache was cleared by checking BroadcastChannel
        expect(periodService.getCacheInfo().size).toBe(0);
      });
    });

    describe('Real-time synchronization', () => {
      it('should sync changes across service instances', async () => {
        const mockPeriods: Period[] = [{ period_id: 1 } as Period];

        // Initial fetch in first instance
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockPeriods
        });
        await periodService.getAll(1);

        // Simulate broadcast message for cache invalidation
        const channel = new BroadcastChannel('reference_data_sync');
        channel.postMessage({
          type: 'CACHE_INVALIDATE',
          entityType: 'periods'
        });

        // Give time for message to process
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify cache was cleared
        expect(periodService.getCacheInfo().size).toBe(0);
      });
    });
  });

  describe('FinancialCenterService', () => {
    it('should handle hierarchical data', async () => {
      const mockCenters: FinancialCenter[] = [
        {
          financial_center_id: 1,
          financial_center_name: 'Parent',
          parent_id: null,
          is_active: true
        } as FinancialCenter,
        {
          financial_center_id: 2,
          financial_center_name: 'Child',
          parent_id: 1,
          is_active: true
        } as FinancialCenter
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCenters
      });

      const result = await financialCenterService.getAll(1);
      
      expect(result).toEqual(mockCenters);
      expect(result[1].parent_id).toBe(1);
    });
  });

  describe('CostCenterService', () => {
    it('should handle budget limits', async () => {
      const mockCostCenter: CostCenter = {
        cost_center_id: 1,
        cost_center_name: 'Marketing',
        financial_center_id: 1,
        budget_limit: 100000,
        budget_period: 'monthly',
        is_active: true
      } as CostCenter;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCostCenter
      });

      const result = await costCenterService.getById(1, 1);
      
      expect(result.budget_limit).toBe(100000);
      expect(result.budget_period).toBe('monthly');
    });
  });

  describe('NomenclatureService', () => {
    it('should handle nomenclature types and colors', async () => {
      const mockNomenclature: Nomenclature = {
        nomenclature_id: 1,
        nomenclature_name: 'Продукты',
        nomenclature_type: 'EXPENSE',
        parent_id: null,
        color: '#FF5733',
        icon: 'shopping-cart',
        is_active: true
      } as Nomenclature;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNomenclature
      });

      const result = await nomenclatureService.getById(1, 1);
      
      expect(result.nomenclature_type).toBe('EXPENSE');
      expect(result.color).toBe('#FF5733');
      expect(result.icon).toBe('shopping-cart');
    });
  });

  describe('ProductService', () => {
    describe('Special product methods', () => {
      it('should get products by category', async () => {
        const mockProducts: Product[] = [
          {
            product_id: 1,
            product_name: 'Молоко',
            category_ids: [5]
          } as Product,
          {
            product_id: 2,
            product_name: 'Хлеб',
            category_ids: [5]
          } as Product
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockProducts
        });

        const result = await productService.getByCategory(5, 1);
        
        expect(global.fetch).toHaveBeenCalledWith('/api/products/category/5?user_id=1');
        expect(result).toEqual(mockProducts);
      });

      it('should search products', async () => {
        const mockProducts: Product[] = [
          {
            product_id: 1,
            product_name: 'Молоко 2.5%'
          } as Product
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockProducts
        });

        const result = await productService.search('молоко', 1);
        
        expect(global.fetch).toHaveBeenCalledWith('/api/products/search?q=молоко&user_id=1');
        expect(result).toEqual(mockProducts);
      });

      it('should get product price history', async () => {
        const mockHistory = [
          { price: 100, date: '2024-01-01' },
          { price: 105, date: '2024-01-15' }
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockHistory
        });

        const result = await productService.getPriceHistory(1, 1);
        
        expect(global.fetch).toHaveBeenCalledWith('/api/products/1/prices?user_id=1');
        expect(result).toEqual(mockHistory);
      });

      it('should update product price', async () => {
        const updatedProduct: Product = {
          product_id: 1,
          product_name: 'Test Product',
          current_price: 150
        } as Product;

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => updatedProduct
        });

        const result = await productService.updatePrice(1, 150, 1);
        
        expect(global.fetch).toHaveBeenCalledWith('/api/products/1/price', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ price: 150, user_id: 1 })
        });
        expect(result).toEqual(updatedProduct);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(periodService.getAll(1)).rejects.toThrow('Network error');
    });

    it('should handle JSON parse errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      await expect(periodService.getAll(1)).rejects.toThrow('Invalid JSON');
    });

    it('should handle rate limiting', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      await expect(periodService.getAll(1)).rejects.toThrow('Failed to fetch periods');
    });
  });

  describe('Cache management', () => {
    it('should provide cache information', async () => {
      const mockPeriods: Period[] = [{ period_id: 1 } as Period];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPeriods
      });

      await periodService.getAll(1);
      
      const cacheInfo = periodService.getCacheInfo();
      expect(cacheInfo.size).toBe(1);
      expect(cacheInfo.keys).toContain('getAll-1');
    });

    it('should clear cache', async () => {
      const mockPeriods: Period[] = [{ period_id: 1 } as Period];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPeriods
      });

      await periodService.getAll(1);
      periodService.clearCache();
      
      const cacheInfo = periodService.getCacheInfo();
      expect(cacheInfo.size).toBe(0);
    });
  });
});
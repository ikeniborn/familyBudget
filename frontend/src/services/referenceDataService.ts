import { apiClient } from '../api/client';
import { toast } from '../components/ui/use-toast';

// Types
export interface Period {
  period_id: number;
  period_name: string;
  period_year: number;
  period_month: number;
  period_order: number;
  user_id: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FinancialCenter {
  financial_center_id: number;
  financial_center_name: string;
  financial_center_description?: string;
  parent_id?: number | null;
  financial_center_order: number;
  user_id: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CostCenter {
  cost_center_id: number;
  cost_center_name: string;
  cost_center_description?: string;
  financial_center_id?: number | null;
  budget_limit?: number;
  budget_period?: 'monthly' | 'quarterly' | 'yearly';
  cost_center_order: number;
  user_id: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Nomenclature {
  nomenclature_id: number;
  nomenclature_name: string;
  nomenclature_type: 'INCOME' | 'EXPENSE';
  parent_id?: number | null;
  nomenclature_order: number;
  color?: string;
  icon?: string;
  user_id: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  product_id: number;
  product_name: string;
  product_description?: string;
  barcode?: string;
  unit?: string;
  category_ids?: number[];
  images?: string[];
  is_active?: boolean;
  user_id: number;
  created_at?: string;
  updated_at?: string;
}

export interface PriceHistory {
  id: number;
  product_id: number;
  price: number;
  store?: string;
  date: string;
  created_at: string;
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>();

// Error types
export class ReferenceDataError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ReferenceDataError';
  }
}

// Utility functions
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && error.response?.status >= 500) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

function getCacheKey(resource: string, params?: any): string {
  return `${resource}:${JSON.stringify(params || {})}`;
}

function getFromCache<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

function clearCache(resource?: string): void {
  if (resource) {
    // Clear specific resource cache
    for (const key of cache.keys()) {
      if (key.startsWith(resource)) {
        cache.delete(key);
      }
    }
  } else {
    // Clear all cache
    cache.clear();
  }
}

// Handle API errors
function handleApiError(error: any, operation: string): never {
  const message = error.response?.data?.detail || error.message || 'Произошла ошибка';
  const statusCode = error.response?.status;
  
  let code = 'UNKNOWN_ERROR';
  if (statusCode === 400) code = 'VALIDATION_ERROR';
  else if (statusCode === 401) code = 'UNAUTHORIZED';
  else if (statusCode === 403) code = 'FORBIDDEN';
  else if (statusCode === 404) code = 'NOT_FOUND';
  else if (statusCode === 409) code = 'CONFLICT';
  else if (statusCode >= 500) code = 'SERVER_ERROR';
  
  throw new ReferenceDataError(
    `${operation}: ${message}`,
    code,
    statusCode,
    error.response?.data
  );
}

// Base service class
abstract class BaseReferenceDataService<T> {
  protected abstract resource: string;
  protected abstract entityName: string;
  protected abstract idField: keyof T;

  async getAll(userId: number, useCache = true): Promise<T[]> {
    const cacheKey = getCacheKey(this.resource, { userId });
    
    if (useCache) {
      const cached = getFromCache<T[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      const response = await withRetry(() => 
        apiClient.get(`/${this.resource}?user_id=${userId}`)
      );
      
      const data = response.data;
      setCache(cacheKey, data);
      
      return data;
    } catch (error) {
      handleApiError(error, `Загрузка ${this.entityName}`);
    }
  }

  async getById(id: number, userId: number): Promise<T> {
    const cacheKey = getCacheKey(this.resource, { id, userId });
    
    const cached = getFromCache<T>(cacheKey);
    if (cached) return cached;

    try {
      const response = await withRetry(() => 
        apiClient.get(`/${this.resource}/${id}?user_id=${userId}`)
      );
      
      const data = response.data;
      setCache(cacheKey, data);
      
      return data;
    } catch (error) {
      handleApiError(error, `Загрузка ${this.entityName}`);
    }
  }

  async create(data: Omit<T, typeof this.idField>): Promise<T> {
    try {
      const response = await withRetry(() => 
        apiClient.post(`/${this.resource}`, data)
      );
      
      // Clear cache for this resource
      clearCache(this.resource);
      
      // Notify other tabs about the change
      this.broadcastChange('create', response.data);
      
      return response.data;
    } catch (error) {
      handleApiError(error, `Создание ${this.entityName}`);
    }
  }

  async update(id: number, data: Partial<T>): Promise<T> {
    try {
      const response = await withRetry(() => 
        apiClient.put(`/${this.resource}/${id}`, data)
      );
      
      // Clear cache for this resource
      clearCache(this.resource);
      
      // Notify other tabs about the change
      this.broadcastChange('update', response.data);
      
      return response.data;
    } catch (error) {
      handleApiError(error, `Обновление ${this.entityName}`);
    }
  }

  async delete(id: number): Promise<void> {
    try {
      await withRetry(() => 
        apiClient.delete(`/${this.resource}/${id}`)
      );
      
      // Clear cache for this resource
      clearCache(this.resource);
      
      // Notify other tabs about the change
      this.broadcastChange('delete', { id });
    } catch (error) {
      handleApiError(error, `Удаление ${this.entityName}`);
    }
  }

  async bulkDelete(ids: number[]): Promise<void> {
    try {
      await Promise.all(ids.map(id => this.delete(id)));
    } catch (error) {
      handleApiError(error, `Массовое удаление ${this.entityName}`);
    }
  }

  // Broadcast changes to other tabs
  protected broadcastChange(action: 'create' | 'update' | 'delete', data: any): void {
    const channel = new BroadcastChannel(`reference_data_${this.resource}`);
    channel.postMessage({ action, data, timestamp: Date.now() });
    channel.close();
  }

  // Listen for changes from other tabs
  subscribeToChanges(callback: (action: string, data: any) => void): () => void {
    const channel = new BroadcastChannel(`reference_data_${this.resource}`);
    
    const handler = (event: MessageEvent) => {
      callback(event.data.action, event.data.data);
    };
    
    channel.addEventListener('message', handler);
    
    // Return unsubscribe function
    return () => {
      channel.removeEventListener('message', handler);
      channel.close();
    };
  }

  // Validate uniqueness
  async validateUnique(
    field: keyof T,
    value: any,
    userId: number,
    excludeId?: number
  ): Promise<boolean> {
    try {
      const all = await this.getAll(userId, false);
      return !all.some(item => 
        item[field] === value && 
        (excludeId === undefined || item[this.idField] !== excludeId)
      );
    } catch (error) {
      console.error('Validation error:', error);
      return true; // Assume unique on error
    }
  }
}

// Period Service
class PeriodService extends BaseReferenceDataService<Period> {
  protected resource = 'periods';
  protected entityName = 'периодов';
  protected idField: keyof Period = 'period_id';

  // Check for period overlap
  async checkOverlap(
    year: number,
    month: number,
    userId: number,
    excludeId?: number
  ): Promise<boolean> {
    const periods = await this.getAll(userId);
    return periods.some(p => 
      p.period_year === year && 
      p.period_month === month &&
      (excludeId === undefined || p.period_id !== excludeId)
    );
  }

  // Get transaction count for period
  async getTransactionCount(periodId: number, userId: number): Promise<number> {
    try {
      const response = await apiClient.get(
        `/registry?user_id=${userId}&period_id=${periodId}`
      );
      return response.data.length || 0;
    } catch (error) {
      console.error('Failed to get transaction count:', error);
      return 0;
    }
  }
}

// Financial Center Service
class FinancialCenterService extends BaseReferenceDataService<FinancialCenter> {
  protected resource = 'financial_centers';
  protected entityName = 'финансовых центров';
  protected idField: keyof FinancialCenter = 'financial_center_id';

  // Get usage statistics
  async getUsageStats(financialCenterId: number, userId: number): Promise<{
    cost_centers_count: number;
    transactions_count: number;
    total_amount: number;
  }> {
    try {
      const [ccResponse, txResponse] = await Promise.all([
        apiClient.get(`/cost_centers?user_id=${userId}&financial_center_id=${financialCenterId}`),
        apiClient.get(`/registry?user_id=${userId}&financial_center_id=${financialCenterId}`)
      ]);
      
      return {
        cost_centers_count: ccResponse.data.length || 0,
        transactions_count: txResponse.data.length || 0,
        total_amount: txResponse.data.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)
      };
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return { cost_centers_count: 0, transactions_count: 0, total_amount: 0 };
    }
  }

  // Check if can delete (no children)
  async canDelete(id: number, userId: number): Promise<boolean> {
    const all = await this.getAll(userId);
    const hasChildren = all.some(fc => fc.parent_id === id);
    return !hasChildren;
  }
}

// Cost Center Service
class CostCenterService extends BaseReferenceDataService<CostCenter> {
  protected resource = 'cost_centers';
  protected entityName = 'центров затрат';
  protected idField: keyof CostCenter = 'cost_center_id';

  // Get usage amount
  async getUsageAmount(costCenterId: number, userId: number): Promise<number> {
    try {
      const response = await apiClient.get(
        `/registry?user_id=${userId}&cost_center_id=${costCenterId}`
      );
      return response.data.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
    } catch (error) {
      console.error('Failed to get usage amount:', error);
      return 0;
    }
  }

  // Bulk copy cost centers
  async bulkCopy(ids: number[], userId: number): Promise<CostCenter[]> {
    const costCenters = await this.getAll(userId);
    const created: CostCenter[] = [];
    
    for (const id of ids) {
      const original = costCenters.find(cc => cc.cost_center_id === id);
      if (!original) continue;
      
      const copy = {
        ...original,
        cost_center_name: `${original.cost_center_name} (копия)`,
        is_active: false
      };
      
      delete (copy as any).cost_center_id;
      delete (copy as any).created_at;
      delete (copy as any).updated_at;
      
      const newCostCenter = await this.create(copy);
      created.push(newCostCenter);
    }
    
    return created;
  }
}

// Nomenclature Service
class NomenclatureService extends BaseReferenceDataService<Nomenclature> {
  protected resource = 'nomenclatures';
  protected entityName = 'номенклатур';
  protected idField: keyof Nomenclature = 'nomenclature_id';

  // Get with hierarchy
  async getHierarchy(userId: number): Promise<Nomenclature[]> {
    const flat = await this.getAll(userId);
    return this.buildHierarchy(flat);
  }

  private buildHierarchy(items: Nomenclature[]): Nomenclature[] {
    const map = new Map<number, Nomenclature & { children?: Nomenclature[] }>();
    const roots: Nomenclature[] = [];

    // First pass: create map
    items.forEach(item => {
      map.set(item.nomenclature_id, { ...item, children: [] });
    });

    // Second pass: build tree
    items.forEach(item => {
      const node = map.get(item.nomenclature_id)!;
      if (item.parent_id && map.has(item.parent_id)) {
        const parent = map.get(item.parent_id)!;
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort by type and order
    roots.sort((a, b) => {
      if (a.nomenclature_type !== b.nomenclature_type) {
        return a.nomenclature_type === 'INCOME' ? -1 : 1;
      }
      return a.nomenclature_order - b.nomenclature_order;
    });

    return roots;
  }

  // Check if can delete (no children and no transactions)
  async canDelete(id: number, userId: number): Promise<{
    canDelete: boolean;
    reason?: string;
    hasChildren: boolean;
    transactionCount: number;
  }> {
    const [all, txResponse] = await Promise.all([
      this.getAll(userId),
      apiClient.get(`/registry?user_id=${userId}&nomenclature_id=${id}`)
    ]);
    
    const hasChildren = all.some(n => n.parent_id === id);
    const transactionCount = txResponse.data.length || 0;
    
    if (hasChildren) {
      return {
        canDelete: false,
        reason: 'Нельзя удалить категорию с подкатегориями',
        hasChildren: true,
        transactionCount
      };
    }
    
    return {
      canDelete: true,
      hasChildren: false,
      transactionCount
    };
  }
}

// Product Service
class ProductService extends BaseReferenceDataService<Product> {
  protected resource = 'products';
  protected entityName = 'продуктов';
  protected idField: keyof Product = 'product_id';

  // Add price to product
  async addPrice(productId: number, price: number, store?: string): Promise<PriceHistory> {
    try {
      const response = await apiClient.post(`/products/${productId}/prices`, {
        price,
        store,
        date: new Date().toISOString().split('T')[0]
      });
      
      // Clear cache
      clearCache(this.resource);
      
      return response.data;
    } catch (error) {
      handleApiError(error, 'Добавление цены');
    }
  }

  // Get price history
  async getPriceHistory(productId: number): Promise<PriceHistory[]> {
    try {
      const response = await apiClient.get(`/products/${productId}/prices`);
      return response.data;
    } catch (error) {
      handleApiError(error, 'Загрузка истории цен');
    }
  }

  // Search products
  async search(query: string, userId: number): Promise<Product[]> {
    try {
      const response = await apiClient.get(
        `/products/search?q=${encodeURIComponent(query)}&user_id=${userId}`
      );
      return response.data;
    } catch (error) {
      handleApiError(error, 'Поиск продуктов');
    }
  }
}

// Export service instances
export const periodService = new PeriodService();
export const financialCenterService = new FinancialCenterService();
export const costCenterService = new CostCenterService();
export const nomenclatureService = new NomenclatureService();
export const productService = new ProductService();

// Export utility to clear all caches
export function clearAllCaches(): void {
  clearCache();
}
import { BaseService } from './BaseService';
import { PrismaClient } from '../generated/prisma';
import { createHash } from 'crypto';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Cache key prefix
  userSpecific?: boolean; // Whether cache should be user-specific
}

export class CachedService extends BaseService {
  private cache: Map<string, { data: any; expiry: number }>;
  private defaultTTL: number;

  constructor(prisma: PrismaClient, defaultTTL: number = 300) { // 5 minutes default
    super(prisma);
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get data from cache or fetch using the provided function
   */
  protected async getCached<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const {
      ttl = this.defaultTTL,
      prefix = 'cache',
      userSpecific = false
    } = options;

    // Create cache key
    const cacheKey = this.createCacheKey(key, prefix, userSpecific ? 'user' : undefined);
    
    // Check if data exists in cache and is not expired
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data as T;
    }

    // Fetch fresh data
    const data = await fetcher();
    
    // Store in cache with expiry
    this.cache.set(cacheKey, {
      data,
      expiry: Date.now() + (ttl * 1000)
    });

    // Clean up expired entries periodically
    this.cleanupExpiredEntries();

    return data;
  }

  /**
   * Get user-specific cached data
   */
  protected async getUserCached<T>(
    userId: string,
    key: string,
    fetcher: (userId: number) => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const userKey = `user:${userId}:${key}`;
    
    return this.getCached(
      userKey,
      () => this.withUser(userId, fetcher),
      { ...options, userSpecific: true }
    );
  }

  /**
   * Invalidate cache entries by pattern
   */
  protected invalidateCache(pattern: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Invalidate user-specific cache
   */
  protected invalidateUserCache(userId: string, pattern?: string): void {
    const userPattern = `user:${userId}${pattern ? `:${pattern}` : ''}`;
    this.invalidateCache(userPattern);
  }

  /**
   * Clear all cache
   */
  protected clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  protected getCacheStats(): { size: number; hits: number; misses: number } {
    // This is a simplified version - in a real implementation,
    // you'd track hits and misses
    return {
      size: this.cache.size,
      hits: 0, // Would be tracked in real implementation
      misses: 0 // Would be tracked in real implementation
    };
  }

  /**
   * Create a consistent cache key
   */
  private createCacheKey(key: string, prefix: string, suffix?: string): string {
    const parts = [prefix, key];
    if (suffix) {
      parts.push(suffix);
    }
    
    // Create a hash for very long keys to avoid issues
    const fullKey = parts.join(':');
    if (fullKey.length > 200) {
      return `${prefix}:${createHash('md5').update(fullKey).digest('hex')}`;
    }
    
    return fullKey;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, value] of this.cache.entries()) {
      if (value.expiry <= now) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

/**
 * Enhanced Reference Data Service with caching
 */
export class CachedReferenceDataService extends CachedService {
  constructor(prisma: PrismaClient) {
    super(prisma, 7200); // 2 hours cache for reference data
  }

  async getPeriods() {
    return this.getCached(
      'periods',
      () => this.prisma.period.findMany({
        orderBy: { date: 'desc' }
      }),
      { ttl: 7200, prefix: 'reference' }
    );
  }

  async getFinancialCenters() {
    return this.getCached(
      'financial_centers',
      () => this.prisma.financialCenter.findMany({
        orderBy: { name: 'asc' }
      }),
      { ttl: 7200, prefix: 'reference' }
    );
  }

  async getCostCenters() {
    return this.getCached(
      'cost_centers',
      () => this.prisma.costCenter.findMany({
        orderBy: { name: 'asc' }
      }),
      { ttl: 7200, prefix: 'reference' }
    );
  }

  async getNomenclatures() {
    return this.getCached(
      'nomenclatures',
      () => this.prisma.nomenclature.findMany({
        orderBy: { name: 'asc' }
      }),
      { ttl: 7200, prefix: 'reference' }
    );
  }

  async getRowTypes() {
    return this.getCached(
      'row_types',
      () => this.prisma.rowType.findMany({
        orderBy: { name: 'asc' }
      }),
      { ttl: 7200, prefix: 'reference' }
    );
  }

  // Invalidate reference data cache when data is modified
  async createPeriod(data: { date: Date; ruName: string }) {
    const result = await this.prisma.period.create({ data });
    this.invalidateCache('reference:periods');
    return result;
  }

  async createFinancialCenter(name: string) {
    const result = await this.prisma.financialCenter.create({
      data: { name }
    });
    this.invalidateCache('reference:financial_centers');
    return result;
  }

  async createCostCenter(name: string) {
    const result = await this.prisma.costCenter.create({
      data: { name }
    });
    this.invalidateCache('reference:cost_centers');
    return result;
  }

  async createNomenclature(data: {
    name: string;
    accountName: string;
    billName: string;
    operation: string;
    isBudget: boolean;
    isFact: boolean;
  }) {
    const result = await this.prisma.nomenclature.create({ data });
    this.invalidateCache('reference:nomenclatures');
    return result;
  }

  async createRowType(name: string) {
    const result = await this.prisma.rowType.create({
      data: { name }
    });
    this.invalidateCache('reference:row_types');
    return result;
  }
}

/**
 * Enhanced Registry Service with caching
 */
export class CachedRegistryService extends CachedService {
  constructor(prisma: PrismaClient) {
    super(prisma, 300); // 5 minutes cache for registry data
  }

  async getLastRows(
    userId: string,
    rowTypeId?: number,
    limit: number = 5
  ) {
    const cacheKey = `last_rows:${rowTypeId || 'all'}:${limit}`;
    
    return this.getUserCached(
      userId,
      cacheKey,
      async (userIdInt) => {
        return this.prisma.registry.findMany({
          where: {
            userId: userIdInt,
            ...(rowTypeId && { rowTypeId })
          },
          include: {
            period: true,
            financialCenter: true,
            costCenter: true,
            nomenclature: true,
            rowType: true
          },
          orderBy: { id: 'desc' },
          take: limit
        });
      },
      { ttl: 300 }
    );
  }

  async getByPeriod(
    userId: string,
    periodId: number,
    rowTypeId?: number
  ) {
    const cacheKey = `period:${periodId}:${rowTypeId || 'all'}`;
    
    return this.getUserCached(
      userId,
      cacheKey,
      async (userIdInt) => {
        return this.prisma.registry.findMany({
          where: {
            userId: userIdInt,
            periodId,
            ...(rowTypeId && { rowTypeId })
          },
          include: {
            period: true,
            financialCenter: true,
            costCenter: true,
            nomenclature: true,
            rowType: true
          },
          orderBy: { operationDate: 'desc' }
        });
      },
      { ttl: 600 } // 10 minutes for period data
    );
  }

  // Invalidate user cache when registry data is modified
  async create(data: any, userId: string) {
    const result = await this.withUser(userId, async (userIdInt) => {
      const registry = await this.prisma.registry.create({
        data: {
          ...data,
          userId: userIdInt
        },
        include: {
          period: true,
          financialCenter: true,
          costCenter: true,
          nomenclature: true,
          rowType: true,
          user: true
        }
      });

      // Invalidate relevant caches
      this.invalidateUserCache(userId, 'last_rows');
      this.invalidateUserCache(userId, `period:${data.periodId}`);
      
      return registry;
    });
    
    return result;
  }

  async update(id: number, data: any, userId: string) {
    const result = await this.withUser(userId, async (userIdInt) => {
      const registry = await this.prisma.registry.update({
        where: { 
          id,
          userId: userIdInt
        },
        data,
        include: {
          period: true,
          financialCenter: true,
          costCenter: true,
          nomenclature: true,
          rowType: true
        }
      });

      // Invalidate relevant caches
      this.invalidateUserCache(userId, 'last_rows');
      this.invalidateUserCache(userId, `period:${registry.periodId}`);
      
      return registry;
    });
    
    return result;
  }

  async delete(id: number, userId: string) {
    // Get the registry first to know which caches to invalidate
    const registry = await this.prisma.registry.findFirst({
      where: { id, userId: parseInt(userId) },
      select: { periodId: true }
    });

    const result = await this.withUser(userId, async (userIdInt) => {
      return this.prisma.registry.delete({
        where: { 
          id,
          userId: userIdInt
        }
      });
    });

    // Invalidate relevant caches
    this.invalidateUserCache(userId, 'last_rows');
    if (registry) {
      this.invalidateUserCache(userId, `period:${registry.periodId}`);
    }
    
    return result;
  }
}
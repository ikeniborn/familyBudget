import { browser } from '$app/environment';
import { debounce } from '$lib/utils/performance';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
  etag?: string;
  stale: boolean;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  staleWhileRevalidate?: number; // Time to serve stale data while revalidating
  maxSize?: number; // Maximum number of entries
  serialize?: boolean; // Whether to serialize to localStorage
}

interface RequestOptions extends RequestInit {
  cacheKey?: string;
  cacheTtl?: number;
  skipCache?: boolean;
  onlyFromCache?: boolean;
}

class ApiCacheService {
  private cache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, Promise<any>>();
  private debouncedRequests = new Map<string, any>();
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl ?? 5 * 60 * 1000, // 5 minutes default
      staleWhileRevalidate: options.staleWhileRevalidate ?? 60 * 1000, // 1 minute default
      maxSize: options.maxSize ?? 100,
      serialize: options.serialize ?? true
    };

    if (browser && this.options.serialize) {
      this.loadFromStorage();
      this.setupStorageSync();
    }
  }

  // Main caching fetch wrapper
  async fetch<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    const cacheKey = options.cacheKey || this.generateCacheKey(url, options);
    
    // Skip cache if requested
    if (options.skipCache) {
      return this.performRequest(url, options);
    }

    // Try to get from cache first
    const cached = this.get<T>(cacheKey);
    
    if (cached) {
      // If data is fresh, return it
      if (!this.isStale(cached)) {
        return cached.data;
      }
      
      // If only from cache is requested, return stale data
      if (options.onlyFromCache) {
        return cached.data;
      }
      
      // If stale-while-revalidate is enabled, return stale data and update in background
      if (this.shouldServeStaleWhileRevalidate(cached)) {
        // Start background revalidation
        this.revalidateInBackground(url, options, cacheKey);
        return cached.data;
      }
    }

    // No valid cache, make request
    return this.performRequest(url, options, cacheKey);
  }

  // Debounced request to prevent duplicate calls
  debouncedFetch<T = any>(
    url: string, 
    options: RequestOptions = {}, 
    debounceMs: number = 300
  ): Promise<T> {
    const cacheKey = options.cacheKey || this.generateCacheKey(url, options);
    const debounceKey = `debounce:${cacheKey}`;
    
    // Cancel existing debounced request if any
    if (this.debouncedRequests.has(debounceKey)) {
      clearTimeout(this.debouncedRequests.get(debounceKey));
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(async () => {
        try {
          const result = await this.fetch<T>(url, options);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.debouncedRequests.delete(debounceKey);
        }
      }, debounceMs);

      this.debouncedRequests.set(debounceKey, timeoutId);
    });
  }

  // Batched requests
  async batchFetch<T = any>(requests: Array<{ url: string; options?: RequestOptions }>): Promise<T[]> {
    const promises = requests.map(({ url, options = {} }) => this.fetch<T>(url, options));
    return Promise.all(promises);
  }

  // Manual cache management
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl ?? this.options.ttl);
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt,
      stale: false
    };

    this.cache.set(key, entry);
    this.enforceMaxSize();
    this.saveToStorage();
  }

  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.saveToStorage();
      return null;
    }

    return entry;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
    this.saveToStorage();
  }

  // Prefetch data
  async prefetch(url: string, options: RequestOptions = {}): Promise<void> {
    const cacheKey = options.cacheKey || this.generateCacheKey(url, options);
    
    // Only prefetch if not already cached or stale
    const cached = this.get(cacheKey);
    if (cached && !this.isStale(cached)) {
      return;
    }

    try {
      await this.fetch(url, options);
    } catch (error) {
      // Prefetch failures should not throw
      console.warn('Prefetch failed:', error);
    }
  }

  // Invalidate cache entries by pattern
  invalidate(pattern: string | RegExp): number {
    let invalidatedCount = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }
    
    if (invalidatedCount > 0) {
      this.saveToStorage();
    }
    
    return invalidatedCount;
  }

  // Get cache stats
  getStats() {
    const now = Date.now();
    let freshCount = 0;
    let staleCount = 0;
    let expiredCount = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expiredCount++;
      } else if (this.isStale(entry)) {
        staleCount++;
      } else {
        freshCount++;
      }
    }

    return {
      totalEntries: this.cache.size,
      freshCount,
      staleCount,
      expiredCount,
      hitRatio: this.calculateHitRatio(),
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  // Private methods
  private async performRequest<T>(url: string, options: RequestOptions, cacheKey?: string): Promise<T> {
    // Deduplicate concurrent requests
    if (cacheKey && this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    const requestPromise = this.makeRequest<T>(url, options);
    
    if (cacheKey) {
      this.pendingRequests.set(cacheKey, requestPromise);
    }

    try {
      const result = await requestPromise;
      
      // Cache the result
      if (cacheKey && !options.skipCache) {
        this.set(cacheKey, result, options.cacheTtl);
      }
      
      return result;
    } catch (error) {
      throw error;
    } finally {
      if (cacheKey) {
        this.pendingRequests.delete(cacheKey);
      }
    }
  }

  private async makeRequest<T>(url: string, options: RequestOptions): Promise<T> {
    const { cacheKey, cacheTtl, skipCache, onlyFromCache, ...fetchOptions } = options;
    
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...fetchOptions.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  }

  private async revalidateInBackground(url: string, options: RequestOptions, cacheKey: string): Promise<void> {
    try {
      const result = await this.performRequest(url, { ...options, skipCache: true }, cacheKey);
      // Update will happen in performRequest
    } catch (error) {
      console.warn('Background revalidation failed:', error);
    }
  }

  private generateCacheKey(url: string, options: RequestOptions): string {
    const { method = 'GET', body } = options;
    const baseKey = `${method}:${url}`;
    
    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      return `${baseKey}:${this.hashString(bodyStr)}`;
    }
    
    return baseKey;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private isStale(entry: CacheEntry): boolean {
    const now = Date.now();
    const staleThreshold = entry.expiresAt - this.options.staleWhileRevalidate;
    return now > staleThreshold;
  }

  private shouldServeStaleWhileRevalidate(entry: CacheEntry): boolean {
    const now = Date.now();
    return now < entry.expiresAt && this.isStale(entry);
  }

  private enforceMaxSize(): void {
    if (this.cache.size <= this.options.maxSize) return;

    // Remove oldest entries
    const entries = Array.from(this.cache.entries())
      .sort(([,a], [,b]) => a.timestamp - b.timestamp);
    
    const toRemove = entries.slice(0, this.cache.size - this.options.maxSize);
    toRemove.forEach(([key]) => this.cache.delete(key));
  }

  private loadFromStorage(): void {
    if (!browser || !this.options.serialize) return;

    try {
      const stored = localStorage.getItem('api-cache');
      if (stored) {
        const data = JSON.parse(stored);
        const now = Date.now();
        
        // Only load non-expired entries
        Object.entries(data).forEach(([key, entry]: [string, any]) => {
          if (entry.expiresAt > now) {
            this.cache.set(key, entry);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to load cache from storage:', error);
    }
  }

  private saveToStorage(): void {
    if (!browser || !this.options.serialize) return;

    try {
      const data = Object.fromEntries(this.cache.entries());
      localStorage.setItem('api-cache', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save cache to storage:', error);
      // If storage is full, clear it and try again
      if (error.name === 'QuotaExceededError') {
        this.clearStorage();
      }
    }
  }

  private clearStorage(): void {
    if (browser) {
      localStorage.removeItem('api-cache');
    }
  }

  private setupStorageSync(): void {
    // Clean up expired entries periodically
    setInterval(() => {
      this.cleanupExpired();
    }, 60000); // Every minute
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.saveToStorage();
    }
  }

  private calculateHitRatio(): number {
    // This would require tracking hits/misses
    // For now, return 0
    return 0;
  }

  private estimateMemoryUsage(): number {
    let size = 0;
    for (const entry of this.cache.values()) {
      size += JSON.stringify(entry).length * 2; // Rough estimate
    }
    return size;
  }
}

// Export singleton instance
export const apiCache = browser ? new ApiCacheService() : null;

// Convenience methods
export const cachedFetch = <T>(url: string, options?: RequestOptions) => {
  return apiCache?.fetch<T>(url, options) ?? fetch(url, options).then(r => r.json());
};

export const debouncedFetch = <T>(url: string, options?: RequestOptions, debounceMs?: number) => {
  return apiCache?.debouncedFetch<T>(url, options, debounceMs) ?? cachedFetch<T>(url, options);
};

export const prefetchData = (url: string, options?: RequestOptions) => {
  return apiCache?.prefetch(url, options);
};

export const invalidateCache = (pattern: string | RegExp) => {
  return apiCache?.invalidate(pattern) ?? 0;
};
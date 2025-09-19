import { browser } from '$app/environment';
import { prefetchData } from './apiCache.service';

interface PrefetchRule {
  route: string;
  endpoints: string[];
  condition?: () => boolean;
  priority: 'high' | 'medium' | 'low';
  delay?: number; // Delay in milliseconds before prefetching
}

class PrefetchingService {
  private rules: PrefetchRule[] = [];
  private prefetchedRoutes = new Set<string>();
  private observer: IntersectionObserver | null = null;

  constructor() {
    if (browser) {
      this.setupDefaultRules();
      this.setupLinkPrefetching();
    }
  }

  private setupDefaultRules(): void {
    this.rules = [
      // Dashboard data
      {
        route: '/dashboard',
        endpoints: [
          '/api/registry?limit=10',
          '/api/reports/summary',
          '/api/periods/current'
        ],
        priority: 'high'
      },
      
      // Budget page
      {
        route: '/budget',
        endpoints: [
          '/api/nomenclatures',
          '/api/periods',
          '/api/registry?type=plan'
        ],
        priority: 'high'
      },
      
      // Fact/expense page
      {
        route: '/fact',
        endpoints: [
          '/api/nomenclatures',
          '/api/cost-centers',
          '/api/financial-centers',
          '/api/periods/current'
        ],
        priority: 'high'
      },
      
      // Reports page
      {
        route: '/reports',
        endpoints: [
          '/api/reports/config',
          '/api/periods',
          '/api/nomenclatures'
        ],
        priority: 'medium',
        delay: 1000 // Delay to avoid blocking main navigation
      },
      
      
      // Reference data pages
      {
        route: '/settings',
        endpoints: [
          '/api/nomenclatures',
          '/api/cost-centers',
          '/api/financial-centers',
          '/api/periods'
        ],
        priority: 'low',
        delay: 3000
      }
    ];
  }

  private setupLinkPrefetching(): void {
    // Prefetch data when user hovers over links
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const link = entry.target as HTMLAnchorElement;
              const href = link.getAttribute('href');
              if (href) {
                this.prefetchRoute(href);
              }
            }
          });
        },
        {
          rootMargin: '100px' // Prefetch when link is 100px from viewport
        }
      );
    }

    // Also prefetch on hover
    document.addEventListener('mouseover', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'A') {
        const link = target as HTMLAnchorElement;
        const href = link.getAttribute('href');
        if (href && this.isInternalLink(href)) {
          this.prefetchRoute(href, { priority: 'high', delay: 50 });
        }
      }
    });
  }

  // Add a route to be observed for prefetching
  observeLink(linkElement: HTMLAnchorElement): void {
    if (this.observer) {
      this.observer.observe(linkElement);
    }
  }

  // Remove observation
  unobserveLink(linkElement: HTMLAnchorElement): void {
    if (this.observer) {
      this.observer.unobserve(linkElement);
    }
  }

  // Prefetch data for a specific route
  async prefetchRoute(
    route: string, 
    options: { priority?: 'high' | 'medium' | 'low'; delay?: number } = {}
  ): Promise<void> {
    // Avoid duplicate prefetching
    if (this.prefetchedRoutes.has(route)) {
      return;
    }

    // Find matching rules
    const matchingRules = this.rules.filter(rule => 
      route.startsWith(rule.route) || rule.route === route
    );

    if (matchingRules.length === 0) {
      return;
    }

    // Mark as prefetched to avoid duplicates
    this.prefetchedRoutes.add(route);

    // Process rules by priority
    const priorityOrder = ['high', 'medium', 'low'];
    const sortedRules = matchingRules.sort((a, b) => 
      priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority)
    );

    for (const rule of sortedRules) {
      // Check condition if provided
      if (rule.condition && !rule.condition()) {
        continue;
      }

      const delay = options.delay ?? rule.delay ?? 0;
      const priority = options.priority ?? rule.priority;

      if (delay > 0) {
        setTimeout(() => this.executeRulePrefetch(rule, priority), delay);
      } else {
        await this.executeRulePrefetch(rule, priority);
      }
    }
  }

  private async executeRulePrefetch(rule: PrefetchRule, priority: string): Promise<void> {
    // Check network conditions
    if (!this.shouldPrefetch(priority)) {
      console.log(`Skipping prefetch for ${rule.route} due to network conditions`);
      return;
    }

    // Prefetch all endpoints for this rule
    const prefetchPromises = rule.endpoints.map(endpoint => 
      this.prefetchEndpoint(endpoint, priority)
    );

    try {
      await Promise.allSettled(prefetchPromises);
      console.log(`Prefetched data for route: ${rule.route}`);
    } catch (error) {
      console.warn(`Failed to prefetch for route ${rule.route}:`, error);
    }
  }

  private async prefetchEndpoint(endpoint: string, priority: string): Promise<void> {
    try {
      await prefetchData(endpoint, {
        cacheTtl: this.getCacheTtlByPriority(priority)
      });
    } catch (error) {
      // Prefetch failures should be silent
      console.debug(`Prefetch failed for ${endpoint}:`, error);
    }
  }

  private shouldPrefetch(priority: string): boolean {
    // Check network conditions
    const connection = (navigator as any).connection;
    if (connection) {
      // Don't prefetch on slow connections for low priority items
      if (priority === 'low' && connection.effectiveType === 'slow-2g') {
        return false;
      }
      
      // Only high priority on very slow connections
      if (priority !== 'high' && connection.effectiveType === '2g') {
        return false;
      }
      
      // Respect user's data saving preference
      if (connection.saveData) {
        return priority === 'high';
      }
    }

    // Don't prefetch if device is low on memory (rough estimate)
    const memory = (performance as any).memory;
    if (memory && memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) {
      return priority === 'high';
    }

    return true;
  }

  private getCacheTtlByPriority(priority: string): number {
    switch (priority) {
      case 'high': return 10 * 60 * 1000; // 10 minutes
      case 'medium': return 5 * 60 * 1000; // 5 minutes
      case 'low': return 2 * 60 * 1000; // 2 minutes
      default: return 5 * 60 * 1000;
    }
  }

  private isInternalLink(href: string): boolean {
    return href.startsWith('/') || href.startsWith(window.location.origin);
  }

  // Public API
  addRule(rule: PrefetchRule): void {
    this.rules.push(rule);
  }

  removeRule(route: string): void {
    this.rules = this.rules.filter(rule => rule.route !== route);
  }

  clearPrefetchedRoutes(): void {
    this.prefetchedRoutes.clear();
  }

  // Prefetch critical data immediately
  async prefetchCriticalData(): Promise<void> {
    const criticalEndpoints = [
      '/api/auth/me',
      '/api/periods/current',
      '/api/nomenclatures?limit=10'
    ];

    const promises = criticalEndpoints.map(endpoint => 
      this.prefetchEndpoint(endpoint, 'high')
    );

    await Promise.allSettled(promises);
  }

  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Export singleton
export const prefetchingService = browser ? new PrefetchingService() : null;

// Svelte action for automatic link prefetching
export function autoprefetch(node: HTMLAnchorElement, enabled = true) {
  if (!browser || !enabled || !prefetchingService) {
    return { destroy() {} };
  }

  prefetchingService.observeLink(node);

  return {
    update(newEnabled: boolean) {
      if (newEnabled && !enabled) {
        prefetchingService?.observeLink(node);
      } else if (!newEnabled && enabled) {
        prefetchingService?.unobserveLink(node);
      }
      enabled = newEnabled;
    },
    destroy() {
      prefetchingService?.unobserveLink(node);
    }
  };
}

// Utility functions
export const prefetchRoute = (route: string, options?: { priority?: 'high' | 'medium' | 'low'; delay?: number }) => {
  return prefetchingService?.prefetchRoute(route, options);
};

export const prefetchCriticalData = () => {
  return prefetchingService?.prefetchCriticalData();
};
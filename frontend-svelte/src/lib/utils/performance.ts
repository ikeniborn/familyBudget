import { browser } from '$app/environment';

interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
  loadTime: number;
  domInteractive: number;
  domComplete: number;
}

interface NetworkMetrics {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private networkMetrics: Partial<NetworkMetrics> = {};
  private observers: PerformanceObserver[] = [];

  constructor() {
    if (!browser) return;
    this.initializeObservers();
    this.collectNetworkInfo();
  }

  private initializeObservers() {
    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          this.metrics.lcp = lastEntry.startTime;
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (e) {
        console.warn('LCP observer not supported:', e);
      }

      // First Input Delay
      try {
        const fidObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach((entry: any) => {
            this.metrics.fid = entry.processingStart - entry.startTime;
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (e) {
        console.warn('FID observer not supported:', e);
      }

      // Cumulative Layout Shift
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.metrics.cls = clsValue;
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (e) {
        console.warn('CLS observer not supported:', e);
      }

      // Navigation timing
      try {
        const navigationObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach((entry: any) => {
            this.metrics.ttfb = entry.responseStart - entry.requestStart;
            this.metrics.loadTime = entry.loadEventEnd - entry.loadEventStart;
            this.metrics.domInteractive = entry.domInteractive - entry.navigationStart;
            this.metrics.domComplete = entry.domComplete - entry.navigationStart;
          });
        });
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navigationObserver);
      } catch (e) {
        console.warn('Navigation observer not supported:', e);
      }

      // First Contentful Paint
      try {
        const fcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach((entry: any) => {
            if (entry.name === 'first-contentful-paint') {
              this.metrics.fcp = entry.startTime;
            }
          });
        });
        fcpObserver.observe({ entryTypes: ['paint'] });
        this.observers.push(fcpObserver);
      } catch (e) {
        console.warn('FCP observer not supported:', e);
      }
    }
  }

  private collectNetworkInfo() {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    if (connection) {
      this.networkMetrics = {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      };

      connection.addEventListener('change', () => {
        this.networkMetrics = {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData
        };
      });
    }
  }

  // Get current performance metrics
  getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics };
  }

  // Get network information
  getNetworkInfo(): Partial<NetworkMetrics> {
    return { ...this.networkMetrics };
  }

  // Get Core Web Vitals score
  getCoreWebVitals() {
    const { fcp, lcp, fid, cls } = this.metrics;
    
    const scores = {
      fcp: this.scoreFCP(fcp),
      lcp: this.scoreLCP(lcp),
      fid: this.scoreFID(fid),
      cls: this.scoreCLS(cls)
    };

    return scores;
  }

  // Scoring functions based on Google's thresholds
  private scoreFCP(fcp?: number): 'good' | 'needs-improvement' | 'poor' | 'unknown' {
    if (fcp === undefined) return 'unknown';
    if (fcp <= 1800) return 'good';
    if (fcp <= 3000) return 'needs-improvement';
    return 'poor';
  }

  private scoreLCP(lcp?: number): 'good' | 'needs-improvement' | 'poor' | 'unknown' {
    if (lcp === undefined) return 'unknown';
    if (lcp <= 2500) return 'good';
    if (lcp <= 4000) return 'needs-improvement';
    return 'poor';
  }

  private scoreFID(fid?: number): 'good' | 'needs-improvement' | 'poor' | 'unknown' {
    if (fid === undefined) return 'unknown';
    if (fid <= 100) return 'good';
    if (fid <= 300) return 'needs-improvement';
    return 'poor';
  }

  private scoreCLS(cls?: number): 'good' | 'needs-improvement' | 'poor' | 'unknown' {
    if (cls === undefined) return 'unknown';
    if (cls <= 0.1) return 'good';
    if (cls <= 0.25) return 'needs-improvement';
    return 'poor';
  }

  // Track custom metrics
  markTime(name: string) {
    if (browser && 'performance' in window) {
      performance.mark(name);
    }
  }

  measureTime(name: string, startMark: string, endMark?: string) {
    if (browser && 'performance' in window) {
      try {
        if (endMark) {
          performance.measure(name, startMark, endMark);
        } else {
          performance.measure(name, startMark);
        }
        
        const measurement = performance.getEntriesByName(name, 'measure')[0];
        return measurement.duration;
      } catch (e) {
        console.warn(`Failed to measure ${name}:`, e);
        return 0;
      }
    }
    return 0;
  }

  // Track user interactions
  trackUserInteraction(action: string, element?: string, value?: number) {
    const timestamp = Date.now();
    const interaction = {
      action,
      element,
      value,
      timestamp,
      url: window.location.pathname,
      ...this.getNetworkInfo()
    };

    // Store locally for now, could send to analytics service
    const interactions = JSON.parse(localStorage.getItem('user-interactions') || '[]');
    interactions.push(interaction);
    
    // Keep only last 100 interactions
    if (interactions.length > 100) {
      interactions.splice(0, interactions.length - 100);
    }
    
    localStorage.setItem('user-interactions', JSON.stringify(interactions));
  }

  // Get performance report
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      metrics: this.getMetrics(),
      networkInfo: this.getNetworkInfo(),
      coreWebVitals: this.getCoreWebVitals(),
      resourceTiming: this.getResourceTiming(),
      memoryInfo: this.getMemoryInfo()
    };

    return report;
  }

  private getResourceTiming() {
    if (!browser || !('performance' in window)) return [];

    const resources = performance.getEntriesByType('resource');
    return resources.map(resource => ({
      name: resource.name,
      duration: resource.duration,
      size: (resource as any).transferSize,
      type: this.getResourceType(resource.name)
    })).filter(r => r.duration > 0);
  }

  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.includes('.png') || url.includes('.jpg') || url.includes('.svg')) return 'image';
    if (url.includes('.woff')) return 'font';
    if (url.includes('/api/')) return 'api';
    return 'other';
  }

  private getMemoryInfo() {
    const memory = (performance as any).memory;
    if (memory) {
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      };
    }
    return null;
  }

  // Clean up observers
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Export singleton instance
export const performanceMonitor = browser ? new PerformanceMonitor() : null;

// Export utility functions
export const trackPageView = (pageName: string) => {
  if (performanceMonitor) {
    performanceMonitor.markTime(`page-${pageName}-start`);
    
    // Track when page is fully loaded
    if (document.readyState === 'complete') {
      performanceMonitor.markTime(`page-${pageName}-complete`);
      performanceMonitor.measureTime(`page-${pageName}-load`, `page-${pageName}-start`, `page-${pageName}-complete`);
    } else {
      window.addEventListener('load', () => {
        performanceMonitor.markTime(`page-${pageName}-complete`);
        performanceMonitor.measureTime(`page-${pageName}-load`, `page-${pageName}-start`, `page-${pageName}-complete`);
      }, { once: true });
    }
  }
};

export const trackInteraction = (action: string, element?: string, value?: number) => {
  if (performanceMonitor) {
    performanceMonitor.trackUserInteraction(action, element, value);
  }
};

// Debounced function for expensive operations
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) func(...args);
    }, wait);
    
    if (callNow) func(...args);
  };
};
/**
 * Performance Monitor
 *
 * Automatic performance monitoring and logging for Family Budget application.
 *
 * Features:
 * - Page load metrics (DNS, TCP, Request, Response, DOM processing)
 * - Resource timing (slowest resources)
 * - Custom performance marks and measures
 * - Core Web Vitals tracking (LCP, FID, CLS)
 * - Automatic logging via centralized Logger
 *
 * Usage:
 * ```javascript
 * // Automatic initialization (on page load)
 * window.perfMonitor = new PerformanceMonitor();
 *
 * // Custom marks/measures
 * perfMonitor.mark('operation-start');
 * // ... operation ...
 * perfMonitor.mark('operation-end');
 * perfMonitor.measure('operation-duration', 'operation-start', 'operation-end');
 * ```
 *
 * @version 1.0.0
 * @date 2025-12-26
 */

class PerformanceMonitor {
    constructor() {
        this.logger = new Logger('[PERF]', 'PERF');
        this.metrics = {};

        // Automatically log page load metrics when available
        if (document.readyState === 'complete') {
            this.logPageLoad();
        } else {
            window.addEventListener('load', () => this.logPageLoad());
        }

        // Track Core Web Vitals if supported
        this.trackCoreWebVitals();
    }

    /**
     * Create a performance mark
     * @param {string} name - Mark name
     */
    mark(name) {
        if (!performance.mark) {
            this.logger.warn('Performance.mark() not supported');
            return;
        }

        performance.mark(name);
        this.logger.debug(`Mark: ${name}`);
    }

    /**
     * Measure time between two marks
     * @param {string} name - Measure name
     * @param {string} startMark - Start mark name
     * @param {string} endMark - End mark name (optional, defaults to now)
     * @returns {number|null} Duration in milliseconds
     */
    measure(name, startMark, endMark) {
        if (!performance.measure) {
            this.logger.warn('Performance.measure() not supported');
            return null;
        }

        try {
            performance.measure(name, startMark, endMark);
            const measure = performance.getEntriesByName(name, 'measure')[0];
            const duration = measure ? measure.duration : null;

            if (duration !== null) {
                this.logger.info(`${name}: ${duration.toFixed(2)}ms`);
                this.metrics[name] = duration;
            }

            return duration;
        } catch (error) {
            this.logger.error(`Failed to measure ${name}:`, error);
            return null;
        }
    }

    /**
     * Log comprehensive page load performance metrics
     */
    logPageLoad() {
        if (!performance.getEntriesByType) {
            this.logger.warn('Performance API not fully supported');
            return;
        }

        const perfData = performance.getEntriesByType('navigation')[0];
        if (!perfData) {
            this.logger.warn('Navigation timing not available');
            return;
        }

        this.logger.group('Page Load Performance');

        // Network timing
        const dnsTime = perfData.domainLookupEnd - perfData.domainLookupStart;
        const tcpTime = perfData.connectEnd - perfData.connectStart;
        const requestTime = perfData.responseStart - perfData.requestStart;
        const responseTime = perfData.responseEnd - perfData.responseStart;

        // DOM processing
        const domProcessing = perfData.domComplete - perfData.domLoading;
        const domContentLoaded = perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart;

        // Total load time
        const totalLoad = perfData.loadEventEnd - perfData.fetchStart;

        this.logger.info(`Network:`);
        this.logger.info(`  DNS lookup: ${dnsTime.toFixed(0)}ms`);
        this.logger.info(`  TCP connection: ${tcpTime.toFixed(0)}ms`);
        this.logger.info(`  Request time: ${requestTime.toFixed(0)}ms`);
        this.logger.info(`  Response time: ${responseTime.toFixed(0)}ms`);

        this.logger.info(`DOM:`);
        this.logger.info(`  DOM processing: ${domProcessing.toFixed(0)}ms`);
        this.logger.info(`  DOMContentLoaded: ${domContentLoaded.toFixed(0)}ms`);

        this.logger.info(`Total load time: ${totalLoad.toFixed(0)}ms`);

        // Store metrics
        this.metrics.pageLoad = {
            dnsTime,
            tcpTime,
            requestTime,
            responseTime,
            domProcessing,
            domContentLoaded,
            totalLoad
        };

        this.logger.groupEnd();

        // Log slowest resources
        this.logSlowResources();
    }

    /**
     * Log slowest loading resources
     * @param {number} count - Number of resources to show (default: 10)
     */
    logSlowResources(count = 10) {
        if (!performance.getEntriesByType) {
            return;
        }

        const resources = performance.getEntriesByType('resource');
        if (!resources || resources.length === 0) {
            return;
        }

        // Sort by duration (descending)
        const slowest = resources
            .sort((a, b) => b.duration - a.duration)
            .slice(0, count);

        this.logger.groupCollapsed(`Slowest ${count} Resources`);
        slowest.forEach((resource, index) => {
            const url = resource.name.split('/').pop() || resource.name;
            const size = resource.transferSize ? `(${(resource.transferSize / 1024).toFixed(1)}KB)` : '';
            this.logger.info(`${index + 1}. ${url}: ${resource.duration.toFixed(2)}ms ${size}`);
        });
        this.logger.groupEnd();
    }

    /**
     * Track Core Web Vitals (LCP, FID, CLS)
     * Requires web-vitals library or native PerformanceObserver
     */
    trackCoreWebVitals() {
        // LCP (Largest Contentful Paint)
        this.observeLCP();

        // FID (First Input Delay) - user interaction required
        this.observeFID();

        // CLS (Cumulative Layout Shift)
        this.observeCLS();
    }

    /**
     * Observe Largest Contentful Paint
     */
    observeLCP() {
        if (!window.PerformanceObserver) {
            return;
        }

        try {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];

                if (lastEntry) {
                    const lcp = lastEntry.renderTime || lastEntry.loadTime;
                    this.logger.info(`LCP (Largest Contentful Paint): ${lcp.toFixed(0)}ms`);
                    this.metrics.lcp = lcp;
                }
            });

            observer.observe({ entryTypes: ['largest-contentful-paint'] });
        } catch (error) {
            this.logger.debug('LCP observation not supported');
        }
    }

    /**
     * Observe First Input Delay
     */
    observeFID() {
        if (!window.PerformanceObserver) {
            return;
        }

        try {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    const fid = entry.processingStart - entry.startTime;
                    this.logger.info(`FID (First Input Delay): ${fid.toFixed(2)}ms`);
                    this.metrics.fid = fid;
                });
            });

            observer.observe({ entryTypes: ['first-input'] });
        } catch (error) {
            this.logger.debug('FID observation not supported');
        }
    }

    /**
     * Observe Cumulative Layout Shift
     */
    observeCLS() {
        if (!window.PerformanceObserver) {
            return;
        }

        try {
            let clsScore = 0;

            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) {
                        clsScore += entry.value;
                    }
                }

                this.logger.info(`CLS (Cumulative Layout Shift): ${clsScore.toFixed(4)}`);
                this.metrics.cls = clsScore;
            });

            observer.observe({ entryTypes: ['layout-shift'] });
        } catch (error) {
            this.logger.debug('CLS observation not supported');
        }
    }

    /**
     * Get all collected metrics
     * @returns {Object} Performance metrics
     */
    getMetrics() {
        return this.metrics;
    }

    /**
     * Log current metrics summary
     */
    logSummary() {
        this.logger.info('Performance Summary:', this.metrics);
    }
}

// Auto-initialize on load
if (typeof window !== 'undefined') {
    window.perfMonitor = new PerformanceMonitor();
}

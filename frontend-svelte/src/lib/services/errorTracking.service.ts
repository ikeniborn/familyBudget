import { browser } from '$app/environment';
import { toastStore } from '$lib/stores/toast.store';

export interface ErrorContext {
  userId?: string;
  sessionId: string;
  userAgent: string;
  url: string;
  timestamp: number;
  buildVersion: string;
  environment: 'development' | 'production' | 'test';
}

export interface ErrorInfo {
  name: string;
  message: string;
  stack?: string;
  cause?: any;
  componentStack?: string;
  errorBoundary?: string;
}

export interface ErrorReport {
  id: string;
  error: ErrorInfo;
  context: ErrorContext;
  breadcrumbs: Breadcrumb[];
  userFeedback?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  fingerprint: string;
}

export interface Breadcrumb {
  timestamp: number;
  message: string;
  category: 'navigation' | 'user' | 'http' | 'console' | 'error';
  level: 'info' | 'warning' | 'error';
  data?: any;
}

class ErrorTrackingService {
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs = 50;
  private sessionId: string;
  private userId?: string;
  private errorBuffer: ErrorReport[] = [];
  private submitTimer: NodeJS.Timeout | null = null;

  constructor() {
    if (!browser) return;

    this.sessionId = this.generateSessionId();
    this.setupErrorHandlers();
    this.setupConsoleInterceptors();
    this.setupUnhandledPromiseRejection();
    this.loadStoredErrors();
  }

  private setupErrorHandlers(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      const error: ErrorInfo = {
        name: event.error?.name || 'Error',
        message: event.message,
        stack: event.error?.stack
      };

      this.captureError(error, {
        severity: 'high',
        tags: ['window-error'],
        source: event.filename,
        line: event.lineno,
        column: event.colno
      });
    });

    // Resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target && event.target !== window) {
        const target = event.target as HTMLElement;
        const tagName = target.tagName?.toLowerCase();
        
        if (['img', 'script', 'link', 'source'].includes(tagName)) {
          this.addBreadcrumb({
            message: `Failed to load ${tagName}: ${target.getAttribute('src') || target.getAttribute('href')}`,
            category: 'error',
            level: 'error',
            data: {
              tagName,
              src: target.getAttribute('src'),
              href: target.getAttribute('href')
            }
          });
        }
      }
    }, true);
  }

  private setupConsoleInterceptors(): void {
    // Intercept console errors and warnings
    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args) => {
      this.addBreadcrumb({
        message: args.join(' '),
        category: 'console',
        level: 'error',
        data: { args }
      });
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      this.addBreadcrumb({
        message: args.join(' '),
        category: 'console',
        level: 'warning',
        data: { args }
      });
      originalWarn.apply(console, args);
    };
  }

  private setupUnhandledPromiseRejection(): void {
    window.addEventListener('unhandledrejection', (event) => {
      const error: ErrorInfo = {
        name: 'UnhandledPromiseRejection',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack
      };

      this.captureError(error, {
        severity: 'high',
        tags: ['unhandled-promise'],
        data: { reason: event.reason }
      });
    });
  }

  // Public API
  captureError(
    error: Error | ErrorInfo,
    options: {
      severity?: ErrorReport['severity'];
      tags?: string[];
      data?: any;
      fingerprint?: string;
      source?: string;
      line?: number;
      column?: number;
    } = {}
  ): string {
    const errorInfo: ErrorInfo = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    } : error;

    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      error: errorInfo,
      context: this.getErrorContext(),
      breadcrumbs: [...this.breadcrumbs],
      severity: options.severity || this.inferSeverity(errorInfo),
      tags: options.tags || [],
      fingerprint: options.fingerprint || this.generateFingerprint(errorInfo)
    };

    // Add to breadcrumbs
    this.addBreadcrumb({
      message: `${errorInfo.name}: ${errorInfo.message}`,
      category: 'error',
      level: 'error',
      data: options.data
    });

    // Store error
    this.bufferError(errorReport);

    // Show user-friendly error message for critical errors
    if (errorReport.severity === 'critical') {
      this.showErrorToUser(errorReport);
    }

    return errorReport.id;
  }

  captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    data?: any
  ): void {
    this.addBreadcrumb({
      message,
      category: 'console',
      level,
      data
    });

    // Also capture as error if level is error
    if (level === 'error') {
      this.captureError({
        name: 'CapturedMessage',
        message
      }, {
        severity: 'low',
        tags: ['manual-capture'],
        data
      });
    }
  }

  addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    const fullBreadcrumb: Breadcrumb = {
      ...breadcrumb,
      timestamp: Date.now()
    };

    this.breadcrumbs.push(fullBreadcrumb);

    // Keep only recent breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }
  }

  setUser(userId: string): void {
    this.userId = userId;
  }

  setTag(key: string, value: string): void {
    // Add tag to next error
    this.addBreadcrumb({
      message: `Tag set: ${key}=${value}`,
      category: 'user',
      level: 'info',
      data: { tag: { [key]: value } }
    });
  }

  // Performance monitoring integration
  reportPerformanceIssue(metric: string, value: number, threshold: number): void {
    if (value > threshold) {
      this.captureError({
        name: 'PerformanceIssue',
        message: `${metric} exceeded threshold: ${value}ms > ${threshold}ms`
      }, {
        severity: 'medium',
        tags: ['performance', metric],
        data: { metric, value, threshold }
      });
    }
  }

  // Network error tracking
  reportNetworkError(url: string, status: number, statusText: string): void {
    this.captureError({
      name: 'NetworkError',
      message: `${status} ${statusText}: ${url}`
    }, {
      severity: status >= 500 ? 'high' : 'medium',
      tags: ['network', `status-${status}`],
      data: { url, status, statusText }
    });
  }

  // Component error tracking
  reportComponentError(
    error: Error,
    componentName: string,
    props?: any
  ): string {
    return this.captureError(error, {
      severity: 'high',
      tags: ['component-error', `component-${componentName}`],
      data: { componentName, props }
    });
  }

  // Get error reports for debugging
  getErrorReports(): ErrorReport[] {
    return [...this.errorBuffer];
  }

  clearErrorReports(): void {
    this.errorBuffer = [];
    this.clearStoredErrors();
  }

  // Private methods
  private bufferError(errorReport: ErrorReport): void {
    this.errorBuffer.push(errorReport);
    
    // Store locally for offline support
    this.storeError(errorReport);
    
    // Batch submit errors
    this.scheduleSubmit();
    
    // Keep buffer size manageable
    if (this.errorBuffer.length > 100) {
      this.errorBuffer = this.errorBuffer.slice(-50);
    }
  }

  private scheduleSubmit(): void {
    if (this.submitTimer) return;
    
    this.submitTimer = setTimeout(() => {
      this.submitErrors();
      this.submitTimer = null;
    }, 5000); // Submit after 5 seconds
  }

  private async submitErrors(): Promise<void> {
    if (this.errorBuffer.length === 0) return;
    
    try {
      const errors = [...this.errorBuffer];
      
      // In a real app, you'd send to your error tracking service
      // For now, we'll just log them
      console.group('[ErrorTracking] Submitting errors');
      errors.forEach(error => {
        console.error(`[${error.severity}] ${error.error.name}: ${error.error.message}`, {
          id: error.id,
          fingerprint: error.fingerprint,
          tags: error.tags,
          breadcrumbs: error.breadcrumbs.slice(-5) // Last 5 breadcrumbs
        });
      });
      console.groupEnd();

      // Simulate API call
      await this.sendToErrorService(errors);
      
      // Clear submitted errors
      this.errorBuffer = [];
      this.clearStoredErrors();
    } catch (error) {
      console.error('Failed to submit errors:', error);
      // Keep errors in buffer for retry
    }
  }

  private async sendToErrorService(errors: ErrorReport[]): Promise<void> {
    // Simulate API call - in real app, send to Sentry, Bugsnag, etc.
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Submitted ${errors.length} errors to error service`);
        resolve();
      }, 1000);
    });
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFingerprint(error: ErrorInfo): string {
    const key = `${error.name}:${error.message}:${error.stack?.split('\n')[1] || ''}`;
    return btoa(key).replace(/[^a-zA-Z0-9]/g, '').substr(0, 32);
  }

  private inferSeverity(error: ErrorInfo): ErrorReport['severity'] {
    const criticalPatterns = [
      /chunk.*loading.*failed/i,
      /network.*error/i,
      /script.*error/i
    ];
    
    const highPatterns = [
      /reference.*error/i,
      /type.*error/i,
      /cannot.*read.*property/i
    ];

    const message = `${error.name} ${error.message}`;
    
    if (criticalPatterns.some(pattern => pattern.test(message))) {
      return 'critical';
    }
    
    if (highPatterns.some(pattern => pattern.test(message))) {
      return 'high';
    }
    
    return 'medium';
  }

  private getErrorContext(): ErrorContext {
    return {
      userId: this.userId,
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: Date.now(),
      buildVersion: '1.0.0', // From package.json or environment
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development'
    };
  }

  private showErrorToUser(errorReport: ErrorReport): void {
    toastStore.add({
      type: 'error',
      message: 'Произошла критическая ошибка. Команда разработки уведомлена.',
      duration: 10000,
      actions: [
        {
          label: 'Перезагрузить',
          action: () => window.location.reload()
        }
      ]
    });
  }

  private storeError(errorReport: ErrorReport): void {
    try {
      const stored = JSON.parse(localStorage.getItem('error-reports') || '[]');
      stored.push(errorReport);
      
      // Keep only recent errors
      if (stored.length > 50) {
        stored.splice(0, stored.length - 50);
      }
      
      localStorage.setItem('error-reports', JSON.stringify(stored));
    } catch (error) {
      console.warn('Failed to store error report:', error);
    }
  }

  private loadStoredErrors(): void {
    try {
      const stored = JSON.parse(localStorage.getItem('error-reports') || '[]');
      this.errorBuffer.push(...stored);
      
      // Schedule submission of stored errors
      if (stored.length > 0) {
        this.scheduleSubmit();
      }
    } catch (error) {
      console.warn('Failed to load stored errors:', error);
    }
  }

  private clearStoredErrors(): void {
    localStorage.removeItem('error-reports');
  }
}

// Export singleton
export const errorTrackingService = browser ? new ErrorTrackingService() : null;

// Utility functions for common error scenarios
export const trackError = (error: Error, context?: string) => {
  return errorTrackingService?.captureError(error, {
    tags: context ? [context] : [],
    severity: 'medium'
  });
};

export const trackComponentError = (error: Error, componentName: string, props?: any) => {
  return errorTrackingService?.reportComponentError(error, componentName, props);
};

export const trackNetworkError = (url: string, status: number, statusText: string) => {
  return errorTrackingService?.reportNetworkError(url, status, statusText);
};

export const trackPerformanceIssue = (metric: string, value: number, threshold: number) => {
  return errorTrackingService?.reportPerformanceIssue(metric, value, threshold);
};
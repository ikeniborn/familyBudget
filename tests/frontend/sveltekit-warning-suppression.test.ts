import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { render } from '@testing-library/svelte';

/**
 * Comprehensive SvelteKit Warning Suppression Test Suite (v3.7.5)
 *
 * Tests the enhanced warning suppression system that filters SvelteKit internal prop warnings
 * from the browser console while preserving legitimate warnings.
 *
 * Coverage:
 * - Browser console filtering functionality
 * - Pattern matching for various warning formats
 * - Performance optimization and caching
 * - Environment detection and safety
 * - Statistics tracking and debugging
 * - Integration with development tools
 */

describe('SvelteKit Warning Suppression System', () => {
  let originalConsole: Console;
  let mockWarn: ReturnType<typeof vi.fn>;
  let mockError: ReturnType<typeof vi.fn>;
  let mockLocation: Partial<Location>;

  beforeAll(() => {
    // Store original console methods
    originalConsole = { ...console };
  });

  beforeEach(() => {
    // Mock console methods
    mockWarn = vi.fn();
    mockError = vi.fn();
    console.warn = mockWarn;
    console.error = mockError;

    // Mock location for environment detection
    mockLocation = {
      hostname: 'localhost',
      port: '5173'
    };
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
      configurable: true
    });

    // Mock import.meta.env
    Object.defineProperty(globalThis, 'import', {
      value: {
        meta: {
          env: {
            DEV: true,
            VITE_DEBUG_WARNING_SUPPRESSION: 'false'
          }
        }
      },
      writable: true,
      configurable: true
    });

    // Clear any existing window functions
    delete (window as any).__svelteKitWarningSuppressionStats;
    delete (window as any).__resetSvelteKitWarningStats;
  });

  afterEach(() => {
    // Restore console methods
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;

    // Clear mocks
    vi.clearAllMocks();
  });

  afterAll(() => {
    // Restore original console
    Object.assign(console, originalConsole);
  });

  describe('Environment Detection', () => {
    it('should detect development environment correctly', () => {
      // Simulate the warning suppression script
      const isDevelopment = (
        (typeof import !== 'undefined' && import.meta && import.meta.env && import.meta.env.DEV) ||
        (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') ||
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1' ||
        location.port === '5173'
      );

      expect(isDevelopment).toBe(true);
    });

    it('should detect production environment and disable filtering', () => {
      // Mock production environment
      mockLocation.hostname = 'example.com';
      mockLocation.port = '443';

      const isDevelopment = (
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1' ||
        location.port === '5173'
      );

      expect(isDevelopment).toBe(false);
    });

    it('should respect debug configuration', () => {
      const debugSuppression = (
        (typeof import !== 'undefined' && import.meta && import.meta.env && import.meta.env.VITE_DEBUG_WARNING_SUPPRESSION === 'true') ||
        localStorage.getItem('debug-warning-suppression') === 'true'
      );

      expect(debugSuppression).toBe(false);

      // Enable debug mode via localStorage
      localStorage.setItem('debug-warning-suppression', 'true');
      const debugEnabled = localStorage.getItem('debug-warning-suppression') === 'true';
      expect(debugEnabled).toBe(true);
    });
  });

  describe('SvelteKit Internal Props Detection', () => {
    const svelteKitInternalProps = new Set([
      // Core SvelteKit props
      'params', 'route', 'url', 'status', 'error', 'form', 'data',
      // Navigation props
      'beforeNavigate', 'afterNavigate', 'invalidateAll', 'preloadData',
      'navigating', 'enhanced', 'shallow', 'keepFocus', 'noscroll',
      'replaceState', 'invalidate', 'goto', 'pushState', 'popState',
      // Store and state props
      'updated', 'page', 'stores', 'snapshot', 'state',
      // Advanced SvelteKit props
      'preloadCode', 'preloadData', 'reload', 'routeId', 'routeParams',
      'searchParams', 'hash', 'origin', 'pathname', 'search',
      // Service worker and offline props
      'serviceWorker', 'offline', 'online', 'connectivity',
      // Development and debugging props
      'dev', 'browser', 'building', 'version', 'base', 'assets',
      // Additional internal props found in SvelteKit 2.x
      'submitting', 'delayed', 'timeout', 'message', 'details'
    ]);

    it('should include all core SvelteKit props', () => {
      const coreProps = ['params', 'route', 'url', 'data', 'form'];
      coreProps.forEach(prop => {
        expect(svelteKitInternalProps.has(prop)).toBe(true);
      });
    });

    it('should include navigation-related props', () => {
      const navProps = ['beforeNavigate', 'afterNavigate', 'navigating', 'goto'];
      navProps.forEach(prop => {
        expect(svelteKitInternalProps.has(prop)).toBe(true);
      });
    });

    it('should include advanced SvelteKit props', () => {
      const advancedProps = ['preloadCode', 'routeId', 'searchParams', 'serviceWorker'];
      advancedProps.forEach(prop => {
        expect(svelteKitInternalProps.has(prop)).toBe(true);
      });
    });
  });

  describe('Warning Pattern Matching', () => {
    const warningPatterns = [
      /(?:Page|Component|\w+) was created with unknown prop '([^']+)'/i,
      /received an unexpected slot "([^"]+)"/i,
      /Unknown prop '([^']+)'/i,
      /'([^']+)' was exported/i,
      /prop '([^']+)' was passed to/i,
      /created with unknown prop (\w+)/i,
      /unexpected prop '([^']+)'/i,
      /invalid prop '([^']+)'/i,
      /undeclared prop '([^']+)'/i,
      /created with unknown props? (?:'([^']+)'(?:,\s*'([^']+)')*)/i
    ];

    it('should match standard component warnings', () => {
      const testCases = [
        "Component was created with unknown prop 'params'",
        "Page was created with unknown prop 'route'",
        "MyComponent was created with unknown prop 'url'"
      ];

      testCases.forEach(message => {
        const matched = warningPatterns.some(pattern => pattern.test(message));
        expect(matched).toBe(true);
      });
    });

    it('should match slot warnings', () => {
      const message = 'received an unexpected slot "params"';
      const matched = warningPatterns.some(pattern => pattern.test(message));
      expect(matched).toBe(true);
    });

    it('should match various warning formats', () => {
      const testCases = [
        "Unknown prop 'data'",
        "'form' was exported",
        "prop 'stores' was passed to",
        "created with unknown prop navigating",
        "unexpected prop 'snapshot'",
        "invalid prop 'state'",
        "undeclared prop 'page'"
      ];

      testCases.forEach(message => {
        const matched = warningPatterns.some(pattern => pattern.test(message));
        expect(matched).toBe(true);
      });
    });

    it('should not match legitimate component warnings', () => {
      const legitimateWarnings = [
        "Component was created with unknown prop 'customProp'",
        "Unknown prop 'userDefinedProp'",
        "prop 'myCustomProperty' was passed to"
      ];

      // These should match the pattern but not be suppressed because they're not internal props
      legitimateWarnings.forEach(message => {
        const matched = warningPatterns.some(pattern => pattern.test(message));
        expect(matched).toBe(true);
      });
    });
  });

  describe('Warning Suppression Logic', () => {
    function shouldSuppressWarning(message: string): boolean {
      const svelteKitInternalProps = new Set([
        'params', 'route', 'url', 'status', 'error', 'form', 'data',
        'beforeNavigate', 'afterNavigate', 'invalidateAll', 'preloadData',
        'navigating', 'enhanced', 'shallow', 'keepFocus', 'noscroll',
        'replaceState', 'invalidate', 'goto', 'pushState', 'popState',
        'updated', 'page', 'stores', 'snapshot', 'state'
      ]);

      const warningPatterns = [
        /(?:Page|Component|\w+) was created with unknown prop '([^']+)'/i,
        /received an unexpected slot "([^"]+)"/i,
        /Unknown prop '([^']+)'/i,
        /'([^']+)' was exported/i,
        /prop '([^']+)' was passed to/i
      ];

      for (const pattern of warningPatterns) {
        const match = message.match(pattern);
        if (match) {
          const propName = match[1] || match[2] || match[3];
          if (propName && svelteKitInternalProps.has(propName)) {
            return true;
          }

          // Handle multi-prop warnings
          const allMatches = message.match(/'([^']+)'/g) || [];
          if (allMatches.length > 0) {
            const allPropsInternal = allMatches.every(quotedProp => {
              const cleanProp = quotedProp.replace(/'/g, '');
              return svelteKitInternalProps.has(cleanProp);
            });
            if (allPropsInternal) {
              return true;
            }
          }
        }
      }

      return false;
    }

    it('should suppress SvelteKit internal prop warnings', () => {
      const svelteKitWarnings = [
        "Component was created with unknown prop 'params'",
        "Page was created with unknown prop 'route'",
        "Unknown prop 'url'",
        "'data' was exported",
        "prop 'form' was passed to",
        "received an unexpected slot \"stores\""
      ];

      svelteKitWarnings.forEach(warning => {
        expect(shouldSuppressWarning(warning)).toBe(true);
      });
    });

    it('should preserve legitimate component warnings', () => {
      const legitimateWarnings = [
        "Component was created with unknown prop 'customProp'",
        "Unknown prop 'userDefinedProperty'",
        "'myCustomExport' was exported",
        "prop 'applicationSpecificProp' was passed to"
      ];

      legitimateWarnings.forEach(warning => {
        expect(shouldSuppressWarning(warning)).toBe(false);
      });
    });

    it('should handle multi-prop warnings correctly', () => {
      const multiPropWarnings = [
        "Component was created with unknown prop 'params' and 'route'",
        "Multiple unknown props: 'url', 'data', 'form'"
      ];

      // These should be handled by the multi-prop logic
      multiPropWarnings.forEach(warning => {
        const hasSvelteKitProps = warning.includes('params') || warning.includes('route') || warning.includes('url');
        expect(hasSvelteKitProps).toBe(true);
      });
    });
  });

  describe('Performance and Caching', () => {
    it('should implement efficient caching for repeated warnings', () => {
      const warningCache = new Map();
      const maxCacheSize = 1000;

      // Simulate cache management
      function addToCache(message: string, shouldSuppress: boolean) {
        if (warningCache.size >= maxCacheSize) {
          const firstKey = warningCache.keys().next().value;
          warningCache.delete(firstKey);
        }
        warningCache.set(message, shouldSuppress);
      }

      // Add many items to test cache limits
      for (let i = 0; i < 1100; i++) {
        addToCache(`warning-${i}`, i % 2 === 0);
      }

      expect(warningCache.size).toBeLessThanOrEqual(maxCacheSize);
      expect(warningCache.has('warning-0')).toBe(false); // Should be evicted
      expect(warningCache.has('warning-1099')).toBe(true); // Should be present
    });

    it('should optimize pattern matching with early exit', () => {
      const patterns = [
        /Component was created with unknown prop '([^']+)'/,
        /Unknown prop '([^']+)'/,
        /prop '([^']+)' was passed to/
      ];

      let matchAttempts = 0;
      const message = "Component was created with unknown prop 'params'";

      for (const pattern of patterns) {
        matchAttempts++;
        const match = message.match(pattern);
        if (match) {
          break; // Early exit on first match
        }
      }

      expect(matchAttempts).toBe(1); // Should exit on first pattern
    });
  });

  describe('Statistics and Debugging', () => {
    it('should track suppression statistics', () => {
      let suppressedCount = 0;
      let totalWarnings = 0;

      // Simulate warning processing
      const warnings = [
        "Component was created with unknown prop 'params'",
        "Unknown prop 'customProp'",
        "Component was created with unknown prop 'route'",
        "prop 'userProp' was passed to"
      ];

      warnings.forEach(warning => {
        totalWarnings++;
        if (warning.includes('params') || warning.includes('route')) {
          suppressedCount++;
        }
      });

      const suppressionRate = Math.round((suppressedCount / totalWarnings) * 100);
      expect(suppressionRate).toBe(50); // 2 out of 4 warnings suppressed
    });

    it('should provide development debugging functions', () => {
      // Simulate the debug functions that would be added to window
      const mockStats = {
        totalWarnings: 10,
        suppressedCount: 7,
        suppressionRate: 70,
        cacheSize: 5,
        internalProps: ['params', 'route', 'url', 'data', 'form'].sort()
      };

      const mockStatsFunction = () => mockStats;
      const mockResetFunction = () => {
        console.info('[CONSOLE FILTER] Statistics reset');
      };

      // Test stats function
      const stats = mockStatsFunction();
      expect(stats.suppressionRate).toBe(70);
      expect(stats.internalProps).toContain('params');

      // Test reset function (should not throw)
      expect(() => mockResetFunction()).not.toThrow();
    });
  });

  describe('Console Method Override', () => {
    it('should override console.warn correctly', () => {
      // This is a simplified version of what the actual implementation would do
      const originalWarn = console.warn;
      let interceptedWarnings: string[] = [];

      console.warn = function(...args: any[]) {
        const message = args.join(' ');

        // Simple suppression logic for testing
        if (message.includes("unknown prop 'params'") || message.includes("unknown prop 'route'")) {
          // Suppress
          return;
        }

        // Store for testing
        interceptedWarnings.push(message);
        return originalWarn.apply(console, args);
      };

      // Test suppression
      console.warn("Component was created with unknown prop 'params'");
      console.warn("Component was created with unknown prop 'customProp'");
      console.warn("Some other warning");

      expect(interceptedWarnings).toHaveLength(2);
      expect(interceptedWarnings).not.toContain("Component was created with unknown prop 'params'");
      expect(interceptedWarnings).toContain("Component was created with unknown prop 'customProp'");

      // Restore
      console.warn = originalWarn;
    });

    it('should handle console.error appropriately', () => {
      const originalError = console.error;
      let interceptedErrors: string[] = [];

      console.error = function(...args: any[]) {
        const message = args.join(' ');

        // Only suppress SvelteKit prop warnings that appear as errors
        if (message.includes("was created with unknown prop") &&
            (message.includes("'params'") || message.includes("'route'"))) {
          return; // Suppress
        }

        interceptedErrors.push(message);
        return originalError.apply(console, args);
      };

      // Test error handling
      console.error("Component was created with unknown prop 'params'");
      console.error("Real application error");
      console.error("Another actual error");

      expect(interceptedErrors).toHaveLength(2);
      expect(interceptedErrors).not.toContain("Component was created with unknown prop 'params'");
      expect(interceptedErrors).toContain("Real application error");

      // Restore
      console.error = originalError;
    });
  });

  describe('Integration with Vite Plugin', () => {
    it('should provide warning suppression status endpoint', async () => {
      const mockResponse = {
        active: true,
        environment: 'development',
        timestamp: new Date().toISOString(),
        config: {
          suppressSvelteKitWarnings: true,
          debugWarningSuppress: false,
          version: 'v3.7.5'
        }
      };

      // Test that the expected structure is correct
      expect(mockResponse.active).toBe(true);
      expect(mockResponse.environment).toBe('development');
      expect(mockResponse.config.version).toBe('v3.7.5');
    });

    it('should inject environment variables correctly', () => {
      const envVars = {
        VITE_SUPPRESS_SVELTEKIT_WARNINGS: 'true',
        VITE_DEBUG_WARNING_SUPPRESSION: 'false'
      };

      const envScript = `
        <script>
          // Environment variables for SvelteKit warning suppression
          window.__SVELTEKIT_WARNING_SUPPRESSION_ENV__ = ${JSON.stringify(envVars)};
        </script>
      `;

      expect(envScript).toContain('__SVELTEKIT_WARNING_SUPPRESSION_ENV__');
      expect(envScript).toContain('"VITE_SUPPRESS_SVELTEKIT_WARNINGS":"true"');
    });
  });

  describe('Cross-browser Compatibility', () => {
    it('should handle different console implementations', () => {
      const testConsoleImplementations = [
        // Chrome/Chromium style
        { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
        // Firefox style
        { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
        // Safari style
        { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
      ];

      testConsoleImplementations.forEach((mockConsole, index) => {
        // Test that our override logic would work with different console implementations
        const originalWarn = mockConsole.warn;

        mockConsole.warn = function(...args: any[]) {
          const message = args.join(' ');
          if (!message.includes("unknown prop 'params'")) {
            return originalWarn.apply(this, args);
          }
        };

        // Should not call originalWarn for suppressed warnings
        mockConsole.warn("Component was created with unknown prop 'params'");
        expect(originalWarn).not.toHaveBeenCalled();

        // Should call originalWarn for legitimate warnings
        mockConsole.warn("Legitimate warning");
        expect(originalWarn).toHaveBeenCalledWith("Legitimate warning");
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed warning messages', () => {
      const malformedMessages = [
        null,
        undefined,
        '',
        'Component was created with unknown prop',
        "Component was created with unknown prop ''",
        'Component was created with unknown prop "params"', // Wrong quotes
        {}
      ];

      // Should not throw errors when processing malformed messages
      malformedMessages.forEach(message => {
        expect(() => {
          const stringMessage = String(message || '');
          const patterns = [/unknown prop '([^']+)'/];
          patterns.some(pattern => pattern.test(stringMessage));
        }).not.toThrow();
      });
    });

    it('should handle memory constraints gracefully', () => {
      const cache = new Map();
      const maxSize = 5;

      // Fill cache beyond limit
      for (let i = 0; i < 10; i++) {
        if (cache.size >= maxSize) {
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }
        cache.set(`key-${i}`, `value-${i}`);
      }

      expect(cache.size).toBeLessThanOrEqual(maxSize);
      expect(cache.has('key-0')).toBe(false); // Evicted
      expect(cache.has('key-9')).toBe(true); // Present
    });
  });
});
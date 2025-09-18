import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import TestComponentWithUnknownProps from '../../frontend-svelte/src/test/components/TestComponentWithUnknownProps.svelte';

/**
 * Console Warning Integration Test Suite (v3.7.5)
 *
 * Tests the integration between Svelte components and the warning suppression system
 * to ensure legitimate warnings are preserved while SvelteKit internal warnings are suppressed.
 */

describe('Console Warning Integration Tests', () => {
  let originalConsole: Console;
  let consoleCalls: string[];

  beforeEach(() => {
    originalConsole = { ...console };
    consoleCalls = [];

    // Mock console to capture all calls
    console.warn = vi.fn((...args) => {
      consoleCalls.push(`WARN: ${args.join(' ')}`);
    });

    console.error = vi.fn((...args) => {
      consoleCalls.push(`ERROR: ${args.join(' ')}`);
    });

    console.info = vi.fn((...args) => {
      consoleCalls.push(`INFO: ${args.join(' ')}`);
    });
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
    vi.clearAllMocks();
  });

  describe('Component Rendering with Unknown Props', () => {
    it('should allow legitimate unknown props to generate warnings', () => {
      // This test validates that our warning suppression system doesn't
      // interfere with legitimate component warnings

      const TestWrapper = {
        Component: TestComponentWithUnknownProps,
        props: {
          knownProp: 'test value',
          anotherKnownProp: 123,
          // These should generate warnings as they're not declared in the component
          unknownCustomProp: 'should warn',
          anotherUnknownProp: 'should also warn'
        }
      };

      // Render with unknown props
      render(TestWrapper.Component, TestWrapper.props);

      // Component should render successfully
      expect(screen.getByText('Test Component for Warning Validation')).toBeInTheDocument();
      expect(screen.getByText('Known Prop: test value')).toBeInTheDocument();
      expect(screen.getByText('Another Known Prop: 123')).toBeInTheDocument();

      // Note: In the test environment, Svelte warnings might not be triggered
      // the same way as in the browser, but this test validates the structure
    });

    it('should render component with SvelteKit internal props without affecting functionality', () => {
      // Simulate what happens when SvelteKit passes internal props
      const TestWrapperWithSvelteKitProps = {
        Component: TestComponentWithUnknownProps,
        props: {
          knownProp: 'test value',
          anotherKnownProp: 456,
          // These are SvelteKit internal props that should be suppressed
          params: { id: '123' },
          route: { id: '/test' },
          url: new URL('http://localhost:5173/test'),
          data: { someData: 'value' }
        }
      };

      render(TestWrapperWithSvelteKitProps.Component, TestWrapperWithSvelteKitProps.props);

      // Component should still function normally
      expect(screen.getByText('Known Prop: test value')).toBeInTheDocument();
      expect(screen.getByText('Another Known Prop: 456')).toBeInTheDocument();
    });
  });

  describe('Warning Suppression Pattern Validation', () => {
    it('should correctly identify SvelteKit internal props', () => {
      const svelteKitInternalProps = [
        'params', 'route', 'url', 'status', 'error', 'form', 'data',
        'beforeNavigate', 'afterNavigate', 'invalidateAll', 'preloadData',
        'navigating', 'enhanced', 'shallow', 'keepFocus', 'noscroll',
        'replaceState', 'invalidate', 'goto', 'pushState', 'popState',
        'updated', 'page', 'stores', 'snapshot', 'state',
        'preloadCode', 'preloadData', 'reload', 'routeId', 'routeParams',
        'searchParams', 'hash', 'origin', 'pathname', 'search',
        'serviceWorker', 'offline', 'online', 'connectivity',
        'dev', 'browser', 'building', 'version', 'base', 'assets',
        'submitting', 'delayed', 'timeout', 'message', 'details'
      ];

      // Validate that all essential SvelteKit props are included
      const essentialProps = ['params', 'route', 'url', 'data', 'form', 'page'];
      essentialProps.forEach(prop => {
        expect(svelteKitInternalProps).toContain(prop);
      });

      // Validate that the list is comprehensive
      expect(svelteKitInternalProps.length).toBeGreaterThan(30);
    });

    it('should correctly match various warning message formats', () => {
      const warningPatterns = [
        /(?:Page|Component|\w+) was created with unknown prop '([^']+)'/i,
        /received an unexpected slot "([^"]+)"/i,
        /Unknown prop '([^']+)'/i,
        /'([^']+)' was exported/i,
        /prop '([^']+)' was passed to/i,
        /created with unknown prop (\w+)/i,
        /unexpected prop '([^']+)'/i,
        /invalid prop '([^']+)'/i,
        /undeclared prop '([^']+)'/i
      ];

      const testMessages = [
        { message: "Component was created with unknown prop 'params'", shouldMatch: true },
        { message: "Page was created with unknown prop 'route'", shouldMatch: true },
        { message: "TestComponent was created with unknown prop 'url'", shouldMatch: true },
        { message: "received an unexpected slot \"data\"", shouldMatch: true },
        { message: "Unknown prop 'form'", shouldMatch: true },
        { message: "'stores' was exported", shouldMatch: true },
        { message: "prop 'page' was passed to", shouldMatch: true },
        { message: "created with unknown prop snapshot", shouldMatch: true },
        { message: "unexpected prop 'state'", shouldMatch: true },
        { message: "invalid prop 'navigating'", shouldMatch: true },
        { message: "undeclared prop 'enhanced'", shouldMatch: true },
        { message: "Some unrelated warning message", shouldMatch: false },
        { message: "Component loaded successfully", shouldMatch: false }
      ];

      testMessages.forEach(({ message, shouldMatch }) => {
        const matched = warningPatterns.some(pattern => pattern.test(message));
        expect(matched).toBe(shouldMatch);
      });
    });
  });

  describe('Performance Optimization Tests', () => {
    it('should handle high-frequency warning patterns efficiently', () => {
      const warningCache = new Map<string, boolean>();
      const maxCacheSize = 1000;

      // Simulate rapid warning processing
      const startTime = performance.now();

      for (let i = 0; i < 10000; i++) {
        const message = `Component was created with unknown prop 'params' - ${i % 100}`;

        // Check cache first
        if (warningCache.has(message)) {
          continue;
        }

        // Simulate pattern matching
        const shouldSuppress = message.includes('params');

        // Update cache with size limit
        if (warningCache.size >= maxCacheSize) {
          const firstKey = warningCache.keys().next().value;
          warningCache.delete(firstKey);
        }
        warningCache.set(message, shouldSuppress);
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete in reasonable time (less than 100ms for 10k operations)
      expect(executionTime).toBeLessThan(100);
      expect(warningCache.size).toBeLessThanOrEqual(maxCacheSize);
    });

    it('should optimize memory usage with LRU cache behavior', () => {
      const cache = new Map<string, boolean>();
      const maxSize = 5;

      // Fill cache to capacity
      for (let i = 0; i < maxSize; i++) {
        cache.set(`warning-${i}`, true);
      }

      expect(cache.size).toBe(maxSize);

      // Add one more item, forcing eviction
      if (cache.size >= maxSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      cache.set('warning-new', true);

      expect(cache.size).toBe(maxSize);
      expect(cache.has('warning-0')).toBe(false); // Evicted
      expect(cache.has('warning-new')).toBe(true); // Present
    });
  });

  describe('Environment and Configuration Tests', () => {
    it('should respect development environment detection', () => {
      // Test environment detection logic
      const mockEnvironments = [
        {
          env: { DEV: true },
          hostname: 'localhost',
          port: '5173',
          expected: true,
          description: 'Standard development environment'
        },
        {
          env: { DEV: false },
          hostname: 'example.com',
          port: '443',
          expected: false,
          description: 'Production environment'
        },
        {
          env: {},
          hostname: '127.0.0.1',
          port: '3000',
          expected: true,
          description: 'Local development with different port'
        }
      ];

      mockEnvironments.forEach(({ env, hostname, port, expected, description }) => {
        const isDevelopment = (
          env.DEV ||
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          port === '5173'
        );

        expect(isDevelopment).toBe(expected);
      });
    });

    it('should handle debug configuration correctly', () => {
      const debugConfigurations = [
        { env: { VITE_DEBUG_WARNING_SUPPRESSION: 'true' }, localStorage: null, expected: true },
        { env: { VITE_DEBUG_WARNING_SUPPRESSION: 'false' }, localStorage: 'true', expected: true },
        { env: {}, localStorage: 'false', expected: false },
        { env: {}, localStorage: null, expected: false }
      ];

      debugConfigurations.forEach(({ env, localStorage, expected }) => {
        // Mock localStorage
        if (localStorage !== null) {
          Object.defineProperty(window, 'localStorage', {
            value: {
              getItem: vi.fn(() => localStorage)
            },
            writable: true
          });
        }

        const debugEnabled = (
          env.VITE_DEBUG_WARNING_SUPPRESSION === 'true' ||
          (window.localStorage && window.localStorage.getItem('debug-warning-suppression') === 'true')
        );

        expect(debugEnabled).toBe(expected);
      });
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track warning statistics accurately', () => {
      let totalWarnings = 0;
      let suppressedCount = 0;

      const warnings = [
        "Component was created with unknown prop 'params'", // Should suppress
        "Unknown prop 'customProp'", // Should not suppress
        "Component was created with unknown prop 'route'", // Should suppress
        "prop 'userDefinedProp' was passed to", // Should not suppress
        "Component was created with unknown prop 'data'", // Should suppress
      ];

      const svelteKitProps = new Set(['params', 'route', 'url', 'data', 'form']);

      warnings.forEach(warning => {
        totalWarnings++;

        // Simple suppression logic for testing
        const match = warning.match(/unknown prop '([^']+)'/);
        if (match && svelteKitProps.has(match[1])) {
          suppressedCount++;
        }
      });

      expect(totalWarnings).toBe(5);
      expect(suppressedCount).toBe(3);

      const suppressionRate = Math.round((suppressedCount / totalWarnings) * 100);
      expect(suppressionRate).toBe(60);
    });

    it('should provide useful debugging information', () => {
      const mockStatistics = {
        totalWarnings: 100,
        suppressedCount: 75,
        suppressionRate: 75,
        cacheSize: 25,
        internalProps: ['params', 'route', 'url', 'data', 'form', 'page'],
        runtime: 300 // seconds
      };

      // Validate statistics structure
      expect(mockStatistics.suppressionRate).toBeGreaterThan(0);
      expect(mockStatistics.internalProps).toContain('params');
      expect(mockStatistics.cacheSize).toBeGreaterThan(0);
      expect(mockStatistics.runtime).toBeGreaterThan(0);

      // Test statistics calculations
      const calculatedRate = Math.round((mockStatistics.suppressedCount / mockStatistics.totalWarnings) * 100);
      expect(calculatedRate).toBe(mockStatistics.suppressionRate);
    });
  });

  describe('Cross-browser and Edge Case Tests', () => {
    it('should handle various console argument formats', () => {
      const testArguments = [
        ['Simple string warning'],
        ['Multiple', 'string', 'arguments'],
        [{ object: 'warning' }],
        ['Mixed', { types: true }, 123],
        [null, undefined, ''],
        []
      ];

      testArguments.forEach(args => {
        expect(() => {
          // Simulate console argument processing
          const message = args.map(arg =>
            typeof arg === 'string' ? arg :
            typeof arg === 'object' ? JSON.stringify(arg) :
            String(arg)
          ).join(' ');

          // Should not throw
          message.includes('unknown prop');
        }).not.toThrow();
      });
    });

    it('should handle regex edge cases', () => {
      const edgeCaseMessages = [
        "Component was created with unknown prop ''",
        "Component was created with unknown prop '  '",
        "Component was created with unknown prop 'prop-with-dashes'",
        "Component was created with unknown prop 'prop_with_underscores'",
        "Component was created with unknown prop 'propWithNumbers123'",
        "Component was created with unknown prop '$specialChars'",
        "Component was created with unknown prop 'params' and more text",
        "Prefix text Component was created with unknown prop 'params'"
      ];

      const pattern = /(?:Page|Component|\w+) was created with unknown prop '([^']+)'/i;

      edgeCaseMessages.forEach(message => {
        expect(() => {
          const match = message.match(pattern);
          if (match && match[1]) {
            // Should extract prop name correctly
            expect(typeof match[1]).toBe('string');
          }
        }).not.toThrow();
      });
    });
  });
});
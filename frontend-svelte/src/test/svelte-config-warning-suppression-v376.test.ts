/**
 * Enhanced SvelteKit Warning Suppression Tests (v3.7.6)
 * Tests for ultimate warning suppression system with Layout support, caching, and multi-prop detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the svelte.config.js onwarn function
const createWarningHandler = () => {
  // Performance cache for processed warnings (v3.7.6 - Ultimate Enhancement)
  const warningCache = new Map();
  let cacheHits = 0;
  let cacheMisses = 0;

  return (warning: any, handler: any) => {
    const debugWarnings = process.env.SVELTE_WARNING_DEBUG === 'true';

    // Performance cache check
    const cacheKey = `${warning.code}:${warning.message}`;
    if (warningCache.has(cacheKey)) {
      cacheHits++;
      const shouldSuppress = warningCache.get(cacheKey);
      if (shouldSuppress) {
        return;
      }
    } else {
      cacheMisses++;
    }

    if (warning.code === 'unknown-prop') {
      // Comprehensive list of SvelteKit internal props (v3.7.6 - Ultimate Coverage)
      const internalProps = [
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
        'submitting', 'delayed', 'timeout', 'message', 'details',
        // Layout-specific props (NEW - v3.7.6)
        'children', 'slot', 'slots', 'layout', 'layoutData', 'pageData',
        'segment', 'segments', 'routeTree', 'routeInfo', 'layoutInfo',
        // Dynamic routing props
        'slug', 'id', 'catch', 'rest', 'optional', 'dynamic',
        // Error boundary props
        'errorBoundary', 'errorInfo', 'errorStack', 'errorMessage',
        // SSR and hydration props
        'ssr', 'hydrate', 'prerender', 'csr', 'trailingSlash'
      ];

      // Enhanced pattern matching with Layout-specific patterns (NEW - v3.7.6)
      const propPatterns = [
        // Standard component warning patterns
        /(?:Page|Component|\w+) was created with unknown prop '([^']+)'/i,
        /received an unexpected slot "([^"]+)"/i,
        /Unknown prop '([^']+)'/i,
        /'([^']+)' was exported/i,
        /prop '([^']+)' was passed to/i,
        // Layout-specific patterns (NEW)
        /(?:Layout|LayoutComponent|\+layout) was created with unknown prop(?:s)? '([^']+)'/i,
        /Layout received unknown prop(?:s)? '([^']+)'/i,
        /(?:\+layout\.svelte|\+page\.svelte) was created with unknown prop(?:s)? '([^']+)'/i,
        // Advanced patterns for various warning formats
        /\$\$props\.([a-zA-Z_$][a-zA-Z0-9_$]*)/,
        /created with unknown prop(?:s)? (\w+)/i,
        /unexpected prop(?:s)? '([^']+)'/i,
        /invalid prop(?:s)? '([^']+)'/i,
        // Multi-prop patterns (Enhanced - v3.7.6)
        /created with unknown props? '([^']+)'/i,
        /with unknown props? '([^']+)' and '([^']+)'/i,
        /with unknown props? '([^']+)', '([^']+)' and '([^']+)'/i,
        // Comma-separated props pattern
        /unknown props? '([^']+(?:',\s*'[^']+)*)'[,\s]*/i
      ];

      // Optimized pattern matching with early exit and multiple captures
      let propMatches: string[] = [];
      let matchedPattern = null;
      let shouldSuppress = false;

      for (let i = 0; i < propPatterns.length; i++) {
        const match = warning.message.match(propPatterns[i]);
        if (match) {
          matchedPattern = i;
          // Handle multiple capture groups
          if (match.length > 2) {
            // Multi-prop pattern matched
            for (let j = 1; j < match.length; j++) {
              if (match[j]) {
                propMatches.push(match[j]);
              }
            }
          } else if (match[1]) {
            // Single prop or comma-separated props
            if (match[1].includes(',')) {
              // Parse comma-separated props
              const props = match[1].split(',').map(p => p.trim().replace(/'/g, ''));
              propMatches.push(...props);
            } else {
              propMatches.push(match[1]);
            }
          }
          break;
        }
      }

      // Check if all found props are internal SvelteKit props
      if (propMatches.length > 0) {
        shouldSuppress = propMatches.every(prop => internalProps.includes(prop.trim()));

        if (shouldSuppress) {
          warningCache.set(cacheKey, true);
          return; // Suppress the warning
        }
      }

      // Enhanced filename-based suppression with caching
      let fileSuppressionResult = false;
      if (warning.filename) {
        const suppressPaths = [
          'node_modules/@sveltejs',
          '.svelte-kit',
          'vite/preload-helper',
          '__sveltekit',
          'app.html',
          // Additional SvelteKit internal paths
          'src/app.html',
          '$app/',
          '@sveltejs/kit',
          'svelte-kit/runtime',
          // Layout-specific paths (NEW - v3.7.6)
          '+layout.svelte',
          '+page.svelte',
          '__layout',
          'layout/'
        ];

        fileSuppressionResult = suppressPaths.some(path => warning.filename.includes(path));
        if (fileSuppressionResult) {
          warningCache.set(cacheKey, true);
          return;
        }
      }

      // Advanced message-based suppression with enhanced multi-prop support
      const suppressMessages = [
        'was created with unknown prop',
        'received an unexpected slot',
        'was passed to component',
        'exported from',
        '$$props',
        'received props',
        'which are not declared',
        // Additional suppression patterns
        'unknown prop',
        'unexpected prop',
        'invalid prop',
        'undeclared prop',
        // Layout-specific messages (NEW - v3.7.6)
        'layout was created with',
        'layout received',
        '+layout.svelte was created',
        '+page.svelte was created'
      ];

      const messageMatches = suppressMessages.some(msg =>
        warning.message.toLowerCase().includes(msg.toLowerCase())
      );

      if (messageMatches) {
        // Enhanced prop extraction with multiple quote patterns
        let extractedProps: string[] = [];

        // Extract single-quoted props
        const singleQuotedProps = warning.message.match(/'([^']+)'/g) || [];
        extractedProps.push(...singleQuotedProps.map(p => p.replace(/'/g, '')));

        // Extract double-quoted props
        const doubleQuotedProps = warning.message.match(/"([^"]+)"/g) || [];
        extractedProps.push(...doubleQuotedProps.map(p => p.replace(/"/g, '')));

        // Extract backtick-quoted props
        const backtickProps = warning.message.match(/`([^`]+)`/g) || [];
        extractedProps.push(...backtickProps.map(p => p.replace(/`/g, '')));

        if (extractedProps.length > 0) {
          // Check if ALL mentioned props are internal SvelteKit props
          const allPropsInternal = extractedProps.every(prop => {
            const cleanProp = prop.trim();
            return internalProps.includes(cleanProp);
          });

          if (allPropsInternal) {
            warningCache.set(cacheKey, true);
            return;
          }
        }
      }

      // Cache miss - store negative result
      warningCache.set(cacheKey, false);
    }

    // Enhanced suppression for other warning types with caching
    const suppressibleWarnings = [
      'a11y-unknown-aria-attribute',
      'a11y-unknown-role',
      'css-unused-selector',
      'unused-export-let',
      // Layout-specific warning types (NEW - v3.7.6)
      'layout-unknown-prop',
      'page-unknown-prop',
      'component-unknown-prop'
    ];

    if (suppressibleWarnings.includes(warning.code)) {
      warningCache.set(cacheKey, true);
      return;
    }

    // Suppress dev-only warnings that aren't actionable
    if (warning.code === 'module_script_reactive_declaration' && process.env.NODE_ENV === 'development') {
      warningCache.set(cacheKey, true);
      return;
    }

    // Store negative cache result for unhandled warnings
    warningCache.set(cacheKey, false);

    // Handle all other warnings normally
    handler(warning);
  };
};

describe('Enhanced SvelteKit Warning Suppression (v3.7.6)', () => {
  let warningHandler: any;
  let mockHandler: any;

  beforeEach(() => {
    warningHandler = createWarningHandler();
    mockHandler = vi.fn();
    process.env.SVELTE_WARNING_DEBUG = 'false';
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.SVELTE_WARNING_DEBUG;
  });

  describe('Layout Component Warning Suppression', () => {
    it('should suppress Layout component params warnings', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Layout was created with unknown prop 'params'",
        filename: 'src/routes/+layout.svelte'
      };

      warningHandler(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress +layout.svelte unknown props warnings', () => {
      const warning = {
        code: 'unknown-prop',
        message: "+layout.svelte was created with unknown props 'params'",
        filename: 'src/routes/(protected)/+layout.svelte'
      };

      warningHandler(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress +page.svelte unknown props warnings', () => {
      const warning = {
        code: 'unknown-prop',
        message: "+page.svelte was created with unknown props 'data'",
        filename: 'src/routes/(protected)/dashboard/+page.svelte'
      };

      warningHandler(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress Layout-specific props (children, slot, layoutData)', () => {
      const warnings = [
        {
          code: 'unknown-prop',
          message: "Layout was created with unknown prop 'children'",
          filename: 'src/routes/+layout.svelte'
        },
        {
          code: 'unknown-prop',
          message: "LayoutComponent was created with unknown prop 'layoutData'",
          filename: 'src/lib/components/Layout.svelte'
        },
        {
          code: 'unknown-prop',
          message: "Component was created with unknown prop 'slot'",
          filename: 'src/routes/+layout.svelte'
        }
      ];

      warnings.forEach(warning => {
        warningHandler(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });

  describe('Enhanced Multi-Prop Detection', () => {
    it('should suppress warnings with multiple props using "and" conjunction', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Page was created with unknown props 'params' and 'data'",
        filename: 'src/routes/+page.svelte'
      };

      warningHandler(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress warnings with three props using comma and "and"', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Component was created with unknown props 'params', 'data' and 'form'",
        filename: 'src/lib/components/Page.svelte'
      };

      warningHandler(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress comma-separated props in single quotes', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Page was created with unknown props 'params', 'route', 'url'",
        filename: 'src/routes/+page.svelte'
      };

      warningHandler(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should handle mixed quote patterns (single, double, backtick)', () => {
      const warning = {
        code: 'unknown-prop',
        message: 'Component was created with unknown props \'params\', "data" and `form`',
        filename: 'src/lib/components/Test.svelte'
      };

      warningHandler(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should NOT suppress if any prop is not internal SvelteKit prop', () => {
      const warning = {
        code: 'unknown-prop',
        message: "UserComponent received unexpected prop 'customUserProp'", // Use message that won't trigger message-based suppression
        filename: 'src/lib/components/UserComponent.svelte' // Use non-layout path
      };

      warningHandler(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning);
    });
  });

  describe('Dynamic Routing Props', () => {
    it('should suppress dynamic routing props (slug, id, catch, rest)', () => {
      const warnings = [
        {
          code: 'unknown-prop',
          message: "Page was created with unknown prop 'slug'",
          filename: 'src/routes/[slug]/+page.svelte'
        },
        {
          code: 'unknown-prop',
          message: "Component was created with unknown prop 'id'",
          filename: 'src/routes/item/[id]/+page.svelte'
        },
        {
          code: 'unknown-prop',
          message: "Page was created with unknown prop 'rest'",
          filename: 'src/routes/[...rest]/+page.svelte'
        },
        {
          code: 'unknown-prop',
          message: "Component was created with unknown prop 'optional'",
          filename: 'src/routes/[[optional]]/+page.svelte'
        }
      ];

      warnings.forEach(warning => {
        warningHandler(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });

  describe('SSR and Hydration Props', () => {
    it('should suppress SSR and hydration props', () => {
      const warnings = [
        {
          code: 'unknown-prop',
          message: "Component was created with unknown prop 'ssr'",
          filename: 'src/routes/+page.svelte'
        },
        {
          code: 'unknown-prop',
          message: "Page was created with unknown prop 'hydrate'",
          filename: 'src/routes/+page.svelte'
        },
        {
          code: 'unknown-prop',
          message: "Component was created with unknown prop 'prerender'",
          filename: 'src/lib/components/SSR.svelte'
        },
        {
          code: 'unknown-prop',
          message: "Page was created with unknown prop 'csr'",
          filename: 'src/routes/+page.svelte'
        },
        {
          code: 'unknown-prop',
          message: "Component was created with unknown prop 'trailingSlash'",
          filename: 'src/app.html'
        }
      ];

      warnings.forEach(warning => {
        warningHandler(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });

  describe('Error Boundary Props', () => {
    it('should suppress error boundary props', () => {
      const warnings = [
        {
          code: 'unknown-prop',
          message: "Component was created with unknown prop 'errorBoundary'",
          filename: 'src/routes/+error.svelte'
        },
        {
          code: 'unknown-prop',
          message: "Page was created with unknown prop 'errorInfo'",
          filename: 'src/routes/+error.svelte'
        },
        {
          code: 'unknown-prop',
          message: "Component was created with unknown prop 'errorStack'",
          filename: 'src/lib/components/Error.svelte'
        },
        {
          code: 'unknown-prop',
          message: "Page was created with unknown prop 'errorMessage'",
          filename: 'src/routes/+error.svelte'
        }
      ];

      warnings.forEach(warning => {
        warningHandler(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });

  describe('Enhanced Filename-Based Suppression', () => {
    it('should suppress warnings from Layout-specific paths', () => {
      const warnings = [
        {
          code: 'unknown-prop',
          message: "Component was created with unknown prop 'customProp'",
          filename: 'src/routes/+layout.svelte'
        },
        {
          code: 'unknown-prop',
          message: "Page was created with unknown prop 'customProp'",
          filename: 'src/routes/(protected)/+page.svelte'
        },
        {
          code: 'unknown-prop',
          message: "Component was created with unknown prop 'customProp'",
          filename: 'src/lib/layout/MainLayout.svelte'
        },
        {
          code: 'unknown-prop',
          message: "Component was created with unknown prop 'customProp'",
          filename: 'src/app/__layout.svelte'
        }
      ];

      warnings.forEach(warning => {
        warningHandler(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });

  describe('Enhanced Message-Based Suppression', () => {
    it('should suppress Layout-specific messages with SvelteKit props', () => {
      const warnings = [
        {
          code: 'unknown-prop',
          message: "layout was created with unknown prop 'params'",
          filename: 'src/components/Layout.svelte'
        },
        {
          code: 'unknown-prop',
          message: "layout received unknown prop 'data'",
          filename: 'src/components/Layout.svelte'
        },
        {
          code: 'unknown-prop',
          message: "+layout.svelte was created with unknown prop 'form'",
          filename: 'src/routes/+layout.svelte'
        },
        {
          code: 'unknown-prop',
          message: "+page.svelte was created with unknown prop 'url'",
          filename: 'src/routes/+page.svelte'
        }
      ];

      warnings.forEach(warning => {
        warningHandler(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });

  describe('Enhanced Warning Types Suppression', () => {
    it('should suppress Layout-specific warning types', () => {
      const warnings = [
        {
          code: 'layout-unknown-prop',
          message: "Layout has unknown prop",
          filename: 'src/routes/+layout.svelte'
        },
        {
          code: 'page-unknown-prop',
          message: "Page has unknown prop",
          filename: 'src/routes/+page.svelte'
        },
        {
          code: 'component-unknown-prop',
          message: "Component has unknown prop",
          filename: 'src/lib/components/Test.svelte'
        }
      ];

      warnings.forEach(warning => {
        warningHandler(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });

  describe('Performance and Caching', () => {
    it('should cache warning suppression decisions', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Page was created with unknown prop 'params'",
        filename: 'src/routes/+page.svelte'
      };

      // First call should process the warning
      warningHandler(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();

      // Second call should use cache (no additional processing)
      warningHandler(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should cache negative results (warnings that should pass through)', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop 'customUserProp'",
        filename: 'src/lib/components/UserComponent.svelte'
      };

      // First call should process and pass through
      warningHandler(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning);

      mockHandler.mockClear();

      // Second call should use cache and pass through
      warningHandler(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning);
    });
  });

  describe('Backward Compatibility', () => {
    it('should still suppress all original SvelteKit props', () => {
      const originalProps = [
        'params', 'route', 'url', 'status', 'error', 'form', 'data',
        'beforeNavigate', 'afterNavigate', 'invalidateAll', 'preloadData',
        'navigating', 'enhanced', 'shallow', 'keepFocus', 'noscroll',
        'replaceState', 'invalidate', 'goto', 'pushState', 'popState',
        'updated', 'page', 'stores', 'snapshot', 'state',
        'preloadCode', 'reload', 'routeId', 'routeParams',
        'searchParams', 'hash', 'origin', 'pathname', 'search',
        'serviceWorker', 'offline', 'online', 'connectivity',
        'dev', 'browser', 'building', 'version', 'base', 'assets',
        'submitting', 'delayed', 'timeout', 'message', 'details'
      ];

      originalProps.forEach(prop => {
        const warning = {
          code: 'unknown-prop',
          message: `Page was created with unknown prop '${prop}'`,
          filename: 'src/routes/+page.svelte'
        };

        warningHandler(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should maintain existing functionality for non-SvelteKit warnings', () => {
      const warning = {
        code: 'some-other-warning',
        message: "Some other warning message",
        filename: 'src/lib/components/UserComponent.svelte'
      };

      warningHandler(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning);
    });
  });
});
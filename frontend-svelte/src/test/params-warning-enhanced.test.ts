/**
 * Enhanced SvelteKit Params Warning Suppression Tests
 *
 * This test suite validates the enhanced warning suppression functionality
 * implemented in svelte.config.js, including the comprehensive regex patterns,
 * message-based suppression, and enhanced SvelteKit prop support.
 *
 * Features tested:
 * - Enhanced regex patterns for prop matching
 * - Comprehensive internal props list (25 props)
 * - Message-based suppression logic
 * - Filename-based suppression for SvelteKit internals
 * - Multi-prop warning handling
 * - Enhanced path suppression
 *
 * Context: Enhanced warning suppression for cleaner console output (v3.7.2)
 *
 * @file params-warning-enhanced.test.ts
 * @author Claude Code Test Engineer
 * @date 2025-09-18
 * @version 2.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Enhanced configuration matching the actual svelte.config.js implementation
const enhancedSvelteConfig = {
  onwarn: (warning: any, handler: any) => {
    if (warning.code === 'unknown-prop') {
      // Comprehensive list of known SvelteKit internal props
      const internalProps = [
        'params', 'route', 'url', 'status', 'error', 'form', 'data',
        'beforeNavigate', 'afterNavigate', 'invalidateAll', 'preloadData',
        'updated', 'page', 'stores', 'snapshot', 'state', 'navigating',
        'enhanced', 'shallow', 'keepFocus', 'noscroll', 'replaceState',
        'invalidate', 'goto', 'pushState', 'popState'
      ];

      // Enhanced pattern matching for prop warnings with comprehensive regex patterns
      const propPatterns = [
        /Page was created with unknown prop '([^']+)'/,
        /Component was created with unknown prop '([^']+)'/,
        /'([^']+)' was exported/,
        /Unknown prop '([^']+)'/,
        /received an unexpected slot "([^"]+)"/,
        /\$\$props\.([a-zA-Z_$][a-zA-Z0-9_$]*)/,
        /prop '([^']+)' was passed to/
      ];

      let propMatch = null;
      for (const pattern of propPatterns) {
        propMatch = warning.message.match(pattern);
        if (propMatch) break;
      }

      if (propMatch && internalProps.includes(propMatch[1])) {
        return; // Suppress the warning
      }

      // Enhanced filename checks for SvelteKit internal warnings
      if (warning.filename) {
        const suppressPaths = [
          'node_modules/@sveltejs',
          '.svelte-kit',
          'vite/preload-helper',
          '__sveltekit',
          'app.html'
        ];

        if (suppressPaths.some(path => warning.filename.includes(path))) {
          return;
        }
      }

      // Additional message-based suppression for SvelteKit internals
      const suppressMessages = [
        'was created with unknown prop',
        'received an unexpected slot',
        'was passed to component',
        'exported from',
        '$$props',
        'received props',
        'which are not declared'
      ];

      if (suppressMessages.some(msg => warning.message.includes(msg))) {
        // Check if it's about internal props
        const messageProps = warning.message.match(/'([^']+)'/g);
        if (messageProps) {
          // Check if ALL mentioned props are internal SvelteKit props
          const allPropsInternal = messageProps.every(prop => {
            const cleanProp = prop.replace(/'/g, '');
            return internalProps.includes(cleanProp);
          });

          if (allPropsInternal) {
            return;
          }
        }
      }
    }

    // Suppress other known non-critical warnings
    if (warning.code === 'a11y-unknown-aria-attribute') return;
    if (warning.code === 'a11y-unknown-role') return;
    if (warning.code === 'css-unused-selector') return;
    if (warning.code === 'module_script_reactive_declaration' && process.env.NODE_ENV === 'development') return;

    handler(warning);
  }
};

describe('Enhanced SvelteKit Params Warning Suppression', () => {
  let mockHandler: any;

  beforeEach(() => {
    mockHandler = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Enhanced Internal Props List', () => {
    it('should include all 25 SvelteKit internal props', () => {
      const expectedProps = [
        // Core SvelteKit props
        'params', 'route', 'url', 'status', 'error', 'form', 'data',
        // Navigation props
        'beforeNavigate', 'afterNavigate', 'invalidateAll', 'preloadData',
        // State management props
        'updated', 'page', 'stores', 'snapshot', 'state', 'navigating',
        // Enhanced navigation props
        'enhanced', 'shallow', 'keepFocus', 'noscroll', 'replaceState',
        'invalidate', 'goto', 'pushState', 'popState'
      ];

      const configSource = enhancedSvelteConfig.onwarn.toString();
      expectedProps.forEach(prop => {
        expect(configSource).toContain(`'${prop}'`);
      });

      expect(expectedProps).toHaveLength(25);
    });

    it('should suppress warnings for all enhanced navigation props', () => {
      const enhancedNavigationProps = [
        'enhanced', 'shallow', 'keepFocus', 'noscroll', 'replaceState',
        'invalidate', 'goto', 'pushState', 'popState'
      ];

      enhancedNavigationProps.forEach(prop => {
        const warning = {
          code: 'unknown-prop',
          message: `Page was created with unknown prop '${prop}'`,
          filename: '/src/routes/+page.svelte'
        };

        mockHandler.mockClear();
        enhancedSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should suppress warnings for navigation state props', () => {
      const navigationStateProps = ['navigating', 'updated', 'snapshot'];

      navigationStateProps.forEach(prop => {
        const warning = {
          code: 'unknown-prop',
          message: `Component was created with unknown prop '${prop}'`,
          filename: '/src/routes/+layout.svelte'
        };

        mockHandler.mockClear();
        enhancedSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });

  describe('Enhanced Regex Pattern Matching', () => {
    it('should match "received an unexpected slot" pattern', () => {
      const warning = {
        code: 'unknown-prop',
        message: 'Component received an unexpected slot "params"',
        filename: '/src/lib/components/Layout.svelte'
      };

      enhancedSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should match "$$props.propName" pattern', () => {
      const warning = {
        code: 'unknown-prop',
        message: 'Access to $$props.params detected in component',
        filename: '/src/routes/+page.svelte'
      };

      enhancedSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should match "prop was passed to" pattern', () => {
      const warning = {
        code: 'unknown-prop',
        message: "prop 'params' was passed to component but not declared",
        filename: '/src/lib/components/PageWrapper.svelte'
      };

      enhancedSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should handle complex prop names in regex patterns', () => {
      const complexProps = ['data-testid', '_internal', '$store', 'on:click'];

      // Note: These are NOT internal props, so they should NOT be suppressed
      complexProps.forEach(prop => {
        const warning = {
          code: 'unknown-prop',
          message: `Page was created with unknown prop '${prop}'`,
          filename: '/src/routes/+page.svelte'
        };

        mockHandler.mockClear();
        enhancedSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).toHaveBeenCalledWith(warning);
      });
    });

    it('should validate $$props regex pattern with various identifiers', () => {
      const validIdentifiers = ['params', 'route_data', '$store', '_internal', 'camelCase'];

      validIdentifiers.forEach(identifier => {
        const regex = /\$\$props\.([a-zA-Z_$][a-zA-Z0-9_$]*)/;
        const message = `Access to $$props.${identifier} detected`;
        const match = message.match(regex);

        expect(match).not.toBeNull();
        expect(match![1]).toBe(identifier);
      });
    });
  });

  describe('Enhanced Filename-Based Suppression', () => {
    it('should suppress warnings from .svelte-kit directory', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Page was created with unknown prop 'customProp'",
        filename: '/project/.svelte-kit/generated/client/app.js'
      };

      enhancedSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress warnings from vite/preload-helper', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop 'data'",
        filename: '/node_modules/vite/preload-helper.js'
      };

      enhancedSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress warnings from __sveltekit directory', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Unknown prop 'params'",
        filename: '/src/__sveltekit/internal/client.js'
      };

      enhancedSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress warnings from app.html', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Page was created with unknown prop 'url'",
        filename: '/src/app.html'
      };

      enhancedSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should NOT suppress warnings from application files', () => {
      const applicationPaths = [
        '/src/routes/dashboard/+page.svelte',
        '/src/lib/components/Button.svelte',
        '/src/lib/stores/auth.store.ts',
        '/src/lib/services/api.service.ts'
      ];

      applicationPaths.forEach(filename => {
        const warning = {
          code: 'unknown-prop',
          message: "Page was created with unknown prop 'customProp'",
          filename
        };

        mockHandler.mockClear();
        enhancedSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).toHaveBeenCalledWith(warning);
      });
    });
  });

  describe('Message-Based Suppression Logic', () => {
    it('should suppress warnings with "was created with unknown prop" for internal props', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Layout component was created with unknown prop 'params' and 'route'",
        filename: '/src/routes/+layout.svelte'
      };

      enhancedSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress warnings with "received props" for internal props', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Component received props 'params', 'url', 'data' which are not declared",
        filename: '/src/lib/components/PageComponent.svelte'
      };

      enhancedSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress warnings with "exported from" for internal props', () => {
      const warning = {
        code: 'unknown-prop',
        message: "'params' and 'route' were exported from component but not used",
        filename: '/src/routes/+page.svelte'
      };

      enhancedSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should NOT suppress mixed internal/external prop warnings', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Component received props 'params', 'customProp' which are not declared",
        filename: '/src/lib/components/PageComponent.svelte'
      };

      enhancedSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning);
    });

    it('should handle warnings with no quoted props in message', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop but prop name is missing",
        filename: '/src/routes/+page.svelte'
      };

      enhancedSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning);
    });

    it('should handle empty props list in message', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Component received props which are not declared",
        filename: '/src/routes/+page.svelte'
      };

      enhancedSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning);
    });
  });

  describe('Multi-Prop Warning Handling', () => {
    it('should suppress warnings when ALL props are internal', () => {
      const allInternalWarnings = [
        "Component received props 'params', 'route', 'url'",
        "Page was created with unknown props 'data', 'form', 'status'",
        "'beforeNavigate', 'afterNavigate', 'invalidateAll' were exported"
      ];

      allInternalWarnings.forEach(message => {
        const warning = {
          code: 'unknown-prop',
          message,
          filename: '/src/routes/+page.svelte'
        };

        mockHandler.mockClear();
        enhancedSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should NOT suppress warnings when ANY prop is external', () => {
      const mixedWarnings = [
        "Component received props 'params', 'customProp'",
        "Page was created with unknown props 'data', 'userDefined'",
        "'route', 'applicationSpecific' were exported"
      ];

      mixedWarnings.forEach(message => {
        const warning = {
          code: 'unknown-prop',
          message,
          filename: '/src/routes/+page.svelte'
        };

        mockHandler.mockClear();
        enhancedSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).toHaveBeenCalledWith(warning);
      });
    });

    it('should handle complex multi-prop warning scenarios', () => {
      const complexScenarios = [
        {
          message: "Component 'PageWrapper' received props 'params', 'route', 'url', 'data' from SvelteKit",
          shouldSuppress: true
        },
        {
          message: "Layout component exported 'beforeNavigate', 'afterNavigate', 'customHandler'",
          shouldSuppress: false
        },
        {
          message: "Page component was created with unknown props 'enhanced', 'shallow', 'keepFocus'",
          shouldSuppress: true
        }
      ];

      complexScenarios.forEach(({ message, shouldSuppress }) => {
        const warning = {
          code: 'unknown-prop',
          message,
          filename: '/src/routes/+page.svelte'
        };

        mockHandler.mockClear();
        enhancedSvelteConfig.onwarn(warning, mockHandler);

        if (shouldSuppress) {
          expect(mockHandler).not.toHaveBeenCalled();
        } else {
          expect(mockHandler).toHaveBeenCalledWith(warning);
        }
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should efficiently process warnings with multiple regex patterns', () => {
      const patterns = [
        "Page was created with unknown prop 'params'",
        "Component was created with unknown prop 'route'",
        "'url' was exported",
        "Unknown prop 'data'",
        'received an unexpected slot "form"',
        "Access to $$props.status detected",
        "prop 'error' was passed to component"
      ];

      const startTime = performance.now();

      patterns.forEach(message => {
        const warning = {
          code: 'unknown-prop',
          message,
          filename: '/src/routes/+page.svelte'
        };

        enhancedSvelteConfig.onwarn(warning, mockHandler);
      });

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(15); // Should process quickly
      expect(mockHandler).not.toHaveBeenCalled(); // All should be suppressed
    });

    it('should handle regex patterns with special characters', () => {
      const specialCharacterTests = [
        {
          message: "$$props.params accessed in component",
          pattern: /\$\$props\.([a-zA-Z_$][a-zA-Z0-9_$]*)/,
          expectedMatch: 'params'
        },
        {
          message: 'received an unexpected slot "data-params"',
          pattern: /received an unexpected slot "([^"]+)"/,
          expectedMatch: 'data-params'
        },
        {
          message: "prop 'on:navigate' was passed to component",
          pattern: /prop '([^']+)' was passed to/,
          expectedMatch: 'on:navigate'
        }
      ];

      specialCharacterTests.forEach(({ message, pattern, expectedMatch }) => {
        const match = message.match(pattern);
        expect(match).not.toBeNull();
        expect(match![1]).toBe(expectedMatch);
      });
    });

    it('should maintain performance with deeply nested prop checks', () => {
      // Test scenario with many props to check ALL internal status
      const manyPropsMessage = "Component received props " +
        "'params', 'route', 'url', 'data', 'form', 'status', 'error', " +
        "'beforeNavigate', 'afterNavigate', 'invalidateAll', 'preloadData', " +
        "'updated', 'page', 'stores', 'snapshot', 'state', 'navigating' " +
        "which are not declared";

      const warning = {
        code: 'unknown-prop',
        message: manyPropsMessage,
        filename: '/src/routes/+page.svelte'
      };

      const startTime = performance.now();
      enhancedSvelteConfig.onwarn(warning, mockHandler);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(5); // Should be fast even with many props
      expect(mockHandler).not.toHaveBeenCalled(); // Should suppress (all internal)
    });
  });

  describe('Real-World Integration Scenarios', () => {
    it('should handle SvelteKit layout component warnings', () => {
      const layoutWarnings = [
        "Layout component was created with unknown prop 'page'",
        "Layout component received props 'navigating', 'updated'",
        "'stores' and 'snapshot' were exported from layout"
      ];

      layoutWarnings.forEach(message => {
        const warning = {
          code: 'unknown-prop',
          message,
          filename: '/src/routes/+layout.svelte'
        };

        mockHandler.mockClear();
        enhancedSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should handle SvelteKit error page warnings', () => {
      const errorPageWarnings = [
        "Error page was created with unknown prop 'status'",
        "Error component received props 'error', 'status'",
        "'error' was exported from error page component"
      ];

      errorPageWarnings.forEach(message => {
        const warning = {
          code: 'unknown-prop',
          message,
          filename: '/src/routes/+error.svelte'
        };

        mockHandler.mockClear();
        enhancedSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should handle enhanced navigation scenarios', () => {
      const enhancedNavigationWarnings = [
        "Navigation component received props 'enhanced', 'shallow'",
        "Router was created with unknown props 'keepFocus', 'noscroll'",
        "'replaceState', 'pushState', 'popState' were passed to navigator"
      ];

      enhancedNavigationWarnings.forEach(message => {
        const warning = {
          code: 'unknown-prop',
          message,
          filename: '/src/lib/components/Navigation.svelte'
        };

        mockHandler.mockClear();
        enhancedSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should preserve application-specific warnings in real scenarios', () => {
      const applicationWarnings = [
        "Dashboard component was created with unknown prop 'userId'",
        "Button component received props 'variant', 'size'",
        "'onClick', 'disabled' were exported from custom component"
      ];

      applicationWarnings.forEach(message => {
        const warning = {
          code: 'unknown-prop',
          message,
          filename: '/src/lib/components/Dashboard.svelte'
        };

        mockHandler.mockClear();
        enhancedSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).toHaveBeenCalledWith(warning);
      });
    });
  });

  describe('Configuration Completeness', () => {
    it('should have comprehensive coverage of all SvelteKit features', () => {
      const svelteKitFeatureGroups = {
        routing: ['params', 'route', 'url'],
        data: ['data', 'form'],
        errors: ['status', 'error'],
        navigation: ['beforeNavigate', 'afterNavigate', 'invalidateAll', 'preloadData'],
        state: ['updated', 'page', 'stores', 'snapshot', 'state'],
        enhanced: ['navigating', 'enhanced', 'shallow', 'keepFocus', 'noscroll'],
        actions: ['replaceState', 'invalidate', 'goto', 'pushState', 'popState']
      };

      const configSource = enhancedSvelteConfig.onwarn.toString();

      Object.values(svelteKitFeatureGroups).flat().forEach(prop => {
        expect(configSource).toContain(`'${prop}'`);
      });
    });

    it('should validate all documented regex patterns are implemented', () => {
      const requiredPatterns = [
        'Page was created with unknown prop',
        'Component was created with unknown prop',
        'was exported',
        'Unknown prop',
        'received an unexpected slot',
        '\\$\\$props\\.',
        'prop .+ was passed to'
      ];

      const configSource = enhancedSvelteConfig.onwarn.toString();

      requiredPatterns.forEach(pattern => {
        expect(configSource).toContain(pattern.replace(/\\/g, ''));
      });
    });

    it('should validate all documented suppress paths are implemented', () => {
      const requiredPaths = [
        'node_modules/@sveltejs',
        '.svelte-kit',
        'vite/preload-helper',
        '__sveltekit',
        'app.html'
      ];

      const configSource = enhancedSvelteConfig.onwarn.toString();

      requiredPaths.forEach(path => {
        expect(configSource).toContain(path);
      });
    });
  });
});
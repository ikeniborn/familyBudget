/**
 * SvelteKit Params Warning Suppression Validation Tests
 *
 * This test suite validates the params warning suppression functionality
 * by testing the actual behavior rather than implementation details.
 * Focuses on functional validation and real-world scenarios.
 *
 * Context: Enhanced warning suppression validation (v3.7.2)
 *
 * @file params-warning-validation.test.ts
 * @author Claude Code Test Engineer
 * @date 2025-09-18
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Actual configuration implementation from svelte.config.js
const actualOnwarn = (warning: any, handler: any) => {
  if (warning.code === 'unknown-prop') {
    // Comprehensive list of known SvelteKit internal props
    const internalProps = [
      'params', 'route', 'url', 'status', 'error', 'form', 'data',
      'beforeNavigate', 'afterNavigate', 'invalidateAll', 'preloadData',
      'updated', 'page', 'stores', 'snapshot', 'state', 'navigating',
      'enhanced', 'shallow', 'keepFocus', 'noscroll', 'replaceState',
      'invalidate', 'goto', 'pushState', 'popState'
    ];

    // Safe message handling to prevent null/undefined errors
    if (!warning.message) {
      handler(warning);
      return;
    }

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
};

describe('SvelteKit Params Warning Suppression Validation', () => {
  let mockHandler: any;

  beforeEach(() => {
    mockHandler = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Core SvelteKit Props Suppression', () => {
    it('should suppress all core SvelteKit navigation props', () => {
      const coreProps = ['params', 'route', 'url'];

      coreProps.forEach(prop => {
        const warning = {
          code: 'unknown-prop',
          message: `Page was created with unknown prop '${prop}'`,
          filename: '/src/routes/+page.svelte'
        };

        mockHandler.mockClear();
        actualOnwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should suppress all core SvelteKit data props', () => {
      const dataProps = ['data', 'form', 'status', 'error'];

      dataProps.forEach(prop => {
        const warning = {
          code: 'unknown-prop',
          message: `Component was created with unknown prop '${prop}'`,
          filename: '/src/routes/+layout.svelte'
        };

        mockHandler.mockClear();
        actualOnwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should suppress all navigation function props', () => {
      const navFunctionProps = ['beforeNavigate', 'afterNavigate', 'invalidateAll', 'preloadData'];

      navFunctionProps.forEach(prop => {
        const warning = {
          code: 'unknown-prop',
          message: `Unknown prop '${prop}'`,
          filename: '/src/routes/+page.svelte'
        };

        mockHandler.mockClear();
        actualOnwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should suppress all state management props', () => {
      const stateProps = ['updated', 'page', 'stores', 'snapshot', 'state', 'navigating'];

      stateProps.forEach(prop => {
        const warning = {
          code: 'unknown-prop',
          message: `'${prop}' was exported`,
          filename: '/src/routes/+layout.svelte'
        };

        mockHandler.mockClear();
        actualOnwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should suppress all enhanced navigation props', () => {
      const enhancedProps = ['enhanced', 'shallow', 'keepFocus', 'noscroll', 'replaceState', 'invalidate', 'goto', 'pushState', 'popState'];

      enhancedProps.forEach(prop => {
        const warning = {
          code: 'unknown-prop',
          message: `Page was created with unknown prop '${prop}'`,
          filename: '/src/routes/+page.svelte'
        };

        mockHandler.mockClear();
        actualOnwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });

  describe('Enhanced Regex Pattern Validation', () => {
    it('should suppress warnings matching "received an unexpected slot" pattern', () => {
      const warning = {
        code: 'unknown-prop',
        message: 'Component received an unexpected slot "params"',
        filename: '/src/lib/components/Layout.svelte'
      };

      actualOnwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress warnings matching "$$props.propName" pattern', () => {
      const warning = {
        code: 'unknown-prop',
        message: 'Access to $$props.params detected in component',
        filename: '/src/routes/+page.svelte'
      };

      actualOnwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress warnings matching "prop was passed to" pattern', () => {
      const warning = {
        code: 'unknown-prop',
        message: "prop 'params' was passed to component but not declared",
        filename: '/src/lib/components/PageWrapper.svelte'
      };

      actualOnwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should NOT suppress non-internal props with same patterns', () => {
      const nonInternalWarnings = [
        'Component received an unexpected slot "customSlot"',
        'Access to $$props.customProp detected in component',
        "prop 'applicationProp' was passed to component but not declared"
      ];

      nonInternalWarnings.forEach(message => {
        const warning = {
          code: 'unknown-prop',
          message,
          filename: '/src/routes/+page.svelte'
        };

        mockHandler.mockClear();
        actualOnwarn(warning, mockHandler);
        expect(mockHandler).toHaveBeenCalledWith(warning);
      });
    });
  });

  describe('Filename-Based Suppression', () => {
    it('should suppress warnings from SvelteKit internal paths', () => {
      const internalPaths = [
        'node_modules/@sveltejs/kit/src/runtime/app.js',
        '.svelte-kit/generated/client/app.js',
        'vite/preload-helper.js',
        '__sveltekit/internal/client.js',
        'src/app.html'
      ];

      internalPaths.forEach(filename => {
        const warning = {
          code: 'unknown-prop',
          message: "Component was created with unknown prop 'customProp'",
          filename
        };

        mockHandler.mockClear();
        actualOnwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should NOT suppress warnings from application paths', () => {
      const applicationPaths = [
        '/src/routes/dashboard/+page.svelte',
        '/src/lib/components/Button.svelte',
        '/src/lib/stores/auth.store.ts'
      ];

      applicationPaths.forEach(filename => {
        const warning = {
          code: 'unknown-prop',
          message: "Component was created with unknown prop 'customProp'",
          filename
        };

        mockHandler.mockClear();
        actualOnwarn(warning, mockHandler);
        expect(mockHandler).toHaveBeenCalledWith(warning);
      });
    });
  });

  describe('Message-Based Suppression', () => {
    it('should suppress single internal prop in message-based warnings', () => {
      const suppressMessages = [
        'was created with unknown prop',
        'received props',
        'exported from'
      ];

      suppressMessages.forEach(messageType => {
        const warning = {
          code: 'unknown-prop',
          message: `Component ${messageType} 'params'`,
          filename: '/src/routes/+page.svelte'
        };

        mockHandler.mockClear();
        actualOnwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should suppress multiple internal props in message-based warnings', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Component received props 'params', 'route', 'url' which are not declared",
        filename: '/src/routes/+page.svelte'
      };

      actualOnwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should NOT suppress mixed internal/external props', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Component received props 'params', 'customProp' which are not declared",
        filename: '/src/routes/+page.svelte'
      };

      actualOnwarn(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning);
    });

    it('should handle warnings with no quoted props', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop but no prop name specified",
        filename: '/src/routes/+page.svelte'
      };

      actualOnwarn(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning);
    });
  });

  describe('Other Warning Types Suppression', () => {
    it('should suppress a11y warnings', () => {
      const a11yWarnings = [
        { code: 'a11y-unknown-aria-attribute', message: "Unknown aria attribute" },
        { code: 'a11y-unknown-role', message: "Unknown role" }
      ];

      a11yWarnings.forEach(warning => {
        mockHandler.mockClear();
        actualOnwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should suppress css-unused-selector warnings', () => {
      const warning = {
        code: 'css-unused-selector',
        message: "Unused CSS selector",
        filename: '/src/routes/+page.svelte'
      };

      actualOnwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress module_script_reactive_declaration in development only', () => {
      const warning = {
        code: 'module_script_reactive_declaration',
        message: "Reactive declarations in module scripts are not recommended",
        filename: '/src/lib/stores/auth.store.ts'
      };

      // Test development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      actualOnwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();

      // Test production environment
      process.env.NODE_ENV = 'production';
      mockHandler.mockClear();

      actualOnwarn(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Application Warning Preservation', () => {
    it('should NOT suppress custom application props', () => {
      const customProps = ['userId', 'variant', 'size', 'onClick', 'isLoading'];

      customProps.forEach(prop => {
        const warning = {
          code: 'unknown-prop',
          message: `Component was created with unknown prop '${prop}'`,
          filename: '/src/lib/components/Button.svelte'
        };

        mockHandler.mockClear();
        actualOnwarn(warning, mockHandler);
        expect(mockHandler).toHaveBeenCalledWith(warning);
      });
    });

    it('should NOT suppress critical warnings', () => {
      const criticalWarnings = [
        { code: 'unused-export-let', message: "Unused export let" },
        { code: 'a11y-missing-attribute', message: "Missing required attribute" },
        { code: 'reactive-component-declaration', message: "Component in reactive statement" }
      ];

      criticalWarnings.forEach(warning => {
        mockHandler.mockClear();
        actualOnwarn(warning, mockHandler);
        expect(mockHandler).toHaveBeenCalledWith(warning);
      });
    });

    it('should NOT suppress misspelled SvelteKit props', () => {
      const misspelledProps = ['paramz', 'rout', 'ur1', 'dat4'];

      misspelledProps.forEach(prop => {
        const warning = {
          code: 'unknown-prop',
          message: `Page was created with unknown prop '${prop}'`,
          filename: '/src/routes/+page.svelte'
        };

        mockHandler.mockClear();
        actualOnwarn(warning, mockHandler);
        expect(mockHandler).toHaveBeenCalledWith(warning);
      });
    });
  });

  describe('Real-World Application Scenarios', () => {
    it('should handle typical navigation scenario warnings', () => {
      const navigationScenarios = [
        {
          warning: {
            code: 'unknown-prop',
            message: "Page was created with unknown prop 'params'",
            filename: '/src/routes/(protected)/dashboard/+page.svelte'
          },
          shouldSuppress: true,
          description: 'Dashboard receiving route params'
        },
        {
          warning: {
            code: 'unknown-prop',
            message: "Layout component received props 'navigating', 'page'",
            filename: '/src/routes/(protected)/+layout.svelte'
          },
          shouldSuppress: true,
          description: 'Layout receiving navigation state'
        },
        {
          warning: {
            code: 'unknown-prop',
            message: "Button component was created with unknown prop 'variant'",
            filename: '/src/lib/components/Button.svelte'
          },
          shouldSuppress: false,
          description: 'Custom component prop'
        }
      ];

      navigationScenarios.forEach(({ warning, shouldSuppress, description }) => {
        mockHandler.mockClear();
        actualOnwarn(warning, mockHandler);

        if (shouldSuppress) {
          expect(mockHandler).not.toHaveBeenCalled();
        } else {
          expect(mockHandler).toHaveBeenCalledWith(warning);
        }
      });
    });

    it('should handle settings page scenarios', () => {
      const settingsScenarios = [
        {
          code: 'unknown-prop',
          message: "Settings page was created with unknown prop 'url'",
          filename: '/src/routes/(protected)/settings/+page.svelte',
          shouldSuppress: true
        },
        {
          code: 'unknown-prop',
          message: "Articles component received props 'data', 'form'",
          filename: '/src/routes/(protected)/settings/articles/+page.svelte',
          shouldSuppress: true
        },
        {
          code: 'unknown-prop',
          message: "Modal component was created with unknown prop 'isOpen'",
          filename: '/src/lib/components/Modal.svelte',
          shouldSuppress: false
        }
      ];

      settingsScenarios.forEach(({ code, message, filename, shouldSuppress }) => {
        const warning = { code, message, filename };
        mockHandler.mockClear();
        actualOnwarn(warning, mockHandler);

        if (shouldSuppress) {
          expect(mockHandler).not.toHaveBeenCalled();
        } else {
          expect(mockHandler).toHaveBeenCalledWith(warning);
        }
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should process warnings efficiently', () => {
      const startTime = performance.now();

      // Test multiple warnings
      for (let i = 0; i < 100; i++) {
        const warning = {
          code: 'unknown-prop',
          message: `Page was created with unknown prop 'params'`,
          filename: `/src/routes/page${i}.svelte`
        };

        actualOnwarn(warning, mockHandler);
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(50); // Should be fast
      expect(mockHandler).not.toHaveBeenCalled(); // All should be suppressed
    });

    it('should handle edge cases gracefully', () => {
      const edgeCases = [
        { code: 'unknown-prop', filename: '/src/routes/+page.svelte' }, // Missing message
        { message: "Page was created with unknown prop 'params'" }, // Missing code
        { code: 'unknown-prop', message: null, filename: '/src/routes/+page.svelte' }, // Null message
        {} // Empty warning
      ];

      edgeCases.forEach(warning => {
        expect(() => {
          actualOnwarn(warning, mockHandler);
        }).not.toThrow();
      });
    });
  });
});
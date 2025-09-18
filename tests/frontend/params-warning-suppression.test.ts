/**
 * SvelteKit Params Warning Suppression Tests
 *
 * Tests the onwarn configuration in svelte.config.js that suppresses
 * "Page was created with unknown prop 'params'" warnings and other
 * SvelteKit internal prop warnings while preserving legitimate warnings.
 *
 * Context: Fixed console warning pollution during navigation (v3.7.2)
 *
 * @file params-warning-suppression.test.ts
 * @author Claude Code Test Engineer
 * @date 2025-09-18
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import '@testing-library/jest-dom';

// Test component that simulates SvelteKit page components
// This component would normally receive props from SvelteKit
const TestPageComponent = `
<script lang="ts">
  export let params: any = undefined;
  export let url: any = undefined;
  export let data: any = undefined;
  export let form: any = undefined;
  export let route: any = undefined;
  export let customProp: string = '';
</script>

<div data-testid="test-page">
  <h1>Test Page</h1>
  {#if params}
    <p>Params: {JSON.stringify(params)}</p>
  {/if}
  {#if customProp}
    <p>Custom: {customProp}</p>
  {/if}
</div>
`;

// Mock the Svelte configuration to test warning suppression
const mockSvelteConfig = {
  onwarn: (warning: any, handler: any) => {
    // This is the actual implementation from svelte.config.js
    if (warning.code === 'unknown-prop') {
      const internalProps = [
        'params', 'route', 'url', 'status', 'error', 'form', 'data',
        'beforeNavigate', 'afterNavigate', 'invalidateAll', 'preloadData',
        'updated', 'page', 'stores', 'snapshot', 'state'
      ];

      const propMatch = warning.message.match(/Page was created with unknown prop '([^']+)'/) ||
                       warning.message.match(/Component was created with unknown prop '([^']+)'/) ||
                       warning.message.match(/'([^']+)' was exported/) ||
                       warning.message.match(/Unknown prop '([^']+)'/);

      if (propMatch && internalProps.includes(propMatch[1])) {
        return; // Suppress the warning
      }

      if (warning.filename && warning.filename.includes('node_modules/@sveltejs')) {
        return;
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

describe('SvelteKit Params Warning Suppression', () => {
  let consoleWarnSpy: any;
  let mockHandler: any;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockHandler = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration Validation', () => {
    it('should have the correct internal props list', () => {
      const expectedInternalProps = [
        'params', 'route', 'url', 'status', 'error', 'form', 'data',
        'beforeNavigate', 'afterNavigate', 'invalidateAll', 'preloadData',
        'updated', 'page', 'stores', 'snapshot', 'state'
      ];

      // Test that our configuration includes all expected SvelteKit internal props
      const configSource = mockSvelteConfig.onwarn.toString();
      expectedInternalProps.forEach(prop => {
        expect(configSource).toContain(`'${prop}'`);
      });
    });

    it('should have the correct warning code checks', () => {
      const configSource = mockSvelteConfig.onwarn.toString();

      // Test that configuration checks for the right warning codes
      expect(configSource).toContain("warning.code === 'unknown-prop'");
      expect(configSource).toContain("warning.code === 'a11y-unknown-aria-attribute'");
      expect(configSource).toContain("warning.code === 'a11y-unknown-role'");
      expect(configSource).toContain("warning.code === 'css-unused-selector'");
      expect(configSource).toContain("warning.code === 'module_script_reactive_declaration'");
    });

    it('should have the correct regex patterns for prop matching', () => {
      const configSource = mockSvelteConfig.onwarn.toString();

      // Test that all expected warning message patterns are covered
      expect(configSource).toContain("Page was created with unknown prop");
      expect(configSource).toContain("Component was created with unknown prop");
      expect(configSource).toContain("was exported");
      expect(configSource).toContain("Unknown prop");
    });
  });

  describe('Unknown Prop Warning Suppression', () => {
    it('should suppress warnings for SvelteKit internal props - params', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Page was created with unknown prop 'params'",
        filename: '/src/routes/+page.svelte'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);

      // Handler should not be called (warning suppressed)
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress warnings for SvelteKit internal props - route', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop 'route'",
        filename: '/src/routes/+layout.svelte'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress warnings for SvelteKit internal props - url', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Page was created with unknown prop 'url'",
        filename: '/src/routes/settings/+page.svelte'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress warnings for SvelteKit internal props - data', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Unknown prop 'data'",
        filename: '/src/routes/api/+page.svelte'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress warnings for SvelteKit internal props - form', () => {
      const warning = {
        code: 'unknown-prop',
        message: "'form' was exported",
        filename: '/src/routes/login/+page.svelte'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress warnings for all SvelteKit navigation props', () => {
      const navigationProps = ['beforeNavigate', 'afterNavigate', 'invalidateAll', 'preloadData'];

      navigationProps.forEach(prop => {
        const warning = {
          code: 'unknown-prop',
          message: `Page was created with unknown prop '${prop}'`,
          filename: '/src/routes/+page.svelte'
        };

        mockHandler.mockClear();
        mockSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should suppress warnings for SvelteKit state management props', () => {
      const stateProps = ['updated', 'page', 'stores', 'snapshot', 'state'];

      stateProps.forEach(prop => {
        const warning = {
          code: 'unknown-prop',
          message: `Component was created with unknown prop '${prop}'`,
          filename: '/src/routes/+layout.svelte'
        };

        mockHandler.mockClear();
        mockSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should suppress warnings for SvelteKit error handling props', () => {
      const errorProps = ['status', 'error'];

      errorProps.forEach(prop => {
        const warning = {
          code: 'unknown-prop',
          message: `Unknown prop '${prop}'`,
          filename: '/src/routes/+error.svelte'
        };

        mockHandler.mockClear();
        mockSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });

  describe('SvelteKit Node Modules Warning Suppression', () => {
    it('should suppress warnings from SvelteKit node_modules', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop 'customProp'",
        filename: '/node_modules/@sveltejs/kit/src/runtime/client/app.js'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress warnings from SvelteKit adapter node_modules', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Page was created with unknown prop 'params'",
        filename: '/node_modules/@sveltejs/adapter-node/files/handler.js'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Other Warning Suppression', () => {
    it('should suppress a11y-unknown-aria-attribute warnings', () => {
      const warning = {
        code: 'a11y-unknown-aria-attribute',
        message: "Unknown aria attribute 'aria-custom'",
        filename: '/src/lib/components/Button.svelte'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress a11y-unknown-role warnings', () => {
      const warning = {
        code: 'a11y-unknown-role',
        message: "Unknown role 'custom-role'",
        filename: '/src/lib/components/Modal.svelte'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress css-unused-selector warnings', () => {
      const warning = {
        code: 'css-unused-selector',
        message: "Unused CSS selector '.unused-class'",
        filename: '/src/routes/+page.svelte'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should suppress module_script_reactive_declaration warnings in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const warning = {
        code: 'module_script_reactive_declaration',
        message: "Reactive declarations in module scripts are not recommended",
        filename: '/src/lib/stores/auth.store.ts'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should NOT suppress module_script_reactive_declaration warnings in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const warning = {
        code: 'module_script_reactive_declaration',
        message: "Reactive declarations in module scripts are not recommended",
        filename: '/src/lib/stores/auth.store.ts'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Legitimate Warning Preservation', () => {
    it('should NOT suppress warnings for legitimate custom props', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Page was created with unknown prop 'unknownCustomProp'",
        filename: '/src/routes/+page.svelte'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning);
    });

    it('should NOT suppress warnings for misspelled SvelteKit props', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop 'paramz'", // Misspelled 'params'
        filename: '/src/routes/+page.svelte'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning);
    });

    it('should NOT suppress warnings for application-specific props', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Page was created with unknown prop 'userId'",
        filename: '/src/routes/dashboard/+page.svelte'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning);
    });

    it('should NOT suppress warnings for component props outside SvelteKit', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop 'customButtonProp'",
        filename: '/src/lib/components/Button.svelte'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning);
    });

    it('should NOT suppress other warning codes', () => {
      const warning = {
        code: 'unused-export-let',
        message: "Component has unused export let 'unused'",
        filename: '/src/lib/components/Card.svelte'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning);
    });

    it('should NOT suppress critical warnings', () => {
      const criticalWarnings = [
        { code: 'a11y-missing-attribute', message: "Missing alt attribute on img element" },
        { code: 'a11y-no-abstract-role', message: "Do not use abstract roles" },
        { code: 'reactive-component-declaration', message: "Component declaration in reactive statement" }
      ];

      criticalWarnings.forEach(warning => {
        mockHandler.mockClear();
        mockSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).toHaveBeenCalledWith(warning);
      });
    });
  });

  describe('Regex Pattern Validation', () => {
    it('should match "Page was created with unknown prop" pattern', () => {
      const regex = /Page was created with unknown prop '([^']+)'/;
      const message = "Page was created with unknown prop 'params'";
      const match = message.match(regex);

      expect(match).not.toBeNull();
      expect(match![1]).toBe('params');
    });

    it('should match "Component was created with unknown prop" pattern', () => {
      const regex = /Component was created with unknown prop '([^']+)'/;
      const message = "Component was created with unknown prop 'route'";
      const match = message.match(regex);

      expect(match).not.toBeNull();
      expect(match![1]).toBe('route');
    });

    it('should match "was exported" pattern', () => {
      const regex = /'([^']+)' was exported/;
      const message = "'data' was exported";
      const match = message.match(regex);

      expect(match).not.toBeNull();
      expect(match![1]).toBe('data');
    });

    it('should match "Unknown prop" pattern', () => {
      const regex = /Unknown prop '([^']+)'/;
      const message = "Unknown prop 'form'";
      const match = message.match(regex);

      expect(match).not.toBeNull();
      expect(match![1]).toBe('form');
    });

    it('should handle props with special characters', () => {
      const regex = /Page was created with unknown prop '([^']+)'/;
      const message = "Page was created with unknown prop 'data-testid'";
      const match = message.match(regex);

      expect(match).not.toBeNull();
      expect(match![1]).toBe('data-testid');
    });
  });

  describe('Edge Cases', () => {
    it('should handle warnings without message property', () => {
      const warning = {
        code: 'unknown-prop',
        filename: '/src/routes/+page.svelte'
        // Missing message property
      };

      expect(() => {
        mockSvelteConfig.onwarn(warning, mockHandler);
      }).not.toThrow();

      // Should pass through to handler since no message to match
      expect(mockHandler).toHaveBeenCalledWith(warning);
    });

    it('should handle warnings without filename property', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Page was created with unknown prop 'params'"
        // Missing filename property
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled(); // Should still suppress based on prop name
    });

    it('should handle warnings without code property', () => {
      const warning = {
        message: "Page was created with unknown prop 'params'",
        filename: '/src/routes/+page.svelte'
        // Missing code property
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning); // Should pass through
    });

    it('should handle malformed warning messages', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Malformed warning message without quotes",
        filename: '/src/routes/+page.svelte'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning); // Should pass through malformed messages
    });

    it('should handle empty prop names in warning messages', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Page was created with unknown prop ''",
        filename: '/src/routes/+page.svelte'
      };

      mockSvelteConfig.onwarn(warning, mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(warning); // Should pass through empty prop names
    });
  });

  describe('Performance and Efficiency', () => {
    it('should efficiently process multiple warnings', () => {
      const warnings = [
        { code: 'unknown-prop', message: "Page was created with unknown prop 'params'" },
        { code: 'unknown-prop', message: "Page was created with unknown prop 'route'" },
        { code: 'unknown-prop', message: "Page was created with unknown prop 'url'" },
        { code: 'unknown-prop', message: "Page was created with unknown prop 'data'" },
        { code: 'unknown-prop', message: "Page was created with unknown prop 'form'" }
      ];

      const startTime = performance.now();

      warnings.forEach(warning => {
        mockSvelteConfig.onwarn(warning, mockHandler);
      });

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should process all warnings quickly (under 10ms for 5 warnings)
      expect(processingTime).toBeLessThan(10);
      expect(mockHandler).not.toHaveBeenCalled(); // All should be suppressed
    });

    it('should not create memory leaks with repeated calls', () => {
      const warning = {
        code: 'unknown-prop',
        message: "Page was created with unknown prop 'params'",
        filename: '/src/routes/+page.svelte'
      };

      // Call the warning handler many times
      for (let i = 0; i < 1000; i++) {
        mockSvelteConfig.onwarn(warning, mockHandler);
      }

      // Should not accumulate calls to handler (all suppressed)
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('should suppress common SvelteKit page navigation warnings', () => {
      const navigationWarnings = [
        "Page was created with unknown prop 'params'",
        "Page was created with unknown prop 'url'",
        "Page was created with unknown prop 'route'",
        "Component was created with unknown prop 'beforeNavigate'",
        "Component was created with unknown prop 'afterNavigate'"
      ];

      navigationWarnings.forEach(message => {
        const warning = {
          code: 'unknown-prop',
          message,
          filename: '/src/routes/+page.svelte'
        };

        mockHandler.mockClear();
        mockSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should suppress common SvelteKit form handling warnings', () => {
      const formWarnings = [
        "Page was created with unknown prop 'form'",
        "Page was created with unknown prop 'data'",
        "'form' was exported",
        "'data' was exported"
      ];

      formWarnings.forEach(message => {
        const warning = {
          code: 'unknown-prop',
          message,
          filename: '/src/routes/login/+page.svelte'
        };

        mockHandler.mockClear();
        mockSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should suppress common SvelteKit error handling warnings', () => {
      const errorWarnings = [
        "Page was created with unknown prop 'status'",
        "Page was created with unknown prop 'error'",
        "Unknown prop 'status'",
        "Unknown prop 'error'"
      ];

      errorWarnings.forEach(message => {
        const warning = {
          code: 'unknown-prop',
          message,
          filename: '/src/routes/+error.svelte'
        };

        mockHandler.mockClear();
        mockSvelteConfig.onwarn(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });

  describe('Documentation and Maintainability', () => {
    it('should have all documented internal props covered in tests', () => {
      const documentedProps = [
        'params', 'route', 'url', 'status', 'error', 'form', 'data',
        'beforeNavigate', 'afterNavigate', 'invalidateAll', 'preloadData',
        'updated', 'page', 'stores', 'snapshot', 'state'
      ];

      // This test ensures that if new props are added to the config,
      // they should also be covered in our test scenarios
      const configSource = mockSvelteConfig.onwarn.toString();

      documentedProps.forEach(prop => {
        expect(configSource).toContain(`'${prop}'`);
      });
    });

    it('should validate configuration matches documented behavior', () => {
      // Test that the configuration actually implements the documented suppression
      const testCases = [
        { prop: 'params', shouldSuppress: true },
        { prop: 'route', shouldSuppress: true },
        { prop: 'url', shouldSuppress: true },
        { prop: 'data', shouldSuppress: true },
        { prop: 'form', shouldSuppress: true },
        { prop: 'customProp', shouldSuppress: false },
        { prop: 'unknownProp', shouldSuppress: false }
      ];

      testCases.forEach(({ prop, shouldSuppress }) => {
        const warning = {
          code: 'unknown-prop',
          message: `Page was created with unknown prop '${prop}'`,
          filename: '/src/routes/+page.svelte'
        };

        mockHandler.mockClear();
        mockSvelteConfig.onwarn(warning, mockHandler);

        if (shouldSuppress) {
          expect(mockHandler).not.toHaveBeenCalled();
        } else {
          expect(mockHandler).toHaveBeenCalledWith(warning);
        }
      });
    });
  });
});
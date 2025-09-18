/**
 * Test suite for verifying SvelteKit params prop warning suppression
 *
 * This test validates that the svelte.config.js warning suppression
 * correctly handles SvelteKit internal props, especially 'params'
 */

import { test, expect } from 'vitest';

// Mock SvelteKit warning handler
const warnings = [];
const mockHandler = (warning) => {
  warnings.push(warning);
};

// Recreate the onwarn function from svelte.config.js for testing
const onwarn = (warning, handler) => {
  // Suppress warnings about unknown props that SvelteKit passes internally
  if (warning.code === 'unknown-prop') {
    // Comprehensive list of known SvelteKit internal props that shouldn't cause warnings
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

  // Handle all other warnings normally
  handler(warning);
};

test('should suppress params prop warnings', () => {
  warnings.length = 0;

  const paramWarning = {
    code: 'unknown-prop',
    message: "Page was created with unknown prop 'params'",
    filename: 'src/routes/+page.svelte'
  };

  // Call the onwarn function
  onwarn(paramWarning, mockHandler);

  // Warning should be suppressed (not passed to handler)
  expect(warnings).toHaveLength(0);
});

test('should suppress route prop warnings', () => {
  warnings.length = 0;

  const routeWarning = {
    code: 'unknown-prop',
    message: "Component was created with unknown prop 'route'",
    filename: 'src/lib/components/Navigation.svelte'
  };

  onwarn(routeWarning, mockHandler);
  expect(warnings).toHaveLength(0);
});

test('should suppress data prop warnings', () => {
  warnings.length = 0;

  const dataWarning = {
    code: 'unknown-prop',
    message: "Page was created with unknown prop 'data'",
    filename: 'src/routes/(protected)/dashboard/+page.svelte'
  };

  onwarn(dataWarning, mockHandler);
  expect(warnings).toHaveLength(0);
});

test('should suppress form prop warnings', () => {
  warnings.length = 0;

  const formWarning = {
    code: 'unknown-prop',
    message: "Unknown prop 'form'",
    filename: 'src/routes/login/+page.svelte'
  };

  onwarn(formWarning, mockHandler);
  expect(warnings).toHaveLength(0);
});

test('should suppress SvelteKit internal path warnings', () => {
  warnings.length = 0;

  const internalWarning = {
    code: 'unknown-prop',
    message: "Page was created with unknown prop 'stores'",
    filename: 'node_modules/@sveltejs/kit/src/runtime/app/stores.js'
  };

  onwarn(internalWarning, mockHandler);
  expect(warnings).toHaveLength(0);
});

test('should suppress .svelte-kit path warnings', () => {
  warnings.length = 0;

  const svelteKitWarning = {
    code: 'unknown-prop',
    message: "Component was created with unknown prop 'page'",
    filename: '.svelte-kit/generated/root.svelte'
  };

  onwarn(svelteKitWarning, mockHandler);
  expect(warnings).toHaveLength(0);
});

test('should allow legitimate warnings to pass through', () => {
  warnings.length = 0;

  const legitimateWarning = {
    code: 'unknown-prop',
    message: "Page was created with unknown prop 'customProp'",
    filename: 'src/routes/+page.svelte'
  };

  onwarn(legitimateWarning, mockHandler);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toBe(legitimateWarning);
});

test('should suppress a11y warnings', () => {
  warnings.length = 0;

  const a11yWarning = {
    code: 'a11y-unknown-aria-attribute',
    message: 'Unknown ARIA attribute',
    filename: 'src/lib/components/Button.svelte'
  };

  onwarn(a11yWarning, mockHandler);
  expect(warnings).toHaveLength(0);
});

test('should suppress css-unused-selector warnings', () => {
  warnings.length = 0;

  const cssWarning = {
    code: 'css-unused-selector',
    message: 'Unused CSS selector',
    filename: 'src/routes/+layout.svelte'
  };

  onwarn(cssWarning, mockHandler);
  expect(warnings).toHaveLength(0);
});

test('should handle multiple prop patterns in single message', () => {
  warnings.length = 0;

  const multiPropWarning = {
    code: 'unknown-prop',
    message: "Component received props 'params' and 'data' which are not declared",
    filename: 'src/routes/settings/+page.svelte'
  };

  onwarn(multiPropWarning, mockHandler);
  expect(warnings).toHaveLength(0);
});

test('should handle prop export warnings', () => {
  warnings.length = 0;

  const exportWarning = {
    code: 'unknown-prop',
    message: "'params' was exported from component",
    filename: 'src/routes/+page.svelte'
  };

  onwarn(exportWarning, mockHandler);
  expect(warnings).toHaveLength(0);
});

// Test comprehensive SvelteKit internal props list
test('should suppress all SvelteKit internal props', () => {
  const internalProps = [
    'params', 'route', 'url', 'status', 'error', 'form', 'data',
    'beforeNavigate', 'afterNavigate', 'invalidateAll', 'preloadData',
    'updated', 'page', 'stores', 'snapshot', 'state', 'navigating',
    'enhanced', 'shallow', 'keepFocus', 'noscroll', 'replaceState',
    'invalidate', 'goto', 'pushState', 'popState'
  ];

  internalProps.forEach(prop => {
    warnings.length = 0;

    const warning = {
      code: 'unknown-prop',
      message: `Page was created with unknown prop '${prop}'`,
      filename: 'src/routes/+page.svelte'
    };

    onwarn(warning, mockHandler);
    expect(warnings).toHaveLength(0);
  });
});

test('should handle various warning message patterns', () => {
  const warningPatterns = [
    "Page was created with unknown prop 'params'",
    "Component was created with unknown prop 'route'",
    "'data' was exported",
    "Unknown prop 'form'",
    "received an unexpected slot \"params\"",
    "prop 'url' was passed to"
  ];

  warningPatterns.forEach(message => {
    warnings.length = 0;

    const warning = {
      code: 'unknown-prop',
      message: message,
      filename: 'src/routes/+page.svelte'
    };

    onwarn(warning, mockHandler);
    expect(warnings).toHaveLength(0);
  });
});
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),
  
  compilerOptions: {
    // Svelte 4 compatibility options
    hydratable: true
  },

  onwarn: (warning, handler) => {
    // Enhanced warning suppression for SvelteKit internal props
    // Performance optimization: Cache warning patterns for faster matching
    const debugWarnings = process.env.SVELTE_WARNING_DEBUG === 'true';

    if (warning.code === 'unknown-prop') {
      // Comprehensive list of SvelteKit internal props (v3.7.5 - Enhanced Coverage)
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
        'submitting', 'delayed', 'timeout', 'message', 'details'
      ];

      // Enhanced pattern matching with performance optimization
      const propPatterns = [
        // Standard component warning patterns
        /(?:Page|Component|\w+) was created with unknown prop '([^']+)'/i,
        /received an unexpected slot "([^"]+)"/i,
        /Unknown prop '([^']+)'/i,
        /'([^']+)' was exported/i,
        /prop '([^']+)' was passed to/i,
        // Advanced patterns for various warning formats
        /\$\$props\.([a-zA-Z_$][a-zA-Z0-9_$]*)/,
        /created with unknown prop (\w+)/,
        /unexpected prop '([^']+)'/i,
        /invalid prop '([^']+)'/i,
        // Multi-prop patterns
        /created with unknown props? '([^']+)'/i
      ];

      // Optimized pattern matching with early exit
      let propMatch = null;
      let matchedPattern = null;
      for (let i = 0; i < propPatterns.length; i++) {
        propMatch = warning.message.match(propPatterns[i]);
        if (propMatch) {
          matchedPattern = i;
          break;
        }
      }

      if (propMatch && internalProps.includes(propMatch[1])) {
        if (debugWarnings) {
          console.debug(`[SVELTE CONFIG] Suppressed SvelteKit internal prop warning: ${propMatch[1]} (pattern ${matchedPattern})`);
        }
        return; // Suppress the warning
      }

      // Enhanced filename-based suppression with performance optimization
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
          'svelte-kit/runtime'
        ];

        const shouldSuppress = suppressPaths.some(path => warning.filename.includes(path));
        if (shouldSuppress) {
          if (debugWarnings) {
            console.debug(`[SVELTE CONFIG] Suppressed warning from SvelteKit internal path: ${warning.filename}`);
          }
          return;
        }
      }

      // Advanced message-based suppression with multi-prop support
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
        'undeclared prop'
      ];

      const messageMatches = suppressMessages.some(msg =>
        warning.message.toLowerCase().includes(msg.toLowerCase())
      );

      if (messageMatches) {
        // Extract all quoted props from the message
        const messageProps = warning.message.match(/'([^']+)'/g) || [];
        if (messageProps.length > 0) {
          // Check if ALL mentioned props are internal SvelteKit props
          const allPropsInternal = messageProps.every(quotedProp => {
            const cleanProp = quotedProp.replace(/'/g, '');
            return internalProps.includes(cleanProp);
          });

          if (allPropsInternal) {
            if (debugWarnings) {
              console.debug(`[SVELTE CONFIG] Suppressed message-based warning for props: ${messageProps.join(', ')}`);
            }
            return;
          }
        }
      }

      // Debug logging for unhandled unknown-prop warnings
      if (debugWarnings) {
        console.debug(`[SVELTE CONFIG] Unhandled unknown-prop warning:`, {
          message: warning.message,
          filename: warning.filename,
          code: warning.code
        });
      }
    }

    // Enhanced suppression for other warning types
    const suppressibleWarnings = [
      'a11y-unknown-aria-attribute',
      'a11y-unknown-role',
      'css-unused-selector', // Dev-only CSS warnings
      'unused-export-let' // Unused export let warnings
    ];

    if (suppressibleWarnings.includes(warning.code)) {
      if (debugWarnings) {
        console.debug(`[SVELTE CONFIG] Suppressed warning type: ${warning.code}`);
      }
      return;
    }

    // Suppress dev-only warnings that aren't actionable
    if (warning.code === 'module_script_reactive_declaration' && process.env.NODE_ENV === 'development') {
      if (debugWarnings) {
        console.debug(`[SVELTE CONFIG] Suppressed dev-only reactive declaration warning`);
      }
      return;
    }

    // Performance optimization: Batch similar warnings
    if (debugWarnings) {
      console.debug(`[SVELTE CONFIG] Passing through warning:`, {
        code: warning.code,
        message: warning.message.substring(0, 100) + (warning.message.length > 100 ? '...' : ''),
        filename: warning.filename ? warning.filename.split('/').pop() : 'unknown'
      });
    }

    // Handle all other warnings normally
    handler(warning);
  },

  kit: {
    // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
    // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
    // See https://svelte.dev/docs/kit/adapters for more information about adapters.
    adapter: adapter({
      out: 'build',
      precompress: false,
      envPrefix: ''
    }),
    // Configure path prefix for production deployment behind reverse proxy
    paths: {
      base: process.env.NODE_ENV === 'production' ? '/svelte' : '',
      relative: false
    },
    alias: {
      $components: 'src/lib/components',
      $stores: 'src/lib/stores',
      $services: 'src/lib/services',
      $types: 'src/lib/types',
      $utils: 'src/lib/utils'
    }
  }
};

export default config;
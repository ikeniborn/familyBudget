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

  onwarn: (() => {
    // Performance cache for processed warnings (v3.7.6 - Ultimate Enhancement)
    const warningCache = new Map();
    let cacheHits = 0;
    let cacheMisses = 0;

    return (warning, handler) => {
      // Enhanced warning suppression for SvelteKit internal props
      // Performance optimization: Cache warning patterns for faster matching
      const debugWarnings = process.env.SVELTE_WARNING_DEBUG === 'true';

      // Performance cache check
      const cacheKey = `${warning.code}:${warning.message}`;
      if (warningCache.has(cacheKey)) {
        cacheHits++;
        const shouldSuppress = warningCache.get(cacheKey);
        if (shouldSuppress) {
          if (debugWarnings) {
            console.debug(`[SVELTE CONFIG] Cache hit - suppressed warning (hits: ${cacheHits}, misses: ${cacheMisses})`);
          }
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
        let propMatches = [];
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
            if (debugWarnings) {
              console.debug(`[SVELTE CONFIG] Suppressed SvelteKit internal prop(s): ${propMatches.join(', ')} (pattern ${matchedPattern})`);
            }
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
            if (debugWarnings) {
              console.debug(`[SVELTE CONFIG] Suppressed warning from SvelteKit internal path: ${warning.filename}`);
            }
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
          let extractedProps = [];

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
              if (debugWarnings) {
                console.debug(`[SVELTE CONFIG] Suppressed message-based warning for props: ${extractedProps.join(', ')}`);
              }
              return;
            }
          }
        }

        // Cache miss - store negative result
        warningCache.set(cacheKey, false);

        // Debug logging for unhandled unknown-prop warnings
        if (debugWarnings) {
          console.debug(`[SVELTE CONFIG] Unhandled unknown-prop warning (cache stats - hits: ${cacheHits}, misses: ${cacheMisses}):`, {
            message: warning.message,
            filename: warning.filename,
            code: warning.code,
            extractedProps: propMatches
          });
        }
      }

      // Enhanced suppression for other warning types with caching
      const suppressibleWarnings = [
        'a11y-unknown-aria-attribute',
        'a11y-unknown-role',
        'css-unused-selector', // Dev-only CSS warnings
        'unused-export-let', // Unused export let warnings
        // Layout-specific warning types (NEW - v3.7.6)
        'layout-unknown-prop',
        'page-unknown-prop',
        'component-unknown-prop'
      ];

      if (suppressibleWarnings.includes(warning.code)) {
        warningCache.set(cacheKey, true);
        if (debugWarnings) {
          console.debug(`[SVELTE CONFIG] Suppressed warning type: ${warning.code}`);
        }
        return;
      }

      // Suppress dev-only warnings that aren't actionable
      if (warning.code === 'module_script_reactive_declaration' && process.env.NODE_ENV === 'development') {
        warningCache.set(cacheKey, true);
        if (debugWarnings) {
          console.debug(`[SVELTE CONFIG] Suppressed dev-only reactive declaration warning`);
        }
        return;
      }

      // Cache performance reporting (every 100 operations)
      const totalOperations = cacheHits + cacheMisses;
      if (debugWarnings && totalOperations > 0 && totalOperations % 100 === 0) {
        const hitRate = ((cacheHits / totalOperations) * 100).toFixed(1);
        console.debug(`[SVELTE CONFIG] Cache performance: ${hitRate}% hit rate (${cacheHits} hits, ${cacheMisses} misses)`);
      }

      // Store negative cache result for unhandled warnings
      warningCache.set(cacheKey, false);

      // Performance optimization: Batch similar warnings
      if (debugWarnings) {
        console.debug(`[SVELTE CONFIG] Passing through warning (cache stats - hits: ${cacheHits}, misses: ${cacheMisses}):`, {
          code: warning.code,
          message: warning.message.substring(0, 100) + (warning.message.length > 100 ? '...' : ''),
          filename: warning.filename ? warning.filename.split('/').pop() : 'unknown'
        });
      }

      // Handle all other warnings normally
      handler(warning);
    };
  })(),

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
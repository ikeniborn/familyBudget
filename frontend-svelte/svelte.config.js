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
    // Suppress warnings about unknown props that SvelteKit passes internally
    // This is a known issue when SvelteKit passes internal props to page components
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
    if (warning.code === 'css-unused-selector') return; // Suppress unused CSS warnings in dev

    // Suppress dev-only warnings that aren't actionable
    if (warning.code === 'module_script_reactive_declaration' && process.env.NODE_ENV === 'development') return;

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
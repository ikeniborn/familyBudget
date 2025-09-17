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
    // This is a known issue when SvelteKit passes internal props like 'params' to page components
    if (warning.code === 'unknown-prop') {
      // List of known SvelteKit internal props that shouldn't cause warnings
      const internalProps = ['params', 'route', 'url', 'status', 'error', 'form', 'data'];
      const propMatch = warning.message.match(/'([^']+)'/);
      if (propMatch && internalProps.includes(propMatch[1])) {
        return; // Suppress the warning
      }
    }

    // Suppress other known non-critical warnings
    if (warning.code === 'a11y-unknown-aria-attribute') return;
    if (warning.code === 'a11y-unknown-role') return;

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
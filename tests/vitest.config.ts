/**
 * Vitest configuration for dashboard tests
 */
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    name: 'dashboard-tests',
    include: [
      'tests/frontend/**/*.test.ts',
      'tests/frontend/**/*.spec.ts'
    ],
    exclude: [
      'node_modules/**',
      'build/**',
      '.svelte-kit/**'
    ],
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/services/dashboard.service.ts',
        'src/routes/(protected)/dashboard/**/*.svelte'
      ],
      exclude: [
        'node_modules/**',
        'tests/**',
        'src/test/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 90,
          lines: 85,
          statements: 85
        }
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      $lib: new URL('../frontend-svelte/src/lib', import.meta.url).pathname,
      $app: new URL('../frontend-svelte/src/app', import.meta.url).pathname,
      '$env/dynamic/private': new URL('../frontend-svelte/src/test/mocks/env-dynamic-private.ts', import.meta.url).pathname,
      '$env/dynamic/public': new URL('../frontend-svelte/src/test/mocks/env-dynamic-public.ts', import.meta.url).pathname,
      '$env/static/private': new URL('../frontend-svelte/src/test/mocks/env-static-private.ts', import.meta.url).pathname,
      '$env/static/public': new URL('../frontend-svelte/src/test/mocks/env-static-public.ts', import.meta.url).pathname
    }
  }
});
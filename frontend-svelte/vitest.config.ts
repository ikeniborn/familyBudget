import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';

export default defineConfig({
  plugins: [sveltekit()],
  
  test: {
    // Test environment
    environment: 'jsdom',
    
    // Setup files
    setupFiles: ['./src/test/setup.ts'],
    
    // Include patterns
    include: ['src/**/*.{test,spec}.{js,ts}'],
    
    // Global test configuration
    globals: true,
    
    // Browser environment simulation
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        runScripts: 'dangerously'
      }
    },
    
    // Force client-side compilation
    define: {
      'import.meta.env.SSR': false,
      'import.meta.env.MODE': '"test"'
    },

    // Configure for browser environment
    transformMode: {
      web: [/\.[jt]sx?$/, /\.svelte$/],
      ssr: []
    },
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/dist/**',
        '**/*.test.*',
        '**/*.spec.*',
      ],
      // Target 50% coverage threshold
      thresholds: {
        global: {
          branches: 50,
          functions: 50,
          lines: 50,
          statements: 50
        }
      }
    }
  },

  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'),
      $components: path.resolve('./src/lib/components'),
      $stores: path.resolve('./src/lib/stores'),
      $services: path.resolve('./src/lib/services'),
      $types: path.resolve('./src/lib/types'),
      $utils: path.resolve('./src/lib/utils'),
      $test: path.resolve('./src/test'),
      $app: path.resolve('./node_modules/@sveltejs/kit/src/runtime/app')
    }
  }
});
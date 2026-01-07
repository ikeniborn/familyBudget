import { defineConfig } from 'vite';
import { resolve } from 'path';
import compression from 'vite-plugin-compression';
import { visualizer } from 'rollup-plugin-visualizer';
import swCacheVersionPlugin from './vite-plugin-sw-version';

const production = process.env.NODE_ENV === 'production';

// Параметры из environment (передаются через build-all.js)
const entryName = process.env.VITE_ENTRY_NAME || 'bundle';
const entryInput = process.env.VITE_ENTRY_INPUT || 'frontend/web/static/js/index.ts';
const entryOutput = process.env.VITE_ENTRY_OUTPUT || 'frontend/web/static/js/dist/bundle.js';
const globalName = process.env.VITE_GLOBAL_NAME || 'App';
const isServiceWorker = process.env.VITE_IS_SW === 'true';

// Build info logged by build-all.js, no need to duplicate here

export default defineConfig({
  build: {
    outDir: '.', // Output в корень проекта, не в dist/
    emptyOutDir: false, // Не удалять файлы (5 билдов пишут в разные места)
    minify: production ? 'esbuild' : false,
    sourcemap: !production,
    target: 'es2020',

    rollupOptions: {
      input: resolve(__dirname, entryInput),

      output: {
        format: 'iife',
        name: globalName,
        entryFileNames: entryOutput,
        generatedCode: {
          constBindings: true
        }
      }
    }
  },

  plugins: [
    // Service Worker plugin только для sw.js
    isServiceWorker && swCacheVersionPlugin(),

    // Gzip compression
    production && compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
      deleteOriginFile: false
    }),

    // Bundle analyzer только для некоторых bundles
    production && (entryName === 'budgetShared' || entryName === 'components') && visualizer({
      filename: `./dist/bundle-stats-${entryName}.html`,
      open: false,
      gzipSize: true,
      brotliSize: true
    })
  ].filter(Boolean),

  // Path aliases
  resolve: {
    alias: {
      '@web': resolve(__dirname, 'frontend/web/static/js'),
      '@webapp': resolve(__dirname, 'frontend/webapp/static/js'),
      '@shared': resolve(__dirname, 'frontend/shared/static/js'),
      '@components': resolve(__dirname, 'frontend/web/static/js/modules/uiComponents')
    }
  },

  // CSS
  css: {
    postcss: './postcss.config.js'
  }
});

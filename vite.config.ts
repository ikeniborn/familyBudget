import { defineConfig } from 'vite';
import { resolve } from 'path';
import compression from 'vite-plugin-compression';
import { visualizer } from 'rollup-plugin-visualizer';
import swCacheVersionPlugin from './vite-plugin-sw-version';

const production = process.env.NODE_ENV === 'production';

export default defineConfig({
  build: {
    emptyOutDir: false, // Не удалять другие файлы
    minify: production ? 'esbuild' : false,
    sourcemap: !production,
    target: 'es2020',

    rollupOptions: {
      // 5 entry points
      input: {
        budgetShared: resolve(__dirname, 'frontend/shared/static/js/budgetShared.ts'),
        bundle: resolve(__dirname, 'frontend/web/static/js/index.ts'),
        webapp: resolve(__dirname, 'frontend/webapp/static/js/index.ts'),
        components: resolve(__dirname, 'frontend/web/static/js/modules/uiComponents/index.ts'),
        sw: resolve(__dirname, 'sw.js')
      },

      output: {
        format: 'iife',

        // КРИТИЧНО: отключить code-splitting для IIFE
        inlineDynamicImports: false,
        manualChunks: undefined, // Отключить автоматическое разделение на chunks

        // Динамические имена файлов
        entryFileNames: (chunkInfo) => {
          const entryPaths: Record<string, string> = {
            budgetShared: 'frontend/shared/static/js/budgetShared.bundle.js',
            bundle: 'frontend/web/static/js/dist/bundle.js',
            webapp: 'frontend/webapp/static/js/dist/webapp.bundle.js',
            components: 'frontend/web/static/js/dist/components.bundle.js',
            sw: 'sw.min.js'
          };
          return entryPaths[chunkInfo.name] || '[name].js';
        },

        // Оптимизация
        generatedCode: {
          constBindings: true
        }
      }
    }
  },

  plugins: [
    // Service Worker cache version injection
    swCacheVersionPlugin(),

    // Gzip compression
    production && compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
      deleteOriginFile: false
    }),

    // Bundle analyzer
    production && visualizer({
      filename: './dist/bundle-stats.html',
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

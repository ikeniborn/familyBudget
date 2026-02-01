import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import compression from 'vite-plugin-compression';
import { visualizer } from 'rollup-plugin-visualizer';
import swCacheVersionPlugin from '../scripts/build/plugins/vite-plugin-sw-version';

const production = process.env.NODE_ENV === 'production';

// Post-build plugin: копирует файлы из dist/ в финальные локации
function postBuildCopy() {
  return {
    name: 'post-build-copy',
    closeBundle() {
      const files = [
        { src: 'dist/budgetShared.js', dest: 'frontend/shared/static/js/budgetShared.bundle.js' },
        { src: 'dist/bundle.js', dest: 'frontend/web/static/js/dist/bundle.js' },
        { src: 'dist/webapp.js', dest: 'frontend/webapp/static/js/dist/webapp.bundle.js' },
        { src: 'dist/components.js', dest: 'frontend/web/static/js/dist/components.bundle.js' },
        { src: 'dist/sw.js', dest: 'sw.min.js' },
        { src: 'dist/lists.js', dest: 'frontend/web/static/js/lists.min.js' },
        { src: 'dist/transfers.js', dest: 'frontend/web/static/js/transfers.min.js' },
        { src: 'dist/plan.js', dest: 'frontend/web/static/js/dist/plan.bundle.js' }
      ];

      files.forEach(({ src, dest }) => {
        try {
          mkdirSync(dirname(dest), { recursive: true });
          copyFileSync(src, dest);
          // Silent copy - errors only
        } catch (err) {
          throw new Error(`Failed to copy ${src} to ${dest}: ${err.message}`);
        }
      });
    }
  };
}

export default defineConfig({
  build: {
    outDir: 'dist', // Безопасная директория для сборки
    emptyOutDir: true, // Очищать dist/ перед каждой сборкой
    minify: production ? 'esbuild' : false,
    sourcemap: !production,
    target: 'es2020',

    rollupOptions: {
      // 6 entry points (NOTE: Not used in build process - build-all.js uses vite.config.single.ts)
      input: {
        budgetShared: resolve(__dirname, 'frontend/shared/static/js/budgetShared.ts'),
        bundle: resolve(__dirname, 'frontend/web/static/js/index.ts'),
        webapp: resolve(__dirname, 'frontend/webapp/static/js/index.ts'),
        components: resolve(__dirname, 'frontend/web/static/js/modules/uiComponents/index.ts'),
        sw: resolve(__dirname, 'sw.js'),
        transfers: resolve(__dirname, 'frontend/web/static/js/transfers/index.ts'),
        plan: resolve(__dirname, 'frontend/web/static/js/plan/index.ts')
      },

      output: {
        format: 'iife',

        // КРИТИЧНО: отключить code-splitting для IIFE
        inlineDynamicImports: false,
        manualChunks: undefined, // Отключить автоматическое разделение на chunks

        // Упрощенные имена файлов в dist/ (без путей)
        entryFileNames: '[name].js',

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

    // Post-build file copying (dist/ → final locations)
    // NOTE: Not used - build-all.js uses vite.config.single.ts instead
    postBuildCopy(),

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
      '@components': resolve(__dirname, 'frontend/web/static/js/modules/uiComponents'),
      '@db': resolve(__dirname, 'frontend/shared/db')
    }
  },

  // Dependency optimization
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.wasm': 'binary'  // WebAssembly support for PGlite
      }
    },
    exclude: ['@electric-sql/pglite']  // Don't pre-bundle PGlite (WASM compatibility)
  },

  // CSS
  css: {
    postcss: './postcss.config.js'
  }
});

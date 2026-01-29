import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
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

// Post-build plugin: копирует файлы из .vite-build/ в финальные локации
function postBuildCopy() {
  return {
    name: 'post-build-copy-single',
    async writeBundle() {
      const { readFileSync, writeFileSync, existsSync, readdirSync, statSync, cpSync } = require('fs');
      const { basename, join } = require('path');

      try {
        const src = `.vite-build/${entryName}.js`;
        const srcMap = `.vite-build/${entryName}.js.map`;
        const srcGz = `.vite-build/${entryName}.js.gz`;
        const srcAssets = '.vite-build/assets';
        const dest = entryOutput;
        const destMap = `${dest}.map`;
        const destGz = `${dest}.gz`;
        const destAssets = join(dirname(dest), 'assets');

        // Проверить что source файл существует (Vite должен был его создать)
        if (!existsSync(src)) {
          throw new Error(`Source file not found: ${src}. Vite may have failed to write the bundle.`);
        }

        // Создать родительскую директорию если не существует
        mkdirSync(dirname(dest), { recursive: true });

        // Копировать JS файл и обновить sourceMappingURL
        let content = readFileSync(src, 'utf-8');

        // Обновить ссылку на sourcemap если она есть
        if (content.includes('sourceMappingURL')) {
          const destBasename = basename(dest);
          content = content.replace(
            /\/\/# sourceMappingURL=.*/,
            `//# sourceMappingURL=${destBasename}.map`
          );
        }

        writeFileSync(dest, content, 'utf-8');

        // Копировать sourcemap если существует
        if (existsSync(srcMap)) {
          copyFileSync(srcMap, destMap);
        }

        // Копировать gzip файл если существует (создается compression plugin)
        if (existsSync(srcGz)) {
          copyFileSync(srcGz, destGz);
        }

        // Копировать assets директорию для ES module chunks (PGlite lazy loading)
        if (existsSync(srcAssets) && statSync(srcAssets).isDirectory()) {
          mkdirSync(destAssets, { recursive: true });

          // Копировать все файлы из assets/
          cpSync(srcAssets, destAssets, { recursive: true });
        }

        // Silent copy - только ошибки логируются
      } catch (err) {
        throw new Error(`Failed to copy ${entryName}.js to ${entryOutput}: ${err.message}`);
      }
    }
  };
}

// Build info logged by build-all.js, no need to duplicate here

export default defineConfig({
  build: {
    // Безопасная временная директория для сборки (устраняет Vite warning)
    outDir: '.vite-build',
    emptyOutDir: true, // Очищать перед каждой сборкой
    minify: production ? 'esbuild' : false,
    sourcemap: !production,
    target: 'es2020',

    rollupOptions: {
      input: {
        [entryName]: resolve(__dirname, entryInput)
      },

      // External dependencies (modules that should NOT be bundled)
      // PGlite is built separately and loaded via <script> tag as window.PGlite
      external: entryName !== 'pglite' ? ['@db/pglite'] : [],

      output: {
        // All modules use IIFE format for synchronous window global creation
        // PGlite uses dynamic import() inside IIFE for lazy loading
        format: 'iife',
        name: globalName,
        entryFileNames: '[name].js', // [name] = entryName из input object key
        generatedCode: {
          constBindings: true
        },
        // Map external modules to global variables (only for IIFE modules)
        // IMPORTANT: Use window.PGlite because PGlite global variable doesn't exist
        // (only window.PGlite Proxy created in index.iife.ts:110)
        globals: {
          '@db/pglite': 'window.PGlite'
        }
        // Note: manualChunks not supported for IIFE format
        // PGlite uses dynamic import() for lazy loading instead
      }
    }
  },

  plugins: [
    // Service Worker plugin только для sw.js
    isServiceWorker && swCacheVersionPlugin(),

    // Gzip compression (MUST run BEFORE postBuildCopy to create .gz files)
    production && compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
      deleteOriginFile: false
    }),

    // Post-build file copying (.vite-build/ → final location)
    // MUST run AFTER compression to copy .gz files
    postBuildCopy(),

    // Bundle analyzer для анализа размера
    production && (entryName === 'budgetShared' || entryName === 'components' || entryName === 'dashboard') && visualizer({
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
      '@components': resolve(__dirname, 'frontend/web/static/js/modules/uiComponents'),
      '@db': resolve(__dirname, 'frontend/shared/db')
    }
  },

  // CSS
  css: {
    postcss: './postcss.config.js'
  }
});

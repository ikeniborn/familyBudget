import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import { visualizer } from 'rollup-plugin-visualizer';

const production = process.env.NODE_ENV === 'production';

/**
 * Rollup configuration for Family Budget frontend modules
 *
 * Output format: IIFE (browser-compatible, no module system required)
 * Minification: Terser (production only)
 * Source maps: Development only (security: disabled in production)
 *
 * Phase 2: ES Modules Migration
 * - Replaces bash build-bundle.sh with modern bundler
 * - Enables tree-shaking and dependency analysis
 * - Supports TypeScript compilation out of the box
 */

export default [
  // budgetShared.js bundle (shared utilities)
  {
    input: 'frontend/shared/static/js/budgetShared.ts',
    output: {
      file: 'frontend/shared/static/js/budgetShared.bundle.js',
      format: 'iife',
      name: 'BudgetShared',
      sourcemap: !production,
      generatedCode: {
        constBindings: true // Better optimization
      }
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: !production,
        inlineSources: !production,
        declaration: false, // No .d.ts files needed for browser bundle
        declarationMap: false
      }),
      resolve({
        browser: true, // Browser-specific resolution
        preferBuiltins: false // Don't use Node.js built-ins
      }),
      commonjs(),
      production && terser({
        compress: {
          passes: 2,
          drop_console: false, // Keep console for debugging
          drop_debugger: true,
          pure_funcs: ['console.debug'] // Remove debug logs only
        },
        mangle: {
          properties: false // Don't mangle property names (safer)
        },
        format: {
          comments: false
        }
      }),
      production && visualizer({
        filename: 'bundle-stats-shared.html',
        gzipSize: true,
        brotliSize: true
      })
    ].filter(Boolean)
  },

  // Main web application bundle (Phase 2.2+)
  {
    input: 'frontend/web/static/js/index.ts',
    output: {
      file: 'frontend/web/static/js/dist/bundle.js',
      format: 'iife',
      name: 'BudgetApp',
      sourcemap: !production,
      generatedCode: {
        constBindings: true
      }
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: !production,
        inlineSources: !production,
        declaration: false
      }),
      resolve({ browser: true }),
      commonjs(),
      production && terser({
        compress: { passes: 2, drop_console: false },
        mangle: { properties: false }
      })
    ].filter(Boolean)
  },

  // webapp (Telegram Mini App) bundle (Phase 2.5+)
  {
    input: 'frontend/webapp/static/js/index.ts',
    output: {
      file: 'frontend/webapp/static/js/dist/webapp.bundle.js',
      format: 'iife',
      name: 'WebApp',
      sourcemap: !production,
      generatedCode: {
        constBindings: true
      }
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: !production,
        inlineSources: !production,
        declaration: false
      }),
      resolve({ browser: true }),
      commonjs(),
      production && terser({
        compress: { passes: 2, drop_console: false },
        mangle: { properties: false }
      })
    ].filter(Boolean)
  }
];

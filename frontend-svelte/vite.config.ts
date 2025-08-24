import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    sveltekit(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Family Budget - Семейный Бюджет',
        short_name: 'FamilyBudget',
        description: 'Управление семейным бюджетом с планированием и контролем расходов',
        theme_color: '#1e293b',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheKeyWillBeUsed: async ({request}) => {
                return `${request.url}?${new Date().getDate()}`; // Daily cache busting
              }
            }
          },
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'local-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 // 1 hour
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          },
          {
            urlPattern: /\.(?:woff|woff2|eot|ttf|otf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'),
      $components: path.resolve('./src/lib/components'),
      $stores: path.resolve('./src/lib/stores'),
      $services: path.resolve('./src/lib/services'),
      $types: path.resolve('./src/lib/types'),
      $utils: path.resolve('./src/lib/utils')
    }
  },
  build: {
    rollupOptions: {
      output: {
        // Manual chunking strategy for better caching
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            // Chart.js and related packages
            if (id.includes('chart.js') || id.includes('svelte-chartjs')) {
              return 'charts';
            }
            // Table and data related
            if (id.includes('@tanstack/svelte-table') || id.includes('xlsx')) {
              return 'data-processing';
            }
            // Form and validation
            if (id.includes('yup') || id.includes('zod') || id.includes('svelte-forms-lib')) {
              return 'forms';
            }
            // Date utilities
            if (id.includes('date-fns')) {
              return 'date-utils';
            }
            // Core framework
            if (id.includes('svelte') || id.includes('@sveltejs')) {
              return 'svelte-framework';
            }
            // Other vendors
            return 'vendor';
          }
          
          // App chunks by feature
          if (id.includes('src/lib/components/charts')) {
            return 'charts-components';
          }
          if (id.includes('src/lib/components/reports')) {
            return 'reports-components';
          }
          if (id.includes('src/lib/components/products')) {
            return 'products-components';
          }
          if (id.includes('src/lib/services')) {
            return 'services';
          }
          if (id.includes('src/lib/utils')) {
            return 'utils';
          }
        }
      }
    },
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
        drop_debugger: true,
        pure_funcs: ['console.debug', 'console.trace']
      },
      mangle: {
        properties: false // Don't mangle properties to avoid breaking Svelte
      }
    },
    // Enable source maps for production debugging
    sourcemap: true,
    // Warn about large chunks
    chunkSizeWarningLimit: 500
  },
  server: {
    port: parseInt(process.env.PORT || '5173'),
    host: true,
    strictPort: false,
    hmr: {
      port: parseInt(process.env.HMR_PORT || '5173'),
      host: 'localhost',
      overlay: false
    },
    fs: {
      // Запретить доступ к тестовым файлам
      deny: ['**/*.test.ts', '**/*.test.js', '**/*.spec.ts', '**/*.spec.js', '**/__tests__/**']
    },
    proxy: {
      '/api': {
        target: 'http://frontend-api-dev:4000',
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying
        rewrite: (path) => path // Keep the /api prefix
      }
    }
  }
});
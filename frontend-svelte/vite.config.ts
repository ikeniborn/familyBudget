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
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly', // Не кешировать API запросы для auth
            options: {
              backgroundSync: {
                name: 'api-queue',
                options: {
                  maxRetentionTime: 60 * 5 // Retry for 5 minutes
                }
              },
              fetchOptions: {
                credentials: 'include'
              },
              matchOptions: {
                ignoreSearch: false
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
            if (id.includes('yup') || id.includes('zod')) {
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
        target: 'http://budget-backend:4000',
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 30000,
        proxyTimeout: 30000,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log(`[PROXY] ${req.method} ${req.url} -> ${options.target}${req.url}`);
            // Forward cookies from the original request
            const cookies = req.headers.cookie;
            if (cookies) {
              proxyReq.setHeader('Cookie', cookies);
            }
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log(`[PROXY] ${req.method} ${req.url} <- ${proxyRes.statusCode}`);
          });
          proxy.on('error', (err, req, res) => {
            console.error(`[PROXY ERROR] ${req.method} ${req.url}:`, err.message);
            // Don't convert proxy errors to 500, let the original status code through
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                error: 'Bad Gateway', 
                message: 'Unable to connect to backend service',
                detail: err.message,
                target: options.target 
              }));
            }
          });
        }
      }
    }
  }
});
/**
 * Service Worker для Family Budget PWA
 * Стратегия кеширования:
 * - Статика (CSS/JS/fonts): Cache First
 * - API endpoints: Network First
 * - HTML страницы: Network First
 */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `budget-${CACHE_VERSION}`;

// Критическая статика для кеширования при установке
const STATIC_CACHE = [
  '/',
  '/static/css/vendor/tailwind-daisyui.min.css',
  '/static/js/vendor/htmx.min.js',
  '/static/js/vendor/htmx-ext-json-enc.min.js',
  '/static/js/vendor/choices.min.js',
  '/shared/static/js/budgetShared.min.js',
  '/shared/static/js/categoryTree.min.js',
  '/shared/static/css/choices-tailwind.css',
  '/web/static/css/custom.css'
];

// Install event - кешируем критическую статику
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static files');
        // Используем Promise.allSettled чтобы не сломаться если какой-то файл 404
        return Promise.allSettled(
          STATIC_CACHE.map(url =>
            cache.add(url).catch(err => {
              console.warn('[SW] Failed to cache:', url, err);
              return null;
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] Skip waiting');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Install failed:', err);
      })
  );
});

// Activate event - удаляем старые кеши
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', CACHE_VERSION);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('budget-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - стратегия кеширования
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Игнорируем non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Игнорируем external requests
  if (url.origin !== location.origin) {
    return;
  }

  // Игнорируем chrome-extension и other schemes
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Стратегия 1: API endpoints - Network First (всегда актуальные данные)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Кешируем только успешные GET API запросы
          if (response.ok && request.method === 'GET') {
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clonedResponse);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback на кеш если сеть недоступна
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                console.log('[SW] Serving API from cache (offline):', url.pathname);
                return cachedResponse;
              }
              // Если нет в кеше - возвращаем offline страницу или ошибку
              return new Response(
                JSON.stringify({ error: 'Offline', message: 'Нет подключения к интернету' }),
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
    return;
  }

  // Стратегия 2: HTML страницы - Network First (актуальный контент)
  if (url.pathname === '/' || url.pathname.match(/\.html$/) || !url.pathname.includes('.')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Кешируем HTML страницы для offline доступа
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          // Fallback на кеш если сеть недоступна
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                console.log('[SW] Serving HTML from cache (offline):', url.pathname);
                return cachedResponse;
              }
              // Если нет в кеше - показываем offline страницу
              return caches.match('/')
                .then(homeResponse => homeResponse || new Response(
                  '<h1>Offline</h1><p>Нет подключения к интернету</p>',
                  { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                ));
            });
        })
    );
    return;
  }

  // Стратегия 3: Статика (CSS/JS/fonts/images) - Cache First (быстрая загрузка)
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|woff2|woff|ttf|ico|gif|webp)$/)) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving from cache:', url.pathname);
            // Опционально: обновляем кеш в фоне (stale-while-revalidate)
            fetch(request).then((response) => {
              if (response.ok) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, response);
                });
              }
            }).catch(() => {
              // Игнорируем ошибки фонового обновления
            });
            return cachedResponse;
          }

          // Если нет в кеше - загружаем из сети и кешируем
          return fetch(request).then((response) => {
            if (response.ok) {
              const clonedResponse = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clonedResponse);
              });
            }
            return response;
          });
        })
    );
    return;
  }

  // Стратегия 4: Все остальное - Network First
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
  );
});

// Message handling (для ручного управления кешем и обновлений)
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data.action === 'clearCache') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      }).then(() => {
        console.log('[SW] All caches cleared');
        // Отправляем сообщение обратно клиенту
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ action: 'cacheCleared' });
          });
        });
      })
    );
  }
});

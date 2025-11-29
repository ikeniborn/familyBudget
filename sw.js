/**
 * Service Worker для Family Budget PWA
 * Стратегия кеширования:
 * - Статика с cache busting (CSS/JS): Cache First с ignoreSearch
 * - API endpoints: Network First
 * - HTML страницы: Network First
 *
 * ВАЖНО: CACHE_VERSION должна обновляться при каждом деплое!
 * Используйте git hash или timestamp для автоматической инвалидации кеша.
 */

// Debug mode (включить только для отладки)
const DEBUG = false;

// ВАЖНО: Обновляйте при каждом деплое! (можно использовать ${GIT_HASH} или ${TIMESTAMP})
const CACHE_VERSION = 'v20251129_1503';
const CACHE_NAME = `budget-${CACHE_VERSION}`;

// Критическая статика БЕЗ версий (для precaching в install event)
// ТОЛЬКО файлы которые НЕ используют cache busting
const STATIC_CACHE = [
  '/',
  '/manifest.json',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/static/icons/favicon.ico'
];

// Файлы с cache busting - кешируются RUNTIME (не в install event)
// Service Worker будет кешировать их при первом запросе

// Install event - кешируем критическую статику
self.addEventListener('install', (event) => {
  if (DEBUG) console.log('[SW] Installing version:', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        if (DEBUG) console.log('[SW] Caching static files');
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
        if (DEBUG) console.log('[SW] Skip waiting');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Install failed:', err);
      })
  );
});

// Activate event - удаляем старые кеши
self.addEventListener('activate', (event) => {
  if (DEBUG) console.log('[SW] Activating version:', CACHE_VERSION);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('budget-') && name !== CACHE_NAME)
            .map((name) => {
              if (DEBUG) console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        if (DEBUG) console.log('[SW] Claiming clients');
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
                if (DEBUG) console.log('[SW] Serving API from cache (offline):', url.pathname);
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
                if (DEBUG) console.log('[SW] Serving HTML from cache (offline):', url.pathname);
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
      // КРИТИЧНО: ignoreSearch: true для корректной работы с cache busting (?v=...)
      caches.match(request, { ignoreSearch: true })
        .then((cachedResponse) => {
          if (cachedResponse) {
            if (DEBUG) console.log('[SW] Serving from cache:', url.pathname);

            // Stale-while-revalidate: обновляем кеш в фоне если версия изменилась
            // Проверяем актуальность файла через network request
            fetch(request).then((response) => {
              if (response.ok) {
                // Сравниваем ETag или Last-Modified для определения изменений
                const cachedETag = cachedResponse.headers.get('etag');
                const newETag = response.headers.get('etag');

                // Обновляем кеш если версия изменилась
                if (!cachedETag || cachedETag !== newETag || url.search) {
                  caches.open(CACHE_NAME).then((cache) => {
                    if (DEBUG) console.log('[SW] Updating cache for:', url.pathname + url.search);
                    cache.put(request, response);
                  });
                }
              }
            }).catch(() => {
              // Игнорируем ошибки фонового обновления (offline mode)
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
  if (DEBUG) console.log('[SW] Message received:', event.data);

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
        if (DEBUG) console.log('[SW] All caches cleared');
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

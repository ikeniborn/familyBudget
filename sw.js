/**
 * Service Worker для Family Budget PWA
 *
 * Стратегия кеширования:
 * - Статика с cache busting (CSS/JS): Cache First с ignoreSearch
 * - API endpoints: Network First
 * - HTML страницы: Network First
 *
 * Версионирование (v10.0+):
 * - CACHE_VERSION: Автоматически обновляется при каждом деплое
 * - Формат: Semantic versioning X.Y.Z (e.g., 10.0.38) - matches VERSION file
 * - PLACEHOLDER заменяется в CI/CD через scripts/ci/cache_busting_ci.sh
 * - Изменение версии → браузер автоматически обнаруживает обновление SW
 * - Deployment: GitHub Actions → версия инжектится из VERSION file
 * - Legacy format v{YYYYMMDD_HHMM} также поддерживается для обратной совместимости
 */

// Debug mode (включить только для отладки)
const DEBUG = false;
let updateMode = false;

// Cache version - автоматически заменяется в CI/CD через cache busting
// Формат: X.Y.Z semantic versioning (совпадает с VERSION file)
// IMPORTANT: scripts/ci/cache_busting_ci.sh replaces PLACEHOLDER during build
// Legacy format v{YYYYMMDD_HHMM} также поддерживается
const CACHE_VERSION = 'PLACEHOLDER';
const CACHE_NAME = `budget-${CACHE_VERSION}`;

// Validation: warn if PLACEHOLDER wasn't replaced (build script error)
// Supported formats:
// - Semantic versioning: X.Y.Z (e.g., 10.0.38)
// - Legacy timestamp: v{YYYYMMDD_HHMM} (e.g., v20260121_0438)
// PLACEHOLDER (11 chars) is invalid
const isSemanticVersion = /^\d+\.\d+\.\d+$/.test(CACHE_VERSION);
const isLegacyVersion = /^v\d{8}_\d{4}$/.test(CACHE_VERSION);

if (!isSemanticVersion && !isLegacyVersion) {
  console.error('[SW] CRITICAL: Cache version not properly set - build script failed!');
  console.error('[SW] Service Worker will NOT work correctly');
  console.error('[SW] Expected format: X.Y.Z or v{YYYYMMDD_HHMM}, got:', CACHE_VERSION);
}

// Критическая статика БЕЗ версий (для precaching в install event)
// ТОЛЬКО файлы которые НЕ используют cache busting
// ВАЖНО: /facts, /plan и /lists НЕ включены - это защищённые страницы,
// они кэшируются при первом посещении (после авторизации с credentials)
const STATIC_CACHE = [
  '/',
  '/manifest.json',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/static/icons/favicon.ico',
  // iOS Splash screens intentionally removed - files not generated in build pipeline
  // To re-enable, add splash screen generation to CI/CD and uncomment:
];

// Страницы доступные в offline режиме (только эти страницы работают без сети)
const OFFLINE_PAGES = ['/', '/lists'];

// Критические ресурсы для offline страниц (CSS/JS без версий - ignoreSearch найдёт их)
// ВАЖНО: Файлы кэшируются БЕЗ query string, но ignoreSearch: true позволяет найти их
// при запросе с cache busting (?v=...). Добавляйте только файлы, уникальные для страницы.
// Общие файлы (vendor, shared) уже кэшируются при посещении главной страницы.
const OFFLINE_PAGE_ASSETS = [
  // === Страница /lists ===
  // CSS
  '/static/css/lists.min.css',
  // JS - offline support
  '/static/js/offline/offlineManager.min.js',
  // JS - lists functionality (единый бандл с v7.0.1+)
  '/static/js/lists.min.js',
  // JS - WebSocket client
  '/static/js/budget/budgetWSClient.min.js',
  // JS - shared (used by lists)
  '/shared/static/js/choicesProductGroupTree.min.js'
];

// Install event - кешируем критическую статику и ресурсы offline страниц
self.addEventListener('install', (event) => {
  console.log('[SW] 📦 Installing Service Worker version:', CACHE_VERSION);

  event.waitUntil(
    (async () => {
      // Check if we're in post-update mode (skip caching)
      // Use Cache API flag instead of MessageChannel (more reliable after unregister)
      // NOTE: caches.match() searches cached *responses* by URL, not named cache existence.
      // Use caches.keys() to check for the presence of a named cache.
      try {
        const isPostUpdate = (await caches.keys()).includes('__sw_update_mode__');
        if (isPostUpdate) {
          console.log('[SW] ⏭️ Skipping cache creation (post-update mode)');

          // Clean up flag cache
          await caches.delete('__sw_update_mode__');

          // Skip waiting and activate immediately
          await self.skipWaiting();
          return; // Exit early, no caching
        }
      } catch (e) {
        console.warn('[SW] Error checking update mode flag:', e.message);
        // Continue with normal caching on error
      }

      // Normal caching flow...
      const cache = await caches.open(CACHE_NAME);

      if (DEBUG) console.log('[SW] Caching static files');
      // Используем Promise.allSettled чтобы не сломаться если какой-то файл 404
      await Promise.allSettled(
        STATIC_CACHE.map(url =>
          cache.add(url).catch(err => {
            // Подавляем ошибки кэширования - файл закэшируется позже при запросе
            if (DEBUG) console.warn('[SW] Failed to cache:', url, err.message);
            return null;
          })
        )
      );

      // Кэшируем ресурсы для offline страниц (CSS/JS)
      // ВАЖНО: Кэшируем БЕЗ credentials т.к. это публичная статика
      if (DEBUG) console.log('[SW] Caching offline page assets');
      await Promise.allSettled(
        OFFLINE_PAGE_ASSETS.map(url =>
          fetch(url, { credentials: 'omit' })
            .then(response => {
              if (response.ok) {
                return cache.put(url, response);
              }
              if (DEBUG) console.warn('[SW] Asset not found:', url);
              return null;
            })
            .catch(err => {
              // Подавляем ошибки - файл может закэшироваться позже
              if (DEBUG) console.warn('[SW] Failed to cache asset:', url, err.message);
              return null;
            })
        )
      );

      console.log('[SW] ⚡ Calling skipWaiting() for immediate activation');
      await self.skipWaiting();
      console.log('[SW] ✓ skipWaiting() completed');
    })()
  );
});

// Activate event - мигрируем критичные страницы и удаляем старые кеши
self.addEventListener('activate', (event) => {
  console.log('[SW] 🚀 Activating Service Worker version:', CACHE_VERSION);

  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter((name) => name.startsWith('budget-') && name !== CACHE_NAME);

      // MIGRATION DISABLED (2026-01-13):
      // Do NOT migrate HTML pages - they use Network First strategy
      // and should always fetch fresh content from server.
      // Old caches will be deleted below, forcing SW to re-fetch HTML.
      //
      // Background: Migration was copying stale HTML from old cache to new cache,
      // causing users to see outdated templates even after SW update.
      // HTML pages have Network First strategy and will be re-cached on next visit.
      if (oldCaches.length > 0) {
        console.log('[SW] 🗑️ Skipping migration - will delete old caches and re-fetch HTML');
      }

      // Now safe to delete old caches
      const cacheDeletes = oldCaches.map((name) => {
        console.log('[SW] 🗑️ Deleting old cache:', name);
        return caches.delete(name);
      });

      await Promise.all(cacheDeletes);
      console.log(`[SW] ✓ Deleted ${cacheDeletes.length} old cache(s)`);

      // CRITICAL: Take control of all clients immediately
      console.log('[SW] 👑 Calling clients.claim() to take control');
      await self.clients.claim();

      // Notify all clients about update with VERSION
      const clients = await self.clients.matchAll({ type: 'window' });
      console.log(`[SW] 📢 Notifying ${clients.length} client(s) about update`);

      clients.forEach(client => {
        client.postMessage({
          type: 'SW_UPDATED',
          version: CACHE_VERSION,
          timestamp: new Date().toISOString()
        });
      });

      console.log('[SW] ✓ Activation complete');
    })()
  );
});

// === Periodic Sync for Data Pruning (task-010) ===
//
// IMPORTANT: Periodic Background Sync API is NOT supported in iOS Safari 16+
// - Only works in Chrome/Edge desktop and Android
// - iOS fallback: Client code should use Page Visibility API or manual timer
// - Registration in client: if ('periodicSync' in registration) { ... }
// - iOS behavior: Event listener registered but never fires
//
// See: https://caniuse.com/periodic-background-sync
// Chrome support: 80+, Safari: No support

const PRUNING_TAG = 'weekly-pruning';
const PRUNING_MAX_RETRIES = 3;
const PRUNING_RETRY_DELAY = 5000; // 5 seconds

// Periodic sync event handler (Chrome/Edge only - iOS Safari will never trigger)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === PRUNING_TAG) {
    event.waitUntil(performPruning());
  }
});

/**
 * Perform automatic data pruning with retry logic
 * Only executes if enableAutoPruning flag is enabled
 */
async function performPruning() {
  let lastError = null;

  for (let attempt = 1; attempt <= PRUNING_MAX_RETRIES; attempt++) {
    try {
      console.log(`[PRUNING_SW] Attempt ${attempt}/${PRUNING_MAX_RETRIES}`);

      // Check if auto-pruning enabled (read from localStorage via clients API)
      const clients = await self.clients.matchAll({ type: 'window' });
      if (clients.length === 0) {
        console.log('[PRUNING_SW] No active clients, skipping');
        return;
      }

      // Get flag from first client's localStorage via message
      const client = clients[0];
      const response = await sendMessageToClient(client, {
        type: 'GET_PRUNING_FLAG'
      });

      if (!response || !response.enableAutoPruning) {
        console.log('[PRUNING_SW] Auto-pruning disabled, skipping');
        return;
      }

      // Send message to client to execute pruning
      const pruneResponse = await sendMessageToClient(client, {
        type: 'EXECUTE_PRUNING'
      });

      if (pruneResponse && pruneResponse.success) {
        const result = pruneResponse.result;

        console.log('[PRUNING_SW] Completed successfully', result);

        // Show notification if significant cleanup
        if (result.deletedCount > 0) {
          await self.registration.showNotification('Data Cleanup', {
            body: `Removed ${result.deletedCount} old transactions (${(result.dbSizeBefore - result.dbSizeAfter).toFixed(0)} KB saved)`,
            icon: '/static/icons/icon-192.png',
            badge: '/static/icons/icon-192.png'
          });
        }

        // Success - exit retry loop
        return;
      } else {
        throw new Error(pruneResponse?.error || 'Unknown error');
      }
    } catch (error) {
      lastError = error;
      console.error(`[PRUNING_SW] Attempt ${attempt} failed:`, error);

      // If not last attempt, wait before retrying (exponential backoff)
      if (attempt < PRUNING_MAX_RETRIES) {
        const delay = PRUNING_RETRY_DELAY * Math.pow(2, attempt - 1); // 5s, 10s, 20s
        console.log(`[PRUNING_SW] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted - show error notification
  console.error('[PRUNING_SW] All retries exhausted', lastError);
  await self.registration.showNotification('Data Cleanup Error', {
    body: 'Failed to clean up old data after 3 attempts. Please try manual cleanup in Settings.',
    icon: '/static/icons/icon-192.png',
    badge: '/static/icons/icon-192.png',
    tag: 'pruning-error'
  });
}

/**
 * Send message to client and wait for response with timeout
 * @param {Client} client - Service Worker client
 * @param {object} message - Message to send
 * @param {number} timeout - Timeout in milliseconds (default: 10s)
 * @returns {Promise} Response from client
 */
async function sendMessageToClient(client, message, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const messageChannel = new MessageChannel();

    // Setup timeout
    const timeoutId = setTimeout(() => {
      messageChannel.port1.close();
      reject(new Error(`Message timeout after ${timeout}ms for type: ${message.type}`));
    }, timeout);

    messageChannel.port1.onmessage = (event) => {
      clearTimeout(timeoutId);
      messageChannel.port1.close();
      resolve(event.data);
    };

    try {
      client.postMessage(message, [messageChannel.port2]);
    } catch (error) {
      clearTimeout(timeoutId);
      messageChannel.port1.close();
      reject(error);
    }
  });
}

// Fetch event - стратегия кеширования
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Update mode: stop caching, let all requests pass through to network
  if (updateMode) return;

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

  // Skip health endpoints - используются NetworkDetector для определения offline статуса
  // NetworkDetector ожидает реальные network errors, а не кешированные/HTML ответы
  if (url.pathname === '/health' ||
      url.pathname === '/ping' ||
      url.pathname === '/ready' ||
      url.pathname.startsWith('/health/')) {
    return; // Пропустить без обработки - fetch пойдет напрямую к серверу
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
          // Кешируем только OFFLINE_PAGES для offline доступа
          if (OFFLINE_PAGES.includes(url.pathname) && response.ok) {
            if (DEBUG) console.log('[SW] Caching HTML page for offline:', url.pathname);
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              // Cache by URL pathname (not full request) to match HTMX requests
              cache.put(url.pathname, clonedResponse);
              if (DEBUG) console.log('[SW] ✓ Cached:', url.pathname);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback на кеш если сеть недоступна
          // Только OFFLINE_PAGES доступны в offline режиме
          if (!OFFLINE_PAGES.includes(url.pathname)) {
            if (DEBUG) console.log('[SW] Page not available offline, redirecting to home:', url.pathname);
            // Редирект на главную страницу для недоступных страниц
            // Используем meta refresh т.к. SW не может сделать HTTP 302
            return new Response(
              `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/"><title>Redirect</title></head></html>`,
              {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              }
            );
          }

          // Match by URL pathname, ignore headers (HTMX adds HX-Request header)
          return caches.match(url.pathname, { ignoreVary: true })
            .then(cachedResponse => {
              if (cachedResponse) {
                if (DEBUG) console.log('[SW] Serving HTML from cache (offline):', url.pathname);
                return cachedResponse;
              }
              // Страница в OFFLINE_PAGES, но не закеширована
              if (DEBUG) console.log('[SW] Page in OFFLINE_PAGES but not cached:', url.pathname);
              return new Response(
                `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head><body><h1>📡 Страница недоступна</h1><p>Откройте ${url.pathname} при наличии интернета.</p><a href="/">На главную</a></body></html>`,
                {
                  status: 200,
                  headers: { 'Content-Type': 'text/html; charset=utf-8' }
                }
              );
            });
        })
    );
    return;
  }

  // Стратегия 3: Статика (CSS/JS/JSON/fonts/images) - Cache First (быстрая загрузка)
  if (url.pathname.match(/\.(css|js|json|png|jpg|jpeg|svg|woff2|woff|ttf|ico|gif|webp)$/)) {
    event.respondWith(
      // КРИТИЧНО: ignoreSearch: true для корректной работы с cache busting (?v=...)
      caches.match(request, { ignoreSearch: true })
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Version mismatch check: if ?v= param differs between cached and requested URL,
            // bypass cache to prevent serving stale bundles during SW transition period.
            // Files without ?v= (e.g. icons, fonts) are served from cache as usual.
            const cachedVersion = new URL(cachedResponse.url).searchParams.get('v');
            const requestVersion = url.searchParams.get('v');
            if (cachedVersion && requestVersion && cachedVersion !== requestVersion) {
              if (DEBUG) console.log('[SW] Version mismatch, fetching fresh:', url.pathname, cachedVersion, '->', requestVersion);
              return fetch(request).then((response) => {
                if (response.ok) {
                  const clonedResponse = response.clone();
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, clonedResponse);
                  });
                }
                return response;
              });
            }
            if (DEBUG) console.log('[SW] Serving from cache:', url.pathname);
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

  if (event.data.action === 'enterUpdateMode') {
    updateMode = true;
    console.log('[SW] Entered update mode - fetch passthrough enabled');
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ type: 'UPDATE_MODE_ACK' });
    }
  }

  // Запрос текущей версии SW
  if (event.data.action === 'getVersion') {
    console.log('[SW] 📩 Version request received, responding with:', CACHE_VERSION);
    event.ports[0].postMessage({
      type: 'VERSION_RESPONSE',
      version: CACHE_VERSION
    });
  }

  // Layer 2: Page wake detection (для iOS/mobile recovery)
  // Уведомляет все вкладки что страница вернулась из sleep режима
  if (event.data.action === 'pageWake') {
    if (DEBUG) console.log('[SW] Page wake detected, notifying all clients');

    self.clients.matchAll({ type: 'window' }).then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'PAGE_WAKE',
          timestamp: Date.now(),
          source: 'sw'
        });
      });
    });
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

// =============================================================================
// OFFLINE MODE SUPPORT (v2.0.0)
// =============================================================================

/**
 * Offline Support
 *
 * Offline data management migrated to Dexie.js (v11.3+)
 * Legacy IndexedDB and Background Sync removed
 * Sync handled via DataLayer + fullFactSync()
 */


/**
 * Push Notification Event Handler
 * Показывает push-уведомления от сервера
 * Support: Chrome, Edge, Safari 16.4+, Яндекс.Браузер
 */
self.addEventListener('push', (event) => {
  if (DEBUG) console.log('[SW] Push notification received');

  const data = event.data ? event.data.json() : {};

  const title = data.title || 'Family Budget';
  const options = {
    body: data.body || 'Новое уведомление',
    icon: '/static/icons/icon-192.png',
    badge: '/static/icons/icon-192.png',
    tag: data.tag || 'notification',
    requireInteraction: data.requireInteraction || false,
    data: data
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/**
 * Notification Click Event Handler
 * Открывает приложение при клике на уведомление
 */
self.addEventListener('notificationclick', (event) => {
  if (DEBUG) console.log('[SW] Notification clicked:', event.notification.tag);

  event.notification.close();

  // Determine URL based on notification type
  let url = '/';
  if (event.notification.data) {
    const data = event.notification.data;

    if (data.type === 'sync_completed') {
      url = '/facts';  // Open facts page
    } else if (data.url) {
      url = data.url;
    }
  }

  // Open or focus app window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then(client => client.navigate(url));
          }
        }

        // No window open, open new one
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

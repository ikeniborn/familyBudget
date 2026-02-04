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
  // iOS Splash - ALL 10 images for comprehensive device coverage
  '/static/icons/splash/splash-750x1334.png',   // iPhone SE/7/8
  '/static/icons/splash/splash-828x1792.png',   // iPhone XR/11
  '/static/icons/splash/splash-1080x2340.png',  // Android (1080x2340)
  '/static/icons/splash/splash-1125x2436.png',  // iPhone X/XS/11 Pro
  '/static/icons/splash/splash-1170x2532.png',  // iPhone 12/13/14
  '/static/icons/splash/splash-1179x2556.png',  // iPhone 14/15 Pro
  '/static/icons/splash/splash-1242x2208.png',  // iPhone 6+/7+/8+
  '/static/icons/splash/splash-1242x2688.png',  // iPhone XS Max/11 Pro Max
  '/static/icons/splash/splash-1284x2778.png',  // iPhone 14/15 Pro Max
  '/static/icons/splash/splash-1290x2796.png'   // iPhone 14/15 Pro Max
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
  '/static/js/offline/offlineShoppingManager.min.js',
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
      try {
        const updateModeCache = await caches.match('__sw_update_mode__');
        if (updateModeCache) {
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
 * IndexedDB Helper Functions
 * Используются для работы с offline data из Service Worker
 *
 * ВАЖНО: DB_VERSION должна совпадать с версией в idb.js!
 * Service Worker НЕ создаёт схему (нет onupgradeneeded),
 * он только читает/пишет в существующие stores.
 * Схема управляется в frontend/web/static/js/offline/idb.js
 */
const DB_NAME = 'FamilyBudgetDB';
const DB_VERSION = 5;  // ✅ Синхронизировано с idb.js (v5 - Added offline_recurring_plans)

async function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getSyncQueue(status = 'pending') {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sync_queue'], 'readonly');
    const store = transaction.objectStore('sync_queue');
    const index = store.index('status');
    const request = index.getAll(status);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function updateSyncQueueItem(id, updates) {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sync_queue'], 'readwrite');
    const store = transaction.objectStore('sync_queue');
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (!item) {
        reject(new Error(`Sync queue item ${id} not found`));
        return;
      }

      const updated = { ...item, ...updates };
      const putRequest = store.put(updated);

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Clear completed items from sync_queue
 * Called after successful synchronization
 */
async function clearCompletedSyncQueue() {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sync_queue'], 'readwrite');
    const store = transaction.objectStore('sync_queue');
    const index = store.index('status');
    const request = index.getAll('completed');

    request.onsuccess = () => {
      const completed = request.result || [];
      completed.forEach(item => store.delete(item.id));
      transaction.oncomplete = () => {
        if (DEBUG && completed.length > 0) {
          console.log(`[SW] Cleared ${completed.length} completed items from sync_queue`);
        }
        resolve(completed.length);
      };
      transaction.onerror = () => reject(transaction.error);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete record from offline store after successful sync
 * @param {string} entity - Entity type: 'fact', 'plan', 'transfer', 'recurring'
 * @param {string|number} tempId - Temporary ID of the offline record
 */
async function deleteFromOfflineStore(entity, tempId) {
  const db = await openIndexedDB();
  const storeName = entity === 'transfer' ? 'offline_transfers' :
                    entity === 'plan' ? 'offline_plans' :
                    entity === 'recurring' ? 'offline_recurring_plans' : 'offline_facts';

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(tempId);

    request.onsuccess = () => {
      if (DEBUG) console.log(`[SW] Deleted ${entity} ${tempId} from ${storeName}`);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get record from offline store (for retrieving contentHash and syncHash)
 * @param {string} entity - Entity type: 'fact', 'plan', 'transfer', 'recurring'
 * @param {string|number} tempId - Temporary ID of the offline record
 * @returns {Promise<Object|null>} Offline record or null if not found
 */
async function getOfflineRecord(entity, tempId) {
  const db = await openIndexedDB();
  const storeName = entity === 'transfer' ? 'offline_transfers' :
                    entity === 'plan' ? 'offline_plans' :
                    entity === 'recurring' ? 'offline_recurring_plans' : 'offline_facts';

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(tempId);

    request.onsuccess = () => {
      if (DEBUG && request.result) {
        console.log(`[SW] Found offline record for ${entity} ${tempId}:`, request.result);
      }
      resolve(request.result || null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Background Sync Event Handler
 * Синхронизирует offline данные при восстановлении сети
 * Support: Chrome, Edge, Яндекс.Браузер (Safari не поддерживает)
 */
self.addEventListener('sync', (event) => {
  if (DEBUG) console.log('[SW] Background Sync triggered:', event.tag);

  if (event.tag === 'sync-budget-data') {
    event.waitUntil(syncBudgetData());
  }
});

async function syncBudgetData() {
  const results = { synced: 0, failed: 0 };

  try {
    const queue = await getSyncQueue('pending');
    if (queue.length === 0) return results;

    for (const item of queue) {
      try {
        const syncResult = await syncItem(item);
        // Only count as synced if item was actually processed (not skipped)
        if (syncResult !== null) {
          results.synced++;
        }
      } catch (error) {
        // Silently handle "item not found" errors (race condition with main thread)
        if (error.message && error.message.includes('not found')) {
          continue;
        }

        const retryCount = (item.retryCount || 0) + 1;
        try {
          if (retryCount >= 5) {
            await updateSyncQueueItem(item.id, { status: 'failed', error: error.message, retryCount });
            results.failed++;
          } else {
            await updateSyncQueueItem(item.id, { status: 'pending', error: error.message, retryCount });
          }
        } catch (e) {
          // Item already removed by main thread - ignore
        }
      }
    }

    // Notify all clients about sync completion
    let hasActiveClients = false;
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      hasActiveClients = clients.length > 0;
      clients.forEach(client => {
        client.postMessage({
          action: 'syncComplete',
          synced: results.synced,
          failed: results.failed
        });
      });
    } catch (e) {
      // Ignore postMessage errors
    }

    // Show push notification ONLY if no active clients (user not using app)
    // If user is active, they already receive toast from handleSyncComplete()
    // This prevents duplicate notifications (push + toast)
    if (results.synced > 0 && !hasActiveClients) {
      try {
        await self.registration.showNotification('Синхронизация завершена', {
          body: `Синхронизировано записей: ${results.synced}`,
          icon: '/static/icons/icon-192.png',
          badge: '/static/icons/icon-192.png',
          tag: 'sync-completed',
          data: { type: 'sync_completed', count: results.synced }
        });
      } catch (e) {
        // Notification permission denied - ignore
      }
    }

    // Clear completed items from sync_queue
    try {
      await clearCompletedSyncQueue();
    } catch (e) {
      // Ignore cleanup errors
      if (DEBUG) console.error('[SW] Failed to clear completed sync queue:', e);
    }

    return results;
  } catch (error) {
    // Only log real errors, not race condition errors
    if (!error.message || !error.message.includes('not found')) {
      console.error('[SW] Background sync failed:', error);
    }
    return results; // Return results instead of throwing
  }
}

async function syncItem(item) {
  // Update status (ignore errors - item may have been removed by main thread)
  try {
    await updateSyncQueueItem(item.id, { status: 'syncing' });
  } catch (e) {
    // Item already processed by main thread, skip
    return null;
  }

  let response;

  switch (item.operation) {
    case 'create':
      response = await syncCreate(item);
      break;
    case 'update':
      response = await syncUpdate(item);
      break;
    case 'delete':
      response = await syncDelete(item);
      break;
    default:
      throw new Error(`Unknown operation: ${item.operation}`);
  }

  // Mark as completed (ignore errors - item may have been removed)
  try {
    await updateSyncQueueItem(item.id, { status: 'completed' });
  } catch (e) {
    // Already processed
  }

  // Delete record from offline store after successful sync
  if (item.operation === 'create' && item.tempId) {
    try {
      await deleteFromOfflineStore(item.entity, item.tempId);
    } catch (e) {
      // Ignore - may already be deleted by main thread
      if (DEBUG) console.log('[SW] Failed to delete from offline store (may already be deleted):', e.message);
    }
  }

  return response;
}

function cleanEntityData(entity, data) {
  const cleaned = { ...data };
  delete cleaned.article_name;
  delete cleaned.financial_center_name;
  delete cleaned.cost_center_name;
  delete cleaned.plan_date;
  delete cleaned.fact_type;
  delete cleaned.notification_enabled;
  delete cleaned.reminder_datetime;

  if (entity === 'transfer') {
    delete cleaned.from_financial_center_name;
    delete cleaned.to_financial_center_name;
    delete cleaned.from_article_name;
    delete cleaned.to_article_name;
  }

  if (entity === 'recurring') {
    delete cleaned.frequency_label;
    delete cleaned.duration_label;
  }

  return cleaned;
}

async function handleSyncError(response) {
  let errorDetail = `HTTP ${response.status}`;
  try {
    const error = await response.json();
    errorDetail = error.detail || errorDetail;
  } catch (e) {
    errorDetail = response.statusText || errorDetail;
  }
  throw new Error(errorDetail);
}

async function syncCreate(item) {
  // Route to appropriate API endpoint based on entity type
  const endpoint = item.entity === 'fact' || item.entity === 'plan' ? '/api/v1/facts' :
                   item.entity === 'transfer' ? '/api/v1/transfers' :
                   item.entity === 'recurring' ? '/api/v1/recurring-plans' :
                   '/api/v1/facts';

  const cleanData = cleanEntityData(item.entity, item.data);

  // Mark as offline sync (for facts, plans, transfers - NOT recurring plans)
  // RecurringPlan model doesn't have is_offline_sync field
  if (item.entity !== 'recurring') {
    cleanData.is_offline_sync = true;
  }

  // Add content_hash and sync_hash for backend deduplication (prevents duplicate records)
  // These hashes were generated when the offline record was created and stored in IndexedDB
  // Note: Only for facts and plans, not for recurring plans or transfers
  if ((item.entity === 'fact' || item.entity === 'plan') && item.tempId) {
    try {
      const offlineRecord = await getOfflineRecord(item.entity, item.tempId);
      if (offlineRecord) {
        if (offlineRecord.contentHash) {
          cleanData.content_hash = offlineRecord.contentHash;
        }
        if (offlineRecord.syncHash) {
          cleanData.sync_hash = offlineRecord.syncHash;
        }
        if (DEBUG) console.log(`[SW] Added deduplication hashes for ${item.tempId}:`, {
          content_hash: cleanData.content_hash,
          sync_hash: cleanData.sync_hash
        });
      }
    } catch (e) {
      // Ignore - record may already be deleted by main thread
      if (DEBUG) console.log(`[SW] Could not get offline record for ${item.tempId}:`, e.message);
    }
  }

  if (DEBUG) console.log(`[SW] Syncing ${item.entity} to ${endpoint}:`, cleanData);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleanData),
    credentials: 'include'
  });

  if (!response.ok) await handleSyncError(response);

  return await response.json();
}

async function syncUpdate(item) {
  const id = item.data.id;
  // Plans use /api/v1/facts endpoint (same as facts, with record_type='plan')
  const endpoint = item.entity === 'fact' || item.entity === 'plan' ? `/api/v1/facts/${id}` :
                   item.entity === 'transfer' ? `/api/v1/transfers/${id}` :
                   `/api/v1/facts/${id}`;

  const cleanData = cleanEntityData(item.entity, item.data);

  if (DEBUG) console.log(`[SW] Updating ${item.entity} at ${endpoint}:`, cleanData);

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleanData),
    credentials: 'include'
  });

  if (!response.ok) await handleSyncError(response);

  return await response.json();
}

async function syncDelete(item) {
  const id = item.data.id;
  // Plans use /api/v1/facts endpoint (same as facts, with record_type='plan')
  const endpoint = item.entity === 'fact' || item.entity === 'plan' ? `/api/v1/facts/${id}` :
                   item.entity === 'transfer' ? `/api/v1/transfers/${id}` :
                   `/api/v1/facts/${id}`;

  const response = await fetch(endpoint, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (!response.ok) await handleSyncError(response);

  // DELETE returns 204 No Content, so no JSON body
  return { success: true };
}

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

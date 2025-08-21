// Service Worker for Family Budget PWA
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `family-budget-${CACHE_VERSION}`;
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE = `${CACHE_NAME}-dynamic`;
const API_CACHE = `${CACHE_NAME}-api`;

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/dashboard',
  '/budget',
  '/fact',
  '/reports',
  '/offline',
  '/manifest.json',
  '/favicon.svg'
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\/nomenclatures/,
  /\/api\/cost-centers/,
  /\/api\/financial-centers/,
  /\/api\/periods/,
  /\/api\/reports\/summary/
];

// Network-first patterns (real-time data)
const NETWORK_FIRST_PATTERNS = [
  /\/api\/registry/,
  /\/api\/auth/,
  /\/api\/reports\/(?!summary)/
];

// Stale-while-revalidate patterns
const SWR_PATTERNS = [
  /\/api\/products/,
  /\/api\/reports\/summary/
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${CACHE_VERSION}`);
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES);
      }),
      caches.open(API_CACHE).then((cache) => {
        console.log('[SW] API cache initialized');
        return cache;
      }),
      caches.open(DYNAMIC_CACHE).then((cache) => {
        console.log('[SW] Dynamic cache initialized');
        return cache;
      })
    ])
  );
  
  // Skip waiting and immediately activate
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${CACHE_VERSION}`);
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName.startsWith('family-budget-') && 
                     cacheName !== STATIC_CACHE &&
                     cacheName !== DYNAMIC_CACHE &&
                     cacheName !== API_CACHE;
            })
            .map((cacheName) => {
              console.log(`[SW] Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            })
        );
      }),
      
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Fetch event - handle requests with different strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) {
    return;
  }

  // Handle different types of requests
  if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isNavigationRequest(request)) {
    event.respondWith(handleNavigationRequest(request));
  } else if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
  } else {
    event.respondWith(handleDynamicRequest(request));
  }
});

// API request handler
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  const cacheKey = getCacheKey(request);
  
  // Network-first strategy for real-time data
  if (matchesPattern(url.pathname, NETWORK_FIRST_PATTERNS)) {
    return networkFirst(request, API_CACHE, cacheKey);
  }
  
  // Stale-while-revalidate for semi-static data
  if (matchesPattern(url.pathname, SWR_PATTERNS)) {
    return staleWhileRevalidate(request, API_CACHE, cacheKey);
  }
  
  // Cache-first for reference data
  if (matchesPattern(url.pathname, API_CACHE_PATTERNS)) {
    return cacheFirst(request, API_CACHE, cacheKey);
  }
  
  // Default: Network-first with fallback
  return networkFirst(request, API_CACHE, cacheKey);
}

// Navigation request handler
async function handleNavigationRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);
    
    // Cache successful navigation responses
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to offline page
    const offlineResponse = await caches.match('/offline');
    if (offlineResponse) {
      return offlineResponse;
    }
    
    // Last resort: basic offline response
    return new Response(
      '<html><body><h1>Offline</h1><p>Please check your connection</p></body></html>',
      { 
        headers: { 'Content-Type': 'text/html' },
        status: 503,
        statusText: 'Service Unavailable'
      }
    );
  }
}

// Static asset handler
async function handleStaticAsset(request) {
  return cacheFirst(request, STATIC_CACHE);
}

// Dynamic request handler
async function handleDynamicRequest(request) {
  return staleWhileRevalidate(request, DYNAMIC_CACHE);
}

// Caching strategies
async function networkFirst(request, cacheName, cacheKey = null) {
  const cache = await caches.open(cacheName);
  const key = cacheKey || request;
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      cache.put(key, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log(`[SW] Network failed for ${request.url}, trying cache`);
    const cachedResponse = await cache.match(key);
    
    if (cachedResponse) {
      // Add header to indicate cached response
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-Cache', 'HIT');
      
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers
      });
    }
    
    throw error;
  }
}

async function cacheFirst(request, cacheName, cacheKey = null) {
  const cache = await caches.open(cacheName);
  const key = cacheKey || request;
  const cachedResponse = await cache.match(key);
  
  if (cachedResponse) {
    // Update cache in background for future requests
    updateCacheInBackground(request, cache, key);
    return cachedResponse;
  }
  
  // Not in cache, fetch from network
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      cache.put(key, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error(`[SW] Cache and network failed for ${request.url}`);
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName, cacheKey = null) {
  const cache = await caches.open(cacheName);
  const key = cacheKey || request;
  const cachedResponse = await cache.match(key);
  
  // Always update cache in background
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(key, response.clone());
    }
    return response;
  }).catch((error) => {
    console.log(`[SW] Background fetch failed for ${request.url}:`, error);
  });
  
  // Return cached version immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // No cache, wait for network
  return fetchPromise;
}

// Background cache update
function updateCacheInBackground(request, cache, key) {
  fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(key, response.clone());
      }
    })
    .catch((error) => {
      console.log(`[SW] Background update failed for ${request.url}:`, error);
    });
}

// Utility functions
function isAPIRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && 
          request.headers.get('accept').includes('text/html'));
}

function isStaticAsset(url) {
  const staticExtensions = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i;
  return staticExtensions.test(url.pathname) || STATIC_FILES.includes(url.pathname);
}

function matchesPattern(path, patterns) {
  return patterns.some(pattern => pattern.test(path));
}

function getCacheKey(request) {
  // Create cache key that includes relevant query parameters for APIs
  const url = new URL(request.url);
  
  // For APIs, include relevant query params in cache key
  if (isAPIRequest(url)) {
    const relevantParams = ['limit', 'offset', 'period', 'type', 'category'];
    const searchParams = new URLSearchParams();
    
    relevantParams.forEach(param => {
      if (url.searchParams.has(param)) {
        searchParams.set(param, url.searchParams.get(param));
      }
    });
    
    return `${url.pathname}?${searchParams.toString()}`;
  }
  
  return request;
}

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);
  
  if (event.tag === 'background-sync-data') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  console.log('[SW] Handling background sync');
  
  try {
    // Send message to client to handle sync
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Push notification event
self.addEventListener('push', (event) => {
  const options = {
    body: 'У вас есть новые уведомления в Family Budget',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'family-budget-notification',
    data: {
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Открыть приложение'
      },
      {
        action: 'dismiss',
        title: 'Скрыть'
      }
    ]
  };

  let title = 'Family Budget';
  let body = options.body;

  if (event.data) {
    const data = event.data.json();
    title = data.title || title;
    body = data.body || body;
    options.data = { ...options.data, ...data };
  }

  event.waitUntil(
    self.registration.showNotification(title, { ...options, body })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  const { action, data } = event.notification;
  
  event.notification.close();

  if (action === 'dismiss') {
    return;
  }

  // Open or focus the app
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Check if app is already open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (self.clients.openWindow) {
        const url = data?.url || '/dashboard';
        return self.clients.openWindow(url);
      }
    })
  );
});

// Skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Periodic background sync for cache cleanup
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(cleanupCaches());
  }
});

async function cleanupCaches() {
  console.log('[SW] Cleaning up expired cache entries');
  
  const cacheNames = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    // Remove expired entries (simple time-based cleanup)
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const key of keys) {
      const response = await cache.match(key);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const cacheTime = new Date(dateHeader).getTime();
          if (now - cacheTime > maxAge) {
            await cache.delete(key);
            console.log(`[SW] Removed expired cache entry: ${key.url}`);
          }
        }
      }
    }
  }
}

console.log(`[SW] Service Worker ${CACHE_VERSION} loaded`);
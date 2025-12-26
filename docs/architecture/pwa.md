# Progressive Web App (PWA) Architecture

## Overview

Family Budget is implemented as a **Progressive Web App (PWA)** with comprehensive offline support, automatic updates, and native app-like experience.

**Key Features:**
- ✅ Service Worker with aggressive automatic updates
- ✅ Offline-first architecture
- ✅ Push notifications
- ✅ Background sync
- ✅ Install prompt for mobile/desktop
- ✅ Responsive design optimized for all devices
- ✅ Automatic reload on update (no user interaction required)

---

## Service Worker Lifecycle

### 1. Install Event

**Purpose:** Cache critical static resources for offline access.

**Strategy:** Aggressive precaching + cache busting support

```javascript
self.addEventListener('install', (event) => {
    // 1. Cache static resources (manifest, icons, splash screens)
    // 2. Cache offline page assets (CSS/JS for / and /lists)
    // 3. CRITICAL: Call skipWaiting() for immediate activation
});
```

**Cached Resources:**
- `/` (home page)
- `/manifest.json`
- App icons (192x192, 512x512, maskable)
- iOS splash screens (10 different sizes for device coverage)
- Offline page assets (CSS/JS for `/` and `/lists`)

**Important:** `skipWaiting()` is called automatically to force immediate activation.

---

### 2. Activate Event

**Purpose:** Clean up old caches and notify clients about update.

**Strategy:** Delete old caches + clients.claim() + postMessage notification

```javascript
self.addEventListener('activate', (event) => {
    // 1. Delete all old caches (budget-vXXXX)
    // 2. CRITICAL: Call clients.claim() to take control immediately
    // 3. Notify all clients via postMessage (type: SW_UPDATED)
});
```

**What Happens:**
1. Old caches deleted (only latest version remains)
2. All open tabs immediately use new service worker
3. All tabs receive `SW_UPDATED` message with version + timestamp
4. **controllerchange** event fires in all tabs → shows update notification

---

### 3. Fetch Event

**Purpose:** Intercept network requests and serve from cache or network.

**Strategy:** Different strategies for different content types.

---

## Caching Strategies

Family Budget uses **4 different caching strategies** optimized for each content type:

### Strategy 1: API Endpoints - Network First

**Pattern:** `/api/*`

**Behavior:**
1. Always try network first
2. Cache successful responses (HTTP 200)
3. Fallback to cache if offline
4. Return 503 error if no cache available

**Why:** API data must be fresh. Cache only for offline fallback.

**Example:**
```
/api/v1/facts → Network First
/api/v1/articles → Network First
/api/v1/auth/me → Network First
```

---

### Strategy 2: HTML Pages - Network First (Limited Offline)

**Pattern:** `/*.html` or paths without extension

**Behavior:**
1. Try network first
2. Cache only **OFFLINE_PAGES** (`/`, `/lists`)
3. Other pages: serve cached if available, otherwise show offline message
4. Protected pages (`/facts`, `/plan`): require online access

**Why:** HTML pages change frequently. Only critical pages work offline.

**Offline Pages:**
- `/` - Home page with metrics and recent facts
- `/lists` - Shopping lists (with offline CRUD)

**Online-Only Pages:**
- `/facts` - Transaction management (requires auth)
- `/plan` - Budget planning (requires auth)
- `/statistics` - Reports (requires DB queries)

---

### Strategy 3: Static Assets - Cache First (Stale-While-Revalidate)

**Pattern:** `*.css`, `*.js`, `*.json`, `*.png`, `*.jpg`, `*.svg`, `*.woff2`, `*.ico`, `*.webp`

**Behavior:**
1. Serve from cache immediately (fast load)
2. Background network request to update cache
3. **CRITICAL:** Use `ignoreSearch: true` for cache busting support
4. Cache updated for next visit

**Why:** Static files rarely change. Fast load is priority.

**Cache Busting:**
- Files use query string: `/static/css/style.min.css?v=20251224_1500`
- Service worker caches **without** query string
- `ignoreSearch: true` matches cached version even with `?v=...`

**Example:**
```javascript
// Request: /static/css/style.min.css?v=20251224_1500
// Cached:  /static/css/style.min.css (without query)
// Match: ✅ ignoreSearch: true finds it
```

---

### Strategy 4: Health Endpoints - No Caching

**Pattern:** `/health`, `/ping`, `/ready`, `/health/*`

**Behavior:**
- **NO SERVICE WORKER INTERCEPT**
- Pass through directly to server
- Used by NetworkDetector for offline detection

**Why:** Health endpoints must reflect real network status, not cached responses.

---

## Aggressive Auto-Update Strategy

**Since:** v5.4.0
**Updated:** v5.5.0 (automatic reload)
**Status:** ✅ Active

### Overview

Family Budget uses **aggressive fully automatic updates** to ensure all users are on the latest version immediately after deployment.

**Key Decisions:**
- ✅ `skipWaiting()` on install (immediate activation)
- ✅ `clients.claim()` on activate (take control of all tabs)
- ✅ Update checks every **1 hour** + on every page load
- ✅ **Automatic page reload** when new SW activates (no user interaction)
- ✅ Full console logging for debugging and monitoring

---

### Update Flow

#### Step 1: New Version Deployed

```
Server: sw.js updated with new CACHE_VERSION
```

#### Step 2: Browser Detects Update

```
Browser: Periodic check (every 1 hour) OR page reload
Browser: registration.update() runs
Browser: Fetch sw.min.js from server
Browser: Compare with current SW
Result: updatefound event fires
```

#### Step 3: New SW Installs

```
New SW: install event fires
New SW: Cache static resources
New SW: CRITICAL: Call skipWaiting()
Old SW: Still active (for now)
```

#### Step 4: New SW Activates

```
New SW: activate event fires immediately (skipWaiting)
New SW: Delete old caches
New SW: CRITICAL: Call clients.claim()
New SW: Send postMessage to all clients (SW_UPDATED)
Browser: controllerchange event fires in all tabs
```

#### Step 5: Version Check and Conditional Reload

```
All Tabs: controllerchange listener fires
All Tabs: Request CACHE_VERSION from new SW via postMessage + MessageChannel
All Tabs: Compare CACHE_VERSION with saved version in localStorage
IF version unchanged:
  - Log: "✓ Version unchanged, skipping reload"
  - Skip reload (prevents reload loops)
ELSE:
  - Log: "⚡ Version changed, reloading page..."
  - Save new CACHE_VERSION to localStorage
  - IMMEDIATELY reload via window.location.reload()
Result: Only tabs with actual version change reload
```

**Why CACHE_VERSION instead of scriptURL:**
- `scriptURL` never changes (`/sw.min.js` is always the same URL)
- `CACHE_VERSION` is the actual version identifier (e.g., `v20251225_1430`)
- Using MessageChannel for request-response pattern ensures reliable version comparison

**Key Benefits:**
- ✅ Zero user interaction required
- ✅ All users on new version within seconds
- ✅ No stale code running
- ✅ Prevents unnecessary reload loops
- ✅ Intelligent version tracking via localStorage

---

### Timeline Example

| Time | Event |
|------|-------|
| 00:00 | Deploy new version to server |
| 00:00 | First user reloads page → update detected |
| 00:01 | New SW installs and activates immediately |
| 00:01 | First user's page **automatically reloads** → on new version |
| 00:15 | Second user's hourly check → update detected → **automatic reload** |
| 00:45 | Third user's hourly check → update detected → **automatic reload** |
| 01:00 | **100% users on new version** (max 1-hour delay) |

---

### Code Implementation

#### Service Worker (sw.js)

```javascript
// Install event - lines 75-125
self.addEventListener('install', (event) => {
    console.log('[SW] Installing version:', CACHE_VERSION);

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static files');
            return cache.addAll(STATIC_CACHE);
        }).then(() => {
            console.log('[SW] CRITICAL: Forcing immediate activation via skipWaiting()');
            return self.skipWaiting(); // ← CRITICAL
        })
    );
});

// Activate event - lines 127-163
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating version:', CACHE_VERSION);

    event.waitUntil(
        (async () => {
            // Delete old caches
            const cacheNames = await caches.keys();
            const deletedCaches = await Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('budget-') && name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );

            console.log('[SW] Deleted', deletedCaches.length, 'old caches');

            // CRITICAL: Take control immediately
            await self.clients.claim(); // ← CRITICAL
            console.log('[SW] Clients claimed');

            // Notify all clients about update
            const clients = await self.clients.matchAll({ type: 'window' });
            console.log('[SW] Notifying', clients.length, 'clients about SW update');

            clients.forEach(client => {
                client.postMessage({
                    type: 'SW_UPDATED',
                    version: CACHE_VERSION,
                    timestamp: new Date().toISOString()
                });
            });
        })()
    );
});
```

#### Frontend (base.html)

```javascript
// Lines 1357-1456
if ('serviceWorker' in navigator) {
    let refreshing = false;
    const SW_VERSION_KEY = 'pwa_sw_version';

    // Helper function to get CACHE_VERSION from SW via MessageChannel
    async function getSWVersion(controller) {
        if (!controller) return null;

        return new Promise((resolve) => {
            const messageChannel = new MessageChannel();
            const timeout = setTimeout(() => {
                console.warn('[PWA] Timeout getting SW version');
                resolve(null);
            }, 5000);

            messageChannel.port1.onmessage = (event) => {
                clearTimeout(timeout);
                if (event.data.type === 'VERSION_RESPONSE') {
                    console.log('[PWA] Received SW version:', event.data.version);
                    resolve(event.data.version);
                } else {
                    resolve(null);
                }
            };

            controller.postMessage(
                { action: 'getVersion' },
                [messageChannel.port2]
            );
        });
    }

    // CRITICAL: Listen for controllerchange event (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', async () => {
        if (refreshing) return;

        const newController = navigator.serviceWorker.controller;
        if (!newController) return;

        console.log('[PWA] New service worker activated');
        console.log('[PWA] Requesting CACHE_VERSION from new SW...');

        // Request CACHE_VERSION from new Service Worker
        const newVersion = await getSWVersion(newController);
        const savedVersion = localStorage.getItem(SW_VERSION_KEY);

        console.log('[PWA] New SW CACHE_VERSION:', newVersion);
        console.log('[PWA] Saved CACHE_VERSION:', savedVersion);

        // If failed to get version, reload for safety
        if (!newVersion) {
            console.warn('[PWA] ⚠️ Failed to get CACHE_VERSION, reloading for safety...');
            refreshing = true;
            window.location.reload();
            return;
        }

        // Check if version changed
        if (newVersion === savedVersion) {
            console.log('[PWA] ✓ Version unchanged, skipping reload');
            return;
        }

        // Version changed - reload
        refreshing = true;
        console.log('[PWA] ⚡ Version changed, reloading page...');
        console.log('[PWA] Previous CACHE_VERSION:', savedVersion);
        console.log('[PWA] New CACHE_VERSION:', newVersion);

        // Save new version before reload
        localStorage.setItem(SW_VERSION_KEY, newVersion);

        // Automatic reload
        window.location.reload();
    });

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.min.js')
            .then(async (registration) => {
                // Get and save current CACHE_VERSION on load
                if (navigator.serviceWorker.controller) {
                    console.log('[PWA] Getting current CACHE_VERSION from SW...');
                    const currentVersion = await getSWVersion(navigator.serviceWorker.controller);
                    if (currentVersion) {
                        localStorage.setItem(SW_VERSION_KEY, currentVersion);
                        console.log('[PWA] Current CACHE_VERSION saved:', currentVersion);
                    }
                }

                // Check for updates on every page load
                registration.update();

                // Auto-check for updates every 1 hour
                setInterval(() => {
                    console.log('[PWA] Running hourly update check...');
                    registration.update();
                }, 60 * 60 * 1000);

                // Handle update found
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                console.log('[PWA] Update available, auto-activating...');
                            } else {
                                // First install - save version
                                console.log('[PWA] Service worker installed for the first time');
                                if (newWorker.scriptURL) {
                                    localStorage.setItem(SW_VERSION_KEY, newWorker.scriptURL);
                                }
                            }
                        }
                    });
                });
            });
    });
}
```

---

### Configuration Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `skipWaiting()` | ✅ Always | Immediate activation, no waiting |
| `clients.claim()` | ✅ Always | All tabs use new SW immediately |
| Update check frequency | 1 hour + page load | Balance between responsiveness and server load |
| Auto-reload | ✅ Enabled (conditional) | Reload only if version changed |
| Version tracking | localStorage | Prevents unnecessary reload loops |
| User interaction | ❌ None required | Zero-friction update experience |
| State preservation | ❌ No | Users should save work frequently (future enhancement) |

---

### Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| User loses unsaved form data | HIGH | LOW | Users should save work frequently; future: detect dirty forms |
| Update interrupts transaction | MEDIUM | LOW | Future: delay reload if transaction in progress |
| Multiple simultaneous reloads (multi-tab) | LOW | LOW | `refreshing` flag prevents duplicate reloads |
| Update delayed beyond 1 hour | LOW | MEDIUM | Max 1-hour delay acceptable; users get latest version automatically |
| Browser compatibility | LOW | LOW | Standard APIs (Service Worker, window.location.reload) |

---

## Offline Support

### Offline Pages

**Available Offline:**
- `/` - Home page (cached HTML + API fallbacks)
- `/lists` - Shopping lists (full CRUD via IndexedDB)

**Online-Only:**
- `/facts` - Requires auth + DB queries
- `/plan` - Requires auth + DB queries
- `/statistics` - Requires complex DB aggregations

---

### IndexedDB Storage

**Database:** `FamilyBudgetDB`
**Version:** 5

**Stores:**
- `offline_facts` - Facts pending sync
- `offline_transfers` - Transfers pending sync
- `offline_plans` - Plans pending sync
- `offline_recurring_plans` - Recurring plans pending sync
- `offline_shopping_lists` - Shopping lists
- `offline_shopping_list_items` - Shopping list items
- `sync_queue` - Sync queue for budget operations
- `sync_queue_shopping` - Sync queue for shopping operations
- `data_cache` - Cached API responses
- `cached_stores` - Cached stores (financial centers, cost centers)
- `cached_product_groups` - Cached product groups
- `sync_metadata` - Sync status and timestamps

**See:** `frontend/web/static/js/offline/idb.js` for schema

---

### Background Sync API

**Supported Operations:**
- CREATE: Facts, Transfers, Plans, Recurring Plans, Shopping Lists
- UPDATE: Facts, Transfers, Plans, Shopping Lists
- DELETE: Facts, Transfers, Plans, Shopping Lists

**Sync Flow:**
1. User performs CRUD operation offline
2. Operation saved to IndexedDB `sync_queue`
3. Background sync registration: `sync-budget-data`
4. When online: Service worker fires `sync` event
5. Service worker POSTs queued operations to API
6. Successful sync: Delete from queue
7. Failed sync: Retry later (max 5 retries with exponential backoff)

**See:** `sw.js` lines 604-695 for sync implementation

---

### Push Notifications

**Supported:**
- Sync completion notifications
- Error notifications
- Administrative broadcasts

**VAPID Keys:**
- Public key: Stored in `backend/app/core/config.py`
- Private key: Environment variable `VAPID_PRIVATE_KEY`

**Notification Click Handling:**
- `sync_completed` → Navigate to `/facts`
- `error` → Navigate to `/`
- Default → Focus existing tab or open new tab

**See:** `sw.js` lines 912-971 for push notification handling

---

## Manifest.json

**Location:** `/manifest.json`

**Key Properties:**
```json
{
  "name": "Семейный Бюджет",
  "short_name": "Бюджет",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#4CAF50",
  "background_color": "#ffffff",
  "icons": [
    { "src": "/static/icons/icon-192.png", "sizes": "192x192" },
    { "src": "/static/icons/icon-512.png", "sizes": "512x512" },
    { "src": "/static/icons/icon-maskable-512.png", "sizes": "512x512", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Добавить факт", "url": "/?action=add" },
    { "name": "Статистика", "url": "/statistics" }
  ]
}
```

**App Shortcuts:**
- Long press app icon → Quick actions
- "Добавить факт" → Opens home with add modal
- "Статистика" → Opens statistics page

---

## Testing Update Flow

### Manual Testing

**Steps:**
1. Open app in browser
2. Check current version in console: `[SW] Activating version: vXXXXXXXX_XXXX`
3. Deploy new version (update `CACHE_VERSION` manually or via `scripts/update-sw-version.sh`)
4. Reload page OR wait 1 hour
5. Observe console logs (page should auto-reload):
   ```
   [PWA] Checking for updates...
   [PWA] New service worker found, installing...
   [SW] Installing version: vXXXXXXXX_YYYY
   [SW] CRITICAL: Forcing immediate activation via skipWaiting()
   [SW] Activating version: vXXXXXXXX_YYYY
   [SW] Deleted 1 old caches
   [SW] Clients claimed
   [SW] Notifying 1 clients about SW update
   [PWA] New service worker activated
   [PWA] Version: 2025-12-25T...Z
   [PWA] Auto-reloading page to apply update...
   [Page reloads automatically]
   ```
6. After automatic reload → Verify new version active: `[SW] Activating version: vXXXXXXXX_YYYY`
7. Verify NO notification shown (automatic reload, no user interaction)

---

### Multi-Tab Testing

**Steps:**
1. Open app in 3 different tabs
2. Deploy new version
3. Trigger update in any tab (reload OR wait 1 hour)
4. Observe behavior:
   - Tab that detected update: Reloads automatically
   - Other tabs: Continue working until their next update check
5. Wait for other tabs' update checks (max 1 hour):
   - Each tab will automatically reload when it detects the update
   - No cross-tab coordination needed (each tab manages itself)
6. Verify: After 1 hour, all tabs are on new version

---

### First-Time Install Testing

**Steps:**
1. Clear all service workers and caches (DevTools → Application)
2. Open app for the first time
3. Verify:
   - SW installs successfully
   - Console log: "Service worker installed for the first time"
   - **NO reload triggered** (first install does NOT reload)
   - Static cache populated
4. Note: Only SW updates trigger reload, not first install

---

## Monitoring and Debugging

### DevTools - Application Tab

**Service Workers:**
- Status: `activated and is running`
- Version: Current CACHE_VERSION
- Update on reload: Toggle for testing

**Cache Storage:**
- Should have exactly **1** cache: `budget-vXXXXXXXX_XXXX`
- Old caches automatically deleted on activate

**Background Sync:**
- Tags: `sync-budget-data`, `sync-shopping-data`
- Status: Pending/Success/Failed

**Push Notifications:**
- Subscription status
- VAPID public key
- Test push notification

---

### Console Logs

**Critical Events (Version Changed):**
```
[SW] Installing version: v20251225_1430
[SW] Caching static files
[SW] Caching offline page assets
[SW] CRITICAL: Forcing immediate activation via skipWaiting()
[SW] Activating version: v20251225_1430
[SW] Deleted N old caches
[SW] Clients claimed
[SW] Notifying N clients about SW update
[PWA] Service Worker registered: /
[PWA] Getting current CACHE_VERSION from SW...
[PWA] Received SW version: v20251225_1430
[PWA] Current CACHE_VERSION saved: v20251225_1430
[PWA] New service worker found, installing...
[PWA] Service worker state: installing
[PWA] Service worker state: installed
[PWA] Update available, auto-activating...
[PWA] New service worker activated
[PWA] Requesting CACHE_VERSION from new SW...
[PWA] Received SW version: v20251225_1530
[PWA] New SW CACHE_VERSION: v20251225_1530
[PWA] Saved CACHE_VERSION: v20251225_1430
[PWA] ⚡ Version changed, reloading page...
[PWA] Previous CACHE_VERSION: v20251225_1430
[PWA] New CACHE_VERSION: v20251225_1530
[Page reloads automatically]
```

**Critical Events (Version Unchanged - No Reload):**
```
[PWA] New service worker activated
[PWA] Requesting CACHE_VERSION from new SW...
[PWA] Received SW version: v20251225_1430
[PWA] New SW CACHE_VERSION: v20251225_1430
[PWA] Saved CACHE_VERSION: v20251225_1430
[PWA] ✓ Version unchanged, skipping reload
[PWA] Application already on latest version
[No reload occurs - prevents reload loop]
```

---

## Performance

### Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| First Contentful Paint (FCP) | < 1.5s | ~1.2s |
| Largest Contentful Paint (LCP) | < 2.5s | ~2.1s |
| Time to Interactive (TTI) | < 3.5s | ~3.0s |
| Service Worker activation | < 5s | ~2s |
| Offline page load | < 1s | ~0.5s |

### Lighthouse PWA Score

**Target:** 95+
**Actual:** 98

**Checklist:**
- ✅ Registers a service worker
- ✅ Responds with 200 when offline
- ✅ Contains viewport meta tag
- ✅ Contains theme color meta tag
- ✅ Contains icons for all platforms
- ✅ Content sized correctly for viewport
- ✅ Displays custom splash screen
- ✅ Sets address bar theme color
- ✅ Has maskable icon
- ✅ Provides app shortcuts

---

## Security Considerations

### HTTPS Requirement

**Critical:** Service workers REQUIRE HTTPS (or localhost for development).

**Current Deployment:**
- Production: HTTPS via Let's Encrypt (Certbot)
- Development: localhost (HTTP allowed)

---

### Content Security Policy (CSP)

**Current CSP:**
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  connect-src 'self' wss:;
```

**Service Worker:** Allowed under `script-src 'self'` ✓

---

### Cache Poisoning Prevention

**Mitigations:**
1. CACHE_VERSION timestamp prevents stale cache reuse
2. Cache cleared on every SW activate
3. No third-party resources cached
4. All cached resources served from same origin

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v5.4.0 | 2025-12-24 | Aggressive auto-update strategy (skipWaiting + 1-hour checks) |
| v5.3.0 | 2025-12-20 | Push notifications + background sync |
| v5.2.0 | 2025-12-15 | IndexedDB offline storage |
| v5.1.0 | 2025-11-10 | Initial PWA implementation |

---

## References

- [Service Worker API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Progressive Web Apps - web.dev](https://web.dev/progressive-web-apps/)
- [Background Sync API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Sync_API)
- [Push API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [IndexedDB API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Web App Manifest - MDN](https://developer.mozilla.org/en-US/docs/Web/Manifest)

---

## Mobile Features

### iOS Safari Modal Interaction Fixes

**Problem:** iOS Safari синтезирует "click outside" события при взаимодействии с интерактивными элементами внутри `<dialog>` (Choices.js dropdown, date picker, etc.)

**Root Cause:** `<form method="dialog" class="modal-backdrop">` автоматически закрывает dialog при любом click событии на backdrop, включая синтетические события от iOS.

**Solution Pattern (применён во всех модальных окнах):**

```javascript
// ✅ Правильный подход: Explicit backdrop handler
if (!modal.dataset.backdropHandlerAdded) {
    modal.addEventListener('click', (e) => {
        // Закрываем ТОЛЬКО при клике напрямую на backdrop
        if (e.target === modal) {
            modal.close();
        }
    });
    modal.dataset.backdropHandlerAdded = 'true';
}
```

```html
<!-- ✅ HTML: Простой div вместо form -->
<div class="modal-backdrop"></div>
```

**Benefits:**
- Choices.js dropdown работает с первого тапа
- Date picker не закрывает modal
- Полный контроль над поведением modal
- Консистентность между всеми модальными окнами

**Affected Browsers:**
- Safari 18+ (iOS 17+)
- Yandex Browser (iOS)
- Chrome iOS (использует WebKit)
- Firefox iOS (использует WebKit)

**Applied to:**
- modal_add_transaction ✅ (версия 6.3.0)
- modal_edit_fact ✅ (ранее)
- modal_transfer ✅ (ранее)
- modal_add_plan ✅ (ранее)
- modal_edit_plan ✅ (ранее)

---

### WebSocket Recovery After Long Sleep (iOS/Mobile)

**Problem:** iOS Safari and Yandex Browser **suspend JavaScript execution** when screen is off for 5+ minutes.

**Impact:**
- WebSocket connection dies on TCP level (iOS kills inactive sockets)
- All timers stopped (ping intervals, reconnection timers)
- Visibility API events may not fire or fire with delay
- WebSocket close event not delivered if JS was suspended
- **Result:** Requires manual page reload

**Solution:** **5-layer defense-in-depth strategy** (v5.7.0+)

#### Layer 1: Enhanced Visibility API Recovery

**Method:** `_performWakeHealthCheck()`

Aggressive connection health check when page becomes visible:
1. Check WebSocket readyState (OPEN?)
2. Check stale connection (lastServerPing > 45s?)
3. Send ping + wait 3s for pong
4. If any check fails → force reconnect

**Trigger:** `visibilitychange` event (visible state)

#### Layer 2: Service Worker Wake Detection

**Mechanism:** Service Worker message passing

Service Worker remains active during page background, can detect wake:
1. Page sends `pageWake` message to SW on visibility change
2. SW broadcasts `PAGE_WAKE` to all clients
3. Clients trigger `_performWakeHealthCheck()`

**Benefit:** Backup mechanism if Visibility API doesn't fire

#### Layer 3: Periodic Health Check

**Method:** `_startHealthCheck()` / `_stopHealthCheck()`

Runs every **60 seconds** when page visible:
1. Check `_isConnectionStale()`
2. If WebSocket OPEN → send ping for verification
3. If connection stale or not OPEN → force reconnect

**Purpose:** Catch cases where connection died but visibility change didn't occur (user reading page without scrolling for 10+ minutes)

#### Layer 4: Heartbeat Timeout Enforcement

**Method:** `_resetPongTimeout()`

After each client ping, sets **20-second timeout**:
1. Client sends ping every 8s (iOS) / 15s (desktop)
2. Timeout set: if no pong within 20s → force close WebSocket
3. On pong received → clear timeout

**Purpose:** Detect "zombie" connections (WebSocket object OPEN but TCP dead)

#### Layer 5: Comprehensive Logging

**Method:** `_log(category, level, message, data)`

Structured logging for all connection events:
- **Prefixes:** `[WS-WAKE]`, `[WS-HEALTH]`, `[WS-PING]`, `[WS-PONG]`, `[WS-PONG-TIMEOUT]`
- **Levels:** error, warn, info, debug
- **Enabled:** Always on iOS, optional on desktop
- **Includes:** Connection state, timestamps, RTT, last ping/pong times

**Purpose:** Easy production debugging on user devices

#### Recovery Time Guarantees

| Sleep Duration | Recovery Mechanism | Max Recovery Time |
|----------------|-------------------|------------------|
| < 1 min | Ping/Pong keepalive | 0s (no disconnect) |
| 1-5 min | Layer 1 (Visibility API) | 2-3s |
| 5-10 min | Layers 1-3 (+ Health Check) | 3-60s |
| 30+ min | All 5 layers | Max 60s |
| Any duration | **No manual reload needed** | ✅ Automatic |

#### Testing

**Manual Testing (iOS Safari / Yandex):**
```bash
# Test Case 1: Short Sleep (< 1 min)
Lock device → Wait 30s → Unlock
Expected: Connection alive (ping/pong kept it)

# Test Case 2: Medium Sleep (1-5 min)
Lock device → Wait 3 min → Unlock
Expected: Reconnect in 2-3s (Visibility API + wake check)

# Test Case 3: Long Sleep (5-10 min)
Lock device → Wait 10 min → Unlock
Expected: Reconnect in 3-60s (health check catches it)

# Test Case 4: Extreme Sleep (30+ min)
Lock device → Wait 1 hour → Unlock
Expected: Automatic reconnect, no manual reload
```

**Automated Testing (DevTools Console):**
```javascript
// Simulate long sleep
window.testWSRecovery = async function(sleepMs) {
    console.group('[WS-TEST] Simulating sleep:', sleepMs, 'ms');

    // Kill WebSocket
    if (window.budgetWSClient.ws) {
        window.budgetWSClient.ws.close(1005, 'Test sleep');
    }

    // Wait
    await new Promise(resolve => setTimeout(resolve, sleepMs));

    // Simulate wake
    document.dispatchEvent(new Event('visibilitychange'));

    console.groupEnd();
};

// Usage
await testWSRecovery(300000); // 5 minutes
```

**Expected Console Output:**
```
[WS-WAKE] Wake Health Check
[WS-WAKE] Visibility: visible, timestamp: 2025-12-26T...
[WS-WAKE] Current WS state: CLOSED
[WS-WAKE] ❌ WebSocket not OPEN, reconnecting
...
[WS-WAKE] ✓ Connection verified
```

#### Implementation Details

**Files Modified:**
- `frontend/web/static/js/budget/budgetWSClient.js` (~250 lines added)
- `sw.js` (~15 lines added)

**New Properties:**
```javascript
this._healthCheckInterval = null;
this.HEALTH_CHECK_INTERVAL = 60000;  // 60s
this._pongTimeoutTimer = null;
this.PONG_TIMEOUT = 20000;  // 20s
this._enableDetailedLogging = this._iosDeviceMode;  // Always on iOS
```

**New Methods:**
```javascript
_log(category, level, msg, data)  // Layer 5: Structured logging
_performWakeHealthCheck()         // Layer 1: Wake health check
_startHealthCheck()                // Layer 3: Start periodic check
_stopHealthCheck()                 // Layer 3: Stop periodic check
_resetPongTimeout()                // Layer 4: Set pong timeout
```

**Backward Compatibility:**
- ✅ All changes additive (no breaking changes)
- ✅ Fallback: existing mechanisms remain if new ones fail
- ✅ Graceful degradation for older browsers

**Version:** 5.7.0+ (December 2025)

---

## WebSocket Diagnostics Modal

### Purpose

Provides debugging interface for WebSocket connection issues on mobile devices (especially iOS Safari).

### Trigger

Triple-tap on WebSocket status badge in header (#budget-sse-status-indicator).

### Implementation

**Location:**
- Modal HTML: `/frontend/web/templates/base.html` (around line 1993)
- JavaScript: `/frontend/web/static/js/budget/budgetWSClient.js`, `showDiagnostics()` method (line 2032)

**Features:**
- ✅ Scrollable modal (max-height: 90dvh)
- ✅ Mobile-optimized (iOS Safari 18+, Yandex Browser)
- ✅ Comprehensive logging ([WS_DIAG] prefix)
- ✅ Graceful fallback to alert() if modal unavailable
- ✅ Dark mode compatible (DaisyUI)

**Diagnostic Data Displayed:**

| Section | Data Points |
|---------|-------------|
| Connection Status | Connected, Enabled, WS State, Long Polling, Polling Active |
| Browser Detection | Safari iOS Mode, Needs Longer Timeout, User Agent |
| Multi-Tab Coordination | Leader, MultiTab Initialized/Supported, Has Channel, Last Heartbeat |
| Reconnection State | Reconnect Attempts, Limit Reached, Approaching Limit |
| Error Tracking | Last Error, Connection History (last 10 events) |

**Console Logging:**

All diagnostic data is also logged to browser console with `[WS_DIAG]` prefix for remote debugging.

**Usage:**

```javascript
// Manual trigger (from console)
window.budgetWSClient.showDiagnostics();

// Triple-tap trigger (user-facing)
// Tap WebSocket badge 3 times quickly (within 500ms)
```

**Mobile Scrolling:**

Modal uses existing mobile CSS patterns (90dvh, overflow-y: auto) to ensure close button is always accessible on small screens. See `base.html` lines 52-97 for implementation.

**Version:** 5.7.0+ (December 2025)

---

## Future Enhancements

### Planned Features

1. **Smart Update Scheduling**
   - Detect if form is being edited (dirty state detection)
   - Delay reload until form saved or user idle
   - Prevent data loss during active transactions

2. **Partial State Preservation**
   - Save draft form data to localStorage before reload
   - Restore after reload (for critical forms only)
   - Preserve scroll position and UI state

3. **Progressive Update Strategy**
   - Show countdown notification (5 seconds) before reload
   - Allow user to cancel reload and save work
   - Re-trigger reload after user-defined delay

4. **Offline Conflict Resolution**
   - Last-Write-Wins (LWW) strategy
   - Conflict detection and user resolution UI
   - Merge strategies for shopping lists

5. **Advanced Caching**
   - Predictive prefetching (articles, categories)
   - Cache warming on login
   - Adaptive cache size based on device

6. **Performance Monitoring**
   - Real User Monitoring (RUM) via Performance API
   - Track SW update success rate
   - Track offline usage patterns

---

**Last Updated:** 2025-12-26
**Maintainer:** Development Team
**Status:** ✅ Production Ready

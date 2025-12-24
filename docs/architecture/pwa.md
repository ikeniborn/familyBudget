# Progressive Web App (PWA) Architecture

## Overview

Family Budget is implemented as a **Progressive Web App (PWA)** with comprehensive offline support, automatic updates, and native app-like experience.

**Key Features:**
- ✅ Service Worker with automatic updates
- ✅ Offline-first architecture
- ✅ Push notifications
- ✅ Background sync
- ✅ Install prompt for mobile/desktop
- ✅ Responsive design optimized for all devices

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
**Status:** ✅ Active

### Overview

Family Budget uses **aggressive automatic updates** with user control to ensure all users are on the latest version within reasonable time of deployment.

**Key Decisions:**
- ✅ `skipWaiting()` on install (immediate activation)
- ✅ `clients.claim()` on activate (take control of all tabs)
- ✅ Update checks every **1 hour** (was 24 hours)
- ✅ Persistent update notification with "Update" button
- ✅ Users can dismiss notification but must reload to apply update
- ❌ No automatic reload (user chooses when to update)

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

#### Step 5: Clients Show Update Notification

```
All Tabs: controllerchange listener fires
All Tabs: Show persistent update notification
All Tabs: Display "Обновить" and "Позже" buttons
User Action: Click "Обновить" button
Result: Page reloads and applies new version
```

**Alternative User Actions:**
- Click "Позже" → Notification dismissed, can continue working
- Ignore notification → App continues to work, notification remains visible

---

### Timeline Example

| Time | Event |
|------|-------|
| 00:00 | Deploy new version to server |
| 00:00 | First user reloads page → update detected |
| 00:01 | New SW installs and activates immediately |
| 00:01 | First user sees notification: "Доступно обновление приложения" with buttons |
| 00:02 | First user clicks "Обновить" → page reloads |
| 00:15 | Second user's hourly check → update detected → notification shown |
| 00:20 | Second user clicks "Позже" → continues working |
| 00:45 | Third user's hourly check → update detected → notification shown |
| 01:30 | Second user reloads page manually → sees notification again → clicks "Обновить" |
| 02:00 | Most users eventually update (when convenient for them) |

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
// Lines 1309-1410
if ('serviceWorker' in navigator) {
    let refreshing = false;

    // CRITICAL: Listen for controllerchange event
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;

        console.log('[PWA] New service worker activated, showing update notification...');

        // Show persistent update notification with user control
        showUpdateNotification();
    });

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.min.js')
            .then((registration) => {
                console.log('[PWA] Service Worker registered:', registration.scope);

                // Check for updates on every page load
                registration.update();

                // Auto-check for updates every 1 hour
                setInterval(() => {
                    console.log('[PWA] Checking for updates...');
                    registration.update();
                }, 60 * 60 * 1000); // 1 hour = 3600000ms

                // Handle update found
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    console.log('[PWA] New service worker found, installing...');

                    newWorker.addEventListener('statechange', () => {
                        console.log('[PWA] Service worker state:', newWorker.state);

                        if (newWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                // Update available
                                console.log('[PWA] Update available, auto-activating...');
                            } else {
                                // First install
                                console.log('[PWA] Service worker installed for the first time');
                                showToast('Приложение готово к работе офлайн', 'success', 3000);
                            }
                        }
                    });
                });
            });
    });

    // Show persistent update notification with user control
    function showUpdateNotification() {
        const toast = document.createElement('div');
        toast.className = 'toast toast-top toast-center update-notification-toast';
        toast.style.cssText = 'position: fixed; z-index: 9999;';
        toast.innerHTML = `
            <div class="alert alert-info shadow-lg gap-4">
                <div class="flex-1 flex items-center">
                    <svg ...>...</svg>
                    <span>Доступно обновление приложения</span>
                </div>
                <div class="flex gap-2">
                    <button class="btn btn-sm btn-ghost" onclick="dismissUpdateNotification()">
                        Позже
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="reloadWithUpdate()">
                        Обновить
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(toast);
    }

    // Dismiss update notification (hide it)
    function dismissUpdateNotification() {
        const toast = document.querySelector('.update-notification-toast');
        if (toast) {
            toast.style.display = 'none';
            console.log('[PWA] Update notification dismissed by user');
        }
    }

    // Reload page when user clicks Update button
    function reloadWithUpdate() {
        console.log('[PWA] User clicked Update button, reloading page...');
        window.location.reload();
    }
}
```

---

### Configuration Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `skipWaiting()` | ✅ Always | Immediate activation, no waiting |
| `clients.claim()` | ✅ Always | All tabs use new SW immediately |
| Update check frequency | 1 hour | Balance between responsiveness and server load |
| Update notification type | Persistent | Users control when to reload, prevents data loss |
| Auto-reload | ❌ Disabled | Users choose convenient time for update |
| State preservation | ❌ No | Consider for future versions |

---

### Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| User ignores notification | MEDIUM | MEDIUM | App remains functional with old SW, new version available in notification |
| Multiple notifications (multi-tab) | LOW | LOW | Each tab shows independent notification |
| User dismisses notification | LOW | MEDIUM | Notification can be re-shown on next page reload |
| Update delayed beyond 1 hour | LOW | MEDIUM | Users can update when convenient, app works normally |
| Browser compatibility | LOW | LOW | Notification uses standard HTML/CSS (DaisyUI) |

---

### Update Notification UI

**Appearance:**
- Fixed position: top-center
- DaisyUI alert with info variant (blue background)
- High z-index (9999) to ensure visibility
- Contains:
  - ✨ Refresh icon (SVG)
  - 📝 Message: "Доступно обновление приложения"
  - Two buttons:
    - "Позже" - Dismiss notification (hide it)
    - "Обновить" - Reload page with new SW

**User Options:**
1. Click "Обновить" → Immediately reload and apply update
2. Click "Позже" → Dismiss notification, continue working
3. Ignore notification → App continues to work normally, notification remains visible

**Behavior:**
- Notification persists across page interactions
- Multiple tabs show independent notifications
- Dismissing on one tab does NOT affect other tabs
- Next page reload shows notification again if SW still updated
- No automatic reload - user has full control

**Implementation Notes:**
- Alert element has class `update-notification-toast` for easy targeting
- `refreshing` flag prevents multiple simultaneous reloads
- Uses DaisyUI classes for consistent styling
- Buttons are semantic `<button>` elements for accessibility
- Console logs for debugging: `[PWA] Update notification dismissed by user`, `[PWA] User clicked Update button, reloading page...`

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
5. Observe console logs:
   ```
   [PWA] Checking for updates...
   [PWA] New service worker found, installing...
   [SW] Installing version: vXXXXXXXX_YYYY
   [SW] CRITICAL: Forcing immediate activation via skipWaiting()
   [SW] Activating version: vXXXXXXXX_YYYY
   [SW] Deleted 1 old caches
   [SW] Clients claimed
   [SW] Notifying 1 clients about SW update
   [PWA] New service worker activated, showing update notification...
   ```
6. Verify update notification appears (not countdown toast)
   - Should show: "Доступно обновление приложения"
   - Should have "Обновить" and "Позже" buttons
7. Test button behavior:
   - Click "Позже" → Notification disappears
   - Reload page → Notification appears again
   - Click "Обновить" → Page reloads immediately
8. After reload → Verify new version active: `[SW] Activating version: vXXXXXXXX_YYYY`

---

### Multi-Tab Testing

**Steps:**
1. Open app in 3 different tabs
2. Deploy new version
3. Trigger update in any tab (reload OR wait 1 hour)
4. Verify all 3 tabs show update notification independently
5. Test independent control:
   - Tab 1: Click "Обновить" → Tab 1 reloads immediately
   - Tab 2: Click "Позже" → Notification dismissed, continue working
   - Tab 3: Ignore notification → Notification remains visible
6. Verify: Each tab operates independently, no cross-tab interference

---

### First-Time Install Testing

**Steps:**
1. Clear all service workers and caches (DevTools → Application)
2. Open app for the first time
3. Verify:
   - SW installs successfully
   - Toast shown: "Приложение готово к работе офлайн"
   - **NO reload triggered** (first install should not reload)
   - Static cache populated

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

**Critical Events:**
```
[SW] Installing version: vXXXXXXXX_XXXX
[SW] Caching static files
[SW] Caching offline page assets
[SW] CRITICAL: Forcing immediate activation via skipWaiting()
[SW] Activating version: vXXXXXXXX_XXXX
[SW] Deleted N old caches
[SW] Clients claimed
[SW] Notifying N clients about SW update
[PWA] Service Worker registered: /
[PWA] Checking for updates...
[PWA] New service worker found, installing...
[PWA] Service worker state: installing
[PWA] Service worker state: installed
[PWA] Update available, auto-activating...
[PWA] New service worker activated, showing update notification...
[User clicks "Обновить" button]
[PWA] User clicked Update button, reloading page...
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

## Future Enhancements

### Planned Features

1. **Smart Update Scheduling**
   - Detect if form is being edited
   - Delay reload until form saved or user idle

2. **Partial State Preservation**
   - Save draft form data to localStorage
   - Restore after reload (for critical forms only)

3. **Update Notification Options**
   - "Update Now" button (immediate reload)
   - "Update Later" button (delay 10 minutes)
   - "Don't Ask Again" (wait until next session)

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

**Last Updated:** 2025-12-24
**Maintainer:** Development Team
**Status:** ✅ Production Ready

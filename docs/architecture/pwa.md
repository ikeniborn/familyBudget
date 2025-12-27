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

## Service Worker Updates (Manual with Notification)

**Since:** v6.4.1 (changed from star icon to text indicator)
**Previous:** v6.4.0 (star icon with badge), v5.4.0-v6.3.0 (automatic reload)
**Status:** ✅ Active

### Overview

Family Budget uses **manual update strategy with simple text indicator** to give users control over when to apply updates.

**Key Changes from v6.4.0:**
- ❌ **REMOVED**: Star icon SVG (⭐)
- ❌ **REMOVED**: "NEW" badge
- ✅ **NEW**: Simple "new" text indicator (lowercase, no icon)
- ✅ **NEW**: Subtle pulse animation on text
- ✅ **RETAINED**: User clicks indicator to manually reload
- ✅ **RETAINED**: First install is silent (no indicator, no toast)

**Retained from previous version:**
- ✅ `skipWaiting()` on install (immediate activation)
- ✅ `clients.claim()` on activate (take control of all tabs)
- ✅ Update checks every **1 hour** + on every page load
- ✅ Full console logging with `[SW_UPDATE]` and `[SW]` prefixes

---

### Update Flow

#### Step 1: New Version Deployed

```
Server: sw.js updated with new CACHE_VERSION (timestamp)
Example: v20251227_1530
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
Console: [SW] 📦 Installing Service Worker version: v20251227_1630
New SW: Cache static resources
Console: [SW] ⚡ Calling skipWaiting() for immediate activation
New SW: CRITICAL: Call skipWaiting()
Console: [SW] ✓ skipWaiting() completed
Old SW: Still active (for now)
```

#### Step 4: New SW Activates

```
New SW: activate event fires immediately (skipWaiting)
Console: [SW] 🚀 Activating Service Worker version: v20251227_1630
New SW: Delete old caches
Console: [SW] 🗑️ Deleting old cache: budget-v20251227_1530
Console: [SW] ✓ Deleted 1 old cache(s)
New SW: CRITICAL: Call clients.claim()
Console: [SW] 👑 Calling clients.claim() to take control
New SW: Send postMessage to all clients (SW_UPDATED)
Console: [SW] 📢 Notifying 1 client(s) about update
Console: [SW] ✓ Activation complete
Browser: controllerchange event fires in all tabs
```

#### Step 5: Version Check and Show Update Indicator

```
All Tabs: controllerchange listener fires
Console: [SW_UPDATE] ⚡ controllerchange event fired

FIRST INSTALL PATH:
  All Tabs: Check for saved version in localStorage
  Console: [SW_UPDATE] Saved version: (none - first install)
  Console: [SW_UPDATE] 🆕 First install detected - setting initial version, no indicator
  All Tabs: Save CACHE_VERSION to localStorage
  Console: [SW_UPDATE] Initial version saved: v20251227_1630
  Result: NO indicator shown, NO toast, silent activation

UPDATE AVAILABLE PATH:
  All Tabs: Request CACHE_VERSION from new SW via MessageChannel
  Console: [SW] 📩 Version request received, responding with: v20251227_1630
  Console: [SW_UPDATE] New SW version received: v20251227_1630
  All Tabs: Compare with saved version
  Console: [SW_UPDATE] Saved version: v20251227_1530

  IF version unchanged:
    Console: [SW_UPDATE] ✓ Version unchanged, no update needed
    Result: Indicator stays hidden

  ELSE (version changed):
    Console: [SW_UPDATE] 🔔 UPDATE AVAILABLE: v20251227_1530 → v20251227_1630
    All Tabs: Store update flags in localStorage
      - pwa_update_available = "true"
      - pwa_new_version = "v20251227_1630"
    All Tabs: Call showUpdateIcon()
    Console: [SW_UPDATE] Showing "new" text indicator with fade-in animation
    Console: [SW_UPDATE] ✨ "new" text indicator now visible with pulse animation
    Console: [SW_UPDATE] User can click on "new" to reload and apply update
    Result: "new" text appears in header with fade-in + subtle pulse animation
```

#### Step 6: User Clicks Update Indicator

```
User: Clicks "new" text indicator in header
Console: [SW_UPDATE] 🖱️ User clicked "new" text indicator - initiating update
Browser: Get new version from localStorage
Console: [SW_UPDATE] Updating to version: v20251227_1630
Browser: Save new version to localStorage (pwa_sw_version)
Console: [SW_UPDATE] ✓ Saved new version to localStorage: v20251227_1630
Browser: Clean up update flags (pwa_update_available, pwa_new_version)
Console: [SW_UPDATE] ✓ Cleaned up update flags from localStorage
Console: [SW_UPDATE] ⟳ Initiating page reload to apply new version...
Browser: RELOAD via window.location.reload()
Result: Page reloads, user on new version, indicator hidden
```

**Why CACHE_VERSION instead of scriptURL:**
- `scriptURL` never changes (`/sw.min.js` is always the same URL)
- `CACHE_VERSION` is the actual version identifier (e.g., `v20251227_1630`)
- Using MessageChannel for request-response pattern ensures reliable version comparison

**Key Benefits:**
- ✅ User controls when to update (no data loss from unsaved forms)
- ✅ Minimal visual notification ("new" text indicator)
- ✅ Prevents unnecessary reloads
- ✅ Silent first install (better UX)
- ✅ Multi-tab support (each tab independent)
- ✅ Comprehensive logging for debugging
- ✅ Simple, unobtrusive design (no icon, no badge)

---

### Timeline Example

| Time | Event |
|------|-------|
| 00:00 | Deploy new version to server |
| 00:00 | First user reloads page → update detected |
| 00:01 | New SW installs and activates immediately |
| 00:01 | **"new" text indicator appears in first user's header** |
| 00:15 | Second user's hourly check → update detected → **"new" indicator appears** |
| 00:45 | Third user's hourly check → update detected → **"new" indicator appears** |
| 01:00 | **All users see indicator** (max 1-hour delay) |
| 01:30 | Users click indicator when convenient → page reloads → on new version |

---

### Update Indicator UX

**Design:**
- **Indicator:** Simple "new" text (lowercase, no icon, no badge)
- **Color:** Warning color (yellow/amber for visibility)
- **Font:** Semibold, responsive (text-sm on mobile, text-base on desktop)
- **Animation:** fade-in (0.4s cubic-bezier) + subtle pulse (2.5s cycle, opacity only)
- **Position:** Header navbar-end (between WebSocket Status and Theme Toggle)
- **Tooltip:** "Доступно обновление! Нажмите для установки"

**Visibility Rules:**
- ✅ **Show:** New version detected AND not first install
- ❌ **Hide:** First install (silent activation)
- ❌ **Hide:** Version unchanged (prevents reload loops)
- ✅ **Persist:** Across page navigations (via localStorage, until clicked)
- ✅ **Multi-tab:** Independent (each tab shows indicator separately)

**localStorage State:**
- `pwa_sw_version`: Current active version (e.g., "v20251227_1530")
- `pwa_update_available`: `"true"` when update pending (cleared on click)
- `pwa_new_version`: Target version to update to (e.g., "v20251227_1630")

**User Interaction:**
1. "new" text appears with fade-in animation when update detected
2. Text pulses subtly (opacity: 1.0 → 0.6 → 1.0) to draw attention
3. User hovers → tooltip shows update message
4. User clicks → page reloads immediately
5. After reload → indicator hidden, user on new version

**Accessibility:**
- ARIA label: "Обновить приложение до новой версии"
- Keyboard accessible (standard button behavior)
- Tooltip for screen readers and visual explanation
- Reduced motion support via `@media (prefers-reduced-motion: reduce)`

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

### Test Case: First Install

**Purpose:** Verify silent activation on first-time installation

**Steps:**
1. Clear all site data (DevTools → Application → Clear storage)
2. Visit application for first time
3. Open DevTools Console

**Expected Behavior:**
- ✅ Service Worker installs successfully
- ✅ **NO update icon appears** (silent activation)
- ✅ **NO toast notification** (silent activation)
- ✅ Static cache populated

**Expected Console Logs:**
```
[SW] 📦 Installing Service Worker version: v20251227_1530
[SW] ⚡ Calling skipWaiting() for immediate activation
[SW] ✓ skipWaiting() completed
[SW] 🚀 Activating Service Worker version: v20251227_1530
[SW] ✓ Deleted 0 old cache(s)
[SW_UPDATE] ⚡ controllerchange event fired
[SW_UPDATE] Saved version: (none - first install)
[SW_UPDATE] 🆕 First install detected - setting initial version, no icon
[SW_UPDATE] Initial version saved: v20251227_1530
```

**Verification:**
```javascript
// Check localStorage
localStorage.getItem('pwa_sw_version')
// Should return: "v20251227_1530"

// Check no update flags
localStorage.getItem('pwa_update_available')
// Should return: null
```

---

### Test Case: Update Available

**Purpose:** Verify update icon appears when new version deployed

**Steps:**
1. With app already installed, update `CACHE_VERSION` in `sw.js`:
   ```bash
   cd ~/familyBudget
   scripts/update-sw-version.sh
   npm run minify:js
   ```
2. Reload page in browser (Ctrl+R / Cmd+R)
3. Observe header area (between WebSocket Status and Theme Toggle)

**Expected Behavior:**
- ✅ Star icon appears with fade-in animation
- ✅ Star pulses continuously (2s cycle)
- ✅ Badge shows "NEW" label (red)
- ✅ Tooltip shows "Доступно обновление! Нажмите для установки"
- ✅ **NO automatic reload** (waits for user click)

**Expected Console Logs:**
```
[SW] 📦 Installing Service Worker version: v20251227_1630
[SW] ⚡ Calling skipWaiting() for immediate activation
[SW] 🚀 Activating Service Worker version: v20251227_1630
[SW] 🗑️ Deleting old cache: budget-v20251227_1530
[SW] ✓ Deleted 1 old cache(s)
[SW_UPDATE] ⚡ controllerchange event fired
[SW_UPDATE] Saved version: v20251227_1530
[SW_UPDATE] New SW version received: v20251227_1630
[SW_UPDATE] 🔔 UPDATE AVAILABLE: v20251227_1530 → v20251227_1630
[SW_UPDATE] Showing update icon with animation
[SW_UPDATE] ✨ Update icon now visible
```

**Verification:**
```javascript
// Check update flags
localStorage.getItem('pwa_update_available')
// Should return: "true"

localStorage.getItem('pwa_new_version')
// Should return: "v20251227_1630"

// Check icon visibility
document.getElementById('update-available-wrapper').classList.contains('hidden')
// Should return: false
```

---

### Test Case: Manual Update (User Click)

**Purpose:** Verify page reloads when user clicks update icon

**Steps:**
1. After icon appears (from previous test case)
2. Click the star icon in header
3. Observe page behavior

**Expected Behavior:**
- ✅ Page reloads immediately (within 1 second)
- ✅ After reload, icon is hidden
- ✅ Application running on new version
- ✅ localStorage flags cleared

**Expected Console Logs (before reload):**
```
[SW_UPDATE] 🖱️ User clicked update icon - initiating update
[SW_UPDATE] Updating to version: v20251227_1630
[SW_UPDATE] ⟳ Initiating page reload...
```

**Expected Console Logs (after reload):**
```
[SW] 🚀 Activating Service Worker version: v20251227_1630
[SW_UPDATE] ⚡ controllerchange event fired
[SW_UPDATE] Saved version: v20251227_1630
[SW_UPDATE] New SW version received: v20251227_1630
[SW_UPDATE] ✓ Version unchanged, no update needed
```

**Verification:**
```javascript
// Check version updated
localStorage.getItem('pwa_sw_version')
// Should return: "v20251227_1630"

// Check update flags cleared
localStorage.getItem('pwa_update_available')
// Should return: null

localStorage.getItem('pwa_new_version')
// Should return: null

// Check icon hidden
document.getElementById('update-available-wrapper').classList.contains('hidden')
// Should return: true
```

---

### Test Case: Multi-Tab Behavior

**Purpose:** Verify each tab shows update icon independently

**Steps:**
1. Open app in Tab A
2. Open app in Tab B (new tab, same browser)
3. Deploy new version (update `sw.js`, minify)
4. Reload Tab A only
5. Observe both tabs

**Expected Behavior:**
- ✅ Tab A: Update icon appears immediately (detected update)
- ✅ Tab B: No icon yet (hasn't checked for updates)
- ✅ Reload Tab B: Update icon appears
- ✅ Both tabs can update independently (click icon in either tab)
- ✅ Each tab's localStorage managed separately for icon visibility

**Verification:**
```javascript
// In Tab A (after reload):
localStorage.getItem('pwa_update_available')
// Should return: "true"

// In Tab B (before reload):
localStorage.getItem('pwa_update_available')
// Should return: "true" (shared localStorage across tabs)

// In Tab B (before reload):
// Icon should appear after checkForPendingUpdate() on DOMContentLoaded
```

**Note:** localStorage is SHARED across tabs, but icon visibility is PER-TAB (via `updateIconShown` session variable)

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

### Cache Monitoring (Admin)

**Since version v6.2**, administrators can monitor client-side cache health via `/admin/monitoring` page.

**Metrics Displayed:**

| Metric | Description | Source |
|--------|-------------|--------|
| **Active Clients** | Number of browsers with metrics < 5min old | Client UUIDs |
| **Total SW Cache Size** | Aggregated Service Worker cache across all clients | Cache API (sampled) |
| **Pending IndexedDB Records** | Unsynced offline transactions | `IndexedDBManager.getInfo()` |
| **Storage Quota Usage** | Average browser storage utilization (%) | `navigator.storage.estimate()` |

**Individual Client Details:**
- Client ID (first 8 chars of UUID)
- SW cache size (MB)
- IDB pending count
- Storage quota usage (%)
- Last update timestamp

**Use Cases:**

1. **Cache Bloat Detection** - Identify clients with excessive cached files
2. **Offline Sync Queue Health** - Monitor pending records awaiting sync
3. **Storage Quota Issues** - Alert when clients approach 80% quota usage
4. **Client-Side Performance** - Debug slow load times due to large caches

**Collection Strategy:**
- Metrics sent **only** when admin viewing monitoring page
- Auto-refresh every 5 seconds (aligned with other metrics)
- 5-minute TTL for client data (auto-cleanup)
- Sampled SW cache estimation (80% faster than full iteration)

**Performance:**
- Collection time: ~40-100ms per client
- Network overhead: ~20-30KB per request (gzipped)
- Memory footprint: ~10MB for 100 concurrent clients

**See:** `/docs/architecture/caching-strategy.md` → "Client-Side Cache Monitoring" for detailed implementation.

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
| v5.8.0 | 2025-12-27 | Session-based splash screen (every cold start, 3s duration, sessionStorage) |
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

## PWA Splash Screen (Session-Based)

**Since:** v5.8.0
**Status:** ✅ Active

### Overview

Family Budget implements a **session-based splash screen** that displays on every cold start (app closed and reopened), not just first launch.

**Key Features:**
- ✅ Shows on EVERY cold start (close → reopen)
- ✅ Session-based detection (sessionStorage, auto-clears on tab close)
- ✅ 3-second duration with bounce animation
- ✅ Comprehensive console logging for debugging
- ✅ Graceful fallback for private browsing mode
- ❌ NO iOS native splash (`apple-touch-startup-image`) - HTML-based only

---

### Behavior

**Display Logic:**

Shows splash screen when ALL conditions met:
1. ✅ PWA mode (standalone, not browser)
2. ✅ Cold start (no `pwa_splash_shown` sessionStorage flag)
3. ✅ NOT a page reload (F5, Cmd+R)

**Duration:** Exactly 3 seconds (or until page load completes, whichever is longer)

---

### Detection Method

**Session Tracking:**
```javascript
// Cold start = no sessionStorage flag yet
var SPLASH_SESSION_KEY = 'pwa_splash_shown';

try {
    var isColdStart = !sessionStorage.getItem(SPLASH_SESSION_KEY);
} catch (e) {
    // Private mode fallback: always show splash
    var isColdStart = true;
}

// Set flag (persists until tab/window closes)
sessionStorage.setItem(SPLASH_SESSION_KEY, Date.now().toString());
```

**Why sessionStorage (not localStorage):**
- Auto-clears when tab/window closes (perfect for cold start detection)
- Persists across page reloads (F5) - prevents splash on refresh
- Per-tab isolation (each tab = separate session)

**Reload Detection:**
```javascript
var navEntry = window.performance.getEntriesByType('navigation')[0];
var isReload = navEntry && navEntry.type === 'reload';
```

---

### When Splash Shows

| Scenario | Splash Shows? | Reason |
|----------|---------------|--------|
| Close PWA → Reopen from home screen | ✅ YES | Cold start (sessionStorage cleared) |
| Close browser → Reopen PWA | ✅ YES | New session |
| First-ever launch after install | ✅ YES | New session |
| Page reload (F5, Cmd+R) | ❌ NO | Session persists, reload detected |
| In-app navigation (click links) | ❌ NO | Session persists |
| Background → Foreground | ❌ NO | Session persists, app not closed |
| Open PWA in browser mode | ❌ NO | Not standalone PWA |
| Open new tab (same browser) | ✅ YES | Separate session (sessionStorage per-tab) |

---

### Implementation

**File:** `/frontend/web/templates/base.html` (lines 492-615)

**Key Components:**

**HTML Structure:**
```html
<div id="pwa-splash" class="pwa-splash" aria-hidden="true" role="presentation">
    <div class="splash-content">
        <img src="/static/icons/icon-192.png" alt="" class="splash-icon" width="96" height="96">
    </div>
</div>
```

**CSS Animation:**
```css
.splash-icon {
    animation: splash-bounce 1s ease-in-out infinite alternate;
}

@keyframes splash-bounce {
    from { transform: translateY(0); }
    to { transform: translateY(-10px); }
}
```

**JavaScript Logic:**
- Session detection with try-catch (private mode safe)
- Performance API reload detection
- Standalone mode check (`display-mode: standalone`)
- Duration tracking with timestamps
- Comprehensive console logging (`[PWA_SPLASH]` prefix)

---

### Console Logs

**Cold Start (splash shown):**
```
[PWA_SPLASH] Display check: {isPWA: true, isColdStart: true, isReload: false, navType: "navigate", timestamp: 1735388400000}
[PWA_SPLASH] Cold start detected, showing splash {startTimestamp: 1735388400000, duration: "3s"}
[PWA_SPLASH] DOMContentLoaded fired
[PWA_SPLASH] Page loaded, checking if ready to hide
[PWA_SPLASH] Hiding splash {timerDone: true, pageLoaded: true, plannedDuration: "3s", actualDuration: "3042ms", hideTimestamp: 1735388403042}
[PWA_SPLASH] Splash removed from DOM {totalTime: "3342ms"}
```

**Page Reload (splash skipped):**
```
[PWA_SPLASH] Display check: {isPWA: true, isColdStart: false, isReload: true, navType: "reload", timestamp: 1735388450000}
[PWA_SPLASH] Skipping splash: {reason: "page reload", sessionFlag: "1735388400000", timestamp: 1735388450000}
```

**In-Session Navigation (splash skipped):**
```
[PWA_SPLASH] Display check: {isPWA: true, isColdStart: false, isReload: false, navType: "navigate", timestamp: 1735388460000}
[PWA_SPLASH] Skipping splash: {reason: "session active", sessionFlag: "1735388400000", timestamp: 1735388460000}
```

**Browser Mode (splash skipped):**
```
[PWA_SPLASH] Display check: {isPWA: false, ...}
```

---

### Performance

**Metrics:**
- Minimal overhead (inline JavaScript, no external dependencies)
- No network requests (icon precached in Service Worker)
- GPU-accelerated animation (CSS `transform: translateZ(0)`)
- Total size: ~3KB (HTML + CSS + JS combined)

**Timing:**
- Script execution: < 10ms
- DOM ready: ~100-300ms (depending on device)
- Total splash display: 3000-3300ms (planned 3s + 300ms fade-out)

---

### Accessibility

**Features:**
- ✅ `aria-hidden="true"` - Hidden from screen readers
- ✅ `role="presentation"` - No semantic meaning
- ✅ `prefers-reduced-motion` - Disables bounce animation if user preference
- ✅ High z-index (99999) - Prevents interaction during splash
- ✅ Keyboard navigation unaffected (splash removed before interaction possible)

**Reduced Motion:**
```css
@media (prefers-reduced-motion: reduce) {
    .splash-icon, .splash-content {
        animation: none;
    }
    .pwa-splash {
        transition: none;
    }
}
```

---

### Dark Mode Support

**Implementation:**
- Auto-detects `prefers-color-scheme: dark`
- DaisyUI theme-aware gradient background
- Fallback colors for non-DaisyUI scenarios

**CSS:**
```css
.pwa-splash {
    /* Light mode (default) */
    background: linear-gradient(135deg, oklch(var(--b1, 100% 0 0)) 0%, oklch(var(--b2, var(--b1, 100% 0 0))) 100%);
}

@media (prefers-color-scheme: dark) {
    .pwa-splash {
        /* Dark mode */
        background: linear-gradient(135deg, oklch(var(--b1, 25% 0.015 270)) 0%, oklch(var(--b2, var(--b1, 25% 0.015 270))) 100%);
    }
}
```

---

### Debugging

**Console Commands:**

```javascript
// Check current session state
sessionStorage.getItem('pwa_splash_shown')
// Returns: timestamp string (e.g., "1735388400000") if splash shown
// Returns: null if cold start

// Clear session to force splash on next navigation
sessionStorage.removeItem('pwa_splash_shown')
// Navigate or reload → splash should appear

// Check if in PWA mode
window.matchMedia('(display-mode: standalone)').matches
// Returns: true (PWA mode) or false (browser mode)

// Check navigation type
window.performance.getEntriesByType('navigation')[0].type
// Returns: "navigate", "reload", "back_forward", or "prerender"
```

**Remote Debugging (iOS Safari):**
1. Connect iPhone to Mac via USB
2. Safari → Develop → [iPhone Name] → [PWA]
3. Console shows all `[PWA_SPLASH]` logs
4. Test cold start: close PWA completely, reopen from home screen

---

### Edge Cases

**Private Browsing Mode:**
- sessionStorage may throw SecurityError
- Fallback: `isColdStart = true` (always show splash)
- Console warning: `[PWA_SPLASH] sessionStorage unavailable (private mode?)`

**iOS Long Sleep (5+ minutes):**
- iOS may kill tab in background
- On return: New session → splash shows (expected behavior)
- If session preserved: No splash (also correct)

**Multiple Tabs:**
- Each tab has separate sessionStorage
- Opening PWA in new tab: Shows splash (separate session)
- Switching between tabs: No splash (session persists per tab)

---

### Testing Checklist

**Manual Tests:**

1. **Cold Start:**
   - Close PWA completely → Reopen from home screen
   - Expected: Splash shows for 3 seconds with bounce

2. **Page Reload:**
   - Press F5 or Cmd+R during session
   - Expected: NO splash (session persists)

3. **In-App Navigation:**
   - Click internal link (e.g., Statistics)
   - Expected: NO splash (session persists)

4. **Background/Foreground:**
   - Switch to another app → Return to PWA
   - Expected: NO splash (session persists, app not closed)

5. **Browser Mode:**
   - Open app in regular browser (not standalone)
   - Expected: NO splash (only works in PWA mode)

6. **Multiple Tabs:**
   - Open PWA in Tab 1 → Open PWA in Tab 2
   - Expected: Tab 2 shows splash (separate session)

---

### Safari 18+ iOS Compatibility

**Tested On:**
- ✅ iOS Safari 18.0+ (iPhone 14, 15, 16)
- ✅ iOS Safari 17.0+ (backward compatible)
- ✅ Yandex Browser (iOS)

**Known Issues:**
- None (fully functional on all tested platforms)

**Optimizations:**
- GPU acceleration for smooth animation
- `dvh` units for proper viewport handling (notch support)
- Safe area insets respected (see `lists.css`)

---

### Architecture Notes

**Why NOT Native iOS Splash (`apple-touch-startup-image`):**

**User Choice:** HTML-based splash only

**Rationale:**
- ✅ More control over animation timing (3 seconds exact)
- ✅ Consistent behavior across all devices (not just iOS)
- ✅ Bounce animation impossible with static iOS splash images
- ✅ Simpler implementation (no need for 10 device-specific meta tags)
- ✅ Session-based detection works perfectly with HTML

**Trade-off:**
- ❌ Native iOS splash appears INSTANTLY (before JavaScript)
- ❌ HTML splash appears after DOM ready (~100-300ms delay)
- ✅ **For this app:** Animation control + session detection > instant display

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

## Mobile Menu Pattern for Secondary Pages

### Overview

Secondary pages (e.g., `/lists`) use custom mobile menus that differ from main app navigation while maintaining DaisyUI component structure and z-index hierarchy.

### Implementation Pattern

**Structure:**
- DaisyUI `btm-nav` for bottom navigation
- DaisyUI `dropdown` for expandable menus
- Hide on desktop via `md:hidden`
- Body/content padding to prevent overlap

**Example** (`lists.html`):
```html
<div class="btm-nav md:hidden z-50" id="page-mobile-menu">
  <button onclick="navigateHome()">Home</button>
  <div class="dropdown dropdown-top dropdown-end">
    <label tabindex="0">Add</label>
    <ul class="dropdown-content menu">
      <li><a onclick="openModal('modal_1')">Option 1</a></li>
    </ul>
  </div>
</div>

<style>
  @media (max-width: 768px) {
    #page-content { padding-bottom: 5rem; }
    .modal-open #page-mobile-menu { z-index: 40; }
  }
</style>
```

### Z-Index Management

**CRITICAL**: Mobile menu must lower z-index when modal is open to prevent overlap.

**Hierarchy**:
- Modal backdrop: `z-index: 1000`
- Modal content: `z-index: 1001`
- Choices dropdown (in modal): `z-index: 1050`
- Mobile menu (normal): `z-index: 50`
- Mobile menu (modal open): `z-index: 40`

### Testing Checklist

- [ ] Menu visible only on mobile (<768px)
- [ ] Dropdown opens upward (dropdown-top)
- [ ] No content overlap (body padding)
- [ ] Z-index lowers when modal opens
- [ ] Touch events work on iOS Safari
- [ ] PWA installed mode works correctly

---

## WebSocket RTT-Based Slow Connection Detection (v6.5.0+)

### Overview

**Since:** v6.5.0 (December 2025)
**Status:** ✅ Active

Family Budget implements **RTT-based slow connection detection** with sticky state mechanism to prevent badge flickering on mobile devices.

**Problem Solved:**
- Yellow badge flickering every 3 seconds on iPhone due to rapid reconnect cycles
- False positives: "many tabs" warning (⚠️) shown even with good network
- No differentiation between slow network and connection pressure
- Rapid badge state changes causing poor UX

**Solution:**
- ✅ Real RTT measurement during ping-pong exchange
- ✅ Sticky state (minimum 5s between badge changes)
- ✅ Dual warning states (🐌 slow connection vs ⚠️ many tabs)
- ✅ Enhanced iOS debouncing (2s vs 1s)
- ✅ Comprehensive logging ([WS_RTT], [WS_STATE])

---

### RTT Measurement Algorithm

**Method:** Ping-Pong Round-Trip Time Calculation

**How It Works:**
1. Record timestamp when client sends ping (`Date.now()`)
2. Server echoes pong back to client
3. Calculate RTT: `pongReceived - pingSent`
4. Store last 5 measurements in rolling window
5. Calculate rolling average (smooth network spikes)
6. Compare to threshold (2000ms)

**Rolling Average Benefits:**
- Smooths temporary network spikes
- Prevents false positives from single slow packet
- More reliable than single measurement
- Adapts to changing network conditions

**Implementation:**

```javascript
// budgetWSClient.js constructor
this._rttMeasurements = [];      // Rolling window of last 5 RTT measurements
this._rttRollingAverage = 0;     // Average of last 5 measurements
this._pingTimestamp = null;      // Timestamp when ping sent
this.RTT_THRESHOLD = 2000;       // Slow connection threshold (ms)
this.RTT_WINDOW_SIZE = 5;        // Number of measurements to average

// Before sending ping
this._pingTimestamp = Date.now();
this._log('PING', 'debug', 'Sending client ping', {
    timestamp: this._pingTimestamp
});

// On pong received
const rtt = this._pingTimestamp ? (Date.now() - this._pingTimestamp) : 0;

// Store measurement (skip first if anomalous > 4000ms)
if (this._rttMeasurements.length > 0 || rtt < this.RTT_THRESHOLD * 2) {
    this._rttMeasurements.push(rtt);

    // Keep only last 5 measurements
    if (this._rttMeasurements.length > this.RTT_WINDOW_SIZE) {
        this._rttMeasurements.shift();
    }

    // Calculate rolling average
    this._rttRollingAverage = this._rttMeasurements.reduce((a, b) => a + b, 0)
        / this._rttMeasurements.length;
}

// Log RTT data
this._log('RTT', 'info', 'RTT measured', {
    current: `${rtt}ms`,
    rolling_avg: `${Math.round(this._rttRollingAverage)}ms`,
    measurements: this._rttMeasurements.length,
    threshold: `${this.RTT_THRESHOLD}ms`
});
```

**First Measurement Handling:**
- Skip first RTT if > 4000ms (connection establishment overhead)
- Prevents false positive from initial handshake
- Subsequent measurements must be < 4000ms (2x threshold)

---

### Sticky State Mechanism

**Purpose:** Prevent badge state changes more frequently than once every 5 seconds.

**Why It's Needed:**
- Previous implementation: Badge could change every 500-1000ms (debounce period)
- User impact: Visual flicker, confusing UX
- Solution: Enforce minimum 5s between state transitions

**Implementation:**

```javascript
// budgetWSClient.js constructor
this._lastStateChangeTime = 0;   // Timestamp of last badge state change
this._currentBadgeState = null;  // Current badge state
this.STICKY_STATE_DURATION = 5000; // Minimum 5s between state changes

/**
 * Check if state change is allowed (sticky state enforcement)
 * @param {string} newState - Proposed new state
 * @returns {boolean} - True if change allowed
 */
_canChangeState(newState) {
    const now = Date.now();
    const timeSinceLastChange = now - this._lastStateChangeTime;

    // Exception 1: Allow immediate transition FROM error states TO connected
    const isRecovery = (
        (this._currentBadgeState === 'error' ||
         this._currentBadgeState === 'limit_reached') &&
        (newState === 'connected' || newState === 'connected_via_leader')
    );

    if (isRecovery) {
        this._log('STATE', 'info', 'Allowing immediate recovery transition', {
            from: this._currentBadgeState,
            to: newState
        });
        return true;
    }

    // Exception 2: First state change (no previous state)
    if (!this._currentBadgeState) {
        return true;
    }

    // Enforce sticky state duration
    if (timeSinceLastChange < this.STICKY_STATE_DURATION) {
        this._log('STATE', 'debug', 'State change blocked by sticky state', {
            current_state: this._currentBadgeState,
            proposed_state: newState,
            time_since_last: `${timeSinceLastChange}ms`,
            required: `${this.STICKY_STATE_DURATION}ms`
        });
        return false;
    }

    return true;
}

/**
 * Record state change timestamp
 * @param {string} newState
 */
_recordStateChange(newState) {
    const oldState = this._currentBadgeState;
    this._currentBadgeState = newState;
    this._lastStateChangeTime = Date.now();

    this._log('STATE', 'info', 'Badge state changed', {
        from: oldState || 'none',
        to: newState,
        timestamp: this._lastStateChangeTime
    });
}
```

**Recovery Exception:**
- Error → Connected: Immediate transition (no 5s wait)
- Limit Reached → Connected: Immediate transition
- Rationale: User should see good news immediately

**First State Exception:**
- First state change: No delay (initialize immediately)
- Prevents 5s blank badge on page load

---

### Badge State Decision Logic

**8 Distinct States (Priority Order):**

| Priority | State | Badge | Condition | Tooltip |
|----------|-------|-------|-----------|---------|
| 1 (Highest) | `disabled` | ⚪ Gray | `!enabled` | Offline mode - real-time disabled |
| 2 | `limit_reached` | 🔴 Red | `limitReached` | Connection limit reached. Close other tabs |
| 3 | `error` | 🔴 Red | `reconnectAttempts >= maxReconnectAttempts` | Connection error. Refresh page |
| 4 | `warning_slow` | 🐌 Yellow | `isConnected && rttAvg > 2000ms` | Slow connection detected (XXXms RTT) |
| 5 | `warning_tabs` | ⚠️ Yellow | `isConnected && connectionPressure >= 0.7` | Many connections. Close unused tabs |
| 6 | `connected` | 💚 Green | `isConnected && normal RTT && few tabs` | Real-time sync active |
| 7 | `connected_via_leader` | 💚 Green | `!isLeader && multiTab && recentHeartbeat` | Sync via another tab |
| 8 | `reconnecting` | 🔄 Yellow | `0 < reconnectAttempts < max` | Reconnecting (X/5) |
| 9 (Lowest) | `connecting` | 🔄 Yellow | Initial connection | Connecting... |

**NEW: Dual Warning States:**

**Before v6.5.0:**
- Only one yellow state: "Many connections" (connectionPressure >= 0.7)
- No RTT-based detection → False positives
- User sees yellow badge even with good network + 7 tabs

**After v6.5.0:**
- `warning_slow` (🐌): Actual slow network (RTT > 2000ms)
- `warning_tabs` (⚠️): Connection pressure (7+ tabs)
- Clear differentiation → Better UX

**State Decision Code:**

```javascript
_updateStatusIndicator() {
    // STEP 1: Determine current state (priority order)
    let state;

    if (!this.enabled) {
        state = 'disabled';
    }
    // PRIORITY 1: Error states (highest priority)
    else if (this.limitReached) {
        state = 'limit_reached';
    }
    else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        state = 'error';
    }
    // PRIORITY 2: Connected states with warnings
    else if (this.isConnected) {
        // Check slow connection (RTT-based)
        const isSlowConnection = this._rttRollingAverage > this.RTT_THRESHOLD;

        // Check many tabs (connection pressure)
        const isManyTabs = this.approachingLimit;  // >= 0.7

        if (isSlowConnection) {
            state = 'warning_slow';
        } else if (isManyTabs) {
            state = 'warning_tabs';
        } else {
            state = 'connected';
        }
    }
    // PRIORITY 3: Multi-tab follower
    else if (!this.isLeader && this._supportsMultiTab() && this.lastLeaderHeartbeat > 0) {
        state = 'connected_via_leader';
    }
    // PRIORITY 4: Reconnecting
    else if (this.reconnectAttempts > 0 && this.reconnectAttempts < this.maxReconnectAttempts) {
        state = 'reconnecting';
    }
    // PRIORITY 5: Connecting (initial)
    else {
        state = 'connecting';
    }

    // STEP 2: Check if state same as before
    if (state === this._lastIndicatorState) {
        return;
    }

    // STEP 3: Sticky state check (with exceptions for recovery)
    if (!this._canChangeState(state)) {
        return;  // State change blocked
    }

    // STEP 4: Apply debouncing
    const isConnectedState = state === 'connected' || state === 'connected_via_leader';

    if (this._iosDeviceMode) {
        // iOS: debounce ALL states if timer active
        if (this._indicatorDebounceTimer) {
            return;
        }
    } else {
        // Non-iOS: allow connected states immediately
        if (!isConnectedState && this._indicatorDebounceTimer) {
            return;
        }
    }

    // STEP 5: Record state change (before applying visual update)
    this._recordStateChange(state);
    this._lastIndicatorState = state;

    // STEP 6: Clear pending debounce timer
    if (this._indicatorDebounceTimer) {
        clearTimeout(this._indicatorDebounceTimer);
        this._indicatorDebounceTimer = null;
    }

    // STEP 7: Apply visual update
    this._applyIndicatorState(indicator, state);

    // STEP 8: Set debounce timer for next update (ENHANCED: 2s on iOS)
    const shouldDebounce = this._iosDeviceMode || !isConnectedState;
    if (shouldDebounce) {
        const debounceMs = this._iosDeviceMode ? 2000 : this.INDICATOR_DEBOUNCE_MS;
        this._indicatorDebounceTimer = setTimeout(() => {
            this._indicatorDebounceTimer = null;
        }, debounceMs);
    }
}
```

---

### Enhanced iOS Debouncing

**Problem:** iOS Safari's aggressive background tab suspension causes rapid reconnects.

**Previous Implementation:**
- iOS: 1000ms debouncing
- Non-iOS: 500ms debouncing
- Issue: Not enough to prevent flicker on rapid reconnects

**New Implementation:**
- iOS: **2000ms debouncing** (doubled)
- Non-iOS: 500ms debouncing (unchanged)
- Connected states: Immediate (no debouncing)

**Rationale:**
- 2s delay acceptable for non-connected states (error, reconnecting)
- Connected state changes should be immediate (good news)
- Prevents flicker from rapid reconnect cycles

---

### Comprehensive Logging

**New Logger Modules:**
- **[WS_RTT]** - RTT measurement logging
- **[WS_STATE]** - Badge state transition logging

**Logging Router (_log method):**

```javascript
/**
 * Centralized logging helper with module prefix
 * @param {string} module - Module name (RTT, STATE, PING, PONG, etc.)
 * @param {string} level - Log level (debug, info, warn, error)
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
_log(module, level, message, data = {}) {
    const logger = module === 'RTT' ? logWSRTT :
                   module === 'STATE' ? logWSState :
                   module === 'PONG' ? logWSDiag :
                   module === 'PING' ? logWSDiag :
                   logWSDiag;

    const logFn = logger[level] || logger.info;

    if (data && Object.keys(data).length > 0) {
        logFn.call(logger, message, data);
    } else {
        logFn.call(logger, message);
    }
}
```

**Example Console Logs:**

```
[WS_RTT] RTT measured { current: "1850ms", rolling_avg: "1920ms", measurements: 5, threshold: "2000ms" }
[WS_RTT] RTT measured { current: "2150ms", rolling_avg: "2010ms", measurements: 5, threshold: "2000ms" }
[WS_RTT] Slow connection detected { avg_rtt: "2010ms", threshold: "2000ms" }
[WS_STATE] Badge state changed { from: "connected", to: "warning_slow", timestamp: 1735388400000 }

[WS_STATE] State change blocked by sticky state { current_state: "warning_slow", proposed_state: "connected", time_since_last: "1200ms", required: "5000ms" }
[WS_STATE] Allowing immediate recovery transition { from: "error", to: "connected" }
```

**Configuration:**

Logging controlled via `/frontend/web/static/js/config/logging.js`:

```javascript
modules: {
    // ... existing modules ...
    WS_RTT: true,         // RTT measurement logging
    WS_STATE: true,       // Badge state transition logging
    // ...
}
```

**Disable in Production:**

```javascript
// Set to false to disable console logs
WS_RTT: false,
WS_STATE: false,
```

---

### Diagnostics Integration

**Triple-Tap Modal Enhancements:**

New sections added to WebSocket diagnostics modal:

**RTT Metrics Section:**
- Rolling Avg RTT (ms)
- Measurements count (0-5)
- Threshold (2000ms)
- Slow Connection flag (true/false)

**State Management Section:**
- Current State (e.g., "warning_slow", "connected")
- Last Change timestamp
- Sticky Duration (5000ms)

**Access Diagnostics:**
1. Triple-tap WebSocket badge in header
2. Scroll to "RTT Metrics" and "State Management" sections
3. Verify values match console logs

**Code Integration:**

```javascript
// In diagnose() method
rtt: {
    current: this._pingTimestamp
        ? `${Date.now() - this._pingTimestamp}ms`
        : 'no ping sent',
    rolling_average: `${Math.round(this._rttRollingAverage)}ms`,
    measurements: this._rttMeasurements,
    threshold: `${this.RTT_THRESHOLD}ms`,
    slow_connection: this._rttRollingAverage > this.RTT_THRESHOLD
},

state: {
    current: this._currentBadgeState,
    last_change: this._lastStateChangeTime
        ? new Date(this._lastStateChangeTime).toISOString()
        : null,
    sticky_duration: `${this.STICKY_STATE_DURATION}ms`
},
```

---

### Testing Procedures

#### Test 1: RTT Measurement Verification

**Browser Console:**
```javascript
// Check RTT data structure
window.budgetWSClient.diagnose().rtt

// Expected output:
{
  current: "1850ms",
  rolling_average: "1920ms",
  measurements: [1850, 1900, 1920, 1950, 1980],
  threshold: "2000ms",
  slow_connection: false
}
```

#### Test 2: Slow Connection Simulation

**Chrome DevTools → Network → Throttling:**

1. Set throttling to "Slow 3G" (or custom with 2000ms+ latency)
2. Wait 75 seconds (5 RTT measurements at 15s ping interval)
3. Expected: Badge shows 🐌 snail emoji (yellow)
4. Tooltip: "Slow connection detected (XXXXms RTT)"

**Console Logs:**
```
[WS_RTT] RTT measured { current: "2100ms", rolling_avg: "2050ms", ... }
[WS_RTT] Slow connection detected { avg_rtt: "2050ms", threshold: "2000ms" }
[WS_STATE] Badge state changed { from: "connected", to: "warning_slow" }
```

#### Test 3: Sticky State Verification

**Rapidly open/close 8+ tabs:**

1. Open 8 browser tabs quickly
2. Close 2 tabs (drops below 7)
3. Open 3 more tabs (back above 7)
4. Expected: Badge should NOT flicker
5. Console logs:
   ```
   [WS_STATE] State change blocked by sticky state { time_since_last: "1200ms", required: "5000ms" }
   ```

#### Test 4: Many Tabs Warning

**Open 7-9 tabs:**

1. Open 7 tabs with same app
2. Expected: Badge shows ⚠️ warning triangle (yellow)
3. Tooltip: "Many connections. Close unused tabs"
4. Console:
   ```
   [WS_STATE] Badge state changed { from: "connected", to: "warning_tabs" }
   ```

#### Test 5: Recovery Transition (Error → Connected)

**Disconnect and reconnect internet:**

1. Disconnect Wi-Fi → Red badge (error)
2. Reconnect Wi-Fi immediately
3. Expected: Immediate green badge (no 5s sticky state delay)
4. Console:
   ```
   [WS_STATE] Allowing immediate recovery transition { from: "error", to: "connected" }
   ```

#### Test 6: iPhone Real Device Testing

**Safari on iPhone (iOS 16+):**

1. Open app in Safari
2. Lock phone for 10 minutes
3. Unlock phone
4. Expected: Green badge within 60 seconds (no yellow flicker)
5. Check console logs via Safari Web Inspector (Mac)

---

### Performance Impact

**Metrics:**

| Metric | Impact | Overhead |
|--------|--------|----------|
| RTT Calculation | Per ping-pong cycle | < 1ms |
| Memory Overhead | 5 RTT measurements | ~40 bytes |
| Logging Overhead | Per state change | < 5ms (can be disabled) |
| Badge Update Frequency | Reduced significantly | From 500-1000ms to 5s minimum |
| Network Impact | None | Uses existing ping-pong mechanism |

**Conclusion:** Minimal performance impact with significant UX improvement.

---

### Configuration Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `RTT_THRESHOLD` | 2000ms | Balance between sensitivity and false positives |
| `RTT_WINDOW_SIZE` | 5 | Smooth network spikes without excessive memory |
| `STICKY_STATE_DURATION` | 5000ms | Prevent flicker while remaining responsive |
| iOS debouncing | 2000ms | Doubled from 1000ms to prevent rapid reconnect flicker |
| Non-iOS debouncing | 500ms | Unchanged (desktop connections more stable) |
| First RTT skip threshold | 4000ms | Avoid connection establishment overhead |

---

### Troubleshooting

**Issue: Badge stuck on yellow (slow connection) despite good network**

**Diagnosis:**
```javascript
// Check RTT measurements
window.budgetWSClient.diagnose().rtt
// Look for: rolling_average > 2000ms
```

**Possible causes:**
1. Server overload (backend slow to respond to pings)
2. Network congestion (packet loss, high latency)
3. Browser throttling (background tab, power saver mode)

**Solution:**
- Check server health (CPU, memory)
- Test network latency: `ping your-server.com`
- Disable browser power saver
- Adjust RTT_THRESHOLD if false positives persist

**Issue: Badge flickering despite sticky state**

**Diagnosis:**
```javascript
// Check state change logs
// Look for: "State change blocked by sticky state"
// If missing → sticky state not enforcing
```

**Possible causes:**
1. State changes happening exactly 5s apart (edge case)
2. Recovery exceptions triggering too often (error → connected → error loop)

**Solution:**
- Increase STICKY_STATE_DURATION to 10s (temporary)
- Check for connection stability issues
- Review error logs for reconnect loop causes

**Issue: No RTT measurements recorded**

**Diagnosis:**
```javascript
window.budgetWSClient.diagnose().rtt
// Expected: measurements array with 0-5 values
// If empty → ping-pong not working
```

**Possible causes:**
1. WebSocket not connected
2. Server not responding to pings
3. Pong handler not executing

**Solution:**
- Check WebSocket connection state
- Verify server ping-pong implementation
- Check browser console for JavaScript errors

---

### Version History

| Version | Date | Changes |
|---------|------|---------|
| v6.5.0 | 2025-12-27 | Initial RTT detection + sticky state implementation |

---

### Related Documentation

- [WebSocket Recovery After Long Sleep](#websocket-recovery-after-long-sleep-iosmobile) - Multi-layer wake detection
- [WebSocket Diagnostics Modal](#websocket-diagnostics-modal) - Triple-tap debugging interface
- [Mobile Features](#mobile-features) - iOS Safari compatibility patterns

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

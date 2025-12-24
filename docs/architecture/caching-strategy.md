# Caching Strategy

**Last Updated:** 2025-12-23
**Version:** v6.1

## Overview

Family Budget application uses a multi-layer caching strategy to optimize performance while ensuring data freshness:

1. **Redis Cache (Backend)** - Reference data and dashboard stats
2. **HTTP Cache Headers** - Browser and Service Worker directives
3. **Service Worker (Frontend)** - Offline-first PWA support
4. **IndexedDB (Frontend)** - Local offline storage

---

## HTTP Cache Headers

### Facts API (`/api/v1/facts`)

**Policy:** `private, no-cache, must-revalidate`

```http
Cache-Control: private, no-cache, must-revalidate
Pragma: no-cache
Vary: Cookie
```

**Rationale:**
- **Frequently changing data** - Transactions are created/edited often
- **User-specific** - Different users see different data (JWT auth)
- **Freshness critical** - Must show latest data immediately after mutations

**Implementation:** `backend/app/api/v1/endpoints/facts.py:440-444`

### Reference Data (`/api/v1/articles`, `/api/v1/financial-centers`, `/api/v1/cost-centers`)

**Policy:** `private, max-age=300` (5 minutes)

**Rationale:**
- **Rarely changing** - Categories, accounts, cost centers don't change often
- **Safe to cache longer** - Stale data acceptable for 5 minutes
- **Performance boost** - Reduces DB load for frequently accessed data

**Implementation:** Redis cache with 300s TTL (CacheTTL.REFERENCE)

### Dashboard Widgets (`/api/v1/analytics/quick-stats-html`, `/api/v1/facts/recent-html`)

**Policy:** Redis cache with 10-30s TTL

**Rationale:**
- **Moderate freshness** - Acceptable to be slightly out of date
- **High request frequency** - Dashboard loaded on every page visit
- **DB query optimization** - Stats aggregation is expensive

**Implementation:** Redis cache with CacheTTL.DASHBOARD (30s) and CacheTTL.SHORT (10s)

---

## Redis Cache (Backend)

### Cache Keys

| Prefix | TTL | Use Case | Example |
|--------|-----|----------|---------|
| `articles:*` | 300s | Article list, tree, single article | `cache:articles:list` |
| `financial_centers:*` | 300s | Financial center list, single FC | `cache:financial_centers:list` |
| `cost_centers:*` | 300s | Cost center list, single CC | `cache:cost_centers:list` |
| `dashboard:*` | 30s | Quick stats, account balances | `cache:dashboard:quick_stats` |
| `recent:*` | 10s | Recent transactions HTML | `cache:recent:html:10` |

### Read-Through Cache Pattern

```python
# Get or set pattern
cached = await cache_service.get(key)
if cached:
    return cached  # Cache HIT

data = await fetch_from_db()  # Cache MISS
await cache_service.set(key, data, ttl)
return data
```

**Implementation:** `backend/app/services/cache_service.py`

### Cache Invalidation

#### Rule: Always AWAIT Cache Invalidation

**❌ WRONG:**
```python
asyncio.create_task(cache_service.invalidate_dashboard())  # Fire-and-forget
return response  # Returns BEFORE cache cleared!
```

**✅ CORRECT:**
```python
await cache_service.invalidate_dashboard()  # Wait for cache to clear
return response  # Cache guaranteed to be cleared
```

**Why:** Ensures subsequent requests get fresh data, prevents race conditions where stale cached data is served after mutations.

**Performance Impact:** Cache invalidation adds ~5-20ms latency, acceptable for data freshness.

#### Invalidation Triggers

| Mutation | Invalidates | Implementation |
|----------|-------------|----------------|
| **Create/Update/Delete Fact** | `dashboard:*`, `recent:*` | `facts.py:383, 1252, 1347, 1458` |
| **Create/Update/Delete Article** | `articles:*` | `cache_service.invalidate_articles()` |
| **Create/Update/Delete Financial Center** | `financial_centers:*` | `cache_service.invalidate_financial_centers()` |
| **Create/Update/Delete Cost Center** | `cost_centers:*` | `cache_service.invalidate_cost_centers()` |
| **Transfer Operation** | `dashboard:*`, `recent:*` | Same as facts |

**Pattern-Based Invalidation:**
```python
# Invalidates all keys matching pattern
await cache_service.invalidate_pattern("articles:*")
```

---

## Service Worker Caching

### Strategies by Resource Type

| Resource | Strategy | Details |
|----------|----------|---------|
| `/api/*` | **Network First** | Always fetch; cache as fallback (offline) |
| HTML pages (`/facts`, `/plan`) | **Network First** | Fresh content preferred |
| `.css`, `.js`, `.png` | **Cache First + SWR** | Serve cached; update in background |
| Static assets (icons, manifest) | **Precache** | Installed on service worker activation |
| Health endpoints (`/health`, `/ping`) | **Bypass SW** | Never cached |

**Network First for API:**
```javascript
// sw.js pattern
fetch(request)
    .then(response => {
        cache.put(request, response.clone());  // Update cache
        return response;  // Return fresh data
    })
    .catch(() => caches.match(request));  // Fallback to cache (offline)
```

**Cache First for Static Files:**
```javascript
caches.match(request)
    .then(response => response || fetch(request));  // Cache hit or network
```

**Stale-While-Revalidate:**
- Serve from cache immediately
- Fetch in background
- Update cache with fresh data

**Implementation:** `frontend/web/static/sw.js`

---

## IndexedDB (Frontend)

### Offline Storage

| Store | Purpose | Cleanup |
|-------|---------|---------|
| `offline_facts` | Offline transactions | On successful sync |
| `offline_plans` | Offline budget plans | On successful sync |
| `sync_queue` | Pending operations | On sync completion |
| `data_cache` | Reference data (articles, etc.) | TTL expiry check |

**Background Sync:**
- Chrome/Edge: Native Background Sync API
- Other browsers: Manual sync on network restore

**Deduplication:**
- `sync_hash` and `content_hash` prevent duplicate records
- Server-side deduplication on `/api/v1/facts` (24-hour window)

**Implementation:** `frontend/web/static/js/idb.js`

---

## Cache Busting

### Query Parameter Strategy

```javascript
// Cache-busting for dynamic queries
const url = `/api/v1/facts?date_from=${date}&_t=${Date.now()}`;
```

**Service Worker honors `ignoreSearch: true`:**
- `.css?v=123` matches `.css?v=456` (same cache entry)
- Prevents cache fragmentation for static files

### ETag Support

```javascript
// Service Worker checks ETag in background
if (cachedResponse.headers.get('etag') !== freshResponse.headers.get('etag')) {
    cache.put(request, freshResponse);  // Update cache
}
```

### Static File Versioning

The application uses **timestamp-based query parameters** for cache busting of static files.

**Mechanism:**
- All `.min.js` and `.min.css` files include `?v=PLACEHOLDER` in templates
- During deployment, `scripts/lib/cache_busting.sh` replaces `PLACEHOLDER` with timestamp (`YYYYMMDD_HHMM`)
- Example: `choices.min.css?v=20251224_1430`

**Supported paths:**
- `/static/` - Web application static files
- `/webapp/` - Telegram WebApp static files
- `/shared/` - Shared modules
- `/vendor/` - Third-party libraries (Choices.js, HTMX, etc.)

**Workflow:**
```bash
# Deployment pipeline
deploy.sh → minification → cache_busting.sh → version update
```

**Script:** `scripts/lib/cache_busting.sh`
- `update_cache_versions()` - Replaces `?v=PLACEHOLDER` or old versions with new timestamp
- `check_cache_versions()` - Audits current versions in templates
- `run_cache_busting(mode)` - Entry point (`auto`, `check`, `manual`)

**Regex patterns:**
```perl
# Matches all static files with ?v= parameter
s{(\/static\/js\/(?:[a-zA-Z_\-]+\/)?)([a-zA-Z_\-]+\.(?:min\.)?js)\?v=(PLACEHOLDER|[0-9]+_[0-9]+)}{\$1\$2?v=${version}}g;
s{(\/static\/css\/(?:[a-zA-Z_\-]+\/)?)([a-zA-Z_\-]+\.(?:min\.)?css)\?v=(PLACEHOLDER|[0-9]+_[0-9]+)}{\$1\$2?v=${version}}g;
```

**Files covered:**
- 26+ templates (web + webapp)
- All minified files (vendor libraries + custom modules)

### Service Worker Versioning (Separate Strategy)

**Why different from static files:**
- Service Worker **content itself changes** - no query parameters needed
- Delivered via **nginx** with `Cache-Control: no-cache, must-revalidate`
- Browser always checks for updates on every page load

**Mechanism:**
- Internal `CACHE_VERSION` constant in `sw.js`:
  ```javascript
  const CACHE_VERSION = 'CACHE_VERSION_PLACEHOLDER';
  ```
- During deployment, `scripts/update-sw-version.sh` replaces placeholder with timestamp:
  ```javascript
  const CACHE_VERSION = 'v20251224_1430';
  ```

**Delivery architecture:**
- **Full profile (production):** Nginx serves `sw.min.js` and `sw.min.js.gz`
  ```nginx
  location = /sw.min.js {
      alias /usr/share/nginx/html/sw.min.js;
      gzip_static on;  # Serve pre-compressed .gz version
      add_header Cache-Control "no-cache, no-store, must-revalidate" always;
      add_header Service-Worker-Allowed "/" always;
  }
  ```
- **Basic profile:** FastAPI backend serves from `/app/sw.min.js`

**Why nginx (not backend):**
- ✅ Performance: `gzip_static on` serves pre-compressed `.gz` files
- ✅ No backend involvement: Static file serving optimized for nginx
- ✅ HTTP/2 push capability (if enabled)
- ✅ Cache headers: Already has `no-cache` headers

**Architecture decision:** Do NOT move to backend delivery (loses performance benefits).

**Validation:** `deploy.sh` aborts deployment if `CACHE_VERSION_PLACEHOLDER` remains (lines 1175-1199).

### Developer Guidelines

**Adding new static files:**
1. Always add `?v=PLACEHOLDER` to `<link>` and `<script>` tags:
   ```html
   <!-- ✅ CORRECT -->
   <link rel="stylesheet" href="/static/css/vendor/newlib.min.css?v=PLACEHOLDER">
   <script src="/static/js/vendor/newlib.min.js?v=PLACEHOLDER"></script>

   <!-- ❌ WRONG - missing cache busting -->
   <link rel="stylesheet" href="/static/css/vendor/newlib.min.css">
   <script src="/static/js/vendor/newlib.min.js"></script>
   ```

2. **Vendor libraries** (third-party): Same rule applies
   - Choices.js, HTMX, ECharts, etc. all use `?v=PLACEHOLDER`

3. **Testing before commit:**
   ```bash
   # Check current versions
   ./scripts/lib/cache_busting.sh check

   # Manual update (for testing)
   ./scripts/lib/cache_busting.sh manual
   ```

4. **Deployment validation:**
   - `deploy.sh` automatically runs `cache_busting.sh`
   - Deployment fails if Service Worker cache version still has `PLACEHOLDER`
   - All templates updated with new timestamp version

**File coverage checklist:**
- [ ] Web templates: `frontend/web/templates/*.html`
- [ ] Webapp templates: `frontend/webapp/*.html`
- [ ] Supports subdirectories: `/vendor/`, `/offline/`, `/budget/`

---

## Testing Cache Behavior

### Clear All Caches

```bash
# Browser: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

# Redis: Flush database
docker compose exec redis redis-cli FLUSHDB

# Service Worker: Chrome DevTools → Application → Clear storage
```

### Verify HTTP Headers

```bash
# Check Cache-Control headers
curl -I https://budget-dev.ikeniborn.ru/api/v1/facts

# Expected output:
# Cache-Control: private, no-cache, must-revalidate
# Pragma: no-cache
# Vary: Cookie
```

### Monitor Cache Hits/Misses

```bash
# Backend logs (DEBUG level)
docker compose logs backend | grep "Cache HIT\|Cache MISS"

# Example output:
# Cache HIT for articles list
# Cache MISS for dashboard:quick_stats
```

---

## Performance Metrics

### Before Cache Optimization

| Operation | Time | Notes |
|-----------|------|-------|
| Dashboard load | ~2-3s | 3 separate DB queries |
| Facts list | ~300-800ms | Single query with JOINs |
| Article list | ~200-400ms | Hierarchical query |

### After Cache Optimization

| Operation | Time | Improvement |
|-----------|------|-------------|
| Dashboard load | ~500ms-1s | 60-70% faster (cache hits) |
| Facts list | ~300-800ms | Same (no cache) |
| Article list | ~50-100ms | 75-80% faster (cache hits) |

**Cache Hit Rate (Production):**
- Reference data: ~90% (TTL=300s)
- Dashboard stats: ~70% (TTL=30s)
- Recent transactions: ~60% (TTL=10s)

---

## Common Issues & Solutions

### Issue: Stale Data After Mutation

**Symptoms:** Creating a transaction shows old data in table, updates after delay.

**Root Cause:** Async cache invalidation not awaited:
```python
asyncio.create_task(cache_service.invalidate_dashboard())  # NOT awaited
return response  # Returns BEFORE cache cleared
```

**Fix:** Await the invalidation:
```python
await cache_service.invalidate_dashboard()  # AWAIT it
return response  # Cache guaranteed cleared
```

**Reference:** Commit `fix(cache): await cache invalidation to prevent stale data display`

### Issue: Service Worker Caching Dynamic Data

**Symptoms:** `/api/v1/facts` responses cached by Service Worker despite changes.

**Solution:** HTTP Cache-Control headers override SW behavior:
```python
response.headers["Cache-Control"] = "private, no-cache, must-revalidate"
```

Service Worker respects `no-cache` and always revalidates with server.

### Issue: Cache Not Invalidating

**Symptoms:** Changes not reflected after mutation.

**Debug Steps:**
1. Check Redis logs: `docker compose logs redis`
2. Verify cache key patterns match: `cache:dashboard:*`
3. Ensure invalidation is awaited
4. Check TTL hasn't already expired

---

## References

### Related Files

- `backend/app/services/cache_service.py` - Redis cache service
- `backend/app/api/v1/endpoints/facts.py` - Facts API with cache invalidation
- `frontend/web/static/sw.js` - Service Worker caching logic
- `frontend/web/static/js/idb.js` - IndexedDB offline storage

### Architecture Docs

- `/docs/architecture/README.md` - Architecture overview
- `/docs/architecture/frontend-loading-patterns.md` - Frontend loading strategies
- `/docs/architecture/backup-system.md` - Data persistence and backups

### External Resources

- [HTTP Caching - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Service Worker API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [IndexedDB API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Redis Cache Patterns](https://redis.io/docs/manual/patterns/)

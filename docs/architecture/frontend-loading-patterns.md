# Frontend Loading Patterns

**Last Updated:** 2025-12-23
**Version:** v6.1

## Overview

Family Budget frontend uses a combination of HTMX, JavaScript fetch, and WebSocket for efficient data loading and real-time updates. This document describes loading patterns, best practices, and common pitfalls.

---

## Page Initialization Patterns

### Dashboard (index.html)

**Pattern:** Parallel HTMX requests on page load

```html
<!-- Quick Stats Card -->
<div hx-get="/api/v1/analytics/quick-stats-html" hx-trigger="load" hx-swap="innerHTML">
    <div class="loading loading-spinner"></div>
</div>

<!-- Account Balances -->
<div hx-get="/api/v1/analytics/account-balances-html" hx-trigger="load" hx-swap="innerHTML">
    <div class="loading loading-spinner"></div>
</div>

<!-- Recent Transactions -->
<div hx-get="/api/v1/facts/recent-html?limit=10" hx-trigger="load" hx-swap="innerHTML">
    <div class="loading loading-spinner"></div>
</div>
```

**Characteristics:**
- **3 parallel HTTP requests** on page load
- **HTMX automatic handling** of loading states
- **Server-side HTML generation** (Jinja2 templates)
- **Redis caching** (10-30s TTL) reduces DB load

**Performance:**
- First load: ~1-2s (cold cache)
- Subsequent loads: ~300-500ms (warm cache)

**Refresh triggers:** WebSocket events (`fact_created`, `fact_updated`, `fact_deleted`)

---

### Facts/Plan Pages (facts.html, plan.html)

**Pattern:** JavaScript fetch with manual DOM manipulation

```javascript
// Page initialization (DOMContentLoaded event)
async function initializePage() {
    try {
        // Phase 1: Load independent reference data (parallel)
        await Promise.all([
            loadUsers(),
            loadFinancialCenters(),
            loadCostCenters()
        ]);

        // Phase 2: Load articles (may depend on hierarchy)
        await loadArticles();

        // Phase 3: Load facts (depends on all reference data being ready)
        await loadFacts();

    } catch (error) {
        console.error('Initialization failed:', error);
        showErrorNotification('Failed to load page data. Please refresh.');
    }
}
```

**Characteristics:**
- **Sequential phased loading** prevents race conditions
- **Awaited promises** ensure data dependencies are met
- **Global variables** (allCategories, allFinancialCenters) populated before facts render
- **No HTMX** - pure JavaScript fetch + DOM manipulation

**Load sequence:**
1. Reference data (users, FCs, CCs) - parallel (**~300ms**)
2. Articles - sequential (**~200ms**, depends on hierarchy)
3. Facts table - sequential (**~500ms**, depends on filters)

**Total load time:** ~1000ms (first load), ~600ms (cached)

**Why not parallel for all?**
- `loadFacts()` may reference `allCategories` for rendering
- Race condition risk if facts load before categories
- Better UX: show complete data at once vs. partial/flickering render

---

## Data Loading Functions

### loadFacts() - Fetch and Render Transactions

```javascript
async function loadFacts() {
    const container = document.getElementById('facts-table-container');

    // Show loading state
    container.innerHTML = '<div class="loading loading-spinner">...</div>';

    try {
        // Build query params with filters
        let params = new URLSearchParams({
            limit: pageSize,
            offset: currentPage * pageSize
        });
        params.append('record_type', 'fact');  // or 'plan'

        // Apply user-selected filters
        if (filters.date_from) params.append('date_from', filters.date_from);
        if (filters.date_to) params.append('date_to', filters.date_to);
        // ... other filters ...

        // Parallel fetch of data and count
        const [factsResponse, countResponse] = await Promise.all([
            fetch(`/api/v1/facts?${params}`, { credentials: 'include' }),
            fetch(`/api/v1/facts/count?${countParams}`, { credentials: 'include' })
        ]);

        if (!factsResponse.ok) throw new Error(`HTTP ${factsResponse.status}`);

        const data = await factsResponse.json();
        factsData = data.facts || [];
        totalFacts = countData.total;

        // Atomic render (single DOM update)
        renderFactsTable(factsData);
        updateStats();
        updatePagination();

    } catch (error) {
        console.error('Failed to load facts:', error);
        container.innerHTML = '<div class="alert alert-error">Failed to load</div>';
    }
}
```

**Key points:**
- **Atomic render** - table appears all at once, no gradual loading
- **Parallel count query** - avoids sequential DB queries
- **Error handling** - shows user-friendly message on failure
- **Filter serialization** - URL query params for pagination/filters

---

### renderFactsTable() - DOM Generation

```javascript
function renderFactsTable(facts) {
    const container = document.getElementById('facts-table-container');

    if (facts.length === 0) {
        container.innerHTML = '<div>No facts found</div>';
        return;
    }

    // Build full HTML string (desktop + mobile)
    let tableHtml = '<div class="hidden md:block"><table>...';
    let mobileHtml = '<div class="md:hidden">...';

    facts.forEach(fact => {
        // Desktop row
        tableHtml += `<tr data-fact-id="${fact.id}">...`;

        // Mobile card
        mobileHtml += `<div class="transaction-item">...`;
    });

    tableHtml += '</table></div>';
    mobileHtml += '</div>';

    // Single atomic DOM update
    container.innerHTML = tableHtml + mobileHtml;
}
```

**Performance:**
- **String concatenation** - fastest for large datasets
- **Single `innerHTML` assignment** - prevents intermediate reflows
- **No DocumentFragment** - simpler, sufficient for this use case
- **Responsive design** - separate desktop/mobile HTML (hidden via CSS)

**Rendering time:**
- 10 records: ~10ms
- 100 records: ~50ms
- 1000 records: ~300ms (pagination recommended)

---

## Real-Time Updates (WebSocket)

### Event Listeners

```javascript
// Fact created
window.budgetWSClient.on('fact_created', (data) => {
    loadFactsDebounced();  // 300ms debounce
});

// Fact updated
window.budgetWSClient.on('fact_updated', (data) => {
    loadFactsDebounced();
});

// Fact deleted
window.budgetWSClient.on('fact_deleted', (data) => {
    loadFactsDebounced();
});
```

**Debouncing:** Prevents multiple rapid reloads when batch operations occur.

```javascript
// Debounced reload (300ms wait)
const loadFactsDebounced = debounce(loadFacts, 300);
```

**Why debounce?**
- Batch delete of 10 facts → 10 WebSocket events → only 1 reload (after 300ms)
- Prevents UI flickering from rapid re-renders
- Reduces server load from duplicate fetch requests

---

### IncrementalUpdates (Optimization)

**Alternative to full reload:** Direct DOM manipulation

```javascript
// Instead of full table reload
IncrementalUpdates.onFactCreated(event) {
    const newRow = createFactRow(event.fact);
    table.querySelector('tbody').prepend(newRow);  // Add to top
    updateStats();  // Recalculate totals
}
```

**Benefits:**
- **75% fewer HTTP requests** (no fetch, direct insert)
- **<100ms latency** vs. ~500ms for full reload
- **Smoother UX** - no spinner, no table rebuild

**Trade-offs:**
- More complex code (manual DOM manipulation)
- Needs reference data cached (article names, etc.)
- Only works for simple append/update/remove operations

**Usage:** Dashboard widgets (quick stats, recent transactions)

---

## HTTP Caching for Dynamic Data

### Facts API (`/api/v1/facts`)

**Policy:** `private, no-cache, must-revalidate`

```http
Cache-Control: private, no-cache, must-revalidate
Pragma: no-cache
Vary: Cookie
```

**Rationale:**
- **Frequently changing** - Transactions created/edited often
- **Must be fresh** - Users expect immediate updates after mutations
- **User-specific** - Different users see different data (JWT auth)

**Service Worker behavior:**
- Respects `no-cache` directive
- Always revalidates with server
- Cache used ONLY as offline fallback

**Implementation:** `backend/app/api/v1/endpoints/facts.py:440-444`

```python
response.headers["Cache-Control"] = "private, no-cache, must-revalidate"
response.headers["Pragma"] = "no-cache"
response.headers["Vary"] = "Cookie"
```

---

### Reference Data (`/api/v1/articles`, `/api/v1/financial-centers`)

**Policy:** `private, max-age=300` (5 minutes)

**Rationale:**
- **Rarely changes** - Categories, accounts updated infrequently
- **Safe to cache** - Stale data acceptable for 5 minutes
- **Performance boost** - Avoids repeated DB queries

**Service Worker behavior:**
- Caches for 5 minutes (browser + SW cache)
- Background revalidation (stale-while-revalidate)

**Redis cache:** 300s TTL (CacheTTL.REFERENCE)

---

## Loading States & Error Handling

### Loading State Pattern

```javascript
// Show loading spinner
container.innerHTML = '<div class="loading loading-spinner loading-lg"></div>';

// Fetch data
const response = await fetch(url);

// Success: render data
if (response.ok) {
    const data = await response.json();
    renderData(data);
}

// Error: show retry option
else {
    container.innerHTML = `
        <div class="alert alert-error">
            <span>Failed to load data</span>
            <button class="btn btn-sm" onclick="retry()">Retry</button>
        </div>
    `;
}
```

### Error Recovery Strategies

| Error Type | Strategy | User Action |
|------------|----------|-------------|
| **Network error** | Show offline message + retry button | Manual retry or wait for reconnect |
| **HTTP 401/403** | Redirect to login | User must re-authenticate |
| **HTTP 404** | Show "not found" message | Return to previous page |
| **HTTP 500** | Show error + retry button | Manual retry or report issue |
| **Timeout** | Show timeout message + retry | Check network connection |

**Timeout configuration:**
```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);  // 10s timeout

fetch(url, { signal: controller.signal })
    .then(response => { clearTimeout(timeoutId); /* ... */ });
```

---

## Filter Management

### Filter State Object

```javascript
const filters = {
    date_from: null,
    date_to: null,
    article_id: null,
    article_type: null,
    financial_center_id: null,
    cost_center_id: null,
    search: null
};
```

### Apply Filters Flow

```javascript
async function applyFilters() {
    // 1. Update filters object from UI
    filters.date_from = document.getElementById('filter-date-from').value;
    filters.article_id = parseInt(document.getElementById('filter-article').value) || null;
    // ... other filters ...

    // 2. Reset pagination
    currentPage = 0;

    // 3. Reload data
    await loadFacts();

    // 4. Update filter indicator (badge count)
    updateFilterIndicator();
}
```

### Filter Indicator

```javascript
function updateFilterIndicator() {
    const activeFilters = Object.values(filters).filter(v => v !== null).length;
    const badge = document.getElementById('filter-count-badge');

    if (activeFilters > 0) {
        badge.textContent = activeFilters;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}
```

**UX:** Shows number of active filters as badge on "Filters" button.

---

## Modal Form Submission Loading States

### Edit Modal Save Buttons

**Pattern:** Button loading state during async form submission

**Implementation:**
```javascript
async function updateFact(event) {
    event.preventDefault();

    // Validation first (early returns OK)
    if (!isValid(formData)) {
        showToast('Validation error', 'error');
        return; // Early return - button NOT disabled
    }

    // Show loading AFTER validation passes
    setSubmitLoading(event.target, true);

    try {
        // ... fetch logic ...
        closeEditModal();
        await loadFacts();
        showToast('Success!', 'success');
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        // Always restore button
        setSubmitLoading(event.target, false);
    }
}
```

**Files:**
- `frontend/web/templates/facts.html:updateFact()` - Facts page edit modal
- `frontend/web/templates/plan.html:updateFact()` - Plan page edit modal

**Visual feedback:**
- Button disabled: prevents double-click
- Spinner icon: shows processing state
- Text changes: "Сохранить" → "Сохранение..."
- Auto-restores: on success or error

**Key features:**
- Validation with early returns happens BEFORE `setSubmitLoading(true)`
- If validation fails → early return → button never disabled
- If validation passes → button disabled → fetch → finally restores button
- `finally` block ensures restoration in all cases (success, error, or exception)

---

## Pagination

### Pagination State

```javascript
let currentPage = 0;  // 0-indexed
let pageSize = 20;    // Records per page
let totalFacts = 0;   // Total count (from server)
```

### Pagination Controls

```javascript
function updatePagination() {
    const totalPages = Math.ceil(totalFacts / pageSize);
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageInfo = document.getElementById('page-info');

    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = (currentPage + 1) >= totalPages;
    pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages}`;
}

function nextPage() {
    if ((currentPage + 1) * pageSize < totalFacts) {
        currentPage++;
        loadFacts();
    }
}

function previousPage() {
    if (currentPage > 0) {
        currentPage--;
        loadFacts();
    }
}
```

**Performance:**
- Server-side pagination (LIMIT/OFFSET)
- Count query separate from data query (parallel)
- Client maintains current page state

---

## Common Pitfalls & Solutions

### Pitfall 1: Race Conditions in Initialization

**Problem:**
```javascript
// BAD: All load in parallel, race condition
loadUsers();
loadArticles();
loadFacts();  // May finish before loadArticles()!
```

**Solution:**
```javascript
// GOOD: Sequential phased loading
await Promise.all([loadUsers(), loadFinancialCenters()]);  // Phase 1
await loadArticles();  // Phase 2 (depends on hierarchy)
await loadFacts();  // Phase 3 (depends on all reference data)
```

---

### Pitfall 2: Multiple Reflows from Incremental DOM Updates

**Problem:**
```javascript
// BAD: Multiple DOM updates (causes reflows)
facts.forEach(fact => {
    const row = createRow(fact);
    table.appendChild(row);  // Reflow on EVERY append!
});
```

**Solution:**
```javascript
// GOOD: Build full HTML string, single update
let html = '';
facts.forEach(fact => {
    html += `<tr>${fact.name}</tr>`;
});
table.innerHTML = html;  // Single reflow
```

---

### Pitfall 3: Stale Global Variables

**Problem:**
```javascript
let allCategories = [];  // Global

loadArticles();  // Async, doesn't await
loadFacts();     // Uses allCategories → may be empty!
```

**Solution:**
```javascript
await loadArticles();  // Wait for categories to load
await loadFacts();     // Now allCategories is populated
```

---

### Pitfall 4: Forgot to Clear Loading State on Error

**Problem:**
```javascript
container.innerHTML = '<div class="loading">...</div>';
try {
    await fetch(url);
    // ... forgot to handle error case
} catch (error) {
    // Loading spinner stuck forever!
}
```

**Solution:**
```javascript
container.innerHTML = '<div class="loading">...</div>';
try {
    const data = await fetch(url);
    renderData(data);
} catch (error) {
    container.innerHTML = '<div class="error">Failed</div>';  // Clear loading
}
```

---

## Testing Frontend Loading

### Manual Testing Checklist

1. **Clear all caches** (Ctrl+Shift+Del)
2. **Disable Service Worker** (Chrome DevTools → Application → Service Workers → Bypass)
3. **Throttle network** (Chrome DevTools → Network → Slow 3G)
4. **Test scenarios:**
   - ✅ First load (cold cache)
   - ✅ Reload (warm cache)
   - ✅ Create transaction → table updates
   - ✅ Filter change → table updates
   - ✅ Pagination → correct page loads
   - ✅ Error handling (disconnect network)
   - ✅ Offline mode (Service Worker fallback)

### Performance Profiling

```javascript
// Measure load time
console.time('loadFacts');
await loadFacts();
console.timeEnd('loadFacts');
// Output: loadFacts: 487.23ms
```

**Chrome DevTools:**
- **Performance tab** → Record page load
- **Network tab** → Check request waterfall
- **Lighthouse** → Run audit (PWA, performance)

---

## References

### Related Files

- `frontend/web/templates/facts.html` - Facts page JavaScript
- `frontend/web/templates/plan.html` - Plan page JavaScript
- `frontend/web/templates/index.html` - Dashboard HTMX widgets
- `frontend/web/static/js/budgetWSClient.js` - WebSocket client
- `frontend/web/static/js/incrementalUpdates.js` - Optimized real-time updates
- `backend/app/api/v1/endpoints/facts.py` - Facts API with cache headers

### Architecture Docs

- `/docs/architecture/caching-strategy.md` - HTTP caching, Redis, Service Worker
- `/docs/architecture/README.md` - Architecture overview
- `/docs/architecture/backup-system.md` - Data persistence

### External Resources

- [HTMX Documentation](https://htmx.org/docs/)
- [Fetch API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [WebSocket API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Service Workers - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

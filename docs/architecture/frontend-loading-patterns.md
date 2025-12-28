# Frontend Loading Patterns

**Last Updated:** 2025-12-25
**Version:** v6.2

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

## Modal Button State Management (v6.2+)

**Last Updated:** 2025-12-25
**Breaking Changes:** Introduced `setButtonLoading()` helper function, deprecated direct `.loading` class usage

### Helper Function: `setButtonLoading()`

**Location:** `frontend/web/templates/base.html` (global utility function)

**Purpose:** Manage button loading state with controlled content replacement (prevents button expansion).

**Implementation:**
```javascript
function setButtonLoading(button, isLoading) {
    if (!button) return;

    if (isLoading) {
        button.disabled = true;
        button.dataset.originalHtml = button.innerHTML;
        // Use loading-xs for btn-sm, loading-sm otherwise
        const spinnerSize = button.classList.contains('btn-sm') ? 'loading-xs' : 'loading-sm';
        button.innerHTML = `<span class="loading loading-spinner ${spinnerSize}"></span> Сохранение...`;
    } else {
        button.disabled = false;
        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
        }
    }
}
```

**Key Features:**
- ✅ **Content replacement** instead of inline addition (prevents button expansion)
- ✅ **Fixed button width** (no horizontal scrolling in modals)
- ✅ **Adaptive spinner size** (`loading-xs` for `btn-sm`, `loading-sm` for regular)
- ✅ **Original HTML preservation** in `dataset.originalHtml`
- ✅ **Graceful degradation** (null-safe, checks for button existence)

**Why this is better than `.classList.add('loading')`:**

| Approach | Button Content | Result |
|----------|----------------|--------|
| **OLD: `.classList.add('loading')`** | `[Icon] Сохранить` → `[Spinner] [Icon] Сохранить` | ❌ Button expands, causes horizontal scroll |
| **NEW: `setButtonLoading(button, true)`** | `[Icon] Сохранить` → `[Spinner] Сохранение...` | ✅ Fixed width, clean UI |

---

### Recommended Pattern (v6.2+)

**Architecture:** Wrapper function controls button state using `setButtonLoading()`, form submit handler only does async API call.

**Wrapper Function (saveTransaction, savePlan, saveTransfer):**
```javascript
function saveTransaction(button) {
    if (button.disabled) return; // Prevent double-click

    setButtonLoading(button, true);

    const form = document.getElementById(button.dataset.formId);
    if (form && form.checkValidity()) {
        form.requestSubmit();
    } else {
        // Re-enable button if validation fails
        setButtonLoading(button, false);
        form?.reportValidity();
    }
}
```

**Form Submit Handler:**
```javascript
document.getElementById('form_modal_add_transaction').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    // ... build data object ...

    try {
        const response = await fetch('/api/v1/facts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        if (response.ok) {
            modal_add_transaction.close();
            e.target.reset();
            showToast('Транзакция успешно сохранена!', 'success');
            await loadFacts(); // Reload data
        } else {
            const error = await response.json();
            showToast('Ошибка: ' + (error.detail || error.message), 'error');
        }
    } catch (error) {
        console.error('Error creating transaction:', error);
        showToast('Ошибка: ' + error.message, 'error');
    } finally {
        // Re-enable button using setButtonLoading()
        const submitBtn = e.target.querySelector('.save-btn');
        setButtonLoading(submitBtn, false);
    }
});
```

**Why this pattern works:**
- ✅ Button disabled only once (no double-disable race condition)
- ✅ Controlled HTML replacement (prevents button expansion)
- ✅ Validation errors handled immediately in wrapper
- ✅ Form handler just does async call + button restoration
- ✅ Button always restored in finally block (even on error)
- ✅ Cleaner code (single function call vs. 3 lines)

---

### Deprecated Pattern (index.html pre-v6.1)

**Problem:** Double button disable + HTML storage causes persistent loading spinner.

**Old Wrapper Function:**
```javascript
// ❌ OLD (BUGGY):
function saveTransaction(button) {
    if (button.disabled) return;
    button.disabled = true;              // ← First disable
    button.classList.add('loading');     // ← First loading class
    unifiedSave(button, 'transaction');  // → calls form.requestSubmit()
}
```

**Old Form Submit Handler:**
```javascript
// ❌ OLD (BUGGY):
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    setSubmitLoading(e.target, true);   // ← SECOND disable + HTML replacement!
    // ... API call ...
    finally {
        setSubmitLoading(e.target, false);  // ← Restore HTML
    }
});
```

**What went wrong:**
1. Wrapper disables button and adds `loading` class
2. Form handler calls `setSubmitLoading(true)` which stores current button HTML (now includes spinner!)
3. API call completes, modal closes
4. `finally` block calls `setSubmitLoading(false)` → restores from `dataset.originalHtml` (which is spinner)
5. User reopens modal → button still shows spinner
6. Next submit → `setSubmitLoading(true)` captures spinner as "original" again

**Root cause:** `dataset.originalHtml` captured spinner instead of button, creating persistent loading state.

---

### Modal Open Functions - Button State Reset

**Pattern:** Clear any stale loading state when modal opens.

```javascript
function openAddTransactionModal() {
    // Reset button state
    const form = document.getElementById('form_modal_add_transaction');
    const submitBtn = form?.querySelector('.save-btn');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        delete submitBtn.dataset.originalHtml; // Clear cache (if exists)
    }

    // Set today date
    const factDateInput = document.querySelector('#form_modal_add_transaction input[name="fact_date"]');
    if (factDateInput) {
        factDateInput.value = BudgetShared.DateFormatter.today();
    }

    modal_add_transaction.showModal();
}
```

**Why this is critical:**
- Clears any leftover loading state from previous submit
- Prevents "stuck spinner" bug on modal reopen
- Acts as safety net even if finally block fails

**Pages affected:**
- `index.html`: `openAddTransactionModal()`, `openAddPlanModal()`, `openFactTransferModal()`, `openPlanTransferModal()`
- `facts.html`: `openCreateModal()`
- `plan.html`: `openAddPlanModal()`, `openPlanTransferModal()`

---

### Common Pitfall: Missing Form Submit Handlers

**Symptom:** Button gets disabled when clicked, but form doesn't submit. No API call happens.

**Root cause:** Wrapper function calls `form.requestSubmit()` but NO `addEventListener('submit')` handler exists.

**Example (transfer modal bug pre-v6.1):**

```javascript
// Wrapper exists:
function saveTransfer(button) {
    button.disabled = true;
    button.classList.add('loading');
    const form = document.getElementById('form_transfer');
    form.requestSubmit(); // ← Fires 'submit' event
}

// ❌ BUT NO HANDLER EXISTS!
// Expected but missing:
// document.getElementById('form_transfer').addEventListener('submit', async function(e) { ... });
```

**Result:**
- Button becomes disabled ✅
- Loading spinner shows ✅
- `submit` event fires... but nobody handles it ❌
- No API call happens ❌
- Modal stays open with disabled button ❌

**How to diagnose:**
1. Check browser console for form submit event registration:
   ```javascript
   // In console:
   $0 = document.getElementById('form_transfer');
   getEventListeners($0).submit; // Should show listener, not undefined
   ```
2. Look for RuntimeWarning in backend logs (won't exist - no API call made)
3. Check Network tab - no POST request to `/api/v1/transfers`

**Fix:** Add the missing submit handler:
```javascript
document.getElementById('form_transfer').addEventListener('submit', async function(e) {
    e.preventDefault();
    // ... handle form submission ...
});
```

**Affected modals (fixed in v6.1):**
- `transfer_modal` on index.html (was broken)
- `transfer_modal` on facts.html (was broken)
- `transfer_modal` on plan.html (was broken)

---

### Best Practices (v6.2+)

#### 1. Always Pair `form.requestSubmit()` with `addEventListener('submit')`

```javascript
// ✅ CORRECT:
function saveTransaction(button) {
    const form = document.getElementById(button.dataset.formId);
    if (form && form.checkValidity()) {
        form.requestSubmit(); // ← Fires 'submit' event
    }
}

// ✅ HANDLER EXISTS:
document.getElementById('form_modal_add_transaction').addEventListener('submit', async function(e) {
    e.preventDefault();
    // ... handle submission ...
});
```

```javascript
// ❌ INCORRECT (missing handler):
function saveTransaction(button) {
    const form = document.getElementById(button.dataset.formId);
    form.requestSubmit(); // ← Fires event, but nobody listens!
}
```

#### 2. Wrapper Functions Handle Validation + Button Disable

```javascript
// ✅ CORRECT (v6.2+):
function saveTransaction(button) {
    if (button.disabled) return; // Double-click prevention

    setButtonLoading(button, true);

    const form = document.getElementById(button.dataset.formId);
    if (form && form.checkValidity()) {
        form.requestSubmit();
    } else {
        // Validation failed - re-enable button immediately
        setButtonLoading(button, false);
        form?.reportValidity();
    }
}
```

**Responsibilities:**
- Check `button.disabled` to prevent double-click
- Call `setButtonLoading(button, true)` to show loading state
- Validate form BEFORE calling `requestSubmit()`
- Re-enable button if validation fails (no API call needed)

#### 3. Form Submit Handlers Only Do Async API Call

```javascript
// ✅ CORRECT:
document.getElementById('form_modal_add_transaction').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    // ... build data object ...

    try {
        // Just do the async API call - button already disabled by wrapper
        const response = await fetch('/api/v1/facts', { /* ... */ });

        if (response.ok) {
            modal_add_transaction.close();
            e.target.reset();
            showToast('Success!', 'success');
            await loadFacts();
        } else {
            const error = await response.json();
            showToast('Error: ' + error.detail, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error: ' + error.message, 'error');
    } finally {
        // Always restore button using setButtonLoading()
        const submitBtn = e.target.querySelector('.save-btn');
        setButtonLoading(submitBtn, false);
    }
});
```

**Responsibilities:**
- Prevent default form submission (`e.preventDefault()`)
- Execute async API call (fetch, OfflineManager, etc.)
- Close modal and reset form on success
- Show error toast on failure
- **Always** restore button in finally block

#### 4. Reset Button State on Modal Open

```javascript
// ✅ CORRECT:
function openAddTransactionModal() {
    // Reset button state FIRST
    const form = document.getElementById('form_modal_add_transaction');
    const submitBtn = form?.querySelector('.save-btn');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        delete submitBtn.dataset.originalHtml; // Clear stale cache
    }

    // Then set default values
    const dateInput = form.querySelector('input[name="fact_date"]');
    if (dateInput) {
        dateInput.value = BudgetShared.DateFormatter.today();
    }

    // Finally open modal
    modal_add_transaction.showModal();
}
```

**Why this is critical:**
- Clears leftover loading state from previous submit
- Prevents "stuck spinner" on modal reopen
- Safety net in case finally block failed (e.g., exception thrown)

---

### Migration Guide (v6.0 → v6.1)

If you have modal forms using the old `setSubmitLoading()` pattern:

**Step 1:** Remove `setSubmitLoading()` calls from form submit handlers:
```diff
  form.addEventListener('submit', async function(e) {
      e.preventDefault();
-     setSubmitLoading(e.target, true);

      try {
          // ... API call ...
      } finally {
-         setSubmitLoading(e.target, false);
+         // Re-enable button
+         const submitBtn = e.target.querySelector('.save-btn');
+         if (submitBtn) {
+             submitBtn.disabled = false;
+             submitBtn.classList.remove('loading');
+         }
      }
  });
```

**Step 2:** Update wrapper functions to validate and enable on failure:
```diff
  function saveTransaction(button) {
      if (button.disabled) return;
      button.disabled = true;
      button.classList.add('loading');

      const form = document.getElementById(button.dataset.formId);
-     form.requestSubmit();
+     if (form && form.checkValidity()) {
+         form.requestSubmit();
+     } else {
+         button.disabled = false;
+         button.classList.remove('loading');
+         form?.reportValidity();
+     }
  }
```

**Step 3:** Add button state reset to modal open functions:
```diff
  function openAddTransactionModal() {
+     // Reset button state
+     const form = document.getElementById('form_modal_add_transaction');
+     const submitBtn = form?.querySelector('.save-btn');
+     if (submitBtn) {
+         submitBtn.disabled = false;
+         submitBtn.classList.remove('loading');
+         delete submitBtn.dataset.originalHtml;
+     }

      // Set today date
      const dateInput = form.querySelector('input[name="fact_date"]');
      if (dateInput) {
          dateInput.value = BudgetShared.DateFormatter.today();
      }

      modal_add_transaction.showModal();
  }
```

---

### Migration Guide (v6.1 → v6.2)

**Problem:** Using DaisyUI `.loading` class directly causes button expansion and horizontal scrolling in narrow modals.

**Solution:** Replace direct `.classList` operations with `setButtonLoading()` helper function.

#### Step 1: Update Wrapper Functions

Replace `classList` operations with `setButtonLoading()` calls:

```diff
  function saveTransaction(button) {
      if (button.disabled) return;
-     button.disabled = true;
-     button.classList.add('loading');
+     setButtonLoading(button, true);

      const form = document.getElementById(button.dataset.formId);
      if (form && form.checkValidity()) {
          form.requestSubmit();
      } else {
-         button.disabled = false;
-         button.classList.remove('loading');
+         setButtonLoading(button, false);
          form?.reportValidity();
      }
  }
```

**Files affected:**
- `index.html`: 6 wrapper functions (saveTransaction, savePlan, saveTransfer + 3 offline versions)
- `facts.html`: 2 wrapper functions (saveTransaction, saveTransfer)
- `plan.html`: 2 wrapper functions (savePlan, saveTransfer)

#### Step 2: Update Form Submit Handlers

Replace button restoration in `finally` blocks:

```diff
  form.addEventListener('submit', async function(e) {
      e.preventDefault();

      try {
          // ... API call ...
      } finally {
          const submitBtn = e.target.querySelector('.save-btn');
-         if (submitBtn) {
-             submitBtn.disabled = false;
-             submitBtn.classList.remove('loading');
-         }
+         setButtonLoading(submitBtn, false);
      }
  });
```

**Files affected:**
- `index.html`: 7 form submit handlers
- `facts.html`: 2 form submit handlers
- `plan.html`: 3 form submit handlers

#### Step 3: Update Modal Open Functions

Remove `.classList.remove('loading')` line (keep `delete dataset.originalHtml`):

```diff
  function openAddTransactionModal() {
      const form = document.getElementById('form_modal_add_transaction');
      const submitBtn = form?.querySelector('.save-btn');
      if (submitBtn) {
          submitBtn.disabled = false;
-         submitBtn.classList.remove('loading');
          delete submitBtn.dataset.originalHtml;
      }
      // ... rest of function ...
  }
```

**Files affected:**
- `index.html`: 4 modal open functions
- `facts.html`: 1 modal open function
- `plan.html`: 2 modal open functions

#### Total Changes

| File | Wrapper Functions | Form Handlers | Modal Opens | **Total** |
|------|-------------------|---------------|-------------|-----------|
| `index.html` | 6 functions | 7 locations | 4 locations | **17** |
| `facts.html` | 2 functions | 2 locations | 1 location | **5** |
| `plan.html` | 2 functions | 3 locations | 2 locations | **7** |
| **TOTAL** | **10** | **12** | **7** | **29** |

#### Verification

After migration, confirm:
```bash
# Should return 0 matches
grep -r "classList\.\(add\|remove\)('loading')" frontend/web/templates/index.html
grep -r "classList\.\(add\|remove\)('loading')" frontend/web/templates/facts.html
grep -r "classList\.\(add\|remove\)('loading')" frontend/web/templates/plan.html
```

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

## Mobile UI Components

### Fixed Bottom FAB Toolbar (v6.6.0+)

**Component:** `components/fab_toolbar.html`

**Conditional Rendering:**
```python
# In base.html Jinja2 template
{% if request.path in ['/', '/facts', '/plan'] %}
    {% include 'components/fab_toolbar.html' %}
{% endif %}
```

**JavaScript Initialization:**
- Auto-initializes on DOMContentLoaded
- Logs button clicks for debugging
- Dropdown menu uses DaisyUI `dropdown-top` class

**Performance:**
- GPU-accelerated (`transform: translateZ(0)`)
- No layout thrashing (fixed positioning)
- Touch-optimized (≥48px tap targets)

**Accessibility:**
- ARIA labels on all buttons
- Keyboard navigation support (tab/enter)
- Screen reader friendly tooltips
- Reduced motion support

**Console Logs:**
```javascript
[FAB_TOOLBAR] Toolbar initialized: { page: "/", buttonsCount: 4 }
[FAB_TOOLBAR] Button clicked: { index: 0, label: "Добавить транзакцию" }
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

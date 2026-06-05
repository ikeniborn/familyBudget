---
state: draft
created: 2026-06-05
chain:
  intent: null
review:
  spec_hash: 7ef352afd3fba7a0
  last_run: 2026-06-05
  phases:
    structure:    { status: passed }
    coverage:     { status: passed }
    clarity:      { status: passed }
    consistency:  { status: passed }
  findings:
    - id: F-001
      phase: clarity
      severity: WARNING
      section: "## Approach"
      section_hash: 67225accbb7b7146
      text: >-
        Несогласованные имена API: паттерн даёт generic
        `HTMXWidgets.refreshWidget(id)` (строка 26), но фактические вызовы —
        `HTMXWidgets.refreshTransactions()` (строки 22, 28, §C). Неясно, какой
        метод реально существует в htmxWidgets.js.
      verdict: fixed
      verdict_at: 2026-06-05
---

# HTMX Everywhere: Dashboard Widget Cleanup

## Problem

After `fix-offline-removal-regressions` (PR #666) two regressions remain unresolved:

1. **Loader can hang in edge cases** — `#recent-transactions` is loaded by two competing mechanisms: HTMX (`hx-trigger="load"`) fetches `/recent-html` (server HTML), and Dashboard JS (`DOMContentLoaded`) fetches `/recent` (JSON → client render). If the HTMX request fails (5xx / network error), HTMX does not swap innerHTML — spinner stays forever. Dashboard JS is the only safety net but the race is non-deterministic.

2. **CSS centering persists after HTMX swap** — `#quick-stats` and `#account-balances` containers have `flex items-center justify-center` on the outer div (meant for the spinner). After HTMX swaps innerHTML with real content, those flex classes remain and affect layout of loaded stats cards. `#recent-transactions` was already fixed correctly (flex only on inner spinner wrapper).

## Goal

Single loading mechanism for all three dashboard widgets, consistent error handling, no duplicate fetches.

## Approach

**HTMX everywhere** — remove Dashboard JS loading of `#recent-transactions` (DOMContentLoaded listener), add HTMX error handler in `htmxWidgets.js`, redirect programmatic refresh callers to `HTMXWidgets.refreshTransactions()`.

All three widgets follow the same pattern after this change:
- Initial load: `hx-trigger="load"` on the container
- Programmatic refresh: `HTMXWidgets.refreshWidget(id)` — generic method, `id ∈ {'quick-stats', 'account-balances', 'recent-transactions'}`. `HTMXWidgets.refreshTransactions()` is a thin alias for `refreshWidget('recent-transactions')`
- Error state: `htmx:responseError` / `htmx:sendError` handler in `htmxWidgets.js`
- Event-driven refresh: `fact:created` → `HTMXWidgets.refreshTransactions()`

## File Changes

### A. `frontend/web/templates/index.html`

**A1 — CSS fix: `#quick-stats` and `#account-balances`**

Remove `flex items-center justify-center` from outer div. Wrap spinner in inner div (matches `#recent-transactions` pattern):

```html
<!-- before -->
<div id="quick-stats"
     hx-get="/api/v1/analytics/quick-stats-html"
     hx-trigger="load"
     hx-swap="innerHTML"
     class="min-h-[100px] flex items-center justify-center">
    <span class="loading loading-spinner loading-lg text-primary"></span>
</div>

<!-- after -->
<div id="quick-stats"
     hx-get="/api/v1/analytics/quick-stats-html"
     hx-trigger="load"
     hx-swap="innerHTML"
     class="min-h-[100px]">
    <div class="flex items-center justify-center py-4">
        <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
</div>
```

Same fix for `#account-balances`.

**A2 — Script block cleanup**

Remove entire `DOMContentLoaded` listener that calls `window.Dashboard.loadRecentTransactions`.

Replace `fact:created` listener:

```javascript
// before
window.addEventListener('fact:created', async () => {
    if (window.Dashboard && window.Dashboard.loadRecentTransactions) {
        await window.Dashboard.loadRecentTransactions();
    }
});

// after
window.addEventListener('fact:created', () => {
    window.HTMXWidgets?.refreshTransactions();
});
```

### B. `frontend/web/static/js/htmxWidgets.js`

Add HTMX error handler in `init()`. Fires on `htmx:responseError` (non-2xx) and `htmx:sendError` (network failure). Shows error alert in the widget container:

```javascript
const WIDGET_IDS = new Set(
    Object.keys(this.widgets)  // ['quick-stats', 'account-balances', 'recent-transactions']
);
const errorHTML = `
    <div class="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
             class="stroke-current shrink-0 w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>Ошибка загрузки. Попробуйте обновить страницу.</span>
    </div>`;

const handleError = (event) => {
    const elt = event.detail?.elt;
    if (elt && WIDGET_IDS.has(elt.id)) {
        elt.innerHTML = errorHTML;
    }
};

document.body.addEventListener('htmx:responseError', handleError);
document.body.addEventListener('htmx:sendError', handleError);
```

### C. `frontend/web/static/js/dashboard/features/modalPlan/saveTransaction.ts`

Replace `window.loadRecentTransactions` call with `HTMXWidgets.refreshTransactions()`:

```typescript
// before
if (typeof window.loadRecentTransactions === 'function') {
    await window.loadRecentTransactions();
}

// after
window.HTMXWidgets?.refreshTransactions();
```

No `await` needed — `refreshTransactions()` is synchronous (fires HTMX ajax and returns immediately).

### D. `frontend/web/static/js/dashboard/adapters/windowExports.ts`

Remove `loadRecentTransactions` from:
- The import (`loadRecentTransactionsImpl`)
- The local wrapper function definition
- The `Dashboard` object export
- `window.loadRecentTransactions = ...` assignment

### E. `frontend/web/static/js/dashboard/types/globals.d.ts`

Remove `loadRecentTransactions` from:
- `Window` interface (optional property)
- `Dashboard` interface

## Out of Scope

- `recentTransactions.ts` module is **not deleted** — `buildRecentTransactionsHTML` and `loadRecentTransactions` remain as named exports for potential test use.
- No changes to backend endpoints.
- No changes to `#recent-transactions` HTMX attributes (already correct from Task 1).

## Verification

1. `npm run type-check` — passes after removing window exports
2. `npm run bundle` — passes
3. Browser: dashboard loads, all three spinners replaced by content
4. Browser: kill network mid-load → error alerts appear in all three widgets (no hanging spinners)
5. Browser console: no duplicate requests for `/recent-html` or `/recent` on page load
6. Add a fact → `#recent-transactions` refreshes via HTMX (single request, no JS fetch)

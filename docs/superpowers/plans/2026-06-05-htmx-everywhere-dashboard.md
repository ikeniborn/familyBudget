---
state: reviewed
created: 2026-06-05
chain:
  intent: null
  spec: docs/superpowers/specs/2026-06-05-htmx-everywhere-dashboard-design.md
review:
  plan_hash: 851f586b3fa52652
  spec_hash: 7ef352afd3fba7a0
  last_run: 2026-06-05
  phases:
    structure:     { status: passed }
    coverage:      { status: passed }
    dependencies:  { status: passed }
    verifiability: { status: passed }
    consistency:   { status: passed }
  findings: []
---

# HTMX Everywhere: Dashboard Widget Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all three dashboard widgets (`#quick-stats`, `#account-balances`, `#recent-transactions`) load through a single HTMX mechanism with consistent error handling and no duplicate fetches.

**Architecture:** Remove the Dashboard-JS fallback loader for `#recent-transactions` (it raced with HTMX). HTMX `hx-trigger="load"` becomes the only loader for all three widgets. Add a global HTMX error handler in `htmxWidgets.js` that renders an error alert on `htmx:responseError` / `htmx:sendError`. Redirect the two programmatic refresh callers to `HTMXWidgets.refreshTransactions()` (a thin alias for `refreshWidget('recent-transactions')`, already present in `htmxWidgets.js`). Fix leftover spinner-centering flex classes on two outer containers.

**Tech Stack:** HTMX, plain JS (`htmxWidgets.js`, served directly — not bundled), TypeScript dashboard module (Rollup bundle), Jinja2 template (`index.html`), Tailwind/DaisyUI classes.

**Note on testing:** These are DOM / HTMX / template changes. The repo has no JS unit-test harness covering these widgets, so verification per task is `npm run type-check` (TS tasks), `npm run bundle`, and the manual browser checklist in the final task — not new unit tests. Do not invent a test framework; follow the existing verification pattern from the spec.

**Reference:** spec at `docs/superpowers/specs/2026-06-05-htmx-everywhere-dashboard-design.md`.

---

## File Structure

| File | Change |
|------|--------|
| `frontend/web/templates/index.html` | Fix outer-div flex classes on `#quick-stats` + `#account-balances`; delete `DOMContentLoaded` recent-transactions loader; rewrite `fact:created` listener to call `HTMXWidgets.refreshTransactions()` |
| `frontend/web/static/js/htmxWidgets.js` | Add `htmx:responseError` / `htmx:sendError` handler in `init()` that writes an error alert into the failing widget container |
| `frontend/web/static/js/dashboard/features/modalPlan/saveTransaction.ts` | Replace `window.loadRecentTransactions()` call with `window.HTMXWidgets?.refreshTransactions()` |
| `frontend/web/static/js/dashboard/adapters/windowExports.ts` | Remove `loadRecentTransactions` import, wrapper fn, `dashboardExports` entry, `window.loadRecentTransactions` assignment |
| `frontend/web/static/js/dashboard/types/globals.d.ts` | Remove `loadRecentTransactions` from `Window` interface and from `DashboardExports` interface |

**Out of scope (do NOT touch):**
- `frontend/web/static/js/dashboard/recentTransactions.ts` — keep `loadRecentTransactions` + `buildRecentTransactionsHTML` named exports.
- `frontend/web/static/js/dashboard/index.ts:162` — keep `export { loadRecentTransactions } from './recentTransactions';` (named export still valid).
- Backend endpoints.
- `#recent-transactions` HTMX attributes in `index.html` (already correct).
- Add a `HTMXWidgets` type to `globals.d.ts` — `saveTransaction.ts` uses optional-chaining on `window.HTMXWidgets?.refreshTransactions()`; see Task 4 for how to keep type-check green.

---

## Task 1: Fix spinner-centering flex on `#quick-stats` and `#account-balances`

**Files:**
- Modify: `frontend/web/templates/index.html:28-34` (`#quick-stats`) and `:49-55` (`#account-balances`)

**Why:** After HTMX swaps `innerHTML`, the outer div keeps `flex items-center justify-center`, which mis-lays-out the real stat cards. Move the flex onto an inner spinner wrapper, matching the already-correct `#recent-transactions` pattern at `:65-73`.

- [ ] **Step 1: Edit `#quick-stats` block**

Replace lines 28-34:

```html
                <div id="quick-stats"
                     hx-get="/api/v1/analytics/quick-stats-html"
                     hx-trigger="load"
                     hx-swap="innerHTML"
                     class="min-h-[100px] flex items-center justify-center">
                    <span class="loading loading-spinner loading-lg text-primary"></span>
                </div>
```

with:

```html
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

- [ ] **Step 2: Edit `#account-balances` block**

Replace lines 49-55:

```html
                <div id="account-balances"
                     hx-get="/api/v1/analytics/account-balances-html"
                     hx-trigger="load"
                     hx-swap="innerHTML"
                     class="min-h-[100px] flex items-center justify-center">
                    <span class="loading loading-spinner loading-lg text-primary"></span>
                </div>
```

with:

```html
                <div id="account-balances"
                     hx-get="/api/v1/analytics/account-balances-html"
                     hx-trigger="load"
                     hx-swap="innerHTML"
                     class="min-h-[100px]">
                    <div class="flex items-center justify-center py-4">
                        <span class="loading loading-spinner loading-lg text-primary"></span>
                    </div>
                </div>
```

- [ ] **Step 3: Verify no leftover centering flex on the outer divs**

Run: `grep -n 'id="quick-stats"' -A4 frontend/web/templates/index.html; grep -n 'id="account-balances"' -A4 frontend/web/templates/index.html`
Expected: neither outer `<div id="...">` line group contains `flex items-center justify-center`; each is followed by an inner `<div class="flex items-center justify-center py-4">`.

- [ ] **Step 4: Commit**

```bash
git add frontend/web/templates/index.html
git commit -m "fix(dashboard): move spinner flex to inner wrapper on quick-stats and account-balances"
```

---

## Task 2: Remove Dashboard-JS recent-transactions loader, route `fact:created` through HTMX

**Files:**
- Modify: `frontend/web/templates/index.html:188-202` (script block)

**Why:** The `DOMContentLoaded` listener fetches `/recent` (JSON) in parallel with HTMX's `/recent-html` (server HTML) → duplicate request and non-deterministic race. HTMX `hx-trigger="load"` already loads `#recent-transactions`, so the JS loader is redundant. The `fact:created` refresh must go through HTMX too, so there is one code path.

- [ ] **Step 1: Replace the script block**

Replace lines 188-202:

```html
<!-- Recent Transactions Module (from dashboard bundle) -->
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    if (window.Dashboard && window.Dashboard.loadRecentTransactions) {
      await window.Dashboard.loadRecentTransactions();
    }
  });

  // Reload on WebSocket update
  window.addEventListener('fact:created', async () => {
    if (window.Dashboard && window.Dashboard.loadRecentTransactions) {
      await window.Dashboard.loadRecentTransactions();
    }
  });
</script>
```

with:

```html
<!-- Recent transactions load via HTMX hx-trigger="load" on #recent-transactions. -->
<script>
  // Refresh recent transactions on WebSocket fact creation (HTMX, single code path)
  window.addEventListener('fact:created', () => {
    window.HTMXWidgets?.refreshTransactions();
  });
</script>
```

- [ ] **Step 2: Verify the old loader is gone**

Run: `grep -n "loadRecentTransactions\|DOMContentLoaded" frontend/web/templates/index.html`
Expected: no matches (zero lines). The `fact:created` listener now calls `HTMXWidgets.refreshTransactions()`.

- [ ] **Step 3: Verify the `htmxWidgets.js` script tag still loads before this block**

Run: `grep -n "htmxWidgets.js\|fact:created" frontend/web/templates/index.html`
Expected: the `htmxWidgets.js?v=PLACEHOLDER` `<script src>` line (≈184) appears BEFORE the `fact:created` line (≈197). `window.HTMXWidgets` is defined by then.

- [ ] **Step 4: Commit**

```bash
git add frontend/web/templates/index.html
git commit -m "refactor(dashboard): load recent-transactions via HTMX only, drop JS fallback loader"
```

---

## Task 3: Add HTMX error handler in `htmxWidgets.js`

**Files:**
- Modify: `frontend/web/static/js/htmxWidgets.js:148-154` (`init()` method)

**Why:** If the HTMX request for a widget fails (5xx or network error), HTMX does not swap `innerHTML`, so the spinner hangs forever. With the JS fallback removed (Task 2), there is no safety net. Add a handler that replaces the failing widget's content with a DaisyUI error alert. Scope it to the three known widget IDs so it never clobbers unrelated HTMX targets.

`htmxWidgets.js` is plain JS served directly at `/static/js/htmxWidgets.js` — it is NOT bundled by Rollup. No build step is required for this file; the change is live once committed and deployed.

- [ ] **Step 1: Extend `init()` with the error handler**

Replace the `init()` method (lines 144-154):

```javascript
        /**
         * Initialize event listeners for automatic refresh
         * Called automatically when script loads
         */
        init() {
            // Refresh on network recovery
            window.addEventListener('online', () => {
                console.debug('[HTMXWidgets] Network online - refreshing widgets');
                this.refreshAll();
            });
        }
```

with:

```javascript
        /**
         * Initialize event listeners for automatic refresh
         * Called automatically when script loads
         */
        init() {
            // Refresh on network recovery
            window.addEventListener('online', () => {
                console.debug('[HTMXWidgets] Network online - refreshing widgets');
                this.refreshAll();
            });

            // Show an error alert inside a widget when its HTMX load fails.
            // htmx:responseError = non-2xx response; htmx:sendError = network failure.
            // Scoped to known widget IDs so unrelated HTMX targets are untouched.
            const widgetIds = new Set(Object.keys(this.widgets));
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
                const elt = event.detail && event.detail.elt;
                if (elt && widgetIds.has(elt.id)) {
                    elt.innerHTML = errorHTML;
                }
            };

            document.body.addEventListener('htmx:responseError', handleError);
            document.body.addEventListener('htmx:sendError', handleError);
        }
```

- [ ] **Step 2: Verify the handler is wired**

Run: `grep -n "htmx:responseError\|htmx:sendError\|widgetIds" frontend/web/static/js/htmxWidgets.js`
Expected: both event names registered via `addEventListener`, and `widgetIds` built from `Object.keys(this.widgets)`.

- [ ] **Step 3: Commit**

```bash
git add frontend/web/static/js/htmxWidgets.js
git commit -m "feat(dashboard): show error alert in widget on HTMX load failure"
```

---

## Task 4: Route `saveTransaction.ts` refresh through HTMX

**Files:**
- Modify: `frontend/web/static/js/dashboard/features/modalPlan/saveTransaction.ts:78-80`

**Why:** This is the second programmatic caller of the old JS loader. Redirect it to HTMX so the JS path can be deleted (Task 5). `refreshTransactions()` fires the HTMX ajax and returns immediately — no `await` needed.

**Type-check note:** `window.HTMXWidgets` is not declared in `globals.d.ts`. To keep `npm run type-check` green without adding a full interface (out of scope per spec), cast through `any` inline. This mirrors how the codebase already accesses untyped globals.

- [ ] **Step 1: Replace the loader call**

Replace lines 78-80:

```typescript
  if (typeof window.loadRecentTransactions === 'function') {
    await window.loadRecentTransactions();
  }
```

with:

```typescript
  // Refresh recent transactions via HTMX (single code path; fire-and-forget)
  (window as any).HTMXWidgets?.refreshTransactions();
```

- [ ] **Step 2: Verify the old call is gone**

Run: `grep -n "loadRecentTransactions\|HTMXWidgets" frontend/web/static/js/dashboard/features/modalPlan/saveTransaction.ts`
Expected: no `loadRecentTransactions`; one `HTMXWidgets?.refreshTransactions()` call.

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS, no errors. (`window.loadRecentTransactions` type still exists in `globals.d.ts` at this point, removed next task — so this compiles cleanly.)

- [ ] **Step 4: Commit**

```bash
git add frontend/web/static/js/dashboard/features/modalPlan/saveTransaction.ts
git commit -m "refactor(dashboard): refresh recent-transactions via HTMXWidgets in plan save"
```

---

## Task 5: Remove `loadRecentTransactions` window export and types

**Files:**
- Modify: `frontend/web/static/js/dashboard/adapters/windowExports.ts` (lines 83-86, 470-472, 549, 627)
- Modify: `frontend/web/static/js/dashboard/types/globals.d.ts` (lines 224-225, 318-319)

**Why:** No caller remains after Tasks 2 and 4. `dashboardExports` (object) and `DashboardExports` (interface) must change together or TypeScript reports a structural mismatch — so both files are edited in one task with a single type-check at the end. The named export in `recentTransactions.ts` / `index.ts` stays (still importable for tests).

- [ ] **Step 1: `windowExports.ts` — remove the import**

Replace lines 83-86:

```typescript
// Recent Transactions (Table Optimization v2.0)
import {
  loadRecentTransactions as loadRecentTransactionsImpl,
} from '../recentTransactions';
```

with:

```typescript
// Recent Transactions: loadRecentTransactions removed (HTMX-only loading).
// Named export still available from ../recentTransactions for test use.
```

- [ ] **Step 2: `windowExports.ts` — remove the wrapper function**

Replace lines 466-472:

```typescript
// ============================================================================
// Recent Transactions (Table Optimization v2.0)
// ============================================================================

async function loadRecentTransactions(): Promise<void> {
  return loadRecentTransactionsImpl();
}
```

with:

```typescript
// ============================================================================
// Recent Transactions: loadRecentTransactions removed — widget loads via HTMX
// ============================================================================
```

- [ ] **Step 3: `windowExports.ts` — remove the `dashboardExports` entry**

Delete lines 548-549 (the comment + the property in the object literal):

```typescript
  // Recent Transactions (Table Optimization v2.0)
  loadRecentTransactions,
```

(Remove both lines. The trailing comma on the preceding property `collectRecurringSettings,` at line 546 already terminates that entry correctly.)

- [ ] **Step 4: `windowExports.ts` — remove the window assignment**

Delete line 627:

```typescript
  window.loadRecentTransactions = loadRecentTransactions;
```

(Leave the surrounding `window.refreshDashboard = ...` etc. lines 623-626 intact.)

- [ ] **Step 5: `globals.d.ts` — remove from the `Window` interface**

Delete lines 224-225:

```typescript
    // Recent Transactions (client-side refresh)
    loadRecentTransactions?: () => Promise<void>;
```

- [ ] **Step 6: `globals.d.ts` — remove from the `DashboardExports` interface**

Delete lines 318-319:

```typescript
  // Recent Transactions (Table Optimization v2.0)
  loadRecentTransactions(): Promise<void>;
```

- [ ] **Step 7: Verify all references are gone from these two files**

Run: `grep -rn "loadRecentTransactions" frontend/web/static/js/dashboard/adapters/windowExports.ts frontend/web/static/js/dashboard/types/globals.d.ts`
Expected: no matches.

Run: `grep -rn "loadRecentTransactions" frontend/ --include=*.ts --include=*.js --include=*.html | grep -v ".min.js" | grep -v ".bundle.js"`
Expected: only `recentTransactions.ts` (definition) and `index.ts:162` (re-export) remain — no callers, no window plumbing, no template references.

- [ ] **Step 8: Type-check and bundle**

Run: `npm run type-check`
Expected: PASS — `dashboardExports` object and `DashboardExports` interface match (both no longer declare `loadRecentTransactions`); no caller references the removed `window.loadRecentTransactions`.

Run: `npm run bundle`
Expected: PASS — dashboard bundle rebuilds without errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/web/static/js/dashboard/adapters/windowExports.ts frontend/web/static/js/dashboard/types/globals.d.ts
git commit -m "refactor(dashboard): drop loadRecentTransactions window export and types"
```

---

## Task 6: Full verification (type-check, bundle, browser checklist)

**Files:** none (verification only).

- [ ] **Step 1: Full front-end build**

Run: `npm run build`
Expected: PASS — type-check + CSS + bundles + verify all succeed.

- [ ] **Step 2: Browser — clean load**

Open the dashboard (dev: https://fbd.ikeniborn.ru/ or local). Confirm:
- All three widget spinners (`#quick-stats`, `#account-balances`, `#recent-transactions`) are replaced by real content.
- Stat cards in `#quick-stats` / `#account-balances` are laid out normally (no residual centering from the old outer flex).

- [ ] **Step 3: Browser — no duplicate requests**

Open DevTools → Network, reload. Confirm:
- Exactly one request to `/api/v1/facts/recent-html` (HTMX), and NO request to the old JSON `/recent` endpoint for the recent-transactions widget on page load.

- [ ] **Step 4: Browser — error state**

Throttle/kill the network (DevTools offline, or block the three widget URLs) and reload. Confirm:
- Each failing widget shows the red `alert alert-error` "Ошибка загрузки. Попробуйте обновить страницу." — no hanging spinners.

- [ ] **Step 5: Browser — event-driven refresh**

Restore the network. Add a fact (transaction). Confirm:
- `#recent-transactions` refreshes via a single HTMX request to `/api/v1/facts/recent-html` (no JSON `/recent` fetch).

- [ ] **Step 6: Responsive check**

Verify the dashboard at 375px, 768px, 1280px breakpoints — widgets and stat cards render correctly at each (per project UI/UX guideline).

---

## Self-Review

**Spec coverage:**
- A1 (CSS fix `#quick-stats` + `#account-balances`) → Task 1 ✓
- A2 (remove `DOMContentLoaded`, rewrite `fact:created`) → Task 2 ✓
- B (HTMX error handler in `htmxWidgets.js`) → Task 3 ✓
- C (`saveTransaction.ts` → `HTMXWidgets.refreshTransactions()`) → Task 4 ✓
- D (remove from `windowExports.ts`) → Task 5 ✓
- E (remove from `globals.d.ts`) → Task 5 ✓
- Out-of-scope items (keep `recentTransactions.ts`, `index.ts` re-export, backend, `#recent-transactions` attrs) → documented in File Structure ✓
- Verification (type-check, bundle, browser) → Task 6 ✓

**Consistency:** `HTMXWidgets.refreshTransactions()` is used everywhere (it exists in `htmxWidgets.js:100-102` as alias for `refreshWidget('recent-transactions')`) — the spec's generic `refreshWidget(id)` is not introduced as a new caller, avoiding the F-001 naming ambiguity. `window.HTMXWidgets` accessed via optional chaining in both the template (untyped JS) and `saveTransaction.ts` (cast `as any`, so no new type needed — consistent with out-of-scope "no HTMXWidgets type").

**Ordering:** Task 4 (drop `window.loadRecentTransactions` call) precedes Task 5 (drop its type) → no intermediate type-check failure. Task 5 edits `windowExports.ts` + `globals.d.ts` together → object/interface stay in sync.

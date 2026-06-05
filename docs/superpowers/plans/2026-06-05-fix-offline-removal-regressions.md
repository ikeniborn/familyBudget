---
review:
  plan_hash: 781255d11ff87827
  spec_hash: 934b436bfe59086e
  last_run: 2026-06-05
  phases:
    structure:     { status: passed }
    coverage:      { status: passed }
    dependencies:  { status: passed }
    verifiability: { status: passed }
    consistency:   { status: passed }
  findings:
    - id: F-001
      phase: coverage
      severity: WARNING
      section: "## Task 6: Guard `#filter-article` init (Spec E)"
      section_hash: 40086c141ad485e0
      text: "Spec E requires guarding the dependent filter-article-type change listener 'the same way'; the plan asserts in Task 6 context it is already optional-chained (articleTypeEl?.addEventListener) but adds no step or grep to confirm. Requirement is covered by claim, not by a verifiable step."
      verdict: fixed
      verdict_at: 2026-06-05
chain:
  intent: null
  spec: docs/superpowers/specs/2026-06-05-fix-offline-removal-regressions-design.md
---

# Fix Offline/Dexie Removal Regressions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the dead code left behind by the Dexie/offline removal (v0.6.195+) so the dashboard loads, the console is clean, and accidentally-deleted push notifications work again.

**Architecture:** This is a cleanup/regression plan, not new feature work. Most changes are deletions of orphaned modules plus three wiring fixes (make the recent-transactions widget self-loading, restore the push-manager bundle, guard a facts-only init). There is almost no new logic to unit-test; the verification loop is **type-check + build + targeted greps for orphans + the manual smoke checks** from the spec. TDD-style red/green tests are not added for pure deletions — forcing them here would add harness code with no reuse value (violates the project's "Simplicity First" rule).

**Tech Stack:** Jinja2 templates (HTMX), TypeScript → Vite bundles (`build-all.js`), FastAPI (backend router), DaisyUI/Tailwind, npm scripts.

**Source spec:** `docs/superpowers/specs/2026-06-05-fix-offline-removal-regressions-design.md`

---

## File Structure

Files created / modified / deleted, grouped by responsibility:

**A — Dashboard loader**
- Modify: `frontend/web/templates/index.html` (make `#recent-transactions` self-load)
- Modify: `frontend/web/static/js/htmxWidgets.js` (drop dead `network-status-change` listener)

**B — Remove P2P (frontend)**
- Delete: `frontend/web/static/js/ui/P2PUIController.js`, `P2PTemplates.js`, `P2PRelayService.js`
- Delete: `frontend/web/templates/p2p/p2p-initiator.html`, `p2p-scanner.html`, `p2p-status.html` (and the now-empty `frontend/web/templates/p2p/` dir)
- Delete: `frontend/web/static/css/p2p.css` (+ generated `p2p.min.css` if present)
- Delete: `tests/manual/p2p-ios-safari.test.js` (tests deleted P2P feature)
- Modify: `frontend/web/templates/base.html` (css link, button, include, script block)
- Modify: `package.json` (`minify:p2p` script + `build:css` chain)

**B — Remove P2P (backend)**
- Delete: `backend/app/api/v1/endpoints/p2p.py`
- Modify: `backend/app/api/v1/endpoints/__init__.py` (import + `__all__`)
- Modify: `backend/app/api/v1/router.py` (import + `include_router`)

**C — Offline orphans**
- Modify: `frontend/web/templates/index.html` (`data-offline-hidden`, `pending-records-card`)
- Modify: `frontend/web/static/js/dashboard/recentTransactions.ts` (orphan `☁️` header)
- Modify: `frontend/web/static/js/plan/crud.ts` (offline-display payload fields + upstream extraction)

**D — Restore push frontend**
- Create: `frontend/web/static/js/notifications/pushManager.ts` (restored from git)
- Modify: `build-all.js` (add bundle entry)
- Modify: `frontend/web/templates/base.html` (re-add `<script>` tag)

**E — Guard facts-only init**
- Modify: `frontend/web/static/js/facts/index.ts`

**F — Redis monitoring clarity (display only)**
- Modify: `frontend/web/templates/admin_monitoring.html` (relabel cumulative counters)

**Finalize**
- Modify: `lat.md/` (sync if needed) + `lat check`
- Modify: `VERSION` (+1 patch)

---

## Task 1: Fix dashboard loader (Spec A)

**Files:**
- Modify: `frontend/web/templates/index.html:61-65`
- Modify: `frontend/web/static/js/htmxWidgets.js:154-161`

- [ ] **Step 1: Make `#recent-transactions` self-loading**

In `frontend/web/templates/index.html`, change the card comment + wrapper + inner div. Replace:

```html
            <!-- Recent Records (hidden when offline) -->
            <div id="recent-transactions-card" class="card bg-base-100 shadow-xl" data-offline-hidden="true">
                <div class="card-body">
                    <h2 class="text-lg sm:text-xl font-bold mb-1 sm:mb-2">📈 Последние записи</h2>
                    <div id="recent-transactions" class="min-h-[200px]" data-offline-hidden="true">
                        <div class="flex items-center justify-center py-8">
                            <span class="loading loading-spinner loading-lg text-primary"></span>
                        </div>
                    </div>
```

with:

```html
            <!-- Recent Records -->
            <div id="recent-transactions-card" class="card bg-base-100 shadow-xl">
                <div class="card-body">
                    <h2 class="text-lg sm:text-xl font-bold mb-1 sm:mb-2">📈 Последние записи</h2>
                    <div id="recent-transactions"
                         class="min-h-[200px]"
                         hx-get="/api/v1/facts/recent-html?limit=10"
                         hx-trigger="load"
                         hx-swap="innerHTML">
                        <div class="flex items-center justify-center py-8">
                            <span class="loading loading-spinner loading-lg text-primary"></span>
                        </div>
                    </div>
```

- [ ] **Step 2: Remove the dead `network-status-change` listener**

In `frontend/web/static/js/htmxWidgets.js`, the `init()` method has two listeners. Keep the `online` one (harmless network-recovery refresh), delete the `network-status-change` one. Replace:

```javascript
            // Refresh on network recovery
            window.addEventListener('online', () => {
                console.debug('[HTMXWidgets] Network online - refreshing widgets');
                this.refreshAll();
            });

            // Refresh on custom network-status-change event
            window.addEventListener('network-status-change', (event) => {
                if (event.detail && event.detail.status === 'online') {
                    console.debug('[HTMXWidgets] Network status change to online - refreshing widgets');
                    this.refreshAll();
                }
            });
        }
```

with:

```javascript
            // Refresh on network recovery
            window.addEventListener('online', () => {
                console.debug('[HTMXWidgets] Network online - refreshing widgets');
                this.refreshAll();
            });
        }
```

- [ ] **Step 3: Verify the endpoint URL is correct**

Run: `grep -n "recent-html" backend/app/api/v1/endpoints/facts.py`
Expected: a line matching `@router.get("/recent-html", response_class=HTMLResponse)` — confirms `/api/v1/facts/recent-html` exists.

- [ ] **Step 4: Commit**

```bash
git add frontend/web/templates/index.html frontend/web/static/js/htmxWidgets.js
git commit -m "fix(dashboard): self-load recent-transactions widget, drop dead network-status listener"
```

---

## Task 2: Remove P2P frontend (Spec B)

**Files:**
- Delete: `frontend/web/static/js/ui/P2PUIController.js`, `P2PTemplates.js`, `P2PRelayService.js`
- Delete: `frontend/web/templates/p2p/` (3 files)
- Delete: `frontend/web/static/css/p2p.css` (+ `p2p.min.css`)
- Delete: `tests/manual/p2p-ios-safari.test.js`
- Modify: `frontend/web/templates/base.html` (lines ~123-124, ~443-455, ~895, ~1279-1293)
- Modify: `package.json` (lines 16, 21)

- [ ] **Step 1: Delete P2P JS, templates, CSS, and the manual test**

```bash
git rm frontend/web/static/js/ui/P2PUIController.js \
       frontend/web/static/js/ui/P2PTemplates.js \
       frontend/web/static/js/ui/P2PRelayService.js \
       frontend/web/templates/p2p/p2p-initiator.html \
       frontend/web/templates/p2p/p2p-scanner.html \
       frontend/web/templates/p2p/p2p-status.html \
       frontend/web/static/css/p2p.css \
       tests/manual/p2p-ios-safari.test.js
rm -f frontend/web/static/css/p2p.min.css
rmdir frontend/web/templates/p2p 2>/dev/null || true
```

- [ ] **Step 2: Remove the P2P CSS link from `base.html`**

In `frontend/web/templates/base.html`, delete:

```html
    <!-- P2P Sync UI styles (modal, QR scanner, status overlay) -->
    <link rel="stylesheet" href="/static/css/p2p.min.css?v=PLACEHOLDER">

```

- [ ] **Step 3: Remove the P2P sync button from `base.html`**

In `frontend/web/templates/base.html`, delete the whole wrapper block:

```html
            <!-- P2P Sync Button (mobile/tablet only, shown when WebRTC available) -->
            <div id="p2p-sync-btn-wrapper"
                 class="tooltip tooltip-bottom hidden lg:!hidden"
                 data-tip="P2P синхронизация (без интернета)">
                <button id="p2p-sync-btn"
                        class="btn btn-ghost btn-circle btn-sm sm:btn-md"
                        onclick="window.p2pUI?.open()"
                        aria-label="P2P синхронизация">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/>
                    </svg>
                </button>
            </div>

```

- [ ] **Step 4: Remove the `p2p-status.html` include from `base.html`**

In `frontend/web/templates/base.html`, delete the line:

```html
    {% include 'p2p/p2p-status.html' %}
```

(Leave the surrounding `{% include 'scripts/push-bell-manager.html' %}` and the `{% if user %}` block intact.)

- [ ] **Step 5: Remove the P2P `<script type="module">` block from `base.html`**

In `frontend/web/templates/base.html`, delete:

```html
    <!-- P2P Sync: show button if WebRTC available -->
    <script type="module">
        import { p2pUIController } from '/static/js/ui/P2PUIController.js?v=PLACEHOLDER';
        // Show P2P button if RTCPeerConnection is supported and HTTPS
        const isHttps = location.protocol === 'https:' || location.hostname === 'localhost';
        if (typeof RTCPeerConnection !== 'undefined' && isHttps) {
            const wrapper = document.getElementById('p2p-sync-btn-wrapper');
            if (wrapper) wrapper.classList.remove('hidden');
        }
        // Also show on p2p-capability-change event from networkDetector
        window.addEventListener('p2p-capability-change', (e) => {
            const wrapper = document.getElementById('p2p-sync-btn-wrapper');
            if (wrapper && e.detail?.capable) wrapper.classList.remove('hidden');
        });
    </script>
```

(Leave the closing `</body></html>` intact.)

- [ ] **Step 6: Remove the `minify:p2p` script from `package.json`**

In `package.json`, delete the line (line ~16):

```json
    "minify:p2p": "postcss --config config/postcss.config.js frontend/web/static/css/p2p.css -u cssnano -o frontend/web/static/css/p2p.min.css",
```

- [ ] **Step 7: Remove `minify:p2p` from the `build:css` chain in `package.json`**

In `package.json` line ~21, in the `build:css` value, remove ` && npm run minify:p2p`. Replace:

```json
    "build:css": "npm run build:tailwind && npm run minify:tailwind && npm run minify:overrides && npm run minify:custom-css && npm run minify:choices && npm run minify:lists && npm run minify:p2p && npm run minify:calendar-widget && npm run minify:z-index && npm run minify:vendor-css && npm run minify:plan",
```

with:

```json
    "build:css": "npm run build:tailwind && npm run minify:tailwind && npm run minify:overrides && npm run minify:custom-css && npm run minify:choices && npm run minify:lists && npm run minify:calendar-widget && npm run minify:z-index && npm run minify:vendor-css && npm run minify:plan",
```

- [ ] **Step 8: Verify no P2P references remain in frontend**

Run: `grep -rni "p2p" frontend/web/templates/ frontend/web/static/js/ frontend/web/static/css/ package.json | grep -v ".min."`
Expected: no matches (empty output). If any appear, remove them.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(p2p): remove dead P2P sync frontend (JS, templates, CSS, build step)"
```

---

## Task 3: Remove P2P backend (Spec B)

**Files:**
- Delete: `backend/app/api/v1/endpoints/p2p.py`
- Modify: `backend/app/api/v1/endpoints/__init__.py:41,76`
- Modify: `backend/app/api/v1/router.py:28,110-111`

> **Note:** All three edits must land together — `router.py` imports `p2p_router` from `endpoints/__init__.py`, which imports it from `p2p.py`. Deleting the file without removing both references breaks the import chain at app startup.

- [ ] **Step 1: Delete the backend P2P endpoint module**

```bash
git rm backend/app/api/v1/endpoints/p2p.py
```

- [ ] **Step 2: Remove the import + `__all__` entry from `endpoints/__init__.py`**

In `backend/app/api/v1/endpoints/__init__.py`, delete the import line (line ~41):

```python
from backend.app.api.v1.endpoints.p2p import router as p2p_router
```

and delete the `__all__` entry (line ~76):

```python
    "p2p_router",
```

- [ ] **Step 3: Remove the import + router registration from `router.py`**

In `backend/app/api/v1/router.py`, delete the import entry (line ~28, inside the multi-name import):

```python
    p2p_router,
```

and delete the registration block (lines ~110-111):

```python
# P2P Sync endpoints (WebRTC peer-to-peer sync) ✅
api_router.include_router(p2p_router)
```

- [ ] **Step 4: Verify backend imports are clean**

Run: `grep -rn "p2p" backend/app/ --include=*.py`
Expected: no matches (empty output).

- [ ] **Step 5: Verify the router module still imports without error**

Run: `cd backend && python -c "import ast; ast.parse(open('app/api/v1/router.py').read()); ast.parse(open('app/api/v1/endpoints/__init__.py').read()); print('parse OK')"`
Expected: `parse OK`
(Full app import requires the Docker env; AST parse confirms no syntax/leftover-reference breakage. Runtime import is validated in CI.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(p2p): remove dead P2P sync backend endpoint and router wiring"
```

---

## Task 4: Remove offline orphans in templates + TS (Spec C)

**Files:**
- Modify: `frontend/web/templates/index.html` (`pending-records-card` block ~73-131)
- Modify: `frontend/web/static/js/dashboard/recentTransactions.ts:79`
- Modify: `frontend/web/static/js/plan/crud.ts:1360,1383-1404,1419-1424`

> **Note:** The `data-offline-hidden` attributes on `#recent-transactions-card` / `#recent-transactions` were already removed in Task 1 Step 1. This task removes the remaining offline orphans.

- [ ] **Step 1: Delete the `pending-records-card` block from `index.html`**

In `frontend/web/templates/index.html`, delete the entire block from the comment through its closing `</div>` — it starts at:

```html
            <!-- Pending Records (shown when offline or items waiting to sync) -->
            <div id="pending-records-card" class="card bg-base-100 shadow-xl hidden">
```

and ends with the matching close before the grid wrapper closes:

```html
                </div>
            </div>
        </div>
```

The block contains: `pending-records-card` → `card-body` → `⏳ Ожидают синхронизации` heading, `pending-records-container` (desktop table + mobile list), and `pending-records-actions` (retry/delete buttons). Delete all of it. Keep the outer grid `</div>` (the one that wraps `recent-transactions-card`).

After deletion, verify the grid wrapper still has exactly one closing `</div>`:

Run: `grep -n "pending-records\|recent-transactions-card\|grid grid-cols-1 gap-6" frontend/web/templates/index.html`
Expected: `recent-transactions-card` and the grid line present, **no** `pending-records` matches.

- [ ] **Step 2: Remove the orphan `☁️` header from `recentTransactions.ts`**

In `frontend/web/static/js/dashboard/recentTransactions.ts`, delete the desktop-table header cell (line 79):

```typescript
            <th title="Создано offline">☁️</th>
```

(This header has no matching `<td>` data cell and the mobile list has no such column — header only.)

- [ ] **Step 3: Remove the offline-display payload fields from `crud.ts`**

In `frontend/web/static/js/plan/crud.ts`, in the `recurringData` object, delete the offline-display fields:

```typescript
        // Add names, type, and date for offline display in pending-records-card
        article_name: articleName,
        article_type: articleType,
        financial_center_name: financialCenterName,
        cost_center_name: costCenterName,
        plan_date: startDate,  // For pending records date display
```

- [ ] **Step 4: Remove the now-orphaned upstream extraction in `crud.ts`**

`noUnusedLocals` is `true` in `tsconfig.json`, so the variables that fed those deleted fields are now unused and will fail type-check. Delete the block (lines ~1383-1404):

```typescript
      const articleSelect = document.querySelector(`#${modalId} select[name="article_id"]`) as HTMLSelectElement | null;
      const financialCenterSelect = document.querySelector(`#${modalId} select[name="financial_center_id"]`) as HTMLSelectElement | null;
      const costCenterSelect = document.querySelector(`#${modalId} select[name="cost_center_id"]`) as HTMLSelectElement | null;

      const articleName = articleSelect?.selectedOptions[0]?.textContent || null;
      const financialCenterName = financialCenterSelect?.selectedOptions[0]?.textContent || null;
      const costCenterName = costCenterId ? (costCenterSelect?.selectedOptions[0]?.textContent || null) : null;

      // Try to get article type from data attribute or fetch (for offline display color)
      let articleType = articleSelect?.selectedOptions[0]?.dataset?.type || null;
      if (!articleType && articleId) {
        try {
          const articleResp = await fetch(`/api/v1/articles/${articleId}`, { credentials: 'include' });
          if (articleResp.ok) {
            const articleData = await articleResp.json();
            articleType = articleData.type;
          }
        } catch (err) {
          // Ignore error - type is optional for offline display
          logCrud.warn('[createPlan] Failed to fetch article type:', err);
        }
      }
```

> Keep the `articleId` / `financialCenterId` / `costCenterId` parsing just above (lines ~1361-1363) — those are still used by validation and by `recurringData.article_id / financial_center_id / cost_center_id`.

- [ ] **Step 5: Fix the now-stale comment in `crud.ts`**

The `articleId` parsing block had the comment `// Get names from select elements for offline display` (line ~1360). The names are gone; relabel it. Replace:

```typescript
      // Get names from select elements for offline display
      const articleId = parseInt(formData.get('article_id') as string);
```

with:

```typescript
      // Parse IDs from form
      const articleId = parseInt(formData.get('article_id') as string);
```

- [ ] **Step 6: Verify type-check passes**

Run: `npm run type-check`
Expected: PASS, no `noUnusedLocals` errors for `articleSelect`, `articleName`, `articleType`, etc.

- [ ] **Step 7: Commit**

```bash
git add frontend/web/templates/index.html frontend/web/static/js/dashboard/recentTransactions.ts frontend/web/static/js/plan/crud.ts
git commit -m "refactor(offline): remove pending-records-card orphans and offline-display payload fields"
```

---

## Task 5: Restore push frontend (Spec D)

**Files:**
- Create: `frontend/web/static/js/notifications/pushManager.ts` (from git `7637d373^`)
- Modify: `build-all.js` (add bundle entry near the `facts`/`dashboard` entries ~209-219)
- Modify: `frontend/web/templates/base.html` (re-add `<script>` in the `{% if user %}` head block ~388-389)

> **Context:** `pushManager.ts` is 516 lines, has **zero imports** (confirmed self-contained), and sets `window.budgetPushManager = new PushNotificationManager()`. It was deleted only because it lived under `static/js/offline/`. Web push is not an offline feature — the backend (`endpoints/push.py`, VAPID, scheduler) is still alive.

- [ ] **Step 1: Restore the source to a non-offline path**

```bash
mkdir -p frontend/web/static/js/notifications
git show 7637d373^:frontend/web/static/js/offline/pushManager.ts > frontend/web/static/js/notifications/pushManager.ts
```

- [ ] **Step 2: Verify the restored file is self-contained**

Run: `grep -nE "^import |from '" frontend/web/static/js/notifications/pushManager.ts; grep -n "window.budgetPushManager" frontend/web/static/js/notifications/pushManager.ts`
Expected: no `import`/`from` matches (zero deps); one `window.budgetPushManager = new PushNotificationManager();` line. If any offline import appears, stop and re-evaluate.

- [ ] **Step 3: Add the bundle entry to `build-all.js`**

In `build-all.js`, add a new entry to the `builds` array, right after the `dashboard` entry (the entry ending at line ~219, before the `// === Service Worker ===` comment). Insert:

```javascript
  {
    name: 'pushManager',
    input: 'frontend/web/static/js/notifications/pushManager.ts',
    output: 'frontend/web/static/js/notifications/pushManager.min.js',
    globalName: 'PushManager'
  },
```

so the array reads:

```javascript
  {
    name: 'dashboard',
    input: 'frontend/web/static/js/dashboard/index.ts',
    output: 'frontend/web/static/js/dashboard.min.js',
    globalName: 'Dashboard'
  },
  {
    name: 'pushManager',
    input: 'frontend/web/static/js/notifications/pushManager.ts',
    output: 'frontend/web/static/js/notifications/pushManager.min.js',
    globalName: 'PushManager'
  },

  // === Service Worker ===
```

- [ ] **Step 4: Re-add the `<script>` tag to `base.html`**

In `frontend/web/templates/base.html`, inside the `{% if user %}` auth-required scripts block (after `incrementalUpdates.min.js`, line ~389), add the push-manager script. Replace:

```html
    {% if user %}
    <!-- Auth-required scripts (только для авторизованных) -->
    <script src="/static/js/budget/budgetWSClient.min.js?v=PLACEHOLDER"></script>
    <script src="/static/js/budget/incrementalUpdates.min.js?v=PLACEHOLDER"></script>
    {% endif %}
```

with:

```html
    {% if user %}
    <!-- Auth-required scripts (только для авторизованных) -->
    <script src="/static/js/budget/budgetWSClient.min.js?v=PLACEHOLDER"></script>
    <script src="/static/js/budget/incrementalUpdates.min.js?v=PLACEHOLDER"></script>
    <!-- Push Notifications (sets window.budgetPushManager; required before push-banner logic) -->
    <script src="/static/js/notifications/pushManager.min.js?v=PLACEHOLDER"></script>
    {% endif %}
```

> This loads before the inline push-banner logic block (~line 1097+) which reads `window.budgetPushManager`.

- [ ] **Step 5: Verify type-check + bundle build the new entry**

Run: `npm run type-check && npm run bundle`
Expected: PASS; `frontend/web/static/js/notifications/pushManager.min.js` is produced.

Run: `ls -la frontend/web/static/js/notifications/pushManager.min.js`
Expected: file exists.

- [ ] **Step 6: Commit**

```bash
git add frontend/web/static/js/notifications/pushManager.ts build-all.js frontend/web/templates/base.html
git commit -m "fix(push): restore web-push frontend bundle removed with offline cleanup"
```

---

## Task 6: Guard `#filter-article` init (Spec E)

**Files:**
- Modify: `frontend/web/static/js/facts/index.ts:124`

> **Context:** `facts.min.js` loads on the dashboard (for the add-fact modal). Its init unconditionally calls `initFactsFilterArticle()` → `ChoicesCategoryTree` on `#filter-article`, which exists only on the facts page → noisy `Element not found` warning on the dashboard. The dependent `filter-article-type` change listener already uses optional chaining (`articleTypeEl?.addEventListener`), so only the unconditional call needs a guard.

- [ ] **Step 1: Wrap the init in an element-existence check**

In `frontend/web/static/js/facts/index.ts`, replace:

```typescript
    // Initialize ChoicesCategoryTree for #filter-article
    initFactsFilterArticle();
```

with:

```typescript
    // Initialize ChoicesCategoryTree for #filter-article (facts page only)
    if (document.getElementById('filter-article')) {
        initFactsFilterArticle();
    }
```

- [ ] **Step 2: Confirm the dependent `filter-article-type` listener is already guarded**

Spec E asks to guard the dependent `filter-article-type` change listener "the same way". Verify it already uses optional chaining (no edit needed):

Run: `grep -n "filter-article-type\|articleTypeEl" frontend/web/static/js/facts/index.ts`
Expected: the listener is registered via `articleTypeEl?.addEventListener('change', ...)` — the `?.` short-circuits when `#filter-article-type` is absent (dashboard), so no `Element not found` warning. No code change required for this listener. If the `?.` is missing, add it.

- [ ] **Step 3: Verify type-check passes**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/web/static/js/facts/index.ts
git commit -m "fix(facts): guard filter-article init so dashboard stops logging Element not found"
```

---

## Task 7: Redis monitoring clarity (Spec F — display only)

**Files:**
- Modify: `frontend/web/templates/admin_monitoring.html:125,132`

> **Context:** The headline cards already surface the real values — `Ключей в кеше` (`total_keys`, line ~628-629) and `Cache Hit Ratio` (`hit_ratio`, line ~637-638) are already rendered by `renderRedisStats()`, parsed from the backend message regex. No backend change and no new headline card is needed. The only remaining clarity gap is the **detailed** section's `Keyspace Hits` / `Keyspace Misses` cards, which show cumulative-since-restart monotonic counters without saying so. This task relabels those two cards.

- [ ] **Step 1: Relabel `Keyspace Hits`**

In `frontend/web/templates/admin_monitoring.html`, replace:

```html
                        <div class="stat-title">Keyspace Hits</div>
                        <div class="stat-value text-success" id="redis-hits">--</div>
```

with:

```html
                        <div class="stat-title">Keyspace Hits</div>
                        <div class="stat-value text-success" id="redis-hits">--</div>
                        <div class="stat-desc">cumulative (с момента перезапуска)</div>
```

- [ ] **Step 2: Relabel `Keyspace Misses`**

In `frontend/web/templates/admin_monitoring.html`, replace:

```html
                        <div class="stat-title">Keyspace Misses</div>
                        <div class="stat-value text-error" id="redis-misses">--</div>
```

with:

```html
                        <div class="stat-title">Keyspace Misses</div>
                        <div class="stat-value text-error" id="redis-misses">--</div>
                        <div class="stat-desc">cumulative (с момента перезапуска)</div>
```

- [ ] **Step 3: Verify the headline cards already exist (no change expected)**

Run: `grep -n "Ключей в кеше\|Cache Hit Ratio" frontend/web/templates/admin_monitoring.html`
Expected: both present — confirms `total_keys` and `hit_ratio` are already headline metrics.

- [ ] **Step 4: Commit**

```bash
git add frontend/web/templates/admin_monitoring.html
git commit -m "fix(monitoring): label Redis keyspace hits/misses as cumulative-since-restart"
```

---

## Task 8: Finalize — full build, docs sync, version bump

**Files:**
- Modify: `lat.md/` (only if a section is now stale)
- Modify: `VERSION`

- [ ] **Step 1: Run the full build**

Run: `npm run build`
Expected: PASS — type-check + CSS (no `minify:p2p` step) + bundles (incl. restored `pushManager`) + verify, all green.

- [ ] **Step 2: Run frontend unit tests (regression guard)**

Run: `npm run test:coverage`
Expected: PASS — confirms the deletions in `crud.ts` / `recentTransactions.ts` did not break existing dashboard/facts tests.

- [ ] **Step 3: Sync `lat.md/` if needed and run lat check**

The frontend docs already state "No local IndexedDB — all data fetched from REST API" (`lat.md/frontend.md`), so the offline/P2P removal is already reflected. Check whether any section still mentions P2P:

Run: `grep -rni "p2p" lat.md/ || echo "no p2p refs in lat.md"`
Expected: `no p2p refs in lat.md` (if matches appear, update those sections to remove P2P references).

Then run lat check:

Run: `"${CLAUDE_CONFIG_DIR}/scripts/lat-runner.sh" check`
Expected: all links/code-refs valid (no broken refs to deleted `p2p.py` / `P2PUIController.js` / `pushManager` old path).

- [ ] **Step 4: Bump `VERSION` (+1 patch)**

Read the current value, increment the patch by one (e.g. `0.6.198` → `0.6.199`), and write it back:

Run: `cat VERSION`
Then update `VERSION` to the next patch value.

- [ ] **Step 5: Commit version bump**

```bash
git add VERSION lat.md
git commit -m "chore(release): bump version for offline-removal regression fixes"
```

- [ ] **Step 6: Final manual smoke checks (from spec Verification)**

After deploy to `fbd.ikeniborn.ru` via CI (no server build), confirm:
1. Dashboard → spinner replaced by recent transactions (or "no records" alert).
2. Browser console clean: no P2P module errors, no `budgetPushManager` warning, no `#filter-article` warning, no ServiceWorker 404 errors for `offline/p2p/*`.
3. Push permission banner appears (where supported); bell works.
4. Facts page filter-article widget still works (regression check for Task 6).
5. Monitoring page shows real key count + hit-rate as headline stats; hits/misses labeled cumulative.

---

## Task 9: Clean stale offline ServiceWorker + test references (Spec Out-of-Scope follow-up)

**Files:**
- Modify: `sw.js:69`
- Modify: `frontend/tests/unit/websocket/budgetWSClient-plan.test.ts:59-67`

> **Context:** Added after Task 8 to close two regressions surfaced by the offline removal that the original 8 tasks did not cover. The spec's **Out of Scope** explicitly anticipated the first: *"the stale `offline/offlineManager.min.js` precache entry on `sw.js:69` is harmless via `Promise.allSettled` and may be cleaned opportunistically."* In practice the entry produced a SW install-time 404 (the file no longer exists), so it was promoted from "opportunistic" to a real fix. The second is the consequential unit-test update — a `budgetWSClient` assertion still required the removed `offlineManager` side-effect.

- [x] **Step 1: Drop the deleted-module precache entry in `sw.js`**

In `sw.js`, inside `OFFLINE_PAGE_ASSETS`, remove the orphan precache line:

```javascript
  // JS - offline support
  '/static/js/offline/offlineManager.min.js',
```

(`offline/` was deleted in `7637d373`; precaching a 404 fails SW install.)

- [x] **Step 2: Drop the stale `offlineManager` assertion in the WS plan test**

In `frontend/tests/unit/websocket/budgetWSClient-plan.test.ts`, the `_handlePlanCreated` non-regression test asserted the handler still notifies `offlineManager` — a side-effect removed with the offline layer. Rename the test and drop the dead assertion:

```typescript
  it('handler still notifies UI handlers', () => {
    // Non-regression: we did not accidentally strip other side-effects.
    const created = extractMethod(source, '_handlePlanCreated');
    expect(created).toMatch(/_notifyHandlers\(\s*['"]plan_created['"]/);
  });
```

- [x] **Step 3: Commits (already landed)**

```
2f59db2d test(ws): drop stale offlineManager assertion removed with offline cleanup
ae4993ba fix(sw): drop precache of deleted offline/offlineManager.min.js (install 404)
```

---

## Self-Review

**Spec coverage:**
- A (stuck loader) → Task 1 ✓
- B (remove P2P frontend) → Task 2 ✓; B (backend) → Task 3 ✓; B (P2P CSS + build step) → Task 2 Steps 1,6,7 ✓
- C (offline orphans templates + dashboard TS) → Task 4 ✓
- D (restore push frontend) → Task 5 ✓
- E (guard `#filter-article`) → Task 6 ✓
- F (Redis monitoring clarity) → Task 7 ✓ (scoped down: headline cards already exist; only relabel needed — documented in task context)
- Verification + VERSION bump + lat sync → Task 8 ✓
- Out-of-Scope follow-up (stale SW precache + WS test) → Task 9 ✓ (sw.js install 404 + dead `offlineManager` assertion)

**Deviations from spec, with rationale:**
- **Task 9 added post-plan.** Two regressions outside the original 8 tasks: the `sw.js` precache 404 (anticipated by spec Out-of-Scope, promoted to a real fix because it broke SW install) and the dependent `budgetWSClient-plan.test.ts` assertion on the removed `offlineManager` side-effect. Both are direct consequences of the offline removal, not scope creep.
- **F is smaller than the spec describes.** The spec asks to "surface `total_keys` and `hit_ratio` as headline metrics" — but `renderRedisStats()` in `admin_monitoring.html:619-651` already renders both as headline `stat-value` cards (`Ключей в кеше`, `Cache Hit Ratio`). Adding them again would duplicate. Only the relabel of the cumulative hits/misses remains. This is the honest surgical scope.
- **C touches more of `crud.ts` than line 1419 alone.** The spec points at line 1419, but with `noUnusedLocals: true` the upstream extraction (lines 1383-1404) becomes unused once the payload fields are removed, so it must be removed in the same change or type-check fails. Documented in Task 4 Steps 3-5.
- **No red/green unit tests added.** This plan is deletion + wiring of dead code; the codebase has no existing tests for the touched render/init paths, and adding harness-heavy tests for code being removed violates the project's "Simplicity First" rule. Verification is build + type-check + existing test suite + manual smoke (Task 8). This is a deliberate, stated choice.

**Placeholder scan:** No `TBD`/`TODO`/"add error handling"/"similar to Task N" — every code step shows exact before/after. ✓

**Type/name consistency:** `pushManager.min.js` path used identically in Task 5 Step 3 (build output), Step 4 (script src), and Step 5 (verify). `window.budgetPushManager` used consistently. `initFactsFilterArticle` name matches the import in `facts/index.ts`. `recent-transactions` id + `/api/v1/facts/recent-html` URL consistent between Task 1 and the verified endpoint. ✓

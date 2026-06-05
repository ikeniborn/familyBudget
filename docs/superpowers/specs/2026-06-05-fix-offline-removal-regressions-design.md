---
review:
  spec_hash: 934b436bfe59086e
  last_run: 2026-06-05
  phases:
    structure:   { status: passed }
    coverage:    { status: passed }
    clarity:     { status: passed }
    consistency: { status: passed }
  findings:
    - id: F-001
      phase: clarity
      severity: WARNING
      section: "### B. Remove P2P sync (frontend + backend)"
      section_hash: f433759e0c9c4fbe
      text: "'Drop P2P static CSS if orphaned' — conditional without explicit orphan-check criterion or file name."
      verdict: fixed
      verdict_at: 2026-06-05
    - id: F-002
      phase: clarity
      severity: INFO
      section: "### F. Redis monitoring clarity (frontend only)"
      section_hash: f515d9a347a51808
      text: "'expose total_keys/hit_ratio through the stats endpoint if not already present' — verify endpoint actually returns both fields; conditional left to implementer."
      verdict: fixed
      verdict_at: 2026-06-05
    - id: F-003
      phase: coverage
      severity: INFO
      section: "### C. Remove offline orphans — templates + dashboard TS"
      section_hash: aa1a6cf044374766
      text: "Claims 'desktop + mobile render' for the offline column; only one <th> confirmed in recentTransactions.ts. Confirm mobile card render also carries it before removal."
      verdict: fixed
      verdict_at: 2026-06-05
chain:
  intent: null
---

# Fix Offline/Dexie Removal Regressions

**Date:** 2026-06-05
**Branch base:** `test`
**Related:** `2026-06-04-remove-dexie-offline-design.md`, commit `7637d373` (Dexie source dirs deleted)

## Problem

After the Dexie/offline removal (v0.6.195+), the dashboard shows a stuck loading
spinner and the browser console is full of errors. Root cause in every case is the
same: code that still depended on now-deleted offline modules was left behind.

Observed symptoms on `https://fbd.ikeniborn.ru/`:

- Loading spinner on "📈 Последние записи" never disappears.
- `Loading failed for module .../offline/p2p/P2PManager.js` (×3) + ServiceWorker
  "intercepted the request and encountered an unexpected error".
- `[PUSH_BANNER] ⚠️ budgetPushManager not available - banner disabled`.
- `[ChoicesCategoryTree] Element not found: #filter-article`.
- User-reported concern: Redis keys "growing strangely".

## Root Cause Analysis

### A. Stuck loader (`#recent-transactions`)

`frontend/web/templates/index.html` — the "Последние записи" widget is a spinner
placeholder with **no** `hx-trigger="load"`. Unlike its siblings `quick-stats` and
`account-balances` (which self-load), `recent-transactions` was populated only by
`HTMXWidgets.refreshAll()`, fired by the `network-status-change` / `online` event
emitted by the offline `networkDetector` module. `networkDetector` was deleted in
`7637d373`, so the event never fires and the spinner stays forever.

### B. P2P console errors (`P2PUIController.js`)

`base.html:1281` loads `ui/P2PUIController.js`, which statically imports three
deleted modules: `offline/p2p/{P2PManager,P2PSyncProtocol,P2PMerge}.js`. The
`offline/` directory is gone → 404 → module load failure + ServiceWorker error on
the intercepted 404. P2P sync was built on top of the Dexie/IndexedDB data layer;
with that gone, it has nothing to sync and is entirely dead.

### C. Offline orphans in templates

`index.html` still contains: `data-offline-hidden` attributes, the entire
`pending-records-card` ("Ожидают синхронизации") sync UI, "hidden when offline"
comments. `recentTransactions.ts` renders an orphan "Создано offline ☁️" header.
`plan/crud.ts:1419` writes into `pending-records-card`. All dead.

### D. Push notifications accidentally removed

`pushManager.ts` (516 lines, **zero imports**, fully self-contained) was deleted in
`7637d373` only because it lived in `static/js/offline/`. Web push is **not** an
offline feature: the backend (`endpoints/push.py`, VAPID config, scheduler,
subscriptions) is still alive and functional. The frontend `window.budgetPushManager`
singleton is gone, so the push-permission banner and bell are permanently disabled
and the backend push endpoints are orphaned.

### E. `#filter-article` warning

`index.html:236` loads `facts.min.js` on the dashboard (needed for the add-fact
modal). Its init unconditionally calls `initFactsFilterArticle()` →
`ChoicesCategoryTree` on `#filter-article`, an element that exists only on the facts
page. Harmless but noisy warning.

### F. Redis keys — not a leak

Audit of every Redis key family shows all are bounded:

| Key | Bound |
| --- | --- |
| `cache:*` | TTL (`ex=ttl_seconds`) |
| `p2p:relay:*` | TTL (`RELAY_TTL_SECONDS`) |
| `budget:event_buffer` | trimmed by age 60s + size 1000 |
| `write_queue:facts` | drained by flush worker |
| `write_queue:facts:failed` (DLQ) | size cap + TTL cleanup |
| `LOCK_KEY` | TTL 30s |

The monitoring screenshot shows `INFO stats` **cumulative monotonic counters**
(`keyspace_hits` 4.68M, `keyspace_misses` 165K) which only grow until Redis restarts
(uptime 54 days). Memory Peak is 1.97 MB. There is no leak. The page is misleading
because it surfaces cumulative counters instead of the actual key count.
`redis_service.py` already computes `total_keys` (from keyspace info) and `hit_ratio`
in `RedisHealthResult` — they just aren't displayed as headline metrics.

## Solution

### A. Fix loader — `index.html` + `htmxWidgets.js`

Make `#recent-transactions` self-loading like its siblings:

```html
<div id="recent-transactions"
     hx-get="/api/v1/facts/recent-html?limit=10"
     hx-trigger="load"
     hx-swap="innerHTML"
     class="min-h-[200px]">
  <span class="loading loading-spinner loading-lg text-primary"></span>
</div>
```

Remove the dead `network-status-change` listener in `htmxWidgets.js:155-162`
(`online` listener can stay — harmless network-recovery refresh).

### B. Remove P2P sync (frontend + backend)

- Delete `static/js/ui/P2PUIController.js`, `P2PTemplates.js`, `P2PRelayService.js`.
- `base.html`: remove the `<script type="module">` P2P block (~1280-1293) and the
  `p2p-sync-btn-wrapper` button (~444-451).
- Delete `templates/p2p/` (initiator, scanner, status).
- Backend: delete `endpoints/p2p.py`, remove `p2p_router` import + `include_router`
  in `router.py` (lines ~28, ~111).
- Drop the P2P CSS: remove `frontend/web/static/css/p2p.css` (+ generated
  `p2p.min.css`), the `minify:p2p` script and its entry in the `build:css` chain in
  `package.json` (lines 16, 21), and the `<link rel="stylesheet" href=".../p2p.min.css">`
  at `base.html:124`. P2P CSS is referenced only from `base.html`, so it is fully dead.

### C. Remove offline orphans — templates + dashboard TS

- `index.html`: drop `data-offline-hidden` attributes, the whole `pending-records-card`
  block, "hidden/shown when offline" comments.
- `recentTransactions.ts`: remove the orphan `<th title="Создано offline">☁️</th>`
  header (line 79) from the desktop table. It has no matching `<td>` data cell and the
  mobile list render has no such column — header only.
- `plan/crud.ts:1419`: remove pending-records-card population logic.
- Remove any now-orphaned imports/exports created by the above.

### D. Restore push frontend

- Restore source from git to a non-offline path:
  `git show 7637d373^:frontend/web/static/js/offline/pushManager.ts`
  → `frontend/web/static/js/notifications/pushManager.ts` (verify it still sets
  `window.budgetPushManager = new PushNotificationManager()` and has no offline deps —
  audit confirms zero imports).
- Add it back to the bundle list in `build-all.js` (it was dropped there in `7637d373`).
- `base.html`: re-add `<script src="/static/js/notifications/pushManager.min.js?v=PLACEHOLDER"></script>`
  before the push-banner logic block (formerly line 388, path updated).
- Result: `window.budgetPushManager` available again → banner + bell work, backend
  `push.py` no longer orphaned.

### E. Guard `#filter-article` — `facts/index.ts`

Wrap the init so it only runs when the element exists:

```ts
if (document.getElementById('filter-article')) {
  initFactsFilterArticle();
}
```

Guard the dependent `filter-article-type` change listener the same way.

### F. Redis monitoring clarity (frontend only)

On the monitoring page ("Детальная статистика", `admin_monitoring.html`):

- Surface `total_keys` (DBSIZE-equivalent) as the headline "keys" metric.
- Surface `hit_ratio` % as a headline metric.
- Relabel Keyspace Hits / Misses as "cumulative (since restart)".

No backend change is needed: `check_redis_health()` already returns `total_keys` and
`hit_ratio`, and `health.py:191-194` already exposes them in the component message
("Keys: N", "Hit ratio: N%"). The template already parses both via regex
(`admin_monitoring.html:599-608`) — the values are simply not promoted to headline
stat cards. This is a display-only change.

## Out of Scope

- Re-implementing offline mode or P2P sync.
- Changing Redis caching/TTL behavior (no leak exists).
- The ServiceWorker `OFFLINE_PAGES`/offline-shell PWA behavior (separate decision;
  the stale `offline/offlineManager.min.js` precache entry on `sw.js:69` is harmless
  via `Promise.allSettled` and may be cleaned opportunistically).

## Verification

1. Open dashboard → spinner replaced by recent transactions (or "no records" alert).
2. Browser console clean: no P2P module errors, no `budgetPushManager` warning, no
   `#filter-article` warning.
3. Push permission banner appears (where supported); bell works.
4. Facts page filter-article widget still works (regression check for guard E).
5. `npm run build` passes (type-check + bundles, incl. restored pushManager).
6. Backend imports clean after `p2p.py` removal (`router.py` still imports).
7. Monitoring page shows real key count + hit-rate as headline stats.
8. Bump `VERSION` (+1 patch); deploy via CI (no server build).

## Affected Files (summary)

- `frontend/web/templates/index.html` (A, C)
- `frontend/web/templates/base.html` (B, D)
- `frontend/web/static/js/htmxWidgets.js` (A)
- `frontend/web/static/js/ui/P2P*.js` — delete (B)
- `frontend/web/templates/p2p/*` — delete (B)
- `frontend/web/static/css/p2p.css` — delete (B)
- `backend/app/api/v1/endpoints/p2p.py` — delete; `router.py` (B)
- `frontend/web/static/js/dashboard/recentTransactions.ts` (C)
- `frontend/web/static/js/plan/crud.ts` (C)
- `frontend/web/static/js/notifications/pushManager.ts` — restore; `build-all.js` (D)
- `frontend/web/static/js/facts/index.ts` (E)
- `frontend/web/templates/admin_monitoring.html` — display only (F)
- `package.json` (B build step removal, D bundle list)
- `lat.md/` — sync docs after change; run `lat check`
- `VERSION` — +1 patch

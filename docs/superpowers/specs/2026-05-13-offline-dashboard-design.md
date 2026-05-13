# Offline Dashboard — Design Spec

**Date:** 2026-05-13
**Status:** Approved for implementation

## Context

Dashboard has 3 data sections loaded via HTMX on page load:
- `#quick-stats` — `hx-get="/api/v1/analytics/quick-stats-html"` `hx-trigger="load"`
- `#account-balances` — `hx-get="/api/v1/analytics/account-balances-html"` `hx-trigger="load"`
- `#recent-transactions` — loaded via JS (`recentTransactions.ts`)

When offline: HTMX requests fail silently (spinner forever), recent-transactions hidden by CSS.
Dexie IndexedDB has all data: facts, articles, financial centers — including pending (offline-created) records.

**Goal:** When offline, compute dashboard data from Dexie and show it with an offline marker.
Pending facts are included in all aggregations.

## Decisions

- **Data source:** Live from Dexie (not cached HTML snapshots)
- **Visual style:** Same cards as online, with `📴 Данные из локального хранилища` badge per section
- **Trigger:** Proactive on page load + reactive on `offline-status-change` event

## Architecture

### New files

```
frontend/web/static/js/dashboard/features/offlineDashboard.ts
```

### Modified files

```
frontend/web/static/js/dashboard/features/factsManager.ts   — implement 3 Dexie aggregations
frontend/web/static/js/dashboard/recentTransactions.ts      — remove offline early-return
frontend/web/static/js/dashboard/index.ts                   — initialize coordinator
```

Template (`index.html`) is **not changed**.

### Lifecycle

```
Page load:
  base.html → sets html.offline-mode from localStorage (synchronous, before render)
  offlineDashboard.init() → registers htmx:beforeRequest listener

  offline-mode active:
    htmx:beforeRequest → e.preventDefault() → renderFromDexie()
    HTMX request never sent

  offline-mode inactive:
    HTMX fires normally, coordinator does nothing

offline-status-change { online: false }:
  renderAll() — replaces all 3 sections with Dexie data

offline-status-change { online: true }:
  clearAll() — restore spinners, restore data-offline-hidden on recent-transactions card
  htmx.trigger(#quick-stats, 'load')
  htmx.trigger(#account-balances, 'load')
  loadRecentTransactions()
```

## factsManager.ts — Dexie Aggregations

Replace 3 `fetchXxxFromAPI()` stubs with Dexie-first implementation.

**Shared pattern:**
```typescript
const manager = getDexieManager();
await manager.init();
const articles = await manager.queryArticles();
const articleMap = new Map(articles.map(a => [a.id, a])); // id → {name, type}
const fcs = await manager.queryFinancialCenters(userId);
const fcMap = new Map(fcs.map(fc => [fc.id, fc]));        // id → {name, type, currency}
// Filter: fact.sync_status !== 'deleted' (includes pending ✓)
```

`LocalBudgetFact` stores `article_id` and `financial_center_id` (no names, no article_type) — all resolved via Maps.

### loadRecentFacts(limit)

- `queryFacts({ date_from: today-90 })`
- filter `sync_status !== 'deleted'`, sort by `created_at DESC`, slice to `limit`
- map → `RecentFact[]` via articleMap + fcMap

### calculateQuickStats()

- 3 queries: today-facts (`record_type='fact'`), month-facts, month-plans
- group by `articleMap.get(f.article_id).type`, sum `f.amount`
- compute `planExecution` percentages

### loadAccountBalances()

- opening: all facts before month start (`record_type='fact'`)
- movement: facts month-start to today (`record_type='fact'`)
- sign: `income/credit → +amount`, `expense/debit → -amount` (resolved via articleMap)
- group by `financial_center_id`, join fcMap for names/currency
- active FCs with no facts show `balance=0`

**When Dexie inactive:** existing `return []` stubs remain — no change.

**New imports:**
```typescript
import { getDexieManager, isDexieActive } from '@db/dexie';
import { getCurrentUserId } from '@shared/utils/userHelpers';
```

`userId` for `queryFinancialCenters` comes from `await getCurrentUserId()` — same pattern used by `saveTransaction.ts`, `categoryLoader.ts`, etc.

## offlineDashboard.ts — Coordinator

```typescript
class OfflineDashboardCoordinator {
    private initialized = false;

    init(): void
    // Called from dashboard/index.ts at DOMContentLoaded
    // Registers htmx:beforeRequest + offline-status-change listeners

    private onHtmxBeforeRequest(e: Event): void
    // If offline-mode: e.preventDefault(), renderSection(e.detail.elt.id)
    // Targets: 'quick-stats', 'account-balances'

    private onOfflineStatusChange(e: CustomEvent): void
    // online=false → renderAll()
    // online=true  → clearAll() + retriggerHtmx()

    private async renderAll(): Promise<void>
    // try/catch wraps entire body — on failure shows "📴 Данные недоступны" placeholder
    // factsManager.initDashboard() [parallel Promise.all]
    // Renders all 3 sections + exposes #recent-transactions-card

    private async renderSection(sectionId: string): Promise<void>
    // Routes to renderQuickStats / renderAccountBalances by sectionId
    // Called from htmx:beforeRequest handler for targeted renders

    private renderQuickStats(data: QuickStats): void
    private renderAccountBalances(data: AccountBalance[]): void
    private renderRecentFacts(data: RecentFact[]): void
    // Each: set innerHTML on container with offline badge + DaisyUI cards

    private clearAll(): void
    // Restore spinners in containers
    // card.setAttribute('data-offline-hidden', 'true') on recent-transactions-card
    // htmx.trigger for HTMX sections
    // loadRecentTransactions() for recent-transactions
}

export const offlineDashboard = new OfflineDashboardCoordinator();
```

**Imports needed in `offlineDashboard.ts`:**
```typescript
import { factsManager } from './factsManager';
import { loadRecentTransactions } from '../recentTransactions';
import type { QuickStats, AccountBalance, RecentFact } from '../types/analytics';
```

### isOfflineMode() helper

No shared utility exists — inline check used throughout codebase. `offlineDashboard.ts` defines:
```typescript
function isOfflineMode(): boolean {
    return document.documentElement.classList.contains('offline-mode');
}
```

### Race condition mitigation

`hx-trigger="load"` fires on DOMContentLoaded. If `htmx:beforeRequest` listener registers after HTMX already sent requests, interception is missed.

Two-layer defence in `init()`:
1. If `isOfflineMode()` at init time — call `renderAll()` immediately (proactive, no HTMX dependency)
2. Register `htmx:beforeRequest` listener — cancels any late-fired HTMX loads and handles dynamic offline transitions

### HTMX interception

**Note:** HTMX cancellation requires `event.detail.cancel = true` — not `e.preventDefault()`.

```typescript
document.addEventListener('htmx:beforeRequest', (e) => {
    if (!isOfflineMode()) return;
    const elt = (e as CustomEvent).detail?.elt as HTMLElement;
    if (['quick-stats', 'account-balances'].includes(elt?.id)) {
        (e as CustomEvent).detail.cancel = true;
        void this.renderSection(elt.id);
    }
});
```

### Showing recent-transactions when offline

CSS hides `[data-offline-hidden="true"]` via `html.offline-mode` selector. Coordinator removes attribute to override:
```typescript
// go offline
card.removeAttribute('data-offline-hidden');
// come online
card.setAttribute('data-offline-hidden', 'true');
```

### Offline badge (all sections)

```html
<div class="flex items-center gap-1 text-xs text-base-content/50 mb-3">
  <span>📴</span><span>Данные из локального хранилища</span>
</div>
```

### RecentFact → RecentTransaction mapping

`buildRecentTransactionsHTML()` (existing) expects `RecentTransaction`. Map:
- `is_offline_sync = syncStatus === 'pending'`
- `recurring_plan_id = null`, `has_reminder = false` (not available without additional join)
- `description = comment`

## Edge Cases

| Situation | Behavior |
|---|---|
| Dexie not initialized | `manager.init()` awaited inside factsManager — waits for init |
| Dexie empty (first run, never synced) | Empty states shown with offline badge |
| Only pending facts (never been online) | Included in aggregations — user sees what they added |
| Network lost mid-request (HTMX already sent) | `htmx:responseError` — coordinator ignores; next `offline-status-change` fixes it |
| Online event while Dexie render in progress | `clearAll()` overwrites partial HTML — OK, HTMX re-renders fresh |
| `isDexieActive() = false` | Placeholder: "📴 Данные недоступны" |
| `renderAll()` called twice rapidly | Guard flag prevents double execution |

## Testing

### Vitest unit

```
factsManager.test.ts:
  ✓ loadRecentFacts — includes pending facts
  ✓ loadRecentFacts — excludes deleted facts
  ✓ calculateQuickStats — groups correctly by article.type
  ✓ calculateQuickStats — pending facts counted in today/month
  ✓ loadAccountBalances — expense/debit produce negative sign
  ✓ loadAccountBalances — FC with no facts shows balance=0

offlineDashboard.test.ts:
  ✓ htmx:beforeRequest — preventDefault when offline-mode
  ✓ htmx:beforeRequest — passes through when online
  ✓ offline-status-change(false) → renderAll() called
  ✓ offline-status-change(true) → htmx.trigger on both containers
  ✓ data-offline-hidden removed offline, restored online
```

### Playwright E2E

- `page.context().setOffline(true)` before load → offline badge visible
- Add transaction offline → quick-stats update reflects it
- `page.context().setOffline(false)` → HTMX re-triggers, server data shown, no badge

## Implementation Order

1. `factsManager.ts` — Dexie aggregations (testable in isolation)
2. `offlineDashboard.ts` — coordinator
3. `recentTransactions.ts` — remove early-return, integrate with coordinator
4. `dashboard/index.ts` — initialize coordinator
5. Tests

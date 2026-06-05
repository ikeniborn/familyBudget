---
review:
  plan_hash: b5ddab9abaa3677e
  spec_hash: 2a3e3e76bbe3adf2
  last_run: 2026-06-04
  phases:
    structure:     { status: passed }
    coverage:      { status: passed }
    dependencies:  { status: passed }
    verifiability: { status: passed }
    consistency:   { status: passed }
  findings: []
chain:
  intent: docs/superpowers/intents/2026-06-04-remove-dexie-offline-intent.md
  spec:   docs/superpowers/specs/2026-06-04-remove-dexie-offline-design.md
---
# Remove Dexie and Offline Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Dexie.js offline sync entirely; all data flows through server REST API + WebSocket only.

**Architecture:** Frontend pages call REST endpoints directly via `fetch`. WebSocket handlers update DOM only — no local DB writes. Backend drops sync-only endpoints (`sync.py`, `sync_handlers.py`) plus `sync_status` / `temp_id` / `is_offline_sync` / `content_hash` / `sync_hash` columns. Single branch `dev/remove-dexie`, single deploy at end.

**Tech Stack:** TypeScript (Rollup bundles), FastAPI 0.121, SQLAlchemy, Alembic, PostgreSQL 16.

**Branch:** `dev/remove-dexie` — create from `test`.

**Proposal-first zones (per intent):** Task 2 (plan WS handler), Task 7 (budgetWSClient handlers). Write proposal comment / DM before code.

---

## Setup: Branch Preparation

- [ ] **Step 0.1: Create branch from `test`**

```bash
git fetch origin
git checkout test
git pull --ff-only origin test
git checkout -b dev/remove-dexie
```

- [ ] **Step 0.2: Sanity check — count Dexie surface before changes**

```bash
grep -rln "dexie\|Dexie\|DataLayer\|sync_status\|temp_id\|is_offline_sync\|content_hash\|sync_hash\|isDexieActive\|getDexieManager\|offlineManager\|OfflineManager" \
  frontend/web/static/js/ frontend/shared/ frontend/web/templates/ backend/app/ \
  | sort -u | wc -l
```
Record the number. Final verification (Task 12) must reach 0 for frontend, and only retain backend matches that are legitimate non-Dexie usage (none expected).

---

## Task 1: Facts Page — Replace DataLayer with Direct API

**Files:**
- Modify: `frontend/web/static/js/facts/integration/factsAPI.ts`
- Modify: `frontend/web/static/js/facts/integration/dropdownAPI.ts`

Goal: facts page loads/creates/updates/deletes via fetch only. No Dexie cache sync; no `convertBudgetFact` (Dexie path), keep `convertAPIFact`.

- [ ] **Step 1.1: Strip Dexie imports from `factsAPI.ts`**

Remove top-of-file imports (lines 14–23):

```ts
import { dataLayer } from '../../data/DataLayer';
import type { DataLayerFetchOptions } from '../../data/DataLayer';
import type {
    FactFilters,
    LocalBudgetFact,
    LocalArticle,
    LocalFinancialCenter,
    LocalCostCenter
} from '@db/dexie';
import { getDexieManager, isDexieActive, mapAPIFactToLocal } from '@db/dexie';
```

Replace with the slimmed import set:

```ts
import type { FactFilters } from '../types/models';
```

Then remove `FactFilters` re-export from `factsAPI.ts` consumers if any (search project for `import.*FactFilters.*factsAPI`).

- [ ] **Step 1.2: Re-home `FactFilters` type**

`FactFilters` lived in `@db/dexie`. Add it to `frontend/web/static/js/facts/types/models.ts` (or create the file if absent):

```ts
export interface FactFilters {
  record_type?: 'fact' | 'plan';
  user_id?: number;
  article_id?: number;
  article_type?: 'expense' | 'income' | 'debit' | 'credit';
  date_from?: string;
  date_to?: string;
  financial_center_id?: number;
  cost_center_id?: number;
  search?: string;
}
```

Run `grep -rn "from '@db/dexie'" frontend/web/static/js/facts/` and replace each `FactFilters` import with `from '../types/models'`.

- [ ] **Step 1.3: Replace `loadFacts()` body in `factsAPI.ts` (lines 174–230)**

```ts
export async function loadFacts(): Promise<LoadFactsResponse> {
    const factFilters = buildFactFilters();
    const params = new URLSearchParams();
    if (factFilters.record_type)        params.set('record_type', factFilters.record_type);
    if (factFilters.user_id)            params.set('user_id', String(factFilters.user_id));
    if (factFilters.article_id)         params.set('article_id', String(factFilters.article_id));
    if (factFilters.article_type)       params.set('article_type', factFilters.article_type);
    if (factFilters.date_from)          params.set('date_from', factFilters.date_from);
    if (factFilters.date_to)            params.set('date_to', factFilters.date_to);
    if (factFilters.financial_center_id) params.set('financial_center_id', String(factFilters.financial_center_id));
    if (factFilters.cost_center_id)     params.set('cost_center_id', String(factFilters.cost_center_id));
    if (factFilters.search)             params.set('search', factFilters.search);
    params.set('limit', String(getLimit()));
    params.set('offset', String(getOffset()));

    const response = await fetch(`/api/v1/facts?${params}`, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const facts: BudgetFact[] = (data.facts ?? data).map(convertAPIFact);
    return {
        facts,
        total: data.total ?? facts.length,
        page: Math.floor(getOffset() / getLimit()),
        page_size: getLimit()
    };
}
```

- [ ] **Step 1.4: Replace `loadFactsCount()` (lines 236–249)**

```ts
export async function loadFactsCount(): Promise<number> {
    const factFilters = buildFactFilters();
    const params = new URLSearchParams();
    Object.entries(factFilters).forEach(([k, v]) => v != null && params.set(k, String(v)));
    const response = await fetch(`/api/v1/facts/count?${params}`, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.total ?? 0;
}
```

If `/api/v1/facts/count` doesn't exist, fall back to `loadFacts()` and return `.total` (verify via `grep -n "/facts/count" backend/app/api/v1/endpoints/facts.py`).

- [ ] **Step 1.5: Strip Dexie cache sync from `createFact()` (lines 317–331)**

Delete the entire `if (isDexieActive()) { … }` block — the `createdFact` is returned as-is.

- [ ] **Step 1.6: Strip Dexie cache sync from `updateFact()` (lines 409–421)**

Same: delete the `if (isDexieActive()) { … }` block; return `updatedFact` directly.

- [ ] **Step 1.7: Strip Dexie helpers from `deleteFact()` (lines 438–479)**

Replace whole body with:

```ts
export async function deleteFact(factId: number): Promise<void> {
    const response = await fetch(`/api/v1/facts/${factId}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
            const error = await response.json();
            if (error.detail) errorMsg = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail);
        } catch { /* non-JSON error */ }
        throw new Error(errorMsg);
    }
}
```

Also delete `findFactTempId()` helper (lines 347–361) and `convertBudgetFact()` (lines 87–115) — neither is reachable now.

- [ ] **Step 1.8: Remove `loadEnrichmentMaps()` (lines 153–172)**

Function is dead — `convertAPIFact` already provides enriched names. Delete.

- [ ] **Step 1.9: Rewrite `dropdownAPI.ts` `loadArticles/loadFinancialCenters/loadCostCenters`**

Replace lines 11 (`dataLayer` import) and rewrite three loaders:

```ts
// remove: import { dataLayer } from '../../data/DataLayer';
import { getCurrentUserId } from '@shared/utils/userHelpers';

export async function loadArticles(): Promise<Article[]> {
    const response = await fetch('/api/v1/articles', { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const articles = data.articles ?? data;
    if (!Array.isArray(articles)) throw new Error('Expected array of articles');
    return articles;
}

export async function loadFinancialCenters(): Promise<FinancialCenter[]> {
    const userId = await getCurrentUserId();
    const response = await fetch(`/api/v1/financial-centers?user_id=${userId}&include_global=true`, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.financial_centers ?? data;
}

export async function loadCostCenters(): Promise<CostCenter[]> {
    const userId = await getCurrentUserId();
    const response = await fetch(`/api/v1/cost-centers?user_id=${userId}&include_global=true`, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.cost_centers ?? data;
}
```

Verify response shape against actual endpoints by reading `backend/app/api/v1/endpoints/articles.py`, `financial_centers.py`, `cost_centers.py` GET handlers — adjust `data.articles ?? data` if the API wraps differently.

- [ ] **Step 1.10: Type-check**

```bash
npm run type-check
```
Expected: PASS. Fix any unresolved imports for `FactFilters`, `LocalBudgetFact`, etc., by importing from `../types/models` or removing the unused reference.

- [ ] **Step 1.11: Browser smoke**

Start dev container, open `/facts`, verify: list loads, create row, edit row, delete row, batch delete, filter by article + date. No console errors.

- [ ] **Step 1.12: Commit**

```bash
git add frontend/web/static/js/facts/
git commit -m "refactor(facts): replace DataLayer/Dexie with direct REST calls"
```

---

## Task 2: Plan Page — Replace DataLayer + Propose Simplified WS Handler

**Files:**
- Modify: `frontend/web/static/js/plan/index.ts`
- Modify: `frontend/web/static/js/plan/helpers.ts`
- Modify: `frontend/web/static/js/plan/wsEventHandlers.ts`
- Modify: `frontend/web/static/js/plan/factsTable.ts`

**Proposal-first per intent — Steps 2.4 / 2.5 require a written proposal before editing.**

- [ ] **Step 2.1: Strip Dexie init from `plan/index.ts`**

Delete import (line 25): `import { getDexieManager } from '@db/dexie';`. Delete function `ensureDexieReady()` (lines 128–142). Delete invocation inside `initialize()` (line 181): `await ensureDexieReady();`.

- [ ] **Step 2.2: Rewrite `plan/helpers.ts` data loaders**

Replace lines 102 (`is_offline_sync?: boolean;` from `BudgetFact`) — delete it. Then replace the three loaders (lines 210–264):

```ts
// remove: import { dataLayer } from '../data/DataLayer';
import { getCurrentUserId } from '@shared/utils/userHelpers';

export async function loadArticles(): Promise<Article[]> {
  const r = await fetch('/api/v1/articles', { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.articles ?? data;
}

export async function loadFinancialCenters(includeGlobal: boolean = true): Promise<FinancialCenter[]> {
  const userId = await getCurrentUserId();
  const r = await fetch(`/api/v1/financial-centers?user_id=${userId}&include_global=${includeGlobal}`, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.financial_centers ?? data;
}

export async function loadCostCenters(includeGlobal: boolean = true): Promise<CostCenter[]> {
  const userId = await getCurrentUserId();
  const r = await fetch(`/api/v1/cost-centers?user_id=${userId}&include_global=${includeGlobal}`, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.cost_centers ?? data;
}
```

- [ ] **Step 2.3: Remove `is_offline_sync` cloud icon from `plan/factsTable.ts`**

```bash
grep -n "is_offline_sync\|☁️" frontend/web/static/js/plan/factsTable.ts
```
For each hit, delete the icon render branch entirely; the row template must produce the same row whether the field was true or false.

- [ ] **Step 2.4: PROPOSAL (proposal-first zone) — simplified `plan/wsEventHandlers.ts`**

Before editing, post this proposal (commit message or PR comment) for review:

> After Dexie removal, `plan_created` / `plan_updated` handlers no longer need `syncFactToDexie`. Logic collapses to:
> - `plan_created` → `await fetchAndInjectPlanRow(id, 'create')`; fallback `debouncedReloadFacts()` if not injected.
> - `plan_updated` → `await fetchAndInjectPlanRow(id, 'update')`; same fallback.
> - `plan_deleted` → `PlanFactsTable.removePlanRow(id)` only (no Dexie cleanup).
> No new state, no extra fetches beyond the already-existing `fetchAndInjectPlanRow`. Behaviour identical to current online path.

Wait for human ACK (per intent autonomy zones). If proposal rejected, halt and escalate.

- [ ] **Step 2.5: Implement simplified `plan/wsEventHandlers.ts`**

Rewrite the file (replaces current ~177 lines):

```ts
/**
 * Plan Page — WebSocket Event Handlers
 *
 * Incremental DOM updates only:
 * - plan_created / plan_updated → fetchAndInjectPlanRow
 * - plan_deleted → removePlanRow
 * - recurring_plan_* + facts_batch_deleted → debounced full reload
 */

import * as PlanFactsTable from './factsTable';

const WS_RELOAD_DEBOUNCE_MS = 500;
let wsReloadTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedReloadFacts(): void {
  if (wsReloadTimeout) clearTimeout(wsReloadTimeout);
  wsReloadTimeout = setTimeout(() => { PlanFactsTable.loadFacts(); }, WS_RELOAD_DEBOUNCE_MS);
}

async function handlePlanCreated(data: { id?: number }): Promise<void> {
  if (!data?.id) { debouncedReloadFacts(); return; }
  const injected = await PlanFactsTable.fetchAndInjectPlanRow(data.id, 'create');
  if (!injected) debouncedReloadFacts();
}

async function handlePlanUpdated(data: { id?: number }): Promise<void> {
  if (!data?.id) { debouncedReloadFacts(); return; }
  const injected = await PlanFactsTable.fetchAndInjectPlanRow(data.id, 'update');
  if (!injected) debouncedReloadFacts();
}

function handlePlanDeleted(data: { id?: number }): void {
  if (!data?.id) { debouncedReloadFacts(); return; }
  PlanFactsTable.removePlanRow(data.id);
}

function handleRecurringPlanChanged(_data: unknown): void { debouncedReloadFacts(); }

function handleFactsBatchDeleted(data: { record_type?: string }): void {
  if (!data.record_type || data.record_type === 'plan') debouncedReloadFacts();
}

async function handleTransferCreated(data: { expense_fact_id?: number; income_fact_id?: number }): Promise<void> {
  const ids = [data.expense_fact_id, data.income_fact_id].filter(Boolean) as number[];
  if (ids.length === 0) { debouncedReloadFacts(); return; }
  const results = await Promise.all(ids.map(id => PlanFactsTable.fetchAndInjectPlanRow(id, 'create')));
  if (!results.some(Boolean)) debouncedReloadFacts();
}

export function registerWSHandlers(): void {
  const c = (window as any).budgetWSClient;
  if (!c) return;
  c.on('plan_created', handlePlanCreated);
  c.on('plan_updated', handlePlanUpdated);
  c.on('plan_deleted', handlePlanDeleted);
  c.on('recurring_plan_created', handleRecurringPlanChanged);
  c.on('recurring_plan_updated', handleRecurringPlanChanged);
  c.on('recurring_plan_deleted', handleRecurringPlanChanged);
  c.on('recurring_plan_facts_generated', handleRecurringPlanChanged);
  c.on('facts_batch_deleted', handleFactsBatchDeleted);
  c.on('transfer_created', handleTransferCreated);
}

export function unregisterWSHandlers(): void {
  const c = (window as any).budgetWSClient;
  if (!c) return;
  c.off('plan_created', handlePlanCreated);
  c.off('plan_updated', handlePlanUpdated);
  c.off('plan_deleted', handlePlanDeleted);
  c.off('recurring_plan_created', handleRecurringPlanChanged);
  c.off('recurring_plan_updated', handleRecurringPlanChanged);
  c.off('recurring_plan_deleted', handleRecurringPlanChanged);
  c.off('recurring_plan_facts_generated', handleRecurringPlanChanged);
  c.off('facts_batch_deleted', handleFactsBatchDeleted);
  c.off('transfer_created', handleTransferCreated);
}
```

- [ ] **Step 2.6: Type-check + browser smoke**

```bash
npm run type-check
```
Browser: open `/plan`, create plan, edit, delete; from second browser tab create plan → first tab must inject row via WS. No console errors.

- [ ] **Step 2.7: Commit**

```bash
git add frontend/web/static/js/plan/
git commit -m "refactor(plan): drop Dexie, simplify WS handlers to DOM-only updates"
```

---

## Task 3: Lists Page — Drop Dexie, Drop temp_id Reconciliation

**Files:**
- Modify: `frontend/web/static/js/lists/listsManager/core/stateManager.ts`
- Modify: `frontend/web/static/js/lists/listsManager/core/listOperations.ts`
- Modify: `frontend/web/static/js/lists/listsManager/ui/modalManager.ts`
- Modify: `frontend/web/static/js/lists/csvImporter.ts`
- Modify: `frontend/web/static/js/lists/listsManager/features/autocomplete.ts`
- Modify: `frontend/web/static/js/lists/listsManager/testing/debugUtils.ts`

- [ ] **Step 3.1: `stateManager.ts` — drop `getDexieManager`**

```bash
grep -n "getDexieManager\|@db/dexie\|dexie" frontend/web/static/js/lists/listsManager/core/stateManager.ts
```
For each hit: delete the import and any call site. State must use API responses directly. Remove fields like `dexieManager: any` from the state interface, and any initialization branch that depends on it.

- [ ] **Step 3.2: `listOperations.ts` — drop `sync_status` checks**

```bash
grep -n "sync_status\|@db/dexie\|isDexieActive" frontend/web/static/js/lists/listsManager/core/listOperations.ts
```
For every conditional like `if (item.sync_status === 'pending')` keep only the synced/online path; remove the offline branch entirely.

- [ ] **Step 3.3: `modalManager.ts` — drop offline create + temp_id reconciliation**

Pattern to remove: "create with temp_id, replace with server id on response". After change, create must `await` the API and render only after success.

Search target:
```bash
grep -n "temp_id\|sync_status\|offline\|isDexieActive\|@db/dexie" frontend/web/static/js/lists/listsManager/ui/modalManager.ts
```
For each: delete entirely. Form submission flow becomes:

```ts
const r = await fetch('/api/v1/shopping-list-items', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify(payload)
});
if (!r.ok) { showError(await r.text()); return; }
const created = await r.json();
addItemRow(created);  // existing render fn — input is server object only
```

- [ ] **Step 3.4: `csvImporter.ts`, `autocomplete.ts`, `debugUtils.ts` — remove Dexie**

For each file:
```bash
grep -n "dexie\|Dexie\|@db/dexie\|isDexieActive\|getDexieManager\|window\.dexieManager" $FILE
```
Delete imports + every conditional branch / function that uses Dexie. In `csvImporter.ts`, batch insert must call the existing `/api/v1/shopping-list-items/batch` (or per-item POST) only. In `autocomplete.ts`, suggestions must come from the API endpoint (likely `/api/v1/shopping-list-items?search=…` — verify). In `debugUtils.ts`, drop `window.dexieManager` debug commands.

- [ ] **Step 3.5: Type-check + browser smoke**

```bash
npm run type-check
```
Browser: open `/lists`, create list, add items (single + batch via CSV), complete item, delete item, second-tab WS update. No console errors.

- [ ] **Step 3.6: Commit**

```bash
git add frontend/web/static/js/lists/
git commit -m "refactor(lists): drop Dexie + temp_id reconciliation, API-only flow"
```

---

## Task 4: Dashboard — Drop Dexie + offlineManager

**Files:**
- Modify: `frontend/web/static/js/dashboard/features/factsManager.ts`
- Modify: `frontend/web/static/js/dashboard/features/addTransaction/categoryLoader.ts`
- Modify: `frontend/web/static/js/dashboard/features/addTransaction/transactionForm.ts`
- Modify: `frontend/web/static/js/dashboard/features/addPlan/planForm.ts`
- Modify: `frontend/web/static/js/dashboard/features/modalFact/saveTransaction.ts`
- Modify: `frontend/web/static/js/dashboard/features/modalFact/saveTransfer.ts`
- Modify: `frontend/web/static/js/dashboard/features/modalPlan/saveTransaction.ts`
- Modify: `frontend/web/static/js/dashboard/features/editModal/dropdownCache.ts`
- Modify: `frontend/web/static/js/dashboard/features/editModal/helpers.ts`
- Modify: `frontend/web/static/js/dashboard/features/editModal/deleteOperations.ts`
- Modify: `frontend/web/static/js/dashboard/features/editModal/formPopulation.ts`
- Modify: `frontend/web/static/js/dashboard/adapters/windowExports.ts`
- Modify: `frontend/web/static/js/dashboard/types/globals.d.ts`
- Delete: `frontend/web/static/js/dashboard/features/offlineDashboard.ts`
- Delete: `frontend/web/static/js/dashboard/features/pendingRecords/` (entire dir)

- [ ] **Step 4.1: Rewrite `dashboard/features/factsManager.ts` to API-only**

The class currently fetches via `getDexieManager` + `queryFacts`. Replace each public method with a server call:

```ts
import { performanceMonitor } from '../../monitoring/PerformanceMonitor';
import type { QuickStats, AccountBalance, RecentFact } from '../types/analytics';

declare const debugLog: (...args: any[]) => void;

class DashboardFactsManager {
  async loadRecentFacts(limit: number = 10): Promise<RecentFact[]> {
    const t0 = performance.now();
    const r = await fetch(`/api/v1/facts/recent?limit=${limit}`, { credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    debugLog(`[DASHBOARD] loadRecentFacts: ${(performance.now() - t0).toFixed(1)}ms`);
    return data.facts ?? data;
  }

  async calculateQuickStats(): Promise<QuickStats> {
    const r = await fetch('/api/v1/analytics/quick-stats', { credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }

  async loadAccountBalances(): Promise<AccountBalance[]> {
    const r = await fetch('/api/v1/financial-centers/balances', { credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return data.balances ?? data;
  }

  async initDashboard() {
    const t0 = performance.now();
    const [recentFacts, quickStats, accountBalances] = await Promise.all([
      this.loadRecentFacts(10),
      this.calculateQuickStats(),
      this.loadAccountBalances(),
    ]);
    debugLog(`[DASHBOARD] Total load time: ${(performance.now() - t0).toFixed(1)}ms`);
    return { recentFacts, quickStats, accountBalances };
  }
}

export const dashboardFactsManager = new DashboardFactsManager();
```

Verify each backend endpoint exists. If `/api/v1/facts/recent` / `/api/v1/analytics/quick-stats` / `/api/v1/financial-centers/balances` are missing, the spec says "Halt if removing Dexie would require redesigning a non-trivial flow." Open an escalation note and stop.

Run:
```bash
grep -n "@router\." backend/app/api/v1/endpoints/facts.py backend/app/api/v1/analytics.py backend/app/api/v1/endpoints/financial_centers.py | grep -i "recent\|quick\|balance"
```

- [ ] **Step 4.2: `categoryLoader.ts` — `dataLayer.getArticles` → `fetch`**

Replace `dataLayer.getArticles()` call with `fetch('/api/v1/articles', { credentials: 'include' })` and `r.json().then(d => d.articles ?? d)`. Delete `import { dataLayer } from '../../../data/DataLayer';`.

- [ ] **Step 4.3: `transactionForm.ts` + `planForm.ts` — drop offlineManager**

Pattern in each:
```ts
if (window.offlineManager?.createFactOffline) {
  await window.offlineManager.createFactOffline(payload);
} else {
  await api.createFact(payload);
}
```
Replace with:
```ts
await api.createFact(payload);
```
(same shape for `createPlanOffline` → direct API). After change, `grep -n "offlineManager\|createFactOffline\|createPlanOffline" <file>` must return 0.

- [ ] **Step 4.4: `modalFact/saveTransaction.ts`, `modalFact/saveTransfer.ts`, `modalPlan/saveTransaction.ts` — drop Dexie writes**

For each:
```bash
grep -n "dexie\|Dexie\|offlineManager\|@db/dexie\|isDexieActive" $FILE
```
Delete every matched line and any conditional branch it gates. The save flow becomes: build payload → POST/PUT to API → on success, close modal + show toast → WS event handles row injection (no local write).

- [ ] **Step 4.5: `editModal/dropdownCache.ts` — delete `populateOfflineDropdowns`**

```bash
grep -n "populateOfflineDropdowns\|isDexieActive\|@db/dexie" frontend/web/static/js/dashboard/features/editModal/dropdownCache.ts
```
Delete the function and every call site. Online path becomes default.

- [ ] **Step 4.6: `editModal/helpers.ts`, `deleteOperations.ts`, `formPopulation.ts` — drop offlineManager refs**

For each:
```bash
grep -n "offlineManager\|OfflineManager\|window\.offlineManager" $FILE
```
Delete every line. Verify no compile errors after each — these often use the offline branch inside try/catch wrappers.

- [ ] **Step 4.7: `dashboard/adapters/windowExports.ts` — strip Dexie**

Remove: any `import` from `@db/dexie`, the `init()` Dexie block, the `offline-sync-complete` event listener, and the `openDexieDiagnostic` export entry. Verify other exports compile by running `npm run type-check` after this edit alone.

- [ ] **Step 4.8: `dashboard/types/globals.d.ts` — remove `OfflineManager` declarations**

Delete the `interface OfflineManager { … }` block and the `window.offlineManager: OfflineManager;` field on the global Window interface.

- [ ] **Step 4.9: Delete `offlineDashboard.ts` + `pendingRecords/` dir**

```bash
git rm frontend/web/static/js/dashboard/features/offlineDashboard.ts
git rm -r frontend/web/static/js/dashboard/features/pendingRecords/
```

- [ ] **Step 4.10: Type-check + browser smoke**

```bash
npm run type-check
```
Browser: open `/` (dashboard), verify Recent Facts, Quick Stats, Account Balances render. Open Add Transaction modal → save → row appears via WS. Open Edit modal → edit + delete. No console errors.

- [ ] **Step 4.11: Commit**

```bash
git add frontend/web/static/js/dashboard/
git commit -m "refactor(dashboard): drop Dexie + offlineManager, API-only flow"
```

---

## Task 5: Transfers — Drop Offline Integration

**Files:**
- Modify: `frontend/web/static/js/transfers/core/dataLoader.ts`
- Modify: `frontend/web/static/js/transfers/types/globals.d.ts`
- Delete: `frontend/web/static/js/transfers/integration/offlineIntegration.ts`

- [ ] **Step 5.1: Remove offline refs from `transfers/core/dataLoader.ts`**

```bash
grep -n "offline\|offlineManager\|Dexie\|@db/dexie" frontend/web/static/js/transfers/core/dataLoader.ts
```
Delete imports + every offline conditional. Loader uses `fetch` only.

- [ ] **Step 5.2: Remove `offlineManager` from `transfers/types/globals.d.ts`**

Delete `window.offlineManager` declaration if present (different file from dashboard's globals.d.ts).

- [ ] **Step 5.3: Delete `offlineIntegration.ts`**

```bash
git rm frontend/web/static/js/transfers/integration/offlineIntegration.ts
```

Search consumers:
```bash
grep -rn "from.*offlineIntegration\|createTransferOffline" frontend/web/static/js/
```
Each match must be removed (already covered in Task 4.4 if inside `dashboard/`).

- [ ] **Step 5.4: Type-check + browser smoke**

```bash
npm run type-check
```
Browser: open dashboard, create a transfer, verify both expense + income rows appear.

- [ ] **Step 5.5: Commit**

```bash
git add frontend/web/static/js/transfers/
git commit -m "refactor(transfers): drop offlineIntegration, online-only"
```

---

## Task 6: Shared Modules — `budgetShared`, `PerformanceMonitor`

**Files:**
- Modify: `frontend/shared/static/js/budgetShared.ts`
- Modify: `frontend/web/static/js/monitoring/PerformanceMonitor.ts`

- [ ] **Step 6.1: `budgetShared.ts` — remove `_loadCategoriesFromDexie` (lines ~1909–2039)**

```bash
grep -n "_loadCategoriesFromDexie\|loadCategoriesFromDexie\|isDexieActive\|@db/dexie" frontend/shared/static/js/budgetShared.ts
```
Delete the method body + every call site. The category loader becomes API-only: `fetch('/api/v1/articles')` etc. Each caller is the existing `_loadCategoriesFromAPI` (or equivalent) — verify by reading the file.

- [ ] **Step 6.2: `PerformanceMonitor.ts` — remove Dexie metrics**

```bash
grep -n "trackDexieCall\|dexie\|Dexie\|trackCacheHit.*dexie" frontend/web/static/js/monitoring/PerformanceMonitor.ts
```
Delete `trackDexieCall()` method and the `'dexie'` literal branch inside `trackCacheHit()`. Strip Dexie keys from any stats record. Update caller in `dashboard/features/factsManager.ts` if any `performanceMonitor.trackDexieCall(...)` survived — replace with no-op or `performanceMonitor.trackApiCall(...)` if such method exists.

- [ ] **Step 6.3: Type-check + commit**

```bash
npm run type-check
git add frontend/shared/ frontend/web/static/js/monitoring/
git commit -m "refactor(shared): drop Dexie loader + perf metrics"
```

---

## Task 7: budgetWSClient — Drop Dexie Helpers + Sync Handlers

**Files:**
- Modify: `frontend/web/static/js/budget/budgetWSClient/integration/eventHandlers.ts`
- Modify: `frontend/web/static/js/budget/budgetWSClient/types/events.ts`
- Modify: `frontend/web/static/js/budget/budgetWSClient/fallback/longPolling.ts`
- Modify: `frontend/web/static/js/budget/budgetWSClient/core/connectionManager.ts`
- Modify: `frontend/web/static/js/budget/budgetWSClient/index.ts`
- Delete: `frontend/web/static/js/budget/budgetWSClient/integration/syncHandler.ts`
- Delete: `frontend/web/static/js/budget/budgetWSClient/integration/uploadHandler.ts`

**Proposal-first per intent — Step 7.1.**

- [ ] **Step 7.1: PROPOSAL — simplified `eventHandlers.ts`**

Post for review:

> After Dexie removal, each WS event handler simplifies to "notifyHandlers + UI bridge". Concretely:
> - All `upsert*InDexie` / `hardDelete*InDexie` helpers (~9 of them) get deleted.
> - Every public `handle*` keeps `notifyHandlers(event, data)` and the `callOfflineManagerUI` / `callListsManagerUI` bridges — except `callOfflineManagerUI` itself gets deleted since `offlineManager` is gone.
> - Imports from `@db/dexie` removed. Imports from `./syncHandler` removed.
> - Sync events (`sync_initial`, `sync_incremental`, `sync_client_changes_response`) handlers deleted entirely.
>
> Result: each handler is `notifyHandlers(event, data); [optional UI bridge];` — no DB writes.

Wait for ACK.

- [ ] **Step 7.2: Strip Dexie helpers + sync from `eventHandlers.ts`**

Delete imports at top (line 12–13, line 46):
```ts
import { db, generateUUID, factRepo, logger as dbLogger, isDexieActive } from '@db/dexie';
import type { WsFactPayload } from '@db/dexie';
import { handleSyncInitial, handleSyncIncremental } from './syncHandler';
```
Delete all helper functions inside the file: `hardDeleteFactInDexie`, `upsertFactInDexie`, `upsertShoppingListInDexie`, `hardDeleteShoppingListFromDexie`, `upsertShoppingItemInDexie`, `hardDeleteShoppingItemInDexie`, `upsertFinancialCenterInDexie`, `deleteFinancialCenterFromDexie`, `upsertCostCenterInDexie`, `deleteCostCenterFromDexie`, `upsertStoreInDexie`, `deleteStoreFromDexie`, `upsertProductGroupInDexie`, `deleteProductGroupFromDexie`, plus `toDate` if unused after.

In each `handle*` function, delete the lines invoking those helpers (e.g. `void upsertFactInDexie(data as WsFactPayload);`, `void hardDeleteFactInDexie(data.id);`). Keep `notifyHandlers(...)` and any `callListsManagerUI(...)` / `(window as any).listsManager.…` bridge.

Delete `callOfflineManagerUI` function and all its invocations (it referenced `window.offlineManager` which no longer exists).

Delete any handler whose only purpose was sync (e.g. `handleSyncInitialResponse`, `handleSyncIncrementalResponse`) plus their `registerHandler('sync_*', …)` calls.

- [ ] **Step 7.3: Clean `types/events.ts`**

```bash
grep -n "sync_hash\|is_offline_sync\|content_hash\|temp_id\|SyncInitial\|SyncIncremental\|SyncClientChanges" frontend/web/static/js/budget/budgetWSClient/types/events.ts
```
Delete: fields `sync_hash`, `is_offline_sync`, `content_hash`, `temp_id` from `WsFactPayload` (and any other WS payload types). Delete `SyncInitialResponse`, `SyncIncrementalResponse`, `SyncClientChangesResponse` type aliases entirely.

- [ ] **Step 7.4: Delete `syncHandler.ts` + `uploadHandler.ts`**

```bash
git rm frontend/web/static/js/budget/budgetWSClient/integration/syncHandler.ts
git rm frontend/web/static/js/budget/budgetWSClient/integration/uploadHandler.ts
```
Search for stray imports:
```bash
grep -rn "syncHandler\|uploadHandler\|handleSyncInitial\|handleSyncIncremental" frontend/web/static/js/
```
Each match must be removed.

- [ ] **Step 7.5: `fallback/longPolling.ts` — drop `isOfflineModeActive()` checks**

```bash
grep -n "isOfflineModeActive\|offlineManager" frontend/web/static/js/budget/budgetWSClient/fallback/longPolling.ts
```
For each hit on the listed lines (21, 26, 51, 145, 207–213 per spec), delete the conditional and keep the "online" branch as the only path.

- [ ] **Step 7.6: `core/connectionManager.ts` — remove `_isOfflineModeActive`**

```bash
grep -n "_isOfflineModeActive\|isOfflineModeActive" frontend/web/static/js/budget/budgetWSClient/core/connectionManager.ts
```
Delete the method + every call site.

- [ ] **Step 7.7: `budgetWSClient/index.ts` — drop offlineManager refs**

```bash
grep -n "offlineManager\|offlineSync" frontend/web/static/js/budget/budgetWSClient/index.ts
```
Delete each line.

- [ ] **Step 7.8: Type-check + browser smoke**

```bash
npm run type-check
```
Browser: open dashboard in two tabs. In tab A create/edit/delete a fact, list item, transfer. Tab B must reflect each change via WS (row inject / update / remove). Also verify long-polling fallback: in DevTools, force WS to fail, then reconnect — events still flow.

- [ ] **Step 7.9: Commit**

```bash
git add frontend/web/static/js/budget/
git commit -m "refactor(ws): drop Dexie helpers + sync handlers, DOM-only updates"
```

---

## Task 8: Templates — Remove Dexie Script Tags + localStorage

**Files:**
- Modify: `frontend/web/templates/base.html`
- Modify: `frontend/web/templates/login_email.html`
- Modify: `frontend/web/templates/2fa_verify.html`
- Modify: `frontend/web/templates/scripts/pwa-splash-screen.html`
- Modify: `frontend/web/templates/scripts/service-worker-registration.html`
- Modify: `frontend/web/templates/partials/lists/initialization_script.html`
- Modify: `frontend/web/templates/partials/recent_transactions.html`
- Delete: `frontend/web/templates/scripts/navbar-sync-badge.html`
- Delete: `frontend/web/templates/scripts/dexie-indicator-manager.html`

- [ ] **Step 8.1: `base.html` — strip Dexie**

```bash
grep -n "dexie\|Dexie\|dexieActive\|navbar-sync-badge\|dexie-indicator-manager" frontend/web/templates/base.html
```
Delete every match:
- `<script src="…/dexie.min.js?v=…"></script>`
- `<script src="…/dexie-diagnostic.min.js?v=…"></script>`
- The Dexie init `<script>` block (spec: lines 880–928)
- `{% include "scripts/navbar-sync-badge.html" %}`
- `{% include "scripts/dexie-indicator-manager.html" %}`
- `<div id="dexie-indicator-wrapper">…</div>`
- `<div id="navbar-sync-badge-wrapper">…</div>`
- Any inline `localStorage.setItem('dexieActive', …)` / `localStorage.getItem('dexieActive')`

- [ ] **Step 8.2: `login_email.html` + `2fa_verify.html` — drop `dexieActive` localStorage**

```bash
grep -n "dexieActive\|dexie\|Dexie" frontend/web/templates/login_email.html frontend/web/templates/2fa_verify.html
```
Delete each `localStorage.setItem('dexieActive', 'true')` line.

- [ ] **Step 8.3: `pwa-splash-screen.html` — remove `window.Dexie` check**

```bash
grep -n "Dexie\|dexie" frontend/web/templates/scripts/pwa-splash-screen.html
```
Delete the `if (window.Dexie) { … }` block.

- [ ] **Step 8.4: `service-worker-registration.html` — remove SW Dexie upload**

```bash
grep -n "Dexie\|dexie\|offlineManager" frontend/web/templates/scripts/service-worker-registration.html
```
Delete the block that uploads pending operations on SW activation.

- [ ] **Step 8.5: `partials/lists/initialization_script.html` — drop `window.Dexie?.getState()`**

```bash
grep -n "Dexie\|dexie" frontend/web/templates/partials/lists/initialization_script.html
```
Delete every match.

- [ ] **Step 8.6: `partials/recent_transactions.html` — drop `is_offline_sync`**

```bash
grep -n "is_offline_sync" frontend/web/templates/partials/recent_transactions.html
```
Delete the column / badge that renders it.

- [ ] **Step 8.7: Delete two include partials**

```bash
git rm frontend/web/templates/scripts/navbar-sync-badge.html
git rm frontend/web/templates/scripts/dexie-indicator-manager.html
```

Search for any stray include:
```bash
grep -rn "navbar-sync-badge\|dexie-indicator-manager" frontend/web/templates/
```
Each match must be deleted.

- [ ] **Step 8.8: Browser smoke + commit**

Open each page (`/`, `/facts`, `/plan`, `/lists`, `/login`, `/2fa`). Confirm rendering OK, no console errors, no missing-icon gaps from removed badges (verify CSS is not orphaned — Task 9 will clean styles if needed).

```bash
git add frontend/web/templates/
git commit -m "refactor(templates): remove Dexie includes, scripts, localStorage flags"
```

---

## Task 9: Mass Delete — Frontend Dexie Files, Tests, Build Config

**Delete (entire directories + files):**

- [ ] **Step 9.1: Delete Dexie source directory + diagnostics + notifications**

```bash
git rm -r frontend/shared/db/dexie/
git rm frontend/web/static/js/data/DataLayer.ts
git rm frontend/web/static/js/diagnostics/dexie-diagnostic-entry.ts
git rm frontend/web/static/js/modules/uiComponents/modals/DexieDiagnosticModal.ts
git rm frontend/web/static/js/notifications/dexieReadyNotification.ts
git rm frontend/web/static/js/notifications/dexieProgressToast.ts
```

If `frontend/web/static/js/data/` becomes empty: `git rm -r frontend/web/static/js/data/`.

- [ ] **Step 9.2: Delete offline / p2p sources**

```bash
git rm frontend/web/static/js/offline/networkDetector.ts
git rm -r frontend/web/static/js/offline/p2p/
git rm -f frontend/web/static/js/offline/*.ts.bak
```
If `frontend/web/static/js/offline/` is empty: `git rm -r frontend/web/static/js/offline/`. Important: keep `frontend/shared/network/` (online quality detector) per spec — not affected.

- [ ] **Step 9.3: Delete IndexedDB schema types + verify script**

```bash
git rm scripts/verify-dexie-export.js
git rm types/indexeddb.d.ts
```

- [ ] **Step 9.4: Delete 18 Dexie-only test files**

```bash
git rm \
  tests/unit/dashboard/dexieArticles.test.ts \
  tests/unit/dashboard/dexieCostCenters.test.ts \
  tests/unit/dashboard/dexieFactsTombstone.test.ts \
  tests/unit/dashboard/dexieFinancialCenters.test.ts \
  tests/unit/dashboard/dexieProductGroups.test.ts \
  tests/unit/dashboard/dexieRecurringPlans.test.ts \
  tests/unit/dashboard/dexieShoppingLists.test.ts \
  tests/unit/dashboard/dexieStores.test.ts \
  tests/unit/dashboard/offlineDashboard.test.ts \
  tests/unit/dashboard/shoppingSync404.test.ts \
  tests/unit/plan/dexieFactsPlans.test.ts \
  tests/unit/data/DexieManager.financialCenters.test.ts \
  tests/unit/data/DataLayer.filtering.test.ts \
  tests/unit/lists/modalManager.fallback.test.ts \
  tests/integration/workflows/offline-sync.test.ts \
  tests/e2e/webapp/test_offline_functionality.spec.ts \
  tests/e2e/webapp/test_offline_dashboard.spec.ts \
  tests/integration/p2p-datalayer-integration.test.js
```

- [ ] **Step 9.5: Partially clean `tests/unit/state/ListsState.test.ts`**

Open the file. Remove every Dexie mock (`vi.mock('@db/dexie', ...)`, `getDexieManager` stubs) and every test case whose only assertion is on Dexie state. Keep tests that assert pure ListsState behaviour (filters, selection, derived counters). Aim: file compiles and passes after removal.

- [ ] **Step 9.6: Update `build-all.js`**

Open `build-all.js`. Remove three bundle entries:

```js
{ name: 'dexie',           input: 'frontend/shared/db/dexie/index.ts',                                    output: 'frontend/shared/db/dexie.min.js' },
{ name: 'dexieDiagnostic', input: 'frontend/web/static/js/diagnostics/dexie-diagnostic-entry.ts',        output: 'frontend/web/static/js/diagnostics/dexie-diagnostic.min.js' },
{ name: 'dataLayer',       input: 'frontend/web/static/js/data/DataLayer.ts',                            output: 'frontend/web/static/js/data/DataLayer.min.js', globalName: 'DataLayer' },
```

Also remove the `verify-build` postbuild step if it only calls `verify-dexie-export.js`.

- [ ] **Step 9.7: Update `package.json`**

```bash
npm uninstall dexie fake-indexeddb
```
Also remove `"verify-build": "node scripts/verify-dexie-export.js"` from `scripts`. Run `npm install` to refresh lock file.

- [ ] **Step 9.8: Update `config/vitest.config.ts`**

Open file. Remove `'**/offlineManager/core/*.ts'` + `'**/offlineManager/operations/*.ts'` keys under `thresholds`. Search for any other `dexie` or `offlineManager` reference and delete.

- [ ] **Step 9.9: Build + test + commit**

```bash
npm run type-check
npm run build           # confirms removed bundles don't break Rollup
npm run test:coverage   # remaining unit tests pass
```
If `npm run build` fails referencing deleted files, fix the import in the consumer (Task 1–8 should have caught all of these — track down stragglers via `grep -rn "@db/dexie\|DataLayer" frontend/`).

```bash
git add -A
git commit -m "chore: delete Dexie source dirs, tests, build config, deps"
```

---

## Task 10: Backend — Modify Endpoints + Models + Schemas, Delete sync.py / sync_handlers.py

**Files (Modify):**
- `backend/app/api/v1/router.py`
- `backend/app/api/v1/endpoints/__init__.py`
- `backend/app/api/v1/endpoints/budget_ws.py`
- `backend/app/api/v1/endpoints/facts.py`
- `backend/app/api/v1/endpoints/shopping_list_items.py`
- `backend/app/api/v1/endpoints/shopping_lists.py`
- `backend/app/api/v1/endpoints/transfers.py`
- `backend/app/models/fact.py`
- `backend/app/models/budget_fact_history.py`
- `backend/app/models/shopping_list.py`
- `backend/app/models/shopping_list_item.py`
- `backend/app/schemas/fact.py`
- `backend/app/schemas/shopping_list_item.py`
- `backend/app/services/shopping_list_item_service.py`
- `backend/app/services/write_behind_service.py`

**Files (Delete):**
- `backend/app/api/v1/endpoints/sync.py`
- `backend/app/api/v1/endpoints/sync_handlers.py`

- [ ] **Step 10.1: Unregister `sync_router` from `router.py`**

Delete line 38: `sync_router,` (from `from backend.app.api.v1.endpoints import (...)`) and line 148: `api_router.include_router(sync_router)`. Also delete the comment block above line 147 ("Sync endpoints (PGlite Offline-First …)").

- [ ] **Step 10.2: Remove `sync_router` export from endpoints `__init__.py`**

```bash
grep -n "sync_router\|from .sync " backend/app/api/v1/endpoints/__init__.py
```
Delete:
```py
from backend.app.api.v1.endpoints.sync import router as sync_router
```
and the `"sync_router"` entry from `__all__`.

- [ ] **Step 10.3: Strip sync imports + dispatch from `budget_ws.py`**

Delete top-of-file import block (lines 46–50):
```py
from backend.app.api.v1.endpoints.sync_handlers import (
    handle_sync_client_changes,
    handle_sync_incremental_request,
    handle_sync_initial,
)
```

Delete message dispatch branches for `sync_initial`, `sync_incremental`, `sync_client_changes` (lines 616–673). The fallthrough `else: logger.debug("unknown message type: %s", msg_type)` remains.

- [ ] **Step 10.4: Delete `sync.py` + `sync_handlers.py`**

```bash
git rm backend/app/api/v1/endpoints/sync.py
git rm backend/app/api/v1/endpoints/sync_handlers.py
```

Confirm nothing else imports them:
```bash
grep -rn "from backend.app.api.v1.endpoints.sync\b\|sync_handlers" backend/ tests/
```
Each match must be removed.

- [ ] **Step 10.5: `facts.py` — remove dedup + create passthrough**

Delete the dedup block (lines 213–225, includes the wrapping `if fact_data.is_offline_sync and fact_data.sync_hash:` and the entire branch that returns the existing record).

In the create path (lines 372–374) remove:
```py
is_offline_sync=fact_data.is_offline_sync,
sync_hash=fact_data.sync_hash,
content_hash=fact_data.content_hash,
```
from the `queue_fact_create(...)` kwargs. Also remove the same fields from any synchronous-write path inside the same function.

Remove `is_offline_sync` from the response dictionaries.

- [ ] **Step 10.6: `shopping_list_items.py` — strip temp_id + sync_status + delta/batch endpoints**

```bash
grep -n "temp_id\|sync_status\|delta_sync\|batch_sync\|ShoppingListItemBatch\|ShoppingListItemSync" backend/app/api/v1/endpoints/shopping_list_items.py
```
For each:
- Delete lines 218–226 (temp_id generation loop in the list endpoint).
- Delete `sync_status="synced"` (line 283 in create).
- Delete `sync_status` update (line 716).
- Delete `delta_sync` endpoint (lines 1036–1053).
- Delete `batch_sync` endpoint (lines 1083–1143).
- Remove `temp_id` and `sync_status` from any response dict.
- Remove unused imports (`import time` if only used for temp_id generation; `ShoppingListItemBatchCreate/Update/Delete/SyncRequest/SyncResult` schemas).

- [ ] **Step 10.7: `shopping_lists.py` — remove server-side temp_id (lines 132–134)**

```bash
grep -n "temp_id" backend/app/api/v1/endpoints/shopping_lists.py
```
Delete every assignment / response field. The endpoint stops emitting `temp_id`.

- [ ] **Step 10.8: `transfers.py` — remove sync_hash dedup + passthrough**

Delete:
- Sync-hash dedup block (lines 174–228).
- `sync_hash` / `content_hash` / `is_offline_sync` passthrough in create call (lines 283–285, 301–303).
- Same fields from response dicts.

- [ ] **Step 10.9: Models — `fact.py`, `budget_fact_history.py`**

```bash
grep -n "is_offline_sync\|content_hash\|sync_hash" backend/app/models/fact.py backend/app/models/budget_fact_history.py
```
Delete each `Field(...)` declaration. Also remove the column from any `__table_args__` or index definitions in the same file (the migration in Task 11 handles the DB side; here we only touch ORM mapping).

- [ ] **Step 10.10: Models — `shopping_list.py`, `shopping_list_item.py`**

```bash
grep -n "temp_id" backend/app/models/shopping_list.py
grep -n "sync_status" backend/app/models/shopping_list_item.py
```
Delete `temp_id` field on `ShoppingList`. Delete `sync_status` field on `ShoppingListItem`. Also delete any constructor docstrings or `__repr__` references (lines 230 etc.). Update the leading docstring (lines 10, 36, 64, 82, 96, 103) to drop sync-status language.

- [ ] **Step 10.11: Schemas — `fact.py`**

```bash
grep -n "is_offline_sync\|content_hash\|sync_hash" backend/app/schemas/fact.py
```
Delete fields from `FactCreate` (and from `FactResponse` if present).

- [ ] **Step 10.12: Schemas — `shopping_list_item.py`**

Delete fields `sync_status` and `temp_id` from each schema class. Delete classes:
- `ShoppingListItemBatchCreate`
- `ShoppingListItemBatchUpdate`
- `ShoppingListItemBatchDelete`
- `ShoppingListItemSyncRequest`
- `ShoppingListItemSyncResult`
(spec: lines 451–602).

- [ ] **Step 10.13: Services — `shopping_list_item_service.py`**

```bash
grep -n "sync_status\|get_items_pending_sync\|get_items_with_conflicts\|resolve_conflict" backend/app/services/shopping_list_item_service.py
```
Delete:
- `sync_status` setting/reading code.
- Methods `get_items_pending_sync()`, `get_items_with_conflicts()`, `resolve_conflict()`.

Find callers:
```bash
grep -rn "get_items_pending_sync\|get_items_with_conflicts\|resolve_conflict" backend/ tests/
```
Each match must be removed (caller endpoint deleted in Step 10.6).

- [ ] **Step 10.14: Services — `write_behind_service.py`**

```bash
grep -n "is_offline_sync\|sync_hash\|content_hash" backend/app/services/write_behind_service.py
```
Delete each kwarg from `queue_fact_create()` (and any other queue method). Update internal Redis payload dict construction to drop the keys.

- [ ] **Step 10.15: Backend test run**

```bash
cd tests && ./run-tests.sh backend
```
Expected: passes. Failures usually mean a test still references the removed columns/schemas — either delete the test or rewrite to skip the dropped field.

- [ ] **Step 10.16: Commit**

```bash
git add backend/
git commit -m "refactor(backend): drop sync.py + sync_handlers.py + dexie sync columns/fields"
```

---

## Task 11: Database Migration — Drop Columns + Indexes

**File:** `backend/db/migrations/versions/20260605_<rev>_remove_dexie_sync_columns.py`

- [ ] **Step 11.1: Find current head**

```bash
cd backend/db/migrations && alembic heads
```
Record the revision id (currently expected to be `1972ca908ff9`). Use it as `down_revision`.

- [ ] **Step 11.2: Generate revision file**

```bash
cd backend/db/migrations && alembic revision -m "remove_dexie_sync_columns"
```
Open the new file (under `versions/`).

- [ ] **Step 11.3: Replace migration body with the full DROP statements**

```python
"""remove_dexie_sync_columns

Revision ID: <auto>
Revises: 1972ca908ff9
Create Date: 2026-06-05 00:00:00.000000

Drops 5 columns + 7 indexes used only by removed Dexie offline sync layer.
"""
from collections.abc import Sequence

from alembic import op


revision: str = "<auto>"           # leave as the auto-generated id
down_revision: str | None = "1972ca908ff9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Indexes first
    op.execute("DROP INDEX IF EXISTS idx_budget_fact_content_hash;")
    op.execute("DROP INDEX IF EXISTS idx_budget_fact_history_content_hash;")
    op.execute("DROP INDEX IF EXISTS idx_budget_fact_sync_hash;")
    op.execute("DROP INDEX IF EXISTS idx_budget_fact_sync_dedup;")
    op.execute("DROP INDEX IF EXISTS idx_budget_fact_history_sync_hash;")
    op.execute("DROP INDEX IF EXISTS idx_shopping_list_item_sync_status;")

    # Drop UNIQUE constraint on shopping list temp_id, then the column
    op.execute("ALTER TABLE t_f_shopping_list DROP CONSTRAINT IF EXISTS uq_shopping_list_temp_id;")
    op.execute("DROP INDEX IF EXISTS uq_shopping_list_temp_id;")
    op.execute("ALTER TABLE t_f_shopping_list DROP COLUMN IF EXISTS temp_id;")

    # shopping_list_item.sync_status
    op.execute("ALTER TABLE t_f_shopping_list_item DROP COLUMN IF EXISTS sync_status;")

    # Fact current + history tables
    for table in ("t_f_fact_current", "t_f_fact_history"):
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS is_offline_sync;")
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS content_hash;")
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS sync_hash;")


def downgrade() -> None:
    # Non-reversible by design — Dexie infrastructure is gone.
    raise NotImplementedError("remove_dexie_sync_columns is not reversible")
```

If actual fact / history table names differ, fix them: `grep -n "__tablename__" backend/app/models/fact.py backend/app/models/budget_fact_history.py`.

If the exact UNIQUE constraint name differs, fix it: `psql -c "\d t_f_shopping_list"` on dev DB and use the real constraint name (Postgres usually names it `t_f_shopping_list_temp_id_key`).

- [ ] **Step 11.4: Apply migration on local dev DB**

```bash
cd backend && .venv/bin/alembic -c db/migrations/alembic.ini upgrade head
```
Expected: completes without error. If a constraint is missing, the migration still passes thanks to `IF EXISTS`.

- [ ] **Step 11.5: Verify schema**

```bash
psql "$DATABASE_URL" -c "\d t_f_fact_current"   | grep -E "is_offline_sync|content_hash|sync_hash" && echo FAIL || echo OK
psql "$DATABASE_URL" -c "\d t_f_fact_history"   | grep -E "is_offline_sync|content_hash|sync_hash" && echo FAIL || echo OK
psql "$DATABASE_URL" -c "\d t_f_shopping_list"  | grep    temp_id                                    && echo FAIL || echo OK
psql "$DATABASE_URL" -c "\d t_f_shopping_list_item" | grep sync_status                               && echo FAIL || echo OK
```
All four must print OK.

- [ ] **Step 11.6: Run backend tests against migrated schema**

```bash
cd tests && ./run-tests.sh backend
```
Expected: passes.

- [ ] **Step 11.7: Commit**

```bash
git add backend/db/migrations/versions/
git commit -m "feat(db): drop Dexie sync columns + indexes (irreversible)"
```

---

## Task 12: Final Verification

- [ ] **Step 12.1: Frontend Dexie grep — must be empty**

```bash
grep -rn "dexie\|Dexie\|DataLayer\|sync_status\|pendingOp\|temp_id\|is_offline_sync\|content_hash\|sync_hash\|isDexieActive\|getDexieManager\|offlineSync\|dexieActive\|offlineManager\|OfflineManager\|offlineDashboard\|pendingRecords\|createFactOffline\|createPlanOffline\|createTransferOffline" \
  frontend/web/static/js/ frontend/shared/ frontend/web/templates/
```
Expected: empty. Each remaining match must be addressed: either delete the file, delete the line, or document why the match is unrelated (e.g. a CSS class named `dexie-*` that survived → rename it).

- [ ] **Step 12.2: Backend grep — only legitimate non-Dexie matches**

```bash
grep -rn "is_offline_sync\|content_hash\|sync_hash\|sync_status\|temp_id" backend/app/
```
Expected: zero matches (all five columns / fields removed).

- [ ] **Step 12.3: Full build**

```bash
npm run build
```
Expected: PASS. CSS minified, Rollup bundles produced, type-check clean.

- [ ] **Step 12.4: Backend tests**

```bash
cd tests && ./run-tests.sh backend
```
Expected: PASS.

- [ ] **Step 12.5: Vitest unit + coverage**

```bash
npm run test:coverage
```
Expected: PASS (coverage thresholds defined in `config/vitest.config.ts` after Task 9.8).

- [ ] **Step 12.6: Playwright E2E golden paths**

```bash
npm run test:e2e
```
Suites covered: facts, plan, lists, dashboard. Expected: PASS. Offline-specific suites were deleted in Task 9.4, so they should not appear in the runner output.

- [ ] **Step 12.7: Manual two-tab WS smoke**

In two browser tabs (different sessions optional):
1. Tab A creates a fact / plan / shopping item. Tab B's table must inject the new row within ~1 s.
2. Tab A edits a row. Tab B's row must update inline.
3. Tab A deletes a row. Tab B's row must disappear.
4. Tab A creates a transfer. Tab B's dashboard must show the new expense + income rows.

No console errors in either tab.

- [ ] **Step 12.8: Migration on test server**

```bash
ssh budget-test 'cd /opt/budget && psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM t_f_fact_current;"'
ssh budget-test 'cd /opt/budget && ./deploy.sh'   # CI/CD path (after VERSION bump + push)
ssh budget-test 'cd /opt/budget && psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM t_f_fact_current;"'
```
The two counts must match. Also spot-check 5 random rows:
```bash
ssh budget-test 'psql "$DATABASE_URL" -c "SELECT id, fact_date, amount, article_id, financial_center_id, user_id FROM t_f_fact_current ORDER BY id DESC LIMIT 5;"'
```
Every row must have non-null values for the listed columns (verifies the drop didn't cascade unexpectedly).

- [ ] **Step 12.9: Bump VERSION + push for CI/CD**

```bash
# from project root
current=$(cat VERSION)
IFS=. read -r maj min patch <<<"$current"
new="$maj.$min.$((patch+1))"
echo "$new" > VERSION
git add VERSION
git commit -m "chore: bump version to $new for dexie removal release"
git push -u origin dev/remove-dexie
```
Open PR `dev/remove-dexie` → `test`.

- [ ] **Step 12.10: After PR approved and merged to `test`**

Verify https://fbd.ikeniborn.ru/ behaves correctly: load facts, plan, lists, dashboard; create + edit + delete each. Confirm zero console errors. Then a separate `test → prod` PR triggers production deploy (human action per CLAUDE.md constraints).

---

## Notes on Constraints (from intent)

- **Halt** if any module surfaces a non-trivial flow that resists API-only rewrite (e.g. the replacement requires a state machine, retries, multi-step coordination). Open an escalation note and stop. Tasks 1, 3, 4, 7 are the highest risk for this.
- **Escalate** if a file mixes Dexie + non-Dexie logic in a non-obvious way (e.g. removing the Dexie path changes observable behaviour beyond offline). Tasks 4 (dashboard saves) and 7 (`eventHandlers.ts`) are the most likely triggers.
- **Auth + production deploy** are human-only (Step 12.10).
- **No new caching layer** — every replacement is a plain `fetch` call.

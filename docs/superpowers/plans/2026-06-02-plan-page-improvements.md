---
chain:
  intent: docs/superpowers/intents/2026-06-01-plan-page-improvements-intent.md
  spec: docs/superpowers/specs/2026-06-01-plan-page-improvements-design.md
review:
  plan_hash: 9c3c12f3e0a800a0
  spec_hash: 2c0cbdeb5e88d2a2
  last_run: 2026-06-02
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
      section: "Task 1: Planning Period Offset"
      section_hash: a65eaaf32f50204a
      text: "Step 1.5 modifies setupPlanPeriodButtons() — spec mentions only setupTransferPeriodButtons() for periodButtons.ts; extra change not traced to spec requirement"
      verdict: fixed
      verdict_at: 2026-06-02
    - id: F-002
      phase: coverage
      severity: WARNING
      section: "Task 2: Category Typeahead in Analytics"
      section_hash: 57805524a1d6d856
      text: "initAnalyticsArticleChoices signature diverges from spec: plan adds 3rd param onChange callback and passes articles to ChoicesCategoryTree constructor — spec shows 2-param signature with direct onAnalyticsArticleChange(id) call"
      verdict: fixed
      verdict_at: 2026-06-02
---

# Plan Page Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four independent improvements to `/plan` page: planning period offset (≥20th → next month default), category typeahead in analytics filter, API-first "Load more" pagination, and backend HTML fix for double-render discrepancy.

**Architecture:** All four tasks are independent — each produces working, testable software on its own and can be committed separately. Tasks 1 and 4 touch backend; Tasks 2 and 3 are frontend-only. No DB schema changes. No breaking changes to bot API contracts.

**Tech Stack:** FastAPI (Python 3.12), TypeScript (Rollup bundles), python-telegram-bot 21.x, pytest, Vitest, Playwright

---

## File Map

| Task | Files changed |
|------|--------------|
| 1 | `backend/app/utils/planning.py` (NEW), `frontend/web/static/js/plan/filters.ts`, `frontend/web/static/js/plan/planModal.ts`, `frontend/web/static/js/dashboard/features/addPlan/periodButtons.ts`, `bot/handlers/add_plan.py` |
| 2 | `frontend/web/static/js/plan/analyticsArticleChoices.ts` (NEW), `frontend/web/static/js/plan/analytics.ts` |
| 3 | `frontend/web/static/js/plan/factsTable.ts`, `frontend/web/static/js/plan/adapters/windowExports.ts`, `frontend/web/templates/plan.html` |
| 4 | `backend/app/api/v1/endpoints/facts.py` (plan-branch of `get_fact_row_html`, lines 1469–1502) |

---

## Task 1: Planning Period Offset

**Files:**
- Create: `backend/app/utils/planning.py`
- Modify: `frontend/web/static/js/plan/filters.ts:51-66`
- Modify: `frontend/web/static/js/plan/planModal.ts:281-290` (`setupCreatePlanPeriodButtons`)
- Modify: `frontend/web/static/js/dashboard/features/addPlan/periodButtons.ts:99-110, 165-174` (`setupPlanPeriodButtons`, `setupTransferPeriodButtons`)
- Modify: `bot/handlers/add_plan.py:371-381` (`amount_entered`)
- Test: `tests/unit/backend/test_planning.py` (NEW)

### Step 1.1 — Write failing backend unit test

- [ ] Create `tests/unit/backend/test_planning.py`:

```python
from datetime import date
from backend.app.utils.planning import get_planning_month


def test_before_20th_returns_current_month():
    assert get_planning_month(date(2026, 6, 15)) == date(2026, 6, 1)


def test_on_20th_returns_next_month():
    assert get_planning_month(date(2026, 6, 20)) == date(2026, 7, 1)


def test_after_20th_returns_next_month():
    assert get_planning_month(date(2026, 6, 28)) == date(2026, 7, 1)


def test_december_wraps_to_january():
    assert get_planning_month(date(2026, 12, 25)) == date(2027, 1, 1)


def test_no_arg_uses_today():
    result = get_planning_month()
    assert result.day == 1
```

- [ ] Run test to verify it fails:

```bash
cd /home/ikeniborn/Documents/Project/familyBudget
python -m pytest tests/unit/backend/test_planning.py -v 2>&1 | head -20
```

Expected: `ModuleNotFoundError: No module named 'backend.app.utils.planning'`

### Step 1.2 — Create backend utility

- [ ] Create `backend/app/utils/planning.py`:

```python
from datetime import date, timedelta


def get_planning_month(as_of: date | None = None) -> date:
    today = as_of or date.today()
    if today.day >= 20:
        return (today.replace(day=1) + timedelta(days=32)).replace(day=1)
    return today.replace(day=1)
```

- [ ] Run test to verify it passes:

```bash
python -m pytest tests/unit/backend/test_planning.py -v
```

Expected: `5 passed`

- [ ] Commit:

```bash
git add backend/app/utils/planning.py tests/unit/backend/test_planning.py
git commit -m "feat(backend): add get_planning_month utility — returns next month from day 20 onward"
```

### Step 1.3 — Update frontend filters.ts

- [ ] In `frontend/web/static/js/plan/filters.ts`, replace lines 51-66 (the two IIFE constants) with:

```typescript
function getPlanningMonthStart(): Date {
  const today = new Date();
  return today.getDate() >= 20
    ? new Date(today.getFullYear(), today.getMonth() + 1, 1)
    : new Date(today.getFullYear(), today.getMonth(), 1);
}

export const DEFAULT_DATE_FROM = (() => {
  const base = getPlanningMonthStart();
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
})();

export const DEFAULT_DATE_TO = (() => {
  const base = getPlanningMonthStart();
  const futureDate = new Date(base.getFullYear(), base.getMonth() + 3, 0);
  const year = futureDate.getFullYear();
  const month = String(futureDate.getMonth() + 1).padStart(2, '0');
  const day = String(futureDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
})();
```

- [ ] Run type-check:

```bash
npm run type-check 2>&1 | grep -E "error|plan/filters"
```

Expected: no errors in filters.ts

### Step 1.4 — Update planModal.ts (plan page create modal)

- [ ] In `frontend/web/static/js/plan/planModal.ts`, inside `setupCreatePlanPeriodButtons()`, replace the period button loop body (lines ~284-290):

Find:
```typescript
  periodButtons.forEach(btn => {
    const offset = parseInt(btn.dataset.offset || '0');
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    btn.textContent = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    btn.dataset.year = String(d.getFullYear());
    btn.dataset.month = String(d.getMonth() + 1).padStart(2, '0');
  });
```

Replace with:
```typescript
  const planningBase = today.getDate() >= 20
    ? new Date(today.getFullYear(), today.getMonth() + 1, 1)
    : new Date(today.getFullYear(), today.getMonth(), 1);

  periodButtons.forEach(btn => {
    const offset = parseInt(btn.dataset.offset || '0');
    const d = new Date(planningBase.getFullYear(), planningBase.getMonth() + offset, 1);
    btn.textContent = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    btn.dataset.year = String(d.getFullYear());
    btn.dataset.month = String(d.getMonth() + 1).padStart(2, '0');
  });
```

- [ ] Run type-check:

```bash
npm run type-check 2>&1 | grep -E "error|planModal"
```

Expected: no errors

### Step 1.5 — Update dashboard periodButtons.ts (transfer modal)

- [ ] In `frontend/web/static/js/dashboard/features/addPlan/periodButtons.ts`, inside `setupTransferPeriodButtons()`, replace the loop (lines ~168-175):

Find:
```typescript
  periodButtons.forEach((btn) => {
    const offset = parseInt(btn.dataset.offset || '0');
    const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const label = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    btn.textContent = label;
    btn.dataset.year = String(date.getFullYear());
    btn.dataset.month = String(date.getMonth() + 1).padStart(2, '0');
  });
```

Replace with:
```typescript
  const planningBase = today.getDate() >= 20
    ? new Date(today.getFullYear(), today.getMonth() + 1, 1)
    : new Date(today.getFullYear(), today.getMonth(), 1);

  periodButtons.forEach((btn) => {
    const offset = parseInt(btn.dataset.offset || '0');
    const date = new Date(planningBase.getFullYear(), planningBase.getMonth() + offset, 1);
    const label = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    btn.textContent = label;
    btn.dataset.year = String(date.getFullYear());
    btn.dataset.month = String(date.getMonth() + 1).padStart(2, '0');
  });
```

- [ ] Run full type-check and build:

```bash
npm run type-check 2>&1 | tail -5
npm run bundle 2>&1 | tail -5
```

Expected: no errors, bundles generated

### Step 1.6 — Update bot add_plan.py

- [ ] In `bot/handlers/add_plan.py`, inside `amount_entered()`, replace the `reply_text` call (lines ~371-381):

Find:
```python
        await update.message.reply_text(
            f"📊 **Планирование бюджета**\n\n"
            f"📋 Шаг 3/4: Введите период планирования\n\n"
            f"Категория: **{article_name}**\n"
            f"Плановая сумма: **{format_amount(amount)}**\n\n"
            f"Введите дату (период) плана:\n\n"
            f"_Примеры: 01.11.2025, 01.12, 2026-01-01_\n"
            f"_Можно указывать будущие даты для планирования_\n\n"
            f"Отправьте /cancel для отмены",
            parse_mode="Markdown"
        )
```

Replace with:
```python
        today = date.today()
        planning_month = (
            (today.replace(day=1) + timedelta(days=32)).replace(day=1)
            if today.day >= 20
            else today.replace(day=1)
        )
        hint = planning_month.strftime("01.%m.%Y")

        await update.message.reply_text(
            f"📊 **Планирование бюджета**\n\n"
            f"📋 Шаг 3/4: Введите период планирования\n\n"
            f"Категория: **{article_name}**\n"
            f"Плановая сумма: **{format_amount(amount)}**\n\n"
            f"Введите дату (период) плана:\n\n"
            f"💡 Рекомендуемый период: {hint}\n\n"
            f"_Примеры: 01.11.2025, 01.12, 2026-01-01_\n"
            f"_Можно указывать будущие даты для планирования_\n\n"
            f"Отправьте /cancel для отмены",
            parse_mode="Markdown"
        )
```

- [ ] Verify `date` and `timedelta` are already imported at the top of the file:

```bash
grep -n "^from datetime\|^import datetime" bot/handlers/add_plan.py
```

If not present, add at the top of the file:
```python
from datetime import date, timedelta
```

- [ ] Run type-check and build:

```bash
npm run type-check 2>&1 | tail -3
```

- [ ] Commit:

```bash
git add frontend/web/static/js/plan/filters.ts \
        frontend/web/static/js/plan/planModal.ts \
        frontend/web/static/js/dashboard/features/addPlan/periodButtons.ts \
        bot/handlers/add_plan.py
git commit -m "feat(plan): default planning period shifts to next month on/after the 20th"
```

---

## Task 2: Category Typeahead in Analytics

**Files:**
- Create: `frontend/web/static/js/plan/analyticsArticleChoices.ts`
- Modify: `frontend/web/static/js/plan/analytics.ts` (replace `loadAnalyticsArticleFilter()` body, update call sites)

### Step 2.1 — Create analyticsArticleChoices.ts module

- [ ] Create `frontend/web/static/js/plan/analyticsArticleChoices.ts`:

```typescript
let articleChoicesInstance: any = null;

export function initAnalyticsArticleChoices(
  articles: Array<{ id: number; name: string; type: string; parent_id: number | null }>,
  articleType: string | null
): void {
  const ChoicesCategoryTree = (window as any).BudgetShared?.ChoicesCategoryTree;
  if (!ChoicesCategoryTree) return;

  if (articleChoicesInstance?.destroy) {
    articleChoicesInstance.destroy();
    articleChoicesInstance = null;
  }

  articleChoicesInstance = new ChoicesCategoryTree('#analytics-article', {
    type: articleType || undefined,
    multiple: false,
    showPath: false,
    showClearButton: true,
    mode: 'create',
    onChange: (selected: any[]) => {
      const id = selected[0]?.id ?? null;
      onAnalyticsArticleChange(id);
    }
  });
}
```

### Step 2.2 — Update analytics.ts to use the new module

- [ ] In `frontend/web/static/js/plan/analytics.ts`, add import at the top (after existing imports):

```typescript
import { initAnalyticsArticleChoices } from './analyticsArticleChoices';
```

- [ ] Replace the body of `loadAnalyticsArticleFilter()` (lines ~417-476) with a call to `initAnalyticsArticleChoices`:

Find the entire function:
```typescript
export async function loadAnalyticsArticleFilter(
  articleType: string | null = null,
  allArticles: Array<{ id: number; name: string; type: string; parent_id: number | null }> | null = null
): Promise<void> {
  try {
    let articles: PlanHelpers.Article[];

    if (articleType !== null) {
      // Type selected → fetch full hierarchy from API for proper tree display
      const url = `/api/v1/articles?limit=1000&sort_by=usage_count&type=${encodeURIComponent(articleType)}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn('[PlanAnalytics] Failed to load articles:', response.status);
        return;
      }
      const data = await response.json();
      articles = Array.isArray(data) ? data : data.articles || [];
    } else if (allArticles !== null) {
      // No type filter + pre-fetched plan articles → use them
      articles = allArticles as PlanHelpers.Article[];
    } else {
      // Fallback: fetch all articles
      const response = await fetch('/api/v1/articles?limit=1000&sort_by=usage_count');
      if (!response.ok) {
        console.warn('[PlanAnalytics] Failed to load articles:', response.status);
        return;
      }
      const data = await response.json();
      articles = Array.isArray(data) ? data : data.articles || [];
    }

    const select = document.getElementById('analytics-article') as HTMLSelectElement | null;
    if (!select) return;

    // Save current selection
    const currentValue = select.value;

    // Clear and repopulate (safe DOM API instead of innerHTML)
    select.textContent = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Все категории';
    select.appendChild(defaultOption);

    // Build tree, flatten, and group by type
    const tree = PlanHelpers.buildArticleTree(articles);
    const flatNodes = PlanHelpers.flattenArticleTree(tree);
    const sortedNodes = groupArticlesByType(flatNodes);

    // Build and append options
    buildArticleOptions(select, sortedNodes);

    // Restore selection if still valid
    if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
      select.value = currentValue;
    }
  } catch (error) {
    console.error('[PlanAnalytics] Error loading article filter:', error);
  }
}
```

Replace with:
```typescript
export async function loadAnalyticsArticleFilter(
  articleType: string | null = null,
  allArticles: Array<{ id: number; name: string; type: string; parent_id: number | null }> | null = null
): Promise<void> {
  try {
    let articles: PlanHelpers.Article[];

    if (articleType !== null) {
      const url = `/api/v1/articles?limit=1000&sort_by=usage_count&type=${encodeURIComponent(articleType)}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn('[PlanAnalytics] Failed to load articles:', response.status);
        return;
      }
      const data = await response.json();
      articles = Array.isArray(data) ? data : data.articles || [];
    } else if (allArticles !== null) {
      articles = allArticles as PlanHelpers.Article[];
    } else {
      const response = await fetch('/api/v1/articles?limit=1000&sort_by=usage_count');
      if (!response.ok) {
        console.warn('[PlanAnalytics] Failed to load articles:', response.status);
        return;
      }
      const data = await response.json();
      articles = Array.isArray(data) ? data : data.articles || [];
    }

    initAnalyticsArticleChoices(articles, articleType);
  } catch (error) {
    console.error('[PlanAnalytics] Error loading article filter:', error);
  }
}
```

### Step 2.3 — Run type-check and build

- [ ] Run:

```bash
npm run type-check 2>&1 | grep -E "error|analytics"
npm run bundle 2>&1 | tail -10
```

Expected: no TypeScript errors, plan bundle produced

### Step 2.4 — Manual smoke test in browser

> **Deploy first:** `npm run bundle` → commit → bump `VERSION` → push → CI builds image → `ssh budget-test 'cd /opt/budget && ./deploy.sh'` → then test.

- [ ] Open `https://fbd.ikeniborn.ru/plan`
- [ ] Expand the Analytics section
- [ ] Verify `#analytics-article` element shows a typeahead input (ChoicesCategoryTree widget) instead of a plain `<select>` dropdown
- [ ] Type a few characters — verify filtered category list appears
- [ ] Select a category — verify the chart reloads
- [ ] Change article type filter — verify the category list reinitializes

- [ ] Commit:

```bash
git add frontend/web/static/js/plan/analyticsArticleChoices.ts \
        frontend/web/static/js/plan/analytics.ts
git commit -m "feat(plan): replace analytics article select with ChoicesCategoryTree typeahead"
```

---

## Task 3: API-First Pagination with "Load More"

**Files:**
- Modify: `frontend/web/static/js/plan/factsTable.ts` (rewrite `loadFacts()`, add `loadMoreFacts()`, update state vars)
- Modify: `frontend/web/static/js/plan/adapters/windowExports.ts` (add `loadMoreFacts`, remove `previousPage`/`nextPage`)
- Modify: `frontend/web/templates/plan.html` (add `#load-more-container`, remove `#pagination-controls`)

### Step 3.1 — Locate and understand current pagination HTML in plan.html

- [ ] Find the pagination controls in `frontend/web/templates/plan.html`:

```bash
grep -n "pagination-controls\|prev-btn\|next-btn\|page-info\|facts-table-container" \
  frontend/web/templates/plan.html | head -20
```

Note the exact line numbers for the next step.

### Step 3.2 — Update plan.html

- [ ] In `frontend/web/templates/plan.html`, find the `#pagination-controls` div and remove it entirely (it contains `#prev-btn`, `#next-btn`, `#page-info`).

- [ ] Directly below `<div id="facts-table-container">...</div>`, add:

```html
<div id="load-more-container" class="flex justify-center py-4 hidden">
  <button id="load-more-btn"
    class="btn btn-outline btn-sm"
    onclick="window.PlanApp.FactsTable.loadMoreFacts()">
    Загрузить ещё
    <span id="load-more-counter" class="ml-1 text-base-content/60"></span>
  </button>
</div>
```

### Step 3.3 — Rewrite factsTable.ts state and helpers

- [ ] In `frontend/web/static/js/plan/factsTable.ts`, replace the state management section (everything before the `Helper Functions` section) with the following. This removes Dexie-related imports, removes old pagination state, and adds new API-first state:

Remove these imports (they're Dexie-specific, no longer needed):
```typescript
import { dataLayer } from '../data/DataLayer';
import {
  isDexieActive,
  type FactFilters,
  type LocalBudgetFact,
  type LocalArticle,
  type LocalFinancialCenter,
  type LocalCostCenter
} from '@db/dexie';
```

Replace the state variables block (lines ~47-93) with:
```typescript
// ============================================================================
// State Management
// ============================================================================

/** Current loaded offset — number of records fetched so far */
let currentOffset = 0;

/** Records per API request */
const PAGE_SIZE = 50;

/** Total matching records from last API response */
let totalFacts = 0;

/** Count of records currently rendered in the table */
let loadedCount = 0;

/** Whether more records are available on the server */
let hasMoreFacts = false;

/**
 * Set of selected fact IDs for batch operations.
 * Exported for use by crud.ts (shared live binding via Rollup).
 */
export let selectedFactIds: Set<number> = new Set();

/**
 * Map of fact ID → reminder for reminder status display.
 * Exported for use by crud.ts (shared live binding via Rollup).
 */
export const remindersMap: Map<number, Reminder> = new Map();
```

- [ ] Remove the functions `buildPlanFactFilters()`, `loadEnrichmentMaps()`, `toUIFact()`, `getCurrentPage()`, `setCurrentPage()`, `getFactsData()` — these are Dexie-path functions no longer needed.

- [ ] Add a new helper `buildFactsApiUrl()` in the Helper Functions section:

```typescript
/**
 * Build URL for /api/v1/facts with current plan filter state.
 */
function buildFactsApiUrl(offset: number): string {
  const f = PlanFilters.getFilters();
  const params = new URLSearchParams({
    record_type: 'plan',
    limit: String(PAGE_SIZE),
    offset: String(offset)
  });
  if (f.user_id) params.set('user_id', String(f.user_id));
  if (f.article_id) params.set('article_id', String(f.article_id));
  if (f.article_type) params.set('article_type', f.article_type);
  if (f.date_from) params.set('date_from', f.date_from);
  if (f.date_to) params.set('date_to', f.date_to);
  if (f.financial_center_id) params.set('financial_center_id', String(f.financial_center_id));
  if (f.cost_center_id) params.set('cost_center_id', String(f.cost_center_id));
  if (f.search) params.set('search', f.search);
  if (f.has_recurring_plan) params.set('has_recurring_plan', 'true');
  if (f.has_reminder) params.set('has_reminder', 'true');
  return `/api/v1/facts?${params}`;
}
```

### Step 3.4 — Rewrite loadFacts() as API-first

- [ ] Replace the entire `loadFacts()` function with:

```typescript
export async function loadFacts(): Promise<void> {
  const container = document.getElementById('facts-table-container');
  if (!container) return;

  currentOffset = 0;
  loadedCount = 0;
  hasMoreFacts = false;

  setInnerHTML(
    container,
    '<div class="flex items-center justify-center py-8"><span class="loading loading-spinner loading-lg text-primary"></span></div>'
  );
  updateLoadMoreButton();

  try {
    const resp = await fetch(buildFactsApiUrl(0), { credentials: 'include' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const items: PlanHelpers.BudgetFact[] = (data.items ?? []).map(toUIFactFromAPI);
    totalFacts = data.total ?? 0;
    loadedCount = items.length;
    hasMoreFacts = PAGE_SIZE < totalFacts;

    remindersMap.clear();
    await loadRemindersForFacts(items.map(f => f.id), false);

    renderFactsTable(items);
    updateStats();
    updateLoadMoreButton();

    const uiFilters = PlanFilters.getFilters();
    if (typeof AdminFactsCommon !== 'undefined') {
      AdminFactsCommon.syncFiltersUI(uiFilters);
    }

    if (typeof (window as any).loadStats === 'function') {
      (window as any).loadStats();
    }
  } catch (error) {
    console.error('[PlanFactsTable] Error loading facts:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    container.textContent = '';
    const alert = document.createElement('div');
    alert.className = 'alert alert-error';
    const span = document.createElement('span');
    span.textContent = `❌ Ошибка загрузки: ${errorMessage}`;
    alert.appendChild(span);
    container.appendChild(alert);
  }
}
```

### Step 3.5 — Add loadMoreFacts() function

- [ ] Add `loadMoreFacts()` after `loadFacts()`:

```typescript
/**
 * Append the next page of facts to the existing table.
 * Called from #load-more-btn onclick.
 */
export async function loadMoreFacts(): Promise<void> {
  if (!hasMoreFacts) return;

  const btn = document.getElementById('load-more-btn') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.classList.add('loading');
  }

  try {
    currentOffset += PAGE_SIZE;
    const resp = await fetch(buildFactsApiUrl(currentOffset), { credentials: 'include' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const items: PlanHelpers.BudgetFact[] = (data.items ?? []).map(toUIFactFromAPI);
    loadedCount += items.length;
    hasMoreFacts = (currentOffset + PAGE_SIZE) < totalFacts;

    await loadRemindersForFacts(items.map(f => f.id), false);

    appendFactsToTable(items);
    updateStats();
    updateLoadMoreButton();
  } catch (error) {
    console.error('[PlanFactsTable] Error loading more facts:', error);
    currentOffset -= PAGE_SIZE; // rollback offset on failure
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  }
}
```

### Step 3.6 — Add appendFactsToTable() helper

- [ ] Add `appendFactsToTable()` in the Table Rendering section, after `renderFactsTable()`:

```typescript
/**
 * Append additional facts rows to the existing table (used by loadMoreFacts).
 * Does not clear selection or reset the table.
 */
function appendFactsToTable(facts: BudgetFact[]): void {
  const desktopTbody = document.querySelector<HTMLElement>('.facts-desktop-table tbody');
  const mobileList = document.querySelector<HTMLElement>('.facts-mobile-list');
  if (!desktopTbody && !mobileList) return;

  facts.forEach(fact => {
    const articleColorClass = TableFormatters.getArticleColorClass(fact.article_type, 'text');
    const description = escapeHtml(fact.description || '—');
    const descriptionTruncated = TableFormatters.truncateText(fact.description || '—', 30);
    const financialCenter = escapeHtml(fact.financial_center_name || '—');
    const costCenter = escapeHtml(fact.cost_center_name || '—');
    const formattedDate = BudgetShared.DateFormatter.formatForDisplay(fact.fact_date);
    const shortDate = formattedDate.slice(0, 5);
    const articleName = escapeHtml(fact.article_name || '—');
    const userName = escapeHtml(fact.user_name || '—');

    if (desktopTbody) {
      const trHtml = `
        <tr data-plan-id="${fact.id}">
          <td><input type="checkbox" class="checkbox checkbox-sm fact-checkbox" value="${fact.id}" onchange="window.PlanApp.FactsTable.updateBatchDeleteButton()"></td>
          <td class="text-base-content/50 text-xs">${fact.id}</td>
          <td>${formattedDate}</td>
          <td class="max-w-xs truncate" title="${financialCenter}">${financialCenter}</td>
          <td class="max-w-xs truncate" title="${costCenter}">${costCenter}</td>
          <td>${articleName}</td>
          <td class="${articleColorClass} font-bold">${TableFormatters.formatAmount(fact.amount, fact.article_type)}</td>
          <td class="max-w-xs truncate" title="${description}">${descriptionTruncated}</td>
          <td>${userName}</td>
          <td class="text-xs text-base-content/60">${TableFormatters.formatUpdatedAt(fact.updated_at)}</td>
          <td class="text-center">${fact.has_reminder ? '<span class="text-info" title="Напоминание установлено">🔔</span>' : ''}</td>
          <td class="text-center">${fact.recurring_plan_id ? '<span class="text-secondary" title="Регламентный платеж">🔄</span>' : ''}</td>
          <td class="text-center" title="${fact.is_offline_sync ? 'Создано offline' : ''}">${fact.is_offline_sync ? '☁️' : ''}</td>
          <td>
            <div class="flex gap-1">
              <button class="btn btn-xs btn-primary gap-1" onclick="showEditModal(${fact.id})">✏️</button>
              <button class="btn btn-xs btn-error btn-square hidden md:inline-flex" data-fact-id="${fact.id}" onclick="event.stopPropagation(); deleteFact(${fact.id})" title="Удалить">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </td>
        </tr>`;
      const tpl = document.createElement('template');
      tpl.innerHTML = trHtml.trim();
      const trEl = tpl.content.firstElementChild;
      if (trEl) desktopTbody.appendChild(trEl);
    }

    if (mobileList) {
      const mobileAmountClass = TableFormatters.getArticleColorClass(fact.article_type, 'amount');
      const mobileAmount = TableFormatters.formatAmount(fact.amount, fact.article_type);
      const reminderIcon = fact.has_reminder ? '<span class="text-info text-xs" title="Напоминание">🔔</span>' : '';
      const offlineIcon = fact.is_offline_sync ? '<span class="text-xs" title="Создано offline">☁️</span>' : '';
      const recurringIcon = fact.recurring_plan_id ? '<span class="text-secondary text-xs" title="Регламентный">🔄</span>' : '';

      const divHtml = `
        <div class="transaction-item py-2" data-plan-id="${fact.id}" onclick="showEditModal(${fact.id})">
          <div class="flex items-center gap-2">
            <span class="badge badge-info badge-xs shrink-0">План</span>
            <span class="flex-1 font-medium truncate">${articleName}</span>
            <span class="${mobileAmountClass} font-bold whitespace-nowrap">${mobileAmount}</span>
            ${recurringIcon}${reminderIcon}${offlineIcon}
          </div>
          <div class="text-xs text-base-content/60 mt-1 truncate">
            ${shortDate} • ${financialCenter} • ${description}
          </div>
        </div>`;
      const tpl = document.createElement('template');
      tpl.innerHTML = divHtml.trim();
      const divEl = tpl.content.firstElementChild;
      if (divEl) mobileList.appendChild(divEl);
    }
  });
}
```

### Step 3.7 — Update stats and add updateLoadMoreButton()

- [ ] Replace `updateStats()` with:

```typescript
function updateStats(): void {
  const totalElem = document.getElementById('stat-total');
  const pageInfoElem = document.getElementById('stat-page-info');

  if (totalElem) totalElem.textContent = String(totalFacts);
  if (pageInfoElem) {
    pageInfoElem.textContent = loadedCount < totalFacts
      ? `показано ${loadedCount} из ${totalFacts}`
      : `${totalFacts}`;
  }
}
```

- [ ] Replace `updatePagination()` with `updateLoadMoreButton()`:

```typescript
function updateLoadMoreButton(): void {
  const container = document.getElementById('load-more-container');
  const counter = document.getElementById('load-more-counter');

  if (!container) return;

  if (hasMoreFacts) {
    container.classList.remove('hidden');
    if (counter) counter.textContent = `(показано ${loadedCount} из ${totalFacts})`;
  } else {
    container.classList.add('hidden');
  }
}
```

### Step 3.8 — Update loadRemindersForFacts() signature

- [ ] Update `loadRemindersForFacts()` to accept an optional `clearExisting` parameter:

Find:
```typescript
async function loadRemindersForFacts(factIds: number[]): Promise<void> {
  remindersMap.clear();
```

Replace:
```typescript
async function loadRemindersForFacts(factIds: number[], clearExisting = true): Promise<void> {
  if (clearExisting) remindersMap.clear();
```

### Step 3.9 — Update isPage1NoExtraFilters() for new state model

- [ ] Find `isPage1NoExtraFilters()` and update the page check:

Find:
```typescript
function isPage1NoExtraFilters(): boolean {
  if (currentPage !== 0) {
    return false;
  }
```

Replace:
```typescript
function isPage1NoExtraFilters(): boolean {
  if (currentOffset !== 0) {
    return false;
  }
```

### Step 3.10 — Update fetchAndInjectPlanRow() for new state model

- [ ] In `fetchAndInjectPlanRow()`, find the trim logic using `pageSize` and update to `PAGE_SIZE`:

Find:
```typescript
      // Trim excess rows beyond pageSize
      const allRows = desktopTbody.querySelectorAll('tr');
      for (let i = allRows.length - 1; i >= pageSize; i--) {
```

Replace:
```typescript
      // Trim excess rows beyond PAGE_SIZE
      const allRows = desktopTbody.querySelectorAll('tr');
      for (let i = allRows.length - 1; i >= PAGE_SIZE; i--) {
```

Find (mobile trim):
```typescript
      // Trim excess items beyond pageSize
      const allItems = mobileList.querySelectorAll('.transaction-item');
      for (let i = allItems.length - 1; i >= pageSize; i--) {
```

Replace:
```typescript
      // Trim excess items beyond PAGE_SIZE
      const allItems = mobileList.querySelectorAll('.transaction-item');
      for (let i = allItems.length - 1; i >= PAGE_SIZE; i--) {
```

Also update the stats after injection. Find in `fetchAndInjectPlanRow()` 'create' branch:
```typescript
    totalFacts++;
    updateStats();
    updatePagination();
```

Replace with:
```typescript
    totalFacts++;
    loadedCount = Math.min(loadedCount + 1, PAGE_SIZE);
    updateStats();
    updateLoadMoreButton();
```

And in `removePlanRow()`:
Find:
```typescript
  totalFacts = Math.max(0, totalFacts - 1);
  updateStats();
  updatePagination();
```

Replace:
```typescript
  totalFacts = Math.max(0, totalFacts - 1);
  loadedCount = Math.max(0, loadedCount - 1);
  updateStats();
  updateLoadMoreButton();
```

### Step 3.11 — Remove previousPage() and nextPage()

- [ ] Delete the `previousPage()` and `nextPage()` functions from `factsTable.ts` entirely (they are no longer needed — "Load more" replaces prev/next navigation).

### Step 3.12 — Update windowExports.ts

- [ ] In `frontend/web/static/js/plan/adapters/windowExports.ts`:

Add `loadMoreFacts` export — add after `window.loadFacts = planApp.loadFacts;`:
```typescript
  window.PlanApp.FactsTable.loadMoreFacts = planApp.FactsTable.loadMoreFacts;
```

Remove these three lines:
```typescript
  window.previousPage = planApp.previousPage;
  window.nextPage = planApp.nextPage;
```

Also verify the `FactsTable` namespace includes `loadMoreFacts`. In `plan/index.ts`, the `FactsTable` object is assembled — add `loadMoreFacts` there if not already present.

- [ ] Find the FactsTable namespace assembly in `plan/index.ts`:

```bash
grep -n "FactsTable\|loadMoreFacts\|previousPage\|nextPage" \
  frontend/web/static/js/plan/index.ts | head -20
```

Update the FactsTable object to include `loadMoreFacts` and remove `previousPage`/`nextPage`.

### Step 3.13 — Run type-check and build

- [ ] Run:

```bash
npm run type-check 2>&1 | grep error
npm run bundle 2>&1 | tail -10
```

Expected: no TypeScript errors, plan bundle produced

### Step 3.14 — Manual smoke test in browser

> **Deploy first:** bump `VERSION` → push → CI → `ssh budget-test 'cd /opt/budget && ./deploy.sh'`.

- [ ] Open `https://fbd.ikeniborn.ru/plan` — page loads, first 50 rows visible
- [ ] If total records > 50: "Загрузить ещё (показано 50 из N)" button visible below table
- [ ] Click "Загрузить ещё" — rows appended (not replaced), counter updates
- [ ] Change a filter and click "Применить" — table clears and resets to first 50
- [ ] Verify WS create event still injects row at top of table

- [ ] Commit:

```bash
git add frontend/web/static/js/plan/factsTable.ts \
        frontend/web/static/js/plan/adapters/windowExports.ts \
        frontend/web/static/js/plan/index.ts \
        frontend/web/templates/plan.html
git commit -m "feat(plan): replace client-side pagination with API-first load-more (limit=50&offset=N)"
```

---

## Task 4: Double Render Fix

**Files:**
- Modify: `backend/app/api/v1/endpoints/facts.py` (plan-branch of `get_fact_row_html`, 3 lines)

### Step 4.1 — Write failing backend integration test

- [ ] Create `tests/integration/backend/test_plan_row_html.py`:

```python
"""
Verify get_fact_row_html plan-branch matches renderFactsTable TypeScript output.
Tests run against live DB — use the standard async client fixture from conftest.py.
"""
import pytest


@pytest.mark.asyncio
async def test_plan_row_html_id_cell_no_badge(async_client, plan_fact):
    """ID cell must be plain <td class="text-base-content/50 text-xs">, not badge-ghost."""
    resp = await async_client.get(
        f"/api/v1/facts/{plan_fact.id}/row-html",
        params={"record_type": "plan"},
    )
    assert resp.status_code == 200
    html = resp.text
    assert 'badge-ghost' not in html
    assert 'text-base-content/50 text-xs' in html


@pytest.mark.asyncio
async def test_plan_row_html_article_cell_no_color_span(async_client, plan_fact):
    """Article name must be plain text in <td>, no color span wrapper."""
    resp = await async_client.get(
        f"/api/v1/facts/{plan_fact.id}/row-html",
        params={"record_type": "plan"},
    )
    assert resp.status_code == 200
    html = resp.text
    # Article name should NOT be inside a colored span
    assert '<span class="text-error">' not in html
    assert '<span class="text-success">' not in html
    assert '<span class="text-info">' not in html
    assert '<span class="text-warning">' not in html


@pytest.mark.asyncio
async def test_plan_row_html_updated_at_class(async_client, plan_fact):
    """Updated-at cell must have text-base-content/60 class (not whitespace-nowrap)."""
    resp = await async_client.get(
        f"/api/v1/facts/{plan_fact.id}/row-html",
        params={"record_type": "plan"},
    )
    assert resp.status_code == 200
    html = resp.text
    assert 'text-base-content/60' in html
```

Note: `plan_fact` fixture must be defined in `conftest.py`. Check if it exists:

```bash
grep -n "plan_fact\|def.*fact.*fixture" tests/integration/backend/conftest.py | head -10
```

If `plan_fact` fixture does not exist, add it to `conftest.py`:
```python
@pytest.fixture
async def plan_fact(session, test_user, test_article, test_financial_center):
    """A minimal plan BudgetFact for row-html tests."""
    from app.models.budget_fact import BudgetFact
    from datetime import date
    fact = BudgetFact(
        fact_date=date(2026, 6, 1),
        financial_center_id=test_financial_center.id,
        article_id=test_article.id,
        amount=10000,
        user_id=test_user.id,
        record_type='plan',
    )
    session.add(fact)
    await session.commit()
    await session.refresh(fact)
    return fact
```

- [ ] Run tests to verify they fail:

```bash
cd tests && ./run-tests.sh backend 2>&1 | grep -A2 "test_plan_row_html"
```

Expected: `FAILED` — tests should fail because the current HTML has `badge-ghost` and colored article span.

### Step 4.2 — Fix plan-branch in facts.py

- [ ] In `backend/app/api/v1/endpoints/facts.py`, find the plan-branch `desktop_row` (around line 1478).

Find these 3 lines inside the plan-branch `desktop_row` f-string:
```python
  <td><code class="badge badge-ghost">{fact.id}</code></td>
```
Replace with:
```python
  <td class="text-base-content/50 text-xs">{fact.id}</td>
```

Find:
```python
  <td><span class="{article_color_class}">{article_name}</span></td>
```
Replace with:
```python
  <td>{article_name}</td>
```

Find (the updated_at `<td>`):
```python
  <td class="text-xs whitespace-nowrap">{updated_at_formatted}</td>
```
Replace with:
```python
  <td class="text-xs text-base-content/60">{updated_at_formatted}</td>
```

**Important:** the plan-branch `desktop_row` is missing the `updated_at` column entirely in the current code (line 1489 shows `<td class="text-center">{reminder_icon}</td>` comes right after user_name). Check the actual plan-branch structure. The spec says to fix the `updated_at` `<td>` class — find the actual tag first:

```bash
grep -n "whitespace-nowrap\|updated_at_formatted\|text-base-content/60" \
  backend/app/api/v1/endpoints/facts.py | head -10
```

Apply the fix to the matching line in the plan-branch only (not the fact-branch).

### Step 4.3 — Run tests to verify they pass

- [ ] Run:

```bash
cd tests && ./run-tests.sh backend 2>&1 | grep -A2 "test_plan_row_html"
```

Expected: `3 passed`

### Step 4.4 — Manual verification

> **Deploy first:** bump `VERSION` → push → CI → `ssh budget-test 'cd /opt/budget && ./deploy.sh'`.

- [ ] Open `https://fbd.ikeniborn.ru/plan`
- [ ] Create a new plan entry
- [ ] Verify the new row matches existing rows: plain ID number (no badge), plain article name (no color span around it), consistent updated-at styling
- [ ] Check on mobile breakpoint (375px) as well

- [ ] Commit:

```bash
git add backend/app/api/v1/endpoints/facts.py \
        tests/integration/backend/test_plan_row_html.py
git commit -m "fix(backend): align plan-branch get_fact_row_html HTML with TypeScript renderFactsTable output"
```

---

## Self-Review Checklist

- [x] **Spec coverage — Task 1:** `get_planning_month` utility, `getPlanningMonthStart` in filters.ts, modal period buttons (plan page + dashboard), bot hint — all covered
- [x] **Spec coverage — Task 2:** `analyticsArticleChoices.ts` new module, `loadAnalyticsArticleFilter` replaced — covered
- [x] **Spec coverage — Task 3:** `loadFacts()` rewritten API-first, `loadMoreFacts()` added, `has_recurring_plan`/`has_reminder` passed to API (not post-filtered), Dexie background sync unaffected (we don't touch DataLayer write path), WS `fetchAndInjectPlanRow` unchanged — covered
- [x] **Spec coverage — Task 4:** 3-line fix in plan-branch only — covered
- [x] **No placeholders:** all steps have exact code or exact commands
- [x] **Type consistency:** `PAGE_SIZE` (not `pageSize`) used throughout factsTable.ts after rewrite; `loadedCount` and `currentOffset` used consistently; `updateLoadMoreButton()` called everywhere `updatePagination()` was called
- [x] **Constraint check:** DB schema unchanged, bot API unchanged (hint is additive text), facts page unaffected (only plan-branch modified in `get_fact_row_html`), Dexie write/sync paths not touched

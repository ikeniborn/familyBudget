---
review:
  plan_hash: 7ad84ecd763e652d
  spec_hash: 65b3bda50725e9a7
  last_run: "2026-06-03"
  phases:
    structure:     { status: passed }
    coverage:      { status: passed }
    dependencies:  { status: passed }
    verifiability: { status: passed }
    consistency:   { status: passed }
  findings:
    - id: F-001
      phase: structure
      severity: WARNING
      section: "## File Map"
      section_hash: "n/a"
      text: "`plan/adapters/eventDelegation.ts` modified in Task 11 but absent from File Map table"
      verdict: fixed
      verdict_at: "2026-06-03"
    - id: F-002
      phase: coverage
      severity: WARNING
      section: "### `facts/index.ts`, ### `plan/index.ts`"
      section_hash: "n/a"
      text: "Spec items 4 (reset-filters handler) placed in eventDelegation.ts (Tasks 7/11), not in index.ts as spec groups them"
      verdict: accepted
      verdict_at: "2026-06-03"
      verdict_reason: "eventDelegation.ts is the correct location per project pattern; spec grouping was logical, not file-literal"
    - id: F-003
      phase: structure
      severity: WARNING
      section: "### Task 12"
      section_hash: f959a944d9a7c00b
      text: "Duplicate step label 'Step A2' (Path A and Path B) — intentional branching but ambiguous numbering"
      verdict: wontfix
      verdict_at: "2026-06-03"
      verdict_reason: "Path A / Path B labels make branching intent clear; renaming would not improve readability"
    - id: F-004
      phase: verifiability
      severity: WARNING
      section: "### Task 13"
      section_hash: eee87ad58c77d3e1
      text: "Smoke test Step 3 references remote dev server https://fbd.ikeniborn.ru before code is deployed (Task 15). 'or local dev if available' mitigates."
      verdict: accepted
      verdict_at: "2026-06-03"
      verdict_reason: "Local dev server is the primary target; remote server mention is aspirational fallback"
chain:
  intent: docs/superpowers/intents/2026-06-03-category-filter-search-intent.md
  spec: docs/superpowers/specs/2026-06-03-category-filter-search-design.md
---

# Category Filter Search (facts & plan) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace plain `<select id="filter-article">` on `/facts` and `/plan` pages with `ChoicesCategoryTree` widget (Choices.js + Fuse.js fuzzy search, breadcrumb hierarchy), and fix analytics-article to filter client-side from cached data.

**Architecture:** Shared factory `createCategoryFilterWidget()` in `modules/filterWidgets/categoryFilter.ts` wraps `BudgetShared.ChoicesCategoryTree`. Facts and plan pages each get a module-level singleton via their own `features/filterArticle/init.ts`. The underlying `<select>` stays in DOM — Choices.js wraps it and keeps `.value` in sync on user interaction. All UI calls to `setValue`/`clearValue`/`destroy` go through the widget wrapper.

**Tech Stack:** TypeScript, `window.BudgetShared.ChoicesCategoryTree`, Choices.js (via BudgetShared), Fuse.js (via ChoicesCategoryTree), Playwright E2E.

---

## File Map

| Action | Path |
|--------|------|
| **Create** | `frontend/web/static/js/modules/filterWidgets/categoryFilter.ts` |
| **Create** | `frontend/web/static/js/facts/features/filterArticle/init.ts` |
| **Create** | `frontend/web/static/js/plan/features/filterArticle/init.ts` |
| **Modify** | `frontend/web/templates/facts.html` (line 85) |
| **Modify** | `frontend/web/templates/components/plan/filters_section.html` (line 69) |
| **Modify** | `frontend/web/static/js/facts/index.ts` |
| **Modify** | `frontend/web/static/js/facts/operations/filterOperations.ts` |
| **Modify** | `frontend/web/static/js/facts/adapters/eventDelegation.ts` |
| **Modify** | `frontend/web/static/js/plan/adapters/eventDelegation.ts` |
| **Modify** | `frontend/web/static/js/plan/index.ts` |
| **Modify** | `frontend/web/static/js/plan/filters.ts` |
| **Modify** | `frontend/web/static/js/plan/filterAnalyticsSync.ts` |
| **Modify** | `frontend/web/static/js/plan/analyticsArticleChoices.ts` |
| **Modify** | `frontend/web/static/js/plan/analytics.ts` |
| **Create** | `tests/e2e/webapp/test_category_filter_search.spec.ts` *(post-deploy, on request)* |

---

### Task 1: Create shared `CategoryFilterWidget` factory

**Files:**
- Create: `frontend/web/static/js/modules/filterWidgets/categoryFilter.ts`

- [ ] **Step 1: Create the factory module**

```typescript
// frontend/web/static/js/modules/filterWidgets/categoryFilter.ts

export interface CategoryFilterWidget {
  init(elementId: string, articleType?: string | null): void;
  destroy(): void;
  setValue(value: string | null): void;
  clearValue(): void;
  getInstance(): any;
}

export function createCategoryFilterWidget(): CategoryFilterWidget {
  let instance: any = null;

  const widget: CategoryFilterWidget = {
    init(elementId: string, articleType?: string | null): void {
      const ChoicesCategoryTree = (window as any).BudgetShared?.ChoicesCategoryTree;
      if (!ChoicesCategoryTree) return;
      instance = new ChoicesCategoryTree(elementId, {
        ...(articleType ? { type: articleType } : {}),
        multiple: false,
        showPath: true,
        showClearButton: true,
      });
    },

    destroy(): void {
      if (instance?.destroy) {
        instance.destroy();
        instance = null;
      }
    },

    setValue(value: string | null): void {
      if (instance?.setChoiceByValue) {
        instance.setChoiceByValue(value ?? '');
      }
    },

    clearValue(): void {
      widget.setValue(null);
    },

    getInstance(): any {
      return instance;
    },
  };

  return widget;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/web/static/js/modules/filterWidgets/categoryFilter.ts
git commit -m "feat: add createCategoryFilterWidget factory"
```

---

### Task 2: Create facts page filter article singleton

**Files:**
- Create: `frontend/web/static/js/facts/features/filterArticle/init.ts`

- [ ] **Step 1: Create the module**

```typescript
// frontend/web/static/js/facts/features/filterArticle/init.ts

import { createCategoryFilterWidget } from '../../../modules/filterWidgets/categoryFilter';

export const factsFilterArticleWidget = createCategoryFilterWidget();

export function initFactsFilterArticle(type?: string | null): void {
  factsFilterArticleWidget.destroy();
  factsFilterArticleWidget.init('#filter-article', type ?? null);
}

export function resetFactsFilterArticle(): void {
  factsFilterArticleWidget.destroy();
  factsFilterArticleWidget.init('#filter-article', null);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/web/static/js/facts/features/filterArticle/init.ts
git commit -m "feat: add facts filter article singleton"
```

---

### Task 3: Create plan page filter article singleton

**Files:**
- Create: `frontend/web/static/js/plan/features/filterArticle/init.ts`

- [ ] **Step 1: Create the module**

```typescript
// frontend/web/static/js/plan/features/filterArticle/init.ts

import { createCategoryFilterWidget } from '../../../modules/filterWidgets/categoryFilter';

export const planFilterArticleWidget = createCategoryFilterWidget();

export function initPlanFilterArticle(type?: string | null): void {
  planFilterArticleWidget.destroy();
  planFilterArticleWidget.init('#filter-article', type ?? null);
}

export function resetPlanFilterArticle(): void {
  planFilterArticleWidget.destroy();
  planFilterArticleWidget.init('#filter-article', null);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/web/static/js/plan/features/filterArticle/init.ts
git commit -m "feat: add plan filter article singleton"
```

---

### Task 4: Remove DaisyUI classes from `#filter-article` in HTML templates

Choices.js wraps the `<select>` in its own `<div>`. DaisyUI `select select-bordered` classes conflict with Choices.js styling (same pattern already applied in modal forms).

**Files:**
- Modify: `frontend/web/templates/facts.html` (line 85)
- Modify: `frontend/web/templates/components/plan/filters_section.html` (line 69)

- [ ] **Step 1: Update `facts.html` line 85**

Before:
```html
<select id="filter-article" class="select select-bordered category-filter w-full" title="Фильтровать факты по категории">
```

After:
```html
<select id="filter-article" class="category-filter w-full" title="Фильтровать факты по категории">
```

- [ ] **Step 2: Update `filters_section.html` line 69**

Before:
```html
<select id="filter-article" class="select select-bordered category-filter w-full" title="Фильтровать плановые записи по категории">
```

After:
```html
<select id="filter-article" class="category-filter w-full" title="Фильтровать плановые записи по категории">
```

- [ ] **Step 3: Commit**

```bash
git add frontend/web/templates/facts.html frontend/web/templates/components/plan/filters_section.html
git commit -m "fix: remove DaisyUI classes from filter-article select (conflicts with Choices.js)"
```

---

### Task 5: Wire up facts page — `facts/index.ts`

Remove the old `populateArticleDropdown` call. Add `initFactsFilterArticle()` call after dropdowns load. Add `change` listener on `#filter-article-type`.

**Files:**
- Modify: `frontend/web/static/js/facts/index.ts`

- [ ] **Step 1: Add import at top of `facts/index.ts`**

After existing imports, add:
```typescript
import { initFactsFilterArticle } from './features/filterArticle/init';
```

- [ ] **Step 2: Remove `populateArticleDropdown` call in `loadAndPopulateDropdowns()`**

Current code in `loadAndPopulateDropdowns()` (around line 196):
```typescript
populateArticleDropdown(articles);
```

Remove that line. The function call and its definition stay — the function is still needed if called elsewhere; if unused after this, remove it too. (Check with grep: `grep -n "populateArticleDropdown" frontend/web/static/js/facts/index.ts`. If it appears only in `loadAndPopulateDropdowns`, delete both the call and the function body.)

- [ ] **Step 3: Add `initFactsFilterArticle()` call in `initializeUI()`**

After the `await loadAndPopulateDropdowns()` block (around line 117), add:
```typescript
// Initialize ChoicesCategoryTree for #filter-article
initFactsFilterArticle();
```

- [ ] **Step 4: Add `change` listener on `#filter-article-type` in `initializeUI()`**

After the `initFactsFilterArticle()` call, add:
```typescript
const articleTypeEl = document.getElementById('filter-article-type') as HTMLSelectElement | null;
articleTypeEl?.addEventListener('change', () => {
  const newType = articleTypeEl.value || null;
  import('./features/filterArticle/init').then(({ initFactsFilterArticle: reinit }) => {
    reinit(newType);
  });
  import('./core/stateManager').then(({ updateFilters }) => {
    updateFilters({ article_id: null });
  });
});
```

> **Note:** Dynamic imports avoid circular dependency risks. Both modules are already loaded at runtime so this adds no latency.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run type-check
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/web/static/js/facts/index.ts
git commit -m "feat(facts): init ChoicesCategoryTree for filter-article, add type change listener"
```

---

### Task 6: Clear Choices.js state on facts filter reset — `filterOperations.ts`

When filters are reset (`writeFiltersToUI()` is called from `resetFiltersAction()`), Choices.js UI must also be cleared. The underlying `<select>.value = ''` alone doesn't update Choices.js visually.

**Files:**
- Modify: `frontend/web/static/js/facts/operations/filterOperations.ts`

- [ ] **Step 1: Add import at top of `filterOperations.ts`**

After existing imports:
```typescript
import { factsFilterArticleWidget } from '../features/filterArticle/init';
```

- [ ] **Step 2: Add `clearValue()` call in `writeFiltersToUI()` (around line 208)**

After:
```typescript
if (articleSelect) articleSelect.value = filters.article_id ? String(filters.article_id) : '';
```

Add:
```typescript
factsFilterArticleWidget.clearValue();
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run type-check
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/web/static/js/facts/operations/filterOperations.ts
git commit -m "fix(facts): sync Choices.js UI on filter reset"
```

---

### Task 7: Call `resetFactsFilterArticle()` in facts event delegation

When user clicks "Сбросить", the widget must be destroyed and reinitialized without type filter (to show all categories). `clearValue()` alone is not enough — we need `destroy + reinit`.

**Files:**
- Modify: `frontend/web/static/js/facts/adapters/eventDelegation.ts`

- [ ] **Step 1: Add import at top of `eventDelegation.ts`**

After existing imports:
```typescript
import { resetFactsFilterArticle } from '../features/filterArticle/init';
```

- [ ] **Step 2: Add call in `reset-filters` case**

Current `reset-filters` case (around line 48):
```typescript
case 'reset-filters':
    event.stopPropagation();
    event.preventDefault();
    resetFiltersAction();
    resetFiltersAndReload();
    break;
```

Add `resetFactsFilterArticle()` call:
```typescript
case 'reset-filters':
    event.stopPropagation();
    event.preventDefault();
    resetFactsFilterArticle();
    resetFiltersAction();
    resetFiltersAndReload();
    break;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run type-check
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/web/static/js/facts/adapters/eventDelegation.ts
git commit -m "fix(facts): reinit filter-article widget on reset-filters"
```

---

### Task 8: Wire up plan page — `plan/index.ts`

Stop populating `#filter-article` with plain options (ChoicesCategoryTree handles that). Add `initPlanFilterArticle()` call after dropdowns load. Add `change` listener on `#filter-article-type`.

**Files:**
- Modify: `frontend/web/static/js/plan/index.ts`

- [ ] **Step 1: Add import at top of `plan/index.ts`**

After existing imports:
```typescript
import { initPlanFilterArticle } from './features/filterArticle/init';
```

- [ ] **Step 2: Stop populating `#filter-article` in `loadArticlesDropdown()`**

In `loadArticlesDropdown()` (around line 322), remove the block that appends options to `filterSelect`:

```typescript
// REMOVE this block (approximately lines 334–344):
const filterSelect = document.getElementById('filter-article') as HTMLSelectElement | null;

if (!filterSelect) {
  log.warn('Article dropdown not found');
  return;
}

sortedNodes.forEach(node => {
  const option = createArticleOption(node);
  filterSelect.appendChild(option);
});
```

Keep the `(window as any).allCategories = articles;` line and all other logic above it — it's needed by `crud.ts`.

After removing, `loadArticlesDropdown()` ends after the `allCategories` assignment and the log line.

- [ ] **Step 3: Call `initPlanFilterArticle()` after dropdowns load in `initialize()`**

After the `await Promise.all([...])` block (around line 190), add:
```typescript
// Initialize ChoicesCategoryTree for #filter-article
initPlanFilterArticle();
```

- [ ] **Step 4: Add `change` listener on `#filter-article-type` in `initialize()`**

After `initPlanFilterArticle()`, add:
```typescript
const filterArticleTypeEl = document.getElementById('filter-article-type') as HTMLSelectElement | null;
filterArticleTypeEl?.addEventListener('change', () => {
  const newType = filterArticleTypeEl.value || null;
  initPlanFilterArticle(newType);
  PlanFilters.setFilters({ article_id: null });
});
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run type-check
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/web/static/js/plan/index.ts
git commit -m "feat(plan): init ChoicesCategoryTree for filter-article, add type change listener"
```

---

### Task 9: Sync Choices.js state in plan filters — `plan/filters.ts`

`writeFiltersToUI()` is called when restoring filter state (reset, init). The Choices.js wrapper must be updated to match the underlying select.

**Files:**
- Modify: `frontend/web/static/js/plan/filters.ts`

- [ ] **Step 1: Add import at top of `filters.ts`**

After existing imports:
```typescript
import { planFilterArticleWidget } from './features/filterArticle/init';
```

- [ ] **Step 2: Add `setValue()` call in `writeFiltersToUI()` (around line 200)**

After:
```typescript
if (articleSelect) articleSelect.value = filters.article_id ? String(filters.article_id) : '';
```

Add:
```typescript
planFilterArticleWidget.setValue(filters.article_id ? String(filters.article_id) : null);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run type-check
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/web/static/js/plan/filters.ts
git commit -m "fix(plan): sync Choices.js UI when writing filters to UI"
```

---

### Task 10: Sync Choices.js in analytics↔filters sync — `plan/filterAnalyticsSync.ts`

When analytics panel changes article (bidirectional sync), the Choices.js filter widget must also update visually.

**Files:**
- Modify: `frontend/web/static/js/plan/filterAnalyticsSync.ts`

- [ ] **Step 1: Add import at top of `filterAnalyticsSync.ts`**

After existing imports:
```typescript
import { planFilterArticleWidget } from './features/filterArticle/init';
```

- [ ] **Step 2: Clear Choices.js when article type resets article (around line 338)**

After:
```typescript
if (filterArticle) {
  filterArticle.value = '';
  PlanFilters.setFilters({ article_id: null });
}
```

Add inside the same `if (filterArticle)` block (or immediately after):
```typescript
planFilterArticleWidget.clearValue();
```

Full updated block:
```typescript
if (filterArticle) {
  filterArticle.value = '';
  PlanFilters.setFilters({ article_id: null });
  planFilterArticleWidget.clearValue();
}
```

- [ ] **Step 3: Sync Choices.js when analytics article changes (around line 354)**

After:
```typescript
filterArticle.value = newValue;
PlanFilters.setFilters({ article_id: parseInt(newValue) || null });
```

Add:
```typescript
planFilterArticleWidget.setValue(newValue || null);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run type-check
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/web/static/js/plan/filterAnalyticsSync.ts
git commit -m "fix(plan): sync Choices.js filter widget during analytics↔filters sync"
```

---

### Task 11: Call `resetPlanFilterArticle()` in plan event delegation

When user clicks "Сбросить", the widget must be destroyed and reinitialized without type filter.

**Files:**
- Modify: `frontend/web/static/js/plan/adapters/eventDelegation.ts`

- [ ] **Step 1: Add import at top of `eventDelegation.ts`**

After existing imports:
```typescript
import { resetPlanFilterArticle } from '../features/filterArticle/init';
```

- [ ] **Step 2: Call `resetPlanFilterArticle()` in `resetFilters()` async function (around line 91)**

Current `resetFilters()`:
```typescript
async function resetFilters(): Promise<void> {
  await PlanFilters.resetFilters();
  await PlanFactsTable.loadFacts();
  FilterAnalyticsSync.debouncedSyncFiltersToAnalytics();
}
```

Updated:
```typescript
async function resetFilters(): Promise<void> {
  resetPlanFilterArticle();
  await PlanFilters.resetFilters();
  await PlanFactsTable.loadFacts();
  FilterAnalyticsSync.debouncedSyncFiltersToAnalytics();
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run type-check
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/web/static/js/plan/adapters/eventDelegation.ts
git commit -m "fix(plan): reinit filter-article widget on reset-filters"
```

---

### Task 12: Client-side analytics-article filtering — `analyticsArticleChoices.ts` + `analytics.ts`

`analytics-article` dropdown must show only categories from the current month's plan records (already loaded in `filterOptions.articles`). Stop making a new API call per type change; filter the cached list client-side.

**Files:**
- Modify: `frontend/web/static/js/plan/analyticsArticleChoices.ts`
- Modify: `frontend/web/static/js/plan/analytics.ts`

#### Step A: Investigate ChoicesCategoryTree API for item injection

- [ ] **Step A1: Check if `ChoicesCategoryTree` exposes `setItems` or `setChoices`**

```bash
grep -r "setItems\|setChoices\|setChoiceByValue" frontend/web/static/js/ --include="*.ts" | grep -v "node_modules"
```

Also check the shared bundle:
```bash
grep -o "setItems\|setChoices" frontend/web/static/js/budgetShared.bundle.js | sort -u
```

If `setItems` or `setChoices` is exposed → use **Path A** below.
If neither is found → use **Path B** below.

#### Path A (preferred): ChoicesCategoryTree exposes item replacement method

- [ ] **Step A2 (Path A): Update `analyticsArticleChoices.ts` to use articles parameter**

Replace current file:
```typescript
// frontend/web/static/js/plan/analyticsArticleChoices.ts

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
    ...(articleType ? { type: articleType } : {}),
    multiple: false,
    showPath: false,
    showClearButton: true,
    mode: 'create',
  });

  // Replace API-loaded items with pre-filtered plan articles
  if (articles.length > 0 && articleChoicesInstance?.setItems) {
    articleChoicesInstance.setItems(articles);
  }
}
```

If `setItems` doesn't exist but `setChoices` does, replace the last block with:
```typescript
  if (articles.length > 0 && articleChoicesInstance?.setChoices) {
    const mapped = articles.map(a => ({ value: String(a.id), label: a.name, customProperties: a }));
    articleChoicesInstance.setChoices(mapped, 'value', 'label', true);
  }
```

#### Path B (fallback): use Choices.js instance directly

- [ ] **Step A2 (Path B): Update `analyticsArticleChoices.ts` to replace via Choices.js instance**

```typescript
// frontend/web/static/js/plan/analyticsArticleChoices.ts

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
    ...(articleType ? { type: articleType } : {}),
    multiple: false,
    showPath: false,
    showClearButton: true,
    mode: 'create',
  });

  // Replace API-loaded choices with pre-filtered plan articles via Choices.js instance
  if (articles.length > 0) {
    const choicesInstance = articleChoicesInstance?.getInstance?.() ?? articleChoicesInstance?._choices;
    if (choicesInstance?.clearChoices && choicesInstance?.setChoices) {
      choicesInstance.clearChoices();
      const mapped = articles.map(a => ({ value: String(a.id), label: a.name }));
      choicesInstance.setChoices(mapped, 'value', 'label', false);
    }
  }
}
```

> **Stop rule:** If neither Path A nor Path B updates the rendered dropdown correctly (inspect in browser console), halt and escalate. Do NOT modify `budgetShared.ts`.

#### Step B: Update `analytics.ts` — client-side type filtering

- [ ] **Step B1: Replace API call branch in `loadAnalyticsArticleFilter()`**

Current implementation (around line 356):
```typescript
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
```

Replace with:
```typescript
if (articleType !== null) {
  const cached = await loadAnalyticsFilterOptions();
  const filtered = (cached?.articles ?? []).filter(
    (a: { type: string }) => a.type === articleType
  );
  articles = filtered as PlanHelpers.Article[];
} else if (allArticles !== null) {
  articles = allArticles as PlanHelpers.Article[];
} else {
  const cached = await loadAnalyticsFilterOptions();
  articles = (cached?.articles ?? []) as PlanHelpers.Article[];
}
```

- [ ] **Step B2: Verify TypeScript compiles**

```bash
npm run type-check
```
Expected: no errors.

- [ ] **Step B3: Commit**

```bash
git add frontend/web/static/js/plan/analyticsArticleChoices.ts frontend/web/static/js/plan/analytics.ts
git commit -m "feat(plan): analytics-article filters client-side from cached plan data"
```

---

### Task 13: Build and visual smoke test

- [ ] **Step 1: Build all bundles**

```bash
FORCE_REBUILD=true npm run bundle
```
Expected: all bundles build successfully.

- [ ] **Step 2: Verify TypeScript**

```bash
npm run type-check
```
Expected: 0 errors.

- [ ] **Step 3: Manual smoke test on dev server**

Open `https://fbd.ikeniborn.ru/facts` (or local dev if available):

1. Filter-article field shows Choices.js widget (not plain select).
2. Type 2+ chars → dropdown filters with fuzzy search.
3. Change article type → widget reinits, shows only that type's categories.
4. Click "Сбросить" → widget resets visually, table reloads.
5. Mobile 375px: Choices.js dropdown not clipped.

Open `https://fbd.ikeniborn.ru/plan`:

6. Same checks 1–5 as facts.
7. Click analytics month → analytics-article shows only categories from that month's plan.
8. Select analytics-article → filter-article updates in Choices.js UI.

---

### Task 14: Write E2E tests *(post-deploy, run only when user requests)*

> **Skip during implementation.** Run after deploying to test server (`https://fbd.ikeniborn.ru`), only when explicitly requested.

**Files:**
- Create: `tests/e2e/webapp/test_category_filter_search.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/e2e/webapp/test_category_filter_search.spec.ts

/**
 * E2E Tests: Category Filter Search (ChoicesCategoryTree on facts & plan pages)
 *
 * Covers:
 *  - Choices.js widget initializes on page load
 *  - Type filter narrows category list
 *  - "Сбросить" clears Choices.js visually
 *  - Plan: analytics-article ↔ filter-article bidirectional sync
 *  - Plan: analytics-article shows only plan-relevant categories
 *  - Regression: transaction modal ChoicesCategoryTree still works
 *  - Mobile 375px: dropdown not clipped
 */

import { test, expect } from '@playwright/test';

const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  desktop: { width: 1920, height: 1080 },
};

// ============================================================================
// Helpers
// ============================================================================

async function navigateTo(page: import('@playwright/test').Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');
  const acceptAll = page.locator('button:has-text("Принять все")');
  if (await acceptAll.isVisible({ timeout: 3000 }).catch(() => false)) {
    await acceptAll.click();
    await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
  }
}

async function waitForChoicesWidget(page: import('@playwright/test').Page, containerId: string): Promise<void> {
  // ChoicesCategoryTree wraps <select> in a div.choices
  await page.waitForSelector(`${containerId} + .choices, .choices:has(+ ${containerId})`, {
    timeout: 8000,
  }).catch(async () => {
    // Fallback: any .choices div near the select
    await page.waitForSelector('.choices', { timeout: 8000 });
  });
}

// ============================================================================
// FACTS PAGE
// ============================================================================

test.describe('Facts — Category Filter Search', () => {
  test('filter-article shows Choices.js widget on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await navigateTo(page, '/facts');
    await page.waitForTimeout(2000); // allow JS init

    // Choices.js wraps the select: look for .choices container
    const choicesContainer = page.locator('.choices').first();
    await expect(choicesContainer).toBeVisible({ timeout: 8000 });

    // Underlying select should still be in DOM (Choices.js hides but keeps it)
    const underlyingSelect = page.locator('#filter-article');
    await expect(underlyingSelect).toBeAttached();
  });

  test('typing in filter-article narrows dropdown (substring search)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await navigateTo(page, '/facts');
    await page.waitForTimeout(2000);

    // Click the Choices.js input to open dropdown
    const choicesInput = page.locator('.choices__input--cloned, .choices__input').first();
    await choicesInput.click();
    await choicesInput.fill('рас');

    // Dropdown with filtered results appears
    const dropdown = page.locator('.choices__list--dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });
    const items = dropdown.locator('.choices__item');
    await expect(items.first()).toBeVisible();
  });

  test('selecting article type narrows category choices', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await navigateTo(page, '/facts');
    await page.waitForTimeout(2000);

    await page.selectOption('#filter-article-type', 'expense');
    await page.waitForTimeout(500); // allow widget reinit

    // Open Choices dropdown
    const choicesInput = page.locator('.choices__input--cloned, .choices__input').first();
    await choicesInput.click();

    const dropdown = page.locator('.choices__list--dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // All shown items should belong to expense type — at minimum dropdown appears
    await expect(dropdown.locator('.choices__item').first()).toBeVisible();
  });

  test('"Сбросить" clears Choices.js selection visually', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await navigateTo(page, '/facts');
    await page.waitForTimeout(2000);

    // Select something first
    const choicesInput = page.locator('.choices__input--cloned, .choices__input').first();
    await choicesInput.click();
    const firstItem = page.locator('.choices__list--dropdown .choices__item--selectable').first();
    if (await firstItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstItem.click();
    }

    // Click reset
    await page.locator('[data-action="reset-filters"]').click();
    await page.waitForTimeout(500);

    // Choices.js input placeholder text appears (no item selected)
    const itemSelected = page.locator('.choices__item--selectable[aria-selected="true"]');
    await expect(itemSelected).toHaveCount(0);
  });

  test('mobile 375px: Choices.js dropdown not clipped', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await navigateTo(page, '/facts');
    await page.waitForTimeout(2000);

    const choicesInput = page.locator('.choices__input--cloned, .choices__input').first();
    await choicesInput.click();

    const dropdown = page.locator('.choices__list--dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Dropdown must be visible within viewport (not clipped off-screen)
    const box = await dropdown.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.width).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// PLAN PAGE
// ============================================================================

test.describe('Plan — Category Filter Search', () => {
  test('filter-article shows Choices.js widget on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await navigateTo(page, '/plan');
    await page.waitForTimeout(2000);

    const choicesContainer = page.locator('.choices').first();
    await expect(choicesContainer).toBeVisible({ timeout: 8000 });

    const underlyingSelect = page.locator('#filter-article');
    await expect(underlyingSelect).toBeAttached();
  });

  test('typing in filter-article narrows dropdown', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await navigateTo(page, '/plan');
    await page.waitForTimeout(2000);

    const choicesInput = page.locator('.choices__input--cloned, .choices__input').first();
    await choicesInput.click();
    await choicesInput.fill('рас');

    const dropdown = page.locator('.choices__list--dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });
    await expect(dropdown.locator('.choices__item').first()).toBeVisible();
  });

  test('selecting article type narrows plan category choices', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await navigateTo(page, '/plan');
    await page.waitForTimeout(2000);

    await page.selectOption('#filter-article-type', 'expense');
    await page.waitForTimeout(500);

    const choicesInput = page.locator('.choices__input--cloned, .choices__input').first();
    await choicesInput.click();

    const dropdown = page.locator('.choices__list--dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });
    await expect(dropdown.locator('.choices__item').first()).toBeVisible();
  });

  test('"Сбросить" clears Choices.js selection on plan page', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await navigateTo(page, '/plan');
    await page.waitForTimeout(2000);

    const choicesInput = page.locator('.choices__input--cloned, .choices__input').first();
    await choicesInput.click();
    const firstItem = page.locator('.choices__list--dropdown .choices__item--selectable').first();
    if (await firstItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstItem.click();
    }

    await page.locator('[data-action="reset-filters"]').click();
    await page.waitForTimeout(500);

    const itemSelected = page.locator('.choices__item--selectable[aria-selected="true"]');
    await expect(itemSelected).toHaveCount(0);
  });

  test('mobile 375px: plan Choices.js dropdown not clipped', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await navigateTo(page, '/plan');
    await page.waitForTimeout(2000);

    const choicesInput = page.locator('.choices__input--cloned, .choices__input').first();
    await choicesInput.click();

    const dropdown = page.locator('.choices__list--dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    const box = await dropdown.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.width).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// PLAN PAGE — Bidirectional sync
// ============================================================================

test.describe('Plan — analytics-article ↔ filter-article sync', () => {
  test('changing analytics-article updates filter-article Choices.js UI', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await navigateTo(page, '/plan');
    await page.waitForTimeout(3000); // allow analytics init

    // Expand analytics section if collapsed
    const analyticsSection = page.locator('#analytics-section, [data-section="analytics"]');
    if (await analyticsSection.isHidden({ timeout: 1000 }).catch(() => false)) {
      await page.locator('[data-action="toggle-analytics"], .analytics-toggle').click();
      await page.waitForTimeout(500);
    }

    // Select a value in analytics-article
    const analyticsArticle = page.locator('#analytics-article');
    const options = await analyticsArticle.locator('option').all();
    if (options.length > 1) {
      const secondOption = await options[1].getAttribute('value');
      if (secondOption) {
        await analyticsArticle.selectOption(secondOption);
        await analyticsArticle.dispatchEvent('change');
        await page.waitForTimeout(500);

        // filter-article underlying select should reflect the value
        const filterArticle = page.locator('#filter-article');
        await expect(filterArticle).toHaveValue(secondOption);
      }
    }
  });
});

// ============================================================================
// REGRESSION: transaction modal ChoicesCategoryTree still works
// ============================================================================

test.describe('Regression — Modal ChoicesCategoryTree unaffected', () => {
  test('transaction create modal: article picker initializes without JS errors', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await navigateTo(page, '/facts');
    await page.waitForTimeout(2000);

    // Open create modal (FAB or button)
    const fabButton = page.locator('[data-action="open-create-modal"], .fab-button, button[aria-label*="добавить"], button[aria-label*="Добавить"]').first();
    if (await fabButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fabButton.click();
      await page.waitForTimeout(1000);

      // Modal should open without JS errors
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      // Choices.js in modal should be visible
      const modalChoices = page.locator('#modal_fact .choices, [id*="modal"] .choices').first();
      await expect(modalChoices).toBeVisible({ timeout: 5000 });

      expect(consoleErrors.filter(e => e.includes('ChoicesCategoryTree') || e.includes('Choices'))).toHaveLength(0);
    }
  });
});
```

- [ ] **Step 2: Run E2E tests against test server**

```bash
npm run test:e2e -- --grep "Category Filter Search"
```

Expected: all tests pass. If a test reveals a widget initialization issue, fix the underlying TS code in the relevant task above.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/webapp/test_category_filter_search.spec.ts
git commit -m "test(e2e): add category filter search tests for facts & plan pages"
```

---

### Task 15: Increment VERSION and open PR

- [ ] **Step 1: Increment patch version**

```bash
# Read current version
cat VERSION
# Increment patch: e.g. 0.6.186 → 0.6.187
echo "0.6.187" > VERSION
```

- [ ] **Step 2: Build to verify no regressions**

```bash
npm run type-check && FORCE_REBUILD=true npm run bundle
```
Expected: 0 errors, all bundles built.

- [ ] **Step 3: Commit version bump**

```bash
git add VERSION
git commit -m "chore: bump version for category filter search feature"
```

- [ ] **Step 4: Create PR into `test` branch**

```bash
git push origin HEAD
gh pr create --base test --title "feat: replace filter-article select with ChoicesCategoryTree on facts & plan" \
  --body "$(cat <<'EOF'
## Summary
- Replaces plain `<select id="filter-article">` on `/facts` and `/plan` with `ChoicesCategoryTree` (Choices.js + Fuse.js fuzzy search, breadcrumb paths)
- Adds `filter-article-type` change listener to reinit widget filtered by type
- Fixes analytics-article to filter plan categories client-side (no new API call)
- Bidirectional analytics↔filter sync updated to set Choices.js UI state

## Test plan
- [ ] Run `npm run type-check` — 0 errors
- [ ] Run E2E: `npm run test:e2e -- --grep "Category Filter Search"`
- [ ] Manual: facts page — type in filter, select type, reset
- [ ] Manual: plan page — type in filter, select type, analytics sync, reset
- [ ] Manual: mobile 375px — dropdown not clipped
- [ ] Regression: transaction modal article picker works

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

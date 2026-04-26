# Dashboard Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Устранить 4 бага из отчёта `tmp/test_plans/report_01_dashboard_2026-04-26.md` (BUG-1..BUG-4) минимальными правками с E2E-тестом-регрессией для главного бага.

**Architecture:** Точечные правки в `frontend/web/templates/index.html` (удалить дубль макросов модалок), `frontend/web/templates/components/tabs/fact_transaction_tab.html` (удалить мёртвый hidden input), `frontend/web/static/js/facts/operations/paginationOperations.ts` (убрать noisy warning). BUG-1 закрывает BUG-2 каскадно. BUG-5 (infra: deploy drift) — вне scope этого плана, обрабатывается отдельной задачей CI/CD.

**Tech Stack:** Jinja2 шаблоны, TypeScript (Rollup bundles), Playwright E2E (`tests/e2e/webapp/`).

---

## Файловая декомпозиция

| Файл | Изменение | Bug |
|---|---|---|
| `frontend/web/templates/index.html` | Удалить строки 185–189 (дубль `modal_fact('modal_add_transaction')` + `modal_plan('modal_add_plan')`) | BUG-1, BUG-2 |
| `tests/e2e/webapp/test_dashboard_modals.spec.ts` | Создать E2E-регрессию: на dashboard ровно 1×`#modal_fact` и 1×`#modal_plan`, нет `#modal_add_*` | BUG-1 |
| `frontend/web/templates/components/tabs/fact_transaction_tab.html` | Удалить hidden `<input name="fact_type">` (строки 44–45) | BUG-4 |
| `frontend/web/static/js/facts/operations/paginationOperations.ts` | Убрать `console.warn` на стр. 122 — выйти silently когда DOM пагинации отсутствует | BUG-3 |
| `VERSION` | bump patch | release |

---

### Task 1: E2E-регрессия для дублирующих модалок (BUG-1)

Сначала тест, потом фикс — гарантия, что фикс действительно закрывает баг.

**Files:**
- Create: `tests/e2e/webapp/test_dashboard_modals.spec.ts`

- [ ] **Step 1: Написать failing-тест**

```ts
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';

test.describe('Dashboard modals — BUG-1 regression', () => {
  test('dashboard renders exactly one #modal_fact and one #modal_plan, no stale duplicates', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(await page.locator('dialog#modal_fact').count()).toBe(1);
    expect(await page.locator('dialog#modal_plan').count()).toBe(1);
    expect(await page.locator('dialog#modal_add_transaction').count()).toBe(0);
    expect(await page.locator('dialog#modal_add_plan').count()).toBe(0);
  });
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `npx playwright test tests/e2e/webapp/test_dashboard_modals.spec.ts --project=chromium`
Expected: FAIL — `Expected: 0, Received: 1` для `#modal_add_transaction` и `#modal_add_plan`.

- [ ] **Step 3: Закоммитить failing-тест**

```bash
git add tests/e2e/webapp/test_dashboard_modals.spec.ts
git commit -m "test(dashboard): add failing E2E for duplicate add-modals (BUG-1)"
```

---

### Task 2: Удалить дубль модалок из index.html (BUG-1, BUG-2)

**Files:**
- Modify: `frontend/web/templates/index.html:185-189`

- [ ] **Step 1: Удалить устаревшие инстансы макросов**

Удалить блок (строки 185–189):
```jinja
    <!-- Modal: Добавить факт -->
    {{ modal_fact('modal_add_transaction') }}

    <!-- Modal: Добавить план -->
    {{ modal_plan('modal_add_plan') }}
```

Оставить только актуальные на строках 270–271:
```jinja
{{ modal_fact('modal_fact') }}
{{ modal_plan('modal_plan') }}
```

- [ ] **Step 2: Прогнать E2E-тест из Task 1**

Run: `npx playwright test tests/e2e/webapp/test_dashboard_modals.spec.ts --project=chromium`
Expected: PASS.

- [ ] **Step 3: Прогнать существующие dashboard-тесты — нет регрессий**

Run: `npx playwright test tests/e2e/webapp/ --project=chromium --grep dashboard`
Expected: PASS (или зелёные те, что были зелёные до правки).

- [ ] **Step 4: Закоммитить фикс**

```bash
git add frontend/web/templates/index.html
git commit -m "fix(dashboard): remove duplicate add-modals (BUG-1, BUG-2)

Inserting modal_fact/modal_plan macros twice (as modal_add_transaction
and modal_fact) caused 4 dialogs in DOM and double loadFinancialCenters
fetch. Keep only the canonical ids."
```

---

### Task 3: Удалить мёртвый hidden `fact_type` (BUG-4)

`record_type` radio — единственный источник правды; `fact_type` hidden не синхронизируется и backend его игнорирует.

**Files:**
- Modify: `frontend/web/templates/components/tabs/fact_transaction_tab.html:44-45`

- [ ] **Step 1: Подтвердить grep'ом, что `fact_type` нигде не читается из JS**

Run: `grep -rn "fact_type" frontend/web/static/js/ frontend/shared/`
Expected: ни одного matches (или только обновляющие writers, без readers — допустимо).

- [ ] **Step 2: Удалить блок строк 44–45**

Удалить:
```html
    <!-- Hidden fact_type — синхронизируется с radio record_type, читается createFact() -->
    <input type="hidden" name="fact_type" value="expense" />
```

- [ ] **Step 3: Прогнать type-check + vitest для modalFact**

Run: `npm run type-check && npx vitest run tests/unit --reporter=default 2>&1 | tail -30`
Expected: 0 type errors, vitest без новых fail.

- [ ] **Step 4: Прогнать dashboard E2E (smoke на создание факта)**

Run: `npx playwright test tests/e2e/webapp/ --project=chromium --grep "fact"`
Expected: существующие тесты создания факта зелёные.

- [ ] **Step 5: Закоммитить**

```bash
git add frontend/web/templates/components/tabs/fact_transaction_tab.html
git commit -m "refactor(modal_fact): remove dead hidden fact_type input (BUG-4)

Backend reads record_type radio; the parallel hidden fact_type was
never synced and confused readers. record_type is the single source."
```

---

### Task 4: Убрать noisy warning из PaginationOps (BUG-3)

`updatePaginationUI()` вызывается на страницах без pagination DOM (например, dashboard, куда подгружается `facts.min.js`). Рефакторить точку вызова — overkill; убираем шумный warn — функция и так корректно ранним return'ом ничего не делает.

**Files:**
- Modify: `frontend/web/static/js/facts/operations/paginationOperations.ts:121-124`

- [ ] **Step 1: Заменить warning на silent return**

Было (строки 121–124):
```ts
    if (!controls || !prevBtn || !nextBtn || !pageInfo) {
        console.warn('[PaginationOps] Pagination UI elements not found');
        return;
    }
```

Стало:
```ts
    if (!controls || !prevBtn || !nextBtn || !pageInfo) {
        return;
    }
```

- [ ] **Step 2: Прогнать type-check + bundle**

Run: `npm run type-check && npm run bundle 2>&1 | tail -20`
Expected: 0 type errors, bundles собрались.

- [ ] **Step 3: Smoke — открыть `/` и `/facts`, проверить console чисто**

Manual / E2E с `page.on('console')`: на `/` нет `[PaginationOps]`, на `/facts` пагинация работает (existing E2E).

- [ ] **Step 4: Закоммитить**

```bash
git add frontend/web/static/js/facts/operations/paginationOperations.ts
git commit -m "fix(facts): silence pagination warning when DOM absent (BUG-3)

facts bundle is loaded on /dashboard which has no pagination DOM.
Early return is the correct behavior; the warn was noise."
```

---

### Task 5: Bump VERSION

**Files:**
- Modify: `VERSION`

- [ ] **Step 1: Прочитать текущую версию**

Run: `cat VERSION`
Expected: `0.6.153`

- [ ] **Step 2: Записать `0.6.154`**

```bash
echo "0.6.154" > VERSION
```

- [ ] **Step 3: Закоммитить**

```bash
git add VERSION
git commit -m "chore: bump version 0.6.153 → 0.6.154"
```

(pre-commit hook автоматически синхронизирует `package.json` / `package-lock.json`).

---

### Task 6: Финальная верификация

- [ ] **Step 1: Прогнать весь E2E dashboard-suite**

Run: `npx playwright test tests/e2e/webapp/ --project=chromium --grep "dashboard|modal_fact|modal_plan"`
Expected: все зелёные, новый тест из Task 1 включён.

- [ ] **Step 2: Прогнать backend-интеграционные**

Run: `cd tests && ./run-tests.sh backend 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 3: Создать PR в `test`**

```bash
gh pr create --base test --title "fix(dashboard): remove duplicate modals + cleanup BUGs from 01-dashboard report" --body "$(cat <<'EOF'
## Summary
- Remove duplicate `modal_fact`/`modal_plan` macro instances on dashboard (BUG-1) — caused 4 dialogs in DOM and double `loadFinancialCenters` fetch (BUG-2)
- Remove dead `fact_type` hidden input from fact transaction tab (BUG-4)
- Silence noisy `[PaginationOps]` warn on pages without pagination DOM (BUG-3)
- Add E2E regression for duplicate-modal bug

## Test plan
- [x] New E2E test fails before fix, passes after
- [x] Existing dashboard/fact/plan E2E green
- [x] type-check + bundle clean
- [x] Manual: dashboard console clean of PaginationOps warning

Source: `tmp/test_plans/report_01_dashboard_2026-04-26.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Что вне scope этого плана

- **BUG-5** (dev отстаёт от `VERSION` на 4 patch): задача CI/CD, не код. Действие: проверить последний прогон `build-and-push.yml` и `deploy.sh` на `budget-test`. Создать отдельный issue, если pipeline сломан.
- **Миграция проверок в shelf-tests** (раздел отчёта): отдельная инициатива, не bugfix-PR. Кандидаты для миграции:
  - CRUD план/факт → `tests/integration/backend/test_plans_crud.py`, `test_facts_crud.py`
  - Recurring → N инстансов → pytest integration
  - Dexie upsert после API → vitest + fake-indexeddb

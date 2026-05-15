---
review:
  plan_hash: 1ff5108631876ba7
  spec_hash: f79bb4093f738775
  last_run: 2026-05-15
  phases:
    structure:     { status: passed }
    coverage:      { status: passed }
    dependencies:  { status: passed }
    verifiability: { status: passed }
    consistency:   { status: passed }
  findings: []
---

# Facts Page: Delete Stat & Row Render Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix double stat decrement on single fact delete and align server `/row-html` markup with client renderer for `record_type=fact`.

**Architecture:** Move `statDecrementedIds` management entirely into `deleteFact()` so the guard is set before the `await` that races with the WS `fact_deleted` event. Rewrite server `get_fact_row_html` `fact` branch to emit the exact 11-column structure produced by client `renderFactRow` / `renderFactMobileCard`.

**Tech Stack:** TypeScript (Vitest), Python FastAPI (pytest + httpx async), HTMX templates.

**Spec:** `docs/superpowers/specs/2026-05-15-facts-delete-stat-and-row-render-design.md`

---

## File Structure

**Modify:**
- `frontend/web/static/js/facts/operations/factsController.ts` — move stat-guard into `deleteFact`, drop from `removeRowFromTable`
- `backend/app/api/v1/endpoints/facts.py` — rewrite `fact` branch of `get_fact_row_html`

**Create:**
- `tests/unit/facts/factsControllerDelete.test.ts` — unit test for guard-before-await ordering
- `tests/integration/backend/test_facts_row_html.py` — pytest covering server markup

`plan` branch of `get_fact_row_html` untouched — exists for `/plan` page.

---

## Task 1: Bug 1 — Move stat-decrement guard before the await

**Files:**
- Modify: `frontend/web/static/js/facts/operations/factsController.ts:257-281` (`removeRowFromTable`), `304-340` (`deleteFact`)
- Test: `tests/unit/facts/factsControllerDelete.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/facts/factsControllerDelete.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../frontend/web/static/js/facts/integration/factsAPI', () => ({
    deleteFact: vi.fn(),
}));
vi.mock('../../../frontend/web/static/js/shared/confirmDialog', () => ({
    showConfirmDialog: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../../frontend/web/static/js/shared/toast', () => ({
    showToast: vi.fn(),
}));

import { deleteFact, consumeStatDecrement } from
    '../../../frontend/web/static/js/facts/operations/factsController';
import { deleteFact as apiDelete } from
    '../../../frontend/web/static/js/facts/integration/factsAPI';

describe('deleteFact stat guard', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <span id="stat-total">10</span>
            <tr data-id="42"><td></td></tr>
        `;
        (window as any).BudgetShared = {};
        vi.clearAllMocks();
    });

    it('marks statDecrementedIds before the API await resolves', async () => {
        let consumedDuringAwait: boolean | null = null;
        (apiDelete as any).mockImplementation(async () => {
            consumedDuringAwait = consumeStatDecrement(42);
        });

        await deleteFact(42);

        expect(consumedDuringAwait).toBe(true);
    });

    it('rolls back guard on API error', async () => {
        (apiDelete as any).mockRejectedValue(new Error('boom'));
        await deleteFact(43);
        expect(consumeStatDecrement(43)).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/facts/factsControllerDelete.test.ts`
Expected: FAIL — `consumedDuringAwait` is `false` (current code adds id after the await, inside `removeRowFromTable`).

- [ ] **Step 3: Update `deleteFact` to manage the guard**

In `frontend/web/static/js/facts/operations/factsController.ts`, replace the body of `deleteFact` (lines 304–340) with:

```typescript
export async function deleteFact(factId: number): Promise<void> {
    if (deletingFactIds.has(factId)) {
        logger.warn('[FACTS] Delete already in progress for fact:', factId);
        return;
    }
    deletingFactIds.add(factId);

    let guardAdded = false;
    try {
        const confirmed = await showConfirmDialog(
            'Вы уверены, что хотите удалить этот факт?',
            'Подтверждение удаления'
        );

        if (!confirmed) {
            return;
        }

        // Mark before the await: WS fact_deleted can arrive while deleteFn is in flight.
        statDecrementedIds.add(factId);
        guardAdded = true;

        const { deleteFact: deleteFn } = await import('../integration/factsAPI');
        await deleteFn(factId);

        // Auto-expire so a stale guard never blocks a future legitimate decrement.
        setTimeout(() => statDecrementedIds.delete(factId), 3000);

        showToast('Факт успешно удален', 'success');

        const removed = removeRowFromTable(factId);
        if (!removed) {
            await loadFacts({ forceAPI: true });
        }
    } catch (error) {
        if (guardAdded) {
            statDecrementedIds.delete(factId);
        }
        logger.error(' Error deleting fact:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showToast(`Ошибка удаления: ${errorMessage}`, 'error');
    } finally {
        deletingFactIds.delete(factId);
    }
}
```

- [ ] **Step 4: Remove guard logic from `removeRowFromTable`**

In the same file, lines 277–278, delete these two lines:

```typescript
    statDecrementedIds.add(factId);
    setTimeout(() => statDecrementedIds.delete(factId), 3000);
```

`removeRowFromTable` now ends at the `return true;` after stat-total update.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/facts/factsControllerDelete.test.ts`
Expected: PASS — both cases.

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/web/static/js/facts/operations/factsController.ts \
        tests/unit/facts/factsControllerDelete.test.ts
git commit -m "fix(facts): set stat-decrement guard before delete await"
```

---

## Task 2: Bug 2 — Align server `/row-html` `fact` branch with client renderer

**Files:**
- Modify: `backend/app/api/v1/endpoints/facts.py:1320-1473` (`get_fact_row_html`)
- Test: `tests/integration/backend/test_facts_row_html.py`

Target structure (must match `buildFactRowHtml` in `factsController.ts:891-916` and `renderFactMobileCard` at `factsController.ts:923-965`):

Desktop `<tr>` — 11 `<td>` in order:
1. checkbox (no `onchange`)
2. plain ID, `<td class="text-base-content/50 text-xs">{id}</td>`
3. date `DD.MM.YYYY`
4. financial center (truncated)
5. cost center (or `—`)
6. article name (truncated — no color span wrapper; color goes on amount cell only)
7. amount (color class + bold)
8. comment (truncated, or `—`)
9. user name with classes `text-xs whitespace-nowrap`
10. updated_at with classes `text-xs text-base-content/50 whitespace-nowrap`
11. actions cell (edit + delete buttons, same as today)

Mobile card — two-line layout, **no** reminder/recurring/offline icons block.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/backend/test_facts_row_html.py`:

```python
"""
Integration tests for GET /api/v1/facts/{id}/row-html.
Ensures server-rendered fact row matches client renderFactRow markup
(spec 2026-05-15-facts-delete-stat-and-row-render-design).
"""
from datetime import date

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.user import User


@pytest_asyncio.fixture
async def sample_fact(
    db_session: AsyncSession, test_user: User
) -> BudgetFact:
    fc = FinancialCenter(user_id=test_user.id, name="FC", is_active=True)
    db_session.add(fc)
    await db_session.commit()
    await db_session.refresh(fc)

    article = Article(
        user_id=test_user.id, parent_id=None, name="Food",
        type="expense", is_active=True,
    )
    db_session.add(article)
    await db_session.commit()
    await db_session.refresh(article)

    fact = BudgetFact(
        user_id=test_user.id,
        fact_date=date(2026, 5, 15),
        article_id=article.id,
        financial_center_id=fc.id,
        amount=12345,
        description="Lunch",
    )
    db_session.add(fact)
    await db_session.commit()
    await db_session.refresh(fact)
    return fact


@pytest.mark.asyncio
async def test_row_html_fact_branch_matches_client(
    auth_client: AsyncClient, sample_fact: BudgetFact
):
    resp = await auth_client.get(
        f"/api/v1/facts/{sample_fact.id}/row-html?record_type=fact"
    )
    assert resp.status_code == 200
    html = resp.text

    desktop, _, mobile = html.partition("|||")

    # Desktop: exactly 11 <td> cells
    assert desktop.count("<td") == 11, desktop

    # ID cell — plain styled td, not badge-ghost wrapper
    assert f'<td class="text-base-content/50 text-xs">{sample_fact.id}</td>' in desktop
    assert "badge badge-ghost" not in desktop

    # Updated_at column present
    assert "text-xs text-base-content/50 whitespace-nowrap" in desktop

    # Checkbox has no onchange handler
    assert "onchange=" not in desktop

    # Reminder / recurring / offline columns removed
    assert "Напоминание установлено" not in desktop
    assert "Регламентный платеж" not in desktop
    assert "Создано offline" not in desktop

    # Mobile card — no icons block
    assert "Напоминание установлено" not in mobile
    assert "Регламентный платеж" not in mobile


@pytest.mark.asyncio
async def test_row_html_plan_branch_unchanged(
    auth_client: AsyncClient, sample_fact: BudgetFact
):
    """Plan branch keeps original 13-column structure."""
    resp = await auth_client.get(
        f"/api/v1/facts/{sample_fact.id}/row-html?record_type=plan"
    )
    assert resp.status_code == 200
    html = resp.text
    desktop, _, _ = html.partition("|||")
    assert desktop.count("<td") == 13
    assert "badge badge-ghost" in desktop
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tests && ./run-tests.sh backend -k test_facts_row_html`
Expected: FAIL — current server output has 13 `<td>`, `badge badge-ghost` wrapper, `onchange=` on checkbox, no `text-base-content/50 whitespace-nowrap` updated_at column.

- [ ] **Step 3: Implement server-side `formatUpdatedAt`**

In `backend/app/api/v1/endpoints/facts.py`, inside `get_fact_row_html` (after `formatted_amount`, before `reminder_icon`), add:

```python
    def _format_updated_at(value) -> str:
        if value is None:
            return "—"
        try:
            dt = value
            return dt.strftime("%d.%m.%Y %H:%M")
        except Exception:
            return "—"

    updated_at_formatted = _format_updated_at(fact.updated_at)
```

(Matches `TableFormatters.formatUpdatedAt` output format `DD.MM.YYYY HH:MM`. Server timestamps are stored in UTC; client renderer normalizes to local — for parity within the row swap window this is acceptable since the WS event triggers an immediate replace and the next page reload runs the client renderer.)

- [ ] **Step 4: Rewrite `record_type=="fact"` desktop/mobile blocks**

Replace the entire `if record_type == "fact":` / `else:` block plus the `desktop_row` and `mobile_row` blocks (currently at `facts.py:1416-1471`) with:

```python
    if record_type == "fact":
        data_attr = f'data-id="{fact.id}"'
        edit_onclick = f"window.FactsManager?.showEditModal?.({fact.id})"
        delete_onclick = f"event.stopPropagation(); window.FactsManager?.deleteFact?.({fact.id})"
        mobile_onclick = f"window.FactsManager?.showEditModal?.({fact.id})"
        badge_html = '<span class="badge badge-primary badge-xs shrink-0">Факт</span>'

        desktop_row = f"""
<tr {data_attr}>
  <td><input type="checkbox" class="checkbox checkbox-sm fact-checkbox" data-fact-id="{fact.id}"></td>
  <td class="text-base-content/50 text-xs">{fact.id}</td>
  <td>{formatted_date}</td>
  <td class="max-w-xs truncate" title="{fc_name}">{fc_name}</td>
  <td class="max-w-xs truncate" title="{cc_name}">{cc_name}</td>
  <td>{article_name}</td>
  <td class="{article_color_class} font-bold">{formatted_amount}</td>
  <td class="max-w-xs truncate" title="{description}">{description_truncated}</td>
  <td class="text-xs whitespace-nowrap">{user_name}</td>
  <td class="text-xs text-base-content/50 whitespace-nowrap">{updated_at_formatted}</td>
  <td>
    <div class="flex gap-1">
      <button class="btn btn-xs btn-primary gap-1" onclick="{edit_onclick}">✏️</button>
      <button class="btn btn-xs btn-error btn-square hidden md:inline-flex" onclick="{delete_onclick}" title="Удалить">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  </td>
</tr>"""

        mobile_row = f"""
<div class="transaction-item py-2" {data_attr} onclick="{mobile_onclick}">
  <div class="flex items-center gap-2">
    {badge_html}
    <span class="flex-1 font-medium truncate">{article_name}</span>
    <span class="{article_color_class} font-bold whitespace-nowrap">{formatted_amount}</span>
  </div>
  <div class="text-xs text-base-content/60 mt-1 truncate">
    {short_date} • {fc_name} • {description}
  </div>
</div>"""
    else:
        # Plan branch — unchanged from prior implementation.
        data_attr = f'data-plan-id="{fact.id}"'
        edit_onclick = f"showEditModal({fact.id})"
        delete_onclick = f"event.stopPropagation(); deleteFact({fact.id})"
        mobile_onclick = f"showEditModal({fact.id})"
        badge_html = '<span class="badge badge-info badge-xs shrink-0">План</span>'
        checkbox_onchange = "window.PlanApp.FactsTable.updateBatchDeleteButton()"

        desktop_row = f"""
<tr {data_attr}>
  <td><input type="checkbox" class="checkbox checkbox-sm fact-checkbox" value="{fact.id}" onchange="{checkbox_onchange}"></td>
  <td><code class="badge badge-ghost">{fact.id}</code></td>
  <td>{formatted_date}</td>
  <td class="max-w-xs truncate" title="{fc_name}">{fc_name}</td>
  <td class="max-w-xs truncate" title="{cc_name}">{cc_name}</td>
  <td><span class="{article_color_class}">{article_name}</span></td>
  <td class="{article_color_class} font-bold">{formatted_amount}</td>
  <td class="max-w-xs truncate" title="{description}">{description_truncated}</td>
  <td>{user_name}</td>
  <td class="text-center">{reminder_icon}</td>
  <td class="text-center">{recurring_icon}</td>
  <td class="text-center">{offline_icon}</td>
  <td>
    <div class="flex gap-1">
      <button class="btn btn-xs btn-primary gap-1" onclick="{edit_onclick}">✏️</button>
      <button class="btn btn-xs btn-error btn-square hidden md:inline-flex" data-fact-id="{fact.id}" onclick="{delete_onclick}" title="Удалить">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  </td>
</tr>"""

        mobile_icons = " ".join(filter(None, [recurring_icon, reminder_icon, offline_icon]))
        mobile_row = f"""
<div class="transaction-item py-2" {data_attr} onclick="{mobile_onclick}">
  <div class="flex items-center gap-2">
    {badge_html}
    <span class="flex-1 font-medium truncate">{article_name}</span>
    <span class="{article_color_class} font-bold whitespace-nowrap">{formatted_amount}</span>
    {mobile_icons}
  </div>
  <div class="text-xs text-base-content/60 mt-1 truncate">
    {short_date} • {fc_name} • {description}
  </div>
</div>"""

    return f'<template data-plan-row="{fact.id}">{desktop_row}|||{mobile_row}</template>'
```

The `reminder_icon`, `recurring_icon`, `offline_icon` computations above this block stay — they are still used by the `plan` branch.

- [ ] **Step 5: Run tests to verify both pass**

Run: `cd tests && ./run-tests.sh backend -k test_facts_row_html`
Expected: PASS for both `test_row_html_fact_branch_matches_client` and `test_row_html_plan_branch_unchanged`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/endpoints/facts.py \
        tests/integration/backend/test_facts_row_html.py
git commit -m "fix(facts): align /row-html fact branch with client renderer"
```

---

## Task 3: Manual verification + E2E regression

- [ ] **Step 1: Build frontend bundles**

Run: `npm run type-check && npm run bundle`
Expected: zero errors, `facts.bundle.js` regenerated.

- [ ] **Step 2: Manual smoke — Bug 1**

1. Open `/facts` on desktop (≥1280px)
2. Note `#stat-total` value N
3. Delete one row, confirm dialog
4. Verify `#stat-total` shows exactly `N-1`
5. Refresh page → still `N-1`

- [ ] **Step 3: Manual smoke — Bug 2**

1. Create a new fact via the modal
2. Inspect new desktop row: count `<td>` (must be 11), ID has class `text-base-content/50 text-xs` (no `badge-ghost`), no reminder/recurring/offline columns, updated_at column populated
3. Resize to 375px, create another fact, inspect mobile card — matches existing cards (no icons row)
4. Refresh page — appearance unchanged

- [ ] **Step 4: Plan-page regression check**

Open `/plan`, create a plan row, verify the plan table still renders correctly (13 columns, badge-ghost ID, icon columns present).

- [ ] **Step 5: Run existing E2E facts CRUD suite**

Run: `npm run test:e2e -- tests/e2e/webapp` (or the facts-specific spec if isolated)
Expected: all passing.

- [ ] **Step 6: Bump VERSION and commit**

Edit `VERSION` — increment patch (e.g. `0.X.Y` → `0.X.(Y+1)`).

```bash
git add VERSION
git commit -m "chore: bump version for facts delete/row-html fixes"
```

---

## Self-Review

**Spec coverage:**
- Bug 1 root cause (race) — Task 1 Steps 3-4 move guard before await, rollback in catch ✓
- Bug 1 3s auto-expire — Task 1 Step 3 keeps timer, scheduled inside `deleteFact` after success ✓ (resolves spec finding F-001)
- Bug 1 set-management consolidated in `deleteFact` — Task 1 Step 4 removes from `removeRowFromTable` ✓
- Bug 2 drop reminder/recurring/offline columns — Task 2 Step 4 desktop block (3 columns removed) ✓
- Bug 2 add updated_at column — Task 2 Steps 3-4 ✓
- Bug 2 ID cell restyle — Task 2 Step 4 (plain `<td>` replaces `<code class="badge badge-ghost">`) ✓
- Bug 2 remove checkbox `onchange` — Task 2 Step 4 ✓
- Bug 2 mobile card no icons — Task 2 Step 4 mobile block ✓
- Plan branch unchanged — Task 2 Step 4 `else:` branch preserved verbatim, regression test in Step 1 ✓
- Verification items (1-5 in spec) — Task 3 ✓

**Placeholder scan:** none.

**Type/name consistency:** `statDecrementedIds`, `consumeStatDecrement`, `deleteFn`, `removeRowFromTable`, `_format_updated_at` referenced consistently. Mobile/desktop variables (`badge_html`, `data_attr`, etc.) defined in both branches before use.

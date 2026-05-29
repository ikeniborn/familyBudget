# Analytics — Dynamics chart filter & Waterfall opening balance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two bugs in `/analytics`: (1) "Динамика расходов и доходов" wrongly aggregates inter-account transfers (`credit`/`debit`) into income/expense, and (2) Waterfall opening balance is computed only from the previous calendar period instead of full cumulative history.

**Architecture:** Surgical SQL/service-layer fixes in two endpoints of `backend/app/api/v1/analytics.py`. Add two helper functions (`_query_period_split`, `_compute_initial_balance`) and one tiny extracted helper (`_normalize_period_key`). Reuse existing `t_agg_financial_center_balance_monthly` aggregate via `balance_aggregation_service.get_opening_balance` / `get_opening_balances_bulk`. Add `transfers_in` / `transfers_out` series to the Waterfall ECharts config in `analytics.html` with a 5-row tooltip.

**Tech Stack:** Python 3.12, FastAPI 0.121, SQLModel/SQLAlchemy, PostgreSQL 16, ECharts (vanilla JS in Jinja2 template), Vitest (frontend unit), Playwright (E2E), pytest-asyncio (backend integration).

**Spec:** `docs/superpowers/specs/2026-05-29-analytics-dynamics-waterfall-design.md`

---

## File Structure

**Create:**
- `backend/tests/test_analytics_trends_filter.py` — unit tests for `/trends` filter
- `backend/tests/test_analytics_waterfall_split.py` — unit tests for `/waterfall` 4-way split
- `backend/tests/test_compute_initial_balance.py` — unit tests for `_compute_initial_balance`
- `backend/tests/integration/test_analytics_endpoints_integration.py` — 3 scenario integration tests
- `frontend/tests/integration/components/charts/waterfall-tooltip.test.ts` — Vitest tooltip unit test
- `tests/e2e/webapp/test_analytics_waterfall.spec.ts` — Playwright E2E

**Modify:**
- `backend/app/api/v1/analytics.py` — imports, `/trends` (848-1087), `/waterfall` (1209-1538); add module-level helpers `_normalize_period_key`, `_query_period_split`, `_compute_initial_balance`; remove now-unused `get_previous_period` (line 284) since it becomes dead code after the swap
- `frontend/web/templates/analytics.html` — `updateWaterfallChart` (1480-1670): add 4 series-equivalent data + tooltip extension + mode handling
- `frontend/web/static/js/dashboard/types/analytics.d.ts` — add `WaterfallResponse` interface
- `VERSION` — patch bump `0.6.165` → `0.6.166`

**Don't touch:**
- `backend/app/services/balance_aggregation_service.py` — read-only usage
- Other analytics endpoints (`/quick-stats`, `/category-breakdown`, `/heatmap`)

---

## Task 1: Extract `_normalize_period_key` helper

**Why first:** Spec finding F-003 — helper referenced but not defined. Pre-extract from existing inline logic at `analytics.py:1311-1323` so later tasks can call it directly.

**Files:**
- Modify: `backend/app/api/v1/analytics.py` (add helper near top, before `@router.get` definitions — pick a location around line 280 next to `get_previous_period`)

- [ ] **Step 1: Add `_normalize_period_key` helper**

Add this function immediately after the existing `get_previous_period` definition (around line 282, before line 284 where `get_previous_period` begins — put `_normalize_period_key` right after `get_previous_period`'s body ends):

```python
def _normalize_period_key(period_key_raw):
    """Convert SQL date_trunc result (datetime/timestamp) to date object.

    Mirrors inline logic previously embedded in /waterfall.
    """
    if period_key_raw == 0 or period_key_raw is None:
        return 0
    if isinstance(period_key_raw, date) and not isinstance(period_key_raw, datetime):
        return period_key_raw
    return period_key_raw.date() if hasattr(period_key_raw, "date") else period_key_raw
```

- [ ] **Step 2: Replace inline conversion in `/waterfall` with helper call**

In `analytics.py`, replace lines 1311-1323 (the `period_key_raw` block inside the `for row in rows:` loop) with:

```python
        for row in rows:
            period_key = _normalize_period_key(row.period_key)
```

Leave the rest of the loop body untouched for now (it still uses the old `type_mapping`; Task 4 will rewrite the bucket aggregation).

- [ ] **Step 3: Type-check + smoke-run waterfall manually**

Run:
```bash
cd backend && python -c "from backend.app.api.v1.analytics import _normalize_period_key; from datetime import date, datetime; assert _normalize_period_key(date(2025,1,1)) == date(2025,1,1); assert _normalize_period_key(datetime(2025,1,1,12,0)) == date(2025,1,1); assert _normalize_period_key(0) == 0; assert _normalize_period_key(None) == 0; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/analytics.py
git commit -m "refactor(analytics): extract _normalize_period_key helper"
```

---

## Task 2: Fix `/trends` — exclude credit/debit at SQL layer

**Files:**
- Test: `backend/tests/test_analytics_trends_filter.py` (CREATE)
- Modify: `backend/app/api/v1/analytics.py:912-941`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_analytics_trends_filter.py`:

```python
"""Unit tests for /trends endpoint: credit/debit exclusion from income/expense."""
from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact

pytestmark = pytest.mark.asyncio


async def _seed_article(session: AsyncSession, *, name: str, type_: str) -> int:
    art = Article(code=name.upper(), name=name, type=type_, parent_id=None)
    session.add(art)
    await session.flush()
    return art.id


async def _seed_fact(session: AsyncSession, *, article_id: int, fc_id: int, amount: str, day: int) -> None:
    session.add(BudgetFact(
        article_id=article_id,
        financial_center_id=fc_id,
        fact_date=date(2025, 10, day),
        amount=Decimal(amount),
        record_type="fact",
    ))


async def test_trends_excludes_credit_from_income(
    auth_client: AsyncClient, session: AsyncSession, seeded_fc_id: int
):
    inc_id = await _seed_article(session, name="Salary", type_="income")
    cred_id = await _seed_article(session, name="Transfer in", type_="credit")
    await _seed_fact(session, article_id=inc_id, fc_id=seeded_fc_id, amount="50000", day=1)
    await _seed_fact(session, article_id=cred_id, fc_id=seeded_fc_id, amount="5000", day=2)
    await session.commit()

    r = await auth_client.get(
        "/api/v1/analytics/trends",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31", "record_type": "fact"},
    )
    assert r.status_code == 200
    data = r.json()
    assert sum(data["income"]) == 50000.0
    assert 5000.0 not in data["income"]


async def test_trends_excludes_debit_from_expense(
    auth_client: AsyncClient, session: AsyncSession, seeded_fc_id: int
):
    exp_id = await _seed_article(session, name="Food", type_="expense")
    deb_id = await _seed_article(session, name="Transfer out", type_="debit")
    await _seed_fact(session, article_id=exp_id, fc_id=seeded_fc_id, amount="10000", day=1)
    await _seed_fact(session, article_id=deb_id, fc_id=seeded_fc_id, amount="3000", day=2)
    await session.commit()

    r = await auth_client.get(
        "/api/v1/analytics/trends",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31", "record_type": "fact"},
    )
    assert r.status_code == 200
    data = r.json()
    assert sum(data["expense"]) == 10000.0
    assert 3000.0 not in data["expense"]


async def test_trends_only_real_income_expense_returned(
    auth_client: AsyncClient, session: AsyncSession, seeded_fc_id: int
):
    """Mixed transactions: only income+expense show in totals; transfers ignored."""
    inc_id = await _seed_article(session, name="Salary", type_="income")
    exp_id = await _seed_article(session, name="Food", type_="expense")
    cred_id = await _seed_article(session, name="Tr in", type_="credit")
    deb_id = await _seed_article(session, name="Tr out", type_="debit")
    for art_id, amount, day in [(inc_id, "50000", 1), (exp_id, "10000", 2),
                                  (cred_id, "5000", 3), (deb_id, "5000", 3)]:
        await _seed_fact(session, article_id=art_id, fc_id=seeded_fc_id, amount=amount, day=day)
    await session.commit()

    r = await auth_client.get(
        "/api/v1/analytics/trends",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31", "record_type": "fact"},
    )
    assert r.status_code == 200
    data = r.json()
    assert sum(data["income"]) == 50000.0
    assert sum(data["expense"]) == 10000.0


async def test_trends_cumulative_mode_unchanged(
    auth_client: AsyncClient, session: AsyncSession, seeded_fc_id: int
):
    inc_id = await _seed_article(session, name="Salary", type_="income")
    exp_id = await _seed_article(session, name="Food", type_="expense")
    await _seed_fact(session, article_id=inc_id, fc_id=seeded_fc_id, amount="100", day=1)
    await _seed_fact(session, article_id=exp_id, fc_id=seeded_fc_id, amount="40", day=2)
    await session.commit()

    r = await auth_client.get(
        "/api/v1/analytics/trends",
        params={
            "date_from": "2025-10-01", "date_to": "2025-10-03",
            "record_type": "fact", "chart_mode": "cumulative",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["chart_mode"] == "cumulative"
    assert data["income_period"] is not None
    # last cumulative point must equal sum of inputs
    assert data["income"][-1] == 100.0
    assert data["expense"][-1] == 40.0
```

> **Note:** Fixtures `auth_client`, `session`, `seeded_fc_id` are expected to exist in `backend/tests/conftest.py`. If `seeded_fc_id` is missing, inspect existing tests (e.g. `backend/tests/integration/test_fact_workflows.py`) and reuse whatever fixture provides an authenticated user with an active FC. If no such fixture exists, add one inline to this file that creates a `FinancialCenter` and returns its id.

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /home/ikeniborn/Documents/Project/familyBudget
cd tests && ./run-tests.sh backend backend/tests/test_analytics_trends_filter.py
```
Expected: assertion failures — current code maps `credit→income` and `debit→expense`, so totals include transfers.

- [ ] **Step 3: Apply the fix**

In `backend/app/api/v1/analytics.py`, replace lines 912-920 (the `query = select(...)` block in `/trends`) with:

```python
        query = select(
            Fact.fact_date,
            Article.type,
            func.sum(Fact.amount).label("total"),
        ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
            Fact.fact_date >= start_date,
            Fact.fact_date <= end_date,
            Fact.record_type == record_type,
            Article.type.in_(["income", "expense"]),
        )
```

Replace lines 932-941 (the `for row in rows:` mapping block) with:

```python
        data_by_date = {}
        for row in rows:
            if row.fact_date not in data_by_date:
                data_by_date[row.fact_date] = {"income": 0.0, "expense": 0.0}
            if row.type == "income":
                data_by_date[row.fact_date]["income"] += float(row.total)
            elif row.type == "expense":
                data_by_date[row.fact_date]["expense"] += float(row.total)
```

- [ ] **Step 4: Re-run tests — verify pass**

```bash
cd tests && ./run-tests.sh backend backend/tests/test_analytics_trends_filter.py
```
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/analytics.py backend/tests/test_analytics_trends_filter.py
git commit -m "fix(analytics): exclude credit/debit from /trends income+expense totals"
```

---

## Task 3: Add `_compute_initial_balance` helper

**Files:**
- Test: `backend/tests/test_compute_initial_balance.py` (CREATE)
- Modify: `backend/app/api/v1/analytics.py` (imports + new module-level helper)

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_compute_initial_balance.py`:

```python
"""Unit tests for analytics._compute_initial_balance."""
from datetime import date
from decimal import Decimal

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.api.v1.analytics import _compute_initial_balance
from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter

pytestmark = pytest.mark.asyncio


async def _make_fc(session, name="FC-test"):
    fc = FinancialCenter(name=name, code=name, is_active=True)
    session.add(fc)
    await session.flush()
    return fc


async def _add_fact(session, *, fc_id, article_id, day, month, year, amount):
    session.add(BudgetFact(
        financial_center_id=fc_id,
        article_id=article_id,
        fact_date=date(year, month, day),
        amount=Decimal(amount),
        record_type="fact",
    ))


async def _add_article(session, *, name, type_):
    art = Article(code=name, name=name, type=type_, parent_id=None)
    session.add(art)
    await session.flush()
    return art


async def test_initial_balance_uses_aggregate_when_aligned_to_month_start(session: AsyncSession):
    """When start_date.day == 1, balance == aggregate snapshot, no delta."""
    fc = await _make_fc(session)
    inc = await _add_article(session, name="salary", type_="income")
    await _add_fact(session, fc_id=fc.id, article_id=inc.id, day=10, month=9, year=2025, amount="100000")
    await session.commit()
    # Need aggregate refreshed for Sept 2025
    from backend.app.services.balance_aggregation_service import refresh_monthly_balances
    await refresh_monthly_balances(session, year=2025, month=9)

    result = await _compute_initial_balance(session, date(2025, 10, 1), cfo_id=fc.id)
    assert result == Decimal("100000.00")


async def test_initial_balance_uses_aggregate_plus_delta_when_mid_month(session: AsyncSession):
    fc = await _make_fc(session)
    inc = await _add_article(session, name="salary", type_="income")
    exp = await _add_article(session, name="food", type_="expense")
    # September: +100000
    await _add_fact(session, fc_id=fc.id, article_id=inc.id, day=10, month=9, year=2025, amount="100000")
    # October 1-14: -5000 expense + 2000 income
    await _add_fact(session, fc_id=fc.id, article_id=exp.id, day=3, month=10, year=2025, amount="5000")
    await _add_fact(session, fc_id=fc.id, article_id=inc.id, day=8, month=10, year=2025, amount="2000")
    # October 15+: should NOT be counted
    await _add_fact(session, fc_id=fc.id, article_id=exp.id, day=20, month=10, year=2025, amount="99999")
    await session.commit()
    from backend.app.services.balance_aggregation_service import refresh_monthly_balances
    await refresh_monthly_balances(session, year=2025, month=9)

    result = await _compute_initial_balance(session, date(2025, 10, 15), cfo_id=fc.id)
    # 100000 + 2000 - 5000 = 97000
    assert result == Decimal("97000.00")


async def test_initial_balance_sums_across_active_fcs_when_no_cfo_id(session: AsyncSession):
    fc1 = await _make_fc(session, "FC-1")
    fc2 = await _make_fc(session, "FC-2")
    inc = await _add_article(session, name="salary", type_="income")
    await _add_fact(session, fc_id=fc1.id, article_id=inc.id, day=10, month=9, year=2025, amount="50000")
    await _add_fact(session, fc_id=fc2.id, article_id=inc.id, day=10, month=9, year=2025, amount="30000")
    await session.commit()
    from backend.app.services.balance_aggregation_service import refresh_monthly_balances
    await refresh_monthly_balances(session, year=2025, month=9)

    result = await _compute_initial_balance(session, date(2025, 10, 1), cfo_id=None)
    assert result == Decimal("80000.00")


async def test_initial_balance_per_cfo_when_cfo_id_set(session: AsyncSession):
    fc1 = await _make_fc(session, "FC-1")
    fc2 = await _make_fc(session, "FC-2")
    inc = await _add_article(session, name="salary", type_="income")
    await _add_fact(session, fc_id=fc1.id, article_id=inc.id, day=10, month=9, year=2025, amount="50000")
    await _add_fact(session, fc_id=fc2.id, article_id=inc.id, day=10, month=9, year=2025, amount="30000")
    await session.commit()
    from backend.app.services.balance_aggregation_service import refresh_monthly_balances
    await refresh_monthly_balances(session, year=2025, month=9)

    result = await _compute_initial_balance(session, date(2025, 10, 1), cfo_id=fc1.id)
    assert result == Decimal("50000.00")


async def test_initial_balance_fallback_to_full_scan_when_aggregate_missing(session: AsyncSession):
    """No aggregate row → get_opening_balances_bulk falls back to full scan."""
    fc = await _make_fc(session)
    inc = await _add_article(session, name="salary", type_="income")
    await _add_fact(session, fc_id=fc.id, article_id=inc.id, day=10, month=9, year=2025, amount="100000")
    await session.commit()
    # Intentionally DO NOT call refresh_monthly_balances

    result = await _compute_initial_balance(session, date(2025, 10, 1), cfo_id=fc.id)
    assert result == Decimal("100000.00")


async def test_initial_balance_zero_when_no_transactions(session: AsyncSession):
    fc = await _make_fc(session)
    await session.commit()

    result = await _compute_initial_balance(session, date(2025, 10, 1), cfo_id=fc.id)
    assert result == Decimal("0.00")


async def test_initial_balance_january_uses_december_prev_year(session: AsyncSession):
    fc = await _make_fc(session)
    inc = await _add_article(session, name="salary", type_="income")
    await _add_fact(session, fc_id=fc.id, article_id=inc.id, day=15, month=12, year=2024, amount="77000")
    await session.commit()
    from backend.app.services.balance_aggregation_service import refresh_monthly_balances
    await refresh_monthly_balances(session, year=2024, month=12)

    result = await _compute_initial_balance(session, date(2025, 1, 1), cfo_id=fc.id)
    assert result == Decimal("77000.00")
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd tests && ./run-tests.sh backend backend/tests/test_compute_initial_balance.py
```
Expected: `ImportError: cannot import name '_compute_initial_balance'`.

- [ ] **Step 3: Add imports**

In `backend/app/api/v1/analytics.py`, update the import block (lines 6-15). Replace line 9 with:

```python
from datetime import date, datetime, timedelta
from decimal import Decimal
```

Add this import next to other service imports (after line 29):

```python
from backend.app.services.balance_aggregation_service import (
    get_opening_balance,
    get_opening_balances_bulk,
)
```

- [ ] **Step 4: Add `_compute_initial_balance` helper**

In `backend/app/api/v1/analytics.py`, add this module-level async function right after `_normalize_period_key` (from Task 1):

```python
async def _compute_initial_balance(
    session: AsyncSession,
    start_date: date,
    cfo_id: int | None,
) -> Decimal:
    """Cumulative balance at end of (start_date - 1).

    - Pulls closing snapshot of previous month from t_agg_financial_center_balance_monthly
      via balance_aggregation_service (built-in fallback to full-scan if missing).
    - If start_date is mid-month, adds delta for the partial current month.
    - Snapshot semantics: aggregate INCLUDES credit/debit (real account balance).
    """
    if start_date.month == 1:
        prev_year, prev_month = start_date.year - 1, 12
    else:
        prev_year, prev_month = start_date.year, start_date.month - 1
    # get_opening_balance(year=Y, month=M) returns closing(Y, M-1); so to get closing(prev_year, prev_month)
    # we pass next month (year, month) after (prev_year, prev_month).
    if prev_month == 12:
        next_year, next_month = prev_year + 1, 1
    else:
        next_year, next_month = prev_year, prev_month + 1

    if cfo_id is not None:
        snapshot = await get_opening_balance(
            session, financial_center_id=cfo_id,
            year=next_year, month=next_month,
        )
    else:
        balances = await get_opening_balances_bulk(
            session, year=next_year, month=next_month,
        )
        snapshot = sum(balances.values(), Decimal("0.00"))

    if start_date.day == 1:
        return snapshot

    delta_start = date(start_date.year, start_date.month, 1)
    delta_end = start_date - timedelta(days=1)

    delta_query = select(
        func.sum(case(
            (Article.type.in_(["income", "credit"]), Fact.amount), else_=0,
        ))
        - func.sum(case(
            (Article.type.in_(["expense", "debit"]), Fact.amount), else_=0,
        ))
    ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
        Fact.fact_date >= delta_start,
        Fact.fact_date <= delta_end,
        Fact.record_type == "fact",
    )
    if cfo_id is not None:
        delta_query = delta_query.where(Fact.financial_center_id == cfo_id)

    delta_result = await session.execute(delta_query)
    delta = delta_result.scalar() or Decimal("0.00")
    return snapshot + Decimal(str(delta))
```

- [ ] **Step 5: Re-run tests — verify pass**

```bash
cd tests && ./run-tests.sh backend backend/tests/test_compute_initial_balance.py
```
Expected: all 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/analytics.py backend/tests/test_compute_initial_balance.py
git commit -m "feat(analytics): add _compute_initial_balance helper using aggregate snapshot"
```

---

## Task 4: Add `_query_period_split` helper

**Files:**
- Modify: `backend/app/api/v1/analytics.py` (add module-level helper)

> No standalone test — covered indirectly by Task 5 waterfall tests. Keeping this as a separate task to keep the helper diff small and committable on its own.

- [ ] **Step 1: Add helper**

Add this async function in `backend/app/api/v1/analytics.py` right after `_compute_initial_balance`:

```python
async def _query_period_split(
    session: AsyncSession,
    start_date: date,
    end_date: date,
    group_by_expr,
    cfo_id: int | None,
    article_id: int | None,
):
    """Return rows grouped by (period_key, Article.type, Article.id, Article.name) for fact records only.

    Does NOT filter by Article.type — caller buckets income / expense / credit / debit downstream.
    """
    query = select(
        group_by_expr.label("period_key"),
        Article.type,
        Article.id.label("article_id"),
        Article.name.label("article_name"),
        func.sum(Fact.amount).label("total"),
    ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
        Fact.fact_date >= start_date,
        Fact.fact_date <= end_date,
        Fact.record_type == "fact",
    )
    if cfo_id is not None:
        query = query.where(Fact.financial_center_id == cfo_id)
    if article_id is not None:
        query = query.where(Article.id == article_id)
    query = query.group_by(group_by_expr, Article.type, Article.id, Article.name).order_by(group_by_expr)
    return (await session.execute(query)).all()
```

- [ ] **Step 2: Import sanity check**

Run:
```bash
cd /home/ikeniborn/Documents/Project/familyBudget && python -c "from backend.app.api.v1.analytics import _query_period_split; print(_query_period_split)"
```
Expected: prints the function reference; no import errors.

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/analytics.py
git commit -m "feat(analytics): add _query_period_split helper"
```

---

## Task 5: Rewrite `/waterfall` — 4-way split, use new helpers, new response fields

**Files:**
- Test: `backend/tests/test_analytics_waterfall_split.py` (CREATE)
- Modify: `backend/app/api/v1/analytics.py:1209-1538`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_analytics_waterfall_split.py`:

```python
"""Unit tests for /waterfall: 4-way bucket split (income/expense/transfers_in/transfers_out)."""
from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter

pytestmark = pytest.mark.asyncio


async def _seed(session, *, fc_name, art_name, art_type, amount, day, month=10, year=2025):
    fc = FinancialCenter(name=fc_name, code=fc_name, is_active=True)
    session.add(fc)
    await session.flush()
    art = Article(code=art_name, name=art_name, type=art_type, parent_id=None)
    session.add(art)
    await session.flush()
    session.add(BudgetFact(
        financial_center_id=fc.id, article_id=art.id,
        fact_date=date(year, month, day), amount=Decimal(amount), record_type="fact",
    ))
    return fc, art


async def test_waterfall_returns_transfers_in_out_arrays(
    auth_client: AsyncClient, session: AsyncSession
):
    await _seed(session, fc_name="FC-A", art_name="cred", art_type="credit", amount="500", day=5)
    await session.commit()
    r = await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "transfers_in" in data and isinstance(data["transfers_in"], list)
    assert "transfers_out" in data and isinstance(data["transfers_out"], list)
    assert sum(data["transfers_in"]) == 500.0


async def test_waterfall_income_excludes_credit(
    auth_client: AsyncClient, session: AsyncSession
):
    await _seed(session, fc_name="FC-B", art_name="salary", art_type="income", amount="50000", day=1)
    await _seed(session, fc_name="FC-C", art_name="cred", art_type="credit", amount="500", day=2)
    await session.commit()
    r = await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31"},
    )
    data = r.json()
    assert sum(data["income"]) == 50000.0
    assert 500.0 not in data["income"]


async def test_waterfall_expense_excludes_debit(
    auth_client: AsyncClient, session: AsyncSession
):
    await _seed(session, fc_name="FC-D", art_name="food", art_type="expense", amount="10000", day=1)
    await _seed(session, fc_name="FC-E", art_name="deb", art_type="debit", amount="300", day=2)
    await session.commit()
    r = await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31"},
    )
    data = r.json()
    assert sum(data["expense"]) == 10000.0
    assert 300.0 not in data["expense"]


async def test_waterfall_balance_includes_transfers(
    auth_client: AsyncClient, session: AsyncSession
):
    """balance per period = initial + income - expense + transfers_in - transfers_out."""
    await _seed(session, fc_name="FC-F", art_name="salary", art_type="income", amount="50000", day=1)
    await _seed(session, fc_name="FC-G", art_name="cred", art_type="credit", amount="500", day=1)
    await _seed(session, fc_name="FC-H", art_name="deb", art_type="debit", amount="500", day=1)
    await session.commit()
    r = await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-02"},
    )
    data = r.json()
    # transfers net = 0; income = 50000; balance ends at 50000 (+ any prior history)
    assert data["balance"][-1] - data["initial_balance"] == 50000.0


async def test_waterfall_drilldown_article_id_unchanged(
    auth_client: AsyncClient, session: AsyncSession
):
    _, art = await _seed(session, fc_name="FC-I", art_name="salary", art_type="income", amount="50000", day=1)
    await session.commit()
    r = await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31", "article_id": art.id},
    )
    data = r.json()
    assert data["article_id"] == art.id
    assert data["article_name"] is not None
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd tests && ./run-tests.sh backend backend/tests/test_analytics_waterfall_split.py
```
Expected: failures — current `/waterfall` does not return `transfers_in` / `transfers_out` keys and maps `credit→income` / `debit→expense`.

- [ ] **Step 3: Rewrite `/waterfall` body**

In `backend/app/api/v1/analytics.py`:

(a) Replace lines 1280-1305 (the inline `query = select(...)` build through `result = await session.execute(query); rows = result.all()`) with a single helper call:

```python
        rows = await _query_period_split(
            session=session,
            start_date=start_date,
            end_date=end_date,
            group_by_expr=group_by_expr,
            cfo_id=cfo_id,
            article_id=article_id,
        )
```

(b) Replace the existing `for row in rows:` block (after Task 1 it currently looks like `for row in rows: period_key = _normalize_period_key(row.period_key); ...`) with the 4-way bucket logic:

```python
        period_data: dict = {}
        articles_info: dict = {}
        for row in rows:
            period_key = _normalize_period_key(row.period_key)
            bucket = period_data.setdefault(period_key, {
                "income": 0.0,
                "expense": 0.0,
                "transfers_in": 0.0,
                "transfers_out": 0.0,
                "articles": [],
            })
            amount = float(row.total)
            if row.type == "income":
                bucket["income"] += amount
            elif row.type == "expense":
                bucket["expense"] += amount
            elif row.type == "credit":
                bucket["transfers_in"] += amount
            elif row.type == "debit":
                bucket["transfers_out"] += amount

            if article_id is None:
                articles_info[row.article_id] = row.article_name
                bucket["articles"].append({
                    "id": row.article_id,
                    "name": row.article_name,
                    "type": row.type,
                    "amount": amount,
                })
```

(c) Replace lines 1350-1383 (the `get_previous_period` call + entire `initial_balance_query = select(...)` block + `initial_balance = float(...)`) with:

```python
        initial_balance_decimal = await _compute_initial_balance(session, start_date, cfo_id)
        initial_balance = float(initial_balance_decimal)
```

(d) Add `transfers_in_data` / `transfers_out_data` lists alongside `income_data` / `expense_data`. Find the block (after Task 1 changes, around line 1385-1392) that initializes:
```python
        labels = []
        income_data = []
        expense_data = []
        balance_data = []
        categories_data = []
        cumulative_balance = initial_balance
```
and change it to:
```python
        labels = []
        income_data = []
        expense_data = []
        transfers_in_data = []
        transfers_out_data = []
        balance_data = []
        categories_data = []
        cumulative_balance = initial_balance
```

(e) In each of the four `if label_format ==` branches (day / week / month / else), update the per-bucket extraction. For the `"day"` branch, replace its inner block (around lines 1404-1424) with:

```python
            current_date = start_date
            while current_date <= end_date:
                if crosses_month:
                    day_label = f"{current_date.day} {month_names_short[current_date.month - 1]}"
                else:
                    day_label = str(current_date.day)

                day_info = period_data.get(current_date, {
                    "income": 0.0, "expense": 0.0,
                    "transfers_in": 0.0, "transfers_out": 0.0, "articles": [],
                })
                income = day_info["income"]
                expense = day_info["expense"]
                t_in = day_info["transfers_in"]
                t_out = day_info["transfers_out"]
                cumulative_balance += income - expense + t_in - t_out

                labels.append(day_label)
                income_data.append(income)
                expense_data.append(expense)
                transfers_in_data.append(t_in)
                transfers_out_data.append(t_out)
                balance_data.append(cumulative_balance)
                categories_data.append(day_info.get("articles", []))

                current_date += timedelta(days=1)
```

For the `"week"` branch (around lines 1432-1455), replace its inner block with:

```python
            week_start = start_date - timedelta(days=start_date.weekday())
            while week_start <= end_date:
                week_data = period_data.get(week_start, {
                    "income": 0.0, "expense": 0.0,
                    "transfers_in": 0.0, "transfers_out": 0.0, "articles": [],
                })
                week_income = week_data["income"]
                week_expense = week_data["expense"]
                week_t_in = week_data["transfers_in"]
                week_t_out = week_data["transfers_out"]
                week_articles = week_data.get("articles", [])

                cumulative_balance += week_income - week_expense + week_t_in - week_t_out

                iso_label = get_iso_week_number(week_start)

                labels.append(iso_label)
                income_data.append(week_income)
                expense_data.append(week_expense)
                transfers_in_data.append(week_t_in)
                transfers_out_data.append(week_t_out)
                balance_data.append(cumulative_balance)
                categories_data.append(week_articles)

                week_start += timedelta(days=7)
```

For the `"month"` branch (around lines 1465-1489), replace its inner block with:

```python
            current_date = date(start_date.year, start_date.month, 1)
            while current_date <= end_date:
                month_data = period_data.get(current_date, {
                    "income": 0.0, "expense": 0.0,
                    "transfers_in": 0.0, "transfers_out": 0.0, "articles": [],
                })
                month_income = month_data["income"]
                month_expense = month_data["expense"]
                month_t_in = month_data["transfers_in"]
                month_t_out = month_data["transfers_out"]

                cumulative_balance += month_income - month_expense + month_t_in - month_t_out

                month_label = f"{month_names_ru[current_date.month - 1]} {current_date.year}"
                labels.append(month_label)
                income_data.append(month_income)
                expense_data.append(month_expense)
                transfers_in_data.append(month_t_in)
                transfers_out_data.append(month_t_out)
                balance_data.append(cumulative_balance)
                categories_data.append(month_data.get("articles", []))

                if current_date.month == 12:
                    current_date = date(current_date.year + 1, 1, 1)
                else:
                    current_date = date(current_date.year, current_date.month + 1, 1)
```

For the trailing `else` branch (around lines 1492-1507), replace with:

```python
            current_date = start_date
            while current_date <= end_date:
                period_info = period_data.get(current_date, {
                    "income": 0.0, "expense": 0.0,
                    "transfers_in": 0.0, "transfers_out": 0.0, "articles": [],
                })
                income = period_info["income"]
                expense = period_info["expense"]
                t_in = period_info["transfers_in"]
                t_out = period_info["transfers_out"]
                cumulative_balance += income - expense + t_in - t_out

                labels.append(current_date.strftime("%d.%m"))
                income_data.append(income)
                expense_data.append(expense)
                transfers_in_data.append(t_in)
                transfers_out_data.append(t_out)
                balance_data.append(cumulative_balance)
                categories_data.append(period_info.get("articles", []))

                current_date += timedelta(days=1)
```

(f) Update the success-path return (around line 1510-1521):

```python
        result = {
            "labels": labels,
            "income": income_data,
            "expense": expense_data,
            "transfers_in": transfers_in_data,
            "transfers_out": transfers_out_data,
            "balance": balance_data,
            "categories": categories_data,
            "initial_balance": initial_balance,
            "period": period,
            "year": today.year,
            "article_id": article_id,
            "article_name": articles_info.get(article_id) if article_id else None,
        }
        return result
```

(g) Update the error-path return (around line 1527-1538):

```python
    except Exception as e:
        logger.error("Error in /waterfall: %s", str(e), exc_info=True)
        return {
            "labels": [],
            "income": [],
            "expense": [],
            "transfers_in": [],
            "transfers_out": [],
            "balance": [],
            "categories": [],
            "initial_balance": 0.0,
            "period": period or "month",
            "year": date.today().year,
            "article_id": article_id,
            "article_name": None,
        }
```

(h) Delete `get_previous_period` function (line 284 — entire `def get_previous_period(start_date: date, ...): ...` definition). This becomes dead code after the swap (verified: no other callers in the repo).

- [ ] **Step 4: Re-run tests — verify pass**

```bash
cd tests && ./run-tests.sh backend backend/tests/test_analytics_waterfall_split.py
```
Expected: all 5 tests PASS.

- [ ] **Step 5: Run full backend suite to catch regressions**

```bash
cd tests && ./run-tests.sh backend
```
Expected: all tests PASS. If `test_admin_analytics.py` or any other existing test breaks, the regression is in the helpers — fix before continuing.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/analytics.py backend/tests/test_analytics_waterfall_split.py
git commit -m "fix(analytics): /waterfall 4-way split + correct opening balance via aggregate"
```

---

## Task 6: Integration tests — 3 end-to-end scenarios

**Files:**
- Test: `backend/tests/integration/test_analytics_endpoints_integration.py` (CREATE)

- [ ] **Step 1: Write integration tests**

Create `backend/tests/integration/test_analytics_endpoints_integration.py`:

```python
"""Integration tests for /trends + /waterfall: real DB, full request cycle, 3 scenarios."""
from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.services.balance_aggregation_service import refresh_monthly_balances

pytestmark = pytest.mark.asyncio


async def _seed_minimal(session, *, fcs: list[str]) -> dict[str, int]:
    """Create FCs + 4 articles (income/expense/credit/debit). Return fc_name -> fc.id."""
    fc_ids = {}
    for name in fcs:
        fc = FinancialCenter(name=name, code=name, is_active=True)
        session.add(fc)
        await session.flush()
        fc_ids[name] = fc.id

    for art_name, t in [("salary", "income"), ("food", "expense"),
                        ("cred", "credit"), ("deb", "debit")]:
        art = Article(code=art_name, name=art_name, type=t, parent_id=None)
        session.add(art)
    await session.flush()
    return fc_ids


async def _fact(session, *, fc_id, art_name, amount, day, month=10, year=2025):
    from sqlmodel import select as _select
    stmt = _select(Article).where(Article.name == art_name)
    art = (await session.execute(stmt)).scalar_one()
    session.add(BudgetFact(
        financial_center_id=fc_id, article_id=art.id,
        fact_date=date(year, month, day), amount=Decimal(amount), record_type="fact",
    ))


async def test_scenario_1_family_without_transfers(auth_client: AsyncClient, session: AsyncSession):
    fc_ids = await _seed_minimal(session, fcs=["FC-1"])
    await _fact(session, fc_id=fc_ids["FC-1"], art_name="salary", amount="50000", day=5)
    await _fact(session, fc_id=fc_ids["FC-1"], art_name="food", amount="10000", day=10)
    await session.commit()

    trends = (await auth_client.get(
        "/api/v1/analytics/trends",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31"},
    )).json()
    assert sum(trends["income"]) == 50000.0
    assert sum(trends["expense"]) == 10000.0

    wf = (await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31"},
    )).json()
    assert sum(wf["transfers_in"]) == 0.0
    assert sum(wf["transfers_out"]) == 0.0
    # balance end - initial == net period flow
    assert round(wf["balance"][-1] - wf["initial_balance"], 2) == 40000.0


async def test_scenario_2_family_with_inter_account_transfer(auth_client: AsyncClient, session: AsyncSession):
    fc_ids = await _seed_minimal(session, fcs=["FC-1", "FC-2"])
    await _fact(session, fc_id=fc_ids["FC-1"], art_name="salary", amount="50000", day=5)
    # Transfer FC-1 -> FC-2 of 5000
    await _fact(session, fc_id=fc_ids["FC-1"], art_name="deb", amount="5000", day=10)
    await _fact(session, fc_id=fc_ids["FC-2"], art_name="cred", amount="5000", day=10)
    await session.commit()

    trends = (await auth_client.get(
        "/api/v1/analytics/trends",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31"},
    )).json()
    assert sum(trends["income"]) == 50000.0
    assert sum(trends["expense"]) == 0.0  # transfer excluded

    wf_all = (await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31"},
    )).json()
    assert sum(wf_all["income"]) == 50000.0
    assert sum(wf_all["expense"]) == 0.0
    assert sum(wf_all["transfers_in"]) == 5000.0
    assert sum(wf_all["transfers_out"]) == 5000.0
    # transfers net = 0 → period change is 50000
    assert round(wf_all["balance"][-1] - wf_all["initial_balance"], 2) == 50000.0

    wf_fc1 = (await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31", "cfo_id": fc_ids["FC-1"]},
    )).json()
    # FC-1: +50000 income, -5000 debit => net 45000
    assert round(wf_fc1["balance"][-1] - wf_fc1["initial_balance"], 2) == 45000.0

    wf_fc2 = (await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31", "cfo_id": fc_ids["FC-2"]},
    )).json()
    # FC-2: +5000 credit only
    assert round(wf_fc2["balance"][-1] - wf_fc2["initial_balance"], 2) == 5000.0


async def test_scenario_3_custom_range_mid_month_start(auth_client: AsyncClient, session: AsyncSession):
    fc_ids = await _seed_minimal(session, fcs=["FC-1"])
    # September: 100000 income
    await _fact(session, fc_id=fc_ids["FC-1"], art_name="salary", amount="100000", day=10, month=9)
    # October 1-14: 2000 income, 5000 expense
    await _fact(session, fc_id=fc_ids["FC-1"], art_name="salary", amount="2000", day=8, month=10)
    await _fact(session, fc_id=fc_ids["FC-1"], art_name="food", amount="5000", day=12, month=10)
    # October 15+: 3000 income (inside requested range)
    await _fact(session, fc_id=fc_ids["FC-1"], art_name="salary", amount="3000", day=20, month=10)
    await session.commit()
    await refresh_monthly_balances(session, year=2025, month=9)

    wf = (await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-15", "date_to": "2025-10-31", "cfo_id": fc_ids["FC-1"]},
    )).json()
    # initial = closing(Sep) + delta(Oct 1-14)
    #         = 100000 + (2000 - 5000) = 97000
    assert wf["initial_balance"] == 97000.0
    # Period: only the 3000 on Oct 20
    assert sum(wf["income"]) == 3000.0
    assert round(wf["balance"][-1], 2) == 100000.0
```

- [ ] **Step 2: Run integration tests**

```bash
cd tests && ./run-tests.sh backend backend/tests/integration/test_analytics_endpoints_integration.py
```
Expected: all 3 scenarios PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/integration/test_analytics_endpoints_integration.py
git commit -m "test(analytics): add 3-scenario integration coverage for /trends + /waterfall"
```

---

## Task 7: Frontend — TypeScript types

**Files:**
- Modify: `frontend/web/static/js/dashboard/types/analytics.d.ts`

- [ ] **Step 1: Add `WaterfallResponse` interface**

Append to `frontend/web/static/js/dashboard/types/analytics.d.ts`:

```typescript
export interface WaterfallArticle {
  id: number;
  name: string;
  type: 'income' | 'expense' | 'credit' | 'debit';
  amount: number;
}

export interface WaterfallResponse {
  labels: string[];
  income: number[];
  expense: number[];
  transfers_in: number[];
  transfers_out: number[];
  balance: number[];
  categories: WaterfallArticle[][];
  initial_balance: number;
  period: 'month' | 'quarter' | 'year';
  year: number;
  article_id: number | null;
  article_name: string | null;
}
```

- [ ] **Step 2: Type-check**

```bash
cd /home/ikeniborn/Documents/Project/familyBudget && npm run type-check
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/web/static/js/dashboard/types/analytics.d.ts
git commit -m "feat(types): add WaterfallResponse interface"
```

---

## Task 8: Frontend — Waterfall chart 4-way bars + tooltip + mode handling

**Files:**
- Modify: `frontend/web/templates/analytics.html` — `updateWaterfallChart` (lines 1480-1670)

> Existing implementation uses a single `data: waterfallData` bar series with per-bar colors. To keep the change surgical, we extend the existing per-bar value construction so each period bar represents `income - expense + transfers_in - transfers_out`, and extend the tooltip to show the 5 rows. We **also** add two extra ECharts bar series (`Пополнение`, `Списание`) that render alongside on a separate stack so transfers are visually distinguishable per the spec.

- [ ] **Step 1: Read current `updateWaterfallChart`**

Open `frontend/web/templates/analytics.html` and confirm lines 1480-1670 still match the structure used here.

- [ ] **Step 2: Extend net calculation + add transfer arrays**

Inside `updateWaterfallChart`, after the line `const initialBalance = data.initial_balance || 0;` (~line 1505), add:

```js
    const transfersIn = data.transfers_in ?? [];
    const transfersOut = data.transfers_out ?? [];
```

Replace **both** occurrences (in the `with_balance` branch and the `without_balance` branch) of:

```js
            const net = income - expense;
```

with:

```js
            const tIn = transfersIn[index] ?? 0;
            const tOut = transfersOut[index] ?? 0;
            const net = income - expense + tIn - tOut;
```

- [ ] **Step 3: Add separate transfers series**

Replace the `series: [ { name: 'Waterfall', ... } ]` block (lines 1651-1667) with:

```js
        series: [
            {
                name: 'Waterfall',
                type: 'bar',
                stack: 'main',
                data: waterfallData,
                label: { show: false },
                emphasis: {
                    focus: 'series',
                    itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }
                }
            },
            ...(currentWaterfallMode === 'with_balance' ? [
                {
                    name: 'Пополнение',
                    type: 'bar',
                    stack: 'flow',
                    data: currentWaterfallMode === 'with_balance'
                        ? [0, ...transfersIn, 0]
                        : transfersIn,
                    itemStyle: { color: '#60a5fa' }
                },
                {
                    name: 'Списание',
                    type: 'bar',
                    stack: 'flow',
                    data: currentWaterfallMode === 'with_balance'
                        ? [0, ...transfersOut.map(x => -x), 0]
                        : transfersOut.map(x => -x),
                    itemStyle: { color: '#fbbf24' }
                }
            ] : [])
        ]
```

> The `[0, ...transfersIn, 0]` padding aligns transfer bars with the `Начало` + periods + `Итого` labels used in `with_balance` mode.

- [ ] **Step 4: Extend tooltip — show 5 rows**

In the tooltip `formatter` function, in the `with_balance` branch, replace the block that builds `tooltip` for "Regular period data" (lines ~1582-1602) with:

```js
                    const dataIndex = labelIndex - 1;
                    const label = data.labels[dataIndex];
                    const income = data.income[dataIndex];
                    const expense = data.expense[dataIndex];
                    const tIn = (data.transfers_in ?? [])[dataIndex] ?? 0;
                    const tOut = (data.transfers_out ?? [])[dataIndex] ?? 0;
                    const net = income - expense + tIn - tOut;
                    const cumulative = data.balance[dataIndex];

                    let tooltip = `<strong>${label}</strong><br/>`;
                    tooltip += `Доходы: ${income.toFixed(2)} ₽<br/>`;
                    tooltip += `Расходы: ${expense.toFixed(2)} ₽<br/>`;
                    tooltip += `Пополнение: ${tIn.toFixed(2)} ₽<br/>`;
                    tooltip += `Списание: ${tOut.toFixed(2)} ₽<br/>`;
                    tooltip += `<hr style="margin: 5px 0"/>`;
                    tooltip += `Чистый поток: <span style="color: ${net >= 0 ? '#4CAF50' : '#f44336'}">${net.toFixed(2)} ₽</span><br/>`;
                    tooltip += `Накопительный итог: ${cumulative.toFixed(2)} ₽`;

                    if (!data.article_id && waterfallCategoriesData[dataIndex]?.length > 0) {
                        tooltip += `<br/><br/><em style="color: #999; font-size: 11px;">Нажмите для детализации по категории</em>`;
                    }

                    return tooltip;
```

In the `without_balance` branch, replace the analogous block (lines ~1604-1623) with:

```js
                    const dataIndex = labelIndex;
                    const label = data.labels[dataIndex];
                    const income = data.income[dataIndex];
                    const expense = data.expense[dataIndex];
                    const tIn = (data.transfers_in ?? [])[dataIndex] ?? 0;
                    const tOut = (data.transfers_out ?? [])[dataIndex] ?? 0;
                    const net = income - expense + tIn - tOut;

                    let tooltip = `<strong>${label}</strong><br/>`;
                    tooltip += `Доходы: ${income.toFixed(2)} ₽<br/>`;
                    tooltip += `Расходы: ${expense.toFixed(2)} ₽<br/>`;
                    tooltip += `Пополнение: ${tIn.toFixed(2)} ₽<br/>`;
                    tooltip += `Списание: ${tOut.toFixed(2)} ₽<br/>`;
                    tooltip += `<hr style="margin: 5px 0"/>`;
                    tooltip += `Чистый поток: <span style="color: ${net >= 0 ? '#4CAF50' : '#f44336'}">${net.toFixed(2)} ₽</span>`;

                    if (!data.article_id && waterfallCategoriesData[dataIndex]?.length > 0) {
                        tooltip += `<br/><br/><em style="color: #999; font-size: 11px;">Нажмите для детализации по категории</em>`;
                    }

                    return tooltip;
```

- [ ] **Step 5: Type-check**

```bash
npm run type-check
```
Expected: 0 errors.

- [ ] **Step 6: Build + verify in browser**

```bash
npm run build
```

Then start the dev backend (`./run-test-server.sh` or equivalent) and open `/analytics`. Verify:
- "💧 Каскадная диаграмма" renders with 3 series in the legend: `Waterfall`, `Пополнение`, `Списание` (`with_balance` mode).
- Hover a period bar → tooltip shows 5 rows (Доходы, Расходы, Пополнение, Списание, Чистый поток + Накопительный итог).
- Toggle `Без баланса` → transfer bars + start/end columns disappear.
- Resize browser to 375 / 768 / 1280 — chart renders cleanly at each.

- [ ] **Step 7: Commit**

```bash
git add frontend/web/templates/analytics.html
git commit -m "feat(analytics): waterfall transfers_in/out bars + 5-row tooltip"
```

---

## Task 9: Frontend — Vitest tooltip unit test

**Files:**
- Test: `frontend/tests/integration/components/charts/waterfall-tooltip.test.ts` (CREATE)

- [ ] **Step 1: Write tooltip test**

Create the file:

```typescript
import { describe, it, expect } from 'vitest';

/**
 * Snapshot of the tooltip formatter from analytics.html.
 * Keep this in sync if the inline formatter is edited.
 */
function formatTooltipWithBalance(params: { dataIndex: number }, data: {
    labels: string[]; income: number[]; expense: number[];
    transfers_in: number[]; transfers_out: number[];
    balance: number[]; initial_balance: number; article_id: number | null;
}): string {
    const labelIndex = params.dataIndex;
    const labelsLen = data.labels.length + 2; // 'Начало' + periods + 'Итого'
    if (labelIndex === 0) {
        return `<strong>Начало</strong><br/>Начальный баланс: ${data.initial_balance.toFixed(2)} ₽`;
    }
    if (labelIndex === labelsLen - 1) {
        const finalBalance = data.balance[data.balance.length - 1];
        return `<strong>Итого</strong><br/>Конечный баланс: ${finalBalance.toFixed(2)} ₽`;
    }
    const i = labelIndex - 1;
    const tIn = data.transfers_in[i] ?? 0;
    const tOut = data.transfers_out[i] ?? 0;
    const net = data.income[i] - data.expense[i] + tIn - tOut;
    return `<strong>${data.labels[i]}</strong><br/>`
         + `Доходы: ${data.income[i].toFixed(2)} ₽<br/>`
         + `Расходы: ${data.expense[i].toFixed(2)} ₽<br/>`
         + `Пополнение: ${tIn.toFixed(2)} ₽<br/>`
         + `Списание: ${tOut.toFixed(2)} ₽<br/>`
         + `<hr style="margin: 5px 0"/>`
         + `Чистый поток: <span style="color: ${net >= 0 ? '#4CAF50' : '#f44336'}">${net.toFixed(2)} ₽</span><br/>`
         + `Накопительный итог: ${data.balance[i].toFixed(2)} ₽`;
}

describe('Waterfall tooltip', () => {
    const data = {
        labels: ['Окт'],
        income: [50000],
        expense: [10000],
        transfers_in: [3000],
        transfers_out: [1000],
        balance: [42000],
        initial_balance: 0,
        article_id: null,
    };

    it('renders 5 rows for period bar (with_balance mode)', () => {
        const html = formatTooltipWithBalance({ dataIndex: 1 }, data);
        expect(html).toContain('Доходы: 50000.00');
        expect(html).toContain('Расходы: 10000.00');
        expect(html).toContain('Пополнение: 3000.00');
        expect(html).toContain('Списание: 1000.00');
        expect(html).toContain('Накопительный итог: 42000.00');
    });

    it('computes net = income - expense + transfers_in - transfers_out', () => {
        const html = formatTooltipWithBalance({ dataIndex: 1 }, data);
        // 50000 - 10000 + 3000 - 1000 = 42000
        expect(html).toContain('Чистый поток: <span style="color: #4CAF50">42000.00 ₽</span>');
    });

    it('renders start label at dataIndex 0', () => {
        expect(formatTooltipWithBalance({ dataIndex: 0 }, data))
            .toContain('Начальный баланс: 0.00');
    });

    it('renders total label at last index', () => {
        expect(formatTooltipWithBalance({ dataIndex: 2 }, data))
            .toContain('Конечный баланс: 42000.00');
    });
});
```

- [ ] **Step 2: Run vitest**

```bash
npm run test:coverage -- frontend/tests/integration/components/charts/waterfall-tooltip.test.ts
```
Expected: 4/4 pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/integration/components/charts/waterfall-tooltip.test.ts
git commit -m "test(waterfall): vitest unit test for 5-row tooltip"
```

---

## Task 10: Frontend — Playwright E2E

**Files:**
- Test: `tests/e2e/webapp/test_analytics_waterfall.spec.ts` (CREATE)

- [ ] **Step 1: Write E2E test**

Create the file:

```typescript
/**
 * E2E: /analytics page — Waterfall chart shows transfers series in legend.
 *
 * Auth: storage state from global setup.
 */
import { test, expect } from '@playwright/test';

const VIEWPORTS = {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1280, height: 800 },
};

async function navigateToAnalytics(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('/analytics');
    await page.waitForLoadState('domcontentloaded');
    const cookieBtn = page.locator('button:has-text("Принять все")');
    if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cookieBtn.click();
        await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
}

test.describe('Analytics Waterfall - transfers series', () => {
    test('legend contains Пополнение and Списание (with_balance mode)', async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.desktop);
        await navigateToAnalytics(page);

        // Wait for waterfall chart to be initialized (ECharts injects canvas)
        const chart = page.locator('#chart-waterfall canvas').first();
        await chart.waitFor({ state: 'visible', timeout: 10000 });

        // Read legend names via ECharts instance
        const legendNames: string[] = await page.evaluate(() => {
            const dom = document.getElementById('chart-waterfall');
            // @ts-expect-error global echarts
            const inst = window.echarts.getInstanceByDom(dom);
            const opt = inst.getOption();
            return (opt.series || []).map((s: { name: string }) => s.name);
        });

        expect(legendNames).toContain('Пополнение');
        expect(legendNames).toContain('Списание');
    });

    test('without_balance mode hides transfer series', async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.desktop);
        await navigateToAnalytics(page);

        // Wait for chart, then click toggle
        await page.locator('#chart-waterfall canvas').first().waitFor({ state: 'visible' });
        await page.locator('#waterfall-mode-without-balance').click();
        // Give ECharts a moment to re-render
        await page.waitForTimeout(500);

        const legendNames: string[] = await page.evaluate(() => {
            const dom = document.getElementById('chart-waterfall');
            // @ts-expect-error global echarts
            const inst = window.echarts.getInstanceByDom(dom);
            const opt = inst.getOption();
            return (opt.series || []).map((s: { name: string }) => s.name);
        });

        expect(legendNames).not.toContain('Пополнение');
        expect(legendNames).not.toContain('Списание');
    });

    test('renders at mobile breakpoint', async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.mobile);
        await navigateToAnalytics(page);
        await expect(page.locator('#chart-waterfall canvas').first()).toBeVisible({ timeout: 10000 });
    });

    test('renders at tablet breakpoint', async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.tablet);
        await navigateToAnalytics(page);
        await expect(page.locator('#chart-waterfall canvas').first()).toBeVisible({ timeout: 10000 });
    });
});
```

- [ ] **Step 2: Run E2E**

```bash
npm run test:e2e -- test_analytics_waterfall
```
Expected: 4/4 pass. (If FC/articles are empty for the test user, the chart may render the empty state and `series` may be missing — in that case, seed minimal data first via a pre-test API call, mirroring the seeding pattern in other E2E specs.)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/webapp/test_analytics_waterfall.spec.ts
git commit -m "test(e2e): waterfall transfer series legend + responsive"
```

---

## Task 11: VERSION bump + deploy

- [ ] **Step 1: Bump VERSION**

Edit `VERSION` — change `0.6.165` to `0.6.166`.

```bash
echo "0.6.166" > VERSION
```

- [ ] **Step 2: Commit**

Pre-commit hook syncs `package.json` / `package-lock.json`.

```bash
git add VERSION package.json package-lock.json
git commit -m "chore: bump version to 0.6.166"
```

- [ ] **Step 3: Push and open PR `dev/analytics-dynamics-waterfall-fix` → `test`**

```bash
git push -u origin dev/analytics-dynamics-waterfall-fix
gh pr create --base test --title "fix(analytics): dynamics filter + waterfall opening balance" --body "$(cat <<'EOF'
## Summary
- `/trends`: filter out `credit`/`debit` at SQL layer so transfers no longer inflate income/expense
- `/waterfall`: split into 4 buckets (income / expense / transfers_in / transfers_out), correct opening balance using `t_agg_financial_center_balance_monthly` aggregate snapshot + intra-month delta
- New helpers: `_normalize_period_key`, `_query_period_split`, `_compute_initial_balance`
- Frontend: new ECharts series for `Пополнение`/`Списание`, 5-row tooltip, mode toggle handling

## Test plan
- [ ] `cd tests && ./run-tests.sh backend` — all unit + integration green
- [ ] `npm run type-check` — 0 errors
- [ ] `npm run test:coverage` — vitest waterfall-tooltip green
- [ ] `npm run test:e2e -- test_analytics_waterfall` — 4 specs green
- [ ] Manual: open `https://fbd.ikeniborn.ru/analytics`, reconcile across 2 FCs (sum facts manually excluding credit/debit vs `/trends`; sum income−expense+credit−debit up to `start_date−1` vs `/waterfall.initial_balance`)
- [ ] Responsive check: 375 / 768 / 1280
- [ ] Mode toggle `with_balance` ↔ `without_balance`
- [ ] Drill-down by category preserves article data

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: After PR merged into `test`, deploy on test server**

```bash
ssh budget-test
cd /opt/budget
./deploy.sh
```

- [ ] **Step 5: Post-deploy verification on `fbd.ikeniborn.ru`**

Per spec "Done-when" criteria + addressing findings F-001 / F-002:

1. Open `/analytics`. Measure page load time in DevTools Network panel — record value. Compare against any prior baseline (if available locally; otherwise record this run as the new baseline). Confirm no visible regression vs. current `/analytics` behavior (F-001).
2. Trigger one aggregate refresh manually via existing admin endpoint, confirm `t_agg_financial_center_balance_monthly` rows update (F-002). Confirm daily scheduler log entry for `refresh_monthly_balances` next morning.
3. Manual reconciliation across ≥ 2 FCs:
   - Sum facts manually excluding `credit`/`debit` → compare with `/trends` chart.
   - Compute `sum(income) - sum(expense) + sum(credit) - sum(debit)` up to `start_date - 1` → compare with `/waterfall.initial_balance`.
4. Responsive check at 375 / 768 / 1280.
5. Mode toggle `with_balance` / `without_balance` and category drill-down work.

---

## Self-Review

**1. Spec coverage:**
- ✅ `/trends` SQL filter + Python mapping — Task 2
- ✅ `_query_period_split` helper — Task 4
- ✅ `_compute_initial_balance` helper — Task 3
- ✅ `_normalize_period_key` helper (F-003 finding) — Task 1
- ✅ Bucket aggregation 4-way — Task 5
- ✅ Per-bucket cumulative balance — Task 5 step (e)
- ✅ Waterfall response shape (`transfers_in`, `transfers_out`, others preserved) — Task 5 steps (f) + (g)
- ✅ Frontend ECharts series + colors + stack — Task 8
- ✅ Frontend tooltip 5 rows — Task 8 step 4
- ✅ Frontend mode handling (`with_balance` shows transfers + balance; `without_balance` hides them) — Task 8 step 3
- ✅ Frontend graceful degradation (`?? []`) — Task 8 steps 2/4
- ✅ TypeScript `WaterfallResponse` — Task 7
- ✅ Backend unit tests (3 files matching spec test names) — Tasks 2, 3, 5
- ✅ Backend integration scenarios 1/2/3 — Task 6
- ✅ Vitest tooltip — Task 9
- ✅ Playwright E2E legend + responsive — Task 10
- ✅ Deploy via `dev/* → test` branch + VERSION bump — Task 11
- ✅ Findings F-001 (load time check) + F-002 (aggregate refresh verify) — Task 11 step 5
- ✅ Snapshot semantics note (aggregate includes credit/debit) — embedded in Task 3 helper docstring
- ✅ `article_id` filter NOT applied to initial balance — confirmed: `_compute_initial_balance` signature has no `article_id` param

**2. Placeholder scan:** No `TBD`, no "add appropriate error handling", every code change is shown verbatim with file paths + line ranges. Test code is complete.

**3. Type / name consistency:**
- `_normalize_period_key` — used in Task 1 step 2 + Task 5 step 3(b) ✅
- `_query_period_split` — defined Task 4 step 1, called Task 5 step 3(a) with named kwargs matching signature ✅
- `_compute_initial_balance` — defined Task 3 step 4 with `(session, start_date, cfo_id)`, called Task 5 step 3(c) with `(session, start_date, cfo_id)` ✅
- Response field names (`transfers_in`, `transfers_out`) — match across backend (Task 5 (f)+(g)), TypeScript (Task 7), frontend (Task 8), tests (Tasks 5+6) ✅
- `get_previous_period` removal — Task 5 step 3(h), verified grep shows only the one caller at line 1352 ✅

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-29-analytics-dynamics-waterfall-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

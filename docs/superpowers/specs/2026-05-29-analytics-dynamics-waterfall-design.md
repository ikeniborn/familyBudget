# Design: Analytics — Dynamics chart filter & Waterfall opening balance

**Date:** 2026-05-29
**Status:** draft
**Intent:** [docs/superpowers/intents/2026-05-29-analytics-dynamics-waterfall-intent.md](../intents/2026-05-29-analytics-dynamics-waterfall-intent.md)

## Summary

Fix two issues on `/analytics`:

1. **"Динамика расходов и доходов"** chart incorrectly aggregates inter-account transfers (`credit`/пополнение, `debit`/списание) into income/expense, inflating both totals and distorting the picture of real spending/earning.
2. **Waterfall chart** opening balance ("остаток на начало") is computed from the previous calendar period's transactions only, not as the cumulative balance up to the start date. Result is wrong by many months of history.

Approach: surgical SQL/service-layer fixes in two endpoints, reuse existing `t_agg_financial_center_balance_monthly` aggregate, add separate "transfers" series to waterfall.

## Scope

**In scope:**
- `backend/app/api/v1/analytics.py` — `/trends` (line 848) and `/waterfall` (line 1209) endpoints.
- `frontend/web/templates/analytics.html` — ECharts waterfall config (series + tooltip).
- Unit + integration tests (backend), Vitest + E2E test coverage (frontend).

**Out of scope:**
- Schema changes to `t_agg_financial_center_balance_monthly` (no new columns).
- Refactoring other analytics endpoints (`/quick-stats`, `/category-breakdown`, `/heatmap`, etc.).
- Changes to `balance_aggregation_service.py` (used as-is).
- Backfill migration (rely on existing daily scheduler + in-service fallback to full-scan).

## Architecture

Locations of changes:

```
backend/app/api/v1/analytics.py
  ├── trends endpoint (line 848-1087)        SQL filter: Article.type IN ('income','expense')
  └── waterfall endpoint (line 1209-1538)    Split queries + use aggregate
       ├── new helper: _query_period_split      real income / real expense / transfers
       └── new helper: _compute_initial_balance aggregate snapshot + delta query

backend/app/services/balance_aggregation_service.py
  (no changes — reuse get_opening_balance + get_opening_balances_bulk)

frontend/web/templates/analytics.html
  └── ECharts datasets: + transfers_in series + transfers_out series + tooltip extension
```

Waterfall data flow:

```
Request (period | date_from/to, cfo_id, article_id)
  │
  ├─► _compute_initial_balance(start_date, cfo_id)
  │     ├── start_date.day == 1  → get_opening_balances_bulk(prev month) → sum
  │     └── start_date.day != 1  → bulk(prev month) + delta query (1 → start_date-1)
  │     (cfo_id set → use get_opening_balance per FC)
  │
  ├─► _query_period_split(start, end, cfo_id, article_id)
  │     Returns rows grouped by (period_key, Article.type, article_id, article_name)
  │
  └─► Bucket aggregation in Python:
        income       += amount when type == 'income'
        expense      += amount when type == 'expense'
        transfers_in += amount when type == 'credit'
        transfers_out+= amount when type == 'debit'

      For each bucket i:
        cumulative_balance += income[i] - expense[i] + transfers_in[i] - transfers_out[i]
        balance[i] = cumulative_balance
```

## Backend changes

### `/trends` (Динамика)

**Filter at SQL layer.** Change the base query (`analytics.py:912-920`):

```python
query = select(
    Fact.fact_date,
    Article.type,
    func.sum(Fact.amount).label("total"),
).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
    Fact.fact_date >= start_date,
    Fact.fact_date <= end_date,
    Fact.record_type == record_type,
    Article.type.in_(["income", "expense"]),   # exclude credit/debit
)
```

Update the in-Python mapping block (`analytics.py:932-941`) to drop credit/debit branches:

```python
for row in rows:
    if row.fact_date not in data_by_date:
        data_by_date[row.fact_date] = {"income": 0.0, "expense": 0.0}
    if row.type == "income":
        data_by_date[row.fact_date]["income"] += float(row.total)
    elif row.type == "expense":
        data_by_date[row.fact_date]["expense"] += float(row.total)
```

Response shape unchanged. Cumulative mode logic unchanged.

### `/waterfall` (Каскадная)

**Step 1 — `_query_period_split` helper.** Single SQL query returns rows grouped by type:

```python
async def _query_period_split(
    session: AsyncSession,
    start_date: date,
    end_date: date,
    group_by_expr,
    cfo_id: int | None,
    article_id: int | None,
):
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
    return (await session.execute(
        query.group_by(group_by_expr, Article.type, Article.id, Article.name)
             .order_by(group_by_expr)
    )).all()
```

**Step 2 — bucket aggregation.** Replace existing single income/expense aggregation with 4-way split:

```python
period_data: dict = {}
for row in rows:
    # Existing logic from analytics.py:1311-1323 — converts date_trunc() result to date
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

**Step 3 — cumulative balance.** Per-bucket update includes transfers:

```python
cumulative_balance = float(initial_balance)
for i in range(len(labels)):
    period_net = (
        income_data[i] - expense_data[i]
        + transfers_in_data[i] - transfers_out_data[i]
    )
    cumulative_balance += period_net
    balance_data.append(cumulative_balance)
```

### `_compute_initial_balance` helper

Replaces broken `initial_balance_query` block (`analytics.py:1352-1383`).

```python
async def _compute_initial_balance(
    session: AsyncSession,
    start_date: date,
    cfo_id: int | None,
) -> Decimal:
    """Cumulative balance at end of (start_date - 1)."""
    if start_date.month == 1:
        prev_year, prev_month = start_date.year - 1, 12
    else:
        prev_year, prev_month = start_date.year, start_date.month - 1
    # Next-month indices for the bulk helper (it returns closing of (year, month) - 1)
    next_year = prev_year if prev_month < 12 else prev_year + 1
    next_month = prev_month + 1 if prev_month < 12 else 1

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

    # Mid-month: add delta for partial current month
    delta_start = date(start_date.year, start_date.month, 1)
    delta_end = start_date - timedelta(days=1)

    delta_query = select(
        func.sum(case(
            (Article.type.in_(["income", "credit"]), Fact.amount), else_=0
        ))
        - func.sum(case(
            (Article.type.in_(["expense", "debit"]), Fact.amount), else_=0
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

Notes:
- Snapshot INCLUDES credit/debit (per Q1 decision: aggregate represents real account balance).
- Delta query INCLUDES credit/debit (consistent with aggregate semantics).
- `article_id` filter is NOT applied to initial balance — opening balance of an account is independent of category drill-down.
- Built-in fallback to full-scan inside `get_opening_balances_bulk` handles missing aggregate rows transparently.

### Waterfall response shape

```python
{
    "labels": [...],
    "income": [...],            # real only (excludes credit/debit)
    "expense": [...],           # real only (excludes credit/debit)
    "transfers_in": [...],      # NEW: пополнение per period
    "transfers_out": [...],     # NEW: списание per period
    "balance": [...],           # cumulative (income - expense + transfers_in - transfers_out)
    "categories": [...],        # drill-down articles (unchanged, includes all types)
    "initial_balance": float,   # corrected via aggregate
    "period": str,
    "year": int,
    "article_id": int | None,
    "article_name": str | None,
}
```

Backward compatibility: `income`/`expense`/`balance` keys preserved (values change — that's the fix). New keys ignored by old clients.

## Frontend changes

Waterfall ECharts inline in `frontend/web/templates/analytics.html`. Existing mode toggle `with_balance`/`without_balance`.

**Add series:**

```js
{
    name: 'Пополнение',
    type: 'bar',
    stack: 'flow',
    data: data.transfers_in ?? [],
    itemStyle: { color: '#60a5fa' },  // neutral blue, distinct from income green
},
{
    name: 'Списание',
    type: 'bar',
    stack: 'flow',
    data: (data.transfers_out ?? []).map(x => -x),
    itemStyle: { color: '#fbbf24' },  // neutral amber, distinct from expense red
},
```

- Stack `flow` separates transfers from income/expense visually.
- Colors deliberately neutral (not green/red) to distinguish from real income/expense.

**Tooltip formatter:** show 5 rows — Доход / Расход / Пополнение / Списание / Остаток.

**Mode handling:**
- `with_balance` (default): all 5 series visible.
- `without_balance`: hide transfers + balance line (consistent with hiding cumulative info).

**Drill-down (`article_id`):** existing logic unchanged. Articles list contains all 4 types; UI shows what's relevant.

**Graceful degradation:** if `transfers_in`/`transfers_out` missing in response (deploy lag), default to `[]` — chart renders without new series.

**TypeScript:** update `frontend/web/static/js/dashboard/types/analytics.d.ts` if it declares waterfall response shape.

**Responsive testing:** mobile (375), tablet (768), desktop (1280) per project guideline.

## Error handling

**Backend:**
- `_compute_initial_balance`: pure-numeric fallback (`Decimal("0.00")`). Built-in fallback inside `get_opening_balances_bulk` (full-scan) handles missing aggregate rows. No raises.
- `_query_period_split`: SQL exceptions caught by existing top-level `try/except` in waterfall endpoint. Empty response gains new fields: `transfers_in: []`, `transfers_out: []`.
- Logging: existing `logger.error("Error in /waterfall: %s", ...)` preserved. No new debug logs.

**Frontend:**
- `data.transfers_in ?? []` / `data.transfers_out ?? []` — graceful default to empty arrays.

**Not doing:**
- No validation for impossible scenarios.
- No retry / circuit-breaker (read-only endpoint).
- No try/except wrap around `get_opening_balances_bulk` (its internal fallback already covers edge cases).

## Testing

**Backend unit tests** (`backend/tests/`):

```
test_analytics_trends_filter.py
  - test_trends_excludes_credit_from_income
  - test_trends_excludes_debit_from_expense
  - test_trends_only_real_income_expense_returned
  - test_trends_cumulative_mode_unchanged

test_analytics_waterfall_split.py
  - test_waterfall_returns_transfers_in_out_arrays
  - test_waterfall_income_excludes_credit
  - test_waterfall_expense_excludes_debit
  - test_waterfall_balance_includes_transfers
  - test_waterfall_drilldown_article_id_unchanged

test_compute_initial_balance.py
  - test_initial_balance_uses_aggregate_when_aligned_to_month_start
  - test_initial_balance_uses_aggregate_plus_delta_when_mid_month
  - test_initial_balance_sums_across_active_fcs_when_no_cfo_id
  - test_initial_balance_per_cfo_when_cfo_id_set
  - test_initial_balance_fallback_to_full_scan_when_aggregate_missing
  - test_initial_balance_zero_when_no_transactions
  - test_initial_balance_january_uses_december_prev_year
```

**Backend integration tests** (`backend/tests/integration/`):

```
test_analytics_endpoints_integration.py
  scenario_1: Family without transfers
    - 1 income 50000 + 1 expense 10000
    - /trends → income=[50000], expense=[10000]
    - /waterfall → balance=[40000], transfers_in=[0], transfers_out=[0]

  scenario_2: Family with inter-account transfer
    - income 50000 on FC#1
    - transfer: debit 5000 on FC#1 + credit 5000 on FC#2
    - /trends → income=[50000], expense=[0] (transfers excluded)
    - /waterfall (cfo_id=None):
        income=[50000], expense=[0],
        transfers_in=[5000], transfers_out=[5000],
        balance=[50000]  # transfers net = 0
    - /waterfall (cfo_id=1) → balance=[45000] (after debit 5000)
    - /waterfall (cfo_id=2) → balance=[5000] (credit only)

  scenario_3: Custom range, mid-month start
    - Transactions across Sep + Oct
    - /waterfall date_from=2025-10-15:
        initial_balance == closing(Sep) + delta(Oct 1-14)
    - Manual cumulative recount matches UI
```

**Frontend tests**:
- Vitest unit: tooltip formatter renders `transfers_in`/`transfers_out` rows.
- Playwright E2E: open `/analytics`, verify "Пополнение" and "Списание" series exist in the waterfall legend.

## Deploy

Per project rules:

1. Branch `dev/analytics-dynamics-waterfall-fix` from `test`.
2. PR → `test` branch (never `prod`).
3. Pre-commit hook validates type-check + console.log.
4. Bump `VERSION` patch (pre-commit syncs `package.json`).
5. CI/CD builds and pushes Docker images, updates `IMAGE_VERSIONS.json`.
6. Manual deploy on test server: `ssh budget-test` → `cd /opt/budget` → `./deploy.sh`.
7. No data migration step — relies on existing scheduler refresh + on-demand fallback inside `get_opening_balances_bulk`.

**Post-deploy verification (Done-when criteria from intent doc):**

- Open `/analytics` on `fbd.ikeniborn.ru`.
- Manual reconciliation across at least 2 financial centers:
  - Sum transactions manually excluding credit/debit → compare with `/trends` chart.
  - Compute opening balance manually (sum income - sum expense + sum credit - sum debit up to start_date - 1) → compare with `/waterfall` `initial_balance`.
- Responsive check: 375px, 768px, 1280px breakpoints.
- Mode toggle: `with_balance` / `without_balance`.
- Drill-down by category preserves expected article-level data.

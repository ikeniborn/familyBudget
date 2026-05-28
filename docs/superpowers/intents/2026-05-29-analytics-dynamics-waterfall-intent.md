# Intent: Analytics — Dynamics chart filter & Waterfall opening balance

**Date:** 2026-05-29
**Status:** approved

## Objective

The `/analytics` page distorts financial analytics:

1. Chart "Динамика расходов и доходов" includes inter-account transfers (`списание` as expense, `пополнение` as income), inflating both totals and breaking the picture of real spending/earning.
2. Waterfall chart shows an incorrect opening balance per account.

Fix now to restore trust in analytics numbers used for budgeting decisions.

## Desired Outcomes

- "Динамика" chart: expense/income sums match manual recount over transactions **excluding** `списание` / `пополнение` types.
- Waterfall: "остаток на начало" per account equals the value derivable from `public.t_agg_financial_center_balance_monthly` for the corresponding month.
- Manual recount vs UI diverges by 0.

## Health Metrics

- `/analytics` page load time does not regress.
- Other widgets on the page (categories, trends) remain correct — type filter does not leak into unrelated views.
- `t_agg_financial_center_balance_monthly` aggregate refresh (triggers/jobs on transaction insert/update/delete) continues to work.
- Analytics API endpoint stays backward-compatible for bot/mobile consumers.

## Strategic Context

- Interacts with: `frontend/web/templates/analytics.html` + analytics JS bundle, analytics API endpoint (`backend/app/api/v1/endpoints/`), statistics service (`backend/app/services/`), `t_agg_financial_center_balance_monthly` table + its refresh triggers/jobs, Transaction model (`transfer_in`/`transfer_out` types).
- Priority trade-off: **trust in numbers > UI speed**.

## Constraints

### Steering (behavioral guidance)

- Reuse `t_agg_financial_center_balance_monthly` — do not introduce parallel aggregate tables.
- Extending the table with extra precomputed aggregates for fast access is allowed (preferred over on-the-fly computation).
- Type filtering happens at SQL / service layer, not in frontend.
- Follow existing FastAPI + Pydantic endpoint pattern.
- `opening_balance` may be derived as previous month's `closing_balance`, or stored as an explicit column for clarity — both acceptable.

### Hard (architectural enforcement)

- Schema changes go through Alembic migration.
- No breaking changes to analytics API response shape.
- Never delete Docker volumes.
- Deploy only via CI/CD after VERSION bump.
- Branch from `dev/*`, PR into `test` (not `prod`).

## Autonomy Zones

- **Full autonomy** (reversible, low risk): frontend code, JS bundles, SQL/service-layer type filters.
- **Guarded** (log + confidence threshold): adding `opening_balance` column to `t_agg_financial_center_balance_monthly` via Alembic; backfill of historical values.
- **Proposal-first** (needs approval): analytics endpoint response shape changes; modifications to aggregate refresh triggers/jobs.
- **No autonomy** (human only): production deploy; deletion/truncate of `t_agg_financial_center_balance_monthly` data.

## Stop Rules

- **Halt if:** Alembic migration fails on dev DB; `opening_balance` per account diverges from manual recount.
- **Escalate if:** `/analytics` performance regresses >2×; aggregate refresh triggers/jobs break.
- **Done when:** "Динамика" chart excludes `списание`/`пополнение`; Waterfall chart uses `opening_balance` from `t_agg_financial_center_balance_monthly`; manual reconciliation across at least 2 accounts matches UI.

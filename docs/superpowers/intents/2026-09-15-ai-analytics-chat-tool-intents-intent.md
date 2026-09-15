---
result_check:
  verdict: OK
  intent_hash: 963e17497ad9616e
  last_run: 2026-09-15
review:
  intent_hash: 963e17497ad9616e
  last_run: 2026-09-15
  phases:
    structure: passed
    completeness: passed
    clarity: passed
    consistency: passed
    alignment: passed
  findings: []
---
# Intent: ai-analytics-chat-tool-intents

**Date:** 2026-09-15
**Status:** approved

## Objective

The analytics chat answers only one question shape — totals + top categories for a
single continuous period — because the scope model extracts nothing but a period,
a category filter, and fact/plan. Comparisons («больше, чем в прошлом месяце?»),
monthly dynamics, and plan-vs-fact are unanswerable. Approved slice 2 (P2) of the
ai-analytics-query-grounding analysis: the scope model additionally selects an
**intent (tool)** and the backend computes the matching aggregate itself.
Discovery verdict: reuse of `analytics.py` endpoint code rejected (chart-shaped
responses, swallowed exceptions, service→API layering inversion) — the intents are
small dedicated queries in `ai_analytics_service` next to `_aggregate`.

## Desired Outcomes

- The scope-extraction prompt asks the model to classify the question into one of
  `totals | compare_periods | trend_monthly | plan_vs_fact` (default `totals`);
  the scope JSON carries `intent` and, for comparisons, a second period.
- «Сколько потратили по сравнению с прошлым месяцем?» yields two backend-computed
  period aggregates plus deltas, and the answer names both periods and the change.
- «Как менялись расходы по месяцам?» yields a backend-computed per-month
  income/expense series over the asked range.
- «Уложились ли в план?» yields backend-computed plan and fact aggregates over
  calendar-month-snapped bounds with per-category execution percentages, and the
  payload flags that facts run only through today while the plan covers the full
  period.
- An unknown or missing intent falls back to `totals` — existing questions keep
  working unchanged.
- Every intent's exchange is persisted in the existing `t_f_ai_chat_log` with the
  intent recorded in `scope`, without KeyError on intents that lack a given field.
- Chat aggregates count only `income`/`expense` articles (consistent with
  `/trends`), so the listed categories always reconcile with the totals.

## Health Metrics

- Grounding invariant intact: the LLM never queries the database (scenarios
  `answer-analytics-question-from-backend-aggregates` and
  `persist-analytics-chat-history` keep passing).
- All existing tests in `tests/integration/backend/test_ai_analytics_chat.py`
  keep passing; `AnalyticsChatResponse` shape unchanged (frontend untouched).
- No extra LLM calls: still exactly two per question.
- The 1100-day range guard applies to every period the model supplies.

## Strategic Context

- Interacts with: `ai_analytics_service` (all changes), `ai.py` endpoint (scope
  logging keys), `t_f_budget_fact` (fact and plan rows share the table,
  discriminated by `record_type`), scope/answer prompts, integration tests.
- Priority trade-off: trust (honest, reconciling numbers) over speed.

## Constraints

### Steering (behavioral guidance)

- New aggregates follow the `_aggregate` pattern: small dedicated SQLModel
  queries in the service, no imports from `api.v1.analytics`.
- Sequential queries on the shared request session (no `asyncio.gather` on one
  `AsyncSession`).
- Keep the answer prompt additions short and per-intent.

### Hard (architectural enforcement)

- The LLM must never query or mutate the database; no invented figures.
- No schema migration: the existing `t_f_ai_chat_log.scope` JSON absorbs the
  intent field.
- `AnalyticsChatResponse` keeps its exact current fields (UI badge contract).
- Delivery via CI/CD: bump `VERSION` one patch step; PR targets `test`; branch
  `dev/ai-analytics-chat-tool-intents` stacks on `dev/ai-analytics-chat-history`.
- Specification mode strict: the new routing behavior gets a valid GWT scenario.

## Autonomy Zones

- Full autonomy (reversible, low risk): prompt wording, payload field names,
  intent sanitization defaults, test structure.
- Guarded (log + confidence threshold): the income/expense-only filter on chat
  aggregates (behavior change — documented in wiki and commit).
- Proposal-first (needs approval): P3 dialog context, P4 synonym dictionary,
  new intents beyond the four listed, changing the response schema.
- No autonomy (human only): deploy to production.

> These zones OVERRIDE subagent-driven-development's "continuous execution,
> don't pause" default. Any task touching proposal-first / no-go decisions
> is marked HUMAN CHECKPOINT in the plan.

## Stop Rules

- Halt if: an intent cannot be grounded without letting the model see raw
  transactions, or requires weakening the no-invented-figures rules.
- Escalate if: scope grows into dialog context (P3) or synonym dictionaries (P4).
- Done when: integration tests cover all four intents plus the unknown-intent
  fallback and pass; existing tests stay green; a comparison, a trend, and a
  plan-vs-fact question produce grounded payloads observable in the second model
  call; `VERSION` bumped; PR opened.

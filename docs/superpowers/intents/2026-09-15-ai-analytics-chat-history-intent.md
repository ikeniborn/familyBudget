---
result_check:
  verdict: OK
  intent_hash: 15dea42f576f6bf6
  last_run: 2026-09-15
review:
  intent_hash: 15dea42f576f6bf6
  last_run: 2026-09-15
  phases:
    structure: passed
    completeness: passed
    clarity: passed
    consistency: passed
    alignment: passed
  findings:
    - id: F-001
      phase: clarity
      severity: WARNING
      section: Desired Outcomes
      section_hash: 8a6be1bf40b15e94
      fragment: "Scope call requests `response_format={\"type\": \"json_object\"}`."
      text: "Outcome is technical (call payload state) rather than user-facing; observable in the provider request, acceptable for a prompt-hardening slice."
      fix: "Optionally rephrase as the user-facing effect (fewer 422 «Не понял» on valid questions)."
      verdict: accepted
      verdict_at: 2026-09-15
---
# Intent: ai-analytics-chat-history

**Date:** 2026-09-15
**Status:** approved

## Objective

The analytics-page AI chat answers miss data semantics (category descriptions are
dropped from the scope prompt, no truncation/zero-data rules in the answer prompt,
scope JSON relies on heuristics instead of JSON mode), and there is no server-side
query history — users cannot see past questions and answers anywhere except a
5-entry localStorage replay on one device. Approved slice 1 of the
ai-analytics-query-grounding analysis (task page
`reference/tasks/ai-analytics-query-grounding`): P1 grounding fixes + server-side
history. P2–P5 (intent/tool aggregates, dialog context, synonym dictionary,
extended tests) are recorded as future slices and require separate approval.

## Desired Outcomes

- Scope-extraction prompt carries category descriptions and usage frequency
  (reuses `format_candidate_lines`), so questions naming a category by meaning
  («продукты», «коммуналка» when described) resolve to the right articles.
- Scope call requests `response_format={"type": "json_object"}`.
- Answer prompt instructs the model how to report truncated breakdowns
  (top-15 shown, totals may exceed the listed sum) and empty periods (say
  plainly that no data exists — no invented figures).
- Every analytics-chat exchange (question, resolved scope, answer, status,
  latency) is persisted in a new `t_f_ai_chat_log` table via Alembic migration.
- `GET /api/v1/ai/analytics-chat/history` returns the recent exchanges.
- The analytics page shows a visible query history (server-backed), replacing
  the localStorage-only replay.

## Health Metrics

- Grounding invariant intact: the LLM never queries the database; answers come
  only from backend aggregates (spec scenario
  `answer-analytics-question-from-backend-aggregates` keeps passing).
- Existing integration tests in `tests/integration/backend/test_ai_analytics_chat.py`
  keep passing; existing endpoints and rate limits unchanged.
- Chat latency not degraded: history logging is one INSERT, no extra LLM calls.
- No secrets in the log table (no tokens, no provider config).

## Strategic Context

- Interacts with: `ai_analytics_service`, `ai_provider_client`, `llm_parse_service`
  helpers, `/api/v1/ai` router, analytics page template + `aiAnalyticsChat` bundle,
  Alembic migrations, shared-budget model (all family members see all data).
- Priority trade-off: trust (honest grounded answers, durable history) over speed.

## Constraints

### Steering (behavioral guidance)

- Keep changes surgical: no refactoring of unrelated AI parsers.
- History list defaults to the current user's own exchanges (questions are
  personal even in a shared budget); revisit only on explicit request.
- Follow project patterns: window exports via adapters, `debugLog()` not
  `console.log`, configs in `config/`.

### Hard (architectural enforcement)

- The LLM must never query or mutate the database (existing invariant).
- No amounts invented: prompt changes must not weaken the grounding rules.
- Delivery via CI/CD only: bump `VERSION` by one patch step; no server builds.
- PR targets `test`; source branch `dev/ai-analytics-chat-history`; `prod`
  never used as a source.
- Specification mode is strict: the new history behavior gets a valid
  Given-When-Then scenario with implements/verifies bindings.

## Autonomy Zones

- Full autonomy (reversible, low risk): prompt wording, schema field names,
  frontend layout of the history block, test structure.
- Guarded (log + confidence threshold): migration content (additive table only).
- Proposal-first (needs approval): implementing P2–P5 slices, changing history
  visibility to family-wide, any retention/cleanup policy beyond a simple cap.
- No autonomy (human only): deploy to production, deleting data.

> These zones OVERRIDE subagent-driven-development's "continuous execution,
> don't pause" default. Any task touching proposal-first / no-go decisions
> is marked HUMAN CHECKPOINT in the plan.

## Stop Rules

- Halt if: the migration would touch or rewrite existing tables (must be
  additive-only), or grounding tests start failing in a way that requires
  weakening the no-invented-figures rules.
- Escalate if: scope grows into P2–P5 territory (new aggregate intents,
  dialog context) — those need separate approval.
- Done when: backend tests (including new history tests) pass; the analytics
  page shows server-backed history for the logged-in user after asking a
  question; prompt changes are visible in the scope/answer calls; `VERSION`
  bumped; PR to `test` opened.

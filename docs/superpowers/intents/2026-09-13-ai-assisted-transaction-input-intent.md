# Intent: ai-assisted-transaction-input

**Date:** 2026-09-13
**Status:** approved

## Objective

Reduce friction of manual transaction entry and raise the quality of budget data. Free text ("кофе 350"), voice (Russian speech in the PWA), and receipt photos become confirmed transaction drafts; CSV import rows get auto-suggested articles. Now — because the household framework GPU API (OpenAI-compatible, self-hosted) provides free inference without sending family data to third parties.

Scope: five parts, Telegram bot explicitly out of scope.

- **B** — NL text → transaction draft (`POST /api/v1/ai/parse-transaction`)
- **C** — voice input in the PWA → STT → same parse path
- **D** — LLM article categorization for CSV import rows
- **E** — receipt photo → VLM → itemized expense list mapped to articles → batch draft
- **F** — AI settings page in the web UI (endpoint, token, three model slots) + availability check

## Desired Outcomes

- User types "кофе 350" or "зарплата 120000 на карту" → sees a filled fact draft (article, amount, date, financial center) → confirms with one button → fact created.
- User taps 🎤 in the add-fact form, speaks Russian → form fields fill from the transcript → confirms → fact created. Works in Chrome and Safari 14+ at 375px/768px/1280px.
- User uploads a receipt photo → VLM produces an editable item table with suggested articles → user adjusts and confirms → facts created.
- During CSV import, rows without an article receive suggested articles; user sees and can correct suggestions before applying the import.
- Admin opens the AI settings page: sets endpoint URL, token, and picks a model per slot (text / image / voice) from the live `GET /v1/models` list; a "test" button runs built-in canned examples and shows per-slot health status.
- When the LLM cannot parse input it returns an honest "не понял" error — never a silently wrong draft. Low-confidence category suggestions carry a visible "проверь категорию" flag.

## Health Metrics

- Existing manual fact entry works unchanged; the AI path is strictly additive.
- CSV import without LLM (provider down) works exactly as today; categorization degrades gracefully and never blocks import.
- GPU API unavailability (503, cold start, timeout) does not slow or break any existing backend path — no blocking calls added to existing flows.
- Fact form open time and PWA bundle size do not grow noticeably (voice/photo code ships as separate lazy bundles).
- Backend/frontend/e2e test suites stay green; the `FactCreate` contract is unchanged.

## Strategic Context

- Interacts with: backend FastAPI (new `ai` module), PWA (fact modal, import page, new settings page), framework GPU API (`https://homelab.ikeniborn.ru/v1`) as external dependency, `frameworkEdgeToken` secret, family members as end users, deploy pipeline (VERSION/CI).
- Priority trade-off: **trust > cost > speed**. Drafts are always human-confirmed (trust); inference is self-hosted and free (cost); 2–5 s latency for recognition + parsing is acceptable (speed last).
- Accepted risk (user-approved): the full-rights `frameworkEdgeToken` is stored in familyBudget's database settings; leak grants control over the homelab API. No separate scoped token will be provisioned for now.

## Constraints

### Steering (behavioral guidance)

- STT accepts WAV only → convert audio on the backend (default decision: ffmpeg added to the backend image, ~60 MB); the client uploads webm/mp4 as recorded — no WAV encoder in the PWA bundle.
- Structured output via prompt + `response_format` json_schema where the model supports it; otherwise validated parsing with an honest "не понял" on garbage.
- 503 from the GPU API → retry with backoff, max 2 attempts, then an honest user-facing error.
- Article candidates for prompts are full hierarchy paths ("Еда > Продукты") built via `hierarchy_service`, cached.
- Confidence threshold: low-confidence article suggestions are flagged "проверь категорию" in the UI.
- Receipt flow: VLM output becomes an editable draft table of line items; nothing is created until the user confirms.
- New frontend code follows project conventions: Vite IIFE bundles, windowExports adapters, per-feature `*API.ts` fetch modules.

### Hard (architectural enforcement)

- `bot/` is not modified in any way.
- Provider is an OpenAI-compatible endpoint only (default: framework GPU API); no calls to OpenAI, Anthropic, or any third-party SaaS.
- Runtime configuration lives in the web UI, not in env vars: endpoint URL, token, and a model choice per slot (text / image / voice), persisted in the database. The settings page is admin-only; the token is masked in the UI and never returned to the client in full.
- Model names are never hardcoded: selection comes from live `GET /v1/models`; the availability check uses built-in canned examples (text request, test image, test WAV) and reports per-slot status.
- The `FactCreate` schema and all existing endpoints are unchanged; the AI module adds only new `POST /api/v1/ai/*` routes.
- Facts are created only after explicit user confirmation; the LLM never writes to the database directly.
- Audio, photos, and transcripts are not persisted server-side (process and discard); only metadata goes to logs — family privacy.
- No builds on the server; delivery via VERSION bump and CI, as always.

## Autonomy Zones

- Full autonomy (reversible, low risk): internal backend/frontend code, tests, prompts, the AI-settings table schema and its Alembic migration.
- Guarded (log + confidence threshold): response shapes of the new `/api/v1/ai/*` endpoints (new contract — free within this intent).
- Proposal-first (needs approval): changes to existing pages beyond adding 🎤/📷/settings entry points; any new dependency other than ffmpeg and an OpenAI-compatible client; docker-compose changes.
- No autonomy (human only): edits under `bot/`, changes to existing API contracts, data deletion, production deploys.

> These zones OVERRIDE subagent-driven-development's "continuous execution,
> don't pause" default. Any task touching proposal-first / no-go decisions
> is marked HUMAN CHECKPOINT in the plan.

## Stop Rules

- Halt if: the GPU API contract diverges from the discovery digest (e.g. `/v1/models` or `/v1/audio/transcriptions` absent or shaped differently).
- Escalate if: Russian text parsing quality of the available models is unusable (garbage on more than half of the test phrases).
- Done when: all five Desired Outcome scenarios are observably working on the dev stand (fbd.ikeniborn.ru) at 375px/768px/1280px; manual entry and non-AI import behave exactly as before; backend/frontend/e2e suites are green.

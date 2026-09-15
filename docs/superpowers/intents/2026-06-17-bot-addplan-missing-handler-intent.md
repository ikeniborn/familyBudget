# Intent: Fix /addplan crash — import from missing bot/handlers/add.py

**Date:** 2026-06-17
**Status:** approved

## Objective
The Telegram bot command `/addplan` crashes at its article-selection step.
`bot/handlers/add_plan.py:221` runs `from bot.handlers.add import build_article_keyboard`,
but `bot/handlers/add.py` does not exist in the repo, so the import raises
`ModuleNotFoundError` mid-conversation. Many handler hint texts and `/help`
reference an `/add` command that is likewise unregistered. Fix now: a core
bot flow is broken for every user who reaches article selection.

## Desired Outcomes
- Running `/addplan` and advancing to article selection shows the article
  keyboard instead of raising an import error.
- No handler imports a module that does not exist in the tree.
- `/help` and hint texts reference only commands that are actually registered.

## Health Metrics
- Other bot handlers (`/today`, `/balance`, `/summary`, `/list`, `/edit`,
  `/delete`, `/export`, `/search`, `/settings`) keep working unchanged.
- Bot bootstrap / handler registration (`bot/main.py`, `bot/bot.py`) still
  starts cleanly.
- No new persistent state introduced (sessions stay in-memory per current design).

## Strategic Context
- Interacts with: `bot/handlers/add_plan.py`, the (missing) `bot/handlers/add.py`,
  handler registration in `bot/bot.py`, `/help` text, backend articles API
  (see [[api#Domain Endpoints]] in docs/wiki).
- Open question for brainstorm: was `add.py` deleted/renamed (restore it) or did
  `build_article_keyboard` move elsewhere (fix the import target)? Resolve from
  git history before choosing.
- Priority trade-off: **trust** — correctness of a user-facing command over speed.

## Constraints
### Steering (behavioral guidance)
- Prefer the smallest change that restores the real keyboard builder; do not
  reimplement article logic if the function exists elsewhere.
- Keep the `/addplan` conversation flow and message copy unchanged.
### Hard (architectural enforcement)
- Bot talks to backend over HTTP only (never the DB) — preserve this.
- No new dependencies; match existing handler style.

## Autonomy Zones
- Full autonomy (reversible, low risk): fixing the import path / restoring the file.
- Guarded (log + confidence threshold): editing `/help` and hint texts.
- Proposal-first (needs approval): adding a brand-new `/add` command if one is deemed needed.
- No autonomy (human only): changing session persistence model.

## Stop Rules
- Halt if: git history shows no prior `build_article_keyboard` definition (the
  function must be authored from scratch → escalate scope).
- Escalate if: the fix would require persistent session storage.
- Done when: `/addplan` reaches article selection and renders the keyboard
  without error in a real bot run, and a grep confirms no handler imports a
  nonexistent module.

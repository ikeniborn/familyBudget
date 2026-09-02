---
review:
  intent_hash: 52b15b605c5246f4
  last_run: 2026-09-02
  phases:
    structure: passed
    completeness: passed
    clarity: passed
    consistency: passed
    alignment: passed
  findings:
    - id: F-001
      phase: structure
      severity: INFO
      section: Constraints
      section_hash: b555f1b3f776f39f
      fragment: "`TODO` comment in the source."
      text: "The literal TODO matches the placeholder scan, but it is the word used as a term inside a steering constraint, not an unfilled placeholder."
      fix: "No change needed; recorded so a later run does not re-raise it."
      verdict: wontfix
      verdict_at: 2026-09-02
    - id: F-002
      phase: alignment
      severity: INFO
      section: Desired Outcomes
      section_hash: 1a49f4c5b8d127ff
      fragment: null
      text: "The intent covers only step 1 of the three-step session-revocation design. This matches the user's explicit decision to ship the steps as separate pull requests."
      fix: "None; steps 2 and 3 get their own intents."
      verdict: accepted
      verdict_at: 2026-09-02
    - id: F-003
      phase: alignment
      severity: INFO
      section: Strategic Context
      section_hash: null
      fragment: null
      text: "The wiki section auth.md#JWT Tokens & Refresh documents the current claim set and goes stale once this ships. Updating it is not named in Desired Outcomes."
      fix: "Covered by the Keep Docs Current rule; update the section as part of implementation."
      verdict: accepted
      verdict_at: 2026-09-02
---

# Intent: Emit and enforce a token_type claim on access tokens

**Date:** 2026-09-02
**Status:** approved

## Objective
`create_access_token` (`backend/app/services/jwt.py:45`) emits no `token_type`
claim, and neither `decode_access_token` (`:151`) nor `decode_access_token_full`
(`:195`) checks one. A refresh token carries a `user_id` claim, so it decodes as
a perfectly valid access token. Two consequences: a captured refresh token works
as a 30-day access token, and `POST /api/v1/auth/logout` — which revokes the
refresh row in `t_f_refresh_token` — does not stop that same token being replayed
through the access path, where the database is never consulted.

Now, because this is step 1 of `reference/session-revocation-design` (audit slice
1): it is the cheapest of the three steps, it logs nobody out, and it removes the
30-day token from the access path on the day it deploys. Steps 2 and 3 — unifying
on the `CurrentUser` dependency and revoking on deactivation — are separate pull
requests and are explicitly out of scope here.

## Desired Outcomes
- A request presenting a refresh token in the `access_token` cookie or in
  `Authorization: Bearer` is refused with 401 instead of being served.
- A session established before this change keeps working after deploy — no user
  of the PWA, the Telegram Web Apps, or the bot is forced to sign in again.
- A freshly issued access token carries `token_type: "access"`, observable by
  decoding the token the login flow returns.
- After `POST /api/v1/auth/logout`, a refresh token retained by the client grants
  access through neither the refresh path nor the access path.

## Health Metrics
- All eleven `Authorization: Bearer` call sites in `bot/utils/api_client.py`
  continue to authenticate; the bot is not modified or rebuilt in this change.
- The WebSocket handshake is untouched: `create_ws_token` / `decode_ws_token`
  keep their `type: "ws"` contract and connections still establish.
- Refresh rotation is unchanged — `POST /api/v1/auth/refresh` still issues a new
  pair and revokes the previous row.
- The existing backend suite stays green, including
  `tests/unit/test_admin_auth_bypass.py` and
  `tests/unit/backend/test_scd2_refresh_token_revocation.py`.

## Strategic Context
- Interacts with: `services/jwt.py` (the change), `middleware/jwt_middleware.py`
  (sole caller of `decode_access_token_full`), `core/auth.py` (reads
  `request.state.user_id`), `bot/utils/api_client.py` and the frontend network
  layer (token senders), and the WebSocket handshake in `endpoints/budget_ws.py`
  (separate token type). See `auth.md#JWT Tokens & Refresh`.
- Priority trade-off: **trust**. Where closing the hole harder conflicts with
  keeping live sessions working, keeping them working wins — an explicit
  `"refresh"` is rejected immediately, a missing claim is tolerated for one
  access-token lifetime.

## Constraints
### Steering (behavioral guidance)
- The tolerance for a missing `token_type` is temporary. Record its removal as a
  dated wiki task scheduled one access-token lifetime after deploy, not as a
  `TODO` comment in the source.
### Hard (architectural enforcement)
- Changes are confined to `backend/app/services/jwt.py` and its tests. No schema
  migration, no new dependency, no edit to `endpoints/auth.py`.
- A **missing** `token_type` claim is accepted as an access token; an explicit
  `"refresh"` is rejected. Requiring the claim outright would invalidate every
  token already issued and is forbidden in this change.
- Steps 2 and 3 of the design — the `CurrentUser` unification and revocation on
  deactivation — must not be touched here, and no incidental refactoring of
  `endpoints/auth.py` may ride along.

## Autonomy Zones
- Full autonomy (reversible, low risk): editing `services/jwt.py`, writing and
  running tests, committing to `dev/access-token-type-claim`, updating the wiki.
- Guarded (log + confidence threshold): deciding the exact rejection shape —
  returning `None` from the decoders, consistent with how they already report an
  invalid token.
- Proposal-first (needs approval): opening the pull request into `test`; any
  change reaching beyond `services/jwt.py` and its tests.
- No autonomy (human only): altering the tolerance rule, touching steps 2 or 3,
  changing `JWT_EXPIRE_DAYS`, or modifying the bot or frontend token handling.

> These zones OVERRIDE subagent-driven-development's "continuous execution,
> don't pause" default. Any task touching proposal-first / no-go decisions
> is marked HUMAN CHECKPOINT in the plan.

## Stop Rules
- Halt if: a client is found to legitimately send a refresh token where an access
  token is expected — the tolerance rule cannot cover that, and the change needs
  re-scoping before it ships.
- Halt if: the change cannot be confined to `services/jwt.py` and its tests.
- Escalate if: making refresh-as-access fail would also break the WebSocket
  handshake or refresh rotation, meaning the token contract is more entangled
  than the design assumed.
- Done when: three observable results hold, each demonstrated by a test run —
  a refresh token presented on the access path is refused; an access token minted
  without a `token_type` claim is still accepted; a newly issued access token
  carries `token_type: "access"` — and the pull request into `test` is open.

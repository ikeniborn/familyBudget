# Intent: Remove broken, unmounted legacy /auth/refresh (auth_refresh.py)

**Date:** 2026-06-17
**Status:** approved

## Objective
`backend/app/api/v1/endpoints/auth_refresh.py` is a stale second implementation
of token refresh. It imports `verify_refresh_token` from the jwt service
(`:13`) — the active `services/jwt.py` exposes `decode_refresh_token`, not that
name — and queries `RefreshToken.token == refresh_token` (`:35`), a plaintext
column the live flow does not use (the real path in `endpoints/auth.py:658`
stores only SHA-256 hashes). The router is **not mounted** in `api/v1/router.py`,
so it is dead code that would also crash on import/use. Remove it now to prevent
a future maintainer wiring up a broken, insecure refresh path.

## Desired Outcomes
- `auth_refresh.py` no longer exists (or contains no route definitions).
- The only live refresh path is the hash-based one in `endpoints/auth.py`.
- No reference anywhere imports `auth_refresh` or `verify_refresh_token`.

## Health Metrics
- The working `/auth/refresh` flow (refresh-token rotation, SHA-256 hashing) is
  unchanged (see [[auth#Refresh-Token Rotation]]).
- App still boots; router mounting (`api/v1/router.py`) unaffected.
- No security regression — plaintext-token comparison is not introduced anywhere.

## Strategic Context
- Interacts with: `endpoints/auth_refresh.py` (to delete), the live refresh in
  `endpoints/auth.py`, `services/jwt.py`, the `RefreshToken` model
  (see [[auth#JWT Tokens]], [[auth#Internal Service Auth]]).
- Verify zero imports/mounts before deleting (grep `auth_refresh`,
  `verify_refresh_token`, `RefreshToken.token`).
- Priority trade-off: **trust** (security) — eliminate a broken, plaintext-based
  auth path before it can be revived.

## Constraints
### Steering (behavioral guidance)
- Prefer outright file deletion over leaving a commented-out shell.
### Hard (architectural enforcement)
- Do not touch the live refresh flow in `endpoints/auth.py`.
- Refresh tokens are compared by SHA-256 hash only — never reintroduce a
  plaintext `.token` comparison.

## Autonomy Zones
- Full autonomy (reversible, low risk): grepping for references.
- Guarded (log + confidence threshold): deleting the file once references confirmed zero.
- Proposal-first (needs approval): if any live code DOES import it (then it is
  not dead — re-scope before removing).
- No autonomy (human only): changes to the live auth/refresh logic.

## Stop Rules
- Halt if: a grep finds any mounted router or live import of `auth_refresh` /
  `verify_refresh_token` → escalate (the "dead code" premise is wrong).
- Done when: the file is gone, `grep -r auth_refresh backend/` returns nothing,
  the app boots, and the existing `/auth/refresh` (hash-based) still issues
  tokens in a real run.

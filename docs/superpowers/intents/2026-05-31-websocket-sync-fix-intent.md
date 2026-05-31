# Intent: WebSocket Sync Fix

**Date:** 2026-05-31
**Status:** approved

## Objective

Regression: after recent updates, real-time WebSocket synchronization stopped working. Changes made in lists (transactions, shopping lists) are only visible locally — other family members do not see updates without a page reload. Fix to restore working state.

## Desired Outcomes

- User A adds a transaction → User B sees it without reloading the page
- Change in shopping list → reflected for all family members in real time

## Health Metrics

- Offline mode (Dexie sync) must not degrade
- WS authentication (JWT tokens) must remain intact
- Note: PGlite has been removed — only Dexie remains for offline

## Strategic Context

- Interacts with: backend WS endpoint (`/api/v1/budget/ws`), Redis Pub/Sub, frontend WS client, Dexie offline-sync, multi-tab leader-follower (Web Locks + BroadcastChannel)
- Priority trade-off: trust > speed > cost

## Constraints

### Steering (behavioral guidance)

- Fix the regression; do not redesign or extend the sync architecture
- Match existing event schema and handler patterns

### Hard (architectural enforcement)

- Deploy only via CI/CD — no direct server hotfixes
- No changes to Redis configuration
- No changes to JWT authentication logic

## Autonomy Zones

- Full autonomy (reversible, low risk): frontend WS handler fixes, subscription/reconnection logic, event routing
- Proposal-first (needs approval): backend WS endpoint changes, event schema changes
- No autonomy (human only): Redis config changes, JWT auth changes

## Stop Rules

- Halt if: fix requires changing the WS event protocol in a breaking way
- Escalate if: root cause is in Redis Pub/Sub infrastructure (not code)
- Done when: real-time sync works — User A's changes appear for User B without reload, across transactions and shopping lists

# Intent: Remove Dexie and Offline Mode

**Date:** 2026-06-04
**Status:** draft

## Objective

Dexie offline sync causes more problems than it solves: duplicates, stuck pending operations, conflicts with WebSocket real-time updates, and cross-device stale data. The feature was patched multiple times (PR #546, #552, #555) without achieving stability. Remove it entirely. All data sync goes through server API or WebSocket only.

## Desired Outcomes

- Pages always show server-fresh data
- WebSocket updates apply without duplicates
- Opening on another device shows current data immediately
- No pending/sync_status/temp_id concepts anywhere in codebase

## Health Metrics

- WebSocket real-time updates continue to work (facts, plans, lists)
- CRUD operations via API do not degrade in speed
- Telegram WebApp does not break
- PWA continues to install (without offline cache — acceptable)

## Strategic Context

- Interacts with: dashboard, facts, plan, lists, transfers, budget WS client (frontend); sync.py, sync_handlers.py (backend)
- Bot: clean, no Dexie
- Service worker: not present — no SW to remove
- Priority trade-off: trust > speed (data correctness over perceived performance)

## Constraints

### Steering (behavioral guidance)

- WS client (`budgetWSClient/`) stays — only remove Dexie dependencies from it
- After removing Dexie from a WS handler, WS must still process server events and update UI
- Remove all: DataLayer.ts, offline/ directory, dexie* files, sync_status logic, pendingOperations logic, temp_id logic

### Hard (architectural enforcement)

- Do NOT remove WebSocket infrastructure
- Backend `sync.py` and `sync_handlers.py` — remove only if used exclusively for Dexie sync (verify before deleting)
- No new caching layer as replacement — plain API calls only

## Autonomy Zones

- Full autonomy (reversible, low risk): deleting Dexie code inside files, deleting entire offline-only files and directories, deleting backend-only-sync endpoints
- Proposal-first (needs approval): changes to WS event handling logic (after removing Dexie, propose new simplified handler before implementing)
- No autonomy (human only): changes to authentication, database schema, production deploy

## Stop Rules

- Halt if: removing a Dexie dependency would require redesigning a non-trivial flow (escalate with proposal)
- Escalate if: a file mixes Dexie logic with non-Dexie logic in a non-obvious way
- Done when: `grep -r "dexie\|Dexie\|sync_status\|pendingOp\|temp_id\|DataLayer" frontend/` returns zero results, backend sync-only endpoints removed, `npm run build` passes, WS updates verified working in browser

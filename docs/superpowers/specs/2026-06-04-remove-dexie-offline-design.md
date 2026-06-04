# Design: Remove Dexie and Offline Mode

**Date:** 2026-06-04  
**Status:** approved  
**Branch:** `dev/remove-dexie`

## Objective

Remove Dexie.js offline sync entirely. All data flows through server API or WebSocket only. Eliminates duplicates, stuck pending operations, and cross-device stale data.

## Architecture After Removal

**Before:** page → DataLayer → [Dexie (primary) | API (fallback)]  
**After:** page → API directly

Reference data (articles, financial centers, cost centers) loaded via direct `fetch` to existing REST endpoints on page/modal open. WebSocket client stays but only receives server-push events and updates DOM — no local DB writes.

## What Gets Removed

### Frontend
- `frontend/shared/db/dexie/` — entire directory (28 files, DexieManager + operations + repositories)
- `DataLayer.ts` — Dexie/API abstraction layer
- `DexieDiagnosticModal.ts` — diagnostics UI
- `dexie` from `package.json`
- WS client: `syncHandler.ts`, `uploadHandler.ts` deleted; Dexie code removed from `eventHandlers.ts`
- All `isDexieActive()`, `getDexieManager()`, `sync_status`, `pendingOp`, `temp_id` references in page modules

### Backend
- `backend/app/api/v1/endpoints/sync.py` — Dexie-only endpoints
- `sync_handlers.py` — Dexie-only WS sync handlers
- Router registrations for removed endpoints

### Database (migration)
| Table | Column | Action |
|-------|--------|--------|
| `t_f_shopping_list` | `temp_id` | DROP |
| `t_f_shopping_list_item` | `sync_status` | DROP |
| `t_f_fact_*` | `is_offline_sync` | DROP |
| `t_f_fact_*` | `content_hash` | DROP |
| `t_f_fact_*` | `sync_hash` | DROP |

**Kept** (real business use): `deleted_at`, `completed_at`, `last_modified_by`, `version` on ShoppingListItem.

## What Stays

- WebSocket infrastructure (`budgetWSClient/` core)
- All regular REST endpoints
- WS event handlers — simplified (no Dexie writes, DOM updates only)
- PWA installable (without offline cache — acceptable)

## Implementation Order (single branch)

All work in `dev/remove-dexie`. One pass, deploy once at end.

1. **facts page** — replace DataLayer in `factsAPI.ts`, `dropdownAPI.ts` with direct API calls
2. **plan page** — replace in `helpers.ts`, `index.ts`; propose simplified `wsEventHandlers.ts` before implementing
3. **lists page** — replace in `stateManager.ts`, `modalManager.ts`; remove temp_id reconciliation (wait for API response instead)
4. **dashboard** — replace in `factsManager.ts`, `categoryLoader.ts`, `saveTransaction.ts`
5. **WS client** — delete `syncHandler.ts`, `uploadHandler.ts`; strip Dexie from `eventHandlers.ts` (proposal first)
6. **shared cleanup** — delete `frontend/shared/db/dexie/`, `DataLayer.ts`, `DexieDiagnosticModal.ts`
7. **package.json** — remove `dexie` dependency
8. **backend** — delete `sync.py`, `sync_handlers.py`, remove router registrations
9. **migration** — drop 5 columns listed above
10. **final verification** — see below

## WS Event Handler Simplification

After Dexie removal, handlers for `fact.created/updated/deleted`:
- **created/updated** → find DOM row by `fact_id`, update inline (existing HTMX swap / DOM update pattern)
- **deleted** → remove DOM row
- **No temp_id reconciliation** — shopping list creation waits for API response, then renders

Each WS handler change requires proposal before implementation (proposal-first zone per intent).

## Verification

After each module (steps 1–5): `npm run type-check` must pass; open page in browser and verify load, CRUD, WS update.

Final (step 10):
```bash
npm run build                          # must pass
grep -r "dexie\|Dexie\|DataLayer\|sync_status\|pendingOp\|temp_id\|is_offline_sync" frontend/  # must return 0
cd tests && ./run-tests.sh backend     # must pass
npm run test:e2e                       # facts, plan, lists golden paths
```

Migration applied last before deploy (irreversible — run on test server first).

## Constraints (from intent)

- Do NOT remove WebSocket infrastructure
- No new caching layer — plain API calls only
- Auth, DB schema migrations, prod deploy: human-only actions
- Halt if removing Dexie dependency requires redesigning a non-trivial flow

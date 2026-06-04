# Design: Remove Dexie and Offline Mode

**Date:** 2026-06-04  
**Status:** approved  
**Branch:** `dev/remove-dexie`

## Objective

Remove Dexie.js offline sync entirely. All data flows through server API or WebSocket only. Eliminates duplicates, stuck pending operations, and cross-device stale data.

## Architecture After Removal

**Before:** page → DataLayer → [Dexie (primary) | API (fallback)]  
**After:** page → API directly

Reference data (articles, financial centers, cost centers) loaded via direct `fetch` to existing REST endpoints on page/modal open. WebSocket client stays but only receives server-push events and updates DOM — no local DB writes. Redis is clean — no Dexie-related keys or queues. Bot is clean — no Dexie involvement.

## What Gets Removed

### Frontend — DELETE entirely

| File/Directory | Reason |
|----------------|--------|
| `frontend/shared/db/dexie/` | Entire Dexie module (28 files: DexieManager, operations, repositories, types, utils) |
| `frontend/web/static/js/data/DataLayer.ts` | Dexie/API abstraction layer |
| `frontend/web/static/js/modules/uiComponents/modals/DexieDiagnosticModal.ts` | Diagnostics UI |
| `frontend/web/static/js/notifications/dexieReadyNotification.ts` | "Dexie ready" toast |
| `frontend/web/static/js/notifications/dexieProgressToast.ts` | Sync progress toast |
| `frontend/web/static/js/dashboard/features/offlineDashboard.ts` | Offline dashboard module |
| `frontend/web/static/js/budget/budgetWSClient/integration/syncHandler.ts` | WS sync message handler |
| `frontend/web/static/js/budget/budgetWSClient/integration/uploadHandler.ts` | WS upload pending handler |
| `frontend/web/templates/scripts/navbar-sync-badge.html` | Sync badge UI (calls `window.Dexie`) |
| `tests/unit/data/DexieManager.financialCenters.test.ts` | Dexie unit test |
| `tests/integration/workflows/offline-sync.test.ts` | Offline sync integration test |
| `tests/unit/data/DataLayer.filtering.test.ts` | DataLayer test |
| `tests/unit/lists/modalManager.fallback.test.ts` | Offline fallback test |

### Frontend — MODIFY (surgical removal of Dexie references)

| File | What to remove |
|------|----------------|
| `budgetWSClient/integration/eventHandlers.ts` | Dexie writes; keep DOM update logic |
| `facts/integration/factsAPI.ts` | `isDexieActive()`, `getDexieManager()` → direct API calls |
| `facts/integration/dropdownAPI.ts` | DataLayer → direct API calls |
| `plan/index.ts` | `getDexieManager()` init |
| `plan/wsEventHandlers.ts` | Dexie bulk updates → DOM-only updates (proposal first) |
| `plan/helpers.ts` | `dataLayer.getArticles/getFinancialCenters/getCostCenters` → direct API |
| `dashboard/features/factsManager.ts` | `isDexieActive()`, `getDexieManager()` |
| `dashboard/features/addTransaction/categoryLoader.ts` | DataLayer → direct API |
| `dashboard/features/modalFact/saveTransaction.ts` | Offline creation logic |
| `dashboard/features/modalPlan/saveTransaction.ts` | Offline creation logic |
| `dashboard/adapters/windowExports.ts` | Remove Dexie window exports |
| `lists/listsManager/core/stateManager.ts` | `getDexieManager()` |
| `lists/listsManager/core/listOperations.ts` | `sync_status` checks |
| `lists/listsManager/ui/modalManager.ts` | Offline item creation, temp_id |
| `lists/csvImporter.ts` | Dexie import calls |
| `lists/listsManager/features/autocomplete.ts` | Offline history |
| `templates/partials/recent_transactions.html` | `is_offline_sync` field reference |
| `tests/unit/state/ListsState.test.ts` | Remove Dexie mocks, keep non-Dexie tests |
| `package.json` | Remove `dexie` dependency |

### Backend — DELETE entirely

| File | Reason |
|------|--------|
| `backend/app/api/v1/endpoints/sync.py` | Dexie-only: shopping reference + delta sync endpoints |
| `backend/app/api/v1/endpoints/sync_handlers.py` | Dexie-only: WS sync_initial, sync_incremental, client_changes handlers |

### Backend — MODIFY

| File | What to remove |
|------|----------------|
| `backend/app/api/v1/router.py` (or main router) | Remove `sync` router registration |
| `backend/app/api/v1/endpoints/budget_ws.py` | Remove `sync_initial`, `sync_incremental`, `handle_sync_*` message dispatch (~lines 46-49, 616-651) |
| `backend/app/models/fact.py` | Remove `is_offline_sync`, `content_hash`, `sync_hash` columns |
| `backend/app/models/shopping_list.py` | Remove `temp_id` column |
| `backend/app/models/shopping_list_item.py` | Remove `sync_status` column |
| `backend/app/schemas/fact.py` | Remove `is_offline_sync`, `content_hash`, `sync_hash` from FactCreate schema |
| `backend/app/schemas/shopping_list_item.py` | Remove `sync_status`, `temp_id` fields; remove batch-sync schema if Dexie-only |

### Database (migration — run last before deploy)

| Table | Column | Action |
|-------|--------|--------|
| `t_f_shopping_list` | `temp_id` | DROP |
| `t_f_shopping_list_item` | `sync_status` | DROP |
| `t_f_fact_*` + history | `is_offline_sync` | DROP |
| `t_f_fact_*` + history | `content_hash` | DROP + drop indexes |
| `t_f_fact_*` + history | `sync_hash` | DROP + drop indexes |

**Kept** (real business use, not Dexie): `deleted_at`, `completed_at`, `last_modified_by`, `version` on ShoppingListItem.

**Not affected:** Redis (no Dexie keys/queues), Bot (no Dexie code).

## What Stays

- WebSocket infrastructure (`budgetWSClient/` core files)
- All regular REST endpoints (facts, lists, plans, articles, financial centers, cost centers)
- WS event handlers — simplified (DOM updates only, no Dexie writes)
- PWA installable (without offline cache — acceptable per intent)

## Implementation Order (single branch, one pass)

All work in `dev/remove-dexie`. Deploy once at end.

1. **facts page** — replace DataLayer in `factsAPI.ts`, `dropdownAPI.ts` with direct API calls
2. **plan page** — replace in `helpers.ts`, `index.ts`; propose simplified `wsEventHandlers.ts` before implementing
3. **lists page** — replace in `stateManager.ts`, `listOperations.ts`, `modalManager.ts`, `csvImporter.ts`, `autocomplete.ts`; remove temp_id reconciliation
4. **dashboard** — replace in `factsManager.ts`, `categoryLoader.ts`, `saveTransaction.ts` (fact + plan modals); remove `offlineDashboard.ts`; clean `windowExports.ts`
5. **WS client** — delete `syncHandler.ts`, `uploadHandler.ts`; strip Dexie from `eventHandlers.ts` (proposal first)
6. **shared cleanup** — delete `frontend/shared/db/dexie/`, `DataLayer.ts`, `DexieDiagnosticModal.ts`, notification files; clean templates; delete Dexie tests
7. **package.json** — remove `dexie` dependency; `npm run build` must pass
8. **backend** — delete `sync.py`, `sync_handlers.py`; modify `budget_ws.py` (remove sync dispatch); remove router registrations; update models + schemas
9. **migration** — Alembic migration dropping 5 columns + 3 indexes
10. **final verification** — see below

## WS Event Handler Simplification

After Dexie removal, handlers for `fact.created/updated/deleted`:
- **created/updated** → find DOM row by `fact_id`, update inline (existing HTMX swap / DOM update pattern)
- **deleted** → remove DOM row
- **No temp_id reconciliation** — shopping list creation waits for API response, then renders

Each WS handler change requires proposal before implementation (proposal-first zone per intent).

## Verification

After each module (steps 1–5): `npm run type-check` must pass; verify in browser: load, CRUD, WS live update.

Final (step 10):
```bash
npm run build
grep -r "dexie\|Dexie\|DataLayer\|sync_status\|pendingOp\|temp_id\|is_offline_sync\|content_hash\|sync_hash" frontend/
# must return 0 results

cd tests && ./run-tests.sh backend
npm run test:e2e   # facts, plan, lists golden paths
```

Migration applied last, on test server first (irreversible).

## Constraints (from intent)

- Do NOT remove WebSocket infrastructure
- Do NOT remove regular REST endpoints
- No new caching layer — plain API calls only
- `budget_ws.py` modify only (remove sync dispatch), do not delete
- Auth, production deploy: human-only actions
- Halt if removing Dexie dependency requires redesigning a non-trivial flow
- Escalate if a file mixes Dexie + non-Dexie logic in a non-obvious way

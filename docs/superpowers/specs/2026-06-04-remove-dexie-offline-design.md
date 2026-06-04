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

---

## Full Artifact Inventory

### Frontend — DELETE entirely

| File/Directory | Notes |
|----------------|-------|
| `frontend/shared/db/dexie/` | 28 files: DexieManager, operations, repositories, types, utils, tests |
| `frontend/web/static/js/data/DataLayer.ts` | Dexie/API abstraction (1674 lines) |
| `frontend/web/static/js/diagnostics/dexie-diagnostic-entry.ts` | Registers `window.openDexieDiagnostic` |
| `frontend/web/static/js/modules/uiComponents/modals/DexieDiagnosticModal.ts` | Diagnostics modal UI |
| `frontend/web/static/js/notifications/dexieReadyNotification.ts` | "Dexie ready" toast |
| `frontend/web/static/js/notifications/dexieProgressToast.ts` | Sync progress toast |
| `frontend/web/static/js/dashboard/features/offlineDashboard.ts` | HTMX intercept + Dexie render for offline dashboard |
| `frontend/web/static/js/offline/networkDetector.ts` | Network detection (offline mode only — no online consumers after Dexie removal) |
| `frontend/web/static/js/offline/p2p/` | P2P sync directory (P2PManager, P2PMerge, P2PSyncProtocol) |
| `frontend/web/static/js/budget/budgetWSClient/integration/syncHandler.ts` | WS sync_initial/sync_incremental handler |
| `frontend/web/static/js/budget/budgetWSClient/integration/uploadHandler.ts` | WS upload pending operations handler |
| `frontend/web/templates/scripts/navbar-sync-badge.html` | Sync badge calling `window.Dexie` |
| `frontend/web/templates/scripts/dexie-indicator-manager.html` | Dexie status indicator (DB icon + status dot) |

### Frontend — MODIFY (surgical Dexie removal)

| File | What to remove |
|------|----------------|
| `budget/budgetWSClient/integration/eventHandlers.ts` | `upsertFactInDexie`, `hardDeleteFactInDexie`, `upsertShoppingListInDexie`, `upsertShoppingItemInDexie`; keep DOM update logic |
| `budget/budgetWSClient/types/events.ts` | `sync_hash`, `is_offline_sync`, `content_hash`, `temp_id` fields from WsFactPayload types; Dexie sync event types |
| `facts/integration/factsAPI.ts` | `isDexieActive()`, `getDexieManager()` → direct API calls |
| `facts/integration/dropdownAPI.ts` | DataLayer → direct API calls |
| `plan/index.ts` | `ensureDexieReady()`, `getDexieManager()` init |
| `plan/wsEventHandlers.ts` | `syncFactToDexie()`, `removeFactFromDexie()` → DOM-only updates (proposal first) |
| `plan/helpers.ts` | `dataLayer.getArticles/getFinancialCenters/getCostCenters` → direct API |
| `plan/factsTable.ts` | Remove `is_offline_sync` cloud icon (☁️) display logic |
| `dashboard/features/factsManager.ts` | `isDexieActive()`, `getDexieManager()`, DexieManager direct calls → API |
| `dashboard/features/addTransaction/categoryLoader.ts` | DataLayer → direct API |
| `dashboard/features/modalFact/saveTransaction.ts` | Offline creation / Dexie write logic |
| `dashboard/features/modalFact/saveTransfer.ts` | Offline transfer creation in Dexie |
| `dashboard/features/modalPlan/saveTransaction.ts` | Offline creation logic |
| `dashboard/adapters/windowExports.ts` | Dexie imports, `init()` Dexie block, `offline-sync-complete` listener, `openDexieDiagnostic` export |
| `lists/listsManager/core/stateManager.ts` | `getDexieManager()` |
| `lists/listsManager/core/listOperations.ts` | `sync_status` checks |
| `lists/listsManager/ui/modalManager.ts` | Offline item creation, temp_id reconciliation |
| `lists/csvImporter.ts` | Dexie import calls |
| `lists/listsManager/features/autocomplete.ts` | Offline history |
| `lists/listsManager/testing/debugUtils.ts` | `window.dexieManager` references |
| `shared/static/js/budgetShared.ts` | `_loadCategoriesFromDexie()` method + calls (lines ~1909-2039) → API-only path |
| `monitoring/PerformanceMonitor.ts` | `trackDexieCall()`, `trackCacheHit('dexie')` methods |
| `templates/base.html` | Remove: dexie.min.js + dexie-diagnostic.min.js script tags, Dexie init block (lines 880-928), navbar-sync-badge/dexie-indicator-manager includes, `#dexie-indicator-wrapper` element, `#navbar-sync-badge-wrapper` element, `dexieActive` localStorage init |
| `templates/login_email.html` | Remove `dexieActive` localStorage.setItem on login |
| `templates/2fa_verify.html` | Remove `dexieActive` localStorage.setItem |
| `templates/scripts/pwa-splash-screen.html` | Remove `window.Dexie` check block |
| `templates/scripts/service-worker-registration.html` | Remove Dexie upload-on-SW-update block |
| `templates/partials/lists/initialization_script.html` | Remove `window.Dexie?.getState()` call |
| `templates/partials/recent_transactions.html` | Remove `is_offline_sync` field reference |
| `build-all.js` | Remove `dexie`, `dexieDiagnostic`, `dataLayer` bundle entries |
| `package.json` | Remove `dexie` dependency; remove `fake-indexeddb` devDependency |
| `config/vitest.config.ts` | Remove `offlineManager` coverage thresholds |

### Frontend — TESTS to DELETE

| File |
|------|
| `tests/unit/dashboard/dexieArticles.test.ts` |
| `tests/unit/dashboard/dexieCostCenters.test.ts` |
| `tests/unit/dashboard/dexieFactsTombstone.test.ts` |
| `tests/unit/dashboard/dexieFinancialCenters.test.ts` |
| `tests/unit/dashboard/dexieProductGroups.test.ts` |
| `tests/unit/dashboard/dexieRecurringPlans.test.ts` |
| `tests/unit/dashboard/dexieShoppingLists.test.ts` |
| `tests/unit/dashboard/dexieStores.test.ts` |
| `tests/unit/dashboard/offlineDashboard.test.ts` |
| `tests/unit/dashboard/shoppingSync404.test.ts` |
| `tests/unit/plan/dexieFactsPlans.test.ts` |
| `tests/unit/data/DexieManager.financialCenters.test.ts` |
| `tests/unit/data/DataLayer.filtering.test.ts` |
| `tests/unit/lists/modalManager.fallback.test.ts` |
| `tests/unit/state/ListsState.test.ts` (partially — remove Dexie mocks, keep non-Dexie assertions) |
| `tests/integration/workflows/offline-sync.test.ts` |
| `tests/e2e/webapp/test_offline_functionality.spec.ts` |
| `tests/e2e/webapp/test_offline_dashboard.spec.ts` |

---

### Backend — DELETE entirely

| File | Reason |
|------|--------|
| `backend/app/api/v1/endpoints/sync.py` | Dexie-only: shopping reference + delta sync REST endpoints |
| `backend/app/api/v1/endpoints/sync_handlers.py` | Dexie-only: WS sync_initial, sync_incremental, client_changes (619 lines) |

### Backend — MODIFY

| File | What to remove/change |
|------|----------------------|
| `backend/app/api/v1/router.py` | Remove `sync_router` import and `include_router(sync_router)` |
| `backend/app/api/v1/endpoints/budget_ws.py` | Remove imports from sync_handlers (lines 46-50); remove `sync_initial`, `sync_incremental`, `sync_client_changes` message dispatch (lines 616-671) |
| `backend/app/api/v1/endpoints/facts.py` | Remove sync_hash/content_hash deduplication block (lines 213-225); remove sync fields from create (lines 372-374) |
| `backend/app/api/v1/endpoints/shopping_list_items.py` | Remove `temp_id` generation (lines 218-226); remove `sync_status="synced"` assignment (line 283); remove `sync_status` update (line 716); delete delta_sync endpoint (lines 1036-1053); delete batch_sync endpoint (lines 1083-1143) |
| `backend/app/api/v1/endpoints/shopping_lists.py` | Remove server-side `temp_id` generation (lines 132-134) |
| `backend/app/api/v1/endpoints/transfers.py` | Remove `sync_hash` deduplication (lines 174-228); remove sync field passthrough (lines 283-285, 301-303) |
| `backend/app/models/fact.py` | Remove columns: `is_offline_sync`, `content_hash`, `sync_hash` |
| `backend/app/models/shopping_list.py` | Remove column: `temp_id` |
| `backend/app/models/shopping_list_item.py` | Remove column: `sync_status` |
| `backend/app/schemas/fact.py` | Remove fields: `is_offline_sync`, `content_hash`, `sync_hash` from FactCreate |
| `backend/app/schemas/shopping_list_item.py` | Remove fields: `sync_status`, `temp_id`; delete `ShoppingListItemBatchCreate/Update/Delete/SyncRequest/SyncResult` schemas (lines 451-602) |
| `backend/app/services/shopping_list_item_service.py` | Remove `sync_status` management, `get_items_pending_sync()`, `get_items_with_conflicts()`, `resolve_conflict()` |
| `backend/app/services/write_behind_service.py` | Remove `is_offline_sync`, `sync_hash`, `content_hash` params and passthrough |

### Database — migration (run last)

| Table | Column | Extra |
|-------|--------|-------|
| `t_f_shopping_list` | `temp_id` | DROP UNIQUE constraint + index first |
| `t_f_shopping_list_item` | `sync_status` | DROP partial index `idx_shopping_list_item_sync_status` |
| `t_f_fact_*` + history | `is_offline_sync` | DROP |
| `t_f_fact_*` + history | `content_hash` | DROP indexes: `idx_budget_fact_content_hash`, `idx_budget_fact_history_content_hash` |
| `t_f_fact_*` + history | `sync_hash` | DROP indexes: `idx_budget_fact_sync_hash`, `idx_budget_fact_sync_dedup`, `idx_budget_fact_history_sync_hash` |

Total: 5 columns, 7 indexes dropped across fact + history tables + shopping tables.

**Kept** (real business use): `deleted_at`, `completed_at`, `last_modified_by`, `version` on ShoppingListItem.

**Not affected:** Redis (no Dexie keys/queues), Bot (no Dexie code).

---

## What Stays

- WebSocket infrastructure (`budgetWSClient/` core: connection, health, reconnect, multi-tab)
- All regular REST endpoints (facts, lists, plans, articles, financial centers, cost centers, stores, product groups)
- WS event handlers — simplified (DOM updates only, no Dexie writes)
- PWA installable (without offline cache — acceptable per intent)
- `networkDetector`-independent features: if any non-offline consumer exists, check before deleting

---

## Implementation Order (single branch, one pass)

All work in `dev/remove-dexie`. Deploy once at end.

1. **facts page** — `factsAPI.ts`, `dropdownAPI.ts`: DataLayer → direct API calls
2. **plan page** — `helpers.ts`, `index.ts`: replace; propose simplified `wsEventHandlers.ts` + `factsTable.ts` before implementing
3. **lists page** — `stateManager.ts`, `listOperations.ts`, `modalManager.ts`, `csvImporter.ts`, `autocomplete.ts`, `debugUtils.ts`: remove Dexie; remove temp_id reconciliation
4. **dashboard** — `factsManager.ts`, `categoryLoader.ts`, `saveTransaction.ts`, `saveTransfer.ts`, `saveTransaction.ts(plan)`, `windowExports.ts`: replace; delete `offlineDashboard.ts`
5. **shared** — `budgetShared.ts`: remove `_loadCategoriesFromDexie`; `monitoring/PerformanceMonitor.ts`: remove Dexie metrics
6. **WS client** — delete `syncHandler.ts`, `uploadHandler.ts`; strip Dexie from `eventHandlers.ts` + clean `types/events.ts` (proposal first)
7. **templates** — `base.html`, `login_email.html`, `2fa_verify.html`, `pwa-splash-screen.html`, `service-worker-registration.html`, `lists/initialization_script.html`, `recent_transactions.html`: remove all Dexie blocks; delete `navbar-sync-badge.html`, `dexie-indicator-manager.html`
8. **shared cleanup** — delete `frontend/shared/db/dexie/`, `DataLayer.ts`, diagnostic/notification/offline files listed above; delete Dexie tests (18 files); update `build-all.js`, `package.json`, `vitest.config.ts`
9. **backend** — delete `sync.py`, `sync_handlers.py`; modify `budget_ws.py`, `facts.py`, `shopping_list_items.py`, `shopping_lists.py`, `transfers.py`; modify services; update models + schemas; remove router registration
10. **migration** — Alembic migration: drop 5 columns + 7 indexes
11. **final verification** — see below

---

## WS Event Handler Simplification

After Dexie removal, handlers for `fact.created/updated/deleted`:
- **created/updated** → find DOM row by `fact_id`, update inline (existing HTMX swap / DOM update pattern)
- **deleted** → remove DOM row
- **No temp_id reconciliation** — shopping list/item creation waits for API response, then renders

Each WS handler change requires proposal before implementation (proposal-first zone per intent).

---

## Verification

After each module (steps 1–6): `npm run type-check` must pass; verify in browser: load, CRUD, WS live update.

Final (step 11):
```bash
npm run build
grep -rn "dexie\|Dexie\|DataLayer\|sync_status\|pendingOp\|temp_id\|is_offline_sync\|content_hash\|sync_hash\|isDexieActive\|getDexieManager\|offlineSync\|dexieActive" \
  frontend/web/static/js/ frontend/shared/ frontend/web/templates/
# must return 0 results

cd tests && ./run-tests.sh backend
npm run test:coverage              # remaining unit tests pass
npm run test:e2e                   # facts, plan, lists, dashboard golden paths
```

Migration: run on test server first, verify data intact, then prod.

---

## Constraints (from intent)

- Do NOT remove WebSocket infrastructure (`budgetWSClient/` core)
- Do NOT remove regular REST endpoints
- No new caching layer — plain API calls only
- `budget_ws.py`: MODIFY only (remove sync dispatch), do NOT delete
- Auth, production deploy: human-only actions
- Halt if removing Dexie dependency requires redesigning a non-trivial flow
- Escalate if a file mixes Dexie + non-Dexie logic in a non-obvious way

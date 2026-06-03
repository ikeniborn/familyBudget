# Intent: Lists Page — Bug Fixes + Edit List Feature

**Date:** 2026-06-03
**Status:** draft

## Objective

Fix 6 critical blocking issues on the /lists page and add list editing capability.
All issues block normal list workflow. Delivered as one PR.

Issues:
1. Add list edit modal (description + comment, possibly name/store)
2. Landing page item counters (X/Y completed) don't update after import — require multiple reloads
3. Google Sheets URL not saved — re-entered on every import
4. New product groups created during import don't appear in hierarchy tree without page reload
5. Delete completed items requires two passes — doesn't complete in one run
6. "Mark all as completed" button doesn't work immediately after import — requires F5

## Desired Outcomes

- Edit list modal: user can change description and comment (and name/store if applicable) from the list detail view
- After CSV/Google Sheets import: landing page cards immediately show correct X/Y completed counts
- Google Sheets URL saved to server, tied to the specific list — pre-filled on next import for that list
- After import with auto-create groups: new product groups appear in hierarchy tree immediately, no reload needed
- "Delete completed" works in a single pass — all marked items removed after one confirmation
- "Mark all as completed" works immediately after import without page refresh

## Health Metrics

- Offline sync (IndexedDB + WebSocket) must not degrade
- CSV import 5-stage wizard flow must remain intact
- Dashboard and facts page counters must not be affected
- Batch delete soft delete pattern must be preserved (deleted items kept for autocomplete history)

## Strategic Context

- Interacts with: `csvImporter.js`, `listsManager.ts`, `offlineShoppingManager`, `shopping_list_service`, `shopping_list_item_service`, `hierarchyView`
- Priority trade-off: **trust** (correctness) > speed > cost
- Delivery: single PR

## Constraints

### Steering (behavioral guidance)

- Edit list = modal window (consistent with item edit UX)
- Touch only broken code; no unrelated cleanup or refactoring
- Match existing patterns: window exports, Choices.js reinit, soft delete

### Hard (architectural enforcement)

- Google Sheets URL field added to `t_f_shopping_list` (DB migration required — full autonomy)
- API changes (new fields in `ShoppingListUpdate`, or new endpoint) — proposal-first before implementation
- No changes to offline sync internals (IndexedDB schema, sync_hash, conflict resolution)
- No changes to batch delete endpoint behavior — fix must be in frontend call logic

## Autonomy Zones

- Full autonomy (reversible, low risk): all frontend bug fixes (counters, delete, mark-all, groups display), DB migration for google_sheets_url field, edit modal UI
- Guarded (log + confidence threshold): any change touching offlineShoppingManager or WebSocket handlers
- Proposal-first (needs approval): API endpoint changes or schema additions beyond google_sheets_url
- No autonomy (human only): changes to offline sync conflict resolution logic

## Stop Rules

- Halt if: delete-completed bug root cause is inside offline sync or IndexedDB (escalate instead)
- Halt if: fixing counter refresh requires WebSocket schema changes
- Escalate if: Google Sheets URL storage needs user-level (not list-level) scope — re-confirm with user
- Done when:
  - All 6 issues verified working in browser (dev server)
  - No regressions in CSV wizard flow
  - Landing page counters update immediately after import
  - Edit list modal opens, saves, reflects changes
  - Delete completed works in one pass
  - Mark all works immediately after import

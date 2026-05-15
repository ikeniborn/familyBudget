# Facts Page: Delete Stat Double-Decrement & New-Row Render Mismatch

**Date:** 2026-05-15
**Type:** Bugfix
**Scope:** `/facts` page

## Problem

Two regressions on `/facts` page:

### Bug 1 — Stat counter decrements by 2 on single delete

User deletes one row, `#stat-total` decreases by 2. Page reload restores correct value (filtered count).

### Bug 2 — Newly added fact row renders with different markup

Row inserted after fact creation has different columns and styling than rows rendered on page load. Refresh fixes appearance.

## Root Causes

### Bug 1: Race between HTTP response and WebSocket event

`deleteFact()` in `frontend/web/static/js/facts/operations/factsController.ts:304`:

1. `await deleteFn(factId)` — backend commits delete + broadcasts WS `fact_deleted`
2. WS event arrives during the `await`, **before** `removeRowFromTable()` runs
3. `handleFactDeleted` (wsEventHandlers.ts:344) calls `consumeStatDecrement(id)` → returns `false` (set is empty) → `adjustStatTotal(-1)` → counter = N-1
4. `await` resolves → `removeRowFromTable` decrements again → counter = N-2, adds id to `statDecrementedIds` (no one will check anymore)

Fix `b66edf2e` is logically correct but inserts the guard flag **after** the await — WS event arrives **before** the await resolves.

### Bug 2: Server `/row-html` and client `renderFactRow` produce different markup

| Aspect | Client `renderFactRow` (`factsController.ts:891`) | Server `/row-html` (`facts.py:1432`) |
|---|---|---|
| Columns | 11 | 13 |
| ID cell | plain text `text-base-content/50 text-xs` | `<code class="badge badge-ghost">` |
| Reminder / recurring / offline | absent | three separate columns |
| `updated_at` column | present | absent |
| Checkbox `onchange` | none | `window.updateBatchDeleteButton?.()` |

`facts.html` table header has 11 `<th>` matching the client renderer. Server-rendered row injects 13 `<td>` → columns shift, ID style differs. Page reload re-renders all rows via client → consistent again.

## Solution

### Bug 1 — Mark `statDecrementedIds` before the await

In `deleteFact()` (`factsController.ts`):

- After confirm passes and **before** `await deleteFn(factId)`: `statDecrementedIds.add(factId)`
- On error in `catch`: `statDecrementedIds.delete(factId)` (rollback so the set doesn't leak)
- `removeRowFromTable()` no longer needs to add the id (already added); keep the 3s auto-expire timer scheduling there or move it to `deleteFact` — pick the path that keeps the set in one place.

Net effect: WS handler always sees the flag and skips its own decrement; `removeRowFromTable` decrements once on success.

### Bug 2 — Sync server `/row-html` (record_type=fact) with client renderer

In `backend/app/api/v1/endpoints/facts.py:1320` `get_fact_row_html`:

For `record_type == "fact"` branch only — `plan` branch unchanged:

- Drop columns: reminder icon, recurring icon, offline icon
- Add column: `updated_at` formatted (use existing `TableFormatters.formatUpdatedAt` equivalent — replicate logic server-side)
- Change ID cell from `<code class="badge badge-ghost">{id}</code>` to `<td class="text-base-content/50 text-xs">{id}</td>`
- Remove `onchange` from checkbox (client renderer has none)
- Mobile card: keep current structure but drop reminder/recurring/offline icons block to match client mobile card (which has no icons)

Result: 11-column row matching client `renderFactRow` and `renderFactMobileCard` exactly.

## Out of Scope

- Plan page (`record_type=plan`) markup — unchanged
- Other consumers of `/row-html` (WS `fact_updated`, transfer create) — automatically benefit from the same fix
- No new endpoints, no API contract changes

## Verification

1. Open `/facts` → delete one row → `#stat-total` decreases by exactly 1; refresh shows same value
2. Open `/facts` → create new fact → new row in desktop table has 11 cells aligned with header, ID styled like other rows, no extra icon columns; refresh — appearance identical
3. Mobile view (375px) — new card matches existing cards
4. Plan page (`/plan`) — no regression
5. E2E tests `tests/e2e/` covering facts CRUD pass

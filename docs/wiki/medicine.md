# Medicine Tracking

Family medicine tracking ("аптечка"): a shared catalog of medicines, per-package stock with quantities and expiry dates, SCD2 audit history on the catalog, and a daily expiry-alert broadcast over Telegram + Web Push. This page documents the Phase 1 (stock) feature as it exists in source.

## Overview

Two domains: a shared **catalog** (`Medicine`, dimension table, SCD Type 1 + history) and **stock** (`MedicineStock`, fact table, one row per physical package). Both are family-wide (no per-user scoping). Phase 1 covers catalog CRUD, stock CRUD, and expiry alerts.

- Design spec: `docs/MEDICINE_TRACKING_DESIGN.md`, `docs/superpowers/specs/2026-06-15-medicine-tracking-design.md`
- Phase plans (Phase 2+ courses/reminders/deduction/import are not yet in code): `docs/superpowers/plans/2026-06-15-medicine-tracking-phase*.md`
- See [[domain#Adjacent Subsystems]] for domain placement and [[database#SCD Type 1 + History-Table Pattern]] for the history pattern.

## Catalog Model

`Medicine` (`backend/app/models/medicine.py`) is a soft-archive dimension table `t_d_medicine`. It carries trade name, INN (groups analogues), dosage form, dosage, prescription flag, notes, and an `is_active` archive flag. There is no per-user ownership beyond `creator_id`.

Fields (`backend/app/models/medicine.py:7`):
- `name` (indexed), `inn` (indexed, nullable), `form`, `dosage`, `prescription_required`, `notes`
- `is_active` (indexed soft-archive flag, default `True`)
- `creator_id` → `t_d_user.id`, `created_at`, `updated_at`

`form` is constrained at the schema layer to `VALID_FORMS = {tablet, capsule, syrup, drops, ointment, spray, injection, other}` (`backend/app/schemas/medicine.py:6`). See [[database#Model Conventions]].

## Catalog Service

`medicine_service.py` (`backend/app/services/medicine_service.py`) does catalog CRUD, appends SCD2 history on every change, and guards hard deletes. List supports `active_only`, `ilike` name search, and pagination.

- `list_medicines` — orders by `name`, optional search on `name.ilike` (`:51`)
- `create_medicine` / `update_medicine` — set fields, then `_append_history` (`:74`, `:84`)
- `archive_medicine` — soft-archive via `is_active=False` (`:112`)
- `has_active_links` — `True` if any non-deleted stock references the medicine; blocks archive (`:101`)
- History is tracked only for `_HISTORY_FIELDS` (`:12`); `change_type` derives to `ARCHIVE`/`RESTORE` when `is_active` flips, else `UPDATE`.

## Stock Model

`MedicineStock` (`backend/app/models/medicine_stock.py`) is the fact table `t_f_medicine_stock` — one row per physical package on the shelf. It mirrors the shopping-list-item pattern: soft-delete (`deleted_at`) plus optimistic-locking `version`.

- `medicine_id` → `t_d_medicine.id` (indexed)
- `quantity_remaining`, `quantity_initial` (Decimal 10,3), `unit` (e.g. шт/мл/доз)
- `expiry_date` (indexed, date), `purchase_date`, `purchase_price` (module analytics only — NOT budget), `location`
- `version` (optimistic locking), `deleted_at` (NULL = active), `last_modified_by`, `creator_id`

There is **no** SCD2 history for stock — only the catalog has a `*_history` table. See [[database#Star Schema & Fact Table]].

## Stock Service

`medicine_stock_service.py` (`backend/app/services/medicine_stock_service.py`) does stock CRUD over active rows (`deleted_at IS NULL`), supports an `expiring_in_days` filter, and orders by `expiry_date` ascending.

- `list_stock` — filters by `medicine_id` and/or `expiry_date <= today + expiring_in_days` (`:15`)
- `update_stock` — applies non-null fields, bumps `version`, sets `last_modified_by` (`:49`)
- `soft_delete_stock` — sets `deleted_at`, bumps `version` (`:62`)
- Create requires the referenced medicine to exist (checked in the endpoint, `medicines.py:137`).

## History (SCD2)

`MedicineHistory` (`backend/app/models/medicine_history.py`) is `t_d_medicine_history` — one row per catalog change. SCD Type 2: each row snapshots all catalog fields plus tz-aware `valid_from`/`valid_to` and an `is_current` flag. The catalog table itself is SCD Type 1 (current state only).

- `valid_from`/`valid_to` use `DateTime(timezone=True)`; the open row's `valid_to = FAR_FUTURE_DATETIME` (`9999-12-31`, tz-aware UTC) (`:7`)
- `change_type` ∈ `CREATE/UPDATE/ARCHIVE/RESTORE`; `changed_fields` is a Postgres `ARRAY(String)`
- `_append_history` (`medicine_service.py:19`) closes the current row (`is_current=False`, `valid_to=now`) and inserts a new current snapshot. It deliberately writes naive-UTC (`datetime.utcnow`), not the SYSTEM_TIMEZONE wall-clock `_now()`.

See [[database#SCD Type 1 + History-Table Pattern]] for the shared history-column convention and the tz-aware sentinel gotcha.

## API Endpoints

`backend/app/api/v1/endpoints/medicines.py` exposes two routers — `/medicines` (catalog) and `/medicine-stock` — both registered in `backend/app/api/v1/router.py:146`. All routes require `get_current_user`. Mutations broadcast over WebSocket (see below).

Catalog (`router`, prefix `/medicines`):
- `GET ""` — list (`active_only`, `q`, `limit`, `offset`)
- `GET /search` — name search (`q` required)
- `GET /{medicine_id}` — fetch one (404 if missing)
- `POST ""` — create (201)
- `PATCH /{medicine_id}` — update
- `DELETE /{medicine_id}` — soft-archive; 409 if `has_active_links` (`:105`)

Stock (`stock_router`, prefix `/medicine-stock`):
- `GET ""` — list (`expiring_in_days`, `medicine_id`, pagination)
- `POST ""` — create (201; 404 if medicine missing)
- `PATCH /{stock_id}` — update
- `DELETE /{stock_id}` — soft-delete (204)

See [[api#Medicine Endpoints]] for the API index entry.

## Web Pages

Two server-rendered Jinja pages under `/medicines/*`, defined in `backend/app/api/web/router.py:492`. Both are thin shells that load the `medicines.min.js` bundle, which fetches data via the REST API on `DOMContentLoaded`.

- `/medicines/catalog` → `frontend/web/templates/medicines_catalog.html` — add-medicine form + catalog table
- `/medicines/stock` → `frontend/web/templates/medicines_stock.html` — the "Аптечка" page: add-package form, "Все" / "Истекает ≤30д" filter buttons, stock table

## Stock Page (Frontend)

`frontend/web/static/js/medicines/medicinesManager.ts` renders both pages from REST data and reacts to WS events. The stock view flags expiry: rows expiring within 30 days get a ⏰ badge — `badge-error` if already expired (`<= today`), else `badge-warning` (`medicinesManager.ts:88`).

- `loadStock(expiringDays?)` — fetches `/api/v1/medicine-stock`, optionally with `expiring_in_days` (`:76`)
- `loadCatalog`, `createMedicineFromForm`, `medicineArchive`, `createStockFromForm`, `stockDelete` — REST wrappers with toasts
- Public functions are attached to `window` via `frontend/web/static/js/medicines-bundle.ts` (bundle `medicines`, `build-all.js:209`)
- See [[frontend#Window-Exports Pattern]] and [[frontend#Vite IIFE Bundle Pipeline]].

## Realtime Updates

Every catalog/stock mutation calls `broadcast_medicine_changed(entity, data)` (`backend/app/api/v1/endpoints/budget_ws.py:1119`). It emits `medicine_stock_changed` for stock and `medicine_{entity}_changed` otherwise, to all connected clients (no channels/subscriptions, like `shopping_list_*`).

- Client subscribes via `budgetWSClient.on('medicine_catalog_changed' | 'medicine_stock_changed', ...)` (`medicines-bundle.ts:21`)
- `handleMedicineEvent` reloads the catalog or stock table if its DOM root is present (`medicinesManager.ts:133`)
- See [[realtime#Event Catalog & Payload Filtering]] and [[realtime#Connection Lifecycle]].

## Expiry Alerts

`medicine_alert_service.py` (`backend/app/services/medicine_alert_service.py`) runs a daily broadcast of stock expiring within `EXPIRY_WINDOW_DAYS = 30` (`:20`) and `quantity_remaining > 0`, joined to the medicine name. It is a broadcast to all active users — there are no per-item reminder rows in Phase 1.

- `get_expiring_stock` — raw SQL join `t_f_medicine_stock` ⨝ `t_d_medicine` on the 30-day cutoff (`:34`)
- `send_expiry_alerts` — Telegram message (users with `enable_telegram_notifications`) + Web Push (`enable_push_notifications`), via `NotificationService` / `PushService` (`:50`)
- Web Push payload: `{type: "medicine_expiry", url: "/medicines/stock"}` (Phase 1 targets the stock page; design spec #5 says `/medicines` in Phase 2) (`:69`)

## Scheduler Wiring

The alert is driven by APScheduler job `medicine_maintenance` — daily at 03:00 SYSTEM_TIMEZONE (after recurring facts at 02:00), registered in `backend/app/scheduler.py:544`. The job takes Postgres advisory lock `LOCK_ID_MEDICINE_MAINTENANCE = 1010` so only one worker runs it.

- `medicine_maintenance_job` (`scheduler.py:361`) acquires the lock, then calls `send_expiry_alerts`; logs the push count
- `LOCK_ID_MEDICINE_DISPATCH = 1009` is reserved for Phase 3 (5-min dispatch) and is unused in current code
- No bot command handlers reference medicine — bot involvement is limited to the Telegram message sent by the alert service. See [[bot#Notification Service]].

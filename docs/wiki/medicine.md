# Medicine Tracking

Family medicine tracking ("аптечка"): a shared catalog of medicines, per-package stock with quantities and expiry dates, SCD2 audit history on the catalog, daily expiry-alert broadcast, and (Phase 2) intake courses with an auto-generated schedule log and real-time take/skip marking.

## Overview

Three domains: a shared **catalog** (`Medicine`, dimension table, SCD Type 1 + history), **stock** (`MedicineStock`, fact table, one row per physical package), and (Phase 2) **courses + intake log** (`MedicineCourse` + `MedicineIntakeLog`). All data is family-wide (no per-user scoping). Phase 1 covers catalog CRUD, stock CRUD, and expiry alerts. Phase 2 adds intake planning and tracking.

- Design spec: `docs/MEDICINE_TRACKING_DESIGN.md`, `docs/superpowers/specs/2026-06-15-medicine-tracking-design.md`
- Phase plans: `docs/superpowers/plans/2026-06-15-medicine-tracking-phase*.md`
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

The APScheduler job `medicine_maintenance` runs daily at 03:00 SYSTEM_TIMEZONE (after recurring facts at 02:00), registered in `backend/app/scheduler.py:549`. It acquires Postgres advisory lock `LOCK_ID_MEDICINE_MAINTENANCE = 1010` so only one worker runs it.

Phase 2 expanded the job to three sequential steps: (а) `generate_all` (intake_log 7 days ahead), (б) `mark_overdue_late` (scheduled→late), (в) `send_expiry_alerts` (Phase 1 expiry broadcast). `scheduler.py:361`.

- `LOCK_ID_MEDICINE_DISPATCH = 1009` is reserved for Phase 3 (5-min dispatch) and is unused in current code
- No bot command handlers reference medicine — bot involvement is limited to the Telegram message sent by the alert service. See [[bot#Notification Service]].

---

## Phase 2 — Courses & Intake Schedule

Phase 2 adds `MedicineCourse` (an intake plan for one patient) and `MedicineIntakeLog` (one row per scheduled dose). Courses reference the catalog via `medicine_id`; the intake log is auto-generated up to 7 days ahead and kept current by the daily maintenance job. See [[database#Phase 2 Medicine Tables]] and [[api#Medicine Endpoints (Phase 2)]].

## Course Model

`MedicineCourse` (`backend/app/models/medicine_course.py`) is `t_f_medicine_course` — one row per prescribed intake plan. It is family-wide like catalog/stock; `patient_id` links to `t_d_family_member`, `medicine_id` links to `t_d_medicine`.

Key fields:
- `medicine_id` → `t_d_medicine.id` (ON DELETE RESTRICT), `patient_id` → `t_d_family_member.id` (ON DELETE RESTRICT)
- `prescribed_by` (nullable, free text — "Doctor / self"), `dose_amount` (Decimal 10,3), `dose_unit`
- `intake_times` (JSONB, e.g. `["08:00","14:00","20:00"]` in SYSTEM_TIMEZONE; frequency = `len(intake_times)`)
- `with_food` (nullable, CHECK `before/with/after/any`), `comment`
- `schedule_type` (CHECK `daily/every_n_days/weekdays`, default `daily`), `schedule_config` (JSONB: `{"n":2}` or `{"days":["mon","wed","fri"]}`)
- `start_date` (date, required), `end_date` (nullable — `NULL` = ongoing)
- `is_active` (indexed), `reminders_enabled`, `notification_channels` (JSONB, default `["telegram","web_push"]`), `snooze_minutes` (default 30)
- `deleted_at` (nullable, indexed — soft delete; `NULL` = live course), `creator_id` → `t_d_user.id`

There is no SCD2 history table for courses. See [[database#Model Conventions]].

## Intake Log Model

`MedicineIntakeLog` (`backend/app/models/medicine_intake_log.py`) is `t_f_medicine_intake_log` — one row per scheduled dose slot, generated by `generate_for_course`. It denormalizes `patient_id` to allow fast date+patient filter without a join.

Key fields:
- `course_id` → `t_f_medicine_course.id` (ON DELETE CASCADE), `patient_id` → `t_d_family_member.id` (denormalized)
- `scheduled_at` (naive TIMESTAMP, SYSTEM_TIMEZONE), `taken_at` (nullable)
- `status` (CHECK `scheduled/taken/skipped/late`, default `scheduled`)
- `dose_taken` (nullable Decimal 10,3), `stock_id` → `t_f_medicine_stock.id` (ON DELETE SET NULL, Phase 4 deduction, currently unused)
- `marked_by` → `t_d_user.id` (nullable), `version` (int, default 1 — optimistic locking)
- UNIQUE constraint `uq_intake_course_scheduled` on `(course_id, scheduled_at)` — idempotency backstop

## Schedule Helpers

`backend/app/services/medicine_schedule.py` is a pure (no DB) module of scheduling helpers used by both the intake service and the API estimate.

- `expand_schedule(intake_times, schedule_type, schedule_config, start_date, end_date, window_start, window_end)` — returns all scheduled naive datetimes within the window, honoring course start/end and the three schedule types.
  - `daily`: every day
  - `every_n_days`: `(day - start_date).days % n == 0` where `n = schedule_config["n"]`
  - `weekdays`: day-of-week in `schedule_config["days"]` (mon/tue/wed/thu/fri/sat/sun)
- `intakes_per_day(intake_times, schedule_type, schedule_config)` — average daily intakes for the estimate.
- `estimate_stock(remaining, dose_amount, intake_times, schedule_type, schedule_config)` → `{remaining, intakes_left, days_left, in_stock}` — "хватит на N приёмов/дней" (decision #7). `days_left` is `None` when `per_day == 0`.

## Intake Generation

`generate_for_course` (`backend/app/services/medicine_intake_service.py:24`) inserts intake rows for a given window. It is idempotent: pre-filters already-existing slots, then issues a bulk `INSERT ... ON CONFLICT (course_id, scheduled_at) DO NOTHING` as a concurrency backstop.

- `generate_all(session, horizon_days=7)` — runs `generate_for_course` for every active, non-deleted course from `today` to `today + GENERATION_HORIZON_DAYS` (7). Returns total new rows.
- Called on **course create** (immediately, so today's doses appear), and **nightly** by the maintenance job.
- **Lazy-backfill**: `GET /api/v1/medicine-intakes` (with `date=today` or no date) calls `generate_all` before querying, so the dashboard stays correct even if the nightly job lagged.

## Overdue Marking

`mark_overdue_late` (`medicine_intake_service.py:72`) bulk-updates `status='late'` for rows where `status='scheduled'` and `scheduled_at < now − 24h`. Called daily by the maintenance job after generation.

## Intake Marking

`mark_intake` (`medicine_intake_service.py:121`) sets status to `taken` or `skipped` using optimistic locking: checks `intake.version == expected_version`, increments `version`, sets `taken_at` (for `taken`), and commits. Raises `IntakeVersionConflict` on mismatch, which the endpoint maps to HTTP 409.

Phase 2 marks status only. Phase 4 will add stock deduction inside the `taken` branch.

## Stock Estimate per Course

`course_estimate` (`medicine_course_service.py:96`) aggregates `Σ stock.quantity_remaining` across active, non-deleted packages for the course's `medicine_id`, then delegates to `estimate_stock` from `medicine_schedule.py`. The result — `{remaining, intakes_left, days_left, in_stock}` — is attached to every course API response.

Decision #6 (soft link): course creation is **not blocked** when stock is empty — the API validates that the medicine and patient exist (404 if missing), but does not require `in_stock`. The estimate simply reflects `intakes_left=0`.

## API Endpoints (Phase 2)

Two routers are defined in `backend/app/api/v1/endpoints/medicine_courses.py` and registered in the v1 router. Both require `get_current_user`. See [[api#Medicine Endpoints (Phase 2)]] for the index entry.

**Courses** (`prefix="/medicine-courses"`):
- `GET ""` — list (`active_only=True`, `patient_id`, `limit`, `offset`); each item includes a `StockEstimate`.
- `GET /{course_id}` — fetch one with estimate (404 if deleted/missing).
- `POST ""` — create (201); validates `medicine_id` and `patient_id` exist (404); generates first horizon immediately; broadcasts `medicine_course_changed`.
- `PATCH /{course_id}` — partial update; broadcasts `medicine_course_changed`.
- `POST /{course_id}/pause` — sets `is_active=False`; broadcasts `medicine_course_changed`.
- `POST /{course_id}/complete` — sets `is_active=False`, `deleted_at=now` (soft delete); broadcasts `medicine_course_changed`.
- `DELETE /{course_id}` — alias for `complete`.

**Intakes** (`prefix="/medicine-intakes"`):
- `GET ""` — list by `date` (`'today'` or `YYYY-MM-DD`; malformed → 422), `patient_id`, `course_id`. Triggers lazy-backfill when `date` is `None` or `'today'`. Returns joined rows with `medicine_name`, `patient_name`, `dose_amount`, `dose_unit`, `with_food`.
- `POST /{intake_id}/take` — body: `IntakeMarkRequest{version, dose_taken?, comment?}`; sets `status=taken`; broadcasts `medicine_intake_marked`; 409 on stale version.
- `POST /{intake_id}/skip` — same body; sets `status=skipped`; broadcasts `medicine_intake_marked`; 409 on stale version.

## Web Pages (Phase 2)

Three new Jinja2 page routes under `/medicines*` (in addition to Phase 1's `/medicines/catalog` and `/medicines/stock`), defined in `backend/app/api/web/router.py:512`.

- `GET /medicines` → `medicines_dashboard.html` — today's intake schedule (lazy-backfill on load), inline take/skip buttons.
- `GET /medicines/courses` → `medicines_courses.html` — course list with in-stock estimate hints and create-course dialog.
- `GET /medicines/courses/{course_id}` → `medicines_course_detail.html` — course card + intake journal for a specific course.

## Realtime Updates (Phase 2)

Two new WebSocket events broadcast to all connected clients when a course or intake changes. Client subscribes via `budgetWSClient.on`. No field whitelist is applied (like Phase 1 medicine events). See [[realtime#Event Catalog & Payload Filtering]].

- `medicine_course_changed` — emitted on create, update, pause, and complete. Payload: full `MedicineCourseResponse` including `StockEstimate`.
- `medicine_intake_marked` — emitted on take and skip. Payload: full `IntakeResponse`.

Both are broadcast via helpers `broadcast_medicine_course_changed` / `broadcast_medicine_intake_marked` imported from `budget_ws.py` into `medicine_courses.py`.

---

## Phase 3 — Reminders

Phase 3 adds push notifications for intake reminders. A `MedicineReminder` row is created for every scheduled intake — one row per recipient — and a dedicated 5-minute dispatch job delivers them via Telegram inline buttons and/or Web Push. See [[database#Phase 3 Medicine Table]], [[realtime#Medicine Reminder Dispatch (Phase 3)]], and [[bot#Medicine Commands (Phase 3)]].

### Reminder Model

`MedicineReminder` (`backend/app/models/medicine_reminder.py`) is `t_medicine_reminder` — a service table (no SCD history). Each row tracks one push to one user for one dose.

- `intake_log_id` → `t_f_medicine_intake_log.id` (ON DELETE CASCADE), `recipient_user_id` → `t_d_user.id` (ON DELETE CASCADE).
- `reminder_datetime` TIMESTAMP (naive, SYSTEM_TIMEZONE), `status` CHECK(`pending/sent/failed/cancelled`).
- `telegram_sent`, `web_push_sent` BOOLEAN flags; `retry_count` INT (max 3 before `failed`); `error_message` VARCHAR(1000).
- UNIQUE `uq_medicine_reminder_recipient` on `(intake_log_id, recipient_user_id)` — one row per intake per recipient, used as the dedup backstop for concurrent inserts.
- Migration: revision `m3c4d5e6f7a8` (after `m2b3c4d5e6f7`).

### Reminder Service

`MedicineReminderService` (`backend/app/services/medicine_reminder_service.py`) handles the full lifecycle.

- `create_reminders_for_intake(session, intake, course, patient)` — fan-out: creates one `pending` row for the guardian user plus one for the linked patient user (if distinct). Each insert runs in a `SAVEPOINT` so a UNIQUE-conflict rolls back only that row.
- `get_due(session, batch_size=100)` — returns `pending` rows with `reminder_datetime <= now`, ordered chronologically.
- `send(session, reminder)` — loads related rows (intake, course, medicine, patient, user), then: sends Telegram message with three inline buttons (`med:take`, `med:skip`, `med:snooze`) if `"telegram"` in `course.notification_channels` and user has `telegram_id`; sends Web Push (`tag="medicine-reminder"`, `data.type="medicine_reminder"`, `data.url="/medicines"`) if `"web_push"` in channels. Returns `(telegram_sent, web_push_sent)`. On total failure increments `retry_count`; after 3 retries marks `status=failed`.
- `snooze(session, intake_id, recipient_user_id)` — updates the existing reminder row in place to `reminder_datetime = now + course.snooze_minutes` (`status=pending`). Creates a new row if none exists.

### Dispatch Job

`medicine_reminder_dispatch_job` (`backend/app/scheduler.py:383`) runs every 5 minutes. Uses advisory lock `LOCK_ID_MEDICINE_DISPATCH = 1009` (single-worker guarantee). Fetches up to 100 due reminders and calls `svc.send` for each. See [[realtime#Medicine Reminder Dispatch (Phase 3)]].

### New Endpoints (Phase 3)

Added to `backend/app/api/v1/endpoints/medicine_courses.py`. Both require `get_current_user`.

- `GET /api/v1/medicine-intakes/{intake_id}` — fetch a single intake log row (`IntakeResponse`); 404 if not found.
- `POST /api/v1/medicine-intakes/{intake_id}/snooze` — snooze the caller's reminder for this intake to `now + course.snooze_minutes`; returns the updated `IntakeResponse`.

### Bot Integration

The bot exposes three Phase 3 entry points. `/medicines` opens the Web App. `/taken` marks the nearest pending intake today as taken directly from chat. Reminder messages sent by `send()` carry inline buttons `med:take:{log_id}` / `med:skip:{log_id}` / `med:snooze:{log_id}` handled by `medicine_callback`. See [[bot#Medicine Commands (Phase 3)]].

### Expiry Alert Web Push (Updated)

`send_expiry_alerts` in `medicine_alert_service.py` now also sends Web Push using the shared `_send_web_push` helper with `tag="medicine-expiry"`, `data_type="medicine_expiry"`, `data.url="/medicines"` (updated from Phase 1). See [[realtime#Medicine Reminder Dispatch (Phase 3)]] for the full payload table.

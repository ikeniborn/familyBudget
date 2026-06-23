# Medicine Tracking

The medicine-tracking subsystem ("семейная аптечка") manages a shared family medicine catalog, physical stock packages, per-patient intake courses, a scheduled-dose journal, multi-channel reminders, automatic stock deduction, expiry/low-stock alerts, purchase analytics, CSV/Google Sheets import, and shopping-list integration. It follows the project's existing Dimension/Fact + SCD + reminder-dispatcher patterns (see [[architecture]], [[database]]). Visibility is family-wide: every authenticated user sees and edits everything; `patient_id` only drives course assignment and reminder routing, not isolation.

The backend splits into focused services under `backend/app/services/` (one per concern), REST endpoints under `backend/app/api/v1/endpoints/` (see [[api]]), and two scheduler jobs in `backend/app/scheduler.py`. Two design decisions recur throughout: medicines use a **soft link** to stock (a course can exist without any stock), and purchase prices feed **module-only analytics**, never the household budget.

## Medicines Catalog

The catalog (`t_d_medicine`, model `Medicine`) is a shared SCD Type 1 dimension; full change history is appended to `t_d_medicine_history` (SCD Type 2). Deletion is soft-archive only; see [[database]].

`medicine_service.py` exposes `list_medicines` (name `ilike` search, active filter, pagination), `get_medicine`, `create_medicine`, `update_medicine`, and `archive_medicine`. Tracked fields are `name`, `inn` (groups analogues), `form` (one of `VALID_FORMS`: tablet/capsule/syrup/drops/ointment/spray/injection/other), `dosage`, `prescription_required`, `notes`, `is_active`.

Every create/update calls `_append_history`, which closes the current `MedicineHistory` row (`is_current=False`, `valid_to=now`) and inserts a fresh current snapshot. `change_type` is derived: `CREATE`, `UPDATE`, or — when `is_active` flips — `ARCHIVE`/`RESTORE`. The SCD2 `valid_from`/`valid_to` columns are tz-aware (`TIMESTAMPTZ`, sentinel `FAR_FUTURE_DATETIME` = 9999-12-31); history is written as naive-UTC (`datetime.utcnow`), deliberately not the SYSTEM_TIMEZONE wall-clock `_now()`.

`has_active_links` counts non-deleted `MedicineStock` and `MedicineCourse` rows; the `DELETE /medicines/{id}` endpoint returns `409` when links exist, blocking archive of an in-use medicine. Endpoints live in `medicines.py` (`GET/POST/PATCH/DELETE /medicines`, `GET /medicines/search`); mutations broadcast `broadcast_medicine_changed("catalog", ...)` over WebSocket (see [[realtime]]).

## Courses & Schedules

A course (`t_f_medicine_course`, model `MedicineCourse`) is an intake plan assigning one medicine to one `patient_id` (a `t_d_family_member`, possibly a child without an account). `medicine_course_service.py` handles CRUD plus lifecycle.

Core fields: `dose_amount`/`dose_unit`, `intake_times` (JSON list like `["08:00","14:00","20:00"]` in SYSTEM_TIMEZONE — frequency is `len(intake_times)`, not stored separately), `with_food` (before/with/after/any), `start_date`/`end_date` (NULL = ongoing), `schedule_type` (`VALID_SCHEDULE`: daily/every_n_days/weekdays), `schedule_config` (`{"n":2}` or `{"days":["mon","wed","fri"]}`), plus `reminders_enabled`, `notification_channels` (default `["telegram","web_push"]`), and per-course `snooze_minutes` (default 30).

`create_course` accepts a `duration_days` shortcut that computes `end_date = start_date + (duration-1) days`. `pause_course` sets `is_active=False`; `complete_course` (also used by `DELETE /medicine-courses/{id}`) deactivates **and** soft-deletes (`deleted_at`). On creation the course endpoint immediately runs `generate_for_course` for the first horizon window so today's doses appear without waiting for the nightly job.

Pure scheduling math lives in `medicine_schedule.py`: `expand_schedule` materializes datetime slots within a window honoring `start_date`/`end_date` and `_day_active` (daily / every-N-days modulo / weekday set). `estimate_stock` (via `course_estimate` → `aggregate_remaining`) computes a read-only "хватит на N приёмов/дней": `intakes_left = remaining // dose_amount`, `days_left = floor(intakes_left / intakes_per_day)`. The estimate is attached to every course API response as `StockEstimate`.

## Intake Logging

The intake journal (`t_f_medicine_intake_log`, model `MedicineIntakeLog`) holds one immutable row per scheduled dose — `status` in `scheduled/taken/skipped/late`, optimistic-locking `version`, `marked_by`. `medicine_intake_service.py` drives it.

`generate_for_course` expands the schedule and inserts log rows for the window, fanning out reminders per row. It is idempotent: `UNIQUE(course_id, scheduled_at)` plus a `SAVEPOINT` (`begin_nested`) makes a duplicate roll back only its own row, not the batch. `generate_all` runs this `GENERATION_HORIZON_DAYS` (7) ahead for every active, non-deleted course. `mark_overdue_late` flips `scheduled → late` when `scheduled_at < now - 24h`. `list_intakes` returns rows joined to medicine + family-member names for the dashboard and course journal.

`mark_intake` applies optimistic locking — a stale `expected_version` raises `IntakeVersionConflict` (→ HTTP `409`). On `taken` it records `taken_at`/`dose_taken`, deducts stock (see [[medicine#Stock & Deduction]]), and on out-of-stock auto-adds the medicine to a shopping list (see [[medicine#Shopping Integration]]) — all in one transaction. Endpoints in `medicine_courses.py`: `GET /medicine-intakes` (filters `patient_id`/`course_id`/`date`, with lazy-backfill via `generate_all` when opened), `POST .../take`, `POST .../skip`, `POST .../snooze`, `GET .../{id}`. Marks broadcast `broadcast_medicine_intake_marked` (and a stock event when a package changed).

## Reminders

`MedicineReminderService` (`medicine_reminder_service.py`) mirrors the budget `ReminderService` pattern. A reminder (`t_medicine_reminder`, model `MedicineReminder`) is one push per `(intake_log_id, recipient_user_id)`; see [[realtime]].

`create_reminders_for_intake` fans out one row per recipient — the patient's `guardian_user_id` plus `linked_user_id` if set — deduplicated by `UNIQUE(intake_log_id, recipient_user_id)` via SAVEPOINT. It is a no-op when the course has reminders disabled or no channels. `get_due` selects `pending` rows with `reminder_datetime <= now` (batch 100).

`send` resolves the related course/medicine/patient/user, builds a Russian message ("💊 Пора принять…"), and delivers over the course's `notification_channels`. Telegram sends via `sendMessage` with inline buttons `med:take:{id}` / `med:skip:{id}` / `med:snooze:{id}` (respecting `enable_telegram_notifications`); Web Push (`_send_web_push`, gated on VAPID config and `enable_push_notifications`) sends a buttonless payload whose click opens `/medicines`, deleting `410 Gone` subscriptions. `snooze` updates the recipient's existing row in place to `now + course.snooze_minutes` (default 30), resetting send state. The `medicine_reminder_dispatch_job` (every 5 min, advisory-lock `1010`-adjacent `LOCK_ID_MEDICINE_DISPATCH`) drains `get_due` and calls `send`.

## Stock & Deduction

Stock (`t_f_medicine_stock`, model `MedicineStock`) models one physical package per row — multiple packages per medicine (different expiry/lot) — with soft-delete and optimistic `version`, mirroring `shopping_list_item` (see [[database]]).

`medicine_stock_service.py` provides CRUD (`list_stock` with `expiring_in_days`/`medicine_id` filters, ordered by `expiry_date`; `create_stock`, `update_stock`, `soft_delete_stock` — the latter two bump `version` and set `last_modified_by`). Endpoints in `medicines.py`: `GET/POST/PATCH/DELETE /medicine-stock` plus `GET /medicine-stock/analytics`; all mutations broadcast `broadcast_medicine_changed("stock", ...)`.

`medicine_deduction_service.py` (`deduct_for_intake`) runs atomically inside `mark_intake`'s transaction. If the request names `preferred_stock_id`, it locks that package `FOR UPDATE` (guarded so it must belong to the course's medicine); otherwise it picks FIFO by `expiry_date ASC LIMIT 1 FOR UPDATE` among packages with `quantity_remaining > 0` and `deleted_at IS NULL`. It subtracts the dose (clamping to 0 for a partial package), sets `intake.stock_id`, and returns `DEDUCTED`; with no eligible package it returns `OUT_OF_STOCK` (triggering shopping-list add). The `FOR UPDATE` lock prevents concurrent takes from double-spending.

## Low-Stock Alerts

`medicine_alert_service.py` produces daily expiry alerts. `get_expiring_stock` selects non-deleted packages with `quantity_remaining > 0` and `expiry_date <= today + EXPIRY_WINDOW_DAYS` (30), joined to medicine name.

`send_expiry_alerts` **broadcasts directly to all active users** (no `t_medicine_reminder` rows — those are only for course intakes), reusing `NotificationService.get_active_users` for Telegram and `MedicineReminderService._send_web_push` (with `tag="medicine-expiry"`, `data_type="medicine_expiry"`, click → `/medicines`) for Web Push. It runs inside `medicine_maintenance_job` (daily 03:00 SYSTEM_TIMEZONE) alongside `generate_all` and `mark_overdue_late`, guarded by advisory lock `LOCK_ID_MEDICINE_MAINTENANCE`. See [[realtime]] for the dispatch model.

## Analytics

`medicine_analytics_service.py` (`purchase_analytics`) is a module-only purchase report — explicitly **not** wired to the budget. It sums `t_f_medicine_stock.purchase_price` per medicine into `total_spent` + a `by_medicine` breakdown.

It surfaces at `GET /medicine-stock/analytics` (in `medicines.py`) as `MedicineAnalyticsResponse`. Because pricing stays inside the module, this analytics path is deliberately decoupled from the budget Fact tables described in [[domain]].

## Import

`medicine_import_service.py` supports CSV / Google Sheets import for two entities — stock and courses — via the shared analyze → preview → execute flow (see [[import]]), reusing `csv_detector`, `csv_security`, and `csv_validator` helpers.

`auto_map` matches columns to fields by case-insensitive substring synonyms (Russian + English) defined in `STOCK_FIELDS`/`COURSE_FIELDS`; required sets are `STOCK_REQUIRED` (name/quantity/unit) and `COURSE_REQUIRED` (patient/medicine/dose_amount/intake_times/start_date). `parse_intake_times` splits `"08:00;20:00"` / `"09:00, 13:00"`. `preview_stock`/`preview_courses` are dry-run validators (per-row errors/warnings, length caps mirroring SQLModel `max_length`); course preview warns when the medicine has no active stock (soft link). `execute_stock`/`execute_courses` use find-or-create helpers: `_find_or_create_medicine` (matches by name+dosage, defaults invalid forms to `other`), `_find_or_create_member`, committing atomically via `_commit_or_fail` (rollback → structured error, never a 500).

Endpoints live in `medicine_import.py`: `/medicine-stock/import/{analyze,preview,execute}`, `/medicine-stock/google-sheets/fetch`, and the parallel `/medicine-courses/...` routers. Google Sheets URLs are resolved through `google_sheets_parser` into base64 CSV before analyze.

## Shopping Integration

`medicine_shopping_integration.py` bridges the аптечка to the shopping subsystem (see [[domain]]). When a take hits `OUT_OF_STOCK`, `add_to_shopping_list` adds the medicine to a restock list so the family knows to rebuy it.

It find-or-creates a dedicated list `"Аптечка — докупить"`, a `"Аптека"` store, and a `"Лекарства"` product group (reusing `csv_validator.get_or_create_store` / `get_or_create_product_group`), then inserts a `ShoppingListItem` (`quantity=1`, `unit="шт"`, comment "Закончилось — автодобавление из аптечки"). The add is idempotent-ish: it skips when an active (non-completed, non-deleted) item for the same product name already exists. The caller commits within the intake transaction.

## Bot Interface

`bot/handlers/medicine.py` provides the Telegram surface (see [[bot]]). `medicine_handler` (`/medicines`) opens the medicines Web App by rewriting the webapp URL to `…/index.html#/medicines`; both commands require an authenticated session.

`taken_handler` (`/taken`) is a quick-mark shortcut: it lists today's intakes (`GET /medicine-intakes?date=today`), takes the nearest `scheduled`/`late` dose via `POST /medicine-intakes/{id}/take` (passing its `version`), and confirms with the medicine name + time. `medicine_callback` handles the inline reminder buttons `med:take/skip/snooze:{log_id}`: for take/skip it re-fetches the intake to read the current `version` before posting, and for snooze it calls the snooze endpoint — degrading gracefully to "open the app" on any error.

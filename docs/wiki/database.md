# Database

The persistence layer is async SQLAlchemy/SQLModel over PostgreSQL 16, organised as a star schema (dimensions + `t_f_budget_fact`) with closure-table hierarchies, history tables for audit, and Alembic migrations. See [[architecture]] and [[domain]] for the entities.

## Async Engine & Session

A single async engine with a bounded connection pool backs all DB access; sessions are yielded per request and auto-commit on success or roll back on exception. Defined in `backend/app/db/session.py`.

- `create_async_engine(DATABASE_URL, pool_size=5, max_overflow=10, expire_on_commit=False)` — `backend/app/db/session.py:19`.
- `get_session()` — FastAPI dependency, commit/rollback/close lifecycle — `backend/app/db/session.py:35`.
- `get_session_context()` — `@asynccontextmanager` for background jobs and the scheduler — `backend/app/db/session.py:59`.
- `init_db()` is a no-op; schema is owned by Alembic. `close_db()` disposes the engine on shutdown.
- Driver: `postgresql+asyncpg://` at runtime; see [[realtime]] for the Redis side of live updates.

## Health Checks

Connectivity is verified by running `SELECT 1` on a fresh connection; failures are caught and reported as a boolean/status dict for the `/health` endpoint. Defined in `backend/app/db/health.py`.

- `check_db_connection()` → `bool`, swallows `SQLAlchemyError` — `backend/app/db/health.py:13`.
- `get_db_status()` → `{"status", "message"}` for richer reporting — `backend/app/db/health.py:43`.
- Consumed by the API health route (see [[api#Health Endpoints]]).

## Model Conventions

Models are SQLModel classes (`table=True`) registered in `backend/app/models/__init__.py` (~37 models across 41 files). Tables use a `t_d_` (dimension), `t_f_` (fact), or `t_*_history` naming scheme; PKs are surrogate `id: int | None`.

- Aggregate import + design-pattern overview: `backend/app/models/__init__.py`.
- Audit columns `created_at` / `updated_at` use `default_factory=datetime.utcnow` (e.g. `backend/app/models/article.py:175`).
- `User` carries DB-level constraints via `__table_args__`: `chk_user_has_auth_method` and a partial-unique email index — `backend/app/models/user.py:101`. See [[auth#User Model & Auth Methods]].
- Tables map explicitly via `__tablename__` (e.g. `t_d_article`, `t_d_user`, `t_f_budget_fact`).

## Star Schema & Fact Table

`BudgetFact` (`t_f_budget_fact`) is the central fact table; it does NOT use SCD versioning and stores dimension FKs captured at transaction time so history survives dimension edits. Defined in `backend/app/models/fact.py`.

- FKs: `user_id`, `article_id` (required), `financial_center_id`, `cost_center_id` (optional) — `backend/app/models/fact.py:62`.
- Partitioned monthly on `fact_date` at the DB level (96 partitions, 2023–2030) — see baseline migration below.
- `ArticleUsageStats` (`t_article_usage_stats`) is a daily-recalculated aggregate keyed by `article_id` — `backend/app/models/article.py:202`.

## ID Pre-Generation (Write-Behind)

IDs can be reserved from PostgreSQL sequences before the row is written, so the API returns an ID immediately while the write is queued asynchronously. Defined in `backend/app/services/id_generator.py`.

- `get_next_fact_id()` runs `SELECT nextval('t_f_budget_fact_id_seq')` — `backend/app/services/id_generator.py:27`.
- `get_next_transfer_id()` derives `MAX(transfer_id)+1` for paired transfer facts — `backend/app/services/id_generator.py:55`.
- Sequence gaps are expected and acceptable; nextval is atomic for concurrent workers.

## SCD Type 1 + History-Table Pattern

The dominant pattern: dimension tables hold only current data (in-place UPDATE), while a parallel `*_history` table records every version (SCD Type 2 temporal validity) for audit. The stable dimension `id` never changes, keeping fact FKs valid.

- Current-data tables: `Article` (`backend/app/models/article.py`), `User` (`backend/app/models/user.py`), plus `Medicine`, `Store`, `ProductGroup` (all "SCD Type 1" in `backend/app/models/__init__.py`).
- History tables (one row per change, FK to the stable dimension `id`): `article_history`, `user_history`, `cost_center_history`, `financial_center_history`, `store_history`, `product_group_history`, `medicine_history`, `budget_fact_history`.
- `ArticleHistory` documents the full shape: `change_type` (CREATE/UPDATE/ARCHIVE/RESTORE/HIERARCHY_CHANGE), `changed_fields` (`ARRAY(String)`), `changed_by_user_id`, `is_current` — `backend/app/models/article_history.py:20`.
- Security note: `password_hash`, `two_factor_secret`, `backup_codes` are deliberately NOT mirrored into `UserHistory` — `backend/app/models/user.py:279`. See [[auth#User Model & Auth Methods]].

## SCD Type 2 Versioning Service

A legacy/parallel path still creates NEW dimension rows per change for FinancialCenter / CostCenter / Article, linking old→new versions in version-link tables. Implemented in `backend/app/services/scd2_service.py`.

- `create_new_version()` closes the old row (`is_current=False`, `valid_to=now`) and inserts a new current row, then writes a version-link record — `backend/app/services/scd2_service.py:37`.
- Time-travel helpers: `get_current_version()`, `get_version_at_date()`, `get_history()` — same file.
- For `Article`, child rows are re-pointed to the new parent version — `backend/app/services/scd2_service.py:183`.
- Version-link tables (`ArticleVersionLink`, `FinancialCenterVersionLink`, `CostCenterVersionLink`) store `old_id`/`new_id`, `changed_by_user_id`, JSONB `changed_fields` — `backend/app/models/version_link.py`.

## TZ-Aware History Timestamps (asyncpg gotcha)

All `*_history` temporal columns use TIMESTAMPTZ (`DateTime(timezone=True)`) and the far-future sentinel `9999-12-31 23:59:59+00`. Naive datetimes crash asyncpg when compared against this tz-aware sentinel ("can't subtract offset-naive and offset-aware datetimes").

- `FAR_FUTURE_DATETIME = datetime(9999,12,31,23,59,59, tzinfo=timezone.utc)` — `backend/app/models/article_history.py:17`, `backend/app/models/medicine_history.py:7`, `backend/app/services/scd2_service.py:31`.
- `valid_from`/`valid_to` declared `sa_column=Column(DateTime(timezone=True), ...)` — `backend/app/models/article_history.py:197`, `backend/app/models/medicine_history.py:29`.
- The fix migration converting all history timestamps to `timestamp with time zone`: `backend/db/migrations/versions/20251128_a8f3b9d4c621_change_history_timestamps_to_timezone_aware.py`.

## Closure Table Hierarchies

Tree structures (article and product-group) are stored both as an adjacency list (`parent_id`) and a closure table holding every ancestor→descendant path with `depth`, giving O(1) subtree/ancestor lookups without recursive SQL.

- `ArticleHierarchy` (`t_d_article_hierarchy`): composite PK `(ancestor_id, descendant_id)`, indexed `depth`; maintained by DB triggers — `backend/app/models/hierarchy.py:16`.
- `ProductGroupHierarchy` mirrors it; its closure table is maintained in service code.
- Query service for articles: `get_subtree`, `get_ancestors`, `get_path`, `get_direct_children`, `get_root`, `archive_recursive`/`restore_recursive` — `backend/app/services/hierarchy_service.py`.
- Product-group service additionally maintains paths: `create_hierarchy_paths`, `delete_hierarchy_paths`, `move_subtree`, `rebuild_hierarchy` (INSERT…SELECT with `depth+1`) — `backend/app/services/product_group_hierarchy_service.py:234`.
- Recursive archive writes `ArticleHistory` rows with `change_type='ARCHIVE'` — `backend/app/services/hierarchy_service.py:409`. See [[domain#Articles (Categories)]] and [[medicine]].

## Phase 2 Medicine Tables

Phase 2 (migration `m2b3c4d5e6f7`, after `m1a2b3c4d5e6`) adds two fact tables for intake planning and tracking. See [[medicine#Course Model]] and [[medicine#Intake Log Model]] for full field semantics.

`t_f_medicine_course` — one row per prescribed intake plan for a family member.
- FKs: `medicine_id` → `t_d_medicine` (ON DELETE RESTRICT), `patient_id` → `t_d_family_member` (ON DELETE RESTRICT), `creator_id` → `t_d_user` (ON DELETE CASCADE).
- `intake_times` JSONB (HH:MM strings), `schedule_type` CHECK(`daily/every_n_days/weekdays`), `schedule_config` JSONB.
- `dose_amount` NUMERIC(10,3), `dose_unit`, `with_food` CHECK(`before/with/after/any` or NULL).
- `is_active` BOOLEAN (partial index `WHERE is_active = TRUE`), `deleted_at` TIMESTAMP (partial index `WHERE deleted_at IS NULL`, soft delete).
- `notification_channels` JSONB default `["telegram","web_push"]`, `snooze_minutes` INT default 30.
- Indexes: `medicine_id`, `patient_id`, `is_active` (partial), `deleted_at` (partial).

`t_f_medicine_intake_log` — one row per scheduled dose slot, generated by the intake service.
- FK: `course_id` → `t_f_medicine_course` (ON DELETE CASCADE); `patient_id` → `t_d_family_member` (denormalized for date+patient filter); `stock_id` → `t_f_medicine_stock` (ON DELETE SET NULL, Phase 4); `marked_by` → `t_d_user` (ON DELETE SET NULL).
- `scheduled_at` TIMESTAMP (naive, SYSTEM_TIMEZONE), `taken_at` TIMESTAMP nullable, `status` CHECK(`scheduled/taken/skipped/late`).
- `dose_taken` NUMERIC(10,3) nullable, `version` INT default 1 (optimistic locking for concurrent take/skip).
- UNIQUE constraint `uq_intake_course_scheduled(course_id, scheduled_at)` — idempotency backstop for `INSERT ... ON CONFLICT DO NOTHING`.
- Indexes: `(patient_id, scheduled_at)`, `(course_id, scheduled_at)`, `status`.

Neither table has a `*_history` audit table in Phase 2. See [[medicine#Intake Generation]] for the idempotent generation strategy and [[medicine#Intake Marking]] for the optimistic-locking take/skip flow.

## Alembic Migrations

Schema is migration-owned (no `create_all` in production). Alembic loads `SQLModel.metadata`, rewrites the async DSN to a sync one, and runs inside a transaction; 68+ versioned files live under `versions/`.

- Config: `backend/db/migrations/alembic.ini` — `script_location`, `version_locations`, dated `file_template` (`%(year)d%(month).2d%(day).2d_%(rev)s_%(slug)s`).
- `env.py` strips `+asyncpg` from `DATABASE_URL` (Alembic uses the sync driver) and sets `SET LOCAL app.admin_telegram_id` for baseline bootstrap — `backend/db/migrations/env.py:31`.
- Baseline: `versions/20251110_e2558a31af07_baseline_v5_1_0_consolidated.py` consolidates core dimensions, the partitioned fact table, hierarchy closure tables, and triggers.
- Workflow: edit models → autogenerate/handwrite a migration → `alembic upgrade head`. Deploy runs upgrades before the app starts (`tests/run-tests.sh` also upgrades first). NEVER build on the server; ship via `VERSION` + CI/CD.

# Database

How Family Budget persists data: async SQLModel/SQLAlchemy over PostgreSQL via asyncpg, the SCD-1-plus-history dimension pattern, the SCD Type 2 versioning service and version links, two Closure Table hierarchies, sequence-based ID pre-generation, and the Alembic migration flow. Domain entities are described in [[domain]]; the user model in [[auth]]; medicine tables in [[medicine]].

## SQLAlchemy Models & Session

All models are SQLModel classes (`table=True`) under `backend/app/models/`, aggregated by `backend/app/models/__init__.py`. The async engine and session factory live in `backend/app/db/session.py`, connecting to PostgreSQL through the asyncpg driver.

- Engine: `create_async_engine(settings.DATABASE_URL, pool_size=5, max_overflow=10)` (`session.py:19`); `DATABASE_URL` uses the `postgresql+asyncpg://` scheme (`backend/app/core/config.py:68`).
- `async_session_maker` builds `AsyncSession` with `expire_on_commit=False` (`session.py:28`).
- `get_session()` is the FastAPI dependency — commit on success, rollback on exception, always close (`session.py:35`). `get_session_context()` is the equivalent `@asynccontextmanager` for scheduler jobs and the [[bot]].
- `init_db()` is a no-op placeholder; schema is owned by Alembic, not `SQLModel.metadata.create_all` (`session.py:92`).
- Health: `backend/app/db/health.py` runs `SELECT 1` via `engine.connect()` for the `/health` and `/ready` probes (see [[architecture#Application Lifespan]]).
- Table naming convention: dimensions `t_d_*`, facts `t_f_*`, history `*_history`, association tables `t_d_<a>_<b>`. The central fact table `t_f_budget_fact` is partitioned monthly by `fact_date` at the DB level (`backend/app/models/fact.py`), so its `id` is `BigInteger` and history tables carry no FK to it.

## SCD Type 1 + History Tables

Dimensions store only current data (in-place UPDATE, SCD Type 1) while a parallel `*_history` table records every version (SCD Type 2). This keeps fact-table foreign keys stable — `t_f_budget_fact.article_id` never has to be remapped on an edit — yet preserves a full audit trail for `GET /{entity}/{id}/history` endpoints (see [[api]]).

- Canonical example: `Article` (`models/article.py`, `t_d_article`) holds current state with a stable surrogate `id`; `ArticleHistory` (`models/article_history.py`, `t_d_article_history`) stores every snapshot.
- History rows carry a surrogate `history_id`, an FK to the stable dimension `id` (e.g. `article_id -> t_d_article.id`), a full column snapshot, the SCD2 temporal triple `valid_from` / `valid_to` / `is_current`, plus audit metadata: `change_type` (CREATE / UPDATE / ARCHIVE / RESTORE / HIERARCHY_CHANGE), `changed_fields` (PostgreSQL `ARRAY(String)`), and `changed_by_user_id`.
- The same pattern repeats across dimensions: `cost_center_history.py`, `financial_center_history.py`, `product_group_history.py`, `store_history.py`, `user_history.py`, `medicine_history.py`, and the fact-level `budget_fact_history.py`.
- `BudgetFactHistory` (`t_f_budget_fact_history`) is deliberately **without** a DB-level FK to `t_f_budget_fact` (the fact table is partitioned with composite PK `(id, fact_date)` and history must outlive fact deletion); it adds `cascade_delete_source` to record which dimension delete triggered a cascade purge.
- `ArticleUsageStats` (`t_article_usage_stats`, in `models/article.py`) is a non-historical aggregate refreshed daily via the `recalculate_article_usage_stats()` SQL function for popularity sorting.

## SCD Type 2 Versioning Service

`backend/app/services/scd2_service.py` is the reusable engine for the *versioned-dimension* variant of SCD Type 2, where an update produces a brand-new row (new `id`) rather than an in-place edit. It is generically typed over `Article` and `User` but also handles `FinancialCenter` and `CostCenter` at runtime.

- `create_new_version()` closes the old row (`is_current=False`, `valid_to=now`), copies all columns except the PK into a new row (`is_current=True`, `valid_from=now`, `valid_to=FAR_FUTURE_DATETIME`), preserves the original `created_at`, and commits atomically.
- Query helpers: `get_current_version()` (filters `is_current=True`), `get_version_at_date()` (time-travel via `valid_from <= t < valid_to`), `get_history()` (all versions, `valid_from DESC`).
- Guards: `has_changes()` skips no-op updates, `validate_scd2_instance()` checks temporal consistency, `verify_no_concurrent_update()` is optimistic locking on `updated_at` (raises `409 Conflict`).
- For `Article`, after versioning it re-points direct children's `parent_id` from the old to the new version, keeping the adjacency tree intact across versioning.
- `User` is intentionally excluded from version links (admin-only, rare changes tracked through `t_d_user` history directly) — see [[auth]].

## Version Links

`backend/app/models/version_link.py` records the old-version -> new-version edge produced by the SCD Type 2 service, giving a queryable change graph separate from the snapshot history. One link table exists per versioned dimension that supports it.

- `ArticleVersionLink` (`t_d_article_version_link`): `old_article_id` / `new_article_id`.
- `FinancialCenterVersionLink` (`t_d_financial_center_version_link`): `old_fc_id` / `new_fc_id`.
- `CostCenterVersionLink` (`t_d_cost_center_version_link`): `old_cc_id` / `new_cc_id`.
- Each link stores `created_at`, `changed_by_user_id` (NULL for system/trigger changes), and `changed_fields` as a JSON array.
- `create_new_version()` writes the matching link via runtime `isinstance` dispatch (`scd2_service.py:144`); there is intentionally no `User` link table.

## Closure Table Hierarchy

Two tree structures use the Closure Table pattern alongside the adjacency-list `parent_id` on the parent dimension, storing **all** ancestor-descendant paths so subtree/ancestor lookups are index-only with no recursive CTEs. The hierarchy entities themselves are covered in [[domain]].

- `ArticleHierarchy` (`models/hierarchy.py`, `t_d_article_hierarchy`) and `ProductGroupHierarchy` (`models/product_group_hierarchy.py`, `t_d_product_group_hierarchy`) share an identical shape: composite PK `(ancestor_id, descendant_id)` plus an indexed `depth`.
- Three relationship classes are stored: self-references `(x, x, 0)`, direct parent-child `(p, c, 1)`, and transitive `(a, d, depth>1)`.
- Typical queries: descendants `WHERE ancestor_id=X AND depth>0`, direct children `depth=1`, ancestors `WHERE descendant_id=X AND depth>0`.
- Maintenance differs by table: the article closure is kept by **database triggers** (direct manipulation discouraged — change `Article.parent_id` instead); the product-group closure is maintained by the **service layer** (`ProductGroupHierarchyService`).
- `backend/app/services/hierarchy_service.py` wraps the article closure: `get_subtree()`, `get_ancestors()`, `get_path()`, `get_depth()`, `get_direct_children()`, `get_root()`, and `archive_recursive()` / `restore_recursive()` for cascading active-flag changes.

## ID Generation

`backend/app/services/id_generator.py` pre-allocates primary keys from PostgreSQL sequences so the write-behind pipeline can return an `id` to the client immediately, before the asynchronous DB write lands (see [[realtime]] for the write-behind flow).

- `get_next_fact_id()` runs `SELECT nextval('t_f_budget_fact_id_seq')` — atomic, multi-worker safe; sequence gaps are accepted as normal.
- `get_next_transfer_id()` links the paired debit/credit facts of a transfer via `COALESCE(MAX(transfer_id), 0) + 1` over `t_f_budget_fact`.
- All other surrogate keys are ordinary `BIGSERIAL`/`SERIAL` PKs auto-assigned on INSERT.

## Migrations (Alembic)

Schema changes are versioned with Alembic under `backend/db/migrations/`; the `versions/` directory holds ~71 revision scripts forming a single linear chain. There is no `create_all` at runtime — the database is built entirely by replaying migrations.

- Config: `alembic.ini` sets `script_location`/`version_locations` to `backend/db/migrations[/versions]` and the filename template `YYYYMMDD_<rev>_<slug>`.
- `env.py` reads `DATABASE_URL` and rewrites `postgresql+asyncpg://` -> `postgresql://` (Alembic runs on the **synchronous** driver), targets `SQLModel.metadata`, and on online runs sets `app.admin_telegram_id` (from `ADMIN_TELEGRAM_ID`) so the baseline migration can bootstrap the admin user.
- The chain root is `20251110_e2558a31af07_baseline_v5_1_0_consolidated.py` (`down_revision = None`), a consolidated v5.1.0 baseline; pre-baseline scripts live in `backend/db/migrations/archive/`.
- Later revisions add pg_trgm description search, GIN indexes on partitions, recommended-amount recalculation functions, and the medicine phase-1/2/reminder tables (`20260615_m*`).
- Apply flow: `alembic -c backend/db/migrations/alembic.ini upgrade head`. The test harness runs this before pytest (`tests/run-tests.sh:50`); production deploy applies migrations via `./deploy.sh` on the server.

## Timezone-Aware History Columns

Every SCD Type 2 history table uses **timezone-aware** temporal columns, and the far-future sentinel is `datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)`. This is load-bearing: a naive sentinel crashes asyncpg with a year-overflow error when bound against a `TIMESTAMPTZ` column.

- Columns are declared as `sa_column=Column(DateTime(timezone=True), ...)` for `valid_from` / `valid_to` / `created_at` (`models/article_history.py:197`).
- `FAR_FUTURE_DATETIME` is defined identically in `scd2_service.py:31` and each history module (e.g. `article_history.py:17`, `budget_fact_history.py:17`); current rows carry it as `valid_to`.
- Closed versions set `valid_to = now`; the open version always holds the far-future sentinel, which is also how `validate_scd2_instance()` asserts a current row.
- Caveat: `version_link.py` uses plain `TIMESTAMP` (timezone-naive) for its `created_at` — the tz-aware requirement applies specifically to the SCD2 `*_history` validity columns, not the link audit timestamps.

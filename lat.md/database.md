# Database

PostgreSQL 16 with a star schema core. Dimension tables use SCD patterns for change tracking; the fact table is partitioned by month.

## Star Schema

Fact table `t_f_budget_fact` references dimension tables: `t_d_article`, `t_d_cost_center`, `t_d_financial_center`. FKs capture dimension IDs at transaction time, enabling historical analysis even after dimension updates.

## Fact Table

`t_f_budget_fact` stores all income/expense transactions. Partitioned by `fact_date` (monthly) at the DB level for query performance. Model: `backend/app/models/fact.py`. No versioning — facts are immutable or soft-deleted.

## SCD Type 2

Full versioning: each update inserts a new row with `is_current=True`; old row gets `is_current=False`, `valid_to=now()`. New row gets `valid_from=now()`, `valid_to=9999-12-31 UTC`. Preserves complete audit trail.

Used by: `Article`, `User`. Service: `backend/app/services/scd2_service.py`. Key invariant: `valid_to=9999-12-31 23:59:59 UTC` (timezone-aware) to avoid asyncpg year overflow.

## SCD Type 1 with History

Main table holds only current data (in-place UPDATE, no new rows). Full history stored in separate `_history` table using SCD Type 2 pattern. Stable PK ensures FK integrity in fact tables never requires updates.

Used by: `CostCenter` → `t_d_cost_center` + `t_d_cost_center_history`. Motivation: fact table FKs to cost centers must remain stable; SCD2 on main table would break them on every update.

## Closure Table

Stores ALL ancestor-descendant paths for a tree, enabling O(1) subtree queries. Each row: `(ancestor_id, descendant_id, depth)`. Self-references (depth=0) for every node. Maintained by DB triggers.

Used by: `Article` → `t_d_article_hierarchy`, `ProductGroup` → `t_d_product_group_hierarchy`. Models: `backend/app/models/hierarchy.py`, `backend/app/models/product_group_hierarchy.py`.

### Query Patterns

Common SQL patterns for tree traversal using the closure table.

```sql
-- All descendants of node X (any depth)
SELECT descendant_id FROM t_d_article_hierarchy WHERE ancestor_id = X AND depth > 0;

-- Direct children only
SELECT descendant_id FROM t_d_article_hierarchy WHERE ancestor_id = X AND depth = 1;

-- All ancestors of node X
SELECT ancestor_id FROM t_d_article_hierarchy WHERE descendant_id = X AND depth > 0;
```

## Migrations

Alembic manages schema migrations. Migration files: `backend/migrations/versions/`. Never run migrations manually on prod — CI/CD handles this via `deploy.sh`.

## Write-Behind Cache

High-frequency writes (e.g., sync events) go to Redis first, flushed to PostgreSQL async. Service: `backend/app/services/write_behind_service.py`. See [[realtime#Write-Behind Cache]].

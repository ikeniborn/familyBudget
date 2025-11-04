# Database Migrations

This directory contains SQL migration scripts for the FamilyBudget database schema.

## Naming Conventions

### Migration Files

Migration files follow this naming pattern:

```
NNN_descriptive_name.sql
```

Where:
- `NNN` is a three-digit sequential number (001, 002, 003, etc.)
- `descriptive_name` is a lowercase, underscore-separated description

**Examples:**
- `001_create_t_d_user.sql`
- `002_create_t_d_article.sql`
- `005_create_t_d_article_hierarchy.sql`

### Table Naming Conventions

- **`t_d_*`** - Dimension tables (reference data/справочники)
  - Example: `t_d_user`, `t_d_article`, `t_d_financial_center`

- **`t_f_*`** - Fact tables (transactional data)
  - Example: `t_f_budget_fact`

- **`v_d_*_current`** - Views for current SCD2 records
  - Example: `v_d_user_current`, `v_d_article_current`

### SCD Type 2 Pattern

All dimension tables implement **SCD Type 2** (Slowly Changing Dimension Type 2) to track historical changes.

**Required columns:**
```sql
-- SCD Type 2 fields
valid_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
valid_to TIMESTAMP DEFAULT '9999-12-31'::TIMESTAMP,
is_current BOOLEAN NOT NULL DEFAULT TRUE
```

**Required constraint:**
```sql
CONSTRAINT unique_[table]_[key]_current 
    UNIQUE ([natural_key], is_current) WHERE is_current = TRUE
```

**Example:**
```sql
CREATE TABLE t_d_user (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    username VARCHAR(255),
    
    -- SCD Type 2
    valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP DEFAULT '9999-12-31'::TIMESTAMP,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    
    CONSTRAINT unique_user_telegram_current 
        UNIQUE (telegram_id, is_current) WHERE is_current = TRUE
);
```

### Audit Fields

All tables should include audit timestamps:

```sql
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

## Migration Execution

### Running Migrations

Use the migration runner script:

```bash
./backend/db/run_migrations.sh
```

This script:
1. Connects to PostgreSQL using environment variables
2. Executes all `.sql` files in sequential order
3. Logs results to `migrations.log`
4. Stops on first error

### Rollback

To rollback migrations:

```bash
./backend/db/rollback_migrations.sh
```

### Manual Execution

To run a specific migration manually:

```bash
psql -h localhost -U familybudget -d familybudget_db -f backend/db/migrations/001_create_t_d_user.sql
```

## Development Mode: Working with Modified Migrations

**ТЕКУЩАЯ ФАЗА:** Development (v5.0.0-beta)

### Problem: Migration Tracking by Filename

The migration system tracks applied migrations by **filename** in `schema_migrations` table:

```sql
CREATE TABLE schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_file VARCHAR(255) NOT NULL UNIQUE,  -- ← Tracks by filename!
    applied_at TIMESTAMP,
    checksum VARCHAR(64)
);
```

**Issue:** If you modify an existing migration file, the system will **skip it** because it sees the filename as already applied.

### When You Can Modify Existing Migrations

✅ **РАЗРЕШЕНО в Development Mode:**
- Прямое редактирование миграций 001-013
- Изменение SQL в существующих файлах
- Изменение структуры таблиц
- НЕТ backward compatibility требований

❌ **ЗАПРЕЩЕНО:**
- Создание новых миграций типа `014_update_xxx.sql`
- В production так делать нельзя!

### Workflow: Modified Migration

When you modify an existing migration file (e.g., `013_create_recommended_amounts_table.sql`):

**Option 1: Recreate Database (Clean Slate)**

Best for development when you don't need data:

```bash
# ⚠️  WARNING: This DELETES ALL DATA!
docker compose down -v
docker compose up -d

# Migrations apply automatically on startup
```

**Option 2: Re-apply Specific Migration**

Best for production/testing when you want to keep data in other tables:

```bash
# Local development
cd ~/familyBudget
./scripts/reapply_migration_013.sh

# Production server
ssh your-server
cd ~/familyBudget
./scripts/remote_reapply_migration_013.sh
```

The re-apply script:
1. Drops the table/functions from modified migration
2. Removes tracking record from `schema_migrations`
3. Re-applies the updated migration
4. Adds tracking record back

### Why Deploy Script Skips Modified Migrations

When you run `./deploy.sh`:

1. Deploy script calls `run_migrations.sh`
2. Migration runner checks `schema_migrations` table
3. Sees `013_create_recommended_amounts_table.sql` already applied
4. **Skips it** (lines 200-203 in run_migrations.sh):

```bash
if is_migration_applied "${basename}"; then
    log_warning "Skipping (already applied): ${basename}"
    skipped=$((skipped + 1))
    continue
fi
```

**Solution:** Use re-apply script instead of deploy when migration content changed.

### Transition to Production

After relase → версионирование миграций (Alembic):
- Alpha → Beta → Production
- New migrations become append-only
- Use Alembic upgrade/downgrade
- No direct SQL file editing

## Migration Files Structure

Current migrations:

1. `001_create_t_d_user.sql` - Users dimension table with SCD2
2. `002_create_t_d_article.sql` - Articles dimension table with SCD2 and hierarchy support
3. `003_create_t_d_financial_center.sql` - Financial centers dimension with SCD2
4. `004_create_t_d_cost_center.sql` - Cost centers dimension with SCD2
5. `005_create_t_d_article_hierarchy.sql` - Closure Table for article hierarchy
6. `006_create_t_f_budget_fact.sql` - Budget fact table with partitioning and FK
7. `007_create_article_hierarchy_triggers.sql` - Triggers for closure table maintenance
8. `008_create_scd2_triggers.sql` - SCD2 automation triggers
9. `009_create_additional_indexes.sql` - Performance indexes
10. `010_add_record_type_to_budget_fact.sql` - Add record_type field (fact/plan)
11. `011_create_notifications_table.sql` - Notifications table
12. `013_create_refresh_tokens_table.sql` - JWT refresh tokens table

**Total:** 12 migrations

**Removed (optimization):**
- `012_add_centers_fk.sql` - Duplicate (FK already in 006)
- `014_remove_code_and_is_global_fields.sql` - Removed unused fields

## Design Decisions

### Why SCD Type 2?

SCD Type 2 allows us to:
- Track complete history of changes to reference data
- Support time-travel queries (as of specific date)
- Maintain referential integrity with fact tables
- Audit changes to master data

### Why Closure Table for Hierarchy?

The Closure Table pattern for `t_d_article` hierarchy provides:
- Fast queries for all descendants/ancestors
- Simple path queries
- Easy to maintain with triggers
- No depth limitations (unlike adjacency list)

### Merged Requirements

This schema merges requirements from:
- **PLAN.md** (2025-10-09): SCD2 for t_d_user, type/is_global fields
- **PRD.md** (2025-10-08): code field, additional dimension tables

**Decision Matrix:**
- Q1: t_d_user **with** SCD Type 2 ✓
- Q2: t_d_article with **merged** fields (code + type + is_global) ✓
- Q3: **All** dimension tables in TASK-001 ✓
- Q4: **Merge** requirements from both documents ✓

## Testing

Test scripts are located in `../tests/`:
- `test_schema.sql` - Schema validation
- `test_scd2_constraints.sql` - SCD2 functionality tests
- `test_migration_execution.sh` - Migration execution tests

Run all tests:

```bash
cd backend/db/tests
./test_migration_execution.sh
```

## References

- **PLAN.md**: Implementation roadmap, TASK-001 specification
- **PRD.md**: Product Requirements Document, database design section
- **workflow/02_detailed_plan.xml**: Detailed subtask breakdown

---

**Last Updated:** 2025-10-09  
**TASK:** TASK-001 - Dimension tables DDL (SCD2)  
**Status:** In Progress

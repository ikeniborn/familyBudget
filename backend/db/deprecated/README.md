# Deprecated Files

This directory contains files that are no longer actively used in the Family Budget project.

## Schema Files (Deprecated as of 2025-11-09)

The `schema/` directory contained the old 2-tier database management system that was used during development mode.

### Why Deprecated?

The project has **fully migrated to Alembic** for database schema management. The old schema-based approach is no longer maintained.

**Old System (Deprecated):**
- Location: `backend/db/schema/*.sql`
- Method: Raw SQL files applied idempotently
- Tracking: Custom `schema_migrations` table with checksums
- Use case: Development mode (full DB recreation)

**New System (Current):**
- Location: `backend/db/migrations/versions/*.py`
- Method: Alembic versioned migrations
- Tracking: Alembic `alembic_version` table
- Use case: Production mode (incremental migrations)

### Schema Files Archive

| File | Description | Migrated To |
|------|-------------|-------------|
| `001_core_dimensions.sql` | Core dimension tables (Users, Articles, FinCenters, CostCenters) | `20251109_001_baseline_schema_v5_0_0.py` |
| `002_core_facts.sql` | Budget fact table | `20251109_001_baseline_schema_v5_0_0.py` |
| `003_core_hierarchy.sql` | Article hierarchy (Closure Table) | `20251109_001_baseline_schema_v5_0_0.py` |
| `004_core_triggers.sql` | Database triggers (Hierarchy + SCD Type 2) | `20251109_001_baseline_schema_v5_0_0.py` |
| `005_auth_tokens.sql` | Authentication tables | `20251109_001_baseline_schema_v5_0_0.py` |
| `006_notifications.sql` | Notification tables | `20251109_001_baseline_schema_v5_0_0.py` |
| `007_recommendations.sql` | Recommendation tables (K-means) | `20251109_001_baseline_schema_v5_0_0.py` |

### Baseline Migration

All schema files have been consolidated into the **baseline Alembic migration**:
- File: `backend/db/migrations/versions/20251109_001_baseline_schema_v5_0_0.py`
- Revision ID: `001_baseline`
- Creates entire database schema from scratch

### DO NOT USE

**WARNING:** These files are kept for historical reference only. DO NOT modify or use them.

For schema changes, create new Alembic migrations instead:

```bash
# Create new migration
alembic revision -m "add_new_column"

# Auto-generate from SQLModel changes
alembic revision --autogenerate -m "sync_models"

# Apply migrations
alembic upgrade head
```

### When to Remove?

These files can be safely deleted after:
1. ✅ Baseline migration is tested and working
2. ✅ Documentation updated
3. ✅ All team members migrated to Alembic workflow
4. ⏳ After v5.0.0 production release (keep for 1-2 releases as backup)

### Related Documentation

- [Backend DB README](../README.md) - Database architecture and Alembic workflow
- [CLAUDE.md](../../../CLAUDE.md) - Alembic usage guide
- [PRD Section 6.7](../../../docs/prd/06-database-design.md) - Database migration strategy

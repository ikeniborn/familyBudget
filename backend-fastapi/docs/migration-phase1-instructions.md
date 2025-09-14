# Phase 1 Database Migration: User-Isolated to Admin-Managed Reference Data

## Overview

This migration converts the Family Budget Application from user-isolated reference data to admin-managed shared reference data. This is a significant architectural change that consolidates duplicate reference data across users and introduces a shared management model.

## ⚠️ CRITICAL WARNING

**This migration makes irreversible changes to your data structure. Create a full database backup before proceeding.**

```bash
# Create backup
docker exec budget-postgres pg_dump -U budget budgetdb > backup_before_phase1_$(date +%Y%m%d_%H%M%S).sql
```

## Migration Components

### 1. Alembic Migration (`5ef4678b70a0`)
- **File**: `alembic/versions/5ef4678b70a0_convert_reference_tables_to_shared_.py`
- **Purpose**: Schema changes (add columns, modify constraints)

### 2. Data Consolidation Script
- **File**: `scripts/consolidate_reference_data.sql`
- **Purpose**: Merge duplicate data and update foreign keys

### 3. Updated SQLAlchemy Models
- **Files**: `app/models/financial_center.py`, `app/models/cost_center.py`, `app/models/nomenclature.py`
- **Purpose**: Reflect new shared reference structure

## Database Schema Changes

### Tables Affected
- `t_d_financial_center`
- `t_d_cost_center`
- `t_d_nomenclature`
- `t_d_period` (made shared)

### New Columns Added
- `{table}_code` - Global unique identifier
- `created_by` - User who created the record
- `managed_by` - User who manages the record
- `description` - Optional description field

### Constraints Changes
- **Removed**: Per-user unique constraints (`_name_user_uc`)
- **Added**: Global unique constraints on code fields (`_code_uc`)
- **Modified**: `user_id` made nullable (NULL = shared record)

## Step-by-Step Migration Process

### Step 1: Prepare Environment
```bash
# Ensure containers are running
docker-compose up -d

# Backup database
docker exec budget-postgres pg_dump -U budget budgetdb > backup_before_migration.sql

# Check current migration status
docker exec budget-backend alembic current
```

### Step 2: Run Alembic Migration
```bash
# Apply schema changes
docker exec budget-backend alembic upgrade head

# Verify migration applied
docker exec budget-backend alembic current
# Should show: 5ef4678b70a0 (head)
```

### Step 3: Run Data Consolidation
```bash
# Connect to database
docker exec -it budget-postgres psql -U budget -d budgetdb

# Execute consolidation script
\i /scripts/consolidate_reference_data.sql

# Review consolidation results
SELECT table_name, records_consolidated FROM consolidation_log WHERE action = 'consolidated';
```

### Step 4: Validate Migration
```bash
# Run validation script
docker exec budget-backend python scripts/test_migration.py
```

### Step 5: Restart Application
```bash
# Restart to load new models
docker-compose restart budget-backend budget-frontend
```

## Expected Results

### Before Migration
```
t_d_financial_center:
- Each user has their own "Sales" center
- Unique constraint: (name, user_id)
- user_id always NOT NULL

User 1: (id=1, name="Sales", user_id=1)
User 2: (id=2, name="Sales", user_id=2)
User 3: (id=3, name="Marketing", user_id=1)
```

### After Migration
```
t_d_financial_center:
- One shared "Sales" center for all users
- Unique constraint: (code)
- user_id can be NULL (shared records)

Shared: (id=1, code="SAL001", name="Sales", user_id=NULL, managed_by=1)
User-specific: (id=3, code="MAR001", name="Marketing", user_id=1, managed_by=1)
```

## Data Consolidation Logic

### Duplicate Detection
Records are considered duplicates if they have the same `name` value. The consolidation process:

1. **Identifies duplicates** by grouping on name
2. **Selects master record** (lowest ID)
3. **Updates foreign keys** in `t_f_registry` and related tables
4. **Deletes duplicate records**
5. **Sets user_id to NULL** for consolidated records (making them shared)

### Code Generation
Auto-generated codes follow this pattern:
- **Financial Centers**: First 3 chars of name + 3-digit sequence (e.g., "SAL001")
- **Cost Centers**: First 3 chars of name + 3-digit sequence (e.g., "IT001")
- **Nomenclatures**: First 5 chars of name + 3-digit sequence (e.g., "OFFIC001")

### Audit Trail
All consolidation actions are logged in the `consolidation_log` table:
```sql
SELECT * FROM consolidation_log ORDER BY consolidated_at DESC;
```

## New Access Patterns

### Shared Reference Data
- `user_id IS NULL` - Available to all users
- Managed by admin users (`managed_by` field)
- Cannot be deleted by regular users

### User-Specific Reference Data
- `user_id IS NOT NULL` - Available only to that user
- Can be managed by the owner
- Follows legacy access patterns

### API Changes Required
APIs will need updates to:
1. Show both shared and user-specific records
2. Respect management permissions
3. Handle the new `code` field as primary identifier
4. Support admin-only operations for shared records

## Rollback Procedure

If issues occur, you can rollback using:

```bash
# Restore from backup
docker exec -i budget-postgres psql -U budget -d budgetdb < backup_before_migration.sql

# Rollback Alembic migration
docker exec budget-backend alembic downgrade 86027abaa82e
```

## Validation Checklist

After migration, verify:

- [ ] All reference tables have `code` fields populated
- [ ] No NULL codes exist
- [ ] Global unique constraints work
- [ ] Registry foreign keys are valid
- [ ] SQLAlchemy models load without errors
- [ ] API endpoints return expected data
- [ ] Frontend displays consolidated data correctly

## Troubleshooting

### Common Issues

1. **Migration fails on constraint drop**
   ```
   Solution: Check if constraint names match your database
   ```

2. **Code generation creates duplicates**
   ```
   Solution: Review the UPPER(LEFT()) logic for your data
   ```

3. **Registry references break**
   ```
   Solution: Check consolidation_log for mapping issues
   ```

4. **Permission denied on scripts**
   ```bash
   chmod +x scripts/test_migration.py
   ```

### Validation Queries

```sql
-- Check consolidation results
SELECT
    table_name,
    COUNT(*) as records_consolidated
FROM consolidation_log
GROUP BY table_name;

-- Check shared vs user-specific distribution
SELECT
    'financial_centers' as table_name,
    COUNT(CASE WHEN user_id IS NULL THEN 1 END) as shared,
    COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as user_specific
FROM t_d_financial_center
UNION ALL
SELECT
    'cost_centers',
    COUNT(CASE WHEN user_id IS NULL THEN 1 END),
    COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END)
FROM t_d_cost_center
UNION ALL
SELECT
    'nomenclatures',
    COUNT(CASE WHEN user_id IS NULL THEN 1 END),
    COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END)
FROM t_d_nomenclature;

-- Verify registry integrity
SELECT
    COUNT(*) as total_records,
    COUNT(fc.financial_center_id) as valid_fc_refs
FROM t_f_registry r
LEFT JOIN t_d_financial_center fc ON r.financial_center_id = fc.financial_center_id;
```

## Next Steps

After successful Phase 1 migration:

1. **Update API endpoints** to handle shared reference data
2. **Modify frontend** to display shared vs user-specific indicators
3. **Implement admin UI** for managing shared reference data
4. **Update documentation** for new data access patterns
5. **Plan Phase 2** for advanced sharing features

## Support

For issues with this migration:
1. Check validation script output
2. Review consolidation_log table
3. Verify backup was created
4. Document any data inconsistencies found
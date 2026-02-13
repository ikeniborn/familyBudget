"""remove_csv_info_fields

Revision ID: b4c5d6e7f8g9
Revises: cb7d14f2d26c
Create Date: 2025-12-29

This migration removes deprecated csv_info1 and csv_info2 fields.

Changes:
1. Remove 'info1' and 'info2' keys from t_import_staging.csv_metadata JSONB
2. Remove 'csv_info1' and 'csv_info2' keys from t_import_column_mapping.mapping JSONB

Reason for removal:
- Rarely used fields
- Replaced by 'include_all_columns' transformation option
- Simplifies import mapping UI

Backward compatibility:
- Old mappings automatically cleaned during upgrade
- Downgrade restores structure but NOT original data (data loss expected)
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b4c5d6e7f8g9'
down_revision: str | None = 'cb7d14f2d26c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Remove deprecated csv_info fields from JSONB columns."""
    from sqlalchemy import text

    # Get connection from Alembic context
    conn = op.get_bind()

    # Step 1: Clean up csv_metadata in t_import_staging
    print("[CSV_MIGRATION] Removing 'info1' and 'info2' from t_import_staging.csv_metadata...")

    # Count affected records before cleanup
    result = conn.execute(text("""
        SELECT COUNT(*) as count
        FROM t_import_staging
        WHERE csv_metadata IS NOT NULL
          AND (csv_metadata::jsonb ? 'info1' OR csv_metadata::jsonb ? 'info2')
    """))
    affected_count = result.scalar()
    print(f"[CSV_MIGRATION] Found {affected_count} staging records with info1/info2 fields")

    # Remove keys from JSON (cast to JSONB for - operator, then back to JSON)
    conn.execute(text("""
        UPDATE t_import_staging
        SET csv_metadata = (csv_metadata::jsonb - 'info1' - 'info2')::json
        WHERE csv_metadata IS NOT NULL
          AND (csv_metadata::jsonb ? 'info1' OR csv_metadata::jsonb ? 'info2')
    """))

    print("[CSV_MIGRATION] Successfully removed info1/info2 from t_import_staging.csv_metadata")

    # Step 2: Clean up mapping in t_import_column_mapping
    print("[CSV_MIGRATION] Removing 'csv_info1' and 'csv_info2' from t_import_column_mapping.mapping...")

    # Count affected records before cleanup
    result = conn.execute(text("""
        SELECT COUNT(*) as count
        FROM t_import_column_mapping
        WHERE mapping IS NOT NULL
          AND (mapping::jsonb ? 'csv_info1' OR mapping::jsonb ? 'csv_info2')
    """))
    affected_count = result.scalar()
    print(f"[CSV_MIGRATION] Found {affected_count} column mappings with csv_info1/csv_info2 fields")

    # Remove keys from JSON (cast to JSONB for - operator, then back to JSON)
    conn.execute(text("""
        UPDATE t_import_column_mapping
        SET mapping = (mapping::jsonb - 'csv_info1' - 'csv_info2')::json
        WHERE mapping IS NOT NULL
          AND (mapping::jsonb ? 'csv_info1' OR mapping::jsonb ? 'csv_info2')
    """))

    print("[CSV_MIGRATION] Successfully removed csv_info1/csv_info2 from t_import_column_mapping.mapping")

    # Step 3: Verify cleanup
    print("[CSV_MIGRATION] Verifying cleanup...")

    result = conn.execute(text("""
        SELECT COUNT(*) as count
        FROM t_import_staging
        WHERE csv_metadata IS NOT NULL
          AND (csv_metadata::jsonb ? 'info1' OR csv_metadata::jsonb ? 'info2')
    """))
    staging_remaining = result.scalar()

    result = conn.execute(text("""
        SELECT COUNT(*) as count
        FROM t_import_column_mapping
        WHERE mapping IS NOT NULL
          AND (mapping::jsonb ? 'csv_info1' OR mapping::jsonb ? 'csv_info2')
    """))
    mapping_remaining = result.scalar()

    if staging_remaining > 0 or mapping_remaining > 0:
        raise Exception(
            f"[CSV_MIGRATION] ⚠️ Cleanup incomplete: staging={staging_remaining}, mapping={mapping_remaining}"
        )

    print("[CSV_MIGRATION] ✅ Cleanup verification passed: all deprecated fields removed")
    print("[CSV_MIGRATION] Migration completed successfully")


def downgrade() -> None:
    """
    Restore deprecated csv_info fields structure.

    WARNING: This only restores the JSONB structure, NOT the original data.
    Original field values are permanently lost after upgrade.
    """

    print("[CSV_MIGRATION] Downgrade: Restoring deprecated field structure...")
    print("[CSV_MIGRATION] ⚠️ WARNING: Original data cannot be restored (data loss expected)")

    # Note: We cannot restore original values, only add empty placeholders
    # This is acceptable as the fields were rarely used

    print("[CSV_MIGRATION] No structural changes to reverse (JSONB keys were removed, not columns)")
    print("[CSV_MIGRATION] If csv_info1/csv_info2 fields are needed, re-add them manually to mapping UI")
    print("[CSV_MIGRATION] Downgrade completed (no-op for JSONB key removal)")

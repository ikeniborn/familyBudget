"""Add csv_delimiter and csv_encoding fields to import file upload table

Revision ID: n9i0j1k2l3m4
Revises: m8h9i0j1k2l3
Create Date: 2025-12-08

This migration adds csv_delimiter and csv_encoding fields to t_import_file_upload table.
These fields store the detected CSV format during analysis, allowing the parser
to use the correct delimiter and encoding when parsing the file.

Fixes: Empty staging list when importing CSV files with comma delimiter.
"""

import sqlalchemy as sa
from alembic import op

# Revision identifiers
revision = "n9i0j1k2l3m4"
down_revision = "m8h9i0j1k2l3"
branch_labels = None
depends_on = None


def upgrade():
    """Add csv_delimiter and csv_encoding columns to import file upload table."""
    op.add_column(
        "t_import_file_upload",
        sa.Column(
            "csv_delimiter",
            sa.String(5),
            nullable=True,
            comment="Detected CSV delimiter (e.g., ';' or ',')",
        ),
    )
    op.add_column(
        "t_import_file_upload",
        sa.Column(
            "csv_encoding",
            sa.String(20),
            nullable=True,
            comment="Detected file encoding (e.g., 'utf-8', 'windows-1251')",
        ),
    )


def downgrade():
    """Remove csv_delimiter and csv_encoding columns from import file upload table."""
    op.drop_column("t_import_file_upload", "csv_encoding")
    op.drop_column("t_import_file_upload", "csv_delimiter")

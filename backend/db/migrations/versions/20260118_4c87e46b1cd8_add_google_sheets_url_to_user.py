"""add_google_sheets_url_to_user

Revision ID: 4c87e46b1cd8
Revises: 28cb68876eaf
Create Date: 2026-01-18 12:00:00.000000

This migration adds google_sheets_url field to t_d_user table
for persistent Google Sheets URL storage per user.

Changes:
1. Add google_sheets_url VARCHAR(2048) NULL to t_d_user
2. Add google_sheets_url VARCHAR(2048) NULL to t_d_user_history

Use Case:
- Users can save their Google Sheets URL for shopping list import
- URL is stored on user level for reuse in future imports
- Frontend auto-fills saved URL when opening Google Sheets import wizard
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '4c87e46b1cd8'
down_revision: str | None = '28cb68876eaf'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add google_sheets_url field to user tables."""

    # Step 1: Add column to main User table (t_d_user)
    print("[MIGRATION] Adding google_sheets_url to t_d_user...")
    op.add_column(
        't_d_user',
        sa.Column(
            'google_sheets_url',
            sa.String(2048),
            nullable=True,
            comment='Saved Google Sheets URL for shopping list import (v7.x+)'
        )
    )

    # Step 2: Add column to User History table (t_d_user_history)
    print("[MIGRATION] Adding google_sheets_url to t_d_user_history...")
    op.add_column(
        't_d_user_history',
        sa.Column(
            'google_sheets_url',
            sa.String(2048),
            nullable=True,
            comment='Historical snapshot of Google Sheets URL preference'
        )
    )

    print("[MIGRATION] google_sheets_url migration completed successfully")


def downgrade() -> None:
    """Remove google_sheets_url field from user tables."""

    print("[MIGRATION] Removing google_sheets_url from t_d_user_history...")
    op.drop_column('t_d_user_history', 'google_sheets_url')

    print("[MIGRATION] Removing google_sheets_url from t_d_user...")
    op.drop_column('t_d_user', 'google_sheets_url')

    print("[MIGRATION] google_sheets_url rollback completed")

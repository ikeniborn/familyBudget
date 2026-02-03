"""fix_recommended_amounts_type_constraint

Revision ID: g2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2025-12-04

Fixes check_type_values constraint to support all article types:
- income
- expense
- credit (for transfers)
- debit (for transfers)
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'g2b3c4d5e6f7'
down_revision: str | None = 'f1a2b3c4d5e6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Update check_type_values constraint to allow all article types.
    """
    # Drop old constraint
    op.execute("""
        ALTER TABLE t_recommended_amounts
        DROP CONSTRAINT IF EXISTS check_type_values
    """)

    # Create new constraint with all types
    op.execute("""
        ALTER TABLE t_recommended_amounts
        ADD CONSTRAINT check_type_values
        CHECK (type IS NULL OR type IN ('income', 'expense', 'credit', 'debit'))
    """)


def downgrade() -> None:
    """
    Restore original constraint (only income/expense).
    """
    # Drop new constraint
    op.execute("""
        ALTER TABLE t_recommended_amounts
        DROP CONSTRAINT IF EXISTS check_type_values
    """)

    # Restore original constraint
    op.execute("""
        ALTER TABLE t_recommended_amounts
        ADD CONSTRAINT check_type_values
        CHECK (type IS NULL OR type IN ('income', 'expense'))
    """)

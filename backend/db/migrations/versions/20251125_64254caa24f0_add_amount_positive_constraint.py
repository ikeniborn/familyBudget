"""add_amount_positive_constraint

Revision ID: 64254caa24f0
Revises: f385331ab243
Create Date: 2025-11-25 17:29:24.182992

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '64254caa24f0'
down_revision: str | None = 'f385331ab243'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Step 1: Fix existing negative amounts (convert to positive)
    op.execute("""
        UPDATE t_f_budget_fact
        SET amount = abs(amount),
            updated_at = NOW()
        WHERE amount < 0
    """)

    # Step 2: Add CHECK constraint to prevent future negative amounts
    op.create_check_constraint(
        constraint_name='check_amount_positive',
        table_name='t_f_budget_fact',
        condition='amount >= 0'
    )


def downgrade() -> None:
    # Remove CHECK constraint
    op.drop_constraint(
        constraint_name='check_amount_positive',
        table_name='t_f_budget_fact',
        type_='check'
    )

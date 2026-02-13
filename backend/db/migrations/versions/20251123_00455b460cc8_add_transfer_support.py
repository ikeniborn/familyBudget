"""add_transfer_support

Revision ID: 00455b460cc8
Revises: e60f86fd6465
Create Date: 2025-11-23 22:10:46.892488

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '00455b460cc8'
down_revision: str | None = 'e60f86fd6465'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add transfer_id column and create special transfer categories."""

    # 1. Add transfer_id column to t_f_budget_fact
    op.add_column(
        't_f_budget_fact',
        sa.Column('transfer_id', sa.BigInteger(), nullable=True)
    )

    # 2. Create index on transfer_id for fast lookup of paired transactions
    op.create_index(
        'ix_budget_fact_transfer_id',
        't_f_budget_fact',
        ['transfer_id'],
        unique=False
    )

    # 3. Add column comment for documentation
    op.execute("""
        COMMENT ON COLUMN t_f_budget_fact.transfer_id IS
        'Transfer ID: links paired expense/income transactions for transfers between financial centers.
        NULL for regular transactions, same value for paired transfer transactions.'
    """)

    # 4. Add description column to t_d_article (for consistency with other dimension tables)
    op.add_column(
        't_d_article',
        sa.Column('description', sa.Text(), nullable=True)
    )

    # 5. Create special categories for transfers
    # Using raw SQL for SCD Type 2 compliance
    op.execute("""
        -- Категория для списания (расход)
        INSERT INTO t_d_article (
            user_id,
            parent_id,
            name,
            type,
            code,
            is_active,
            valid_from,
            valid_to,
            is_current
        )
        SELECT
            (SELECT id FROM t_d_user WHERE is_admin = true ORDER BY id LIMIT 1),
            NULL,
            'Перевод-списание',
            'expense',
            'TRF-OUT',
            true,
            NOW(),
            '9999-12-31'::timestamp,
            true
        WHERE NOT EXISTS (
            SELECT 1 FROM t_d_article
            WHERE name = 'Перевод-списание' AND is_current = true
        );

        -- Категория для пополнения (доход)
        INSERT INTO t_d_article (
            user_id,
            parent_id,
            name,
            type,
            code,
            is_active,
            valid_from,
            valid_to,
            is_current
        )
        SELECT
            (SELECT id FROM t_d_user WHERE is_admin = true ORDER BY id LIMIT 1),
            NULL,
            'Перевод-пополнение',
            'income',
            'TRF-IN',
            true,
            NOW(),
            '9999-12-31'::timestamp,
            true
        WHERE NOT EXISTS (
            SELECT 1 FROM t_d_article
            WHERE name = 'Перевод-пополнение' AND is_current = true
        );
    """)

    # 6. Add descriptions to transfer categories
    op.execute("""
        UPDATE t_d_article
        SET description = 'Используется для внутренних переводов между ЦФО (списание с источника)'
        WHERE name = 'Перевод-списание' AND is_current = true;

        UPDATE t_d_article
        SET description = 'Используется для внутренних переводов между ЦФО (пополнение получателя)'
        WHERE name = 'Перевод-пополнение' AND is_current = true;
    """)


def downgrade() -> None:
    """Remove transfer_id column and archive special transfer categories."""

    # 1. Archive special transfer categories (soft delete via SCD Type 2)
    # NOTE: Using soft delete to preserve history, not hard DELETE
    op.execute("""
        UPDATE t_d_article
        SET is_current = false,
            valid_to = NOW()
        WHERE name IN ('Перевод-списание', 'Перевод-пополнение')
        AND is_current = true;
    """)

    # 2. Drop description column from t_d_article
    op.drop_column('t_d_article', 'description')

    # 3. Drop index first (required before dropping column)
    op.drop_index('ix_budget_fact_transfer_id', table_name='t_f_budget_fact')

    # 4. Drop transfer_id column
    op.drop_column('t_f_budget_fact', 'transfer_id')

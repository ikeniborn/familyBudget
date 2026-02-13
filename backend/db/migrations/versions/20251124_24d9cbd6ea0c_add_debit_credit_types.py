"""add_debit_credit_types

Revision ID: 24d9cbd6ea0c
Revises: 00455b460cc8
Create Date: 2025-11-24 12:00:00.000000

Add 'debit' and 'credit' article types for user-defined transfer categories.
Removes old static transfer categories (TRF-OUT, TRF-IN).
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '24d9cbd6ea0c'
down_revision: str | None = '00455b460cc8'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add debit/credit types to Article and remove old static transfer categories."""

    # 1. Find and drop existing CHECK constraint
    # PostgreSQL auto-generates constraint name: t_d_article_type_check
    # Use DROP CONSTRAINT IF EXISTS for safety
    op.execute("""
        -- Drop old CHECK constraint (income/expense only)
        ALTER TABLE t_d_article
        DROP CONSTRAINT IF EXISTS t_d_article_type_check;
    """)

    # 2. Add new CHECK constraint with debit/credit types
    op.execute("""
        -- Add new CHECK constraint with 4 types
        ALTER TABLE t_d_article
        ADD CONSTRAINT t_d_article_type_check
        CHECK (type IN ('income', 'expense', 'debit', 'credit'));
    """)

    # 3. Delete old static transfer categories (hard delete)
    # These were created in previous migration but are no longer needed
    # Users will create their own debit/credit categories
    op.execute("""
        -- Delete old TRF-OUT category (all SCD Type 2 versions)
        DELETE FROM t_d_article
        WHERE code = 'TRF-OUT';

        -- Delete old TRF-IN category (all SCD Type 2 versions)
        DELETE FROM t_d_article
        WHERE code = 'TRF-IN';
    """)

    # 4. Add explanatory comment
    op.execute("""
        COMMENT ON CONSTRAINT t_d_article_type_check ON t_d_article IS
        'Article types: income (доход), expense (расход), debit (списание), credit (пополнение)';
    """)


def downgrade() -> None:
    """Revert to income/expense only types and restore static transfer categories."""

    # 1. Restore old static transfer categories
    # Recreate TRF-OUT and TRF-IN for backward compatibility
    op.execute("""
        -- Категория для списания (расход)
        INSERT INTO t_d_article (
            user_id,
            parent_id,
            name,
            description,
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
            'Используется для внутренних переводов между ЦФО (списание с источника)',
            'expense',
            'TRF-OUT',
            true,
            NOW(),
            '9999-12-31'::timestamp,
            true
        WHERE NOT EXISTS (
            SELECT 1 FROM t_d_article WHERE code = 'TRF-OUT'
        );

        -- Категория для пополнения (доход)
        INSERT INTO t_d_article (
            user_id,
            parent_id,
            name,
            description,
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
            'Используется для внутренних переводов между ЦФО (пополнение получателя)',
            'income',
            'TRF-IN',
            true,
            NOW(),
            '9999-12-31'::timestamp,
            true
        WHERE NOT EXISTS (
            SELECT 1 FROM t_d_article WHERE code = 'TRF-IN'
        );
    """)

    # 2. Drop CHECK constraint with debit/credit
    op.execute("""
        ALTER TABLE t_d_article
        DROP CONSTRAINT IF EXISTS t_d_article_type_check;
    """)

    # 3. Add old CHECK constraint (income/expense only)
    op.execute("""
        ALTER TABLE t_d_article
        ADD CONSTRAINT t_d_article_type_check
        CHECK (type IN ('income', 'expense'));
    """)

    # 4. Archive any user-created debit/credit categories
    # Soft delete to preserve history (SCD Type 2 pattern)
    op.execute("""
        UPDATE t_d_article
        SET is_current = false,
            valid_to = NOW()
        WHERE type IN ('debit', 'credit')
        AND is_current = true;
    """)

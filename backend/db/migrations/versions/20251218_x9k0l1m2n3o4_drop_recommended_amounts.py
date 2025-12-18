"""Drop t_recommended_amounts table and K-means functions.

This migration removes the recommended amounts feature which was never fully implemented.
The endpoint /api/v1/analytics/recommended-amounts was not created, making this functionality
non-functional.

Removed:
- Table t_recommended_amounts (cached K-means recommendations)
- Function round_to_nice(DECIMAL) (rounds amounts to "nice" numbers)
- Function recalculate_recommended_amounts() (scheduler job function)
- All associated indexes

Revision ID: x9k0l1m2n3o4
Revises: w8j9k0l1m2n3
Create Date: 2025-12-18

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'x9k0l1m2n3o4'
down_revision = 'w8j9k0l1m2n3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Drop recommended amounts table and functions."""
    # Drop table with CASCADE (removes all indexes automatically)
    op.execute("DROP TABLE IF EXISTS t_recommended_amounts CASCADE")

    # Drop K-means related functions
    op.execute("DROP FUNCTION IF EXISTS round_to_nice(DECIMAL) CASCADE")
    op.execute("DROP FUNCTION IF EXISTS recalculate_recommended_amounts() CASCADE")


def downgrade() -> None:
    """
    Recreate recommended amounts table and functions.

    Note: This is a minimal recreation for rollback purposes.
    The full implementation was never completed.
    """
    # Recreate round_to_nice function
    op.execute("""
        CREATE OR REPLACE FUNCTION round_to_nice(amount DECIMAL(15,2))
        RETURNS DECIMAL(15,2)
        LANGUAGE plpgsql
        IMMUTABLE
        AS $$
        DECLARE
            nice_numbers DECIMAL[] := ARRAY[10, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
            closest DECIMAL := nice_numbers[1];
            diff DECIMAL := ABS(amount - nice_numbers[1]);
            n DECIMAL;
        BEGIN
            FOREACH n IN ARRAY nice_numbers LOOP
                IF ABS(amount - n) < diff THEN
                    closest := n;
                    diff := ABS(amount - n);
                END IF;
            END LOOP;
            RETURN closest;
        END;
        $$;
    """)

    # Recreate table
    op.execute("""
        CREATE TABLE t_recommended_amounts (
            id SERIAL PRIMARY KEY,
            article_id INTEGER REFERENCES t_d_article(id) ON DELETE CASCADE,
            financial_center_id INTEGER REFERENCES t_d_financial_center(id) ON DELETE CASCADE,
            type VARCHAR(20),
            record_type VARCHAR(20) NOT NULL DEFAULT 'fact',
            period VARCHAR(20) NOT NULL DEFAULT 'quarter',
            amounts JSONB NOT NULL,
            metadata JSONB,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
            last_updated TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
            CONSTRAINT chk_recommended_amounts_type CHECK (type IS NULL OR type IN ('income', 'expense')),
            CONSTRAINT chk_recommended_amounts_record_type CHECK (record_type IN ('fact', 'plan')),
            CONSTRAINT chk_recommended_amounts_period CHECK (period IN ('week', 'month', 'quarter', 'year'))
        )
    """)

    # Recreate indexes
    op.execute("CREATE INDEX idx_recommended_amounts_article ON t_recommended_amounts(article_id) WHERE article_id IS NOT NULL")
    op.execute("CREATE INDEX idx_recommended_amounts_global ON t_recommended_amounts(type, record_type, period) WHERE article_id IS NULL")
    op.execute("CREATE INDEX idx_recommended_amounts_type ON t_recommended_amounts(type) WHERE type IS NOT NULL")
    op.execute("CREATE INDEX idx_recommended_amounts_record_type ON t_recommended_amounts(record_type)")
    op.execute("CREATE INDEX idx_recommended_amounts_lookup ON t_recommended_amounts(article_id, type, record_type, period)")
    op.execute("CREATE INDEX idx_recommended_amounts_last_updated ON t_recommended_amounts(last_updated)")

    # Note: recalculate_recommended_amounts() function is not recreated
    # as it's complex and the feature is being removed

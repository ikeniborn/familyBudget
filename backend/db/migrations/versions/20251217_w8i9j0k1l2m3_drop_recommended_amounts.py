"""Drop recommended amounts table and K-means functions.

Revision ID: w8i9j0k1l2m3
Revises: v7h8i9j0k1l2
Create Date: 2025-12-17

This migration removes the recommended amounts functionality:
- t_recommended_amounts table (K-means clustered amounts)
- round_to_nice(DECIMAL) function
- kmeans_init_quantile(DECIMAL[], INTEGER) function
- recalculate_recommended_amounts() function

The recommended amounts feature is being removed in favor of
simpler plan-hints (showing previous month plan/fact sums).
"""

from alembic import op


# revision identifiers
revision = 'w8i9j0k1l2m3'
down_revision = 'v7h8i9j0k1l2'
branch_labels = None
depends_on = None


def upgrade():
    """Drop recommended amounts table and functions."""
    # Drop table (CASCADE will drop any triggers/constraints)
    op.execute("DROP TABLE IF EXISTS t_recommended_amounts CASCADE")

    # Drop K-means functions
    op.execute("DROP FUNCTION IF EXISTS round_to_nice(DECIMAL)")
    op.execute("DROP FUNCTION IF EXISTS kmeans_init_quantile(DECIMAL[], INTEGER)")
    op.execute("DROP FUNCTION IF EXISTS recalculate_recommended_amounts()")


def downgrade():
    """
    Downgrade is not supported - the recommended amounts functionality
    is being permanently removed. Recreating the table and functions
    would require significant code that is no longer maintained.
    """
    # No-op: functionality is permanently removed
    pass

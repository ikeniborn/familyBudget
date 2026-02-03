"""fix_history_fk_constraints

Revision ID: 7922e6509813
Revises: 7f9e8c6d5b4a
Create Date: 2025-11-28 14:15:00.000000


Fix ON DELETE CASCADE constraints in history tables.

History tables should NOT have ON DELETE CASCADE constraints because:
1. History is an audit trail and must persist even after main record deletion
2. DELETE operations create a DELETE history record BEFORE deleting main record
3. ON DELETE CASCADE would delete the DELETE history record immediately

This migration:
- Drops FK constraints with ON DELETE CASCADE from:
  - t_d_article_history.article_id
  - t_d_financial_center_history.financial_center_id
- History integrity is enforced at application level (not database level)
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '7922e6509813'
down_revision: str | None = '7f9e8c6d5b4a'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Remove ON DELETE CASCADE constraints from history tables."""

    # Drop FK constraint from ArticleHistory
    # This constraint was causing cascade deletion of history records when article was deleted
    # History should persist for audit trail even after article deletion
    op.drop_constraint(
        'fk_article_history_article_id',
        't_d_article_history',
        type_='foreignkey'
    )

    # Drop FK constraint from FinancialCenterHistory
    # Same reasoning - history must persist after financial center deletion
    op.drop_constraint(
        'fk_financial_center_history_fc_id',
        't_d_financial_center_history',
        type_='foreignkey'
    )

    # Note: We do NOT re-create these constraints without CASCADE
    # because history tables should persist independently for audit purposes
    # Referential integrity is enforced at application level


def downgrade() -> None:
    """Restore ON DELETE CASCADE constraints (NOT RECOMMENDED)."""

    # WARNING: This downgrade will break deletion logic!
    # Only use if you need to revert for testing purposes

    # Restore FK constraint on ArticleHistory with ON DELETE CASCADE
    op.create_foreign_key(
        'fk_article_history_article_id',
        't_d_article_history',
        't_d_article',
        ['article_id'],
        ['id'],
        ondelete='CASCADE'
    )

    # Restore FK constraint on FinancialCenterHistory with ON DELETE CASCADE
    op.create_foreign_key(
        'fk_financial_center_history_fc_id',
        't_d_financial_center_history',
        't_d_financial_center',
        ['financial_center_id'],
        ['id'],
        ondelete='CASCADE'
    )

"""change_telegram_id_to_bigint

Revision ID: 272161ce0d9f
Revises: 2cb6c738c255
Create Date: 2025-11-26 22:40:38.130418

Change telegram_id column type from INTEGER to BIGINT in both t_d_user
and t_d_user_history tables to support large Telegram user IDs.

PROBLEM: Telegram user IDs can exceed INT32 max value (2,147,483,647).
For example, user ID 7842101095 causes "value out of int32 range" error.

SOLUTION: Change to BIGINT (INT64, max 9,223,372,036,854,775,807).

Tables affected:
    - t_d_user.telegram_id
    - t_d_user_history.telegram_id

Safety:
    - ALTER TYPE is safe for existing data (all values fit in BIGINT)
    - Indexes are automatically recreated by PostgreSQL
    - No downtime required (operation is fast)
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '272161ce0d9f'
down_revision: str | None = '2cb6c738c255'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Change telegram_id from INTEGER to BIGINT."""
    # Change t_d_user.telegram_id: INTEGER -> BIGINT
    op.alter_column(
        't_d_user',
        'telegram_id',
        existing_type=sa.INTEGER(),
        type_=sa.BIGINT(),
        existing_nullable=False,
        existing_server_default=None
    )

    # Change t_d_user_history.telegram_id: INTEGER -> BIGINT
    op.alter_column(
        't_d_user_history',
        'telegram_id',
        existing_type=sa.INTEGER(),
        type_=sa.BIGINT(),
        existing_nullable=False,
        existing_server_default=None
    )


def downgrade() -> None:
    """Revert telegram_id from BIGINT to INTEGER.

    WARNING: This may fail if any telegram_id values exceed INT32 max!
    Only safe if all telegram_id < 2,147,483,647.
    """
    # Revert t_d_user_history.telegram_id: BIGINT -> INTEGER
    op.alter_column(
        't_d_user_history',
        'telegram_id',
        existing_type=sa.BIGINT(),
        type_=sa.INTEGER(),
        existing_nullable=False,
        existing_server_default=None
    )

    # Revert t_d_user.telegram_id: BIGINT -> INTEGER
    op.alter_column(
        't_d_user',
        'telegram_id',
        existing_type=sa.BIGINT(),
        type_=sa.INTEGER(),
        existing_nullable=False,
        existing_server_default=None
    )

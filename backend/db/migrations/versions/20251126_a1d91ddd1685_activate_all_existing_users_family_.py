"""activate_all_existing_users_family_budget

Auto-activate all existing users for family budget use case (2-5 person family).

Previous behavior:
- New users created with is_active=False
- Required manual admin activation
- Caused 403 Forbidden errors on login

New behavior (after auth.py fix + this migration):
- All users auto-activated on creation (auth.py:221)
- Admin can manually deactivate via /admin/users if needed
- This migration activates existing inactive users

Revision ID: a1d91ddd1685
Revises: c1f8efaa5e47
Create Date: 2025-11-26 16:02:49.430089

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1d91ddd1685'
down_revision: Union[str, None] = 'c1f8efaa5e47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Activate all existing inactive users (family budget use case)
    # This is a data migration - no schema changes
    op.execute("""
        UPDATE public.t_d_user
        SET is_active = true
        WHERE is_active = false
    """)


def downgrade() -> None:
    # Downgrade is not applicable for data migration
    # Cannot know which users were originally inactive
    pass

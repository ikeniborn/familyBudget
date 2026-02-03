"""activate_admin_user_only

Activate admin user if exists and is inactive.

Previous behavior (PRD FR-030):
- Admin auto-activated on first login (auth.py:221)
- Regular users pending activation by admin
- This was correct but existing admin may be inactive in database

Fix:
- Activate existing admin user (is_admin=True) if is_active=False
- Regular users remain inactive (activated manually by admin)
- Ensures admin can always login and activate others

Revision ID: 24a93352147e
Revises: c1f8efaa5e47
Create Date: 2025-11-26 16:05:13.707518

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '24a93352147e'
down_revision: str | None = 'c1f8efaa5e47'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Activate ALL admin users (is_admin=True) unconditionally
    # Regular users (is_admin=False) remain inactive until manually activated
    # This ensures admins can always login, even if accidentally deactivated
    op.execute("""
        UPDATE public.t_d_user
        SET is_active = true
        WHERE is_admin = true
    """)


def downgrade() -> None:
    # Downgrade is not applicable for data migration
    # Cannot know original activation state of admin
    pass

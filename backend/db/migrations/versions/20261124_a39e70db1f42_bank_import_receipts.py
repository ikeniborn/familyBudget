"""Keep bank CSV source identities and durable confirmation results."""

import sqlalchemy as sa
from alembic import op

revision = "a39e70db1f42"
down_revision = "f7c3e9a1d5b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("t_import_file_upload", sa.Column("fingerprint", sa.String(64), nullable=True))
    op.add_column("t_import_staging", sa.Column("source_row", sa.Integer(), nullable=True))
    op.create_table(
        "t_import_confirmation",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("t_d_user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("confirmation_id", sa.String(64), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("response", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "confirmation_id"),
    )
    op.create_table(
        "t_import_source_receipt",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("t_d_user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("source_row", sa.Integer(), nullable=False),
        # Keep the receipt after a fact is edited or deleted.
        sa.Column("fact_id", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "fingerprint", "source_row"),
    )


def downgrade() -> None:
    op.drop_table("t_import_source_receipt")
    op.drop_table("t_import_confirmation")
    op.drop_column("t_import_staging", "source_row")
    op.drop_column("t_import_file_upload", "fingerprint")
